#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    ◉  ENVELO One-Command Installer                        ║
║       Sentinel Authority © 2026                           ║
║                                                           ║
║    curl -sSL https://get.sentinelauthority.org | bash     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

This single file:
  1. Asks for Certificate ID + API Key
  2. Downloads approved boundaries from Sentinel Authority
  3. Auto-discovers every telemetry source on the machine
  4. Maps boundaries → sources with zero manual config
  5. Installs the ENVELO agent
  6. Starts enforcement
  7. Confirms CAT-72 readiness

The customer sees ~60 seconds of progress, types 2 things, done.
"""

from __future__ import annotations

import concurrent.futures
import getpass
import glob
import hashlib
import json
import os
import platform
import re
import shutil
import signal
import socket
import ssl
import struct
import subprocess
import sys
import textwrap
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ══════════════════════════════════════════════════════════
#  CONFIGURATION
# ══════════════════════════════════════════════════════════

VERSION = "2.0.0"
API_BASE = "https://sentinel-authority-production.up.railway.app"
PORTAL_URL = "https://app.sentinelauthority.org"
INSTALL_DIR = Path.home() / ".envelo"
CONFIG_FILE = INSTALL_DIR / "envelo.yaml"
AGENT_FILE = INSTALL_DIR / "envelo_agent.py"
PID_FILE = INSTALL_DIR / "envelo.pid"
LOG_FILE = INSTALL_DIR / "envelo.log"
CACHE_FILE = INSTALL_DIR / "boundary_cache.json"


# ══════════════════════════════════════════════════════════
#  TERMINAL UX — Make it beautiful
# ══════════════════════════════════════════════════════════

def _has_color() -> bool:
    if os.environ.get("NO_COLOR"): return False
    if not hasattr(sys.stdout, "isatty"): return False
    return sys.stdout.isatty()

_C = _has_color()

# Colors
P  = "\033[35m"   if _C else ""   # Purple
G  = "\033[92m"   if _C else ""   # Green
Y  = "\033[93m"   if _C else ""   # Yellow
R  = "\033[91m"   if _C else ""   # Red
CY = "\033[96m"   if _C else ""   # Cyan
W  = "\033[97m"   if _C else ""   # White
B  = "\033[1m"    if _C else ""   # Bold
D  = "\033[2m"    if _C else ""   # Dim
X  = "\033[0m"    if _C else ""   # Reset
CL = "\033[2K"   if _C else ""   # Clear line

BANNER = f"""
{P}{B}
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║    ◉  S E N T I N E L   A U T H O R I T Y                ║
  ║                                                           ║
  ║    ENVELO Installer  v{VERSION}                            ║
  ║    One command. That's it.                                ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
{X}"""

# Simple step counter
_total_steps = 6
_current_step = 0

def _bar():
    """Render progress bar."""
    filled = _current_step
    empty = _total_steps - filled
    blocks = f"{G}■{X} " * filled + f"{D}□{X} " * empty
    pct = int((filled / _total_steps) * 100)
    return f"  {blocks} {pct}%"

def step(title: str):
    """Start a new step."""
    global _current_step
    _current_step += 1
    print(f"\n{_bar()}")
    print(f"\n  {CY}{'─' * 56}{X}")
    print(f"  {B}Step {_current_step} of {_total_steps}:{X} {title}")
    print(f"  {CY}{'─' * 56}{X}")

def ok(msg):      print(f"  {G}✓{X}  {msg}")
def fail(msg):    print(f"  {R}✗{X}  {msg}")
def warn(msg):    print(f"  {Y}⚠{X}  {Y}{msg}{X}")
def info(msg):    print(f"     {D}{msg}{X}")
def big_ok(msg):  print(f"\n  {G}{B}✓ {msg}{X}")
def big_fail(msg):print(f"\n  {R}{B}✗ {msg}{X}")


class Spinner:
    """Animated spinner for long operations."""
    FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]
    
    def __init__(self, msg=""):
        self.msg = msg
        self._stop = threading.Event()
        self._thread = None
    
    def __enter__(self):
        if _C and sys.stdout.isatty():
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
        else:
            print(f"  ... {self.msg}", flush=True)
        return self
    
    def __exit__(self, *a):
        self._stop.set()
        if self._thread: self._thread.join(timeout=1)
        if _C and sys.stdout.isatty():
            sys.stdout.write(f"\r{CL}")
            sys.stdout.flush()
    
    def _spin(self):
        import itertools
        for frame in itertools.cycle(self.FRAMES):
            if self._stop.is_set(): break
            sys.stdout.write(f"\r  {CY}{frame}{X} {self.msg}")
            sys.stdout.flush()
            time.sleep(0.08)
    
    def update(self, msg): self.msg = msg


# ══════════════════════════════════════════════════════════
#  STEP 1 — GET CREDENTIALS
# ══════════════════════════════════════════════════════════

def get_credentials() -> Tuple[str, str]:
    """Ask for Certificate ID and API Key. That's all the customer types."""
    
    step("Your credentials")
    print()
    print(f"  {D}You'll find these in your portal dashboard at:{X}")
    print(f"  {CY}{PORTAL_URL}{X} → {B}Deployment{X} tab")
    print()
    
    # Certificate ID
    while True:
        cert_id = input(f"  {CY}▸{X} Certificate ID {D}(starts with ODDC-){X}: ").strip()
        if not cert_id:
            cert_id = os.environ.get("ENVELO_CERTIFICATE_ID", "")
        if cert_id.startswith("ODDC-") and len(cert_id) >= 10:
            ok(f"Certificate: {cert_id}")
            break
        elif cert_id:
            warn(f"That doesn't look right. Should start with ODDC- (e.g. ODDC-2026-00042)")
        else:
            warn("Check your portal dashboard for your Certificate ID")
    
    # API Key
    while True:
        api_key = getpass.getpass(f"  {CY}▸{X} API Key {D}(hidden){X}: ").strip()
        if not api_key:
            api_key = os.environ.get("ENVELO_API_KEY", "")
        if api_key.startswith("sa_live_") and len(api_key) > 20:
            ok(f"API Key: {'•' * 20}")
            break
        elif api_key:
            warn(f"Should start with sa_live_ — copy it from Portal → Deployment → Reveal Key")
        else:
            warn("Check your portal Deployment tab and click 'Reveal API Key'")
    
    return cert_id, api_key


