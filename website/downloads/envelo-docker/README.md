# ENVELO Interlock - Docker

Run the ENVELO Interlock as a Docker container.

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
docker build -t envelo-interlock .
docker run -e ENVELO_CERTIFICATE_ID=... -e ENVELO_API_KEY=... envelo-interlock
```

## Integrating with Your Application

Mount your application directory and import the interlock:
```bash
docker run -d \
  -e ENVELO_CERTIFICATE_ID=ODDC-2026-XXXXX \
  -e ENVELO_API_KEY=your-api-key \
  -v $(pwd)/my-app:/app/my-app \
  sentinelauthority/envelo
```

Then in your Python code:
```python
from envelo import EnveloInterlock, EnveloConfig, NumericBoundary

config = EnveloConfig(
    certificate_id="ODDC-2026-XXXXX",
    api_key="your-api-key"
)
interlock = EnveloInterlock(config)
```

## Support

- Documentation: https://sentinelauthority.org/interlock.html
- Email: conformance@sentinelauthority.org
