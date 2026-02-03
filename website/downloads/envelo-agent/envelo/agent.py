"""
ENVELO Agent v2.0
Enforced Non-Violable Execution-Limit Override

Key change: Boundaries are fetched from Sentinel Authority API, not configured locally.
This ensures the agent enforces exactly what was approved during certification.
"""

import hashlib
import json
import time
import threading
import queue
import os
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
import httpx

__version__ = "2.0.0"


# ============================================
# EXCEPTIONS
# ============================================

class EnveloError(Exception):
    """Base exception for ENVELO errors"""
    pass


class BoundaryViolation(EnveloError):
    """Raised when an action violates a boundary"""
    def __init__(self, boundary_name: str, message: str, value: Any = None, limit: Any = None):
        self.boundary_name = boundary_name
        self.message = message
        self.value = value
        self.limit = limit
        super().__init__(f"Boundary violation [{boundary_name}]: {message}")


class ConfigurationError(EnveloError):
    """Raised when agent cannot fetch or parse configuration"""
    pass


# ============================================
# CONFIGURATION
# ============================================

@dataclass
class EnveloConfig:
    """Agent configuration - only API key and endpoint needed"""
    api_key: str
    api_endpoint: str = "https://sentinel-authority-production.up.railway.app"
    
    # These are fetched from API, not set locally
    certificate_id: Optional[str] = None
    certificate_number: Optional[str] = None
    
    # Local settings
    fail_closed: bool = True  # If API unreachable, block all actions
    safe_state_callback: Optional[Callable] = None
    log_local: bool = True
    local_log_path: str = "./envelo_logs"
    
    # Fetched from API
    boundaries: Dict[str, Any] = field(default_factory=dict)


# ============================================
# BOUNDARY EVALUATORS
# ============================================

class BoundaryEvaluator:
    """Evaluates a single boundary definition against action parameters"""
    
    @staticmethod
    def evaluate_numeric(boundary: Dict, params: Dict) -> tuple[bool, str]:
        """Evaluate numeric boundary (speed, temp, etc.)"""
        param_name = boundary.get("parameter")
        if param_name not in params:
            return True, "Parameter not present"
        
        value = params[param_name]
        min_val = boundary.get("min_value")
        max_val = boundary.get("max_value")
        tolerance = boundary.get("tolerance", 0)
        
        if min_val is not None and value < (min_val - tolerance):
            return False, f"{param_name}={value} below minimum {min_val}"
        
        if max_val is not None and value > (max_val + tolerance):
            return False, f"{param_name}={value} exceeds maximum {max_val}"
        
        return True, "Within bounds"
    
    @staticmethod
    def evaluate_geo(boundary: Dict, params: Dict) -> tuple[bool, str]:
        """Evaluate geographic boundary"""
        lat = params.get("latitude") or params.get("lat")
        lon = params.get("longitude") or params.get("lon")
        
        if lat is None or lon is None:
            return True, "No location data"
        
        boundary_type = boundary.get("boundary_type", "circle")
        
        if boundary_type == "circle":
            center = boundary.get("center", {})
            radius = boundary.get("radius_meters", 0)
            
            # Haversine distance calculation
            from math import radians, cos, sin, sqrt, atan2
            R = 6371000  # Earth radius in meters
            
            lat1, lon1 = radians(center.get("lat", 0)), radians(center.get("lon", 0))
            lat2, lon2 = radians(lat), radians(lon)
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance = R * c
            
            if distance > radius:
                return False, f"Location {distance:.0f}m from center exceeds {radius}m radius"
        
        # TODO: Implement polygon boundary check
        
        return True, "Within geographic bounds"
    
    @staticmethod
    def evaluate_time(boundary: Dict, params: Dict) -> tuple[bool, str]:
        """Evaluate time-based boundary"""
        now = datetime.now()
        
        start_hour = boundary.get("allowed_hours_start", 0)
        end_hour = boundary.get("allowed_hours_end", 23)
        allowed_days = boundary.get("allowed_days", [0, 1, 2, 3, 4, 5, 6])
        
        current_hour = now.hour
        current_day = now.weekday()
        
        if current_day not in allowed_days:
            return False, f"Day {current_day} not in allowed days {allowed_days}"
        
        if not (start_hour <= current_hour <= end_hour):
            return False, f"Hour {current_hour} outside allowed hours {start_hour}-{end_hour}"
        
        return True, "Within operating hours"
    
    @staticmethod
    def evaluate_state(boundary: Dict, params: Dict) -> tuple[bool, str]:
        """Evaluate state-based boundary"""
        param_name = boundary.get("parameter")
        if param_name not in params:
            return True, "State parameter not present"
        
        value = params[param_name]
        allowed = boundary.get("allowed_values", [])
        forbidden = boundary.get("forbidden_values", [])
        
        if forbidden and value in forbidden:
            return False, f"State '{value}' is forbidden"
        
        if allowed and value not in allowed:
            return False, f"State '{value}' not in allowed states {allowed}"
        
        return True, "State allowed"


# ============================================
# MAIN AGENT
# ============================================

