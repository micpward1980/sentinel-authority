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
from app.core.security import get_current_user, require_role
from app.core.config import settings
from app.services.email_service import (
    send_test_setup_instructions, send_test_started, send_test_failed,
    send_certificate_issued
)
from app.services.audit_service import write_audit_log
from app.models.models import (
    CAT72Test, Application, Telemetry, InterlockEvent, 
    TestState, CertificationState, UserRole
)

router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================

class TestCreate(BaseModel):
    application_id: int
    duration_hours: int = 72


class TelemetryInput(BaseModel):
    state_vector: Dict[str, float]
    timestamp: Optional[datetime] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def compute_hash(data: dict, prev_hash: str = "") -> str:
    """Compute SHA-256 hash for evidence chain."""
    payload = json.dumps(data, sort_keys=True, default=str) + prev_hash
    return hashlib.sha256(payload.encode()).hexdigest()


def check_envelope(state_vector: Dict[str, float], envelope: Dict[str, Any]) -> tuple:
    """Check if state vector is within envelope boundaries."""
    boundaries = envelope.get("boundaries", {})
    min_distance = float("inf")
    in_envelope = True
    violations = []
    
    for var, value in state_vector.items():
        if var in boundaries:
            bounds = boundaries[var]
            min_val = bounds.get("min", float("-inf"))
            max_val = bounds.get("max", float("inf"))
            
            if value < min_val:
                in_envelope = False
                violations.append({"var": var, "value": value, "bound": "min", "threshold": min_val})
                distance = min_val - value
            elif value > max_val:
                in_envelope = False
                violations.append({"var": var, "value": value, "bound": "max", "threshold": max_val})
                distance = value - max_val
            else:
                # Distance to nearest boundary
                distance = min(value - min_val, max_val - value)
            
            min_distance = min(min_distance, distance)
    
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
    
    if application.state not in [CertificationState.UNDER_REVIEW, CertificationState.OBSERVE]:
        raise HTTPException(status_code=400, detail=f"Application must be in UNDER_REVIEW or OBSERVE state")
    
    test_id = await generate_test_id(db)
    
    test = CAT72Test(
        test_id=test_id,
        application_id=application.id,
        duration_hours=data.duration_hours,
        envelope_definition=application.envelope_definition,
        state=TestState.SCHEDULED,
        operator_id=int(user["sub"]),
        evidence_chain=[],
    )
    
    db.add(test)
    
    # Update application state
    application.state = CertificationState.BOUNDED
    
    await db.commit()
    await db.refresh(test)
    await write_audit_log(db, action="test_created", resource_type="cat72_test", resource_id=test.id,
        user_id=int(user["sub"]), user_email=user.get("email"), details={"test_id": test.test_id})
    
    # Notify applicant
    try:
        from app.services.audit_service import write_audit_log
from app.models.models import User
        owner_result = await db.execute(select(User).where(User.id == application.user_id))
        owner = owner_result.scalar_one_or_none()
        if owner and owner.email:
            from app.services.email_service import send_test_scheduled
            await send_test_scheduled(owner.email, application.system_name, "Within 24 hours")
    except Exception as e:
        print(f"Email error (test scheduled): {e}")
    
    return {
        "id": test.id,
        "test_id": test.test_id,
        "state": test.state.value,
        "duration_hours": test.duration_hours,
        "message": "Test created and scheduled"
    }


@router.get("/tests", summary="List CAT-72 tests")
async def list_tests(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """List all tests."""
    result = await db.execute(select(CAT72Test, Application).join(Application, CAT72Test.application_id == Application.id).order_by(CAT72Test.created_at.desc()))
    rows = result.all()
    
    return [
        {
            "id": t.id,
            "test_id": t.test_id,
            "organization_name": a.organization_name,
            "system_name": a.system_name,
            "application_id": t.application_id,
            "state": t.state.value,
            "duration_hours": t.duration_hours,
            "elapsed_seconds": t.elapsed_seconds,
            "total_samples": t.total_samples,
            "conformant_samples": t.conformant_samples,
            "convergence_score": t.convergence_score,
            "interlock_activations": t.interlock_activations,
            "started_at": t.started_at.isoformat() if t.started_at else None,
            "result": t.result,
        }
        for t, a in rows
    ]


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
        "state": test.state.value,
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
    
    if test.state != TestState.SCHEDULED:
        raise HTTPException(status_code=400, detail=f"Test must be SCHEDULED to start, currently {test.state.value}")
    
    test.state = TestState.RUNNING
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
            from app.services.audit_service import write_audit_log
from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.user_id))
            owner = owner_result.scalar_one_or_none()
            if owner and owner.email:
                await send_test_started(owner.email, application.system_name, test.test_id)
    except Exception as e:
        print(f"Email error (test started): {e}")
    
    return {
        "test_id": test.test_id,
        "state": test.state.value,
        "started_at": test.started_at.isoformat(),
        "genesis_hash": genesis_hash,
        "message": "Test started - 72-hour timer running"
    }


@router.post("/tests/{test_id}/telemetry", summary="Submit test telemetry data")
async def ingest_telemetry(
    test_id: str,
    data: TelemetryInput,
    db: AsyncSession = Depends(get_db),
):
    """Ingest telemetry data point."""
    result = await db.execute(select(CAT72Test).where(CAT72Test.test_id == test_id))
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test.state != TestState.RUNNING:
        raise HTTPException(status_code=400, detail="Test is not running")
    
    timestamp = (data.timestamp.replace(tzinfo=None) if data.timestamp else datetime.utcnow())
    elapsed = int((timestamp.replace(tzinfo=None) - test.started_at).total_seconds()) if test.started_at else 0
    
    # Check if test duration exceeded
    max_seconds = test.duration_hours * 3600
    if elapsed >= max_seconds:
        test.state = TestState.COMPLETED
        test.ended_at = timestamp
        await db.commit()
        raise HTTPException(status_code=400, detail="Test duration exceeded")
    
    # Check envelope
    in_envelope, distance, violations = check_envelope(data.state_vector, test.envelope_definition or {})
    
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
    
    telemetry = Telemetry(
        test_id=test.id,
        timestamp=timestamp,
        elapsed_seconds=elapsed,
        state_vector=data.state_vector,
        in_envelope=in_envelope,
        envelope_distance=distance,
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
        
        # Create interlock event
        v = violations[0]  # Primary violation
        event_data = {
            "timestamp": timestamp.isoformat(),
            "trigger": v,
            "action": "constrain",
        }
        event_hash = compute_hash(event_data, sample_hash)
        
        interlock_event = InterlockEvent(
            test_id=test.id,
            timestamp=timestamp,
            elapsed_seconds=elapsed,
            trigger_type="boundary_violation",
            trigger_parameter=v["var"],
            trigger_value=v["value"],
            threshold_value=v["threshold"],
            action_type="constrain",
            state_before=data.state_vector,
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
    
    if test.state != TestState.RUNNING:
        raise HTTPException(status_code=400, detail="Test is not running")
    
    test.state = TestState.COMPLETED
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
    
    await db.commit()
    
    # Notify applicant of result
    try:
        app_result = await db.execute(select(Application).where(Application.id == test.application_id))
        application = app_result.scalar_one_or_none()
        if application:
            from app.services.audit_service import write_audit_log
from app.models.models import User
            owner_result = await db.execute(select(User).where(User.id == application.user_id))
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
    
    return {
        "test_id": test.test_id,
        "state": test.state.value,
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
        "state": test.state.value,
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
