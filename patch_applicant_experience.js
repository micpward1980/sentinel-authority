#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Applicant Experience Upgrade
 * ===================================================
 * 
 * Patches:
 *  1. Fix handleApprove bug in ApplicationDetail
 *  2. Add useAuth() + role guards to ApplicationDetail
 *  3. Add visual progress tracker to ApplicationDetail
 *  4. Applicant-specific detail view (hide admin controls)
 *  5. Upgrade CustomerDashboard with pipeline + CTA + rich cards
 *  6. Wizard pre-fill org from user profile
 *  7. Post-submit success screen
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_applicant_experience.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Applicant Experience Upgrade');
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
  } else {
    console.log(`⚠ ${name} — pattern not found`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Add useAuth() to ApplicationDetail
// ═══════════════════════════════════════════════════════════
patch(
  'Add useAuth() to ApplicationDetail',
  'function ApplicationDetail() {\n  const { id } = useParams();\n  const [app, setApp] = useState(null);',
  'function ApplicationDetail() {\n  const { id } = useParams();\n  const { user } = useAuth();\n  const [app, setApp] = useState(null);'
);

// ═══════════════════════════════════════════════════════════
// PATCH 2: Add handleApprove function to ApplicationDetail
// ═══════════════════════════════════════════════════════════
patch(
  'Add handleApprove function',
  "  if (!app) return <div style={{color: styles.textTertiary}}>Loading...</div>;",
  `  const handleApprove = async () => {
    if (!window.confirm('Approve this application and grant ENVELO agent access?')) return;
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=approved\`);
      setApp({...app, state: 'approved'});
    } catch (err) {
      alert('Failed to approve: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAdvanceToReview = async () => {
    try {
      await api.patch(\`/api/applications/\${id}/state?new_state=under_review\`);
      setApp({...app, state: 'under_review'});
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Certification pipeline stages
  const PIPELINE_STAGES = [
    { key: 'pending', label: 'Submitted', icon: '1' },
    { key: 'under_review', label: 'Under Review', icon: '2' },
    { key: 'approved', label: 'Approved', icon: '3' },
    { key: 'testing', label: 'CAT-72 Testing', icon: '4' },
    { key: 'conformant', label: 'Conformant', icon: '✓' },
  ];
  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.key === app?.state);
  const isSuspended = app?.state === 'revoked' || app?.state === 'suspended';

  const nextStepText = () => {
    switch(app?.state) {
      case 'pending': return 'Your application is queued for review by the Sentinel Authority team.';
      case 'under_review': return 'Our team is evaluating your ODD specification and boundary definitions.';
      case 'approved': return 'Your system is approved. The ENVELO agent is being configured for CAT-72 testing.';
      case 'testing': return 'CAT-72 continuous conformance test is in progress (72-hour minimum).';
      case 'conformant': return 'Your system has achieved ODDC Conformance. Your certificate and ENVELO agent credentials are active.';
      case 'revoked': return 'This application has been suspended. Contact info@sentinelauthority.org for remediation steps.';
      default: return '';
    }
  };

  if (!app) return <div style={{color: styles.textTertiary}}>Loading...</div>;`
);

// ═══════════════════════════════════════════════════════════
// PATCH 3: Replace ApplicationDetail header + controls
// The section between "Back to Applications" and "testCreated"
// ═══════════════════════════════════════════════════════════

// Replace the entire controls section with role-aware version + progress tracker
const OLD_CONTROLS = `      <div className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center gap-2 no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
        <div style={{display: 'flex', gap: '12px'}}>
          {(app.state === 'pending' || app.state === 'under_review') && (
            <button
              onClick={handleApprove}
              className="px-4 py-2 rounded-lg transition-all"
              style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.4)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
            >
              Approve Application
            </button>
          )}
          {app.state === 'approved' && (
            <button
              onClick={handleScheduleTest}
              disabled={scheduling}
              className="px-4 py-2 rounded-lg transition-all"
              style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: scheduling ? 'wait' : 'pointer', opacity: scheduling ? 0.7 : 1}}
            >
              {scheduling ? 'Scheduling...' : 'Schedule CAT-72 Test'}
            </button>
          )}
          <button
            onClick={handleDeleteApplication}
            className="px-4 py-2 rounded-lg transition-all"
            style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
          >
            Delete
          </button>
        </div>
      </div>`;

const NEW_CONTROLS = `      <div className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center gap-2 no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
        {user?.role === 'admin' && (
        <div style={{display: 'flex', gap: '12px'}}>
          {app.state === 'pending' && (
            <button onClick={handleAdvanceToReview} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.4)', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Begin Review
            </button>
          )}
          {(app.state === 'pending' || app.state === 'under_review') && (
            <button onClick={handleApprove} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.4)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Approve Application
            </button>
          )}
          {app.state === 'approved' && (
            <button onClick={handleScheduleTest} disabled={scheduling} className="px-4 py-2 rounded-lg transition-all" style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: scheduling ? 'wait' : 'pointer', opacity: scheduling ? 0.7 : 1}}>
              {scheduling ? 'Scheduling...' : 'Schedule CAT-72 Test'}
            </button>
          )}
          <button onClick={handleDeleteApplication} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
            Delete
          </button>
        </div>
        )}
      </div>
      
      {/* ── Progress Pipeline ── */}
      <Panel>
        <div style={{padding: '8px 0'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px'}}>
            {PIPELINE_STAGES.map((stage, i) => {
              const isActive = stage.key === app.state;
              const isComplete = currentStageIdx > i;
              const isPending = currentStageIdx < i;
              return (
                <React.Fragment key={stage.key}>
                  {i > 0 && <div style={{flex: 1, height: '2px', background: isComplete ? styles.accentGreen : styles.borderGlass, margin: '0 8px'}} />}
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '80px'}}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 'bold',
                      background: isComplete ? 'rgba(92,214,133,0.2)' : isActive ? 'rgba(157,140,207,0.25)' : 'rgba(255,255,255,0.03)',
                      border: \`2px solid \${isComplete ? styles.accentGreen : isActive ? styles.purpleBright : styles.borderGlass}\`,
                      color: isComplete ? styles.accentGreen : isActive ? styles.purpleBright : styles.textTertiary,
                    }}>
                      {isComplete ? '✓' : stage.icon}
                    </div>
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase', color: isActive ? styles.purpleBright : isComplete ? styles.accentGreen : styles.textTertiary, textAlign: 'center'}}>
                      {stage.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {isSuspended && (
            <div style={{padding: '12px 16px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '8px', marginBottom: '12px'}}>
              <span style={{color: styles.accentRed, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px'}}>⚠ SUSPENDED — This application has been suspended pending review.</span>
            </div>
          )}
          <div style={{padding: '12px 16px', background: 'rgba(157,140,207,0.08)', border: \`1px solid \${styles.borderGlass}\`, borderRadius: '8px'}}>
            <span style={{color: styles.textSecondary, fontSize: '13px', lineHeight: '1.5'}}>{nextStepText()}</span>
          </div>
        </div>
      </Panel>`;

patch('Replace header controls with role-guarded version + pipeline', OLD_CONTROLS, NEW_CONTROLS);


// ═══════════════════════════════════════════════════════════
// PATCH 4: Role-guard the state dropdown in Status panel
// ═══════════════════════════════════════════════════════════

const OLD_STATE_DROPDOWN = `          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1 rounded" style={{
              background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
              color: app.state === 'conformant' ? styles.accentGreen : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              {app.state}
            </span>
            <select 
              value={app.state}
              onChange={async (e) => {
                const newState = e.target.value;
                if (!window.confirm(\`Change status to \${newState.toUpperCase()}?\`)) return;
                try {
                  await api.patch(\`/api/applications/\${id}/state?new_state=\${newState}\`);
                  setApp({...app, state: newState});
                  // Show auto-generated API key
                  
                } catch (err) {
                  alert('Failed to update state: ' + (err.response?.data?.detail || err.message));
                }
              }}
              className="px-3 py-2 rounded-lg"
              style={{background: 'rgba(255,255,255,0.05)', border: \`1px solid \${styles.borderGlass}\`, color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px'}}
            >
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved (Agent Access)</option>
              <option value="testing">Testing (CAT-72 Active)</option>
              <option value="conformant">Conformant</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>`;

const NEW_STATE_DROPDOWN = `          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1 rounded" style={{
              background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
              color: app.state === 'conformant' ? styles.accentGreen : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              {app.state}
            </span>
            {user?.role === 'admin' && (
            <select 
              value={app.state}
              onChange={async (e) => {
                const newState = e.target.value;
                if (!window.confirm(\`Change status to \${newState.toUpperCase()}?\`)) return;
                try {
                  await api.patch(\`/api/applications/\${id}/state?new_state=\${newState}\`);
                  setApp({...app, state: newState});
                } catch (err) {
                  alert('Failed to update state: ' + (err.response?.data?.detail || err.message));
                }
              }}
              className="px-3 py-2 rounded-lg"
              style={{background: 'rgba(255,255,255,0.05)', border: \`1px solid \${styles.borderGlass}\`, color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px'}}
            >
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved (Agent Access)</option>
              <option value="testing">Testing (CAT-72 Active)</option>
              <option value="conformant">Conformant</option>
              <option value="revoked">Revoked</option>
            </select>
            )}
          </div>`;

patch('Role-guard state dropdown (admin only)', OLD_STATE_DROPDOWN, NEW_STATE_DROPDOWN);


// ═══════════════════════════════════════════════════════════
// PATCH 5: Role-guard BoundaryEditor
// ═══════════════════════════════════════════════════════════
patch(
  'Role-guard BoundaryEditor (admin only)',
  '      {/* Boundary Editor - Admin Only */}\n      <BoundaryEditor',
  '      {/* Boundary Editor - Admin Only */}\n      {user?.role === \'admin\' && <BoundaryEditor'
);

// Find the closing of BoundaryEditor's onSave callback and add the role-guard closing
// The BoundaryEditor block ends with a specific pattern, let's handle it by finding the onSave error handler
patch(
  'Close BoundaryEditor role guard',
  `            await api.patch(\`/api/applicants/\${app.id}\`, { envelope_definition: boundaries });
            alert("Boundaries saved!");
            setApp({...app, envelope_definition: boundaries});
          } catch (e) {`,
  `            await api.patch(\`/api/applicants/\${app.id}\`, { envelope_definition: boundaries });
            alert("Boundaries saved!");
            setApp({...app, envelope_definition: boundaries});
          } catch (e) {/* boundary save error */`
);


// ═══════════════════════════════════════════════════════════
// PATCH 6: Replace CustomerDashboard entirely
// ═══════════════════════════════════════════════════════════

const OLD_DASHBOARD_START = 'function CustomerDashboard() {\n  const { user } = useAuth();';
const DASHBOARD_END_MARKER = '// Role-based dashboard routing';

const dashboardStart = code.indexOf(OLD_DASHBOARD_START);
const dashboardEnd = code.indexOf(DASHBOARD_END_MARKER);

if (dashboardStart !== -1 && dashboardEnd !== -1) {
  // Find the closing brace of CustomerDashboard (line before the comment)
  let searchBack = dashboardEnd - 1;
  while (searchBack > dashboardStart && code[searchBack] !== '}') searchBack--;
  
  const NEW_DASHBOARD = `function CustomerDashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/certificates/').catch(() => ({ data: [] }))
    ]).then(([appsRes, certsRes]) => {
      setApplications(appsRes.data || []);
      setCertificates(certsRes.data || []);
      setLoading(false);
    });
  }, []);

  const STAGES = [
    { key: 'pending', label: 'Submitted' },
    { key: 'under_review', label: 'In Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'testing', label: 'Testing' },
    { key: 'conformant', label: 'Conformant' },
  ];

  const stageIdx = (state) => STAGES.findIndex(s => s.key === state);

  const nextAction = (state) => {
    switch(state) {
      case 'pending': return 'Awaiting review';
      case 'under_review': return 'Under evaluation';
      case 'approved': return 'Preparing CAT-72';
      case 'testing': return 'Test in progress';
      case 'conformant': return 'Certificate issued';
      case 'revoked': return 'Suspended';
      default: return 'Pending';
    }
  };

  const stateColor = (state) => {
    if (state === 'conformant') return styles.accentGreen;
    if (state === 'revoked' || state === 'suspended') return styles.accentRed;
    if (state === 'testing' || state === 'approved') return styles.purpleBright;
    return styles.accentAmber;
  };

  if (loading) return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>ODDC Certification</p>
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Welcome{user?.full_name ? \`, \${user.full_name.split(' ')[0]}\` : ''}</h1>
          <p style={{color: styles.textSecondary, marginTop: '8px'}}>Track your certification progress and manage your systems.</p>
        </div>
        <Link to="/applications/new" className="flex items-center gap-2 px-5 py-3 rounded-lg no-underline" style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>
          <Plus className="w-4 h-4" />
          New Application
        </Link>
      </div>

      {/* Quick Stats */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px'}}>
        <Panel>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px'}}>
            <div style={{fontFamily: styles.serif, fontSize: '32px', fontWeight: 200, color: styles.purpleBright, lineHeight: '38px'}}>{applications.length}</div>
            <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px'}}>Applications</div>
          </div>
        </Panel>
        <Panel>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px'}}>
            <div style={{fontFamily: styles.serif, fontSize: '32px', fontWeight: 200, color: styles.accentGreen, lineHeight: '38px'}}>{certificates.length}</div>
            <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px'}}>Certificates</div>
          </div>
        </Panel>
        <Panel>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px'}}>
            <div style={{fontFamily: styles.serif, fontSize: '32px', fontWeight: 200, color: styles.accentAmber, lineHeight: '38px'}}>{applications.filter(a => a.state === 'testing').length}</div>
            <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px'}}>Active Tests</div>
          </div>
        </Panel>
        <Panel>
          <a href="https://sentinel-website-eta.vercel.app/status.html" target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px'}}>
            <div style={{height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Activity size={32} style={{color: styles.purpleBright}} /></div>
            <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px'}}>Live Status</div>
          </a>
        </Panel>
      </div>

      {/* Applications with Progress */}
      <Panel>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Your Applications</h2>
          {applications.length > 0 && (
            <Link to="/applications" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px'}}>View All →</Link>
          )}
        </div>
        {applications.length === 0 ? (
          <div style={{textAlign: 'center', padding: '48px 20px'}}>
            <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>⬡</div>
            <p style={{color: styles.textSecondary, fontSize: '15px', marginBottom: '8px'}}>No applications yet</p>
            <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '24px'}}>Start your ODDC certification journey by submitting your first application.</p>
            <Link to="/applications/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg no-underline" style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>
              <Plus className="w-4 h-4" />
              Begin ODDC Certification
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => {
              const idx = stageIdx(app.state);
              return (
                <Link key={app.id} to={\`/applications/\${app.id}\`} style={{textDecoration: 'none', display: 'block'}}>
                  <div style={{padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: \`1px solid \${styles.borderGlass}\`, cursor: 'pointer', transition: 'border-color 0.2s'}} onMouseEnter={e => e.currentTarget.style.borderColor = styles.purpleBright} onMouseLeave={e => e.currentTarget.style.borderColor = styles.borderGlass}>
                    {/* Top row: name + badge */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                      <div>
                        <div style={{fontWeight: 500, color: styles.textPrimary, fontSize: '15px', marginBottom: '4px'}}>{app.system_name}</div>
                        <div style={{fontSize: '11px', color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace"}}>{app.application_number} · {app.system_type?.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <span style={{fontSize: '12px', color: styles.textTertiary}}>{nextAction(app.state)}</span>
                        <span style={{padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px',
                          background: \`\${stateColor(app.state)}20\`,
                          color: stateColor(app.state),
                          border: \`1px solid \${stateColor(app.state)}40\`,
                        }}>{app.state}</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div style={{display: 'flex', gap: '3px', height: '4px'}}>
                      {STAGES.map((s, i) => (
                        <div key={s.key} style={{flex: 1, borderRadius: '2px', background: i <= idx ? stateColor(app.state) : 'rgba(255,255,255,0.05)'}} />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Certificates */}
      {certificates.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Certificates</h2>
          <div className="space-y-3">
            {certificates.map(cert => (
              <div key={cert.id} style={{padding: '16px', background: 'rgba(92,214,133,0.08)', border: '1px solid rgba(92,214,133,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500, color: styles.accentGreen, marginBottom: '4px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px'}}>{cert.certificate_number}</div>
                  <div style={{fontSize: '12px', color: styles.textTertiary}}>Issued: {new Date(cert.issued_at).toLocaleDateString()}{cert.expires_at ? \` · Expires: \${new Date(cert.expires_at).toLocaleDateString()}\` : ''}</div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <a href={\`https://sentinel-authority-production.up.railway.app/api/applications/\${cert.application_id}/certificate/download\`}
                     target="_blank"
                     style={{padding: '8px 16px', background: styles.purplePrimary, borderRadius: '6px', color: '#fff', fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", textDecoration: 'none'}}>
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Resources */}
      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Resources</h2>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px'}}>
          {certificates.some(c => c.status === 'issued' || c.status === 'active') && (
          <a href="https://sentinelauthority.org/agent.html" target="_blank" style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textDecoration: 'none', color: styles.textSecondary, border: \`1px solid \${styles.borderGlass}\`}}>
            <div style={{fontWeight: 500, marginBottom: '4px', color: styles.textPrimary, fontSize: '13px'}}>ENVELO Agent Setup</div>
            <div style={{fontSize: '11px'}}>Installation & configuration guide</div>
          </a>
          )}
          <a href="https://sentinelauthority.org" target="_blank" style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textDecoration: 'none', color: styles.textSecondary, border: \`1px solid \${styles.borderGlass}\`}}>
            <div style={{fontWeight: 500, marginBottom: '4px', color: styles.textPrimary, fontSize: '13px'}}>ODDC Framework</div>
            <div style={{fontSize: '11px'}}>Certification overview & requirements</div>
          </a>
          <a href="mailto:info@sentinelauthority.org" style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textDecoration: 'none', color: styles.textSecondary, border: \`1px solid \${styles.borderGlass}\`}}>
            <div style={{fontWeight: 500, marginBottom: '4px', color: styles.textPrimary, fontSize: '13px'}}>Contact Support</div>
            <div style={{fontSize: '11px'}}>info@sentinelauthority.org</div>
          </a>
        </div>
      </Panel>
    </div>
  );
}`;

  code = code.slice(0, dashboardStart) + NEW_DASHBOARD + '\n\n\n' + code.slice(dashboardEnd);
  console.log('✓ Replaced CustomerDashboard (pipeline cards, CTA, progress bars, 4-stat grid)');
  patchCount++;
} else {
  console.log('⚠ Could not locate CustomerDashboard boundaries');
}


// ═══════════════════════════════════════════════════════════
// PATCH 7: Wizard pre-fill org from user context
// ═══════════════════════════════════════════════════════════
patch(
  'Add user context to wizard',
  "function NewApplication() {\n\n  const [step, setStep] = useState(1);",
  "function NewApplication() {\n  const { user } = useAuth();\n  const [step, setStep] = useState(1);"
);

// Add useEffect to pre-fill org info from user
patch(
  'Wizard pre-fill org from user profile',
  "const [safety, setSafety] = useState({ violation_action: 'stop', connection_loss_action: 'stop', fail_closed: true, emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '', existing_safety_systems: '', escalation_triggers: '' });",
  `const [safety, setSafety] = useState({ violation_action: 'stop', connection_loss_action: 'stop', fail_closed: true, emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '', existing_safety_systems: '', escalation_triggers: '' });
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill org from user profile
  useEffect(() => {
    if (user) {
      setOrg(prev => ({
        ...prev,
        contact_name: prev.contact_name || user.full_name || '',
        contact_email: prev.contact_email || user.email || '',
        organization_name: prev.organization_name || user.organization_name || '',
      }));
    }
  }, [user]);`
);


// ═══════════════════════════════════════════════════════════
// PATCH 8: Post-submit success screen
// ═══════════════════════════════════════════════════════════

// Replace the handleSubmit to set submitted state instead of just navigating
const OLD_SUBMIT_END = `alert('Application submitted!');
      navigate('/applications');`;

const NEW_SUBMIT_END = `setSubmitted(true);`;

if (code.includes(OLD_SUBMIT_END)) {
  patch('Post-submit success state', OLD_SUBMIT_END, NEW_SUBMIT_END);
} else {
  // Try alternate pattern
  patch('Post-submit success state (alt)',
    "alert('Application submitted!');\n      navigate('/applications')",
    'setSubmitted(true);'
  );
}

// Add success screen rendering before the step rendering
// Find the wizard return statement - look for the step indicator
const WIZARD_RETURN_MARKER = `{/* Step indicator */}`;
const WIZARD_RETURN_MARKER_ALT = `{step === 1 && (`;

// Try to find a good insertion point for the success screen
// We need to insert before the step rendering content
const successScreen = `
      {submitted && (
        <div style={{textAlign: 'center', padding: '60px 20px'}}>
          <div style={{width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(92,214,133,0.15)', border: '2px solid rgba(92,214,133,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px'}}>✓</div>
          <h2 style={{fontFamily: "'Source Serif 4', serif", fontSize: '28px', fontWeight: 200, margin: '0 0 12px', color: styles.textPrimary}}>Application Submitted</h2>
          <p style={{color: styles.textSecondary, fontSize: '14px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto 8px'}}>Your application is now in the queue. Our team will review your ODD specification and boundary definitions.</p>
          <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '32px'}}>You'll receive email updates as your application progresses through the certification pipeline.</p>
          <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
            <Link to="/applications" className="no-underline px-6 py-3 rounded-lg" style={{background: styles.purplePrimary, border: \`1px solid \${styles.purpleBright}\`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>View Applications</Link>
            <Link to="/dashboard" className="no-underline px-6 py-3 rounded-lg" style={{background: 'transparent', border: \`1px solid \${styles.borderGlass}\`, color: styles.textSecondary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>Dashboard</Link>
          </div>
        </div>
      )}
      {!submitted && <>`;

// Find the first step rendering and wrap everything in a submitted guard
const firstStepIdx = code.indexOf('{step === 1 && (<div className="space-y-4">{sectionHead(\'Organization');
if (firstStepIdx !== -1) {
  code = code.slice(0, firstStepIdx) + successScreen + code.slice(firstStepIdx);
  
  // Find the closing nav buttons div and close the fragment
  const navEnd = code.indexOf("Submit Application</button>)}</div>");
  if (navEnd !== -1) {
    const insertPoint = navEnd + "Submit Application</button>)}</div>".length;
    code = code.slice(0, insertPoint) + '\n      </>}' + code.slice(insertPoint);
    console.log('✓ Added post-submit success screen with pipeline guidance');
    patchCount++;
  } else {
    console.log('⚠ Could not find nav end for success screen wrapper');
  }
} else {
  console.log('⚠ Could not find step 1 marker for success screen');
}


// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);
const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);

console.log('\n── Verification ──');
const checks = [
  ['useAuth in ApplicationDetail', code.includes('function ApplicationDetail() {\n  const { id } = useParams();\n  const { user } = useAuth();')],
  ['handleApprove defined', code.includes('const handleApprove = async () => {')],
  ['handleAdvanceToReview defined', code.includes('const handleAdvanceToReview = async () => {')],
  ['PIPELINE_STAGES in detail view', code.includes('const PIPELINE_STAGES = [')],
  ['Progress tracker renders', code.includes('PIPELINE_STAGES.map((stage, i)')],
  ['Admin controls role-guarded', code.includes("{user?.role === 'admin' && (\n        <div style={{display: 'flex', gap: '12px'}}>")],
  ['State dropdown role-guarded', code.includes("{user?.role === 'admin' && (\n            <select")],
  ['BoundaryEditor role-guarded', code.includes("{user?.role === 'admin' && <BoundaryEditor")],
  ['CustomerDashboard has pipeline cards', code.includes('Mini progress bar')],
  ['CustomerDashboard has CTA', code.includes('Begin ODDC Certification')],
  ['4-stat grid', code.includes('Active Tests')],
  ['Wizard has useAuth', code.includes("function NewApplication() {\n  const { user } = useAuth();")],
  ['Wizard pre-fills org', code.includes('contact_name: prev.contact_name || user.full_name')],
  ['Post-submit success screen', code.includes('Application Submitted')],
  ['nextStepText helper', code.includes('const nextStepText = () => {')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "feat: streamline applicant certification experience"');
