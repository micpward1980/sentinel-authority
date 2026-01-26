"""ENVELO Boundaries - Constraint definitions"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import time

@dataclass
class BoundaryResult:
    passed: bool
    actual_value: Any
    limit_value: Any
    message: str

class Boundary(ABC):
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.boundary_type = self.__class__.__name__
    
    @abstractmethod
    def evaluate(self, parameters: Dict[str, Any]) -> BoundaryResult: pass
    
    def to_dict(self) -> dict:
        return {"name": self.name, "type": self.boundary_type, "description": self.description}

class NumericBoundary(Boundary):
    def __init__(self, name: str, parameter: Optional[str] = None, min: Optional[float] = None, 
                 max: Optional[float] = None, unit: str = "", description: str = ""):
        super().__init__(name, description)
        self.parameter = parameter or name
        self.min, self.max, self.unit = min, max, unit
    
    def evaluate(self, parameters: Dict[str, Any]) -> BoundaryResult:
        value = parameters.get(self.parameter)
        if value is None:
            return BoundaryResult(True, None, f"[{self.min}, {self.max}]", "Parameter not present")
        try:
            value = float(value)
        except:
            return BoundaryResult(False, value, f"[{self.min}, {self.max}]", f"Invalid numeric: {value}")
        if self.min is not None and value < self.min:
            return BoundaryResult(False, value, self.min, f"{self.parameter}={value}{self.unit} below min {self.min}{self.unit}")
        if self.max is not None and value > self.max:
            return BoundaryResult(False, value, self.max, f"{self.parameter}={value}{self.unit} above max {self.max}{self.unit}")
        return BoundaryResult(True, value, f"[{self.min}, {self.max}]", f"{self.parameter}={value}{self.unit} OK")
    
    def to_dict(self):
        d = super().to_dict()
        d.update({"parameter": self.parameter, "min": self.min, "max": self.max, "unit": self.unit})
        return d

class GeoBoundary(Boundary):
    def __init__(self, name: str, lat_param: str = "latitude", lon_param: str = "longitude",
                 allowed_zones: Optional[List[dict]] = None, forbidden_zones: Optional[List[dict]] = None, description: str = ""):
        super().__init__(name, description)
        self.lat_param, self.lon_param = lat_param, lon_param
        self.allowed_zones = allowed_zones or []
        self.forbidden_zones = forbidden_zones or []
    
    def _in_circle(self, lat, lon, center, radius_m):
        import math
        lat1, lon1, lat2, lon2 = map(math.radians, [lat, lon, center[0], center[1]])
        a = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
        return 6371000 * 2 * math.asin(math.sqrt(a)) <= radius_m
    
    def _in_polygon(self, lat, lon, points):
        n, inside, j = len(points), False, len(points)-1
        for i in range(n):
            if ((points[i][0] > lat) != (points[j][0] > lat) and
                lon < (points[j][1]-points[i][1])*(lat-points[i][0])/(points[j][0]-points[i][0]) + points[i][1]):
                inside = not inside
            j = i
        return inside
    
    def _in_zone(self, lat, lon, zone):
        if zone["type"] == "circle": return self._in_circle(lat, lon, zone["center"], zone["radius_m"])
        if zone["type"] == "polygon": return self._in_polygon(lat, lon, zone["points"])
        return False
    
    def evaluate(self, parameters: Dict[str, Any]) -> BoundaryResult:
        lat, lon = parameters.get(self.lat_param), parameters.get(self.lon_param)
        if lat is None or lon is None:
            return BoundaryResult(True, None, "geo zones", "Position not present")
        try:
            lat, lon = float(lat), float(lon)
        except:
            return BoundaryResult(False, (lat, lon), "valid coords", f"Invalid: ({lat}, {lon})")
        for zone in self.forbidden_zones:
            if self._in_zone(lat, lon, zone):
                return BoundaryResult(False, (lat, lon), f"outside {zone.get('name', 'forbidden')}", f"In forbidden zone")
        if self.allowed_zones and not any(self._in_zone(lat, lon, z) for z in self.allowed_zones):
            return BoundaryResult(False, (lat, lon), "within allowed", f"Outside allowed zones")
        return BoundaryResult(True, (lat, lon), "geo zones", f"Position OK")

class RateLimitBoundary(Boundary):
    def __init__(self, name: str, action_type: Optional[str] = None, max_per_second: Optional[float] = None,
                 max_per_minute: Optional[float] = None, max_per_hour: Optional[float] = None, description: str = ""):
        super().__init__(name, description)
        self.action_type = action_type
        self.max_per_second, self.max_per_minute, self.max_per_hour = max_per_second, max_per_minute, max_per_hour
        self._timestamps: List[float] = []
    
    def evaluate(self, parameters: Dict[str, Any]) -> BoundaryResult:
        if self.action_type and parameters.get("_action_type") != self.action_type:
            return BoundaryResult(True, 0, "N/A", "Action type mismatch")
        now = time.time()
        if self.max_per_second:
            self._timestamps = [t for t in self._timestamps if t > now - 1]
            if len(self._timestamps) >= self.max_per_second:
                return BoundaryResult(False, len(self._timestamps), self.max_per_second, f"Rate exceeded: {len(self._timestamps)}/s")
        if self.max_per_minute:
            self._timestamps = [t for t in self._timestamps if t > now - 60]
            if len(self._timestamps) >= self.max_per_minute:
                return BoundaryResult(False, len(self._timestamps), self.max_per_minute, f"Rate exceeded: {len(self._timestamps)}/min")
        self._timestamps.append(now)
        return BoundaryResult(True, len(self._timestamps), "OK", "Within limits")

class StateBoundary(Boundary):
    def __init__(self, name: str, required_states: Optional[Dict[str, Any]] = None,
                 forbidden_states: Optional[Dict[str, Any]] = None, description: str = ""):
        super().__init__(name, description)
        self.required_states = required_states or {}
        self.forbidden_states = forbidden_states or {}
    
    def evaluate(self, parameters: Dict[str, Any]) -> BoundaryResult:
        violations = []
        for k, v in self.required_states.items():
            if parameters.get(k) != v: violations.append(f"{k} must be {v}")
        for k, v in self.forbidden_states.items():
            if parameters.get(k) == v: violations.append(f"{k} must not be {v}")
        if violations:
            return BoundaryResult(False, parameters, self.required_states, "; ".join(violations))
        return BoundaryResult(True, parameters, "OK", "All states OK")

class CustomBoundary(Boundary):
    def __init__(self, name: str, evaluator: callable, description: str = ""):
        super().__init__(name, description)
        self.evaluator = evaluator
    
    def evaluate(self, parameters: Dict[str, Any]) -> BoundaryResult:
        try:
            result = self.evaluator(parameters)
            if isinstance(result, bool): return BoundaryResult(result, parameters, "custom", "OK" if result else "Failed")
            if isinstance(result, tuple): return BoundaryResult(result[0], parameters, "custom", result[1])
            return BoundaryResult(bool(result), parameters, "custom", str(result))
        except Exception as e:
            return BoundaryResult(False, parameters, "custom", f"Error: {e}")
