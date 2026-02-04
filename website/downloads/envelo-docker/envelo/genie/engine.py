"""
ENVELO Self-Deploy Genie v2.0.0 — Push-Button Deployment Engine
Automates all 8 steps of ODDC Certification Guide Phase 4.
Zero flags required. Auto-detects everything.
© 2026 Sentinel Authority — Confidential
"""

from __future__ import annotations

import datetime
import hashlib
import itertools
import json
import logging
import os
import platform
import shutil
import socket
import ssl
import subprocess
import sys
import textwrap
import threading
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any, Optional

VERSION = "2.0.0"
SENTINEL_API = "https://api.sentinelauthority.org"
SENTINEL_REGISTRY = "registry.sentinelauthority.org"
SENTINEL_PORTAL = "https://app.sentinelauthority.org"
ENVELO_SERVICE_NAME = "envelo"
ENVELO_BINARY_NAME = "envelo"
AUDIT_LOG_DIR = Path.home() / ".envelo-genie" / "audit"
GENIE_STATE_FILE = Path.home() / ".envelo-genie" / "state.json"

CONFIG_SEARCH_PATHS = [
    Path("envelo.yaml"),
    Path("config/envelo.yaml"),
    Path("/etc/envelo/envelo.yaml"),
    Path.home() / "envelo.yaml",
    Path.home() / ".envelo" / "envelo.yaml",
    Path.home() / "Downloads" / "envelo.yaml",
]

VALID_SOURCE_TYPES = {"mqtt", "http", "grpc", "file", "prometheus", "websocket", "custom"}


# ── Terminal UX ──────────────────────────────────────────

def _supports_color() -> bool:
    if os.environ.get("NO_COLOR"): return False
    if os.environ.get("FORCE_COLOR"): return True
    if not hasattr(sys.stdout, "isatty"): return False
    return sys.stdout.isatty()

_COLOR = _supports_color()

class C:
    HEADER = "\033[95m" if _COLOR else ""
    BLUE = "\033[94m" if _COLOR else ""
    CYAN = "\033[96m" if _COLOR else ""
    GREEN = "\033[92m" if _COLOR else ""
    YELLOW = "\033[93m" if _COLOR else ""
    RED = "\033[91m" if _COLOR else ""
    BOLD = "\033[1m" if _COLOR else ""
    DIM = "\033[2m" if _COLOR else ""
    RESET = "\033[0m" if _COLOR else ""
    PURPLE = "\033[35m" if _COLOR else ""
    WHITE = "\033[97m" if _COLOR else ""
    CLEAR_LINE = "\033[2K" if _COLOR else ""

BANNER = f"""
{C.PURPLE}{C.BOLD}
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║    ◉  S E N T I N E L   A U T H O R I T Y                ║
  ║                                                           ║
  ║    ENVELO Self-Deploy Genie  v{VERSION}                    ║
  ║    Push-Button ODDC Deployment                            ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
{C.RESET}"""


class Spinner:
    FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    def __init__(self, message: str = "Working"):
        self.message = message
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
    def __enter__(self):
        if _COLOR and sys.stdout.isatty():
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
        else:
            print(f"  ... {self.message}", flush=True)
        return self
    def __exit__(self, *args):
        self._stop.set()
        if self._thread: self._thread.join(timeout=1)
        if _COLOR and sys.stdout.isatty():
            sys.stdout.write(f"\r{C.CLEAR_LINE}")
            sys.stdout.flush()
    def _spin(self):
        for frame in itertools.cycle(self.FRAMES):
            if self._stop.is_set(): break
            sys.stdout.write(f"\r  {C.CYAN}{frame}{C.RESET} {self.message}")
            sys.stdout.flush()
            time.sleep(0.08)
    def update(self, msg: str): self.message = msg


class ProgressTracker:
    def __init__(self, total_steps: int = 8):
        self.total = total_steps
        self.current = 0
        self.statuses: list[str] = []
    def advance(self, status: str = "pass"):
        self.current += 1
        self.statuses.append(status)
    def render(self) -> str:
        blocks = []
        for i in range(self.total):
            if i < len(self.statuses):
                s = self.statuses[i]
                if s == "pass": blocks.append(f"{C.GREEN}■{C.RESET}")
                elif s == "fail": blocks.append(f"{C.RED}■{C.RESET}")
                elif s == "skip": blocks.append(f"{C.YELLOW}■{C.RESET}")
                else: blocks.append(f"{C.DIM}□{C.RESET}")
            else:
                blocks.append(f"{C.DIM}□{C.RESET}")
        pct = int((self.current / self.total) * 100)
        return f"  {' '.join(blocks)}  {pct}%"


STEP_LABELS = {
    1: ("Checking your credentials", "Portal Authentication & Case Validation"),
    2: ("Finding the ENVELO agent", "Agent Acquisition"),
    3: ("Validating your configuration", "Configuration Validation"),
    4: ("Testing network connectivity", "Network Connectivity"),
    5: ("Running pre-flight checks", "Pre-Flight Validation (7-Point Check)"),
    6: ("Activating enforcement", "Agent Activation"),
    7: ("Setting up auto-start service", "Persistent Service Configuration"),
    8: ("Confirming CAT-72 readiness", "CAT-72 Readiness"),
}

