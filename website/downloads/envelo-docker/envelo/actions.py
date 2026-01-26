"""ENVELO Actions"""
from dataclasses import dataclass, field
from typing import Any, Dict, List

@dataclass
class Action:
    action_type: str
    parameters: Dict[str, Any]
    source: str = "unknown"
    priority: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ActionResult:
    allowed: bool
    action_id: str
    evaluations: List[Dict[str, Any]]
    violations: List[str]
    timestamp: str
    
    def __bool__(self): return self.allowed
    
    def raise_if_blocked(self):
        if not self.allowed:
            from .exceptions import BoundaryViolation
            raise BoundaryViolation(f"Blocked: {', '.join(self.violations)}")
