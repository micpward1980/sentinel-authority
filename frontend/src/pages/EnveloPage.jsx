import React, { useState, useEffect, useRef } from 'react';
import CAT72ConsolePage from './CAT72Console';
import ErrorBoundary from '../components/ErrorBoundary';
import CertificatesPageEmbed from './CertificatesPage';
import MonitoringPageEmbed from './MonitoringPage';
import { Shield, Download, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

const API_BASE = 'https://sentinel-authority-production.up.railway.app';

// ─── ENVELO Agent code generator ──────────────────────────────────────────────

function buildProductionAgent({ apiKey, certificateNumber, systemName, organizationName }) {
  return `#!/usr/bin/env python3
"""
ENVELO Interlock — Sentinel Authority
Enforced Non-Violable Execution-Limit Override

Certificate : ${certificateNumber}
System      : ${systemName}
Organization: ${organizationName}

Generated   : ${new Date().toISOString().split('T')[0]}
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
API_ENDPOINT  = "${API_BASE}"
API_KEY       = "${apiKey}"
CERTIFICATE   = "${certificateNumber}"
SYSTEM_NAME   = "${systemName}"

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
`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TelemetryLog({ sessionId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    api.get(`/api/envelo/admin/sessions/${sessionId}/telemetry`)
      .then(r => setRecords(r.data.records || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div style={{ color: styles.textTertiary, padding: '12px', fontFamily: styles.mono, fontSize: '12px' }}>Loading telemetry…</div>;
  if (!records.length) return <div style={{ color: styles.textTertiary, padding: '12px', fontFamily: styles.mono, fontSize: '12px' }}>No records yet — data appears as the interlock runs.</div>;

  return (
    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
            {['Time', 'Action', 'Result', 'Params'].map(h => (
              <th key={h} style={{ padding: '8px', textAlign: 'left', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${styles.borderSubtle}` }}>
              <td style={{ padding: '8px', fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '—'}</td>
              <td style={{ padding: '8px', color: styles.textPrimary }}>{r.action_type}</td>
              <td style={{ padding: '8px' }}>
                <span style={{
                  padding: '2px 8px', fontSize: '10px', borderRadius: '4px',
                  background: r.result === 'PASS' ? 'rgba(22,135,62,0.10)' : 'rgba(180,52,52,0.10)',
                  color: r.result === 'PASS' ? styles.accentGreen : styles.accentRed
                }}>{r.result}</span>
              </td>
              <td style={{ padding: '8px', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '10px' }}>{JSON.stringify(r.parameters || {})}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionReport({ session }) {
  if (!session) return null;
  const total = (session.pass_count || 0) + (session.block_count || 0);
  const passRate = total > 0 ? ((session.pass_count / total) * 100).toFixed(1) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Actions', value: total, color: styles.textPrimary },
          { label: 'Passed', value: session.pass_count || 0, color: styles.accentGreen },
          { label: 'Blocked', value: session.block_count || 0, color: styles.accentRed },
          { label: 'Pass Rate', value: passRate + '%', color: passRate >= 95 ? styles.accentGreen : styles.accentRed },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: 'clamp(20px,4vw,28px)', fontWeight: 500, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '16px' }}>
        <div><div style={{ fontSize: '10px', color: styles.textTertiary, marginBottom: '4px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>Session</div><div style={{ fontFamily: styles.mono, color: styles.textSecondary, fontSize: '12px' }}>{session.session_id?.substring(0, 20)}…</div></div>
        <div><div style={{ fontSize: '10px', color: styles.textTertiary, marginBottom: '4px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>Certificate</div><div style={{ color: styles.textSecondary }}>{session.certificate_id || 'N/A'}</div></div>
        <div><div style={{ fontSize: '10px', color: styles.textTertiary, marginBottom: '4px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>Started</div><div style={{ color: styles.textSecondary }}>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</div></div>
        <div><div style={{ fontSize: '10px', color: styles.textTertiary, marginBottom: '4px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>Status</div>
          <span style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '4px', background: session.status === 'active' ? 'rgba(22,135,62,0.10)' : 'rgba(0,0,0,0.04)', color: session.status === 'active' ? styles.accentGreen : styles.textTertiary }}>{session.status?.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────

function EnveloAdminView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [sessions, setSessions]     = useState([]);
  const [applications, setApplications] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedCert, setSelectedCert]       = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // queue | monitoring | certified | review
  const [reviewComment, setReviewComment] = useState('');
  const [reviewingApp, setReviewingApp]   = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [sessRes, appsRes, certsRes] = await Promise.all([
        api.get('/api/envelo/admin/sessions').catch(() => ({ data: { sessions: [] } })),
        api.get('/api/applications/').catch(() => ({ data: [] })),
        api.get('/api/certificates/').catch(() => ({ data: [] })),
      ]);
      setSessions(sessRes.data.sessions || []);
      setApplications(appsRes.data.applications || appsRes.data || []);
      setCertificates(certsRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  // ── Segmented state buckets ───────────────────────────────
  const pending     = applications.filter(a => a.state === 'pending');
  const underReview = applications.filter(a => a.state === 'under_review');
  const approved    = applications.filter(a => a.state === 'approved');   // key sent, waiting for interlock
  const testing     = applications.filter(a => a.state === 'testing');    // CAT-72 running
  const conformant  = certificates.filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');

  // Check which approved apps have an active interlock session
  const connectedIds = new Set(sessions.filter(s => {
    const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at;
    return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120_000;
  }).map(s => s.certificate_id));

  const activeSessions   = sessions.filter(s => s.status === 'active');
  const totalViolations  = sessions.reduce((a, s) => a + (s.block_count || 0), 0);
  const needsAttention   = pending.length + underReview.length;

  const downloadAgentForCert = (cert) => {
    const code = buildProductionAgent({
      apiKey:           'YOUR_API_KEY',
      certificateNumber: cert.certificate_number,
      systemName:        cert.system_name || 'Unknown',
      organizationName:  cert.organization_name || '',
    });
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([code], { type: 'text/plain' })),
      download: `envelo_agent_${cert.certificate_number}.py`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const beginCAT72 = async (app) => {
    if (!await confirm({ title: 'Begin CAT-72', message: `Start the 72-hour conformance test for ${app.system_name}? The interlock must be confirmed online.`, confirmLabel: 'Begin Test', danger: false })) return;
    try {
      const reqId = `cat72-${app.id}-${Date.now()}`;
      await api.post(`/api/applications/${app.id}/begin-cat72`, { request_id: reqId });
      toast.show('CAT-72 test started', 'success');
      load();
    } catch (e) {
      toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error');
    }
  };

  const provisionKey = async (app) => {
    if (!await confirm({ title: 'Provision API Key', message: `Generate and email API key to ${app.contact_email} for ${app.system_name}?`, confirmLabel: 'Provision Key' })) return;
    try {
      await api.post('/api/apikeys/admin/provision', {
        user_id:        app.user_id,
        certificate_id: app.certificate_id,
        name:           'deployment-' + new Date().toISOString().split('T')[0],
        send_email:     true,
      });
      toast.show('Key generated and emailed to customer', 'success');
      load();
    } catch (e) {
      toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error');
    }
  };

  if (loading) return (
    <div style={{ color: styles.textTertiary, padding: '40px', textAlign: 'center' }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const tabs = [
    { id: 'queue',        label: 'Review Queue',    badge: needsAttention },
    { id: 'monitoring',   label: 'Monitoring',       badge: activeSessions.length },
    { id: 'cat72',        label: 'CAT-72',           badge: testing.length },
    { id: 'certificates', label: 'Certificates',     badge: conformant.length },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
      <SectionHeader label="Admin Console" title="ENVELO Management" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${styles.borderGlass}`, paddingBottom: '16px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 18px', borderRadius: '6px',
            background:  activeTab === tab.id ? 'rgba(29,26,59,0.08)' : 'transparent',
            border:      `1px solid ${activeTab === tab.id ? 'rgba(29,26,59,0.5)' : styles.borderGlass}`,
            color:       activeTab === tab.id ? styles.purpleBright : styles.textSecondary,
            fontFamily:  styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {tab.label}
            {tab.badge > 0 && (
              <span style={{ padding: '1px 6px', borderRadius: '999px', background: 'rgba(29,26,59,0.15)', color: styles.purpleBright, fontSize: '10px' }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── REVIEW QUEUE ── */}
      {activeTab === 'queue' && (
        <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
          {/* Pending */}
          {pending.length > 0 && (
            <Panel accent="amber">
              <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '16px' }}>New Applications — Pending Review</p>
              {pending.map(app => (
                <div key={app.id} style={{ padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontWeight: 500, color: styles.textPrimary, marginBottom: '4px' }}>{app.system_name}</h3>
                      <p style={{ color: styles.textSecondary, fontSize: '13px', marginBottom: '4px' }}>{app.organization_name} · {app.contact_email}</p>
                      <p style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>{app.application_number} · submitted {app.created_at?.split('T')[0]}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/api/applications/${app.id}/begin-review`);
                            toast.show('Review started', 'success'); load();
                          } catch (e) { toast.show('Failed: ' + e.message, 'error'); }
                        }}
                        style={{ padding: '8px 16px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: styles.mono, fontSize: '11px', cursor: 'pointer', borderRadius: '6px' }}
                      >
                        Begin Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </Panel>
          )}

          {/* Under review */}
          {underReview.map(app => (
            <Panel key={app.id} glow>
              <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px' }}>Under Review</p>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontWeight: 500, color: styles.textPrimary, marginBottom: '4px' }}>{app.system_name}</h3>
                <p style={{ color: styles.textSecondary, fontSize: '13px' }}>{app.organization_name} · {app.application_number}</p>
              </div>

              {/* Boundary summary */}
              {app.envelope_definition && (() => {
                const env = app.envelope_definition;
                const nb  = env.numeric_boundaries || [];
                const gb  = env.geographic_boundaries || [];
                const tb  = env.time_boundaries || [];
                const sb  = env.state_boundaries || [];
                return (
                  <div style={{ marginBottom: '20px', padding: '12px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px' }}>
                    <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px' }}>Submitted Boundaries</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: '8px', textAlign: 'center' }}>
                      {[
                        { label: 'Numeric', count: nb.length },
                        { label: 'Geographic', count: gb.length },
                        { label: 'Time', count: tb.length },
                        { label: 'State', count: sb.length },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '10px', background: 'rgba(29,26,59,0.05)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '20px', fontWeight: 500, color: styles.purpleBright }}>{s.count}</div>
                          <div style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary, marginTop: '2px' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {nb.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        {nb.map((b, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${styles.borderSubtle}`, fontSize: '12px' }}>
                            <span style={{ color: styles.textPrimary }}>{b.name}</span>
                            <span style={{ fontFamily: styles.mono, color: styles.purpleBright }}>{b.min_value ?? '—'} → {b.max_value ?? '—'} {b.unit || ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ padding: '12px 16px', background: 'rgba(158,110,18,0.04)', border: '1px solid rgba(158,110,18,0.15)', borderRadius: '6px', marginBottom: '16px' }}>
                <p style={{ color: styles.accentAmber, fontSize: '12px', margin: 0 }}>⚠ Sentinel Authority does not modify customer-submitted boundaries. Approve as submitted or reject with required changes.</p>
              </div>

              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Review notes (required for rejection, optional for approval)…"
                style={{ width: '100%', minHeight: '72px', padding: '10px 14px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px', fontFamily: styles.sans, resize: 'vertical', borderRadius: '6px', boxSizing: 'border-box' }}
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    try {
                      const approveReqId = `approve-${app.id}-${Date.now()}`;
      await api.post(`/api/applications/${app.id}/approve`, { note: reviewComment || 'Approved.', request_id: approveReqId });
                      toast.show('Application approved — API key generated and emailed to customer', 'success');
                      setReviewComment(''); load();
                    } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
                  }}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${styles.accentGreen}`, color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px' }}
                >
                  ✓ Approve — Generate &amp; Email Key
                </button>
                <button
                  onClick={async () => {
                    if (!reviewComment.trim()) { toast.show('Rejection requires specific feedback', 'error'); return; }
                    try {
                      const rejectReqId = `reject-${app.id}-${Date.now()}`;
      await api.post(`/api/applications/${app.id}/reject`, { note: reviewComment, request_id: rejectReqId });
                      toast.show('Sent back with required changes', 'success');
                      setReviewComment(''); load();
                    } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
                  }}
                  style={{ flex: 1, padding: '12px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px' }}
                >
                  ✗ Reject — Request Changes
                </button>
              </div>
            </Panel>
          ))}

          {/* Approved — waiting for interlock */}
          {approved.length > 0 && (
            <Panel>
              <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px' }}>Approved — Awaiting Interlock Connection</p>
              {approved.map(app => {
                const certId = app.certificate_number || app.certificate_id;
                const isConnected = certId && connectedIds.has(certId);
                return (
                  <div key={app.id} style={{ padding: '16px', background: styles.cardSurface, border: `1px solid ${isConnected ? styles.accentGreen : styles.borderGlass}`, borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ fontWeight: 500, color: styles.textPrimary, marginBottom: '4px' }}>{app.system_name}</h3>
                        <p style={{ fontSize: '12px', color: styles.textSecondary, marginBottom: '4px' }}>{app.organization_name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isConnected ? styles.accentGreen : styles.accentAmber }} />
                          <span style={{ fontFamily: styles.mono, fontSize: '10px', color: isConnected ? styles.accentGreen : styles.accentAmber, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {isConnected ? 'Interlock Online' : 'Waiting for Customer to Deploy'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isConnected && (
                          <button onClick={() => beginCAT72(app)} style={{ padding: '8px 18px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: styles.mono, fontSize: '11px', cursor: 'pointer', borderRadius: '6px' }}>
                            Begin CAT-72
                          </button>
                        )}
                        <button onClick={() => provisionKey(app)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, fontFamily: styles.mono, fontSize: '10px', cursor: 'pointer', borderRadius: '6px' }}>
                          Resend Key
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Panel>
          )}

          {/* CAT-72 In Progress */}
          {testing.length > 0 && (
            <Panel accent="amber">
              <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '16px' }}>CAT-72 Running</p>
              {testing.map(app => {
                const certId = app.certificate_number || app.certificate_id;
                const session = sessions.find(s => s.certificate_id === certId);
                const started = app.cat72_started_at ? new Date(app.cat72_started_at) : null;
                const elapsed = started ? (Date.now() - started.getTime()) / 1000 : 0;
                const remaining = Math.max(0, (72 * 3600) - elapsed);
                const pct = Math.min(100, (elapsed / (72 * 3600)) * 100).toFixed(0);
                return (
                  <div key={app.id} style={{ padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontWeight: 500, color: styles.textPrimary, marginBottom: '4px' }}>{app.system_name}</h3>
                        <p style={{ fontSize: '12px', color: styles.textSecondary }}>{app.organization_name}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: styles.mono, fontSize: '20px', color: styles.accentAmber }}>{(remaining / 3600).toFixed(1)}h</div>
                        <div style={{ fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px' }}>remaining</div>
                      </div>
                    </div>
                    <div style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '4px', overflow: 'hidden', height: '6px', marginBottom: '8px' }}>
                      <div style={{ width: pct + '%', height: '100%', background: styles.accentAmber, transition: 'width 1s linear', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: styles.textTertiary, fontFamily: styles.mono }}>
                      <span>{pct}% complete</span>
                      {session && <span>✓ {session.pass_count || 0} · ✗ {session.block_count || 0}</span>}
                    </div>
                  </div>
                );
              })}
            </Panel>
          )}

          {needsAttention === 0 && approved.length === 0 && testing.length === 0 && (
            <Panel>
              <div style={{ textAlign: 'center', padding: '48px 20px', color: styles.textTertiary }}>
                <Shield size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontFamily: styles.mono, fontSize: '12px', letterSpacing: '1px' }}>Queue is clear</p>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── LIVE MONITORING ── */}
      {activeTab === 'monitoring' && (
        <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
          <Panel glow>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <p style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary }}>Active Sessions</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: styles.accentGreen, animation: 'pulse 2s infinite' }} />
                <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.accentGreen, textTransform: 'uppercase', letterSpacing: '1px' }}>Live</span>
              </div>
            </div>

            {sessions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
                      {['Certificate', 'System', 'Status', 'Pass', 'Block', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => {
                      const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at;
                      const online = la && (Date.now() - new Date(la).getTime()) < 120_000;
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${styles.borderSubtle}` }}>
                          <td style={{ padding: '14px 16px', fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright }}>{s.certificate_id || 'N/A'}</td>
                          <td style={{ padding: '14px 16px', color: styles.textPrimary, fontSize: '13px' }}>{s.system_name || '—'}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: online ? styles.accentGreen : styles.textDim }} />
                              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: online ? styles.accentGreen : styles.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>{online ? 'Online' : 'Offline'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: styles.accentGreen, fontFamily: styles.mono }}>{s.pass_count || 0}</td>
                          <td style={{ padding: '14px 16px', color: (s.block_count || 0) > 0 ? styles.accentRed : styles.textTertiary, fontFamily: styles.mono }}>{s.block_count || 0}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <button onClick={() => setSelectedSession(s)} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', cursor: 'pointer', borderRadius: '4px' }}>Details</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: styles.textTertiary, textAlign: 'center', padding: '40px' }}>No sessions yet. Sessions appear when customers deploy the interlock.</p>
            )}
          </Panel>

      {selectedSession && (
            <Panel accent="purple">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <p style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary }}>Session Detail</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.get(`/api/envelo/admin/sessions/${selectedSession.session_id}/report`, { responseType: 'blob' });
                        const url = URL.createObjectURL(new Blob([res.data]));
                        Object.assign(document.createElement('a'), { href: url, download: `CAT72-${selectedSession.session_id}.pdf` }).click();
                      } catch (e) { toast.show('Report unavailable', 'error'); }
                    }}
                    style={{ padding: '7px 14px', background: 'transparent', border: 'none', color: styles.purpleBright, fontSize: '11px', cursor: 'pointer', fontFamily: styles.mono }}
                  >
                    ↓ Download Report
                  </button>
                  <button onClick={() => setSelectedSession(null)} style={{ padding: '7px 14px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textTertiary, cursor: 'pointer', fontSize: '11px', borderRadius: '6px' }}>✕</button>
                </div>
              </div>
              <SessionReport session={selectedSession} />
              <div style={{ marginTop: '20px' }}>
                <TelemetryLog sessionId={selectedSession.session_id} />
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── CAT-72 ── */}
      {activeTab === 'cat72' && (
        <ErrorBoundary><CAT72ConsolePage /></ErrorBoundary>
      )}

      {/* ── CERTIFICATES ── */}
      {activeTab === 'certificates' && (
        <ErrorBoundary><CertificatesPageEmbed /></ErrorBoundary>
      )}

      {/* ── CERTIFIED (legacy) ── */}
      {activeTab === 'certified' && (
        <Panel>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px' }}>ODDC Conformant Systems</p>
          {conformant.length > 0 ? conformant.map(cert => {
            const certId = cert.certificate_number;
            const isOnline = connectedIds.has(certId);
            return (
              <div key={cert.id} style={{ padding: '20px', background: styles.cardSurface, border: `1px solid ${isOnline ? styles.accentGreen : styles.borderGlass}`, borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h3 style={{ fontWeight: 500, color: styles.textPrimary, margin: 0 }}>{cert.system_name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? styles.accentGreen : styles.textDim, ...(isOnline ? { animation: 'pulse 2s infinite' } : {}) }} />
                        <span style={{ fontFamily: styles.mono, fontSize: '9px', color: isOnline ? styles.accentGreen : styles.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>{isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: styles.textSecondary, marginBottom: '4px' }}>{cert.organization_name}</p>
                    <p style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright }}>{cert.certificate_number}</p>
                    {cert.expires_at && <p style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary, marginTop: '4px' }}>Expires: {cert.expires_at.split('T')[0]}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => downloadAgentForCert(cert)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, fontFamily: styles.mono, fontSize: '10px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Download size={12} /> Agent Template
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <p style={{ color: styles.textTertiary, textAlign: 'center', padding: '40px' }}>No certified systems yet.</p>
          )}
        </Panel>
      )}
    </div>
  );
}

// ─── CUSTOMER VIEW ─────────────────────────────────────────────────────────────

function EnveloCustomerView() {
  const toast  = useToast();
  const { user } = useAuth();
  const [loading, setLoading]     = useState(true);
  const [userApps, setUserApps]   = useState([]);
  const [userCerts, setUserCerts] = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [apiKeys, setApiKeys]     = useState([]);
  const [copied, setCopied]       = useState(false);
  const [showUninstall, setShowUninstall] = useState(false);

  const load = async () => {
    try {
      const [appsRes, certsRes, sessRes, keysRes] = await Promise.all([
        api.get('/api/applications/').catch(() => ({ data: [] })),
        api.get('/api/certificates/').catch(() => ({ data: [] })),
        api.get('/api/envelo/sessions').catch(() => ({ data: { sessions: [] } })),
        api.get('/api/apikeys/').catch(() => ({ data: [] })),
      ]);
      setUserApps(appsRes.data?.applications || appsRes.data || []);
      setUserCerts(certsRes.data || []);
      setSessions(sessRes.data.sessions || []);
      setApiKeys(keysRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  if (loading) return (
    <div style={{ color: styles.textTertiary, padding: '40px', textAlign: 'center' }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  // ── Derived state ──
  const latestApp = [...userApps].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  const conformantCerts = userCerts.filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const activeSessions  = sessions.filter(s => {
    const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at;
    return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120_000;
  });
  const firstKey = apiKeys[0];

  const downloadAgent = (key) => {
    const app  = latestApp;
    const cert = conformantCerts[0];
    const code = buildProductionAgent({
      apiKey:            key || firstKey?.key || 'YOUR_API_KEY',
      certificateNumber: cert?.certificate_number || app?.certificate_number || app?.application_number || 'PENDING',
      systemName:        app?.system_name || 'My System',
      organizationName:  app?.organization_name || user?.organization_name || '',
    });
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([code], { type: 'text/plain' })),
      download: 'envelo_agent.py',
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.show('envelo_agent.py downloaded', 'success');
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    toast.show('API key copied', 'success');
  };

  // ════ STATE 1: No applications ═══════════════════════════════════════════
  if (!latestApp) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
        <SectionHeader label="ENVELO Interlock" title="Get Started" />
        <Panel>
          <div style={{ textAlign: 'center', padding: 'clamp(32px,6vw,72px) clamp(16px,4vw,24px)' }}>
            <Shield fill="currentColor" fillOpacity={0.08} strokeWidth={1.5} size={56} style={{ color: styles.purpleBright, margin: '0 auto 20px' }} />
            <h2 style={{ fontFamily: styles.serif, fontSize: 'clamp(20px,4vw,28px)', fontWeight: 200, marginBottom: '12px' }}>Start Your Certification</h2>
            <p style={{ color: styles.textSecondary, maxWidth: '400px', margin: '0 auto 32px', lineHeight: 1.6 }}>
              Submit an application to begin the ODDC certification process for your autonomous system.
            </p>
            <a href="/applications/new" style={{ display: 'inline-block', padding: '13px 36px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: styles.mono, fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '6px' }}>
              New Application →
            </a>
          </div>
        </Panel>
      </div>
    );
  }

  // ════ STATE 2: Pending / Under Review ════════════════════════════════════
  if (latestApp.state === 'pending' || latestApp.state === 'under_review') {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
        <SectionHeader label="ENVELO Interlock" title="Application in Review" />
        <Panel>
          <div style={{ textAlign: 'center', padding: 'clamp(32px,5vw,60px) clamp(16px,4vw,24px)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `2px solid rgba(158,110,18,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>⏳</div>
            <h2 style={{ fontFamily: styles.serif, fontSize: 'clamp(20px,4vw,26px)', fontWeight: 200, marginBottom: '8px' }}>
              {latestApp.state === 'under_review' ? 'Being Reviewed' : 'In Queue'}
            </h2>
            <p style={{ color: styles.textSecondary, marginBottom: '8px' }}>{latestApp.system_name}</p>
            <p style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.textTertiary, marginBottom: '24px' }}>{latestApp.application_number}</p>
            <p style={{ color: styles.textSecondary, maxWidth: '380px', margin: '0 auto', lineHeight: 1.6, fontSize: '14px' }}>
              {latestApp.state === 'under_review'
                ? 'Our team is reviewing your boundaries. You\'ll receive an email when approved.'
                : 'Your application is in the queue. Our team will begin review shortly.'}
            </p>
          </div>
        </Panel>
        <Panel>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px' }}>What happens next</p>
          {[
            { step: '1', text: 'Admin reviews your boundary definitions', done: true },
            { step: '2', text: 'Approval email sent with API key', done: false },
            { step: '3', text: 'You deploy the ENVELO Interlock', done: false },
            { step: '4', text: '72-hour conformance test runs', done: false },
            { step: '5', text: 'Certificate issued automatically', done: false },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${styles.borderSubtle}` }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.done ? 'rgba(22,135,62,0.1)' : styles.cardSurface, border: `1px solid ${s.done ? styles.accentGreen : styles.borderGlass}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: s.done ? styles.accentGreen : styles.textTertiary, fontFamily: styles.mono, flexShrink: 0 }}>
                {s.done ? '✓' : s.step}
              </div>
              <span style={{ fontSize: '13px', color: s.done ? styles.textPrimary : styles.textSecondary }}>{s.text}</span>
            </div>
          ))}
        </Panel>
      </div>
    );
  }

  // ════ STATE 3: Approved — key ready, need to deploy ═══════════════════════
  if (latestApp.state === 'approved') {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
        <SectionHeader label="ENVELO Interlock" title="Deploy Your Interlock" description="Your application is approved. Install the agent to begin the 72-hour test." />

        {/* API Key panel */}
        <Panel glow>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentGreen, marginBottom: '16px' }}>✓ Application Approved — API Key Ready</p>

          {firstKey ? (
            <div>
              <div style={{ padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontFamily: styles.mono, fontSize: '13px', color: styles.textPrimary, wordBreak: 'break-all', marginBottom: '12px' }}>
                  {firstKey.key_prefix}••••••••••••••••••••
                </div>
                <p style={{ fontSize: '12px', color: styles.accentAmber, marginBottom: '12px' }}>⚠ Your full key was emailed to {latestApp.contact_email}. Download the agent below to get it embedded.</p>
                <button onClick={() => downloadAgent()} style={{ padding: '10px 20px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: styles.mono, fontSize: '11px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={14} /> Download envelo_agent.py (pre-configured)
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', background: 'rgba(158,110,18,0.04)', border: '1px solid rgba(158,110,18,0.2)', borderRadius: '8px' }}>
              <p style={{ color: styles.accentAmber, fontSize: '13px' }}>Your API key is being provisioned. Check your email or refresh in a moment.</p>
            </div>
          )}
        </Panel>

        {/* Install instructions */}
        <Panel>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px' }}>Installation Steps</p>

          {[
            {
              num: '1', title: 'Download the agent',
              content: <button onClick={() => downloadAgent()} style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', cursor: 'pointer', borderRadius: '6px' }}>↓ envelo_agent.py</button>
            },
            {
              num: '2', title: 'Install dependency',
              content: (
                <div style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${styles.borderGlass}`, padding: '10px 14px', borderRadius: '6px', fontFamily: styles.mono, fontSize: '12px', color: styles.textPrimary }}>
                  <span style={{ color: styles.accentGreen }}>$</span> pip install httpx
                </div>
              )
            },
            {
              num: '3', title: 'Run the agent',
              content: (
                <div style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${styles.borderGlass}`, padding: '10px 14px', borderRadius: '6px', fontFamily: styles.mono, fontSize: '12px', color: styles.textPrimary }}>
                  <span style={{ color: styles.accentGreen }}>$</span> python envelo_agent.py
                </div>
              )
            },
            {
              num: '4', title: 'Integrate (optional — agent works standalone)',
              content: (
                <div style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${styles.borderGlass}`, padding: '10px 14px', borderRadius: '6px', fontFamily: styles.mono, fontSize: '12px', color: styles.textSecondary }}>
                  <div style={{ color: styles.textTertiary, marginBottom: '4px' }}># In your code:</div>
                  <div>from envelo_agent import agent</div>
                  <div>agent.start()</div>
                  <div style={{ marginTop: '8px' }}>@agent.enforce</div>
                  <div>def my_action(speed=0): ...</div>
                </div>
              )
            },
          ].map(s => (
            <div key={s.num} style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${styles.purpleBright}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright, flexShrink: 0 }}>{s.num}</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: styles.textSecondary, marginBottom: '8px', fontSize: '14px' }}>{s.title}</p>
                {s.content}
              </div>
            </div>
          ))}

          <div style={{ padding: '12px 16px', background: 'rgba(22,135,62,0.04)', border: '1px solid rgba(22,135,62,0.1)', borderRadius: '6px', marginTop: '8px' }}>
            <p style={{ color: styles.accentGreen, fontSize: '13px', margin: 0 }}>Once the agent is running, it will connect automatically. Your 72-hour test starts when an admin confirms the connection — this page will update.</p>
          </div>
        </Panel>
      </div>
    );
  }

  // ════ STATE 4: Testing (CAT-72 running) ═══════════════════════════════════
  if (latestApp.state === 'testing') {
    const session = sessions[0];
    const started = latestApp.cat72_started_at ? new Date(latestApp.cat72_started_at) : null;
    const elapsed = started ? (Date.now() - started.getTime()) / 1000 : 0;
    const remaining = Math.max(0, (72 * 3600) - elapsed);
    const pct = Math.min(100, (elapsed / (72 * 3600)) * 100).toFixed(1);
    const isOnline = activeSessions.length > 0;

    return (
      <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
        <SectionHeader label="ENVELO Interlock" title="CAT-72 Running" description="72-hour conformance test in progress. Keep the agent running." />

        <Panel glow={isOnline}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontWeight: 500, color: styles.textPrimary, marginBottom: '4px' }}>{latestApp.system_name}</h3>
              <p style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.textTertiary }}>{latestApp.application_number}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'transparent' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? styles.accentGreen : styles.accentRed, ...(isOnline ? { animation: 'pulse 2s infinite' } : {}) }} />
              <span style={{ fontFamily: styles.mono, fontSize: '11px', color: isOnline ? styles.accentGreen : styles.accentRed, textTransform: 'uppercase', letterSpacing: '1px' }}>{isOnline ? 'Interlock Online' : 'Interlock Offline — Check Agent'}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>{pct}% complete</span>
              <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.accentAmber }}>{(remaining / 3600).toFixed(1)}h remaining</span>
            </div>
            <div style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
              <div style={{ width: pct + '%', height: '100%', background: `linear-gradient(90deg, ${styles.purpleBright}, ${styles.accentGreen})`, transition: 'width 1s linear', borderRadius: '4px' }} />
            </div>
          </div>

          {/* Stats */}
          {session && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: '12px' }}>
              {[
                { label: 'Passed', value: session.pass_count || 0, color: styles.accentGreen },
                { label: 'Blocked', value: session.block_count || 0, color: (session.block_count || 0) > 0 ? styles.accentRed : styles.accentGreen },
                { label: 'Total Actions', value: (session.pass_count || 0) + (session.block_count || 0), color: styles.textPrimary },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '14px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px' }}>
                  <div style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 200, color: s.color }}>{s.value}</div>
                  <div style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary, marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {!isOnline && (
          <Panel accent="amber">
            <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '12px' }}>Agent Offline — Action Required</p>
            <p style={{ color: styles.textSecondary, fontSize: '14px', marginBottom: '16px' }}>The ENVELO Interlock hasn't sent a heartbeat in the last 2 minutes. Check that it's running:</p>
            <div style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${styles.borderGlass}`, padding: '10px 14px', borderRadius: '6px', fontFamily: styles.mono, fontSize: '12px', color: styles.textPrimary, marginBottom: '16px' }}>
              <span style={{ color: styles.accentGreen }}>$</span> python envelo_agent.py
            </div>
            <p style={{ fontSize: '12px', color: styles.textTertiary }}>If the test was interrupted for more than 5 minutes, contact admin — the test window may need to be restarted.</p>
          </Panel>
        )}
      </div>
    );
  }

  // ════ STATE 5: Conformant / Certified ════════════════════════════════════
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
      <SectionHeader label="ENVELO Interlock" title="Active" description="ODDC conformant — boundaries enforced in production" />

      {conformantCerts.map(cert => {
        const session = sessions.find(s => s.certificate_id === cert.certificate_number);
        const isOnline = activeSessions.some(s => s.certificate_id === cert.certificate_number);
        return (
          <Panel key={cert.id} glow={isOnline}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h3 style={{ fontWeight: 500, color: styles.textPrimary, margin: 0 }}>{cert.system_name}</h3>
                  <span style={{ padding: '2px 8px', background: 'rgba(22,135,62,0.08)', border: '1px solid rgba(22,135,62,0.2)', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', borderRadius: '4px' }}>CONFORMANT</span>
                </div>
                <p style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.purpleBright, marginBottom: '4px' }}>{cert.certificate_number}</p>
                {cert.expires_at && <p style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary }}>Expires {cert.expires_at.split('T')[0]}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? styles.accentGreen : styles.textDim, ...(isOnline ? { animation: 'pulse 2s infinite' } : {}) }} />
                <span style={{ fontFamily: styles.mono, fontSize: '11px', color: isOnline ? styles.accentGreen : styles.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>{isOnline ? 'Interlock Active' : 'Interlock Offline'}</span>
              </div>
            </div>

            {session && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '12px', paddingTop: '16px', borderTop: `1px solid ${styles.borderGlass}` }}>
                {[
                  { label: 'Passed', value: session.pass_count || 0, color: styles.accentGreen },
                  { label: 'Blocked', value: session.block_count || 0, color: (session.block_count || 0) > 0 ? styles.accentRed : styles.textTertiary },
                  { label: 'Total', value: (session.pass_count || 0) + (session.block_count || 0), color: styles.textPrimary },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 200, color: s.color }}>{s.value}</div>
                    <div style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary, marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        );
      })}

      {/* Agent control */}
      <Panel>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px' }}>Agent Control</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px' }}>
          <button onClick={() => downloadAgent()} style={{ padding: '14px', background: 'transparent', border: `1px solid ${styles.purpleBright}`, cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}>
            <p style={{ fontWeight: 500, color: styles.purpleBright, marginBottom: '4px', fontSize: '14px' }}>↓ Re-download Agent</p>
            <p style={{ color: styles.textTertiary, fontSize: '11px', margin: 0 }}>Get the current pre-configured script</p>
          </button>
          <button onClick={() => setShowUninstall(!showUninstall)} style={{ padding: '14px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}>
            <p style={{ fontWeight: 500, color: styles.textSecondary, marginBottom: '4px', fontSize: '14px' }}>⊘ Uninstall</p>
            <p style={{ color: styles.textTertiary, fontSize: '11px', margin: 0 }}>Remove agent and auto-restart service</p>
          </button>
        </div>
        {showUninstall && (
          <div style={{ marginTop: '14px', padding: '14px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px' }}>
            <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '8px' }}>Paste in terminal to fully remove</p>
            <div style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.textSecondary, whiteSpace: 'pre', lineHeight: 1.8, overflowX: 'auto' }}>
              {`kill $(cat ~/.envelo/envelo.pid) 2>/dev/null\nsystemctl --user stop envelo.service 2>/dev/null\nsystemctl --user disable envelo.service 2>/dev/null\nrm -f ~/.config/systemd/user/envelo.service\nrm -rf ~/.envelo\necho "✓ ENVELO uninstalled"`}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function EnveloPage() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <EnveloAdminView /> : <EnveloCustomerView />;
}