class EnveloAgent:
    """
    ENVELO Enforcement Agent
    
    Fetches approved boundary configuration from Sentinel Authority
    and enforces those boundaries on all actions.
    """
    
    def __init__(self, config: EnveloConfig):
        self.config = config
        self.boundaries_loaded = False
        self.session_id = None
        self.pass_count = 0
        self.block_count = 0
        
        # Telemetry queue
        self._telemetry_queue = queue.Queue()
        self._running = False
        self._telemetry_thread = None
        
        # HTTP client
        self._client = httpx.Client(
            base_url=config.api_endpoint,
            headers={"X-API-Key": config.api_key},
            timeout=30.0
        )
        
        # Fetch boundaries on init
        self._fetch_boundaries()
        
        # Start telemetry thread
        self._start_telemetry_thread()
    
    def _fetch_boundaries(self):
        """Fetch approved boundary configuration from Sentinel Authority"""
        print(f"[ENVELO] Fetching boundary configuration from {self.config.api_endpoint}...")
        
        try:
            # Try production config first (for certified systems)
            response = self._client.get("/api/envelo/boundaries/config")
            
            if response.status_code == 404:
                # Try test config (for CAT-72 testing)
                response = self._client.get("/api/envelo/boundaries/config/test")
            
            if response.status_code != 200:
                raise ConfigurationError(f"Failed to fetch boundaries: {response.status_code} - {response.text}")
            
            data = response.json()
            
            # Store configuration
            self.config.certificate_id = data.get("certificate_id")
            self.config.certificate_number = data.get("certificate_number")
            self.config.boundaries = {
                "numeric": data.get("numeric_boundaries", []),
                "geo": data.get("geo_boundaries", []),
                "time": data.get("time_boundaries", []),
                "state": data.get("state_boundaries", []),
                "rate": data.get("rate_boundaries", []),
                "safe_state": data.get("safe_state", {}),
                "fail_closed": data.get("fail_closed", True)
            }
            
            self.boundaries_loaded = True
            
            # Print loaded boundaries
            print(f"[ENVELO] ✓ Configuration loaded for: {data.get('system_name', 'Unknown')}")
            print(f"[ENVELO]   Certificate: {data.get('certificate_number', 'TESTING')}")
            print(f"[ENVELO]   Boundaries: {len(self.config.boundaries['numeric'])} numeric, "
                  f"{len(self.config.boundaries['geo'])} geo, "
                  f"{len(self.config.boundaries['time'])} time")
            
            # Register session
            self._register_session()
            
        except httpx.RequestError as e:
            if self.config.fail_closed:
                raise ConfigurationError(f"Cannot reach Sentinel Authority: {e}. Fail-closed mode active.")
            else:
                print(f"[ENVELO] ⚠ Warning: Cannot fetch boundaries: {e}. Running in permissive mode.")
    
    def _register_session(self):
        """Register monitoring session with Sentinel Authority"""
        try:
            response = self._client.post("/api/envelo/register", json={
                "agent_version": __version__,
                "certificate_id": self.config.certificate_number
            })
            
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get("session_id")
                print(f"[ENVELO] ✓ Session registered: {self.session_id}")
            else:
                print(f"[ENVELO] ⚠ Session registration failed: {response.status_code}")
                
        except Exception as e:
            print(f"[ENVELO] ⚠ Session registration error: {e}")
    
    def _start_telemetry_thread(self):
        """Start background thread for sending telemetry"""
        self._running = True
        self._telemetry_thread = threading.Thread(target=self._telemetry_worker, daemon=True)
        self._telemetry_thread.start()
    
    def _telemetry_worker(self):
        """Background worker that sends telemetry batches"""
        batch = []
        last_send = time.time()
        
        while self._running:
            try:
                # Collect from queue with timeout
                try:
                    record = self._telemetry_queue.get(timeout=1.0)
                    batch.append(record)
                except queue.Empty:
                    pass
                
                # Send batch every second or when batch is large
                if batch and (time.time() - last_send >= 1.0 or len(batch) >= 10):
                    self._send_telemetry_batch(batch)
                    batch = []
                    last_send = time.time()
                    
            except Exception as e:
                print(f"[ENVELO] Telemetry error: {e}")
    
    def _send_telemetry_batch(self, batch: List[Dict]):
        """Send telemetry batch to Sentinel Authority"""
        if not self.session_id:
            return
        
        try:
            response = self._client.post("/api/envelo/telemetry", json={
                "session_id": self.session_id,
                "records": batch
            })
            
            if response.status_code != 200:
                print(f"[ENVELO] Telemetry send failed: {response.status_code}")
                
        except Exception as e:
            # Log locally if remote fails
            if self.config.log_local:
                self._log_locally(batch)
    
    def _log_locally(self, records: List[Dict]):
        """Fallback local logging"""
        os.makedirs(self.config.local_log_path, exist_ok=True)
        filename = f"{self.config.local_log_path}/envelo_{datetime.now().strftime('%Y%m%d')}.jsonl"
        
        with open(filename, "a") as f:
            for record in records:
                f.write(json.dumps(record) + "\n")
    
    def evaluate(self, action_type: str, **params) -> tuple[bool, List[Dict]]:
        """
        Evaluate an action against all approved boundaries.
        Returns (allowed, violations)
        """
        if not self.boundaries_loaded:
            if self.config.fail_closed:
                return False, [{"boundary": "config", "message": "Boundaries not loaded"}]
            return True, []
        
        violations = []
        evaluations = []
        
        # Check numeric boundaries
        for boundary in self.config.boundaries.get("numeric", []):
            passed, msg = BoundaryEvaluator.evaluate_numeric(boundary, params)
            evaluations.append({
                "boundary": boundary.get("name"),
                "type": "numeric",
                "passed": passed,
                "message": msg
            })
            if not passed:
                violations.append({
                    "boundary": boundary.get("name"),
                    "type": "numeric",
                    "message": msg
                })
        
        # Check geo boundaries
        for boundary in self.config.boundaries.get("geo", []):
            passed, msg = BoundaryEvaluator.evaluate_geo(boundary, params)
            evaluations.append({
                "boundary": boundary.get("name"),
                "type": "geo",
                "passed": passed,
                "message": msg
            })
            if not passed:
                violations.append({
                    "boundary": boundary.get("name"),
                    "type": "geo",
                    "message": msg
                })
        
        # Check time boundaries
        for boundary in self.config.boundaries.get("time", []):
            passed, msg = BoundaryEvaluator.evaluate_time(boundary, params)
            evaluations.append({
                "boundary": boundary.get("name"),
                "type": "time",
                "passed": passed,
                "message": msg
            })
            if not passed:
                violations.append({
                    "boundary": boundary.get("name"),
                    "type": "time",
                    "message": msg
                })
        
        # Check state boundaries
        for boundary in self.config.boundaries.get("state", []):
            passed, msg = BoundaryEvaluator.evaluate_state(boundary, params)
            evaluations.append({
                "boundary": boundary.get("name"),
                "type": "state",
                "passed": passed,
                "message": msg
            })
            if not passed:
                violations.append({
                    "boundary": boundary.get("name"),
                    "type": "state",
                    "message": msg
                })
        
        allowed = len(violations) == 0
        
        # Update counts
        if allowed:
            self.pass_count += 1
        else:
            self.block_count += 1
        
        # Queue telemetry
        self._telemetry_queue.put({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": action_type,
            "parameters": params,
            "allowed": allowed,
            "evaluations": evaluations,
            "violations": violations
        })
        
        return allowed, violations
    
    def enforce(self, action_type: str, **params) -> bool:
        """
        Enforce boundaries on an action.
        Returns True if allowed, raises BoundaryViolation if blocked.
        """
        allowed, violations = self.evaluate(action_type, **params)
        
        if not allowed:
            # Trigger safe state if configured
            if self.config.safe_state_callback:
                self.config.safe_state_callback(violations)
            
            raise BoundaryViolation(
                boundary_name=violations[0]["boundary"],
                message=violations[0]["message"]
            )
        
        return True
    
    def check(self, action_type: str, **params) -> bool:
        """
        Check if action would be allowed without blocking.
        Use for preview/planning.
        """
        allowed, _ = self.evaluate(action_type, **params)
        return allowed
    
    def get_stats(self) -> Dict:
        """Get enforcement statistics"""
        total = self.pass_count + self.block_count
        return {
            "session_id": self.session_id,
            "certificate_number": self.config.certificate_number,
            "pass_count": self.pass_count,
            "block_count": self.block_count,
            "total_actions": total,
            "pass_rate": self.pass_count / total if total > 0 else 1.0,
            "boundaries_loaded": self.boundaries_loaded
        }
    
    def shutdown(self):
        """Graceful shutdown"""
        self._running = False
        if self._telemetry_thread:
            self._telemetry_thread.join(timeout=5.0)
        self._client.close()
        print(f"[ENVELO] Shutdown complete. Stats: {self.pass_count} passed, {self.block_count} blocked")


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def create_agent(api_key: str, api_endpoint: str = None) -> EnveloAgent:
    """
    Create and initialize an ENVELO agent.
    Boundaries are automatically fetched from Sentinel Authority.
    
    Usage:
        agent = create_agent("sa_live_xxx")
        
        # In your action loop:
        if agent.enforce("move", speed=50, direction="north"):
            execute_move()
    """
    config = EnveloConfig(
        api_key=api_key,
        api_endpoint=api_endpoint or "https://sentinel-authority-production.up.railway.app"
    )
    return EnveloAgent(config)


# ============================================
# CLI ENTRY POINT
# ============================================

if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("ENVELO Agent v" + __version__)
    print("Sentinel Authority - ODDC Conformance Enforcement")
    print("=" * 60)
    
    api_key = os.environ.get("ENVELO_API_KEY") or input("API Key: ").strip()
    
    if not api_key:
        print("Error: API key required")
        sys.exit(1)
    
    try:
        agent = create_agent(api_key)
        print("\n[ENVELO] Agent running. Press Ctrl+C to stop.\n")
        
        # Keep alive
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[ENVELO] Shutting down...")
        agent.shutdown()
    except Exception as e:
        print(f"[ENVELO] Error: {e}")
        sys.exit(1)
