import React, { useState, useEffect } from 'react';
import { Award, AlertTriangle, Clock, ExternalLink, Shield, Download, RefreshCw, BookOpen } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function buildProductionAgent({ apiEndpoint, apiKey, certificateNumber, systemName, organizationName }) {
  const ts = new Date().toISOString();
  return `#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
Enforced Non-Violable Execution-Limit Override

System:       ${systemName}
Certificate:  ${certificateNumber}
Organization: ${organizationName}
Generated:    ${ts}

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
API_ENDPOINT = "${apiEndpoint}"
API_KEY      = "${apiKey}"
CERTIFICATE  = "${certificateNumber}"
SYSTEM_NAME  = "${systemName}"

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
        log.info("Starting ENVELO Agent v2.0.0")
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
                ],
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

        log.info("  Status:      \u2713 RUNNING")
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
                    "block_count": self.stats["block"],
                },
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
            "boundary_evaluations": evals,
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
                    "stats": self.stats,
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
                "stats": {"pass_count": self.stats["pass"], "block_count": self.stats["block"]},
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
    print("${"\u2554" + "\u2550".repeat(59) + "\u2557"}")
    print("${"\u2551"}  ENVELO Agent \u2014 Sentinel Authority                         ${"\u2551"}")
    print("${"\u2551"}  Enforced Non-Violable Execution-Limit Override              ${"\u2551"}")
    print("${"\u255a" + "\u2550".repeat(59) + "\u255d"}")
    print()

    agent.start()
    print()
    print("Agent running. Ctrl+C to stop.")
    print()
    print("\u2500" * 60)
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
    print("\u2500" * 60)
    print()

    try:
        while agent.running:
            time.sleep(1)
    except KeyboardInterrupt:
        agent.shutdown()
`;
}


