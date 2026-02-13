"""CAT-72 Console routes - Core conformance testing engine."""

import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_role, org_filter
from app.core.config import settings
from app.services.email_service import (
    send_test_setup_instructions, send_test_started, send_test_failed,
    send_certificate_issued, send_learning_started, send_learning_complete,
    send_first_interlock
)
from app.services.audit_service import write_audit_log
from app.models.models import (
    CAT72Test, Application, Telemetry, InterlockEvent, 
    TestState, CertificationState, UserRole, Certificate, User
)

router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================

class TestCreate(BaseModel):
    application_id: int
    duration_hours: int = 72


class TelemetryInput(BaseModel):
    state_vector: Dict[str, Any]
    timestamp: Optional[datetime] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def compute_hash(data: dict, prev_hash: str = "") -> str:
    """Compute SHA-256 hash for evidence chain."""
    payload = json.dumps(data, sort_keys=True, default=str) + prev_hash
    return hashlib.sha256(payload.encode()).hexdigest()



# ── AUTO-LEARNING ENDPOINTS ──────────────────────────────────

def profile_state_vector(profile: dict, state_vector: dict, prev_sv: dict = None, interval_s: float = None):
    """Accumulate statistics for every variable in a state vector.
    
    Profile structure per variable:
    {
        "var_name": {
            "count": int,
            "type": "numeric"|"categorical"|"boolean"|"list",
            "min": float, "max": float, "sum": float, "sum_sq": float,  # numeric
            "unique_values": [str],  # categorical
            "true_count": int, "false_count": int,  # boolean
            "max_rate": float,  # rate of change
            "max_gap_s": float,  # connectivity
            "positions": [[lat,lng], ...],  # geographic (sampled)
        }
    }
    """
    if not profile.get("variables"):
        profile["variables"] = {}
    if not profile.get("sample_count"):
        profile["sample_count"] = 0
    if not profile.get("timestamps"):
        profile["timestamps"] = []
    
    profile["sample_count"] = profile.get("sample_count", 0) + 1
    
    # Track sample gap for connectivity learning
    if interval_s is not None:
        if "max_gap_s" not in profile:
            profile["max_gap_s"] = interval_s
        else:
            profile["max_gap_s"] = max(profile["max_gap_s"], interval_s)
        if "avg_gap_s" not in profile:
            profile["avg_gap_s"] = interval_s
            profile["gap_count"] = 1
        else:
            profile["gap_count"] = profile.get("gap_count", 0) + 1
            profile["avg_gap_s"] = (profile["avg_gap_s"] * (profile["gap_count"] - 1) + interval_s) / profile["gap_count"]
    
    for key, value in state_vector.items():
        if key not in profile["variables"]:
            profile["variables"][key] = {"count": 0}
        
        var_prof = profile["variables"][key]
        var_prof["count"] = var_prof.get("count", 0) + 1
        
        # Determine type and accumulate
        if isinstance(value, bool) or str(value).lower() in ("true", "false"):
            var_prof["type"] = "boolean"
            is_true = value is True or str(value).lower() == "true"
            var_prof["true_count"] = var_prof.get("true_count", 0) + (1 if is_true else 0)
            var_prof["false_count"] = var_prof.get("false_count", 0) + (0 if is_true else 1)
        
        elif isinstance(value, (int, float)):
            var_prof["type"] = "numeric"
            fv = float(value)
            if "min" not in var_prof or fv < var_prof["min"]:
                var_prof["min"] = fv
            if "max" not in var_prof or fv > var_prof["max"]:
                var_prof["max"] = fv
            var_prof["sum"] = var_prof.get("sum", 0) + fv
            var_prof["sum_sq"] = var_prof.get("sum_sq", 0) + fv * fv
            
            # Rate of change
            if prev_sv and key in prev_sv and interval_s and interval_s > 0:
                try:
                    prev_fv = float(prev_sv[key])
                    rate = abs(fv - prev_fv) / interval_s
                    if "max_rate" not in var_prof or rate > var_prof["max_rate"]:
                        var_prof["max_rate"] = rate
                except (ValueError, TypeError):
                    pass
            
            # Geographic detection (lat/lng)
            if key.lower() in ("latitude", "lat"):
                positions = profile.get("_positions", [])
                lng_key = None
                for k in state_vector:
                    if k.lower() in ("longitude", "lng", "lon"):
                        lng_key = k
                        break
                if lng_key and lng_key in state_vector:
                    try:
                        pos = [float(value), float(state_vector[lng_key])]
                        # Sample positions (keep max 200)
                        if len(positions) < 200:
                            positions.append(pos)
                        profile["_positions"] = positions
                    except:
                        pass
        
        elif isinstance(value, list):
            var_prof["type"] = "list"
            var_prof["max_length"] = max(var_prof.get("max_length", 0), len(value))
        
        elif isinstance(value, str):
            # Try to parse as number
            try:
                fv = float(value)
                var_prof["type"] = "numeric"
                if "min" not in var_prof or fv < var_prof["min"]:
                    var_prof["min"] = fv
                if "max" not in var_prof or fv > var_prof["max"]:
                    var_prof["max"] = fv
                var_prof["sum"] = var_prof.get("sum", 0) + fv
                var_prof["sum_sq"] = var_prof.get("sum_sq", 0) + fv * fv
            except ValueError:
                var_prof["type"] = "categorical"
                if "unique_values" not in var_prof:
                    var_prof["unique_values"] = []
                if value.lower() not in [v.lower() for v in var_prof["unique_values"]]:
                    if len(var_prof["unique_values"]) < 100:
                        var_prof["unique_values"].append(value)
    
    return profile


def generate_boundaries_from_profile(profile: dict, margin: float = 0.1) -> list:
    """Auto-generate boundary definitions from a learned profile.
    
    Args:
        profile: Accumulated variable statistics
        margin: Safety margin (0.1 = 10% beyond observed range)
    
    Returns:
        List of boundary definition dicts ready for envelope_definition
    """
    boundaries = []
    variables = profile.get("variables", {})
    sample_count = profile.get("sample_count", 0)
    
    if sample_count < 10:
        return boundaries  # Not enough data
    
    for var_name, vp in variables.items():
        vtype = vp.get("type", "unknown")
        count = vp.get("count", 0)
        
        if count < 5:
            continue  # Skip rarely-seen variables
        
        # Skip position variables (handled separately as geographic)
        if var_name.lower() in ("latitude", "lat", "longitude", "lng", "lon"):
            continue
        
        if vtype == "numeric":
            obs_min = vp.get("min", 0)
            obs_max = vp.get("max", 0)
            obs_range = obs_max - obs_min
            margin_val = max(obs_range * margin, 0.01)  # minimum margin
            
            boundaries.append({
                "name": var_name,
                "type": "numeric",
                "min": round(obs_min - margin_val, 4),
                "max": round(obs_max + margin_val, 4),
                "learned": True,
                "observed_min": round(obs_min, 4),
                "observed_max": round(obs_max, 4),
                "sample_count": count
            })
            
            # Rate of change boundary if observed
            if "max_rate" in vp and vp["max_rate"] > 0:
                boundaries.append({
                    "name": f"{var_name}_rate",
                    "type": "rate_of_change",
                    "variable": var_name,
                    "max_rate": round(vp["max_rate"] * (1 + margin), 4),
                    "learned": True,
                    "observed_max_rate": round(vp["max_rate"], 4)
                })
        
        elif vtype == "categorical":
            unique = vp.get("unique_values", [])
            if unique:
                boundaries.append({
                    "name": var_name,
                    "type": "categorical",
                    "allowed": unique,
                    "learned": True,
                    "sample_count": count
                })
        
        elif vtype == "boolean":
            tc = vp.get("true_count", 0)
            fc = vp.get("false_count", 0)
            # If >95% true, it's probably required to be true (sensor health)
            if tc > 0 and fc == 0:
                boundaries.append({
                    "name": var_name,
                    "type": "boolean",
                    "variable": var_name,
                    "required_value": True,
                    "learned": True,
                    "confidence": 1.0,
                    "sample_count": count
                })
            elif fc > 0 and tc == 0:
                boundaries.append({
                    "name": var_name,
                    "type": "boolean",
                    "variable": var_name,
                    "required_value": False,
                    "learned": True,
                    "confidence": 1.0,
                    "sample_count": count
                })
            elif tc / (tc + fc) > 0.95:
                boundaries.append({
                    "name": var_name,
                    "type": "boolean",
                    "variable": var_name,
                    "required_value": True,
                    "learned": True,
                    "confidence": round(tc / (tc + fc), 4),
                    "sample_count": count
                })
    
    # Geographic boundary from positions
    positions = profile.get("_positions", [])
    if len(positions) >= 5:
        lats = [p[0] for p in positions]
        lngs = [p[1] for p in positions]
        center_lat = sum(lats) / len(lats)
        center_lng = sum(lngs) / len(lngs)
        
        # Calculate max distance from center (haversine)
        import math
        max_dist = 0
        R = 6371000
        for lat, lng in positions:
            lat1, lat2 = math.radians(center_lat), math.radians(lat)
            dlat = math.radians(lat - center_lat)
            dlng = math.radians(lng - center_lng)
            a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            max_dist = max(max_dist, R * c)
        
        boundaries.append({
            "name": "learned_geofence",
            "type": "geographic",
            "center_lat": round(center_lat, 6),
            "center_lng": round(center_lng, 6),
            "radius_m": round(max_dist * (1 + margin), 1),
            "learned": True,
            "observed_max_radius_m": round(max_dist, 1),
            "position_samples": len(positions)
        })
    
    # Connectivity boundary from sample gaps
    max_gap = profile.get("max_gap_s")
    avg_gap = profile.get("avg_gap_s")
    if max_gap and avg_gap:
        boundaries.append({
            "name": "learned_heartbeat",
            "type": "connectivity",
            "max_gap_seconds": round(max_gap * 3, 1),  # 3x observed max gap
            "learned": True,
            "observed_max_gap_s": round(max_gap, 2),
            "observed_avg_gap_s": round(avg_gap, 2)
        })
    
    return boundaries




# ── TELEMETRY RATE LIMITING ──────────────────────────────────
_telem_rate = {}  # {test_id: [timestamp, ...]}
_TELEM_MAX_PER_MINUTE = 120  # max samples per minute per test
_TELEM_MAX_PER_SECOND = 10   # burst limit

def check_telemetry_rate(test_id: str) -> bool:
    """Returns True if within rate limits, False if exceeded."""
    from time import time
    now = time()
    if test_id not in _telem_rate:
        _telem_rate[test_id] = []
    # Prune entries older than 60 seconds
    _telem_rate[test_id] = [t for t in _telem_rate[test_id] if now - t < 60]
    # Check per-minute limit
    if len(_telem_rate[test_id]) >= _TELEM_MAX_PER_MINUTE:
        return False
    # Check per-second burst limit
    recent = [t for t in _telem_rate[test_id] if now - t < 1]
    if len(recent) >= _TELEM_MAX_PER_SECOND:
        return False
    _telem_rate[test_id].append(now)
    return True

async def verify_test_access(test, user: dict, db):
    """Verify user has access to this test's application org."""
    if user.get("role") == "admin":
        return True
    org_id = user.get("organization_id")
    if org_id is None:
        # Check direct ownership via application
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        app = app_result.scalar_one_or_none()
        if app and app.applicant_id == int(user.get("sub", 0)):
            return True
        raise HTTPException(status_code=403, detail="Access denied — test belongs to another organization")
    app_result = await db.execute(select(Application).where(Application.id == test.application_id))
    app = app_result.scalar_one_or_none()
    if not app or app.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied — test belongs to another organization")
    return True

@router.post("/tests/{test_id}/start-learning")
async def start_learning(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Start a test in learning mode. Telemetry is collected and profiled
    but not enforced. No interlock activations during learning."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Test not found")
    if test.state not in ("scheduled", "spec_review"):
        raise HTTPException(400, f"Cannot start learning from state '{test.state}'")
    await verify_test_access(test, current_user, db)
    
    test.state = "learning"
    test.started_at = datetime.utcnow()
    # Initialize learning profile in a JSON field
    env = dict(test.envelope_definition or {})
    env["_learning_profile"] = {"variables": {}, "sample_count": 0}
    test.envelope_definition = env
    from sqlalchemy.orm.attributes import flag_modified as _fm2
    _fm2(test, "envelope_definition")
    
    await db.commit()
    
    return {
        "test_id": test_id,
        "state": "learning",
        "started_at": test.started_at.isoformat(),
        "message": "Learning mode active — telemetry collected, boundaries not enforced. Submit samples, then call /learn-complete when ready."
    }

    # Notify owner
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        app = app_result.scalar_one_or_none()
        if app:
            owner_result = await db.execute(select(User).where(User.id == app.applicant_id))
            owner = owner_result.scalar_one_or_none()
            if owner:
                await send_learning_started(owner.email, app.system_name, test.test_id)
    except Exception as e:
        print(f"Failed to send learning-started email: {e}")


