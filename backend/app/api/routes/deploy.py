"""
One-Command Deploy Endpoint
GET /api/deploy/{case_id}?key=sk-envelo-xxx

Returns a personalized bash script that:
  1. Installs Python agent
  2. Writes customer-specific envelo.yaml
  3. Runs envelo setup --non-interactive
  4. Customer pastes ONE command, everything happens

Usage from dashboard:
  curl -sSL https://api.sentinelauthority.org/api/deploy/ODDC-2026-00001?key=sk-envelo-xxx | bash
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from app.core.database import get_db as get_db_session
from app.models.models import Application, Certificate
import yaml
import textwrap

router = APIRouter()


def _generate_envelo_yaml(app_data: dict, cert_data: dict, api_key: str) -> str:
    """Build the customer's envelo.yaml from their approved application data."""
    config = {
        "case_id": cert_data.get("certificate_number", app_data.get("case_number", "")),
        "api_key": api_key,
        "api_endpoint": "https://api.sentinelauthority.org",
        "system_name": app_data.get("system_name", "Autonomous System"),
        "organization": app_data.get("organization_name", ""),
        "odd_version": app_data.get("odd_version", "1.0"),
    }

    # Build parameters from approved envelope definition
    envelope = app_data.get("envelope_definition") or cert_data.get("envelope_definition") or {}
    parameters = []

    # Numeric boundaries
    for b in envelope.get("numeric_boundaries", []):
        parameters.append({
            "name": b.get("name", ""),
            "unit": b.get("unit", ""),
            "tolerance_min": b.get("min_value"),
            "tolerance_max": b.get("max_value"),
            "source_type": b.get("source_type", ""),
            "source_address": b.get("source_address", ""),
            "poll_interval_ms": b.get("poll_interval_ms", 1000),
        })

    # Rate boundaries
    for b in envelope.get("rate_boundaries", []):
        parameters.append({
            "name": b.get("name", ""),
            "unit": f"per_{b.get('period', 'second')}",
            "tolerance_min": 0,
            "tolerance_max": b.get("max_value", b.get("max_per_second", 100)),
            "source_type": b.get("source_type", ""),
            "source_address": b.get("source_address", ""),
            "poll_interval_ms": b.get("poll_interval_ms", 1000),
        })

    # Geo boundaries
    for b in envelope.get("geo_boundaries", []):
        parameters.append({
            "name": b.get("name", "geo_position"),
            "unit": "coordinates",
            "tolerance_min": 0,
            "tolerance_max": 0,
            "source_type": b.get("source_type", ""),
            "source_address": b.get("source_address", ""),
            "poll_interval_ms": b.get("poll_interval_ms", 1000),
            "geo_zones": b.get("allowed_zones", []),
        })

    # State boundaries
    for b in envelope.get("state_boundaries", []):
        parameters.append({
            "name": b.get("name", ""),
            "unit": "state",
            "tolerance_min": 0,
            "tolerance_max": 0,
            "source_type": b.get("source_type", ""),
            "source_address": b.get("source_address", ""),
            "poll_interval_ms": b.get("poll_interval_ms", 1000),
            "allowed_states": b.get("allowed_values", []),
            "forbidden_states": b.get("forbidden_values", []),
        })

    # Time boundaries
    for b in envelope.get("time_boundaries", []):
        parameters.append({
            "name": b.get("name", "operating_hours"),
            "unit": "time",
            "tolerance_min": 0,
            "tolerance_max": 0,
            "source_type": "custom",
            "source_address": "system_clock",
            "poll_interval_ms": 60000,
            "allowed_days": b.get("allowed_days", []),
            "start_hour": b.get("start_hour", 0),
            "end_hour": b.get("end_hour", 24),
        })

    if not parameters:
        # Fallback: use ODD specification fields
        odd = app_data.get("odd_specification") or {}
        for key, val in odd.items():
            if isinstance(val, dict) and ("min" in val or "max" in val):
                parameters.append({
                    "name": key,
                    "unit": val.get("unit", ""),
                    "tolerance_min": val.get("min"),
                    "tolerance_max": val.get("max"),
                    "source_type": "",
                    "source_address": "",
                    "poll_interval_ms": 1000,
                })

    config["parameters"] = parameters

    return yaml.dump(config, default_flow_style=False, sort_keys=False)


