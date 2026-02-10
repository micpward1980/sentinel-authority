"""
One-Command Deploy Endpoint
GET /api/deploy/{case_id}?key=sa_live_xxx

Returns a bash script that installs, configures, starts, and
auto-restarts the ENVELO agent. Customer pastes one command.
"""

import hashlib
import textwrap
import yaml
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Application, Certificate, APIKey

router = APIRouter()


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


async def _validate_key(db, key: str):
    key_hash = _hash_key(key)
    result = await db.execute(
        select(APIKey).where(APIKey.key_hash == key_hash, APIKey.is_active == True)
    )
    return result.scalar_one_or_none()


async def _find_case(db, case_id: str):
    """Find by application_number or certificate_number."""
    result = await db.execute(
        select(Application).where(Application.application_number == case_id)
    )
    app = result.scalar_one_or_none()
    if app:
        cert_r = await db.execute(
            select(Certificate).where(Certificate.application_id == app.id)
        )
        return app, cert_r.scalar_one_or_none()

    cert_r = await db.execute(
        select(Certificate).where(Certificate.certificate_number == case_id)
    )
    cert = cert_r.scalar_one_or_none()
    if cert:
        app_r = await db.execute(
            select(Application).where(Application.id == cert.application_id)
        )
        return app_r.scalar_one_or_none(), cert

    return None, None


def _build_yaml(app, cert, api_key: str) -> str:
    envelope = {}
    if cert and hasattr(cert, 'envelope_definition') and cert.envelope_definition:
        envelope = cert.envelope_definition
    elif hasattr(app, 'envelope_definition') and app.envelope_definition:
        envelope = app.envelope_definition

    config = {
        "sentinel_authority": {
            "api_endpoint": "https://sentinel-authority-production.up.railway.app",
            "api_key": api_key,
            "certificate": getattr(cert, 'certificate_number', None) or app.application_number,
            "system_name": app.system_name or "Autonomous System",
            "organization": app.organization_name or "",
        },
        "boundaries": {
            "numeric": [
                {"name": b.get("name",""), "parameter": b.get("parameter", b.get("name","")),
                 "min": b.get("min_value"), "max": b.get("max_value"),
                 "hard_limit": b.get("hard_limit"), "unit": b.get("unit",""), "tolerance": b.get("tolerance",0)}
                for b in envelope.get("numeric_boundaries", [])
            ],
            "geographic": [
                {"name": b.get("name",""), "type": b.get("boundary_type","circle"),
                 "center_lat": (b.get("center") or {}).get("lat") or b.get("lat"),
                 "center_lon": (b.get("center") or {}).get("lon") or b.get("lon"),
                 "radius_meters": b.get("radius_meters", 1000),
                 "altitude_min": b.get("altitude_min"), "altitude_max": b.get("altitude_max")}
                for b in envelope.get("geographic_boundaries", [])
            ],
            "time": [
                {"name": b.get("name",""),
                 "start_hour": b.get("allowed_hours_start", b.get("start_hour", 0)),
                 "end_hour": b.get("allowed_hours_end", b.get("end_hour", 24)),
                 "days": b.get("allowed_days", b.get("days", [0,1,2,3,4,5,6])),
                 "timezone": b.get("timezone", "UTC")}
                for b in envelope.get("time_boundaries", [])
            ],
            "state": [
                {"name": b.get("name",""), "parameter": b.get("parameter",""),
                 "allowed": b.get("allowed_values", []), "forbidden": b.get("forbidden_values", [])}
                for b in envelope.get("state_boundaries", [])
            ],
        }
    }
    return yaml.dump(config, default_flow_style=False, sort_keys=False)


