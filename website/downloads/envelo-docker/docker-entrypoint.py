#!/usr/bin/env python3
"""
ENVELO Interlock — Docker Entrypoint
Sentinel Authority © 2025-2026
"""

import os
import sys
import signal
import time

sys.path.insert(0, "/app")

from envelo import EnveloAgent, EnveloConfig, __version__


def main():
    api_key = os.environ.get("ENVELO_API_KEY")
    cert = os.environ.get("ENVELO_CERTIFICATE", "")
    endpoint = os.environ.get(
        "ENVELO_ENDPOINT",
        "https://sentinel-authority-production.up.railway.app",
    )

    if not api_key:
        print("ERROR: ENVELO_API_KEY environment variable required")
        print()
        print("Usage:")
        print("  docker run \\")
        print("    -e ENVELO_API_KEY=sa_live_xxx \\")
        print("    -e ENVELO_CERTIFICATE=ODDC-2026-00001 \\")
        print("    sentinelauthority/envelo")
        sys.exit(1)

    print("=" * 60)
    print(f"  ENVELO Interlock v{__version__} — Docker")
    print("  Sentinel Authority")
    print("=" * 60)
    print(f"  Certificate: {cert or '(pre-certification)'}")
    print(f"  Endpoint:    {endpoint}")
    print()

    config = EnveloConfig(
        api_key=api_key,
        certificate_number=cert,
        api_endpoint=endpoint,
    )

    agent = EnveloAgent(config)

    if not agent.start():
        print("FATAL: Agent failed to start")
        sys.exit(1)

    print()
    print("Interlock running. Mount your application and import:")
    print("  from envelo import EnveloAgent")
    print()

    # Block until signal
    shutdown = threading.Event()

    def handle_signal(sig, frame):
        print(f"\nSignal {sig} — shutting down...")
        shutdown.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    shutdown.wait()
    agent.stop()


if __name__ == "__main__":
    import threading
    main()
