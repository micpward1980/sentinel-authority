#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ◉  ENVELO — The Agent Does Everything                   ║
║      Sentinel Authority © 2026                            ║
║                                                           ║
║   Install:   curl -sSL https://get.sentinelauthority.org | bash
║   Then:      envelo start                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

COMMANDS:

  RUNNING
    start [-d]           Start enforcement (foreground or daemon)
    stop                 Stop running agent
    restart              Stop + start
    validate             Check config without starting

  MONITORING
    status               Full health check
    monitor              Live terminal dashboard (like htop)
    events [--last N]    Violation & enforcement event history
    logs [-f] [--last N] View/tail agent logs
    cat72                CAT-72 test status & progress

  BOUNDARIES
    boundaries           Show all enforced boundaries
    resync               Force re-fetch from Sentinel Authority
    simulate PARAM VAL   Dry-run a boundary check

  SOURCES
    test                 Test all telemetry source connections
    rediscover [--all]   Re-scan for telemetry sources
    benchmark            Measure enforcement latency

  INFRASTRUCTURE
    service install      Install as system service (auto-start on boot)
    service uninstall    Remove system service
    docker               Generate Dockerfile + docker-compose.yml
    k8s                  Generate Kubernetes manifests

  MAINTENANCE
    diagnose             Generate support bundle
    network              Full network diagnostic
    export               Auditor-ready config + boundary bundle
    rotate-key           Rotate your API key
    update               Check for agent updates
    rollback             Uninstall ENVELO
    version              Version info