def _build_agent(api_key: str, certificate: str, system_name: str) -> str:
    return textwrap.dedent(f'''\
#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
Enforced Non-Violable Execution-Limit Override
System: {system_name} | Certificate: {certificate}
"""

import os, sys, time, json, uuid, signal, threading, logging
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

try:
    import httpx
except ImportError:
    os.system(f"{{sys.executable}} -m pip install httpx -q")
    import httpx

try:
    import yaml
except ImportError:
    os.system(f"{{sys.executable}} -m pip install pyyaml -q")
    import yaml

CONFIG_PATH = Path.home() / ".envelo" / "envelo.yaml"
if CONFIG_PATH.exists():
    with open(CONFIG_PATH) as _f:
        _cfg = yaml.safe_load(_f)
    _sa = _cfg.get("sentinel_authority", {{}})
    API_ENDPOINT = _sa.get("api_endpoint", "https://sentinel-authority-production.up.railway.app")
    API_KEY = _sa.get("api_key", "{api_key}")
    CERTIFICATE = _sa.get("certificate", "{certificate}")
    SYSTEM_NAME = _sa.get("system_name", "{system_name}")
else:
    API_ENDPOINT = "https://sentinel-authority-production.up.railway.app"
    API_KEY = "{api_key}"
    CERTIFICATE = "{certificate}"
    SYSTEM_NAME = "{system_name}"

logging.basicConfig(level=logging.INFO, format="[ENVELO] %(message)s")
log = logging.getLogger("envelo")


class Boundary:
    def __init__(self, name, parameter=None, min_value=None, max_value=None,
                 hard_limit=None, unit="", tolerance=0, **kw):
        self.name = name
        self.parameter = parameter or name
        self.min_value = float(min_value) if min_value is not None else None
        self.max_value = float(max_value) if max_value is not None else None
        self.hard_limit = float(hard_limit) if hard_limit is not None else None
        self.unit = unit
        self.tolerance = float(tolerance) if tolerance else 0

    def check(self, value):
        v = float(value)
        if self.hard_limit is not None and v > self.hard_limit:
            return False, f"{{self.name}}={{v}}{{self.unit}} exceeds hard limit {{self.hard_limit}}{{self.unit}}"
        if self.min_value is not None and v < self.min_value - self.tolerance:
            return False, f"{{self.name}}={{v}}{{self.unit}} below min {{self.min_value}}{{self.unit}}"
        if self.max_value is not None and v > self.max_value + self.tolerance:
            return False, f"{{self.name}}={{v}}{{self.unit}} above max {{self.max_value}}{{self.unit}}"
        return True, None


class EnveloAgent:
    def __init__(self):
        self.client = httpx.Client(
            base_url=API_ENDPOINT,
            headers={{"Authorization": f"Bearer {{API_KEY}}"}},
            timeout=15,
        )
        self.session_id = uuid.uuid4().hex
        self.boundaries = {{}}
        self.telemetry_buffer = []
        self.stats = {{"pass": 0, "block": 0}}
        self.running = False
        self._threads = []

    def start(self):
        log.info("Starting ENVELO Agent v2.0.0")
        log.info(f"  System:      {{SYSTEM_NAME}}")
        log.info(f"  Certificate: {{CERTIFICATE}}")

        if CONFIG_PATH.exists():
            with open(CONFIG_PATH) as f:
                cfg = yaml.safe_load(f)
            for b in cfg.get("boundaries", {{}}).get("numeric", []):
                self.boundaries[b.get("parameter", b["name"])] = Boundary(
                    name=b["name"], parameter=b.get("parameter"),
                    min_value=b.get("min"), max_value=b.get("max"),
                    hard_limit=b.get("hard_limit"), unit=b.get("unit",""),
                    tolerance=b.get("tolerance", 0))
            log.info(f"  Boundaries:  {{len(self.boundaries)}} from config")

        try:
            res = self.client.get("/api/envelo/boundaries/config")
            if res.status_code == 200:
                for b in res.json().get("numeric_boundaries", []):
                    self.boundaries[b.get("parameter", b["name"])] = Boundary(**b)
                log.info(f"  Boundaries:  {{len(self.boundaries)}} synced from server")
        except Exception as e:
            log.warning(f"  Server sync: {{e}}")

        try:
            self.client.post("/api/envelo/sessions", json={{
                "certificate_id": CERTIFICATE, "session_id": self.session_id,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "agent_version": "2.0.0", "system_name": SYSTEM_NAME,
                "boundaries": [{{"name": b.name, "min": b.min_value, "max": b.max_value}} for b in self.boundaries.values()],
            }})
            log.info(f"  Session:     {{self.session_id[:16]}}...")
        except Exception as e:
            log.warning(f"  Session: {{e}}")

        self.running = True
        for target in [self._heartbeat_loop, self._flush_loop]:
            t = threading.Thread(target=target, daemon=True); t.start(); self._threads.append(t)
        log.info("  Status:      RUNNING")
        return self

    def shutdown(self):
        log.info("Shutting down...")
        self.running = False
        self._flush_telemetry()
        try:
            self.client.post(f"/api/envelo/sessions/{{self.session_id}}/end", json={{
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "final_stats": {{"pass_count": self.stats["pass"], "block_count": self.stats["block"]}},
            }})
        except: pass
        self.client.close()
        log.info(f"Done. {{self.stats['pass']}} passed, {{self.stats['block']}} blocked.")

    def _cleanup(self):
        """Disable auto-restart when key is revoked."""
        import pathlib, subprocess
        pid_file = pathlib.Path.home() / ".envelo" / "envelo.pid"
        if pid_file.exists(): pid_file.unlink()
        try:
            subprocess.run(["systemctl", "--user", "stop", "envelo.service"], capture_output=True)
            subprocess.run(["systemctl", "--user", "disable", "envelo.service"], capture_output=True)
        except: pass
        plist = pathlib.Path.home() / "Library" / "LaunchAgents" / "org.sentinelauthority.envelo.plist"
        if plist.exists():
            try: subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
            except: pass
        log.info("Auto-restart disabled.")

    def add_boundary(self, name, min_value=None, max_value=None, unit="", tolerance=0):
        self.boundaries[name] = Boundary(name=name, min_value=min_value, max_value=max_value, unit=unit, tolerance=tolerance)

    def check(self, parameter, value):
        if parameter not in self.boundaries: return True, None
        return self.boundaries[parameter].check(value)

    def enforce_params(self, **params):
        violations, evals = [], []
        for p, v in params.items():
            passed, msg = self.check(p, v)
            evals.append({{"boundary": p, "passed": passed}})
            if not passed: violations.append({{"boundary": p, "value": v, "message": msg}})
        result = "PASS" if not violations else "BLOCK"
        self.telemetry_buffer.append({{
            "timestamp": datetime.now(timezone.utc).isoformat(), "action_id": uuid.uuid4().hex[:8],
            "action_type": "boundary_check", "result": result,
            "parameters": dict(params), "boundary_evaluations": evals,
        }})
        if violations:
            self.stats["block"] += 1
            for vi in violations: log.warning(f"VIOLATION: {{vi['message']}}")
            return False, violations
        self.stats["pass"] += 1
        return True, []

    def enforce(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            passed, violations = self.enforce_params(**kwargs)
            if not passed: raise RuntimeError(f"ENVELO BLOCK: {{violations[0]['message']}}")
            return func(*args, **kwargs)
        return wrapper

    def _heartbeat_loop(self):
        fail_count = 0
        while self.running:
            try:
                res = self.client.post("/api/envelo/heartbeat", json={{
                    "session_id": self.session_id, "certificate_id": CERTIFICATE,
                    "timestamp": datetime.now(timezone.utc).isoformat(), "stats": self.stats,
                }})
                if res.status_code == 401:
                    log.warning("API key revoked - shutting down")
                    self.running = False; self._flush_telemetry(); self._cleanup(); return
                fail_count = 0
            except:
                fail_count += 1
                if fail_count >= 10:
                    log.warning(f"Lost connection ({{fail_count}} failures) - stopping")
                    self.running = False; return
            time.sleep(30)

    def _flush_loop(self):
        while self.running: time.sleep(10); self._flush_telemetry()

    def _flush_telemetry(self):
        if not self.telemetry_buffer: return
        batch, self.telemetry_buffer = self.telemetry_buffer[:], []
        try:
            res = self.client.post("/api/envelo/telemetry", json={{
                "certificate_id": CERTIFICATE, "session_id": self.session_id,
                "records": batch, "stats": {{"pass_count": self.stats["pass"], "block_count": self.stats["block"]}},
            }})
            if res.status_code == 401:
                log.warning("API key revoked - shutting down")
                self.running = False; self._cleanup(); return
        except Exception as e:
            log.warning(f"Telemetry flush failed: {{e}}")
            self.telemetry_buffer = batch + self.telemetry_buffer


agent = EnveloAgent()

def _sig(s, f): agent.shutdown(); sys.exit(0)
signal.signal(signal.SIGINT, _sig)
signal.signal(signal.SIGTERM, _sig)

if __name__ == "__main__":
    agent.start()
    print()
    print("ENVELO Agent running. Ctrl+C to stop.")
    print("Dashboard: https://app.sentinelauthority.org/envelo")
    print()
    try:
        while agent.running: time.sleep(1)
    except KeyboardInterrupt:
        agent.shutdown()
''')


