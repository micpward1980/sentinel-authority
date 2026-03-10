# ENVELO Interlock Resilience Specification

## Heartbeat Buffering

When the interlock cannot reach the Sentinel Authority API:

1. **Local Queue**: Store heartbeats in a local SQLite buffer (`/var/lib/envelo/buffer.db`)
2. **Retry Logic**: Attempt delivery every 30 seconds with exponential backoff, capped at 5 minutes
3. **Buffer Limit**: Store up to 72 hours of heartbeats, with bounded replay batch sizes to prevent reconnect flooding
4. **Replay on Reconnect**: When connectivity is restored, replay buffered heartbeats in order and mark records delivered only after confirmed server acknowledgment
5. **Continue Enforcement**: The interlock continues enforcing locally regardless of API connectivity
6. **Tamper Detection**: Each buffered record should include a checksum or signature to detect corruption or manipulation
7. **Retention and Pruning**: Expired or successfully delivered records should be pruned safely under a documented retention policy

## Buffer Schema
```sql
CREATE TABLE heartbeat_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    payload TEXT NOT NULL,
    delivered INTEGER NOT NULL DEFAULT 0,
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    delivered_at TEXT,
    checksum TEXT,
    UNIQUE(timestamp, checksum)
);

CREATE INDEX idx_heartbeat_buffer_delivered_id
ON heartbeat_buffer(delivered, id);
```

## Reconnection Flow
1. Interlock detects API unreachable because of timeout, connection error, or eligible 5xx response
2. System switches to buffered mode and logs heartbeats locally
3. Retry interval begins at 30 seconds and backs off exponentially to a 5 minute maximum
4. On reconnect, the system replays undelivered heartbeats in monotonic order using controlled batch sizes
5. Records are cleared or marked delivered only after confirmed delivery from the upstream service
6. Normal real-time heartbeat mode resumes after replay completion

## Failure Handling Requirements

- Telemetry delivery failure must not disable or weaken local enforcement
- Duplicate records must be handled idempotently where practical
- Clock drift and duplicate timestamps must be handled explicitly
- Buffered payloads should be encrypted at rest if they contain sensitive telemetry
- Circuit breaker behavior should be defined after repeated upstream failures
- Fail-open versus fail-closed behavior must be documented unambiguously for each subsystem

## Key Principle

The interlock never stops enforcing. API connectivity affects monitoring and external visibility, not safety enforcement.
