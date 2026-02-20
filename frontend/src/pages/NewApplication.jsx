import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import Panel from '../components/Panel';
import { BulkImportModal } from './ApplicationsList';
import { SYSTEM_TYPES, DOMAIN_GROUPS } from '../systemTypesData';

function NewApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [error, setError] = useState('');
  const [org, setOrg] = useState({ organization_name: '', contact_name: '', contact_email: '', contact_phone: '' });
  const [sys, setSys] = useState({ system_name: '', system_type: '', system_version: '', manufacturer: '', system_description: '', deployment_type: '', environment: '', integration_method: 'python', expected_volume: '', compliance_requirements: '' });
  const [odd, setOdd] = useState({ odd_description: '', facility_location: '', preferred_test_date: '', temp_min: '', temp_max: '', temp_unit: 'F', weather_constraints: '', surface_type: '', notes: '' });
  const [numericBounds, setNumericBounds] = useState([{ name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' }]);
  const [bulkModal, setBulkModal] = useState({ open: false, type: '' });
  const [customSystemType, setCustomSystemType] = useState('');
  const [geoBounds, setGeoBounds] = useState([{ name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' }]);
  const [timeBounds, setTimeBounds] = useState([{ name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] }]);
  const [stateBounds, setStateBounds] = useState([{ name: '', parameter: '', allowed_values: '', forbidden_values: '' }]);
  const [safety, setSafety] = useState({ violation_action: 'stop', connection_loss_action: 'stop', fail_closed: true, emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '', existing_safety_systems: '', escalation_triggers: '' });
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill org from user profile
  useEffect(() => {
    if (user) {
      setOrg(prev => ({
        ...prev,
        contact_name: prev.contact_name || user.full_name || '',
        contact_email: prev.contact_email || user.email || '',
        organization_name: prev.organization_name || user.organization_name || ''
      }));
    }
  }, [user]);
  
  // ═══ SYSTEM TYPE TEMPLATES ═══
  // boundaryTemplates moved to systemTypesData.js (124 system types)

  const applyTemplate = (systemType) => {
    const st = SYSTEM_TYPES[systemType];
    if (!st || !st.template) return;
    const t = st.template;

    // ── Numeric Boundaries ──
    // Template format: [{ name, min, max, unit, tolerance }]
    // State format:    [{ name, parameter, min_value, max_value, hard_limit, unit, tolerance }]
    if (t.numeric && t.numeric.length > 0) {
      setNumericBounds(t.numeric.map(n => ({
        name: n.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        parameter: n.name,
        min_value: n.min != null ? String(n.min) : '',
        max_value: n.max != null ? String(n.max) : '',
        hard_limit: n.max != null ? String(n.max) : '',
        unit: n.unit || '',
        tolerance: n.tolerance != null ? String(n.tolerance) : ''
      })));
    } else {
      setNumericBounds([{ name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' }]);
    }

    // ── Geographic Boundaries ──
    // Template format: { type, description }
    // State format:    [{ name, boundary_type, lat, lon, radius_meters, altitude_min, altitude_max }]
    if (t.geo) {
      setGeoBounds([{
        name: 'Primary Operating Zone',
        boundary_type: (t.geo.type === 'polygon' || t.geo.type === 'polygon_3d') ? 'polygon' : 'circle',
        lat: '', lon: '', radius_meters: '',
        altitude_min: '', altitude_max: ''
      }]);
    } else {
      setGeoBounds([{ name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' }]);
    }

    // ── Time Boundaries ──
    // Template format: { operating_hours: 'HH:MM-HH:MM', operating_days: [...], timezone }
    // State format:    [{ name, start_hour, end_hour, timezone, days }]
    if (t.time) {
      const [startH, endH] = (t.time.operating_hours || '0-23').split('-').map(h => String(parseInt(h)));
      const tz = t.time.timezone || 'America/Chicago';
      // Map generic timezone labels to IANA
      const tzMap = { 'facility_local': 'America/Chicago', 'ops_local': 'America/Chicago', 'farm_local': 'America/Chicago',
        'delivery_zone_local': 'America/Chicago', 'campus_local': 'America/Chicago', 'city_local': 'America/Chicago',
        'community_local': 'America/Chicago', 'site_local': 'America/Chicago', 'hospital_local': 'America/Chicago',
        'lab_local': 'America/Chicago', 'mine_local': 'America/Chicago', 'port_local': 'America/Chicago',
        'airport_local': 'America/Chicago', 'transit_local': 'America/Chicago', 'incident_local': 'America/Chicago',
        'exchange_local': 'America/New_York', 'institution_local': 'America/New_York', 'utility_local': 'America/Chicago',
        'grid_local': 'America/Chicago', 'plant_local': 'America/Chicago', 'fab_local': 'America/Chicago',
        'restaurant_local': 'America/Chicago', 'store_local': 'America/Chicago', 'hotel_local': 'America/Chicago',
        'network_local': 'UTC', 'theater_local': 'UTC',
        'patient_local': 'America/Chicago', 'student_local': 'America/Chicago', 'firm_local': 'America/New_York',
        'mission_local': 'UTC' };
      setTimeBounds([{
        name: 'Operating Hours',
        start_hour: startH,
        end_hour: endH,
        timezone: tzMap[tz] || tz,
        days: t.time.operating_days || [0,1,2,3,4,5,6]
      }]);
    } else {
      setTimeBounds([{ name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] }]);
    }

    // ── State Boundaries ──
    // Template format: { allowed: [...], forbidden: [...] }
    // State format:    [{ name, parameter, allowed_values, forbidden_values }]
    if (t.states && (t.states.allowed?.length || t.states.forbidden?.length)) {
      setStateBounds([{
        name: 'Operational States',
        parameter: 'mode',
        allowed_values: (t.states.allowed || []).join(', '),
        forbidden_values: (t.states.forbidden || []).join(', ')
      }]);
    } else {
      setStateBounds([{ name: '', parameter: '', allowed_values: '', forbidden_values: '' }]);
    }

    // ── ODD Description ──
    if (t.odd_description) {
      setOdd(prev => ({ ...prev, odd_description: t.odd_description }));
    }

    // ── Deployment type & environment from domain ──
    const domainToDeployment = {
      ground_robots: 'indoor', aerial: 'outdoor', vehicles: 'outdoor', marine: 'outdoor',
      medical: 'indoor', financial: 'virtual', energy: 'hybrid', manufacturing: 'indoor',
      defense: 'hybrid', agriculture: 'outdoor', space_extreme: 'outdoor',
      telecom_digital: 'virtual', construction: 'outdoor', logistics: 'indoor',
      retail_hospitality: 'indoor', education_research: 'indoor', legal_compliance: 'virtual', other: ''
    };
    const domainToEnvironment = {
      ground_robots: 'warehouse', aerial: 'airspace', vehicles: 'road', marine: 'other',
      medical: 'clinical', financial: 'data_center', energy: 'other', manufacturing: 'manufacturing',
      defense: 'other', agriculture: 'agriculture', space_extreme: 'other',
      telecom_digital: 'data_center', construction: 'construction', logistics: 'warehouse',
      retail_hospitality: 'other', education_research: 'other', legal_compliance: 'other', other: ''
    };
    setSys(prev => ({
      ...prev,
      deployment_type: domainToDeployment[st.domain] || prev.deployment_type,
      environment: domainToEnvironment[st.domain] || prev.environment
    }));

    // ── Safety config ──
    if (t.safety) {
      const actionMap = { 'block': 'stop', 'warn': 'alert', 'stop': 'stop' };
      setSafety(prev => ({
        ...prev,
        violation_action: actionMap[t.safety.violation_action] || t.safety.violation_action || prev.violation_action,
        fail_closed: t.safety.fail_closed !== false
      }));
    }
  };

  const inputStyle = { background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: styles.sans };
  const sectionHead = (text) => (<h2 style={{fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>{text}</h2>);
  const fieldLabel = (text) => (<label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>{text}</label>);
  const helpText = (text) => (<p style={{color: styles.textTertiary, fontSize: '11px', marginTop: '4px', lineHeight: '1.4'}}>{text}</p>);
  const addRow = (arr, setArr, template) => setArr([...arr, {...template}]);
  const removeRow = (arr, setArr, idx) => { if (arr.length > 1) setArr(arr.filter((_, i) => i !== idx)); };
  const updateRow = (arr, setArr, idx, field, val) => { const n = [...arr]; n[idx] = {...n[idx], [field]: val}; setArr(n); };
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const buildEnvelopeDefinition = () => {
    const nb = numericBounds.filter(b => b.name && b.parameter).map(b => ({ name: b.name, parameter: b.parameter, min_value: b.min_value ? parseFloat(b.min_value) : null, max_value: b.max_value ? parseFloat(b.max_value) : null, hard_limit: b.hard_limit ? parseFloat(b.hard_limit) : null, unit: b.unit || null, tolerance: b.tolerance ? parseFloat(b.tolerance) : 0 }));
    const gb = geoBounds.filter(b => b.name && b.lat && b.lon).map(b => ({ name: b.name, boundary_type: b.boundary_type, center: { lat: parseFloat(b.lat), lon: parseFloat(b.lon) }, radius_meters: b.radius_meters ? parseFloat(b.radius_meters) : 1000, altitude_min: b.altitude_min ? parseFloat(b.altitude_min) : null, altitude_max: b.altitude_max ? parseFloat(b.altitude_max) : null }));
    const tb = timeBounds.filter(b => b.name).map(b => ({ name: b.name, allowed_hours_start: parseInt(b.start_hour), allowed_hours_end: parseInt(b.end_hour), allowed_days: b.days, timezone: b.timezone }));
    const sb = stateBounds.filter(b => b.name && b.parameter).map(b => ({ name: b.name, parameter: b.parameter, allowed_values: b.allowed_values ? b.allowed_values.split(',').map(s => s.trim()).filter(Boolean) : [], forbidden_values: b.forbidden_values ? b.forbidden_values.split(',').map(s => s.trim()).filter(Boolean) : [] }));
    return { numeric_boundaries: nb, geo_boundaries: gb, time_boundaries: tb, state_boundaries: sb, rate_boundaries: [], safe_state: { action: safety.violation_action, connection_loss: safety.connection_loss_action, notify: true, emergency_contact: { name: safety.emergency_contact_name, phone: safety.emergency_contact_phone, email: safety.emergency_contact_email } }, fail_closed: safety.fail_closed };
  };
  const handleSubmit = async () => {
    try {
      const envelope = buildEnvelopeDefinition();
      const payload = { organization_name: org.organization_name, contact_name: org.contact_name, contact_email: org.contact_email, contact_phone: org.contact_phone, system_name: sys.system_name, system_type: sys.system_type, custom_system_type: customSystemType || null, system_version: sys.system_version, manufacturer: sys.manufacturer, system_description: sys.system_description, odd_specification: { description: odd.odd_description, deployment_type: sys.deployment_type, environment: sys.environment, facility_location: odd.facility_location, operating_temp: odd.temp_min && odd.temp_max ? { min: parseFloat(odd.temp_min), max: parseFloat(odd.temp_max), unit: odd.temp_unit } : null, weather_constraints: odd.weather_constraints || null, surface_type: odd.surface_type || null, integration_method: sys.integration_method, expected_volume: sys.expected_volume, compliance_requirements: sys.compliance_requirements }, envelope_definition: envelope, facility_location: odd.facility_location, preferred_test_date: odd.preferred_test_date || null, notes: odd.notes };
      await api.post('/api/applications/', payload);
      navigate('/applications');
    } catch (err) { setError(err.response?.data?.detail || 'Failed to submit application'); setStep(1); }
  };
  const handleBulkImport = (type, rows) => {
    if (type === 'numeric') { setNumericBounds(prev => [...prev.filter(b => b.name), ...rows.map(r => ({ name: r.name || '', parameter: r.parameter || '', min_value: r.min_value || '', max_value: r.max_value || '', hard_limit: r.hard_limit || '', unit: r.unit || '', tolerance: r.tolerance || '' }))]); }
    if (type === 'geo') { setGeoBounds(prev => [...prev.filter(b => b.name), ...rows.map(r => ({ name: r.name || '', boundary_type: r.boundary_type || 'circle', lat: r.lat || '', lon: r.lon || '', radius_meters: r.radius_meters || '', altitude_min: r.altitude_min || '', altitude_max: r.altitude_max || '' }))]); }
    if (type === 'time') { setTimeBounds(prev => [...prev.filter(b => b.name), ...rows.map(r => ({ name: r.name || '', start_hour: r.start_hour || '6', end_hour: r.end_hour || '22', timezone: r.timezone || 'America/Chicago', days: Array.isArray(r.days) ? r.days : [0,1,2,3,4,5,6] }))]); }
    if (type === 'state') { setStateBounds(prev => [...prev.filter(b => b.name), ...rows.map(r => ({ name: r.name || '', parameter: r.parameter || '', allowed_values: r.allowed_values || '', forbidden_values: r.forbidden_values || '' }))]); }
  };
  const canNext = () => { if (step === 1) return org.organization_name && org.contact_email; if (step === 2) return sys.system_name && sys.system_type; return true; };
  const stepLabels = ['Organization', 'System', 'Operating Domain', 'Boundaries', 'Safety & Failure', 'Review'];
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/applications" className="flex items-center gap-2 mb-4 no-underline" style={{color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}><ArrowLeft className="w-4 h-4" />Back to Applications</Link>
        <p style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>New Submission</p>
        <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>ODDC Application</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Submit your autonomous system for conformance determination</p>
      </div>
      <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>{stepLabels.map((label, i) => (<div key={i} style={{flex: 1, textAlign: 'center'}}><div style={{height: '3px', background: i + 1 <= step ? styles.purpleBright : 'rgba(0,0,0,0.09)', transition: 'background 0.3s', marginBottom: '6px'}} /><span style={{fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: i + 1 <= step ? styles.purpleBright : styles.textTertiary}}>{label}</span></div>))}</div>
      <Panel>
        {error && <div className="mb-4 p-3" style={{background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentRed, borderRadius: 8}}>{error}</div>}
        
      {submitted && (
        <div style={{textAlign: 'center', padding: 'clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)'}}>
          <div style={{width: '64px', height: '64px', borderRadius: '50%', background: 'transparent', border: '2px solid rgba(22,135,62,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 'clamp(20px, 4vw, 28px)'}}>✓</div>
          <h2 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, margin: '0 0 12px', color: styles.textPrimary}}>Application Submitted</h2>
          <p style={{color: styles.textSecondary, fontSize: '14px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto 8px'}}>Your application is now in the queue. Our team will review your ODD specification and boundary definitions.</p>
          <p style={{color: styles.textTertiary, fontSize: '13px', marginBottom: '32px'}}>You'll receive email updates as your application progresses through the certification pipeline.</p>
          <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
            <Link to="/applications" className="no-underline px-6 py-3" style={{background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>View Applications</Link>
            <Link to="/dashboard" className="no-underline px-6 py-3" style={{background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>Dashboard</Link>
          </div>
        </div>
      )}
      {!submitted && <>{step === 1 && (<div className="space-y-4">{sectionHead('Organization Information')}<div>{fieldLabel('Organization Name *')}<input type="text" value={org.organization_name} onChange={(e) => setOrg({...org, organization_name: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} /></div><div>{fieldLabel('Contact Name')}<input type="text" value={org.contact_name} onChange={(e) => setOrg({...org, contact_name: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} /></div><div className="grid gap-4" style={{gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))"}}><div>{fieldLabel('Contact Email *')}<input type="email" value={org.contact_email} onChange={(e) => setOrg({...org, contact_email: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} /></div><div>{fieldLabel('Contact Phone')}<input type="tel" value={org.contact_phone} onChange={(e) => setOrg({...org, contact_phone: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} /></div></div></div>)}
        {step === 2 && (<div className="space-y-4">{sectionHead('System Information')}<div className="grid gap-4" style={{gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))"}}><div>{fieldLabel('System Name *')}<input type="text" value={sys.system_name} onChange={(e) => setSys({...sys, system_name: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} /></div><div>{fieldLabel('System Type *')}<select value={sys.system_type} onChange={(e) => { setSys({...sys, system_type: e.target.value}); applyTemplate(e.target.value); }} className="w-full px-4 py-3 outline-none" style={inputStyle}><option value="">Select system type ({Object.keys(SYSTEM_TYPES).length} available)...</option>{DOMAIN_GROUPS.map(group => { const types = Object.entries(SYSTEM_TYPES).filter(([,v]) => v.domain === group.key); if (!types.length) return null; return (<optgroup key={group.key} label={group.label}>{types.map(([key, t]) => (<option key={key} value={key}>{t.label}</option>))}</optgroup>); })}</select></div></div><div className="grid gap-4" style={{gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))"}}><div>{fieldLabel('System Version')}<input type="text" value={sys.system_version} onChange={(e) => setSys({...sys, system_version: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} placeholder="e.g., 1.0.0" /></div><div>{fieldLabel('Manufacturer')}<input type="text" value={sys.manufacturer} onChange={(e) => setSys({...sys, manufacturer: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} /></div></div><div>{fieldLabel('System Description *')}<textarea value={sys.system_description} onChange={(e) => setSys({...sys, system_description: e.target.value})} rows={3} className="w-full px-4 py-3 outline-none resize-none" style={inputStyle} /></div><div className="grid gap-4" style={{gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))"}}><div>{fieldLabel('Deployment Type')}<select value={sys.deployment_type} onChange={(e) => setSys({...sys, deployment_type: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle}><option value="">Select...</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option><option value="hybrid">Indoor + Outdoor</option><option value="virtual">Virtual / Cloud</option></select></div><div>{fieldLabel('Environment')}<select value={sys.environment} onChange={(e) => setSys({...sys, environment: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle}><option value="">Select...</option><option value="warehouse">Warehouse / Logistics</option><option value="manufacturing">Manufacturing Floor</option><option value="road">Public Road</option><option value="airspace">Airspace</option><option value="clinical">Clinical / Hospital</option><option value="data_center">Data Center</option><option value="agriculture">Agriculture / Field</option><option value="construction">Construction Site</option><option value="other">Other</option></select></div></div><div className="grid gap-4" style={{gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))"}}><div>{fieldLabel('Agent Deployment Method')}<select value={sys.integration_method} onChange={(e) => setSys({...sys, integration_method: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle}><option value="python">Python Package</option><option value="docker">Docker Container</option><option value="kubernetes">Kubernetes</option></select></div><div>{fieldLabel('Expected Actions / Day')}<select value={sys.expected_volume} onChange={(e) => setSys({...sys, expected_volume: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle}><option value="">Select...</option><option value="low">{"Low (< 1,000)"}</option><option value="medium">Medium (1K — 10K)</option><option value="high">High (10K — 100K)</option><option value="very_high">Very High (100K+)</option></select></div></div><div>{sys.system_type && sys.system_type.includes('custom') && (<div style={{marginTop: '-8px'}}>{fieldLabel('Describe Your System Type *')}<input type="text" value={customSystemType} onChange={(e) => setCustomSystemType(e.target.value)} className="w-full px-4 py-3 outline-none" style={inputStyle} placeholder="e.g., Underwater pipeline inspection ROV, Agricultural pollination drone swarm" />{helpText('Since your system doesn\'t fit a standard category, please describe it so we can configure appropriate boundaries.')}</div>)}{fieldLabel('Compliance Requirements')}<input type="text" value={sys.compliance_requirements} onChange={(e) => setSys({...sys, compliance_requirements: e.target.value})} className="w-full px-4 py-3 outline-none" style={inputStyle} placeholder="e.g., ISO 26262, FDA 510(k), FAA Part 107, SOC 2" />{helpText('List any regulatory or compliance frameworks your system must adhere to.')}</div></div>)}
        {step === 3 && (<div className="space-y-4">{sectionHead('Review & Submit')}<p style={{color: styles.textSecondary, fontSize: '13px', lineHeight: '1.6', marginBottom: '16px'}}>Review your application. After approval, we will push the ENVELO Interlock to you. It will autodetect your system's operating boundaries during deployment. Our team will then review the detected boundaries before your CAT-72 test begins.</p><div style={{background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '16px', marginBottom: '12px'}}><div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Organization</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{org.organization_name}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Contact</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{org.contact_name || org.contact_email}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>System</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{sys.system_name}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>System Type</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{sys.system_type || 'Not specified'}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Deployment</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{sys.deployment_type || 'Not specified'} — {sys.environment || 'Not specified'}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Integration</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{sys.integration_method}</span></div></div></div><div style={{background: 'rgba(22,135,62,0.06)', border: '1px solid rgba(22,135,62,0.15)', padding: '16px'}}><p style={{color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px'}}>What Happens Next</p><div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}><div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}><span style={{color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px'}}>1.</span><span style={{color: styles.textSecondary, fontSize: '13px'}}>Our team reviews your application and approves it</span></div><div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}><span style={{color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px'}}>2.</span><span style={{color: styles.textSecondary, fontSize: '13px'}}>We push the ENVELO Interlock to you with your API key</span></div><div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}><span style={{color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px'}}>3.</span><span style={{color: styles.textSecondary, fontSize: '13px'}}>You deploy the interlock — it autodetects your operating boundaries</span></div><div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}><span style={{color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px'}}>4.</span><span style={{color: styles.textSecondary, fontSize: '13px'}}>We review and approve the detected boundaries</span></div><div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}><span style={{color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px'}}>5.</span><span style={{color: styles.textSecondary, fontSize: '13px'}}>CAT-72 runs automatically — certificate issued on pass</span></div></div></div></div>)}

        <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${styles.borderGlass}`}}>{step > 1 ? (<button onClick={() => setStep(step - 1)} style={{background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '10px 24px', color: styles.textSecondary, cursor: 'pointer', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Back</button>) : <div />}{step < totalSteps ? (<button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} style={{background: canNext() ? styles.purplePrimary : 'rgba(0,0,0,0.025)', border: `1px solid ${canNext() ? styles.purpleBright : styles.borderGlass}`, padding: '10px 32px', color: canNext() ? '#fff' : styles.textTertiary, cursor: canNext() ? 'pointer' : 'not-allowed', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Continue</button>) : (<button onClick={handleSubmit} style={{background: styles.accentGreen, border: '1px solid ' + styles.accentGreen, padding: '10px 32px', color: '#fff', cursor: 'pointer', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold'}}>Submit Application</button>)}</div>
      </>}
      </Panel>
    </div>
  );
}

// Application Detail

export default NewApplication;

