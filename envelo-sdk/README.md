# ENVELO SDK

**Enforcer for Non-Violable Execution & Limit Oversight**

The official Python SDK for Sentinel Authority's ENVELO enforcement system. This agent **physically prevents** autonomous systems from operating outside their certified Operational Design Domain (ODD).

## What ENVELO Does

ENVELO is not a logger. It is an **ENFORCER**. When your autonomous system attempts an action that violates its ODD boundaries, ENVELO **blocks the action from executing**.
```
┌─────────────────────────────────────────────────────────────┐
│                   YOUR AUTONOMOUS SYSTEM                     │
│                                                              │
│    robot.move(speed=150)                                     │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────────────────────────────┐                 │
│    │         ENVELO ENFORCEMENT           │                 │
│    │                                       │                 │
│    │  speed=150 > max_speed=100           │                 │
│    │                                       │                 │
│    │  ⛔ VIOLATION DETECTED                │                 │
│    │  ⛔ ACTION BLOCKED                    │                 │
│    │  ⛔ MOTORS DO NOT MOVE                │                 │
│    └──────────────────────────────────────┘                 │
│                                                              │
│    (robot.move never executes)                               │
└─────────────────────────────────────────────────────────────┘
```

## Installation
```bash
pip install envelo
```

Or for a provisioned agent from Sentinel Authority:
```bash
python envelo_agent_SA-XXXX-XXXX.py
```

## Quick Start
```python
from envelo import EnveloAgent

# Initialize (credentials from Sentinel Authority)
agent = EnveloAgent(
    api_key="sa_live_xxxx",
    certificate_number="SA-2026-0001"
)

# Start enforcement
agent.start()

# Method 1: Decorator (recommended)
@agent.enforce
def move_robot(speed, position):
    """This function ONLY executes if speed and position are within ODD"""
    motors.set_speed(speed)
    motors.set_position(position)

# Method 2: Context manager
with agent.enforced(speed=50, temperature=25):
    # This block ONLY executes if all parameters pass
    execute_action()

# Method 3: Direct check
if agent.check(speed=50, altitude=100):
    do_action()
else:
    handle_violation()

# Method 4: Must check (always raises exception on violation)
try:
    agent.must_check(speed=200)  # Raises EnveloViolation
except EnveloViolation as e:
    print(f"Blocked: {e}")
```

## Boundary Types

ENVELO supports five boundary types:

### Numeric Boundaries
```python
# Speed: 0-100 km/h
# Temperature: -20 to 50°C
# Altitude: 0-400m
```

### Geographic Boundaries
```python
# Circular geofence (warehouse radius)
# Polygon geofence (delivery zone)
# Rectangular bounds (work area)
```

### Time Boundaries
```python
# Operating hours: 06:00-22:00
# Allowed days: Monday-Friday
# Maintenance windows
```

### Rate Boundaries
```python
# Max 10 actions per second
# Max 1000 API calls per hour
# Motor activation limits
```

### State Boundaries
```python
# Allowed modes: ["autonomous", "manual", "maintenance"]
# Forbidden states: ["emergency", "override"]
```

## Enforcement Modes
```python
# BLOCK mode (default) - silently blocks, returns False
agent = EnveloAgent(enforcement_mode="BLOCK")

# EXCEPTION mode - raises EnveloViolation
agent = EnveloAgent(enforcement_mode="EXCEPTION")

# SAFE_STATE mode - triggers your safe state callback
def emergency_stop(violations):
    robot.stop()
    robot.disable_motors()
    alert_operator()

agent = EnveloAgent(
    enforcement_mode="SAFE_STATE",
    safe_state_callback=emergency_stop
)
```

## Fail-Closed Operation

If ENVELO loses connection to Sentinel Authority, it enters **failsafe mode** where ALL actions are blocked:
```python
agent = EnveloAgent(
    fail_closed=True,  # Default: block everything if disconnected
    failsafe_timeout_seconds=30.0  # Enter failsafe after 30s no contact
)
```

This ensures your system cannot operate outside its certified envelope even if network connectivity is lost.

## CAT-72 Testing

For initial attestation, your system must run continuously for 72 hours with zero violations:
```python
agent = EnveloAgent(api_key="...", certificate_number="...")
agent.start()

# Run your system normally for 72+ hours
# ENVELO tracks uptime automatically
# Violations are reported to Sentinel Authority
# Certificate issued automatically upon completion
```

## Statistics & Monitoring
```python
stats = agent.get_stats()
print(f"Session: {stats['session_id']}")
print(f"Passed: {stats['pass_count']}")
print(f"Blocked: {stats['block_count']}")
print(f"Duration: {stats['duration']}")
print(f"Failsafe Active: {stats['failsafe_active']}")
```

## Environment Variables
```bash
export ENVELO_API_KEY=sa_live_xxxxx
export ENVELO_CERTIFICATE=SA-2026-0001
export ENVELO_ENDPOINT=https://api.sentinelauthority.org
```

## Support

- Documentation: https://docs.sentinelauthority.org/envelo
- Support: support@sentinelauthority.org
- Website: https://www.sentinelauthority.org

## License

Proprietary - Sentinel Authority. Licensed for use by attested systems only.
