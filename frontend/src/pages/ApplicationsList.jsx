import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import { api } from '../config/api';
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
      <div style={{background:'#120c1e',border:'1px solid rgba(157,140,207,0.2)',padding:'32px',maxWidth:'min(700px, 95vw)',width:'100%',maxHeight:'80vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <h3 style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px',fontWeight:400,margin:0,letterSpacing:'2px',textTransform:'uppercase',color:'#a896d6'}}>Bulk Import — {boundaryType}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.50)',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          {['json','csv'].map(f => (<button key={f} onClick={() => {setFormat(f); setError(''); setPreview(null);}} style={{padding:'6px 16px',border:'1px solid '+(format===f?'#a896d6':'rgba(255,255,255,0.1)'),background:format===f?'rgba(91,75,138,0.25)':'transparent',color:format===f?'#a896d6':'rgba(255,255,255,.60)',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer'}}>{f}</button>))}
          <button onClick={() => setRaw(templates[boundaryType]?.[format] || '')} style={{marginLeft:'auto',padding:'6px 12px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,.60)',fontSize:'11px',cursor:'pointer'}}>Load Example</button>
        </div>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={10} placeholder={format === 'json' ? 'Paste JSON array of boundaries...' : 'Paste CSV with header row...'} style={{width:'100%',background: 'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,0.1)',padding:'12px',color:'rgba(255,255,255,.90)',fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'12px',lineHeight:'1.5',resize:'vertical',outline:'none'}} />
        {error && <p style={{color:'#D65C5C',fontSize:'12px',marginTop:'8px'}}>⚠ {error}</p>}
        <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
          <button onClick={parseData} style={{padding:'8px 20px',border:'1px solid #a896d6',background:'transparent',color:'#a896d6',fontSize:'12px',cursor:'pointer'}}>Preview</button>
          {preview && <button onClick={() => { onImport(preview); onClose(); setRaw(''); setPreview(null); }} style={{padding:'8px 20px',border:'none',background: 'transparent',color: 'rgba(255,255,255,.94)',fontSize:'12px',cursor:'pointer',fontWeight:500}}>Import {preview.length} {preview.length === 1 ? 'boundary' : 'boundaries'}</button>}
        </div>
        {preview && (<div style={{marginTop:'16px',background:'transparent',padding:'12px',maxHeight:'200px',overflowY:'auto'}}>
          <p style={{fontFamily:"Consolas, 'IBM Plex Mono', monospace",fontSize:'10px',color:'rgba(255,255,255,.50)',marginBottom:'8px'}}>PREVIEW ({preview.length} rows)</p>
          {preview.map((row, i) => (<div key={i} style={{fontSize:'11px',color:'rgba(255,255,255,.60)',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>{Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(' · ')}</div>))}
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
    { key: 'approved', label: 'Awaiting Deploy' },
    { key: 'testing', label: 'CAT-72 Active' },
    { key: 'conformant', label: 'Certified' },
    { key: 'revoked', label: 'Suspended' },
  ];

  const filtered = applications;

  const stateColor = (state) => {
    if (state === 'conformant') return '#5CD685';
    if (state === 'revoked' || state === 'suspended') return '#D65C5C';
    if (state === 'testing' || state === 'approved') return '#a896d6';
    return '#D6A05C';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '8px'}}>{user?.role === 'admin' ? 'Conformance' : 'My Organization'}</p>
          <h1 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 400, margin: 0, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.94)'}}>{user?.role === 'admin' ? 'Applications' : 'Certification Status'}</h1>
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
                    {app.state === 'conformant' && (
                      <span style={{color: '#5CD685', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px'}}>✓ Certified</span>
                    )}
                    {app.state === 'testing' && (
                      <Link to="/cat72" className="px-2 py-1 no-underline btn">View CAT-72</Link>
                    )}
                    {['pending','under_review','approved','testing','conformant'].includes(app.state) && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'suspended', `Suspend ${app.system_name}`); }} className="btn" style={{padding: '4px 10px', color: '#D65C5C'}}>Suspend</button>
                    )}
                    {(app.state === 'suspended' || app.state === 'revoked') && (
                      <button onClick={(e) => { e.stopPropagation(); handleQuickAdvance(app.id, 'pending', `Reinstate ${app.system_name} to pending`); }} className="btn" style={{padding: '4px 10px', color: '#5CD685'}}>Reinstate</button>
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
              <button onClick={() => handleBulkAction('suspend', 'suspended')} disabled={bulkLoading} className="btn" style={{padding: '6px 14px', color: '#D65C5C'}}>Suspend</button>
              <button onClick={() => handleBulkAction('reinstate', 'pending')} disabled={bulkLoading} className="btn" style={{padding: '6px 14px', color: 'var(--accent-green)'}}>Reinstate</button>
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



export { BulkImportModal };
export default ApplicationsList;

