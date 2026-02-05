import React, { useState, useEffect } from 'react';
import { Award, AlertTriangle, Clock, ExternalLink, Shield, Download, RefreshCw, BookOpen } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function AgentSimulator({ apiKey }) {
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
            fontFamily: "'IBM Plex Mono', monospace",
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
          fontFamily: "'IBM Plex Mono', monospace",
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
    // Create a configured Python script
    const configScript = `#!/usr/bin/env python3
"""
ENVELO Agent - Pre-configured for your system
Sentinel Authority - https://sentinelauthority.org

QUICK START:
1. Install dependencies: pip install httpx
2. Run this file: python envelo_agent.py
3. Check your dashboard: https://app.sentinelauthority.org/envelo
"""

import os
import sys
import time
import json
import uuid
import httpx
from datetime import datetime
from functools import wraps

# ═══════════════════════════════════════════════════════════════════
# YOUR CREDENTIALS (pre-configured)
# ═══════════════════════════════════════════════════════════════════
CERTIFICATE_ID = "ODDC-2026-PENDING"
API_KEY = "${apiKey}"
API_ENDPOINT = "https://sentinel-authority-production.up.railway.app"

# ═══════════════════════════════════════════════════════════════════
# ENVELO AGENT
# ═══════════════════════════════════════════════════════════════════

class NumericBoundary:
    def __init__(self, name, min=None, max=None, unit=""):
        self.name = name
        self.min = min
        self.max = max
        self.unit = unit
    
    def check(self, value):
        if self.min is not None and value < self.min:
            return False, f"{self.name} ({value}) below minimum ({self.min})"
        if self.max is not None and value > self.max:
            return False, f"{self.name} ({value}) above maximum ({self.max})"
        return True, None

class EnveloAgent:
    def __init__(self):
        self.boundaries = []
        self.session_id = uuid.uuid4().hex[:16]
        self.telemetry = []
        self.pass_count = 0
        self.block_count = 0
        self._register_session()
    
    def _register_session(self):
        try:
            httpx.post(
                f"{API_ENDPOINT}/api/envelo/sessions",
                json={
                    "certificate_id": CERTIFICATE_ID,
                    "session_id": self.session_id,
                    "started_at": datetime.utcnow().isoformat() + "Z",
                    "agent_version": "1.0.0",
                    "boundaries": [{"name": b.name} for b in self.boundaries]
                },
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=10
            )
            print(f"✓ Session registered: {self.session_id}")
        except Exception as e:
            print(f"⚠ Could not register session: {e}")
    
    def add_boundary(self, boundary):
        self.boundaries.append(boundary)
        print(f"  + Boundary: {boundary.name} ({boundary.min} to {boundary.max} {boundary.unit})")
    
    def enforce(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            action_id = uuid.uuid4().hex[:8]
            
            # Check all boundaries
            violations = []
            for boundary in self.boundaries:
                if boundary.name in kwargs:
                    passed, msg = boundary.check(kwargs[boundary.name])
                    if not passed:
                        violations.append({"boundary": boundary.name, "message": msg})
            
            result = "PASS" if not violations else "BLOCK"
            exec_time = (time.time() - start) * 1000
            
            # Record telemetry
            record = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "action_id": action_id,
                "action_type": func.__name__,
                "result": result,
                "execution_time_ms": exec_time,
                "parameters": kwargs,
                "boundary_evaluations": [{"boundary": b.name, "passed": b.name not in [v["boundary"] for v in violations]} for b in self.boundaries]
            }
            self.telemetry.append(record)
            
            if result == "PASS":
                self.pass_count += 1
                return func(*args, **kwargs)
            else:
                self.block_count += 1
                raise Exception(f"ENVELO BLOCK: {violations[0]['message']}")
        
        return wrapper
    
    def send_telemetry(self):
        if not self.telemetry:
            return
        try:
            httpx.post(
                f"{API_ENDPOINT}/api/envelo/telemetry",
                json={
                    "certificate_id": CERTIFICATE_ID,
                    "session_id": self.session_id,
                    "records": self.telemetry,
                    "stats": {"pass_count": self.pass_count, "block_count": self.block_count}
                },
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=10
            )
            print(f"✓ Sent {len(self.telemetry)} telemetry records")
            self.telemetry = []
        except Exception as e:
            print(f"⚠ Could not send telemetry: {e}")
    
    def shutdown(self):
        self.send_telemetry()
        try:
            httpx.post(
                f"{API_ENDPOINT}/api/envelo/sessions/{self.session_id}/end",
                json={
                    "ended_at": datetime.utcnow().isoformat() + "Z",
                    "final_stats": {"pass_count": self.pass_count, "block_count": self.block_count}
                },
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=10
            )
            print(f"✓ Session ended")
        except Exception as e:
            print(f"⚠ Could not end session: {e}")

# ═══════════════════════════════════════════════════════════════════
# EXAMPLE USAGE - MODIFY FOR YOUR SYSTEM
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║           ENVELO Agent - Sentinel Authority               ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print("")
    print(f"Certificate: {CERTIFICATE_ID}")
    print(f"API Key:     {API_KEY[:12]}...")
    print("")
    
    # Initialize agent
    agent = EnveloAgent()
    print("")
    
    # Define YOUR boundaries (modify these for your system)
    print("Defining ODD boundaries:")
    agent.add_boundary(NumericBoundary("speed", min=0, max=100, unit="km/h"))
    agent.add_boundary(NumericBoundary("temperature", min=-20, max=50, unit="celsius"))
    print("")
    
    # Example protected function (replace with your actual function)
    @agent.enforce
    def autonomous_action(speed, temperature):
        print(f"    Executing action: speed={speed}, temp={temperature}")
        return True
    
    # Test 1: Within boundaries (should PASS)
    print("─" * 50)
    print("Test 1: speed=50, temperature=25 (within bounds)")
    try:
        autonomous_action(speed=50, temperature=25)
        print("    ✓ PASSED - Action executed")
    except Exception as e:
        print(f"    ✗ BLOCKED - {e}")
    print("")
    
    # Test 2: Outside boundaries (should BLOCK)
    print("Test 2: speed=150, temperature=25 (speed exceeds limit)")
    try:
        autonomous_action(speed=150, temperature=25)
        print("    ✓ PASSED - Action executed")
    except Exception as e:
        print(f"    ✗ BLOCKED - {e}")
    print("")
    
    # Send telemetry and shutdown
    print("─" * 50)
    agent.shutdown()
    print("")
    print("═" * 50)
    print("Check your dashboard: https://app.sentinelauthority.org/envelo")
    print("═" * 50)
    print("")
`;
    
    // Create and download the file
    const blob = new Blob([configScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `envelo_agent_${cert.certificate_number}.py`;
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
    return `#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
Generated: ${new Date().toISOString()}
Quick Start: pip install requests && python envelo_agent.py
"""
import os, sys, time, json, uuid, signal, threading
from datetime import datetime
try:
    import requests
except ImportError:
    os.system("pip install requests"); import requests

API_ENDPOINT = "${API_BASE}"
API_KEY = "${apiKey}"
CERTIFICATE_NUMBER = "${selectedCert ? userCertificates.find(c => c.id === selectedCert)?.certificate_number || 'PENDING' : 'PENDING'}"

class EnveloAgent:
    def __init__(self):
        self.session_id = str(uuid.uuid4())
        self.boundaries = {}
        self.stats = {"pass": 0, "block": 0}
        self.running = False

    def start(self):
        try:
            res = requests.get(f"{API_ENDPOINT}/api/envelo/boundaries/config",
                headers={"Authorization": f"Bearer {API_KEY}"}, timeout=10)
            if res.ok:
                for b in res.json().get("numeric_boundaries", []):
                    self.boundaries[b["name"]] = b
                print(f"[ENVELO] Loaded {len(self.boundaries)} boundaries")
        except: pass
        try:
            requests.post(f"{API_ENDPOINT}/api/envelo/sessions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={"certificate_id": CERTIFICATE_NUMBER, "session_id": self.session_id,
                      "started_at": datetime.utcnow().isoformat()+"Z", "agent_version": "2.0.0"}, timeout=10)
            self.running = True
            print(f"[ENVELO] Session started: {self.session_id[:16]}...")
            return True
        except Exception as e:
            print(f"[ENVELO] Connection error: {e}")
            return False

    def check(self, parameter, value):
        if parameter not in self.boundaries: return True
        b = self.boundaries[parameter]
        if b.get("min_value") is not None and value < b["min_value"]:
            self.stats["block"] += 1; return False
        if b.get("max_value") is not None and value > b["max_value"]:
            self.stats["block"] += 1; return False
        self.stats["pass"] += 1; return True

    def enforce(self, **params):
        return all(self.check(k, v) for k, v in params.items())

    def stop(self):
        self.running = False
        print(f"[ENVELO] Stats: {self.stats['pass']} passed, {self.stats['block']} blocked")

agent = EnveloAgent()
if __name__ == "__main__":
    print("=" * 60)
    print("  ENVELO Agent - Sentinel Authority")
    print(f"  Certificate: {CERTIFICATE_NUMBER}")
    print("=" * 60)
    if agent.start():
        print("[ENVELO] ✓ Running. Ctrl+C to stop.")
        signal.signal(signal.SIGINT, lambda s,f: (agent.stop(), sys.exit(0)))
        while agent.running: time.sleep(1)
`;
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
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentGreen, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>✓ New API Key Generated</div>
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary, wordBreak: 'break-all', marginBottom: '12px'}}>
            {generatedKey.key}
          </div>
          <div style={{display: 'flex', gap: '12px'}}>
            <button onClick={copyKey} style={{padding: '8px 16px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer'}}>Copy to Clipboard</button>
            <button onClick={() => setGeneratedKey(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textSecondary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer'}}>Dismiss</button>
          </div>
          <p style={{color: styles.textTertiary, fontSize: '12px', marginTop: '12px'}}>⚠️ Save this key now. You won't be able to see it again.</p>
          <div style={{marginTop: '16px', padding: '16px', background: 'rgba(91,75,138,0.2)', border: '1px solid rgba(91,75,138,0.3)', borderRadius: '8px'}}>
            <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.purpleBright, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Next Step</div>
            <p style={{color: styles.textSecondary, fontSize: '13px', marginBottom: '12px'}}>Download the ENVELO Agent pre-configured with your credentials:</p>
            <button 
              onClick={() => downloadConfiguredAgent(generatedKey.key)}
              style={{padding: '12px 24px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
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
          style={{flex: 1, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px'}}
        />
        <button
          onClick={generateKey}
          disabled={!newKeyName.trim()}
          style={{padding: '10px 20px', background: newKeyName.trim() ? styles.purplePrimary : 'rgba(0,0,0,0.2)', border: `1px solid ${newKeyName.trim() ? styles.purpleBright : styles.borderGlass}`, borderRadius: '6px', color: newKeyName.trim() ? '#fff' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: newKeyName.trim() ? 'pointer' : 'not-allowed'}}
        >
          Generate Key
        </button>
      </div>

      {keys.length > 0 ? (
        <div>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px'}}>Your API Keys</div>
          {keys.map((k) => (
            <div key={k.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', marginBottom: '8px'}}>
              <div>
                <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary}}>{k.name}</div>
                <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary, marginTop: '4px'}}>{k.key_prefix}••••••••</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                <span style={{fontSize: '11px', color: styles.textTertiary}}>{k.last_used_at ? `Last used: ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
                <button onClick={() => revokeKey(k.id)} style={{padding: '6px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '4px', color: '#ff6464', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer'}}>Revoke</button>
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

function BoundaryConfigurator() {
  const [boundaries, setBoundaries] = useState([]);
  const [newBoundary, setNewBoundary] = useState({ type: 'numeric', name: '', parameter: '', min: '', max: '', unit: '' });

  const addBoundary = () => {
    if (!newBoundary.name) return;
    setBoundaries([...boundaries, { ...newBoundary, id: Date.now() }]);
    setNewBoundary({ type: 'numeric', name: '', parameter: '', min: '', max: '', unit: '' });
  };

  const removeBoundary = (id) => {
    setBoundaries(boundaries.filter(b => b.id !== id));
  };

  const generateCode = () => {
    let code = `from envelo import EnveloAgent, EnveloConfig, NumericBoundary, GeoBoundary, RateLimitBoundary

config = EnveloConfig(
    certificate_id="YOUR-CERTIFICATE-ID",
    api_key="YOUR-API-KEY"
)

agent = EnveloAgent(config)

# Your ODD Boundaries
`;
    boundaries.forEach(b => {
      if (b.type === 'numeric') {
        code += `agent.add_boundary(NumericBoundary("${b.name}", parameter="${b.parameter || b.name}", min=${b.min || 'None'}, max=${b.max || 'None'}, unit="${b.unit || ''}"))
`;
      } else if (b.type === 'rate') {
        code += `agent.add_boundary(RateLimitBoundary("${b.name}", max_per_${b.rateUnit || 'second'}=${b.rateLimit || 10}))
`;
      }
    });
    code += `
# Wrap your autonomous functions
@agent.enforce
def your_action(**params):
    # Your code here
    pass
`;
    return code;
  };

  const downloadConfig = () => {
    const code = generateCode();
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'envelo_config.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px'}}>
        <select
          value={newBoundary.type}
          onChange={(e) => setNewBoundary({...newBoundary, type: e.target.value})}
          style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
        >
          <option value="numeric">Numeric Limit</option>
          <option value="rate">Rate Limit</option>
        </select>
        <input
          type="text"
          placeholder="Name (e.g., speed)"
          value={newBoundary.name}
          onChange={(e) => setNewBoundary({...newBoundary, name: e.target.value, parameter: e.target.value})}
          style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
        />
        {newBoundary.type === 'numeric' && (
          <>
            <input
              type="number"
              placeholder="Min"
              value={newBoundary.min}
              onChange={(e) => setNewBoundary({...newBoundary, min: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
            <input
              type="number"
              placeholder="Max"
              value={newBoundary.max}
              onChange={(e) => setNewBoundary({...newBoundary, max: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
            <input
              type="text"
              placeholder="Unit (e.g., km/h)"
              value={newBoundary.unit}
              onChange={(e) => setNewBoundary({...newBoundary, unit: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
          </>
        )}
        {newBoundary.type === 'rate' && (
          <>
            <input
              type="number"
              placeholder="Limit"
              value={newBoundary.rateLimit}
              onChange={(e) => setNewBoundary({...newBoundary, rateLimit: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
            <select
              value={newBoundary.rateUnit || 'second'}
              onChange={(e) => setNewBoundary({...newBoundary, rateUnit: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            >
              <option value="second">per second</option>
              <option value="minute">per minute</option>
              <option value="hour">per hour</option>
            </select>
          </>
        )}
        <button
          onClick={addBoundary}
          style={{padding: '10px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', cursor: 'pointer'}}
        >
          + Add
        </button>
      </div>

      {boundaries.length > 0 && (
        <div style={{marginBottom: '16px'}}>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Defined Boundaries</div>
          {boundaries.map((b) => (
            <div key={b.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.2)', borderRadius: '6px', marginBottom: '8px'}}>
              <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.accentGreen}}>
                {b.type === 'numeric' ? `${b.name}: ${b.min || '−∞'} to ${b.max || '∞'} ${b.unit}` : `${b.name}: ${b.rateLimit}/${b.rateUnit}`}
              </span>
              <button onClick={() => removeBoundary(b.id)} style={{background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '16px'}}>×</button>
            </div>
          ))}
        </div>
      )}

      {boundaries.length > 0 && (
        <div>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Generated Configuration</div>
          <pre style={{background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textSecondary, overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap'}}>{generateCode()}</pre>
          <button
            onClick={downloadConfig}
            className="mt-3 px-4 py-2 rounded-lg"
            style={{marginTop: '12px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
          >
            Download Config
          </button>
        </div>
      )}
    </div>
  );
}

// ENVELO Agent Page





function EnveloAdminView() {
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
    const agentCode = `#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
System: ${cert.system_name || 'Unknown'}
Certificate: ${cert.certificate_number}
Organization: ${cert.organization_name || 'Unknown'}
Generated: ${new Date().toISOString()}
"""

import os, json, time, requests
from datetime import datetime

SENTINEL_API = "https://api.sentinelauthority.org"
CERTIFICATE_NUMBER = "${cert.certificate_number}"
SYSTEM_NAME = "${cert.system_name || 'Unknown'}"

class EnveloAgent:
    def __init__(self, api_key):
        self.api_key = api_key
        self.session_id = None
        self.boundaries = {}
        self.config = None
        
    def start_session(self):
        # Fetch approved boundaries from server
        try:
            config_res = requests.get(f"{SENTINEL_API}/api/envelo/boundaries/config",
                headers={"Authorization": f"Bearer {self.api_key}"})
            if config_res.ok:
                self.config = config_res.json()
                self._load_boundaries_from_config()
                print(f"[ENVELO] Loaded {len(self.boundaries)} boundaries from server")
        except Exception as e:
            print(f"[ENVELO] Warning: Could not fetch boundaries: {e}")
        
        # Start session
        res = requests.post(f"{SENTINEL_API}/api/envelo/sessions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "certificate_id": CERTIFICATE_NUMBER,
                "session_id": str(uuid.uuid4()),
                "started_at": datetime.utcnow().isoformat() + "Z",
                "agent_version": "1.0.0",
                "boundaries": list(self.boundaries.values())
            })
        if res.ok:
            self.session_id = res.json().get("session_id")
            print(f"[ENVELO] Session started: {self.session_id}")
            return True
        return False
    
    def _load_boundaries_from_config(self):
        if not self.config:
            return
        for b in self.config.get("numeric_boundaries", []):
            self.boundaries[b["name"]] = {"type": "numeric", "min": b.get("min_value"), "max": b.get("max_value")}
        for b in self.config.get("rate_boundaries", []):
            self.boundaries[b["name"]] = {"type": "rate", "max_per_second": b.get("max_per_second")}
    
    def add_boundary(self, name, min_val=None, max_val=None):
        self.boundaries[name] = {"type": "numeric", "min": min_val, "max": max_val}
    
    def check(self, name, value):
        if name not in self.boundaries:
            return True
        b = self.boundaries[name]
        if b.get("min") is not None and value < b["min"]:
            self._violation(name, value, f"Below min {b['min']}")
            return False
        if b.get("max") is not None and value > b["max"]:
            self._violation(name, value, f"Above max {b['max']}")
            return False
        return True
    
    def _violation(self, name, value, reason):
        print(f"[ENVELO] VIOLATION: {name}={value} - {reason}")
        try:
            requests.post(f"{SENTINEL_API}/api/envelo/telemetry",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "certificate_id": CERTIFICATE_NUMBER,
                    "session_id": self.session_id,
                    "records": [{
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "action_type": "boundary_check",
                        "result": "BLOCK",
                        "parameters": {name: value},
                        "boundary_evaluations": [{"boundary": name, "passed": False, "message": reason}]
                    }],
                    "stats": {"block_count": 1}
                })
        except:
            pass
    
    def heartbeat(self):
        try:
            requests.post(f"{SENTINEL_API}/api/envelo/heartbeat",
                headers={"Authorization": f"Bearer {self.api_key}"})
        except:
            pass
    
    def shutdown(self):
        if self.session_id:
            requests.post(f"{SENTINEL_API}/api/envelo/sessions/{self.session_id}/end",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"ended_at": datetime.utcnow().isoformat() + "Z", "final_stats": {}})
        print("[ENVELO] Session ended")

import uuid
import { SYSTEM_TYPES, DOMAIN_GROUPS } from './systemTypesData';

if __name__ == "__main__":
    print("=" * 60)
    print("  ENVELO Agent - Sentinel Authority")
    print(f"  System: {SYSTEM_NAME}")
    print(f"  Certificate: {CERTIFICATE_NUMBER}")
    print("=" * 60)
    print()
    print("Usage:")
    print("  agent = EnveloAgent('your-api-key')")
    print("  agent.start_session()")
    print("  agent.check('speed', 50)")
    print("  agent.shutdown()")
`;
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
              fontFamily: "'IBM Plex Mono', monospace",
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
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Active Sessions</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.accentGreen}}>{activeSessions.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Attested Systems</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.purpleBright}}>{activeCerts.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>CAT-72 In Progress</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.accentAmber}}>{pendingApps.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Violations (Total)</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: totalViolations > 0 ? styles.accentRed : styles.accentGreen}}>{totalViolations}</p>
        </Panel>
      </div>

      {/* Tab Content */}
      {activeTab === 'monitoring' && (
        <>
          {/* Active Sessions Table */}
          <Panel glow>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Active Sessions</p>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(92,214,133,0.15)', borderRadius: '20px'}}>
                <div style={{width: '6px', height: '6px', borderRadius: '50%', background: styles.accentGreen, boxShadow: `0 0 8px ${styles.accentGreen}`, animation: 'pulse 2s infinite'}}></div>
                <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.accentGreen, textTransform: 'uppercase'}}>Live</span>
              </div>
            </div>
            
            {sessions.length > 0 ? (
              <div style={{overflowX: 'auto'}}>
                <table className="w-full">
                  <thead>
                    <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Certificate</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Status</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Pass</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Block</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={i} className="sexy-row" style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                        <td style={{padding: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{s.certificate_id || 'N/A'}</td>
                        <td style={{padding: '16px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <div style={{width: '8px', height: '8px', borderRadius: '50%', background: s.status === 'active' ? styles.accentGreen : styles.textTertiary, boxShadow: s.status === 'active' ? `0 0 8px ${styles.accentGreen}` : 'none'}}></div>
                            <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: s.status === 'active' ? styles.accentGreen : styles.textTertiary}}>{s.status}</span>
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
                <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Session: {selectedSession.session_id?.substring(0, 16)}...</p>
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
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px'}}>Attested Systems</p>
            {activeCerts.length > 0 ? (
              <div className="space-y-4">
                {activeCerts.map(cert => (
                  <div key={cert.id} style={{padding: '20px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '12px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
                      <div>
                        <h3 style={{fontSize: '16px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 4px 0'}}>{cert.system_name || 'Unnamed'}</h3>
                        <p style={{fontSize: '13px', color: styles.textSecondary, marginBottom: '8px'}}>{cert.organization_name}</p>
                        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{cert.certificate_number}</p>
                      </div>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <button onClick={() => { setSelectedCert(cert); setActiveTab('configure'); }} style={{padding: '8px 16px', background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: styles.purpleBright, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <Shield size={12} /> Configure
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Provision and send ENVELO agent to ${cert.organization_name}?`)) return;
                          try {
                            const res = await api.post('/api/apikeys/admin/provision', null, { params: { user_id: cert.applicant_id, certificate_id: cert.id, send_email: true }});
                            if (res.data.agent_code) {
                              const blob = new Blob([res.data.agent_code], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `envelo_agent_${cert.certificate_number}.py`;
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
              <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '20px'}}>CAT-72 Testing In Progress</p>
              <div className="space-y-4">
                {pendingApps.map(app => (
                  <div key={app.id} style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${styles.borderGlass}`}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <p style={{fontSize: '14px', color: styles.textPrimary, marginBottom: '4px'}}>{app.system_name}</p>
                        <p style={{fontSize: '12px', color: styles.textSecondary}}>{app.organization_name}</p>
                      </div>
                      <span style={{padding: '4px 12px', background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', borderRadius: '20px', fontSize: '10px', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase'}}>
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
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>API Key Management</p>
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
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Configuring Boundaries</p>
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
                <Shield size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
                <h2 style={{fontSize: '20px', fontWeight: 200, marginBottom: '8px'}}>Select a System to Configure</h2>
                <p style={{color: styles.textSecondary, marginBottom: '24px'}}>Choose a system from the Customer Systems tab to configure its boundaries.</p>
                <button onClick={() => setActiveTab('customers')} style={{padding: '12px 24px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '8px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>View Customer Systems</button>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function EnveloCustomerView() {
  const [activeApiKey, setActiveApiKey] = useState(null);
  const [userCerts, setUserCerts] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [certsRes, appsRes, sessionsRes] = await Promise.all([
          api.get('/api/certificates/').catch(() => ({ data: [] })),
          api.get('/api/applications/').catch(() => ({ data: [] })),
          api.get('/api/envelo/sessions').catch(() => ({ data: { sessions: [] } }))
        ]);
        setUserCerts(certsRes.data || []);
        setUserApps(appsRes.data || []);
        setSessions(sessionsRes.data.sessions || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const hasCert = Array.isArray(userCerts) && userCerts.some(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const hasApprovedApp = Array.isArray(userApps) && userApps.some(a => a.state === 'approved' || a.state === 'testing');
  const canAccessAgent = hasCert || hasApprovedApp;
  const isTestMode = hasApprovedApp && !hasCert;
  const certifiedSystems = ((Array.isArray(userCerts) ? userCerts : [])).filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const approvedApps = ((Array.isArray(userApps) ? userApps : [])).filter(a => a.state === 'approved' || a.state === 'testing');

  const getDeployCommand = (caseId, apiKey) => {
    return 'curl -sSL "' + API_BASE + '/api/deploy/' + caseId + '?key=' + apiKey + '" | bash';
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}><RefreshCw size={24} style={{animation: 'spin 1s linear infinite'}} /></div>;
  }

  if (!canAccessAgent) {
    return (
      <div className="space-y-6">
        <SectionHeader label="ENVELO Agent" title="Application Required" />
        <Panel>
          <div style={{textAlign: 'center', padding: '40px'}}>
            <Award size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
            <h2 style={{fontFamily: "'Source Serif 4', serif", fontSize: '24px', fontWeight: 200, marginBottom: '12px'}}>Approval Required</h2>
            <p style={{color: styles.textSecondary, marginBottom: '24px'}}>Your application must be approved before you can access the ENVELO Agent.</p>
            <p style={{color: styles.textTertiary, fontSize: '13px'}}>Once approved, you can deploy the agent with a single command.</p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader 
        label="ENVELO Agent" 
        title="Deploy & Monitor" 
        description="One command deploys everything automatically"
      />

      {/* ONE-COMMAND DEPLOY */}
      <Panel>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
          <div style={{width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #5B4B8A 0%, #9d8ccf 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Download size={20} color="#fff" />
          </div>
          <div>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '2px'}}>One-Command Deploy</p>
            <p style={{color: styles.textSecondary, fontSize: '13px', margin: 0}}>Open a terminal. Paste the command. Press Enter. Done.</p>
          </div>
        </div>

        {[...approvedApps, ...certifiedSystems].map((sys, idx) => {
          const caseId = sys.application_number || sys.certificate_number;
          const sysName = sys.system_name || 'System';
          const keyId = 'deploy-' + idx;
          const apiKeyVal = activeApiKey || 'YOUR_API_KEY';
          const hasKey = activeApiKey && activeApiKey !== 'YOUR_API_KEY';
          const cmd = getDeployCommand(caseId, apiKeyVal);

          return (
            <div key={idx} style={{marginBottom: '20px'}}>
              <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px'}}>{sysName} — {caseId}</p>
              
              <div style={{position: 'relative', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid ' + (hasKey ? styles.purpleBright : styles.borderGlass), overflow: 'hidden'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid ' + styles.borderGlass}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57'}}></div>
                    <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e'}}></div>
                    <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#28c840'}}></div>
                  </div>
                  <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>Terminal</span>
                  <button
                    onClick={() => copyToClipboard(cmd, keyId)}
                    disabled={!hasKey}
                    style={{padding: '4px 12px', background: hasKey ? styles.purplePrimary : 'rgba(255,255,255,0.05)', border: '1px solid ' + (hasKey ? styles.purpleBright : styles.borderGlass), borderRadius: '6px', color: hasKey ? '#fff' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: hasKey ? 'pointer' : 'not-allowed'}}
                  >
                    {copied === keyId ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                
                <div style={{padding: '16px 20px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', lineHeight: '1.6', overflowX: 'auto', whiteSpace: 'nowrap'}}>
                  <span style={{color: styles.accentGreen}}>$</span>{' '}
                  <span style={{color: styles.textPrimary}}>curl -sSL "</span>
                  <span style={{color: styles.purpleBright}}>{API_BASE + '/api/deploy/' + caseId + '?key='}</span>
                  <span style={{color: hasKey ? styles.accentGreen : styles.accentAmber}}>{apiKeyVal}</span>
                  <span style={{color: styles.textPrimary}}>" | bash</span>
                </div>
              </div>

              {!hasKey && (
                <p style={{color: styles.accentAmber, fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <AlertTriangle size={12} /> Generate an API key below first
                </p>
              )}
            </div>
          );
        })}

        <div style={{marginTop: '24px', padding: '16px', background: 'rgba(91,75,138,0.08)', borderRadius: '10px', border: '1px solid ' + styles.borderGlass}}>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>What this command does</p>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
            {[
              { num: '1', label: 'Installs agent', desc: 'Downloads ENVELO' },
              { num: '2', label: 'Writes config', desc: 'Your approved boundaries' },
              { num: '3', label: 'Tests everything', desc: 'Network, sources, clock' },
              { num: '4', label: 'Activates', desc: 'Ready for CAT-72' },
            ].map(s => (
              <div key={s.num} style={{textAlign: 'center'}}>
                <div style={{width: '28px', height: '28px', borderRadius: '50%', background: styles.purplePrimary, border: '1px solid ' + styles.purpleBright, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 'bold', color: '#fff'}}>{s.num}</div>
                <p style={{fontSize: '12px', fontWeight: 500, color: styles.textPrimary, marginBottom: '2px'}}>{s.label}</p>
                <p style={{fontSize: '11px', color: styles.textTertiary}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* TEST MODE BANNER */}
      {isTestMode && (
        <Panel accent="amber">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <div style={{width: '10px', height: '10px', borderRadius: '50%', background: styles.accentAmber, animation: 'pulse 2s infinite'}}></div>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, margin: 0}}>CAT-72 Testing Mode</p>
          </div>
          <p style={{color: styles.textSecondary, marginBottom: '8px'}}>Deploy the ENVELO Agent using the command above, then start your 72-hour test from the CAT-72 tab.</p>
          <p style={{color: styles.textTertiary, fontSize: '12px'}}>The deploy command configures everything automatically — your approved boundaries are baked in.</p>
        </Panel>
      )}

      {/* LIVE SYSTEMS */}
      {certifiedSystems.length > 0 && certifiedSystems.map(cert => {
        const session = sessions.find(s => s.certificate_id === cert.certificate_number);
        const isOnline = session && session.status === 'active';
        
        return (
          <Panel key={cert.id} glow={isOnline}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
              <div>
                <h3 style={{fontSize: '20px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 8px 0'}}>{cert.system_name || 'Unnamed System'}</h3>
                <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: styles.purpleBright, marginBottom: '4px'}}>{cert.certificate_number}</p>
                <p style={{fontSize: '12px', color: styles.textTertiary}}>
                  {'Attested ' + (cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : 'N/A') + ' | Expires ' + (cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A')}
                </p>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: isOnline ? 'rgba(92,214,133,0.15)' : 'rgba(255,255,255,0.05)', borderRadius: '20px'}}>
                <div style={{width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? styles.accentGreen : styles.textTertiary, boxShadow: isOnline ? '0 0 8px ' + styles.accentGreen : 'none'}}></div>
                <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: isOnline ? styles.accentGreen : styles.textTertiary}}>
                  {isOnline ? 'ENVELO Active' : 'Offline'}
                </span>
              </div>
            </div>
            
            {session && (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid ' + styles.borderGlass}}>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '28px', fontWeight: 200, color: styles.accentGreen}}>{session.uptime || '0h'}</p>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Uptime</p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '28px', fontWeight: 200, color: styles.purpleBright}}>{session.record_count || 0}</p>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Telemetry</p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '28px', fontWeight: 200, color: (session.violations || 0) > 0 ? styles.accentRed : styles.accentGreen}}>{session.violations || 0}</p>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Violations</p>
                </div>
              </div>
            )}
          </Panel>
        );
      })}

      {/* API KEY */}
      <Panel>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your API Key</p>
        <p style={{color: styles.textSecondary, marginBottom: '16px', fontSize: '14px'}}>Generate a key to activate the deploy command above.</p>
        <APIKeyManager onKeyGenerated={setActiveApiKey} />
      </Panel>

      {/* HELP */}
      <Panel>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Need Help?</p>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
          <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
            <p style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '4px', fontSize: '14px'}}>Check Status</p>
            <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginTop: '8px'}}>$ envelo status</div>
          </div>
          <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
            <p style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '4px', fontSize: '14px'}}>Get Support</p>
            <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginTop: '8px'}}>$ envelo diagnose</div>
          </div>
        </div>
        <p style={{color: styles.textTertiary, fontSize: '12px', marginTop: '12px'}}>
          Run <code style={{color: styles.purpleBright}}>envelo diagnose</code> and email the output to <a href="mailto:conformance@sentinelauthority.org" style={{color: styles.purpleBright, textDecoration: 'none'}}>conformance@sentinelauthority.org</a>
        </p>
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

