"""
ENVELO Interlock — Local Enforcement Server
Runs alongside any system. Language-agnostic boundary checking via HTTP.

Endpoints:
    POST /check          Check parameters → {"allowed": true/false, "violations": [...]}
    POST /enforce        Same as /check but returns 403 on violation
    GET  /status         Health + stats
    GET  /boundaries     List active boundaries
    GET  /health         Liveness probe (k8s/docker)

Sentinel Authority © 2025-2026
"""

import json
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional

from .agent import EnveloAgent

logger = logging.getLogger("envelo.server")

_agent: Optional[EnveloAgent] = None


class InterlockHandler(BaseHTTPRequestHandler):
    """Handles enforcement requests over HTTP."""

    # Suppress default logging — we use our own
    def log_message(self, format, *args):
        logger.debug(f"{self.client_address[0]} {format % args}")

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Envelo-Version", "3.0.0")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw)

    # ── POST /check ──────────────────────────────────────
    def _handle_check(self, strict=False):
        if not _agent or not _agent.is_running:
            self._send_json(503, {
                "allowed": False,
                "error": "Interlock not running",
            })
            return

        try:
            params = self._read_json()
        except (json.JSONDecodeError, ValueError) as e:
            self._send_json(400, {"allowed": False, "error": f"Invalid JSON: {e}"})
            return

        if not params:
            self._send_json(400, {"allowed": False, "error": "No parameters provided"})
            return

        # Run enforcement
        violations = []
        all_passed = True

        for param, value in params.items():
            passed, msg = _agent._check_parameter(param, value)
            if not passed:
                all_passed = False
                violations.append({
                    "parameter": param,
                    "value": value,
                    "message": msg,
                })

        # Record stats
        if all_passed:
            with _agent._stats_lock:
                _agent._stats["pass_count"] += 1
            _agent._queue_telemetry("check", params, "PASS")
        else:
            with _agent._stats_lock:
                _agent._stats["block_count"] += 1
                _agent._stats["violations"].extend(violations)
            _agent._queue_telemetry("check", params, "BLOCK", violations)

        result = {
            "allowed": all_passed,
            "violations": violations,
            "boundary_count": len(_agent._boundaries),
        }

        if strict and not all_passed:
            self._send_json(403, result)
        else:
            self._send_json(200, result)

    # ── GET /status ──────────────────────────────────────
    def _handle_status(self):
        if not _agent:
            self._send_json(503, {"status": "not_initialized"})
            return
        self._send_json(200, _agent.get_stats())

    # ── GET /boundaries ──────────────────────────────────
    def _handle_boundaries(self):
        if not _agent:
            self._send_json(503, {"error": "not_initialized"})
            return

        boundaries = []
        for name, b in _agent._boundaries.items():
            entry = b.to_dict()
            entry["enabled"] = b.enabled
            entry["check_count"] = b.check_count
            entry["violation_count"] = b.violation_count
            boundaries.append(entry)

        self._send_json(200, {
            "boundaries": boundaries,
            "count": len(boundaries),
        })

    # ── GET /health ──────────────────────────────────────
    def _handle_health(self):
        if _agent and _agent.is_running:
            self._send_json(200, {"status": "healthy", "failsafe": _agent.in_failsafe})
        else:
            self._send_json(503, {"status": "unhealthy"})

    # ── Routing ──────────────────────────────────────────
    def do_GET(self):
        path = self.path.rstrip("/")
        if path == "/status":
            self._handle_status()
        elif path == "/boundaries":
            self._handle_boundaries()
        elif path == "/health":
            self._handle_health()
        else:
            self._send_json(404, {"error": f"Unknown endpoint: {path}"})

    def do_POST(self):
        path = self.path.rstrip("/")
        if path == "/check":
            self._handle_check(strict=False)
        elif path == "/enforce":
            self._handle_check(strict=True)
        else:
            self._send_json(404, {"error": f"Unknown endpoint: {path}"})


class InterlockServer:
    """Threaded HTTP server for the ENVELO Interlock."""

    def __init__(self, agent: EnveloAgent, host: str = "127.0.0.1", port: int = 9090):
        global _agent
        _agent = agent
        self.host = host
        self.port = port
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Start the server in a background thread."""
        self._server = HTTPServer((self.host, self.port), InterlockHandler)
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            daemon=True,
            name="envelo-server",
        )
        self._thread.start()
        logger.info(f"Interlock server listening on {self.host}:{self.port}")

    def stop(self):
        """Shut down the server."""
        if self._server:
            self._server.shutdown()
            logger.info("Interlock server stopped")


def run_server(agent: EnveloAgent, host: str = "127.0.0.1", port: int = 9090) -> InterlockServer:
    """Convenience function to start the server."""
    server = InterlockServer(agent, host, port)
    server.start()
    return server
