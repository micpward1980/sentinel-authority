# Sentinel Authority Certification Platform

**ENVELO™ Certification Management System**

A complete platform for managing autonomous system certifications under the ENVELO (Enforcer for Non-Violable Execution & Limit Oversight) framework.

## Overview

Sentinel Authority provides:

- **Account Management** — Onboard and manage applicants, certified operators, licensed implementers, insurers, and regulators
- **System Registration** — Register autonomous systems with Operational Design Domain (ODD) classification
- **Envelope Definition** — Define versioned operational envelopes with physics-derived constraints
- **CAT-72 Testing** — Schedule and monitor 72-hour Convergence Authorization Tests
- **Conformance Records** — Issue cryptographically signed ODDC attestations
- **Public Verification** — Allow third parties to verify certification status

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                   app.sentinelauthority.org                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Nginx)                          │
│                   api.sentinelauthority.org                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend API (FastAPI)                          │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│    │ Accounts │ │ Systems  │ │  CAT-72  │ │Conformance│         │
│    └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │PostgreSQL│    │  Redis   │    │    S3    │
         │ Database │    │  Cache   │    │ Storage  │
         └──────────┘    └──────────┘    └──────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Running with Docker

```bash
# Clone the repository
git clone https://github.com/sentinel-authority/platform.git
cd platform

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the platform
# Frontend: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Development

**Backend:**

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://sentinel:password@localhost:5432/sentinel_authority"
export SECRET_KEY="your-secret-key"

# Run database migrations (or execute schema.sql)
psql -U sentinel -d sentinel_authority -f ../database/schema.sql

# Start the server
uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Reference

### Authentication

All API endpoints (except `/verify/*`) require authentication via Bearer token.

```bash
# Get access token
curl -X POST http://localhost:8000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in requests
curl http://localhost:8000/accounts \
  -H "Authorization: Bearer <token>"
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/accounts` | GET, POST | List/create accounts |
| `/accounts/{id}` | GET, PATCH, DELETE | Manage account |
| `/systems` | GET, POST | List/create systems |
| `/systems/{id}` | GET, PATCH, DELETE | Manage system |
| `/systems/{id}/state` | POST | Update certification state |
| `/envelopes` | GET, POST | List/create envelopes |
| `/envelopes/{id}/approve` | POST | Approve envelope |
| `/cat72` | GET, POST | List/schedule CAT-72 tests |
| `/cat72/{id}/start` | POST | Start test |
| `/cat72/{id}/events` | GET, POST | List/ingest telemetry |
| `/cat72/{id}/complete` | POST | Complete test |
| `/conformance` | GET, POST | List/issue conformance records |
| `/conformance/{id}/revoke` | POST | Revoke record |
| `/verify` | POST | Verify conformance record (public) |
| `/verify/{record_number}` | GET | Quick verify (public) |

### Certification States

| State | Description |
|-------|-------------|
| `observe` | Telemetry only; autonomous actuation prohibited |
| `bounded` | Restricted autonomy under elevated supervision |
| `certified` | Full autonomy within operational envelope |
| `suspended` | Autonomy disabled pending remediation |
| `revoked` | Terminal state; certification cancelled |

### CAT-72 Test Status

| Status | Description |
|--------|-------------|
| `scheduled` | Test scheduled, not yet started |
| `initializing` | Test initialization in progress |
| `in_progress` | Test actively running |
| `passed` | 72-hour convergence demonstrated |
| `failed` | Test failed due to violations |
| `aborted` | Test manually aborted |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT signing key | Required |
| `ENVIRONMENT` | `development`, `testing`, `production` | `development` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `SIGNING_KEY_PATH` | Path to ECDSA private key | `/etc/sentinel/keys/signing_key.pem` |

## Telemetry Ingestion

Systems under CAT-72 testing should submit telemetry events to the `/cat72/{test_id}/events` endpoint.

```bash
curl -X POST http://localhost:8000/cat72/{test_id}/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_time": "2026-01-23T10:30:00Z",
    "event_type": "position_update",
    "severity": "info",
    "position_lat": 30.4515,
    "position_lon": -97.8231,
    "velocity_mps": 5.2,
    "heading_deg": 180.5,
    "envelope_evaluation": {
      "velocity_check": "pass",
      "position_check": "pass"
    }
  }'
```

For high-volume telemetry, use batch ingestion:

```bash
curl -X POST http://localhost:8000/cat72/{test_id}/events/batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '[{"event_time": "...", ...}, {"event_time": "...", ...}]'
```

## License

Proprietary — Sentinel Authority LLC

## Support

- Documentation: https://docs.sentinelauthority.org
- Email: support@sentinelauthority.org
- Website: https://sentinelauthority.org
