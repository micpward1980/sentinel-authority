# ENVELO Agent - Docker

Run the ENVELO Agent as a Docker container.

## Quick Start
```bash
docker run -d \
  -e ENVELO_CERTIFICATE_ID=ODDC-2026-XXXXX \
  -e ENVELO_API_KEY=your-api-key \
  sentinelauthority/envelo
```

## Using Docker Compose

1. Create a `.env` file:
```
ENVELO_CERTIFICATE_ID=ODDC-2026-XXXXX
ENVELO_API_KEY=your-api-key
```

2. Run:
```bash
docker-compose up -d
```

## Building Locally
```bash
docker build -t envelo-agent .
docker run -e ENVELO_CERTIFICATE_ID=... -e ENVELO_API_KEY=... envelo-agent
```

## Integrating with Your Application

Mount your application directory and import the agent:
```bash
docker run -d \
  -e ENVELO_CERTIFICATE_ID=ODDC-2026-XXXXX \
  -e ENVELO_API_KEY=your-api-key \
  -v $(pwd)/my-app:/app/my-app \
  sentinelauthority/envelo
```

Then in your Python code:
```python
from envelo import EnveloAgent, EnveloConfig, NumericBoundary

config = EnveloConfig(
    certificate_id="ODDC-2026-XXXXX",
    api_key="your-api-key"
)
agent = EnveloAgent(config)
```

## Support

- Documentation: https://sentinelauthority.org/agent.html
- Email: conformance@sentinelauthority.org
