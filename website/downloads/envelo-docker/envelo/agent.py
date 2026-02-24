"""
ENVELO Agent - Core Enforcement Engine
The heart of the ENVELO system that actually blocks unauthorized actions
"""

import os
import sys
import time
import json
import uuid
import signal
import logging
import hashlib
import threading
import functools
from queue import Queue, Empty
from typing import Any, Callable, Dict, List, Optional, Union
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import contextmanager

try:
    import requests
except ImportError:
    print("[ENVELO] Installing required package: requests")
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests

from .config import EnveloConfig
from .boundaries import (
    Boundary, NumericBoundary, GeoBoundary, TimeBoundary, 
    RateBoundary, StateBoundary, boundary_from_dict
)
from .discovery import DiscoveryEngine
from .exceptions import (
    EnveloViolation, EnveloConnectionError, EnveloConfigError,
    EnveloNotStartedError, EnveloFailsafeError, EnveloTamperError
)


class EnveloAgent:
    """
    ENVELO Enforcement Agent
    
    Wraps autonomous system code and BLOCKS execution when boundaries are violated.
    This is not a logger - it is an ENFORCER that prevents unauthorized actions.
    
    Usage:
        agent = EnveloAgent()
        agent.start()
        
        @agent.enforce
        def move_robot(speed, position):
            # This code ONLY runs if speed and position are within boundaries
            robot.actuate(speed, position)
        
        # Or use context manager
        with agent.enforced(speed=50, position=current_pos):
            robot.move()
        
        # Or check directly
        if agent.check(speed=50):
            do_action()
    """
    
    def __init__(self, config: EnveloConfig = None, **kwargs):
        """
        Initialize ENVELO Agent
        
        Args:
            config: EnveloConfig object, or pass kwargs directly
            **kwargs: Config options (api_key, certificate_number, etc.)
        """
        if config:
            self.config = config
        else:
            self.config = EnveloConfig(**kwargs)
        
        # Core state
        self._started = False
        self._session_id: Optional[str] = None
        self._boundaries: Dict[str, Boundary] = {}
        self._parameter_map: Dict[str, str] = {}  # param -> boundary name
        
        # Failsafe state
        self._failsafe_active = False
        self._last_server_contact = None
        self._connection_failures = 0
        
        # Statistics
        self._stats = {
            "pass_count": 0,
            "block_count": 0,
            "failsafe_blocks": 0,
            "session_start": None,
            "violations": []
        }
        
        # Background threads
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._telemetry_thread: Optional[threading.Thread] = None
        self._telemetry_queue: Queue = Queue()
        self._running = False
        
        # Offline buffer
        self._offline_buffer: List[Dict] = []
        
        # Logging
        self._setup_logging()
        
        self.logger.info(f"ENVELO Agent initialized (config hash: {self.config._config_hash})")
    
    def _setup_logging(self):
        """Configure logging"""
        self.logger = logging.getLogger("envelo")
        self.logger.setLevel(getattr(logging, self.config.log_level.upper()))
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                "[ENVELO] %(asctime)s %(levelname)s: %(message)s",
                datefmt="%H:%M:%S"
            ))
            self.logger.addHandler(handler)
        
        if self.config.log_file:
            fh = logging.FileHandler(self.config.log_file)
            fh.setFormatter(logging.Formatter(
                "%(asctime)s %(levelname)s: %(message)s"
            ))
            self.logger.addHandler(fh)
    
    # =========================================================================
    # LIFECYCLE MANAGEMENT
    # =========================================================================
    
    def start(self) -> bool:
        """
        Start the ENVELO agent.
        - Validates configuration
        - Fetches boundaries from Sentinel Authority
        - Starts telemetry and heartbeat threads
        - Registers session with server
        
        Returns True if started successfully.
        """
        self.logger.info("=" * 60)
        self.logger.info("ENVELO Agent Starting")
        self.logger.info(f"  System: {self.config.system_name or 'Unknown'}")
        self.logger.info(f"  Certificate: {self.config.certificate_number or 'Unknown'}")
        self.logger.info(f"  Mode: {self.config.enforcement_mode}")
        self.logger.info(f"  Fail-Closed: {self.config.fail_closed}")
        self.logger.info("=" * 60)
        
        # Validate config
        try:
            self.config.validate()
        except ValueError as e:
            self.logger.error(f"Configuration error: {e}")
            raise EnveloConfigError(str(e))
        
        # Fetch boundaries from server
        if not self._fetch_boundaries():
            # No server boundaries — enter auto-discovery mode
            self.logger.info("[ENVELO] No boundaries from server — entering auto-discovery mode")
            self._discovery_mode = True
            self._discovery.start()
            if self.config.fail_closed:
                self.logger.error("Cannot fetch boundaries and fail_closed=True. Cannot start.")
                return False
            else:
                self.logger.warning("Cannot fetch boundaries, starting with empty boundaries")
        
        # Generate session ID
        self._session_id = str(uuid.uuid4())
        self._stats["session_start"] = datetime.utcnow()
        
        # Register session with server
        self._register_session()
        
        # Start background threads
        self._running = True
        self._start_heartbeat()
        self._start_telemetry_worker()
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        self._started = True
        self._last_server_contact = time.time()
        
        self.logger.info(f"✓ ENVELO Agent started (session: {self._session_id[:8]}...)")
        self.logger.info(f"✓ Loaded {len(self._boundaries)} boundaries")
        
        return True
    
    def stop(self):
        """Stop the ENVELO agent gracefully"""
        self.logger.info("Stopping ENVELO Agent...")
        
        self._running = False
        
        # Flush remaining telemetry
        self._flush_telemetry()
        
        # End session with server
        self._end_session()
        
        # Log final statistics
        self.logger.info("=" * 60)
        self.logger.info("ENVELO Session Complete")
        self.logger.info(f"  Duration: {self._get_session_duration()}")
        self.logger.info(f"  Passed: {self._stats['pass_count']}")
        self.logger.info(f"  Blocked: {self._stats['block_count']}")
        self.logger.info(f"  Failsafe blocks: {self._stats['failsafe_blocks']}")
        self.logger.info("=" * 60)
        
        self._started = False
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)
    
    # =========================================================================
    # BOUNDARY ENFORCEMENT - THE CORE BLOCKING MECHANISM
    # =========================================================================
    
    def check(self, **params) -> bool:
        # Feed parameters to discovery engine if in discovery mode
        if self._discovery_mode:
            self._discovery.observe(**params)
            if self._discovery.state == DiscoveryEngine.ENFORCING:
                # Discovery complete — boundaries are now loaded
                self._discovery_mode = False
                self.logger.info("[ENVELO] Discovery complete — enforcement active")
            else:
                # Still discovering — allow all actions
                self._queue_telemetry("check", params, "ALLOW_DISCOVERY")
                return True

        """
        Check if parameters are within boundaries.
        
        Returns True if ALL parameters pass, False if ANY violate.
        Does NOT raise exceptions in BLOCK mode.
        
        Usage:
            if agent.check(speed=50, temperature=25):
                do_action()
        """
        if not self._started:
            raise EnveloNotStartedError("Agent not started. Call agent.start() first.")
        
        # Failsafe check - only hard-block if NO boundaries loaded
        # If we have cached boundaries, continue enforcing with them
        if self._failsafe_active and len(self._boundaries) == 0:
            self._stats["failsafe_blocks"] += 1
            self.logger.warning(f"FAILSAFE BLOCK (no boundaries): {params}")
            if self.config.enforcement_mode == "EXCEPTION":
                raise EnveloFailsafeError()
            return False
        
        if self._failsafe_active:
            # We have cached boundaries - continue enforcing locally
            self.logger.debug(f"OFFLINE ENFORCEMENT (using cached boundaries): {params}")
        
        # Check all parameters
        all_passed = True
        violations = []
        
        for param, value in params.items():
            passed, msg = self._check_parameter(param, value)
            if not passed:
                all_passed = False
                violations.append({"parameter": param, "value": value, "message": msg})
        
        # Record statistics
        if all_passed:
            self._stats["pass_count"] += 1
            self._queue_telemetry("check", params, "PASS")
        else:
            self._stats["block_count"] += 1
            self._stats["violations"].extend(violations)
            self._queue_telemetry("check", params, "BLOCK", violations)
            
            for v in violations:
                self.logger.warning(f"⛔ VIOLATION: {v['message']}")
            
            # Execute safe state callback if configured
            if self.config.enforcement_mode == "SAFE_STATE" and self.config.safe_state_callback:
                try:
                    self.config.safe_state_callback(violations)
                except Exception as e:
                    self.logger.error(f"Safe state callback error: {e}")
            
            # Raise exception if in EXCEPTION mode
            if self.config.enforcement_mode == "EXCEPTION" and violations:
                v = violations[0]
                raise EnveloViolation(
                    boundary_name=self._parameter_map.get(v["parameter"], "unknown"),
                    parameter=v["parameter"],
                    value=v["value"],
                    limit="boundary",
                    message=v["message"]
                )
        
        return all_passed
    
    def _check_parameter(self, param: str, value: Any) -> tuple:
        """Check a single parameter against its boundary"""
        # Find boundary for this parameter
        boundary_name = self._parameter_map.get(param)
        if not boundary_name:
            # No boundary defined for this parameter - allow by default
            return True, None
        
        boundary = self._boundaries.get(boundary_name)
        if not boundary or not boundary.enabled:
            return True, None
        
        return boundary.check(value)
    
    def enforce(self, func: Callable = None, **param_mapping):
        """
        Decorator that enforces boundaries on function parameters.
        
        The function WILL NOT EXECUTE if any parameter violates boundaries.
        
        Usage:
            @agent.enforce
            def move(speed, position):
                robot.actuate(speed, position)
            
            # With parameter mapping (if function params differ from boundary params)
            @agent.enforce(velocity="speed")
            def move(velocity, pos):
                robot.actuate(velocity, pos)
        """
        def decorator(fn):
            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                # Feed discovery engine
                if self._discovery_mode:
                    mapped = {}
                    sig_params = list(fn.__code__.co_varnames[:fn.__code__.co_argcount])
                    for i, arg in enumerate(args):
                        if i < len(sig_params):
                            mapped[sig_params[i]] = arg
                    mapped.update(kwargs)
                    self._discovery.observe(**mapped)
                    if self._discovery.state == DiscoveryEngine.ENFORCING:
                        self._discovery_mode = False
                    else:
                        return fn(*args, **kwargs)  # Allow during discovery
                # Build parameter dict from function arguments
                import inspect
                sig = inspect.signature(fn)
                bound = sig.bind(*args, **kwargs)
                bound.apply_defaults()
                
                # Map parameters
                check_params = {}
                for param_name, value in bound.arguments.items():
                    # Use mapping if provided, otherwise use param name directly
                    boundary_param = param_mapping.get(param_name, param_name)
                    check_params[boundary_param] = value
                
                # ENFORCE - block execution if violation
                if not self.check(**check_params):
                    self.logger.warning(f"⛔ BLOCKED: {fn.__name__}({check_params})")
                    return None  # Function does NOT execute
                
                # All checks passed - execute function
                return fn(*args, **kwargs)
            
            return wrapper
        
        if func is not None:
            # Called as @agent.enforce without arguments
            return decorator(func)
        else:
            # Called as @agent.enforce(param_mapping)
            return decorator
    
    @contextmanager
    def enforced(self, **params):
        """
        Context manager for enforcing boundaries.
        
        Code inside the `with` block WILL NOT EXECUTE if boundaries violated.
        
        Usage:
            with agent.enforced(speed=50, position=current_pos):
                robot.move()  # Only executes if boundaries pass
        """
        if not self.check(**params):
            self.logger.warning(f"⛔ BLOCKED context: {params}")
            # Yield nothing - the block will be skipped
            class SkipBlock(Exception): pass
            try:
                yield False
                raise SkipBlock()
            except SkipBlock:
                return
        
        yield True
    
    def must_check(self, **params) -> bool:
        """
        Same as check() but raises EnveloViolation on failure regardless of mode.
        Use when you need guaranteed exception behavior.
        """
        if not self._started:
            raise EnveloNotStartedError("Agent not started. Call agent.start() first.")
        
        if self._failsafe_active:
            raise EnveloFailsafeError()
        
        for param, value in params.items():
            passed, msg = self._check_parameter(param, value)
            if not passed:
                raise EnveloViolation(
                    boundary_name=self._parameter_map.get(param, "unknown"),
                    parameter=param,
                    value=value,
                    limit="boundary",
                    message=msg
                )
        
        self._stats["pass_count"] += 1
        return True
    
    # =========================================================================
    # BOUNDARY MANAGEMENT
    # =========================================================================
    
    def _fetch_boundaries(self) -> bool:
        """Fetch boundary configuration from Sentinel Authority"""
        try:
            response = requests.get(
                f"{self.config.api_endpoint}/api/envelo/boundaries/config",
                headers={"Authorization": f"Bearer {self.config.api_key}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self._load_boundaries(data)
                self._cache_boundaries(data)  # Cache for offline use
                self._last_server_contact = time.time()
                self.logger.info("Boundaries fetched from Sentinel Authority")
                return True
            else:
                self.logger.error(f"Failed to fetch boundaries: {response.status_code}")
                return self._load_cached_boundaries()  # Fallback to cache
                
        except requests.RequestException as e:
            self.logger.warning(f"Cannot reach Sentinel Authority: {e}")
            self.logger.info("Attempting to load cached boundaries for offline enforcement...")
            return self._load_cached_boundaries()  # Fallback to cache
    
    def _load_boundaries(self, config: Dict):
        """Load boundaries from configuration dictionary"""
        self._boundaries.clear()
        self._parameter_map.clear()
        
        # Load numeric boundaries
        for b in config.get("numeric_boundaries", []):
            try:
                boundary = NumericBoundary.from_dict(b)
                self._boundaries[boundary.name] = boundary
                self._parameter_map[boundary.parameter] = boundary.name
            except Exception as e:
                self.logger.warning(f"Failed to load boundary: {e}")
        
        # Load geo boundaries
        for b in config.get("geo_boundaries", []):
            try:
                boundary = GeoBoundary.from_dict(b)
                self._boundaries[boundary.name] = boundary
                self._parameter_map[boundary.parameter] = boundary.name
            except Exception as e:
                self.logger.warning(f"Failed to load geo boundary: {e}")
        
        # Load time boundaries
        for b in config.get("time_boundaries", []):
            try:
                boundary = TimeBoundary.from_dict(b)
                self._boundaries[boundary.name] = boundary
                self._parameter_map[boundary.parameter] = boundary.name
            except Exception as e:
                self.logger.warning(f"Failed to load time boundary: {e}")
        
        # Load rate boundaries
        for b in config.get("rate_boundaries", []):
            try:
                boundary = RateBoundary.from_dict(b)
                self._boundaries[boundary.name] = boundary
                self._parameter_map[boundary.parameter] = boundary.name
            except Exception as e:
                self.logger.warning(f"Failed to load rate boundary: {e}")
        
        # Load state boundaries
        for b in config.get("state_boundaries", []):
            try:
                boundary = StateBoundary.from_dict(b)
                self._boundaries[boundary.name] = boundary
                self._parameter_map[boundary.parameter] = boundary.name
            except Exception as e:
                self.logger.warning(f"Failed to load state boundary: {e}")
        
        self.logger.info(f"Loaded {len(self._boundaries)} boundaries")
    
    def add_boundary(self, boundary: Boundary):
        """Add a boundary manually (for testing or local-only boundaries)"""
        self._boundaries[boundary.name] = boundary
        self._parameter_map[boundary.parameter] = boundary.name

    def _cache_boundaries(self, config: Dict):
        """Cache boundaries locally for offline enforcement"""
        if not self.config.cache_boundaries_locally:
            return
        try:
            cache_path = Path(self.config.boundary_cache_path)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, "w") as f:
                json.dump({
                    "cached_at": datetime.utcnow().isoformat() + "Z",
                    "certificate_number": self.config.certificate_number,
                    "config": config
                }, f)
            self.logger.debug(f"Boundaries cached to {cache_path}")
        except Exception as e:
            self.logger.warning(f"Failed to cache boundaries: {e}")

    def _load_cached_boundaries(self) -> bool:
        """Load boundaries from local cache (for offline operation)"""
        if not self.config.enforce_with_cached_boundaries:
            return False
        try:
            cache_path = Path(self.config.boundary_cache_path)
            if not cache_path.exists():
                self.logger.warning("No cached boundaries found")
                return False
            with open(cache_path) as f:
                data = json.load(f)
            if data.get("certificate_number") != self.config.certificate_number:
                self.logger.warning("Cached boundaries are for different certificate")
                return False
            self._load_boundaries(data["config"])
            self.logger.info(f"Loaded {len(self._boundaries)} boundaries from CACHE (offline mode)")
            self.logger.info(f"  Cached at: {data.get(cached_at, unknown)}")
            return True
        except Exception as e:
            self.logger.warning(f"Failed to load cached boundaries: {e}")
            return False
        """Add a boundary manually (for testing or local-only boundaries)"""
        self._boundaries[boundary.name] = boundary
        self._parameter_map[boundary.parameter] = boundary.name
    
    def get_boundary(self, name: str) -> Optional[Boundary]:
        """Get a boundary by name"""
        return self._boundaries.get(name)
    
    def list_boundaries(self) -> List[str]:
        """List all boundary names"""
        return list(self._boundaries.keys())
    
    # =========================================================================
    # SERVER COMMUNICATION
    # =========================================================================
    
    def _register_session(self):
        """Register this session with Sentinel Authority"""
        try:
            response = requests.post(
                f"{self.config.api_endpoint}/api/envelo/sessions",
                headers={"Authorization": f"Bearer {self.config.api_key}"},
                json={
                    "session_id": self._session_id,
                    "certificate_number": self.config.certificate_number,
                    "started_at": datetime.utcnow().isoformat() + "Z",
                    "agent_version": "1.0.0",
                    "config_hash": self.config._config_hash,
                    "enforcement_mode": self.config.enforcement_mode,
                    "boundary_count": len(self._boundaries)
                },
                timeout=10
            )
            if response.ok:
                self._last_server_contact = time.time()
                self.logger.debug("Session registered with server")
            else:
                self.logger.warning(f"Failed to register session: {response.status_code}")
        except Exception as e:
            self.logger.warning(f"Could not register session: {e}")
    
    def _end_session(self):
        """End session with Sentinel Authority"""
        try:
            response = requests.post(
                f"{self.config.api_endpoint}/api/envelo/sessions/{self._session_id}/end",
                headers={"Authorization": f"Bearer {self.config.api_key}"},
                json={
                    "ended_at": datetime.utcnow().isoformat() + "Z",
                    "final_stats": {
                        "pass_count": self._stats["pass_count"],
                        "block_count": self._stats["block_count"],
                        "failsafe_blocks": self._stats["failsafe_blocks"],
                        "duration_seconds": self._get_session_duration_seconds()
                    }
                },
                timeout=10
            )
            if response.ok:
                self.logger.debug("Session ended with server")
        except Exception as e:
            self.logger.warning(f"Could not end session: {e}")
    
    def _start_heartbeat(self):
        """Start background heartbeat thread"""
        def heartbeat_loop():
            while self._running:
                try:
                    response = requests.post(
                        f"{self.config.api_endpoint}/api/envelo/heartbeat",
                        headers={"Authorization": f"Bearer {self.config.api_key}"},
                        json={
                            "session_id": self._session_id,
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "stats": {
                                "pass_count": self._stats["pass_count"],
                                "block_count": self._stats["block_count"]
                            }
                        },
                        timeout=self.config.heartbeat_timeout
                    )
                    
                    if response.ok:
                        self._last_server_contact = time.time()
                        self._connection_failures = 0
                        if self._failsafe_active:
                            self.logger.info("Connection restored, exiting failsafe mode")
                            self._failsafe_active = False
                    else:
                        self._handle_connection_failure()
                        
                except Exception as e:
                    self._handle_connection_failure()
                
                time.sleep(self.config.heartbeat_interval)
        
        self._heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()
    
    def _handle_connection_failure(self):
        """Handle server connection failure"""
        self._connection_failures += 1
        
        if self._last_server_contact:
            time_since_contact = time.time() - self._last_server_contact
        else:
            time_since_contact = float('inf')
        
        if time_since_contact > self.config.failsafe_timeout_seconds:
            if not self._failsafe_active and self.config.fail_closed:
                self.logger.error("=" * 60)
                self.logger.error("ENTERING FAILSAFE MODE")
                self.logger.error(f"No server contact for {time_since_contact:.0f}s")
                self.logger.error("ALL ACTIONS WILL BE BLOCKED")
                self.logger.error("=" * 60)
                self._failsafe_active = True
    
    # =========================================================================
    # TELEMETRY
    # =========================================================================
    
    def _queue_telemetry(self, action_type: str, params: Dict, result: str, violations: List = None):
        """Queue telemetry record for async transmission"""
        record = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "session_id": self._session_id,
            "action_type": action_type,
            "parameters": params,
            "result": result,
            "violations": violations or []
        }
        
        self._telemetry_queue.put(record)
    
    def _start_telemetry_worker(self):
        """Start background telemetry transmission thread"""
        def telemetry_loop():
            batch = []
            last_flush = time.time()
            
            while self._running or not self._telemetry_queue.empty():
                try:
                    record = self._telemetry_queue.get(timeout=0.1)
                    batch.append(record)
                except Empty:
                    pass
                
                # Flush batch if full or interval elapsed
                should_flush = (
                    len(batch) >= self.config.telemetry_batch_size or
                    (time.time() - last_flush) >= self.config.telemetry_flush_interval
                )
                
                if should_flush and batch:
                    self._send_telemetry_batch(batch)
                    batch = []
                    last_flush = time.time()
            
            # Final flush
            if batch:
                self._send_telemetry_batch(batch)
        
        self._telemetry_thread = threading.Thread(target=telemetry_loop, daemon=True)
        self._telemetry_thread.start()
    
    def _send_telemetry_batch(self, batch: List[Dict]):
        """Send telemetry batch to server"""
        try:
            response = requests.post(
                f"{self.config.api_endpoint}/api/envelo/telemetry",
                headers={"Authorization": f"Bearer {self.config.api_key}"},
                json={
                    "certificate_number": self.config.certificate_number,
                    "session_id": self._session_id,
                    "records": batch
                },
                timeout=10
            )
            
            if response.ok:
                self._last_server_contact = time.time()
            else:
                # Buffer for retry
                self._offline_buffer.extend(batch)
                if len(self._offline_buffer) > self.config.offline_buffer_size:
                    self._offline_buffer = self._offline_buffer[-self.config.offline_buffer_size:]
                    
        except Exception as e:
            # Buffer for retry
            self._offline_buffer.extend(batch)
    
    def _flush_telemetry(self):
        """Flush any remaining telemetry"""
        if self._telemetry_thread and self._telemetry_thread.is_alive():
            self._running = False
            self._telemetry_thread.join(timeout=5)
    
    # =========================================================================
    # UTILITIES
    # =========================================================================
    
    def _get_session_duration(self) -> str:
        """Get human-readable session duration"""
        if not self._stats["session_start"]:
            return "0s"
        
        delta = datetime.utcnow() - self._stats["session_start"]
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
    
    def _get_session_duration_seconds(self) -> float:
        """Get session duration in seconds"""
        if not self._stats["session_start"]:
            return 0
        return (datetime.utcnow() - self._stats["session_start"]).total_seconds()
    
    def get_stats(self) -> Dict:
        """Get current session statistics"""
        return {
            "session_id": self._session_id,
            "started": self._started,
            "failsafe_active": self._failsafe_active,
            "pass_count": self._stats["pass_count"],
            "block_count": self._stats["block_count"],
            "failsafe_blocks": self._stats["failsafe_blocks"],
            "duration": self._get_session_duration(),
            "boundary_count": len(self._boundaries),
            "last_server_contact": self._last_server_contact
        }
    
    @property
    def _on_discovery_complete(self, boundaries, envelope_definition):
        """Called when auto-discovery finishes generating boundaries."""
        self.logger.info(f"[ENVELO] Auto-discovered {len(boundaries)} boundaries")

        # Load discovered boundaries into enforcement engine
        for b in boundaries:
            self._boundaries[b.parameter] = b
            self.logger.info(f"  → {b.name}: {b.parameter}")

        # Upload envelope to Sentinel Authority
        try:
            resp = requests.post(
                f"{self.config.api_endpoint}/api/envelo/boundaries/discovered",
                headers={"Authorization": f"Bearer {self.config.api_key}"},
                json={
                    "session_id": self._session_id,
                    "envelope_definition": envelope_definition,
                },
                timeout=10,
            )
            if resp.ok:
                self.logger.info("[ENVELO] Envelope uploaded to Sentinel Authority")
            else:
                self.logger.warning(f"[ENVELO] Envelope upload failed: {resp.status_code}")
        except Exception as e:
            self.logger.warning(f"[ENVELO] Envelope upload error: {e}")
            # Still enforce locally even if upload fails

        self.logger.info("[ENVELO] ═══════════════════════════════════════════")
        self.logger.info("[ENVELO] AUTO-DISCOVERY COMPLETE — ENFORCEMENT ACTIVE")
        self.logger.info(f"[ENVELO] {len(boundaries)} boundaries now enforced")
        self.logger.info("[ENVELO] ═══════════════════════════════════════════")

    def get_discovery_stats(self):
        """Return current auto-discovery statistics."""
        return self._discovery.get_discovery_stats()

    def is_running(self) -> bool:
        """Check if agent is running"""
        return self._started and self._running
    
    @property
    def in_failsafe(self) -> bool:
        """Check if agent is in failsafe mode"""
        return self._failsafe_active
