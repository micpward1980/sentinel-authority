import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useBeforeUnload } from 'react-router-dom';
import Panel from '../components/Panel';

// ─── System type options (simplified — no templates, no boundary auto-fill) ───

const SYSTEM_TYPE_OPTIONS = [
  { group: 'Ground Vehicles & Robots', types: [
    'Autonomous Ground Vehicle — Urban',
    'Autonomous Ground Vehicle — Highway',
    'Autonomous Shuttle / Transit',
    'Warehouse / Logistics Robot',
    'Last-Mile Delivery Robot',
    'Agricultural Robot',
    'Mining / Excavation Robot',
    'Construction Robot',
    'Security / Patrol Robot',
  ]},
  { group: 'Aerial Systems', types: [
    'Autonomous Aerial System — BVLOS Cargo',
    'Autonomous Aerial System — Survey / Inspection',
    'Autonomous Aerial System — Agriculture',
    'Urban Air Mobility (eVTOL)',
    'Search & Rescue Drone',
  ]},
  { group: 'Marine & Subsea', types: [
    'Autonomous Surface Vessel',
    'Autonomous Underwater Vehicle',
    'Port / Harbor Automation',
  ]},
  { group: 'Medical & Surgical', types: [
    'Surgical Robotics',
    'Pharmacy / Lab Automation',
    'Patient Care / Rehabilitation Robot',
    'Diagnostic AI System',
  ]},
  { group: 'Industrial & Manufacturing', types: [
    'Industrial Robot / Cobot',
    'Quality Inspection System',
    'Process Control System',
    'Predictive Maintenance System',
  ]},
  { group: 'Transportation Infrastructure', types: [
    'Traffic Management System',
    'Rail / Metro Automation',
    'Smart Highway System',
    'Autonomous Port Crane / Terminal',
  ]},
  { group: 'Energy & Utilities', types: [
    'Grid Management System',
    'Power Plant Automation',
    'Pipeline Inspection System',
    'Renewable Energy Controller',
  ]},
  { group: 'Space & Satellite', types: [
    'Autonomous Orbital System',
    'Satellite Constellation Management',
    'Launch Vehicle Guidance',
  ]},
  { group: 'Smart Building & Facility', types: [
    'Building Management System',
    'HVAC Optimization System',
    'Autonomous Elevator / Conveyance',
    'Smart Campus / Facility Controller',
  ]},
  { group: 'Telecommunications', types: [
    'Network Optimization AI',
    'Autonomous Capacity Management',
    'Infrastructure Self-Healing System',
  ]},
  { group: 'Retail & Hospitality', types: [
    'Autonomous Checkout System',
    'Service / Hospitality Robot',
    'Inventory Management System',
  ]},
  { group: 'Environmental & Monitoring', types: [
    'Wildfire Detection System',
    'Pollution Monitoring System',
    'Weather Prediction / Response System',
    'Natural Disaster Early Warning',
  ]},
  { group: 'Cybersecurity', types: [
    'Autonomous Threat Response',
    'Intrusion Detection System',
    'Automated Incident Response',
  ]},
  { group: 'Supply Chain & Logistics', types: [
    'Demand Forecasting System',
    'Autonomous Routing / Dispatch',
    'Inventory Optimization Engine',
  ]},
  { group: 'Financial & Trading', types: [
    'Algorithmic Trading System',
    'Risk Assessment Engine',
    'Fraud Detection System',
  ]},
  { group: 'Other', types: [
    'Custom / Other (describe below)',
  ]},
];

// ─── NewApplication ───────────────────────────────────────────────────────────

function NewApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Form state ──
  const [org, setOrg] = useState({
    organization_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  });

  const [sys, setSys] = useState({
    system_name: '',
    system_type: '',
    custom_system_type: '',
    system_version: '',
    manufacturer: '',
    system_description: '',
    deployment_type: '',
    environment: '',
    environment_custom: '',
  });

  // Dirty check — warn before leaving with unsaved form data
  const isDirty = !submitted && (
    step > 1 ||
    org.organization_name !== '' ||
    org.contact_email !== '' ||
    sys.system_name !== ''
  );

  useBeforeUnload(
    React.useCallback((e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved application data. Leave anyway?';
      }
    }, [isDirty])
  );

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
  }, [user]);

  // ── Submission ──
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        organization_name: org.organization_name,
        contact_name: org.contact_name,
        contact_email: org.contact_email,
        contact_phone: org.contact_phone,
        system_name: sys.system_name,
        system_type: sys.system_type === 'Custom / Other (describe below)' ? 'custom' : sys.system_type,
        custom_system_type: sys.custom_system_type || null,
        system_version: sys.system_version,
        manufacturer: sys.manufacturer,
        system_description: sys.system_description,
        odd_specification: {
          deployment_type: sys.deployment_type,
          environment: sys.environment,
          description: 'Boundaries will be auto-discovered by ENVELO Interlock during OBSERVE phase.',
        },
        envelope_definition: null, // Interlock auto-discovers boundaries
      };
      await api.post('/api/applications/', payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit application');
    }
    setSubmitting(false);
  };

  // ── Validation ──
  const canNext = () => {
    if (step === 1) return org.organization_name.trim() && org.contact_email.trim();
    if (step === 2) return sys.system_name.trim() && sys.system_type;
    return true;
  };

  // ── Style helpers ──
  const inputStyle = {
    background: styles.cardSurface,
    border: `1px solid ${styles.borderGlass}`,
    color: styles.textPrimary,
    fontFamily: styles.sans,
  };

  const sectionHead = (text) => (
    <h2 style={{
      fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px',
      textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px',
    }}>{text}</h2>
  );

  const fieldLabel = (text, required) => (
    <label style={{ display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px' }}>
      {text}{required && ' *'}
    </label>
  );

  const helpText = (text) => (
    <p style={{ color: styles.textTertiary, fontSize: '11px', marginTop: '4px', lineHeight: '1.4' }}>{text}</p>
  );

  const stepLabels = ['Organization', 'System', 'Review'];
  const isCustomType = sys.system_type === 'Custom / Other (describe below)';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/applications" className="flex items-center gap-2 mb-4 no-underline"
          style={{ color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          <ArrowLeft className="w-4 h-4" />Back to Applications
        </Link>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px' }}>
          New Submission
        </p>
        <h1 style={{ fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0 }}>
          ODDC Application
        </h1>
        <p style={{ color: styles.textSecondary, marginTop: '8px' }}>
          Submit your autonomous system for conformance determination
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {stepLabels.map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: '3px',
              background: i + 1 <= step ? styles.purpleBright : 'rgba(0,0,0,0.09)',
              transition: 'background 0.3s',
              marginBottom: '6px',
            }} />
            <span style={{
              fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase',
              color: i + 1 <= step ? styles.purpleBright : styles.textTertiary,
            }}>{label}</span>
          </div>
        ))}
      </div>

      <Panel>
        {error && (
          <div className="mb-4 p-3" style={{
            background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle,
            color: styles.accentRed, borderRadius: 8,
          }}>{error}</div>
        )}

        {/* ── Success state ── */}
        {submitted && (
          <div style={{ textAlign: 'center', padding: 'clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', background: 'transparent',
              border: '2px solid rgba(22,135,62,0.4)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 24px', fontSize: 'clamp(20px, 4vw, 28px)',
            }}>✓</div>
            <h2 style={{
              fontFamily: "Georgia, 'Source Serif 4', serif",
              fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, margin: '0 0 12px',
              color: styles.textPrimary,
            }}>Application Submitted</h2>
            <p style={{
              color: styles.textSecondary, fontSize: '14px', lineHeight: '1.6',
              maxWidth: '480px', margin: '0 auto 8px',
            }}>
              Your application is now in the queue. Our team will review and reach out with next steps.
            </p>
            <p style={{ color: styles.textTertiary, fontSize: '13px', marginBottom: '32px' }}>
              Once approved, we'll send you an API key and the ENVELO Interlock will auto-discover your system's operating boundaries.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to="/applications" className="no-underline px-6 py-3" style={{
                background: 'transparent', border: 'none',
                borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright,
                fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
              }}>View Applications</Link>
              <Link to="/dashboard" className="no-underline px-6 py-3" style={{
                background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`,
                color: styles.textSecondary, fontFamily: styles.mono, fontSize: '10px',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>Dashboard</Link>
            </div>
          </div>
        )}

        {/* ── Form steps ── */}
        {!submitted && <>

          {/* STEP 1: Organization */}
          {step === 1 && (
            <div className="space-y-4">
              {sectionHead('Organization Information')}
              <div>
                {fieldLabel('Organization Name', true)}
                <input type="text" value={org.organization_name}
                  onChange={e => setOrg({ ...org, organization_name: e.target.value })}
                  className="w-full px-4 py-3 outline-none" style={inputStyle} />
              </div>
              <div>
                {fieldLabel('Contact Name')}
                <input type="text" value={org.contact_name}
                  onChange={e => setOrg({ ...org, contact_name: e.target.value })}
                  className="w-full px-4 py-3 outline-none" style={inputStyle} />
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div>
                  {fieldLabel('Contact Email', true)}
                  <input type="email" value={org.contact_email}
                    onChange={e => setOrg({ ...org, contact_email: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle} />
                </div>
                <div>
                  {fieldLabel('Contact Phone')}
                  <input type="tel" value={org.contact_phone}
                    onChange={e => setOrg({ ...org, contact_phone: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: System */}
          {step === 2 && (
            <div className="space-y-4">
              {sectionHead('System Information')}
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div>
                  {fieldLabel('System Name', true)}
                  <input type="text" value={sys.system_name}
                    onChange={e => setSys({ ...sys, system_name: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}
                    placeholder="e.g., NavBot 3000" />
                </div>
                <div>
                  {fieldLabel('System Type', true)}
                  <select value={sys.system_type}
                    onChange={e => setSys({ ...sys, system_type: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}>
                    <option value="">Select system type...</option>
                    {SYSTEM_TYPE_OPTIONS.map(group => (
                      <optgroup key={group.group} label={group.group}>
                        {group.types.map(t => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {isCustomType && (
                <div>
                  {fieldLabel('Describe Your System Type', true)}
                  <input type="text" value={sys.custom_system_type}
                    onChange={e => setSys({ ...sys, custom_system_type: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}
                    placeholder="e.g., Underwater pipeline inspection ROV" />
                  {helpText('Describe your system so we can configure the appropriate review process.')}
                </div>
              )}

              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div>
                  {fieldLabel('System Version')}
                  <input type="text" value={sys.system_version}
                    onChange={e => setSys({ ...sys, system_version: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}
                    placeholder="e.g., 2.1.0" />
                </div>
                <div>
                  {fieldLabel('Manufacturer')}
                  <input type="text" value={sys.manufacturer}
                    onChange={e => setSys({ ...sys, manufacturer: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle} />
                </div>
              </div>

              <div>
                {fieldLabel('System Description', true)}
                <textarea value={sys.system_description}
                  onChange={e => setSys({ ...sys, system_description: e.target.value })}
                  rows={3} className="w-full px-4 py-3 outline-none resize-none" style={inputStyle}
                  placeholder="What does this system do? What decisions does it make autonomously?" />
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div>
                  {fieldLabel('Deployment Type')}
                  <select value={sys.deployment_type}
                    onChange={e => setSys({ ...sys, deployment_type: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="hybrid">Indoor + Outdoor</option>
                    <option value="aerial">Aerial</option>
                    <option value="underwater">Underwater / Subsea</option>
                    <option value="subterranean">Subterranean</option>
                    <option value="multi_domain">Multi-Domain</option>
                    <option value="virtual">Virtual / Cloud</option>
                    <option value="other_deploy">Other (describe below)</option>
                  </select>
                </div>
                {sys.deployment_type === 'other_deploy' && (
                  <div>
                    {fieldLabel('Describe Deployment Type', true)}
                    <input type="text" value={sys.deployment_custom || ''}
                      onChange={e => setSys({ ...sys, deployment_custom: e.target.value })}
                      className="w-full px-4 py-3 outline-none" style={inputStyle}
                      placeholder="e.g., Deep ocean floor, low Earth orbit, underground cave network" />
                  </div>
                )}
                <div>
                  {fieldLabel('Operating Environment')}
                  <select value={sys.environment}
                    onChange={e => setSys({ ...sys, environment: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="warehouse">Warehouse / Logistics</option>
                    <option value="manufacturing">Manufacturing Floor</option>
                    <option value="road">Public Road</option>
                    <option value="rail">Rail Corridor</option>
                    <option value="airspace">Airspace</option>
                    <option value="clinical">Clinical / Hospital</option>
                    <option value="data_center">Data Center</option>
                    <option value="agriculture">Agriculture / Field</option>
                    <option value="construction">Construction Site</option>
                    <option value="marine">Marine / Waterway</option>
                    <option value="underground">Underground / Tunnel</option>
                    <option value="residential">Residential</option>
                    <option value="retail">Retail / Commercial</option>
                    <option value="arctic">Arctic / Extreme Weather</option>
                    <option value="space">Space / Orbital</option>
                    <option value="mining">Mining (Underground)</option>
                    <option value="office">Office / Smart Building</option>
                    <option value="other">Other (describe below)</option>
                  </select>
                </div>
              </div>

              {sys.environment === 'other' && (
                <div>
                  {fieldLabel('Describe Operating Environment', true)}
                  <input type="text" value={sys.environment_custom}
                    onChange={e => setSys({ ...sys, environment_custom: e.target.value })}
                    className="w-full px-4 py-3 outline-none" style={inputStyle}
                    placeholder="e.g., Deep-sea oil platform, orbital space station, underground mine shaft" />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-4">
              {sectionHead('Review & Submit')}

              <p style={{ color: styles.textSecondary, fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
                Review your application details below. After approval, the ENVELO Interlock will be pushed to you
                and will auto-discover your system's operating boundaries during deployment.
              </p>

              {/* Summary card */}
              <div style={{
                background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`,
                padding: '16px', marginBottom: '12px',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}>
                  <div>
                    <span style={{ color: styles.textTertiary, fontSize: '11px' }}>Organization</span><br />
                    <span style={{ color: styles.textPrimary, fontSize: '14px' }}>{org.organization_name}</span>
                  </div>
                  <div>
                    <span style={{ color: styles.textTertiary, fontSize: '11px' }}>Contact</span><br />
                    <span style={{ color: styles.textPrimary, fontSize: '14px' }}>{org.contact_name || org.contact_email}</span>
                  </div>
                  <div>
                    <span style={{ color: styles.textTertiary, fontSize: '11px' }}>System</span><br />
                    <span style={{ color: styles.textPrimary, fontSize: '14px' }}>{sys.system_name}</span>
                  </div>
                  <div>
                    <span style={{ color: styles.textTertiary, fontSize: '11px' }}>System Type</span><br />
                    <span style={{ color: styles.textPrimary, fontSize: '14px' }}>
                      {isCustomType ? (sys.custom_system_type || 'Custom') : sys.system_type}
                    </span>
                  </div>
                  {sys.deployment_type && (
                    <div>
                      <span style={{ color: styles.textTertiary, fontSize: '11px' }}>Deployment</span><br />
                      <span style={{ color: styles.textPrimary, fontSize: '14px' }}>
                        {sys.deployment_type}{sys.environment ? ` — ${sys.environment}` : ''}
                      </span>
                    </div>
                  )}
                  {sys.manufacturer && (
                    <div>
                      <span style={{ color: styles.textTertiary, fontSize: '11px' }}>Manufacturer</span><br />
                      <span style={{ color: styles.textPrimary, fontSize: '14px' }}>{sys.manufacturer}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* What happens next */}
              <div style={{
                background: 'rgba(22,135,62,0.06)', border: '1px solid rgba(22,135,62,0.15)',
                padding: '16px',
              }}>
                <p style={{
                  color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px',
                  letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px',
                }}>What Happens Next</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    'Our team reviews your application and approves it',
                    'We push the ENVELO Interlock to you with your API key',
                    'You deploy the Interlock — it auto-discovers your operating boundaries',
                    'We review and approve the detected boundaries',
                    'CAT-72 runs (72 cumulative hours) — certificate issued on pass',
                  ].map((text, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span style={{
                        color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px',
                      }}>{i + 1}.</span>
                      <span style={{ color: styles.textSecondary, fontSize: '13px' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* No boundaries notice */}
              <div style={{
                padding: '12px 16px',
                border: `1px solid ${styles.borderGlass}`,
                background: styles.cardSurface,
              }}>
                <p style={{ color: styles.textTertiary, fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                  <strong style={{ color: styles.textSecondary }}>No boundary definitions required.</strong>{' '}
                  The ENVELO Interlock will observe your system in normal operation and auto-discover
                  operational boundaries. Your IP stays yours — we certify the process, not the parameters.
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
            marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${styles.borderGlass}`,
          }}>
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} style={{
                background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`,
                padding: '10px 24px', color: styles.textSecondary, cursor: 'pointer',
                fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
              }}>Back</button>
            ) : <div />}

            {step < totalSteps ? (
              <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} style={{
                background: canNext() ? styles.purplePrimary : 'rgba(0,0,0,0.025)',
                border: `1px solid ${canNext() ? styles.purpleBright : styles.borderGlass}`,
                padding: '10px 32px', color: canNext() ? '#fff' : styles.textTertiary,
                cursor: canNext() ? 'pointer' : 'not-allowed',
                fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
              }}>Continue</button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} style={{
                background: styles.accentGreen, border: '1px solid ' + styles.accentGreen,
                padding: '10px 32px', color: '#fff', cursor: submitting ? 'wait' : 'pointer',
                fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                fontWeight: 'bold', opacity: submitting ? 0.7 : 1,
              }}>{submitting ? 'Submitting…' : 'Submit Application'}</button>
            )}
          </div>
        </>}
      </Panel>
    </div>
  );
}

export default NewApplication;