@router.get("/tests/{test_id}/learned-boundaries")
async def get_learned_boundaries(
    test_id: str,
    margin: float = 0.1,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Preview what boundaries would be auto-generated from learning data."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Test not found")
    
    env = test.envelope_definition or {}
    profile = env.get("_learning_profile") or {}
    
    if not profile or profile.get("sample_count", 0) < 10:
        return {
            "test_id": test_id,
            "samples_collected": profile.get("sample_count", 0),
            "message": "Need at least 10 samples to generate boundaries",
            "boundaries": []
        }
    
    boundaries = generate_boundaries_from_profile(profile, margin=margin)
    
    # Compute stats
    variables = profile.get("variables", {})
    var_stats = {}
    for vn, vp in variables.items():
        stats = {"type": vp.get("type"), "count": vp.get("count", 0)}
        if vp.get("type") == "numeric":
            count = vp.get("count", 1)
            mean = vp.get("sum", 0) / count if count > 0 else 0
            variance = (vp.get("sum_sq", 0) / count - mean * mean) if count > 0 else 0
            stats["min"] = round(vp.get("min", 0), 4)
            stats["max"] = round(vp.get("max", 0), 4)
            stats["mean"] = round(mean, 4)
            stats["stddev"] = round(max(variance, 0) ** 0.5, 4)
            if "max_rate" in vp:
                stats["max_rate_of_change"] = round(vp["max_rate"], 4)
        elif vp.get("type") == "categorical":
            stats["unique_values"] = vp.get("unique_values", [])
        elif vp.get("type") == "boolean":
            stats["true_pct"] = round(vp.get("true_count", 0) / max(vp.get("count", 1), 1) * 100, 1)
        var_stats[vn] = stats
    
    return {
        "test_id": test_id,
        "state": test.state,
        "samples_collected": profile.get("sample_count", 0),
        "margin_pct": margin * 100,
        "variable_profiles": var_stats,
        "auto_generated_boundaries": boundaries,
        "boundary_count": len(boundaries),
        "message": f"Generated {len(boundaries)} boundaries from {profile.get('sample_count', 0)} samples. Call /learn-complete to apply and start enforcement."
    }


@router.post("/tests/{test_id}/learn-complete")
async def learn_complete(
    test_id: str,
    margin: float = 0.1,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Finalize learning: auto-generate boundaries and transition to running state."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Test not found")
    if test.state != "learning":
        raise HTTPException(400, f"Test not in learning state (current: {test.state})")
    await verify_test_access(test, current_user, db)
    
    env_raw = test.envelope_definition or {}
    profile = env_raw.get("_learning_profile") or {}
    
    if profile.get("sample_count", 0) < 10:
        raise HTTPException(400, f"Need at least 10 samples (have {profile.get('sample_count', 0)})")
    
    # Generate boundaries
    boundaries = generate_boundaries_from_profile(profile, margin=margin)
    
    if not boundaries:
        raise HTTPException(400, "Could not generate any boundaries from learning data")
    
    # Apply to test envelope
    from sqlalchemy.orm.attributes import flag_modified
    env = dict(test.envelope_definition or {})
    env["boundaries"] = boundaries
    env["learning_meta"] = {
        "samples_used": profile.get("sample_count", 0),
        "margin_pct": margin * 100,
        "generated_at": datetime.utcnow().isoformat(),
        "boundary_count": len(boundaries)
    }
    test.envelope_definition = env
    flag_modified(test, "envelope_definition")
    
    # Transition to running
    test.state = "running"
    test.started_at = datetime.utcnow()  # Reset timer for 72-hour enforcement
    
    # Generate genesis hash
    import hashlib, json
    genesis_data = json.dumps({
        "test_id": test_id,
        "boundaries": boundaries,
        "started_at": test.started_at.isoformat(),
        "learning_samples": profile.get("sample_count", 0)
    }, sort_keys=True)
    test.genesis_hash = hashlib.sha256(genesis_data.encode()).hexdigest()
    
    # Reset counters for enforcement phase
    test.total_samples = 0
    test.conformant_samples = 0
    test.interlock_activations = 0
    
    await db.commit()
    
    return {
        "test_id": test_id,
        "state": "running",
        "started_at": test.started_at.isoformat(),
        "genesis_hash": test.genesis_hash,
        "boundaries_generated": len(boundaries),
        "learning_samples_used": profile.get("sample_count", 0),
        "margin_pct": margin * 100,
        "boundaries": boundaries,
        "message": f"Learning complete. {len(boundaries)} boundaries auto-generated from {profile.get('sample_count', 0)} samples. 72-hour enforcement now active."
    }
    # Notify owner
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        app = app_result.scalar_one_or_none()
        if app:
            owner_result = await db.execute(select(User).where(User.id == app.applicant_id))
            owner = owner_result.scalar_one_or_none()
            if owner:
                await send_learning_complete(owner.email, app.system_name, test.test_id, len(boundaries), profile.get("sample_count", 0))
    except Exception as e:
        print(f"Failed to send learning-complete email: {e}")
    # Notify owner
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        app = app_result.scalar_one_or_none()
        if app:
            owner_result = await db.execute(select(User).where(User.id == app.applicant_id))
            owner = owner_result.scalar_one_or_none()
            if owner:
                await send_learning_complete(owner.email, app.system_name, test.test_id, len(boundaries), profile.get("sample_count", 0))
    except Exception as e:
        print(f"Failed to send learning-complete email: {e}")



