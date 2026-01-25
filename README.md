# Sentinel Authority Platform

**The Certification Authority for Autonomous Systems**

Unified platform for ODDC (Operational Design Domain Conformance) certification under the ENVELO™ framework (Enforcer for Non-Violable Execution & Limit Oversight).

© 2026 Wemby Corporation. All rights reserved.

---

## Platform Modules

| Module | Description | Users |
|--------|-------------|-------|
| **Applicant Portal** | Submit ODD specs, book assessments, track status | Customers |
| **CAT-72 Console** | Run 72-hour conformance tests, monitor telemetry | Operators |
| **Certification Registry** | Issue, manage, suspend/revoke certificates | Admin/Operators |
| **Public Verification API** | Third-party certificate verification | Anyone |
| **Licensee Portal** | ENVELO technical documentation | Licensed implementers |

---

## Quick Start

### Local Development (Docker)

```bash
# Clone and start
git clone https://github.com/your-org/sentinel-authority.git
cd sentinel-authority
cp .env.example .env
docker-compose up -d

# Access
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
# API: http://localhost:8000
```

### Default Credentials (Development Only)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sentinelauthority.org | admin123 |
| Operator | operator@sentinelauthority.org | operator123 |

⚠️ **Change these immediately in production!**

---

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect Railway to your repo
3. Add PostgreSQL and Redis services
4. Set environment variables:
   - `DATABASE_URL` (from Railway Postgres)
   - `REDIS_URL` (from Railway Redis)
   - `SECRET_KEY` (generate secure key)
   - `ENVIRONMENT=production`
   - `CORS_ORIGINS` (your frontend URL)

### Manual Deployment

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run build
# Serve 'dist' folder with any static server
```

---

## API Documentation

Once running, access:
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate user |
| `/api/auth/register` | POST | Register new user |
| `/api/applicants` | GET/POST | List/create applications |
| `/api/cat72/tests` | GET/POST | List/create CAT-72 tests |
| `/api/cat72/tests/{id}/start` | POST | Start a test |
| `/api/cat72/tests/{id}/telemetry` | POST | Ingest telemetry |
| `/api/certificates` | GET | List certificates |
| `/api/certificates/issue/{test_id}` | POST | Issue certificate |
| `/api/verify/{cert_number}` | GET | Public verification (no auth) |

---

## CAT-72 Test Flow

```
1. Application Submitted → PENDING
2. Review Approved → UNDER_REVIEW
3. Test Scheduled → OBSERVE
4. Test Started → BOUNDED (72-hour timer begins)
5. Telemetry Ingested → Real-time envelope monitoring
6. Test Completed → PASS/FAIL determination
7. Certificate Issued → CONFORMANT
```

### Certification Criteria

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Convergence | ≥ 95% | % of samples within envelope |
| Drift Rate | ≤ 0.02 | Rate of boundary approach |
| Stability | ≥ 90% | Variance in conformance |

---

## Evidence Chain

Every CAT-72 test generates a cryptographic evidence chain:

```
Genesis Block (test start)
    ↓
Sample Blocks (each telemetry point)
    ↓
Interlock Blocks (boundary events)
    ↓
Final Block (test completion + results)
```

Each block contains:
- SHA-256 hash of content
- Reference to previous block's hash
- Timestamp and data

This provides tamper-evident certification records.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌──────────┬──────────┬──────────┬──────────┬────────┐ │
│  │Dashboard │Applicant │ CAT-72   │  Certs   │Licensee│ │
│  │          │ Portal   │ Console  │ Registry │ Portal │ │
│  └──────────┴──────────┴──────────┴──────────┴────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                      HTTPS/REST API
                            │
┌─────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                      │
│  ┌──────────┬──────────┬──────────┬──────────┬────────┐ │
│  │   Auth   │Applicants│  CAT-72  │  Certs   │Licensee│ │
│  │  Routes  │  Routes  │  Routes  │  Routes  │ Routes │ │
│  └──────────┴──────────┴──────────┴──────────┴────────┘ │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              Core Services                         │  │
│  │  • Security (JWT, RBAC)                           │  │
│  │  • Evidence Chain (SHA-256)                       │  │
│  │  • Envelope Validation                            │  │
│  │  • Metrics Computation                            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
       ┌──────┴──────┐            ┌───────┴───────┐
       │ PostgreSQL  │            │     Redis     │
       │ (Data)      │            │ (Real-time)   │
       └─────────────┘            └───────────────┘
```

---

## Project Structure

```
sentinel-authority/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # API endpoints
│   │   ├── core/            # Config, DB, Security
│   │   ├── models/          # SQLAlchemy models
│   │   ├── services/        # Business logic
│   │   └── utils/           # Helpers
│   ├── main.py              # FastAPI app
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Utilities
│   │   └── App.jsx          # Main app
│   ├── package.json
│   └── Dockerfile
├── database/
│   └── init.sql             # DB initialization
├── docker-compose.yml
├── railway.toml
└── README.md
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SECRET_KEY` | Yes | JWT signing key (generate securely) |
| `ENVIRONMENT` | No | `development` or `production` |
| `CORS_ORIGINS` | No | Allowed origins for CORS |
| `CAT72_CONVERGENCE_THRESHOLD` | No | Pass threshold (default: 0.95) |

---

## Support

- **Documentation**: https://docs.sentinelauthority.org
- **Technical Support**: support@sentinelauthority.org
- **Licensee Support**: licensee-support@sentinelauthority.org

---

## License

Proprietary. © 2026 Wemby Corporation. All rights reserved.

ENVELO™ is a trademark of Wemby Corporation.