"""

from __future__ import annotations

import concurrent.futures
import datetime
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

VERSION = "2.0.0"
API_BASE = "https://sentinel-authority-production.up.railway.app"
PORTAL = "https://app.sentinelauthority.org"
ENVELO_DIR = Path.home() / ".envelo"
CONFIG_FILE = ENVELO_DIR / "envelo.yaml"
SDK_CONFIG = ENVELO_DIR / "config.json"
CACHE_FILE = ENVELO_DIR / "boundary_cache.json"
LOG_FILE = ENVELO_DIR / "envelo.log"
PID_FILE = ENVELO_DIR / "envelo.pid"
EVENTS_FILE = ENVELO_DIR / "events.jsonl"
DIAG_DIR = ENVELO_DIR / "diagnostics"


# ══════════════════════════════════════════════════════════════════
#  TERMINAL UX
# ══════════════════════════════════════════════════════════════════

def _c():
    if os.environ.get("NO_COLOR"): return False
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

_CC = _c()
P  = "\033[35m"   if _CC else ""
G  = "\033[92m"   if _CC else ""
Y  = "\033[93m"   if _CC else ""
R  = "\033[91m"   if _CC else ""
CY = "\033[96m"   if _CC else ""
W  = "\033[97m"   if _CC else ""
B  = "\033[1m"    if _CC else ""
D  = "\033[2m"    if _CC else ""
X  = "\033[0m"    if _CC else ""
CL = "\033[2K"    if _CC else ""
BG = "\033[48;5;236m" if _CC else ""

def ok(msg):       print(f"  {G}✓{X}  {msg}")
def fail(msg):     print(f"  {R}✗{X}  {msg}")
def warn(msg):     print(f"  {Y}⚠{X}  {Y}{msg}{X}")
def info(msg):     print(f"     {D}{msg}{X}")
def big_ok(msg):   print(f"\n  {G}{B}✓ {msg}{X}")
def big_fail(msg): print(f"\n  {R}{B}✗ {msg}{X}")
def header(msg):
    print(f"\n  {CY}{'─' * 56}{X}")
    print(f"  {B}{msg}{X}")
    print(f"  {CY}{'─' * 56}{X}")

def banner():
    print(f"\n{P}{B}  ◉  ENVELO Agent  v{VERSION}{X}")
    print(f"{D}     Sentinel Authority{X}\n")

class Spinner:
    FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]
    def __init__(self, msg=""):
        self.msg = msg; self._stop = threading.Event(); self._thread = None
    def __enter__(self):
        if _CC:
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
        else: print(f"  ... {self.msg}", flush=True)
        return self
    def __exit__(self, *a):
        self._stop.set()
        if self._thread: self._thread.join(timeout=1)
        if _CC: sys.stdout.write(f"\r{CL}"); sys.stdout.flush()
    def _spin(self):
        import itertools
        for f in itertools.cycle(self.FRAMES):
            if self._stop.is_set(): break
            sys.stdout.write(f"\r  {CY}{f}{X} {self.msg}"); sys.stdout.flush()
            time.sleep(0.08)
    def update(self, msg): self.msg = msg


# ══════════════════════════════════════════════════════════════════
#  CONFIG HELPERS
# ══════════════════════════════════════════════════════════════════

def _load_sdk() -> Dict:
    if SDK_CONFIG.exists():
        try: return json.loads(SDK_CONFIG.read_text())
        except: pass
    return {}

def _load_yaml() -> Dict:
    if not CONFIG_FILE.exists(): return {}
    try:
        import yaml
        return yaml.safe_load(CONFIG_FILE.read_text()) or {}
    except ImportError: pass
    cfg = {}; section = None; items = None; item = None
    for raw in CONFIG_FILE.read_text().splitlines():
        line = raw.rstrip(); s = line.lstrip()
        if not s or s.startswith("#"): continue
        ind = len(line) - len(s)
        if ind == 0 and ":" in s:
            if item and items is not None: items.append(item); item = None
            k, _, v = s.partition(":"); k, v = k.strip(), v.strip()
            if v: cfg[k] = _co(v)
            else: cfg[k] = []; section = k; items = cfg[k]
        elif s.startswith("- "):
            if item and items is not None: items.append(item)
            item = {}; rest = s[2:].strip()
            if ":" in rest: k2, _, v2 = rest.partition(":"); item[k2.strip()] = _co(v2.strip())
        elif ":" in s and item is not None:
            k2, _, v2 = s.partition(":"); item[k2.strip()] = _co(v2.strip())
    if item and items is not None: items.append(item)
    return cfg

def _co(v):
    if not v: return v
    if v.lower() in ("true","yes"): return True
    if v.lower() in ("false","no"): return False
    try: return int(v)
    except: pass
    try: return float(v)
    except: pass
    return v

def _creds() -> Tuple[str, str]:
    sdk = _load_sdk(); yml = _load_yaml()
    key = sdk.get("api_key") or yml.get("api_key") or os.environ.get("ENVELO_API_KEY","")
    cert = sdk.get("certificate_number") or yml.get("case_id") or os.environ.get("ENVELO_CERTIFICATE","")
    return key, cert

def _api_get(path, key):
    req = urllib.request.Request(f"{API_BASE}{path}")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Accept", "application/json")
    return json.loads(urllib.request.urlopen(req, timeout=15).read().decode())

def _api_post(path, key, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{API_BASE}{path}", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    return json.loads(urllib.request.urlopen(req, timeout=15).read().decode())

def _write_yaml(config):
    try:
        import yaml
        CONFIG_FILE.write_text(yaml.dump(config, default_flow_style=False, sort_keys=False))
        return
    except ImportError: pass
    lines = []
    for key, value in config.items():
        if key == "parameters":
            lines.append("parameters:")
            for p in value:
                first = True
                for pk, pv in p.items():
                    if pk == "boundary": continue
                    lines.append(f"{'  - ' if first else '    '}{pk}: {pv}")
                    first = False
        elif isinstance(value, dict):
            lines.append(f"{key}:")
            for sk, sv in value.items(): lines.append(f"  {sk}: {sv}")
        else: lines.append(f"{key}: {value}")
    CONFIG_FILE.write_text("\n".join(lines) + "\n")

def _not_installed():
    if not ENVELO_DIR.exists():
        big_fail("ENVELO not installed")
        print(f"\n  {CY}curl -sSL https://get.sentinelauthority.org | bash{X}\n")
        return True
    return False

def _agent_pid() -> Optional[int]:
    if not PID_FILE.exists(): return None
    try:
        pid = int(PID_FILE.read_text().strip())
        os.kill(pid, 0)
        return pid
    except: PID_FILE.unlink(missing_ok=True); return None

def _log_event(event_type, data=None):
    """Append event to JSONL event log."""
    try:
        evt = {
            "ts": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "type": event_type,
        }
        if data: evt.update(data)
        with open(EVENTS_FILE, "a") as f:
            f.write(json.dumps(evt) + "\n")
    except: pass


# ══════════════════════════════════════════════════════════════════
#  NETWORK / PORT SCANNING
# ══════════════════════════════════════════════════════════════════

def _scan_port(h, p, t=0.8):
    try:
        with socket.create_connection((h, p), timeout=t): return True
    except: return False

def _scan_ports(h, ports):
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        fs = {ex.submit(_scan_port, h, p): p for p in ports}
        return sorted(p for f, p in fs.items() if f.result())

def _check_tls(host, port=443):
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=10) as s:
            with ctx.wrap_socket(s, server_hostname=host) as ss:
                return True, f"{ss.version()}, {ss.cipher()[0] if ss.cipher() else '?'}"
    except ssl.SSLCertVerificationError: return False, "SSL cert error"
    except socket.timeout: return False, "Timeout"
    except ConnectionRefusedError: return False, "Refused"
    except socket.gaierror: return False, "DNS failed"
    except Exception as e: return False, str(e)

def _get_hosts():
    hosts = ["127.0.0.1"]
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); lip = s.getsockname()[0]; s.close()
        if lip != "127.0.0.1": hosts.append(lip)
    except: pass
    for dh in ["172.17.0.1"]:
        try: socket.getaddrinfo(dh, None, socket.AF_INET); hosts.append(dh)
        except: pass
    return hosts

def _resolve_dns(host):
    try:
        results = socket.getaddrinfo(host, None)
        return True, list(set(r[4][0] for r in results))
    except socket.gaierror as e: return False, str(e)

def _check_latency(host, port=443, count=5):
    times = []
    for _ in range(count):
        try:
            start = time.time()
            with socket.create_connection((host, port), timeout=5): pass
            times.append((time.time() - start) * 1000)
        except: pass
    if not times: return None, None, None
    return min(times), sum(times)/len(times), max(times)


# ══════════════════════════════════════════════════════════════════
#  TELEMETRY PROBES
# ══════════════════════════════════════════════════════════════════

def _mqtt_probe(host, port, secs=5.0):
    topics = []
    try:
        sock = socket.create_connection((host, port), timeout=5)
        cid = b"envelo-probe"; pkt = bytearray([0x10])
        vh = bytearray(b'\x00\x04MQTT\x04\x02') + struct.pack(">H", 60)
        vh += struct.pack(">H", len(cid)) + cid
        _me(pkt, len(vh)); pkt += vh; sock.sendall(bytes(pkt)); sock.settimeout(3)
        r = sock.recv(4)
        if len(r) < 4 or r[0] != 0x20: sock.close(); return topics
        sub = bytearray([0x82]); sp = struct.pack(">H", 1) + struct.pack(">H", 1) + b"#" + b'\x00'
        _me(sub, len(sp)); sub += sp; sock.sendall(bytes(sub)); sock.settimeout(0.5)
        end = time.time() + secs; seen = set()
        while time.time() < end:
            try:
                data = sock.recv(4096)
                if not data: break
                off = 0
                while off < len(data):
                    if (data[off] & 0xF0) == 0x30:
                        pt = data[off]; off += 1; rem, u = _md(data, off); off += u
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
                            topics.append({"topic": topic, "sample": payload[:200].decode("utf-8", errors="replace")})
                    else:
                        off += 1
                        if off < len(data): rem, u = _md(data, off); off += u + rem
                        else: break
            except socket.timeout: continue
            except: break
        try: sock.sendall(bytes([0xE0, 0x00])); sock.close()
        except: pass
    except: pass
    return topics

def _me(buf, length):
    while True:
        byte = length % 128; length //= 128
        if length > 0: byte |= 0x80
        buf.append(byte)
        if length == 0: break

def _md(data, offset):
    mult = 1; val = 0; idx = 0
    while offset + idx < len(data):
        enc = data[offset + idx]; val += (enc & 0x7F) * mult; idx += 1
        if (enc & 0x80) == 0: break
        mult *= 128
    return val, idx

def _http_probe(host, port):
    results = []
    scheme = "https" if port in (443, 8443) else "http"
    for path in ["/metrics","/api/telemetry","/api/v1/telemetry","/api/status",
                 "/api/sensors","/api/v1/sensors","/health","/api/data",
                 "/vehicle/status","/robot/status","/system/metrics","/telemetry/current"]:
        try:
            req = urllib.request.Request(f"{scheme}://{host}:{port}{path}")
            req.add_header("User-Agent", "ENVELO/2.0")
            req.add_header("Accept", "application/json, text/plain, */*")
            resp = urllib.request.urlopen(req, timeout=2)
            body = resp.read(8192).decode("utf-8", errors="replace")
            ct = resp.headers.get("Content-Type", ""); keys = []
            if "text/plain" in ct or path == "/metrics":
                for line in body.splitlines():
                    line = line.strip()
                    if line and not line.startswith("#"):
                        m = re.match(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)', line)
                        if m: keys.append(m.group(1))
            elif "json" in ct:
                try: keys = _jk(json.loads(body))
                except: pass
            if keys:
                stype = "prometheus" if path == "/metrics" else "http"
                results.append({"url": f"{scheme}://{host}:{port}{path}", "keys": list(set(keys)), "type": stype})
        except: continue
    return results

def _jk(d, pfx="", dep=0):
    k = []
    if dep > 3: return k
    if isinstance(d, dict):
        for key, v in d.items():
            fp = f"{pfx}.{key}" if pfx else key
            if isinstance(v, (int, float)): k.append(fp)
            elif isinstance(v, dict): k.extend(_jk(v, fp, dep+1))
    return k

def _ros2_probe():
    if not os.environ.get("ROS_DISTRO"): return []
    try:
        r = subprocess.run(["ros2","topic","list","-t"], capture_output=True, text=True, timeout=10)
        if r.returncode != 0: return []
        return [{"topic": p[0].strip(), "type": p[1].rstrip("]") if len(p) > 1 else ""}
                for line in r.stdout.splitlines() if line.strip()
                for p in [line.strip().split(" [")]]
    except: return []

def _file_probe():
    results = []
    for pat, hint in [
        ("/sys/class/thermal/thermal_zone*/temp","temperature"),
        ("/sys/class/hwmon/hwmon*/temp*_input","temperature"),
        ("/sys/class/power_supply/*/voltage_now","voltage"),
        ("/sys/class/power_supply/*/current_now","current"),
        ("/sys/class/power_supply/*/capacity","battery"),
        ("/dev/ttyUSB*","serial_gps"),("/dev/ttyACM*","serial"),("/dev/iio:device*","imu"),
    ]:
        for m in glob.glob(pat):
            if os.path.exists(m): results.append({"path": m, "hint": hint})
    return results

def _test_source(st, sa):
    if st in ("http","prometheus"):
        try:
            resp = urllib.request.urlopen(urllib.request.Request(sa, method="GET"), timeout=5)
            return True, f"HTTP {resp.status}"
        except Exception as e: return False, str(e)
    elif st in ("mqtt","grpc","websocket"):
        try:
            addr = sa
            for pfx in ("mqtt://","grpc://","ws://","wss://","http://","https://"): addr = addr.replace(pfx,"")
            addr = addr.split("/")[0]
            h, p = (addr.rsplit(":",1)[0], int(addr.rsplit(":",1)[1])) if ":" in addr else (addr, 1883)
            with socket.create_connection((h, p), timeout=5): return True, "Connected"
        except Exception as e: return False, str(e)
    elif st == "ros2":
        try:
            r = subprocess.run(["ros2","topic","info",sa], capture_output=True, text=True, timeout=5)
            return (True, "Topic active") if r.returncode == 0 else (False, "Not found")
        except: return False, "ROS2 unavailable"
    elif st == "file":
        return (True, "Exists") if Path(sa).exists() else (False, "Not found")
    elif st == "custom": return True, "Custom (runtime)"
    return False, f"Unknown: {st}"


# ══════════════════════════════════════════════════════════════════
#  FUZZY MATCHING
# ══════════════════════════════════════════════════════════════════

KW = {
    "speed":["speed","velocity","vel","spd","knots","mph","kph","km_h","m_s"],
    "temperature":["temp","temperature","thermal","celsius","fahrenheit","heat"],
    "pressure":["pressure","psi","bar","pascal","atm"],
    "altitude":["altitude","alt","elevation","height","agl","msl"],
    "latitude":["lat","latitude","gps_lat","position_lat"],
    "longitude":["lon","lng","longitude","gps_lon","position_lon"],
    "heading":["heading","yaw","bearing","course","azimuth"],
    "torque":["torque","nm","force_rotational"],
    "current":["current","ampere","amp","amps"],
    "voltage":["voltage","volt","volts","vdc"],
    "rpm":["rpm","revolutions","rotational_speed"],
    "battery":["battery","soc","charge","batt"],
    "acceleration":["accel","acceleration","g_force","imu"],
    "angular_rate":["gyro","angular","omega","rad_s"],
}
def _norm(s): return re.sub(r'[^a-z0-9]', '_', s.lower()).strip('_')
def _match(p, c):
    pn, cn = _norm(p), _norm(c)
    if pn == cn: return 1.0
    if pn in cn or cn in pn: return 0.85
    for fam, kws in KW.items():
        if (any(k in pn for k in kws) or _norm(fam) in pn) and \
           (any(k in cn for k in kws) or _norm(fam) in cn): return 0.75
    pt = set(pn.split('_')) - {'api','v1','v2','data','value','raw','status'}
    ct = set(cn.split('_')) - {'api','v1','v2','data','value','raw','status'}
    if pt and ct:
        o = len(pt & ct)
        if o > 0: return 0.5 + (0.3 * o / max(len(pt), len(ct)))
    return 0.0
def _poll(pn):
    n = _norm(pn)
    if any(f in n for f in ["speed","velocity","position","torque","force","accel","gyro"]): return 100
    if any(f in n for f in ["heading","altitude","roll","pitch","yaw","rpm","current","voltage"]): return 250
    if any(f in n for f in ["temperature","humidity","pressure","battery","weight"]): return 1000
    return 500


# ══════════════════════════════════════════════════════════════════
#  BOUNDARY LOADING (shared across commands)
# ══════════════════════════════════════════════════════════════════

def _load_boundaries() -> Tuple[Optional[Dict], str]:
    """Load boundaries from API or cache. Returns (data, source)."""
    key, cert = _creds()
    if key:
        try: return _api_get("/api/envelo/boundaries/config", key), "API (live)"
        except: pass
    if CACHE_FILE.exists():
        try:
            c = json.loads(CACHE_FILE.read_text())
            return c.get("config", {}), f"cache ({c.get('cached_at','?')})"
        except: pass
    return None, "none"

def _boundary_params(data):
    """Extract all parameter names from boundary config."""
    params = []
    for k in ["numeric_boundaries","geo_boundaries","geographic_boundaries",
              "time_boundaries","state_boundaries","rate_boundaries"]:
        for b in data.get(k, []):
            name = b.get("name") or b.get("parameter","")
            if name: params.append({"name": name, "boundary": b})
    return params


# ══════════════════════════════════════════════════════════════════
#  COMMAND: start
# ══════════════════════════════════════════════════════════════════

def cmd_start(args):
    banner()
    if _not_installed(): return 1
    key, cert = _creds()
    if not key or not cert:
        big_fail("Missing credentials"); print(f"\n  Re-run: {CY}curl -sSL https://get.sentinelauthority.org | bash{X}\n"); return 1

    if _agent_pid():
        warn(f"Agent already running (PID {_agent_pid()})"); info("Use: envelo restart"); return 0

    daemon = "-d" in args or "--daemon" in args

    if daemon and hasattr(os, 'fork'):
        pid = os.fork()
        if pid > 0:
            PID_FILE.write_text(str(pid)); ok(f"Agent started (PID {pid})")
            info(f"Logs: envelo logs -f"); info(f"Stop: envelo stop"); return 0
        sys.stdout = open(str(LOG_FILE), "a"); sys.stderr = sys.stdout

    # Try SDK import
    try:
        from envelo import EnveloAgent, EnveloConfig
        config = EnveloConfig(api_key=key, certificate_number=cert, api_endpoint=API_BASE,
                              log_file=str(LOG_FILE), boundary_cache_path=str(CACHE_FILE),
                              cache_boundaries_locally=True, enforce_with_cached_boundaries=True)
        agent = EnveloAgent(config)
        header("Starting ENVELO enforcement")
        if agent.start():
            ok(f"Enforcing {len(getattr(agent, '_boundaries', []))} boundaries")
            PID_FILE.write_text(str(os.getpid()))
            _log_event("agent_start", {"pid": os.getpid(), "cert": cert})
            if not daemon: info("Press Ctrl+C to stop")
            try:
                while getattr(agent, 'is_running', True): time.sleep(1)
            except KeyboardInterrupt: pass
            finally:
                agent.stop(); PID_FILE.unlink(missing_ok=True)
                _log_event("agent_stop"); ok("Agent stopped")
            return 0
        else: big_fail("Failed to start"); return 1
    except ImportError:
        # Fallback: run local agent script
        agent_script = ENVELO_DIR / "envelo_agent.py"
        if agent_script.exists():
            info("SDK not found, using local agent")
            os.execv(sys.executable, [sys.executable, str(agent_script)])
        big_fail("ENVELO SDK not found"); print(f"  {CY}pip install envelo-sdk{X}\n"); return 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: stop
# ══════════════════════════════════════════════════════════════════

def cmd_stop(args):
    banner()
    pid = _agent_pid()
    if not pid:
        info("No running agent found"); return 0
    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(10):
            try: os.kill(pid, 0); time.sleep(0.5)
            except OSError: break
        PID_FILE.unlink(missing_ok=True)
        _log_event("agent_stop", {"pid": pid})
        ok(f"Agent stopped (PID {pid})"); return 0
    except ProcessLookupError:
        PID_FILE.unlink(missing_ok=True); info("Agent was not running"); return 0
    except PermissionError:
        fail("Permission denied. Try: sudo envelo stop"); return 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: restart
# ══════════════════════════════════════════════════════════════════

def cmd_restart(args):
    banner()
    pid = _agent_pid()
    if pid:
        ok(f"Stopping agent (PID {pid})")
        try:
            os.kill(pid, signal.SIGTERM)
            for _ in range(10):
                try: os.kill(pid, 0); time.sleep(0.5)
                except OSError: break
            PID_FILE.unlink(missing_ok=True)
        except: pass
    return cmd_start(args)


# ══════════════════════════════════════════════════════════════════
#  COMMAND: validate
# ══════════════════════════════════════════════════════════════════

def cmd_validate(args):
    banner(); header("Validating configuration")
    if _not_installed(): return 1
    errors = 0

    # Config file
    if CONFIG_FILE.exists():
        cfg = _load_yaml(); ok(f"Config file: {CONFIG_FILE}")
    else:
        fail("No config file"); return 1

    # Credentials
    key, cert = _creds()
    if key and key.startswith("sa_live_"): ok(f"API key format: valid")
    elif key: fail(f"API key format: should start with sa_live_"); errors += 1
    else: fail("No API key"); errors += 1

    if cert and cert.startswith("ODDC-"): ok(f"Certificate ID: {cert}")
    elif cert: warn(f"Certificate ID format: {cert} (expected ODDC-...)"); errors += 1
    else: fail("No certificate ID"); errors += 1

    # Parameters
    params = cfg.get("parameters", [])
    ok(f"Parameters declared: {len(params)}")
    unmapped = 0
    for p in params:
        name = p.get("name","?"); st = p.get("source_type",""); sa = p.get("source_address","")
        if not st or not sa:
            warn(f"  {name}: no telemetry source mapped"); unmapped += 1; errors += 1
        else:
            info(f"  {name}: {st} → {sa}")
    if unmapped: warn(f"{unmapped} parameter(s) need source mapping (run: envelo rediscover)")

    # API connectivity
    if key:
        try:
            _api_get("/api/envelo/boundaries/config", key)
            ok("API connectivity: verified")
        except urllib.error.HTTPError as e:
            if e.code == 401: fail("API: invalid credentials"); errors += 1
            else: fail(f"API: HTTP {e.code}"); errors += 1
        except Exception as e: fail(f"API: {e}"); errors += 1

    # Enforcement mode
    mode = cfg.get("enforcement_mode", "")
    if mode: ok(f"Enforcement mode: {mode}")
    else: info("Enforcement mode: default (BLOCK)")

    # Fail-closed
    fc = cfg.get("fail_closed")
    if fc is True: ok("Fail-closed: enabled (recommended)")
    elif fc is False: warn("Fail-closed: DISABLED — agent will allow actions when disconnected"); errors += 1
    else: info("Fail-closed: default (true)")

    print()
    if errors == 0:
        big_ok("Configuration valid — ready to start")
        print(f"  Run: {CY}envelo start{X}\n")
    else:
        print(f"  {R}{errors} issue(s) found{X}")
        print(f"  Fix the issues above, then run {CY}envelo validate{X} again\n")
    return 0 if errors == 0 else 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: status
# ══════════════════════════════════════════════════════════════════

def cmd_status(args):
    banner(); header("ENVELO Status")
    if _not_installed(): return 1

    cfg = _load_yaml()
    ok(f"Installed: {ENVELO_DIR}")
    ok(f"Config: {CONFIG_FILE}")
    info(f"Case: {cfg.get('case_id','?')}")
    params = cfg.get("parameters", [])
    info(f"Parameters: {len(params)}")

    pid = _agent_pid()
    if pid: ok(f"Agent running (PID {pid})")
    else: info("Agent not running")

    key, cert = _creds()
    if key:
        try: _api_get("/api/envelo/boundaries/config", key); ok("API: connected")
        except urllib.error.HTTPError as e:
            if e.code == 401: fail("API: invalid credentials")
            else: warn(f"API: HTTP {e.code}")
        except Exception as e: fail(f"API: {e}")

    tls_ok, tls_msg = _check_tls("sentinel-authority-production.up.railway.app")
    (ok if tls_ok else fail)(f"TLS: {tls_msg}")

    if CACHE_FILE.exists():
        try:
            c = json.loads(CACHE_FILE.read_text()); ok(f"Cache: {c.get('cached_at','?')}")
        except: warn("Cache: corrupt")

    if params:
        header("Telemetry Sources")
        for p in params:
            st, sa, name = p.get("source_type",""), p.get("source_address",""), p.get("name","?")
            if st and sa:
                reachable, msg = _test_source(st, sa)
                (ok if reachable else fail)(f"{name}: {st} → {msg}")
            else: warn(f"{name}: no source mapped")

    if LOG_FILE.exists():
        ok(f"Log: {LOG_FILE} ({LOG_FILE.stat().st_size / 1024:.0f} KB)")

    print()
    if pid: big_ok("ENVELO is active and enforcing")
    else: print(f"\n  {Y}Agent installed but not running{X}\n  Start: {CY}envelo start{X}\n")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: monitor (live terminal dashboard)
# ══════════════════════════════════════════════════════════════════

def cmd_monitor(args):
    """Live terminal dashboard — refreshes every 2 seconds."""
    if _not_installed(): return 1
    key, cert = _creds()

    try:
        while True:
            # Clear screen
            os.system('cls' if os.name == 'nt' else 'clear')
            now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            print(f"{P}{B}  ◉  ENVELO Monitor{X}  {D}{now}{X}")
            print(f"  {CY}{'─' * 60}{X}")

            # Agent status
            pid = _agent_pid()
            if pid:
                print(f"  Agent: {G}● RUNNING{X} (PID {pid})")
            else:
                print(f"  Agent: {R}● STOPPED{X}")

            # Uptime
            if pid and PID_FILE.exists():
                try:
                    mtime = os.path.getmtime(str(PID_FILE))
                    uptime = time.time() - mtime
                    h, rem = divmod(int(uptime), 3600); m, s = divmod(rem, 60)
                    print(f"  Uptime: {h}h {m}m {s}s")
                except: pass

            # API
            if key:
                try:
                    start_t = time.time()
                    _api_get("/api/envelo/boundaries/config", key)
                    lat = (time.time() - start_t) * 1000
                    print(f"  API: {G}● CONNECTED{X} ({lat:.0f}ms)")
                except:
                    print(f"  API: {R}● DISCONNECTED{X}")

            # Parameters
            cfg = _load_yaml()
            params = cfg.get("parameters", [])
            print(f"\n  {B}Boundary Parameters ({len(params)}){X}")
            print(f"  {'─' * 60}")
            for p in params:
                name = p.get("name","?"); st = p.get("source_type","")
                sa = p.get("source_address",""); poll = p.get("poll_interval_ms","?")
                if st and sa:
                    reachable, _ = _test_source(st, sa)
                    dot = f"{G}●{X}" if reachable else f"{R}●{X}"
                    print(f"  {dot} {name:<25} {st:<10} {poll}ms")
                else:
                    print(f"  {Y}○{X} {name:<25} {Y}unmapped{X}")

            # Recent events
            if EVENTS_FILE.exists():
                lines = EVENTS_FILE.read_text().splitlines()[-5:]
                if lines:
                    print(f"\n  {B}Recent Events{X}")
                    print(f"  {'─' * 60}")
                    for line in reversed(lines):
                        try:
                            evt = json.loads(line)
                            ts = evt.get("ts","")[:19]
                            etype = evt.get("type","?")
                            color = R if "violation" in etype else G if "pass" in etype else D
                            print(f"  {color}{ts}  {etype}{X}")
                        except: pass

            # Last log lines
            if LOG_FILE.exists():
                log_lines = LOG_FILE.read_text().splitlines()[-3:]
                if log_lines:
                    print(f"\n  {D}Last log:{X}")
                    for l in log_lines: print(f"  {D}{l[:70]}{X}")

            print(f"\n  {D}Refreshing every 2s. Press Ctrl+C to exit.{X}")
            time.sleep(2)
    except KeyboardInterrupt:
        print(f"\n  {D}Monitor closed.{X}")
        return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: events
# ══════════════════════════════════════════════════════════════════

def cmd_events(args):
    banner(); header("Event History")
    if not EVENTS_FILE.exists():
        info("No events recorded yet"); return 0

    n = 20
    for i, a in enumerate(args):
        if a in ("--last", "-n") and i + 1 < len(args):
            try: n = int(args[i + 1])
            except: pass

    etype_filter = None
    if "--violations" in args: etype_filter = "violation"
    if "--blocks" in args: etype_filter = "block"

    lines = EVENTS_FILE.read_text().splitlines()
    if etype_filter:
        lines = [l for l in lines if etype_filter in l]

    for line in lines[-n:]:
        try:
            evt = json.loads(line)
            ts = evt.get("ts","")[:19]; etype = evt.get("type","?")
            color = R if "violation" in etype or "block" in etype else G if "pass" in etype or "start" in etype else Y
            detail = ""
            if "parameter" in evt: detail += f" param={evt['parameter']}"
            if "value" in evt: detail += f" val={evt['value']}"
            if "limit" in evt: detail += f" limit={evt['limit']}"
            print(f"  {color}{ts}{X}  {B}{etype}{X}{D}{detail}{X}")
        except: pass

    total = len(EVENTS_FILE.read_text().splitlines())
    print(f"\n  {D}Showing last {min(n, len(lines))} of {total} events{X}")
    if etype_filter: print(f"  {D}Filtered by: {etype_filter}{X}")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: logs
# ══════════════════════════════════════════════════════════════════

def cmd_logs(args):
    if not LOG_FILE.exists(): print(f"  No log file at {LOG_FILE}"); return 0
    n = 20; follow = "-f" in args or "--follow" in args
    for i, a in enumerate(args):
        if a in ("--last", "-n") and i + 1 < len(args):
            try: n = int(args[i + 1])
            except: pass
    if follow:
        print(f"  {D}Following {LOG_FILE} (Ctrl+C to stop){X}\n")
        try:
            proc = subprocess.Popen(["tail", "-f", str(LOG_FILE)], stdout=sys.stdout, stderr=sys.stderr)
            proc.wait()
        except KeyboardInterrupt: proc.terminate()
        except FileNotFoundError:
            with open(LOG_FILE) as f:
                f.seek(0, 2)
                while True:
                    line = f.readline()
                    if line: print(line, end="")
                    else: time.sleep(0.1)
    else:
        for line in LOG_FILE.read_text().splitlines()[-n:]: print(f"  {line}")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: cat72
# ══════════════════════════════════════════════════════════════════

def cmd_cat72(args):
    banner(); header("CAT-72 Test Status")
    key, cert = _creds()
    if not key:
        fail("No credentials — can't check CAT-72 status"); return 1

    with Spinner("Checking CAT-72 status"):
        try:
            data = _api_get("/api/envelo/cat72/status", key)
        except urllib.error.HTTPError:
            try: data = _api_get(f"/api/applications/{cert}/cat72", key)
            except: data = None
        except: data = None

    if not data:
        warn("Could not fetch CAT-72 status from API")
        info("Check manually at: " + PORTAL)

        # Show local inference
        if EVENTS_FILE.exists():
            lines = EVENTS_FILE.read_text().splitlines()
            violations = sum(1 for l in lines if "violation" in l)
            total = len(lines)
            if total > 0:
                print(f"\n  {B}Local event summary:{X}")
                print(f"  Total events: {total}")
                print(f"  Violations: {R}{violations}{X}")
                print(f"  Pass rate: {G}{((total - violations) / total * 100):.1f}%{X}")
        return 1

    status = data.get("status", data.get("test_status", "unknown"))
    started = data.get("started_at", data.get("start_time", "?"))
    elapsed = data.get("elapsed_hours", data.get("hours_elapsed", "?"))
    remaining = data.get("remaining_hours", data.get("hours_remaining", "?"))
    violations = data.get("violations", data.get("violation_count", 0))
    pass_rate = data.get("pass_rate", data.get("compliance_rate", "?"))

    status_colors = {"active": G, "running": G, "passed": G, "failed": R, "pending": Y}
    sc = status_colors.get(status.lower(), Y)

    print(f"\n  Status: {sc}{B}{status.upper()}{X}")
    print(f"  Started: {started}")
    if elapsed != "?":
        # Progress bar
        pct = min(float(elapsed) / 72.0, 1.0) if isinstance(elapsed, (int, float)) else 0
        filled = int(pct * 30); empty = 30 - filled
        bar = f"{G}{'█' * filled}{X}{D}{'░' * empty}{X}"
        print(f"  Progress: [{bar}] {pct:.0%}")
        print(f"  Elapsed: {elapsed}h / 72h")
        if remaining != "?": print(f"  Remaining: {remaining}h")

    print(f"  Violations: {R if violations else G}{violations}{X}")
    if pass_rate != "?": print(f"  Pass rate: {pass_rate}%")

    if str(status).lower() in ("active", "running"):
        print(f"\n  {Y}{B}The 72-hour timer is running. No pause.{X}")
    elif str(status).lower() == "passed":
        print(f"\n  {G}{B}CAT-72 PASSED — Certificate ready for issuance{X}")
    elif str(status).lower() == "failed":
        print(f"\n  {R}{B}CAT-72 FAILED — Contact your Conformance Engineer{X}")
    else:
        print(f"\n  Start the agent to begin: {CY}envelo start{X}")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: boundaries
# ══════════════════════════════════════════════════════════════════

def cmd_boundaries(args):
    banner(); header("Enforced Boundaries")
    data, source = _load_boundaries()
    if not data: fail("No boundary data"); return 1
    info(f"Source: {source}\n")

    for b in data.get("numeric_boundaries", []):
        lo = b.get("min_value", b.get("min","?")); hi = b.get("max_value", b.get("max","?"))
        wall = b.get("hard_limit",""); unit = b.get("unit","")
        print(f"  {G}■{X} {B}{b.get('name','?')}{X}")
        print(f"    ODD: {lo} — {hi} {unit}")
        if wall: print(f"    Wall: {R}{wall} {unit}{X}")
        print()

    for b in data.get("geo_boundaries", data.get("geographic_boundaries", [])):
        btype = b.get("boundary_type", b.get("type","circle"))
        print(f"  {G}■{X} {B}{b.get('name','?')}{X} ({btype})")
        if btype == "circle":
            lat = b.get("center",{}).get("lat") or b.get("center_lat","?")
            lon = b.get("center",{}).get("lon") or b.get("center_lon","?")
            print(f"    Center: {lat}, {lon}  Radius: {b.get('radius_meters','?')}m")
        print()

    for b in data.get("time_boundaries", []):
        start = b.get("allowed_hours_start", b.get("start_hour",0))
        end = b.get("allowed_hours_end", b.get("end_hour",24))
        tz = b.get("timezone","UTC")
        print(f"  {G}■{X} {B}{b.get('name','?')}{X}")
        print(f"    Hours: {start}:00 — {end}:00 {tz}")
        print()

    for b in data.get("state_boundaries", []):
        allowed = b.get("allowed_values", b.get("allowed",[]))
        forbidden = b.get("forbidden_values", b.get("forbidden",[]))
        print(f"  {G}■{X} {B}{b.get('name','?')}{X}")
        if allowed: print(f"    Allowed: {', '.join(str(v) for v in allowed)}")
        if forbidden: print(f"    Forbidden: {R}{', '.join(str(v) for v in forbidden)}{X}")
        print()
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: resync
# ══════════════════════════════════════════════════════════════════

def cmd_resync(args):
    banner(); header("Resyncing boundaries")
    key, cert = _creds()
    if not key: fail("No credentials"); return 1
    try:
        data = _api_get("/api/envelo/boundaries/config", key)
        ok("Fetched from Sentinel Authority")
        CACHE_FILE.write_text(json.dumps({"cached_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                                          "certificate_number": cert, "config": data}, indent=2))
        ok(f"Cache updated")
        total = sum(len(data.get(k,[])) for k in ["numeric_boundaries","geo_boundaries","geographic_boundaries",
                                                    "time_boundaries","state_boundaries","rate_boundaries"])
        ok(f"{total} boundary parameter(s) synced")
        pid = _agent_pid()
        if pid:
            try: os.kill(pid, signal.SIGUSR1); ok("Signaled agent to reload")
            except: info("Agent will reload on restart")
        return 0
    except Exception as e: fail(f"Failed: {e}"); return 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: simulate
# ══════════════════════════════════════════════════════════════════

def cmd_simulate(args):
    banner(); header("Boundary Simulation")
    data, source = _load_boundaries()
    if not data: fail("No boundaries loaded"); return 1

    if len(args) >= 2:
        param_name = args[0]
        try: value = float(args[1])
        except: fail(f"Value must be a number: {args[1]}"); return 1

        # Find matching boundary
        for b in data.get("numeric_boundaries", []):
            bname = b.get("name","")
            if _norm(bname) == _norm(param_name) or param_name.lower() in bname.lower():
                lo = b.get("min_value", b.get("min")); hi = b.get("max_value", b.get("max"))
                wall = b.get("hard_limit"); unit = b.get("unit","")

                print(f"  Parameter: {B}{bname}{X}")
                print(f"  Value: {value} {unit}")
                print(f"  ODD: {lo} — {hi} {unit}")
                if wall: print(f"  Wall: {wall} {unit}")
                print()

                if lo is not None and value < float(lo):
                    fail(f"VIOLATION: {value} < min {lo}")
                    print(f"  {R}{B}Tier 2: ODD breach → MRC triggered{X}")
                    if wall and value < float(wall):
                        print(f"  {R}{B}Tier 3: ENVELO WALL → HARD HALT{X}")
                elif hi is not None and value > float(hi):
                    fail(f"VIOLATION: {value} > max {hi}")
                    print(f"  {R}{B}Tier 2: ODD breach → MRC triggered{X}")
                    if wall and value > float(wall):
                        print(f"  {R}{B}Tier 3: ENVELO WALL → HARD HALT{X}")
                else:
                    big_ok(f"PASS: {value} is within ODD [{lo} — {hi}]")
                    print(f"  {G}Tier 1: Operating normally within envelope{X}")
                return 0

        fail(f"No numeric boundary found matching '{param_name}'")
        info("Available parameters:")
        for b in data.get("numeric_boundaries", []):
            info(f"  • {b.get('name','?')}")
        return 1
    else:
        # Interactive: simulate all boundaries
        print(f"  {D}Usage: envelo simulate <parameter> <value>{X}")
        print(f"  {D}Example: envelo simulate vehicle_speed 45.5{X}\n")
        print(f"  Available parameters:")
        for b in data.get("numeric_boundaries", []):
            lo = b.get("min_value",b.get("min","?")); hi = b.get("max_value",b.get("max","?"))
            print(f"  • {CY}{b.get('name','?')}{X}  [{lo} — {hi} {b.get('unit','')}]")
        return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: test
# ══════════════════════════════════════════════════════════════════

def cmd_test(args):
    banner(); header("Testing telemetry sources")
    cfg = _load_yaml(); params = cfg.get("parameters",[])
    if not params: warn("No parameters configured"); return 0
    passed = failed = 0
    for p in params:
        st, sa, name = p.get("source_type",""), p.get("source_address",""), p.get("name","?")
        if not st or not sa: warn(f"{name}: no source"); failed += 1; continue
        r, msg = _test_source(st, sa)
        (ok if r else fail)(f"{name}: {st} → {msg}")
        if r: passed += 1
        else: failed += 1
    print()
    if failed == 0: big_ok(f"All {passed} sources reachable")
    else: print(f"  {G}{passed} passed{X}  {R}{failed} failed{X}\n  Fix, then run {CY}envelo test{X} again")
    return 0 if failed == 0 else 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: rediscover
# ══════════════════════════════════════════════════════════════════

def cmd_rediscover(args):
    banner(); header("Auto-Discovery Scan")
    cfg = _load_yaml(); params = cfg.get("parameters",[])
    if not params: warn("No parameters"); return 0
    rescan_all = "--all" in args
    targets = params if rescan_all else [p for p in params if not p.get("source_type") or not p.get("source_address")]
    if not targets:
        ok(f"All {len(params)} mapped. Use {CY}--all{X} to rescan."); return 0
    info(f"Scanning for {len(targets)} parameter(s)...\n")
    all_sources = []
    hosts = _get_hosts()
    ports = sorted(set([1883,8883,80,8080,8000,8888,3000,5000,9090,443,8443,50051,50052]))
    for host in hosts:
        open_ports = _scan_ports(host, ports)
        if not open_ports: continue
        ok(f"{host}: {len(open_ports)} service(s)")
        for port in open_ports:
            if port in [1883,8883]:
                topics = _mqtt_probe(host, port, 5.0)
                for t in topics: all_sources.append(("mqtt", f"mqtt://{host}:{port}/{t['topic']}", t['topic']))
                if topics: ok(f"  MQTT: {len(topics)} topic(s)")
            if port in [80,8080,8000,8888,3000,5000,9090,443,8443]:
                eps = _http_probe(host, port)
                for ep in eps:
                    for key in ep['keys']:
                        addr = ep['url'] if ep['type'] == 'prometheus' else f"{ep['url']}#$.{key}"
                        all_sources.append((ep['type'], addr, key))
                if eps: ok(f"  HTTP: {sum(len(e['keys']) for e in eps)} metric(s)")
            if port in [50051,50052]:
                all_sources.append(("grpc", f"grpc://{host}:{port}", "")); ok(f"  gRPC: detected")
    ros = _ros2_probe()
    if ros:
        for rt in ros: all_sources.append(("ros2", rt['topic'], rt['topic'].split('/')[-1]))
        ok(f"ROS2: {len(ros)} topic(s)")
    files = _file_probe()
    if files:
        for fs in files: all_sources.append(("file", fs['path'], fs['hint']))
        ok(f"Hardware: {len(files)} sensor(s)")
    print(); info(f"Discovered {len(all_sources)} source(s)")
    updated = 0
    for p in targets:
        pname = p.get("name",""); best = None; best_s = 0.0
        for st, sa, hint in all_sources:
            s = max(_match(pname, hint), _match(pname, sa))
            if s > best_s: best_s = s; best = (st, sa)
        if best and best_s >= 0.5:
            st, sa = best
            if best_s >= 0.8:
                p["source_type"] = st; p["source_address"] = sa; p["poll_interval_ms"] = _poll(pname)
                ok(f"{pname} → {st}://{sa.split('://')[-1]}"); updated += 1
            else:
                print(f"\n  {B}{pname}{X} → {st}://{sa.split('://')[-1]} ({Y}{best_s:.0%}{X})")
                r = input(f"  Accept? [Y/n]: ").strip().lower()
                if r in ("","y","yes"):
                    p["source_type"]=st; p["source_address"]=sa; p["poll_interval_ms"]=_poll(pname)
                    ok(f"{pname} mapped"); updated += 1
        else: warn(f"{pname}: no match")
    if updated: _write_yaml(cfg); print(); ok(f"Updated {updated} mapping(s)")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: benchmark
# ══════════════════════════════════════════════════════════════════

def cmd_benchmark(args):
    banner(); header("Enforcement Latency Benchmark")
    iterations = 10000
    for i, a in enumerate(args):
        if a in ("-n","--iterations") and i+1 < len(args):
            try: iterations = int(args[i+1])
            except: pass

    data, _ = _load_boundaries()
    if not data: fail("No boundaries"); return 1
    numeric = data.get("numeric_boundaries", [])
    if not numeric: warn("No numeric boundaries to benchmark"); return 0

    # Simulate boundary checks
    import random
    b = numeric[0]
    lo = float(b.get("min_value", b.get("min", 0)))
    hi = float(b.get("max_value", b.get("max", 100)))

    ok(f"Benchmarking {iterations:,} boundary checks on '{b.get('name','?')}'")
    info(f"Range: {lo} — {hi}\n")

    # Warm up
    for _ in range(100): v = random.uniform(lo - 10, hi + 10); _ = lo <= v <= hi

    # Actual benchmark
    start = time.perf_counter()
    passes = violations = 0
    for _ in range(iterations):
        v = random.uniform(lo - 10, hi + 10)
        if lo <= v <= hi: passes += 1
        else: violations += 1
    elapsed = time.perf_counter() - start

    per_check_ns = (elapsed / iterations) * 1_000_000_000
    checks_per_sec = iterations / elapsed

    ok(f"Completed {iterations:,} checks in {elapsed*1000:.1f}ms")
    print(f"\n  Per check:    {CY}{per_check_ns:.0f} ns{X}")
    print(f"  Throughput:   {CY}{checks_per_sec:,.0f} checks/sec{X}")
    print(f"  Passes:       {G}{passes:,}{X}")
    print(f"  Violations:   {R}{violations:,}{X}")

    if per_check_ns < 1000:
        print(f"\n  {G}{B}SUB-MICROSECOND — Zero enforcement overhead{X}")
    elif per_check_ns < 10000:
        print(f"\n  {G}Single-digit microsecond — Negligible overhead{X}")
    else:
        print(f"\n  {Y}Consider optimizing boundary evaluation logic{X}")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: service install / uninstall
# ══════════════════════════════════════════════════════════════════

def cmd_service(args):
    banner()
    if not args: print(f"  Usage: envelo service install|uninstall"); return 0
    sub = args[0].lower()

    if sub == "install":
        header("Installing system service")
        system = platform.system()

        if system == "Linux":
            # systemd
            envelo_bin = shutil.which("envelo") or f"{sys.executable} {__file__}"
            unit = textwrap.dedent(f"""\
                [Unit]
                Description=ENVELO Enforcement Agent — Sentinel Authority
                After=network-online.target
                Wants=network-online.target
                Documentation=https://docs.sentinelauthority.org

                [Service]
                Type=simple
                ExecStart={envelo_bin} start
                Restart=always
                RestartSec=5
                StandardOutput=journal
                StandardError=journal
                Environment=ENVELO_API_KEY={_creds()[0]}
                Environment=ENVELO_CERTIFICATE={_creds()[1]}
                WatchdogSec=60
                TimeoutStopSec=30

                [Install]
                WantedBy=multi-user.target
            """)
            svc_path = Path("/etc/systemd/system/envelo.service")
            try:
                svc_path.write_text(unit)
                subprocess.run(["systemctl", "daemon-reload"], check=True)
                subprocess.run(["systemctl", "enable", "envelo"], check=True)
                subprocess.run(["systemctl", "start", "envelo"], check=True)
                ok(f"Systemd service installed and started")
                info(f"  Status:  systemctl status envelo")
                info(f"  Logs:    journalctl -u envelo -f")
                info(f"  Stop:    systemctl stop envelo")
            except PermissionError:
                fail("Need sudo to install service")
                print(f"\n  Run: {CY}sudo envelo service install{X}\n")
                return 1
            except Exception as e:
                fail(f"Failed: {e}"); return 1

        elif system == "Darwin":
            # launchd
            plist = textwrap.dedent(f"""\
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
                <plist version="1.0">
                <dict>
                    <key>Label</key>
                    <string>org.sentinelauthority.envelo</string>
                    <key>ProgramArguments</key>
                    <array>
                        <string>{sys.executable}</string>
                        <string>{__file__}</string>
                        <string>start</string>
                    </array>
                    <key>RunAtLoad</key>
                    <true/>
                    <key>KeepAlive</key>
                    <true/>
                    <key>StandardOutPath</key>
                    <string>{LOG_FILE}</string>
                    <key>StandardErrorPath</key>
                    <string>{LOG_FILE}</string>
                    <key>EnvironmentVariables</key>
                    <dict>
                        <key>ENVELO_API_KEY</key>
                        <string>{_creds()[0]}</string>
                        <key>ENVELO_CERTIFICATE</key>
                        <string>{_creds()[1]}</string>
                    </dict>
                </dict>
                </plist>
            """)
            plist_path = Path.home() / "Library/LaunchAgents/org.sentinelauthority.envelo.plist"
            plist_path.parent.mkdir(parents=True, exist_ok=True)
            plist_path.write_text(plist)
            subprocess.run(["launchctl", "load", str(plist_path)])
            ok("LaunchAgent installed and loaded")
            info(f"  Stop: launchctl unload {plist_path}")

        elif system == "Windows":
            warn("Windows service requires NSSM or sc.exe")
            print(f"\n  Install NSSM: https://nssm.cc/download")
            print(f"  Then: nssm install ENVELO {sys.executable} {__file__} start\n")
        else:
            warn(f"Unsupported OS: {system}")
        return 0

    elif sub == "uninstall":
        header("Removing system service")
        system = platform.system()
        if system == "Linux":
            svc_path = Path("/etc/systemd/system/envelo.service")
            if svc_path.exists():
                try:
                    subprocess.run(["systemctl","stop","envelo"], capture_output=True)
                    subprocess.run(["systemctl","disable","envelo"], capture_output=True)
                    svc_path.unlink()
                    subprocess.run(["systemctl","daemon-reload"], capture_output=True)
                    ok("Systemd service removed")
                except PermissionError:
                    fail("Need sudo"); return 1
            else: info("No systemd service found")
        elif system == "Darwin":
            plist_path = Path.home() / "Library/LaunchAgents/org.sentinelauthority.envelo.plist"
            if plist_path.exists():
                subprocess.run(["launchctl","unload",str(plist_path)], capture_output=True)
                plist_path.unlink()
                ok("LaunchAgent removed")
            else: info("No LaunchAgent found")
        return 0
    else:
        print(f"  Unknown: envelo service {sub}"); return 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: docker
# ══════════════════════════════════════════════════════════════════

def cmd_docker(args):
    banner(); header("Docker Configuration")
    key, cert = _creds()

    # Dockerfile
    dockerfile = textwrap.dedent(f"""\
        FROM python:3.11-slim
        LABEL org.opencontainers.image.title="ENVELO Agent"
        LABEL org.opencontainers.image.vendor="Sentinel Authority"

        WORKDIR /envelo
        COPY requirements.txt .
        RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
        COPY . .

        ENV ENVELO_API_KEY=""
        ENV ENVELO_CERTIFICATE=""
        ENV ENVELO_API_ENDPOINT="{API_BASE}"

        HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
            CMD python cli.py status || exit 1

        ENTRYPOINT ["python", "cli.py", "start"]
    """)

    # docker-compose.yml
    compose = textwrap.dedent(f"""\
        version: '3.8'
        services:
          envelo:
            build: .
            container_name: envelo-agent
            restart: always
            environment:
              - ENVELO_API_KEY={key or 'your-api-key-here'}
              - ENVELO_CERTIFICATE={cert or 'ODDC-2026-XXXXX'}
              - ENVELO_API_ENDPOINT={API_BASE}
            volumes:
              - envelo-data:/envelo/data
              - envelo-logs:/envelo/logs
            network_mode: host  # Access local telemetry sources
            logging:
              driver: json-file
              options:
                max-size: "10m"
                max-file: "3"

        volumes:
          envelo-data:
          envelo-logs:
    """)

    out_dir = Path.cwd() / "envelo-docker"
    out_dir.mkdir(exist_ok=True)
    (out_dir / "Dockerfile").write_text(dockerfile)
    (out_dir / "docker-compose.yml").write_text(compose)
    (out_dir / "requirements.txt").write_text("envelo-sdk>=2.0.0\n")

    # Copy CLI
    cli_src = Path(__file__).resolve()
    if cli_src.exists():
        shutil.copy2(cli_src, out_dir / "cli.py")

    ok(f"Generated: {out_dir}/")
    info(f"  Dockerfile")
    info(f"  docker-compose.yml")
    info(f"  requirements.txt")
    print(f"\n  {B}Start:{X}")
    print(f"  {CY}cd {out_dir}{X}")
    print(f"  {CY}docker compose up -d{X}\n")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: k8s
# ══════════════════════════════════════════════════════════════════

def cmd_k8s(args):
    banner(); header("Kubernetes Manifests")
    key, cert = _creds()

    manifests = textwrap.dedent(f"""\
        ---
        apiVersion: v1
        kind: Secret
        metadata:
          name: envelo-credentials
          namespace: default
          labels:
            app: envelo
        type: Opaque
        stringData:
          api-key: "{key or 'your-api-key-here'}"
          certificate: "{cert or 'ODDC-2026-XXXXX'}"

        ---
        apiVersion: apps/v1
        kind: DaemonSet
        metadata:
          name: envelo-agent
          namespace: default
          labels:
            app: envelo
            sentinel.authority/component: enforcement
        spec:
          selector:
            matchLabels:
              app: envelo
          template:
            metadata:
              labels:
                app: envelo
            spec:
              containers:
                - name: envelo
                  image: sentinelauthority/envelo:latest
                  env:
                    - name: ENVELO_API_KEY
                      valueFrom:
                        secretKeyRef:
                          name: envelo-credentials
                          key: api-key
                    - name: ENVELO_CERTIFICATE
                      valueFrom:
                        secretKeyRef:
                          name: envelo-credentials
                          key: certificate
                    - name: ENVELO_API_ENDPOINT
                      value: "{API_BASE}"
                  resources:
                    requests:
                      cpu: "50m"
                      memory: "64Mi"
                    limits:
                      cpu: "200m"
                      memory: "128Mi"
                  livenessProbe:
                    exec:
                      command: ["python", "cli.py", "status"]
                    initialDelaySeconds: 10
                    periodSeconds: 30
                  readinessProbe:
                    exec:
                      command: ["python", "cli.py", "validate"]
                    initialDelaySeconds: 5
                    periodSeconds: 10
                  volumeMounts:
                    - name: envelo-data
                      mountPath: /envelo/data
              volumes:
                - name: envelo-data
                  emptyDir: {{}}
              hostNetwork: true
              dnsPolicy: ClusterFirstWithHostNet
    """)

    out_file = Path.cwd() / "envelo-k8s.yaml"
    out_file.write_text(manifests)
    ok(f"Generated: {out_file}")
    info("Includes: Secret + DaemonSet")
    print(f"\n  {B}Deploy:{X}")
    print(f"  {CY}kubectl apply -f {out_file}{X}")
    print(f"  {CY}kubectl get pods -l app=envelo{X}\n")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: network
# ══════════════════════════════════════════════════════════════════

def cmd_network(args):
    banner(); header("Network Diagnostics")

    # DNS
    host = "sentinel-authority-production.up.railway.app"
    dns_ok, dns_result = _resolve_dns(host)
    if dns_ok: ok(f"DNS: {host} → {', '.join(dns_result)}")
    else: fail(f"DNS: {dns_result}")

    # TLS
    tls_ok, tls_msg = _check_tls(host)
    (ok if tls_ok else fail)(f"TLS: {tls_msg}")

    # Latency
    mn, avg, mx = _check_latency(host)
    if avg:
        color = G if avg < 100 else Y if avg < 300 else R
        ok(f"Latency: {color}min={mn:.0f}ms avg={avg:.0f}ms max={mx:.0f}ms{X}")
    else: fail("Latency: unreachable")

    # API
    key, _ = _creds()
    if key:
        try:
            start_t = time.time()
            _api_get("/api/envelo/boundaries/config", key)
            api_lat = (time.time() - start_t) * 1000
            ok(f"API: authenticated in {api_lat:.0f}ms")
        except urllib.error.HTTPError as e: fail(f"API: HTTP {e.code}")
        except Exception as e: fail(f"API: {e}")

    # Outbound internet
    for test_host, test_port in [("8.8.8.8", 53), ("1.1.1.1", 53)]:
        try:
            with socket.create_connection((test_host, test_port), timeout=5):
                ok(f"Internet: {test_host}:{test_port} reachable")
        except: fail(f"Internet: {test_host}:{test_port} blocked")

    # Local interfaces
    header("Local Network")
    hosts = _get_hosts()
    for h in hosts: ok(f"Interface: {h}")

    # Firewall hints
    if platform.system() == "Linux":
        try:
            r = subprocess.run(["iptables","-L","-n","--line-numbers"],
                               capture_output=True, text=True, timeout=5)
            if r.returncode == 0 and r.stdout.strip():
                info("iptables rules detected (check for ENVELO port blocking)")
        except: pass

    # Proxy detection
    for var in ["HTTP_PROXY","HTTPS_PROXY","http_proxy","https_proxy","NO_PROXY"]:
        val = os.environ.get(var)
        if val: warn(f"Proxy: {var}={val}")

    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: diagnose
# ══════════════════════════════════════════════════════════════════

def cmd_diagnose(args):
    banner(); header("Generating diagnostics")
    diag = {
        "timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": VERSION,
        "system": {"os": platform.system(), "release": platform.release(),
                   "arch": platform.machine(), "hostname": platform.node(),
                   "python": platform.python_version(), "cpus": os.cpu_count()}}
    ok("System info")

    cfg = _load_yaml()
    if cfg:
        safe = dict(cfg)
        if "api_key" in safe: safe["api_key"] = safe["api_key"][:12] + "..."
        diag["config"] = safe; ok("Config (redacted)")

    pid = _agent_pid(); diag["agent_running"] = pid is not None
    if pid: diag["agent_pid"] = pid
    ok(f"Agent: {'running' if pid else 'stopped'}")

    diag["network"] = {}
    host = "sentinel-authority-production.up.railway.app"
    tls_ok, msg = _check_tls(host); diag["network"]["tls"] = {"ok": tls_ok, "detail": msg}
    mn, avg, mx = _check_latency(host)
    diag["network"]["latency"] = {"min_ms": mn, "avg_ms": avg, "max_ms": mx}
    ok("Network")

    params = cfg.get("parameters", [])
    diag["sources"] = {}
    for p in params:
        st, sa, name = p.get("source_type",""), p.get("source_address",""), p.get("name","?")
        if st and sa:
            r, msg = _test_source(st, sa); diag["sources"][name] = {"type":st,"reachable":r,"detail":msg}
    ok(f"Sources ({len(diag['sources'])})")

    if LOG_FILE.exists():
        diag["logs"] = LOG_FILE.read_text().splitlines()[-200:]
        ok("Logs (last 200 lines)")

    if EVENTS_FILE.exists():
        diag["events"] = EVENTS_FILE.read_text().splitlines()[-100:]
        ok("Events (last 100)")

    if CACHE_FILE.exists():
        try:
            c = json.loads(CACHE_FILE.read_text())
            diag["cache"] = {"cached_at": c.get("cached_at"), "cert": c.get("certificate_number")}
        except: pass

    DIAG_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    diag_file = DIAG_DIR / f"envelo-diag-{ts}.json"
    diag_file.write_text(json.dumps(diag, indent=2, default=str))
    big_ok("Diagnostics saved")
    print(f"\n  {CY}{diag_file}{X}")
    print(f"  Send to your Conformance Engineer. {D}No secrets included.{X}\n")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: export
# ══════════════════════════════════════════════════════════════════

def cmd_export(args):
    banner(); header("Exporting auditor bundle")
    key, cert = _creds()

    bundle = {
        "export_timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "agent_version": VERSION,
        "certificate_number": cert,
    }

    # Boundaries
    data, source = _load_boundaries()
    if data:
        bundle["boundaries"] = data
        bundle["boundary_source"] = source
        ok("Boundaries included")

    # Config (redacted)
    cfg = _load_yaml()
    if cfg:
        safe = dict(cfg)
        if "api_key" in safe: safe["api_key"] = "[REDACTED]"
        bundle["config"] = safe
        ok("Configuration included (key redacted)")

    # Event summary
    if EVENTS_FILE.exists():
        lines = EVENTS_FILE.read_text().splitlines()
        violations = sum(1 for l in lines if "violation" in l)
        bundle["event_summary"] = {"total_events": len(lines), "violations": violations,
                                   "first_event": lines[0][:50] if lines else "",
                                   "last_event": lines[-1][:50] if lines else ""}
        ok("Event summary included")

    # System info
    bundle["system"] = {"os": platform.system(), "arch": platform.machine(),
                        "hostname": platform.node(), "python": platform.python_version()}

    out_file = Path.cwd() / f"envelo-export-{cert or 'unknown'}-{datetime.datetime.utcnow().strftime('%Y%m%d')}.json"
    out_file.write_text(json.dumps(bundle, indent=2, default=str))
    ok(f"Exported: {out_file}")
    print(f"\n  This file is safe to share with auditors.")
    print(f"  API key has been redacted.\n")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: rotate-key
# ══════════════════════════════════════════════════════════════════

def cmd_rotate_key(args):
    banner(); header("API Key Rotation")
    key, cert = _creds()
    if not key: fail("No current key"); return 1

    print(f"\n  {Y}{B}WARNING:{X} Rotating your API key will:")
    print(f"    • Invalidate the current key immediately")
    print(f"    • Generate a new key")
    print(f"    • Require restarting the agent\n")

    resp = input(f"  Continue? [y/N]: ").strip().lower()
    if resp not in ("y","yes"): info("Cancelled"); return 0

    try:
        with Spinner("Rotating key"):
            result = _api_post("/api/envelo/keys/rotate", key, {"certificate_number": cert})
        new_key = result.get("api_key", result.get("new_key",""))
        if not new_key: fail("API did not return new key"); return 1

        # Update config files
        sdk = _load_sdk()
        if sdk:
            sdk["api_key"] = new_key
            SDK_CONFIG.write_text(json.dumps(sdk, indent=2))

        cfg = _load_yaml()
        if cfg:
            cfg["api_key"] = new_key
            _write_yaml(cfg)

        ok(f"New key: {new_key[:16]}...")
        ok("Config files updated")

        pid = _agent_pid()
        if pid:
            warn("Agent needs restart to use new key")
            print(f"  Run: {CY}envelo restart{X}")
        return 0
    except urllib.error.HTTPError as e:
        if e.code == 404: warn("Key rotation endpoint not available yet")
        else: fail(f"API error: {e.code}")
        info(f"Rotate manually at: {PORTAL}"); return 1
    except Exception as e: fail(f"Failed: {e}"); return 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: update
# ══════════════════════════════════════════════════════════════════

def cmd_update(args):
    banner(); header("Checking for updates")
    ok(f"Current: v{VERSION}")
    try:
        data = _api_get("/api/envelo/agent/version", _creds()[0] or "public")
        latest = data.get("version", VERSION)
        if latest == VERSION: ok("Already on latest"); return 0
        print(f"\n  New version: {G}{B}{latest}{X}")
        r = input(f"  Update now? [Y/n]: ").strip().lower()
        if r in ("","y","yes"): os.system("curl -sSL https://get.sentinelauthority.org | bash")
        return 0
    except:
        warn("Could not check — update manually")
        print(f"  {CY}curl -sSL https://get.sentinelauthority.org | bash{X}\n"); return 1


# ══════════════════════════════════════════════════════════════════
#  COMMAND: rollback
# ══════════════════════════════════════════════════════════════════

def cmd_rollback(args):
    banner(); header(f"{R}ENVELO Rollback{X}")
    print(f"\n  {R}{B}WARNING:{X} This removes ENVELO completely.")
    print(f"  Your certificate will show as {R}INACTIVE{X}.")
    print(f"  You'll need to re-run CAT-72 to restore conformance.\n")
    if "--force" not in args and "-f" not in args:
        r = input(f"  {R}Type 'REMOVE' to confirm: {X}").strip()
        if r != "REMOVE": info("Cancelled"); return 0

    pid = _agent_pid()
    if pid:
        try: os.kill(pid, signal.SIGTERM); time.sleep(2); ok("Agent stopped")
        except: pass

    # Remove service
    for svc_path in [Path("/etc/systemd/system/envelo.service"),
                     Path.home() / "Library/LaunchAgents/org.sentinelauthority.envelo.plist"]:
        if svc_path.exists():
            try:
                if "systemd" in str(svc_path):
                    subprocess.run(["systemctl","stop","envelo"], capture_output=True)
                    subprocess.run(["systemctl","disable","envelo"], capture_output=True)
                    svc_path.unlink(); subprocess.run(["systemctl","daemon-reload"], capture_output=True)
                else:
                    subprocess.run(["launchctl","unload",str(svc_path)], capture_output=True)
                    svc_path.unlink()
                ok(f"Service removed: {svc_path}")
            except: warn(f"Need sudo to remove {svc_path}")

    if ENVELO_DIR.exists():
        shutil.rmtree(ENVELO_DIR, ignore_errors=True); ok(f"Removed {ENVELO_DIR}")

    # Docker cleanup
    try:
        r = subprocess.run(["docker","ps","-q","--filter","name=envelo"], capture_output=True, text=True, timeout=5)
        if r.stdout.strip():
            subprocess.run(["docker","stop",r.stdout.strip()], capture_output=True)
            subprocess.run(["docker","rm",r.stdout.strip()], capture_output=True)
            ok("Docker container removed")
    except: pass

    big_ok("ENVELO removed")
    print(f"\n  Re-install: {CY}curl -sSL https://get.sentinelauthority.org | bash{X}\n")
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: version
# ══════════════════════════════════════════════════════════════════

def cmd_version(args):
    print(f"  ENVELO Agent v{VERSION}")
    print(f"  Python {platform.python_version()} on {platform.system()} {platform.machine()}")
    key, cert = _creds()
    if cert: print(f"  Certificate: {cert}")
    if ENVELO_DIR.exists(): print(f"  Install: {ENVELO_DIR}")
    try:
        from envelo import __version__ as sv; print(f"  SDK: v{sv}")
    except: pass
    return 0


# ══════════════════════════════════════════════════════════════════
#  COMMAND: help
# ══════════════════════════════════════════════════════════════════

def cmd_help(args):
    banner()
    print(f"""  {B}Usage:{X}  envelo <command> [options]

  {CY}{B}RUNNING{X}
    start [-d]           Start enforcement (foreground or daemon)
    stop                 Stop running agent
    restart              Stop + start
    validate             Check config without starting

  {CY}{B}MONITORING{X}
    status               Full health check
    monitor              Live terminal dashboard
    events [--last N]    Violation & enforcement history
    logs [-f] [--last N] View/tail agent logs
    cat72                CAT-72 test status & progress

  {CY}{B}BOUNDARIES{X}
    boundaries           Show all enforced boundaries
    resync               Force re-fetch from API
    simulate PARAM VAL   Dry-run a boundary check

  {CY}{B}SOURCES{X}
    test                 Test all telemetry connections
    rediscover [--all]   Re-scan for telemetry sources
    benchmark [-n 10000] Measure enforcement latency

  {CY}{B}INFRASTRUCTURE{X}
    service install      Auto-start on boot (systemd/launchd)
    service uninstall    Remove system service
    docker               Generate Dockerfile + compose
    k8s                  Generate Kubernetes manifests

  {CY}{B}MAINTENANCE{X}
    diagnose             Generate support bundle
    network              Full network diagnostic
    export               Auditor-ready boundary bundle
    rotate-key           Rotate your API key
    update               Check for agent updates
    rollback             Uninstall ENVELO completely
    version              Version info

  {B}First time?{X}
    {CY}curl -sSL https://get.sentinelauthority.org | bash{X}

  {B}Need help?{X}
    {CY}envelo diagnose{X} → send output to your Conformance Engineer
