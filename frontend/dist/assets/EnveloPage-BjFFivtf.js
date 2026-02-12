import{a as H,j as e,b as q,u as X,d as p,A as Y}from"./index-DE2YKgEw.js";import{r as i,h as J,m as K,D as Q}from"./icons-DL0PQMVt.js";import{P as h}from"./Panel-DXfHMjAz.js";import{S as G}from"./SectionHeader-tcHwHDiO.js";import"./vendor-DYB3FAiG.js";function Z({apiEndpoint:a,apiKey:y,certificateNumber:g,systemName:b,organizationName:w}){const c=new Date().toISOString();return`#!/usr/bin/env python3
"""
ENVELO Interlock - Sentinel Authority
Enforced Non-Violable Execution-Limit Override

System:       ${b}
Certificate:  ${g}
Organization: ${w}
Generated:    ${c}

DEPLOY:
  pip install httpx
  python envelo_agent.py

INTEGRATE:
  from envelo_agent import agent

  @agent.enforce
  def autonomous_action(speed=0, temperature=0):
      pass  # your logic here
"""

import os, sys, time, json, uuid, signal, threading, logging
from datetime import datetime, timezone
from functools import wraps

try:
    import httpx
except ImportError:
    print("[ENVELO] Installing httpx...")
    os.system(f"{sys.executable} -m pip install httpx -q")
    import httpx

# ${"═".repeat(65)}
# CREDENTIALS (pre-configured by Sentinel Authority)
# ${"═".repeat(65)}
API_ENDPOINT = "${a}"
API_KEY      = "${y}"
CERTIFICATE  = "${g}"
SYSTEM_NAME  = "${b}"

logging.basicConfig(level=logging.INFO, format="[ENVELO] %(message)s")
log = logging.getLogger("envelo")


class Boundary:
    """Single ODD boundary with min/max/hard-limit enforcement."""
    def __init__(self, name, parameter=None, min_value=None, max_value=None,
                 hard_limit=None, unit="", tolerance=0):
        self.name = name
        self.parameter = parameter or name
        self.min_value = float(min_value) if min_value is not None else None
        self.max_value = float(max_value) if max_value is not None else None
        self.hard_limit = float(hard_limit) if hard_limit is not None else None
        self.unit = unit
        self.tolerance = float(tolerance) if tolerance else 0

    def check(self, value):
        v = float(value)
        if self.hard_limit is not None and v > self.hard_limit:
            return False, f"{self.name}={v}{self.unit} exceeds hard limit {self.hard_limit}{self.unit}"
        if self.min_value is not None and v < self.min_value - self.tolerance:
            return False, f"{self.name}={v}{self.unit} below min {self.min_value}{self.unit}"
        if self.max_value is not None and v > self.max_value + self.tolerance:
            return False, f"{self.name}={v}{self.unit} above max {self.max_value}{self.unit}"
        return True, None


class EnveloAgent:
    """
    Production ENVELO agent with server-synced boundaries,
    background telemetry, heartbeat, and graceful shutdown.
    """
    def __init__(self):
        self.client = httpx.Client(
            base_url=API_ENDPOINT,
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=15,
        )
        self.session_id = uuid.uuid4().hex
        self.boundaries = {}
        self.telemetry_buffer = []
        self.stats = {"pass": 0, "block": 0}
        self.running = False
        self._threads = []

    # ── lifecycle ──────────────────────────────────────────────

    def start(self):
        log.info("Starting ENVELO Interlock v2.0.0")
        log.info(f"  System:      {SYSTEM_NAME}")
        log.info(f"  Certificate: {CERTIFICATE}")
        log.info(f"  Endpoint:    {API_ENDPOINT}")

        # 1. Fetch approved boundaries from server
        try:
            res = self.client.get("/api/envelo/boundaries/config")
            if res.status_code == 200:
                cfg = res.json()
                for b in cfg.get("numeric_boundaries", []):
                    self.boundaries[b.get("parameter", b["name"])] = Boundary(**b)
                log.info(f"  Boundaries:  {len(self.boundaries)} loaded from server")
            else:
                log.warning(f"  Boundaries:  server returned {res.status_code}, using local")
        except Exception as e:
            log.warning(f"  Boundaries:  fetch failed ({e}), using local")

        # 2. Register session
        try:
            self.client.post("/api/envelo/sessions", json={
                "certificate_id": CERTIFICATE,
                "session_id": self.session_id,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "agent_version": "2.0.0",
                "system_name": SYSTEM_NAME,
                "boundaries": [
                    {"name": b.name, "min": b.min_value, "max": b.max_value}
                    for b in self.boundaries.values()
                ]
            })
            log.info(f"  Session:     {self.session_id[:16]}...")
        except Exception as e:
            log.warning(f"  Session registration failed: {e}")

        self.running = True

        # 3. Background threads
        for target in [self._heartbeat_loop, self._flush_loop]:
            t = threading.Thread(target=target, daemon=True)
            t.start()
            self._threads.append(t)

        log.info("  Status:      ✓ RUNNING")
        return self

    def shutdown(self):
        log.info("Shutting down...")
        self.running = False
        self._flush_telemetry()
        try:
            self.client.post(f"/api/envelo/sessions/{self.session_id}/end", json={
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "final_stats": {
                    "pass_count": self.stats["pass"],
                    "block_count": self.stats["block"]
                }
            })
        except:
            pass
        self.client.close()
        log.info(f"Done. {self.stats['pass']} passed, {self.stats['block']} blocked.")

    def _cleanup(self):
        """Remove PID file and disable auto-restart on key revocation."""
        import pathlib, subprocess
        pid_file = pathlib.Path.home() / ".envelo" / "envelo.pid"
        if pid_file.exists():
            pid_file.unlink()
        try:
            subprocess.run(["systemctl", "--user", "stop", "envelo.service"], capture_output=True)
            subprocess.run(["systemctl", "--user", "disable", "envelo.service"], capture_output=True)
        except: pass
        plist = pathlib.Path.home() / "Library" / "LaunchAgents" / "org.sentinelauthority.envelo.plist"
        if plist.exists():
            try: subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
            except: pass
        log.info("Auto-restart disabled. Agent stopped cleanly.")


    # ── boundary management ───────────────────────────────────

    def add_boundary(self, name, min_value=None, max_value=None, unit="", tolerance=0):
        self.boundaries[name] = Boundary(
            name=name, min_value=min_value, max_value=max_value,
            unit=unit, tolerance=tolerance,
        )
        log.info(f"  + {name}: {min_value} to {max_value} {unit}")

    # ── enforcement ───────────────────────────────────────────

    def check(self, parameter, value):
        """Check one parameter. Returns (passed: bool, message: str|None)."""
        if parameter not in self.boundaries:
            return True, None
        return self.boundaries[parameter].check(value)

    def enforce_params(self, **params):
        """Check all params. Returns (all_passed, violations_list)."""
        violations = []
        evals = []
        for param, value in params.items():
            passed, msg = self.check(param, value)
            evals.append({"boundary": param, "passed": passed})
            if not passed:
                violations.append({"boundary": param, "value": value, "message": msg})

        result = "PASS" if not violations else "BLOCK"
        self.telemetry_buffer.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_id": uuid.uuid4().hex[:8],
            "action_type": "boundary_check",
            "result": result,
            "parameters": {k: v for k, v in params.items()},
            "boundary_evaluations": evals
        })

        if violations:
            self.stats["block"] += 1
            for v in violations:
                log.warning(f"VIOLATION: {v['message']}")
            return False, violations
        self.stats["pass"] += 1
        return True, []

    def enforce(self, func):
        """Decorator — blocks execution if any kwarg violates a boundary."""
        @wraps(func)
        def wrapper(*args, **kwargs):
            passed, violations = self.enforce_params(**kwargs)
            if not passed:
                raise RuntimeError(f"ENVELO BLOCK: {violations[0]['message']}")
            return func(*args, **kwargs)
        return wrapper

    # ── background loops ──────────────────────────────────────

    def _heartbeat_loop(self):
        fail_count = 0
        while self.running:
            try:
                res = self.client.post("/api/envelo/heartbeat", json={
                    "session_id": self.session_id,
                    "certificate_id": CERTIFICATE,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "stats": self.stats
                })
                if res.status_code == 401:
                    log.warning("API key revoked — shutting down")
                    self.running = False
                    self._flush_telemetry()
                    self._cleanup()
                    return
                fail_count = 0
            except:
                fail_count += 1
                if fail_count >= 10:
                    log.warning(f"Lost connection ({fail_count} failures) — stopping")
                    self.running = False
                    return
            time.sleep(30)

    def _flush_loop(self):
        while self.running:
            time.sleep(10)
            self._flush_telemetry()

    def _flush_telemetry(self):
        if not self.telemetry_buffer:
            return
        batch, self.telemetry_buffer = self.telemetry_buffer[:], []
        try:
            res = self.client.post("/api/envelo/telemetry", json={
                "certificate_id": CERTIFICATE,
                "session_id": self.session_id,
                "records": batch,
                "stats": {"pass_count": self.stats["pass"], "block_count": self.stats["block"]}
            })
            if res.status_code == 401:
                log.warning("API key revoked — shutting down")
                self.running = False
                self._cleanup()
                return
        except Exception as e:
            log.warning(f"Telemetry flush failed: {e}")
            self.telemetry_buffer = batch + self.telemetry_buffer


# ── global instance ───────────────────────────────────────────
agent = EnveloAgent()

def _shutdown(sig, frame):
    agent.shutdown()
    sys.exit(0)

signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)


if __name__ == "__main__":
    print()
    print("${"╔"+"═".repeat(59)+"╗"}")
    print("║  ENVELO Interlock — Sentinel Authority                         ║")
    print("║  Enforced Non-Violable Execution-Limit Override              ║")
    print("${"╚"+"═".repeat(59)+"╝"}")
    print()

    agent.start()
    print()
    print("Agent running. Ctrl+C to stop.")
    print()
    print("─" * 60)
    print("INTEGRATION:")
    print()
    print("  from envelo_agent import agent")
    print("  agent.start()")
    print()
    print("  @agent.enforce")
    print("  def my_action(speed=0, temperature=0):")
    print("      # your autonomous logic")
    print("      pass")
    print()
    print("  # Or check directly:")
    print("  passed, violations = agent.enforce_params(speed=50, temp=25)")
    print("─" * 60)
    print()

    try:
        while agent.running:
            time.sleep(1)
    except KeyboardInterrupt:
        agent.shutdown()
`}function ee({session:a}){var g;if(!a)return null;const y=a.pass_count+a.block_count>0?(a.pass_count/(a.pass_count+a.block_count)*100).toFixed(1):0;return e.jsxs("div",{children:[e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"16px",marginBottom:"24px"},children:[e.jsxs("div",{style:{padding:"16px",background:"transparent",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:"rgba(255,255,255,.94)"},children:(a.pass_count||0)+(a.block_count||0)}),e.jsx("div",{style:{fontSize:"11px",color:"#888",textTransform:"uppercase"},children:"Total Actions"})]}),e.jsxs("div",{style:{padding:"16px",background:"transparent",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:"#5CD685"},children:a.pass_count||0}),e.jsx("div",{style:{fontSize:"11px",color:"#888",textTransform:"uppercase"},children:"Passed"})]}),e.jsxs("div",{style:{padding:"16px",background:"transparent",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:"#D65C5C"},children:a.block_count||0}),e.jsx("div",{style:{fontSize:"11px",color:"#888",textTransform:"uppercase"},children:"Blocked"})]}),e.jsxs("div",{style:{padding:"16px",background:y>=95?"rgba(92,214,133,0.1)":"rgba(214,92,92,0.03)",textAlign:"center"},children:[e.jsxs("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:y>=95?"#5CD685":"#D65C5C"},children:[y,"%"]}),e.jsx("div",{style:{fontSize:"11px",color:"#888",textTransform:"uppercase"},children:"Pass Rate"})]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"16px"},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:"#888",marginBottom:"4px"},children:"SESSION ID"}),e.jsx("div",{style:{fontFamily:"monospace",color:"#ccc"},children:a.session_id})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:"#888",marginBottom:"4px"},children:"CERTIFICATE"}),e.jsx("div",{style:{color:"#ccc"},children:a.certificate_id||"N/A"})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:"#888",marginBottom:"4px"},children:"STARTED"}),e.jsx("div",{style:{color:"#ccc"},children:a.started_at?new Date(a.started_at).toLocaleString():"N/A"})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:"#888",marginBottom:"4px"},children:"STATUS"}),e.jsx("span",{style:{padding:"4px 12px",fontSize:"12px",background:a.status==="active"?"rgba(92,214,133,0.2)":"rgba(255,255,255,0.1)",color:a.status==="active"?"#5CD685":"#888"},children:(g=a.status)==null?void 0:g.toUpperCase()})]})]})]})}function te({sessionId:a}){const[y,g]=i.useState([]),[b,w]=i.useState(!0);return i.useEffect(()=>{a&&p.get(`/api/envelo/admin/sessions/${a}/telemetry`).then(c=>g(c.data.records||[])).catch(console.error).finally(()=>w(!1))},[a]),b?e.jsx("div",{style:{color:"#888",padding:"12px"},children:"Loading..."}):y.length?e.jsx("div",{style:{maxHeight:"300px",overflowY:"auto"},children:e.jsxs("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:"12px"},children:[e.jsx("thead",{children:e.jsxs("tr",{style:{borderBottom:"1px solid rgba(255,255,255,0.1)"},children:[e.jsx("th",{style:{padding:"8px",textAlign:"left",color:"#888"},children:"Time"}),e.jsx("th",{style:{padding:"8px",textAlign:"left",color:"#888"},children:"Action"}),e.jsx("th",{style:{padding:"8px",textAlign:"left",color:"#888"},children:"Result"}),e.jsx("th",{style:{padding:"8px",textAlign:"left",color:"#888"},children:"Params"})]})}),e.jsx("tbody",{children:y.map((c,B)=>e.jsxs("tr",{style:{borderBottom:"1px solid rgba(255,255,255,0.05)"},children:[e.jsx("td",{style:{padding:"8px",fontFamily:"monospace",fontSize:"11px",color:"#aaa"},children:c.timestamp?new Date(c.timestamp).toLocaleTimeString():"-"}),e.jsx("td",{style:{padding:"8px",color:"rgba(255,255,255,.94)"},children:c.action_type}),e.jsx("td",{style:{padding:"8px"},children:e.jsx("span",{style:{padding:"2px 8px",fontSize:"10px",fontWeight:400,background:c.result==="PASS"?"rgba(92,214,133,0.2)":"rgba(214,92,92,0.2)",color:c.result==="PASS"?"#5CD685":"#D65C5C"},children:c.result})}),e.jsx("td",{style:{padding:"8px",color:"#666",fontFamily:"monospace",fontSize:"10px"},children:JSON.stringify(c.parameters||{})})]},B))})]})}):e.jsx("div",{style:{color:"#888",padding:"12px"},children:"No telemetry records"})}function ne({onKeyGenerated:a}){const[y,g]=i.useState([]),[b,w]=i.useState(!0),[c,B]=i.useState(""),[f,A]=i.useState(null);i.useEffect(()=>{f!=null&&f.key&&(a==null||a(f.key))},[f]),i.useEffect(()=>{T()},[]);const D=r=>{const l=R.find(M=>M.id===S),k=Z({apiEndpoint:Y,apiKey:r,certificateNumber:(l==null?void 0:l.certificate_number)||"PENDING",systemName:(l==null?void 0:l.system_name)||"My System",organizationName:(l==null?void 0:l.organization_name)||""}),v=new Blob([k],{type:"text/plain"}),C=URL.createObjectURL(v),_=document.createElement("a");_.href=C,_.download="envelo_agent.py",document.body.appendChild(_),_.click(),document.body.removeChild(_),URL.revokeObjectURL(C)},T=async()=>{try{const r=await p.get("/api/apikeys/");g(r.data)}catch(r){console.error("Failed to load API keys:",r)}w(!1)},[R,L]=i.useState([]),[S,z]=i.useState(null);i.useEffect(()=>{p.get("/api/certificates/").then(r=>{const l=(r.data||[]).filter(k=>k.state==="conformant"||k.state==="active"||k.state==="issued");L(l),l.length>0&&z(l[0].id)}).catch(()=>{})},[]);const N=async()=>{if(c.trim())try{const r=await p.post("/api/apikeys/generate",{name:c,certificate_id:S});A(r.data),B(""),T()}catch(r){console.error("Failed to generate key:",r)}},O=async r=>{if(await confirm({title:"Revoke Key",message:"Revoke this API key? This cannot be undone.",danger:!0,confirmLabel:"Revoke"}))try{await p.delete(`/api/apikeys/${r}`),T()}catch(l){console.error("Failed to revoke key:",l)}},I=()=>{f!=null&&f.key&&navigator.clipboard.writeText(f.key)};return b?e.jsx("div",{style:{color:"rgba(255,255,255,.50)"},children:"Loading..."}):e.jsxs("div",{children:[f&&e.jsxs("div",{style:{background:"transparent",border:"1px solid rgba(255,255,255,0.07)",padding:"16px",marginBottom:"20px"},children:[e.jsx("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",color:"#5CD685",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"},children:"✓ New API Key Generated"}),e.jsx("div",{style:{background:"rgba(255,255,255,.05)",padding:"12px",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px",color:"rgba(255,255,255,.94)",wordBreak:"break-all",marginBottom:"12px"},children:f.key}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsx("button",{onClick:I,className:"btn primary",children:"Copy to Clipboard"}),e.jsx("button",{onClick:()=>A(null),style:{padding:"8px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.78)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",cursor:"pointer"},children:"Dismiss"})]}),e.jsx("p",{style:{color:"rgba(255,255,255,.50)",fontSize:"12px",marginTop:"12px"},children:"⚠️ Save this key now. You won't be able to see it again."}),e.jsxs("div",{style:{marginTop:"16px",padding:"16px",background:"rgba(91,75,138,0.2)",border:"1px solid rgba(91,75,138,0.3)"},children:[e.jsx("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",color:"#a896d6",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"},children:"Next Step"}),e.jsx("p",{style:{color:"rgba(255,255,255,.78)",fontSize:"13px",marginBottom:"12px"},children:"Download the ENVELO Interlock pre-configured with your credentials:"}),e.jsxs("button",{onClick:()=>D(f.key),className:"btn primary",children:[e.jsx(Q,{size:16})," Download ENVELO Interlock"]})]})]}),e.jsxs("div",{style:{display:"flex",gap:"12px",marginBottom:"20px"},children:[e.jsx("input",{type:"text",placeholder:"Key name (e.g., Production)",value:c,onChange:r=>B(r.target.value),style:{flex:1,padding:"10px 14px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.94)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px"}}),e.jsx("button",{onClick:N,disabled:!c.trim(),className:"btn",children:"Generate Key"})]}),y.length>0?e.jsxs("div",{children:[e.jsx("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"12px",textTransform:"uppercase",letterSpacing:"1px"},children:"Your API Keys"}),y.map(r=>e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",padding:"12px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",marginBottom:"8px"},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px",color:"rgba(255,255,255,.94)"},children:r.name}),e.jsxs("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",color:"rgba(255,255,255,.50)",marginTop:"4px"},children:[r.key_prefix,"••••••••"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"16px"},children:[e.jsx("span",{style:{fontSize:"11px",color:"rgba(255,255,255,.50)"},children:r.last_used_at?`Last used: ${new Date(r.last_used_at).toLocaleDateString()}`:"Never used"}),e.jsx("button",{onClick:()=>O(r.id),style:{padding:"6px 12px",background:"rgba(255,100,100,0.1)",border:"1px solid rgba(255,100,100,0.3)",color:"#ff6464",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",cursor:"pointer"},children:"Revoke"})]})]},r.id))]}):e.jsx("p",{style:{color:"rgba(255,255,255,.50)",fontSize:"14px"},children:"No API keys yet. Generate one to connect the ENVELO Interlock."})]})}function se(){var U;const a=q();X();const[y,g]=i.useState(null),[b,w]=i.useState([]),[c,B]=i.useState([]),[f,A]=i.useState([]),[D,T]=i.useState(0),[R,L]=i.useState({}),[S,z]=i.useState(null),[N,O]=i.useState(null),[I,r]=i.useState("monitoring"),[l,k]=i.useState(""),[v,C]=i.useState(null),[_,M]=i.useState(!0);if(i.useEffect(()=>{const n=async()=>{try{const[x,t,o,d]=await Promise.all([p.get("/api/envelo/stats").catch(()=>({data:null})),p.get("/api/envelo/admin/sessions").catch(()=>({data:{sessions:[]}})),p.get("/api/certificates/").catch(()=>({data:[]})),p.get("/api/applications/").catch(()=>({data:[]}))]);g(x.data),w(t.data.sessions||[]),B(o.data||[]),A(d.data.applications||d.data||[])}catch(x){console.error(x)}M(!1)};n();const u=setInterval(n,3e4);return()=>clearInterval(u)},[]),_)return e.jsx("div",{style:{color:"rgba(255,255,255,.50)",padding:"clamp(16px, 4vw, 40px)",textAlign:"center"},children:e.jsx(J,{size:24,style:{animation:"spin 1s linear infinite"}})});const W=b.filter(n=>n.status==="active"),$=b.reduce((n,u)=>n+(u.block_count||0),0),E=c.filter(n=>n.state==="conformant"||n.state==="active"||n.state==="issued"),P=f.filter(n=>n.state==="approved"||n.state==="testing"),V=n=>{const u=Z({apiEndpoint:Y,apiKey:"YOUR_API_KEY",certificateNumber:n.certificate_number,systemName:n.system_name||"Unknown",organizationName:n.organization_name||"Unknown"}),x=new Blob([u],{type:"text/plain"}),t=URL.createObjectURL(x),o=document.createElement("a");o.href=t,o.download=`envelo_agent_${n.certificate_number}.py`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(t)};return e.jsxs("div",{className:"space-y-6",children:[e.jsx(G,{label:"⬡ Admin Console",title:"ENVELO Management",description:"Monitor, configure, and manage all customer systems"}),e.jsx("div",{style:{display:"flex",gap:"8px",borderBottom:"1px solid rgba(255,255,255,.07)",paddingBottom:"16px",overflowX:"auto",WebkitOverflowScrolling:"touch"},children:[{id:"monitoring",label:"Live Monitoring"},{id:"customers",label:"Customer Systems"},{id:"review",label:"Review Boundaries"}].map(n=>e.jsx("button",{onClick:()=>r(n.id),className:"btn",children:n.label},n.id))}),e.jsxs("div",{className:"grid gap-4",style:{gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))"},children:[e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"12px"},children:"Active Sessions"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:"#5CD685"},children:W.length})]}),e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"12px"},children:"Attested Systems"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:"#a896d6"},children:E.length})]}),e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"12px"},children:"CAT-72 In Progress"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:"#D6A05C"},children:P.length})]}),e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"12px"},children:"Violations (Total)"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:$>0?"#D65C5C":"#5CD685"},children:$})]})]}),I==="monitoring"&&e.jsxs(e.Fragment,{children:[e.jsxs(h,{glow:!0,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",marginBottom:"20px"},children:[e.jsx("div",{className:"hud-label",children:"Active Sessions"}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"4px 12px",background:"transparent"},children:[e.jsx("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#5CD685",boxShadow:"0 0 8px #5CD685",animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"#5CD685",textTransform:"uppercase"},children:"Live"})]})]}),b.length>0?e.jsx("div",{className:"table-scroll",style:{overflowX:"auto",WebkitOverflowScrolling:"touch"},children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{style:{borderBottom:"1px solid rgba(255,255,255,.07)"},children:[e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",fontWeight:400},children:"Certificate"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",fontWeight:400},children:"Status"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",fontWeight:400},children:"Pass"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",fontWeight:400},children:"Block"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",fontWeight:400},children:"Actions"})]})}),e.jsx("tbody",{children:b.map((n,u)=>e.jsxs("tr",{style:{borderBottom:"1px solid rgba(255,255,255,.07)"},children:[e.jsx("td",{style:{padding:"16px",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"12px",color:"#a896d6"},children:n.certificate_id||"N/A"}),e.jsx("td",{style:{padding:"16px"},children:e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:n.status==="active"?"#5CD685":"rgba(255,255,255,.50)",boxShadow:n.status==="active"?"0 0 8px #5CD685":"none"}}),e.jsx("span",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",textTransform:"uppercase",color:n.status==="active"?"#5CD685":"rgba(255,255,255,.50)"},children:n.status})]})}),e.jsx("td",{style:{padding:"16px",color:"#5CD685"},children:n.pass_count||0}),e.jsx("td",{style:{padding:"16px",color:(n.block_count||0)>0?"#D65C5C":"rgba(255,255,255,.50)"},children:n.block_count||0}),e.jsx("td",{style:{padding:"16px"},children:e.jsx("button",{onClick:()=>z(n),style:{padding:"6px 12px",background:"transparent",border:"1px solid #a896d6",color:"#a896d6",fontSize:"11px",cursor:"pointer"},children:"View Details"})})]},u))})]})}):e.jsx("p",{style:{color:"rgba(255,255,255,.50)",textAlign:"center",padding:"clamp(16px, 4vw, 40px)"},children:"No sessions found."})]}),S&&e.jsxs(h,{accent:"purple",children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",marginBottom:"20px"},children:[e.jsxs("div",{className:"hud-label",children:["Session: ",(U=S.session_id)==null?void 0:U.substring(0,16),"..."]}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsx("button",{onClick:async()=>{try{const n=await p.get(`/api/envelo/admin/sessions/${S.id}/report`,{responseType:"blob"}),u=window.URL.createObjectURL(new Blob([n.data])),x=document.createElement("a");x.href=u,x.download=`CAT72-Report-${S.session_id}.pdf`,x.click()}catch(n){a.show("Failed: "+n.message,"error")}},style:{padding:"8px 16px",background:"#5B4B8A",border:"none",color:"rgba(255,255,255,.94)",fontSize:"11px",cursor:"pointer"},children:"Download Report"}),e.jsx("button",{onClick:()=>z(null),style:{padding:"8px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.50)",cursor:"pointer",fontSize:"11px"},children:"✕ Close"})]})]}),e.jsx(ee,{session:S}),e.jsx("div",{style:{marginTop:"20px"},children:e.jsx(te,{sessionId:S.id})})]})]}),I==="customers"&&e.jsxs(e.Fragment,{children:[e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"20px"},children:"Attested Systems"}),E.length>0?e.jsx("div",{className:"space-y-4",children:E.map(n=>e.jsx("div",{style:{padding:"20px",background:"transparent",border:"1px solid rgba(255,255,255,.07)"},children:e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"16px"},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:"16px",fontWeight:500,color:"rgba(255,255,255,.94)",margin:"0 0 4px 0"},children:n.system_name||"Unnamed"}),e.jsx("p",{style:{fontSize:"13px",color:"rgba(255,255,255,.78)",marginBottom:"8px"},children:n.organization_name}),e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"12px",color:"#a896d6"},children:n.certificate_number})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"},children:[e.jsxs("button",{onClick:()=>{C(n),r("review")},style:{padding:"8px 16px",background:"transparent",border:"1px solid #a896d6",color:"#a896d6",fontSize:"11px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx(K,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:12})," Review Boundaries"]}),e.jsx("span",{style:{padding:"8px 16px",background:"transparent",border:"1px solid rgba(255,255,255,0.06)",color:"#5CD685",fontSize:"11px",display:"flex",alignItems:"center",gap:"6px"},children:"✓ Auto-provisioned on Approve"}),e.jsxs("button",{onClick:()=>V(n),style:{padding:"8px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.78)",fontSize:"11px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx(Q,{size:12})," Download Only"]})]})]})},n.id))}):e.jsx("p",{style:{color:"rgba(255,255,255,.50)",textAlign:"center",padding:"24px"},children:"No attested systems yet."})]}),P.length>0&&e.jsxs(h,{accent:"amber",children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:"#D6A05C",marginBottom:"20px"},children:"CAT-72 Testing In Progress"}),e.jsx("div",{className:"space-y-4",children:P.map(n=>e.jsx("div",{style:{padding:"16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)"},children:e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontSize:"14px",color:"rgba(255,255,255,.94)",marginBottom:"4px"},children:n.system_name}),e.jsx("p",{style:{fontSize:"12px",color:"rgba(255,255,255,.78)"},children:n.organization_name})]}),e.jsx("span",{className:"btn",children:n.cat72_started?"In Progress":"Ready"})]})},n.id))})]}),e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"16px"},children:"API Key Management"}),e.jsx(ne,{})]})]}),I==="review"&&e.jsx(e.Fragment,{children:v?(()=>{const n=v.envelope_definition||{},u=n.numeric_boundaries||[],x=n.geographic_boundaries||[],t=n.time_boundaries||[],o=n.state_boundaries||[],d=u.length+x.length+t.length+o.length>0;return e.jsxs(h,{glow:!0,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"24px"},children:[e.jsxs("div",{children:[e.jsxs("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"9px",letterSpacing:"4px",textTransform:"uppercase",color:"#a896d6",marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px"},children:[e.jsx("span",{style:{width:"24px",height:"1px",background:"#a896d6"}}),"Boundary Review — Read Only"]}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(24px, 4vw, 32px)",fontWeight:200,letterSpacing:"-0.02em",margin:"0 0 4px 0"},children:v.system_name}),e.jsxs("p",{style:{color:"rgba(255,255,255,.78)"},children:[v.organization_name," • ",v.certificate_number]})]}),e.jsx("button",{onClick:()=>C(null),style:{padding:"8px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.50)",cursor:"pointer",fontSize:"11px"},children:"← Back"})]}),e.jsx("div",{style:{padding:"12px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.10)",marginBottom:"24px"},children:e.jsx("p",{style:{color:"#D6A05C",fontSize:"13px",margin:0},children:"⚠ Sentinel Authority does not modify customer boundaries. Review and approve as submitted, or reject with required changes."})}),d?e.jsxs("div",{className:"space-y-6",children:[u.length>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"hud-label",style:{marginBottom:"12px"},children:["Numeric Boundaries (",u.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:u.map((s,m)=>e.jsxs("div",{style:{padding:"14px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Parameter"}),e.jsx("p",{style:{fontWeight:500,color:"rgba(255,255,255,.94)",fontSize:"14px"},children:s.name||s.parameter||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Range"}),e.jsxs("p",{style:{color:"#a896d6",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px"},children:[s.min_value??"—"," → ",s.max_value??"—"," ",s.unit||""]})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Hard Limit"}),e.jsx("p",{style:{color:s.hard_limit?"#D65C5C":"rgba(255,255,255,.50)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px"},children:s.hard_limit??"None"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Tolerance"}),e.jsxs("p",{style:{color:"rgba(255,255,255,.78)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px"},children:["±",s.tolerance||0]})]})]},m))})]}),x.length>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"hud-label",style:{marginBottom:"12px"},children:["Geographic Boundaries (",x.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:x.map((s,m)=>{var j,F;return e.jsxs("div",{style:{padding:"14px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Zone"}),e.jsx("p",{style:{fontWeight:500,color:"rgba(255,255,255,.94)",fontSize:"14px"},children:s.name||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Type"}),e.jsx("p",{style:{color:"rgba(255,255,255,.78)",fontSize:"13px"},children:s.boundary_type||"circle"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Center"}),e.jsxs("p",{style:{color:"#a896d6",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"12px"},children:[((j=s.center)==null?void 0:j.lat)||s.lat||"—",", ",((F=s.center)==null?void 0:F.lon)||s.lon||"—"]})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Radius"}),e.jsxs("p",{style:{color:"rgba(255,255,255,.78)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px"},children:[s.radius_meters||"—","m"]})]})]},m)})})]}),t.length>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"hud-label",style:{marginBottom:"12px"},children:["Time Boundaries (",t.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:t.map((s,m)=>e.jsxs("div",{style:{padding:"14px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Schedule"}),e.jsx("p",{style:{fontWeight:500,color:"rgba(255,255,255,.94)",fontSize:"14px"},children:s.name||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Hours"}),e.jsxs("p",{style:{color:"#a896d6",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px"},children:[s.allowed_hours_start??s.start_hour??0,":00 → ",s.allowed_hours_end??s.end_hour??24,":00 ",s.timezone||"UTC"]})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Days"}),e.jsx("p",{style:{color:"rgba(255,255,255,.78)",fontSize:"12px"},children:(s.allowed_days||s.days||[]).map(j=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][j]||j).join(", ")||"All"})]})]},m))})]}),o.length>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"hud-label",style:{marginBottom:"12px"},children:["State Boundaries (",o.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:o.map((s,m)=>e.jsxs("div",{style:{padding:"14px 16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Parameter"}),e.jsx("p",{style:{fontWeight:500,color:"rgba(255,255,255,.94)",fontSize:"14px"},children:s.name||s.parameter||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Allowed"}),e.jsx("p",{style:{color:"#5CD685",fontSize:"12px"},children:(s.allowed_values||[]).join(", ")||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)",marginBottom:"2px"},children:"Forbidden"}),e.jsx("p",{style:{color:"#D65C5C",fontSize:"12px"},children:(s.forbidden_values||[]).join(", ")||"—"})]})]},m))})]})]}):e.jsx("p",{style:{color:"rgba(255,255,255,.50)",textAlign:"center",padding:"clamp(16px, 4vw, 40px)"},children:"No boundaries defined in this application."}),e.jsxs("div",{style:{marginTop:"32px",paddingTop:"24px",borderTop:"1px solid rgba(255,255,255,.07)"},children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"16px"},children:"Review Decision"}),e.jsx("textarea",{value:l,onChange:s=>k(s.target.value),placeholder:"Review notes (required for rejection, optional for approval)...",style:{width:"100%",minHeight:"80px",padding:"12px 16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",color:"rgba(255,255,255,.94)",fontSize:"13px",fontFamily:"Georgia, 'Source Serif 4', serif",resize:"vertical"}}),e.jsxs("div",{style:{display:"flex",gap:"12px",marginTop:"16px"},children:[e.jsx("button",{onClick:async()=>{var s,m;try{await p.post(`/api/applications/${v.application_id||"unknown"}/comments`,{content:"[BOUNDARY REVIEW — APPROVED] "+(l||"Boundaries approved as submitted."),is_internal:!1}),a.show("Boundaries approved as submitted","success"),C(null),k("")}catch(j){a.show("Failed: "+(((m=(s=j.response)==null?void 0:s.data)==null?void 0:m.detail)||j.message),"error")}},className:"btn",children:"✓ Approve Boundaries"}),e.jsx("button",{onClick:async()=>{var s,m;if(!l.trim()){a.show("Rejection requires specific feedback on what must change","error");return}try{await p.post(`/api/applications/${v.application_id||"unknown"}/comments`,{content:"[BOUNDARY REVIEW — CHANGES REQUIRED] "+l,is_internal:!1}),a.show("Sent back to applicant with required changes","success"),C(null),k("")}catch(j){a.show("Failed: "+(((m=(s=j.response)==null?void 0:s.data)==null?void 0:m.detail)||j.message),"error")}},className:"btn",children:"✗ Reject — Require Changes"})]})]})]})})():e.jsx(h,{children:e.jsxs("div",{style:{textAlign:"center",padding:"clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)"},children:[e.jsx(K,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:48,style:{color:"rgba(255,255,255,.50)",margin:"0 auto 16px"}}),e.jsx("h2",{style:{fontSize:"20px",fontWeight:200,marginBottom:"8px"},children:"Select a System to Review"}),e.jsx("p",{style:{color:"rgba(255,255,255,.78)",marginBottom:"24px"},children:"Choose a system from the Customer Systems tab to review its submitted boundaries."}),e.jsx("button",{onClick:()=>r("customers"),className:"btn",children:"View Customer Systems"})]})})})]})}function oe(){var x;const[a,y]=i.useState(null),[g,b]=i.useState(!1),[w,c]=i.useState([]),[B,f]=i.useState([]),[A,D]=i.useState([]),[T,R]=i.useState([]),[L,S]=i.useState(!0),[z,N]=i.useState(!1),[O,I]=i.useState(!1),r=X(),l=q(),{user:k}=H();i.useEffect(()=>{(async()=>{try{const[o,d,s,m]=await Promise.all([p.get("/api/certificates/").catch(()=>({data:[]})),p.get("/api/applications/").catch(()=>({data:[]})),p.get("/api/envelo/sessions").catch(()=>({data:{sessions:[]}})),p.get("/api/apikeys/").catch(()=>({data:[]}))]);c(o.data||[]),f(d.data||[]),D(s.data.sessions||[]),R(m.data||[])}catch(o){console.error(o)}S(!1)})()},[]);const v=(Array.isArray(w)?w:[]).filter(t=>t.state==="conformant"||t.state==="active"||t.state==="issued"),C=(Array.isArray(B)?B:[]).filter(t=>t.state==="approved"||t.state==="testing"),_=[...C,...v],M=v.length>0||C.length>0,W=A.filter(t=>t.status==="active"),$=W.length>0,E=async()=>{var t,o,d;b(!0);try{const s=_[0],m=(s==null?void 0:s.certificate_id)||null,j="deploy-"+new Date().toISOString().split("T")[0],F=await p.post("/api/apikeys/generate",{name:j,certificate_id:m});(t=F.data)!=null&&t.key&&y(F.data.key)}catch(s){l.show("Failed to generate key: "+(((d=(o=s.response)==null?void 0:o.data)==null?void 0:d.detail)||s.message),"error")}b(!1)},P=()=>{const t=_[0];return(t==null?void 0:t.certificate_number)||(t==null?void 0:t.application_number)||"PENDING"},V=()=>a?'curl -sSL "'+Y+"/api/deploy/"+P()+"?key="+a+'" | bash':null,U=()=>{const t=V();t&&(navigator.clipboard.writeText(t),N(!0),setTimeout(()=>N(!1),3e3))};if(L)return e.jsx("div",{style:{color:"rgba(255,255,255,.50)",padding:"clamp(16px, 4vw, 40px)",textAlign:"center"},children:e.jsx(J,{size:24,style:{animation:"spin 1s linear infinite"}})});if(!M)return e.jsxs("div",{className:"space-y-6",children:[e.jsx(G,{label:"ENVELO Interlock",title:"Application Required"}),e.jsx(h,{children:e.jsxs("div",{style:{textAlign:"center",padding:"clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)"},children:[e.jsx(K,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:48,style:{color:"rgba(255,255,255,.50)",margin:"0 auto 16px"}}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(18px, 4vw, 24px)",fontWeight:200,marginBottom:"12px"},children:"Pending Approval"}),e.jsx("p",{style:{color:"rgba(255,255,255,.78)",maxWidth:"min(400px, 90vw)",margin:"0 auto"},children:"Your application is being reviewed. Once approved, you'll deploy the ENVELO agent with a single command."})]})})]});if($)return e.jsxs("div",{className:"space-y-6",children:[e.jsx(G,{label:"ENVELO Interlock",title:"Active",description:"Your agent is connected and enforcing boundaries"}),v.map(t=>{const o=A.find(s=>s.certificate_id===t.certificate_number),d=o&&o.status==="active";return e.jsxs(h,{glow:d,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"20px"},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:"20px",fontWeight:500,color:"rgba(255,255,255,.94)",margin:"0 0 8px 0"},children:t.system_name||"System"}),e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px",color:"#a896d6",marginBottom:"4px"},children:t.certificate_number}),e.jsx("p",{style:{fontSize:"12px",color:"rgba(255,255,255,.50)"},children:"Attested "+(t.issued_at?new Date(t.issued_at).toLocaleDateString():"N/A")})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:"#5CD685",animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",textTransform:"uppercase",color:"#5CD685"},children:"ENVELO Active"})]})]}),o&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"16px",marginTop:"24px",paddingTop:"24px",borderTop:"1px solid rgba(255,255,255,.07)"},children:[e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:"#5CD685"},children:o.uptime||"0h"}),e.jsx("div",{className:"hud-label",children:"Uptime"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:"#a896d6"},children:o.record_count||0}),e.jsx("div",{className:"hud-label",children:"Telemetry"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:(o.violations||0)>0?"#D65C5C":"#5CD685"},children:o.violations||0}),e.jsx("div",{className:"hud-label",children:"Violations"})]})]})]},t.id)}),C.filter(t=>!v.some(o=>o.application_id===t.id)).map(t=>{const o=W[0];return e.jsxs(h,{glow:!0,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:"20px",fontWeight:500,color:"rgba(255,255,255,.94)",margin:"0 0 4px 0"},children:t.system_name}),e.jsxs("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px",color:"#D6A05C"},children:[t.application_number," — CAT-72 Testing"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:"#5CD685",animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",textTransform:"uppercase",color:"#5CD685"},children:"ENVELO Active"})]})]}),o&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"16px",marginTop:"24px",paddingTop:"24px",borderTop:"1px solid rgba(255,255,255,.07)"},children:[e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:"#5CD685"},children:o.pass_count||0}),e.jsx("div",{className:"hud-label",children:"Passed"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:(o.block_count||0)>0?"#D65C5C":"#5CD685"},children:o.block_count||0}),e.jsx("div",{className:"hud-label",children:"Blocked"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:"#a896d6"},children:(o.pass_count||0)+(o.block_count||0)}),e.jsx("div",{className:"hud-label",children:"Total"})]})]})]},t.id)}),e.jsxs(h,{children:[e.jsx("div",{className:"hud-label",style:{marginBottom:"16px"},children:"Agent Control"}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"12px"},children:[e.jsxs("button",{onClick:async()=>{var t,o;if(await r({title:"Stop Agent",message:"Stop the ENVELO agent? It will shut down within 30 seconds.",danger:!0}))try{const d=await p.get("/api/apikeys/");for(const s of d.data||[])await p.delete(`/api/apikeys/${s.id}`);l.show("Agent will stop within 30 seconds","success"),setTimeout(()=>window.location.reload(),3e3)}catch(d){l.show("Failed: "+(((o=(t=d.response)==null?void 0:t.data)==null?void 0:o.detail)||d.message),"error")}},style:{padding:"16px",background:"transparent",border:"1px solid rgba(255,255,255,.10)",cursor:"pointer",textAlign:"left"},children:[e.jsx("p",{style:{fontWeight:500,color:"#D65C5C",marginBottom:"4px",fontSize:"14px"},children:"⏹ Stop Agent"}),e.jsx("p",{style:{color:"rgba(255,255,255,.50)",fontSize:"11px",margin:0},children:"Revokes API key. Agent shuts down within 30s."})]}),e.jsxs("button",{onClick:async()=>{var t,o;if(await r({title:"Redeploy",message:"This revokes your current key and generates a new deploy command."}))try{const d=await p.get("/api/apikeys/");for(const s of d.data||[])await p.delete(`/api/apikeys/${s.id}`);l.show("Old agent stopping. Generating new deploy...","success"),setTimeout(()=>window.location.reload(),2e3)}catch(d){l.show("Failed: "+(((o=(t=d.response)==null?void 0:t.data)==null?void 0:o.detail)||d.message),"error")}},style:{padding:"16px",background:"transparent",border:"1px solid rgba(91,75,138,0.2)",cursor:"pointer",textAlign:"left"},children:[e.jsx("p",{style:{fontWeight:500,color:"#a896d6",marginBottom:"4px",fontSize:"14px"},children:"↻ Redeploy"}),e.jsx("p",{style:{color:"rgba(255,255,255,.50)",fontSize:"11px",margin:0},children:"Stop current agent and get a fresh deploy command."})]}),e.jsxs("button",{onClick:async()=>{var t,o;if(await r({title:"Uninstall",message:"Uninstall ENVELO agent? This revokes all keys and shows cleanup instructions.",danger:!0}))try{const d=await p.get("/api/apikeys/");for(const s of d.data||[])await p.delete(`/api/apikeys/${s.id}`);l.show("Keys revoked. Run the cleanup command below.","success"),I(!0)}catch(d){l.show("Failed: "+(((o=(t=d.response)==null?void 0:t.data)==null?void 0:o.detail)||d.message),"error")}},style:{padding:"16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,.07)",cursor:"pointer",textAlign:"left"},children:[e.jsx("p",{style:{fontWeight:500,color:"rgba(255,255,255,.78)",marginBottom:"4px",fontSize:"14px"},children:"⊘ Uninstall"}),e.jsx("p",{style:{color:"rgba(255,255,255,.50)",fontSize:"11px",margin:0},children:"Remove agent, config, and auto-restart service."})]})]}),O&&e.jsxs("div",{style:{marginTop:"16px",padding:"16px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)"},children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:"#D6A05C",marginBottom:"8px"},children:"Paste in terminal to fully remove"}),e.jsx("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"12px",color:"rgba(255,255,255,.78)",padding:"12px",background:"rgba(255,255,255,.05)",whiteSpace:"pre-wrap",lineHeight:"1.8"},children:`# Stop agent
kill $(cat ~/.envelo/envelo.pid) 2>/dev/null

# Remove systemd service (Linux)
systemctl --user stop envelo.service 2>/dev/null
systemctl --user disable envelo.service 2>/dev/null
rm -f ~/.config/systemd/user/envelo.service

# Remove launchd (macOS)
launchctl unload ~/Library/LaunchAgents/org.sentinelauthority.envelo.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/org.sentinelauthority.envelo.plist

# Remove files
rm -rf ~/.envelo

echo "✓ ENVELO uninstalled"`})]}),e.jsxs("div",{style:{marginTop:"16px",padding:"12px",background:"transparent"},children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",marginBottom:"8px"},children:"Logs"}),e.jsx("div",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"12px",color:"rgba(255,255,255,.78)",padding:"8px",background:"rgba(255,255,255,.05)"},children:"cat ~/.envelo/envelo.log"})]})]})]});const n=((x=_[0])==null?void 0:x.system_name)||"Your System",u=V();return e.jsxs("div",{className:"space-y-6",children:[e.jsx(G,{label:"ENVELO Interlock",title:"Deploy",description:"Ready to deploy "+n}),e.jsx(h,{glow:!0,children:e.jsx("div",{style:{textAlign:"center",padding:"clamp(20px, 4vw, 40px) clamp(12px, 3vw, 20px)"},children:a?e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:{marginBottom:"24px"},children:[e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent",marginBottom:"16px"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:"#5CD685"}}),e.jsx("span",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",color:"#5CD685",textTransform:"uppercase",letterSpacing:"1px"},children:"Ready to Deploy"})]}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(18px, 4vw, 24px)",fontWeight:200,color:"rgba(255,255,255,.94)",margin:"0 0 8px 0"},children:"Paste in your terminal"})]}),e.jsxs("div",{style:{maxWidth:"min(700px, 95vw)",margin:"0 auto",textAlign:"left"},children:[e.jsxs("div",{style:{background:"rgba(255,255,255,.05)",border:"1px solid #a896d6",overflow:"hidden"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:"rgba(255,255,255,.05)",borderBottom:"1px solid rgba(255,255,255,.07)"},children:[e.jsxs("div",{style:{display:"flex",gap:"6px"},children:[e.jsx("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:"#ff5f57"}}),e.jsx("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:"#febc2e"}}),e.jsx("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:"#28c840"}})]}),e.jsx("span",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",color:"rgba(255,255,255,.50)"},children:"Terminal"}),e.jsx("button",{onClick:U,style:{padding:"4px 16px",background:z?"rgba(92,214,133,0.2)":"#5B4B8A",border:"1px solid "+(z?"#5CD685":"#a896d6"),color:z?"#5CD685":"#fff",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer"},children:z?"✓ Copied":"Copy"})]}),e.jsxs("div",{style:{padding:"20px",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"13px",lineHeight:"1.6",overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all"},children:[e.jsx("span",{style:{color:"#5CD685"},children:"$"})," ",e.jsx("span",{style:{color:"rgba(255,255,255,.94)"},children:u})]})]}),e.jsxs("div",{style:{marginTop:"20px",padding:"16px",background:"transparent",border:"1px solid rgba(255,255,255,.07)"},children:[e.jsx("p",{style:{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:"rgba(255,255,255,.50)",marginBottom:"12px"},children:"What happens"}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"12px",textAlign:"center"},children:[{icon:"↓",label:"Installs"},{icon:"⚙",label:"Configures"},{icon:"▶",label:"Starts"},{icon:"↻",label:"Auto-restarts"}].map((t,o)=>e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"18px",marginBottom:"4px"},children:t.icon}),e.jsx("div",{style:{fontSize:"11px",color:"rgba(255,255,255,.78)"},children:t.label})]},o))})]}),e.jsx("p",{style:{color:"#D6A05C",fontSize:"12px",marginTop:"16px",textAlign:"center"},children:"⚠ This command contains your API key. Don't share it."}),e.jsx("div",{style:{textAlign:"center",marginTop:"16px"},children:e.jsx("button",{onClick:()=>y(null),style:{background:"transparent",border:"none",color:"rgba(255,255,255,.50)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"11px",cursor:"pointer",textDecoration:"underline"},children:"Generate new key"})})]})]}):e.jsxs(e.Fragment,{children:[e.jsx(K,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:56,style:{color:"#a896d6",margin:"0 auto 20px"}}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,marginBottom:"12px",color:"rgba(255,255,255,.94)"},children:"One Command. That's It."}),e.jsx("p",{style:{color:"rgba(255,255,255,.78)",maxWidth:"min(440px, 90vw)",margin:"0 auto 32px",lineHeight:"1.6"},children:"Generate your deploy command. Paste it in a terminal. The ENVELO agent installs, configures your approved boundaries, starts running, and auto-restarts on reboot."}),e.jsx("button",{onClick:E,disabled:g,style:{padding:"16px 48px",background:"transparent",border:"1px solid #a896d6",color:"rgba(255,255,255,.94)",fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:"14px",letterSpacing:"1px",cursor:g?"wait":"pointer",opacity:g?.7:1,transition:"all 0.2s"},children:g?"⟳ Generating...":"⬡ Generate Deploy Command"})]})})})]})}function pe(){const{user:a}=H();return(a==null?void 0:a.role)==="admin"?e.jsx(se,{}):e.jsx(oe,{})}export{pe as default};
