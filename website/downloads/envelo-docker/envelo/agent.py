"""ENVELO Agent - Core enforcement engine"""

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
    api_endpoint: str = "https://api.sentinelauthority.org"
    telemetry_interval: float = 1.0
    fail_closed: bool = True
    safe_state_callback: Optional[Callable] = None
    log_local: bool = True
    local_log_path: str = "./envelo_logs"

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
        self._telemetry_thread: Optional[threading.Thread] = None
        self._action_counter = 0
        self._session_id = self._generate_session_id()
        self._start_time = datetime.now(timezone.utc)
        self._violation_count = 0
        self._pass_count = 0
        self._block_count = 0
        self._system_state: Dict[str, Any] = {}
        self._state_lock = threading.Lock()
        self._start_telemetry_stream()
        self._register_session()
    
    def _generate_session_id(self) -> str:
        data = f"{self.config.certificate_id}:{time.time()}:{id(self)}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _register_session(self):
        try:
            with httpx.Client(timeout=10) as client:
                client.post(f"{self.config.api_endpoint}/api/envelo/sessions",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    json={"certificate_id": self.config.certificate_id, "session_id": self._session_id,
                          "started_at": self._start_time.isoformat(), "agent_version": "1.0.0",
                          "boundaries": [b.to_dict() for b in self.boundaries]})
        except Exception as e:
            print(f"[ENVELO] Warning: Could not connect to Sentinel Authority: {e}")
            if self.config.fail_closed:
                raise EnveloError("Cannot start: Unable to connect to Sentinel Authority")
    
    def _start_telemetry_stream(self):
        self._running = True
        self._telemetry_thread = threading.Thread(target=self._telemetry_worker, daemon=True)
        self._telemetry_thread.start()
    
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
        if not batch: return
        try:
            with httpx.Client(timeout=10) as client:
                client.post(f"{self.config.api_endpoint}/api/envelo/telemetry",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    json={"certificate_id": self.config.certificate_id, "session_id": self._session_id,
                          "records": [self._record_to_dict(r) for r in batch],
                          "stats": {"pass_count": self._pass_count, "block_count": self._block_count}})
        except Exception as e:
            print(f"[ENVELO] Could not send telemetry: {e}")
            if self.config.log_local: self._log_locally(batch)
    
    def _record_to_dict(self, r): 
        return {"timestamp": r.timestamp, "action_id": r.action_id, "action_type": r.action_type,
                "parameters": r.parameters, "boundary_evaluations": r.boundary_evaluations,
                "result": r.result, "execution_time_ms": r.execution_time_ms, "system_state": r.system_state}
    
    def _log_locally(self, batch):
        import os
        os.makedirs(self.config.local_log_path, exist_ok=True)
        with open(f"{self.config.local_log_path}/envelo_{datetime.now().strftime('%Y%m%d')}.jsonl", "a") as f:
            for r in batch: f.write(json.dumps(self._record_to_dict(r)) + "\n")
    
    def add_boundary(self, boundary: Boundary):
        self.boundaries.append(boundary)
        print(f"[ENVELO] Boundary added: {boundary.name}")
    
    def update_state(self, state: Dict[str, Any]):
        with self._state_lock: self._system_state.update(state)
    
    def evaluate(self, parameters: Dict[str, Any]) -> ActionResult:
        start_time = time.time()
        self._action_counter += 1
        action_id = f"{self._session_id}-{self._action_counter:08d}"
        evaluations, all_passed, violation_details = [], True, []
        
        for boundary in self.boundaries:
            try:
                result = boundary.evaluate(parameters)
                evaluations.append({"boundary": boundary.name, "type": boundary.boundary_type,
                                   "passed": result.passed, "value": result.actual_value,
                                   "limit": result.limit_value, "message": result.message})
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
                try: self.config.safe_state_callback(parameters, violation_details)
                except: pass
        
        with self._state_lock: current_state = self._system_state.copy()
        record = TelemetryRecord(datetime.now(timezone.utc).isoformat(), action_id,
                                parameters.get("_action_type", "unknown"), parameters, evaluations,
                                "PASS" if all_passed else "BLOCK", (time.time() - start_time) * 1000, current_state)
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
        if self._telemetry_thread: self._telemetry_thread.join(timeout=5)
        remaining = []
        while not self.telemetry_queue.empty():
            try: remaining.append(self.telemetry_queue.get_nowait())
            except: break
        if remaining: self._send_telemetry_batch(remaining)
        try:
            with httpx.Client(timeout=10) as client:
                client.post(f"{self.config.api_endpoint}/api/envelo/sessions/{self._session_id}/end",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    json={"ended_at": datetime.now(timezone.utc).isoformat(),
                          "final_stats": {"pass_count": self._pass_count, "block_count": self._block_count}})
        except: pass
        print("[ENVELO] Shutdown complete")
    
    def __enter__(self): return self
    def __exit__(self, *args): self.shutdown(); return False