def _build_installer(envelo_yaml: str, agent_py: str, case_id: str, system_name: str) -> str:
    safe_yaml = envelo_yaml.replace("'", "'\\''")
    safe_agent = agent_py.replace("'", "'\\''")

    return textwrap.dedent(f'''\
#!/bin/bash
set -e
P=\'\\033[35m\'; G=\'\\033[92m\'; Y=\'\\033[93m\'; R=\'\\033[91m\'; C=\'\\033[96m\'; B=\'\\033[1m\'; X=\'\\033[0m\'
D="$HOME/.envelo"

clear
echo ""
echo "${{P}}${{B}}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║    ◉  S E N T I N E L   A U T H O R I T Y                ║"
echo "  ║    ENVELO Deploy                                          ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo "${{X}}"
echo ""

# Python check
if ! command -v python3 &>/dev/null; then
    echo "  ${{R}}✗${{X}} Python 3 required"
    [[ "$OSTYPE" == "darwin"* ]] && echo "    brew install python3"
    [[ "$OSTYPE" == "linux-gnu"* ]] && echo "    sudo apt install python3 python3-pip"
    exit 1
fi
echo "  ${{G}}✓${{X}} Python $(python3 -c \'import sys;print(f"{{sys.version_info.major}}.{{sys.version_info.minor}}")\' )"

# Install files
mkdir -p "$D"

cat > "$D/envelo.yaml" << \'YAMLEOF\'
{safe_yaml}YAMLEOF

cat > "$D/envelo_agent.py" << \'AGENTEOF\'
{safe_agent}AGENTEOF
chmod +x "$D/envelo_agent.py"
echo "  ${{G}}✓${{X}} Agent installed"

python3 -m pip install httpx pyyaml -q --break-system-packages 2>/dev/null || python3 -m pip install httpx pyyaml -q 2>/dev/null
echo "  ${{G}}✓${{X}} Dependencies ready"

# Stop existing
[ -f "$D/envelo.pid" ] && kill $(cat "$D/envelo.pid") 2>/dev/null && echo "  ${{Y}}↻${{X}} Stopped previous agent"
rm -f "$D/envelo.pid"

# Verify connection
echo "  ${{C}}↓${{X}} Connecting..."
python3 -c "
import httpx,yaml
sa=yaml.safe_load(open(\'$D/envelo.yaml\'))[\'sentinel_authority\']
try:
    r=httpx.get(sa[\'api_endpoint\']+\'/health\',timeout=10)
    print(\'  \\033[92m✓\\033[0m Connected\' if r.status_code==200 else f\'  \\033[93m⚠\\033[0m Server {{r.status_code}}\')
except Exception as e: print(f\'  \\033[93m⚠\\033[0m {{e}} (will retry)\')
"

# Start agent
nohup python3 "$D/envelo_agent.py" > "$D/envelo.log" 2>&1 &
echo "$!" > "$D/envelo.pid"
sleep 2
if kill -0 $(cat "$D/envelo.pid") 2>/dev/null; then
    echo "  ${{G}}✓${{X}} Agent running (PID $(cat $D/envelo.pid))"
else
    echo "  ${{R}}✗${{X}} Failed. See $D/envelo.log"; exit 1
fi

# Auto-restart
if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v systemctl &>/dev/null; then
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/envelo.service" << SVCEOF
[Unit]
Description=ENVELO Agent
After=network-online.target
[Service]
Type=simple
ExecStart=$(which python3) $D/envelo_agent.py
Restart=always
RestartSec=10
WorkingDirectory=$D
[Install]
WantedBy=default.target
SVCEOF
    systemctl --user daemon-reload 2>/dev/null
    systemctl --user enable envelo.service 2>/dev/null
    systemctl --user restart envelo.service 2>/dev/null
    loginctl enable-linger $(whoami) 2>/dev/null
    echo "  ${{G}}✓${{X}} Auto-restart (systemd)"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$HOME/Library/LaunchAgents/org.sentinelauthority.envelo.plist" << PEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>org.sentinelauthority.envelo</string>
<key>ProgramArguments</key><array><string>$(which python3)</string><string>$D/envelo_agent.py</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>WorkingDirectory</key><string>$D</string>
<key>StandardOutPath</key><string>$D/envelo.log</string>
<key>StandardErrorPath</key><string>$D/envelo.log</string>
</dict></plist>
PEOF
    launchctl unload "$HOME/Library/LaunchAgents/org.sentinelauthority.envelo.plist" 2>/dev/null
    launchctl load "$HOME/Library/LaunchAgents/org.sentinelauthority.envelo.plist" 2>/dev/null
    echo "  ${{G}}✓${{X}} Auto-restart (launchd)"
else
    (crontab -l 2>/dev/null | grep -v envelo_agent; echo "@reboot python3 $D/envelo_agent.py >> $D/envelo.log 2>&1 &") | crontab -
    echo "  ${{G}}✓${{X}} Auto-restart (crontab)"
fi

echo ""
echo "  ${{G}}${{B}}✓ ENVELO Active${{X}}"
echo ""
echo "  Dashboard: https://app.sentinelauthority.org/envelo"
echo "  Logs:      $D/envelo.log"
echo "  Stop:      kill \$(cat $D/envelo.pid)"
echo ""
''')