def check_envelope(
    state_vector: Dict[str, Any],
    envelope: Dict[str, Any],
    prev_state_vector: Optional[Dict[str, Any]] = None,
    sample_interval_s: Optional[float] = None,
    current_timestamp: Optional[datetime] = None,
    test_stats: Optional[Dict[str, Any]] = None,
    recent_samples: Optional[List[Dict[str, Any]]] = None,
    recent_violations_count: int = 0,
    recent_violations_window: int = 0,
    cumulative_state: Optional[Dict[str, Any]] = None,
    baseline_metrics: Optional[Dict[str, Any]] = None,
) -> tuple:
    """Comprehensive envelope enforcement supporting all boundary types:
    
    - numeric:       min/max range checks (speed, temperature, wind)
    - categorical:   allowed value sets (surface_type, lighting, weather)
    - geographic:    radius geofence via haversine (center_lat/lng + radius_m)
    - polygon:       point-in-polygon geofence (vertices list)
    - temporal:      time-of-day operating windows (start_hour/end_hour, optional days)
    - rate_of_change: delta limits between consecutive samples (max_rate per second)
    - compound:      conditional rules (if condition met, apply sub-boundaries)
    - boolean:       required true/false state (sensor health, comms link)
    - connectivity:  max gap between samples (max_gap_seconds)
    """
    import math
    
    raw = envelope.get("boundaries", {})
    
    # Parse boundary definitions into typed groups
    boundaries = {}
    geo_boundaries = []
    polygon_boundaries = []
    temporal_boundaries = []
    rate_boundaries = []
    compound_boundaries = []
    boolean_boundaries = []
    connectivity_boundaries = []
    cumulative_boundaries = []
    statistical_boundaries = []
    frequency_boundaries = []
    sequence_boundaries = []
    drift_boundaries = []
    multi_condition_boundaries = []
    exclusion_zone_boundaries = []
    proximity_boundaries = []
    redundancy_boundaries = []
    energy_reserve_boundaries = []
    dynamic_boundaries = []
    envelope_curve_boundaries = []
    calculated_boundaries = []
    contraindication_boundaries = []
    escalation_boundaries = []
    protocol_boundaries = []
    ratio_boundaries = []
    jurisdiction_boundaries = []
    
    if isinstance(raw, list):
        for b in raw:
            btype = (b.get("type", "") or "").lower().replace(" ", "_")
            name = (b.get("name", "") or btype).lower().replace(" ", "_")
            key = name or btype
            if not key:
                continue
            
            if btype == "geographic" or (b.get("center_lat") is not None and btype != "polygon"):
                geo_boundaries.append(b)
            elif btype == "polygon" and b.get("vertices"):
                polygon_boundaries.append(b)
            elif btype == "temporal":
                temporal_boundaries.append(b)
            elif btype == "rate_of_change":
                rate_boundaries.append(b)
            elif btype == "compound" or btype == "conditional":
                compound_boundaries.append(b)
            elif btype == "boolean":
                boolean_boundaries.append(b)
            elif btype == "connectivity":
                connectivity_boundaries.append(b)
            elif btype == "cumulative":
                cumulative_boundaries.append(b)
            elif btype == "statistical" or btype == "rolling_window":
                statistical_boundaries.append(b)
            elif btype == "frequency" or btype == "count":
                frequency_boundaries.append(b)
            elif btype == "sequence" or btype == "state_machine":
                sequence_boundaries.append(b)
            elif btype == "drift" or btype == "baseline":
                drift_boundaries.append(b)
            elif btype == "multi_condition" or btype == "multi_variable":
                multi_condition_boundaries.append(b)
            elif btype == "exclusion_zone" or btype == "no_fly" or btype == "restricted_area":
                exclusion_zone_boundaries.append(b)
            elif btype == "proximity" or btype == "separation" or btype == "daa":
                proximity_boundaries.append(b)
            elif btype == "redundancy" or btype == "min_count":
                redundancy_boundaries.append(b)
            elif btype == "energy_reserve" or btype == "fuel_reserve" or btype == "battery_reserve":
                energy_reserve_boundaries.append(b)
            elif btype == "dynamic" or btype == "notam" or btype == "live_boundary":
                dynamic_boundaries.append(b)
            elif btype == "envelope_curve" or btype == "function_boundary" or btype == "lookup_table":
                envelope_curve_boundaries.append(b)
            elif btype == "calculated" or btype == "formula" or btype == "composite_score":
                calculated_boundaries.append(b)
            elif btype == "contraindication" or btype == "prohibition" or btype == "never":
                contraindication_boundaries.append(b)
            elif btype == "escalation" or btype == "response_time" or btype == "time_to_action":
                escalation_boundaries.append(b)
            elif btype == "protocol" or btype == "checklist" or btype == "care_bundle":
                protocol_boundaries.append(b)
            elif btype == "ratio" or btype == "proportion" or btype == "staffing":
                ratio_boundaries.append(b)
            elif btype == "jurisdiction" or btype == "scope" or btype == "authorization":
                jurisdiction_boundaries.append(b)
            elif b.get("allowed"):
                boundaries[key] = {"type": "categorical", "allowed": [str(v).lower() for v in b["allowed"]]}
            else:
                boundaries[key] = {
                    "type": "numeric",
                    "min": float(b["min"]) if b.get("min") is not None else float("-inf"),
                    "max": float(b["max"]) if b.get("max") is not None else float("inf"),
                }
    elif isinstance(raw, dict):
        boundaries = raw
    
    min_distance = float("inf")
    in_envelope = True
    violations = []
    
    # ── 1. NUMERIC & CATEGORICAL ─────────────────────────────
    for var, value in state_vector.items():
        key = var.lower().replace(" ", "_")
        if key in ("latitude", "longitude", "timestamp"):
            continue
        bounds = boundaries.get(var) or boundaries.get(key)
        if not bounds:
            continue
        
        btype = bounds.get("type", "numeric")
        
        if btype == "categorical":
            allowed = [str(v).lower() for v in bounds.get("allowed", [])]
            val_str = str(value).lower()
            if val_str not in allowed:
                in_envelope = False
                violations.append({"var": var, "value": value, "bound": "allowed", "threshold": allowed})
                min_distance = min(min_distance, 1)
            else:
                min_distance = min(min_distance, 0)
        else:
            try:
                fval = float(value)
            except (ValueError, TypeError):
                violations.append({"var": var, "value": str(value), "bound": "type_error", "threshold": "numeric expected"})
                in_envelope = False
                continue
            min_val = float(bounds.get("min", float("-inf")))
            max_val = float(bounds.get("max", float("inf")))
            if fval < min_val:
                in_envelope = False
                violations.append({"var": var, "value": fval, "bound": "min", "threshold": min_val})
                distance = min_val - fval
            elif fval > max_val:
                in_envelope = False
                violations.append({"var": var, "value": fval, "bound": "max", "threshold": max_val})
                distance = fval - max_val
            else:
                distance = min(fval - min_val, max_val - fval)
            min_distance = min(min_distance, distance)
    
    # ── 2. GEOGRAPHIC (radius geofence) ──────────────────────
    sv_lat = state_vector.get("latitude")
    sv_lng = state_vector.get("longitude")
    if sv_lat is not None and sv_lng is not None:
        for geo in geo_boundaries:
            clat = geo.get("center_lat")
            clng = geo.get("center_lng")
            radius_m = geo.get("radius_m")
            if clat is None or clng is None or radius_m is None:
                continue
            R = 6371000
            lat1, lat2 = math.radians(float(clat)), math.radians(float(sv_lat))
            dlat = math.radians(float(sv_lat) - float(clat))
            dlng = math.radians(float(sv_lng) - float(clng))
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            dist_m = R * c
            if dist_m > float(radius_m):
                in_envelope = False
                violations.append({
                    "var": "geofence", "value": round(dist_m, 1),
                    "bound": "radius", "threshold": float(radius_m),
                    "center": [float(clat), float(clng)],
                    "position": [float(sv_lat), float(sv_lng)]
                })
                distance = dist_m - float(radius_m)
            else:
                distance = float(radius_m) - dist_m
            min_distance = min(min_distance, distance)
    
    # ── 3. POLYGON GEOFENCE (point-in-polygon, ray casting) ──
    if sv_lat is not None and sv_lng is not None:
        for poly in polygon_boundaries:
            vertices = poly.get("vertices", [])
            if len(vertices) < 3:
                continue
            pname = (poly.get("name", "") or "polygon_geofence").lower().replace(" ", "_")
            # Ray-casting algorithm
            px, py = float(sv_lng), float(sv_lat)
            n = len(vertices)
            inside = False
            j = n - 1
            for i in range(n):
                yi, xi = float(vertices[i][0]), float(vertices[i][1])
                yj, xj = float(vertices[j][0]), float(vertices[j][1])
                if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi):
                    inside = not inside
                j = i
            if not inside:
                in_envelope = False
                violations.append({
                    "var": pname, "value": [float(sv_lat), float(sv_lng)],
                    "bound": "polygon", "threshold": f"{len(vertices)}-vertex boundary"
                })
                min_distance = min(min_distance, 1)
    
    # ── 4. TEMPORAL (time-of-day windows) ─────────────────────
    if current_timestamp and temporal_boundaries:
        for tb in temporal_boundaries:
            tname = (tb.get("name", "") or "operating_hours").lower().replace(" ", "_")
            start_h = tb.get("start_hour", 0)
            end_h = tb.get("end_hour", 24)
            allowed_days = tb.get("allowed_days")  # e.g. [0,1,2,3,4] for Mon-Fri
            
            current_hour = current_timestamp.hour + current_timestamp.minute / 60.0
            current_dow = current_timestamp.weekday()
            
            # Check time-of-day
            time_ok = False
            if start_h <= end_h:
                time_ok = start_h <= current_hour < end_h
            else:
                # Overnight window, e.g. 22:00-06:00
                time_ok = current_hour >= start_h or current_hour < end_h
            
            # Check day-of-week if specified
            day_ok = True
            if allowed_days is not None:
                day_ok = current_dow in allowed_days
            
            if not time_ok or not day_ok:
                in_envelope = False
                detail = {}
                if not time_ok:
                    detail["current_hour"] = round(current_hour, 2)
                    detail["allowed_window"] = f"{start_h}:00-{end_h}:00"
                if not day_ok:
                    detail["current_day"] = current_dow
                    detail["allowed_days"] = allowed_days
                violations.append({
                    "var": tname, "value": detail,
                    "bound": "temporal", "threshold": {"start_hour": start_h, "end_hour": end_h}
                })
                min_distance = min(min_distance, 1)
    
    # ── 5. RATE OF CHANGE (delta between consecutive samples) ─
    if prev_state_vector and sample_interval_s and sample_interval_s > 0:
        for rb in rate_boundaries:
            rname = (rb.get("name", "") or "rate_check").lower().replace(" ", "_")
            variable = rb.get("variable", "")
            max_rate = rb.get("max_rate")
            if not variable or max_rate is None:
                continue
            
            curr_val = state_vector.get(variable)
            prev_val = prev_state_vector.get(variable)
            if curr_val is None or prev_val is None:
                continue
            
            try:
                delta = abs(float(curr_val) - float(prev_val))
                rate = delta / sample_interval_s
                if rate > float(max_rate):
                    in_envelope = False
                    violations.append({
                        "var": rname, "value": round(rate, 4),
                        "bound": "max_rate", "threshold": float(max_rate),
                        "variable": variable,
                        "delta": round(delta, 4),
                        "interval_s": round(sample_interval_s, 2)
                    })
                    distance = rate - float(max_rate)
                    min_distance = min(min_distance, distance)
            except (ValueError, TypeError):
                continue
    
    # ── 6. COMPOUND / CONDITIONAL ─────────────────────────────
    for cb in compound_boundaries:
        cname = (cb.get("name", "") or "conditional").lower().replace(" ", "_")
        condition = cb.get("condition", {})
        then_rules = cb.get("then", {})
        
        # Check if condition is met
        condition_met = True
        for cvar, cval in condition.items():
            sv_val = state_vector.get(cvar)
            if sv_val is None:
                condition_met = False
                break
            if isinstance(cval, list):
                if str(sv_val).lower() not in [str(v).lower() for v in cval]:
                    condition_met = False
                    break
            elif str(sv_val).lower() != str(cval).lower():
                condition_met = False
                break
        
        if condition_met:
            # Apply conditional sub-boundaries
            for tvar, trule in then_rules.items():
                sv_val = state_vector.get(tvar)
                if sv_val is None:
                    continue
                try:
                    fval = float(sv_val)
                except (ValueError, TypeError):
                    continue
                tmin = float(trule.get("min", float("-inf"))) if isinstance(trule, dict) else float("-inf")
                tmax = float(trule.get("max", float("inf"))) if isinstance(trule, dict) else float("inf")
                if fval < tmin:
                    in_envelope = False
                    violations.append({
                        "var": cname, "value": fval,
                        "bound": "conditional_min", "threshold": tmin,
                        "condition": condition, "target": tvar
                    })
                    min_distance = min(min_distance, tmin - fval)
                elif fval > tmax:
                    in_envelope = False
                    violations.append({
                        "var": cname, "value": fval,
                        "bound": "conditional_max", "threshold": tmax,
                        "condition": condition, "target": tvar
                    })
                    min_distance = min(min_distance, fval - tmax)
    
    # ── 7. BOOLEAN (sensor health, system state) ──────────────
    for bb in boolean_boundaries:
        bname = (bb.get("name", "") or "boolean_check").lower().replace(" ", "_")
        variable = bb.get("variable", bname)
        required = bb.get("required_value", True)
        
        sv_val = state_vector.get(variable)
        if sv_val is None:
            # Missing required sensor → violation
            in_envelope = False
            violations.append({
                "var": bname, "value": None,
                "bound": "boolean_missing", "threshold": required,
                "variable": variable
            })
            min_distance = min(min_distance, 1)
        else:
            # Coerce to bool
            if isinstance(sv_val, str):
                bval = sv_val.lower() in ("true", "1", "yes", "on", "active", "operational")
            else:
                bval = bool(sv_val)
            if bval != required:
                in_envelope = False
                violations.append({
                    "var": bname, "value": bval,
                    "bound": "boolean", "threshold": required,
                    "variable": variable
                })
                min_distance = min(min_distance, 1)
    
    # ── 8. CONNECTIVITY (heartbeat gap) ───────────────────────
    if sample_interval_s is not None:
        for conn in connectivity_boundaries:
            cname = (conn.get("name", "") or "connectivity").lower().replace(" ", "_")
            max_gap = conn.get("max_gap_seconds")
            if max_gap is None:
                continue
            if sample_interval_s > float(max_gap):
                in_envelope = False
                violations.append({
                    "var": cname, "value": round(sample_interval_s, 2),
                    "bound": "max_gap", "threshold": float(max_gap),
                })
                min_distance = min(min_distance, sample_interval_s - float(max_gap))
    

    # ── 9. CUMULATIVE (running totals) ────────────────────────
    # "total distance < 100km", "total transactions < $1M"
    if cumulative_state:
        for cum in cumulative_boundaries:
            cname = (cum.get("name", "") or "cumulative").lower().replace(" ", "_")
            variable = cum.get("variable", "")
            max_total = cum.get("max_total")
            min_total = cum.get("min_total")
            if not variable:
                continue
            
            current_total = cumulative_state.get(variable, 0)
            # Add current sample value to running total
            sv_val = state_vector.get(variable)
            if sv_val is not None:
                try:
                    current_total += float(sv_val)
                except (ValueError, TypeError):
                    pass
            
            if max_total is not None and current_total > float(max_total):
                in_envelope = False
                violations.append({
                    "var": cname, "value": round(current_total, 4),
                    "bound": "max_total", "threshold": float(max_total),
                    "variable": variable
                })
                min_distance = min(min_distance, current_total - float(max_total))
            
            if min_total is not None and current_total < float(min_total):
                in_envelope = False
                violations.append({
                    "var": cname, "value": round(current_total, 4),
                    "bound": "min_total", "threshold": float(min_total),
                    "variable": variable
                })
                min_distance = min(min_distance, float(min_total) - current_total)
    
    # ── 10. STATISTICAL / ROLLING WINDOW ──────────────────────
    # "accuracy > 95% over last 100 decisions", "false_positive_rate < 5%"
    if recent_samples:
        for sb in statistical_boundaries:
            sname = (sb.get("name", "") or "statistical").lower().replace(" ", "_")
            variable = sb.get("variable", "")
            window_size = sb.get("window_size", 100)
            min_value = sb.get("min_value")
            max_value = sb.get("max_value")
            aggregation = sb.get("aggregation", "mean")  # mean, median, sum, min, max, ratio_true
            
            if not variable:
                continue
            
            # Collect values from recent samples
            window = recent_samples[-window_size:]
            values = []
            for s in window:
                sv = s if isinstance(s, dict) else {}
                v = sv.get(variable)
                if v is not None:
                    try:
                        values.append(float(v))
                    except (ValueError, TypeError):
                        # For boolean/binary: true=1, false=0
                        if isinstance(v, bool):
                            values.append(1.0 if v else 0.0)
                        elif str(v).lower() in ("true", "1", "yes", "pass"):
                            values.append(1.0)
                        elif str(v).lower() in ("false", "0", "no", "fail"):
                            values.append(0.0)
            
            if not values:
                continue
            
            # Compute aggregate
            if aggregation == "mean":
                agg_val = sum(values) / len(values)
            elif aggregation == "median":
                sorted_v = sorted(values)
                mid = len(sorted_v) // 2
                agg_val = sorted_v[mid] if len(sorted_v) % 2 else (sorted_v[mid-1] + sorted_v[mid]) / 2
            elif aggregation == "sum":
                agg_val = sum(values)
            elif aggregation == "min":
                agg_val = min(values)
            elif aggregation == "max":
                agg_val = max(values)
            elif aggregation == "ratio_true":
                agg_val = sum(1 for v in values if v > 0) / len(values)
            elif aggregation == "stddev":
                mean = sum(values) / len(values)
                agg_val = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
            else:
                agg_val = sum(values) / len(values)
            
            if min_value is not None and agg_val < float(min_value):
                in_envelope = False
                violations.append({
                    "var": sname, "value": round(agg_val, 4),
                    "bound": "min_value", "threshold": float(min_value),
                    "aggregation": aggregation,
                    "window_actual": len(values),
                    "window_requested": window_size
                })
                min_distance = min(min_distance, float(min_value) - agg_val)
            
            if max_value is not None and agg_val > float(max_value):
                in_envelope = False
                violations.append({
                    "var": sname, "value": round(agg_val, 4),
                    "bound": "max_value", "threshold": float(max_value),
                    "aggregation": aggregation,
                    "window_actual": len(values),
                    "window_requested": window_size
                })
                min_distance = min(min_distance, agg_val - float(max_value))
    
    # ── 11. FREQUENCY / COUNT ─────────────────────────────────
    # "max 3 emergency stops per hour", "max 10 violations before halt"
    for fb in frequency_boundaries:
        fname = (fb.get("name", "") or "frequency").lower().replace(" ", "_")
        max_count = fb.get("max_count")
        window_seconds = fb.get("window_seconds")
        
        if max_count is None:
            continue
        
        # Use recent_violations_count and window passed from caller
        relevant_count = recent_violations_count
        if window_seconds and recent_violations_window:
            # Scale if the window we got doesn't match what's requested
            if recent_violations_window > 0 and recent_violations_window != window_seconds:
                relevant_count = int(relevant_count * (float(window_seconds) / recent_violations_window))
        
        if relevant_count > int(max_count):
            in_envelope = False
            violations.append({
                "var": fname, "value": relevant_count,
                "bound": "max_count", "threshold": int(max_count),
                "window_seconds": window_seconds
            })
            min_distance = min(min_distance, relevant_count - int(max_count))
    
    # ── 12. SEQUENCE / STATE MACHINE ──────────────────────────
    # "must complete pre-flight before takeoff", "verify identity before dispense"
    for seq in sequence_boundaries:
        seqname = (seq.get("name", "") or "sequence").lower().replace(" ", "_")
        required_state = seq.get("required_state")  # state that must be current
        prerequisite = seq.get("prerequisite")  # state_vector key that must be true/present
        prerequisite_value = seq.get("prerequisite_value", True)
        action_key = seq.get("action_key")  # what triggers the check
        
        if not action_key:
            continue
        
        # Only check if the action is being attempted
        action_val = state_vector.get(action_key)
        if action_val is None:
            continue
        
        # Coerce to check if action is "active"
        action_active = False
        if isinstance(action_val, bool):
            action_active = action_val
        elif isinstance(action_val, (int, float)):
            action_active = action_val > 0
        else:
            action_active = str(action_val).lower() in ("true", "1", "yes", "active", "on")
        
        if not action_active:
            continue
        
        # Check prerequisite
        if prerequisite:
            prereq_val = state_vector.get(prerequisite)
            if prereq_val is None:
                in_envelope = False
                violations.append({
                    "var": seqname, "value": None,
                    "bound": "prerequisite_missing", "threshold": prerequisite,
                    "action": action_key
                })
                min_distance = min(min_distance, 1)
            else:
                # Check if prereq matches required value
                if isinstance(prerequisite_value, bool):
                    pval = str(prereq_val).lower() in ("true", "1", "yes")
                    if pval != prerequisite_value:
                        in_envelope = False
                        violations.append({
                            "var": seqname, "value": prereq_val,
                            "bound": "prerequisite_not_met", "threshold": prerequisite_value,
                            "prerequisite": prerequisite, "action": action_key
                        })
                        min_distance = min(min_distance, 1)
                elif str(prereq_val).lower() != str(prerequisite_value).lower():
                    in_envelope = False
                    violations.append({
                        "var": seqname, "value": prereq_val,
                        "bound": "prerequisite_not_met", "threshold": prerequisite_value,
                        "prerequisite": prerequisite, "action": action_key
                    })
                    min_distance = min(min_distance, 1)
        
        if required_state:
            current_state = state_vector.get("system_state") or state_vector.get("state")
            if current_state and str(current_state).lower() != str(required_state).lower():
                in_envelope = False
                violations.append({
                    "var": seqname, "value": current_state,
                    "bound": "wrong_state", "threshold": required_state,
                    "action": action_key
                })
                min_distance = min(min_distance, 1)
    
    # ── 13. DRIFT / BASELINE DEGRADATION ──────────────────────
    # "confidence must not degrade > 10% from baseline"
    if baseline_metrics:
        for db_ in drift_boundaries:
            dname = (db_.get("name", "") or "drift").lower().replace(" ", "_")
            variable = db_.get("variable", "")
            max_drift_pct = db_.get("max_drift_pct")  # max % change from baseline
            max_drift_abs = db_.get("max_drift_abs")  # max absolute change
            direction = db_.get("direction", "both")  # "up", "down", "both"
            
            if not variable:
                continue
            
            baseline_val = baseline_metrics.get(variable)
            current_val = state_vector.get(variable)
            
            if baseline_val is None or current_val is None:
                continue
            
            try:
                bv = float(baseline_val)
                cv = float(current_val)
            except (ValueError, TypeError):
                continue
            
            abs_change = cv - bv
            pct_change = (abs_change / bv * 100) if bv != 0 else 0
            
            violated = False
            if max_drift_pct is not None:
                if direction == "down" and pct_change < -float(max_drift_pct):
                    violated = True
                elif direction == "up" and pct_change > float(max_drift_pct):
                    violated = True
                elif direction == "both" and abs(pct_change) > float(max_drift_pct):
                    violated = True
            
            if max_drift_abs is not None:
                if direction == "down" and abs_change < -float(max_drift_abs):
                    violated = True
                elif direction == "up" and abs_change > float(max_drift_abs):
                    violated = True
                elif direction == "both" and abs(abs_change) > float(max_drift_abs):
                    violated = True
            
            if violated:
                in_envelope = False
                violations.append({
                    "var": dname, "value": round(cv, 4),
                    "bound": "drift",
                    "baseline": round(bv, 4),
                    "drift_pct": round(pct_change, 2),
                    "drift_abs": round(abs_change, 4),
                    "max_drift_pct": max_drift_pct,
                    "max_drift_abs": max_drift_abs,
                    "direction": direction
                })
                min_distance = min(min_distance, abs(abs_change))
    
    # ── 14. MULTI-CONDITION (AND/OR across variables) ─────────
    # "if speed > 15 AND wind > 20 AND rain = true, then halt"
    for mc in multi_condition_boundaries:
        mcname = (mc.get("name", "") or "multi_condition").lower().replace(" ", "_")
        conditions = mc.get("conditions", [])
        logic = mc.get("logic", "all")  # "all" (AND) or "any" (OR)
        action = mc.get("action", "violate")  # "violate" = flag if conditions met
        
        if not conditions:
            continue
        
        results = []
        for cond in conditions:
            cvar = cond.get("variable", "")
            cop = cond.get("operator", "eq")  # eq, neq, gt, gte, lt, lte, in, not_in
            cval = cond.get("value")
            
            sv_val = state_vector.get(cvar)
            if sv_val is None:
                results.append(False)
                continue
            
            try:
                sv_num = float(sv_val)
                cval_num = float(cval) if not isinstance(cval, list) else None
            except (ValueError, TypeError):
                sv_num = None
                cval_num = None
            
            if cop == "eq":
                results.append(str(sv_val).lower() == str(cval).lower())
            elif cop == "neq":
                results.append(str(sv_val).lower() != str(cval).lower())
            elif cop == "gt" and sv_num is not None and cval_num is not None:
                results.append(sv_num > cval_num)
            elif cop == "gte" and sv_num is not None and cval_num is not None:
                results.append(sv_num >= cval_num)
            elif cop == "lt" and sv_num is not None and cval_num is not None:
                results.append(sv_num < cval_num)
            elif cop == "lte" and sv_num is not None and cval_num is not None:
                results.append(sv_num <= cval_num)
            elif cop == "in" and isinstance(cval, list):
                results.append(str(sv_val).lower() in [str(v).lower() for v in cval])
            elif cop == "not_in" and isinstance(cval, list):
                results.append(str(sv_val).lower() not in [str(v).lower() for v in cval])
            else:
                results.append(False)
        
        # Evaluate logic
        if logic == "all":
            triggered = all(results) if results else False
        else:  # "any"
            triggered = any(results) if results else False
        
        if triggered and action == "violate":
            in_envelope = False
            violations.append({
                "var": mcname,
                "value": {c.get("variable", ""): state_vector.get(c.get("variable", "")) for c in conditions},
                "bound": "multi_condition",
                "logic": logic,
                "conditions_met": sum(results),
                "conditions_total": len(results)
            })
            min_distance = min(min_distance, 1)
    

    # ══════════════════════════════════════════════════════════
    # AVIATION / ADVANCED BOUNDARIES (16-21)
    # ══════════════════════════════════════════════════════════

    # ── 16. EXCLUSION ZONE (must stay OUT of area) ────────────
    if sv_lat is not None and sv_lng is not None:
        for ez in exclusion_zone_boundaries:
            ezname = (ez.get("name", "") or "exclusion_zone").lower().replace(" ", "_")
            shape = ez.get("shape", "polygon")

            if shape == "radius" or ez.get("center_lat") is not None:
                clat = ez.get("center_lat")
                clng = ez.get("center_lng")
                radius_m = ez.get("radius_m")
                if clat is None or clng is None or radius_m is None:
                    continue
                R = 6371000
                lat1, lat2 = math.radians(float(clat)), math.radians(float(sv_lat))
                dlat = math.radians(float(sv_lat) - float(clat))
                dlng = math.radians(float(sv_lng) - float(clng))
                a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                dist_m = R * c
                if dist_m <= float(radius_m):
                    in_envelope = False
                    violations.append({
                        "var": ezname, "value": round(dist_m, 1),
                        "bound": "exclusion_radius", "threshold": float(radius_m),
                        "penetration_m": round(float(radius_m) - dist_m, 1)
                    })
                    min_distance = min(min_distance, float(radius_m) - dist_m)

            elif ez.get("vertices"):
                vertices = ez.get("vertices", [])
                if len(vertices) < 3:
                    continue
                px, py = float(sv_lng), float(sv_lat)
                n = len(vertices)
                inside = False
                j = n - 1
                for i in range(n):
                    yi, xi = float(vertices[i][0]), float(vertices[i][1])
                    yj, xj = float(vertices[j][0]), float(vertices[j][1])
                    if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi):
                        inside = not inside
                    j = i
                if inside:
                    in_envelope = False
                    violations.append({
                        "var": ezname, "value": [float(sv_lat), float(sv_lng)],
                        "bound": "exclusion_polygon",
                        "threshold": f"{len(vertices)}-vertex exclusion zone"
                    })
                    min_distance = min(min_distance, 1)

    # ── 17. PROXIMITY / SEPARATION (DAA) ──────────────────────
    for prox in proximity_boundaries:
        pname = (prox.get("name", "") or "proximity").lower().replace(" ", "_")
        min_separation_m = prox.get("min_separation_m")
        objects_key = prox.get("objects_key", "nearby_objects")
        if min_separation_m is None:
            continue
        nearby = state_vector.get(objects_key)
        if not nearby:
            continue
        if isinstance(nearby, list):
            for idx_obj, obj in enumerate(nearby):
                if isinstance(obj, dict):
                    if "distance_m" in obj:
                        dist = float(obj["distance_m"])
                    elif "lat" in obj and "lng" in obj and sv_lat is not None and sv_lng is not None:
                        R = 6371000
                        lat1, lat2 = math.radians(float(sv_lat)), math.radians(float(obj["lat"]))
                        dlat = math.radians(float(obj["lat"]) - float(sv_lat))
                        dlng = math.radians(float(obj["lng"]) - float(sv_lng))
                        a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
                        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                        dist = R * c
                    else:
                        continue
                    if dist < float(min_separation_m):
                        in_envelope = False
                        violations.append({
                            "var": pname, "value": round(dist, 1),
                            "bound": "min_separation", "threshold": float(min_separation_m),
                            "object_id": obj.get("id", f"object_{idx_obj}")
                        })
                        min_distance = min(min_distance, float(min_separation_m) - dist)
        elif isinstance(nearby, (int, float)):
            if float(nearby) < float(min_separation_m):
                in_envelope = False
                violations.append({
                    "var": pname, "value": float(nearby),
                    "bound": "min_separation", "threshold": float(min_separation_m)
                })
                min_distance = min(min_distance, float(min_separation_m) - float(nearby))

    # ── 18. REDUNDANCY (min operational subsystems) ───────────
    for red in redundancy_boundaries:
        rname = (red.get("name", "") or "redundancy").lower().replace(" ", "_")
        variables = red.get("variables", [])
        group_key = red.get("group_key")
        min_operational = red.get("min_operational", 1)
        if group_key:
            count_val = state_vector.get(group_key)
            if count_val is not None:
                try:
                    count = int(float(count_val))
                except (ValueError, TypeError):
                    count = 0
                if count < int(min_operational):
                    in_envelope = False
                    violations.append({
                        "var": rname, "value": count,
                        "bound": "min_operational", "threshold": int(min_operational)
                    })
                    min_distance = min(min_distance, int(min_operational) - count)
        elif variables:
            operational = 0
            for v in variables:
                sv_val = state_vector.get(v)
                if sv_val is None:
                    continue
                if isinstance(sv_val, bool) and sv_val:
                    operational += 1
                elif isinstance(sv_val, (int, float)) and float(sv_val) > 0:
                    operational += 1
                elif isinstance(sv_val, str) and sv_val.lower() in ("true", "1", "yes", "on", "active", "operational"):
                    operational += 1
            if operational < int(min_operational):
                in_envelope = False
                violations.append({
                    "var": rname, "value": operational,
                    "bound": "min_operational", "threshold": int(min_operational),
                    "total_subsystems": len(variables)
                })
                min_distance = min(min_distance, int(min_operational) - operational)

    # ── 19. ENERGY RESERVE ────────────────────────────────────
    for er in energy_reserve_boundaries:
        ername = (er.get("name", "") or "energy_reserve").lower().replace(" ", "_")
        current_key = er.get("current_key", "battery_pct")
        consumption_rate_key = er.get("consumption_rate_key")
        min_reserve_pct = er.get("min_reserve_pct")
        min_reserve_abs = er.get("min_reserve_abs")
        min_reserve_time_s = er.get("min_reserve_time_s")
        current_energy = state_vector.get(current_key)
        if current_energy is None:
            continue
        try:
            energy = float(current_energy)
        except (ValueError, TypeError):
            continue
        if min_reserve_pct is not None and energy < float(min_reserve_pct):
            in_envelope = False
            violations.append({"var": ername, "value": round(energy, 2), "bound": "min_reserve_pct", "threshold": float(min_reserve_pct)})
            min_distance = min(min_distance, float(min_reserve_pct) - energy)
        if min_reserve_abs is not None and energy < float(min_reserve_abs):
            in_envelope = False
            violations.append({"var": ername, "value": round(energy, 2), "bound": "min_reserve_abs", "threshold": float(min_reserve_abs)})
            min_distance = min(min_distance, float(min_reserve_abs) - energy)
        if min_reserve_time_s is not None and consumption_rate_key:
            rate = state_vector.get(consumption_rate_key)
            if rate is not None:
                try:
                    rate_f = float(rate)
                    if rate_f > 0:
                        time_remaining = energy / rate_f
                        if time_remaining < float(min_reserve_time_s):
                            in_envelope = False
                            violations.append({"var": ername, "value": round(time_remaining, 1), "bound": "min_reserve_time", "threshold": float(min_reserve_time_s)})
                            min_distance = min(min_distance, float(min_reserve_time_s) - time_remaining)
                except (ValueError, TypeError):
                    pass

    # ── 20. DYNAMIC BOUNDARY (NOTAMs, live feeds) ─────────────
    for dyn in dynamic_boundaries:
        dname = (dyn.get("name", "") or "dynamic").lower().replace(" ", "_")
        status_key = dyn.get("status_key")
        violation_value = dyn.get("violation_value", "active")
        detail_key = dyn.get("detail_key")
        if not status_key:
            continue
        sv_val = state_vector.get(status_key)
        if sv_val is None:
            continue
        is_violation = False
        if isinstance(violation_value, list):
            is_violation = str(sv_val).lower() in [str(v).lower() for v in violation_value]
        elif isinstance(violation_value, bool):
            sv_bool = str(sv_val).lower() in ("true", "1", "yes", "active") if not isinstance(sv_val, bool) else sv_val
            is_violation = sv_bool == violation_value
        else:
            is_violation = str(sv_val).lower() == str(violation_value).lower()
        if is_violation:
            detail = state_vector.get(detail_key, "") if detail_key else ""
            in_envelope = False
            violations.append({"var": dname, "value": sv_val, "bound": "dynamic_condition", "threshold": violation_value, "detail": detail})
            min_distance = min(min_distance, 1)

    # ── 21. ENVELOPE CURVE (piecewise function) ───────────────
    for ec in envelope_curve_boundaries:
        ecname = (ec.get("name", "") or "envelope_curve").lower().replace(" ", "_")
        input_variable = ec.get("input_variable")
        output_variable = ec.get("output_variable")
        curve_type = ec.get("curve_type", "max")
        points = ec.get("points", [])
        if not input_variable or not output_variable or len(points) < 2:
            continue
        input_val = state_vector.get(input_variable)
        output_val = state_vector.get(output_variable)
        if input_val is None or output_val is None:
            continue
        try:
            x = float(input_val)
            y = float(output_val)
        except (ValueError, TypeError):
            continue
        sorted_pts = sorted(points, key=lambda p: float(p[0]))
        limit = None
        if x <= float(sorted_pts[0][0]):
            limit = float(sorted_pts[0][1])
        elif x >= float(sorted_pts[-1][0]):
            limit = float(sorted_pts[-1][1])
        else:
            for i in range(len(sorted_pts) - 1):
                x0, y0 = float(sorted_pts[i][0]), float(sorted_pts[i][1])
                x1, y1 = float(sorted_pts[i+1][0]), float(sorted_pts[i+1][1])
                if x0 <= x <= x1:
                    t = (x - x0) / (x1 - x0) if x1 != x0 else 0
                    limit = y0 + t * (y1 - y0)
                    break
        if limit is None:
            continue
        violated = False
        if curve_type == "max" and y > limit:
            violated = True
            edist = y - limit
        elif curve_type == "min" and y < limit:
            violated = True
            edist = limit - y
        if violated:
            in_envelope = False
            violations.append({
                "var": ecname, "value": round(y, 4), "bound": f"curve_{curve_type}",
                "threshold": round(limit, 4), "input_variable": input_variable, "input_value": round(x, 4)
            })
            min_distance = min(min_distance, edist)

    # ══════════════════════════════════════════════════════════
    # HEALTHCARE / MEDICAL BOUNDARIES (22-27)
    # ══════════════════════════════════════════════════════════

    # ── 22. CALCULATED / FORMULA (composite scores, dosing) ───
    for calc in calculated_boundaries:
        calcname = (calc.get("name", "") or "calculated").lower().replace(" ", "_")
        formula_type = calc.get("formula_type", "weighted_sum")
        inputs = calc.get("inputs", [])
        result_min = calc.get("result_min")
        result_max = calc.get("result_max")
        divisor_variable = calc.get("divisor_variable")
        multiplier_variable = calc.get("multiplier_variable")
        thresholds = calc.get("thresholds", [])
        if not inputs:
            continue
        computed = 0
        all_present = True
        if formula_type == "weighted_sum":
            for inp in inputs:
                sv_val = state_vector.get(inp.get("variable", ""))
                if sv_val is None:
                    all_present = False
                    break
                try:
                    computed += float(sv_val) * float(inp.get("weight", 1)) + float(inp.get("offset", 0))
                except (ValueError, TypeError):
                    all_present = False
                    break
        elif formula_type == "product":
            computed = 1
            for inp in inputs:
                sv_val = state_vector.get(inp.get("variable", ""))
                if sv_val is None:
                    all_present = False
                    break
                try:
                    computed *= float(sv_val)
                except (ValueError, TypeError):
                    all_present = False
                    break
        elif formula_type == "lookup_sum":
            for inp in inputs:
                sv_val = state_vector.get(inp.get("variable", ""))
                if sv_val is None:
                    all_present = False
                    break
                lookup = inp.get("lookup", [])
                score = 0
                try:
                    fval = float(sv_val)
                except (ValueError, TypeError):
                    fval = None
                if isinstance(lookup, list):
                    for entry in lookup:
                        if fval is not None:
                            if float(entry.get("min", float("-inf"))) <= fval <= float(entry.get("max", float("inf"))):
                                score = float(entry.get("score", 0))
                                break
                        elif "value" in entry and str(sv_val).lower() == str(entry["value"]).lower():
                            score = float(entry.get("score", 0))
                            break
                computed += score
        if not all_present:
            continue
        if divisor_variable:
            dv = state_vector.get(divisor_variable)
            if dv is not None:
                try:
                    dvf = float(dv)
                    if dvf > 0:
                        computed = computed / dvf
                except (ValueError, TypeError):
                    pass
        if multiplier_variable:
            mv = state_vector.get(multiplier_variable)
            if mv is not None:
                try:
                    computed = computed * float(mv)
                except (ValueError, TypeError):
                    pass
        if result_max is not None and computed > float(result_max):
            in_envelope = False
            violations.append({"var": calcname, "value": round(computed, 4), "bound": "formula_max", "threshold": float(result_max)})
            min_distance = min(min_distance, computed - float(result_max))
        if result_min is not None and computed < float(result_min):
            in_envelope = False
            violations.append({"var": calcname, "value": round(computed, 4), "bound": "formula_min", "threshold": float(result_min)})
            min_distance = min(min_distance, float(result_min) - computed)
        if thresholds:
            for tier in thresholds:
                if float(tier.get("min", float("-inf"))) <= computed <= float(tier.get("max", float("inf"))):
                    if tier.get("action") == "violate":
                        in_envelope = False
                        violations.append({"var": calcname, "value": round(computed, 4), "bound": "threshold_tier", "tier_level": tier.get("level", "unknown")})
                        min_distance = min(min_distance, 1)
                    break

    # ── 23. CONTRAINDICATION / PROHIBITION ────────────────────
    for contra in contraindication_boundaries:
        cname = (contra.get("name", "") or "contraindication").lower().replace(" ", "_")
        conditions = contra.get("conditions", [])
        prohibited_action = contra.get("prohibited_action")
        prohibited_value = contra.get("prohibited_value")
        message = contra.get("message", "Contraindicated action detected")
        severity = contra.get("severity", "critical")
        conditions_met = True
        for cond in conditions:
            cvar = cond.get("variable", "")
            cop = cond.get("operator", "eq")
            cval = cond.get("value")
            sv_val = state_vector.get(cvar)
            if sv_val is None:
                conditions_met = False
                break
            try:
                sv_num = float(sv_val)
                cval_num = float(cval) if cval is not None and not isinstance(cval, (list, bool)) else None
            except (ValueError, TypeError):
                sv_num = None
                cval_num = None
            met = False
            if cop == "eq": met = str(sv_val).lower() == str(cval).lower()
            elif cop == "neq": met = str(sv_val).lower() != str(cval).lower()
            elif cop == "gt" and sv_num is not None and cval_num is not None: met = sv_num > cval_num
            elif cop == "gte" and sv_num is not None and cval_num is not None: met = sv_num >= cval_num
            elif cop == "lt" and sv_num is not None and cval_num is not None: met = sv_num < cval_num
            elif cop == "lte" and sv_num is not None and cval_num is not None: met = sv_num <= cval_num
            elif cop == "in" and isinstance(cval, list): met = str(sv_val).lower() in [str(v).lower() for v in cval]
            elif cop == "contains" and isinstance(sv_val, str): met = str(cval).lower() in sv_val.lower()
            elif cop == "present": met = True
            elif cop == "trending_up" and prev_state_vector:
                pv = prev_state_vector.get(cvar)
                if pv is not None:
                    try: met = float(sv_val) > float(pv)
                    except: met = False
            elif cop == "trending_down" and prev_state_vector:
                pv = prev_state_vector.get(cvar)
                if pv is not None:
                    try: met = float(sv_val) < float(pv)
                    except: met = False
            if not met:
                conditions_met = False
                break
        if not conditions_met:
            continue
        if prohibited_action:
            pa_val = state_vector.get(prohibited_action)
            if pa_val is None:
                continue
            if prohibited_value is not None:
                if str(pa_val).lower() != str(prohibited_value).lower():
                    continue
            else:
                if isinstance(pa_val, bool) and not pa_val: continue
                if isinstance(pa_val, (int, float)) and pa_val <= 0: continue
                if isinstance(pa_val, str) and pa_val.lower() in ("false", "0", "no", "none", ""): continue
        in_envelope = False
        violations.append({
            "var": cname, "value": {c.get("variable"): state_vector.get(c.get("variable")) for c in conditions},
            "bound": "contraindication", "prohibited_action": prohibited_action,
            "severity": severity, "message": message
        })
        min_distance = min(min_distance, 0)

    # ── 24. ESCALATION / RESPONSE TIME ────────────────────────
    for esc in escalation_boundaries:
        escname = (esc.get("name", "") or "escalation").lower().replace(" ", "_")
        trigger_conditions = esc.get("trigger_conditions", [])
        response_key = esc.get("response_key")
        response_value = esc.get("response_value", True)
        max_response_seconds = esc.get("max_response_seconds")
        trigger_time_key = esc.get("trigger_time_key")
        triggered = True
        for tc in trigger_conditions:
            tcvar = tc.get("variable", "")
            tcop = tc.get("operator", "gt")
            tcval = tc.get("value")
            sv_val = state_vector.get(tcvar)
            if sv_val is None:
                triggered = False
                break
            try:
                sv_num = float(sv_val)
                tc_num = float(tcval) if tcval is not None else None
            except (ValueError, TypeError):
                sv_num = None
                tc_num = None
            met = False
            if tcop == "gt" and sv_num is not None and tc_num is not None: met = sv_num > tc_num
            elif tcop == "gte" and sv_num is not None and tc_num is not None: met = sv_num >= tc_num
            elif tcop == "lt" and sv_num is not None and tc_num is not None: met = sv_num < tc_num
            elif tcop == "eq": met = str(sv_val).lower() == str(tcval).lower()
            elif tcop == "present": met = True
            elif tcop == "truthy": met = str(sv_val).lower() in ("true", "1", "yes")
            if not met:
                triggered = False
                break
        if not triggered:
            continue
        if response_key:
            resp_val = state_vector.get(response_key)
            if resp_val is not None:
                if isinstance(response_value, bool):
                    if (str(resp_val).lower() in ("true", "1", "yes")) == response_value:
                        continue
                elif str(resp_val).lower() == str(response_value).lower():
                    continue
        if max_response_seconds and trigger_time_key and current_timestamp:
            trigger_time = state_vector.get(trigger_time_key)
            if trigger_time is not None:
                try:
                    from datetime import datetime as _dt
                    if isinstance(trigger_time, str):
                        tt = _dt.fromisoformat(trigger_time.replace("Z", "+00:00")).replace(tzinfo=None)
                    elif isinstance(trigger_time, (int, float)):
                        tt = _dt.utcfromtimestamp(float(trigger_time))
                    else:
                        tt = None
                    if tt and (current_timestamp - tt).total_seconds() <= float(max_response_seconds):
                        continue
                except:
                    pass
        in_envelope = False
        violations.append({
            "var": escname,
            "value": {tc.get("variable"): state_vector.get(tc.get("variable")) for tc in trigger_conditions},
            "bound": "escalation_overdue", "response_key": response_key,
            "max_response_seconds": max_response_seconds
        })
        min_distance = min(min_distance, 0)

    # ── 25. PROTOCOL / ORDERED CHECKLIST ──────────────────────
    for proto in protocol_boundaries:
        pname = (proto.get("name", "") or "protocol").lower().replace(" ", "_")
        steps = proto.get("steps", [])
        protocol_active_key = proto.get("active_key")
        if not steps:
            continue
        if protocol_active_key:
            active_val = state_vector.get(protocol_active_key)
            if active_val is None or str(active_val).lower() in ("false", "0", "no", "inactive"):
                continue
        prev_step_complete = True
        for step_idx, step in enumerate(steps):
            step_key = step.get("key", "")
            required_value = step.get("required_value", True)
            sv_val = state_vector.get(step_key)
            step_complete = False
            if sv_val is not None:
                if isinstance(required_value, bool):
                    step_complete = str(sv_val).lower() in ("true", "1", "yes", "done", "complete")
                else:
                    step_complete = str(sv_val).lower() == str(required_value).lower()
            if not step_complete and prev_step_complete:
                for later_step in steps[step_idx + 1:]:
                    later_val = state_vector.get(later_step.get("key", ""))
                    if later_val is not None and str(later_val).lower() in ("true", "1", "yes", "done", "complete"):
                        in_envelope = False
                        violations.append({
                            "var": pname, "value": f"Step '{later_step.get('key')}' before '{step_key}'",
                            "bound": "protocol_order", "skipped_step": step_key, "completed_step": later_step.get("key")
                        })
                        min_distance = min(min_distance, 0)
                        break
            prev_step_complete = step_complete

    # ── 26. RATIO / PROPORTION ────────────────────────────────
    for rat in ratio_boundaries:
        ratname = (rat.get("name", "") or "ratio").lower().replace(" ", "_")
        numerator_key = rat.get("numerator_key")
        denominator_key = rat.get("denominator_key")
        min_ratio = rat.get("min_ratio")
        max_ratio = rat.get("max_ratio")
        if not numerator_key or not denominator_key:
            continue
        num_val = state_vector.get(numerator_key)
        den_val = state_vector.get(denominator_key)
        if num_val is None or den_val is None:
            continue
        try:
            num = float(num_val)
            den = float(den_val)
        except (ValueError, TypeError):
            continue
        if den == 0:
            continue
        ratio_val = num / den
        if min_ratio is not None and ratio_val < float(min_ratio):
            in_envelope = False
            violations.append({"var": ratname, "value": round(ratio_val, 4), "bound": "min_ratio", "threshold": float(min_ratio), "numerator": round(num, 2), "denominator": round(den, 2)})
            min_distance = min(min_distance, float(min_ratio) - ratio_val)
        if max_ratio is not None and ratio_val > float(max_ratio):
            in_envelope = False
            violations.append({"var": ratname, "value": round(ratio_val, 4), "bound": "max_ratio", "threshold": float(max_ratio), "numerator": round(num, 2), "denominator": round(den, 2)})
            min_distance = min(min_distance, ratio_val - float(max_ratio))

    # ── 27. JURISDICTION / SCOPE / AUTHORIZATION ──────────────
    for jur in jurisdiction_boundaries:
        jurname = (jur.get("name", "") or "jurisdiction").lower().replace(" ", "_")
        role_key = jur.get("role_key", "system_role")
        action_key = jur.get("action_key")
        allowed_actions = jur.get("allowed_actions", {})
        prohibited_actions = jur.get("prohibited_actions", {})
        scope_key = jur.get("scope_key")
        allowed_scopes = jur.get("allowed_scopes")
        if scope_key and allowed_scopes:
            scope_val = state_vector.get(scope_key)
            if scope_val is not None and str(scope_val).lower() not in [str(s).lower() for s in allowed_scopes]:
                in_envelope = False
                violations.append({"var": jurname, "value": scope_val, "bound": "scope_unauthorized", "allowed_scopes": allowed_scopes})
                min_distance = min(min_distance, 0)
                continue
        current_role = state_vector.get(role_key)
        current_action = state_vector.get(action_key) if action_key else None
        if not current_role or not current_action:
            continue
        role_str = str(current_role).lower()
        action_str = str(current_action).lower()
        if allowed_actions:
            for r, actions in allowed_actions.items():
                if str(r).lower() == role_str:
                    role_allowed = [str(a).lower() for a in actions]
                    if action_str not in role_allowed:
                        in_envelope = False
                        violations.append({"var": jurname, "value": action_str, "bound": "action_not_allowed", "role": role_str, "allowed_actions": role_allowed})
                        min_distance = min(min_distance, 0)
                    break
        if prohibited_actions:
            for r, actions in prohibited_actions.items():
                if str(r).lower() == role_str:
                    role_prohibited = [str(a).lower() for a in actions]
                    if action_str in role_prohibited:
                        in_envelope = False
                        violations.append({"var": jurname, "value": action_str, "bound": "action_prohibited", "role": role_str})
                        min_distance = min(min_distance, 0)
                    break

    return in_envelope, min_distance if min_distance != float("inf") else 0, violations


