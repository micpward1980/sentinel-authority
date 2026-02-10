import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Panel from '../components/Panel';
import { Link } from 'react-router-dom';

function CAT72Console() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [catSearch, setCatSearch] = useState('');
  const toast = useToast();
  const [loading, setLoading] = useState({});
  const [completedPage, setCompletedPage] = useState(1);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedResultFilter, setCompletedResultFilter] = useState('');
  const [completedSort, setCompletedSort] = useState('created_at');
  const [now, setNow] = useState(Date.now());

  const loadCompleted = () => {
    const params = new URLSearchParams({ page: completedPage, per_page: 25, state: 'completed', sort: completedSort, order: 'desc' });
    if (completedSearch) params.set('search', completedSearch);
    if (completedResultFilter) params.set('result_filter', completedResultFilter);
    api.get(`/api/cat72/tests?${params}`).then(res => {
      const data = res.data;
      if (data.tests) {
        setTests(prev => {
          const nonCompleted = prev.filter(t => t.state !== 'completed');
          return [...nonCompleted, ...data.tests];
        });
        setCompletedTotal(data.pagination?.pages || 1);
      }
    }).catch(console.error);
  };

  useEffect(() => { loadCompleted(); }, [completedPage, completedSearch, completedResultFilter, completedSort]);

  const loadTests = () => {
    api.get('/api/cat72/tests?per_page=100').then(res => setTests(res.data.tests || res.data)).catch(console.error);
    api.get('/api/envelo/monitoring/overview').then(res => {
      const sessions = (res.data.sessions || []).filter(s => s.session_type === 'cat72_test');
      setLiveSessions(sessions);
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
        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '8px'}}>Testing</p>
        <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>CAT-72 Console</h1>
        <p style={{color: 'rgba(255,255,255,.78)', marginTop: '8px'}}>{user?.role === 'admin' ? '72-hour Conformance Authorization Tests · Auto-refreshes every 15s' : 'Monitor your 72-hour conformance test in real time'}</p>
      </div>

      {/* Summary Stats */}
      <div style={{display:"flex",gap:"16px",marginBottom:"16px"}}>
        {['live','scheduled','completed'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{background:activeTab===tab?"rgba(91,75,138,0.25)":"transparent",border:"1px solid rgba(91,75,138,0.3)",color:activeTab===tab?"rgba(255,255,255,.94)":"rgba(255,255,255,.50)",padding:"6px 16px",fontFamily:"Consolas, monospace",fontSize:"10px",textTransform:"uppercase",letterSpacing:"1px",cursor:"pointer"}}>{tab === 'live' ? 'Live CAT-72 Tests' : tab === 'scheduled' ? 'Scheduled Tests' : 'Completed Tests'}</button>
        ))}
      </div>

      {activeTab === 'live' ? (
        <><input type="text" placeholder="Search sessions..." value={catSearch} onChange={e => setCatSearch(e.target.value)} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.90)",padding:"6px 12px",fontFamily:"Consolas, monospace",fontSize:"11px",width:"200px",outline:"none",marginBottom:"12px"}} /><LiveSessionsPanel sessions={liveSessions} search={catSearch} /></>
      ) : activeTab === 'scheduled' ? (<>
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
                      <div className="w-full h-3 overflow-hidden" style={{background: 'rgba(91,75,138,0.15)'}}>
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
        <Panel>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <div className="hud-label">Scheduled</div>
            <input type="text" placeholder="Search..." value={catSearch} onChange={e => setCatSearch(e.target.value)} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.90)',padding:'5px 10px',fontFamily:'Consolas, monospace',fontSize:'10px',width:'160px',outline:'none'}} />
          </div>
          {scheduledTests.filter(t => !catSearch || (t.organization_name||'').toLowerCase().includes(catSearch.toLowerCase()) || (t.system_name||'').toLowerCase().includes(catSearch.toLowerCase()) || (t.test_id||'').toLowerCase().includes(catSearch.toLowerCase())).length === 0 ? (
            <div style={{padding:'20px',textAlign:'center',color:'rgba(255,255,255,.4)',fontFamily:"Consolas, monospace",fontSize:'11px'}}>No scheduled tests{catSearch ? ' matching search' : ''}</div>
          ) : (
          <div className="space-y-3">
            {scheduledTests.filter(t => !catSearch || (t.organization_name||'').toLowerCase().includes(catSearch.toLowerCase()) || (t.system_name||'').toLowerCase().includes(catSearch.toLowerCase()) || (t.test_id||'').toLowerCase().includes(catSearch.toLowerCase())).map(test => (
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
          )}
        </Panel>

      </>) : (<>
      {/* Completed Tests */}
        <Panel>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'8px'}}>
            <div className="hud-label">Completed Tests</div>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <input type="text" placeholder="Search..." value={completedSearch} onChange={e => { setCompletedSearch(e.target.value); setCompletedPage(1); }} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.90)',padding:'5px 10px',fontFamily:'Consolas, monospace',fontSize:'10px',width:'160px',outline:'none'}} />
              <select value={completedResultFilter} onChange={e => { setCompletedResultFilter(e.target.value); setCompletedPage(1); }} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.90)',padding:'5px 8px',fontFamily:'Consolas, monospace',fontSize:'10px',outline:'none'}}>
                <option value="">All Results</option>
                <option value="PASS">PASS</option>
                <option value="FAIL">FAIL</option>
              </select>
              <select value={completedSort} onChange={e => setCompletedSort(e.target.value)} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.90)',padding:'5px 8px',fontFamily:'Consolas, monospace',fontSize:'10px',outline:'none'}}>
                <option value="created_at">Newest</option>
                <option value="convergence_score">Pass Rate</option>
                <option value="elapsed_seconds">Duration</option>
              </select>
            </div>
          </div>
          {completedTests.length === 0 ? (
            <div style={{padding:'20px',textAlign:'center',color:'rgba(255,255,255,.4)',fontFamily:"Consolas, monospace",fontSize:'11px'}}>No completed tests{completedSearch || completedResultFilter ? ' matching filters' : ''}</div>
          ) : (
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: '1px solid rgba(255,255,255,.07)'}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Result</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Pass Rate</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Duration</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Completed</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedTests.map(test => {
                const totalActs = (test.conformant_samples || 0) + (test.interlock_activations || 0);
                const passRate = totalActs > 0 ? ((test.conformant_samples || 0) / totalActs * 100).toFixed(1) : (test.convergence_score ? test.convergence_score.toFixed(1) : '—');
                return (
                <tr key={test.id} style={{borderBottom: '1px solid rgba(255,255,255,.07)'}}>
                  <td className="px-4 py-4">
                    <div style={{fontWeight: 500, color: 'rgba(255,255,255,.94)'}}>{test.organization_name} — {test.system_name}</div>
                    <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', marginTop: '2px'}}>{test.test_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: test.result === 'PASS' ? '#5CD685' : '#D65C5C', padding: '4px 10px', background: test.result === 'PASS' ? 'rgba(92,214,133,0.04)' : 'rgba(214,92,92,0.04)'}}>{test.result || '—'}</span>
                  </td>
                  <td className="px-4 py-4" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: typeof passRate === 'string' && passRate !== '—' && parseFloat(passRate) >= 95 ? '#5CD685' : '#D6A35C'}}>{passRate}%</td>
                  <td className="px-4 py-4" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(255,255,255,.78)'}}>{formatTime(test.elapsed_seconds)}</td>
                  <td className="px-4 py-4" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.60)'}}>{test.ended_at ? new Date(test.ended_at).toLocaleDateString() : '—'}</td>
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
                );
              })}
            </tbody>
          </table>
          )}
          {completedTotal > 1 && (
            <div style={{display:'flex',justifyContent:'center',gap:'4px',marginTop:'12px'}}>
              <button onClick={() => setCompletedPage(p => Math.max(1, p-1))} disabled={completedPage <= 1} style={{background:'transparent',border:'1px solid rgba(91,75,138,0.3)',color: completedPage <= 1 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.70)',padding:'4px 10px',fontFamily:'Consolas, monospace',fontSize:'10px',cursor: completedPage <= 1 ? 'default' : 'pointer'}}>Prev</button>
              <span style={{fontFamily:'Consolas, monospace',fontSize:'10px',color:'rgba(255,255,255,.50)',padding:'4px 8px'}}>{completedPage} / {completedTotal}</span>
              <button onClick={() => setCompletedPage(p => Math.min(completedTotal, p+1))} disabled={completedPage >= completedTotal} style={{background:'transparent',border:'1px solid rgba(91,75,138,0.3)',color: completedPage >= completedTotal ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.70)',padding:'4px 10px',fontFamily:'Consolas, monospace',fontSize:'10px',cursor: completedPage >= completedTotal ? 'default' : 'pointer'}}>Next</button>
            </div>
          )}
        </Panel>
      </>)}
    </div>
  );
}


