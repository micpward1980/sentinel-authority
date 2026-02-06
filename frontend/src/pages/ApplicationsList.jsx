import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Plus } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import EmptyState from '../components/EmptyState';

function BulkImportModal({ isOpen, onClose, onImport, boundaryType }) {
  const [raw, setRaw] = React.useState('');
  const [format, setFormat] = React.useState('json');
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(null);

  const templates = {
    numeric: { json: '[{"name":"Speed Limit","parameter":"speed","min_value":0,"max_value":100,"unit":"km/h","tolerance":5}]', csv: 'name,parameter,min_value,max_value,hard_limit,unit,tolerance\nSpeed Limit,speed,0,100,120,km/h,5' },
    geo: { json: '[{"name":"Operating Zone","boundary_type":"circle","lat":30.123,"lon":-97.456,"radius_meters":500}]', csv: 'name,boundary_type,lat,lon,radius_meters,altitude_max\nOperating Zone,circle,30.123,-97.456,500,120' },
    time: { json: '[{"name":"Business Hours","start_hour":6,"end_hour":22,"timezone":"America/Chicago","days":[0,1,2,3,4]}]', csv: 'name,start_hour,end_hour,timezone,days\nBusiness Hours,6,22,America/Chicago,0;1;2;3;4' },
    state: { json: '[{"name":"Mode Check","parameter":"mode","allowed_values":"autonomous,semi-auto","forbidden_values":"manual_override"}]', csv: 'name,parameter,allowed_values,forbidden_values\nMode Check,mode,"autonomous,semi-auto",manual_override' }
  };

  const parseData = () => {
    setError(''); setPreview(null);
    try {
      let rows = [];
      if (format === 'json') {
        const parsed = JSON.parse(raw);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const lines = raw.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV needs header + data rows');
        const headers = lines[0].split(',').map(h => h.trim());
        rows = lines.slice(1).map(line => {
          const vals = line.match(/(".*?"|[^,]+)/g) || [];
          const obj = {};
          headers.forEach((h, i) => {
            let v = (vals[i] || '').replace(/^"|"$/g, '').trim();
            if (h === 'days') { obj[h] = v.split(';').map(Number); }
            else if (['min_value','max_value','hard_limit','tolerance','lat','lon','radius_meters','altitude_min','altitude_max','start_hour','end_hour'].includes(h)) { obj[h] = v === '' ? '' : v; }
            else { obj[h] = v; }
          });
          return obj;
        });
      }
      if (rows.length === 0) throw new Error('No data found');
      setPreview(rows);
    } catch (e) { setError(e.message); }
  };

  if (!isOpen) return null;
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={onClose}>
      <div style={{background:'#1a1a2e',border:'1px solid rgba(157,140,207,0.2)',borderRadius:'16px',padding:'32px',maxWidth:'min(700px, 95vw)',width:'100%',maxHeight:'80vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <h3 style={{fontFamily:"Georgia, 'Source Serif 4', serif",fontSize:'20px',fontWeight:200,margin:0}}>Bulk Import — {boundaryType}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#6a6a80',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          {['json','csv'].map(f => (<button key={f} onClick={() => {setFormat(f); setError(''); setPreview(null);}} style={{padding:'6px 16px',borderRadius:'6px',border:'1px solid '+(format===f?'#8b5cf6':'rgba(255,255,255,0.1)'),background:format===f?'rgba(139,92,246,0.15)':'transparent',color:format===f?'#8b5cf6':'#a0a0b0',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer'}}>{f}</button>))}
          <button onClick={() => setRaw(templates[boundaryType]?.[format] || '')} style={{marginLeft:'auto',padding:'6px 12px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#a0a0b0',fontSize:'11px',cursor:'pointer'}}>Load Example</button>
        </div>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={10} placeholder={format === 'json' ? 'Paste JSON array of boundaries...' : 'Paste CSV with header row...'} style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'12px',color:'#e8e8f0',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'12px',lineHeight:'1.5',resize:'vertical',outline:'none'}} />
        {error && <p style={{color:'#ef4444',fontSize:'12px',marginTop:'8px'}}>⚠ {error}</p>}
        <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
          <button onClick={parseData} style={{padding:'8px 20px',borderRadius:'8px',border:'1px solid #8b5cf6',background:'transparent',color:'#8b5cf6',fontSize:'12px',cursor:'pointer'}}>Preview</button>
          {preview && <button onClick={() => { onImport(preview); onClose(); setRaw(''); setPreview(null); }} style={{padding:'8px 20px',borderRadius:'8px',border:'none',background:'linear-gradient(135deg,#5B4B8A,#8b5cf6)',color:'#fff',fontSize:'12px',cursor:'pointer',fontWeight:500}}>Import {preview.length} {preview.length === 1 ? 'boundary' : 'boundaries'}</button>}
        </div>
        {preview && (<div style={{marginTop:'16px',background:'rgba(0,0,0,0.2)',borderRadius:'8px',padding:'12px',maxHeight:'200px',overflowY:'auto'}}>
          <p style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'10px',color:'#6a6a80',marginBottom:'8px'}}>PREVIEW ({preview.length} rows)</p>
          {preview.map((row, i) => (<div key={i} style={{fontSize:'11px',color:'#a0a0b0',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>{Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(' · ')}</div>))}
        </div>)}
      </div>
    </div>
  );
}

// New Application Form — Multi-step wizard with structured boundary config

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
    { key: 'approved', label: 'Approved' },
    { key: 'testing', label: 'Testing' },
    { key: 'conformant', label: 'Conformant' },
    { key: 'revoked', label: 'Suspended' },
  ];

  const filtered = applications;

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
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>{user?.role === 'admin' ? 'Conformance' : 'My Organization'}</p>
          <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>{user?.role === 'admin' ? 'Applications' : 'Certification Status'}</h1>
        </div>
        
      </div>

{user?.role === "admin" && <div style={{display: "flex", gap: "12px", alignItems: "center"}}>
        <div style={{position: "relative", flex: 1, maxWidth: 'min(400px, 90vw)'}}>
          <Search className="w-4 h-4" style={{position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: styles.textTertiary}} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, org, or ID..." style={{width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${styles.borderGlass}`, borderRadius: "8px", padding: "8px 12px 8px 36px", color: styles.textPrimary, fontSize: "13px", fontFamily: "Consolas, 'IBM Plex Mono', monospace", outline: "none"}} />
        </div>
        <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: "11px", color: styles.textTertiary}}>{filtered.length} of {appTotal}</span>
      </div>}

      {/* Filter Tabs */}
      {user?.role === 'admin' && (
        <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
          {filters.map(f => {
            const count = f.key === 'all' ? (stateCounts.all || 0) : f.key === 'revoked' ? ((stateCounts.suspended || 0) + (stateCounts.revoked || 0)) : (stateCounts[f.key] || 0);
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                background: filter === f.key ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === f.key ? styles.purpleBright : styles.borderGlass}`,
                color: filter === f.key ? styles.purpleBright : styles.textTertiary,
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
            <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
              {user?.role === 'admin' && <th className="px-2 py-3 text-center" style={{width: '40px'}}><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={e => e.target.checked ? selectAll() : selectNone()} style={{cursor: 'pointer', accentColor: styles.purpleBright}} /></th>}
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System Name</th>
              {user?.role === 'admin' && <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>}
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Submitted</th>
              {user?.role === 'admin' && <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.id} className="transition-colors" style={{borderBottom: `1px solid ${styles.borderGlass}`, background: selected.has(app.id) ? 'rgba(157,140,207,0.08)' : 'transparent'}}>
                {user?.role === 'admin' && <td className="px-2 py-4 text-center"><input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleSelect(app.id)} style={{cursor: 'pointer', accentColor: styles.purpleBright}} /></td>}
                <td className="px-4 py-4">
                  <Link to={`/applications/${app.id}`} style={{color: styles.purpleBright, textDecoration: 'none'}}>{app.system_name}</Link>
                  <div style={{fontSize: '11px', color: styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", marginTop: '2px'}}>{app.application_number}</div>
                </td>
                {user?.role === 'admin' && <td className="px-4 py-4" style={{color: styles.textSecondary}}>{app.organization_name}</td>}
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded" style={{
                    background: `${stateColor(app.state)}20`,
                    color: stateColor(app.state),
                    border: `1px solid ${stateColor(app.state)}40`,
                    fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                  }}>{app.state?.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-4" style={{color: styles.textTertiary, fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
                {user?.role === 'admin' && (
                <td className="px-4 py-4">
                  <div style={{display: 'flex', gap: '6px'}}>
                    {app.state === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'under_review', `Begin review for ${app.system_name}`); }} className="px-2 py-1 rounded" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Review</button>
                    )}
                    {(app.state === 'pending' || app.state === 'under_review') && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'approved', `Approve ${app.system_name}`); }} className="px-2 py-1 rounded" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Approve</button>
                    )}
                    {app.state === 'approved' && (
                      <Link to={`/applications/${app.id}`} className="px-2 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.borderGlass}`, color: styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Schedule Test</Link>
                    )}
                    {app.state === 'conformant' && (
                      <span style={{color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px'}}>✓ Certified</span>
                    )}
                    {app.state === 'testing' && (
                      <Link to="/cat72" className="px-2 py-1 rounded no-underline" style={{background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.borderGlass}`, color: styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>View Test</Link>
                    )}
                    {['pending','under_review','approved','testing','conformant'].includes(app.state) && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'suspended', `Suspend ${app.system_name}`); }} className="px-2 py-1 rounded" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Suspend</button>
                    )}
                    {(app.state === 'suspended' || app.state === 'revoked') && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'pending', `Reinstate ${app.system_name} to pending`); }} className="px-2 py-1 rounded" style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Reinstate</button>
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
            background: 'rgba(18,12,30,0.95)', backdropFilter: 'blur(12px)',
            border: `1px solid ${styles.purpleBright}`, borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>
              {selected.size} selected
            </span>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <button onClick={() => handleBulkAction('approve', 'approved')} disabled={bulkLoading} style={{padding: '6px 14px', borderRadius: '6px', background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Approve</button>
              <button onClick={() => handleBulkAction('review', 'under_review')} disabled={bulkLoading} style={{padding: '6px 14px', borderRadius: '6px', background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: '#D6A05C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Review</button>
              <button onClick={() => handleBulkAction('suspend', 'suspended')} disabled={bulkLoading} style={{padding: '6px 14px', borderRadius: '6px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Suspend</button>
              <button onClick={() => handleBulkAction('reinstate', 'pending')} disabled={bulkLoading} style={{padding: '6px 14px', borderRadius: '6px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Reinstate</button>
              <div style={{width: '1px', height: '20px', background: styles.borderGlass, margin: '0 4px'}} />
              <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading} style={{padding: '6px 14px', borderRadius: '6px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Delete</button>
              <button onClick={selectNone} style={{padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Cancel</button>
              {bulkLoading && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>Processing...</span>}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <EmptyState icon={FileText} title="No Applications Found" description={applications.length === 0 ? "You haven't submitted any certification applications yet. Start your ODDC certification journey." : "No applications match your current filter."}  />
        )}
      </Panel>
    </div>
  );
}



export { BulkImportModal };
export default ApplicationsList;