def compute_metrics(telemetry_samples: List[Telemetry]) -> Dict[str, float]:
    """Compute convergence, drift, and stability metrics."""
    if not telemetry_samples:
        return {"convergence": 0, "drift": 0, "stability": 0, "margin": 0}
    
    conformant = sum(1 for t in telemetry_samples if t.in_envelope)
    convergence = conformant / len(telemetry_samples) if telemetry_samples else 0
    
    # Drift: rate of envelope distance change
    if len(telemetry_samples) >= 2:
        distances = [t.envelope_distance for t in telemetry_samples[-100:]]  # Last 100 samples
        if len(distances) >= 2:
            drift = abs(distances[-1] - distances[0]) / len(distances)
        else:
            drift = 0
    else:
        drift = 0
    
    # Stability: variance in convergence over recent samples
    recent = telemetry_samples[-100:]
    if recent:
        recent_conformant = [1 if t.in_envelope else 0 for t in recent]
        mean = sum(recent_conformant) / len(recent_conformant)
        variance = sum((x - mean) ** 2 for x in recent_conformant) / len(recent_conformant)
        stability = 1 - min(variance, 1)  # Higher = more stable
    else:
        stability = 0
    
    # Margin: average distance to boundary
    margin = sum(t.envelope_distance for t in telemetry_samples) / len(telemetry_samples) if telemetry_samples else 0
    
    return {"convergence": convergence, "drift": drift, "stability": stability, "margin": margin}