def _generate_install_script(envelo_yaml: str, case_id: str) -> str:
    """Generate the all-in-one bash installer."""

    # Escape any single quotes in the yaml for safe embedding
    safe_yaml = envelo_yaml.replace("'", "'\\''")

    return textwrap.dedent(f'''\
#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  ENVELO Agent — One-Command Deploy
#  Sentinel Authority © 2026
#
#  Case: {case_id}
#  This script installs and configures everything automatically.
# ══════════════════════════════════════════════════════════════

set -e

PURPLE='\\033[35m'
GREEN='\\033[92m'
YELLOW='\\033[93m'
RED='\\033[91m'
CYAN='\\033[96m'
BOLD='\\033[1m'
DIM='\\033[2m'
RESET='\\033[0m'

clear
echo ""
echo "${{PURPLE}}${{BOLD}}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║                                                           ║"
echo "  ║    ◉  S E N T I N E L   A U T H O R I T Y                ║"
echo "  ║                                                           ║"
echo "  ║    ENVELO One-Command Deploy                              ║"
echo "  ║    Case: {case_id}                              ║"
echo "  ║                                                           ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo "${{RESET}}"
echo ""

# ── Check Python ─────────────────────────────────────────
if ! command -v python3 &> /dev/null; then
    echo "  ${{RED}}✗${{RESET}}  Python 3 not found"
    echo ""
    echo "  ${{YELLOW}}${{BOLD}}How to fix:${{RESET}}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  ${{YELLOW}}  brew install python3${{RESET}}"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  ${{YELLOW}}  sudo apt install python3 python3-pip${{RESET}}"
    fi
    exit 1
fi

PY_VER=$(python3 -c 'import sys; print(f"{{sys.version_info.major}}.{{sys.version_info.minor}}")')
PY_MAJ=$(python3 -c 'import sys; print(sys.version_info.major)')
PY_MIN=$(python3 -c 'import sys; print(sys.version_info.minor)')

if [ "$PY_MAJ" -lt 3 ] || ([ "$PY_MAJ" -eq 3 ] && [ "$PY_MIN" -lt 9 ]); then
    echo "  ${{RED}}✗${{RESET}}  Python $PY_VER too old (need 3.9+)"
    exit 1
fi
echo "  ${{GREEN}}✓${{RESET}}  Python $PY_VER"

# ── Create install directory ─────────────────────────────
INSTALL_DIR="$HOME/.envelo"
mkdir -p "$INSTALL_DIR"
echo "  ${{GREEN}}✓${{RESET}}  Install directory: $INSTALL_DIR"

# ── Write config ─────────────────────────────────────────
echo "  ${{CYAN}}↓${{RESET}}  Writing configuration..."

cat > "$INSTALL_DIR/envelo.yaml" << 'YAMLEOF'
{safe_yaml}YAMLEOF

echo "  ${{GREEN}}✓${{RESET}}  envelo.yaml written"

# ── Download agent ───────────────────────────────────────
echo "  ${{CYAN}}↓${{RESET}}  Downloading ENVELO Agent v2.0..."
cd "$INSTALL_DIR"

if [ -f "envelo-agent/envelo/__init__.py" ]; then
    echo "  ${{GREEN}}✓${{RESET}}  Agent already present, updating..."
fi

curl -sSL https://www.sentinelauthority.org/downloads/envelo-agent-v2.0.0.zip -o agent.zip 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  ${{RED}}✗${{RESET}}  Download failed"
    echo "  ${{YELLOW}}Check your internet connection and try again${{RESET}}"
    exit 1
fi
unzip -q -o agent.zip 2>/dev/null
rm -f agent.zip
echo "  ${{GREEN}}✓${{RESET}}  Agent downloaded"

# ── Install package ──────────────────────────────────────
echo "  ${{CYAN}}↓${{RESET}}  Installing..."
cd "$INSTALL_DIR/envelo-agent"

pip3 install -e . --break-system-packages --quiet 2>/dev/null || pip3 install -e . --quiet 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  ${{RED}}✗${{RESET}}  pip install failed"
    echo "  ${{YELLOW}}Try: pip3 install -e $INSTALL_DIR/envelo-agent${{RESET}}"
    exit 1
fi
echo "  ${{GREEN}}✓${{RESET}}  Agent installed"

# ── Run setup wizard ─────────────────────────────────────
echo ""
echo "  ${{BOLD}}Starting deployment wizard...${{RESET}}"
echo ""

envelo setup --config "$INSTALL_DIR/envelo.yaml"

''')


