import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useBeforeUnload } from 'react-router-dom';
import Panel from '../components/Panel';

function NewApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [org, setOrg] = useState({
    organization_name: '', contact_name: '', contact_email: '', contact_phone: '',
  });

  const [sys, setSys] = useState({
    system_name: '', system_description: '', operating_domains: '',
  });

  const isDirty = !submitted && (step > 1 || org.organization_name !== '' || org.contact_email !== '' || sys.system_name !== '');

  useBeforeUnload(React.useCallback((e) => {
    if (isDirty) { e.preventDefault(); e.returnValue = 'You have unsaved application data. Leave anyway?'; }
  }, [isDirty]));

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

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      await api.post('/api/applications/', {
        organization_name: org.organization_name, contact_name: org.contact_name,
        contact_email: org.contact_email, contact_phone: org.contact_phone,
        system_name: sys.system_name, system_type: 'pending_classification',
        system_version: '1.0', manufacturer: org.organization_name,
        system_description: sys.system_description,
        odd_specification: { description: sys.operating_domains },
        envelope_definition: null,
      });
      setSubmitted(true);
    } catch (err) { setError(err.response?.data?.detail || 'Failed to submit application'); }
    setSubmitting(false);
  };

  const canNext = () => {
    if (step === 1) return org.organization_name.trim() && org.contact_email.trim() && org.contact_name.trim();
    if (step === 2) return sys.system_name.trim() && sys.system_description.trim() && sys.operating_domains.trim();
    return true;
  };

  const inputStyle = { background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: styles.sans };
  const sectionHead = (text) => (<h2 style={{ fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px' }}>{text}</h2>);
  const fieldLabel = (text, required) => (<label style={{ display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px' }}>{text}{required && ' *'}</label>);
  const helpText = (text) => (<p style={{ color: styles.textTertiary, fontSize: '11px', marginTop: '4px', lineHeight: '1.4' }}>{text}</p>);
  const stepLabels = ['Organization', 'System', 'Review'];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/applications" className="flex items-center gap-2 mb-4 no-underline" style={{ color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          <ArrowLeft className="w-4 h-4" />Back to Applications
        </Link>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px' }}>New Submission</p>
        <h1 style={{ fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0 }}>ODDC Certification Application</h1>
        <p style={{ color: styles.textSecondary, marginTop: '8px' }}>Tell us about your organization and system. We handle the rest.</p>
      </div>

      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {stepLabels.map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: '3px', background: i + 1 <= step ? styles.purpleBright : 'rgba(0,0,0,0.09)', transition: 'background 0.3s', marginBottom: '6px' }} />
            <span style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: i + 1 <= step ? styles.purpleBright : styles.textTertiary }}>{label}</span>
          </div>
        ))}
      </div>

      <Panel>
        {error && <div className="mb-4 p-3" style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderSubtle, color: styles.accentRed, borderRadius: 8 }}>{error}</div>}

        {submitted && (
          <div style={{ textAlign: 'center', padding: 'clamp(24px, 5vw, 60px) clamp(12px, 3vw, 20px)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'transparent', border: '2px solid rgba(22,135,62,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 'clamp(20px, 4vw, 28px)' }}>✓</div>
            <h2 style={{ fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 200, margin: '0 0 12px', color: styles.textPrimary }}>Application Submitted</h2>
            <p style={{ color: styles.textSecondary, fontSize: '14px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto 8px' }}>Your application is now in our queue. A certification specialist will review your submission and reach out within 2 business days.</p>
            <p style={{ color: styles.textTertiary, fontSize: '13px', marginBottom: '32px' }}>You will receive a fee proposal along with next steps for the assessment process.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to="/applications" className="no-underline px-6 py-3" style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>View Applications</Link>
              <Link to="/dashboard" className="no-underline px-6 py-3" style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Dashboard</Link>
            </div>
          </div>
        )}

        {!submitted && <>
          {step === 1 && (
            <div className="space-y-4">
              {sectionHead('Your Organization')}
              <div>
                {fieldLabel('Organization Name', true)}
                <input type="text" value={org.organization_name} onChange={e => setOrg({ ...org, organization_name: e.target.value })} className="w-full px-4 py-3 outline-none" style={inputStyle} placeholder="e.g., Waymo, Nuro, Aurora Innovation" />
              </div>
              <div>
                {fieldLabel('Contact Name', true)}
                <input type="text" value={org.contact_name} onChange={e => setOrg({ ...org, contact_name: e.target.value })} className="w-full px-4 py-3 outline-none" style={inputStyle} />
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div>
                  {fieldLabel('Contact Email', true)}
                  <input type="email" value={org.contact_email} onChange={e => setOrg({ ...org, contact_email: e.target.value })} className="w-full px-4 py-3 outline-none" style={inputStyle} />
                </div>
                <div>
                  {fieldLabel('Contact Phone')}
                  <input type="tel" value={org.contact_phone} onChange={e => setOrg({ ...org, contact_phone: e.target.value })} className="w-full px-4 py-3 outline-none" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {sectionHead('About Your System')}
              <div>
                {fieldLabel('System Name', true)}
                <input type="text" value={sys.system_name} onChange={e => setSys({ ...sys, system_name: e.target.value })} className="w-full px-4 py-3 outline-none" style={inputStyle} placeholder="e.g., Waymo Driver, Nuro R3, Aurora Virtual Driver" />
                {helpText('The name you use internally for this autonomous system.')}
              </div>
              <div>
                {fieldLabel('What does your system do?', true)}
                <textarea value={sys.system_description} onChange={e => setSys({ ...sys, system_description: e.target.value })} rows={4} className="w-full px-4 py-3 outline-none resize-none" style={inputStyle} placeholder="Describe your system in plain language. What does it do? What decisions does it make on its own? What kind of vehicle or platform does it operate on?" />
                {helpText('Be as descriptive as you like. This helps us understand your system before the formal assessment begins.')}
              </div>
              <div>
                {fieldLabel('Where does your system operate?', true)}
                <textarea value={sys.operating_domains} onChange={e => setSys({ ...sys, operating_domains: e.target.value })} rows={3} className="w-full px-4 py-3 outline-none resize-none" style={inputStyle} placeholder="Describe the environments and conditions where your system operates. For example: urban city streets, highway corridors, warehouse interiors, suburban neighborhoods, etc." />
                {helpText('List all environments where your system currently operates or plans to operate. Our assessment covers each operational domain separately.')}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {sectionHead('Review & Submit')}
              <p style={{ color: styles.textSecondary, fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>Review your application below. Once submitted, our team will analyze your system and prepare a certification fee proposal.</p>
              <div style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <span style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>Organization</span>
                    <div style={{ color: styles.textPrimary, fontSize: '15px', marginTop: '4px' }}>{org.organization_name}</div>
                    <div style={{ color: styles.textSecondary, fontSize: '13px', marginTop: '2px' }}>{org.contact_name}{org.contact_name && ' · '}{org.contact_email}</div>
                  </div>
                  <div style={{ borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px' }}>
                    <span style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>System</span>
                    <div style={{ color: styles.textPrimary, fontSize: '15px', marginTop: '4px' }}>{sys.system_name}</div>
                    <div style={{ color: styles.textSecondary, fontSize: '13px', marginTop: '6px', lineHeight: '1.5' }}>{sys.system_description}</div>
                  </div>
                  <div style={{ borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px' }}>
                    <span style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, letterSpacing: '1px', textTransform: 'uppercase' }}>Operating Domains</span>
                    <div style={{ color: styles.textSecondary, fontSize: '13px', marginTop: '6px', lineHeight: '1.5' }}>{sys.operating_domains}</div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(22,135,62,0.06)', border: '1px solid rgba(22,135,62,0.15)', padding: '16px' }}>
                <p style={{ color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>What Happens Next</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['We analyze your system and prepare a certification fee proposal', 'You review and accept the proposal', 'We deploy the ENVELO Interlock — it auto-discovers your operating boundaries', 'CAT-72 conformance testing runs (72 cumulative hours)', 'ODDC certificate issued on pass — listed in the public registry'].map((text, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span style={{ color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px', minWidth: '20px' }}>{i + 1}.</span>
                      <span style={{ color: styles.textSecondary, fontSize: '13px' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '12px 16px', border: `1px solid ${styles.borderGlass}`, background: styles.cardSurface }}>
                <p style={{ color: styles.textTertiary, fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                  <strong style={{ color: styles.textSecondary }}>Your IP stays yours.</strong> Our assessment certifies the conformance process, not your proprietary parameters. The ENVELO Interlock observes operational boundaries without exposing your algorithms or trade secrets.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${styles.borderGlass}` }}>
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, padding: '10px 24px', color: styles.textSecondary, cursor: 'pointer', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Back</button>
            ) : <div />}
            {step < totalSteps ? (
              <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} style={{ background: canNext() ? styles.purplePrimary : 'rgba(0,0,0,0.025)', border: `1px solid ${canNext() ? styles.purpleBright : styles.borderGlass}`, padding: '10px 32px', color: canNext() ? '#fff' : styles.textTertiary, cursor: canNext() ? 'pointer' : 'not-allowed', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Continue</button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} style={{ background: styles.accentGreen, border: '1px solid ' + styles.accentGreen, padding: '10px 32px', color: '#fff', cursor: submitting ? 'wait' : 'pointer', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Submitting…' : 'Submit Application'}</button>
            )}
          </div>
        </>}
      </Panel>
    </div>
  );
}

export default NewApplication;