@router.get("/deploy/{case_id}")
async def deploy_script(
    case_id: str,
    key: str = Query(..., description="API key"),
    db = Depends(get_db),
):
    """One-command installer. curl -sSL '...?key=xxx' | bash"""
    try:
        api_key_record = await _validate_key(db, key)
        if not api_key_record:
            raise HTTPException(status_code=401, detail="Invalid API key")

        application, certificate = await _find_case(db, case_id)
        if not application:
            raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

        state_str = application.state.value if hasattr(application.state, 'value') else str(application.state)
        if state_str not in ('approved', 'testing', 'conformant', 'active', 'certified', 'bounded', 'observe'):
            raise HTTPException(status_code=403, detail=f"State is '{state_str}'. Must be approved.")

        cert_num = certificate.certificate_number if certificate else application.application_number
        sys_name = application.system_name or "Autonomous System"

        envelo_yaml = _build_yaml(application, certificate, key)
        agent_py = _build_agent(key, cert_num, sys_name)
        script = _build_installer(envelo_yaml, agent_py, case_id, sys_name)

        return PlainTextResponse(
            content=script,
            media_type="text/x-shellscript",
            headers={"Content-Disposition": f"inline; filename=envelo-deploy-{case_id}.sh", "Cache-Control": "no-store"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy build error: {str(e)}")


@router.get("/deploy/{case_id}/config")
async def deploy_config_only(
    case_id: str,
    key: str = Query(..., description="API key"),
    db = Depends(get_db),
):
    """Just the envelo.yaml for customers who already have the agent."""
        api_key_record = await _validate_key(db, key)
        if not api_key_record:
            raise HTTPException(status_code=401, detail="Invalid API key")

        application, certificate = await _find_case(db, case_id)
        if not application:
            raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

        envelo_yaml = _build_yaml(application, certificate, key)
        return PlainTextResponse(
            content=envelo_yaml,
            media_type="text/yaml",
            headers={"Content-Disposition": "attachment; filename=envelo.yaml", "Cache-Control": "no-store"},
        )
