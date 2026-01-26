#!/usr/bin/env python3
"""
ENVELO Agent Docker Entrypoint
Sentinel Authority
"""

import os
import sys
import time
import signal

sys.path.insert(0, '/app')

from envelo import EnveloAgent, EnveloConfig

def main():
    cert_id = os.environ.get('ENVELO_CERTIFICATE_ID')
    api_key = os.environ.get('ENVELO_API_KEY')
    endpoint = os.environ.get('ENVELO_API_ENDPOINT', 'https://api.sentinelauthority.org')

    if not cert_id or not api_key:
        print("ERROR: ENVELO_CERTIFICATE_ID and ENVELO_API_KEY environment variables required")
        print("")
        print("Usage:")
        print("  docker run -e ENVELO_CERTIFICATE_ID=ODDC-2026-XXXXX -e ENVELO_API_KEY=your-key sentinelauthority/envelo")
        sys.exit(1)

    print("╔═══════════════════════════════════════════════════════════╗")
    print("║           ENVELO Agent v1.0 - Docker                      ║")
    print("║           Sentinel Authority                              ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print("")
    print(f"Certificate: {cert_id}")
    print(f"Endpoint:    {endpoint}")
    print("")

    config = EnveloConfig(
        certificate_id=cert_id,
        api_key=api_key,
        api_endpoint=endpoint
    )

    agent = EnveloAgent(config)
    print("✓ Agent initialized and connected")
    print("")
    print("Agent is running. Mount your application and import:")
    print("  from envelo import EnveloAgent, EnveloConfig, NumericBoundary")
    print("")

    # Keep running
    def shutdown(sig, frame):
        print("\nShutting down...")
        agent.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    while True:
        time.sleep(1)

if __name__ == '__main__':
    main()