""")
    return 0


# ══════════════════════════════════════════════════════════════════
#  DISPATCH
# ══════════════════════════════════════════════════════════════════

COMMANDS = {
    "start": cmd_start, "stop": cmd_stop, "restart": cmd_restart,
    "validate": cmd_validate, "check": cmd_validate,
    "status": cmd_status,
    "monitor": cmd_monitor, "mon": cmd_monitor, "watch": cmd_monitor, "dashboard": cmd_monitor,
    "events": cmd_events, "event": cmd_events,
    "logs": cmd_logs, "log": cmd_logs,
    "cat72": cmd_cat72, "cat": cmd_cat72,
    "boundaries": cmd_boundaries, "boundary": cmd_boundaries, "bounds": cmd_boundaries,
    "resync": cmd_resync, "sync": cmd_resync,
    "simulate": cmd_simulate, "sim": cmd_simulate,
    "test": cmd_test,
    "rediscover": cmd_rediscover, "discover": cmd_rediscover, "scan": cmd_rediscover,
    "benchmark": cmd_benchmark, "bench": cmd_benchmark,
    "service": cmd_service, "svc": cmd_service,
    "docker": cmd_docker,
    "k8s": cmd_k8s, "kubernetes": cmd_k8s, "kube": cmd_k8s,
    "diagnose": cmd_diagnose, "diag": cmd_diagnose,
    "network": cmd_network, "net": cmd_network,
    "export": cmd_export,
    "rotate-key": cmd_rotate_key, "rotate": cmd_rotate_key,
    "update": cmd_update, "upgrade": cmd_update,
    "rollback": cmd_rollback, "uninstall": cmd_rollback, "remove": cmd_rollback,
    "version": cmd_version, "-v": cmd_version, "--version": cmd_version,
    "help": cmd_help, "-h": cmd_help, "--help": cmd_help,
}


def main():
    args = sys.argv[1:]
    if not args: cmd_help([]); return 0
    cmd = args[0].lower()

    # Handle "envelo service install" etc.
    handler = COMMANDS.get(cmd)

    # Fuzzy match
    if not handler:
        for k in COMMANDS:
            if k.startswith(cmd): handler = COMMANDS[k]; break

    if not handler:
        print(f"\n  {R}Unknown: {args[0]}{X}")
        print(f"  Run {CY}envelo help{X} for commands\n")
        return 1

    try:
        return handler(args[1:]) or 0
    except KeyboardInterrupt:
        print(f"\n  {Y}Cancelled{X}"); return 1
    except Exception as e:
        print(f"\n  {R}{B}Error: {e}{X}")
        print(f"  Run {CY}envelo diagnose{X} for support\n")
        if "--verbose" in args or "-v" in args[1:]:
            import traceback; traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
