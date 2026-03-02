"""
Merge Monitoring into Surveillance
===================================
1. SurveillancePage: Add fleet health, telemetry stats, export, session detail
2. App.jsx: Redirect /monitoring → /surveillance
"""
import os

BASE = os.path.expanduser('~/Downloads/sentinel-authority')

# ═══════════════════════════════════════════════════
# 1. Add monitoring data fetch to SurveillancePage
# ═══════════════════════════════════════════════════

path = os.path.join(BASE, 'frontend/src/pages/SurveillancePage.jsx')
with open(path) as f:
    code = f.read()

# Add imports we need
code = code.replace(
    "import { RefreshCw, Search } from 'lucide-react';",
    "import { RefreshCw, Search, Download } from 'lucide-react';\nimport { useAuth } from '../context/AuthContext';\nimport { useToast } from '../context/ToastContext';"
)

# Add auth + toast + monitoring state
code = code.replace(
    "  const [alertFilter, setAlertFilter] = useState('all');",
    """  const [alertFilter, setAlertFilter] = useState('all');
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const { user } = useAuth();
  const toast = useToast();"""
)

# Add monitoring overview query after the alerts query
code = code.replace(
    "  const status = statusData ?? null;",
    """  // Monitoring telemetry data
  const { data: monitoringData } = useQuery({
    queryKey: ['monitoring-overview'],
    queryFn: () => api.get('/api/envelo/monitoring/overview').then(r => r.data),
    refetchInterval: autoRefresh ? 15000 : false,
  });
  const monSummary = monitoringData?.summary || {};
  const monSessions = monitoringData?.sessions || [];
  const onlineSessions = monSessions.filter(s => s.is_online);
  const offlineSessions = monSessions.filter(s => !s.is_online && s.status !== 'ended');
  const totalFleet = onlineSessions.length + offlineSessions.length;
  const healthPct = totalFleet > 0 ? (onlineSessions.length / totalFleet * 100) : 0;

  const status = statusData ?? null;"""
)

# Add session detail fetch + export functions before handleRefresh
code = code.replace(
    "  const handleRefresh = useCallback(async () => {",
    """  const fetchSessionDetail = async (system) => {
    const session = monSessions.find(s => s.certificate_id === system.certificate_number);
    if (session) {
      setSessionDetail(session);
      try {
        const res = await api.get('/api/envelo/monitoring/session/' + session.session_id + '/timeline?hours=24');
        setTimeline(res.data.timeline || []);
      } catch { setTimeline([]); }
    }
  };

  const exportCSV = () => {
    const rows = (systemsData?.systems || []).map(s => ({
      system_name: s.system_name, organization: s.organization_name, certificate: s.certificate_number,
      status: s.status, score: s.score, block_rate: s.block_rate, total_actions: s.total_actions, last_seen: s.last_seen_seconds + 's ago'
    }));
    if (rows.length === 0) { toast.show('No data to export', 'warning'); return; }
    const hdrs = Object.keys(rows[0]);
    const csv = [hdrs.join(','), ...rows.map(r => hdrs.map(h => JSON.stringify(String(r[h] ?? ''))).join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = 'surveillance-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleRefresh = useCallback(async () => {"""
)

# Add monitoring-overview to refresh invalidation
code = code.replace(
    "      qc.invalidateQueries(['surveillance-alerts']),",
    "      qc.invalidateQueries(['surveillance-alerts']),\n      qc.invalidateQueries(['monitoring-overview']),"
)

# Add Export CSV button next to Refresh
code = code.replace(
    """            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> REFRESH
          </button>
        </div>
      </div>""",
    """            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> REFRESH
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid ' + styles.purplePrimary + '33', background: 'transparent', color: styles.purplePrimary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', cursor: 'pointer', borderRadius: 4 }}>
            <Download size={12} /> EXPORT
          </button>
        </div>
      </div>

      {/* Fleet Health Bar */}
      {totalFleet > 0 && (
        <Panel style={{ marginBottom: 16, padding: '16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={label9}>Fleet Health</div>
            <div style={{ ...mono, fontSize: '12px', color: healthPct >= 90 ? styles.accentGreen : healthPct >= 70 ? styles.accentAmber : styles.accentRed, fontWeight: 500 }}>{healthPct.toFixed(0)}% Online</div>
          </div>
          <div style={{ height: 6, background: 'transparent', overflow: 'hidden', display: 'flex', borderRadius: 3 }}>
            {onlineSessions.length > 0 && <div style={{ width: (onlineSessions.length / totalFleet * 100) + '%', background: styles.accentGreen, transition: 'width 0.5s' }} />}
            {offlineSessions.length > 0 && <div style={{ width: (offlineSessions.length / totalFleet * 100) + '%', background: styles.accentRed, transition: 'width 0.5s' }} />}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
            <span style={{ fontSize: '10px', color: styles.accentGreen, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: styles.accentGreen, display: 'inline-block' }} /> {onlineSessions.length} online
            </span>
            <span style={{ fontSize: '10px', color: styles.accentRed, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: styles.accentRed, display: 'inline-block' }} /> {offlineSessions.length} offline
            </span>
            {monSummary.pass_rate > 0 && <span style={{ fontSize: '10px', color: monSummary.pass_rate >= 99 ? styles.accentGreen : styles.accentAmber, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              Pass Rate: {monSummary.pass_rate?.toFixed(1)}%
            </span>}
            {(monSummary.total_actions || 0) > 0 && <span style={{ fontSize: '10px', color: styles.textTertiary }}>
              {(monSummary.total_actions || 0).toLocaleString()} actions
            </span>}
            {(monSummary.total_block || 0) > 0 && <span style={{ fontSize: '10px', color: styles.accentRed }}>
              {(monSummary.total_block || 0).toLocaleString()} violations
            </span>}
          </div>
        </Panel>
      )}"""
)