async def generate_test_id(db: AsyncSession) -> str:
    """Generate unique test ID."""
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count(CAT72Test.id)).where(CAT72Test.test_id.like(f"CAT72-{year}-%"))
    )
    count = (result.scalar() or 0) + 1
    return f"CAT72-{year}-{count:05d}"


# =============================================================================
# ROUTES
# =============================================================================

@router.post("/tests", summary="Create new CAT-72 test")
async def create_test(
    data: TestCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin", "operator"]))
):
    """Create a new CAT-72 test."""
    # Get application
    result = await db.execute(select(Application).where(Application.id == data.application_id))
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if application.state not in ["approved", "under_review", "observe"]:
        raise HTTPException(status_code=400, detail=f"Application must be in UNDER_REVIEW or OBSERVE state")
    
    test_id = await generate_test_id(db)
    
    test = CAT72Test(
        test_id=test_id,
        application_id=application.id,
        duration_hours=data.duration_hours,
        envelope_definition=application.envelope_definition,
        state="scheduled",
        operator_id=int(user["sub"]),
        evidence_chain=[],
    )
    
    db.add(test)
    
    # Application stays approved until test completes
    
    await db.commit()
    await db.refresh(test)
    await write_audit_log(db, action="test_created", resource_type="cat72_test", resource_id=test.id,
        user_id=int(user["sub"]), user_email=user.get("email"), details={"test_id": test.test_id})
    
    # Notify applicant
    try:
        from app.models.models import User
        owner_result = await db.execute(select(User).where(User.id == application.applicant_id))
        owner = owner_result.scalar_one_or_none()
        if owner and owner.email:
            from app.services.email_service import send_test_scheduled
            await send_test_scheduled(owner.email, application.system_name, "Within 24 hours")
    except Exception as e:
        print(f"Email error (test scheduled): {e}")
    
    return {
        "id": test.id,
        "test_id": test.test_id,
        "state": test.state,
        "duration_hours": test.duration_hours,
        "message": "Test created and scheduled"
    }


