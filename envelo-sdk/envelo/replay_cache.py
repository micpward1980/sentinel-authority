"""
ENVELO Replay Cache
Thread-safe, bounded in-memory store for used JTIs.
Prevents token replay within the expiry window.
For multi-node deployments, swap _seen for a Redis SETNX call.
"""
import threading
import time


class ReplayCache:
    def __init__(self, max_entries: int = 10_000):
        self._seen: dict[str, int] = {}
        self._lock = threading.Lock()
        self._max_entries = max_entries

    def _purge_expired(self, now: int) -> None:
        # Remove expired entries
        expired = [k for k, exp in self._seen.items() if exp < now]
        for k in expired:
            self._seen.pop(k, None)

        # Evict oldest if still over limit (safety valve)
        if len(self._seen) > self._max_entries:
            items = sorted(self._seen.items(), key=lambda kv: kv[1])
            for k, _ in items[: len(self._seen) - self._max_entries]:
                self._seen.pop(k, None)

    def mark_if_new(self, jti: str, exp: int) -> bool:
        """Return True and record jti if not seen before.  Return False if replay."""
        now = int(time.time())
        with self._lock:
            self._purge_expired(now)
            if jti in self._seen:
                return False
            self._seen[jti] = exp
            return True

    def size(self) -> int:
        with self._lock:
            return len(self._seen)
