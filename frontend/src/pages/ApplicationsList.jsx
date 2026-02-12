import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import EmptyState from '../components/EmptyState';

function ApplicationsList() {
  const toast = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [applications, setApplications] = useState([]);
  const [appTotal, setAppTotal] = useState(0);
  const [stateCounts, setStateCounts] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAll = () => setSelected(new Set(filtered.map(a => a.id)));
  const selectNone = () => setSelected(new Set());

  const handleBulkAction = async (action, newState) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const label = action === 'delete' ? `Delete ${ids.length} application(s)?` : `${action} ${ids.length} application(s)?`;
    if (!await confirm({title: 'Confirm', message: label})) return;
    setBulkLoading(true);
    try {
      if (action === 'delete') {
        await api.post('/api/applications/bulk-delete', { ids });
      } else {
        await api.post('/api/applications/bulk-state', { ids, new_state: newState });
      }
      setSelected(new Set());
      loadApps();
    } catch (err) {
      toast.show('Bulk operation failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setBulkLoading(false);
  };

  const loadApps = (search = '', state = 'all') => {
    const params = {};
    if (search) params.search = search;
    if (state && state !== 'all') params.state = state;
    api.get('/api/applications/', { params }).then(res => {
      setApplications(res.data.applications || res.data);
      setAppTotal(res.data.total ?? (res.data.applications || res.data).length);
      setStateCounts(res.data.state_counts || {});
    }).catch(console.error);
  };

  useEffect(() => { loadApps(); }, []);

  // Debounced server-side search
  useEffect(() => {
    const timer = setTimeout(() => { loadApps(searchQuery, filter); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filter]);

  const handleQuickAdvance = async (appId, newState, label) => {
    if (!await confirm({title: 'Confirm', message: label + '?'})) return;
    try {
      await api.patch(`/api/applications/${appId}/state?new_state=${newState}`);
      loadApps();
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'under_review', label: 'Review' },
    { key: 'approved', label: 'Awaiting Deploy' },
    { key: 'failed', label: 'Failed' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const filtered = applications;

  const stateColor = (state) => {
    if (state === 'conformant') return '#5CD685';
    if (state === 'revoked' || state === 'suspended' || state === 'failed' || state === 'rejected') return '#D65C5C';
    if (state === 'testing' || state === 'approved') return '#a896d6';
    return '#D6A05C';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px'}}><span style={{width:'24px',height:'1px',background:'#a896d6'}}></span>{user?.role === 'admin' ? 'Conformance' : 'My Organization'}</p>
          <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 200, margin: 0, letterSpacing: '-0.02em', color: 'rgba(255,255,255,.94)'}}>{user?.role === 'admin' ? 'Applications' : 'Certification Status'}</h1>
        </div>
        
      </div>

{user?.role === "admin" && <div style={{display: "flex", gap: "12px", alignItems: "center"}}>
        <div style={{position: "relative", flex: 1, maxWidth: 'min(400px, 90vw)'}}>
          <Search className="w-4 h-4" style={{position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: 'rgba(255,255,255,.50)'}} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, org, or ID..." style={{width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${'rgba(255,255,255,.07)'}`, padding: "8px 12px 8px 36px", color: 'rgba(255,255,255,.94)', fontSize: "13px", fontFamily: "Consolas, 'IBM Plex Mono', monospace", outline: "none"}} />
        </div>
        <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: "11px", color: 'rgba(255,255,255,.50)'}}>{filtered.length} of {appTotal}</span>
      </div>}

      {/* Filter Tabs */}
      {user?.role === 'admin' && (
        <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
          {filters.map(f => {
            const count = f.key === 'all' ? (stateCounts.all || 0) : f.key === 'revoked' ? ((stateCounts.suspended || 0) + (stateCounts.revoked || 0)) : (stateCounts[f.key] || 0);
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 14px', cursor: 'pointer',
                fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                background: filter === f.key ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === f.key ? '#a896d6' : 'rgba(255,255,255,.07)'}`,
                color: filter === f.key ? '#a896d6' : 'rgba(255,255,255,.50)'
              }}>
                {f.label} {count > 0 ? `(${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      <Panel>
        <div style={{overflowX: "auto", WebkitOverflowScrolling: "touch"}}><table className="w-full" style={{minWidth: "700px"}}>
          <thead>
            <tr style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
              {user?.role === 'admin' && <th className="px-2 py-3 text-center" style={{width: '40px'}}><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={e => e.target.checked ? selectAll() : selectNone()} style={{cursor: 'pointer', accentColor: '#a896d6'}} /></th>}
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>System Name</th>
              {user?.role === 'admin' && <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Organization</th>}
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>State</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Submitted</th>
              {user?.role === 'admin' && <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.id} className="transition-colors" style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`, background: selected.has(app.id) ? 'rgba(157,140,207,0.08)' : 'transparent'}}>
                {user?.role === 'admin' && <td className="px-2 py-4 text-center"><input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelect(app.id)} style={{cursor: 'pointer', accentColor: '#a896d6'}} /></td>}
                <td className="px-4 py-4">
                  <Link to={`/applications/${app.id}`} style={{color: '#a896d6', textDecoration: 'none'}}>{app.system_name}</Link>
                  <div style={{fontSize: '11px', color: 'rgba(255,255,255,.50)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", marginTop: '2px'}}>{app.application_number}</div>
                </td>
                {user?.role === 'admin' && <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.78)'}}>{app.organization_name}</td>}
                <td className="px-4 py-4">
                  <span className="px-2 py-1" style={{
                    background: `${stateColor(app.state)}06`,
                    color: stateColor(app.state),
                    border: `1px solid ${stateColor(app.state)}10`,
                    fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'
                  }}>{app.state === 'approved' ? 'Awaiting Deploy' : app.state === 'conformant' ? 'Certified' : app.state === 'testing' ? 'CAT-72 Active' : app.state === 'under_review' ? 'In Review' : app.state?.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.50)', fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
                {user?.role === 'admin' && (
                <td className="px-4 py-4">
                  <div style={{display: 'flex', gap: '6px'}}>
                    {app.state === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`); }} className="btn" style={{padding: '4px 10px', color: '#D6A05C'}}>Review</button>
                    )}
                    {(app.state === 'pending' || app.state === 'under_review') && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`); }} className="btn" style={{padding: '4px 10px', color: '#5CD685'}}>Approve</button>
                    )}
                    {app.state === 'approved' && (
                      <Link to={`/applications/${app.id}`} className="px-2 py-1 no-underline btn">Schedule CAT-72</Link>
                    )}


                    {['pending','under_review','approved'].includes(app.state) && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'suspended', `Suspend ${app.system_name}`); }} className="btn" style={{padding: '4px 10px', color: '#D65C5C'}}>Withdraw</button>
                    )}
                  </div>
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
        {/* Bulk Action Bar */}
        {selected.size > 0 && user?.role === 'admin' && (
          <div style={{
            position: 'sticky', bottom: '16px', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
            padding: '12px 20px', margin: '16px',
            background: 'rgba(18,12,30,0.95)',
            border: `1px solid ${'#a896d6'}` }}>
            <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: '#a896d6'}}>
              {selected.size} selected
            </span>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button onClick={() => handleBulkAction('approve', 'approved')} disabled={bulkLoading} className="btn" style={{padding: '6px 14px', color: 'var(--accent-green)'}}>Approve</button>
              <button onClick={() => handleBulkAction('review', 'under_review')} disabled={bulkLoading} className="btn" style={{padding: '6px 14px', color: '#D6A05C'}}>Review</button>
              <button onClick={() => handleBulkAction('withdraw', 'suspended')} disabled={bulkLoading} className="btn" style={{padding: '6px 14px', color: '#D65C5C'}}>Withdraw</button>
              <div style={{width: '1px', height: '20px', background: 'rgba(255,255,255,.07)', margin: '0 4px'}} />
              <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading} className="btn" style={{padding: '6px 14px', color: '#D65C5C'}}>Delete</button>
              <button onClick={selectNone} className="btn">Cancel</button>
              {bulkLoading && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)'}}>Processing...</span>}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <EmptyState icon={FileText} title="No Applications Found" description={applications.length === 0 ? "No ODDC certification applications submitted yet." : "No applications match your current filter."}  />
        )}
      </Panel>
    </div>
  );
}



export default ApplicationsList;

