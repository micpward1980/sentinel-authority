import{a as q,j as e,b as X,u as ee,s as t,d,A as M}from"./index-BedPMBGb.js";import{r as a,i as J,S as U,D as Q}from"./icons-BDb2Zpiz.js";import{P as y}from"./Panel-BxJjkWUN.js";import{S as V}from"./SectionHeader-Brkl_dpu.js";import"./vendor-BY35fGmp.js";function Z({apiEndpoint:i,apiKey:h,certificateNumber:u,systemName:S,organizationName:k}){const c=new Date().toISOString();return`#!/usr/bin/env python3
"""
ENVELO Interlock - Sentinel Authority
Enforced Non-Violable Execution-Limit Override

System:       ${S}
Certificate:  ${u}
Organization: ${k}
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
API_ENDPOINT = "${i}"
API_KEY      = "${h}"
CERTIFICATE  = "${u}"
SYSTEM_NAME  = "${S}"

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
`}function te({session:i}){var u;if(!i)return null;const h=i.pass_count+i.block_count>0?(i.pass_count/(i.pass_count+i.block_count)*100).toFixed(1):0;return e.jsxs("div",{children:[e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"16px",marginBottom:"24px"},children:[e.jsxs("div",{style:{padding:"16px",background:"transparent",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:t.textPrimary},children:(i.pass_count||0)+(i.block_count||0)}),e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,textTransform:"uppercase"},children:"Total Actions"})]}),e.jsxs("div",{style:{padding:"16px",background:"transparent",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:t.accentGreen},children:i.pass_count||0}),e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,textTransform:"uppercase"},children:"Passed"})]}),e.jsxs("div",{style:{padding:"16px",background:"transparent",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:t.accentRed},children:i.block_count||0}),e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,textTransform:"uppercase"},children:"Blocked"})]}),e.jsxs("div",{style:{padding:"16px",background:h>=95?"rgba(22,135,62,0.08)":"rgba(180,52,52,0.04)",textAlign:"center"},children:[e.jsxs("div",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:500,color:h>=95?t.accentGreen:t.accentRed},children:[h,"%"]}),e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,textTransform:"uppercase"},children:"Pass Rate"})]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"16px"},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,marginBottom:"4px"},children:"SESSION ID"}),e.jsx("div",{style:{fontFamily:t.mono,color:t.textSecondary},children:i.session_id})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,marginBottom:"4px"},children:"CERTIFICATE"}),e.jsx("div",{style:{color:t.textSecondary},children:i.certificate_id||"N/A"})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,marginBottom:"4px"},children:"STARTED"}),e.jsx("div",{style:{color:t.textSecondary},children:i.started_at?new Date(i.started_at).toLocaleString():"N/A"})]}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"11px",color:t.textTertiary,marginBottom:"4px"},children:"STATUS"}),e.jsx("span",{style:{padding:"4px 12px",fontSize:"12px",background:i.status==="active"?"rgba(22,135,62,0.10)":"rgba(0,0,0,0.04)",color:i.status==="active"?t.accentGreen:t.textTertiary},children:(u=i.status)==null?void 0:u.toUpperCase()})]})]})]})}function ne({sessionId:i}){const[h,u]=a.useState([]),[S,k]=a.useState(!0);return a.useEffect(()=>{i&&d.get(`/api/envelo/admin/sessions/${i}/telemetry`).then(c=>u(c.data.records||[])).catch(console.error).finally(()=>k(!1))},[i]),S?e.jsx("div",{style:{color:t.textTertiary,padding:"12px"},children:"Loading..."}):h.length?e.jsx("div",{style:{maxHeight:"300px",overflowY:"auto"},children:e.jsxs("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:"12px"},children:[e.jsx("thead",{children:e.jsxs("tr",{style:{borderBottom:"1px solid "+t.borderGlass,borderRadius:8},children:[e.jsx("th",{style:{padding:"8px",textAlign:"left",color:t.textTertiary},children:"Time"}),e.jsx("th",{style:{padding:"8px",textAlign:"left",color:t.textTertiary},children:"Action"}),e.jsx("th",{style:{padding:"8px",textAlign:"left",color:t.textTertiary},children:"Result"}),e.jsx("th",{style:{padding:"8px",textAlign:"left",color:t.textTertiary},children:"Params"})]})}),e.jsx("tbody",{children:h.map((c,A)=>e.jsxs("tr",{style:{borderBottom:"1px solid "+t.borderSubtle,borderRadius:8},children:[e.jsx("td",{style:{padding:"8px",fontFamily:t.mono,fontSize:"11px",color:t.textTertiary},children:c.timestamp?new Date(c.timestamp).toLocaleTimeString():"-"}),e.jsx("td",{style:{padding:"8px",color:t.textPrimary},children:c.action_type}),e.jsx("td",{style:{padding:"8px"},children:e.jsx("span",{style:{padding:"2px 8px",fontSize:"10px",fontWeight:400,background:c.result==="PASS"?"rgba(22,135,62,0.10)":"rgba(180,52,52,0.10)",color:c.result==="PASS"?t.accentGreen:t.accentRed},children:c.result})}),e.jsx("td",{style:{padding:"8px",color:t.textTertiary,fontFamily:t.mono,fontSize:"10px"},children:JSON.stringify(c.parameters||{})})]},A))})]})}):e.jsx("div",{style:{color:t.textTertiary,padding:"12px"},children:"No telemetry records"})}function re({onKeyGenerated:i}){const[h,u]=a.useState([]),[S,k]=a.useState(!0),[c,A]=a.useState(""),[g,C]=a.useState(null);a.useEffect(()=>{g!=null&&g.key&&(i==null||i(g.key))},[g]),a.useEffect(()=>{N()},[]);const P=l=>{const x=L.find(R=>R.id===_),b=Z({apiEndpoint:M,apiKey:l,certificateNumber:(x==null?void 0:x.certificate_number)||"PENDING",systemName:(x==null?void 0:x.system_name)||"My System",organizationName:(x==null?void 0:x.organization_name)||""}),T=new Blob([b],{type:"text/plain"}),w=URL.createObjectURL(T),F=document.createElement("a");F.href=w,F.download="envelo_agent.py",document.body.appendChild(F),F.click(),document.body.removeChild(F),URL.revokeObjectURL(w)},N=async()=>{try{const l=await d.get("/api/apikeys/");u(l.data)}catch(l){console.error("Failed to load API keys:",l)}k(!1)},[L,O]=a.useState([]),[_,B]=a.useState(null);a.useEffect(()=>{d.get("/api/certificates/").then(l=>{const x=(l.data||[]).filter(b=>b.state==="conformant"||b.state==="active"||b.state==="issued");O(x),x.length>0&&B(x[0].id)}).catch(()=>{})},[]);const I=async()=>{if(c.trim())try{const l=await d.post("/api/apikeys/generate",{name:c,certificate_id:_});C(l.data),A(""),N()}catch(l){console.error("Failed to generate key:",l)}},W=async l=>{if(await confirm({title:"Revoke Key",message:"Revoke this API key? This cannot be undone.",danger:!0,confirmLabel:"Revoke"}))try{await d.delete(`/api/apikeys/${l}`),N()}catch(x){console.error("Failed to revoke key:",x)}},z=()=>{g!=null&&g.key&&navigator.clipboard.writeText(g.key)};return S?e.jsx("div",{style:{color:t.textTertiary},children:"Loading..."}):e.jsxs("div",{children:[g&&e.jsxs("div",{style:{background:t.cardSurface,border:"1px solid "+t.borderSubtle,padding:"16px",marginBottom:"20px",borderRadius:8},children:[e.jsx("div",{style:{fontFamily:t.mono,fontSize:"11px",color:t.accentGreen,marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"},children:"✓ New API Key Generated"}),e.jsx("div",{style:{background:"transparent",padding:"12px",fontFamily:t.mono,fontSize:"13px",color:t.textPrimary,wordBreak:"break-all",marginBottom:"12px"},children:g.key}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsx("button",{onClick:z,style:{padding:"8px 16px",background:"transparent",border:"none",borderBottom:`1px solid ${t.purpleBright}`,color:t.purpleBright,fontFamily:t.mono,fontSize:"11px",cursor:"pointer"},children:"Copy to Clipboard"}),e.jsx("button",{onClick:()=>C(null),style:{padding:"8px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,color:t.textSecondary,fontFamily:t.mono,fontSize:"11px",cursor:"pointer"},children:"Dismiss"})]}),e.jsx("p",{style:{color:t.textTertiary,fontSize:"12px",marginTop:"12px"},children:"⚠️ Save this key now. You won't be able to see it again."}),e.jsxs("div",{style:{marginTop:"16px",padding:"16px",background:"rgba(74,61,117,0.2)",border:"1px solid rgba(74,61,117,0.3)"},children:[e.jsx("div",{style:{fontFamily:t.mono,fontSize:"11px",color:t.purpleBright,marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"},children:"Next Step"}),e.jsx("p",{style:{color:t.textSecondary,fontSize:"13px",marginBottom:"12px"},children:"Download the ENVELO Interlock pre-configured with your credentials:"}),e.jsxs("button",{onClick:()=>P(g.key),style:{padding:"12px 24px",background:"transparent",border:"none",borderBottom:`1px solid ${t.purpleBright}`,color:t.purpleBright,fontFamily:t.mono,fontSize:"12px",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx(Q,{size:16})," Download ENVELO Interlock"]})]})]}),e.jsxs("div",{style:{display:"flex",gap:"12px",marginBottom:"20px"},children:[e.jsx("input",{type:"text",placeholder:"Key name (e.g., Production)",value:c,onChange:l=>A(l.target.value),style:{flex:1,padding:"10px 14px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,color:t.textPrimary,fontFamily:t.mono,fontSize:"13px"}}),e.jsx("button",{onClick:I,disabled:!c.trim(),style:{padding:"10px 20px",background:c.trim()?t.purplePrimary:"transparent",border:`1px solid ${c.trim()?t.purpleBright:t.borderGlass}`,color:c.trim()?"#fff":t.textTertiary,fontFamily:t.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:c.trim()?"pointer":"not-allowed"},children:"Generate Key"})]}),h.length>0?e.jsxs("div",{children:[e.jsx("div",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"12px",textTransform:"uppercase",letterSpacing:"1px"},children:"Your API Keys"}),h.map(l=>e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",padding:"12px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,marginBottom:"8px"},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontFamily:t.mono,fontSize:"13px",color:t.textPrimary},children:l.name}),e.jsxs("div",{style:{fontFamily:t.mono,fontSize:"11px",color:t.textTertiary,marginTop:"4px"},children:[l.key_prefix,"••••••••"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"16px"},children:[e.jsx("span",{style:{fontSize:"11px",color:t.textTertiary},children:l.last_used_at?`Last used: ${new Date(l.last_used_at).toLocaleDateString()}`:"Never used"}),e.jsx("button",{onClick:()=>W(l.id),style:{padding:"6px 12px",background:"rgba(180,52,52,0.06)",border:"1px solid rgba(180,52,52,0.22)",color:t.accentRed,fontFamily:t.mono,fontSize:"10px",cursor:"pointer"},children:"Revoke"})]})]},l.id))]}):e.jsx("p",{style:{color:t.textTertiary,fontSize:"14px"},children:"No API keys yet. Generate one to connect the ENVELO Interlock."})]})}function oe(){var D;const i=X();ee();const[h,u]=a.useState(null),[S,k]=a.useState([]),[c,A]=a.useState([]),[g,C]=a.useState([]),[P,N]=a.useState(0),[L,O]=a.useState({}),[_,B]=a.useState(null),[I,W]=a.useState(null),[z,l]=a.useState("monitoring"),[x,b]=a.useState(""),[T,w]=a.useState(null),[F,R]=a.useState(!0);if(a.useEffect(()=>{const r=async()=>{try{const[n,o,p,m]=await Promise.all([d.get("/api/envelo/stats").catch(()=>({data:null})),d.get("/api/envelo/admin/sessions").catch(()=>({data:{sessions:[]}})),d.get("/api/certificates/").catch(()=>({data:[]})),d.get("/api/applications/").catch(()=>({data:[]}))]);u(n.data),k(o.data.sessions||[]),A(p.data||[]),C(m.data.applications||m.data||[])}catch(n){console.error(n)}R(!1)};r();const f=setInterval(r,3e4);return()=>clearInterval(f)},[]),F)return e.jsx("div",{style:{color:t.textTertiary,padding:"clamp(16px, 4vw, 40px)",textAlign:"center"},children:e.jsx(J,{size:24,style:{animation:"spin 1s linear infinite"}})});const K=S.filter(r=>r.status==="active"),$=S.reduce((r,f)=>r+(f.block_count||0),0),G=c.filter(r=>r.state==="conformant"||r.state==="active"||r.state==="issued"),E=g.filter(r=>r.state==="approved"||r.state==="testing"),Y=r=>{const f=Z({apiEndpoint:M,apiKey:"YOUR_API_KEY",certificateNumber:r.certificate_number,systemName:r.system_name||"Unknown",organizationName:r.organization_name||"Unknown"}),n=new Blob([f],{type:"text/plain"}),o=URL.createObjectURL(n),p=document.createElement("a");p.href=o,p.download=`envelo_agent_${r.certificate_number}.py`,document.body.appendChild(p),p.click(),document.body.removeChild(p),URL.revokeObjectURL(o)};return e.jsxs("div",{className:"space-y-6",children:[e.jsx(V,{label:"⬡ Admin Console",title:"ENVELO Management",description:"Monitor, configure, and manage all customer systems"}),e.jsx("div",{style:{display:"flex",gap:"8px",borderBottom:`1px solid ${t.borderGlass}`,paddingBottom:"16px",overflowX:"auto",WebkitOverflowScrolling:"touch"},children:[{id:"monitoring",label:"Live Monitoring"},{id:"customers",label:"Customer Systems"},{id:"review",label:"Review Boundaries"}].map(r=>e.jsx("button",{onClick:()=>l(r.id),style:{padding:"10px 20px",background:z===r.id?"rgba(74,61,117,0.08)":"transparent",border:`1px solid ${z===r.id?"rgba(74,61,117,0.60)":t.borderGlass}`,color:z===r.id?"rgba(74,61,117,1.00)":t.textSecondary,fontFamily:t.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",whiteSpace:"nowrap",flexShrink:0},children:r.label},r.id))}),e.jsxs("div",{className:"grid gap-4",style:{gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))"},children:[e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:"Active Sessions"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:t.accentGreen},children:K.length})]}),e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:"Attested Systems"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:t.purpleBright},children:G.length})]}),e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:"CAT-72 In Progress"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:t.accentAmber},children:E.length})]}),e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:"Violations (Total)"}),e.jsx("p",{style:{fontSize:"clamp(24px, 5vw, 36px)",fontWeight:200,color:$>0?t.accentRed:t.accentGreen},children:$})]})]}),z==="monitoring"&&e.jsxs(e.Fragment,{children:[e.jsxs(y,{glow:!0,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",marginBottom:"20px"},children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Active Sessions"}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"4px 12px",background:"transparent"},children:[e.jsx("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:t.accentGreen,animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontFamily:t.mono,fontSize:"10px",color:t.accentGreen,textTransform:"uppercase"},children:"Live"})]})]}),S.length>0?e.jsx("div",{className:"table-scroll",style:{overflowX:"auto",WebkitOverflowScrolling:"touch"},children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{style:{borderBottom:`1px solid ${t.borderGlass}`},children:[e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:t.mono,fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:t.textTertiary,fontWeight:400},children:"Certificate"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:t.mono,fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:t.textTertiary,fontWeight:400},children:"Status"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:t.mono,fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:t.textTertiary,fontWeight:400},children:"Pass"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:t.mono,fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:t.textTertiary,fontWeight:400},children:"Block"}),e.jsx("th",{style:{padding:"12px 16px",textAlign:"left",fontFamily:t.mono,fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:t.textTertiary,fontWeight:400},children:"Actions"})]})}),e.jsx("tbody",{children:S.map((r,f)=>e.jsxs("tr",{style:{borderBottom:`1px solid ${t.borderGlass}`},children:[e.jsx("td",{style:{padding:"16px",fontFamily:t.mono,fontSize:"12px",color:t.purpleBright},children:r.certificate_id||"N/A"}),e.jsx("td",{style:{padding:"16px"},children:e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:r.status==="active"?t.accentGreen:t.textTertiary}}),e.jsx("span",{style:{fontFamily:t.mono,fontSize:"11px",textTransform:"uppercase",color:r.status==="active"?t.accentGreen:t.textTertiary},children:r.status})]})}),e.jsx("td",{style:{padding:"16px",color:t.accentGreen},children:r.pass_count||0}),e.jsx("td",{style:{padding:"16px",color:(r.block_count||0)>0?t.accentRed:t.textTertiary},children:r.block_count||0}),e.jsx("td",{style:{padding:"16px"},children:e.jsx("button",{onClick:()=>B(r),style:{padding:"6px 12px",background:"transparent",border:`1px solid ${t.purpleBright}`,color:t.purpleBright,fontSize:"11px",cursor:"pointer"},children:"View Details"})})]},f))})]})}):e.jsx("p",{style:{color:t.textTertiary,textAlign:"center",padding:"clamp(16px, 4vw, 40px)"},children:"No sessions found."})]}),_&&e.jsxs(y,{accent:"purple",children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",marginBottom:"20px"},children:[e.jsxs("p",{style:{fontFamily:t.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:["Session: ",(D=_.session_id)==null?void 0:D.substring(0,16),"..."]}),e.jsxs("div",{style:{display:"flex",gap:"12px"},children:[e.jsx("button",{onClick:async()=>{try{const r=await d.get(`/api/envelo/admin/sessions/${_.id}/report`,{responseType:"blob"}),f=window.URL.createObjectURL(new Blob([r.data])),n=document.createElement("a");n.href=f,n.download=`CAT72-Report-${_.session_id}.pdf`,n.click()}catch(r){i.show("Failed: "+r.message,"error")}},style:{padding:"8px 16px",background:"transparent",border:"none",color:t.purpleBright,fontSize:"11px",cursor:"pointer"},children:"Download Report"}),e.jsx("button",{onClick:()=>B(null),style:{padding:"8px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,color:t.textTertiary,cursor:"pointer",fontSize:"11px"},children:"✕ Close"})]})]}),e.jsx(te,{session:_}),e.jsx("div",{style:{marginTop:"20px"},children:e.jsx(ne,{sessionId:_.id})})]})]}),z==="customers"&&e.jsxs(e.Fragment,{children:[e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"20px"},children:"Attested Systems"}),G.length>0?e.jsx("div",{className:"space-y-4",children:G.map(r=>e.jsx("div",{style:{padding:"20px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`},children:e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"16px"},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:"16px",fontWeight:500,color:t.textPrimary,margin:"0 0 4px 0"},children:r.system_name||"Unnamed"}),e.jsx("p",{style:{fontSize:"13px",color:t.textSecondary,marginBottom:"8px"},children:r.organization_name}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"12px",color:t.purpleBright},children:r.certificate_number})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"},children:[e.jsxs("button",{onClick:()=>{w(r),l("review")},style:{padding:"8px 16px",background:"transparent",border:`1px solid ${t.purpleBright}`,color:t.purpleBright,fontSize:"11px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx(U,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:12})," Review Boundaries"]}),e.jsx("span",{style:{padding:"8px 16px",background:t.cardSurface,border:"1px solid "+t.borderSubtle,color:t.accentGreen,fontSize:"11px",display:"flex",alignItems:"center",gap:"6px",borderRadius:8},children:"✓ Auto-provisioned on Approve"}),e.jsxs("button",{onClick:()=>Y(r),style:{padding:"8px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,color:t.textSecondary,fontSize:"11px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx(Q,{size:12})," Download Only"]})]})]})},r.id))}):e.jsx("p",{style:{color:t.textTertiary,textAlign:"center",padding:"24px"},children:"No attested systems yet."})]}),E.length>0&&e.jsxs(y,{accent:"amber",children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:t.accentAmber,marginBottom:"20px"},children:"CAT-72 Testing In Progress"}),e.jsx("div",{className:"space-y-4",children:E.map(r=>e.jsx("div",{style:{padding:"16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`},children:e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontSize:"14px",color:t.textPrimary,marginBottom:"4px"},children:r.system_name}),e.jsx("p",{style:{fontSize:"12px",color:t.textSecondary},children:r.organization_name})]}),e.jsx("span",{style:{padding:"4px 12px",background:t.cardSurface,border:"1px solid "+t.borderSubtle,fontSize:"10px",color:t.accentAmber,fontFamily:t.mono,textTransform:"uppercase",borderRadius:8},children:r.cat72_started?"In Progress":"Ready"})]})},r.id))})]}),e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"16px"},children:"API Key Management"}),e.jsx(re,{})]})]}),z==="review"&&e.jsx(e.Fragment,{children:T?(()=>{const r=T.envelope_definition||{},f=r.numeric_boundaries||[],n=r.geographic_boundaries||[],o=r.time_boundaries||[],p=r.state_boundaries||[],m=f.length+n.length+o.length+p.length>0;return e.jsxs(y,{glow:!0,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"24px"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.purpleBright,marginBottom:"8px"},children:"Boundary Review — Read Only"}),e.jsx("h2",{style:{fontFamily:t.serif,fontSize:"clamp(18px, 4vw, 24px)",fontWeight:200,margin:"0 0 4px 0"},children:T.system_name}),e.jsxs("p",{style:{color:t.textSecondary},children:[T.organization_name," • ",T.certificate_number]})]}),e.jsx("button",{onClick:()=>w(null),style:{padding:"8px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,color:t.textTertiary,cursor:"pointer",fontSize:"11px"},children:"← Back"})]}),e.jsx("div",{style:{padding:"12px 16px",background:t.cardSurface,border:"1px solid "+t.borderGlass,marginBottom:"24px",borderRadius:8},children:e.jsx("p",{style:{color:t.accentAmber,fontSize:"13px",margin:0},children:"⚠ Sentinel Authority does not modify customer boundaries. Review and approve as submitted, or reject with required changes."})}),m?e.jsxs("div",{className:"space-y-6",children:[f.length>0&&e.jsxs("div",{children:[e.jsxs("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:["Numeric Boundaries (",f.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:f.map((s,v)=>e.jsxs("div",{style:{padding:"14px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Parameter"}),e.jsx("p",{style:{fontWeight:500,color:t.textPrimary,fontSize:"14px"},children:s.name||s.parameter||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Range"}),e.jsxs("p",{style:{color:t.purpleBright,fontFamily:t.mono,fontSize:"13px"},children:[s.min_value??"—"," → ",s.max_value??"—"," ",s.unit||""]})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Hard Limit"}),e.jsx("p",{style:{color:s.hard_limit?t.accentRed:t.textTertiary,fontFamily:t.mono,fontSize:"13px"},children:s.hard_limit??"None"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Tolerance"}),e.jsxs("p",{style:{color:t.textSecondary,fontFamily:t.mono,fontSize:"13px"},children:["±",s.tolerance||0]})]})]},v))})]}),n.length>0&&e.jsxs("div",{children:[e.jsxs("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:["Geographic Boundaries (",n.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:n.map((s,v)=>{var j,H;return e.jsxs("div",{style:{padding:"14px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Zone"}),e.jsx("p",{style:{fontWeight:500,color:t.textPrimary,fontSize:"14px"},children:s.name||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Type"}),e.jsx("p",{style:{color:t.textSecondary,fontSize:"13px"},children:s.boundary_type||"circle"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Center"}),e.jsxs("p",{style:{color:t.purpleBright,fontFamily:t.mono,fontSize:"12px"},children:[((j=s.center)==null?void 0:j.lat)||s.lat||"—",", ",((H=s.center)==null?void 0:H.lon)||s.lon||"—"]})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Radius"}),e.jsxs("p",{style:{color:t.textSecondary,fontFamily:t.mono,fontSize:"13px"},children:[s.radius_meters||"—","m"]})]})]},v)})})]}),o.length>0&&e.jsxs("div",{children:[e.jsxs("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:["Time Boundaries (",o.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:o.map((s,v)=>e.jsxs("div",{style:{padding:"14px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Schedule"}),e.jsx("p",{style:{fontWeight:500,color:t.textPrimary,fontSize:"14px"},children:s.name||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Hours"}),e.jsxs("p",{style:{color:t.purpleBright,fontFamily:t.mono,fontSize:"13px"},children:[s.allowed_hours_start??s.start_hour??0,":00 → ",s.allowed_hours_end??s.end_hour??24,":00 ",s.timezone||"UTC"]})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Days"}),e.jsx("p",{style:{color:t.textSecondary,fontSize:"12px"},children:(s.allowed_days||s.days||[]).map(j=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][j]||j).join(", ")||"All"})]})]},v))})]}),p.length>0&&e.jsxs("div",{children:[e.jsxs("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:["State Boundaries (",p.length,")"]}),e.jsx("div",{style:{display:"grid",gap:"8px"},children:p.map((s,v)=>e.jsxs("div",{style:{padding:"14px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",gap:"16px",alignItems:"center"},children:[e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Parameter"}),e.jsx("p",{style:{fontWeight:500,color:t.textPrimary,fontSize:"14px"},children:s.name||s.parameter||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Allowed"}),e.jsx("p",{style:{color:t.accentGreen,fontSize:"12px"},children:(s.allowed_values||[]).join(", ")||"—"})]}),e.jsxs("div",{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary,marginBottom:"2px"},children:"Forbidden"}),e.jsx("p",{style:{color:t.accentRed,fontSize:"12px"},children:(s.forbidden_values||[]).join(", ")||"—"})]})]},v))})]})]}):e.jsx("p",{style:{color:t.textTertiary,textAlign:"center",padding:"clamp(16px, 4vw, 40px)"},children:"No boundaries defined in this application."}),e.jsxs("div",{style:{marginTop:"32px",paddingTop:"24px",borderTop:`1px solid ${t.borderGlass}`},children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"16px"},children:"Review Decision"}),e.jsx("textarea",{value:x,onChange:s=>b(s.target.value),placeholder:"Review notes (required for rejection, optional for approval)...",style:{width:"100%",minHeight:"80px",padding:"12px 16px",background:t.cardSurface,border:`1px solid ${t.borderGlass}`,color:t.textPrimary,fontSize:"13px",fontFamily:"Georgia, 'Source Serif 4', serif",resize:"vertical"}}),e.jsxs("div",{style:{display:"flex",gap:"12px",marginTop:"16px"},children:[e.jsx("button",{onClick:async()=>{var s,v;try{await d.post(`/api/applications/${T.application_id||"unknown"}/comments`,{content:"[BOUNDARY REVIEW — APPROVED] "+(x||"Boundaries approved as submitted."),is_internal:!1}),i.show("Boundaries approved as submitted","success"),w(null),b("")}catch(j){i.show("Failed: "+(((v=(s=j.response)==null?void 0:s.data)==null?void 0:v.detail)||j.message),"error")}},style:{flex:1,padding:"14px",background:"transparent",border:`1px solid ${t.accentGreen}`,color:t.accentGreen,fontFamily:t.mono,fontSize:"12px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer"},children:"✓ Approve Boundaries"}),e.jsx("button",{onClick:async()=>{var s,v;if(!x.trim()){i.show("Rejection requires specific feedback on what must change","error");return}try{await d.post(`/api/applications/${T.application_id||"unknown"}/comments`,{content:"[BOUNDARY REVIEW — CHANGES REQUIRED] "+x,is_internal:!1}),i.show("Sent back to applicant with required changes","success"),w(null),b("")}catch(j){i.show("Failed: "+(((v=(s=j.response)==null?void 0:s.data)==null?void 0:v.detail)||j.message),"error")}},style:{flex:1,padding:"14px",background:t.cardSurface,border:"1px solid "+t.borderSubtle,color:t.accentRed,fontFamily:t.mono,fontSize:"12px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",borderRadius:8},children:"✗ Reject — Require Changes"})]})]})]})})():e.jsx(y,{children:e.jsxs("div",{style:{textAlign:"center",padding:"clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)"},children:[e.jsx(U,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:48,style:{color:t.textTertiary,margin:"0 auto 16px"}}),e.jsx("h2",{style:{fontFamily:t.serif,fontSize:"20px",fontWeight:200,marginBottom:"8px"},children:"Select a System to Review"}),e.jsx("p",{style:{color:t.textSecondary,marginBottom:"24px"},children:"Choose a system from the Customer Systems tab to review its submitted boundaries."}),e.jsx("button",{onClick:()=>l("customers"),style:{padding:"12px 24px",background:"transparent",border:"none",borderBottom:`1px solid ${t.purpleBright}`,color:t.purpleBright,fontFamily:t.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer"},children:"View Customer Systems"})]})})})]})}function ie(){var f;const[i,h]=a.useState(null),[u,S]=a.useState(!1),[k,c]=a.useState([]),[A,g]=a.useState([]),[C,P]=a.useState([]),[N,L]=a.useState([]),[O,_]=a.useState(!0),[B,I]=a.useState(!1),[W,z]=a.useState(!1),l=X(),{user:x}=q();a.useEffect(()=>{(async()=>{try{const[o,p,m,s]=await Promise.all([d.get("/api/certificates/").catch(()=>({data:[]})),d.get("/api/applications/").catch(()=>({data:[]})),d.get("/api/envelo/sessions").catch(()=>({data:{sessions:[]}})),d.get("/api/apikeys/").catch(()=>({data:[]}))]);c(o.data||[]),g(p.data||[]),P(m.data.sessions||[]),L(s.data||[])}catch(o){console.error(o)}_(!1)})()},[]);const b=(Array.isArray(k)?k:[]).filter(n=>n.state==="conformant"||n.state==="active"||n.state==="issued"),T=(Array.isArray(A)?A:[]).filter(n=>n.state==="approved"||n.state==="testing"),w=[...T,...b],F=b.length>0||T.length>0,R=C.filter(n=>n.status==="active"),K=R.length>0,$=async()=>{var n,o,p;S(!0);try{const m=w[0],s=(m==null?void 0:m.certificate_id)||null,v="deploy-"+new Date().toISOString().split("T")[0],j=await d.post("/api/apikeys/generate",{name:v,certificate_id:s});(n=j.data)!=null&&n.key&&h(j.data.key)}catch(m){l.show("Failed to generate key: "+(((p=(o=m.response)==null?void 0:o.data)==null?void 0:p.detail)||m.message),"error")}S(!1)},G=()=>{const n=w[0];return(n==null?void 0:n.certificate_number)||(n==null?void 0:n.application_number)||"PENDING"},E=()=>i?'curl -sSL "'+M+"/api/deploy/"+G()+"?key="+i+'" | bash':null,Y=()=>{const n=E();n&&(navigator.clipboard.writeText(n),I(!0),setTimeout(()=>I(!1),3e3))};if(O)return e.jsx("div",{style:{color:t.textTertiary,padding:"clamp(16px, 4vw, 40px)",textAlign:"center"},children:e.jsx(J,{size:24,style:{animation:"spin 1s linear infinite"}})});if(!F)return e.jsxs("div",{className:"space-y-6",children:[e.jsx(V,{label:"ENVELO Interlock",title:"Application Required"}),e.jsx(y,{children:e.jsxs("div",{style:{textAlign:"center",padding:"clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)"},children:[e.jsx(U,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:48,style:{color:t.textTertiary,margin:"0 auto 16px"}}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(18px, 4vw, 24px)",fontWeight:200,marginBottom:"12px"},children:"Pending Approval"}),e.jsx("p",{style:{color:t.textSecondary,maxWidth:"min(400px, 90vw)",margin:"0 auto"},children:"Your application is being reviewed. Once approved, you'll deploy the ENVELO agent with a single command."})]})})]});if(K)return e.jsxs("div",{className:"space-y-6",children:[e.jsx(V,{label:"ENVELO Interlock",title:"Active",description:"Your agent is connected and enforcing boundaries"}),b.map(n=>{const o=C.find(m=>m.certificate_id===n.certificate_number),p=o&&o.status==="active";return e.jsxs(y,{glow:p,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"20px"},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:"20px",fontWeight:500,color:t.textPrimary,margin:"0 0 8px 0"},children:n.system_name||"System"}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"13px",color:t.purpleBright,marginBottom:"4px"},children:n.certificate_number}),e.jsx("p",{style:{fontSize:"12px",color:t.textTertiary},children:"Attested "+(n.issued_at?new Date(n.issued_at).toLocaleDateString():"N/A")})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:t.accentGreen,animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontFamily:t.mono,fontSize:"11px",textTransform:"uppercase",color:t.accentGreen},children:"ENVELO Active"})]})]}),o&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"16px",marginTop:"24px",paddingTop:"24px",borderTop:"1px solid "+t.borderGlass,borderRadius:8},children:[e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:t.accentGreen},children:o.uptime||"0h"}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Uptime"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:t.purpleBright},children:o.record_count||0}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Telemetry"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:(o.violations||0)>0?t.accentRed:t.accentGreen},children:o.violations||0}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Violations"})]})]})]},n.id)}),T.filter(n=>!b.some(o=>o.application_id===n.id)).map(n=>{const o=R[0];return e.jsxs(y,{glow:!0,children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:"20px",fontWeight:500,color:t.textPrimary,margin:"0 0 4px 0"},children:n.system_name}),e.jsxs("p",{style:{fontFamily:t.mono,fontSize:"13px",color:t.accentAmber},children:[n.application_number," — CAT-72 Testing"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:t.accentGreen,animation:"pulse 2s infinite"}}),e.jsx("span",{style:{fontFamily:t.mono,fontSize:"11px",textTransform:"uppercase",color:t.accentGreen},children:"ENVELO Active"})]})]}),o&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"16px",marginTop:"24px",paddingTop:"24px",borderTop:"1px solid "+t.borderGlass,borderRadius:8},children:[e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:t.accentGreen},children:o.pass_count||0}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Passed"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:(o.block_count||0)>0?t.accentRed:t.accentGreen},children:o.block_count||0}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Blocked"})]}),e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("p",{style:{fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,color:t.purpleBright},children:(o.pass_count||0)+(o.block_count||0)}),e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary},children:"Total"})]})]})]},n.id)}),e.jsxs(y,{children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"16px"},children:"Agent Control"}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"12px"},children:[e.jsxs("button",{onClick:async()=>{var n,o;if(confirm("Stop the ENVELO agent? It will shut down within 30 seconds."))try{const p=await d.get("/api/apikeys/");for(const m of p.data||[])await d.delete(`/api/apikeys/${m.id}`);l.show("Agent will stop within 30 seconds","success"),setTimeout(()=>window.location.reload(),3e3)}catch(p){l.show("Failed: "+(((o=(n=p.response)==null?void 0:n.data)==null?void 0:o.detail)||p.message),"error")}},style:{padding:"16px",background:t.cardSurface,border:"1px solid "+t.borderGlass,cursor:"pointer",textAlign:"left",borderRadius:8},children:[e.jsx("p",{style:{fontWeight:500,color:t.accentRed,marginBottom:"4px",fontSize:"14px"},children:"⏹ Stop Agent"}),e.jsx("p",{style:{color:t.textTertiary,fontSize:"11px",margin:0},children:"Revokes API key. Agent shuts down within 30s."})]}),e.jsxs("button",{onClick:async()=>{var n,o;if(confirm("Redeploy? This revokes your current key and generates a new deploy command."))try{const p=await d.get("/api/apikeys/");for(const m of p.data||[])await d.delete(`/api/apikeys/${m.id}`);l.show("Old agent stopping. Generating new deploy...","success"),setTimeout(()=>window.location.reload(),2e3)}catch(p){l.show("Failed: "+(((o=(n=p.response)==null?void 0:n.data)==null?void 0:o.detail)||p.message),"error")}},style:{padding:"16px",background:"transparent",border:"1px solid rgba(74,61,117,0.2)",cursor:"pointer",textAlign:"left"},children:[e.jsx("p",{style:{fontWeight:500,color:t.purpleBright,marginBottom:"4px",fontSize:"14px"},children:"↻ Redeploy"}),e.jsx("p",{style:{color:t.textTertiary,fontSize:"11px",margin:0},children:"Stop current agent and get a fresh deploy command."})]}),e.jsxs("button",{onClick:async()=>{var n,o;if(confirm("Uninstall ENVELO agent? This revokes all keys and shows cleanup instructions."))try{const p=await d.get("/api/apikeys/");for(const m of p.data||[])await d.delete(`/api/apikeys/${m.id}`);l.show("Keys revoked. Run the cleanup command below.","success"),z(!0)}catch(p){l.show("Failed: "+(((o=(n=p.response)==null?void 0:n.data)==null?void 0:o.detail)||p.message),"error")}},style:{padding:"16px",background:t.cardSurface,border:"1px solid "+t.borderGlass,cursor:"pointer",textAlign:"left",borderRadius:8},children:[e.jsx("p",{style:{fontWeight:500,color:t.textSecondary,marginBottom:"4px",fontSize:"14px"},children:"⊘ Uninstall"}),e.jsx("p",{style:{color:t.textTertiary,fontSize:"11px",margin:0},children:"Remove agent, config, and auto-restart service."})]})]}),W&&e.jsxs("div",{style:{marginTop:"16px",padding:"16px",background:t.cardSurface,border:"1px solid "+t.borderGlass,borderRadius:8},children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:t.accentAmber,marginBottom:"8px"},children:"Paste in terminal to fully remove"}),e.jsx("div",{style:{fontFamily:t.mono,fontSize:"12px",color:t.textSecondary,padding:"12px",background:"transparent",whiteSpace:"pre-wrap",lineHeight:"1.8"},children:`# Stop agent
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

echo "✓ ENVELO uninstalled"`})]}),e.jsxs("div",{style:{marginTop:"16px",padding:"12px",background:"transparent"},children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"8px"},children:"Logs"}),e.jsx("div",{style:{fontFamily:t.mono,fontSize:"12px",color:t.textSecondary,padding:"8px",background:"transparent"},children:"cat ~/.envelo/envelo.log"})]})]})]});const D=((f=w[0])==null?void 0:f.system_name)||"Your System",r=E();return e.jsxs("div",{className:"space-y-6",children:[e.jsx(V,{label:"ENVELO Interlock",title:"Deploy",description:"Ready to deploy "+D}),e.jsx(y,{glow:!0,children:e.jsx("div",{style:{textAlign:"center",padding:"clamp(20px, 4vw, 40px) clamp(12px, 3vw, 20px)"},children:i?e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:{marginBottom:"24px"},children:[e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent",marginBottom:"16px"},children:[e.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:t.accentGreen}}),e.jsx("span",{style:{fontFamily:t.mono,fontSize:"11px",color:t.accentGreen,textTransform:"uppercase",letterSpacing:"1px"},children:"Ready to Deploy"})]}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(18px, 4vw, 24px)",fontWeight:200,color:t.textPrimary,margin:"0 0 8px 0"},children:"Paste in your terminal"})]}),e.jsxs("div",{style:{maxWidth:"min(700px, 95vw)",margin:"0 auto",textAlign:"left"},children:[e.jsxs("div",{style:{background:"transparent",border:"1px solid "+t.purpleBright,overflow:"hidden"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:t.cardSurface,borderBottom:"1px solid "+t.borderGlass,borderRadius:8},children:[e.jsxs("div",{style:{display:"flex",gap:"6px"},children:[e.jsx("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:"#ff5f57"}}),e.jsx("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:"#febc2e"}}),e.jsx("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:"#28c840"}})]}),e.jsx("span",{style:{fontFamily:t.mono,fontSize:"10px",color:t.textTertiary},children:"Terminal"}),e.jsx("button",{onClick:Y,style:{padding:"4px 16px",background:B?"rgba(22,135,62,0.10)":t.purplePrimary,border:"1px solid "+(B?t.accentGreen:t.purpleBright),color:B?t.accentGreen:"#fff",fontFamily:t.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer"},children:B?"✓ Copied":"Copy"})]}),e.jsxs("div",{style:{padding:"20px",fontFamily:t.mono,fontSize:"13px",lineHeight:"1.6",overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all"},children:[e.jsx("span",{style:{color:t.accentGreen},children:"$"})," ",e.jsx("span",{style:{color:t.textPrimary},children:r})]})]}),e.jsxs("div",{style:{marginTop:"20px",padding:"16px",background:t.cardSurface,border:"1px solid "+t.borderGlass,borderRadius:8},children:[e.jsx("p",{style:{fontFamily:t.mono,fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:t.textTertiary,marginBottom:"12px"},children:"What happens"}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"12px",textAlign:"center"},children:[{icon:"↓",label:"Installs"},{icon:"⚙",label:"Configures"},{icon:"▶",label:"Starts"},{icon:"↻",label:"Auto-restarts"}].map((n,o)=>e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"18px",marginBottom:"4px"},children:n.icon}),e.jsx("div",{style:{fontSize:"11px",color:t.textSecondary},children:n.label})]},o))})]}),e.jsx("p",{style:{color:t.accentAmber,fontSize:"12px",marginTop:"16px",textAlign:"center"},children:"⚠ This command contains your API key. Don't share it."}),e.jsx("div",{style:{textAlign:"center",marginTop:"16px"},children:e.jsx("button",{onClick:()=>h(null),style:{background:"transparent",border:"none",color:t.textTertiary,fontFamily:t.mono,fontSize:"11px",cursor:"pointer",textDecoration:"underline"},children:"Generate new key"})})]})]}):e.jsxs(e.Fragment,{children:[e.jsx(U,{fill:"currentColor",fillOpacity:.15,strokeWidth:1.8,size:56,style:{color:t.purpleBright,margin:"0 auto 20px"}}),e.jsx("h2",{style:{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:"clamp(20px, 4vw, 28px)",fontWeight:200,marginBottom:"12px",color:t.textPrimary},children:"One Command. That's It."}),e.jsx("p",{style:{color:t.textSecondary,maxWidth:"min(440px, 90vw)",margin:"0 auto 32px",lineHeight:"1.6"},children:"Generate your deploy command. Paste it in a terminal. The ENVELO agent installs, configures your approved boundaries, starts running, and auto-restarts on reboot."}),e.jsx("button",{onClick:$,disabled:u,style:{padding:"16px 48px",background:"transparent",border:"1px solid "+t.purpleBright,color:t.textPrimary,fontFamily:t.mono,fontSize:"14px",letterSpacing:"1px",cursor:u?"wait":"pointer",opacity:u?.7:1,transition:"all 0.2s"},children:u?"⟳ Generating...":"⬡ Generate Deploy Command"})]})})})]})}function de(){const{user:i}=q();return(i==null?void 0:i.role)==="admin"?e.jsx(oe,{}):e.jsx(ie,{})}export{de as default};
