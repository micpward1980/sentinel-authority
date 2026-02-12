#!/usr/bin/env python3
"""
ENVELO Interlock CLI
Usage:
    envelo start [-d]     Start enforcement
    envelo status         Health check
    envelo stop           Stop daemon
    envelo boundaries     Show active boundaries
    envelo version        Show version
"""

import os
import sys
import json
import signal
import time
import threading
from pathlib import Path

from . import __version__
from .agent import EnveloAgent
from .config import EnveloConfig


PID_FILE = Path.home() / ".envelo" / "envelo.pid"


def _print_header():
    print(f"  ENVELO Interlock v{__version__}")
    print(f"  Sentinel Authority")
    print()


def _load_config():
    try:
        return EnveloConfig()
    except Exception as e:
        print(f"  Config error: {e}")
        print()
        print("  Set environment variables:")
        print("    export ENVELO_API_KEY=sa_live_xxx")
        print("    export ENVELO_CERTIFICATE=ODDC-2026-00001  # optional pre-cert")
        sys.exit(1)


def cmd_start(daemon=False):
    _print_header()
    config = _load_config()
    agent = EnveloAgent(config)

    if not agent.start():
        print("  FATAL: Agent failed to start")
        sys.exit(1)

    print(f"  Enforcement active.")
    print(f"  Boundaries: {len(agent.list_boundaries())}")
    print()

    if daemon:
        # Write PID and detach
        PID_FILE.parent.mkdir(parents=True, exist_ok=True)
        PID_FILE.write_text(str(os.getpid()))
        print(f"  PID {os.getpid()} written to {PID_FILE}")
        print(f"  Stop with: envelo stop")

    # Block until signal
    shutdown = threading.Event()

    def handle_sig(sig, frame):
        shutdown.set()

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    shutdown.wait()
    agent.stop()

    if PID_FILE.exists():
        PID_FILE.unlink()


def cmd_status():
    _print_header()
    config = _load_config()

    # Check if daemon is running
    if PID_FILE.exists():
        pid = int(PID_FILE.read_text().strip())
        try:
            os.kill(pid, 0)
            print(f"  Agent:       RUNNING (PID {pid})")
        except OSError:
            print(f"  Agent:       STALE PID {pid}")
            PID_FILE.unlink()
    else:
        print(f"  Agent:       NOT RUNNING")

    print(f"  API Key:     {config.api_key[:12]}...")
    print(f"  Certificate: {config.certificate_number or '(pre-certification)'}")
    print(f"  Endpoint:    {config.api_endpoint}")
    print(f"  Mode:        {config.enforcement_mode}")
    print(f"  Fail-Closed: {config.fail_closed}")
    print()

    # Test connectivity
    try:
        import httpx
        r = httpx.get(
            f"{config.api_endpoint}/api/envelo/boundaries/config",
            headers={"Authorization": f"Bearer {config.api_key}"},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            total = sum(
                len(data.get(k, []))
                for k in ("numeric_boundaries", "geo_boundaries",
                           "time_boundaries", "rate_boundaries", "state_boundaries")
            )
            print(f"  Server:      CONNECTED")
            print(f"  Boundaries:  {total} loaded")
        elif r.status_code == 401:
            print(f"  Server:      AUTH FAILED (check API key)")
        else:
            print(f"  Server:      HTTP {r.status_code}")
    except Exception as e:
        print(f"  Server:      UNREACHABLE ({e})")

    # Check cache
    cache = Path(config.boundary_cache_path)
    if cache.exists():
        stat = cache.stat()
        age_hrs = (time.time() - stat.st_mtime) / 3600
        print(f"  Cache:       {cache} ({age_hrs:.1f}h old)")
    else:
        print(f"  Cache:       none")

    print()


def cmd_stop():
    _print_header()
    if not PID_FILE.exists():
        print("  No running agent found.")
        return

    pid = int(PID_FILE.read_text().strip())
    try:
        os.kill(pid, signal.SIGTERM)
        print(f"  Sent SIGTERM to PID {pid}")
        # Wait up to 5s
        for _ in range(50):
            try:
                os.kill(pid, 0)
                time.sleep(0.1)
            except OSError:
                print(f"  Agent stopped.")
                PID_FILE.unlink()
                return
        print(f"  Agent did not stop in 5s. Kill with: kill -9 {pid}")
    except OSError:
        print(f"  PID {pid} not running (stale)")
        PID_FILE.unlink()


def cmd_boundaries():
    _print_header()
    config = _load_config()

    try:
        import httpx
        r = httpx.get(
            f"{config.api_endpoint}/api/envelo/boundaries/config",
            headers={"Authorization": f"Bearer {config.api_key}"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"  Cannot fetch boundaries: {e}")
        return

    type_keys = {
        "numeric_boundaries": "NUMERIC",
        "geo_boundaries": "GEO",
        "time_boundaries": "TIME",
        "rate_boundaries": "RATE",
        "state_boundaries": "STATE",
    }

    total = 0
    for key, label in type_keys.items():
        boundaries = data.get(key, [])
        for b in boundaries:
            total += 1
            name = b.get("name", "?")
            param = b.get("parameter", "?")

            if label == "NUMERIC":
                lo = b.get("min_value", "")
                hi = b.get("max_value", "")
                unit = b.get("unit", "")
                print(f"  [{label:>7}]  {name}: {param} = {lo}..{hi} {unit}")
            elif label == "GEO":
                bt = b.get("boundary_type", "?")
                radius = b.get("radius_meters", "")
                print(f"  [{label:>7}]  {name}: {bt} {f'r={radius}m' if radius else ''}")
            elif label == "TIME":
                start = b.get("allowed_start", "?")
                end = b.get("allowed_end", "?")
                print(f"  [{label:>7}]  {name}: {start}-{end}")
            elif label == "RATE":
                limits = []
                if b.get("max_per_second"): limits.append(f"{b['max_per_second']}/s")
                if b.get("max_per_minute"): limits.append(f"{b['max_per_minute']}/m")
                if b.get("max_per_hour"): limits.append(f"{b['max_per_hour']}/h")
                print(f"  [{label:>7}]  {name}: {', '.join(limits)}")
            elif label == "STATE":
                allowed = b.get("allowed_values", [])
                forbidden = b.get("forbidden_values", [])
                if allowed:
                    print(f"  [{label:>7}]  {name}: allow {allowed}")
                if forbidden:
                    print(f"  [{label:>7}]  {name}: deny {forbidden}")

    if total == 0:
        print("  No boundaries configured.")
    else:
        print(f"\n  {total} boundaries active.")
    print()


def main():
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help", "help"):
        print(__doc__)
        sys.exit(0)

    cmd = args[0]

    if cmd == "start":
        daemon = "-d" in args or "--daemon" in args
        cmd_start(daemon=daemon)
    elif cmd == "status":
        cmd_status()
    elif cmd == "stop":
        cmd_stop()
    elif cmd == "boundaries":
        cmd_boundaries()
    elif cmd in ("version", "--version", "-v"):
        print(f"envelo {__version__}")
    else:
        print(f"  Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