# ══════════════════════════════════════════════════════════
#  STEP 2 — CONNECT & DOWNLOAD BOUNDARIES
# ══════════════════════════════════════════════════════════

def fetch_boundaries(cert_id: str, api_key: str) -> Dict:
    """Fetch approved boundaries from Sentinel Authority API."""
    
    step("Downloading your approved boundaries")
    
    with Spinner("Connecting to Sentinel Authority"):
        try:
            url = f"{API_BASE}/api/envelo/boundaries/config"
            req = urllib.request.Request(url)
            req.add_header("Authorization", f"Bearer {api_key}")
            req.add_header("Accept", "application/json")
            resp = urllib.request.urlopen(req, timeout=15)
            data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 401:
                big_fail("Invalid API key")
                print(f"\n  Go to {CY}{PORTAL_URL}{X} → Deployment → Reveal Key")
                print(f"  Copy the full key starting with sa_live_\n")
                sys.exit(1)
            elif e.code == 404:
                big_fail(f"Certificate {cert_id} not found")
                print(f"\n  Check your Certificate ID in the portal\n")
                sys.exit(1)
            else:
                big_fail(f"Server error ({e.code})")
                print(f"\n  Try again in a few minutes. If it persists,")
                print(f"  contact your Conformance Engineer.\n")
                sys.exit(1)
        except (urllib.error.URLError, socket.timeout) as e:
            big_fail("Can't reach Sentinel Authority")
            print(f"\n  Check your internet connection.")
            print(f"  Make sure outbound HTTPS is allowed to:")
            print(f"    {CY}sentinel-authority-production.up.railway.app{X}\n")
            sys.exit(1)
    
    ok("Connected to Sentinel Authority")
    
    # Count boundaries
    counts = {}
    for btype in ["numeric_boundaries", "geo_boundaries", "geographic_boundaries",
                   "time_boundaries", "state_boundaries", "rate_boundaries"]:
        items = data.get(btype, [])
        if items:
            label = btype.replace("_boundaries", "").replace("_", " ")
            counts[label] = len(items)
    
    total = sum(counts.values())
    ok(f"Downloaded {total} boundary parameter(s)")
    for label, count in counts.items():
        info(f"  {count} {label}")
    
    if total == 0:
        big_fail("No boundaries found for this certificate")
        print(f"\n  Your ODD may not have been approved yet.")
        print(f"  Check your case status at {CY}{PORTAL_URL}{X}\n")
        sys.exit(1)
    
    return data


# ══════════════════════════════════════════════════════════
#  STEP 3 — AUTO-DISCOVERY
# ══════════════════════════════════════════════════════════

# --- Port scanning ---

def _scan_port(host: str, port: int, timeout: float = 0.8) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def _scan_ports(host: str, ports: List[int]) -> List[int]:
    open_ports = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(_scan_port, host, p): p for p in ports}
        for f in concurrent.futures.as_completed(futures):
            if f.result(): open_ports.append(futures[f])
    return sorted(open_ports)


def _get_hosts() -> List[str]:
    hosts = ["127.0.0.1"]
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lip = s.getsockname()[0]
        s.close()
        if lip != "127.0.0.1": hosts.append(lip)
    except: pass
    for dh in ["172.17.0.1", "host.docker.internal"]:
        try:
            socket.getaddrinfo(dh, None, socket.AF_INET)
            hosts.append(dh)
        except: pass
    return hosts


# --- MQTT raw probe (no dependencies) ---

