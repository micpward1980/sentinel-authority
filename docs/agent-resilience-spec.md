# ENVELO Interlock Resilience Specification

## Heartbeat Buffering

When the interlock cannot reach the Sentinel Authority API:

1. **Local Queue**: Store heartbeats in a local SQLite buffer (`/var/lib/envelo/buffer.db`)
2. **Retry Logic**: Attempt delivery every 30 seconds with exponential backoff (max 5 min)
3. **Buffer Limit**: Store up to 72 hours of heartbeats (~8,640 entries at 30s intervals)
4. **Replay on Reconnect**: When connection restores, replay buffered heartbeats in order
5. **Continue Enforcement**: The interlock continues enforcing locally regardless of API connectivity

## Buffer Schema
```sql
CREATE TABLE heartbeat_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    payload TEXT NOT NULL,
    delivered INTEGER DEFAULT 0
);
```

## Reconnection Flow
1. Interlock detects API unreachable (HTTP timeout or 5xx)
2. Switches to buffered mode — logs heartbeats locally
3. Retries API connection every 30s (backoff to 5 min max)
4. On successful reconnect: replays all undelivered heartbeats
5. Clears buffer after confirmed delivery
6. Resumes normal real-time heartbeat mode

## Key Principle
The interlock NEVER stops enforcing. API connectivity affects monitoring only, not safety.
