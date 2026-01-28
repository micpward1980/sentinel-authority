"""
ENVELO Boundary Definitions
All boundary types that constrain autonomous system behavior
"""

import math
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime, time as dt_time
from collections import deque


class Boundary(ABC):
    """Abstract base class for all boundary types"""
    
    def __init__(self, name: str, parameter: str, violation_action: str = "BLOCK"):
        self.name = name
        self.parameter = parameter
        self.violation_action = violation_action
        self.enabled = True
        self.violation_count = 0
        self.check_count = 0
    
    @abstractmethod
    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        """Check if value is within boundary. Returns (passed, violation_message)"""
        pass
    
    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Serialize boundary to dictionary"""
        pass
    
    @classmethod
    @abstractmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Boundary":
        """Deserialize boundary from dictionary"""
        pass
    
    def _record_check(self, passed: bool):
        self.check_count += 1
        if not passed:
            self.violation_count += 1


class NumericBoundary(Boundary):
    """Numeric range boundary for speed, temperature, pressure, etc."""
    
    def __init__(self, name: str, parameter: str, min_value: Optional[float] = None,
                 max_value: Optional[float] = None, unit: str = "", tolerance: float = 0.0,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        self.min_value = min_value
        self.max_value = max_value
        self.unit = unit
        self.tolerance = tolerance
        if min_value is None and max_value is None:
            raise ValueError(f"Boundary '{name}' must have min_value or max_value")
    
    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        try:
            v = float(value)
        except (TypeError, ValueError):
            self._record_check(False)
            return False, f"{self.parameter}={value} is not numeric"
        
        if self.min_value is not None and v < (self.min_value - self.tolerance):
            self._record_check(False)
            return False, f"{self.parameter}={v}{self.unit} below min {self.min_value}{self.unit}"
        
        if self.max_value is not None and v > (self.max_value + self.tolerance):
            self._record_check(False)
            return False, f"{self.parameter}={v}{self.unit} above max {self.max_value}{self.unit}"
        
        self._record_check(True)
        return True, None
    
    def to_dict(self) -> Dict[str, Any]:
        return {"type": "numeric", "name": self.name, "parameter": self.parameter,
                "min_value": self.min_value, "max_value": self.max_value,
                "unit": self.unit, "tolerance": self.tolerance}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NumericBoundary":
        return cls(name=data["name"], parameter=data.get("parameter", data["name"]),
                   min_value=data.get("min_value"), max_value=data.get("max_value"),
                   unit=data.get("unit", ""), tolerance=data.get("tolerance", 0.0))


class GeoBoundary(Boundary):
    """Geographic boundary for location constraints (polygon, circle, rectangle)"""
    
    def __init__(self, name: str, parameter: str = "position", boundary_type: str = "circle",
                 coordinates: List[Dict[str, float]] = None, center: Dict[str, float] = None,
                 radius_meters: float = None, violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        self.boundary_type = boundary_type
        self.coordinates = coordinates or []
        self.center = center
        self.radius_meters = radius_meters
    
    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        try:
            if isinstance(value, dict):
                lat, lon = value.get("lat"), value.get("lon")
            elif isinstance(value, (list, tuple)):
                lat, lon = value[0], value[1]
            else:
                raise ValueError()
            lat, lon = float(lat), float(lon)
        except:
            self._record_check(False)
            return False, f"Invalid position format: {value}"
        
        if self.boundary_type == "circle" and self.center and self.radius_meters:
            dist = self._haversine(lat, lon, self.center["lat"], self.center["lon"])
            if dist > self.radius_meters:
                self._record_check(False)
                return False, f"Position {dist:.0f}m from center, exceeds {self.radius_meters}m radius"
        elif self.boundary_type == "polygon" and len(self.coordinates) >= 3:
            if not self._point_in_polygon(lat, lon):
                self._record_check(False)
                return False, f"Position outside geofence '{self.name}'"
        elif self.boundary_type == "rectangle" and len(self.coordinates) == 2:
            min_lat = min(c["lat"] for c in self.coordinates)
            max_lat = max(c["lat"] for c in self.coordinates)
            min_lon = min(c["lon"] for c in self.coordinates)
            max_lon = max(c["lon"] for c in self.coordinates)
            if not (min_lat <= lat <= max_lat and min_lon <= lon <= max_lon):
                self._record_check(False)
                return False, f"Position outside rectangular bounds"
        
        self._record_check(True)
        return True, None
    
    def _haversine(self, lat1, lon1, lat2, lon2) -> float:
        R = 6371000
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
        a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    def _point_in_polygon(self, lat, lon) -> bool:
        n = len(self.coordinates)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = self.coordinates[i]["lat"], self.coordinates[i]["lon"]
            xj, yj = self.coordinates[j]["lat"], self.coordinates[j]["lon"]
            if ((yi > lon) != (yj > lon)) and (lat < (xj-xi)*(lon-yi)/(yj-yi) + xi):
                inside = not inside
            j = i
        return inside
    
    def to_dict(self) -> Dict[str, Any]:
        return {"type": "geo", "name": self.name, "parameter": self.parameter,
                "boundary_type": self.boundary_type, "coordinates": self.coordinates,
                "center": self.center, "radius_meters": self.radius_meters}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GeoBoundary":
        return cls(name=data["name"], parameter=data.get("parameter", "position"),
                   boundary_type=data.get("boundary_type", "circle"),
                   coordinates=data.get("coordinates", []), center=data.get("center"),
                   radius_meters=data.get("radius_meters"))


class TimeBoundary(Boundary):
    """Time-based boundary for operating hours"""
    
    def __init__(self, name: str, parameter: str = "timestamp",
                 allowed_start: str = "00:00", allowed_end: str = "23:59",
                 allowed_days: List[int] = None, violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        self.allowed_start = self._parse_time(allowed_start)
        self.allowed_end = self._parse_time(allowed_end)
        self.allowed_days = allowed_days if allowed_days else [0,1,2,3,4,5,6]
    
    def _parse_time(self, t) -> dt_time:
        if isinstance(t, dt_time): return t
        if isinstance(t, str):
            parts = t.split(":")
            return dt_time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
        return dt_time(int(t), 0)
    
    def check(self, value: Any = None) -> Tuple[bool, Optional[str]]:
        now = datetime.now()
        if now.weekday() not in self.allowed_days:
            self._record_check(False)
            return False, f"Operation not allowed on day {now.weekday()}"
        
        current = now.time()
        if self.allowed_start <= self.allowed_end:
            in_window = self.allowed_start <= current <= self.allowed_end
        else:
            in_window = current >= self.allowed_start or current <= self.allowed_end
        
        if not in_window:
            self._record_check(False)
            return False, f"Operation not allowed at {current.strftime('%H:%M')}"
        
        self._record_check(True)
        return True, None
    
    def to_dict(self) -> Dict[str, Any]:
        return {"type": "time", "name": self.name, "parameter": self.parameter,
                "allowed_start": self.allowed_start.strftime("%H:%M"),
                "allowed_end": self.allowed_end.strftime("%H:%M"),
                "allowed_days": self.allowed_days}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TimeBoundary":
        return cls(name=data["name"], allowed_start=data.get("allowed_start", "00:00"),
                   allowed_end=data.get("allowed_end", "23:59"),
                   allowed_days=data.get("allowed_days"))


class RateBoundary(Boundary):
    """Rate limiting boundary for action frequency"""
    
    def __init__(self, name: str, parameter: str, max_per_second: float = None,
                 max_per_minute: float = None, max_per_hour: float = None,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        self.max_per_second = max_per_second
        self.max_per_minute = max_per_minute
        self.max_per_hour = max_per_hour
        self._timestamps: deque = deque(maxlen=10000)
    
    def check(self, value: Any = None) -> Tuple[bool, Optional[str]]:
        now = time.time()
        self._timestamps.append(now)
        
        if self.max_per_second:
            count = sum(1 for t in self._timestamps if now - t <= 1.0)
            if count > self.max_per_second:
                self._record_check(False)
                return False, f"Rate {count}/sec exceeds {self.max_per_second}/sec"
        
        if self.max_per_minute:
            count = sum(1 for t in self._timestamps if now - t <= 60.0)
            if count > self.max_per_minute:
                self._record_check(False)
                return False, f"Rate {count}/min exceeds {self.max_per_minute}/min"
        
        if self.max_per_hour:
            count = sum(1 for t in self._timestamps if now - t <= 3600.0)
            if count > self.max_per_hour:
                self._record_check(False)
                return False, f"Rate {count}/hr exceeds {self.max_per_hour}/hr"
        
        self._record_check(True)
        return True, None
    
    def to_dict(self) -> Dict[str, Any]:
        return {"type": "rate", "name": self.name, "parameter": self.parameter,
                "max_per_second": self.max_per_second, "max_per_minute": self.max_per_minute,
                "max_per_hour": self.max_per_hour}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RateBoundary":
        return cls(name=data["name"], parameter=data.get("parameter", data["name"]),
                   max_per_second=data.get("max_per_second"),
                   max_per_minute=data.get("max_per_minute"),
                   max_per_hour=data.get("max_per_hour"))


class StateBoundary(Boundary):
    """State-based boundary for allowed operational states"""
    
    def __init__(self, name: str, parameter: str, allowed_values: List[Any] = None,
                 forbidden_values: List[Any] = None, violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        self.allowed_values = allowed_values or []
        self.forbidden_values = forbidden_values or []
    
    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        if self.forbidden_values and value in self.forbidden_values:
            self._record_check(False)
            return False, f"{self.parameter}='{value}' is forbidden"
        if self.allowed_values and value not in self.allowed_values:
            self._record_check(False)
            return False, f"{self.parameter}='{value}' not in allowed values"
        self._record_check(True)
        return True, None
    
    def to_dict(self) -> Dict[str, Any]:
        return {"type": "state", "name": self.name, "parameter": self.parameter,
                "allowed_values": self.allowed_values, "forbidden_values": self.forbidden_values}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StateBoundary":
        return cls(name=data["name"], parameter=data.get("parameter", data["name"]),
                   allowed_values=data.get("allowed_values", []),
                   forbidden_values=data.get("forbidden_values", []))


BOUNDARY_TYPES = {
    "numeric": NumericBoundary, "geo": GeoBoundary, "time": TimeBoundary,
    "rate": RateBoundary, "state": StateBoundary
}

def boundary_from_dict(data: Dict[str, Any]) -> Boundary:
    btype = data.get("type", "numeric")
    return BOUNDARY_TYPES[btype].from_dict(data)
