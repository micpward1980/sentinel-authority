FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir httpx

# Copy agent
COPY envelo-agent/envelo /app/envelo

# Copy entrypoint
COPY docker-entrypoint.py /app/entrypoint.py

ENV ENVELO_CERTIFICATE_ID=""
ENV ENVELO_API_KEY=""
ENV ENVELO_API_ENDPOINT="https://api.sentinelauthority.org"

ENTRYPOINT ["python", "/app/entrypoint.py"]
