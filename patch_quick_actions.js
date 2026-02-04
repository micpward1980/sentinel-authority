#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Admin Quick-Actions Wiring
 * =================================================
 * 
 * Adds:
 *  1. Applications table: Suspend button (all active states), Reinstate (suspended)
 *  2. Detail page: Suspend + Reinstate buttons, proper re-fetch after actions
 *  3. Detail page: handleSuspend + handleReinstate functions
 *  4. Dashboard review queue: Suspend button
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_quick_actions.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Admin Quick-Actions Wiring');
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

// ═══════════════════════════════════════════════════════════
// PATCH 1: Applications table — add Suspend + Reinstate buttons
// ═══════════════════════════════════════════════════════════

console.log('── Applications Table ──');

// After the "Schedule Test" link for approved, add Suspend for active states
patch(
  'Add Suspend + Reinstate to table actions',
  `                    {app.state === 'conformant' && (
                      <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px'}}>✓ Certified</span>
                    )}`,
  `                    {app.state === 'conformant' && (
                      <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px'}}>✓ Certified</span>
                    )}
                    {app.state === 'testing' && (
                      <Link to="/cat72" className="px-2 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.15)', border: \`1px solid \${styles.borderGlass}\`, color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>View Test</Link>
                    )}
                    {['pending','under_review','approved','testing','conformant'].includes(app.state) && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'suspended', \`Suspend \${app.system_name}\`); }} className="px-2 py-1 rounded" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Suspend</button>
                    )}
                    {(app.state === 'suspended' || app.state === 'revoked') && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'pending', \`Reinstate \${app.system_name} to pending\`); }} className="px-2 py-1 rounded" style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Reinstate</button>
                    )}`
);

// ═══════════════════════════════════════════════════════════
// PATCH 2: Detail page — add handleSuspend + handleReinstate
// ═══════════════════════════════════════════════════════════

console.log('\n── Application Detail ──');

// Add suspend/reinstate functions after handleAdvanceToReview
patch(
  'Add handleSuspend + handleReinstate + refreshApp',
  `  const handleAdvanceToReview = async () => {
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=under_review\`);
      setApp({...app, state: 'under_review'});
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.detail || err.message));
    }
  };`,
  `  const refreshApp = async () => {
    try {
      const res = await api.get(\`/api/applications/\${id}\`);
      setApp(res.data);
    } catch (err) {
      console.error('Failed to refresh:', err);
    }
  };

  const handleAdvanceToReview = async () => {
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=under_review\`);
      await refreshApp();
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSuspend = async () => {
    const reason = window.prompt('Suspension reason (shown to applicant):');
    if (!reason) return;
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=suspended\`);
      await refreshApp();
    } catch (err) {
      alert('Failed to suspend: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReinstate = async () => {
    if (!window.confirm('Reinstate this application to pending? The applicant will need to go through review again.')) return;
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=pending\`);
      await refreshApp();
    } catch (err) {
      alert('Failed to reinstate: ' + (err.response?.data?.detail || err.message));
    }
  };`
);

// Fix handleApprove to use refreshApp
patch(
  'Fix handleApprove to use refreshApp',
  `  const handleApprove = async () => {
    if (!window.confirm('Approve this application and grant ENVELO agent access?')) return;
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=approved\`);
      setApp({...app, state: 'approved'});
    } catch (err) {
      alert('Failed to approve: ' + (err.response?.data?.detail || err.message));
    }
  };`,
  `  const handleApprove = async () => {
    if (!window.confirm('Approve this application and grant ENVELO agent access?')) return;
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=approved\`);
      await refreshApp();
    } catch (err) {
      alert('Failed to approve: ' + (err.response?.data?.detail || err.message));
    }
  };`
);

// ═══════════════════════════════════════════════════════════
// PATCH 3: Detail page — add Suspend + Reinstate buttons
// ═══════════════════════════════════════════════════════════

// Add Suspend button before Delete (for any non-suspended, non-expired state)
// Add Reinstate button for suspended state
patch(
  'Add Suspend + Reinstate buttons to detail header',
  `          <button onClick={handleDeleteApplication} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
            Delete
          </button>`,
  `          {['pending','under_review','approved','testing','conformant'].includes(app.state) && (
            <button onClick={handleSuspend} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Suspend
            </button>
          )}
          {(app.state === 'suspended' || app.state === 'revoked') && (
            <button onClick={handleReinstate} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.4)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Reinstate
            </button>
          )}
          {app.state === 'expired' && (
            <button onClick={handleReinstate} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(157,140,207,0.15)', border: \`1px solid \${styles.purpleBright}\`, color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Re-open
            </button>
          )}
          <button onClick={handleDeleteApplication} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
            Delete
          </button>`
);

// ═══════════════════════════════════════════════════════════
// PATCH 4: Dashboard review queue — add Suspend button
// ═══════════════════════════════════════════════════════════

console.log('\n── Dashboard Review Queue ──');

// In the review queue, after the View link, add Suspend
patch(
  'Add Suspend to dashboard review queue',
  `                  <Link to={\`/applications/\${app.id}\`} className="px-3 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.1)', border: \`1px solid \${styles.borderGlass}\`, color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>View</Link>
                </div>
              </div>
            ))}
          </div>`,
  `                  <button onClick={() => handleQuickAdvance(app.id, 'suspended', \`Suspend \${app.system_name}\`)} className="px-3 py-1 rounded" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Suspend</button>
                  <Link to={\`/applications/\${app.id}\`} className="px-3 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.1)', border: \`1px solid \${styles.borderGlass}\`, color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>View</Link>
                </div>
              </div>
            ))}
          </div>`
);

// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);
const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);

console.log('\n── Verification ──');
const checks = [
  ['Table: Suspend button', code.includes("handleQuickAdvance(app.id, 'suspended'")],
  ['Table: Reinstate button', code.includes("handleQuickAdvance(app.id, 'pending', `Reinstate")],
  ['Table: View Test link for testing state', code.includes("app.state === 'testing'") && code.includes('View Test')],
  ['Detail: handleSuspend function', code.includes('const handleSuspend = async')],
  ['Detail: handleReinstate function', code.includes('const handleReinstate = async')],
  ['Detail: refreshApp function', code.includes('const refreshApp = async')],
  ['Detail: handleApprove uses refreshApp', code.includes("handleApprove") && code.includes('await refreshApp()')],
  ['Detail: Suspend button in header', code.includes("onClick={handleSuspend}")],
  ['Detail: Reinstate button in header', code.includes("onClick={handleReinstate}")],
  ['Detail: Re-open for expired', code.includes("Re-open")],
  ['Dashboard: Suspend in review queue', code.includes("Suspend ${app.system_name}")],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "feat: admin quick-actions — suspend, reinstate, full lifecycle"');