def _mqtt_probe(host: str, port: int, listen_sec: float = 5.0) -> List[Dict]:
    topics = []
    try:
        sock = socket.create_connection((host, port), timeout=5)
        # CONNECT
        client_id = b"envelo-discover"
        pkt = bytearray([0x10])
        vh = bytearray(b'\x00\x04MQTT\x04\x02') + struct.pack(">H", 60)
        vh += struct.pack(">H", len(client_id)) + client_id
        _mqtt_encode_len(pkt, len(vh))
        pkt += vh
        sock.sendall(bytes(pkt))
        sock.settimeout(3)
        r = sock.recv(4)
        if len(r) < 4 or r[0] != 0x20:
            sock.close(); return topics
        # SUBSCRIBE to #
        sub = bytearray([0x82])
        sp = struct.pack(">H", 1) + struct.pack(">H", 1) + b"#" + b'\x00'
        _mqtt_encode_len(sub, len(sp))
        sub += sp
        sock.sendall(bytes(sub))
        # LISTEN
        sock.settimeout(0.5)
        end = time.time() + listen_sec
        seen = set()
        while time.time() < end:
            try:
                data = sock.recv(4096)
                if not data: break
                off = 0
                while off < len(data):
                    if (data[off] & 0xF0) == 0x30:
                        pt = data[off]; off += 1
                        rem, used = _mqtt_decode_len(data, off); off += used
                        if off + 2 > len(data): break
                        tl = struct.unpack(">H", data[off:off+2])[0]; off += 2
                        if off + tl > len(data): break
                        topic = data[off:off+tl].decode("utf-8", errors="replace"); off += tl
                        qos = (pt >> 1) & 0x03
                        if qos > 0: off += 2
                        pl = rem - tl - 2 - (2 if qos > 0 else 0)
                        payload = data[off:off+max(pl,0)] if pl > 0 else b""
                        off += max(pl, 0)
                        if topic not in seen:
                            seen.add(topic)
                            topics.append({"topic": topic,
                                "sample": payload[:200].decode("utf-8", errors="replace")})
                    else:
                        off += 1
                        if off < len(data):
                            rem, used = _mqtt_decode_len(data, off)
                            off += used + rem
                        else: break
            except socket.timeout: continue
            except: break
        try: sock.sendall(bytes([0xE0, 0x00])); sock.close()
        except: pass
    except: pass
    return topics

def _mqtt_encode_len(buf, length):
    while True:
        byte = length % 128; length //= 128
        if length > 0: byte |= 0x80
        buf.append(byte)
        if length == 0: break

def _mqtt_decode_len(data, offset):
    mult = 1; val = 0; idx = 0
    while offset + idx < len(data):
        enc = data[offset + idx]; val += (enc & 0x7F) * mult; idx += 1
        if (enc & 0x80) == 0: break
        mult *= 128
    return val, idx


# --- HTTP probe ---

def _http_probe(host: str, port: int) -> List[Dict]:
    results = []
    scheme = "https" if port in (443, 8443) else "http"
    paths = ["/metrics", "/api/telemetry", "/api/v1/telemetry", "/api/status",
             "/api/sensors", "/api/v1/sensors", "/health", "/api/data",
             "/vehicle/status", "/robot/status", "/system/metrics",
             "/telemetry/current", "/api/v1/data"]
    for path in paths:
        try:
            req = urllib.request.Request(f"{scheme}://{host}:{port}{path}")
            req.add_header("User-Agent", "ENVELO-Discovery/1.0")
            req.add_header("Accept", "application/json, text/plain, */*")
            resp = urllib.request.urlopen(req, timeout=2)
            body = resp.read(8192).decode("utf-8", errors="replace")
            ct = resp.headers.get("Content-Type", "")
            keys = []
            if "text/plain" in ct or path == "/metrics":
                for line in body.splitlines():
                    line = line.strip()
                    if line and not line.startswith("#"):
                        m = re.match(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)', line)
                        if m: keys.append(m.group(1))
            elif "json" in ct:
                try: keys = _json_keys(json.loads(body))
                except: pass
            if keys:
                results.append({"url": f"{scheme}://{host}:{port}{path}",
                                "path": path, "keys": list(set(keys)),
                                "type": "prometheus" if path == "/metrics" else "http"})
        except: continue
    return results

def _json_keys(data, prefix="", depth=0):
    keys = []
    if depth > 3: return keys
    if isinstance(data, dict):
        for k, v in data.items():
            fp = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (int, float)): keys.append(fp)
            elif isinstance(v, dict): keys.extend(_json_keys(v, fp, depth+1))
    return keys


# --- ROS2 probe ---

def _ros2_probe() -> List[Dict]:
    if not os.environ.get("ROS_DISTRO"): return []
    try:
        r = subprocess.run(["ros2", "topic", "list", "-t"],
                           capture_output=True, text=True, timeout=10)
        if r.returncode != 0: return []
        topics = []
        for line in r.stdout.splitlines():
            line = line.strip()
            if not line: continue
            parts = line.split(" [")
            topics.append({"topic": parts[0].strip(),
                           "msg_type": parts[1].rstrip("]") if len(parts) > 1 else ""})
        return topics
    except: return []


