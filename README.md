# Sentinel Authority Platform

**Independent Conformance Determination for Autonomous Systems**

Unified platform for ODDC (Operational Design Domain Conformance) determination with ENVELO enforcement requirements (Enforcer for Non-Violable Execution & Limit Oversight).

ENVELO is a method designation describing non-bypassable enforcement requirements, not a product or platform.

© 2026 Sentinel Authority. All rights reserved.

---

## Live URLs

- **Platform:** https://sentinel-authority.vercel.app
- **API:** https://sentinel-authority-production.up.railway.app
- **API Docs:** https://sentinel-authority-production.up.railway.app/docs

---

## Platform Modules

| Module | Description | Users |
|--------|-------------|-------|
| **Applicant Portal** | Submit ODD specs, track status | Customers |
| **CAT-72 Console** | Run 72-hour conformance tests | Operators |
| **Conformance Registry** | Issue, manage, revoke determinations | Admin |
| **Public Verification** | Third-party verification | Anyone |
| **Licensee Portal** | Technical documentation | Licensed implementers |

---

## CAT-72 Pass Criteria

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Convergence | ≥ 95% | % of samples within envelope |
| Drift Rate | ≤ 0.02 | Rate of approach to boundaries |
| Stability | ≥ 90% | Consistency over time |

---

## Tech Stack

- **Backend:** FastAPI + PostgreSQL
- **Frontend:** React + Vite
- **Hosting:** Railway (API) + Vercel (UI) + Neon (DB)

