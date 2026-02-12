import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';

function NewApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [appNumber, setAppNumber] = useState('');

  const [form, setForm] = useState({
    organization_name: '',
    contact_email: '',
    system_name: '',
  });

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        organization_name: user.organization_name || '',
        contact_email: user.email || '',
      }));
    }
  }, [user]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const canSubmit = form.organization_name && form.contact_email && form.system_name;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/applications/', {
        organization_name: form.organization_name,
        contact_email: form.contact_email,
        system_name: form.system_name,
        system_description: form.system_name,
      });
      setAppNumber(res.data.application_number || res.data.id);
      setSubmitted(true);
      toast.show('Application submitted', 'success');
    } catch (err) {
      toast.show(err?.response?.data?.detail || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: '#fff',
    fontFamily: "Calibri, 'Inter', system-ui, sans-serif",
    fontSize: '14px',
    transition: 'border-color 0.2s ease',
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 0', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 24px',
          border: '2px solid rgba(92,214,133,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#5CD685', fontSize: 28
        }}>✓</div>
        <h1 style={{
          fontFamily: "Georgia, 'Source Serif 4', serif",
          fontSize: 28, fontWeight: 200, marginBottom: 8
        }}>Application Submitted</h1>
        <p style={{
          fontFamily: "Consolas, 'IBM Plex Mono', monospace",
          fontSize: 13, color: '#a896d6', letterSpacing: 1, marginBottom: 24
        }}>{appNumber}</p>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Your application is under review. Once approved, you'll receive Interlock deployment credentials 
          and a one-command install script. The Interlock will auto-discover your system's boundaries 
          and begin the CAT-72 verification process.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/applications')} className="btn"
            style={{ padding: '12px 24px', color: '#a896d6', borderColor: 'rgba(157,140,207,0.3)',
              fontFamily: "Consolas, monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
            View Applications
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn"
            style={{ padding: '12px 24px', color: 'rgba(255,255,255,.5)', borderColor: 'rgba(255,255,255,0.07)',
              fontFamily: "Consolas, monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <SectionHeader label="New Application" title="Apply for ODDC" />
      <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, lineHeight: 1.6, marginBottom: 32 }}>
        Three fields. Submit your application, and we'll handle the rest — Interlock deployment, 
        boundary discovery, and CAT-72 verification are all automated.
      </p>

      <Panel>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,.78)', fontSize: 13 }}>
              Organization Name
            </label>
            <input
              type="text"
              value={form.organization_name}
              onChange={e => set('organization_name', e.target.value)}
              className="w-full px-4 py-3 outline-none"
              style={inputStyle}
              placeholder="Acme Robotics Inc."
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,.78)', fontSize: 13 }}>
              Contact Email
            </label>
            <input
              type="email"
              value={form.contact_email}
              onChange={e => set('contact_email', e.target.value)}
              className="w-full px-4 py-3 outline-none"
              style={inputStyle}
              placeholder="ops@acmerobotics.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,.78)', fontSize: 13 }}>
              System Name
            </label>
            <input
              type="text"
              value={form.system_name}
              onChange={e => set('system_name', e.target.value)}
              className="w-full px-4 py-3 outline-none"
              style={inputStyle}
              placeholder="e.g., WarehouseBot v3, DeliveryDrone Mark II"
            />
            <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              One system = one unique software + operating domain combination.
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 20, marginTop: 4 }}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn w-full"
              style={{
                padding: '14px 24px',
                color: canSubmit ? '#5CD685' : 'rgba(255,255,255,.2)',
                borderColor: canSubmit ? 'rgba(92,214,133,0.3)' : 'rgba(255,255,255,0.04)',
                fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: submitting ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Application — $12,000'}
            </button>
            <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 10, textAlign: 'center', marginTop: 10, lineHeight: 1.4 }}>
              Assessment fee due at approval. Covers ODD review, CAT-72, and certificate issuance.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default NewApplication;
