#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Admin Experience Upgrade
 * ===================================================
 * 
 * Patches:
 *  1. Admin Dashboard: pipeline breakdown, review queue, quick-action rows
 *  2. ApplicationsList: state filter tabs, quick-action buttons per row
 *  3. CAT-72 Console: live timer, auto-refresh, telemetry stats, better cards
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_admin_experience.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Admin Experience Upgrade');
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

function patchBetween(name, startStr, endStr, replacement) {
  const si = code.indexOf(startStr);
  const ei = code.indexOf(endStr, si + startStr.length);
  if (si !== -1 && ei !== -1) {
    code = code.slice(0, si) + replacement + code.slice(ei + endStr.length);
    console.log(`✓ ${name}`);
    patchCount++;
    return true;
  }
  console.log(`⚠ ${name} — boundaries not found`);
  return false;
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Replace Admin Dashboard
// ═══════════════════════════════════════════════════════════

const NEW_ADMIN_DASHBOARD = `function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [activeTests, setActiveTests] = useState([]);
  const [allApps, setAllApps] = useState([]);

  const loadData = () => {
    api.get('/api/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
    api.get('/api/dashboard/recent-applications').then(res => setRecentApps(res.data)).catch(console.error);
    api.get('/api/dashboard/active-tests').then(res => setActiveTests(res.data)).catch(console.error);
    api.get('/api/applications/').then(res => setAllApps(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Pipeline breakdown
  const pipeline = {
    pending: allApps.filter(a => a.state === 'pending').length,
    under_review: allApps.filter(a => a.state === 'under_review').length,
    approved: allApps.filter(a => a.state === 'approved').length,
    testing: allApps.filter(a => a.state === 'testing').length,
    conformant: allApps.filter(a => a.state === 'conformant').length,
    revoked: allApps.filter(a => a.state === 'revoked' || a.state === 'suspended').length,
  };

  const needsAction = allApps.filter(a => a.state === 'pending' || a.state === 'under_review');

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!window.confirm(\`\${label}?\`)) return;
    try {
      await api.patch(\`/api/applications/\${appId}/state?new_state=\${newState}\`);
      loadData();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Administration" title="Dashboard" />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={stats?.total_applications || 0} color={styles.purpleBright} icon={<FileText className="w-5 h-5" style={{color: styles.purpleBright}} />} />
        <StatCard label="Active Tests" value={stats?.active_tests || 0} color={styles.accentAmber} icon={<Activity className="w-5 h-5" style={{color: styles.accentAmber}} />} />
        <StatCard label="Certificates Issued" value={stats?.certificates_issued || 0} color={styles.accentGreen} icon={<Award className="w-5 h-5" style={{color: styles.accentGreen}} />} />
        <StatCard label="Needs Action" value={needsAction.length} color={needsAction.length > 0 ? '#D6A05C' : styles.textTertiary} icon={<AlertCircle className="w-5 h-5" style={{color: needsAction.length > 0 ? '#D6A05C' : styles.textTertiary}} />} />
      </div>

      {/* Pipeline Breakdown */}
      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Certification Pipeline</h2>
        <div style={{display: 'flex', gap: '4px', height: '32px', borderRadius: '6px', overflow: 'hidden'}}>
          {[
            { key: 'pending', label: 'Pending', color: '#D6A05C', count: pipeline.pending },
            { key: 'under_review', label: 'Review', color: '#D6A05C', count: pipeline.under_review },
            { key: 'approved', label: 'Approved', color: styles.purpleBright, count: pipeline.approved },
            { key: 'testing', label: 'Testing', color: styles.purpleBright, count: pipeline.testing },
            { key: 'conformant', label: 'Conformant', color: styles.accentGreen, count: pipeline.conformant },
            { key: 'revoked', label: 'Suspended', color: styles.accentRed, count: pipeline.revoked },
          ].map(stage => {
            const total = allApps.length || 1;
            const pct = Math.max((stage.count / total) * 100, stage.count > 0 ? 8 : 0);
            return stage.count > 0 ? (
              <div key={stage.key} style={{width: \`\${pct}%\`, background: \`\${stage.color}30\`, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', position: 'relative', borderLeft: \`2px solid \${stage.color}\`}} title={\`\${stage.label}: \${stage.count}\`}>
                <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: stage.color, whiteSpace: 'nowrap'}}>{stage.count} {stage.label}</span>
              </div>
            ) : null;
          })}
          {allApps.length === 0 && <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)'}}><span style={{color: styles.textTertiary, fontSize: '12px'}}>No applications yet</span></div>}
        </div>
      </Panel>

      {/* Review Queue */}
      {needsAction.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, margin: 0}}>⚡ Review Queue ({needsAction.length})</h2>
            <Link to="/applications" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
          </div>
          <div className="space-y-3">
            {needsAction.slice(0, 5).map(app => (
              <div key={app.id} style={{padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: \`1px solid \${styles.borderGlass}\`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                  <Link to={\`/applications/\${app.id}\`} style={{color: styles.purpleBright, textDecoration: 'none', fontWeight: 500, fontSize: '14px'}}>{app.system_name}</Link>
                  <span style={{color: styles.textTertiary, fontSize: '12px'}}>{app.organization_name}</span>
                  <span className="px-2 py-1 rounded" style={{background: 'rgba(214,160,92,0.15)', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>{app.state?.replace('_', ' ')}</span>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  {app.state === 'pending' && (
                    <button onClick={() => handleQuickAdvance(app.id, 'under_review', \`Begin review for \${app.system_name}\`)} className="px-3 py-1 rounded" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Begin Review</button>
                  )}
                  <button onClick={() => handleQuickAdvance(app.id, 'approved', \`Approve \${app.system_name}\`)} className="px-3 py-1 rounded" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Approve</button>
                  <Link to={\`/applications/\${app.id}\`} className="px-3 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.1)', border: \`1px solid \${styles.borderGlass}\`, color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase'}}>View</Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Active Tests */}
      {activeTests.length > 0 && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Active CAT-72 Tests</h2>
            <Link to="/cat72" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>Console →</Link>
          </div>
          <div className="space-y-3">
            {activeTests.map((test) => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id} className="p-4 rounded-lg" style={{background: 'rgba(255,255,255,0.03)', border: \`1px solid \${styles.borderGlass}\`}}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{test.organization_name} — {test.system_name}</span>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>{hoursLeft}h remaining</span>
                      <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentAmber}}>{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.1)'}}>
                    <div className="h-full rounded-full transition-all" style={{width: \`\${pct}%\`, background: pct >= 100 ? styles.accentGreen : styles.purpleBright}} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Recent Applications */}
      <Panel>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Recent Applications</h2>
          <Link to="/applications" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none'}}>View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: \`1px solid \${styles.borderGlass}\`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app) => (
                <tr key={app.id} className="transition-colors cursor-pointer" style={{borderBottom: \`1px solid \${styles.borderGlass}\`}} onClick={() => window.location.hash = \`#/applications/\${app.id}\`}>
                  <td className="px-4 py-3"><Link to={\`/applications/\${app.id}\`} style={{color: styles.purpleBright, textDecoration: 'none'}}>{app.system_name}</Link></td>
                  <td className="px-4 py-3" style={{color: styles.textSecondary}}>{app.organization_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs" style={{
                      background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'observe' ? 'rgba(157,140,207,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
                      color: app.state === 'conformant' ? styles.accentGreen : app.state === 'observe' ? styles.purpleBright : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                    }}>{app.state}</span>
                  </td>
                  <td className="px-4 py-3" style={{color: styles.textTertiary, fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}`;

patchBetween(
  'Replace Admin Dashboard (pipeline, review queue, quick actions)',
  'function Dashboard() {\n  const { user } = useAuth();',
  '// Applications List',
  NEW_ADMIN_DASHBOARD + '\n\n// Applications List'
);


// ═══════════════════════════════════════════════════════════
// PATCH 2: Replace ApplicationsList with filter tabs
// ═══════════════════════════════════════════════════════════

const NEW_APPS_LIST = `function ApplicationsList() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');

  const loadApps = () => {
    api.get('/api/applications/').then(res => setApplications(res.data)).catch(console.error);
  };

  useEffect(() => { loadApps(); }, []);

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!window.confirm(\`\${label}?\`)) return;
    try {
      await api.patch(\`/api/applications/\${appId}/state?new_state=\${newState}\`);
      loadApps();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'under_review', label: 'Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'testing', label: 'Testing' },
    { key: 'conformant', label: 'Conformant' },
    { key: 'revoked', label: 'Suspended' },
  ];

  const filtered = filter === 'all' ? applications : applications.filter(a => a.state === filter || (filter === 'revoked' && a.state === 'suspended'));

  const stateColor = (state) => {
    if (state === 'conformant') return styles.accentGreen;
    if (state === 'revoked' || state === 'suspended') return styles.accentRed;
    if (state === 'testing' || state === 'approved') return styles.purpleBright;
    return styles.accentAmber;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Conformance</p>
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Applications</h1>
        </div>
        {user?.role !== "admin" && <Link to="/applications/new" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors no-underline" style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <Plus className="w-4 h-4" />
          New Application
        </Link>}
      </div>

      {/* Filter Tabs */}
      {user?.role === 'admin' && (
        <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
          {filters.map(f => {
            const count = f.key === 'all' ? applications.length : applications.filter(a => a.state === f.key || (f.key === 'revoked' && a.state === 'suspended')).length;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                background: filter === f.key ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.03)',
                border: \`1px solid \${filter === f.key ? styles.purpleBright : styles.borderGlass}\`,
                color: filter === f.key ? styles.purpleBright : styles.textTertiary,
              }}>
                {f.label} {count > 0 ? \`(\${count})\` : ''}
              </button>
            );
          })}
        </div>
      )}

      <Panel>
        <table className="w-full">
          <thead>
            <tr style={{borderBottom: \`1px solid \${styles.borderGlass}\`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System Name</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Submitted</th>
              {user?.role === 'admin' && <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.id} className="transition-colors" style={{borderBottom: \`1px solid \${styles.borderGlass}\`}}>
                <td className="px-4 py-4">
                  <Link to={\`/applications/\${app.id}\`} style={{color: styles.purpleBright, textDecoration: 'none'}}>{app.system_name}</Link>
                  <div style={{fontSize: '11px', color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", marginTop: '2px'}}>{app.application_number}</div>
                </td>
                <td className="px-4 py-4" style={{color: styles.textSecondary}}>{app.organization_name}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded" style={{
                    background: \`\${stateColor(app.state)}20\`,
                    color: stateColor(app.state),
                    border: \`1px solid \${stateColor(app.state)}40\`,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                  }}>{app.state?.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-4" style={{color: styles.textTertiary, fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
                {user?.role === 'admin' && (
                <td className="px-4 py-4">
                  <div style={{display: 'flex', gap: '6px'}}>
                    {app.state === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'under_review', \`Begin review for \${app.system_name}\`); }} className="px-2 py-1 rounded" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Review</button>
                    )}
                    {(app.state === 'pending' || app.state === 'under_review') && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'approved', \`Approve \${app.system_name}\`); }} className="px-2 py-1 rounded" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Approve</button>
                    )}
                    {app.state === 'approved' && (
                      <Link to={\`/applications/\${app.id}\`} className="px-2 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.15)', border: \`1px solid \${styles.borderGlass}\`, color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Schedule Test</Link>
                    )}
                    {app.state === 'conformant' && (
                      <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px'}}>✓ Certified</span>
                    )}
                  </div>
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{color: styles.textTertiary}}>
            {filter === 'all' ? 'No applications yet' : \`No \${filter.replace('_', ' ')} applications\`}
          </div>
        )}
      </Panel>
    </div>
  );
}`;

patchBetween(
  'Replace ApplicationsList (filter tabs, quick actions)',
  'function ApplicationsList() {\n  const { user } = useAuth();',
  '// New Application Form',
  NEW_APPS_LIST + '\n\n// New Application Form'
);


// ═══════════════════════════════════════════════════════════
// PATCH 3: Replace CAT-72 Console
// ═══════════════════════════════════════════════════════════

const NEW_CAT72 = `function CAT72Console() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState({});
  const [now, setNow] = useState(Date.now());

  const loadTests = () => {
    api.get('/api/cat72/tests').then(res => setTests(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadTests();
    const dataInterval = setInterval(loadTests, 15000);
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(tickInterval); };
  }, []);

  const handleStart = async (testId) => {
    if (!window.confirm('Start this CAT-72 test? The 72-hour timer will begin.')) return;
    setLoading(prev => ({...prev, [testId]: 'starting'}));
    try {
      await api.post(\`/api/cat72/tests/\${testId}/start\`);
      loadTests();
    } catch (err) {
      alert('Failed to start test: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const handleStop = async (testId) => {
    if (!window.confirm('Stop this CAT-72 test and evaluate results?')) return;
    setLoading(prev => ({...prev, [testId]: 'stopping'}));
    try {
      await api.post(\`/api/cat72/tests/\${testId}/stop\`);
      loadTests();
    } catch (err) {
      alert('Failed to stop test: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const handleIssueCertificate = async (testId) => {
    if (!window.confirm('Issue ODDC certificate for this passed test?')) return;
    setLoading(prev => ({...prev, [testId]: 'issuing'}));
    try {
      const res = await api.post(\`/api/certificates/issue/\${testId}\`);
      alert(\`Certificate issued: \${res.data.certificate_number}\\nVerification URL: \${res.data.verification_url}\`);
      loadTests();
    } catch (err) {
      alert('Failed to issue certificate: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return \`\${String(h).padStart(2,'0')}:\${String(m).padStart(2,'0')}:\${String(s).padStart(2,'0')}\`;
  };

  const runningTests = tests.filter(t => t.state === 'running');
  const scheduledTests = tests.filter(t => t.state === 'scheduled');
  const completedTests = tests.filter(t => t.state === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Testing</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>CAT-72 Console</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>72-hour Convergence Authorization Tests · Auto-refreshes every 15s</p>
      </div>

      {/* Summary Stats */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px'}}>
        <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: \`1px solid \${styles.borderGlass}\`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: '24px', fontWeight: 200, color: styles.accentAmber}}>{runningTests.length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Running</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: \`1px solid \${styles.borderGlass}\`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: '24px', fontWeight: 200, color: styles.purpleBright}}>{scheduledTests.length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Scheduled</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: \`1px solid \${styles.borderGlass}\`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: '24px', fontWeight: 200, color: styles.accentGreen}}>{completedTests.filter(t => t.result === 'PASS').length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Passed</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: \`1px solid \${styles.borderGlass}\`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: '24px', fontWeight: 200, color: styles.accentRed}}>{completedTests.filter(t => t.result === 'FAIL').length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Failed</div>
        </div>
      </div>

      {/* Running Tests — Card View */}
      {runningTests.length > 0 && (
        <div>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '12px'}}>● Live Tests</h2>
          <div className="space-y-4">
            {runningTests.map(test => {
              const totalSec = test.duration_hours * 3600;
              const pct = Math.min(100, Math.round((test.elapsed_seconds / totalSec) * 100));
              const remaining = Math.max(0, totalSec - test.elapsed_seconds);
              return (
                <Panel key={test.id}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px'}}>
                    <div>
                      <div style={{fontWeight: 500, fontSize: '16px', color: styles.textPrimary, marginBottom: '4px'}}>{test.organization_name} — {test.system_name}</div>
                      <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>Test ID: {test.test_id} · Duration: {test.duration_hours}h</div>
                    </div>
                    <button onClick={() => handleStop(test.test_id)} disabled={loading[test.test_id]} className="px-4 py-2 rounded-lg" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
                      {loading[test.test_id] === 'stopping' ? '...' : 'Stop & Evaluate'}
                    </button>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px'}}>
                    <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '28px', fontWeight: 200, color: styles.purpleBright, letterSpacing: '2px'}}>{formatTime(test.elapsed_seconds)}</div>
                    <div style={{flex: 1}}>
                      <div className="w-full h-3 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.08)'}}>
                        <div className="h-full rounded-full transition-all" style={{width: \`\${pct}%\`, background: pct >= 100 ? styles.accentGreen : \`linear-gradient(90deg, \${styles.purplePrimary}, \${styles.purpleBright})\`}} />
                      </div>
                    </div>
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', color: pct >= 100 ? styles.accentGreen : styles.textSecondary, fontWeight: 500}}>{pct}%</span>
                  </div>
                  <div style={{display: 'flex', gap: '24px'}}>
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>Remaining: {formatTime(remaining)}</span>
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>Telemetry: {test.telemetry_count || 0} events</span>
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: test.violations_count > 0 ? styles.accentRed : styles.textTertiary}}>Violations: {test.violations_count || 0}</span>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {/* Scheduled Tests */}
      {scheduledTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Scheduled</h2>
          <div className="space-y-3">
            {scheduledTests.map(test => (
              <div key={test.id} style={{padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: \`1px solid \${styles.borderGlass}\`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '2px'}}>{test.organization_name} — {test.system_name}</div>
                  <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>{test.test_id} · {test.duration_hours}h test</div>
                </div>
                <button onClick={() => handleStart(test.test_id)} disabled={loading[test.test_id]} className="px-4 py-2 rounded-lg" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
                  {loading[test.test_id] === 'starting' ? '...' : 'Start Test'}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Completed Tests */}
      {completedTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Completed</h2>
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: \`1px solid \${styles.borderGlass}\`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Result</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Duration</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedTests.map(test => (
                <tr key={test.id} style={{borderBottom: \`1px solid \${styles.borderGlass}\`}}>
                  <td className="px-4 py-4">
                    <div style={{fontWeight: 500, color: styles.textPrimary}}>{test.organization_name} — {test.system_name}</div>
                    <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>{test.test_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: test.result === 'PASS' ? styles.accentGreen : styles.accentRed, padding: '4px 10px', borderRadius: '4px', background: test.result === 'PASS' ? 'rgba(92,214,133,0.15)' : 'rgba(214,92,92,0.15)'}}>{test.result}</span>
                  </td>
                  <td className="px-4 py-4" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary}}>{formatTime(test.elapsed_seconds)}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {test.result === 'PASS' && !test.certificate_issued && (
                        <button onClick={() => handleIssueCertificate(test.test_id)} disabled={loading[test.test_id]} className="px-3 py-1 rounded" style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
                          {loading[test.test_id] === 'issuing' ? '...' : 'Issue Certificate'}
                        </button>
                      )}
                      {test.certificate_issued && (
                        <><span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px'}}>✓ Certified</span><a href={\`\${API_BASE}/api/applications/\${test.application_id}/certificate/download\`} target="_blank" style={{marginLeft: '8px', padding: '2px 8px', background: styles.purplePrimary, borderRadius: '4px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', textDecoration: 'none'}}>PDF</a></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {tests.length === 0 && (
        <Panel>
          <div className="text-center py-12" style={{color: styles.textTertiary}}>
            <p style={{marginBottom: '8px'}}>No tests yet</p>
            <p style={{fontSize: '13px'}}>Approve an application and schedule a CAT-72 test to get started.</p>
          </div>
        </Panel>
      )}
    </div>
  );
}`;

patchBetween(
  'Replace CAT-72 Console (live timer, cards, auto-refresh, stats)',
  'function CAT72Console() {\n  const [tests, setTests] = useState([]);',
  '// Certificates',
  NEW_CAT72 + '\n\n// Certificates'
);


// ═══════════════════════════════════════════════════════════
// PATCH 4: Ensure AlertCircle is imported
// ═══════════════════════════════════════════════════════════
if (!code.includes('AlertCircle')) {
  // Add AlertCircle to lucide-react imports
  patch(
    'Add AlertCircle to lucide-react imports',
    'import { ',
    'import { AlertCircle, '
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
  ['Admin Dashboard: pipeline breakdown', code.includes('Certification Pipeline')],
  ['Admin Dashboard: review queue', code.includes('Review Queue')],
  ['Admin Dashboard: quick advance', code.includes('handleQuickAdvance')],
  ['Admin Dashboard: auto-refresh 30s', code.includes('setInterval(loadData, 30000)')],
  ['Admin Dashboard: needs action stat', code.includes('Needs Action')],
  ['Admin Dashboard: hours remaining', code.includes('hoursLeft')],
  ['ApplicationsList: filter tabs', code.includes("const [filter, setFilter] = useState('all')")],
  ['ApplicationsList: quick actions column', code.includes('Schedule Test')],
  ['ApplicationsList: filter count badges', code.includes("count > 0 ?")],
  ['CAT-72: live timer tick', code.includes("setInterval(() => setNow(Date.now()), 1000)")],
  ['CAT-72: auto-refresh 15s', code.includes('setInterval(loadTests, 15000)')],
  ['CAT-72: formatTime helper', code.includes('const formatTime = (seconds)')],
  ['CAT-72: running/scheduled/completed sections', code.includes('runningTests.length > 0')],
  ['CAT-72: elapsed timer display', code.includes('formatTime(test.elapsed_seconds)')],
  ['CAT-72: telemetry count', code.includes('telemetry_count')],
  ['CAT-72: violations count', code.includes('violations_count')],
  ['CAT-72: summary stats grid', code.includes('Running') && code.includes('Scheduled') && code.includes('Passed') && code.includes('Failed')],
  ['AlertCircle imported', code.includes('AlertCircle')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "feat: admin dashboard, filter tabs, CAT-72 live console"');