function AgentSimulator({ apiKey }) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ pass: 0, block: 0 });

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const runSimulation = async () => {
    if (!apiKey) {
      toast.show('Generate an API key first', 'warning');
      return;
    }
    
    setRunning(true);
    setLogs([]);
    setStats({ pass: 0, block: 0 });
    
    const sessionId = Math.random().toString(36).substring(2, 18);
    const certId = 'ODDC-2026-DEMO';
    
    addLog('ENVELO Agent starting...', 'info');
    addLog(`Session: ${sessionId}`, 'info');
    addLog('', 'info');
    
    // Register session
    addLog('Registering session...', 'info');
    try {
      await api.post('/api/envelo/sessions', {
        certificate_id: certId,
        session_id: sessionId,
        started_at: new Date().toISOString(),
        agent_version: '1.0.0-web',
        boundaries: [
          { name: 'speed', min: 0, max: 100 },
          { name: 'temperature', min: -20, max: 50 }
        ]
      }, { headers: { Authorization: `Bearer ${apiKey}` }});
      addLog('✓ Session registered', 'success');
    } catch (e) {
      addLog('✓ Session registered (simulated)', 'success');
    }
    
    addLog('', 'info');
    addLog('Boundaries defined:', 'info');
    addLog('  • speed: 0-100 km/h', 'info');
    addLog('  • temperature: -20 to 50°C', 'info');
    addLog('', 'info');
    
    // Simulate actions
    const testCases = [
      { speed: 50, temperature: 25, shouldPass: true, desc: 'Normal operation' },
      { speed: 80, temperature: 30, shouldPass: true, desc: 'Highway speed' },
      { speed: 150, temperature: 25, shouldPass: false, desc: 'Speed violation' },
      { speed: 60, temperature: 60, shouldPass: false, desc: 'Temperature violation' },
      { speed: 40, temperature: 20, shouldPass: true, desc: 'City driving' },
    ];
    
    const records = [];
    let passCount = 0;
    let blockCount = 0;
    
    for (let i = 0; i < testCases.length; i++) {
      await new Promise(r => setTimeout(r, 800));
      const tc = testCases[i];
      const result = tc.shouldPass ? 'PASS' : 'BLOCK';
      
      if (tc.shouldPass) {
        passCount++;
        addLog(`Action ${i+1}: ${tc.desc}`, 'info');
        addLog(`  speed=${tc.speed}, temp=${tc.temperature}`, 'info');
        addLog(`  ✓ PASSED`, 'success');
      } else {
        blockCount++;
        addLog(`Action ${i+1}: ${tc.desc}`, 'info');
        addLog(`  speed=${tc.speed}, temp=${tc.temperature}`, 'info');
        addLog(`  ✗ BLOCKED - Outside ODD boundaries`, 'error');
      }
      
      setStats({ pass: passCount, block: blockCount });
      
      records.push({
        timestamp: new Date().toISOString(),
        action_id: Math.random().toString(36).substring(2, 10),
        action_type: 'autonomous_action',
        result,
        execution_time_ms: Math.random() * 5,
        parameters: { speed: tc.speed, temperature: tc.temperature },
        boundary_evaluations: [
          { boundary: 'speed', passed: tc.speed <= 100 },
          { boundary: 'temperature', passed: tc.temperature <= 50 }
        ]
      });
    }
    
    addLog('', 'info');
    addLog('Sending telemetry...', 'info');
    
    // Send telemetry
    try {
      await api.post('/api/envelo/telemetry', {
        certificate_id: certId,
        session_id: sessionId,
        records,
        stats: { pass_count: passCount, block_count: blockCount }
      }, { headers: { Authorization: `Bearer ${apiKey}` }});
      addLog(`✓ Sent ${records.length} records`, 'success');
    } catch (e) {
      addLog(`✓ Sent ${records.length} records (simulated)`, 'success');
    }
    
    // End session
    try {
      await api.post(`/api/envelo/sessions/${sessionId}/end`, {
        ended_at: new Date().toISOString(),
        final_stats: { pass_count: passCount, block_count: blockCount }
      }, { headers: { Authorization: `Bearer ${apiKey}` }});
    } catch (e) {}
    
    addLog('', 'info');
    addLog('═══════════════════════════════════════', 'info');
    addLog(`Session complete: ${passCount} passed, ${blockCount} blocked`, 'success');
    addLog('Telemetry visible in dashboard below ↓', 'info');
    
    setRunning(false);
  };

  return (
    <div>
      <div style={{display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px'}}>
        <button
          onClick={runSimulation}
          disabled={running || !apiKey}
          style={{
            padding: '12px 24px',
            background: running ? 'rgba(0,0,0,0.3)' : styles.accentGreen,
            border: 'none',
            borderRadius: '6px',
            color: running ? styles.textTertiary : '#000',
            fontFamily: "Consolas, 'IBM Plex Mono', monospace",
            fontSize: '12px',
            fontWeight: 400,
            cursor: running || !apiKey ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {running ? '⟳ Running...' : '▶ Run Test Simulation'}
        </button>
        {!apiKey && <span style={{color: styles.textTertiary, fontSize: '12px'}}>Generate an API key first</span>}
      </div>
      
      {stats.pass + stats.block > 0 && (
        <div style={{display: 'flex', gap: '24px', marginBottom: '16px'}}>
          <div style={{padding: '12px 20px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(157,140,207,0.3)', borderRadius: '6px'}}>
            <div style={{fontSize: '24px', fontWeight: 500, color: styles.accentGreen}}>{stats.pass}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px'}}>Passed</div>
          </div>
          <div style={{padding: '12px 20px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '6px'}}>
            <div style={{fontSize: '24px', fontWeight: 500, color: '#D65C5C'}}>{stats.block}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px'}}>Blocked</div>
          </div>
        </div>
      )}
      
      {logs.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${styles.borderGlass}`,
          borderRadius: '8px',
          padding: '16px',
          maxHeight: '300px',
          overflowY: 'auto',
          fontFamily: "Consolas, 'IBM Plex Mono', monospace",
          fontSize: '12px'
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{
              color: log.type === 'success' ? styles.accentGreen : log.type === 'error' ? '#D65C5C' : styles.textSecondary,
              marginBottom: '4px'
            }}>
              {log.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// API Key Manager Component


function SessionReport({ session }) {
  if (!session) return null;
  const passRate = session.pass_count + session.block_count > 0 
    ? ((session.pass_count / (session.pass_count + session.block_count)) * 100).toFixed(1)
    : 0;
  return (
    <div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px'}}>
        <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: '#fff'}}>{(session.pass_count || 0) + (session.block_count || 0)}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Total Actions</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(92,214,133,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: '#5CD685'}}>{session.pass_count || 0}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Passed</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(214,92,92,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: '#D65C5C'}}>{session.block_count || 0}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Blocked</div>
        </div>
        <div style={{padding: '16px', background: passRate >= 95 ? 'rgba(92,214,133,0.1)' : 'rgba(214,92,92,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: passRate >= 95 ? '#5CD685' : '#D65C5C'}}>{passRate}%</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Pass Rate</div>
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>SESSION ID</div><div style={{fontFamily: 'monospace', color: '#ccc'}}>{session.session_id}</div></div>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>CERTIFICATE</div><div style={{color: '#ccc'}}>{session.certificate_id || 'N/A'}</div></div>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>STARTED</div><div style={{color: '#ccc'}}>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</div></div>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>STATUS</div><span style={{padding: '4px 12px', borderRadius: '4px', fontSize: '12px', background: session.status === 'active' ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.1)', color: session.status === 'active' ? '#5CD685' : '#888'}}>{session.status?.toUpperCase()}</span></div>
      </div>
    </div>
  );
}


function TelemetryLog({ sessionId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (sessionId) {
      api.get(`/api/envelo/admin/sessions/${sessionId}/telemetry`)
        .then(res => setRecords(res.data.records || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [sessionId]);
  if (loading) return <div style={{color: '#888', padding: '12px'}}>Loading...</div>;
  if (!records.length) return <div style={{color: '#888', padding: '12px'}}>No telemetry records</div>;
  return (
    <div style={{maxHeight: '300px', overflowY: 'auto'}}>
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
        <thead><tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Time</th><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Action</th><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Result</th><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Params</th></tr></thead>
        <tbody>{records.map((r, i) => (<tr key={i} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}><td style={{padding: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#aaa'}}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '-'}</td><td style={{padding: '8px', color: '#fff'}}>{r.action_type}</td><td style={{padding: '8px'}}><span style={{padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 400, background: r.result === 'PASS' ? 'rgba(92,214,133,0.2)' : 'rgba(214,92,92,0.2)', color: r.result === 'PASS' ? '#5CD685' : '#D65C5C'}}>{r.result}</span></td><td style={{padding: '8px', color: '#666', fontFamily: 'monospace', fontSize: '10px'}}>{JSON.stringify(r.parameters || {})}</td></tr>))}</tbody>
      </table>
    </div>
  );
}


function APIKeyManager({ onKeyGenerated }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);
  
  useEffect(() => {
    if (generatedKey?.key) {
      onKeyGenerated?.(generatedKey.key);
    }
  }, [generatedKey]);

  useEffect(() => {
    loadKeys();
  }, []);

  const downloadConfiguredAgent = (apiKey) => {
    const certInfo = userCertificates.find(c => c.id === selectedCert);
    const agentCode = buildProductionAgent({
      apiEndpoint: API_BASE,
      apiKey: apiKey,
      certificateNumber: certInfo?.certificate_number || 'PENDING',
      systemName: certInfo?.system_name || 'My System',
      organizationName: certInfo?.organization_name || '',
    });
    const blob = new Blob([agentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'envelo_agent.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadKeys = async () => {
    try {
      const res = await api.get('/api/apikeys/');
      setKeys(res.data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
    setLoading(false);
  };

  const [userCertificates, setUserCertificates] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);

  useEffect(() => {
    api.get('/api/certificates/').then(res => {
      const certs = (res.data || []).filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
      setUserCertificates(certs);
      if (certs.length > 0) setSelectedCert(certs[0].id);
    }).catch(() => {});
  }, []);

  const downloadAgent = async (keyData) => {
    try {
      const certId = keyData.certificate_id || selectedCert;
      if (!certId) { toast.show('No certificate linked to this key', 'warning'); return; }
      const res = await api.post('/api/apikeys/admin/provision', {
        user_id: parseInt(keyData.user_id || '0'),
        certificate_id: certId,
        name: keyData.name,
        send_email: false,
      });
      if (res.data?.agent_code) {
        const blob = new Blob([res.data.agent_code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'envelo_agent.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // Fallback: generate client-side download
      if (keyData.key) {
        const script = generateClientAgent(keyData.key);
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'envelo_agent.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  const generateClientAgent = (apiKey) => {
    const certInfo = userCertificates.find(c => c.id === selectedCert);
    return buildProductionAgent({
      apiEndpoint: API_BASE,
      apiKey: apiKey,
      certificateNumber: certInfo?.certificate_number || 'PENDING',
      systemName: certInfo?.system_name || 'My System',
      organizationName: certInfo?.organization_name || '',
    });
  };

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post('/api/apikeys/generate', { name: newKeyName, certificate_id: selectedCert });
      setGeneratedKey(res.data);
      setNewKeyName('');
      loadKeys();
    } catch (err) {
      console.error('Failed to generate key:', err);
    }
  };

  const revokeKey = async (keyId) => {
    if (!await confirm({title: 'Revoke Key', message: 'Revoke this API key? This cannot be undone.', danger: true, confirmLabel: 'Revoke'})) return;
    try {
     await api.delete(`/api/apikeys/${keyId}`);
      loadKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyKey = () => {
    if (generatedKey?.key) {
      navigator.clipboard.writeText(generatedKey.key);
    }
  };

  if (loading) return <div style={{color: styles.textTertiary}}>Loading...</div>;

  return (
    <div>
      {generatedKey && (
        <div style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(157,140,207,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px'}}>
          <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentGreen, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>✓ New API Key Generated</div>
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary, wordBreak: 'break-all', marginBottom: '12px'}}>
            {generatedKey.key}
          </div>
          <div style={{display: 'flex', gap: '12px'}}>
            <button onClick={copyKey} style={{padding: '8px 16px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer'}}>Copy to Clipboard</button>
            <button onClick={() => setGeneratedKey(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textSecondary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer'}}>Dismiss</button>
          </div>
          <p style={{color: styles.textTertiary, fontSize: '12px', marginTop: '12px'}}>⚠️ Save this key now. You won't be able to see it again.</p>
          <div style={{marginTop: '16px', padding: '16px', background: 'rgba(91,75,138,0.2)', border: '1px solid rgba(91,75,138,0.3)', borderRadius: '8px'}}>
            <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.purpleBright, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Next Step</div>
            <p style={{color: styles.textSecondary, fontSize: '13px', marginBottom: '12px'}}>Download the ENVELO Agent pre-configured with your credentials:</p>
            <button 
              onClick={() => downloadConfiguredAgent(generatedKey.key)}
              style={{padding: '12px 24px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
            >
              <Download size={16} /> Download ENVELO Agent
            </button>
          </div>
        </div>
      )}

      <div style={{display: 'flex', gap: '12px', marginBottom: '20px'}}>
        <input
          type="text"
          placeholder="Key name (e.g., Production)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          style={{flex: 1, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px'}}
        />
        <button
          onClick={generateKey}
          disabled={!newKeyName.trim()}
          style={{padding: '10px 20px', background: newKeyName.trim() ? styles.purplePrimary : 'rgba(0,0,0,0.2)', border: `1px solid ${newKeyName.trim() ? styles.purpleBright : styles.borderGlass}`, borderRadius: '6px', color: newKeyName.trim() ? '#fff' : styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: newKeyName.trim() ? 'pointer' : 'not-allowed'}}
        >
          Generate Key
        </button>
      </div>

      {keys.length > 0 ? (
        <div>
          <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px'}}>Your API Keys</div>
          {keys.map((k) => (
            <div key={k.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', marginBottom: '8px'}}>
              <div>
                <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary}}>{k.name}</div>
                <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary, marginTop: '4px'}}>{k.key_prefix}••••••••</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                <span style={{fontSize: '11px', color: styles.textTertiary}}>{k.last_used_at ? `Last used: ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
                <button onClick={() => revokeKey(k.id)} style={{padding: '6px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '4px', color: '#ff6464', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer'}}>Revoke</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{color: styles.textTertiary, fontSize: '14px'}}>No API keys yet. Generate one to connect the ENVELO Agent.</p>
      )}
    </div>
  );
}

// Boundary Configurator Component

function BoundaryConfigurator({ certificateNumber, initialBoundaries, onSave }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Parse initial boundaries into editable state
  const parse = (init) => {
    const nb = (init?.numeric_boundaries || []).map(b => ({
      name: b.name || '', parameter: b.parameter || '', min_value: b.min_value ?? '',
      max_value: b.max_value ?? '', hard_limit: b.hard_limit ?? '', unit: b.unit || '', tolerance: b.tolerance ?? ''
    }));
    const gb = (init?.geographic_boundaries || []).map(b => ({
      name: b.name || '', boundary_type: b.boundary_type || 'circle',
      lat: b.center?.lat ?? b.lat ?? '', lon: b.center?.lon ?? b.lon ?? '',
      radius_meters: b.radius_meters ?? '', altitude_min: b.altitude_min ?? '', altitude_max: b.altitude_max ?? ''
    }));
    const tb = (init?.time_boundaries || []).map(b => ({
      name: b.name || '', start_hour: String(b.allowed_hours_start ?? b.start_hour ?? 6),
      end_hour: String(b.allowed_hours_end ?? b.end_hour ?? 22),
      timezone: b.timezone || 'America/Chicago', days: b.allowed_days || b.days || [0,1,2,3,4,5,6]
    }));
    const sb = (init?.state_boundaries || []).map(b => ({
      name: b.name || '', parameter: b.parameter || '',
      allowed_values: Array.isArray(b.allowed_values) ? b.allowed_values.join(', ') : (b.allowed_values || ''),
      forbidden_values: Array.isArray(b.forbidden_values) ? b.forbidden_values.join(', ') : (b.forbidden_values || '')
    }));
    return {
      numeric: nb.length ? nb : [{ name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' }],
      geo: gb.length ? gb : [{ name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' }],
      time: tb.length ? tb : [{ name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] }],
      state: sb.length ? sb : [{ name: '', parameter: '', allowed_values: '', forbidden_values: '' }],
    };
  };

  const [bounds, setBounds] = useState(() => parse(initialBoundaries));

  const update = (type, idx, field, value) => {
    setBounds(prev => {
      const arr = [...prev[type]];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [type]: arr };
    });
    setDirty(true);
  };

  const addRow = (type, template) => {
    setBounds(prev => ({ ...prev, [type]: [...prev[type], { ...template }] }));
    setDirty(true);
  };

  const removeRow = (type, idx) => {
    setBounds(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== idx) }));
    setDirty(true);
  };

  const assemble = () => ({
    numeric_boundaries: bounds.numeric.filter(b => b.name && b.parameter).map(b => ({
      name: b.name, parameter: b.parameter,
      min_value: b.min_value !== '' ? parseFloat(b.min_value) : null,
      max_value: b.max_value !== '' ? parseFloat(b.max_value) : null,
      hard_limit: b.hard_limit !== '' ? parseFloat(b.hard_limit) : null,
      unit: b.unit || null, tolerance: b.tolerance !== '' ? parseFloat(b.tolerance) : 0,
    })),
    geographic_boundaries: bounds.geo.filter(b => b.name && b.lat && b.lon).map(b => ({
      name: b.name, boundary_type: b.boundary_type,
      center: { lat: parseFloat(b.lat), lon: parseFloat(b.lon) },
      radius_meters: b.radius_meters ? parseFloat(b.radius_meters) : 1000,
      altitude_min: b.altitude_min !== '' ? parseFloat(b.altitude_min) : null,
      altitude_max: b.altitude_max !== '' ? parseFloat(b.altitude_max) : null,
    })),
    time_boundaries: bounds.time.filter(b => b.name).map(b => ({
      name: b.name, allowed_hours_start: parseInt(b.start_hour),
      allowed_hours_end: parseInt(b.end_hour), allowed_days: b.days, timezone: b.timezone,
    })),
    state_boundaries: bounds.state.filter(b => b.name && b.parameter).map(b => ({
      name: b.name, parameter: b.parameter,
      allowed_values: b.allowed_values ? b.allowed_values.split(',').map(s => s.trim()).filter(Boolean) : [],
      forbidden_values: b.forbidden_values ? b.forbidden_values.split(',').map(s => s.trim()).filter(Boolean) : [],
    })),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const envelope = assemble();
      await onSave(envelope);
      setDirty(false);
    } catch (e) {
      toast.show('Save failed: ' + e.message, 'error');
    }
    setSaving(false);
  };

  const inputStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', outline: 'none' };
  const sectionTitle = (text) => <div style={{ fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', marginTop: '20px' }}>{text}</div>;
  const helpText = (text) => <p style={{ color: styles.textTertiary, fontSize: '11px', marginBottom: '8px' }}>{text}</p>;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const totalCount = bounds.numeric.filter(b => b.name).length + bounds.geo.filter(b => b.name).length + bounds.time.filter(b => b.name).length + bounds.state.filter(b => b.name).length;

  return (
    <div>
      {/* Summary Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px 16px', background: dirty ? 'rgba(214,160,92,0.08)' : 'rgba(92,214,133,0.05)', border: '1px solid ' + (dirty ? 'rgba(214,160,92,0.2)' : 'rgba(92,214,133,0.15)'), borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span style={{ fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary }}>{totalCount} boundaries defined</span>
          {dirty && <span style={{ fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.accentAmber, letterSpacing: '1px', textTransform: 'uppercase' }}>● Unsaved changes</span>}
        </div>
        <button onClick={handleSave} disabled={saving || !dirty} style={{ padding: '8px 24px', borderRadius: '8px', background: dirty ? styles.purplePrimary : 'rgba(255,255,255,0.05)', border: '1px solid ' + (dirty ? styles.purpleBright : styles.borderGlass), color: dirty ? '#fff' : styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : dirty ? 'Save Boundaries' : 'Saved ✓'}
        </button>
      </div>

      {/* ── NUMERIC ── */}
      {sectionTitle('Numeric Boundaries')}
      {helpText('Measurable limits: speed, temperature, altitude, weight, pressure, distance.')}
      {bounds.numeric.map((b, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid ' + styles.borderGlass, borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={b.name} onChange={e => update('numeric', i, 'name', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Name (e.g., Speed Limit)" />
            <input type="text" value={b.parameter} onChange={e => update('numeric', i, 'parameter', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Parameter (e.g., speed)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            <input type="number" value={b.min_value} onChange={e => update('numeric', i, 'min_value', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Min" />
            <input type="number" value={b.max_value} onChange={e => update('numeric', i, 'max_value', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Max" />
            <input type="number" value={b.hard_limit} onChange={e => update('numeric', i, 'hard_limit', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Hard limit" />
            <input type="text" value={b.unit} onChange={e => update('numeric', i, 'unit', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Unit" />
            <div style={{ display: 'flex', gap: '4px' }}>
              <input type="number" value={b.tolerance} onChange={e => update('numeric', i, 'tolerance', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle, flex: 1 }} placeholder="±Tol" />
              {bounds.numeric.length > 1 && <button onClick={() => removeRow('numeric', i)} style={{ background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '0 8px', fontSize: '14px' }}>×</button>}
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => addRow('numeric', { name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' })} style={{ width: '100%', marginBottom: '4px', background: 'transparent', border: '1px dashed ' + styles.borderGlass, borderRadius: '6px', padding: '8px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px' }}>+ Add Numeric Boundary</button>

      {/* ── GEOGRAPHIC ── */}
      {sectionTitle('Geographic Boundaries')}
      {helpText('Physical operating zone — center coordinates + radius.')}
      {bounds.geo.map((b, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid ' + styles.borderGlass, borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={b.name} onChange={e => update('geo', i, 'name', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Name (e.g., Operating Zone)" />
            <select value={b.boundary_type} onChange={e => update('geo', i, 'boundary_type', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }}>
              <option value="circle">Radius from Point</option>
              <option value="polygon">Polygon (advanced)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <input type="number" step="any" value={b.lat} onChange={e => update('geo', i, 'lat', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Latitude" />
            <input type="number" step="any" value={b.lon} onChange={e => update('geo', i, 'lon', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Longitude" />
            <input type="number" value={b.radius_meters} onChange={e => update('geo', i, 'radius_meters', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Radius (m)" />
            <div style={{ display: 'flex', gap: '4px' }}>
              <input type="number" value={b.altitude_max} onChange={e => update('geo', i, 'altitude_max', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle, flex: 1 }} placeholder="Alt max (m)" />
              {bounds.geo.length > 1 && <button onClick={() => removeRow('geo', i)} style={{ background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '0 8px', fontSize: '14px' }}>×</button>}
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => addRow('geo', { name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' })} style={{ width: '100%', marginBottom: '4px', background: 'transparent', border: '1px dashed ' + styles.borderGlass, borderRadius: '6px', padding: '8px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px' }}>+ Add Geographic Boundary</button>

      {/* ── TIME ── */}
      {sectionTitle('Time Boundaries')}
      {helpText('Allowed operating hours and days of week.')}
      {bounds.time.map((b, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid ' + styles.borderGlass, borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={b.name} onChange={e => update('time', i, 'name', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Name" />
            <input type="number" min="0" max="23" value={b.start_hour} onChange={e => update('time', i, 'start_hour', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Start hour" />
            <input type="number" min="0" max="23" value={b.end_hour} onChange={e => update('time', i, 'end_hour', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="End hour" />
            <select value={b.timezone} onChange={e => update('time', i, 'timezone', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }}>
              <option value="America/New_York">Eastern</option>
              <option value="America/Chicago">Central</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Los_Angeles">Pacific</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">UK</option>
              <option value="Europe/Berlin">CET</option>
              <option value="Asia/Tokyo">JST</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: styles.textTertiary, fontSize: '11px', marginRight: '4px' }}>Days:</span>
            {dayNames.map((d, di) => (
              <label key={di} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '11px', color: b.days.includes(di) ? styles.purpleBright : styles.textTertiary }}>
                <input type="checkbox" checked={b.days.includes(di)} onChange={e => {
                  const newDays = e.target.checked ? [...b.days, di].sort() : b.days.filter(x => x !== di);
                  update('time', i, 'days', newDays);
                }} style={{ accentColor: styles.purpleBright, width: '12px', height: '12px' }} />{d}
              </label>
            ))}
            {bounds.time.length > 1 && <button onClick={() => removeRow('time', i)} style={{ marginLeft: 'auto', background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '2px 8px', fontSize: '14px' }}>×</button>}
          </div>
        </div>
      ))}
      <button onClick={() => addRow('time', { name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] })} style={{ width: '100%', marginBottom: '4px', background: 'transparent', border: '1px dashed ' + styles.borderGlass, borderRadius: '6px', padding: '8px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px' }}>+ Add Time Boundary</button>

      {/* ── STATE ── */}
      {sectionTitle('State Boundaries')}
      {helpText('Allowed/forbidden operational states and modes.')}
      {bounds.state.map((b, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid ' + styles.borderGlass, borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={b.name} onChange={e => update('state', i, 'name', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Name (e.g., Mode Check)" />
            <input type="text" value={b.parameter} onChange={e => update('state', i, 'parameter', e.target.value)} className="px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Parameter (e.g., mode)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <input type="text" value={b.allowed_values} onChange={e => update('state', i, 'allowed_values', e.target.value)} className="w-full px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Allowed (comma-sep)" />
              <span style={{ fontSize: '9px', color: styles.textTertiary }}>e.g., autonomous, semi-autonomous</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ flex: 1 }}>
                <input type="text" value={b.forbidden_values} onChange={e => update('state', i, 'forbidden_values', e.target.value)} className="w-full px-3 py-2 rounded-lg" style={{ ...inputStyle }} placeholder="Forbidden (comma-sep)" />
                <span style={{ fontSize: '9px', color: styles.textTertiary }}>e.g., manual_override, degraded</span>
              </div>
              {bounds.state.length > 1 && <button onClick={() => removeRow('state', i)} style={{ background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '0 8px', fontSize: '14px', alignSelf: 'flex-start' }}>×</button>}
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => addRow('state', { name: '', parameter: '', allowed_values: '', forbidden_values: '' })} style={{ width: '100%', marginBottom: '4px', background: 'transparent', border: '1px dashed ' + styles.borderGlass, borderRadius: '6px', padding: '8px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px' }}>+ Add State Boundary</button>
    </div>
  );
}


function EnveloAdminView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [applications, setApplications] = useState([]);
  const [appTotal, setAppTotal] = useState(0);
  const [stateCounts, setStateCounts] = useState({});
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedCert, setSelectedCert] = useState(null);
  const [activeTab, setActiveTab] = useState('monitoring'); // monitoring, customers, configure
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, sessionsRes, certsRes, appsRes] = await Promise.all([
          api.get('/api/envelo/stats').catch(() => ({ data: null })),
          api.get('/api/envelo/admin/sessions').catch(() => ({ data: { sessions: [] } })),
          api.get('/api/certificates/').catch(() => ({ data: [] })),
          api.get('/api/applications/').catch(() => ({ data: [] }))
        ]);
        setStats(statsRes.data);
        setSessions(sessionsRes.data.sessions || []);
        setCertificates(certsRes.data || []);
        setApplications(appsRes.data.applications || appsRes.data || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}><RefreshCw size={24} style={{animation: 'spin 1s linear infinite'}} /></div>;
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const totalViolations = sessions.reduce((acc, s) => acc + (s.block_count || 0), 0);
  const activeCerts = certificates.filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const pendingApps = applications.filter(a => a.state === 'approved' || a.state === 'testing');

  const downloadAgentForCert = (cert) => {
    const agentCode = buildProductionAgent({
      apiEndpoint: API_BASE,
      apiKey: 'YOUR_API_KEY',
      certificateNumber: cert.certificate_number,
      systemName: cert.system_name || 'Unknown',
      organizationName: cert.organization_name || 'Unknown',
    });
    const blob = new Blob([agentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `envelo_agent_${cert.certificate_number}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionHeader 
        label="⬡ Admin Console" 
        title="ENVELO Management" 
        description="Monitor, configure, and manage all customer systems"
      />

      {/* Tab Navigation */}
      <div style={{display: 'flex', gap: '8px', borderBottom: `1px solid ${styles.borderGlass}`, paddingBottom: '16px'}}>
        {[
          { id: 'monitoring', label: 'Live Monitoring' },
          { id: 'customers', label: 'Customer Systems' },
          { id: 'configure', label: 'Configure Boundaries' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? styles.purplePrimary : 'transparent',
              border: `1px solid ${activeTab === tab.id ? styles.purpleBright : styles.borderGlass}`,
              borderRadius: '8px',
              color: activeTab === tab.id ? '#fff' : styles.textSecondary,
              fontFamily: "Consolas, 'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Panel>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Active Sessions</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.accentGreen}}>{activeSessions.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Attested Systems</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.purpleBright}}>{activeCerts.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>CAT-72 In Progress</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.accentAmber}}>{pendingApps.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Violations (Total)</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: totalViolations > 0 ? styles.accentRed : styles.accentGreen}}>{totalViolations}</p>
        </Panel>
      </div>

      {/* Tab Content */}
      {activeTab === 'monitoring' && (
        <>
          {/* Active Sessions Table */}
          <Panel glow>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Active Sessions</p>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(92,214,133,0.15)', borderRadius: '20px'}}>
                <div style={{width: '6px', height: '6px', borderRadius: '50%', background: styles.accentGreen, boxShadow: `0 0 8px ${styles.accentGreen}`, animation: 'pulse 2s infinite'}}></div>
                <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.accentGreen, textTransform: 'uppercase'}}>Live</span>
              </div>
            </div>
            
            {sessions.length > 0 ? (
              <div style={{overflowX: 'auto'}}>
                <table className="w-full">
                  <thead>
                    <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Certificate</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Status</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Pass</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Block</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={i} className="sexy-row" style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                        <td style={{padding: '16px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{s.certificate_id || 'N/A'}</td>
                        <td style={{padding: '16px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <div style={{width: '8px', height: '8px', borderRadius: '50%', background: s.status === 'active' ? styles.accentGreen : styles.textTertiary, boxShadow: s.status === 'active' ? `0 0 8px ${styles.accentGreen}` : 'none'}}></div>
                            <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: s.status === 'active' ? styles.accentGreen : styles.textTertiary}}>{s.status}</span>
                          </div>
                        </td>
                        <td style={{padding: '16px', color: styles.accentGreen}}>{s.pass_count || 0}</td>
                        <td style={{padding: '16px', color: (s.block_count || 0) > 0 ? styles.accentRed : styles.textTertiary}}>{s.block_count || 0}</td>
                        <td style={{padding: '16px'}}>
                          <button onClick={() => setSelectedSession(s)} style={{padding: '6px 12px', background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: styles.purpleBright, fontSize: '11px', cursor: 'pointer'}}>View Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{color: styles.textTertiary, textAlign: 'center', padding: '40px'}}>No sessions found.</p>
            )}
          </Panel>

          {/* Session Detail Modal */}
          {selectedSession && (
            <Panel accent="purple">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Session: {selectedSession.session_id?.substring(0, 16)}...</p>
                <div style={{display: 'flex', gap: '12px'}}>
                  <button onClick={async () => {
                    try {
                      const res = await api.get(`/api/envelo/admin/sessions/${selectedSession.id}/report`, {responseType: 'blob'});
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `CAT72-Report-${selectedSession.session_id}.pdf`;
                      link.click();
                    } catch(e) { toast.show('Failed: ' + e.message, 'error'); }
                  }} style={{padding: '8px 16px', background: styles.purplePrimary, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer'}}>Download Report</button>
                  <button onClick={() => setSelectedSession(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textTertiary, cursor: 'pointer', fontSize: '11px'}}>✕ Close</button>
                </div>
              </div>
              <SessionReport session={selectedSession} />
              <div style={{marginTop: '20px'}}>
                <TelemetryLog sessionId={selectedSession.id} />
              </div>
            </Panel>
          )}
        </>
      )}

      {activeTab === 'customers' && (
        <>
          {/* Attested Systems */}
          <Panel>
            <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px'}}>Attested Systems</p>
            {activeCerts.length > 0 ? (
              <div className="space-y-4">
                {activeCerts.map(cert => (
                  <div key={cert.id} style={{padding: '20px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '12px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
                      <div>
                        <h3 style={{fontSize: '16px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 4px 0'}}>{cert.system_name || 'Unnamed'}</h3>
                        <p style={{fontSize: '13px', color: styles.textSecondary, marginBottom: '8px'}}>{cert.organization_name}</p>
                        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{cert.certificate_number}</p>
                      </div>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <button onClick={() => { setSelectedCert(cert); setActiveTab('configure'); }} style={{padding: '8px 16px', background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: styles.purpleBright, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={12} /> Configure
                        </button>
                        <button onClick={async () => {
                          if (!await confirm({title: 'Provision Agent', message: `Provision and send ENVELO agent to ${cert.organization_name}?`})) return;
                          try {
                            const res = await api.post('/api/apikeys/admin/provision', null, { params: { user_id: cert.applicant_id, certificate_id: cert.id, send_email: true }});
                            if (res.data.agent_code) {
                              const blob = new Blob([res.data.agent_code], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'envelo_agent.py';
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                            toast.show('Agent provisioned successfully', 'success');
                          } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
                        }} style={{padding: '8px 16px', background: styles.accentGreen, border: `1px solid ${styles.accentGreen}`, borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <ExternalLink size={12} /> Provision & Send
                        </button>
                        <button onClick={() => downloadAgentForCert(cert)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <Download size={12} /> Download Only
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: styles.textTertiary, textAlign: 'center', padding: '24px'}}>No attested systems yet.</p>
            )}
          </Panel>

          {/* Pending CAT-72 */}
          {pendingApps.length > 0 && (
            <Panel accent="amber">
              <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '20px'}}>CAT-72 Testing In Progress</p>
              <div className="space-y-4">
                {pendingApps.map(app => (
                  <div key={app.id} style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${styles.borderGlass}`}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <p style={{fontSize: '14px', color: styles.textPrimary, marginBottom: '4px'}}>{app.system_name}</p>
                        <p style={{fontSize: '12px', color: styles.textSecondary}}>{app.organization_name}</p>
                      </div>
                      <span style={{padding: '4px 12px', background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', borderRadius: '20px', fontSize: '10px', color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", textTransform: 'uppercase'}}>
                        {app.cat72_started ? 'In Progress' : 'Ready'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* API Key Management */}
          <Panel>
            <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>API Key Management</p>
            <APIKeyManager />
          </Panel>
        </>
      )}

      {activeTab === 'configure' && (
        <>
          {selectedCert ? (
            <Panel glow>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px'}}>
                <div>
                  <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Configuring Boundaries</p>
                  <h2 style={{fontSize: '24px', fontWeight: 200, margin: '0 0 4px 0'}}>{selectedCert.system_name}</h2>
                  <p style={{color: styles.textSecondary}}>{selectedCert.organization_name} • {selectedCert.certificate_number}</p>
                </div>
                <button onClick={() => setSelectedCert(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textTertiary, cursor: 'pointer', fontSize: '11px'}}>← Back to List</button>
              </div>
              
              <BoundaryConfigurator 
                certificateNumber={selectedCert.certificate_number}
                initialBoundaries={selectedCert.envelope_definition || {}}
                onSave={async (boundaries) => {
                  try {
                    await api.put(`/api/envelo/boundaries/config/boundaries?certificate_number=${selectedCert.certificate_number}`, boundaries);
                    toast.show('Boundaries saved','success');
                  } catch (e) {
                    toast.show('Failed to save: ' + e.message, 'error');
                  }
                }}
              />
            </Panel>
          ) : (
            <Panel>
              <div style={{textAlign: 'center', padding: '60px 20px'}}>
                <Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
                <h2 style={{fontSize: '20px', fontWeight: 200, marginBottom: '8px'}}>Select a System to Configure</h2>
                <p style={{color: styles.textSecondary, marginBottom: '24px'}}>Choose a system from the Customer Systems tab to configure its boundaries.</p>
                <button onClick={() => setActiveTab('customers')} style={{padding: '12px 24px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '8px', color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>View Customer Systems</button>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function EnveloCustomerView() {
  const [deployKey, setDeployKey] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [userCerts, setUserCerts] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [existingKeys, setExistingKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showUninstall, setShowUninstall] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [certsRes, appsRes, sessionsRes, keysRes] = await Promise.all([
          api.get('/api/certificates/').catch(() => ({ data: [] })),
          api.get('/api/applications/').catch(() => ({ data: [] })),
          api.get('/api/envelo/sessions').catch(() => ({ data: { sessions: [] } })),
          api.get('/api/apikeys/').catch(() => ({ data: [] }))
        ]);
        setUserCerts(certsRes.data || []);
        setUserApps(appsRes.data || []);
        setSessions(sessionsRes.data.sessions || []);
        setExistingKeys(keysRes.data || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const certifiedSystems = (Array.isArray(userCerts) ? userCerts : []).filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const approvedApps = (Array.isArray(userApps) ? userApps : []).filter(a => a.state === 'approved' || a.state === 'testing');
  const allSystems = [...approvedApps, ...certifiedSystems];
  const canAccessAgent = certifiedSystems.length > 0 || approvedApps.length > 0;
  const activeSessions = sessions.filter(s => s.status === 'active');
  const isDeployed = activeSessions.length > 0;

  const generateDeployCommand = async () => {
    setGenerating(true);
    try {
      const sys = allSystems[0];
      const certId = sys?.certificate_id || null;
      const name = 'deploy-' + new Date().toISOString().split('T')[0];
      const res = await api.post('/api/apikeys/generate', { name, certificate_id: certId });
      if (res.data?.key) {
        setDeployKey(res.data.key);
      }
    } catch (err) {
      toast.show('Failed to generate key: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setGenerating(false);
  };

  const getCaseId = () => {
    const sys = allSystems[0];
    return sys?.certificate_number || sys?.application_number || 'PENDING';
  };

  const getDeployCommand = () => {
    if (!deployKey) return null;
    return 'curl -sSL "' + API_BASE + '/api/deploy/' + getCaseId() + '?key=' + deployKey + '" | bash';
  };

  const copyCommand = () => {
    const cmd = getDeployCommand();
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (loading) {
    return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}><RefreshCw size={24} style={{animation: 'spin 1s linear infinite'}} /></div>;
  }

  // ── STATE 1: Not approved yet ──────────────────────────
  if (!canAccessAgent) {
    return (
      <div className="space-y-6">
        <SectionHeader label="ENVELO Agent" title="Application Required" />
        <Panel>
          <div style={{textAlign: 'center', padding: '60px 20px'}}>
            <Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
            <h2 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: '24px', fontWeight: 200, marginBottom: '12px'}}>Pending Approval</h2>
            <p style={{color: styles.textSecondary, maxWidth: '400px', margin: '0 auto'}}>Your application is being reviewed. Once approved, you'll deploy the ENVELO agent with a single command.</p>
          </div>
        </Panel>
      </div>
    );
  }

  // ── STATE 3: Agent running — monitoring view ───────────
  if (isDeployed) {
    return (
      <div className="space-y-6">
        <SectionHeader label="ENVELO Agent" title="Active" description="Your agent is connected and enforcing boundaries" />

        {certifiedSystems.map(cert => {
          const session = sessions.find(s => s.certificate_id === cert.certificate_number);
          const isOnline = session && session.status === 'active';
          return (
            <Panel key={cert.id} glow={isOnline}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
                <div>
                  <h3 style={{fontSize: '20px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 8px 0'}}>{cert.system_name || 'System'}</h3>
                  <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: styles.purpleBright, marginBottom: '4px'}}>{cert.certificate_number}</p>
                  <p style={{fontSize: '12px', color: styles.textTertiary}}>
                    {'Attested ' + (cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : 'N/A')}
                  </p>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(92,214,133,0.15)', borderRadius: '20px'}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.accentGreen, boxShadow: '0 0 8px ' + styles.accentGreen, animation: 'pulse 2s infinite'}}></div>
                  <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: styles.accentGreen}}>ENVELO Active</span>
                </div>
              </div>
              {session && (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid ' + styles.borderGlass}}>
                  <div style={{textAlign: 'center'}}>
                    <p style={{fontSize: '28px', fontWeight: 200, color: styles.accentGreen}}>{session.uptime || '0h'}</p>
                    <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Uptime</p>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <p style={{fontSize: '28px', fontWeight: 200, color: styles.purpleBright}}>{session.record_count || 0}</p>
                    <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Telemetry</p>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <p style={{fontSize: '28px', fontWeight: 200, color: (session.violations || 0) > 0 ? styles.accentRed : styles.accentGreen}}>{session.violations || 0}</p>
                    <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Violations</p>
                  </div>
                </div>
              )}
            </Panel>
          );
        })}

        {approvedApps.filter(a => !certifiedSystems.some(c => c.application_id === a.id)).map(app => {
          const session = activeSessions[0];
          return (
            <Panel key={app.id} glow>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <h3 style={{fontSize: '20px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 4px 0'}}>{app.system_name}</h3>
                  <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', color: styles.accentAmber}}>{app.application_number} — CAT-72 Testing</p>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(92,214,133,0.15)', borderRadius: '20px'}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.accentGreen, boxShadow: '0 0 8px ' + styles.accentGreen, animation: 'pulse 2s infinite'}}></div>
                  <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: styles.accentGreen}}>ENVELO Active</span>
                </div>
              </div>
              {session && (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid ' + styles.borderGlass}}>
                  <div style={{textAlign: 'center'}}>
                    <p style={{fontSize: '28px', fontWeight: 200, color: styles.accentGreen}}>{session.pass_count || 0}</p>
                    <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Passed</p>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <p style={{fontSize: '28px', fontWeight: 200, color: (session.block_count || 0) > 0 ? styles.accentRed : styles.accentGreen}}>{session.block_count || 0}</p>
                    <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Blocked</p>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <p style={{fontSize: '28px', fontWeight: 200, color: styles.purpleBright}}>{(session.pass_count || 0) + (session.block_count || 0)}</p>
                    <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Total</p>
                  </div>
                </div>
              )}
            </Panel>
          );
        })}

        <Panel>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Agent Control</p>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
            <button
              onClick={async () => {
                if (!confirm('Stop the ENVELO agent? It will shut down within 30 seconds.')) return;
                try {
                  const keys = await api.get('/api/apikeys/');
                  for (const k of (keys.data || [])) {
                    await api.delete(`/api/apikeys/${k.id}`);
                  }
                  toast.show('Agent will stop within 30 seconds', 'success');
                  setTimeout(() => window.location.reload(), 3000);
                } catch (e) {
                  toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error');
                }
              }}
              style={{padding: '16px', background: 'rgba(214,92,92,0.08)', border: '1px solid rgba(214,92,92,0.2)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left'}}
            >
              <p style={{fontWeight: 500, color: styles.accentRed, marginBottom: '4px', fontSize: '14px'}}>⏹ Stop Agent</p>
              <p style={{color: styles.textTertiary, fontSize: '11px', margin: 0}}>Revokes API key. Agent shuts down within 30s.</p>
            </button>

            <button
              onClick={async () => {
                if (!confirm('Redeploy? This revokes your current key and generates a new deploy command.')) return;
                try {
                  const keys = await api.get('/api/apikeys/');
                  for (const k of (keys.data || [])) {
                    await api.delete(`/api/apikeys/${k.id}`);
                  }
                  toast.show('Old agent stopping. Generating new deploy...', 'success');
                  setTimeout(() => window.location.reload(), 2000);
                } catch (e) {
                  toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error');
                }
              }}
              style={{padding: '16px', background: 'rgba(91,75,138,0.08)', border: '1px solid rgba(91,75,138,0.2)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left'}}
            >
              <p style={{fontWeight: 500, color: styles.purpleBright, marginBottom: '4px', fontSize: '14px'}}>↻ Redeploy</p>
              <p style={{color: styles.textTertiary, fontSize: '11px', margin: 0}}>Stop current agent and get a fresh deploy command.</p>
            </button>

            <button
              onClick={async () => {
                if (!confirm('Uninstall ENVELO agent? This revokes all keys and shows cleanup instructions.')) return;
                try {
                  const keys = await api.get('/api/apikeys/');
                  for (const k of (keys.data || [])) {
                    await api.delete(`/api/apikeys/${k.id}`);
                  }
                  toast.show('Keys revoked. Run the cleanup command below.', 'success');
                  setShowUninstall(true);
                } catch (e) {
                  toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error');
                }
              }}
              style={{padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, borderRadius: '8px', cursor: 'pointer', textAlign: 'left'}}
            >
              <p style={{fontWeight: 500, color: styles.textSecondary, marginBottom: '4px', fontSize: '14px'}}>⊘ Uninstall</p>
              <p style={{color: styles.textTertiary, fontSize: '11px', margin: 0}}>Remove agent, config, and auto-restart service.</p>
            </button>
          </div>

          {showUninstall && (
            <div style={{marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid ' + styles.borderGlass}}>
              <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '8px'}}>Paste in terminal to fully remove</p>
              <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.8'}}>
                {'# Stop agent\nkill $(cat ~/.envelo/envelo.pid) 2>/dev/null\n\n# Remove systemd service (Linux)\nsystemctl --user stop envelo.service 2>/dev/null\nsystemctl --user disable envelo.service 2>/dev/null\nrm -f ~/.config/systemd/user/envelo.service\n\n# Remove launchd (macOS)\nlaunchctl unload ~/Library/LaunchAgents/org.sentinelauthority.envelo.plist 2>/dev/null\nrm -f ~/Library/LaunchAgents/org.sentinelauthority.envelo.plist\n\n# Remove files\nrm -rf ~/.envelo\n\necho "✓ ENVELO uninstalled"'}
              </div>
            </div>
          )}

          <div style={{marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px'}}>
            <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px'}}>Logs</p>
            <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px'}}>cat ~/.envelo/envelo.log</div>
          </div>
        </Panel>
      </div>
    );
  }

  // ── STATE 2: Approved, needs to deploy ─────────────────
  const sysName = allSystems[0]?.system_name || 'Your System';
  const cmd = getDeployCommand();

  return (
    <div className="space-y-6">
      <SectionHeader label="ENVELO Agent" title="Deploy" description={'Ready to deploy ' + sysName} />

      <Panel glow>
        <div style={{textAlign: 'center', padding: '40px 20px'}}>
          {!deployKey ? (
            <>
              <Shield fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} size={56} style={{color: styles.purpleBright, margin: '0 auto 20px'}} />
              <h2 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: '28px', fontWeight: 200, marginBottom: '12px', color: styles.textPrimary}}>One Command. That's It.</h2>
              <p style={{color: styles.textSecondary, maxWidth: '440px', margin: '0 auto 32px', lineHeight: '1.6'}}>
                Generate your deploy command. Paste it in a terminal. The ENVELO agent installs, configures your approved boundaries, starts running, and auto-restarts on reboot.
              </p>
              <button
                onClick={generateDeployCommand}
                disabled={generating}
                style={{
                  padding: '16px 48px',
                  background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
                  border: '1px solid ' + styles.purpleBright,
                  borderRadius: '12px',
                  color: '#fff',
                  fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                  fontSize: '14px',
                  letterSpacing: '1px',
                  cursor: generating ? 'wait' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                  boxShadow: '0 4px 24px rgba(91,75,138,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {generating ? '⟳ Generating...' : '⬡ Generate Deploy Command'}
              </button>
            </>
          ) : (
            <>
              <div style={{marginBottom: '24px'}}>
                <div style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(92,214,133,0.1)', borderRadius: '20px', marginBottom: '16px'}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.accentGreen}}></div>
                  <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentGreen, textTransform: 'uppercase', letterSpacing: '1px'}}>Ready to Deploy</span>
                </div>
                <h2 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: '24px', fontWeight: 200, color: styles.textPrimary, margin: '0 0 8px 0'}}>Paste in your terminal</h2>
              </div>

              {/* Terminal */}
              <div style={{maxWidth: '700px', margin: '0 auto', textAlign: 'left'}}>
                <div style={{background: 'rgba(0,0,0,0.5)', borderRadius: '12px', border: '1px solid ' + styles.purpleBright, overflow: 'hidden'}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid ' + styles.borderGlass}}>
                    <div style={{display: 'flex', gap: '6px'}}>
                      <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57'}}></div>
                      <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e'}}></div>
                      <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#28c840'}}></div>
                    </div>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>Terminal</span>
                    <button
                      onClick={copyCommand}
                      style={{
                        padding: '4px 16px',
                        background: copied ? 'rgba(92,214,133,0.2)' : styles.purplePrimary,
                        border: '1px solid ' + (copied ? styles.accentGreen : styles.purpleBright),
                        borderRadius: '6px',
                        color: copied ? styles.accentGreen : '#fff',
                        fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                        fontSize: '11px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div style={{padding: '20px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '13px', lineHeight: '1.6', overflowX: 'auto', whiteSpace: 'nowrap'}}>
                    <span style={{color: styles.accentGreen}}>$</span>{' '}
                    <span style={{color: styles.textPrimary}}>{cmd}</span>
                  </div>
                </div>

                <div style={{marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid ' + styles.borderGlass}}>
                  <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>What happens</p>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center'}}>
                    {[
                      { icon: '↓', label: 'Installs' },
                      { icon: '⚙', label: 'Configures' },
                      { icon: '▶', label: 'Starts' },
                      { icon: '↻', label: 'Auto-restarts' },
                    ].map((s, i) => (
                      <div key={i}>
                        <div style={{fontSize: '18px', marginBottom: '4px'}}>{s.icon}</div>
                        <div style={{fontSize: '11px', color: styles.textSecondary}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <p style={{color: styles.accentAmber, fontSize: '12px', marginTop: '16px', textAlign: 'center'}}>
                  ⚠ This command contains your API key. Don't share it.
                </p>

                <div style={{textAlign: 'center', marginTop: '16px'}}>
                  <button onClick={() => setDeployKey(null)} style={{background: 'transparent', border: 'none', color: styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer', textDecoration: 'underline'}}>
                    Generate new key
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

// Main App
// Monitoring Dashboard

function EnveloPage() {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <EnveloAdminView />;
  }
  return <EnveloCustomerView />;
}

// Admin View - System-wide monitoring and management
// Admin View - Full management and monitoring

export default EnveloPage;

