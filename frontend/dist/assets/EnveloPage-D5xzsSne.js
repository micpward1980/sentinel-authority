import{u as K,j as t,a as V,e as ee,s as e,d as y,E as Y}from"./index-CgfCCdr4.js";import{r as d,i as q,p as U,D as M}from"./icons-DCxkC3Ow.js";import te from"./CAT72Console-DDlxkbSv.js";import ne from"./CertificatesPage-DPqsMxrn.js";import{P as m}from"./Panel-D9-D5yaB.js";import{S as R}from"./SectionHeader-DTPDq2b8.js";import"./vendor-DxYwK_Rn.js";import"./Badge-lci1yq2Q.js";import"./CopyableId-HrCqZqFc.js";const re="https://sentinel-authority-production.up.railway.app";function H({apiKey:s,certificateNumber:u,systemName:f,organizationName:_}){return`#!/usr/bin/env python3
"""
ENVELO Interlock — Sentinel Authority
Enforced Non-Violable Execution-Limit Override

Certificate : ${u}
System      : ${f}
Organization: ${_}

Generated   : ${new Date().toISOString().split("T")[0]}
"""

import os, sys, uuid, time, json, signal, threading, logging
from datetime import datetime, timezone
from functools import wraps

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "-q"])
    import httpx

# ── Configuration ─────────────────────────────────────────────────────────────
API_ENDPOINT  = "${re}"
API_KEY       = "${s}"
CERTIFICATE   = "${u}"
SYSTEM_NAME   = "${f}"

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger("envelo")

class Boundary:
    def __init__(self, name, min_value=None, max_value=None, unit="", tolerance=0):
        self.name       = name
        self.min_value  = min_value
        self.max_value  = max_value
        self.unit       = unit
        self.tolerance  = tolerance

    def check(self, value):
        if self.min_value is not None and value < (self.min_value - self.tolerance):
            return False, f"{self.name}: {value} below min {self.min_value}{self.unit}"
        if self.max_value is not None and value > (self.max_value + self.tolerance):
            return False, f"{self.name}: {value} exceeds max {self.max_value}{self.unit}"
        return True, None

class EnveloAgent:
    def __init__(self):
        self.session_id       = uuid.uuid4().hex
        self.boundaries       = {}
        self.telemetry_buffer = []
        self.stats            = {"pass": 0, "block": 0}
        self.running          = False
        self._threads         = []
        self.client           = httpx.Client(
            base_url=API_ENDPOINT,
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=10.0
        )

    def start(self):
        log.info("ENVELO Interlock starting...")
        log.info(f"  Certificate: {CERTIFICATE}")
        log.info(f"  System:      {SYSTEM_NAME}")

        # 1. Sync boundaries from server
        try:
            res = self.client.get(f"/api/envelo/boundaries/{CERTIFICATE}")
            if res.status_code == 200:
                data = res.json()
                for b in data.get("numeric_boundaries", []):
                    self.add_boundary(b["name"], b.get("min_value"), b.get("max_value"),
                                      b.get("unit",""), b.get("tolerance", 0))
                log.info(f"  Boundaries:  synced {len(self.boundaries)} from server")
            else:
                log.warning(f"  Boundaries:  server returned {res.status_code}, using local")
        except Exception as e:
            log.warning(f"  Boundaries:  fetch failed ({e}), using local")

        # 2. Register session
        try:
            self.client.post("/api/envelo/sessions", json={
                "certificate_id": CERTIFICATE,
                "session_id":     self.session_id,
                "started_at":     datetime.now(timezone.utc).isoformat(),
                "agent_version":  "2.0.0",
                "system_name":    SYSTEM_NAME,
                "boundaries":     [
                    {"name": b.name, "min": b.min_value, "max": b.max_value}
                    for b in self.boundaries.values()
                ]
            })
            log.info(f"  Session:     {self.session_id[:16]}...")
        except Exception as e:
            log.warning(f"  Session registration failed: {e}")

        self.running = True

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
                "ended_at":    datetime.now(timezone.utc).isoformat(),
                "final_stats": {"pass_count": self.stats["pass"], "block_count": self.stats["block"]}
            })
        except: pass
        self.client.close()
        log.info(f"Done. {self.stats['pass']} passed, {self.stats['block']} blocked.")

    def _cleanup(self):
        import pathlib, subprocess
        pid_file = pathlib.Path.home() / ".envelo" / "envelo.pid"
        if pid_file.exists(): pid_file.unlink()
        try:
            subprocess.run(["systemctl","--user","stop","envelo.service"], capture_output=True)
            subprocess.run(["systemctl","--user","disable","envelo.service"], capture_output=True)
        except: pass
        plist = pathlib.Path.home() / "Library" / "LaunchAgents" / "org.sentinelauthority.envelo.plist"
        if plist.exists():
            try: subprocess.run(["launchctl","unload",str(plist)], capture_output=True)
            except: pass
        log.info("Auto-restart disabled. Agent stopped cleanly.")

    def add_boundary(self, name, min_value=None, max_value=None, unit="", tolerance=0):
        self.boundaries[name] = Boundary(name=name, min_value=min_value, max_value=max_value,
                                          unit=unit, tolerance=tolerance)

    def check(self, parameter, value):
        if parameter not in self.boundaries: return True, None
        return self.boundaries[parameter].check(value)

    def enforce_params(self, **params):
        violations, evals = [], []
        for param, value in params.items():
            passed, msg = self.check(param, value)
            evals.append({"boundary": param, "passed": passed})
            if not passed: violations.append({"boundary": param, "value": value, "message": msg})

        result = "PASS" if not violations else "BLOCK"
        self.telemetry_buffer.append({
            "timestamp":            datetime.now(timezone.utc).isoformat(),
            "action_id":            uuid.uuid4().hex[:8],
            "action_type":          "boundary_check",
            "result":               result,
            "parameters":           {k: v for k, v in params.items()},
            "boundary_evaluations": evals
        })

        if violations:
            self.stats["block"] += 1
            for v in violations: log.warning(f"VIOLATION: {v['message']}")
            return False, violations
        self.stats["pass"] += 1
        return True, []

    def enforce(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            passed, violations = self.enforce_params(**kwargs)
            if not passed:
                raise RuntimeError(f"ENVELO BLOCK: {violations[0]['message']}")
            return func(*args, **kwargs)
        return wrapper

    def _heartbeat_loop(self):
        fail_count = 0
        while self.running:
            try:
                res = self.client.post("/api/envelo/heartbeat", json={
                    "session_id":     self.session_id,
                    "certificate_id": CERTIFICATE,
                    "timestamp":      datetime.now(timezone.utc).isoformat(),
                    "stats":          self.stats
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
        if not self.telemetry_buffer: return
        batch, self.telemetry_buffer = self.telemetry_buffer[:], []
        try:
            res = self.client.post("/api/envelo/telemetry", json={
                "certificate_id": CERTIFICATE,
                "session_id":     self.session_id,
                "records":        batch,
                "stats":          {"pass_count": self.stats["pass"], "block_count": self.stats["block"]}
            })
            if res.status_code == 401:
                log.warning("API key revoked — shutting down")
                self.running = False
                self._cleanup()
                return
        except Exception as e:
            log.warning(f"Telemetry flush failed: {e}")
            self.telemetry_buffer = batch + self.telemetry_buffer

agent = EnveloAgent()

def _shutdown(sig, frame):
    agent.shutdown()
    sys.exit(0)

signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)

if __name__ == "__main__":
    print()
    print("╔" + "═"*59 + "╗")
    print("║  ENVELO Interlock — Sentinel Authority                    ║")
    print("║  Enforced Non-Violable Execution-Limit Override           ║")
    print("╚" + "═"*59 + "╝")
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
`}function ie({sessionId:s}){const[u,f]=d.useState([]),[_,b]=d.useState(!0);return d.useEffect(()=>{s&&y.get(`/api/envelo/admin/sessions/${s}/telemetry`).then(c=>f(c.data.records||[])).catch(()=>{}).finally(()=>b(!1))},[s]),_?t.jsx("div",{style:{color:e.textTertiary,padding:"12px",fontFamily:e.mono,fontSize:"12px"},children:"Loading telemetry…"}):u.length?t.jsx("div",{style:{maxHeight:"280px",overflowY:"auto"},children:t.jsxs("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:"12px"},children:[t.jsx("thead",{children:t.jsx("tr",{style:{borderBottom:`1px solid ${e.borderGlass}`},children:["Time","Action","Result","Params"].map(c=>t.jsx("th",{style:{padding:"8px",textAlign:"left",color:e.textTertiary,fontFamily:e.mono,fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",fontWeight:400},children:c},c))})}),t.jsx("tbody",{children:u.map((c,B)=>t.jsxs("tr",{style:{borderBottom:`1px solid ${e.borderSubtle}`},children:[t.jsx("td",{style:{padding:"8px",fontFamily:e.mono,fontSize:"11px",color:e.textTertiary},children:c.timestamp?new Date(c.timestamp).toLocaleTimeString():"—"}),t.jsx("td",{style:{padding:"8px",color:e.textPrimary},children:c.action_type}),t.jsx("td",{style:{padding:"8px"},children:t.jsx("span",{style:{padding:"2px 8px",fontSize:"10px",borderRadius:"4px",background:c.result==="PASS"?"rgba(22,135,62,0.10)":"rgba(180,52,52,0.10)",color:c.result==="PASS"?e.accentGreen:e.accentRed},children:c.result})}),t.jsx("td",{style:{padding:"8px",color:e.textTertiary,fontFamily:e.mono,fontSize:"10px"},children:JSON.stringify(c.parameters||{})})]},B))})]})}):t.jsx("div",{style:{color:e.textTertiary,padding:"12px",fontFamily:e.mono,fontSize:"12px"},children:"No records yet — data appears as the interlock runs."})}function oe({session:s}){var _,b;if(!s)return null;const u=(s.pass_count||0)+(s.block_count||0),f=u>0?(s.pass_count/u*100).toFixed(1):0;return t.jsxs("div",{children:[t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"16px",marginBottom:"24px"},children:[{label:"Total Actions",value:u,color:e.textPrimary},{label:"Passed",value:s.pass_count||0,color:e.accentGreen},{label:"Blocked",value:s.block_count||0,color:e.accentRed},{label:"Pass Rate",value:f+"%",color:f>=95?e.accentGreen:e.accentRed}].map(c=>t.jsxs("div",{style:{textAlign:"center",padding:"16px"},children:[t.jsx("div",{style:{fontSize:"clamp(20px,4vw,28px)",fontWeight:500,color:c.color},children:c.value}),t.jsx("div",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary,marginTop:"4px"},children:c.label})]},c.label))}),t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px,1fr))",gap:"16px"},children:[t.jsxs("div",{children:[t.jsx("div",{style:{fontSize:"10px",color:e.textTertiary,marginBottom:"4px",fontFamily:e.mono,letterSpacing:"1px",textTransform:"uppercase"},children:"Session"}),t.jsxs("div",{style:{fontFamily:e.mono,color:e.textSecondary,fontSize:"12px"},children:[(_=s.session_id)==null?void 0:_.substring(0,20),"…"]})]}),t.jsxs("div",{children:[t.jsx("div",{style:{fontSize:"10px",color:e.textTertiary,marginBottom:"4px",fontFamily:e.mono,letterSpacing:"1px",textTransform:"uppercase"},children:"Certificate"}),t.jsx("div",{style:{color:e.textSecondary},children:s.certificate_id||"N/A"})]}),t.jsxs("div",{children:[t.jsx("div",{style:{fontSize:"10px",color:e.textTertiary,marginBottom:"4px",fontFamily:e.mono,letterSpacing:"1px",textTransform:"uppercase"},children:"Started"}),t.jsx("div",{style:{color:e.textSecondary},children:s.started_at?new Date(s.started_at).toLocaleString():"N/A"})]}),t.jsxs("div",{children:[t.jsx("div",{style:{fontSize:"10px",color:e.textTertiary,marginBottom:"4px",fontFamily:e.mono,letterSpacing:"1px",textTransform:"uppercase"},children:"Status"}),t.jsx("span",{style:{padding:"3px 10px",fontSize:"11px",borderRadius:"4px",background:s.status==="active"?"rgba(22,135,62,0.10)":"rgba(0,0,0,0.04)",color:s.status==="active"?e.accentGreen:e.textTertiary},children:(b=s.status)==null?void 0:b.toUpperCase()})]})]})]})}function se(){const s=V(),u=ee(),[f,_]=d.useState([]),[b,c]=d.useState([]),[B,$]=d.useState([]),[S,F]=d.useState(null),[D,L]=d.useState(null),[w,W]=d.useState("queue"),[k,C]=d.useState(""),[P,g]=d.useState(null),[I,E]=d.useState(!0),h=async()=>{try{const[n,i,o]=await Promise.all([y.get("/api/envelo/admin/sessions").catch(()=>({data:{sessions:[]}})),y.get("/api/applications/").catch(()=>({data:[]})),y.get("/api/certificates/").catch(()=>({data:[]}))]);_(n.data.sessions||[]),c(i.data.applications||i.data||[]),$(o.data||[])}catch(n){console.error(n)}E(!1)};d.useEffect(()=>{h();const n=setInterval(h,3e4);return()=>clearInterval(n)},[]);const z=b.filter(n=>n.state==="pending"),r=b.filter(n=>n.state==="under_review"),a=b.filter(n=>n.state==="approved"),p=b.filter(n=>n.state==="testing"),x=B.filter(n=>n.state==="conformant"||n.state==="active"||n.state==="issued"),v=new Set(f.filter(n=>{const i=n.last_heartbeat_at||n.last_telemetry_at||n.started_at;return n.status==="active"&&i&&Date.now()-new Date(i).getTime()<12e4}).map(n=>n.certificate_id)),T=f.filter(n=>n.status==="active");f.reduce((n,i)=>n+(i.block_count||0),0);const A=z.length+r.length,Q=n=>{const i=H({apiKey:"YOUR_API_KEY",certificateNumber:n.certificate_number,systemName:n.system_name||"Unknown",organizationName:n.organization_name||""}),o=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([i],{type:"text/plain"})),download:`envelo_agent_${n.certificate_number}.py`});document.body.appendChild(o),o.click(),document.body.removeChild(o)},X=async n=>{var i,o;if(await u({title:"Begin CAT-72",message:`Start the 72-hour conformance test for ${n.system_name}? The interlock must be confirmed online.`,confirmLabel:"Begin Test",danger:!1}))try{const l=`cat72-${n.id}-${Date.now()}`;await y.post(`/api/applications/${n.id}/begin-cat72`,{request_id:l}),s.show("CAT-72 test started","success"),h()}catch(l){s.show("Failed: "+(((o=(i=l.response)==null?void 0:i.data)==null?void 0:o.detail)||l.message),"error")}},J=async n=>{var i,o;if(await u({title:"Provision API Key",message:`Generate and email API key to ${n.contact_email} for ${n.system_name}?`,confirmLabel:"Provision Key"}))try{await y.post("/api/apikeys/admin/provision",{user_id:n.user_id,certificate_id:n.certificate_id,name:"deployment-"+new Date().toISOString().split("T")[0],send_email:!0}),s.show("Key generated and emailed to customer","success"),h()}catch(l){s.show("Failed: "+(((o=(i=l.response)==null?void 0:i.data)==null?void 0:o.detail)||l.message),"error")}};if(I)return t.jsx("div",{style:{color:e.textTertiary,padding:"40px",textAlign:"center"},children:t.jsx(q,{size:24,style:{animation:"spin 1s linear infinite"}})});const Z=[{id:"queue",label:"Review Queue",badge:A},{id:"monitoring",label:"Monitoring",badge:T.length},{id:"cat72",label:"CAT-72",badge:p.length},{id:"certificates",label:"Certificates",badge:x.length}];return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsx(R,{label:"Admin Console",title:"ENVELO Management"}),t.jsx("div",{style:{display:"flex",gap:"8px",borderBottom:`1px solid ${e.borderGlass}`,paddingBottom:"16px",overflowX:"auto"},children:Z.map(n=>t.jsxs("button",{onClick:()=>W(n.id),style:{padding:"8px 18px",borderRadius:"6px",background:w===n.id?"rgba(29,26,59,0.08)":"transparent",border:`1px solid ${w===n.id?"rgba(29,26,59,0.5)":e.borderGlass}`,color:w===n.id?e.purpleBright:e.textSecondary,fontFamily:e.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"8px"},children:[n.label,n.badge>0&&t.jsx("span",{style:{padding:"1px 6px",borderRadius:"999px",background:"rgba(29,26,59,0.15)",color:e.purpleBright,fontSize:"10px"},children:n.badge})]},n.id))}),w==="queue"&&t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[z.length>0&&t.jsxs(m,{accent:"amber",children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.accentAmber,marginBottom:"16px"},children:"New Applications — Pending Review"}),z.map(n=>{var i;return t.jsx("div",{style:{padding:"16px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"8px",marginBottom:"8px"},children:t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"},children:[t.jsxs("div",{children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,marginBottom:"4px"},children:n.system_name}),t.jsxs("p",{style:{color:e.textSecondary,fontSize:"13px",marginBottom:"4px"},children:[n.organization_name," · ",n.contact_email]}),t.jsxs("p",{style:{fontFamily:e.mono,fontSize:"11px",color:e.textTertiary},children:[n.application_number," · submitted ",(i=n.created_at)==null?void 0:i.split("T")[0]]})]}),t.jsx("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"},children:t.jsx("button",{onClick:async()=>{try{await y.post(`/api/applications/${n.id}/begin-review`),s.show("Review started","success"),h()}catch(o){s.show("Failed: "+o.message,"error")}},style:{padding:"8px 16px",background:e.purplePrimary,border:`1px solid ${e.purpleBright}`,color:"#fff",fontFamily:e.mono,fontSize:"11px",cursor:"pointer",borderRadius:"6px"},children:"Begin Review"})})]})},n.id)})]}),r.map(n=>t.jsxs(m,{glow:!0,children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.purpleBright,marginBottom:"16px"},children:"Under Review"}),t.jsxs("div",{style:{marginBottom:"20px"},children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,marginBottom:"4px"},children:n.system_name}),t.jsxs("p",{style:{color:e.textSecondary,fontSize:"13px"},children:[n.organization_name," · ",n.application_number]})]}),n.envelope_definition&&(()=>{const i=n.envelope_definition,o=i.numeric_boundaries||[],l=i.geographic_boundaries||[],G=i.time_boundaries||[],O=i.state_boundaries||[];return t.jsxs("div",{style:{marginBottom:"20px",padding:"12px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"8px"},children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:e.textTertiary,marginBottom:"12px"},children:"Submitted Boundaries"}),t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(110px,1fr))",gap:"8px",textAlign:"center"},children:[{label:"Numeric",count:o.length},{label:"Geographic",count:l.length},{label:"Time",count:G.length},{label:"State",count:O.length}].map(j=>t.jsxs("div",{style:{padding:"10px",background:"rgba(29,26,59,0.05)",borderRadius:"6px"},children:[t.jsx("div",{style:{fontSize:"20px",fontWeight:500,color:e.purpleBright},children:j.count}),t.jsx("div",{style:{fontFamily:e.mono,fontSize:"9px",textTransform:"uppercase",letterSpacing:"1px",color:e.textTertiary,marginTop:"2px"},children:j.label})]},j.label))}),o.length>0&&t.jsx("div",{style:{marginTop:"12px"},children:o.map((j,N)=>t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${e.borderSubtle}`,fontSize:"12px"},children:[t.jsx("span",{style:{color:e.textPrimary},children:j.name}),t.jsxs("span",{style:{fontFamily:e.mono,color:e.purpleBright},children:[j.min_value??"—"," → ",j.max_value??"—"," ",j.unit||""]})]},N))})]})})(),t.jsx("div",{style:{padding:"12px 16px",background:"rgba(158,110,18,0.04)",border:"1px solid rgba(158,110,18,0.15)",borderRadius:"6px",marginBottom:"16px"},children:t.jsx("p",{style:{color:e.accentAmber,fontSize:"12px",margin:0},children:"⚠ Sentinel Authority does not modify customer-submitted boundaries. Approve as submitted or reject with required changes."})}),t.jsx("textarea",{value:k,onChange:i=>C(i.target.value),placeholder:"Review notes (required for rejection, optional for approval)…",style:{width:"100%",minHeight:"72px",padding:"10px 14px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,color:e.textPrimary,fontSize:"13px",fontFamily:e.sans,resize:"vertical",borderRadius:"6px",boxSizing:"border-box"}}),t.jsxs("div",{style:{display:"flex",gap:"12px",marginTop:"12px",flexWrap:"wrap"},children:[t.jsx("button",{onClick:async()=>{var i,o;try{const l=`approve-${n.id}-${Date.now()}`;await y.post(`/api/applications/${n.id}/approve`,{note:k||"Approved.",request_id:l}),s.show("Application approved — API key generated and emailed to customer","success"),C(""),h()}catch(l){s.show("Failed: "+(((o=(i=l.response)==null?void 0:i.data)==null?void 0:o.detail)||l.message),"error")}},style:{flex:1,padding:"12px",background:"transparent",border:`1px solid ${e.accentGreen}`,color:e.accentGreen,fontFamily:e.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",borderRadius:"6px"},children:"✓ Approve — Generate & Email Key"}),t.jsx("button",{onClick:async()=>{var i,o;if(!k.trim()){s.show("Rejection requires specific feedback","error");return}try{const l=`reject-${n.id}-${Date.now()}`;await y.post(`/api/applications/${n.id}/reject`,{note:k,request_id:l}),s.show("Sent back with required changes","success"),C(""),h()}catch(l){s.show("Failed: "+(((o=(i=l.response)==null?void 0:i.data)==null?void 0:o.detail)||l.message),"error")}},style:{flex:1,padding:"12px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,color:e.accentRed,fontFamily:e.mono,fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",borderRadius:"6px"},children:"✗ Reject — Request Changes"})]})]},n.id)),a.length>0&&t.jsxs(m,{children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary,marginBottom:"16px"},children:"Approved — Awaiting Interlock Connection"}),a.map(n=>{const i=n.certificate_number||n.certificate_id,o=i&&v.has(i);return t.jsx("div",{style:{padding:"16px",background:e.cardSurface,border:`1px solid ${o?e.accentGreen:e.borderGlass}`,borderRadius:"8px",marginBottom:"8px"},children:t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"},children:[t.jsxs("div",{children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,marginBottom:"4px"},children:n.system_name}),t.jsx("p",{style:{fontSize:"12px",color:e.textSecondary,marginBottom:"4px"},children:n.organization_name}),t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[t.jsx("div",{style:{width:"7px",height:"7px",borderRadius:"50%",background:o?e.accentGreen:e.accentAmber}}),t.jsx("span",{style:{fontFamily:e.mono,fontSize:"10px",color:o?e.accentGreen:e.accentAmber,textTransform:"uppercase",letterSpacing:"1px"},children:o?"Interlock Online":"Waiting for Customer to Deploy"})]})]}),t.jsxs("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:[o&&t.jsx("button",{onClick:()=>X(n),style:{padding:"8px 18px",background:e.purplePrimary,border:`1px solid ${e.purpleBright}`,color:"#fff",fontFamily:e.mono,fontSize:"11px",cursor:"pointer",borderRadius:"6px"},children:"Begin CAT-72"}),t.jsx("button",{onClick:()=>J(n),style:{padding:"8px 14px",background:"transparent",border:`1px solid ${e.borderGlass}`,color:e.textSecondary,fontFamily:e.mono,fontSize:"10px",cursor:"pointer",borderRadius:"6px"},children:"Resend Key"})]})]})},n.id)})]}),p.length>0&&t.jsxs(m,{accent:"amber",children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.accentAmber,marginBottom:"16px"},children:"CAT-72 Running"}),p.map(n=>{const i=n.certificate_number||n.certificate_id,o=f.find(N=>N.certificate_id===i),l=n.cat72_started_at?new Date(n.cat72_started_at):null,G=l?(Date.now()-l.getTime())/1e3:0,O=Math.max(0,72*3600-G),j=Math.min(100,G/(72*3600)*100).toFixed(0);return t.jsxs("div",{style:{padding:"16px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"8px",marginBottom:"8px"},children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",marginBottom:"12px"},children:[t.jsxs("div",{children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,marginBottom:"4px"},children:n.system_name}),t.jsx("p",{style:{fontSize:"12px",color:e.textSecondary},children:n.organization_name})]}),t.jsxs("div",{style:{textAlign:"right"},children:[t.jsxs("div",{style:{fontFamily:e.mono,fontSize:"20px",color:e.accentAmber},children:[(O/3600).toFixed(1),"h"]}),t.jsx("div",{style:{fontFamily:e.mono,fontSize:"9px",color:e.textTertiary,textTransform:"uppercase",letterSpacing:"1px"},children:"remaining"})]})]}),t.jsx("div",{style:{background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"4px",overflow:"hidden",height:"6px",marginBottom:"8px"},children:t.jsx("div",{style:{width:j+"%",height:"100%",background:e.accentAmber,transition:"width 1s linear",borderRadius:"4px"}})}),t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"11px",color:e.textTertiary,fontFamily:e.mono},children:[t.jsxs("span",{children:[j,"% complete"]}),o&&t.jsxs("span",{children:["✓ ",o.pass_count||0," · ✗ ",o.block_count||0]})]})]},n.id)})]}),A===0&&a.length===0&&p.length===0&&t.jsx(m,{children:t.jsxs("div",{style:{textAlign:"center",padding:"48px 20px",color:e.textTertiary},children:[t.jsx(U,{size:40,style:{margin:"0 auto 12px",opacity:.3}}),t.jsx("p",{style:{fontFamily:e.mono,fontSize:"12px",letterSpacing:"1px"},children:"Queue is clear"})]})})]}),w==="monitoring"&&t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsxs(m,{glow:!0,children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px",marginBottom:"20px"},children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary},children:"Active Sessions"}),t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"4px 12px"},children:[t.jsx("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:e.accentGreen,animation:"pulse 2s infinite"}}),t.jsx("span",{style:{fontFamily:e.mono,fontSize:"10px",color:e.accentGreen,textTransform:"uppercase",letterSpacing:"1px"},children:"Live"})]})]}),f.length>0?t.jsx("div",{style:{overflowX:"auto"},children:t.jsxs("table",{style:{width:"100%",borderCollapse:"collapse"},children:[t.jsx("thead",{children:t.jsx("tr",{style:{borderBottom:`1px solid ${e.borderGlass}`},children:["Certificate","System","Status","Pass","Block",""].map(n=>t.jsx("th",{style:{padding:"10px 16px",textAlign:"left",fontFamily:e.mono,fontSize:"9px",letterSpacing:"1.5px",textTransform:"uppercase",color:e.textTertiary,fontWeight:400},children:n},n))})}),t.jsx("tbody",{children:f.map((n,i)=>{const o=n.last_heartbeat_at||n.last_telemetry_at||n.started_at,l=o&&Date.now()-new Date(o).getTime()<12e4;return t.jsxs("tr",{style:{borderBottom:`1px solid ${e.borderSubtle}`},children:[t.jsx("td",{style:{padding:"14px 16px",fontFamily:e.mono,fontSize:"12px",color:e.purpleBright},children:n.certificate_id||"N/A"}),t.jsx("td",{style:{padding:"14px 16px",color:e.textPrimary,fontSize:"13px"},children:n.system_name||"—"}),t.jsx("td",{style:{padding:"14px 16px"},children:t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[t.jsx("div",{style:{width:"7px",height:"7px",borderRadius:"50%",background:l?e.accentGreen:e.textDim}}),t.jsx("span",{style:{fontFamily:e.mono,fontSize:"10px",color:l?e.accentGreen:e.textDim,textTransform:"uppercase",letterSpacing:"1px"},children:l?"Online":"Offline"})]})}),t.jsx("td",{style:{padding:"14px 16px",color:e.accentGreen,fontFamily:e.mono},children:n.pass_count||0}),t.jsx("td",{style:{padding:"14px 16px",color:(n.block_count||0)>0?e.accentRed:e.textTertiary,fontFamily:e.mono},children:n.block_count||0}),t.jsx("td",{style:{padding:"14px 16px"},children:t.jsx("button",{onClick:()=>F(n),style:{padding:"5px 12px",background:"transparent",border:`1px solid ${e.purpleBright}`,color:e.purpleBright,fontFamily:e.mono,fontSize:"10px",cursor:"pointer",borderRadius:"4px"},children:"Details"})})]},i)})})]})}):t.jsx("p",{style:{color:e.textTertiary,textAlign:"center",padding:"40px"},children:"No sessions yet. Sessions appear when customers deploy the interlock."})]}),S&&t.jsxs(m,{accent:"purple",children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",marginBottom:"20px"},children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary},children:"Session Detail"}),t.jsxs("div",{style:{display:"flex",gap:"10px"},children:[t.jsx("button",{onClick:async()=>{try{const n=await y.get(`/api/envelo/admin/sessions/${S.session_id}/report`,{responseType:"blob"}),i=URL.createObjectURL(new Blob([n.data]));Object.assign(document.createElement("a"),{href:i,download:`CAT72-${S.session_id}.pdf`}).click()}catch{s.show("Report unavailable","error")}},style:{padding:"7px 14px",background:"transparent",border:"none",color:e.purpleBright,fontSize:"11px",cursor:"pointer",fontFamily:e.mono},children:"↓ Download Report"}),t.jsx("button",{onClick:()=>F(null),style:{padding:"7px 14px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,color:e.textTertiary,cursor:"pointer",fontSize:"11px",borderRadius:"6px"},children:"✕"})]})]}),t.jsx(oe,{session:S}),t.jsx("div",{style:{marginTop:"20px"},children:t.jsx(ie,{sessionId:S.session_id})})]})]}),w==="cat72"&&t.jsx(Y,{children:t.jsx(te,{})}),w==="certificates"&&t.jsx(Y,{children:t.jsx(ne,{})}),w==="certified"&&t.jsxs(m,{children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary,marginBottom:"20px"},children:"ODDC Conformant Systems"}),x.length>0?x.map(n=>{const i=n.certificate_number,o=v.has(i);return t.jsx("div",{style:{padding:"20px",background:e.cardSurface,border:`1px solid ${o?e.accentGreen:e.borderGlass}`,borderRadius:"8px",marginBottom:"12px"},children:t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"16px"},children:[t.jsxs("div",{children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"},children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,margin:0},children:n.system_name}),t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px"},children:[t.jsx("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:o?e.accentGreen:e.textDim,...o?{animation:"pulse 2s infinite"}:{}}}),t.jsx("span",{style:{fontFamily:e.mono,fontSize:"9px",color:o?e.accentGreen:e.textDim,textTransform:"uppercase",letterSpacing:"1px"},children:o?"Online":"Offline"})]})]}),t.jsx("p",{style:{fontSize:"13px",color:e.textSecondary,marginBottom:"4px"},children:n.organization_name}),t.jsx("p",{style:{fontFamily:e.mono,fontSize:"12px",color:e.purpleBright},children:n.certificate_number}),n.expires_at&&t.jsxs("p",{style:{fontFamily:e.mono,fontSize:"11px",color:e.textTertiary,marginTop:"4px"},children:["Expires: ",n.expires_at.split("T")[0]]})]}),t.jsx("div",{style:{display:"flex",gap:"8px",alignItems:"center"},children:t.jsxs("button",{onClick:()=>Q(n),style:{padding:"8px 14px",background:"transparent",border:`1px solid ${e.borderGlass}`,color:e.textSecondary,fontFamily:e.mono,fontSize:"10px",cursor:"pointer",borderRadius:"6px",display:"flex",alignItems:"center",gap:"6px"},children:[t.jsx(M,{size:12})," Agent Template"]})})]})},n.id)}):t.jsx("p",{style:{color:e.textTertiary,textAlign:"center",padding:"40px"},children:"No certified systems yet."})]})]})}function ae(){const s=V(),{user:u}=K(),[f,_]=d.useState(!0),[b,c]=d.useState([]),[B,$]=d.useState([]),[S,F]=d.useState([]),[D,L]=d.useState([]),[w,W]=d.useState(!1),[k,C]=d.useState(!1),P=async()=>{var r;try{const[a,p,x,v]=await Promise.all([y.get("/api/applications/").catch(()=>({data:[]})),y.get("/api/certificates/").catch(()=>({data:[]})),y.get("/api/envelo/sessions").catch(()=>({data:{sessions:[]}})),y.get("/api/apikeys/").catch(()=>({data:[]}))]);c(((r=a.data)==null?void 0:r.applications)||a.data||[]),$(p.data||[]),F(x.data.sessions||[]),L(v.data||[])}catch(a){console.error(a)}_(!1)};if(d.useEffect(()=>{P();const r=setInterval(P,15e3);return()=>clearInterval(r)},[]),f)return t.jsx("div",{style:{color:e.textTertiary,padding:"40px",textAlign:"center"},children:t.jsx(q,{size:24,style:{animation:"spin 1s linear infinite"}})});const g=[...b].sort((r,a)=>new Date(a.updated_at)-new Date(r.updated_at))[0],I=B.filter(r=>r.state==="conformant"||r.state==="active"||r.state==="issued"),E=S.filter(r=>{const a=r.last_heartbeat_at||r.last_telemetry_at||r.started_at;return r.status==="active"&&a&&Date.now()-new Date(a).getTime()<12e4}),h=D[0],z=r=>{const a=g,p=I[0],x=H({apiKey:(h==null?void 0:h.key)||"YOUR_API_KEY",certificateNumber:(p==null?void 0:p.certificate_number)||(a==null?void 0:a.certificate_number)||(a==null?void 0:a.application_number)||"PENDING",systemName:(a==null?void 0:a.system_name)||"My System",organizationName:(a==null?void 0:a.organization_name)||(u==null?void 0:u.organization_name)||""}),v=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([x],{type:"text/plain"})),download:"envelo_agent.py"});document.body.appendChild(v),v.click(),document.body.removeChild(v),s.show("envelo_agent.py downloaded","success")};if(!g)return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsx(R,{label:"ENVELO Interlock",title:"Get Started"}),t.jsx(m,{children:t.jsxs("div",{style:{textAlign:"center",padding:"clamp(32px,6vw,72px) clamp(16px,4vw,24px)"},children:[t.jsx(U,{fill:"currentColor",fillOpacity:.08,strokeWidth:1.5,size:56,style:{color:e.purpleBright,margin:"0 auto 20px"}}),t.jsx("h2",{style:{fontFamily:e.serif,fontSize:"clamp(20px,4vw,28px)",fontWeight:200,marginBottom:"12px"},children:"Start Your Certification"}),t.jsx("p",{style:{color:e.textSecondary,maxWidth:"400px",margin:"0 auto 32px",lineHeight:1.6},children:"Submit an application to begin the ODDC certification process for your autonomous system."}),t.jsx("a",{href:"/applications/new",style:{display:"inline-block",padding:"13px 36px",background:e.purplePrimary,border:`1px solid ${e.purpleBright}`,color:"#fff",fontFamily:e.mono,fontSize:"12px",letterSpacing:"1.5px",textTransform:"uppercase",textDecoration:"none",borderRadius:"6px"},children:"New Application →"})]})})]});if(g.state==="pending"||g.state==="under_review")return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsx(R,{label:"ENVELO Interlock",title:"Application in Review"}),t.jsx(m,{children:t.jsxs("div",{style:{textAlign:"center",padding:"clamp(32px,5vw,60px) clamp(16px,4vw,24px)"},children:[t.jsx("div",{style:{width:"56px",height:"56px",borderRadius:"50%",border:"2px solid rgba(158,110,18,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:"24px"},children:"⏳"}),t.jsx("h2",{style:{fontFamily:e.serif,fontSize:"clamp(20px,4vw,26px)",fontWeight:200,marginBottom:"8px"},children:g.state==="under_review"?"Being Reviewed":"In Queue"}),t.jsx("p",{style:{color:e.textSecondary,marginBottom:"8px"},children:g.system_name}),t.jsx("p",{style:{fontFamily:e.mono,fontSize:"12px",color:e.textTertiary,marginBottom:"24px"},children:g.application_number}),t.jsx("p",{style:{color:e.textSecondary,maxWidth:"380px",margin:"0 auto",lineHeight:1.6,fontSize:"14px"},children:g.state==="under_review"?"Our team is reviewing your boundaries. You'll receive an email when approved.":"Your application is in the queue. Our team will begin review shortly."})]})}),t.jsxs(m,{children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary,marginBottom:"12px"},children:"What happens next"}),[{step:"1",text:"Admin reviews your boundary definitions",done:!0},{step:"2",text:"Approval email sent with API key",done:!1},{step:"3",text:"You deploy the ENVELO Interlock",done:!1},{step:"4",text:"72-hour conformance test runs",done:!1},{step:"5",text:"Certificate issued automatically",done:!1}].map(r=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:`1px solid ${e.borderSubtle}`},children:[t.jsx("div",{style:{width:"22px",height:"22px",borderRadius:"50%",background:r.done?"rgba(22,135,62,0.1)":e.cardSurface,border:`1px solid ${r.done?e.accentGreen:e.borderGlass}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:r.done?e.accentGreen:e.textTertiary,fontFamily:e.mono,flexShrink:0},children:r.done?"✓":r.step}),t.jsx("span",{style:{fontSize:"13px",color:r.done?e.textPrimary:e.textSecondary},children:r.text})]},r.step))]})]});if(g.state==="approved")return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsx(R,{label:"ENVELO Interlock",title:"Deploy Your Interlock",description:"Your application is approved. Install the agent to begin the 72-hour test."}),t.jsxs(m,{glow:!0,children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.accentGreen,marginBottom:"16px"},children:"✓ Application Approved — API Key Ready"}),h?t.jsx("div",{children:t.jsxs("div",{style:{padding:"16px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"8px",marginBottom:"16px"},children:[t.jsxs("div",{style:{fontFamily:e.mono,fontSize:"13px",color:e.textPrimary,wordBreak:"break-all",marginBottom:"12px"},children:[h.key_prefix,"••••••••••••••••••••"]}),t.jsxs("p",{style:{fontSize:"12px",color:e.accentAmber,marginBottom:"12px"},children:["⚠ Your full key was emailed to ",g.contact_email,". Download the agent below to get it embedded."]}),t.jsxs("button",{onClick:()=>z(),style:{padding:"10px 20px",background:e.purplePrimary,border:`1px solid ${e.purpleBright}`,color:"#fff",fontFamily:e.mono,fontSize:"11px",cursor:"pointer",borderRadius:"6px",display:"flex",alignItems:"center",gap:"8px"},children:[t.jsx(M,{size:14})," Download envelo_agent.py (pre-configured)"]})]})}):t.jsx("div",{style:{padding:"16px",background:"rgba(158,110,18,0.04)",border:"1px solid rgba(158,110,18,0.2)",borderRadius:"8px"},children:t.jsx("p",{style:{color:e.accentAmber,fontSize:"13px"},children:"Your API key is being provisioned. Check your email or refresh in a moment."})})]}),t.jsxs(m,{children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary,marginBottom:"20px"},children:"Installation Steps"}),[{num:"1",title:"Download the agent",content:t.jsx("button",{onClick:()=>z(),style:{padding:"9px 18px",background:"transparent",border:`1px solid ${e.purpleBright}`,color:e.purpleBright,fontFamily:e.mono,fontSize:"11px",cursor:"pointer",borderRadius:"6px"},children:"↓ envelo_agent.py"})},{num:"2",title:"Install dependency",content:t.jsxs("div",{style:{background:"rgba(0,0,0,0.04)",border:`1px solid ${e.borderGlass}`,padding:"10px 14px",borderRadius:"6px",fontFamily:e.mono,fontSize:"12px",color:e.textPrimary},children:[t.jsx("span",{style:{color:e.accentGreen},children:"$"})," pip install httpx"]})},{num:"3",title:"Run the agent",content:t.jsxs("div",{style:{background:"rgba(0,0,0,0.04)",border:`1px solid ${e.borderGlass}`,padding:"10px 14px",borderRadius:"6px",fontFamily:e.mono,fontSize:"12px",color:e.textPrimary},children:[t.jsx("span",{style:{color:e.accentGreen},children:"$"})," python envelo_agent.py"]})},{num:"4",title:"Integrate (optional — agent works standalone)",content:t.jsxs("div",{style:{background:"rgba(0,0,0,0.04)",border:`1px solid ${e.borderGlass}`,padding:"10px 14px",borderRadius:"6px",fontFamily:e.mono,fontSize:"12px",color:e.textSecondary},children:[t.jsx("div",{style:{color:e.textTertiary,marginBottom:"4px"},children:"# In your code:"}),t.jsx("div",{children:"from envelo_agent import agent"}),t.jsx("div",{children:"agent.start()"}),t.jsx("div",{style:{marginTop:"8px"},children:"@agent.enforce"}),t.jsx("div",{children:"def my_action(speed=0): ..."})]})}].map(r=>t.jsxs("div",{style:{display:"flex",gap:"16px",marginBottom:"20px"},children:[t.jsx("div",{style:{width:"28px",height:"28px",borderRadius:"50%",border:`1px solid ${e.purpleBright}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:e.mono,fontSize:"12px",color:e.purpleBright,flexShrink:0},children:r.num}),t.jsxs("div",{style:{flex:1},children:[t.jsx("p",{style:{color:e.textSecondary,marginBottom:"8px",fontSize:"14px"},children:r.title}),r.content]})]},r.num)),t.jsx("div",{style:{padding:"12px 16px",background:"rgba(22,135,62,0.04)",border:"1px solid rgba(22,135,62,0.1)",borderRadius:"6px",marginTop:"8px"},children:t.jsx("p",{style:{color:e.accentGreen,fontSize:"13px",margin:0},children:"Once the agent is running, it will connect automatically. Your 72-hour test starts when an admin confirms the connection — this page will update."})})]})]});if(g.state==="testing"){const r=S[0],a=g.cat72_started_at?new Date(g.cat72_started_at):null,p=a?(Date.now()-a.getTime())/1e3:0,x=Math.max(0,72*3600-p),v=Math.min(100,p/(72*3600)*100).toFixed(1),T=E.length>0;return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsx(R,{label:"ENVELO Interlock",title:"CAT-72 Running",description:"72-hour conformance test in progress. Keep the agent running."}),t.jsxs(m,{glow:T,children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"16px",marginBottom:"24px"},children:[t.jsxs("div",{children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,marginBottom:"4px"},children:g.system_name}),t.jsx("p",{style:{fontFamily:e.mono,fontSize:"12px",color:e.textTertiary},children:g.application_number})]}),t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"transparent"},children:[t.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:T?e.accentGreen:e.accentRed,...T?{animation:"pulse 2s infinite"}:{}}}),t.jsx("span",{style:{fontFamily:e.mono,fontSize:"11px",color:T?e.accentGreen:e.accentRed,textTransform:"uppercase",letterSpacing:"1px"},children:T?"Interlock Online":"Interlock Offline — Check Agent"})]})]}),t.jsxs("div",{style:{marginBottom:"20px"},children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:"8px"},children:[t.jsxs("span",{style:{fontFamily:e.mono,fontSize:"11px",color:e.textTertiary},children:[v,"% complete"]}),t.jsxs("span",{style:{fontFamily:e.mono,fontSize:"11px",color:e.accentAmber},children:[(x/3600).toFixed(1),"h remaining"]})]}),t.jsx("div",{style:{background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"4px",overflow:"hidden",height:"8px"},children:t.jsx("div",{style:{width:v+"%",height:"100%",background:`linear-gradient(90deg, ${e.purpleBright}, ${e.accentGreen})`,transition:"width 1s linear",borderRadius:"4px"}})})]}),r&&t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px,1fr))",gap:"12px"},children:[{label:"Passed",value:r.pass_count||0,color:e.accentGreen},{label:"Blocked",value:r.block_count||0,color:(r.block_count||0)>0?e.accentRed:e.accentGreen},{label:"Total Actions",value:(r.pass_count||0)+(r.block_count||0),color:e.textPrimary}].map(A=>t.jsxs("div",{style:{textAlign:"center",padding:"14px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"8px"},children:[t.jsx("div",{style:{fontSize:"clamp(18px,3vw,24px)",fontWeight:200,color:A.color},children:A.value}),t.jsx("div",{style:{fontFamily:e.mono,fontSize:"9px",textTransform:"uppercase",letterSpacing:"1px",color:e.textTertiary,marginTop:"4px"},children:A.label})]},A.label))})]}),!T&&t.jsxs(m,{accent:"amber",children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.accentAmber,marginBottom:"12px"},children:"Agent Offline — Action Required"}),t.jsx("p",{style:{color:e.textSecondary,fontSize:"14px",marginBottom:"16px"},children:"The ENVELO Interlock hasn't sent a heartbeat in the last 2 minutes. Check that it's running:"}),t.jsxs("div",{style:{background:"rgba(0,0,0,0.04)",border:`1px solid ${e.borderGlass}`,padding:"10px 14px",borderRadius:"6px",fontFamily:e.mono,fontSize:"12px",color:e.textPrimary,marginBottom:"16px"},children:[t.jsx("span",{style:{color:e.accentGreen},children:"$"})," python envelo_agent.py"]}),t.jsx("p",{style:{fontSize:"12px",color:e.textTertiary},children:"If the test was interrupted for more than 5 minutes, contact admin — the test window may need to be restarted."})]})]})}return t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"24px"},children:[t.jsx(R,{label:"ENVELO Interlock",title:"Active",description:"ODDC conformant — boundaries enforced in production"}),I.map(r=>{const a=S.find(x=>x.certificate_id===r.certificate_number),p=E.some(x=>x.certificate_id===r.certificate_number);return t.jsxs(m,{glow:p,children:[t.jsxs("div",{style:{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"16px",marginBottom:"20px"},children:[t.jsxs("div",{children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"},children:[t.jsx("h3",{style:{fontWeight:500,color:e.textPrimary,margin:0},children:r.system_name}),t.jsx("span",{style:{padding:"2px 8px",background:"rgba(22,135,62,0.08)",border:"1px solid rgba(22,135,62,0.2)",color:e.accentGreen,fontFamily:e.mono,fontSize:"10px",borderRadius:"4px"},children:"CONFORMANT"})]}),t.jsx("p",{style:{fontFamily:e.mono,fontSize:"12px",color:e.purpleBright,marginBottom:"4px"},children:r.certificate_number}),r.expires_at&&t.jsxs("p",{style:{fontFamily:e.mono,fontSize:"11px",color:e.textTertiary},children:["Expires ",r.expires_at.split("T")[0]]})]}),t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 16px"},children:[t.jsx("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:p?e.accentGreen:e.textDim,...p?{animation:"pulse 2s infinite"}:{}}}),t.jsx("span",{style:{fontFamily:e.mono,fontSize:"11px",color:p?e.accentGreen:e.textDim,textTransform:"uppercase",letterSpacing:"1px"},children:p?"Interlock Active":"Interlock Offline"})]})]}),a&&t.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"12px",paddingTop:"16px",borderTop:`1px solid ${e.borderGlass}`},children:[{label:"Passed",value:a.pass_count||0,color:e.accentGreen},{label:"Blocked",value:a.block_count||0,color:(a.block_count||0)>0?e.accentRed:e.textTertiary},{label:"Total",value:(a.pass_count||0)+(a.block_count||0),color:e.textPrimary}].map(x=>t.jsxs("div",{style:{textAlign:"center"},children:[t.jsx("div",{style:{fontSize:"clamp(18px,3vw,24px)",fontWeight:200,color:x.color},children:x.value}),t.jsx("div",{style:{fontFamily:e.mono,fontSize:"9px",textTransform:"uppercase",letterSpacing:"1px",color:e.textTertiary,marginTop:"4px"},children:x.label})]},x.label))})]},r.id)}),t.jsxs(m,{children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:e.textTertiary,marginBottom:"16px"},children:"Agent Control"}),t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"10px"},children:[t.jsxs("button",{onClick:()=>z(),style:{padding:"14px",background:"transparent",border:`1px solid ${e.purpleBright}`,cursor:"pointer",textAlign:"left",borderRadius:"8px"},children:[t.jsx("p",{style:{fontWeight:500,color:e.purpleBright,marginBottom:"4px",fontSize:"14px"},children:"↓ Re-download Agent"}),t.jsx("p",{style:{color:e.textTertiary,fontSize:"11px",margin:0},children:"Get the current pre-configured script"})]}),t.jsxs("button",{onClick:()=>C(!k),style:{padding:"14px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,cursor:"pointer",textAlign:"left",borderRadius:"8px"},children:[t.jsx("p",{style:{fontWeight:500,color:e.textSecondary,marginBottom:"4px",fontSize:"14px"},children:"⊘ Uninstall"}),t.jsx("p",{style:{color:e.textTertiary,fontSize:"11px",margin:0},children:"Remove agent and auto-restart service"})]})]}),k&&t.jsxs("div",{style:{marginTop:"14px",padding:"14px",background:e.cardSurface,border:`1px solid ${e.borderGlass}`,borderRadius:"8px"},children:[t.jsx("p",{style:{fontFamily:e.mono,fontSize:"10px",letterSpacing:"1px",textTransform:"uppercase",color:e.accentAmber,marginBottom:"8px"},children:"Paste in terminal to fully remove"}),t.jsx("div",{style:{fontFamily:e.mono,fontSize:"12px",color:e.textSecondary,whiteSpace:"pre",lineHeight:1.8,overflowX:"auto"},children:`kill $(cat ~/.envelo/envelo.pid) 2>/dev/null
systemctl --user stop envelo.service 2>/dev/null
systemctl --user disable envelo.service 2>/dev/null
rm -f ~/.config/systemd/user/envelo.service
rm -rf ~/.envelo
echo "✓ ENVELO uninstalled"`})]})]})]})}function ye(){const{user:s}=K();return(s==null?void 0:s.role)==="admin"?t.jsx(se,{}):t.jsx(ae,{})}export{ye as default};
