"""ENVELO Agent - Core enforcement engine with continuous monitoring"""

import hashlib, json, time, threading, queue
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
import httpx

from .boundaries import Boundary
from .actions import ActionResult
from .exceptions import BoundaryViolation, EnveloError

@dataclass
class EnveloConfig:
    certificate_id: str
    api_key: str
    api_endpoint: str = "https://sentinel-authority-production.up.railway.app"
    telemetry_interval: float = 1.0
    heartbeat_interval: float = 30.0  # Send heartbeat every 30 seconds
    fail_closed: bool = True
    safe_state_callback: Optional[Callable] = None
    log_local: bool = True
    local_log_path: str = "./envelo_logs"
    reconnect_attempts: int = 5
    reconnect_delay: float = 5.0

@dataclass 
class TelemetryRecord:
    timestamp: str
    action_id: str
    action_type: str
    parameters: Dict[str, Any]
    boundary_evaluations: List[Dict[str, Any]]
    result: str
    execution_time_ms: float
    system_state: Dict[str, Any] = field(default_factory=dict)

class EnveloAgent:
    def __init__(self, config: EnveloConfig):
        self.config = config
        self.boundaries: List[Boundary] = []
        self.telemetry_queue: queue.Queue = queue.Queue()
        self._running = False
        self._connected = False
        self._telemetry_thread: Optional[threading.Thread] = None
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._action_counter = 0
        self._session_id = self._generate_session_id()
        self._start_time = datetime.now(timezone.utc)
        self._violation_count = 0
        self._pass_count = 0
        self._block_count = 0
        self._system_state: Dict[str, Any] = {}
        self._state_lock = threading.Lock()
        self._connection_lock = threading.Lock()
        self._last_telemetry_success = None
        self._reconnect_count = 0
        self._start_telemetry_stream()
        self._start_heartbeat()
        self._register_session()
    
    def _generate_session_id(self) -> str:
        data = f"{self.config.certificate_id}:{time.time()}:{id(self)}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _register_session(self):
        for attempt in range(self.config.reconnect_attempts):
            try:
                with httpx.Client(timeout=10) as client:
                    response = client.post(
                        f"{self.config.api_endpoint}/api/envelo/sessions",
                        headers={"Authorization": f"Bearer {self.config.api_key}"},
                        json={
                            "certificate_id": self.config.certificate_id,
                            "session_id": self._session_id,
                            "started_at": self._start_time.isoformat(),
                            "agent_version": "1.1.0",
                            "boundaries": [b.to_dict() for b in self.boundaries]
                        }
                    )
                    if response.status_code == 200:
                        self._connected = True
                        self._reconnect_count = 0
                        print(f"[ENVELO] Session registered: {self._session_id}")
                        return
            except Exception as e:
                print(f"[ENVELO] Connection attempt {attempt + 1} failed: {e}")
                if attempt < self.config.reconnect_attempts - 1:
                    time.sleep(self.config.reconnect_delay)
        
        print(f"[ENVELO] Warning: Could not connect to Sentinel Authority after {self.config.reconnect_attempts} attempts")
        if self.config.fail_closed:
            raise EnveloError("Cannot start: Unable to connect to Sentinel Authority")
        self._connected = False
    
    def _start_telemetry_stream(self):
        self._running = True
        self._telemetry_thread = threading.Thread(target=self._telemetry_worker, daemon=True)
        self._telemetry_thread.start()
    
    def _start_heartbeat(self):
        self._heartbeat_thread = threading.Thread(target=self._heartbeat_worker, daemon=True)
        self._heartbeat_thread.start()
    
    def _heartbeat_worker(self):
        """Send periodic heartbeats to confirm agent is alive"""
        while self._running:
            try:
                time.sleep(self.config.heartbeat_interval)
                if not self._running:
                    break
                self._send_heartbeat()
            except Exception as e:
                print(f"[ENVELO] Heartbeat error: {e}")
    
    def _send_heartbeat(self):
        try:
            with httpx.Client(timeout=5) as client:
                response = client.post(
                    f"{self.config.api_endpoint}/api/envelo/heartbeat",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    json={"session_id": self._session_id}
                )
                if response.status_code == 200:
                    with self._connection_lock:
                        self._connected = True
                        self._reconnect_count = 0
                else:
                    self._handle_connection_issue()
        except Exception as e:
            self._handle_connection_issue()
    
    def _handle_connection_issue(self):
        with self._connection_lock:
            self._reconnect_count += 1
            if self._reconnect_count >= 3:
                self._connected = False
                print(f"[ENVELO] Connection lost - will retry")
    
    def _telemetry_worker(self):
        batch, last_send = [], time.time()
        while self._running:
            try:
                try:
                    batch.append(self.telemetry_queue.get(timeout=0.1))
                except queue.Empty:
                    pass
                if (time.time() - last_send >= self.config.telemetry_interval and batch) or len(batch) >= 100:
                    self._send_telemetry_batch(batch)
                    batch, last_send = [], time.time()
            except Exception as e:
                print(f"[ENVELO] Telemetry error: {e}")
    
    def _send_telemetry_batch(self, batch):
        if not batch:
            return
        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(
                    f"{self.config.api_endpoint}/api/envelo/telemetry",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    json={
                        "certificate_id": self.config.certificate_id,
                        "session_id": self._session_id,
                        "records": [self._record_to_dict(r) for r in batch],
                        "stats": {"pass_count": self._pass_count, "block_count": self._block_count}
                    }
                )
                if response.status_code == 200:
                    self._last_telemetry_success = datetime.now(timezone.utc)
                    with self._connection_lock:
                        self._connected = True
        except Exception as e:
            print(f"[ENVELO] Could not send telemetry: {e}")
            if self.config.log_local:
                self._log_locally(batch)
    
    def _record_to_dict(self, r): 
        return {
            "timestamp": r.timestamp, "action_id": r.action_id, "action_type": r.action_type,
            "parameters": r.parameters, "boundary_evaluations": r.boundary_evaluations,
            "result": r.result, "execution_time_ms": r.execution_time_ms, "system_state": r.system_state
        }
    
    def _log_locally(self, batch):
        import os
        os.makedirs(self.config.local_log_path, exist_ok=True)
        with open(f"{self.config.local_log_path}/envelo_{datetime.now().strftime('%Y%m%d')}.jsonl", "a") as f:
            for r in batch:
                f.write(json.dumps(self._record_to_dict(r)) + "\n")
    
    def add_boundary(self, boundary: Boundary):
        self.boundaries.append(boundary)
        print(f"[ENVELO] Boundary added: {boundary.name}")
    
    def update_state(self, state: Dict[str, Any]):
        with self._state_lock:
            self._system_state.update(state)
    
    def is_connected(self) -> bool:
        """Check if agent is connected to Sentinel Authority"""
        with self._connection_lock:
            return self._connected
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current agent statistics"""
        return {
            "session_id": self._session_id,
            "connected": self.is_connected(),
            "uptime_seconds": (datetime.now(timezone.utc) - self._start_time).total_seconds(),
            "pass_count": self._pass_count,
            "block_count": self._block_count,
            "total_actions": self._pass_count + self._block_count,
            "pass_rate": (self._pass_count / max(self._pass_count + self._block_count, 1)) * 100,
            "boundaries": len(self.boundaries)
        }
    
    def evaluate(self, parameters: Dict[str, Any]) -> ActionResult:
        start_time = time.time()
        self._action_counter += 1
        action_id = f"{self._session_id}-{self._action_counter:08d}"
        evaluations, all_passed, violation_details = [], True, []
        
        for boundary in self.boundaries:
            try:
                result = boundary.evaluate(parameters)
                evaluations.append({
                    "boundary": boundary.name, "type": boundary.boundary_type,
                    "passed": result.passed, "value": result.actual_value,
                    "limit": result.limit_value, "message": result.message
                })
                if not result.passed:
                    all_passed = False
                    violation_details.append(f"{boundary.name}: {result.message}")
            except Exception as e:
                evaluations.append({"boundary": boundary.name, "passed": False, "error": str(e)})
                all_passed = False
                violation_details.append(f"{boundary.name}: Error - {e}")
        
        if all_passed:
            self._pass_count += 1
        else:
            self._block_count += 1
            self._violation_count += 1
            if self.config.safe_state_callback:
                try:
                    self.config.safe_state_callback(parameters, violation_details)
                except:
                    pass
        
        with self._state_lock:
            current_state = self._system_state.copy()
        
        record = TelemetryRecord(
            datetime.now(timezone.utc).isoformat(), action_id,
            parameters.get("_action_type", "unknown"), parameters, evaluations,
            "PASS" if all_passed else "BLOCK", (time.time() - start_time) * 1000, current_state
        )
        self.telemetry_queue.put(record)
        
        return ActionResult(all_passed, action_id, evaluations, violation_details, record.timestamp)
    
    def enforce(self, func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            kwargs["_action_type"] = func.__name__
            result = self.evaluate(kwargs)
            if not result.allowed:
                raise BoundaryViolation(f"Action blocked: {', '.join(result.violations)}")
            return func(*args, **kwargs)
        wrapper.__name__ = func.__name__
        return wrapper
    
    def shutdown(self):
        print("[ENVELO] Shutting down...")
        self._running = False
        if self._telemetry_thread:
            self._telemetry_thread.join(timeout=5)
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=2)
        
        # Flush remaining telemetry
        remaining = []
        while not self.telemetry_queue.empty():
            try:
                remaining.append(self.telemetry_queue.get_nowait())
            except:
                break
        if remaining:
            self._send_telemetry_batch(remaining)
        
        # End session
        try:
            with httpx.Client(timeout=10) as client:
                client.post(
                    f"{self.config.api_endpoint}/api/envelo/sessions/{self._session_id}/end",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    json={
                        "ended_at": datetime.now(timezone.utc).isoformat(),
                        "final_stats": {"pass_count": self._pass_count, "block_count": self._block_count}
                    }
                )
        except:
            pass
        print("[ENVELO] Shutdown complete")
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.shutdown()
        return False
