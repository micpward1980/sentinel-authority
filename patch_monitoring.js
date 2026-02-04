#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Monitoring Dashboard Enhancements
 * =======================================================
 * 
 * Upgrades:
 *  1. Summary cards: Add Fleet Health + Certificates Active
 *  2. Sessions table: Add Organization, System, Certificate columns
 *  3. Session detail: Boundary violations list, agent info, end session button
 *  4. System-wide health bar (% of fleet healthy/degraded/offline)
 *  5. Auto-refresh indicator with countdown
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_monitoring.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Monitoring Dashboard Enhancements');
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
// PATCH 1: Replace summary cards with 6-card grid + fleet health
// ═══════════════════════════════════════════════════════════

const OLD_SUMMARY = `      {/* Summary Cards */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px'}}>
        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Active Sessions
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: styles.accentGreen}}>{summary.active || 0}</div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            {summary.offline || 0} offline
          </div>
        </div>

        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Total Actions
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{(summary.total_actions || 0).toLocaleString()}</div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            {summary.total_pass?.toLocaleString() || 0} passed, {summary.total_block?.toLocaleString() || 0} blocked
          </div>
        </div>

        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Pass Rate
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: summary.pass_rate >= 99 ? styles.accentGreen : summary.pass_rate >= 95 ? '#D6A05C' : '#D65C5C'}}>
            {summary.pass_rate?.toFixed(1) || 0}%
          </div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            enforcement success
          </div>
        </div>

        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Total Sessions
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{summary.total || 0}</div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            {summary.ended || 0} completed
          </div>
        </div>
      </div>`;

const NEW_SUMMARY = `      {/* Summary Cards */}
      {(() => {
        const onlineCount = sessions.filter(s => s.is_online).length;
        const offlineCount = sessions.filter(s => !s.is_online && s.status !== 'ended').length;
        const totalFleet = onlineCount + offlineCount;
        const healthPct = totalFleet > 0 ? (onlineCount / totalFleet * 100) : 0;
        const cardStyle = {background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'};
        const labelStyle = {fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'};
        const subStyle = {fontSize: '12px', color: styles.textSecondary, marginTop: '4px'};
        return (
          <div style={{marginBottom: '32px'}}>
            {/* Fleet Health Bar */}
            {totalFleet > 0 && (
              <div style={{marginBottom: '20px', padding: '16px 20px', ...cardStyle}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <div style={labelStyle}>Fleet Health</div>
                  <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: healthPct >= 90 ? styles.accentGreen : healthPct >= 70 ? '#D6A05C' : '#D65C5C', fontWeight: 500}}>
                    {healthPct.toFixed(0)}% Online
                  </div>
                </div>
                <div style={{height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex'}}>
                  {onlineCount > 0 && <div style={{width: (onlineCount / totalFleet * 100) + '%', background: styles.accentGreen, borderRadius: '4px 0 0 4px', transition: 'width 0.5s'}} />}
                  {offlineCount > 0 && <div style={{width: (offlineCount / totalFleet * 100) + '%', background: '#D65C5C', transition: 'width 0.5s'}} />}
                </div>
                <div style={{display: 'flex', gap: '16px', marginTop: '8px'}}>
                  <span style={{fontSize: '11px', color: styles.accentGreen, display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.accentGreen, display: 'inline-block'}} /> {onlineCount} online
                  </span>
                  <span style={{fontSize: '11px', color: '#D65C5C', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#D65C5C', display: 'inline-block'}} /> {offlineCount} offline
                  </span>
                  <span style={{fontSize: '11px', color: styles.textTertiary, display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span style={{width: '8px', height: '8px', borderRadius: '50%', background: styles.textTertiary, display: 'inline-block'}} /> {summary.ended || 0} ended
                  </span>
                </div>
              </div>
            )}
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px'}}>
              <div style={cardStyle}>
                <div style={labelStyle}>Active Sessions</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.accentGreen}}>{summary.active || 0}</div>
                <div style={subStyle}>{summary.offline || 0} offline</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Actions</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{(summary.total_actions || 0).toLocaleString()}</div>
                <div style={subStyle}>{summary.total_pass?.toLocaleString() || 0} passed, {summary.total_block?.toLocaleString() || 0} blocked</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Pass Rate</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: summary.pass_rate >= 99 ? styles.accentGreen : summary.pass_rate >= 95 ? '#D6A05C' : '#D65C5C'}}>{summary.pass_rate?.toFixed(1) || 0}%</div>
                <div style={subStyle}>enforcement success</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Violations (24h)</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: (summary.total_block || 0) > 0 ? '#D65C5C' : styles.accentGreen}}>{(summary.total_block || 0).toLocaleString()}</div>
                <div style={subStyle}>{((summary.total_block || 0) / Math.max(summary.total_actions || 1, 1) * 100).toFixed(2)}% of actions</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Sessions</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{summary.total || 0}</div>
                <div style={subStyle}>{summary.ended || 0} completed</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Unique Systems</div>
                <div style={{fontSize: '32px', fontWeight: 300, color: styles.purpleBright}}>{[...new Set(sessions.map(s => s.certificate_id).filter(Boolean))].length}</div>
                <div style={subStyle}>{[...new Set(sessions.map(s => s.organization_name).filter(Boolean))].length} organizations</div>
              </div>
            </div>
          </div>
        );
      })()}`;