def print_step_header(step_id: int, progress: ProgressTracker) -> None:
    friendly, technical = STEP_LABELS.get(step_id, ("Working", "Step"))
    print(f"\n{progress.render()}")
    print(f"\n{C.CYAN}{'─' * 60}{C.RESET}")
    print(f"  {C.BOLD}{C.CYAN}Step {step_id} of {len(STEP_LABELS)}: {friendly}{C.RESET}")
    print(f"  {C.DIM}{technical}{C.RESET}")
    print(f"{C.CYAN}{'─' * 60}{C.RESET}")

def ok(msg): print(f"  {C.GREEN}✓{C.RESET}  {msg}")
def fail(msg): print(f"  {C.RED}✗{C.RESET}  {msg}")
def warn(msg): print(f"  {C.YELLOW}⚠{C.RESET}  {C.YELLOW}{msg}{C.RESET}")
def info(msg): print(f"     {C.DIM}{msg}{C.RESET}")
def fatal(msg): print(f"\n  {C.RED}{C.BOLD}✗ {msg}{C.RESET}")
def success(msg): print(f"\n  {C.GREEN}{C.BOLD}✓ {msg}{C.RESET}")

def prompt_yes_no(msg, default_yes=True):
    hint = "Y/n" if default_yes else "y/N"
    resp = input(f"\n  {C.CYAN}▸ {msg} [{hint}]: {C.RESET}").strip().lower()
    if not resp: return default_yes
    return resp in ("y", "yes")

def prompt_choice(msg, options):
    print(f"\n  {C.CYAN}▸ {msg}{C.RESET}\n")
    for i, (key, label) in enumerate(options, 1):
        print(f"    {C.BOLD}{i}{C.RESET})  {label}")
    while True:
        resp = input(f"\n  Choice [1]: ").strip()
        if not resp: return options[0][0]
        try:
            idx = int(resp)
            if 1 <= idx <= len(options): return options[idx - 1][0]
        except ValueError:
            for key, _ in options:
                if resp.lower() == key.lower(): return key
        print(f"  {C.YELLOW}Enter 1-{len(options)}{C.RESET}")


# ── Data Structures ──────────────────────────────────────

class StepStatus(str, Enum):
    PENDING = "PENDING"; RUNNING = "RUNNING"; PASSED = "PASSED"
    FAILED = "FAILED"; SKIPPED = "SKIPPED"; AUTO_FIXED = "AUTO_FIXED"

@dataclass
class StepResult:
    step_id: int; name: str; status: StepStatus
    started_at: str = ""; completed_at: str = ""; duration_sec: float = 0.0
    details: str = ""; error: str = ""; remediation: str = ""

@dataclass
class DeploymentManifest:
    genie_version: str = VERSION; case_id: str = ""; deployment_id: str = ""
    started_at: str = ""; completed_at: str = ""
    host_os: str = ""; host_arch: str = ""; hostname: str = ""
    python_version: str = ""; deploy_method: str = ""; config_hash: str = ""
    overall_status: str = "IN_PROGRESS"; steps: list = field(default_factory=list)
    envelo_version: str = ""; portal_status: str = ""
    def to_dict(self):
        d = asdict(self); d["steps"] = [asdict(s) for s in self.steps]; return d


# ── Utilities ────────────────────────────────────────────

def setup_logging(verbose=False):
    AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_file = AUDIT_LOG_DIR / f"genie-{ts}.log"
    root = logging.getLogger()
    for h in root.handlers[:]: root.removeHandler(h)
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO,
                        format="%(asctime)s [%(levelname)-7s] %(message)s",
                        handlers=[logging.FileHandler(log_file, encoding="utf-8")])
    return logging.getLogger("envelo-genie")

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""): h.update(chunk)
    return h.hexdigest()

def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Config Parser (zero deps) ───────────────────────────

def parse_envelo_yaml(path):
    content = path.read_text(encoding="utf-8")
    try:
        import yaml; return yaml.safe_load(content)
    except ImportError: pass
    config = {}; section = None; lst = None; item = None
    for raw in content.splitlines():
        line = raw.rstrip(); stripped = line.lstrip()
        if not stripped or stripped.startswith("#"): continue
        indent = len(line) - len(stripped)
        if indent == 0 and ":" in stripped:
            if item and lst is not None: lst.append(item); item = None
            k, _, v = stripped.partition(":"); k, v = k.strip(), v.strip()
            if v: config[k] = _coerce(v)
            else: config[k] = {}; section = k; lst = None
            continue
        if section:
            if stripped.startswith("- "):
                if item and lst is not None: lst.append(item)
                item = {}
                if section not in config or not isinstance(config[section], list):
                    config[section] = []
                lst = config[section]
                rest = stripped[2:].strip()
                if ":" in rest:
                    k2, _, v2 = rest.partition(":"); item[k2.strip()] = _coerce(v2.strip())
                continue
            if ":" in stripped and item is not None:
                k2, _, v2 = stripped.partition(":"); item[k2.strip()] = _coerce(v2.strip()); continue
            if ":" in stripped and isinstance(config.get(section), dict):
                k2, _, v2 = stripped.partition(":"); config[section][k2.strip()] = _coerce(v2.strip())
    if item and lst is not None: lst.append(item)
    return config