@router.get("/tests", summary="List CAT-72 tests")
async def list_tests(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    page: int = 1,
    per_page: int = 25,
    state: str = None,
    result_filter: str = None,
    search: str = None,
    sort: str = "created_at",
    order: str = "desc",
):
    """List all tests with pagination and filtering."""
    from sqlalchemy import func, or_
    
    query = select(CAT72Test, Application).join(Application, CAT72Test.application_id == Application.id)
    # ── ORG ISOLATION: non-admin users only see their org's tests ──
    _org_f = org_filter(user, Application)
    if _org_f is not None:
        query = query.where(_org_f)
        count_query = count_query.where(_org_f)
    count_query = select(func.count(CAT72Test.id)).select_from(CAT72Test).join(Application, CAT72Test.application_id == Application.id)
    
    if state:
        query = query.where(CAT72Test.state == state)
        count_query = count_query.where(CAT72Test.state == state)
    if result_filter:
        query = query.where(CAT72Test.result == result_filter)
        count_query = count_query.where(CAT72Test.result == result_filter)
    if search:
        sq = f"%{search}%"
        filt = or_(Application.organization_name.ilike(sq), Application.system_name.ilike(sq), CAT72Test.test_id.ilike(sq))
        query = query.where(filt)
        count_query = count_query.where(filt)
    
    sort_map = {"created_at": CAT72Test.created_at, "started_at": CAT72Test.started_at, "convergence_score": CAT72Test.convergence_score, "elapsed_seconds": CAT72Test.elapsed_seconds}
    sort_col = sort_map.get(sort, CAT72Test.created_at)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    rows = result.all()
    
    return {
        "tests": [
            {
                "id": t.id,
                "test_id": t.test_id,
                "organization_name": a.organization_name,
                "system_name": a.system_name,
                "application_id": t.application_id,
                "state": t.state,
                "duration_hours": t.duration_hours,
                "elapsed_seconds": t.elapsed_seconds,
                "total_samples": t.total_samples,
                "conformant_samples": t.conformant_samples,
                "convergence_score": t.convergence_score,
                "interlock_activations": t.interlock_activations,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "ended_at": t.ended_at.isoformat() if t.ended_at else None,
                "result": t.result,
                "certificate_issued": t.result == "PASS",
                "envelope_definition": t.envelope_definition,
            }
            for t, a in rows
        ],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": max(1, -(-total // per_page)),
        }
    }


@router.get("/tests/{test_id}", summary="Get test details")
async def get_test(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get test details."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {
        "id": test.id,
        "test_id": test.test_id,
        "application_id": test.application_id,
        "state": test.state,
        "duration_hours": test.duration_hours,
        "elapsed_seconds": test.elapsed_seconds,
        "started_at": test.started_at.isoformat() if test.started_at else None,
        "ended_at": test.ended_at.isoformat() if test.ended_at else None,
        "total_samples": test.total_samples,
        "conformant_samples": test.conformant_samples,
        "interlock_activations": test.interlock_activations,
        "convergence_score": test.convergence_score,
        "drift_rate": test.drift_rate,
        "stability_index": test.stability_index,
        "envelope_margin": test.envelope_margin,
        "evidence_hash": test.evidence_hash,
        "result": test.result,
        "envelope_definition": test.envelope_definition,
    }


