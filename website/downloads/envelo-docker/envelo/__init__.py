"""
ENVELO Agent - Enforcer for Non-Violable Execution & Limit Oversight
Provided by Sentinel Authority for ODDC Conformance
"""

__version__ = "1.0.0"
__author__ = "Sentinel Authority"

from .agent import EnveloAgent, EnveloConfig
from .boundaries import Boundary, NumericBoundary, GeoBoundary, RateLimitBoundary, StateBoundary, CustomBoundary
from .actions import Action, ActionResult
from .exceptions import BoundaryViolation, EnveloError

__all__ = [
    "EnveloAgent", "EnveloConfig",
    "Boundary", "NumericBoundary", "GeoBoundary", "RateLimitBoundary", "StateBoundary", "CustomBoundary",
    "Action", "ActionResult",
    "BoundaryViolation", "EnveloError",
]
