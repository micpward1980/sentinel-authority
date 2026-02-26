"""
ENVELO Auto-Discovery Engine
Observes autonomous system behavior and auto-generates ODD envelope boundaries.

The customer's system already operates within its designed ODD. The Interlock
watches a window of normal operation, extracts the parameters, and locks them in
as independently enforced boundaries.

Sentinel Authority © 2025-2026
"""

import math
import time
import threading
import logging
import statistics
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Tuple, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field

from .boundaries import (
    Boundary, NumericBoundary, GeoBoundary, TimeBoundary,
    RateBoundary, StateBoundary
)

logger = logging.getLogger("envelo.discovery")


# ---------------------------------------------------------------------------
# Observation containers
# ---------------------------------------------------------------------------

@dataclass
class NumericObservation:
    """Tracks numeric parameter observations with running statistics."""
    values: List[float] = field(default_factory=list)
    timestamps: List[float] = field(default_factory=list)
    min_seen: float = float("inf")
    max_seen: float = float("-inf")

    def record(self, value: float):
        now = time.time()
        self.values.append(value)
        self.timestamps.append(now)
        if value < self.min_seen:
            self.min_seen = value
        if value > self.max_seen:
            self.max_seen = value

    @property
    def count(self) -> int:
        return len(self.values)

    @property
    def mean(self) -> float:
        return statistics.mean(self.values) if self.values else 0.0

    @property
    def stdev(self) -> float:
        return statistics.stdev(self.values) if len(self.values) > 1 else 0.0

    def percentile(self, p: float) -> float:
        """Return p-th percentile (0-100)."""
        if not self.values:
            return 0.0
        s = sorted(self.values)
        k = (len(s) - 1) * (p / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return s[int(k)]
        return s[f] * (c - k) + s[c] * (k - f)


@dataclass
class GeoObservation:
    """Tracks position observations for geofence generation."""
    points: List[Tuple[float, float]] = field(default_factory=list)
    lat_min: float = float("inf")
    lat_max: float = float("-inf")
    lon_min: float = float("inf")
    lon_max: float = float("-inf")

    def record(self, lat: float, lon: float):
        self.points.append((lat, lon))
        self.lat_min = min(self.lat_min, lat)
        self.lat_max = max(self.lat_max, lat)
        self.lon_min = min(self.lon_min, lon)
        self.lon_max = max(self.lon_max, lon)

    @property
    def count(self) -> int:
        return len(self.points)

    @property
    def centroid(self) -> Tuple[float, float]:
        if not self.points:
            return (0.0, 0.0)
        lats = [p[0] for p in self.points]
        lons = [p[1] for p in self.points]
        return (statistics.mean(lats), statistics.mean(lons))

    @property
    def max_radius_meters(self) -> float:
        """Max distance from centroid to any observed point."""
        if not self.points:
            return 0.0
        clat, clon = self.centroid
        max_d = 0.0
        for lat, lon in self.points:
            d = self._haversine(clat, clon, lat, lon)
            if d > max_d:
                max_d = d
        return max_d

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6_371_000
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def convex_hull(self) -> List[Tuple[float, float]]:
        """Compute convex hull of observed positions using Graham scan."""
        if len(self.points) < 3:
            return list(self.points)

        pts = list(set(self.points))
        if len(pts) < 3:
            return pts

        # Find lowest point (min lat, then min lon)
        start = min(pts, key=lambda p: (p[0], p[1]))
        pts.remove(start)

        def polar_angle(p):
            return math.atan2(p[1] - start[1], p[0] - start[0])

        def cross(o, a, b):
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

        pts.sort(key=polar_angle)
        hull = [start]

        for p in pts:
            while len(hull) > 1 and cross(hull[-2], hull[-1], p) <= 0:
                hull.pop()
            hull.append(p)

        return hull


@dataclass
class TimeObservation:
    """Tracks when the system operates."""
    hours: List[int] = field(default_factory=list)
    weekdays: List[int] = field(default_factory=list)
    timestamps: List[datetime] = field(default_factory=list)

    def record(self):
        now = datetime.now()
        self.hours.append(now.hour)
        self.weekdays.append(now.weekday())
        self.timestamps.append(now)

    @property
    def count(self) -> int:
        return len(self.timestamps)

    @property
    def active_hours(self) -> Tuple[int, int]:
        """Return (earliest_hour, latest_hour) of operation."""
        if not self.hours:
            return (0, 23)
        return (min(self.hours), max(self.hours))

    @property
    def active_days(self) -> List[int]:
        """Return sorted list of observed operating days."""
        if not self.weekdays:
            return list(range(7))
        return sorted(set(self.weekdays))


@dataclass
class RateObservation:
    """Tracks action frequency for rate boundary generation."""
    timestamps: deque = field(default_factory=lambda: deque(maxlen=100_000))
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def record(self):
        with self._lock:
            self.timestamps.append(time.monotonic())

    @property
    def count(self) -> int:
        return len(self.timestamps)

    def max_rate_per_second(self) -> float:
        """Compute observed max rate per second over sliding windows."""
        if len(self.timestamps) < 2:
            return 0.0
        max_rate = 0.0
        ts = list(self.timestamps)
        for i in range(len(ts)):
            count = 0
            for j in range(i, len(ts)):
                if ts[j] - ts[i] <= 1.0:
                    count += 1
                else:
                    break
            if count > max_rate:
                max_rate = count
        return max_rate

    def max_rate_per_minute(self) -> float:
        if len(self.timestamps) < 2:
            return 0.0
        ts = list(self.timestamps)
        max_rate = 0.0
        for i in range(len(ts)):
            count = sum(1 for j in range(i, len(ts)) if ts[j] - ts[i] <= 60.0)
            if count > max_rate:
                max_rate = count
        return max_rate


@dataclass
class StateObservation:
    """Tracks categorical/state values."""
    values: List[Any] = field(default_factory=list)

    def record(self, value: Any):
        self.values.append(value)

    @property
    def count(self) -> int:
        return len(self.values)

    @property
    def unique_values(self) -> Set:
        return set(self.values)




@dataclass
class DeltaObservation:
    """Tracks rate-of-change between consecutive samples for a numeric parameter."""
    prev_value: Optional[float] = None
    prev_time: Optional[float] = None
    deltas: List[float] = field(default_factory=list)
    rates: List[float] = field(default_factory=list)
    max_delta: float = 0.0
    max_rate: float = 0.0

    def record(self, value: float):
        now = time.time()
        if self.prev_value is not None and self.prev_time is not None:
            dt = now - self.prev_time
            if dt > 0:
                delta = abs(value - self.prev_value)
                rate = delta / dt
                self.deltas.append(delta)
                self.rates.append(rate)
                if delta > self.max_delta:
                    self.max_delta = delta
                if rate > self.max_rate:
                    self.max_rate = rate
        self.prev_value = value
        self.prev_time = now

    @property
    def count(self) -> int:
        return len(self.deltas)

    @property
    def mean_rate(self) -> float:
        return statistics.mean(self.rates) if self.rates else 0.0

    @property
    def stdev_rate(self) -> float:
        return statistics.stdev(self.rates) if len(self.rates) > 1 else 0.0

    def percentile_rate(self, p: float) -> float:
        if not self.rates:
            return 0.0
        s = sorted(self.rates)
        k = (len(s) - 1) * (p / 100.0)
        f_idx = math.floor(k)
        c_idx = math.ceil(k)
        if f_idx == c_idx:
            return s[int(k)]
        return s[f_idx] * (c_idx - k) + s[c_idx] * (k - f_idx)


@dataclass
class CorrelationObservation:
    """Tracks paired observations between two parameters for correlation detection."""
    param_a: str = ""
    param_b: str = ""
    pairs: List[Tuple[float, float]] = field(default_factory=list)

    def record(self, a: float, b: float):
        self.pairs.append((a, b))

    @property
    def count(self) -> int:
        return len(self.pairs)

    def correlation(self) -> float:
        """Pearson correlation coefficient."""
        if len(self.pairs) < 10:
            return 0.0
        a_vals = [p[0] for p in self.pairs]
        b_vals = [p[1] for p in self.pairs]
        n = len(self.pairs)
        mean_a = sum(a_vals) / n
        mean_b = sum(b_vals) / n
        cov = sum((a - mean_a) * (b - mean_b) for a, b in self.pairs) / n
        std_a = (sum((a - mean_a) ** 2 for a in a_vals) / n) ** 0.5
        std_b = (sum((b - mean_b) ** 2 for b in b_vals) / n) ** 0.5
        if std_a < 1e-10 or std_b < 1e-10:
            return 0.0
        return cov / (std_a * std_b)

    def conditional_ranges(self, a_bins: int = 5) -> List[Dict]:
        """Split param_a into bins and compute param_b range per bin."""
        if len(self.pairs) < 20:
            return []
        a_vals = sorted(set(p[0] for p in self.pairs))
        if len(a_vals) < a_bins:
            a_bins = max(2, len(a_vals))
        bin_size = len(a_vals) // a_bins
        result = []
        for i in range(a_bins):
            start_idx = i * bin_size
            end_idx = start_idx + bin_size if i < a_bins - 1 else len(a_vals)
            a_low = a_vals[start_idx]
            a_high = a_vals[min(end_idx, len(a_vals) - 1)]
            b_in_bin = [p[1] for p in self.pairs if a_low <= p[0] <= a_high]
            if b_in_bin:
                result.append({
                    "a_min": a_low, "a_max": a_high,
                    "b_min": min(b_in_bin), "b_max": max(b_in_bin),
                    "b_mean": statistics.mean(b_in_bin),
                    "count": len(b_in_bin),
                })
        return result


@dataclass
class ModalObservation:
    """Detects multi-modal distributions (e.g., 2mph in warehouse, 15mph in corridor)."""
    values: List[float] = field(default_factory=list)

    def record(self, value: float):
        self.values.append(value)

    @property
    def count(self) -> int:
        return len(self.values)

    def detect_modes(self, min_gap_ratio: float = 0.3) -> List[Dict]:
        """Detect clusters/modes using valley detection on histogram."""
        if len(self.values) < 30:
            return [{"center": statistics.mean(self.values), "min": min(self.values), "max": max(self.values), "count": len(self.values)}]
        sorted_vals = sorted(self.values)
        data_range = sorted_vals[-1] - sorted_vals[0]
        if data_range < 1e-10:
            return [{"center": sorted_vals[0], "min": sorted_vals[0], "max": sorted_vals[0], "count": len(self.values)}]
        n_bins = min(50, max(10, len(self.values) // 20))
        bin_width = data_range / n_bins
        bins = [0] * n_bins
        for v in sorted_vals:
            idx = min(int((v - sorted_vals[0]) / bin_width), n_bins - 1)
            bins[idx] += 1
        peaks = []
        for i in range(1, n_bins - 1):
            if bins[i] >= bins[i-1] and bins[i] >= bins[i+1] and bins[i] > len(self.values) * 0.02:
                peaks.append(i)
        if not peaks:
            peaks = [bins.index(max(bins))]
        merged = [peaks[0]]
        for p in peaks[1:]:
            if p - merged[-1] > n_bins * min_gap_ratio:
                merged.append(p)
        modes = []
        for peak_idx in merged:
            center = sorted_vals[0] + (peak_idx + 0.5) * bin_width
            mode_vals = [v for v in sorted_vals if abs(v - center) < data_range / (len(merged) + 1)]
            if mode_vals:
                modes.append({
                    "center": round(statistics.mean(mode_vals), 6),
                    "min": round(min(mode_vals), 6),
                    "max": round(max(mode_vals), 6),
                    "count": len(mode_vals),
                })
        return modes if modes else [{"center": statistics.mean(self.values), "min": min(self.values), "max": max(self.values), "count": len(self.values)}]

    @property
    def is_multimodal(self) -> bool:
        return len(self.detect_modes()) > 1


@dataclass
class SequenceObservation:
    """Tracks state transitions to detect operational sequences and prerequisites."""
    transitions: List[Tuple[str, str, float]] = field(default_factory=list)
    state_history: List[Tuple[str, float]] = field(default_factory=list)
    _prev_states: Dict[str, Any] = field(default_factory=dict)

    def record_states(self, current_states: Dict[str, Any]):
        now = time.time()
        for key, value in current_states.items():
            str_val = str(value).lower()
            prev = self._prev_states.get(key)
            if prev is not None and prev != str_val:
                self.transitions.append((f"{key}={prev}", f"{key}={str_val}", now))
                self.state_history.append((f"{key}={str_val}", now))
            self._prev_states[key] = str_val

    @property
    def count(self) -> int:
        return len(self.transitions)

    def detect_prerequisites(self, min_confidence: float = 0.8) -> List[Dict]:
        """Detect state transitions that always follow another state."""
        if len(self.transitions) < 20:
            return []
        follows = defaultdict(lambda: defaultdict(int))
        total_to = defaultdict(int)
        for i, (_, to_state, ts) in enumerate(self.transitions):
            total_to[to_state] += 1
            for j in range(max(0, i - 5), i):
                _, prev_to, prev_ts = self.transitions[j]
                if ts - prev_ts < 60:
                    follows[to_state][prev_to] += 1
        prereqs = []
        for target, predecessors in follows.items():
            for prereq, count in predecessors.items():
                if prereq == target:
                    continue
                confidence = count / total_to[target] if total_to[target] > 0 else 0
                if confidence >= min_confidence and count >= 5:
                    prereqs.append({
                        "action": target,
                        "prerequisite": prereq,
                        "confidence": round(confidence, 3),
                        "occurrences": count,
                    })
        return prereqs



# ---------------------------------------------------------------------------
# Discovery Engine
# ---------------------------------------------------------------------------

# Parameter names that indicate geographic coordinates
GEO_PARAMS = {
    "position", "location", "coordinates", "gps",
    "lat_lon", "latlon", "geo", "pos"
}

# Parameter names that indicate latitude or longitude individually
LAT_PARAMS = {"latitude", "lat", "y"}
LON_PARAMS = {"longitude", "lon", "lng", "x"}

# Known unit hints for parameter naming
RATE_PARAMS = {
    "rpm", "rps", "frequency", "rate", "throughput",
    "requests", "calls", "actions"
}


class DiscoveryEngine:
    """
    Auto-discovers ODD boundaries by observing system behavior.

    Modes:
        DISCOVERY  — observing, collecting statistics, no enforcement
        CALIBRATING — enough data collected, computing boundaries
        ENFORCING  — boundaries locked, full enforcement active

    Usage:
        engine = DiscoveryEngine(min_samples=500, discovery_duration=300)
        engine.start()

        # In your system's main loop:
        engine.observe(speed=45.2, heading=180, position={"lat": 30.45, "lon": -97.85})

        # Engine auto-transitions to ENFORCING when ready
        if engine.state == "ENFORCING":
            boundaries = engine.get_boundaries()
    """

    # States
    DISCOVERY = "DISCOVERY"
    CALIBRATING = "CALIBRATING"
    ENFORCING = "ENFORCING"

    def __init__(
        self,
        min_samples: int = 200,
        discovery_duration: float = 300.0,       # seconds (5 min default)
        safety_margin: float = 0.10,              # 10% margin beyond observed ranges
        confidence_percentile: float = 99.0,      # use 99th percentile not raw max
        geo_buffer_meters: float = 50.0,          # buffer around observed geofence
        auto_transition: bool = True,             # auto-switch to enforcement
        on_boundaries_ready: callable = None,     # callback when boundaries are generated
    ):
        self.min_samples = min_samples
        self.discovery_duration = discovery_duration
        self.safety_margin = safety_margin
        self.confidence_percentile = confidence_percentile
        self.geo_buffer_meters = geo_buffer_meters
        self.auto_transition = auto_transition
        self.on_boundaries_ready = on_boundaries_ready

        self._state = self.DISCOVERY
        self._state_lock = threading.Lock()
        self._start_time: Optional[float] = None
        self._total_observations = 0

        # Observation stores keyed by parameter name
        self._numeric: Dict[str, NumericObservation] = {}
        self._geo: Dict[str, GeoObservation] = {}
        self._time_obs: TimeObservation = TimeObservation()
        self._rates: Dict[str, RateObservation] = {}
        self._states: Dict[str, StateObservation] = {}

        # Paired lat/lon tracking
        self._lat_buffer: Dict[str, float] = {}
        self._lon_buffer: Dict[str, float] = {}

        # Enhanced discovery stores
        self._deltas: Dict[str, DeltaObservation] = {}
        self._correlations: Dict[str, CorrelationObservation] = {}
        self._modals: Dict[str, ModalObservation] = {}
        self._sequences: SequenceObservation = SequenceObservation()
        self._prev_numeric_snapshot: Dict[str, float] = {}

        # Generated boundaries
        self._boundaries: List[Boundary] = []
        self._envelope_definition: Dict[str, Any] = {}

        self._lock = threading.Lock()

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    @property
    def state(self) -> str:
        return self._state

    @property
    def total_observations(self) -> int:
        return self._total_observations

    @property
    def elapsed_seconds(self) -> float:
        if self._start_time is None:
            return 0.0
        return time.time() - self._start_time

    @property
    def progress(self) -> float:
        """Discovery progress 0.0 to 1.0."""
        if self._state != self.DISCOVERY:
            return 1.0
        time_pct = min(self.elapsed_seconds / self.discovery_duration, 1.0) if self.discovery_duration > 0 else 1.0
        sample_pct = min(self._total_observations / self.min_samples, 1.0) if self.min_samples > 0 else 1.0
        return min(time_pct, sample_pct)

    def start(self):
        """Begin discovery phase."""
        self._start_time = time.time()
        self._state = self.DISCOVERY
        logger.info(
            f"Discovery started — observing for {self.discovery_duration}s "
            f"or {self.min_samples} samples"
        )

    def observe(self, **params):
        """
        Feed system parameters into the discovery engine.

        Call this on every action/tick/cycle of your autonomous system.
        The engine classifies each parameter automatically and tracks statistics.

        Examples:
            engine.observe(speed=45.2, heading=180.0)
            engine.observe(position={"lat": 30.45, "lon": -97.85})
            engine.observe(latitude=30.45, longitude=-97.85, altitude=150.0)
            engine.observe(mode="autonomous", speed=30.0)
        """
        if self._state != self.DISCOVERY:
            return

        with self._lock:
            self._total_observations += 1
            self._time_obs.record()

            # Classify and record each parameter
            for param, value in params.items():
                self._classify_and_record(param, value)

            # Check for paired lat/lon
            self._check_paired_geo(params)

            # Feed enhanced observation stores
            self._feed_enhanced_observations(params)

        # Check if discovery is complete
        if self.auto_transition and self._should_transition():
            self._transition_to_enforcement()

    def force_calibrate(self) -> List[Boundary]:
        """Force boundary generation from current observations, regardless of sample count."""
        logger.info(f"Force calibration with {self._total_observations} observations")
        self._generate_boundaries()
        return self._boundaries

    def get_boundaries(self) -> List[Boundary]:
        """Return generated boundaries (empty if still in DISCOVERY)."""
        return list(self._boundaries)

    def get_envelope_definition(self) -> Dict[str, Any]:
        """Return the auto-generated envelope definition for upload to Sentinel Authority."""
        return dict(self._envelope_definition)

    def get_discovery_stats(self) -> Dict[str, Any]:
        """Return current discovery statistics."""
        stats = {
            "state": self._state,
            "total_observations": self._total_observations,
            "elapsed_seconds": round(self.elapsed_seconds, 1),
            "progress": round(self.progress * 100, 1),
            "numeric_parameters": {},
            "geo_zones": {},
            "operating_hours": None,
            "rate_parameters": {},
            "state_parameters": {},
        }

        for name, obs in self._numeric.items():
            stats["numeric_parameters"][name] = {
                "count": obs.count,
                "min": round(obs.min_seen, 4),
                "max": round(obs.max_seen, 4),
                "mean": round(obs.mean, 4),
                "stdev": round(obs.stdev, 4),
            }

        for name, obs in self._geo.items():
            stats["geo_zones"][name] = {
                "points": obs.count,
                "centroid": obs.centroid,
                "max_radius_m": round(obs.max_radius_meters, 1),
                "bounds": {
                    "lat": [obs.lat_min, obs.lat_max],
                    "lon": [obs.lon_min, obs.lon_max],
                },
            }

        if self._time_obs.count > 0:
            start_h, end_h = self._time_obs.active_hours
            stats["operating_hours"] = {
                "observations": self._time_obs.count,
                "start_hour": start_h,
                "end_hour": end_h,
                "active_days": self._time_obs.active_days,
            }

        for name, obs in self._rates.items():
            stats["rate_parameters"][name] = {"observations": obs.count}

        for name, obs in self._states.items():
            stats["state_parameters"][name] = {
                "observations": obs.count,
                "unique_values": list(obs.unique_values),
            }

        
        # Enhanced discovery stats
        stats["delta_parameters"] = {}
        for name, obs in self._deltas.items():
            if obs.count > 0:
                stats["delta_parameters"][name] = {
                    "observations": obs.count,
                    "max_rate": round(obs.max_rate, 4),
                    "mean_rate": round(obs.mean_rate, 4),
                }
        stats["correlations"] = {}
        for name, obs in self._correlations.items():
            if obs.count > 10:
                corr = obs.correlation()
                if abs(corr) > 0.3:
                    stats["correlations"][name] = {
                        "observations": obs.count,
                        "correlation": round(corr, 4),
                    }
        stats["multimodal_parameters"] = {}
        for name, obs in self._modals.items():
            if obs.count > 30 and obs.is_multimodal:
                modes = obs.detect_modes()
                stats["multimodal_parameters"][name] = {
                    "modes": len(modes),
                    "centers": [round(m["center"], 2) for m in modes],
                }
        stats["sequence_prerequisites"] = self._sequences.detect_prerequisites()

        return stats

    # -----------------------------------------------------------------------
    # Classification
    # -----------------------------------------------------------------------


    def _feed_enhanced_observations(self, params: Dict[str, Any]):
        """Feed parameters into enhanced discovery stores."""
        numeric_snapshot = {}

        for param, value in params.items():
            param_lower = param.lower()
            if param_lower in GEO_PARAMS or param_lower in LAT_PARAMS or param_lower in LON_PARAMS:
                continue

            if isinstance(value, (int, float)) and not isinstance(value, bool):
                fval = float(value)
                numeric_snapshot[param_lower] = fval

                if param_lower not in self._deltas:
                    self._deltas[param_lower] = DeltaObservation()
                self._deltas[param_lower].record(fval)

                if param_lower not in self._modals:
                    self._modals[param_lower] = ModalObservation()
                self._modals[param_lower].record(fval)

        # Cross-parameter correlation (all numeric pairs)
        numeric_keys = sorted(numeric_snapshot.keys())
        for i in range(len(numeric_keys)):
            for j in range(i + 1, len(numeric_keys)):
                pair_key = f"{numeric_keys[i]}__x__{numeric_keys[j]}"
                if pair_key not in self._correlations:
                    self._correlations[pair_key] = CorrelationObservation(
                        param_a=numeric_keys[i], param_b=numeric_keys[j]
                    )
                self._correlations[pair_key].record(
                    numeric_snapshot[numeric_keys[i]],
                    numeric_snapshot[numeric_keys[j]]
                )

        # Sequence tracking for categorical/state params
        state_snapshot = {}
        for param, value in params.items():
            if isinstance(value, str):
                state_snapshot[param.lower()] = value
            elif isinstance(value, bool):
                state_snapshot[param.lower()] = str(value)
        if state_snapshot:
            self._sequences.record_states(state_snapshot)

        self._prev_numeric_snapshot = numeric_snapshot

    def _classify_and_record(self, param: str, value: Any):
        """Classify a parameter by type and record observation."""
        param_lower = param.lower()

        # Check for position dict/tuple
        if param_lower in GEO_PARAMS:
            self._record_geo(param_lower, value)
            return

        # Check for individual lat/lon
        if param_lower in LAT_PARAMS:
            try:
                self._lat_buffer[param_lower] = float(value)
            except (TypeError, ValueError):
                pass
            return

        if param_lower in LON_PARAMS:
            try:
                self._lon_buffer[param_lower] = float(value)
            except (TypeError, ValueError):
                pass
            return

        # Check for rate-type parameter
        if param_lower in RATE_PARAMS:
            if param_lower not in self._rates:
                self._rates[param_lower] = RateObservation()
            self._rates[param_lower].record()
            return

        # Check numeric
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if param_lower not in self._numeric:
                self._numeric[param_lower] = NumericObservation()
            self._numeric[param_lower].record(float(value))
            return

        # Check string/categorical
        if isinstance(value, str):
            if param_lower not in self._states:
                self._states[param_lower] = StateObservation()
            self._states[param_lower].record(value)
            return

        # Check bool as state
        if isinstance(value, bool):
            if param_lower not in self._states:
                self._states[param_lower] = StateObservation()
            self._states[param_lower].record(value)
            return

        # Dict that's not geo — try to flatten
        if isinstance(value, dict):
            for k, v in value.items():
                self._classify_and_record(f"{param}.{k}", v)

    def _record_geo(self, param: str, value: Any):
        """Record a geographic position observation."""
        try:
            if isinstance(value, dict):
                lat = float(value.get("lat", value.get("latitude", 0)))
                lon = float(value.get("lon", value.get("lng", value.get("longitude", 0))))
            elif isinstance(value, (list, tuple)) and len(value) >= 2:
                lat, lon = float(value[0]), float(value[1])
            else:
                return

            if param not in self._geo:
                self._geo[param] = GeoObservation()
            self._geo[param].record(lat, lon)
        except (TypeError, ValueError, IndexError):
            pass

    def _check_paired_geo(self, params: Dict[str, Any]):
        """Check if lat and lon were provided separately and pair them."""
        lat_key = next((k for k in params if k.lower() in LAT_PARAMS), None)
        lon_key = next((k for k in params if k.lower() in LON_PARAMS), None)

        if lat_key and lon_key:
            try:
                lat = float(params[lat_key])
                lon = float(params[lon_key])
                geo_name = "position"
                if geo_name not in self._geo:
                    self._geo[geo_name] = GeoObservation()
                self._geo[geo_name].record(lat, lon)
            except (TypeError, ValueError):
                pass
        elif self._lat_buffer and self._lon_buffer:
            # Use buffered values from separate calls
            lat_val = next(iter(self._lat_buffer.values()))
            lon_val = next(iter(self._lon_buffer.values()))
            geo_name = "position"
            if geo_name not in self._geo:
                self._geo[geo_name] = GeoObservation()
            self._geo[geo_name].record(lat_val, lon_val)
            self._lat_buffer.clear()
            self._lon_buffer.clear()

    # -----------------------------------------------------------------------
    # Transition logic
    # -----------------------------------------------------------------------

    def _should_transition(self) -> bool:
        """Check if we have enough data to generate boundaries."""
        if self._total_observations < self.min_samples:
            return False
        if self.elapsed_seconds < self.discovery_duration:
            return False
        # Need at least some numeric or geo observations
        has_data = bool(self._numeric) or bool(self._geo) or bool(self._states)
        return has_data

    def _transition_to_enforcement(self):
        """Generate boundaries and switch to enforcement mode."""
        with self._state_lock:
            if self._state != self.DISCOVERY:
                return
            self._state = self.CALIBRATING

        logger.info(
            f"Discovery complete — {self._total_observations} observations "
            f"over {self.elapsed_seconds:.0f}s. Generating boundaries..."
        )

        self._generate_boundaries()

        with self._state_lock:
            self._state = self.ENFORCING

        logger.info(
            f"Enforcement active — {len(self._boundaries)} boundaries generated"
        )

        if self.on_boundaries_ready:
            try:
                self.on_boundaries_ready(self._boundaries, self._envelope_definition)
            except Exception as e:
                logger.warning(f"on_boundaries_ready callback failed: {e}")

    # -----------------------------------------------------------------------
    # Boundary generation
    # -----------------------------------------------------------------------

    def _generate_boundaries(self):
        """Generate all boundary types from collected observations."""
        self._boundaries.clear()
        envelope = {"boundaries": [], "generated_at": datetime.utcnow().isoformat()}

        # Numeric boundaries
        for param, obs in self._numeric.items():
            if obs.count < 5:
                continue
            boundary, spec = self._generate_numeric_boundary(param, obs)
            self._boundaries.append(boundary)
            envelope["boundaries"].append(spec)

        # Geo boundaries
        for param, obs in self._geo.items():
            if obs.count < 10:
                continue
            boundary, spec = self._generate_geo_boundary(param, obs)
            self._boundaries.append(boundary)
            envelope["boundaries"].append(spec)

        # Time boundary
        if self._time_obs.count >= 10:
            boundary, spec = self._generate_time_boundary()
            self._boundaries.append(boundary)
            envelope["boundaries"].append(spec)

        # Rate boundaries
        for param, obs in self._rates.items():
            if obs.count < 20:
                continue
            boundary, spec = self._generate_rate_boundary(param, obs)
            self._boundaries.append(boundary)
            envelope["boundaries"].append(spec)

        # State boundaries
        for param, obs in self._states.items():
            if obs.count < 5:
                continue
            boundary, spec = self._generate_state_boundary(param, obs)
            self._boundaries.append(boundary)
            envelope["boundaries"].append(spec)

        # Rate-of-change boundaries
        for param, obs in self._deltas.items():
            if obs.count < 20:
                continue
            spec = self._generate_delta_boundary(param, obs)
            if spec:
                envelope["boundaries"].append(spec)

        # Compound/conditional boundaries from correlations
        for pair_key, obs in self._correlations.items():
            if obs.count < 30:
                continue
            specs = self._generate_correlation_boundaries(obs)
            for spec in specs:
                envelope["boundaries"].append(spec)

        # Multi-modal boundaries
        for param, obs in self._modals.items():
            if obs.count < 50 or not obs.is_multimodal:
                continue
            spec = self._generate_modal_boundary(param, obs)
            if spec:
                envelope["boundaries"].append(spec)

        # Sequence/prerequisite boundaries
        prereqs = self._sequences.detect_prerequisites()
        for prereq in prereqs:
            spec = self._generate_sequence_boundary(prereq)
            envelope["boundaries"].append(spec)

        envelope["total_boundaries"] = len(self._boundaries)
        envelope["total_observations"] = self._total_observations
        envelope["discovery_duration_seconds"] = round(self.elapsed_seconds, 1)
        envelope["parameters_discovered"] = {
            "numeric": list(self._numeric.keys()),
            "geo": list(self._geo.keys()),
            "rate": list(self._rates.keys()),
            "state": list(self._states.keys()),
        }

        self._envelope_definition = envelope

    def _generate_numeric_boundary(
        self, param: str, obs: NumericObservation
    ) -> Tuple[NumericBoundary, Dict]:
        """Generate a numeric boundary from observations with safety margin."""
        # Use percentiles to exclude outliers
        low = obs.percentile(100.0 - self.confidence_percentile)
        high = obs.percentile(self.confidence_percentile)

        # Apply safety margin
        data_range = high - low if high > low else abs(obs.mean) * 0.01 or 1.0
        margin = data_range * self.safety_margin

        min_val = round(low - margin, 6)
        max_val = round(high + margin, 6)

        # Detect if parameter is naturally non-negative
        if obs.min_seen >= 0 and min_val < 0:
            min_val = 0.0

        # Infer unit from parameter name
        unit = self._infer_unit(param)

        boundary = NumericBoundary(
            name=f"auto_{param}",
            parameter=param,
            min_value=min_val,
            max_value=max_val,
            unit=unit,
            tolerance=round(margin * 0.1, 6),  # small additional tolerance
        )

        spec = boundary.to_dict()
        spec["discovery"] = {
            "samples": obs.count,
            "observed_min": round(obs.min_seen, 6),
            "observed_max": round(obs.max_seen, 6),
            "observed_mean": round(obs.mean, 6),
            "observed_stdev": round(obs.stdev, 6),
            "percentile_low": round(low, 6),
            "percentile_high": round(high, 6),
            "safety_margin": self.safety_margin,
        }

        logger.info(
            f"  Numeric: {param} → [{min_val}, {max_val}] {unit} "
            f"(observed {obs.min_seen:.2f}–{obs.max_seen:.2f}, "
            f"{obs.count} samples)"
        )

        return boundary, spec

    def _generate_geo_boundary(
        self, param: str, obs: GeoObservation
    ) -> Tuple[GeoBoundary, Dict]:
        """Generate a geofence boundary from observed positions."""
        centroid = obs.centroid
        max_radius = obs.max_radius_meters

        # Add buffer
        radius = max_radius + self.geo_buffer_meters

        # If operating area is small (< 500m), use circle
        # If large, use convex hull polygon
        if max_radius < 500 or obs.count < 50:
            boundary = GeoBoundary(
                name=f"auto_{param}_geofence",
                parameter=param,
                boundary_type="circle",
                center={"lat": centroid[0], "lon": centroid[1]},
                radius_meters=round(radius, 1),
            )
        else:
            hull = obs.convex_hull()
            # Expand hull points outward from centroid by buffer percentage
            expanded = []
            for lat, lon in hull:
                dlat = lat - centroid[0]
                dlon = lon - centroid[1]
                dist = math.sqrt(dlat ** 2 + dlon ** 2)
                if dist > 0:
                    scale = 1 + (self.geo_buffer_meters / (obs.max_radius_meters or 1))
                    expanded.append({
                        "lat": round(centroid[0] + dlat * scale, 8),
                        "lon": round(centroid[1] + dlon * scale, 8),
                    })
                else:
                    expanded.append({"lat": lat, "lon": lon})

            boundary = GeoBoundary(
                name=f"auto_{param}_geofence",
                parameter=param,
                boundary_type="polygon",
                coordinates=expanded,
            )

        spec = boundary.to_dict()
        spec["discovery"] = {
            "samples": obs.count,
            "centroid": {"lat": centroid[0], "lon": centroid[1]},
            "observed_radius_m": round(max_radius, 1),
            "buffer_m": self.geo_buffer_meters,
        }

        logger.info(
            f"  Geo: {param} → {boundary.boundary_type} "
            f"({obs.count} points, {max_radius:.0f}m observed, "
            f"{radius:.0f}m enforced)"
        )

        return boundary, spec

    def _generate_time_boundary(self) -> Tuple[TimeBoundary, Dict]:
        """Generate operating hours boundary from observed activity times."""
        start_h, end_h = self._time_obs.active_hours
        active_days = self._time_obs.active_days

        # Add 1-hour buffer on each side
        buffered_start = max(0, start_h - 1)
        buffered_end = min(23, end_h + 1)

        boundary = TimeBoundary(
            name="auto_operating_hours",
            parameter="timestamp",
            allowed_start=f"{buffered_start:02d}:00",
            allowed_end=f"{buffered_end:02d}:59",
            allowed_days=active_days,
        )

        spec = boundary.to_dict()
        spec["discovery"] = {
            "samples": self._time_obs.count,
            "observed_start_hour": start_h,
            "observed_end_hour": end_h,
            "buffer_hours": 1,
        }

        logger.info(
            f"  Time: operating hours {buffered_start:02d}:00–{buffered_end:02d}:59, "
            f"days {active_days}"
        )

        return boundary, spec

    def _generate_rate_boundary(
        self, param: str, obs: RateObservation
    ) -> Tuple[RateBoundary, Dict]:
        """Generate rate limit boundary from observed action frequency."""
        max_per_sec = obs.max_rate_per_second()
        max_per_min = obs.max_rate_per_minute()

        # Apply safety margin
        limit_sec = round(max_per_sec * (1 + self.safety_margin), 2) if max_per_sec > 0 else None
        limit_min = round(max_per_min * (1 + self.safety_margin), 0) if max_per_min > 0 else None

        boundary = RateBoundary(
            name=f"auto_{param}_rate",
            parameter=param,
            max_per_second=limit_sec,
            max_per_minute=limit_min,
        )

        spec = boundary.to_dict()
        spec["discovery"] = {
            "samples": obs.count,
            "observed_max_per_sec": max_per_sec,
            "observed_max_per_min": max_per_min,
        }

        logger.info(
            f"  Rate: {param} → max {limit_sec}/sec, {limit_min}/min"
        )

        return boundary, spec

    def _generate_state_boundary(
        self, param: str, obs: StateObservation
    ) -> Tuple[StateBoundary, Dict]:
        """Generate state boundary from observed categorical values."""
        allowed = list(obs.unique_values)

        boundary = StateBoundary(
            name=f"auto_{param}_states",
            parameter=param,
            allowed_values=allowed,
        )

        spec = boundary.to_dict()
        spec["discovery"] = {
            "samples": obs.count,
            "unique_count": len(allowed),
        }

        logger.info(
            f"  State: {param} → allowed {allowed} "
            f"({obs.count} observations)"
        )

        return boundary, spec

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _infer_unit(param: str) -> str:
        """Infer measurement unit from parameter name."""
        param_lower = param.lower()
        units = {
            "speed": "m/s", "velocity": "m/s",
            "acceleration": "m/s²", "accel": "m/s²",
            "temperature": "°C", "temp": "°C",
            "pressure": "Pa", "altitude": "m", "height": "m",
            "distance": "m", "range": "m", "depth": "m",
            "angle": "°", "heading": "°", "bearing": "°",
            "yaw": "°", "pitch": "°", "roll": "°",
            "voltage": "V", "current": "A", "power": "W",
            "weight": "kg", "mass": "kg",
            "humidity": "%", "battery": "%", "fuel": "%",
        }
        for key, unit in units.items():
            if key in param_lower:
                return unit
        return ""

    def reset(self):
        """Reset discovery engine to start fresh."""
        with self._lock:
            self._state = self.DISCOVERY
            self._start_time = None
            self._total_observations = 0
            self._numeric.clear()
            self._geo.clear()
            self._time_obs = TimeObservation()
            self._rates.clear()
            self._states.clear()
            self._lat_buffer.clear()
            self._lon_buffer.clear()
            self._boundaries.clear()
            self._envelope_definition.clear()
            self._deltas.clear()
            self._correlations.clear()
            self._modals.clear()
            self._sequences = SequenceObservation()
            self._prev_numeric_snapshot.clear()