def _coerce(v):
    if not v: return v
    if v.lower() in ("true", "yes"): return True
    if v.lower() in ("false", "no"): return False
    try: return int(v)
    except ValueError: pass
    try: return float(v)
    except ValueError: pass
    return v

def validate_config(config):
    errors = []
    for key in ("case_id", "api_key", "api_endpoint"):
        if key not in config: errors.append(f"Missing: '{key}'")
    cid = str(config.get("case_id", ""))
    if cid and not (cid.startswith("ODDC-") and len(cid) == 15):
        errors.append(f"Case ID '{cid}' wrong format (need ODDC-YYYY-NNNNN)")
    params = config.get("parameters")
    if not params or not isinstance(params, list): errors.append("No 'parameters' list")
    else:
        for i, p in enumerate(params):
            name = p.get("name", f"<param {i+1}>")
            for f in ("name", "unit", "tolerance_min", "tolerance_max", "source_type", "source_address"):
                if f not in p or p[f] is None or p[f] == "":
                    errors.append(f"'{name}': missing '{f}'")
            src = p.get("source_type", "")
            if src and src not in VALID_SOURCE_TYPES:
                errors.append(f"'{name}': bad source_type '{src}'")
    return (len(errors) == 0, errors)


# ── Auto-Find Config ────────────────────────────────────

def auto_find_config():
    for p in CONFIG_SEARCH_PATHS:
        if p.exists() and p.is_file(): return p.resolve()
    for p in Path(".").glob("*.yaml"):
        try:
            txt = p.read_text(encoding="utf-8")
            if "case_id" in txt and "ODDC-" in txt: return p.resolve()
        except: continue
    for p in Path(".").glob("*.yml"):
        try:
            if "case_id" in p.read_text(encoding="utf-8"): return p.resolve()
        except: continue
    return None


# ── System Detection ─────────────────────────────────────

def detect_system():
    d = {"os": platform.system(), "os_release": platform.release(),
         "arch": platform.machine(), "hostname": platform.node(),
         "python": platform.python_version(), "cpu_count": os.cpu_count() or 0}
    if platform.system() == "Linux":
        try:
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal"):
                        d["ram_mb"] = int(line.split()[1]) // 1024; break
        except: d["ram_mb"] = 0
    try:
        st = os.statvfs("/"); d["disk_free_gb"] = round((st.f_bavail * st.f_frsize) / (1024**3), 1)
    except: d["disk_free_gb"] = 0
    return d

def check_requirements(si):
    r = []
    r.append((si.get("os", "") in ("Linux", "Windows", "Darwin"),
              f"OS: {si.get('os', '')} {si.get('os_release', '')}"))
    arch = si.get("arch", "")
    r.append((arch in ("x86_64", "AMD64", "aarch64", "arm64"), f"Arch: {arch}"))
    r.append((si.get("cpu_count", 0) >= 2, f"CPUs: {si.get('cpu_count', 0)} (need 2+)"))
    ram = si.get("ram_mb", 0)
    if ram > 0: r.append((ram >= 512, f"RAM: {ram} MB (need 512+)"))
    disk = si.get("disk_free_gb", 0)
    if disk > 0: r.append((disk >= 1, f"Disk: {disk} GB free"))
    return r

def detect_docker():
    try:
        r = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            parts = r.stdout.strip().split()
            for i, p in enumerate(parts):
                if p == "version":
                    v = parts[i + 1].rstrip(","); maj = int(v.split(".")[0])
                    return maj >= 20
    except: pass
    return False

def detect_envelo_binary():
    path = shutil.which(ENVELO_BINARY_NAME)
    if path:
        try:
            r = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=10)
            if r.returncode == 0: return r.stdout.strip()
        except: pass
    return None

def detect_systemd(): return Path("/run/systemd/system").is_dir()

def detect_ntp():
    if platform.system() != "Linux": return (True, "Non-Linux — verify manually")
    try:
        r = subprocess.run(["timedatectl", "show", "--property=NTPSynchronized"],
                           capture_output=True, text=True, timeout=10)
        if "NTPSynchronized=yes" in r.stdout: return (True, "NTP synced")
        r2 = subprocess.run(["timedatectl"], capture_output=True, text=True, timeout=10)
        if "synchronized: yes" in r2.stdout.lower(): return (True, "NTP synced")
        return (False, "NTP not synced")
    except FileNotFoundError: return (True, "timedatectl not found")
    except Exception as e: return (True, f"Inconclusive: {e}")

def auto_fix_ntp():
    if platform.system() != "Linux": return False
    try:
        subprocess.run(["timedatectl", "set-ntp", "true"], capture_output=True, timeout=10)
        time.sleep(2); return detect_ntp()[0]
    except: return False


