"""
ENVELO - Enforcer for Non-Violable Execution & Limit Oversight
Sentinel Authority Runtime Enforcement SDK

Usage:
    from envelo import EnveloAgent
    
    agent = EnveloAgent()
    agent.start()
    
    @agent.enforce
    def move_robot(speed, position):
        robot.actuate(speed, position)
"""

from .agent import EnveloAgent
from .boundaries import (
    NumericBoundary,
    GeoBoundary, 
    TimeBoundary,
    RateBoundary,
    StateBoundary
)
from .exceptions import (
    EnveloViolation,
    EnveloBoundaryError,
    EnveloConnectionError,
    EnveloConfigError
)
from .config import EnveloConfig

__version__ = "1.0.0"
__all__ = [
    "EnveloAgent",
    "EnveloConfig",
    "NumericBoundary",
    "GeoBoundary",
    "TimeBoundary",
    "RateBoundary",
    "StateBoundary",
    "EnveloViolation",
    "EnveloBoundaryError",
    "EnveloConnectionError",
    "EnveloConfigError",
]