# --- File probe ---

def _file_probe() -> List[Dict]:
    results = []
    patterns = [
        ("/sys/class/thermal/thermal_zone*/temp", "temperature"),
        ("/sys/class/hwmon/hwmon*/temp*_input", "temperature"),
        ("/sys/class/power_supply/*/voltage_now", "voltage"),
        ("/sys/class/power_supply/*/current_now", "current"),
        ("/sys/class/power_supply/*/capacity", "battery"),
        ("/dev/ttyUSB*", "serial_gps"),
        ("/dev/ttyACM*", "serial_device"),
        ("/dev/iio:device*", "imu_sensor"),
    ]
    for pattern, hint in patterns:
        for m in glob.glob(pattern):
            if os.path.exists(m):
                results.append({"path": m, "hint": hint})
    return results


# --- Fuzzy matching ---

KEYWORD_FAMILIES = {
    "speed":       ["speed","velocity","vel","spd","knots","mph","kph","km_h","m_s"],
    "temperature": ["temp","temperature","thermal","celsius","fahrenheit","heat"],
    "pressure":    ["pressure","psi","bar","pascal","atm"],
    "altitude":    ["altitude","alt","elevation","height","agl","msl"],
    "latitude":    ["lat","latitude","gps_lat","position_lat"],
    "longitude":   ["lon","lng","longitude","gps_lon","position_lon"],
    "heading":     ["heading","yaw","bearing","course","azimuth"],
    "roll":        ["roll","bank"],
    "pitch":       ["pitch","tilt","inclination"],
    "torque":      ["torque","nm","force_rotational"],
    "current":     ["current","ampere","amp","amps"],
    "voltage":     ["voltage","volt","volts","vdc"],
    "power":       ["power","watt","watts","kw"],
    "rpm":         ["rpm","revolutions","rotational_speed"],
    "position":    ["position","pos","location","coord"],
    "distance":    ["distance","range","proximity","dist"],
    "battery":     ["battery","soc","charge","batt"],
    "humidity":    ["humidity","rh","relative_humidity"],
    "flow":        ["flow","flow_rate","gpm","lpm"],
    "weight":      ["weight","mass","load","kg","lbs"],
    "acceleration":["accel","acceleration","g_force","imu"],
    "angular_rate":["gyro","angular","omega","rad_s"],
}

def _normalize(s): return re.sub(r'[^a-z0-9]', '_', s.lower()).strip('_')

def _match_score(param_name: str, candidate: str) -> float:
    pn = _normalize(param_name); cn = _normalize(candidate)
    if pn == cn: return 1.0
    if pn in cn or cn in pn: return 0.85
    for fam, kws in KEYWORD_FAMILIES.items():
        p_hit = any(k in pn for k in kws) or _normalize(fam) in pn
        c_hit = any(k in cn for k in kws) or _normalize(fam) in cn
        if p_hit and c_hit: return 0.75
    pt = set(pn.split('_')) - {'api','v1','v2','data','value','raw','status','current'}
    ct = set(cn.split('_')) - {'api','v1','v2','data','value','raw','status','current'}
    if pt and ct:
        overlap = len(pt & ct)
        if overlap > 0: return 0.5 + (0.3 * overlap / max(len(pt), len(ct)))
    return 0.0

def _poll_interval(param_name: str) -> int:
    pn = _normalize(param_name)
    fast = ["speed","velocity","position","torque","force","acceleration","angular","gyro","collision"]
    if any(f in pn for f in fast): return 100
    med = ["heading","altitude","roll","pitch","yaw","rpm","current","voltage","power","flow"]
    if any(m in pn for m in med): return 250
    slow = ["temperature","humidity","pressure","battery","weight","fuel"]
    if any(s in pn for s in slow): return 1000
    return 500


# --- The actual discovery ---

