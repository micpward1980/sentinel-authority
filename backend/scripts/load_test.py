"""
Load test for Sentinel Authority platform.
Simulates N certified systems sending heartbeat telemetry concurrently.

Usage:
    python scripts/load_test.py --systems 100 --duration 60 --url https://api.sentinelauthority.org
    python scripts/load_test.py --systems 1000 --duration 120 --url http://localhost:8000
"""
import asyncio
import argparse
import time
import random
import json
import logging
from dataclasses import dataclass, field
from typing import List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [LOAD] %(message)s")
logger = logging.getLogger(__name__)

try:
    import httpx
except ImportError:
    print("pip install httpx")
    exit(1)


@dataclass
class Stats:
    total_requests: int = 0
    successful: int = 0
    failed: int = 0
    latencies: List[float] = field(default_factory=list)
    errors: dict = field(default_factory=dict)
    start_time: float = 0
    end_time: float = 0

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time

    @property
    def rps(self) -> float:
        return self.total_requests / max(self.duration, 0.001)

    @property
    def p50(self) -> float:
        if not self.latencies:
            return 0
        s = sorted(self.latencies)
        return s[len(s) // 2]

    @property
    def p95(self) -> float:
        if not self.latencies:
            return 0
        s = sorted(self.latencies)
        return s[int(len(s) * 0.95)]

    @property
    def p99(self) -> float:
        if not self.latencies:
            return 0
        s = sorted(self.latencies)
        return s[int(len(s) * 0.99)]


async def simulate_system(client: httpx.AsyncClient, system_id: int, base_url: str,
                          duration: int, stats: Stats, api_key: str = "load-test-key"):
    """Simulate one certified system sending heartbeats every 30s."""
    session_id = f"load-test-session-{system_id:04d}"
    end_time = time.time() + duration

    while time.time() < end_time:
        try:
            start = time.monotonic()
            resp = await client.post(
                f"{base_url}/api/envelo/heartbeat",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "session_id": session_id,
                    "timestamp": time.time(),
                    "status": "active",
                    "parameters": {
                        "speed": round(random.uniform(0, 25), 2),
                        "temperature": round(random.uniform(15, 45), 1),
                        "battery": round(random.uniform(20, 100), 0),
                        "lat": round(30.38 + random.uniform(-0.01, 0.01), 6),
                        "lon": round(-97.82 + random.uniform(-0.01, 0.01), 6),
                    }
                },
                timeout=10.0,
            )
            elapsed = time.monotonic() - start

            stats.total_requests += 1
            stats.latencies.append(elapsed)

            if resp.status_code in (200, 201, 202):
                stats.successful += 1
            else:
                stats.failed += 1
                code = str(resp.status_code)
                stats.errors[code] = stats.errors.get(code, 0) + 1

        except Exception as e:
            stats.total_requests += 1
            stats.failed += 1
            ename = type(e).__name__
            stats.errors[ename] = stats.errors.get(ename, 0) + 1

        # Heartbeat interval: 30s in prod, compressed to 1-3s for load test
        await asyncio.sleep(random.uniform(1, 3))


async def run_load_test(num_systems: int, duration: int, base_url: str, api_key: str):
    stats = Stats()
    stats.start_time = time.time()

    logger.info(f"Starting load test: {num_systems} systems, {duration}s duration")
    logger.info(f"Target: {base_url}")

    limits = httpx.Limits(max_connections=600, max_keepalive_connections=200)
    async with httpx.AsyncClient(limits=limits, timeout=httpx.Timeout(30.0)) as client:
        tasks = [
            simulate_system(client, i, base_url, duration, stats, api_key)
            for i in range(num_systems)
        ]
        await asyncio.gather(*tasks)

    stats.end_time = time.time()

    print("\n" + "=" * 60)
    print("LOAD TEST RESULTS")
    print("=" * 60)
    print(f"Systems simulated:  {num_systems}")
    print(f"Duration:           {stats.duration:.1f}s")
    print(f"Total requests:     {stats.total_requests}")
    print(f"Successful:         {stats.successful} ({stats.successful / max(stats.total_requests, 1) * 100:.1f}%)")
    print(f"Failed:             {stats.failed}")
    print(f"Requests/sec:       {stats.rps:.1f}")
    print(f"Latency p50:        {stats.p50 * 1000:.0f}ms")
    print(f"Latency p95:        {stats.p95 * 1000:.0f}ms")
    print(f"Latency p99:        {stats.p99 * 1000:.0f}ms")
    if stats.errors:
        print(f"Error breakdown:    {json.dumps(stats.errors, indent=2)}")
    print("=" * 60)

    # Pass/fail threshold
    success_rate = stats.successful / max(stats.total_requests, 1)
    if success_rate >= 0.99 and stats.p95 < 2.0:
        print("\n✅ PASS — Platform handles this load")
        return True
    elif success_rate >= 0.95:
        print("\n⚠️  WARN — Degraded performance, investigate")
        return True
    else:
        print("\n❌ FAIL — Platform cannot handle this load")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sentinel Authority Load Test")
    parser.add_argument("--systems", type=int, default=100, help="Number of concurrent systems")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--url", type=str, default="http://localhost:8000", help="Base URL")
    parser.add_argument("--api-key", type=str, default="load-test-key", help="API key for auth")
    args = parser.parse_args()

    success = asyncio.run(run_load_test(args.systems, args.duration, args.url, args.api_key))
    exit(0 if success else 1)