function LiveSessionsPanel({ sessions, search }) {
  const [expanded, setExpanded] = useState(null);
  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.session_id.toLowerCase().includes(q) || (s.organization_name||"").toLowerCase().includes(q) || (s.system_name||"").toLowerCase().includes(q);
  });
  if (!filtered.length) return <div style={{padding:'20px',textAlign:'center',color:'rgba(255,255,255,.4)',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px'}}>No active CAT-72 tests</div>;
  const mono = "Consolas, 'IBM Plex Mono', monospace";
  const dim = 'rgba(255,255,255,.50)';
  const green = '#5CD685';
  const amber = '#D6A35C';
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
      <HeartbeatStyle />
      {filtered.map(s => {
        const total = (s.pass_count || 0) + (s.block_count || 0);
        const rate = total > 0 ? ((s.pass_count || 0) / total * 100).toFixed(1) : '0.0';
        const blockRate = total > 0 ? ((s.block_count || 0) / total * 100).toFixed(1) : '0.0';
        const isOnline = s.is_online;
        const isExpanded = expanded === s.session_id;
        const uptimeHrs = parseFloat(s.uptime_hours || 0);
        const pct72 = Math.min((uptimeHrs / 72) * 100, 100).toFixed(1);
        const remaining = Math.max(72 - uptimeHrs, 0).toFixed(1);
        return (
          <div key={s.session_id} onClick={() => setExpanded(isExpanded ? null : s.session_id)} style={{padding:'12px 16px',background: isExpanded ? 'rgba(91,75,138,0.12)' : 'rgba(91,75,138,0.08)',border:'1px solid rgba(91,75,138,0.15)',cursor:'pointer',transition:'background 0.15s'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <span style={{fontFamily:mono,fontSize:'11px',color:isOnline?green:dim}}>● {isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                <span style={{fontFamily:mono,fontSize:'11px',color:'rgba(255,255,255,.80)',marginLeft:'12px'}}>{s.organization_name || 'Unknown'} — {s.system_name || s.session_id.slice(0,16)}</span>
                <span style={{fontFamily:mono,fontSize:'9px',color:'rgba(255,255,255,.25)',marginLeft:'8px'}}>{isExpanded ? '▾' : '▸'}</span>
              </div>
              <div style={{display:'flex',gap:'16px'}}>
                <span style={{fontFamily:mono,fontSize:'10px',color:dim}}>Actions: {total.toLocaleString()}</span>
                <span style={{fontFamily:mono,fontSize:'10px',color:parseFloat(rate)>=98?green:amber}}>Pass: {rate}%</span>
                <span style={{fontFamily:mono,fontSize:'10px',color:dim}}>Uptime: {uptimeHrs.toFixed(1)}h</span>
              </div>
            </div>
            {isExpanded && (
              <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid rgba(91,75,138,0.15)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Session ID</div>
                    <div style={{fontFamily:mono,fontSize:'11px',color:'rgba(255,255,255,.80)'}}>{s.session_id}</div>
                  </div>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Started</div>
                    <div style={{fontFamily:mono,fontSize:'11px',color:'rgba(255,255,255,.80)'}}>{s.started_at ? new Date(s.started_at).toLocaleString() : '—'}</div>
                  </div>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Last Heartbeat</div>
                    <div style={{fontFamily:mono,fontSize:'11px',color:'rgba(255,255,255,.80)',display:'flex',alignItems:'center',gap:'6px'}}>{isOnline && <span style={{display:'inline-block',animation:'heartbeat 1.2s ease-in-out infinite',fontSize:'13px',color:'#D66A6A'}}>♥</span>}{s.last_heartbeat_at ? new Date(s.last_heartbeat_at).toLocaleString() : '—'}</div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'16px',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Pass Count</div>
                    <div style={{fontFamily:mono,fontSize:'14px',color:green}}>{(s.pass_count||0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Block Count</div>
                    <div style={{fontFamily:mono,fontSize:'14px',color:parseInt(s.block_count||0)>0?amber:'rgba(255,255,255,.80)'}}>{(s.block_count||0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Conformance</div>
                    <div style={{fontFamily:mono,fontSize:'14px',color:parseFloat(rate)>=98?green:parseFloat(rate)>=95?amber:'#D66A6A'}}>{rate}%</div>
                  </div>
                  <div>
                    <div style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Violation Rate</div>
                    <div style={{fontFamily:mono,fontSize:'14px',color:parseFloat(blockRate)<=2?green:amber}}>{blockRate}%</div>
                  </div>
                </div>
                <div style={{marginBottom:'4px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontFamily:mono,fontSize:'9px',color:dim,letterSpacing:'1px',textTransform:'uppercase'}}>72-Hour Progress</span>
                    <span style={{fontFamily:mono,fontSize:'9px',color:dim}}>{pct72}% — {remaining}h remaining</span>
                  </div>
                  <div style={{height:'6px',background:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct72}%`,background:parseFloat(pct72)>=100?green:'var(--purple-bright)',transition:'width 0.3s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const HeartbeatStyle = () => <style>{`@keyframes heartbeat { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.3); opacity: 1; } }`}</style>;

export default CAT72Console;

