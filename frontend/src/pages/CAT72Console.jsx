import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import AuditTrailView from '../components/AuditTrailView';
import ConformanceReport from '../components/ConformanceReport';

function CAT72Console() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const toast = useToast();
  const [loading, setLoading] = useState({});
  const [now, setNow] = useState(Date.now());
  const [telemetryLogs, setTelemetryLogs] = useState({});

  const loadTests = () => {
    api.get('/api/cat72/tests').then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setTests(list);
      // Fetch telemetry for running tests
      list.filter(t => t.state === 'running').forEach(t => {
        api.get(`/api/cat72/tests/${t.test_id}/telemetry?limit=50`)
          .then(r => setTelemetryLogs(prev => ({ ...prev, [t.test_id]: r.data?.logs || [] })))
          .catch(() => {});
      });
    }).catch(console.error);
  };

  useEffect(() => {
    loadTests();
    const dataInterval = setInterval(loadTests, 15000);
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(tickInterval); };
  }, []);

  const handleStart = async (testId) => {
    if (!await confirm({title: 'Start Test', message: 'Start this CAT-72 test? The 72-hour timer will begin.'})) return;
    setLoading(prev => ({...prev, [testId]: 'starting'}));
    try {
      await api.post(`/api/cat72/tests/${testId}/start`);
      loadTests();
    } catch (err) {
      toast.show('Failed to start test: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const handleStop = async (testId) => {
    if (!await confirm({title: 'Stop Test', message: 'Stop this CAT-72 test and evaluate results?'})) return;
    setLoading(prev => ({...prev, [testId]: 'stopping'}));
    try {
      await api.post(`/api/cat72/tests/${testId}/stop`);
      loadTests();
    } catch (err) {
      toast.show('Failed to stop test: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const handleIssueCertificate = async (testId) => {
    if (!await confirm({title: 'Issue Certificate', message: 'Issue ODDC certificate for this passed test?'})) return;
    setLoading(prev => ({...prev, [testId]: 'issuing'}));
    try {
      const res = await api.post(`/api/certificates/issue/${testId}`);
      toast.show(`Certificate issued: ${res.data.certificate_number}`, 'success');
      loadTests();
    } catch (err) {
      toast.show('Failed to issue certificate: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const runningTests = tests.filter(t => t.state === 'running');
  const scheduledTests = tests.filter(t => t.state === 'scheduled');
  const completedTests = tests.filter(t => t.state === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0' }}>Testing</p>
        <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary }}>CAT-72 Console</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>{user?.role === 'admin' ? '72-hour Convergence Authorization Tests · Auto-refreshes every 15s' : 'Monitor your 72-hour conformance test in real time'}</p>
      </div>

      {/* Summary Stats */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
        <div style={{padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 200, color: styles.accentAmber}}>{runningTests.length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Running</div>
        </div>
        <div style={{padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 200, color: styles.purpleBright}}>{scheduledTests.length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Scheduled</div>
        </div>
        <div style={{padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 200, color: styles.accentGreen}}>{completedTests.filter(t => t.result === 'PASS').length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Passed</div>
        </div>
        <div style={{padding: '16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, textAlign: 'center'}}>
          <div style={{fontFamily: styles.serif, fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 200, color: styles.accentRed}}>{completedTests.filter(t => t.result === 'FAIL').length}</div>
          <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Failed</div>
        </div>
      </div>

      {/* Running Tests — Card View */}
      {runningTests.length > 0 && (
        <div>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '12px'}}>● Live Tests</h2>
          <div className="space-y-4">
            {runningTests.map(test => {
              const totalSec = test.duration_hours * 3600;
              const pct = Math.min(100, Math.round((test.elapsed_seconds / totalSec) * 100));
              const remaining = Math.max(0, totalSec - test.elapsed_seconds);
              return (
                <React.Fragment key={test.id}>
                <Panel key={test.id}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px'}}>
                    <div>
                      <div style={{fontWeight: 500, fontSize: '16px', color: styles.textPrimary, marginBottom: '4px'}}>{test.organization_name} — {test.system_name}</div>
                      <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>Test ID: {test.test_id} · Duration: {test.duration_hours}h</div>
                    </div>
                    {user?.role === 'admin' && <button onClick={() => handleStop(test.test_id)} disabled={loading[test.test_id]} className="px-4 py-2" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 8}}>
                      {loading[test.test_id] === 'stopping' ? '...' : 'Stop & Evaluate'}
                    </button>}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px'}}>
                    <div style={{fontFamily: styles.mono, fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, color: styles.purpleBright, letterSpacing: '2px'}}>{formatTime(test.elapsed_seconds)}</div>
                    <div style={{flex: 1}}>
                      <div className="w-full h-3 overflow-hidden" style={{background: 'transparent'}}>
                        <div className="h-full transition-all" style={{width: `${pct}%`, background: pct >= 100 ? styles.accentGreen : styles.purplePrimary}} />
                      </div>
                    </div>
                    <span style={{fontFamily: styles.mono, fontSize: '14px', color: pct >= 100 ? styles.accentGreen : styles.textSecondary, fontWeight: 500}}>{pct}%</span>
                  </div>
                  <div style={{display: 'flex', gap: '24px'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary}}>Remaining: {formatTime(remaining)}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary}}>Telemetry: {test.telemetry_count || 0} events</span>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: test.violations_count > 0 ? styles.accentAmber : styles.textTertiary}}>
                      {(test.violations_count || 0) > 0
                        ? `✓ ${test.violations_count} interventions`
                        : '0 boundary events'}
                    </span>
                  </div>
                </Panel>
                <AuditTrailView logs={telemetryLogs[test.test_id] || []}
                  certNumber={test.certificate_number}
                  nodeId="0847"
                />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Scheduled Tests */}
      {scheduledTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Scheduled</h2>
          <div className="space-y-3">
            {scheduledTests.map(test => (
              <div key={test.id} style={{padding: '14px 16px', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
                <div>
                  <div style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '2px'}}>{test.organization_name} — {test.system_name}</div>
                  <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>{test.test_id} · {test.duration_hours}h test</div>
                </div>
                {user?.role === 'admin' && <button onClick={() => handleStart(test.test_id)} disabled={loading[test.test_id]} className="px-4 py-2" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 8}}>
                  {loading[test.test_id] === 'starting' ? '...' : 'Start Test'}
                </button>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Completed Tests */}
      {completedTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Completed</h2>
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Result</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Duration</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedTests.map(test => (
                <tr key={test.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                  <td className="px-4 py-4">
                    <div style={{fontWeight: 500, color: styles.textPrimary}}>{test.organization_name} — {test.system_name}</div>
                    <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>{test.test_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span style={{fontFamily: styles.mono, fontSize: '12px', fontWeight: 500, color: test.result === 'PASS' ? styles.accentGreen : styles.accentRed, padding: '4px 10px', background: test.result === 'PASS' ? 'rgba(22,135,62,0.06)' : 'rgba(180,52,52,0.06)'}}>{test.result}</span>
                  </td>
                  <td className="px-4 py-4" style={{fontFamily: styles.mono, fontSize: '12px', color: styles.textSecondary}}>{formatTime(test.elapsed_seconds)}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {user?.role === 'admin' && test.result === 'PASS' && !test.certificate_issued && (
                        <button onClick={() => handleIssueCertificate(test.test_id)} disabled={loading[test.test_id]} className="px-3 py-1" style={{background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
                          {loading[test.test_id] === 'issuing' ? '...' : 'Issue Certificate'}
                        </button>
                      )}
                      {test.certificate_issued && (
                        <><span style={{color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px'}}>✓ Certified</span><a href={`${API_BASE}/api/certificates/${test.certificate_number || test.test_id}/pdf`} target="_blank" rel="noreferrer noopener" style={{marginLeft: '8px', padding: '2px 0', background: 'transparent', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '9px', textDecoration: 'none'}}>PDF</a></>
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
            <p style={{marginBottom: '8px'}}>{user?.role === 'admin' ? 'No tests yet' : 'No active tests'}</p>
            <p style={{fontSize: '13px'}}>{user?.role === 'admin' ? 'Approve an application and schedule a CAT-72 test to get started.' : 'When your application is approved and a CAT-72 test is scheduled, you can monitor its progress here in real time.'}</p>
          </div>
        </Panel>
      )}
    </div>
  );
}

// Certificates

export default CAT72Console;