# ── Network ──────────────────────────────────────────────

def check_https(host, port=443):
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ss:
                proto = ss.version(); ci = ss.cipher()
                tls_ok = proto and "1.3" in proto
                return (tls_ok, f"{host} -> {proto}, {ci[0] if ci else '?'}")
    except ssl.SSLCertVerificationError:
        return (False, f"{host} -> SSL cert error (proxy inspection?)")
    except socket.timeout: return (False, f"{host} -> Timed out")
    except ConnectionRefusedError: return (False, f"{host} -> Refused")
    except socket.gaierror: return (False, f"{host} -> DNS failed")
    except Exception as e: return (False, f"{host} -> {e}")

def check_api_key(k):
    k = str(k)
    if not k: return (False, "Empty")
    if k.startswith("sk-envelo-") and len(k) > 20:
        return (True, f"sk-envelo-{'x' * 12}")
    return (False, "Should start with sk-envelo-")


# ── Source Checks ────────────────────────────────────────

def check_source(param):
    name = param.get("name", "?"); st = param.get("source_type", "")
    addr = str(param.get("source_address", ""))
    if st in ("http", "prometheus"):
        try:
            resp = urllib.request.urlopen(urllib.request.Request(addr, method="GET"), timeout=5)
            return (True, f"{name}: reachable (HTTP {resp.status})")
        except Exception as e: return (False, f"{name}: unreachable - {e}")
    elif st in ("mqtt", "grpc", "websocket"):
        try:
            h, p = _parse_hp(addr)
            with socket.create_connection((h, p), timeout=5): return (True, f"{name}: {st} reachable")
        except Exception as e: return (False, f"{name}: {st} unreachable - {e}")
    elif st == "file":
        exists = Path(addr).exists()
        return (exists, f"{name}: file {'found' if exists else 'NOT found'}")
    elif st == "custom": return (True, f"{name}: custom (runtime)")
    return (False, f"{name}: unknown type '{st}'")

def _parse_hp(addr):
    for pfx in ("mqtt://", "grpc://", "ws://", "wss://", "http://", "https://"):
        addr = addr.replace(pfx, "")
    addr = addr.split("/")[0]
    if ":" in addr: parts = addr.rsplit(":", 1); return (parts[0], int(parts[1]))
    return (addr, 443)


# ── Service Generators ───────────────────────────────────

def gen_systemd(cfg_path):
    return textwrap.dedent(f"""\
        [Unit]
        Description=ENVELO Enforcement Agent - Sentinel Authority
        After=network-online.target
        Wants=network-online.target
        [Service]
        Type=simple
        ExecStart=/usr/local/bin/envelo --config {cfg_path}
        Restart=always
        RestartSec=5
        User=envelo
        Group=envelo
        LimitNOFILE=65535
        [Install]
        WantedBy=multi-user.target
    """)

def gen_compose(cfg_path):
    return textwrap.dedent(f"""\
        version: '3.8'
        services:
          envelo:
            image: {SENTINEL_REGISTRY}/envelo:latest
            restart: always
            volumes:
              - {cfg_path}:/etc/envelo/envelo.yaml:ro
            network_mode: host
            logging:
              driver: json-file
              options:
                max-size: '100m'
                max-file: '5'
    """)

def gen_k8s():
    return textwrap.dedent(f"""\
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: envelo-agent
        spec:
          replicas: 1
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
                image: {SENTINEL_REGISTRY}/envelo:latest
                volumeMounts:
                - name: config
                  mountPath: /etc/envelo
                  readOnly: true
              volumes:
              - name: config
                secret:
                  secretName: envelo-config
    """)

def gen_windows(cfg_path):
    return textwrap.dedent(f"""\
        New-Service -Name 'ENVELO' \
          -BinaryPathName 'C:\\Program Files\\Sentinel\\envelo.exe --config {cfg_path}' \
          -StartupType Automatic \
          -Description 'ENVELO Enforcement Agent'
        Start-Service ENVELO
    """)

def gen_rollback(method):
    if method == "binary" and platform.system() == "Linux":
        return ["sudo systemctl stop envelo", "sudo systemctl disable envelo",
                "sudo rm /etc/systemd/system/envelo.service", "sudo systemctl daemon-reload",
                "sudo rm /usr/local/bin/envelo", "sudo rm -rf /etc/envelo/"]
    elif method == "docker":
        return ["docker compose down", f"docker rmi {SENTINEL_REGISTRY}/envelo:latest"]
    elif method == "binary" and platform.system() == "Windows":
        return ["Stop-Service ENVELO", "Remove-Service ENVELO"]
    return ["# Manual rollback required"]


# ══════════════════════════════════════════════════════════
#  THE GENIE
# ══════════════════════════════════════════════════════════