@router.post("/tests/{test_id}/start", summary="Start CAT-72 test execution")
async def start_test(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin", "operator"]))
):
    """Start a CAT-72 test."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test.state != "scheduled":
        raise HTTPException(status_code=400, detail=f"Test must be SCHEDULED to start, currently {test.state}")
    await verify_test_access(test, user, db)
    
    # CRITICAL: Refuse to start without envelope boundaries
    envelope = test.envelope_definition or {}
    boundaries = envelope.get("boundaries", [])
    if not boundaries:
        raise HTTPException(
            status_code=400,
            detail="Cannot start test: no envelope boundaries defined. "
                   "The ENVELO Interlock must report-specs before the test can begin."
        )
    
    test.state = "running"
    test.started_at = datetime.utcnow()
    
    # Initialize evidence chain with genesis block
    genesis = {
        "type": "genesis",
        "test_id": test.test_id,
        "started_at": test.started_at.isoformat(),
        "operator_id": int(user["sub"]),
        "envelope_definition": test.envelope_definition,
    }
    genesis_hash = compute_hash(genesis)
    test.evidence_chain = [{"block": 0, "hash": genesis_hash, "data": genesis}]
    test.evidence_hash = genesis_hash
    
    await db.commit()
    
    # Notify applicant
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.applicant_id))
            owner = owner_result.scalar_one_or_none()
            if owner and owner.email:
                await send_test_started(owner.email, application.system_name, test.test_id)
    except Exception as e:
        print(f"Email error (test started): {e}")
    
    return {
        "test_id": test.test_id,
        "state": test.state,
        "started_at": test.started_at.isoformat(),
        "genesis_hash": genesis_hash,
        "message": "Test started - 72-hour timer running"
    }




@router.post("/tests/{test_id}/confirm-specs", summary="Confirm specs and start CAT-72")
async def confirm_specs_and_start(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin", "operator"]))
):
    """Admin confirms auto-pulled specs are correct, starts the 72-hour window."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test.state != "spec_review":
        raise HTTPException(status_code=400, detail=f"Test must be in SPEC_REVIEW to confirm, currently {test.state}")
    await verify_test_access(test, user, db)
    
    test.state = "running"
    test.started_at = datetime.utcnow()
    
    # Initialize evidence chain with genesis block
    confirm_block = {
        "type": "specs_confirmed",
        "test_id": test.test_id,
        "started_at": test.started_at.isoformat(),
        "operator_id": int(user["sub"]),
        "confirmed_by": user.get("email"),
        "envelope_definition": test.envelope_definition,
        "specs_confirmed": True,
    }
    prev_hash = test.evidence_hash or ""
    confirm_hash = compute_hash(confirm_block, prev_hash)
    chain = test.evidence_chain or []
    chain.append({"block": len(chain), "hash": confirm_hash, "data": confirm_block})
    test.evidence_chain = chain
    test.evidence_hash = confirm_hash
    
    await db.commit()
    
    await write_audit_log(db, action="specs_confirmed", resource_type="cat72_test", resource_id=test.id,
        user_id=int(user["sub"]), user_email=user.get("email"),
        details={"test_id": test.test_id, "confirmed_by": user.get("email")})
    
    # Notify applicant
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.applicant_id))
            owner = owner_result.scalar_one_or_none()
            if owner and owner.email:
                await send_test_started(owner.email, application.system_name, test.test_id)
    except Exception as e:
        print(f"Email error (specs confirmed): {e}")
    
    return {
        "test_id": test.test_id,
        "state": test.state,
        "started_at": test.started_at.isoformat(),
        "genesis_hash": genesis_hash,
        "message": "Specs confirmed - 72-hour CAT-72 window started"
    }