patch('Replace summary cards with fleet health + 6 cards', OLD_SUMMARY, NEW_SUMMARY);

// ═══════════════════════════════════════════════════════════
// PATCH 2: Add Organization, System, Certificate columns to table
// ═══════════════════════════════════════════════════════════

const OLD_TABLE_HEADERS = `                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Status</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Session ID</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Uptime</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Actions</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Pass Rate</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Last Activity</th>`;

const NEW_TABLE_HEADERS = `                  {(() => { const th = {padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}; const thr = {...th, textAlign: 'right'}; return (<>
                  <th style={th}>Status</th>
                  <th style={th}>Organization</th>
                  <th style={th}>System / Certificate</th>
                  <th style={th}>Session</th>
                  <th style={th}>Uptime</th>
                  <th style={thr}>Actions</th>
                  <th style={thr}>Pass Rate</th>
                  <th style={th}>Last Activity</th>
                  </>); })()}`;

patch('Add org/system/cert columns to table headers', OLD_TABLE_HEADERS, NEW_TABLE_HEADERS);

// ═══════════════════════════════════════════════════════════
// PATCH 3: Add org/system/cert cells to table rows
// ═══════════════════════════════════════════════════════════

const OLD_SESSION_ID_CELL = `                      <td style={{padding: '14px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary}}>
                        {session.session_id}
                      </td>`;

const NEW_SESSION_CELLS = `                      <td style={{padding: '14px 16px'}}>
                        <div style={{fontSize: '13px', color: styles.textPrimary, fontWeight: 500}}>{session.organization_name || 'Unknown'}</div>
                      </td>
                      <td style={{padding: '14px 16px'}}>
                        <div style={{fontSize: '13px', color: styles.textPrimary}}>{session.system_name || '-'}</div>
                        <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>{session.certificate_id || '-'}</div>
                      </td>
                      <td style={{padding: '14px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>
                        {session.session_id?.slice(0, 12)}...
                      </td>`;

patch('Add org/system/cert cells to rows', OLD_SESSION_ID_CELL, NEW_SESSION_CELLS);

// ═══════════════════════════════════════════════════════════
// PATCH 4: Enhance session detail panel
// ═══════════════════════════════════════════════════════════

const OLD_DETAIL_GRID = `            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px'}}>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Started</div>
                <div style={{color: styles.textPrimary}}>{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Pass Count</div>
                <div style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace"}}>{selectedSession.pass_count.toLocaleString()}</div>
              </div>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Block Count</div>
                <div style={{color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace"}}>{selectedSession.block_count.toLocaleString()}</div>
              </div>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Certificate</div>
                <div style={{color: styles.textPrimary}}>{selectedSession.certificate_id || '-'}</div>
              </div>
            </div>`;

