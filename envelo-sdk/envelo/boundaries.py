"""
ENVELO Boundary Definitions
All boundary types that constrain autonomous system behavior.
Thread-safe, validated, serializable.

Sentinel Authority © 2025-2026
"""

import math
import time
import threading
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, time as dt_time
from collections import deque


class Boundary(ABC):
    """Abstract base class for all boundary types."""

    def __init__(self, name: str, parameter: str, violation_action: str = "BLOCK"):
        if not name or not isinstance(name, str):
            raise ValueError("Boundary name must be a non-empty string")
        if not parameter or not isinstance(parameter, str):
            raise ValueError("Boundary parameter must be a non-empty string")
        self.name = name
        self.parameter = parameter
        self.violation_action = violation_action
        self.enabled = True
        self._lock = threading.Lock()
        self._violation_count = 0
        self._check_count = 0

    @abstractmethod
    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        """Check if value is within boundary. Returns (passed, message)."""
        pass

    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Serialize boundary to dictionary."""
        pass

    @classmethod
    @abstractmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Boundary":
        """Deserialize boundary from dictionary."""
        pass

    def _record_check(self, passed: bool):
        with self._lock:
            self._check_count += 1
            if not passed:
                self._violation_count += 1

    @property
    def violation_count(self) -> int:
        return self._violation_count

    @property
    def check_count(self) -> int:
        return self._check_count


class NumericBoundary(Boundary):
    """Numeric range boundary for speed, temperature, pressure, etc."""

    def __init__(self, name: str, parameter: str, min_value: Optional[float] = None,
                 max_value: Optional[float] = None, unit: str = "", tolerance: float = 0.0,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        if min_value is None and max_value is None:
            raise ValueError(f"Boundary '{name}' must have min_value or max_value")
        if min_value is not None and max_value is not None and min_value > max_value:
            raise ValueError(f"Boundary '{name}': min_value ({min_value}) > max_value ({max_value})")
        if tolerance < 0:
            raise ValueError(f"Boundary '{name}': tolerance must be >= 0")
        self.min_value = min_value
        self.max_value = max_value
        self.unit = unit
        self.tolerance = tolerance

    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        try:
            v = float(value)
        except (TypeError, ValueError):
            self._record_check(False)
            return False, f"{self.parameter}={value!r} is not numeric"

        if self.min_value is not None and v < (self.min_value - self.tolerance):
            self._record_check(False)
            return False, (
                f"{self.parameter}={v}{self.unit} below min "
                f"{self.min_value}{self.unit}"
            )

        if self.max_value is not None and v > (self.max_value + self.tolerance):
            self._record_check(False)
            return False, (
                f"{self.parameter}={v}{self.unit} above max "
                f"{self.max_value}{self.unit}"
            )

        self._record_check(True)
        return True, None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "numeric", "name": self.name, "parameter": self.parameter,
            "min_value": self.min_value, "max_value": self.max_value,
            "unit": self.unit, "tolerance": self.tolerance,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NumericBoundary":
        return cls(
            name=data["name"], parameter=data.get("parameter", data["name"]),
            min_value=data.get("min_value"), max_value=data.get("max_value"),
            unit=data.get("unit", ""), tolerance=data.get("tolerance", 0.0),
        )


class GeoBoundary(Boundary):
    """Geographic boundary — circle, polygon, or rectangle."""

    def __init__(self, name: str, parameter: str = "position",
                 boundary_type: str = "circle",
                 coordinates: Optional[List[Dict[str, float]]] = None,
                 center: Optional[Dict[str, float]] = None,
                 radius_meters: Optional[float] = None,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        if boundary_type not in ("circle", "polygon", "rectangle"):
            raise ValueError(f"Unknown geo boundary_type: {boundary_type}")
        if boundary_type == "circle":
            if not center or radius_meters is None:
                raise ValueError(f"Circle boundary '{name}' requires center and radius_meters")
            if radius_meters <= 0:
                raise ValueError(f"Boundary '{name}': radius_meters must be > 0")
        if boundary_type == "polygon" and (not coordinates or len(coordinates) < 3):
            raise ValueError(f"Polygon boundary '{name}' requires >= 3 coordinates")
        if boundary_type == "rectangle" and (not coordinates or len(coordinates) != 2):
            raise ValueError(f"Rectangle boundary '{name}' requires exactly 2 coordinates")
        self.boundary_type = boundary_type
        self.coordinates = coordinates or []
        self.center = center
        self.radius_meters = radius_meters

    def _parse_position(self, value: Any) -> Tuple[float, float]:
        """Extract (lat, lon) from value. Raises ValueError on bad input."""
        if isinstance(value, dict):
            lat, lon = value.get("lat"), value.get("lon")
        elif isinstance(value, (list, tuple)) and len(value) >= 2:
            lat, lon = value[0], value[1]
        else:
            raise ValueError(f"Invalid position: {value!r}")
        return float(lat), float(lon)

    def check(self, value: Any) -> Tuple[bool, Optional[str]]:
        try:
            lat, lon = self._parse_position(value)
        except (TypeError, ValueError, IndexError):
            self._record_check(False)
            return False, f"Invalid position format: {value!r}"

        passed, msg = True, None

        if self.boundary_type == "circle":
            dist = self._haversine(lat, lon, self.center["lat"], self.center["lon"])
            if dist > self.radius_meters:
                passed = False
                msg = f"Position {dist:.0f}m from center, exceeds {self.radius_meters}m radius"

        elif self.boundary_type == "polygon":
            if not self._point_in_polygon(lat, lon):
                passed = False
                msg = f"Position outside geofence '{self.name}'"

        elif self.boundary_type == "rectangle":
            min_lat = min(c["lat"] for c in self.coordinates)
            max_lat = max(c["lat"] for c in self.coordinates)
            min_lon = min(c["lon"] for c in self.coordinates)
            max_lon = max(c["lon"] for c in self.coordinates)
            if not (min_lat <= lat <= max_lat and min_lon <= lon <= max_lon):
                passed = False
                msg = "Position outside rectangular bounds"

        self._record_check(passed)
        return passed, msg

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6_371_000  # Earth radius in meters
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _point_in_polygon(self, lat: float, lon: float) -> bool:
        """Ray-casting algorithm."""
        n = len(self.coordinates)
        inside = False
        j = n - 1
        for i in range(n):
            yi = self.coordinates[i]["lon"]
            yj = self.coordinates[j]["lon"]
            xi = self.coordinates[i]["lat"]
            xj = self.coordinates[j]["lat"]
            if ((yi > lon) != (yj > lon)) and (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "geo", "name": self.name, "parameter": self.parameter,
            "boundary_type": self.boundary_type, "coordinates": self.coordinates,
            "center": self.center, "radius_meters": self.radius_meters,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GeoBoundary":
        return cls(
            name=data["name"], parameter=data.get("parameter", "position"),
            boundary_type=data.get("boundary_type", "circle"),
            coordinates=data.get("coordinates", []),
            center=data.get("center"), radius_meters=data.get("radius_meters"),
        )


class TimeBoundary(Boundary):
    """Time-based boundary for operating hours."""

    def __init__(self, name: str, parameter: str = "timestamp",
                 allowed_start: str = "00:00", allowed_end: str = "23:59",
                 allowed_days: Optional[List[int]] = None,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        self.allowed_start = self._parse_time(allowed_start)
        self.allowed_end = self._parse_time(allowed_end)
        self.allowed_days = allowed_days if allowed_days is not None else [0, 1, 2, 3, 4, 5, 6]
        for d in self.allowed_days:
            if d not in range(7):
                raise ValueError(f"Invalid day: {d}. Must be 0 (Mon) through 6 (Sun)")

    @staticmethod
    def _parse_time(t) -> dt_time:
        if isinstance(t, dt_time):
            return t
        if isinstance(t, str):
            parts = t.strip().split(":")
            return dt_time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
        raise ValueError(f"Cannot parse time: {t!r}")

    def check(self, value: Any = None) -> Tuple[bool, Optional[str]]:
        now = datetime.now()
        if now.weekday() not in self.allowed_days:
            self._record_check(False)
            return False, f"Operation not allowed on day {now.weekday()} ({now.strftime('%A')})"

        current = now.time()
        if self.allowed_start <= self.allowed_end:
            in_window = self.allowed_start <= current <= self.allowed_end
        else:
            # Wraps midnight
            in_window = current >= self.allowed_start or current <= self.allowed_end

        if not in_window:
            self._record_check(False)
            return False, f"Operation not allowed at {current.strftime('%H:%M')}"

        self._record_check(True)
        return True, None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "time", "name": self.name, "parameter": self.parameter,
            "allowed_start": self.allowed_start.strftime("%H:%M"),
            "allowed_end": self.allowed_end.strftime("%H:%M"),
            "allowed_days": self.allowed_days,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TimeBoundary":
        return cls(
            name=data["name"], parameter=data.get("parameter", "timestamp"),
            allowed_start=data.get("allowed_start", "00:00"),
            allowed_end=data.get("allowed_end", "23:59"),
            allowed_days=data.get("allowed_days"),
        )


class RateBoundary(Boundary):
    """Rate limiting boundary for action frequency."""

    def __init__(self, name: str, parameter: str,
                 max_per_second: Optional[float] = None,
                 max_per_minute: Optional[float] = None,
                 max_per_hour: Optional[float] = None,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        if max_per_second is None and max_per_minute is None and max_per_hour is None:
            raise ValueError(f"RateBoundary '{name}' must have at least one limit")
        self.max_per_second = max_per_second
        self.max_per_minute = max_per_minute
        self.max_per_hour = max_per_hour
        self._timestamps: deque = deque(maxlen=100_000)
        self._ts_lock = threading.Lock()

    def check(self, value: Any = None) -> Tuple[bool, Optional[str]]:
        now = time.monotonic()
        with self._ts_lock:
            self._timestamps.append(now)

            if self.max_per_second is not None:
                count = sum(1 for t in self._timestamps if now - t <= 1.0)
                if count > self.max_per_second:
                    self._record_check(False)
                    return False, f"Rate {count}/sec exceeds {self.max_per_second}/sec"

            if self.max_per_minute is not None:
                count = sum(1 for t in self._timestamps if now - t <= 60.0)
                if count > self.max_per_minute:
                    self._record_check(False)
                    return False, f"Rate {count}/min exceeds {self.max_per_minute}/min"

            if self.max_per_hour is not None:
                count = sum(1 for t in self._timestamps if now - t <= 3600.0)
                if count > self.max_per_hour:
                    self._record_check(False)
                    return False, f"Rate {count}/hr exceeds {self.max_per_hour}/hr"

        self._record_check(True)
        return True, None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "rate", "name": self.name, "parameter": self.parameter,
            "max_per_second": self.max_per_second,
            "max_per_minute": self.max_per_minute,
            "max_per_hour": self.max_per_hour,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RateBoundary":
        return cls(
            name=data["name"], parameter=data.get("parameter", data["name"]),
            max_per_second=data.get("max_per_second"),
            max_per_minute=data.get("max_per_minute"),
            max_per_hour=data.get("max_per_hour"),
        )


class StateBoundary(Boundary):
    """State-based boundary for allowed operational states."""

    def __init__(self, name: str, parameter: str,
                 allowed_values: Optional[List[Any]] = None,
                 forbidden_values: Optional[List[Any]] = None,
                 violation_action: str = "BLOCK"):
        super().__init__(name, parameter, violation_action)
        if not allowed_values and not forbidden_values:
            raise ValueError(f"StateBoundary '{name}' needs allowed_values or forbidden_values")
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
        return {
            "type": "state", "name": self.name, "parameter": self.parameter,
            "allowed_values": self.allowed_values,
            "forbidden_values": self.forbidden_values,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StateBoundary":
        return cls(
            name=data["name"], parameter=data.get("parameter", data["name"]),
            allowed_values=data.get("allowed_values", []),
            forbidden_values=data.get("forbidden_values", []),
        )


BOUNDARY_TYPES = {
    "numeric": NumericBoundary,
    "geo": GeoBoundary,
    "time": TimeBoundary,
    "rate": RateBoundary,
    "state": StateBoundary,
}


def boundary_from_dict(data: Dict[str, Any]) -> Boundary:
    """Deserialize any boundary from a dictionary."""
    btype = data.get("type", "numeric")
    if btype not in BOUNDARY_TYPES:
        raise ValueError(f"Unknown boundary type: {btype}")
    return BOUNDARY_TYPES[btype].from_dict(data)