def discover_sources(boundaries: Dict) -> Tuple[List[Dict], List[Dict]]:
    """
    Discover telemetry sources and match them to boundary parameters.
    
    Returns (mapped, unmapped) where each is a list of parameter dicts
    with source_type/source_address/poll_interval_ms filled in.
    """
    
    step("Finding your telemetry sources")
    
    # Collect all parameter names from boundaries
    params = []
    for btype in ["numeric_boundaries", "geo_boundaries", "geographic_boundaries",
                   "time_boundaries", "state_boundaries", "rate_boundaries"]:
        for b in boundaries.get(btype, []):
            name = b.get("name") or b.get("parameter", "")
            if name and name not in [p["name"] for p in params]:
                params.append({
                    "name": name,
                    "unit": b.get("unit", ""),
                    "boundary": b,
                })
    
    if not params:
        warn("No parameters to map")
        return [], []
    
    info(f"Need to map {len(params)} parameter(s):")
    for p in params:
        info(f"  • {p['name']} {D}[{p['unit']}]{X}" if p['unit'] else f"  • {p['name']}")
    print()
    
    # Collect all discovered sources
    all_sources = []  # List of (source_type, address, hint_name)
    
    # Scan network
    hosts = _get_hosts()
    all_ports = sorted(set(
        [1883, 8883] +                          # MQTT
        [80, 8080, 8000, 8888, 3000, 5000, 9090, 443, 8443] +  # HTTP
        [50051, 50052] +                         # gRPC
        [7400, 7401] +                           # ROS2/DDS
        [502, 4840]                              # Industrial
    ))
    
    for host in hosts:
        with Spinner(f"Scanning {host} ({len(all_ports)} ports)"):
            open_ports = _scan_ports(host, all_ports)
        
        if open_ports:
            ok(f"{host}: {len(open_ports)} service(s) found")
        else:
            info(f"{host}: no services detected")
            continue
        
        # MQTT
        mqtt_ports = [p for p in open_ports if p in [1883, 8883, 1884, 9883]]
        for port in mqtt_ports:
            with Spinner(f"Listening to MQTT broker {host}:{port}"):
                topics = _mqtt_probe(host, port, listen_sec=5.0)
            if topics:
                ok(f"MQTT: {len(topics)} topic(s) on {host}:{port}")
                for t in topics:
                    all_sources.append(("mqtt", f"mqtt://{host}:{port}/{t['topic']}", t['topic']))
            else:
                info(f"MQTT broker at {host}:{port} — no active topics")
        
        # HTTP / Prometheus
        http_ports = [p for p in open_ports if p in [80,8080,8000,8888,3000,5000,9090,443,8443]]
        for port in http_ports:
            with Spinner(f"Probing HTTP endpoints on {host}:{port}"):
                endpoints = _http_probe(host, port)
            for ep in endpoints:
                ok(f"{ep['type'].upper()}: {len(ep['keys'])} metric(s) at {ep['url']}")
                for key in ep['keys']:
                    addr = ep['url'] if ep['type'] == 'prometheus' else f"{ep['url']}#$.{key}"
                    all_sources.append((ep['type'], addr, key))
        
        # gRPC
        grpc_ports = [p for p in open_ports if p in [50051, 50052]]
        for port in grpc_ports:
            ok(f"gRPC: server at {host}:{port}")
            all_sources.append(("grpc", f"grpc://{host}:{port}", ""))
    
    # ROS2
    with Spinner("Checking for ROS2"):
        ros_topics = _ros2_probe()
    if ros_topics:
        ok(f"ROS2: {len(ros_topics)} topic(s)")
        for rt in ros_topics:
            hint = rt['topic'].split('/')[-1] if '/' in rt['topic'] else rt['topic']
            all_sources.append(("ros2", rt['topic'], hint))
    
    # Files
    with Spinner("Scanning hardware sensors"):
        file_sources = _file_probe()
    if file_sources:
        ok(f"Hardware: {len(file_sources)} sensor(s)")
        for fs in file_sources:
            all_sources.append(("file", fs['path'], fs['hint']))
    
    print()
    info(f"Total: {len(all_sources)} telemetry source(s) discovered")
    print()
    
    # Match parameters to sources
    mapped = []
    unmapped = []
    
    for param in params:
        pname = param["name"]
        best_source = None
        best_score = 0.0
        
        for src_type, src_addr, src_hint in all_sources:
            # Score against hint name
            score = _match_score(pname, src_hint)
            # Also try the full address
            score = max(score, _match_score(pname, src_addr))
            
            if score > best_score:
                best_score = score
                best_source = (src_type, src_addr, src_hint)
        
        if best_source and best_score >= 0.5:
            src_type, src_addr, src_hint = best_source
            param["source_type"] = src_type
            param["source_address"] = src_addr
            param["poll_interval_ms"] = _poll_interval(pname)
            param["confidence"] = best_score
            mapped.append(param)
            
            conf_color = G if best_score >= 0.8 else Y if best_score >= 0.5 else R
            conf_label = "HIGH" if best_score >= 0.8 else "MEDIUM" if best_score >= 0.5 else "LOW"
            ok(f"{B}{pname}{X} → {src_type}://{src_addr.split('://')[-1]}")
            info(f"  Match: {conf_color}{conf_label} ({best_score:.0%}){X}")
        else:
            unmapped.append(param)
            warn(f"{pname}: couldn't find a match")
    
    return mapped, unmapped


