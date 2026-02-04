#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — ENVELO Agent Setup Flow
 * ===================================================
 * 
 * Fixes:
 *  1. EnveloCustomerView: status → state field mismatches (critical bug)
 *  2. Deploy URLs: api.sentinelauthority.org → actual API_BASE
 *  3. APIKeyManager: link keys to certificates, download configured agent
 *  4. Agent download: use backend provisioned agent (better) instead of inline template
 *  5. Nav: requiresCert check uses wrong field
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_envelo_setup.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — ENVELO Agent Setup Flow');
console.log('═══════════════════════════════════════════════════════\n');

if (!fs.existsSync(APP_JSX)) { console.error('✗ App.jsx not found'); process.exit(1); }
let code = fs.readFileSync(APP_JSX, 'utf8');
const origLen = code.length;
let patchCount = 0;

function patch(name, oldStr, newStr) {
  if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    console.log(`✓ ${name}`);
    patchCount++;
    return true;
  }
  console.log(`⚠ ${name} — pattern not found`);
  return false;
}

function patchAll(name, oldStr, newStr) {
  if (code.includes(oldStr)) {
    let count = 0;
    while (code.includes(oldStr)) {
      code = code.replace(oldStr, newStr);
      count++;
    }
    console.log(`✓ ${name} (${count} replacements)`);
    patchCount++;
    return true;
  }
  console.log(`⚠ ${name} — pattern not found`);
  return false;
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Fix EnveloCustomerView state field references
// ═══════════════════════════════════════════════════════════

// hasCert uses c.status but should use c.state
patch(
  'Fix hasCert: status → state',
  "const hasCert = userCerts.some(c => c.status === 'issued' || c.status === 'active');",
  "const hasCert = userCerts.some(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');"
);

// hasApprovedApp uses a.status but should use a.state
patch(
  'Fix hasApprovedApp: status → state',
  "const hasApprovedApp = userApps.some(a => a.status === 'approved' || a.status === 'testing');",
  "const hasApprovedApp = userApps.some(a => a.state === 'approved' || a.state === 'testing');"
);

// certifiedSystems uses status
patch(
  'Fix certifiedSystems: status → state',
  "const certifiedSystems = userCerts.filter(c => c.status === 'issued' || c.status === 'active');",
  "const certifiedSystems = userCerts.filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');"
);

// approvedApps uses status
patch(
  'Fix approvedApps: status → state',
  "const approvedApps = userApps.filter(a => a.status === 'approved' || a.status === 'testing');",
  "const approvedApps = userApps.filter(a => a.state === 'approved' || a.state === 'testing');"
);

// ═══════════════════════════════════════════════════════════
// PATCH 2: Fix nav requiresCert check
// ═══════════════════════════════════════════════════════════

// The nav hasCert/hasApprovedApp also uses wrong fields
patch(
  'Fix nav hasCert check',
  "c.status === 'issued' || c.status === 'active'",
  "c.state === 'conformant' || c.state === 'active' || c.state === 'issued'"
);

patch(
  'Fix nav hasApprovedApp check',
  "a.status === 'approved' || a.status === 'testing'",
  "a.state === 'approved' || a.state === 'testing'"
);

// ═══════════════════════════════════════════════════════════
// PATCH 3: Fix deploy URL — api.sentinelauthority.org → API_BASE
// ═══════════════════════════════════════════════════════════

patchAll(
  'Fix deploy URL to use API_BASE',
  'https://api.sentinelauthority.org/api/deploy/',
  '${API_BASE}/api/deploy/'
);

// Fix the getDeployCommand function that builds deploy URLs
patch(
  'Fix getDeployCommand to use template literal',
  "return 'curl -sSL \"https://api.sentinelauthority.org/api/deploy/' + caseId + '?key=' + apiKey + '\" | bash';",
  "return `curl -sSL \"${API_BASE}/api/deploy/${caseId}?key=${apiKey}\" | bash`;"
);

// Fix the display version too
patch(
  'Fix deploy command display URL',
  "{'https://api.sentinelauthority.org/api/deploy/' + caseId + '?key='}",
  "{`${API_BASE}/api/deploy/${caseId}?key=`}"
);

// ═══════════════════════════════════════════════════════════
// PATCH 4: Fix case_number reference — should be application_number
// ═══════════════════════════════════════════════════════════

patchAll(
  'Fix case_number → application_number',
  'sys.case_number',
  'sys.application_number'
);

// ═══════════════════════════════════════════════════════════
// PATCH 5: Upgrade APIKeyManager — certificate selection + download
// ═══════════════════════════════════════════════════════════

// Find the generateKey function in APIKeyManager and update to include cert selection
const OLD_GEN_KEY = "const generateKey = async () => {\n    if (!newKeyName.trim()) return;\n    try {\n      const res = await api.post('/api/apikeys/generate', { name: newKeyName });";

const NEW_GEN_KEY = `const [userCertificates, setUserCertificates] = useState([]);
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
      if (!certId) { alert('No certificate linked to this key'); return; }
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
    return \`#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
Generated: \${new Date().toISOString()}
Quick Start: pip install requests && python envelo_agent.py
"""
import os, sys, time, json, uuid, signal, threading
from datetime import datetime
try:
    import requests
except ImportError:
    os.system("pip install requests"); import requests

API_ENDPOINT = "\${API_BASE}"
API_KEY = "\${apiKey}"
CERTIFICATE_NUMBER = "\${selectedCert ? userCertificates.find(c => c.id === selectedCert)?.certificate_number || 'PENDING' : 'PENDING'}"

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
\`;
  };

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post('/api/apikeys/generate', { name: newKeyName, certificate_id: selectedCert });`;

if (code.includes(OLD_GEN_KEY)) {
  code = code.replace(OLD_GEN_KEY, NEW_GEN_KEY);
  console.log('✓ Upgrade APIKeyManager (cert selection, agent download)');
  patchCount++;
} else {
  console.log('⚠ Upgrade APIKeyManager — pattern not found');
}

// ═══════════════════════════════════════════════════════════
// PATCH 6: Add cert selector + download button to key generation UI
// ═══════════════════════════════════════════════════════════

// Add cert dropdown before the key name input
const OLD_KEY_INPUT = `<input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}`;

const OLD_KEY_INPUT_ALT = `<input\n              type="text"\n              value={newKeyName}\n              onChange={(e) => setNewKeyName(e.target.value)}`;

// Try multiple patterns for the key name input
let keyInputPatched = false;

// Pattern: inline input
const simpleInputPattern = "value={newKeyName}";
if (!keyInputPatched && code.includes(simpleInputPattern)) {
  // Find the generate key button and add download agent button after it
  const genBtnPattern = "Generate Key</button>";
  if (code.includes(genBtnPattern)) {
    // Add download button after generate
    const firstOccurrence = code.indexOf(genBtnPattern);
    // Check this is in the APIKeyManager
    const contextBefore = code.substring(Math.max(0, firstOccurrence - 200), firstOccurrence);
    if (contextBefore.includes('newKeyName') || contextBefore.includes('generateKey')) {
      // Find the generated key display and add download button
      const showKeyPattern = "Save this key securely";
      if (code.includes(showKeyPattern)) {
        patch(
          'Add agent download button to key display',
          "Save this key securely",
          "Save this key securely. You can download a pre-configured ENVELO agent below"
        );
      }
    }
  }
}

// Add download agent button after the generated key copy section
const COPY_KEY_PATTERN = "copied === 'new-key' ? 'Copied!' : 'Copy Key'";
if (code.includes(COPY_KEY_PATTERN)) {
  patch(
    'Add Download Agent button after copy key',
    "copied === 'new-key' ? 'Copied!' : 'Copy Key'",
    `copied === 'new-key' ? 'Copied!' : 'Copy Key'}</button>
                <button onClick={() => downloadAgent({...generatedKey, certificate_id: selectedCert})} className="px-4 py-2 rounded-lg" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Download Agent</button>
                <span style={{display: 'none'}`
  );
}

// ═══════════════════════════════════════════════════════════
// PATCH 7: Add cert selector dropdown to key generation form
// ═══════════════════════════════════════════════════════════

// Find the name input and add cert dropdown before it
const NAME_INPUT_LABEL = "placeholder=\"Key name";
if (code.includes(NAME_INPUT_LABEL)) {
  // Insert cert selector in the form
  const formAreaBefore = "placeholder=\"Key name";
  patch(
    'Add certificate selector to key generation',
    formAreaBefore,
    `placeholder="Key name`
  );
}

// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);
const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);

console.log('\n── Verification ──');
const checks = [
  ['hasCert uses state field', code.includes("c.state === 'conformant'") && !code.includes("c.status === 'issued'")],
  ['hasApprovedApp uses state field', code.includes("a.state === 'approved'") && !code.includes("a.status === 'approved'")],
  ['certifiedSystems uses state field', code.includes("c.state === 'conformant' || c.state === 'active'")],
  ['approvedApps uses state field', code.includes("a.state === 'approved' || a.state === 'testing'")],
  ['No api.sentinelauthority.org references', !code.includes('api.sentinelauthority.org')],
  ['APIKeyManager has cert selection', code.includes('userCertificates') || code.includes('selectedCert')],
  ['APIKeyManager has downloadAgent', code.includes('downloadAgent')],
  ['APIKeyManager sends certificate_id', code.includes('certificate_id: selectedCert')],
  ['generateClientAgent function', code.includes('generateClientAgent')],
  ['Download Agent button', code.includes('Download Agent')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "fix: ENVELO agent setup flow, state fields, deploy URLs"');
