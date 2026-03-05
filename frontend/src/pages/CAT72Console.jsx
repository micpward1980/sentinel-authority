import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import Pagination from '../components/Pagination';
import AuditTrailView from '../components/AuditTrailView';
import ConformanceReport from '../components/ConformanceReport';

function CAT72Console() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const toast = useToast();
  const [loading, setLoading] = useState({});
  const [now, setNow] = useState(Date.now());
  const [telemetryLogs, setTelemetryLogs] = useState({});
  const [historyOffset, setHistoryOffset] = useState(0);
  const HISTORY_LIMIT = 10;

  const loadTests = () => {
    api.get('/api/cat72/tests').then(res => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.tests || []);
      setTests(list);
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

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const runningTests = tests.filter(t => t.state === 'running');
  const awaitingTests = tests.filter(t => t.state === 'scheduled');
  const completedTests = tests.filter(t => t.state === 'completed');
  const unresolvedFails = completedTests.filter(t => t.result === 'FAIL' && !t.retest_initiated);
  const passedCount = completedTests.filter(t => t.result === 'PASS').length;
  const activeTests = [...runningTests, ...awaitingTests];
  const paginatedHistory = completedTests.slice(historyOffset, historyOffset + HISTORY_LIMIT);

  const isAdmin = user?.role === 'admin';

  const statBlock = (value, label, color) => (
    <div style={{padding: '20px 16px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, textAlign: 'center'}}>
      <div style={{fontFamily: styles.serif, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 200, color: color}}>{value}</div>
      <div style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '6px'}}>{label}</div>
    </div>
  );

  const thStyle = {fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400, padding: '11px 16px', textAlign: 'left'};

  return (
    <div className="space-y-6">
      <div>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, margin: '0 0 8px 0' }}>Testing</p>
        <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0, color: styles.textPrimary }}>CAT-72 Console</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>{isAdmin ? '72-hour Conformance Assurance Tests · Auto-refreshes every 15s' : 'Monitor your 72-hour conformance test in real time'}</p>
      </div>

      {/* ── Stat Blocks ── */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '12px'}}>
        {statBlock(runningTests.length, 'Running', runningTests.length > 0 ? styles.accentAmber : styles.textDim)}
        {statBlock(awaitingTests.length, 'Awaiting Interlock', awaitingTests.length > 0 ? styles.purpleBright : styles.textDim)}
        {statBlock(passedCount, 'Passed', passedCount > 0 ? styles.accentGreen : styles.textDim)}
        {statBlock(unresolvedFails.length, 'Failed', unresolvedFails.length > 0 ? styles.accentRed : styles.textDim)}
      </div>

      {/* ── Live Tests ── */}
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
                <Panel>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px'}}>
                    <div>
                      <div style={{fontWeight: 500, fontSize: '16px', color: styles.textPrimary, marginBottom: '4px'}}>{test.organization_name} — {test.system_name}</div>
                      <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>Test ID: {test.test_id} · Duration: {test.duration_hours}h</div>
                    </div>
                    {isAdmin && <button onClick={() => handleStop(test.test_id)} disabled={loading[test.test_id]} style={{background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentAmber, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 3, padding: '6px 14px'}}>
                      {loading[test.test_id] === 'stopping' ? '...' : 'Stop & Evaluate'}
                    </button>}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px'}}>
                    <div style={{fontFamily: styles.mono, fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, color: styles.purpleBright, letterSpacing: '2px'}}>{formatTime(test.elapsed_seconds)}</div>
                    <div style={{flex: 1, height: '6px', background: styles.borderSubtle, borderRadius: 3, overflow: 'hidden'}}>
                      <div style={{width: pct + '%', height: '100%', background: pct >= 100 ? styles.accentGreen : styles.purplePrimary, transition: 'width 1s linear'}} />
                    </div>
                    <span style={{fontFamily: styles.mono, fontSize: '14px', color: pct >= 100 ? styles.accentGreen : styles.textSecondary, fontWeight: 500}}>{pct}%</span>
                  </div>
                  <div style={{display: 'flex', gap: '24px'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary}}>Remaining: {formatTime(remaining)}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary}}>Telemetry: {test.telemetry_count || 0} events</span>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: test.violations_count > 0 ? styles.accentAmber : styles.textTertiary}}>
                      {(test.violations_count || 0) > 0 ? test.violations_count + ' interventions' : '0 boundary events'}
                    </span>
                  </div>
                </Panel>
                <AuditTrailView logs={telemetryLogs[test.test_id] || []} certNumber={test.certificate_number} nodeId="0847" />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Awaiting Interlock ── */}
      {awaitingTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>Awaiting Interlock Deployment</h2>
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            {awaitingTests.map(test => (
              <div key={test.id} style={{padding: '14px 16px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
                <div>
                  <div style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '2px', cursor: 'pointer'}} onClick={() => navigate('/applications/' + test.application_id)}>{test.organization_name} — {test.system_name}</div>
                  <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>{test.test_id} · {test.duration_hours}h test</div>
                </div>
                <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.accentAmber, padding: '3px 8px', border: '1px solid ' + styles.accentAmber + '30', borderRadius: 3}}>Awaiting customer deployment</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Needs Attention (unresolved failures) ── */}
      {unresolvedFails.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentRed, marginBottom: '16px'}}>Needs Attention</h2>
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            {unresolvedFails.map(test => (
              <div key={test.id} style={{padding: '14px 16px', background: styles.cardSurface, border: '1px solid ' + styles.accentRed + '30', display: 'flex', cursor: 'pointer', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}} onClick={() => navigate('/applications/' + test.application_id)}>
                <div>
                  <div style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '2px', cursor: 'pointer'}} onClick={() => navigate('/applications/' + test.application_id)}>{test.organization_name} — {test.system_name}</div>
                  <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>{test.test_id} · Failed {formatDate(test.ended_at)}</div>
                  {test.result_notes && <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.accentRed, marginTop: '4px'}}>{test.result_notes}</div>}
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 500, color: styles.accentRed, padding: '3px 8px', background: 'rgba(180,52,52,0.06)'}}>FAIL</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Completed History ── */}
      {completedTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Completed History</h2>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{borderBottom: '1px solid ' + styles.borderGlass}}>
                  <th style={thStyle}>System</th>
                  <th style={thStyle}>Result</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Completed</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map(test => (
                  <tr key={test.id} onClick={() => navigate('/applications/' + test.application_id)} style={{borderBottom: '1px solid ' + styles.borderGlass, cursor: 'pointer', transition: 'background 0.15s'}} onMouseEnter={e => e.currentTarget.style.background = styles.surfaceAlt || '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{padding: '12px 16px'}}>
                      <div style={{fontWeight: 500, color: styles.textPrimary}}>{test.organization_name} — {test.system_name}</div>
                      <div style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>{test.test_id}</div>
                    </td>
                    <td style={{padding: '12px 16px'}}>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 500, color: test.result === 'PASS' ? styles.accentGreen : styles.accentRed, padding: '3px 8px', background: test.result === 'PASS' ? 'rgba(22,135,62,0.06)' : 'rgba(180,52,52,0.06)'}}>{test.result}</span>
                    </td>
                    <td style={{padding: '12px 16px', fontFamily: styles.mono, fontSize: '12px', color: styles.textSecondary}}>{formatTime(test.elapsed_seconds)}</td>
                    <td style={{padding: '12px 16px', fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary}}>{formatDate(test.ended_at)}</td>
                    <td style={{padding: '12px 16px', fontFamily: styles.mono, fontSize: '12px', color: styles.textSecondary}}>{test.convergence_score ? test.convergence_score.toFixed(1) + '%' : '—'}</td>
                    <td style={{padding: '12px 16px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {isAdmin && test.result === 'PASS' && !test.certificate_issued && (
                          <button onClick={() => handleIssueCertificate(test.test_id)} disabled={loading[test.test_id]} style={{background: 'transparent', border: 'none', borderBottom: '1px solid ' + styles.purpleBright, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 0'}}>
                            {loading[test.test_id] === 'issuing' ? '...' : 'Issue Cert'}
                          </button>
                        )}
                        {test.certificate_issued && (
                          <>
                            <span style={{color: styles.accentGreen, fontFamily: styles.mono, fontSize: '10px'}}>✓ Certified</span>
                            <a href={`${API_BASE}/api/certificates/${test.certificate_number || test.test_id}/pdf`} target="_blank" rel="noreferrer noopener" style={{padding: '2px 0', background: 'transparent', borderBottom: '1px solid ' + styles.purpleBright, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '9px', textDecoration: 'none'}}>PDF</a>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={completedTests.length} limit={HISTORY_LIMIT} offset={historyOffset} onChange={setHistoryOffset} />
        </Panel>
      )}

      {/* ── Empty State ── */}
      {tests.length === 0 && (
        <Panel>
          <div style={{textAlign: 'center', padding: '48px 20px', color: styles.textTertiary}}>
            <p style={{marginBottom: '8px'}}>{isAdmin ? 'No tests yet' : 'No active tests'}</p>
            <p style={{fontSize: '13px'}}>{isAdmin ? 'Approve an application and deploy the ENVELO Interlock to start a CAT-72 test.' : 'When your application is approved and the Interlock is deployed, your 72-hour test will begin automatically.'}</p>
          </div>
        </Panel>
      )}
    </div>
  );
}

export default CAT72Console;