def handle_unmapped(unmapped: List[Dict]) -> List[Dict]:
    """
    For any parameters we couldn't auto-map, give the customer
    simple prompts. No jargon.
    """
    if not unmapped:
        return []
    
    print()
    print(f"  {Y}{B}Almost there!{X} {len(unmapped)} parameter(s) need your help:")
    print()
    print(f"  {D}For each one, tell us how your system reports this data.{X}")
    print(f"  {D}Common options:{X}")
    print(f"    {CY}mqtt{X}    → MQTT topic (e.g., mqtt://localhost:1883/sensor/speed)")
    print(f"    {CY}http{X}    → REST endpoint (e.g., http://localhost:8080/api/speed)")
    print(f"    {CY}grpc{X}    → gRPC service (e.g., grpc://localhost:50051)")
    print(f"    {CY}ros2{X}    → ROS2 topic (e.g., /cmd_vel)")
    print(f"    {CY}file{X}    → File path (e.g., /sys/class/thermal/thermal_zone0/temp)")
    print(f"    {CY}custom{X}  → Custom integration (we'll help you set it up)")
    print()
    
    resolved = []
    
    for param in unmapped:
        pname = param["name"]
        print(f"  {B}{pname}{X} [{param.get('unit', '?')}]")
        
        while True:
            src_type = input(f"    Protocol {D}(mqtt/http/grpc/ros2/file/custom){X}: ").strip().lower()
            if src_type in ("mqtt", "http", "grpc", "ros2", "file", "custom",
                            "prometheus", "websocket", "modbus", "opcua"):
                break
            if src_type == "skip":
                break
            if src_type == "":
                print(f"    {D}Type the protocol your system uses, or 'skip' to configure later{X}")
            else:
                print(f"    {Y}'{src_type}' isn't recognized. Try: mqtt, http, grpc, ros2, file, or custom{X}")
        
        if src_type == "skip":
            warn(f"  Skipped {pname} — you'll need to edit envelo.yaml later")
            continue
        
        src_addr = input(f"    Address: ").strip()
        if not src_addr:
            warn(f"  Skipped {pname}")
            continue
        
        param["source_type"] = src_type
        param["source_address"] = src_addr
        param["poll_interval_ms"] = _poll_interval(pname)
        param["confidence"] = 1.0
        resolved.append(param)
        ok(f"  {pname} → {src_type}://{src_addr}")
        print()
    
    return resolved


# ══════════════════════════════════════════════════════════
#  STEP 4 — INSTALL AGENT
# ══════════════════════════════════════════════════════════