# Make system rows clickable to expand session detail
# Replace the system row onClick to toggle detail
code = code.replace(
    "onClick={() => s.application_id ? navigate('/applications/' + s.application_id) : null}",
    "onClick={() => { if (selectedSystem?.session_id === s.session_id) { setSelectedSystem(null); setSessionDetail(null); } else { setSelectedSystem(s); fetchSessionDetail(s); } }}"
)

# Add session detail panel after each system row
code = code.replace(
    """                <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary }}>{lastSeenLabel(s.last_seen_seconds)}</div>
              </div>
            ))}""",
    """                <div style={{ ...mono, fontSize: '10px', color: styles.textTertiary }}>{lastSeenLabel(s.last_seen_seconds)}</div>
              </div>
              {selectedSystem?.session_id === s.session_id && sessionDetail && (
                <div style={{ padding: '16px 20px', marginBottom: 8, background: styles.purplePrimary + '04', borderLeft: '3px solid ' + styles.purplePrimary, borderRadius: '0 4px 4px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div><div style={label9}>Uptime</div><div style={{ ...mono, fontSize: '16px', color: styles.textPrimary, marginTop: 4 }}>{sessionDetail.uptime_hours?.toFixed(1) || '0'}h</div></div>
                    <div><div style={label9}>Passed</div><div style={{ ...mono, fontSize: '16px', color: styles.accentGreen, marginTop: 4 }}>{(sessionDetail.pass_count || 0).toLocaleString()}</div></div>
                    <div><div style={label9}>Blocked</div><div style={{ ...mono, fontSize: '16px', color: styles.accentRed, marginTop: 4 }}>{(sessionDetail.block_count || 0).toLocaleString()}</div></div>
                    <div><div style={label9}>Pass Rate</div>{(() => { const t = (sessionDetail.pass_count || 0) + (sessionDetail.block_count || 0); const r = t > 0 ? (sessionDetail.pass_count / t * 100) : 0; return <div style={{ ...mono, fontSize: '16px', color: r >= 99 ? styles.accentGreen : r >= 95 ? styles.accentAmber : styles.accentRed, marginTop: 4 }}>{r.toFixed(1)}%</div>; })()}</div>
                    <div><div style={label9}>Session</div><div style={{ ...mono, fontSize: '10px', color: styles.textTertiary, marginTop: 4 }}>{sessionDetail.session_id?.slice(0, 16)}...</div></div>
                    <div><div style={label9}>Version</div><div style={{ ...mono, fontSize: '12px', color: styles.textTertiary, marginTop: 4 }}>v{sessionDetail.agent_version || '1.0.0'}</div></div>
                  </div>
                  {timeline.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ ...label9, marginBottom: 8 }}>24-Hour Activity</div>
                      <div style={{ display: 'flex', gap: 1, height: 40, alignItems: 'flex-end' }}>
                        {timeline.map((p, ti) => { const mx = Math.max(...timeline.map(t => t.total), 1); const h = (p.total / mx) * 100; const pr = p.total > 0 ? p.pass / p.total : 1; return <div key={ti} style={{ flex: 1, height: Math.max(h, 2) + '%', background: pr >= 0.99 ? styles.accentGreen : pr >= 0.95 ? styles.accentAmber : styles.accentRed, opacity: 0.7, borderRadius: '1px 1px 0 0' }} />; })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '9px', color: styles.textDim }}><span>24h ago</span><span>Now</span></div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={async (e) => { e.stopPropagation(); try { const base = user?.role === 'admin' ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/'; const res = await api.get(base + sessionDetail.session_id + '/telemetry'); const recs = res.data.records || []; if (recs.length === 0) { toast.show('No telemetry data', 'info'); return; } const h = ['timestamp','action_type','result','execution_time_ms']; const csv = [h.join(','), ...recs.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\\n'); const b = new Blob([csv], {type:'text/csv'}); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'telemetry-' + sessionDetail.session_id + '.csv'; l.click(); } catch { toast.show('Failed', 'error'); }}} style={{ padding: '4px 10px', border: '1px solid ' + styles.purplePrimary + '33', background: 'transparent', color: styles.purplePrimary, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.5px', cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase' }}>Telemetry CSV</button>
                    <button onClick={async (e) => { e.stopPropagation(); try { const base = user?.role === 'admin' ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/'; const res = await api.get(base + sessionDetail.session_id + '/violations'); const v = res.data.violations || []; if (v.length === 0) { toast.show('No violations', 'info'); return; } const h = ['timestamp','boundary_name','violation_message']; const csv = [h.join(','), ...v.map(r => h.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\\n'); const b = new Blob([csv], {type:'text/csv'}); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'violations-' + sessionDetail.session_id + '.csv'; l.click(); } catch { toast.show('Failed', 'error'); }}} style={{ padding: '4px 10px', border: '1px solid ' + styles.accentRed + '33', background: 'transparent', color: styles.accentRed, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.5px', cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase' }}>Violations CSV</button>
                    <button onClick={async (e) => { e.stopPropagation(); try { const base = user?.role === 'admin' ? '/api/envelo/admin/sessions/' : '/api/envelo/my/sessions/'; const res = await api.get(base + sessionDetail.session_id + '/report', { responseType: 'blob' }); const b = new Blob([res.data], {type:'application/pdf'}); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'CAT72-Report-' + sessionDetail.session_id + '.pdf'; l.click(); } catch { toast.show('Failed', 'error'); }}} style={{ padding: '4px 10px', border: '1px solid ' + styles.accentGreen + '33', background: 'transparent', color: styles.accentGreen, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.5px', cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase' }}>CAT-72 Report</button>
                    {s.application_id && <button onClick={(e) => { e.stopPropagation(); navigate('/applications/' + s.application_id); }} style={{ padding: '4px 10px', border: '1px solid ' + styles.textDim + '33', background: 'transparent', color: styles.textSecondary, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.5px', cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase' }}>Application →</button>}
                  </div>
                </div>
              )}
            </>) /* end system row fragment */}
          </>))}"""
)

