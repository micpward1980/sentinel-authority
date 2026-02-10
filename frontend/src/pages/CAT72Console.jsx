import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';

function CAT72Console() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [showLive, setShowLive] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const toast = useToast();
  const [loading, setLoading] = useState({});
  const [now, setNow] = useState(Date.now());

  const loadTests = () => {
    api.get('/api/cat72/tests').then(res => setTests(res.data)).catch(console.error);
    api.get('/api/envelo/monitoring/overview').then(res => {
      const sessions = (res.data.sessions || []).filter(s => s.session_type === 'cat72_test');
      setLiveSessions(sessions);
    }).catch(console.error);
  };

  useEffect(() => {
    loadTests();
    const dataInterval = setInterval(loadTests, 60000);
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
        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '8px'}}>Testing</p>
        <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>CAT-72 Console</h1>
        <p style={{color: 'rgba(255,255,255,.78)', marginTop: '8px'}}>{user?.role === 'admin' ? '72-hour Convergence Authorization Tests · Auto-refreshes every 15s' : 'Monitor your 72-hour conformance test in real time'}</p>
      </div>

      {/* Summary Stats */}
      <div style={{display:"flex",gap:"16px",marginBottom:"16px"}}>
        <button onClick={() => setShowLive(false)} style={{background:!showLive?"rgba(91,75,138,0.25)":"transparent",border:"1px solid rgba(91,75,138,0.3)",color:!showLive?"rgba(255,255,255,.94)":"rgba(255,255,255,.50)",padding:"6px 16px",fontFamily:"Consolas, monospace",fontSize:"10px",textTransform:"uppercase",letterSpacing:"1px",cursor:"pointer"}}>Scheduled Tests</button>
        <button onClick={() => setShowLive(true)} style={{background:showLive?"rgba(91,75,138,0.25)":"transparent",border:"1px solid rgba(91,75,138,0.3)",color:showLive?"rgba(255,255,255,.94)":"rgba(255,255,255,.50)",padding:"6px 16px",fontFamily:"Consolas, monospace",fontSize:"10px",textTransform:"uppercase",letterSpacing:"1px",cursor:"pointer"}}>Live Agent Sessions</button>
      </div>

      {showLive ? (
        <><input type="text" placeholder="Search sessions..." value={catSearch} onChange={e => setCatSearch(e.target.value)} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.90)",padding:"6px 12px",fontFamily:"Consolas, monospace",fontSize:"11px",width:"200px",outline:"none",marginBottom:"12px"}} /><LiveSessionsPanel sessions={liveSessions} search={catSearch} /></>
      ) : (<>
      {/* Running Tests — Card View */}
      {runningTests.length > 0 && (
        <div>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#D6A05C', marginBottom: '12px'}}>● Live Tests</h2>
          <div className="space-y-4">
            {runningTests.map(test => {
              const totalSec = test.duration_hours * 3600;
              const pct = Math.min(100, Math.round((test.elapsed_seconds / totalSec) * 100));
              const remaining = Math.max(0, totalSec - test.elapsed_seconds);
              return (
                <Panel key={test.id}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px'}}>
                    <div>
                      <div style={{fontWeight: 500, fontSize: '16px', color: 'rgba(255,255,255,.94)', marginBottom: '4px'}}>{test.organization_name} — {test.system_name}</div>
                      <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>Test ID: {test.test_id} · Duration: {test.duration_hours}h</div>
                    </div>
                    {user?.role === 'admin' && <button onClick={() => handleStop(test.test_id)} disabled={loading[test.test_id]} className="px-4 py-2 btn">
                      {loading[test.test_id] === 'stopping' ? '...' : 'Stop & Evaluate'}
                    </button>}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px'}}>
                    <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, color: '#a896d6', letterSpacing: '2px'}}>{formatTime(test.elapsed_seconds)}</div>
                    <div style={{flex: 1}}>
                      <div className="w-full h-3 overflow-hidden" style={{background: 'transparent'}}>
                        <div className="h-full transition-all" style={{width: `${pct}%`, background: pct >= 100 ? '#5CD685' : '#5B4B8A'}} />
                      </div>
                    </div>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '14px', color: pct >= 100 ? '#5CD685' : 'rgba(255,255,255,.78)', fontWeight: 500}}>{pct}%</span>
                  </div>
                  <div style={{display: 'flex', gap: '24px'}}>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)'}}>Remaining: {formatTime(remaining)}</span>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)'}}>Telemetry: {test.telemetry_count || 0} events</span>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: test.violations_count > 0 ? '#D65C5C' : 'rgba(255,255,255,.50)'}}>Violations: {test.violations_count || 0}</span>
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
          <div className="hud-label" style={{marginBottom: '16px'}}>Scheduled</div>
          <div className="space-y-3">
            {scheduledTests.map(test => (
              <div key={test.id} style={{padding: '14px 16px', background: 'transparent', border: `1px solid ${'rgba(255,255,255,.07)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
                <div>
                  <div style={{fontWeight: 500, color: 'rgba(255,255,255,.94)', marginBottom: '2px'}}>{test.organization_name} — {test.system_name}</div>
                  <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>{test.test_id} · {test.duration_hours}h test</div>
                </div>
                {user?.role === 'admin' && <button onClick={() => handleStart(test.test_id)} disabled={loading[test.test_id]} className="px-4 py-2 btn">
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
          <div className="hud-label" style={{marginBottom: '16px'}}>Completed</div>
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Result</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Duration</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedTests.map(test => (
                <tr key={test.id} style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
                  <td className="px-4 py-4">
                    <div style={{fontWeight: 500, color: 'rgba(255,255,255,.94)'}}>{test.organization_name} — {test.system_name}</div>
                    <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', marginTop: '2px'}}>{test.test_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: test.result === 'PASS' ? '#5CD685' : '#D65C5C', padding: '4px 10px', background: test.result === 'PASS' ? 'rgba(92,214,133,0.04)' : 'rgba(214,92,92,0.04)'}}>{test.result}</span>
                  </td>
                  <td className="px-4 py-4" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(255,255,255,.78)'}}>{formatTime(test.elapsed_seconds)}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {user?.role === 'admin' && test.result === 'PASS' && !test.certificate_issued && (
                        <button onClick={() => handleIssueCertificate(test.test_id)} disabled={loading[test.test_id]} className="px-3 py-1 btn">
                          {loading[test.test_id] === 'issuing' ? '...' : 'Issue Certificate'}
                        </button>
                      )}
                      {test.certificate_issued && (
                        <><span style={{color: '#5CD685', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px'}}>✓ Certified</span><a href={`${API_BASE}/api/certificates/${test.certificate_number || test.test_id}/pdf`} target="_blank" style={{marginLeft: '8px', padding: '2px 8px', background: '#5B4B8A', color: 'rgba(255,255,255,.94)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', textDecoration: 'none'}}>PDF</a></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      </>)}

      {!showLive && tests.length === 0 && (
        <Panel>
          <div className="text-center py-12" style={{color: 'rgba(255,255,255,.50)'}}>
            <p style={{marginBottom: '8px'}}>{user?.role === 'admin' ? 'No tests yet' : 'No active tests'}</p>
            <p style={{fontSize: '13px'}}>{user?.role === 'admin' ? 'Approve an application and schedule a CAT-72 test to get started.' : 'When your application is approved and a CAT-72 test is scheduled, you can monitor its progress here in real time.'}</p>
          </div>
        </Panel>
      )}
    </div>
  );
}

// Certificates

function LiveSessionsPanel({ sessions, search }) {
  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.session_id.toLowerCase().includes(q) || (s.organization_name||"").toLowerCase().includes(q) || (s.system_name||"").toLowerCase().includes(q);
  });
  if (!filtered.length) return <div style={{padding:'20px',textAlign:'center',color:'rgba(255,255,255,.4)',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px'}}>No active CAT-72 agent sessions</div>;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
      {filtered.map(s => {
        const total = (s.pass_count || 0) + (s.block_count || 0);
        const rate = total > 0 ? ((s.pass_count || 0) / total * 100).toFixed(1) : '0.0';
        const isOnline = s.is_online;
        return (
          <div key={s.session_id} style={{padding:'12px 16px',background:'rgba(91,75,138,0.08)',border:'1px solid rgba(91,75,138,0.15)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <span style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px',color:isOnline?'#5CD685':'rgba(255,255,255,.50)'}}>● {isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                <span style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px',color:'rgba(255,255,255,.80)',marginLeft:'12px'}}>{s.organization_name || 'Unknown'} — {s.system_name || s.session_id.slice(0,16)}</span>
                <span style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'9px',color:'rgba(255,255,255,.35)',marginLeft:'8px'}}>{s.session_id.slice(0,12)}...</span>
              </div>
              <div style={{display:'flex',gap:'16px'}}>
                <span style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'10px',color:'rgba(255,255,255,.50)'}}>Actions: {total.toLocaleString()}</span>
                <span style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'10px',color:parseFloat(rate)>=98?'#5CD685':'#D6A35C'}}>Pass: {rate}%</span>
                <span style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'10px',color:'rgba(255,255,255,.50)'}}>Uptime: {s.uptime_hours || 0}h</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CAT72Console;