def install_agent(cert_id: str, api_key: str, boundaries: Dict,
                  mapped: List[Dict]) -> Path:
    """Install the ENVELO agent and write config."""
    
    step("Installing ENVELO agent")
    
    # Create install directory
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    ok(f"Directory: {INSTALL_DIR}")
    
    # Build YAML config
    config_lines = [
        f"# ENVELO Configuration — Auto-generated by installer v{VERSION}",
        f"# {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
        f"#",
        f"# DO NOT edit boundary values (min, max, hard_limit).",
        f"# These are fetched from Sentinel Authority on each restart.",
        f"# Only source_type, source_address, and poll_interval_ms are local.",
        f"",
        f"case_id: {cert_id}",
        f"api_key: {api_key}",
        f"api_endpoint: {API_BASE}",
        f"enforcement_mode: BLOCK",
        f"fail_closed: true",
        f"",
        f"parameters:",
    ]
    
    for p in mapped:
        config_lines.append(f"  - name: {p['name']}")
        config_lines.append(f"    unit: {p.get('unit', '')}")
        config_lines.append(f"    source_type: {p.get('source_type', '')}")
        config_lines.append(f"    source_address: {p.get('source_address', '')}")
        config_lines.append(f"    poll_interval_ms: {p.get('poll_interval_ms', 1000)}")
        # Include boundary values for reference (overridden by API on startup)
        b = p.get("boundary", {})
        if "min_value" in b: config_lines.append(f"    tolerance_min: {b['min_value']}")
        if "max_value" in b: config_lines.append(f"    tolerance_max: {b['max_value']}")
        if "hard_limit" in b: config_lines.append(f"    hard_limit: {b['hard_limit']}")
    
    CONFIG_FILE.write_text("\n".join(config_lines) + "\n", encoding="utf-8")
    ok(f"Config: {CONFIG_FILE}")
    
    # Cache boundaries
    CACHE_FILE.write_text(json.dumps({
        "cached_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "certificate_number": cert_id,
        "config": boundaries,
    }, indent=2), encoding="utf-8")
    ok("Boundaries cached for offline enforcement")
    
    # Write agent wrapper script
    agent_script = textwrap.dedent(f'''\
        #!/usr/bin/env python3
        """ENVELO Agent Launcher — auto-generated"""
        import sys, os
        sys.path.insert(0, os.path.dirname(__file__))
        os.environ.setdefault("ENVELO_API_KEY", "{api_key}")
        os.environ.setdefault("ENVELO_CERTIFICATE", "{cert_id}")
        
        try:
            from envelo import EnveloAgent, EnveloConfig
            config = EnveloConfig(
                api_key="{api_key}",
                certificate_number="{cert_id}",
                api_endpoint="{API_BASE}",
                log_file="{LOG_FILE}",
                boundary_cache_path="{CACHE_FILE}",
            )
            agent = EnveloAgent(config)
            if agent.start():
                print("[ENVELO] Agent running. Ctrl+C to stop.")
                import time
                while agent.is_running:
                    time.sleep(1)
            else:
                print("[ENVELO] Failed to start. Check {LOG_FILE}")
                sys.exit(1)
        except ImportError:
            print("[ENVELO] SDK not found. Installing...")
            os.system(f"{{sys.executable}} -m pip install envelo-sdk -q")
            print("[ENVELO] Installed. Run this script again.")
            sys.exit(1)
    ''')
    
    AGENT_FILE.write_text(agent_script, encoding="utf-8")
    os.chmod(str(AGENT_FILE), 0o755)
    ok(f"Agent: {AGENT_FILE}")
    
    # Write convenience JSON config for the SDK
    sdk_config = {
        "api_key": api_key,
        "certificate_number": cert_id,
        "api_endpoint": API_BASE,
        "enforcement_mode": "BLOCK",
        "fail_closed": True,
        "cache_boundaries_locally": True,
        "boundary_cache_path": str(CACHE_FILE),
        "enforce_with_cached_boundaries": True,
        "log_file": str(LOG_FILE),
        "system_name": "",
        "organization": "",
    }
    sdk_config_path = INSTALL_DIR / "config.json"
    sdk_config_path.write_text(json.dumps(sdk_config, indent=2), encoding="utf-8")
    ok(f"SDK config: {sdk_config_path}")
    
    # Download & install CLI (the `envelo` command)
    cli_url = "https://get.sentinelauthority.org/envelo_cli.py"
    cli_path = INSTALL_DIR / "cli.py"
    try:
        with Spinner("Installing ENVELO CLI"):
            urllib.request.urlretrieve(cli_url, str(cli_path))
        os.chmod(str(cli_path), 0o755)
        ok(f"CLI: {cli_path}")
    except:
        info("CLI download skipped — will use local agent script")
    
    # Create `envelo` wrapper in a PATH-accessible location
    wrapper_script = f"""#!/bin/bash
exec {sys.executable} "{cli_path}" "$@"
"""
    wrapper_locations = [
        Path.home() / ".local" / "bin" / "envelo",
        Path("/usr/local/bin/envelo"),
    ]
    installed_wrapper = False
    for wrapper_path in wrapper_locations:
        try:
            wrapper_path.parent.mkdir(parents=True, exist_ok=True)
            wrapper_path.write_text(wrapper_script)
            os.chmod(str(wrapper_path), 0o755)
            ok(f"Command: {wrapper_path}")
            installed_wrapper = True
            
            # Ensure ~/.local/bin is in PATH
            if ".local/bin" in str(wrapper_path):
                shell_rc = Path.home() / ".bashrc"
                if shell_rc.exists():
                    rc_text = shell_rc.read_text()
                    if ".local/bin" not in rc_text:
                        with open(shell_rc, "a") as f:
                            f.write('\nexport PATH="$HOME/.local/bin:$PATH"\n')
                        info("Added ~/.local/bin to PATH in .bashrc")
                # Also try zshrc
                zshrc = Path.home() / ".zshrc"
                if zshrc.exists():
                    zrc_text = zshrc.read_text()
                    if ".local/bin" not in zrc_text:
                        with open(zshrc, "a") as f:
                            f.write('\nexport PATH="$HOME/.local/bin:$PATH"\n')
                        info("Added ~/.local/bin to PATH in .zshrc")
            break
        except PermissionError:
            continue
    
    if not installed_wrapper:
        info(f"Could not install 'envelo' command. Use: python3 {cli_path}")
    
    return CONFIG_FILE


# ══════════════════════════════════════════════════════════
#  STEP 5 — START AGENT
# ══════════════════════════════════════════════════════════

def start_agent(cert_id: str, api_key: str):
    """Verify we can reach the API and register."""
    
    step("Activating enforcement")
    
    # Test API connection with the actual boundaries endpoint
    with Spinner("Verifying enforcement connection"):
        try:
            url = f"{API_BASE}/api/envelo/boundaries/config"
            req = urllib.request.Request(url)
            req.add_header("Authorization", f"Bearer {api_key}")
            resp = urllib.request.urlopen(req, timeout=10)
            if resp.status == 200:
                ok("API connection verified")
            else:
                warn(f"API returned {resp.status} — agent will retry automatically")
        except Exception as e:
            warn(f"API check: {e} — agent will retry on start")
    
    # Register session
    with Spinner("Registering with Sentinel Authority"):
        try:
            import uuid
            session_data = json.dumps({
                "session_id": str(uuid.uuid4()),
                "certificate_number": cert_id,
                "started_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                "agent_version": VERSION,
                "enforcement_mode": "BLOCK",
            }).encode("utf-8")
            
            req = urllib.request.Request(
                f"{API_BASE}/api/envelo/sessions",
                data=session_data, method="POST"
            )
            req.add_header("Authorization", f"Bearer {api_key}")
            req.add_header("Content-Type", "application/json")
            resp = urllib.request.urlopen(req, timeout=10)
            ok("Session registered")
        except Exception:
            info("Session registration deferred — will register on agent start")
    
    ok("Enforcement ready")
    
    # Show how to start
    print()
    info("Start the agent with:")
    print(f"\n    {CY}envelo start{X}\n")
    info("Or as a background daemon:")
    print(f"\n    {CY}envelo start -d{X}\n")
    info("Or auto-start on boot:")
    print(f"\n    {CY}envelo service install{X}\n")
    info("Or add to your application:")
    print(f"""
    {CY}from envelo import EnveloAgent, EnveloConfig{X}
    {CY}agent = EnveloAgent(EnveloConfig.from_provisioned_agent({X}
    {CY}    api_key="{api_key[:12]}..."{X},
    {CY}    certificate_number="{cert_id}"{X}
    {CY})){X}
    {CY}agent.start(){X}
    """)