@router.get("/deploy/{{case_id}}")
async def deploy_script(
    case_id: str,
    key: str = Query(..., description="API key"),
):
    """
    Serve a personalized one-command installer.

    Customer pastes into terminal:
      curl -sSL https://api.sentinelauthority.org/api/deploy/ODDC-2026-00001?key=sk-envelo-xxx | bash
    """
    async with get_db_session() as db:
        # Find application by case number
        stmt = select(Application).where(
            Application.case_number == case_id
        )
        result = await db.execute(stmt)
        application = result.scalar_one_or_none()

        if not application:
            raise HTTPException(status_code=404, detail="Case not found")

        # Validate API key
        stmt_key = select(APIKey).where(
            APIKey.application_id == application.id,
            APIKey.key == key,
            APIKey.is_active == True
        )
        result_key = await db.execute(stmt_key)
        api_key_record = result_key.scalar_one_or_none()

        if not api_key_record:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Check application is approved
        if application.status not in ("approved", "certified", "active"):
            raise HTTPException(
                status_code=403,
                detail=f"Application status is '{application.status}'. Must be approved first."
            )

        # Get certificate if exists
        cert_data = {}
        if hasattr(application, 'certificate') and application.certificate:
            cert = application.certificate
            cert_data = {
                "certificate_number": cert.certificate_number,
                "envelope_definition": cert.envelope_definition,
            }

        # Build the app data dict
        app_data = {
            "case_number": application.case_number,
            "system_name": application.system_name,
            "organization_name": application.organization_name,
            "odd_specification": application.odd_specification,
            "envelope_definition": application.envelope_definition,
            "odd_version": getattr(application, 'odd_version', '1.0'),
        }

        # Generate personalized config
        envelo_yaml = _generate_envelo_yaml(app_data, cert_data, key)

        # Generate install script
        script = _generate_install_script(envelo_yaml, case_id)

        return PlainTextResponse(
            content=script,
            media_type="text/x-shellscript",
            headers={
                "Content-Disposition": f"inline; filename=envelo-deploy-{case_id}.sh",
                "Cache-Control": "no-store",
            }
        )


@router.get("/deploy/{{case_id}}/config")
async def deploy_config_only(
    case_id: str,
    key: str = Query(..., description="API key"),
):
    """
    Serve just the envelo.yaml (for customers who already have the agent).
    """
    async with get_db_session() as db:
        stmt = select(Application).where(Application.case_number == case_id)
        result = await db.execute(stmt)
        application = result.scalar_one_or_none()

        if not application:
            raise HTTPException(status_code=404, detail="Case not found")

        stmt_key = select(APIKey).where(
            APIKey.application_id == application.id,
            APIKey.key == key,
            APIKey.is_active == True
        )
        result_key = await db.execute(stmt_key)
        if not result_key.scalar_one_or_none():
            raise HTTPException(status_code=401, detail="Invalid API key")

        cert_data = {}
        if hasattr(application, 'certificate') and application.certificate:
            cert_data = {
                "certificate_number": application.certificate.certificate_number,
                "envelope_definition": application.certificate.envelope_definition,
            }

        app_data = {
            "case_number": application.case_number,
            "system_name": application.system_name,
            "organization_name": application.organization_name,
            "odd_specification": application.odd_specification,
            "envelope_definition": application.envelope_definition,
        }

        envelo_yaml = _generate_envelo_yaml(app_data, cert_data, key)

        return PlainTextResponse(
            content=envelo_yaml,
            media_type="text/yaml",
            headers={
                "Content-Disposition": f"attachment; filename=envelo.yaml",
                "Cache-Control": "no-store",
            }
        )