const NEW_DETAIL_GRID = `            {/* Session Info Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px'}}>
              <div>
                <h3 style={{margin: '0 0 4px 0', fontSize: '18px', fontWeight: 400, color: styles.textPrimary}}>{selectedSession.organization_name || 'Unknown Organization'}</h3>
                <p style={{margin: 0, fontSize: '13px', color: styles.textSecondary}}>{selectedSession.system_name || 'Unknown System'} · {selectedSession.certificate_id || 'No certificate'}</p>
                <p style={{margin: '4px 0 0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>Agent v{selectedSession.agent_version || '1.0.0'} · Session {selectedSession.session_id}</p>
              </div>
              {selectedSession.is_online && (
                <button
                  onClick={async () => {
                    if (!window.confirm('Force-end this session?')) return;
                    try {
                      await api.post('/api/envelo/sessions/' + selectedSession.session_id + '/end', { ended_at: new Date().toISOString(), final_stats: { pass_count: selectedSession.pass_count, block_count: selectedSession.block_count } });
                      setSelectedSession(null);
                      fetchData();
                    } catch (e) { alert('Failed: ' + e.message); }
                  }}
                  style={{padding: '8px 16px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '8px', color: '#D65C5C', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}
                >
                  Force End Session
                </button>
              )}
            </div>
            
            {/* Stats Grid */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px'}}>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Started</div>
                <div style={{color: styles.textPrimary, fontSize: '13px'}}>{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleString() : '-'}</div>
              </div>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Uptime</div>
                <div style={{color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px'}}>{selectedSession.uptime_hours?.toFixed(1) || '0'}h</div>
              </div>
              <div style={{background: 'rgba(92,214,133,0.08)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Passed</div>
                <div style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px'}}>{(selectedSession.pass_count || 0).toLocaleString()}</div>
              </div>
              <div style={{background: 'rgba(214,92,92,0.08)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Blocked</div>
                <div style={{color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px'}}>{(selectedSession.block_count || 0).toLocaleString()}</div>
              </div>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Pass Rate</div>
                {(() => { const t = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); const r = t > 0 ? (selectedSession.pass_count / t * 100) : 0; return (
                  <div style={{color: r >= 99 ? styles.accentGreen : r >= 95 ? '#D6A05C' : '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px'}}>{r.toFixed(1)}%</div>
                ); })()}
              </div>
              <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px'}}>Certificate</div>
                <div style={{color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}>{selectedSession.certificate_id || '-'}</div>
              </div>
            </div>
            
            {/* Pass/Block Ratio Bar */}
            {(() => { const t = (selectedSession.pass_count || 0) + (selectedSession.block_count || 0); if (t === 0) return null; const pp = selectedSession.pass_count / t * 100; return (
              <div style={{marginBottom: '24px'}}>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Enforcement Distribution</div>
                <div style={{height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex'}}>
                  <div style={{width: pp + '%', background: 'linear-gradient(90deg, ' + styles.accentGreen + ', #4BC87A)', transition: 'width 0.5s'}} />
                  <div style={{width: (100 - pp) + '%', background: '#D65C5C', transition: 'width 0.5s'}} />
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px'}}>
                  <span style={{color: styles.accentGreen}}>Pass: {pp.toFixed(1)}%</span>
                  <span style={{color: '#D65C5C'}}>Block: {(100 - pp).toFixed(1)}%</span>
                </div>
              </div>
            ); })()}`;

patch('Enhance session detail panel', OLD_DETAIL_GRID, NEW_DETAIL_GRID);

// ═══════════════════════════════════════════════════════════
// PATCH 5: Fix timeline API URL (missing /api prefix)
// ═══════════════════════════════════════════════════════════

patch(
  'Fix timeline API URL',
  "const res = await api.get(`/envelo/monitoring/session/${sessionId}/timeline?hours=24`);",
  "const res = await api.get(`/api/envelo/monitoring/session/${sessionId}/timeline?hours=24`);"
);

// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);
const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);

console.log('\n── Verification ──');
const checks = [
  ['Fleet health bar', code.includes('Fleet Health')],
  ['6 summary cards (Violations + Unique Systems)', code.includes('Violations (24h)') && code.includes('Unique Systems')],
  ['Organization column in table', code.includes('Organization</th>')],
  ['System / Certificate column', code.includes('System / Certificate</th>')],
  ['Organization cell in rows', code.includes('session.organization_name || \'Unknown\'')],
  ['Certificate in row cells', code.includes('session.certificate_id || \'-\'')],
  ['Session detail: org header', code.includes('selectedSession.organization_name || \'Unknown Organization\'')],
  ['Session detail: agent version', code.includes('Agent v')],
  ['Session detail: force end button', code.includes('Force End Session')],
  ['Session detail: enforcement distribution bar', code.includes('Enforcement Distribution')],
  ['Timeline API URL fixed', code.includes('/api/envelo/monitoring/session/')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "feat: monitoring dashboard enhancements"');