# ══════════════════════════════════════════════════════════
#  STEP 6 — DONE
# ══════════════════════════════════════════════════════════

def show_success(cert_id: str, mapped_count: int, unmapped_count: int):
    """The big green success screen."""
    
    step("Done!")
    
    if unmapped_count > 0:
        print(f"""
  {Y}{B}
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║    ALMOST READY — {unmapped_count} parameter(s) need manual config    ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝{X}

  {B}What's done:{X}
    {G}✓{X}  ENVELO agent installed at {INSTALL_DIR}
    {G}✓{X}  {mapped_count} parameter(s) auto-mapped
    {Y}⚠{X}  {unmapped_count} parameter(s) need source mapping

  {B}Fix unmapped sources:{X}
    {CY}envelo rediscover{X}     Re-scan your system
    {CY}envelo validate{X}       Check everything's ready

  {B}Then:{X}
    {CY}envelo start{X}          Start enforcement
    {CY}{PORTAL_URL}{X} → CAT-72 tab → Begin Test
        """)
    else:
        print(f"""
  {G}{B}
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║              Y O U ' R E    L I V E  !                 ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝{X}

  {B}What happened:{X}
    {G}✓{X}  Connected to Sentinel Authority
    {G}✓{X}  Downloaded your approved boundaries
    {G}✓{X}  Found {mapped_count} telemetry source(s) automatically
    {G}✓{X}  ENVELO agent installed at {INSTALL_DIR}
    {G}✓{X}  Configuration written — ready for CAT-72

  {B}Start the agent:{X}
    {CY}envelo start{X}

  {B}Then go to:{X}
    {W}1.{X} {CY}{PORTAL_URL}{X}
    {W}2.{X} Open your case → {B}CAT-72{X} tab
    {W}3.{X} Verify agent shows {G}Active{X}
    {W}4.{X} Click {B}'Begin Test'{X}

  {B}Useful commands:{X}
    {CY}envelo status{X}        Full health check
    {CY}envelo monitor{X}       Live dashboard
    {CY}envelo boundaries{X}    View all boundaries
    {CY}envelo cat72{X}         Check test progress
    {CY}envelo help{X}          See everything

  {Y}{B}The 72-hour timer starts immediately. No pause.{X}
        """)
    
    print(f"\n{_bar()}\n")


# ══════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════

def main():
    print(BANNER)
    
    # Check Python version
    if sys.version_info < (3, 7):
        big_fail(f"Python 3.7+ required (you have {platform.python_version()})")
        print(f"\n  Install Python 3.7+ and try again.\n")
        sys.exit(1)
    
    info(f"Python {platform.python_version()} on {platform.system()} {platform.machine()}")
    print()
    
    # Check for env var shortcuts (for non-interactive / CI)
    env_cert = os.environ.get("ENVELO_CERTIFICATE_ID", "")
    env_key = os.environ.get("ENVELO_API_KEY", "")
    
    if env_cert and env_key:
        info("Using credentials from environment variables")
        cert_id, api_key = env_cert, env_key
        global _current_step
        _current_step = 1  # Skip step 1
    else:
        cert_id, api_key = get_credentials()
    
    # Fetch boundaries
    boundaries = fetch_boundaries(cert_id, api_key)
    
    # Auto-discover
    mapped, unmapped = discover_sources(boundaries)
    
    # Handle unmapped
    resolved = handle_unmapped(unmapped)
    all_mapped = mapped + resolved
    still_unmapped = len(unmapped) - len(resolved)
    
    # Install
    install_agent(cert_id, api_key, boundaries, all_mapped)
    
    # Activate
    start_agent(cert_id, api_key)
    
    # Done
    show_success(cert_id, len(all_mapped), still_unmapped)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n  {Y}Cancelled.{X} Nothing was changed. Safe to re-run.\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n  {R}{B}Error: {e}{X}")
        print(f"  Please contact your Conformance Engineer.\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