# Wrap each system row in a Fragment so detail can follow it
code = code.replace(
    "            {systems.map((s, i) => (\n              <div key={s.session_id || i}",
    "            {systems.map((s, i) => (<React.Fragment key={s.session_id || i}>\n              <div"
)

# Close the Fragment after the detail panel
# Already handled in the replacement above with </>) /* end system row fragment */}

with open(path, 'w') as f:
    f.write(code)
print('1. SurveillancePage upgraded with monitoring data')

# ═══════════════════════════════════════════════════
# 2. Redirect /monitoring → /surveillance in App.jsx
# ═══════════════════════════════════════════════════

path = os.path.join(BASE, 'frontend/src/App.jsx')
with open(path) as f:
    code = f.read()

# Add Navigate import if not present
if 'Navigate' not in code:
    code = code.replace(
        "import { BrowserRouter, Routes, Route",
        "import { BrowserRouter, Routes, Route, Navigate"
    )

# Replace MonitoringPage route with redirect
if "path=\"/monitoring\"" in code:
    # Find the monitoring route and replace with redirect
    import re
    code = re.sub(
        r'<Route path="/monitoring"[^/]*/>\s*',
        '<Route path="/monitoring" element={<Navigate to="/surveillance" replace />} />\n',
        code
    )
    # Remove MonitoringPage import
    code = re.sub(r'import MonitoringPage from.*\n', '', code)
    print('2. /monitoring now redirects to /surveillance')
else:
    print('2. Could not find /monitoring route')

with open(path, 'w') as f:
    f.write(code)

# ═══════════════════════════════════════════════════
# 3. Update dashboard Systems Online link
# ═══════════════════════════════════════════════════

path = os.path.join(BASE, 'frontend/src/pages/DashboardPage.jsx')
with open(path) as f:
    code = f.read()

# Already pointing to /surveillance from earlier fix
if "navigate('/surveillance')" in code:
    print('3. Dashboard already links to /surveillance')
else:
    code = code.replace("navigate('/monitoring')", "navigate('/surveillance')")
    with open(path, 'w') as f:
        f.write(code)
    print('3. Dashboard Systems Online → /surveillance')

print('\nDone. Build and deploy.')
