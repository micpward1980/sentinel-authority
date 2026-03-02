import React, { useState, useEffect, useRef } from 'react';
import { Shield, Download, RefreshCw } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

const API_BASE = 'https://api.sentinelauthority.org';

// ─── ENVELO Interlock code generator ──────────────────────────────────────────────

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
        log.info("Auto-restart disabled. Interlock stopped cleanly.")

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
    print("Interlock running. Ctrl+C to stop.")
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
  const [activeTab, setActiveTab] = useState('queue'); // queue | certified
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
  const failed      = applications.filter(a => a.state === 'failed' || a.state === 'test_failed');
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
      await api.post(`/api/applications/${app.id}/begin-cat72`);
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
    { id: 'queue',      label: 'Review Queue',  badge: needsAttention },
    { id: 'certified',  label: 'Certified',      badge: conformant.length },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader label="⬡ Admin Console" title="ENVELO Management" description="Certify and manage all customer systems" />

      {/* Stats row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {[
          { label: 'Awaiting Review', value: needsAttention,          color: needsAttention > 0 ? styles.accentAmber : styles.textTertiary },
          { label: 'Approved / Deploying', value: approved.length,    color: styles.purpleBright },
          { label: 'CAT-72 Running',   value: testing.length,         color: styles.accentAmber },
          { label: 'Failed',           value: failed.length,          color: styles.accentRed },
          { label: 'Live Interlocks',  value: activeSessions.length,  color: styles.accentGreen },
          { label: 'Certified Systems',value: conformant.length,      color: styles.purpleBright },
          { label: 'Total Violations', value: totalViolations,        color: totalViolations > 0 ? styles.accentRed : styles.accentGreen },
        ].map(s => (
          <Panel key={s.label}>
            <p style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px' }}>{s.label}</p>
            <p style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 200, color: s.color }}>{s.value}</p>
          </Panel>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${styles.borderGlass}`, paddingBottom: '16px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 18px', borderRadius: '6px',
            background:  activeTab === tab.id ? 'rgba(74,61,117,0.08)' : 'transparent',
            border:      `1px solid ${activeTab === tab.id ? 'rgba(74,61,117,0.5)' : styles.borderGlass}`,
            color:       activeTab === tab.id ? styles.purpleBright : styles.textSecondary,
            fontFamily:  styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {tab.label}
            {tab.badge > 0 && (
              <span style={{ padding: '1px 6px', borderRadius: '999px', background: 'rgba(74,61,117,0.15)', color: styles.purpleBright, fontSize: '10px' }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── REVIEW QUEUE ── */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
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
                        <div key={s.label} style={{ padding: '10px', background: 'rgba(74,61,117,0.05)', borderRadius: '6px' }}>
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
                      await api.post(`/api/applications/${app.id}/approve`, { note: reviewComment || 'Approved.' });
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
                      await api.post(`/api/applications/${app.id}/reject`, { note: reviewComment });
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
      {/* ── CERTIFIED ── */}
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
                      <Download size={12} /> Interlock Template
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
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [acceptingAgreement, setAcceptingAgreement] = useState(false);

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
      download: 'envelo_interlock.py',
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.show('envelo_interlock.py downloaded', 'success');
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
      <div className="space-y-6">
        <SectionHeader label="CERTIFICATION" title="Getting Started" />
        <Panel>
          <div style={{ textAlign: 'center', padding: 'clamp(32px,6vw,56px) clamp(16px,4vw,24px)' }}>
            <p style={{ color: styles.textSecondary, maxWidth: '400px', margin: '0 auto', lineHeight: 1.6, fontSize: '14px' }}>
              This page tracks your certification progress once you've submitted an application.
            </p>

          </div>
        </Panel>
      </div>
    );
  }

  // ════ STATE 2: Pending / Under Review ════════════════════════════════════
  if (latestApp.state === 'pending' || latestApp.state === 'under_review') {
    return (
      <div className="space-y-6">
        <SectionHeader label="CERTIFICATION" title="Application in Review" />
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
                ? 'Our team is reviewing your application. You\'ll receive an email when approved.'
                : 'Your application is in the queue. Our team will begin review shortly.'}
            </p>
          </div>
        </Panel>
        <Panel>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px' }}>What happens next</p>
          {[
            { step: '1', text: 'Application reviewed by Sentinel Authority', done: true },
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

  // ════ STATE 3a: Approved but agreement not yet accepted ═══════════════════
  const needsAgreement = (latestApp.state === 'approved' || latestApp.state === 'bounded' || latestApp.state === 'observe') && !latestApp.agreement_accepted_at;

  const handleAcceptAgreement = async () => {
    setAcceptingAgreement(true);
    try {
      await api.post(`/api/applications/${latestApp.id}/accept-agreement`);
      toast.show('Conformance Agreement executed — deploy when ready', 'success');
      load();
    } catch (e) {
      toast.show(e.response?.data?.detail || 'Failed to record agreement', 'error');
    }
    setAcceptingAgreement(false);
  };

  if (needsAgreement) {
    return (
      <div className="space-y-6">
        <SectionHeader label="CERTIFICATION" title="Conformance Agreement" description="Review and execute the agreement before deployment." />

        <Panel glow>
          <div style={{ textAlign: 'center', padding: '24px 16px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `2px solid ${styles.accentGreen}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>✓</div>
            <h2 style={{ fontFamily: styles.serif, fontSize: 'clamp(20px,4vw,26px)', fontWeight: 200, marginBottom: '8px', color: styles.accentGreen }}>Application Approved</h2>
            <p style={{ color: styles.textSecondary, fontSize: '14px' }}>{latestApp.system_name} — {latestApp.organization_name}</p>
          </div>
        </Panel>

        <Panel>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px' }}>Conformance Agreement</p>
          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '20px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: styles.textSecondary, lineHeight: 1.7 }}>
            <p style={{ fontWeight: 600, color: styles.textPrimary, marginBottom: '16px' }}>ODDC Conformance Agreement</p>
            <p style={{ marginBottom: '12px' }}>This Conformance Agreement ("Agreement") is entered into between Sentinel Authority ("SA") and the undersigned applicant ("Applicant") in connection with ODDC certification services.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>1. Scope of Certification</p>
            <p style={{ marginBottom: '12px' }}>SA will evaluate Applicant's autonomous system for Operational Design Domain Conformance ("ODDC") using the ENVELO Interlock enforcement framework and the CAT-72 assessment protocol. Certification applies solely to the system version, configuration, and operational domain tested.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>2. Applicant Obligations</p>
            <p style={{ marginBottom: '8px' }}>Applicant agrees to: (a) deploy and maintain the ENVELO Interlock agent on all certified systems; (b) maintain minimum 99% monthly uptime for the Interlock agent; (c) not modify, disable, or circumvent ENVELO enforcement mechanisms; (d) promptly notify SA of any material changes to the certified system; (e) submit to continuous post-certification enforcement.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>3. Continuous Enforcement</p>
            <p style={{ marginBottom: '8px' }}>Certified systems are subject to continuous enforcement. SA computes a real-time conformance score for each system. Certificates are automatically suspended if agent heartbeat is lost for more than 15 minutes or boundary violation rate exceeds the enforcement threshold. Reinstatement requires human authorization.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>4. Revocation & Suspension</p>
            <p style={{ marginBottom: '8px' }}>SA reserves the right to suspend or revoke certification for: (a) failure to maintain Interlock connectivity; (b) material modification of the certified system without re-assessment; (c) repeated boundary violations; (d) non-payment of renewal fees; (e) conduct that endangers public safety.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>5. Intellectual Property</p>
            <p style={{ marginBottom: '8px' }}>The ENVELO Interlock transmits only operational telemetry. Applicant's proprietary system internals, algorithms, and trade secrets are not accessed, transmitted, or stored by SA.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>6. Limitation of Liability</p>
            <p style={{ marginBottom: '8px' }}>ODDC certification does not constitute a warranty of safety. SA's liability is limited to the certification fees paid. SA is not liable for damages arising from system operation, regardless of certification status.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>7. Term & Renewal</p>
            <p style={{ marginBottom: '8px' }}>Certification is valid for one year from issuance. Renewal requires demonstration of continued conformance and payment of applicable fees. Lapsed certifications require a new CAT-72 assessment.</p>
            <p style={{ fontWeight: 600, color: styles.textPrimary, margin: '16px 0 8px' }}>8. Governing Law</p>
            <p>This Agreement is governed by the laws of the State of Texas, USA. Disputes shall be resolved in the courts of Travis County, Texas.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'rgba(74,61,117,0.04)', border: `1px solid rgba(74,61,117,0.15)`, borderRadius: '6px', marginBottom: '20px' }}>
            <input type="checkbox" id="agreement-check" checked={agreementChecked} onChange={(e) => setAgreementChecked(e.target.checked)} style={{ marginTop: '2px', accentColor: styles.purpleBright, width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }} />
            <label htmlFor="agreement-check" style={{ fontSize: '13px', color: styles.textPrimary, lineHeight: 1.6, cursor: 'pointer' }}>
              I have read and agree to the ODDC Conformance Agreement on behalf of <strong>{latestApp.organization_name}</strong>. I understand that certification is subject to continuous enforcement and may be suspended or revoked under the conditions described above.
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={handleAcceptAgreement} disabled={!agreementChecked || acceptingAgreement} style={{ padding: '13px 36px', background: agreementChecked ? styles.purplePrimary : styles.cardSurface, border: `1px solid ${agreementChecked ? styles.purpleBright : styles.borderGlass}`, color: agreementChecked ? '#fff' : styles.textTertiary, fontFamily: styles.mono, fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', borderRadius: '6px', cursor: agreementChecked ? 'pointer' : 'not-allowed', opacity: acceptingAgreement ? 0.6 : 1 }}>
              {acceptingAgreement ? 'Recording...' : 'Execute Agreement'}
            </button>
            <a href="https://www.sentinelauthority.org/conformance-agreement.html" target="_blank" rel="noopener" style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.purpleBright, textDecoration: 'none' }}>View full agreement ↗</a>
          </div>
        </Panel>

        <Panel>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px' }}>What happens next</p>
          {[
            { step: '1', text: 'Application approved', done: true },
            { step: '2', text: 'Execute Conformance Agreement', done: false, active: true },
            { step: '3', text: 'Deploy the ENVELO Interlock', done: false },
            { step: '4', text: '72-hour conformance test runs', done: false },
            { step: '5', text: 'Certificate issued', done: false },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${styles.borderSubtle}` }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.done ? 'rgba(22,135,62,0.1)' : s.active ? 'rgba(74,61,117,0.1)' : styles.cardSurface, border: `1px solid ${s.done ? styles.accentGreen : s.active ? styles.purpleBright : styles.borderGlass}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: s.done ? styles.accentGreen : s.active ? styles.purpleBright : styles.textTertiary, fontFamily: styles.mono, flexShrink: 0 }}>
                {s.done ? '✓' : s.step}
              </div>
              <span style={{ fontSize: '13px', color: s.done ? styles.textPrimary : s.active ? styles.purpleBright : styles.textSecondary, fontWeight: s.active ? 500 : 400 }}>{s.text}</span>
            </div>
          ))}
        </Panel>
      </div>
    );
  }

  // ════ STATE 3b: Approved + agreement accepted — DEPLOY NOW ════════════════
  if (latestApp.state === 'approved' || latestApp.state === 'bounded' || latestApp.state === 'observe') {
    const certNum = userCerts[0]?.certificate_number || latestApp.certificate_number || 'PENDING';
    const keyStr = firstKey?.key || firstKey?.key_prefix ? (firstKey.key || firstKey.key_prefix + '••••••••') : 'PROVISIONING...';
    const hasFullKey = firstKey?.key && firstKey.key.startsWith('sa_live_');
    const deployUrl = `https://api.sentinelauthority.org/api/v1/deploy/${certNum}?key=${hasFullKey ? firstKey.key : 'YOUR_KEY'}`;
    const curlCmd = `curl -sSL '${deployUrl}' | bash`;

    return (
      <div className="space-y-6">
        <SectionHeader label="CERTIFICATION" title="Deploy Now" description="Your application is approved. Deploy the interlock to begin your 72-hour test." />

        {/* Big green approval banner */}
        <Panel glow>
          <div style={{ textAlign: 'center', padding: '24px 16px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `2px solid ${styles.accentGreen}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>✓</div>
            <h2 style={{ fontFamily: styles.serif, fontSize: 'clamp(20px,4vw,26px)', fontWeight: 200, marginBottom: '8px', color: styles.accentGreen }}>Application Approved</h2>
            <p style={{ color: styles.textSecondary, fontSize: '14px' }}>{latestApp.system_name} — {latestApp.organization_name}</p>
          </div>
        </Panel>

        {/* THE ONE COMMAND */}
        <Panel>
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentGreen, marginBottom: '16px' }}>▸ PASTE THIS ON YOUR TARGET SYSTEM</p>

            <div style={{ position: 'relative', background: '#0a0a12', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
              <pre style={{ fontFamily: styles.mono, fontSize: '12px', color: styles.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.7, margin: 0 }}>{curlCmd}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(curlCmd); setCopied(true); setTimeout(() => setCopied(false), 3000); toast.show('Deploy command copied!', 'success'); }}
                style={{ position: 'absolute', top: '12px', right: '12px', padding: '6px 14px', background: copied ? 'rgba(22,135,62,0.15)' : 'rgba(139,92,246,0.1)', border: `1px solid ${copied ? styles.accentGreen : styles.purpleBright}`, color: copied ? styles.accentGreen : styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px 16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '6px' }}>
                <p style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '4px' }}>Certificate</p>
                <p style={{ fontFamily: styles.mono, fontSize: '13px', color: styles.purpleBright }}>{certNum}</p>
              </div>
              <div style={{ padding: '12px 16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, borderRadius: '6px' }}>
                <p style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '4px' }}>API Key</p>
                <p style={{ fontFamily: styles.mono, fontSize: '13px', color: styles.purpleBright, wordBreak: 'break-all' }}>{hasFullKey ? firstKey.key.slice(0,20) + '...' : keyStr}</p>
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: 'rgba(22,135,62,0.04)', border: '1px solid rgba(22,135,62,0.15)', borderRadius: '6px' }}>
              <p style={{ color: styles.accentGreen, fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                <strong>This single command</strong> installs the ENVELO Interlock, configures your boundaries, starts enforcement, and begins your 72-hour CAT-72 test. This page updates automatically.
              </p>
            </div>
          </div>
        </Panel>

        {/* Alternative: download agent file */}
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '4px' }}>Alternative</p>
              <p style={{ color: styles.textSecondary, fontSize: '13px' }}>Download standalone interlock file instead</p>
            </div>
            <button onClick={() => downloadAgent()} style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, fontFamily: styles.mono, fontSize: '11px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={12} /> envelo_interlock.py
            </button>
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
      <div className="space-y-6">
        <SectionHeader label="CERTIFICATION" title="CAT-72 Running" description="Minimum 72-hour conformance assessment in progress. Keep the interlock running." />

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
            <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '12px' }}>Interlock Offline — Action Required</p>
            <p style={{ color: styles.textSecondary, fontSize: '14px', marginBottom: '16px' }}>The ENVELO Interlock hasn't sent a heartbeat in the last 2 minutes. Check that it's running:</p>
            <div style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${styles.borderGlass}`, padding: '10px 14px', borderRadius: '6px', fontFamily: styles.mono, fontSize: '12px', color: styles.textPrimary, marginBottom: '16px' }}>
              <span style={{ color: styles.accentGreen }}>$</span> python envelo_interlock.py
            </div>
            <p style={{ fontSize: '12px', color: styles.textTertiary }}>If the test was interrupted for more than 5 minutes, contact admin — the assessment window may need to be restarted.</p>
          </Panel>
        )}
      </div>
    );
  }

  // ════ STATE 5: Conformant / Certified ════════════════════════════════════
  return (
    <div className="space-y-6">
      <SectionHeader label="CERTIFICATION" title="Active" description="ODDC conformant — boundaries enforced in production" />

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
                <a href={API_BASE + '/api/certificates/' + cert.certificate_number + '/pdf'} target="_blank" rel="noreferrer noopener" style={{ display: 'inline-block', marginTop: '8px', padding: '6px 14px', background: 'rgba(22,135,62,0.08)', border: '1px solid rgba(22,135,62,0.2)', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', textDecoration: 'none', borderRadius: '4px', letterSpacing: '1px' }}>Download Certificate PDF</a>
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
        <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px' }}>Interlock Control</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px' }}>
          <button onClick={() => downloadAgent()} style={{ padding: '14px', background: 'transparent', border: `1px solid ${styles.purpleBright}`, cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}>
            <p style={{ fontWeight: 500, color: styles.purpleBright, marginBottom: '4px', fontSize: '14px' }}>↓ Re-download Interlock</p>
            <p style={{ color: styles.textTertiary, fontSize: '11px', margin: 0 }}>Get the current pre-configured interlock script</p>
          </button>

        </div>

      </Panel>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function EnveloPage() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <EnveloAdminView /> : <EnveloCustomerView />;
}
