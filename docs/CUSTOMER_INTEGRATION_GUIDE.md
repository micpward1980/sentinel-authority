# Sentinel Authority — CAT-72 Integration Guide

**ODDC Conformance for Autonomous Systems**

Version 1.1 | © 2026 Sentinel Authority

---

## Overview

The **Convergence Authorization Test (CAT-72)** is a 72-hour continuous evaluation that determines whether your autonomous system maintains operational conformance within its declared Operational Design Domain (ODD).

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
Accept: application/json
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

## Production Guidance

Use a persistent HTTP session, validate the state vector before transmission, log failures explicitly, and retry only on transient network or upstream service errors. Telemetry delivery failures should never disable local enforcement.

---

## Hardened Python Example
```python
from __future__ import annotations

import logging
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from requests import Response, Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("cat72_client")


DEFAULT_BASE_URL = "https://sentinel-authority-production.up.railway.app"


@dataclass(frozen=True)
class StateVector:
    x: float
    y: float
    velocity: float
    heading: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "x": float(self.x),
            "y": float(self.y),
            "velocity": float(self.velocity),
            "heading": float(self.heading),
        }


class CAT72ClientError(Exception):
    pass


class CAT72Client:
    def __init__(
        self,
        test_id: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout_seconds: float = 10.0,
        user_agent: str = "sentinel-cat72-client/1.0",
        session: Optional[Session] = None,
    ) -> None:
        if not test_id or not isinstance(test_id, str):
            raise ValueError("test_id must be a non-empty string")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be > 0")

        self.test_id = test_id.strip()
        self.timeout_seconds = timeout_seconds
        self.endpoint = (
            f"{base_url.rstrip('/')}/api/cat72/tests/{self.test_id}/telemetry"
        )

        self.session = session or self._build_session(user_agent)

    @staticmethod
    def _build_session(user_agent: str) -> Session:
        session = requests.Session()

        retry = Retry(
            total=3,
            connect=3,
            read=3,
            status=3,
            backoff_factor=0.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset(["POST"]),
            raise_on_status=False,
        )

        adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update(
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": user_agent,
            }
        )
        return session

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _validate_state(state: Dict[str, Any]) -> Dict[str, float]:
        required = ("x", "y", "velocity", "heading")
        missing = [key for key in required if key not in state]
        if missing:
            raise ValueError(f"state missing required keys: {missing}")

        validated: Dict[str, float] = {}
        for key in required:
            value = state[key]
            if not isinstance(value, (int, float)):
                raise ValueError(
                    f"state[{key!r}] must be numeric, got {type(value).__name__}"
                )
            validated[key] = float(value)

        heading = validated["heading"]
        if not (0.0 <= heading < 360.0):
            raise ValueError("heading must be in range [0, 360)")

        velocity = validated["velocity"]
        if velocity < 0:
            raise ValueError("velocity must be >= 0")

        return validated

    def send_telemetry(self, state: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "state_vector": self._validate_state(state),
            "timestamp": self._utc_now_iso(),
        }

        try:
            response = self.session.post(
                self.endpoint,
                json=payload,
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as exc:
            raise CAT72ClientError(f"network error sending telemetry: {exc}") from exc

        self._raise_for_bad_response(response)

        try:
            data = response.json()
        except ValueError as exc:
            raise CAT72ClientError("server returned non-JSON response") from exc

        if not isinstance(data, dict):
            raise CAT72ClientError("server returned unexpected JSON shape")

        return data

    @staticmethod
    def _raise_for_bad_response(response: Response) -> None:
        if 200 <= response.status_code < 300:
            return

        body_preview = response.text[:500].strip()
        raise CAT72ClientError(
            f"telemetry request failed: status={response.status_code}, body={body_preview!r}"
        )

    def close(self) -> None:
        self.session.close()


class RobotInterface:
    """
    Replace this stub with your real robot or system adapter.
    """

    @property
    def position_x(self) -> float:
        return 125.5

    @property
    def position_y(self) -> float:
        return -42.3

    @property
    def velocity(self) -> float:
        return 8.7

    @property
    def heading(self) -> float:
        return 270.0

    def current_state(self) -> StateVector:
        return StateVector(
            x=self.position_x,
            y=self.position_y,
            velocity=self.velocity,
            heading=self.heading,
        )


_running = True


def _handle_shutdown(signum: int, frame: Any) -> None:
    global _running
    logger.info("received shutdown signal: %s", signum)
    _running = False


def main() -> int:
    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    robot = RobotInterface()
    client = CAT72Client("CAT72-2026-00015", timeout_seconds=10.0)

    sample_interval_seconds = 1.0

    try:
        while _running:
            start = time.monotonic()

            try:
                state = robot.current_state().to_dict()
                result = client.send_telemetry(state)

                interlock_triggered = bool(result.get("interlock_triggered", False))
                in_envelope = result.get("in_envelope")
                convergence_score = result.get("convergence_score")

                logger.info(
                    "telemetry accepted in_envelope=%s convergence_score=%s interlock_triggered=%s",
                    in_envelope,
                    convergence_score,
                    interlock_triggered,
                )

                if interlock_triggered:
                    logger.critical("safety interlock triggered")

            except (ValueError, CAT72ClientError) as exc:
                logger.error("telemetry cycle failed: %s", exc)

            elapsed = time.monotonic() - start
            sleep_for = max(0.0, sample_interval_seconds - elapsed)
            time.sleep(sleep_for)

    finally:
        client.close()
        logger.info("client closed")

    return 0


if __name__ == "__main__":
    sys.exit(main())
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