@router.post("/tests/{test_id}/telemetry", summary="Submit test telemetry data")
async def ingest_telemetry(
    test_id: str,
    data: TelemetryInput,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Ingest telemetry data point. Requires authentication."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # ── RATE LIMITING ──
    if not check_telemetry_rate(test_id):
        raise HTTPException(429, "Rate limit exceeded — max 120 samples/minute, 10/second burst")
    
    # ── SANITIZE STATE VECTOR: strip nulls, validate types ──
    if not data.state_vector or not isinstance(data.state_vector, dict):
        raise HTTPException(400, "state_vector must be a non-empty JSON object")
    # Strip null values — missing data should be absent, not null
    data.state_vector = {k: v for k, v in data.state_vector.items() if v is not None}
    if not data.state_vector:
        raise HTTPException(400, "state_vector contains no non-null values")
    # Coerce stringified numbers
    for k, v in list(data.state_vector.items()):
        if isinstance(v, str):
            try:
                fv = float(v)
                data.state_vector[k] = int(fv) if fv == int(fv) else fv
            except (ValueError, TypeError):
                pass  # leave as string (categorical)
    
    if test.state not in ("running", "learning"):
        raise HTTPException(status_code=400, detail="Test is not running")
    
    timestamp = (data.timestamp.replace(tzinfo=None) if data.timestamp else datetime.utcnow())
    elapsed = int((timestamp.replace(tzinfo=None) - test.started_at).total_seconds()) if test.started_at else 0
    
    # Check if test duration exceeded — auto-complete with full PASS/FAIL logic
    max_seconds = test.duration_hours * 3600
    if elapsed >= max_seconds:
        test.state = "completed"
        test.ended_at = timestamp
        
        # Compute final metrics (same as stop_test)
        telemetry_result = await db.execute(
            select(Telemetry).where(Telemetry.test_id == test.id).order_by(Telemetry.timestamp)
        )
        telemetry_samples = telemetry_result.scalars().all()
        metrics = compute_metrics(telemetry_samples)
        test.convergence_score = metrics["convergence"]
        test.drift_rate = metrics["drift"]
        test.stability_index = metrics["stability"]
        
        if (test.convergence_score >= settings.CAT72_CONVERGENCE_THRESHOLD and
            test.drift_rate <= settings.CAT72_DRIFT_THRESHOLD and
            test.stability_index >= settings.CAT72_STABILITY_THRESHOLD):
            test.result = "PASS"
        else:
            test.result = "FAIL"
        
        # Final evidence block
        final_block = {
            "type": "final",
            "test_id": test.test_id,
            "ended_at": test.ended_at.isoformat(),
            "total_samples": test.total_samples,
            "conformant_samples": test.conformant_samples,
            "convergence_score": test.convergence_score,
            "drift_rate": test.drift_rate,
            "stability_index": test.stability_index,
            "result": test.result,
        }
        final_hash = compute_hash(final_block, test.evidence_hash or "")
        chain = test.evidence_chain or []
        chain.append({"block": len(chain), "hash": final_hash, "data": final_block})
        test.evidence_chain = chain
        test.evidence_hash = final_hash
        
        # Update application state
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            if test.result == "PASS":
                application.state = CertificationState.CONFORMANT
            else:
                application.state = "failed"
        
        await db.commit()
        
        # Auto-issue certificate on pass
        if test.result == "PASS":
            try:
                from datetime import timedelta
                import hashlib as _hl
                if application and not (await db.execute(select(Certificate).where(Certificate.application_id == application.id))).scalar_one_or_none():
                    now_cert = datetime.utcnow()
                    year = now_cert.year
                    cert_count_r = await db.execute(select(func.count(Certificate.id)).where(Certificate.certificate_number.like(f"ODDC-{year}-%")))
                    cert_count = (cert_count_r.scalar() or 0) + 1
                    cert_number = f"ODDC-{year}-{cert_count:05d}"
                    sig_content = f"{cert_number}:{application.organization_name}:{application.system_name}:{now_cert.isoformat()}:{test.evidence_hash}"
                    signature = _hl.sha256(sig_content.encode()).hexdigest()
                    certificate = Certificate(
                        certificate_number=cert_number, application_id=application.id,
                        organization_name=application.organization_name, system_name=application.system_name,
                        system_version=application.system_version, odd_specification=application.odd_specification,
                        envelope_definition=test.envelope_definition or application.envelope_definition,
                        state="conformant", issued_at=now_cert, expires_at=now_cert + timedelta(days=365),
                        issued_by=0, test_id=test.id, convergence_score=test.convergence_score,
                        evidence_hash=test.evidence_hash, signature=signature,
                        verification_url=f"https://sentinelauthority.org/verify.html?cert={cert_number}",
                        history=[{"action": "auto_issued", "timestamp": now_cert.isoformat(), "by": "system", "trigger": "cat72_auto_complete"}],
                    )
                    db.add(certificate)
                    await db.commit()
                    import logging
                    logging.getLogger("main").info(f"AUTO-ISSUED certificate {cert_number} for {application.system_name}")
                    
                    # Send certificate email
                    try:
                        owner_r = await db.execute(select(User).where(User.id == application.applicant_id))
                        owner = owner_r.scalar_one_or_none()
                        if owner and owner.email:
                            await send_certificate_issued(owner.email, application.system_name, test.test_id, cert_number)
                    except Exception as e:
                        logging.getLogger("main").warning(f"Certificate email failed: {e}")
            except Exception as e:
                import logging
                logging.getLogger("main").error(f"Auto-certificate failed: {e}")
        
        # Send fail email if needed
        if test.result == "FAIL" and application:
            try:
                owner_r = await db.execute(select(User).where(User.id == application.applicant_id))
                owner = owner_r.scalar_one_or_none()
                if owner and owner.email:
                    reason = []
                    if test.convergence_score < 0.95: reason.append(f"Convergence {test.convergence_score:.1%} < 95%")
                    if test.drift_rate and test.drift_rate > 0.005: reason.append(f"Drift {test.drift_rate:.4f} > 0.005")
                    if test.stability_index and test.stability_index < 0.90: reason.append(f"Stability {test.stability_index:.1%} < 90%")
                    await send_test_failed(owner.email, application.system_name, "; ".join(reason) or "Did not meet thresholds", (test.convergence_score or 0) * 100)
            except Exception as e:
                import logging
                logging.getLogger("main").warning(f"Fail email error: {e}")
        
        return {"completed": True, "result": test.result, "convergence_score": test.convergence_score}
    
    # Fetch previous telemetry for rate-of-change, connectivity, and statistical checks
    prev_result = await db.execute(
        select(Telemetry).where(Telemetry.test_id == test.id)
        .order_by(Telemetry.timestamp.desc()).limit(1)
    )
    prev_sample = prev_result.scalar_one_or_none()
    prev_sv = prev_sample.state_vector if prev_sample else None
    sample_gap = (timestamp - prev_sample.timestamp).total_seconds() if prev_sample and prev_sample.timestamp else None
    
    # Fetch recent samples for statistical/rolling window checks (last 100)
    recent_result = await db.execute(
        select(Telemetry.state_vector).where(Telemetry.test_id == test.id)
        .order_by(Telemetry.timestamp.desc()).limit(100)
    )
    recent_svs = [row[0] for row in recent_result.fetchall() if row[0]]
    
    # Count recent violations for frequency checks (last hour)
    from datetime import timedelta as _td
    hour_ago = timestamp - _td(hours=1)
    viol_result = await db.execute(
        select(func.count(InterlockEvent.id)).where(
            InterlockEvent.test_id == test.id,
            InterlockEvent.timestamp >= hour_ago
        )
    )
    recent_viol_count = viol_result.scalar() or 0
    
    # Build cumulative state from test running totals
    cumul_state = test.cumulative_state if hasattr(test, 'cumulative_state') and test.cumulative_state else {}
    
    # Build baseline metrics (from first N samples or stored baseline)
    baseline = test.baseline_metrics if hasattr(test, 'baseline_metrics') and test.baseline_metrics else {}
    
    # ── LEARNING MODE: Profile instead of enforce ──────────
    if test.state == "learning":
        env = dict(test.envelope_definition or {})
        lp = env.get("_learning_profile") or {"variables": {}, "sample_count": 0}
        profile_state_vector(lp, data.state_vector, prev_sv, sample_gap)
        env["_learning_profile"] = lp
        test.envelope_definition = env
        from sqlalchemy.orm.attributes import flag_modified as _fm
        _fm(test, "envelope_definition")
        
        test.total_samples = (test.total_samples or 0) + 1
        test.conformant_samples = (test.conformant_samples or 0) + 1
        
        sample = Telemetry(
            test_id=test.id,
            timestamp=timestamp,
            state_vector=data.state_vector,
            in_envelope=True,
            envelope_distance=0,
            elapsed_seconds=elapsed,
        )
        sample.sample_hash = hashlib.sha256(
            json.dumps(data.state_vector, sort_keys=True).encode()
        ).hexdigest()
        sample.convergence_score = 1.0
        db.add(sample)
        await db.commit()
        await db.refresh(sample)
        
        return {
            "mode": "learning",
            "sample_number": test.total_samples,
            "timestamp": timestamp.isoformat(),
            "elapsed_seconds": elapsed,
            "variables_profiled": len(lp.get("variables", {})),
            "total_learning_samples": lp.get("sample_count", 0),
            "sample_hash": sample.sample_hash,
            "message": "Sample recorded for learning. No enforcement active."
        }
    
    # Check envelope — full 15-type boundary enforcement
    in_envelope, distance, violations = check_envelope(
        state_vector=data.state_vector,
        envelope=test.envelope_definition or {},
        prev_state_vector=prev_sv,
        sample_interval_s=sample_gap,
        current_timestamp=timestamp,
        test_stats={
            "total_samples": test.total_samples or 0,
            "conformant_samples": test.conformant_samples or 0,
            "interlock_activations": test.interlock_activations or 0,
            "elapsed_seconds": elapsed,
        },
        recent_samples=recent_svs,
        recent_violations_count=recent_viol_count,
        recent_violations_window=3600,
        cumulative_state=cumul_state,
        baseline_metrics=baseline,
    )
    
    # Get previous hash
    prev_hash = test.evidence_hash or ""
    
    # Create telemetry record
    sample_data = {
        "timestamp": timestamp.isoformat(),
        "elapsed": elapsed,
        "state_vector": data.state_vector,
        "in_envelope": in_envelope,
        "distance": distance,
    }
    sample_hash = compute_hash(sample_data, prev_hash)
    
    # Separate numeric and categorical values for storage
    # DB envelope_distance must be float; state_vector stored as JSON
    numeric_sv = {}
    categorical_sv = {}
    for k, v in data.state_vector.items():
        try:
            numeric_sv[k] = float(v)
        except (ValueError, TypeError):
            categorical_sv[k] = str(v)
    
    # Store full state_vector as JSON-safe dict
    safe_state_vector = {**{k: v for k, v in numeric_sv.items()}, **categorical_sv}
    
    telemetry = Telemetry(
        test_id=test.id,
        timestamp=timestamp,
        elapsed_seconds=elapsed,
        state_vector=safe_state_vector,
        in_envelope=in_envelope,
        envelope_distance=float(distance) if distance is not None else 0.0,
        sample_hash=sample_hash,
        prev_hash=prev_hash,
    )
    db.add(telemetry)
    
    # Update test stats
    test.total_samples = (test.total_samples or 0) + 1
    if in_envelope:
        test.conformant_samples = (test.conformant_samples or 0) + 1
    test.elapsed_seconds = elapsed
    test.evidence_hash = sample_hash
    
    # Handle interlock events (violations)
    interlock_event = None
    if violations:
        test.interlock_activations = (test.interlock_activations or 0) + 1
        # ── FIRST INTERLOCK NOTIFICATION ──
        if test.interlock_activations == 1:
            try:
                _app_r = await db.execute(select(Application).where(Application.id == test.application_id))
                _app = _app_r.scalar_one_or_none()
                if _app:
                    _own_r = await db.execute(select(User).where(User.id == _app.applicant_id))
                    _own = _own_r.scalar_one_or_none()
                    if _own:
                        await send_first_interlock(_own.email, _app.system_name, test.test_id, violations)
            except Exception as e:
                print(f"Failed to send first-interlock email: {e}")
        # ── FIRST INTERLOCK NOTIFICATION ──
        if test.interlock_activations == 1:
            try:
                _app_r = await db.execute(select(Application).where(Application.id == test.application_id))
                _app = _app_r.scalar_one_or_none()
                if _app:
                    _own_r = await db.execute(select(User).where(User.id == _app.applicant_id))
                    _own = _own_r.scalar_one_or_none()
                    if _own:
                        await send_first_interlock(_own.email, _app.system_name, test.test_id, violations)
            except Exception as e:
                print(f"Failed to send first-interlock email: {e}")
        
        # Create interlock event
        v = violations[0]  # Primary violation
        event_data = {
            "timestamp": timestamp.isoformat(),
            "trigger": v,
            "action": "constrain",
        }
        event_hash = compute_hash(event_data, sample_hash)
        
        # Coerce values for DB storage — trigger_value/threshold_value are Float columns
        try:
            tv = float(v["value"])
        except (ValueError, TypeError):
            tv = None  # categorical value — stored in event_data JSON instead
        try:
            th = float(v["threshold"]) if not isinstance(v["threshold"], (list, dict)) else None
        except (ValueError, TypeError):
            th = None
        
        interlock_event = InterlockEvent(
            test_id=test.id,
            timestamp=timestamp,
            elapsed_seconds=elapsed,
            trigger_type="boundary_violation" if tv is not None else "categorical_violation",
            trigger_parameter=v["var"],
            trigger_value=tv,
            threshold_value=th,
            action_type="constrain",
            state_before={"state_vector": {k: str(val) if not isinstance(val, (int, float)) else val for k, val in data.state_vector.items()}, "violation": v},
            event_hash=event_hash,
        )
        db.add(interlock_event)
    
    # Compute running metrics
    if test.total_samples > 0:
        test.convergence_score = test.conformant_samples / test.total_samples
    
    await db.commit()
    
    return {
        "sample_number": test.total_samples,
        "timestamp": timestamp.isoformat(),
        "elapsed_seconds": elapsed,
        "in_envelope": in_envelope,
        "envelope_distance": distance,
        "sample_hash": sample_hash,
        "convergence_score": test.convergence_score,
        "interlock_triggered": interlock_event is not None,
    }


@router.post("/tests/{test_id}/stop", summary="Stop running test")
async def stop_test(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin", "operator"]))
):
    """Stop a running test and compute final results."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test.state != "running":
        raise HTTPException(status_code=400, detail="Test is not running")
    
    test.state = "completed"
    test.ended_at = datetime.utcnow()
    
    # Compute final metrics
    telemetry_result = await db.execute(
        select(Telemetry).where(Telemetry.test_id == test.id).order_by(Telemetry.timestamp)
    )
    samples = telemetry_result.scalars().all()
    
    metrics = compute_metrics(samples)
    test.convergence_score = metrics["convergence"]
    test.drift_rate = metrics["drift"]
    test.stability_index = metrics["stability"]
    test.envelope_margin = metrics["margin"]
    
    # Determine result
    if (test.convergence_score >= settings.CAT72_CONVERGENCE_THRESHOLD and
        test.drift_rate <= settings.CAT72_DRIFT_THRESHOLD and
        test.stability_index >= settings.CAT72_STABILITY_THRESHOLD):
        test.result = "PASS"
    else:
        test.result = "FAIL"
    
    # Final evidence block
    final_block = {
        "type": "final",
        "test_id": test.test_id,
        "ended_at": test.ended_at.isoformat(),
        "total_samples": test.total_samples,
        "conformant_samples": test.conformant_samples,
        "convergence_score": test.convergence_score,
        "drift_rate": test.drift_rate,
        "stability_index": test.stability_index,
        "result": test.result,
    }
    final_hash = compute_hash(final_block, test.evidence_hash or "")
    
    chain = test.evidence_chain or []
    chain.append({"block": len(chain), "hash": final_hash, "data": final_block})
    test.evidence_chain = chain
    test.evidence_hash = final_hash

    # Update application state based on result
    app_result = await db.execute(select(Application).where(Application.id == test.application_id))
    application = app_result.scalar_one_or_none()
    if application:
        if test.result == "PASS":
            application.state = CertificationState.CONFORMANT
        else:
            application.state = "failed"  # Distinct state — requires retest, not re-intake

    await db.commit()
    
    # Notify applicant of result
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.applicant_id))
            owner = owner_result.scalar_one_or_none()
            if owner and owner.email:
                if test.result == "PASS":
                    await send_certificate_issued(
                        owner.email, application.system_name,
                        test.test_id, "Pending issuance"
                    )
                else:
                    reason = []
                    if test.convergence_score < 0.95:
                        reason.append(f"Convergence {test.convergence_score:.1%} < 95%")
                    if test.drift_rate and test.drift_rate > 0.005:
                        reason.append(f"Drift rate {test.drift_rate:.4f} > 0.005")
                    if test.stability_index and test.stability_index < 0.90:
                        reason.append(f"Stability {test.stability_index:.1%} < 90%")
                    await send_test_failed(
                        owner.email, application.system_name,
                        "; ".join(reason) or "Did not meet thresholds",
                        (test.convergence_score or 0) * 100
                    )
    except Exception as e:
        print(f"Email error (test result): {e}")
    
    # Auto-issue certificate on pass
    if test.result == "PASS" and test.state == "completed":
        try:
            from app.models.models import Certificate, Application
            from datetime import timedelta
            import hashlib as _hl
            
            app_result = await db.execute(
                select(Application).where(Application.id == test.application_id)
            )
            application = app_result.scalar_one_or_none()
            
            if application:
                # Check no certificate already exists
                existing_cert = await db.execute(
                    select(Certificate).where(Certificate.application_id == application.id)
                )
                if not existing_cert.scalar_one_or_none():
                    now = datetime.utcnow()
                    year = now.year
                    cert_count_r = await db.execute(
                        select(func.count(Certificate.id)).where(
                            Certificate.certificate_number.like(f"ODDC-{year}-%")
                        )
                    )
                    cert_count = (cert_count_r.scalar() or 0) + 1
                    cert_number = f"ODDC-{year}-{cert_count:05d}"
                    
                    sig_content = f"{cert_number}:{application.organization_name}:{application.system_name}:{now.isoformat()}:{test.evidence_hash}"
                    signature = _hl.sha256(sig_content.encode()).hexdigest()
                    
                    certificate = Certificate(
                        certificate_number=cert_number,
                        application_id=application.id,
                        organization_name=application.organization_name,
                        system_name=application.system_name,
                        system_version=application.system_version,
                        odd_specification=application.odd_specification,
                        envelope_definition=test.envelope_definition or application.envelope_definition,
                        state="conformant",
                        issued_at=now,
                        expires_at=now + timedelta(days=365),
                        issued_by=int(user["sub"]),
                        test_id=test.id,
                        convergence_score=test.convergence_score,
                        evidence_hash=test.evidence_hash,
                        signature=signature,
                        verification_url=f"https://sentinelauthority.org/verify.html?cert={cert_number}",
                        history=[{"action": "auto_issued", "timestamp": now.isoformat(), "by": "system", "trigger": "cat72_pass"}],
                    )
                    db.add(certificate)
                    
                    # Update application state
                    application.state = "conformant"
                    
                    await db.commit()
                    print(f"AUTO-ISSUED certificate {cert_number} for {application.system_name}")
                    
                    # Notify applicant
                    try:
                        from app.services.email_service import send_email
                        if application.contact_email:
                            await send_email(
                                application.contact_email,
                                f"ODDC Certificate Issued — {cert_number}",
                                f"Your system '{application.system_name}' has passed CAT-72 verification.\n\n"
                                f"Certificate: {cert_number}\n"
                                f"Convergence: {test.convergence_score:.4f}\n"
                                f"Verify: https://sentinelauthority.org/verify.html?cert={cert_number}\n\n"
                                f"Your certificate is now live in the public registry."
                            )
                    except Exception as email_err:
                        print(f"Certificate email failed: {email_err}")
        except Exception as cert_err:
            print(f"Auto-certificate failed: {cert_err}")

    return {
        "test_id": test.test_id,
        "state": test.state,
        "result": test.result,
        "ended_at": test.ended_at.isoformat(),
        "total_samples": test.total_samples,
        "conformant_samples": test.conformant_samples,
        "convergence_score": test.convergence_score,
        "drift_rate": test.drift_rate,
        "stability_index": test.stability_index,
        "envelope_margin": test.envelope_margin,
        "evidence_hash": test.evidence_hash,
    }


@router.get("/tests/{test_id}/metrics", summary="Get test metrics summary")
async def get_test_metrics(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get real-time test metrics."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    max_seconds = test.duration_hours * 3600
    remaining = max(0, max_seconds - (test.elapsed_seconds or 0))
    progress = (test.elapsed_seconds or 0) / max_seconds * 100 if max_seconds > 0 else 0
    
    # Get latest telemetry
    latest_result = await db.execute(
        select(Telemetry).where(Telemetry.test_id == test.id).order_by(Telemetry.timestamp.desc()).limit(1)
    )
    latest = latest_result.scalar_one_or_none()
    
    return {
        "test_id": test.test_id,
        "state": test.state,
        "elapsed_seconds": test.elapsed_seconds or 0,
        "remaining_seconds": remaining,
        "progress_percent": round(progress, 2),
        "total_samples": test.total_samples or 0,
        "conformant_samples": test.conformant_samples or 0,
        "conformance_rate": test.convergence_score or 0,
        "interlock_activations": test.interlock_activations or 0,
        "current_convergence": test.convergence_score or 0,
        "current_drift": test.drift_rate or 0,
        "current_stability": test.stability_index or 0,
        "envelope_margin": test.envelope_margin or 0,
        "latest_state_vector": latest.state_vector if latest else None,
        "evidence_hash": test.evidence_hash,
    }


@router.get("/tests/{test_id}/interlock-events", summary="Get interlock event log")
async def get_interlock_events(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get interlock events for a test."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    events_result = await db.execute(
        select(InterlockEvent).where(InterlockEvent.test_id == test.id).order_by(InterlockEvent.timestamp.desc()).limit(100)
    )
    events = events_result.scalars().all()
    
    return [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat(),
            "elapsed_seconds": e.elapsed_seconds,
            "trigger_type": e.trigger_type,
            "trigger_parameter": e.trigger_parameter,
            "trigger_value": e.trigger_value,
            "threshold_value": e.threshold_value,
            "action_type": e.action_type,
            "event_hash": e.event_hash,
        }
        for e in events
    ]


@router.get("/tests/{test_id}/evidence", summary="Get test evidence package")
async def get_evidence_chain(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get evidence hash chain for a test."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {
        "test_id": test.test_id,
        "current_hash": test.evidence_hash,
        "chain": test.evidence_chain or [],
        "total_samples": test.total_samples,
    }
