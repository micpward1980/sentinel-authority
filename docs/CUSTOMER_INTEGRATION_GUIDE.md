# Sentinel Authority — CAT-72 Integration Guide

**ODDC Conformance for Autonomous Systems**

Version 1.0 | © 2026 Sentinel Authority

---

## Overview

The **Convergence Authorization Test (CAT-72)** is a 72-hour continuous evaluation that determines your autonomous system maintains operational conformance within its declared Operational Design Domain (ODD).

---

## API Integration

### Base URL
```
https://sentinel-authority-production.up.railway.app
```

### Telemetry Endpoint
```
POST /api/cat72/tests/{test_id}/telemetry
Content-Type: application/json
```

### Request Format
```json
{
  "state_vector": {
    "x": 125.5,
    "y": -42.3,
    "velocity": 8.7,
    "heading": 270.0
  },
  "timestamp": "2026-01-25T14:30:00.000Z"
}
```

### Response Format
```json
{
  "sample_number": 12847,
  "in_envelope": true,
  "envelope_distance": 2.3,
  "convergence_score": 0.9847,
  "interlock_triggered": false
}
```

---

## Python Example
```python
import requests
import time
from datetime import datetime, timezone

class CAT72Client:
    def __init__(self, test_id: str):
        self.endpoint = f"https://sentinel-authority-production.up.railway.app/api/cat72/tests/{test_id}/telemetry"
    
    def send_telemetry(self, state: dict) -> dict:
        payload = {
            "state_vector": state,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        response = requests.post(self.endpoint, json=payload, timeout=10)
        return response.json()

# Usage
client = CAT72Client("CAT72-2026-00015")

while True:
    state = {
        "x": robot.position.x,
        "y": robot.position.y,
        "velocity": robot.velocity,
        "heading": robot.heading
    }
    result = client.send_telemetry(state)
    
    if result["interlock_triggered"]:
        print("ALERT: Safety interlock triggered!")
    
    time.sleep(1)
```

---

## Pass/Fail Criteria

| Metric | Threshold |
|--------|-----------|
| Convergence | ≥ 95% |
| Drift Rate | ≤ 0.02 |
| Stability | ≥ 90% |

---

## Contact

conformance@sentinelauthority.org