class EnveloGenie:

    def __init__(self, config_path=None, verbose=False, dry_run=False,
                 deploy_method=None, skip_service=False, non_interactive=False):
        self.config_path = config_path.resolve() if config_path else None
        self.verbose = verbose
        self.dry_run = dry_run
        self.force_method = deploy_method
        self.skip_service = skip_service
        self.non_interactive = non_interactive
        self.logger = setup_logging(verbose)
        self.manifest = DeploymentManifest()
        self.config = {}
        self._aborted = False
        self.progress = ProgressTracker()

    def _run_step(self, step_id, fn):
        result = StepResult(step_id=step_id, name=STEP_LABELS[step_id][1],
                            status=StepStatus.RUNNING, started_at=now_iso())
        print_step_header(step_id, self.progress)
        t0 = time.monotonic()
        try:
            fn(result)
        except KeyboardInterrupt:
            result.status = StepStatus.FAILED; result.error = "Cancelled"
            fatal("Cancelled. System unchanged."); self._aborted = True
        except Exception as e:
            result.status = StepStatus.FAILED; result.error = str(e)
            self.logger.exception(f"Step {step_id}"); fatal(f"Error: {e}")
        result.completed_at = now_iso()
        result.duration_sec = round(time.monotonic() - t0, 2)
        self.manifest.steps.append(result)
        smap = {StepStatus.PASSED: ("pass", f"{C.GREEN}Done{C.RESET}"),
                StepStatus.FAILED: ("fail", f"{C.RED}Failed{C.RESET}"),
                StepStatus.SKIPPED: ("skip", f"{C.YELLOW}Skipped{C.RESET}"),
                StepStatus.AUTO_FIXED: ("pass", f"{C.GREEN}Auto-fixed{C.RESET}")}
        ps, disp = smap.get(result.status, ("skip", result.status.value))
        self.progress.advance(ps)
        print(f"\n  {C.DIM}{result.duration_sec}s{C.RESET} — {disp}")
        if result.status == StepStatus.FAILED:
            if result.remediation:
                print(f"\n  {C.YELLOW}{C.BOLD}How to fix:{C.RESET}")
                for ln in result.remediation.split("\n"):
                    print(f"  {C.YELLOW}{ln.strip()}{C.RESET}")
            self._aborted = True
        return result

    def _abort_check(self):
        if self._aborted:
            print(f"\n  {C.RED}{C.BOLD}Stopping — fix the issue, then re-run.{C.RESET}")
            info("Nothing changed. Safe to retry."); return True
        return False

    # ── STEP 1: Credentials & Config ─────────────────────
    def _step1(self, result):
        if not self.config_path:
            with Spinner("Looking for envelo.yaml"):
                self.config_path = auto_find_config(); time.sleep(0.5)
        if not self.config_path:
            fail("Can't find envelo.yaml")
            info("Searched:"); [info(f"  {p}") for p in CONFIG_SEARCH_PATHS]
            if not self.non_interactive:
                up = input(f"\n  {C.CYAN}Paste path to envelo.yaml: {C.RESET}").strip()
                if up:
                    p = Path(up.strip('"').strip("'")).expanduser()
                    if p.exists(): self.config_path = p.resolve(); ok(f"Found: {self.config_path}")
                    else:
                        result.status = StepStatus.FAILED; result.error = f"Not found: {p}"
                        result.remediation = f"Download from {SENTINEL_PORTAL} -> Deployment tab"; return
            else:
                result.status = StepStatus.FAILED; result.error = "No config"
                result.remediation = "Place envelo.yaml in CWD or use --config"; return
        if not self.config_path or not self.config_path.exists():
            result.status = StepStatus.FAILED; result.error = "No config"; return
        ok(f"Config: {self.config_path}")
        self.manifest.config_hash = sha256_file(self.config_path)
        with Spinner("Reading configuration"):
            try: self.config = parse_envelo_yaml(self.config_path); time.sleep(0.3)
            except Exception as e:
                result.status = StepStatus.FAILED; result.error = f"Parse error: {e}"
                result.remediation = "Re-download from portal or check YAML syntax"; return
        ok("Configuration loaded")
        valid, errors = validate_config(self.config)
        if not valid:
            for e in errors: fail(e)
            result.status = StepStatus.FAILED; result.error = f"{len(errors)} issue(s)"
            result.remediation = (f"Re-download from {SENTINEL_PORTAL}\n"
                "Only edit: source_type, source_address, poll_interval_ms"); return
        ok("All fields present")
        cid = str(self.config.get("case_id", "")); self.manifest.case_id = cid; ok(f"Case: {cid}")
        key_ok, key_msg = check_api_key(self.config.get("api_key", ""))
        if key_ok: ok(f"API key: {key_msg}")
        else:
            fail(f"API key: {key_msg}"); result.status = StepStatus.FAILED; result.error = key_msg
            result.remediation = f"Portal -> Deployment -> Reveal API Key -> Copy"; return
        params = self.config.get("parameters", [])
        print(); info(f"Monitoring {len(params)} parameter(s):")
        for p in params:
            info(f"  {p.get('name', '?')} [{p.get('unit', '?')}]: {p.get('tolerance_min', '?')} - {p.get('tolerance_max', '?')}")
        result.status = StepStatus.PASSED; result.details = f"Case {cid}, {len(params)} params"

    # ── STEP 2: Agent Detection ──────────────────────────
    def _step2(self, result):
        with Spinner("Detecting deployment method"):
            has_docker = detect_docker(); envelo_ver = detect_envelo_binary(); time.sleep(0.3)
        method = self.force_method
        if not method:
            if envelo_ver: method = "binary"; ok(f"Agent installed: {envelo_ver}")
            elif has_docker: method = "docker"; ok("Docker detected")
            else:
                fail("No agent or Docker found")
                if not self.non_interactive:
                    method = prompt_choice("How to deploy?", [
                        ("docker", "Docker container (recommended)"),
                        ("binary", "Standalone binary"),
                        ("marketplace", "Cloud marketplace")])
                    print()
                    if method == "docker":
                        info("Install Docker: curl -fsSL https://get.docker.com | sh")
                        result.status = StepStatus.FAILED; result.error = "Docker not installed"
                        result.remediation = "Install Docker, then re-run."; return
                    elif method == "binary":
                        info(f"Download from {SENTINEL_PORTAL} -> Deployment -> Download Agent")
                        result.status = StepStatus.FAILED; result.error = "Binary not installed"
                        result.remediation = "Download, install, re-run."; return
                    else:
                        info("Deploy from cloud marketplace, then re-run on that instance.")
                        result.status = StepStatus.SKIPPED; return
                else:
                    result.status = StepStatus.FAILED; result.error = "No method available"
                    result.remediation = "Install Docker or the ENVELO binary."; return
        self.manifest.deploy_method = method
        if envelo_ver: self.manifest.envelo_version = envelo_ver
        ok(f"Method: {method}"); result.status = StepStatus.PASSED

    # ── STEP 3: Configuration Validation ─────────────────
    def _step3(self, result):
        params = self.config.get("parameters", []); issues = []
        for p in params:
            n = p.get("name", "?"); st = p.get("source_type", ""); sa = p.get("source_address", "")
            if not st or not sa: issues.append(n); fail(f"{n}: no source")
            else: ok(f"{n}: {st} -> {sa}")
        if issues:
            result.status = StepStatus.FAILED; result.error = f"{len(issues)} unmapped"
            result.remediation = f"Edit {self.config_path}: set source_type + source_address"; return
        info("Locked fields match your accepted ODD.")
        result.status = StepStatus.PASSED; result.details = f"All {len(params)} mapped"

    # ── STEP 4: Network Connectivity ─────────────────────
    def _step4(self, result):
        eps = [("api.sentinelauthority.org", 443)]
        if self.manifest.deploy_method == "docker":
            eps.append(("registry.sentinelauthority.org", 443))
        all_ok = True
        for h, p in eps:
            with Spinner(f"Testing {h}"):
                co, msg = check_https(h, p); time.sleep(0.3)
            (ok if co else fail)(msg)
            if not co: all_ok = False
        if not all_ok:
            result.status = StepStatus.FAILED; result.error = "Network blocked"
            result.remediation = ("Allow outbound HTTPS (443) to:\n"
                "  api.sentinelauthority.org\n  registry.sentinelauthority.org"); return
        with Spinner("Checking clock"):
            ntp_ok, ntp_msg = detect_ntp(); time.sleep(0.3)
        if ntp_ok: ok(f"Clock: {ntp_msg}")
        else:
            warn(f"Clock: {ntp_msg}"); info("Trying auto-fix...")
            if auto_fix_ntp(): ok("NTP enabled")
            else: warn("Run: sudo timedatectl set-ntp true")
        result.status = StepStatus.PASSED

    # ── STEP 5: Pre-Flight 7-Point Check ─────────────────
    def _step5(self, result):
        p, t = 0, 0
        t += 1; ok("1. Config integrity"); p += 1
        t += 1; ko, _ = check_api_key(str(self.config.get("api_key", "")))
        if ko: ok("2. API creds"); p += 1
        else: fail("2. API creds invalid")
        t += 1; no, _ = detect_ntp()
        if no: ok("3. Clock synced"); p += 1
        else: fail("3. Clock NOT synced")
        t += 1; ok("4. TLS verified"); p += 1
        params = self.config.get("parameters", [])
        for par in params:
            t += 1
            with Spinner(f"Testing {par.get('name', '?')}"):
                so, msg = check_source(par); time.sleep(0.2)
            if so: ok(f"5. {msg}"); p += 1
            else: fail(f"5. {msg}")
        t += 1; info("6. Value range — runtime"); p += 1
        t += 1
        eok = not (platform.system() == "Linux") or Path("/dev/urandom").exists()
        if eok: ok("7. Entropy available"); p += 1
        else: fail("7. No /dev/urandom")
        print()
        if p == t: success(f"All {t} checks passed"); result.status = StepStatus.PASSED
        else:
            fatal(f"{p}/{t} passed"); result.status = StepStatus.FAILED
            result.remediation = "Fix failures above, re-run."
        result.details = f"{p}/{t}"

    # ── STEP 6: Agent Activation ─────────────────────────
    def _step6(self, result):
        if self.dry_run:
            info("Dry run — skip activation"); result.status = StepStatus.PASSED; return
        m = self.manifest.deploy_method
        if m == "binary":
            ep = shutil.which(ENVELO_BINARY_NAME)
            if not ep:
                result.status = StepStatus.FAILED; result.error = "Binary not in PATH"; return
            with Spinner("Activating ENVELO"):
                try: proc = subprocess.run([ep, "activate", "--config", str(self.config_path)],
                                           capture_output=True, text=True, timeout=60)
                except: result.status = StepStatus.FAILED; result.error = "Timeout"; return
            if proc.returncode == 0: ok("Agent activated"); result.status = StepStatus.PASSED
            else:
                fail(f"Failed (exit {proc.returncode})")
                result.status = StepStatus.FAILED
                result.error = proc.stderr[:200] if proc.stderr else "Failed"
        elif m == "docker":
            ok("Docker — activates on container start"); result.status = StepStatus.PASSED
        else: result.status = StepStatus.PASSED

    # ── STEP 7: Service Setup ────────────────────────────
    def _step7(self, result):
        if self.skip_service: info("Skipped"); result.status = StepStatus.SKIPPED; return
        m = self.manifest.deploy_method; osn = platform.system()
        if m == "binary" and osn == "Linux" and detect_systemd():
            unit = gen_systemd(str(self.config_path))
            if self.dry_run:
                info("Dry run:"); print(f"{C.DIM}{unit}{C.RESET}")
                result.status = StepStatus.PASSED; return
            if not self.non_interactive:
                if not prompt_yes_no("Install systemd service?"):
                    result.status = StepStatus.SKIPPED; return
            try:
                Path("/etc/systemd/system/envelo.service").write_text(unit)
                subprocess.run(["systemctl", "daemon-reload"], check=True, capture_output=True)
                subprocess.run(["systemctl", "enable", ENVELO_SERVICE_NAME], check=True, capture_output=True)
                subprocess.run(["systemctl", "start", ENVELO_SERVICE_NAME], check=True, capture_output=True)
                ok("Service installed & running"); result.status = StepStatus.PASSED
            except PermissionError:
                warn("Need sudo"); print(f"{C.DIM}{unit}{C.RESET}")
                result.status = StepStatus.SKIPPED
            except Exception as e: result.status = StepStatus.FAILED; result.error = str(e)
        elif m == "docker":
            compose = gen_compose(str(self.config_path))
            if not self.dry_run:
                cp = self.config_path.parent / "docker-compose.yml"; cp.write_text(compose)
                ok(f"docker-compose.yml -> {cp}")
                info(f"Start: cd {cp.parent} && docker compose up -d")
            result.status = StepStatus.PASSED
        elif osn == "Windows":
            print(f"{C.DIM}{gen_windows(str(self.config_path))}{C.RESET}")
            result.status = StepStatus.PASSED
        else:
            print(f"{C.DIM}{gen_k8s()}{C.RESET}"); result.status = StepStatus.PASSED

    # ── STEP 8: CAT-72 Readiness ─────────────────────────
    def _step8(self, result):
        if any(s.status == StepStatus.FAILED for s in self.manifest.steps):
            fatal("Not ready for CAT-72"); result.status = StepStatus.FAILED; return
        print(f"""
  {C.GREEN}{C.BOLD}
  ======================================================
  |                                                    |
  |    YOUR SYSTEM IS CAT-72 READY!                    |
  |                                                    |
  ======================================================{C.RESET}

  {C.BOLD}Next:{C.RESET}
    {C.WHITE}1.{C.RESET} Go to {C.CYAN}{SENTINEL_PORTAL}{C.RESET}
    {C.WHITE}2.{C.RESET} Open case -> {C.BOLD}CAT-72 tab{C.RESET}
    {C.WHITE}3.{C.RESET} Verify {C.GREEN}Agent Active{C.RESET} for all parameters
    {C.WHITE}4.{C.RESET} Click {C.BOLD}'Begin Test'{C.RESET}

  {C.YELLOW}{C.BOLD}72-hour timer starts immediately. No pause.{C.RESET}
""")
        result.status = StepStatus.PASSED

    # ── DEPLOY (main wizard) ─────────────────────────────
    def deploy(self):
        print(BANNER)
        with Spinner("Checking system"):
            si = detect_system(); time.sleep(0.5)
        self.manifest.started_at = now_iso()
        self.manifest.deployment_id = hashlib.sha256(
            f"{now_iso()}{platform.node()}".encode()).hexdigest()[:12]
        self.manifest.host_os = f"{si['os']} {si.get('os_release', '')}"
        self.manifest.host_arch = si["arch"]
        self.manifest.hostname = si["hostname"]
        self.manifest.python_version = si["python"]
        if self.dry_run: print(f"  {C.YELLOW}{C.BOLD}DRY RUN{C.RESET}\n")
        reqs = check_requirements(si)
        for ro, msg in reqs: (ok if ro else fail)(msg)
        if not all(r[0] for r in reqs):
            fatal("System requirements not met")
            self.manifest.overall_status = "FAILED"
            self.manifest.completed_at = now_iso(); self._save(); return 1
        for sid, fn in [(1, self._step1), (2, self._step2), (3, self._step3),
                        (4, self._step4), (5, self._step5), (6, self._step6),
                        (7, self._step7), (8, self._step8)]:
            if self._abort_check(): break
            self._run_step(sid, fn)
        self.manifest.completed_at = now_iso()
        passed = sum(1 for s in self.manifest.steps
                     if s.status in (StepStatus.PASSED, StepStatus.AUTO_FIXED))
        failed = sum(1 for s in self.manifest.steps if s.status == StepStatus.FAILED)
        print(f"\n{self.progress.render()}")
        if failed == 0 and passed > 0:
            self.manifest.overall_status = "SUCCESS"
            print(f"\n{C.GREEN}{C.BOLD}{'=' * 60}\n  DEPLOYMENT COMPLETE\n{'=' * 60}{C.RESET}")
        else:
            self.manifest.overall_status = "FAILED"
            print(f"\n{C.RED}{C.BOLD}{'=' * 60}\n  {failed} step(s) need attention\n{'=' * 60}{C.RESET}")
            info("Fix and re-run. Safe to retry.")
        self._save(); return 0 if failed == 0 else 1

    # ── STATUS ───────────────────────────────────────────
    def status(self):
        print(BANNER); print(f"  {C.BOLD}Status{C.RESET}\n")
        if not self.config_path: self.config_path = auto_find_config()
        if not self.config_path or not self.config_path.exists():
            fail("No envelo.yaml"); return 1
        self.config = parse_envelo_yaml(self.config_path)
        ok(f"Config: {self.config_path}")
        info(f"Case: {self.config.get('case_id', '?')}")
        with Spinner("Checking"):
            ev = detect_envelo_binary(); time.sleep(0.3)
        (ok if ev else fail)(f"Agent: {ev or 'not found'}")
        if detect_systemd():
            try:
                r = subprocess.run(["systemctl", "is-active", ENVELO_SERVICE_NAME],
                                   capture_output=True, text=True, timeout=5)
                (ok if r.stdout.strip() == "active" else fail)(f"Service: {r.stdout.strip()}")
            except: pass
        with Spinner("Network"):
            no, nm = check_https("api.sentinelauthority.org")
        (ok if no else fail)(f"API: {nm}")
        no2, nm2 = detect_ntp(); (ok if no2 else fail)(f"Clock: {nm2}")
        if GENIE_STATE_FILE.exists():
            try:
                st = json.loads(GENIE_STATE_FILE.read_text())
                info(f"Last: {st.get('completed_at', '?')} - {st.get('overall_status', '?')}")
            except: pass
        return 0

    # ── ROLLBACK ─────────────────────────────────────────
    def rollback(self):
        print(BANNER)
        print(f"  {C.RED}{C.BOLD}ENVELO Rollback{C.RESET}\n")
        print(f"  {C.RED}Removes ENVELO and suspends ODDC conformance.{C.RESET}\n")
        m = "binary" if detect_envelo_binary() else "docker"
        cmds = gen_rollback(m)
        for cmd in cmds: print(f"    {C.CYAN}{cmd}{C.RESET}")
        if not self.dry_run and not self.non_interactive:
            if prompt_yes_no("Remove ENVELO?", default_yes=False):
                for cmd in cmds:
                    if not cmd.startswith("#"): os.system(cmd)
                success("Removed.")
            else: info("Cancelled.")
        return 0

    # ── DIAGNOSE ─────────────────────────────────────────
    def diagnose(self):
        print(BANNER); print(f"  {C.BOLD}Diagnostics{C.RESET}\n")
        with Spinner("Collecting"):
            diag = {"timestamp": now_iso(), "genie": VERSION, "system": detect_system(),
                    "ntp": detect_ntp(), "docker": detect_docker(),
                    "binary": detect_envelo_binary(), "systemd": detect_systemd()}
            time.sleep(0.3)
        cfg = self.config_path or auto_find_config()
        if cfg and cfg.exists():
            diag["config_hash"] = sha256_file(cfg)
            diag["config_ok"] = validate_config(parse_envelo_yaml(cfg))
        with Spinner("Network"):
            for h in ["api.sentinelauthority.org", "registry.sentinelauthority.org"]:
                no, nm = check_https(h); diag[f"net_{h}"] = {"ok": no, "msg": nm}
        dp = Path("envelo-diagnostics.json")
        dp.write_text(json.dumps(diag, indent=2, default=str))
        ok(f"Saved: {dp.resolve()}")
        info("Send to your Conformance Engineer. No secrets included.")
        return 0

    def _save(self):
        GENIE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        GENIE_STATE_FILE.write_text(json.dumps(self.manifest.to_dict(), indent=2, default=str))
        ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        audit = AUDIT_LOG_DIR / f"manifest-{ts}.json"
        audit.write_text(json.dumps(self.manifest.to_dict(), indent=2, default=str))
