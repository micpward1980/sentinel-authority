# ENVELO SDK — Sentinel Authority

**Enforced Non-Violable Execution-Limit Override**

Runtime boundary enforcement for autonomous systems. ENVELO is the enforcement layer that ensures your autonomous system operates within its certified operational envelope.

## Installation

    pip install envelo

## Quick Start

    from envelo import EnveloAgent, EnveloConfig

    config = EnveloConfig()
    config.organization = "Your Company"
    config.system_name = "Your System"

    agent = EnveloAgent(config=config)
    agent.start()

    result = agent.check(speed_mph=4.5, battery_pct=85, payload_kg=12)

    agent.stop()

## How It Works

1. Apply for ODDC certification at app.sentinelauthority.org
2. Install the ENVELO SDK in your system
3. Configure with your API key and certificate number
4. Wrap every autonomous action with agent.check()
5. ENVELO enforces your certified operational boundaries in real-time
6. After 72 hours of monitored operation, your system is certified

## Boundary Types

- **Numeric**: Min/max ranges with tolerance (speed, temperature, weight)
- **Geographic**: Geofenced operating zones (radius, polygon)
- **Temporal**: Time-of-day restrictions (operating hours, day-of-week)
- **Rate**: Rate-of-change limits (acceleration, throughput)
- **State**: Allowed system states (idle, active, maintenance)

## Environment Variables

- ENVELO_API_KEY (required): Your sa_live_... API key
- ENVELO_CERTIFICATE (required): Your ODDC-YYYY-NNNNN cert number
- ENVELO_ENDPOINT (optional): API endpoint (defaults to production)

## Links

- Dashboard: https://app.sentinelauthority.org
- Website: https://sentinelauthority.org
- Support: info@sentinelauthority.org

Copyright 2026 Sentinel Authority. All rights reserved.
