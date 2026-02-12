"""
ENVELO - Enforced Non-Violable Execution-Limit Override
Sentinel Authority Runtime Enforcement SDK v3.0.0

Usage:
    from envelo import EnveloAgent
    
    agent = EnveloAgent()
    agent.start()
    
    @agent.enforce
    def move_robot(speed, position):
        robot.actuate(speed, position)

CLI:
    envelo setup       # Push-button deployment
    envelo status      # Health check
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

__version__ = "3.0.0"
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
