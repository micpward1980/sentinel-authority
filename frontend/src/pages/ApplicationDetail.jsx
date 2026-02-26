import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import CopyableId from '../components/CopyableId';
import ExportBundle from '../components/ExportBundle';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUTC(ts) {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').substring(0, 19) + 'Z';
}

function stateColor(state) {
  if (state === 'conformant') return styles.accentGreen;
  if (state === 'revoked' || state === 'suspended') return styles.accentRed;
  if (state === 'observe' || state === 'bounded' || state === 'approved') return styles.purpleBright;
  if (state === 'under_review') return styles.accentAmber;
  return styles.accentAmber;
}

const PANEL_LABEL = {
  fontFamily: styles.mono, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: styles.textTertiary, marginBottom: '16px',
};

const ACTION_BTN = (color, solid = false) => ({
  padding: '8px 16px',
  background: solid ? color : 'transparent',
  border: `1px solid ${solid ? color : styles.borderGlass}`,
  color: solid ? '#fff' : color,
  fontFamily: styles.mono, fontSize: '11px',
  fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', cursor: 'pointer',
});

// ─── Pipeline — matches backend CertificationState enum ──────────────────────

const PIPELINE_STAGES = [
  { key: 'pending',      label: 'Submitted',           icon: '1' },
  { key: 'under_review', label: 'Under Review',        icon: '2' },
  { key: 'approved',     label: 'Approved',             icon: '3' },
  { key: 'observe',      label: 'Interlock Observing',  icon: '4' },
  { key: 'bounded',      label: 'CAT-72 Testing',       icon: '5' },
  { key: 'conformant',   label: 'Conformant',           icon: '✓' },
];

const NEXT_STEP = {
  pending:      'Your application is queued for review by the Sentinel Authority team.',
  under_review: 'Our team is evaluating your system information and preparing approval.',
  approved:     'API key provisioned and sent. Waiting for customer to deploy the ENVELO Interlock.',
  observe:      'ENVELO Interlock is deployed and observing the system. Auto-discovering operational boundaries from live telemetry.',
  bounded:      'Boundaries approved. CAT-72 conformance test in progress — 72 cumulative hours of enforced operation.',
  conformant:   'Your system has achieved ODDC Conformance. Certificate and ENVELO Interlock credentials are active.',
  suspended:    'This application has been suspended. Contact conformance@sentinelauthority.org for remediation steps.',
  revoked:      'This application has been revoked. Contact conformance@sentinelauthority.org for remediation steps.',
  expired:      'This certification has expired. Submit a new application or contact conformance@sentinelauthority.org.',
};

// ─── Email Preview Modal ──────────────────────────────────────────────────────

function EmailPreviewModal({ preview, onCancel, onConfirm }) {
  if (!preview) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'rgba(255,255,255,0.97)', border: `1px solid ${styles.borderGlass}`, maxWidth: 'min(650px, 95vw)', width: '95%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: styles.purpleBright }}>Email Preview</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: styles.textTertiary }}>
              Will be sent to <strong style={{ color: styles.textPrimary }}>{preview.to}</strong>
            </p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '18px', padding: '4px 8px' }}>×</button>
        </div>
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${styles.borderGlass}` }}>
          <div style={{ fontSize: '11px', color: styles.textTertiary, marginBottom: '2px', fontFamily: styles.mono }}>Subject</div>
          <div style={{ fontSize: '14px', color: styles.textPrimary, fontWeight: 500 }}>{preview.subject}</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <div dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onCancel} style={ACTION_BTN(styles.textSecondary)}>Cancel</button>
          <button onClick={onConfirm} style={ACTION_BTN(
            preview.newState === 'suspended' ? styles.accentRed : '#fff',
            preview.newState !== 'suspended'
          )}>
            {preview.label} + Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ApplicationDetail ────────────────────────────────────────────────────────

function ApplicationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: app, isLoading, isError } = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get(`/api/applications/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['application', id, 'history'],
    queryFn: () => api.get(`/api/applications/${id}/history`).then(r => r.data),
    enabled: !!id,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['application', id, 'comments'],
    queryFn: () => api.get(`/api/applications/${id}/comments`).then(r => r.data),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['application', id] });
    qc.invalidateQueries({ queryKey: ['applications'] });
  };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const showEmailPreview = async (newState, label) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/api/applications/${id}/email-preview?new_state=${newState}`);
      setEmailPreview({ ...res.data, label, newState });
    } catch { toast.show('Preview failed', 'error'); }
    setPreviewLoading(false);
  };

  const confirmStateChange = async () => {
    if (!emailPreview) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=${emailPreview.newState}`);
      setEmailPreview(null);
      invalidate();
      toast.show(`State changed to ${emailPreview.newState}`, 'success');
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleStateDropdown = async (newState) => {
    if (!await confirm({ title: 'Change Status', message: `Change status to ${newState.toUpperCase()}?` })) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=${newState}`);
      // Auto-provision key on approval
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, { params: { application_id: id, send_email: true } });
          toast.show('Approved — API key generated and emailed to customer', 'success');
        } catch { /* non-fatal */ }
      }
      invalidate();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleDelete = async () => {
    if (!await confirm({ title: 'Delete Application', message: 'Are you sure? This cannot be undone.', danger: true, confirmLabel: 'Delete' })) return;
    try {
      await api.delete(`/api/applications/${id}`);
      toast.show('Application deleted', 'success');
      navigate('/applications');
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleReinstate = async () => {
    if (!await confirm({ title: 'Reinstate', message: 'Reinstate to pending? Applicant will go through review again.' })) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=pending`);
      invalidate();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await api.post(`/api/applications/${id}/comments`, { content: newComment, is_internal: isInternal });
      setNewComment('');
      setIsInternal(false);
      refetchComments();
      toast.show('Comment added', 'success');
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
    setPostingComment(false);
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/api/applications/${id}/comments/${commentId}`);
      refetchComments();
      toast.show('Comment deleted', 'success');
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const currentStageIdx = useMemo(() => PIPELINE_STAGES.findIndex(s => s.key === app?.state), [app?.state]);
  const isSuspended = app?.state === 'revoked' || app?.state === 'suspended';
  const isAdmin = user?.role === 'admin';

  // ─── Loading / Error ─────────────────────────────────────────────────────────

  if (isLoading) return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim, letterSpacing: '0.10em' }}>LOADING...</div>
  );

  if (isError || !app) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.accentRed, marginBottom: '16px' }}>Failed to load application.</p>
      <Link to="/applications" style={{ color: styles.purpleBright, fontFamily: styles.mono, fontSize: '11px' }}>← Back to Applications</Link>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <EmailPreviewModal preview={emailPreview} onCancel={() => setEmailPreview(null)} onConfirm={confirmStateChange} />

      {/* Nav + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link to="/applications" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
          <ArrowLeft size={13} /> Back
        </Link>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {app.state === 'pending' && (
              <button onClick={() => showEmailPreview('under_review', 'Begin Review')} disabled={previewLoading} style={ACTION_BTN(styles.accentAmber)}>Begin Review</button>
            )}
            {app.state === 'pending' && (
              <button onClick={() => showEmailPreview('approved', 'Skip to Approved')} disabled={previewLoading} style={{ ...ACTION_BTN(styles.textTertiary), fontSize: '10px', opacity: 0.6 }}>Skip Review</button>
            )}
            {app.state === 'under_review' && (
              <button onClick={() => showEmailPreview('approved', 'Approve')} disabled={previewLoading} style={ACTION_BTN(styles.accentGreen, true)}>Approve & Push Key</button>
            )}
            {app.state === 'observe' && (
              <button onClick={() => showEmailPreview('bounded', 'Approve Boundaries')} disabled={previewLoading} style={ACTION_BTN(styles.accentGreen, true)}>Approve Boundaries → Begin CAT-72</button>
            )}
            {['under_review', 'approved', 'observe', 'bounded', 'conformant'].includes(app.state) && (
              <button onClick={() => showEmailPreview('suspended', 'Suspend Application')} style={ACTION_BTN(styles.accentRed)}>Suspend</button>
            )}
            {(app.state === 'suspended' || app.state === 'revoked') && (
              <button onClick={handleReinstate} style={ACTION_BTN(styles.accentGreen)}>Reinstate</button>
            )}
            {app.state === 'expired' && (
              <button onClick={handleReinstate} style={ACTION_BTN(styles.purpleBright)}>Re-open</button>
            )}
            {['pending', 'suspended', 'revoked'].includes(app.state) && (
              <button onClick={handleDelete} style={ACTION_BTN(styles.accentRed)}>Delete</button>
            )}
          </div>
        )}
      </div>

      {/* Pipeline */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = stage.key === app.state;
            const isComplete = currentStageIdx > i;
            const color = isComplete ? styles.accentGreen : isActive ? styles.purpleBright : styles.borderGlass;
            return (
              <React.Fragment key={stage.key}>
                {i > 0 && <div style={{ flex: 1, height: '2px', background: isComplete ? styles.accentGreen : styles.borderGlass, margin: '0 8px', borderRadius: 8 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '72px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: styles.mono, fontSize: '11px', fontWeight: 700,
                    background: isComplete ? 'rgba(22,135,62,0.08)' : isActive ? 'rgba(29,26,59,0.12)' : 'transparent',
                    border: `2px solid ${color}`, color,
                  }}>
                    {isComplete ? '✓' : stage.icon}
                  </div>
                  <span style={{
                    fontFamily: styles.mono, fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: isActive ? styles.purpleBright : isComplete ? styles.accentGreen : styles.textDim, textAlign: 'center',
                  }}>
                    {stage.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {isSuspended && (
          <div style={{ padding: '10px 14px', border: `1px solid ${styles.accentRed}20`, marginBottom: '10px' }}>
            <span style={{ color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', fontWeight: 600 }}>⚠ SUSPENDED — Pending review.</span>
          </div>
        )}

        <div style={{ padding: '12px 16px', border: `1px solid ${styles.borderGlass}` }}>
          <span style={{ color: styles.textSecondary, fontSize: '13px', lineHeight: 1.6 }}>{NEXT_STEP[app.state] || ''}</span>
        </div>
      </Panel>

      {/* Header */}
      <div>
        <p style={{
          fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase',
          color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CopyableId id={app.application_number} style={{ color: styles.purpleBright, fontSize: '10px' }} />
        </p>
        <h1 style={{ fontFamily: styles.serif, fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0 }}>{app.system_name}</h1>
        {app.system_description && <p style={{ color: styles.textSecondary, marginTop: '8px', marginBottom: 0 }}>{app.system_description}</p>}
      </div>

      {/* Org + Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <Panel>
          <h2 style={PANEL_LABEL}>Organization</h2>
          <p style={{ color: styles.textPrimary, fontSize: '17px', fontWeight: 500, marginBottom: '12px' }}>{app.organization_name}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Contact:</strong> {app.contact_name}</p>
            <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Email:</strong> {app.contact_email}</p>
            {app.contact_phone && <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Phone:</strong> {app.contact_phone}</p>}
          </div>
        </Panel>

        <Panel>
          <h2 style={PANEL_LABEL}>Status</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '3px 10px', background: `${stateColor(app.state)}10`, color: stateColor(app.state),
            }}>
              {app.state?.replace('_', ' ')}
            </span>
            {isAdmin && (
              <select value={app.state} onChange={e => handleStateDropdown(e.target.value)}
                style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="observe">Observe</option>
                <option value="bounded">Bounded (CAT-72)</option>
                <option value="conformant">Conformant</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
            )}
          </div>
          <p style={{ color: styles.textSecondary, margin: 0, fontFamily: styles.mono, fontSize: '12px' }}>
            Submitted: {fmtUTC(app.submitted_at)}
          </p>
        </Panel>
      </div>

      {/* System Details */}
      <Panel>
        <h2 style={PANEL_LABEL}>System Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <p style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, marginBottom: '4px' }}>TYPE</p>
            <p style={{ color: styles.textPrimary, margin: 0 }}>{app.system_type || '—'}</p>
          </div>
          <div>
            <p style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, marginBottom: '4px' }}>VERSION</p>
            <p style={{ color: styles.textPrimary, margin: 0 }}>{app.system_version || '—'}</p>
          </div>
          <div>
            <p style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, marginBottom: '4px' }}>MANUFACTURER</p>
            <p style={{ color: styles.textPrimary, margin: 0 }}>{app.manufacturer || '—'}</p>
          </div>
          {app.facility_location && (
            <div>
              <p style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, marginBottom: '4px' }}>FACILITY</p>
              <p style={{ color: styles.textPrimary, margin: 0 }}>{app.facility_location}</p>
            </div>
          )}
          {app.odd_specification?.deployment_type && (
            <div>
              <p style={{ color: styles.textTertiary, fontSize: '11px', fontFamily: styles.mono, marginBottom: '4px' }}>DEPLOYMENT</p>
              <p style={{ color: styles.textPrimary, margin: 0 }}>
                {app.odd_specification.deployment_type}
                {app.odd_specification.environment ? ` — ${app.odd_specification.environment}` : ''}
              </p>
            </div>
          )}
        </div>
      </Panel>

      {/* Detected Boundaries — only show when interlock has discovered them */}
      {app.envelope_definition && (app.state === 'observe' || app.state === 'bounded' || app.state === 'conformant') && (() => {
        const env = typeof app.envelope_definition === 'string' ? JSON.parse(app.envelope_definition) : app.envelope_definition;
        const nb = env?.numeric_boundaries || [];
        const gb = env?.geo_boundaries || env?.geographic_boundaries || [];
        const tb = env?.time_boundaries || [];
        const sb = env?.state_boundaries || [];
        const hasData = nb.length > 0 || gb.length > 0 || tb.length > 0 || sb.length > 0;

        if (!hasData) return null;

        return (
          <Panel accent={app.state === 'observe' ? 'amber' : undefined}>
            <h2 style={PANEL_LABEL}>
              {app.state === 'observe' ? 'Auto-Detected Boundaries — Pending Review' : 'Enforced Boundaries'}
            </h2>

            {app.state === 'observe' && (
              <div style={{ padding: '10px 14px', background: 'rgba(158,110,18,0.04)', border: '1px solid rgba(158,110,18,0.15)', borderRadius: '6px', marginBottom: '16px' }}>
                <p style={{ color: styles.accentAmber, fontSize: '12px', margin: 0 }}>
                  ⚠ These boundaries were auto-discovered by the ENVELO Interlock during the OBSERVE phase. Review and approve to begin CAT-72.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: '8px', textAlign: 'center', marginBottom: '16px' }}>
              {[
                { label: 'Numeric', count: nb.length },
                { label: 'Geographic', count: gb.length },
                { label: 'Time', count: tb.length },
                { label: 'State', count: sb.length },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px', background: 'rgba(29,26,59,0.05)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 500, color: styles.purpleBright }}>{s.count}</div>
                  <div style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {nb.length > 0 && (
              <div>
                <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px' }}>Numeric Boundaries</p>
                {nb.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${styles.borderSubtle}`, fontSize: '12px' }}>
                    <span style={{ color: styles.textPrimary }}>{b.name}</span>
                    <span style={{ fontFamily: styles.mono, color: styles.purpleBright }}>
                      {b.min_value ?? '—'} → {b.max_value ?? '—'} {b.unit || ''}
                      {b.tolerance ? ` (±${b.tolerance})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isAdmin && app.state === 'observe' && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={() => showEmailPreview('bounded', 'Approve Boundaries')}
                  disabled={previewLoading}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${styles.accentGreen}`, color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px' }}>
                  ✓ Approve Boundaries — Begin CAT-72
                </button>
              </div>
            )}
          </Panel>
        );
      })()}

      {/* State History */}
      {history.length > 0 && (
        <Panel>
          <h2 style={PANEL_LABEL}>State Change History</h2>
          <div style={{ position: 'relative', paddingLeft: '28px' }}>
            <div style={{ position: 'absolute', left: '8px', top: '4px', bottom: '4px', width: '1px', background: styles.borderGlass, borderRadius: 8 }} />
            {history.map((entry, i) => {
              const ns = entry.details?.new_state;
              const color = ns === 'conformant' || ns === 'approved' || ns === 'bounded' ? styles.accentGreen
                : ns === 'suspended' || ns === 'revoked' ? styles.accentRed
                : ns === 'under_review' || ns === 'observe' ? styles.purpleBright
                : entry.action === 'submitted' ? styles.purpleBright
                : styles.accentAmber;
              const label = ns?.replace('_', ' ') || entry.action?.replace('_', ' ');
              const from = entry.details?.old_state?.replace('_', ' ');
              return (
                <div key={i} style={{ position: 'relative', paddingBottom: i < history.length - 1 ? '20px' : 0 }}>
                  <div style={{ position: 'absolute', left: '-24px', top: '3px', width: '11px', height: '11px', borderRadius: '50%', background: `${color}10`, border: `2px solid ${color}` }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                      {from && entry.action !== 'submitted' && (
                        <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, marginLeft: '8px' }}>from {from}</span>
                      )}
                      <div style={{ marginTop: '3px', fontSize: '12px', color: styles.textTertiary }}>{entry.user_email}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, flexShrink: 0 }}>
                      {fmtUTC(entry.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Comments */}
      <Panel>
        <h2 style={PANEL_LABEL}>Comments & Notes</h2>
        <div style={{ marginBottom: comments.length > 0 ? '20px' : 0 }}>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            rows={3}
            placeholder="Add a comment or note..."
            style={{ width: '100%', background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px', fontFamily: 'inherit', padding: '12px 16px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = styles.purpleBright}
            onBlur={e => e.target.style.borderColor = styles.borderGlass}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
            {isAdmin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} style={{ accentColor: styles.purpleBright }} />
                <span style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, color: styles.textTertiary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Internal only</span>
              </label>
            )}
            <button onClick={handlePostComment} disabled={postingComment || !newComment.trim()}
              style={{
                ...ACTION_BTN('#fff', true),
                background: newComment.trim() ? styles.purplePrimary : 'transparent',
                borderColor: newComment.trim() ? styles.purpleBright : styles.borderGlass,
                color: newComment.trim() ? '#fff' : styles.textTertiary,
                opacity: postingComment ? 0.6 : 1,
                cursor: newComment.trim() ? 'pointer' : 'default',
                borderRadius: 8,
              }}>
              {postingComment ? 'Posting…' : 'Post Comment'}
            </button>
          </div>
        </div>
        {comments.length > 0 && (
          <div style={{ borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px' }}>
            {comments.map(c => (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: `1px solid ${styles.borderSubtle}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: styles.mono, fontSize: '12px', fontWeight: 600, color: c.user_role === 'admin' ? styles.purpleBright : styles.textSecondary }}>{c.user_email}</span>
                    {c.user_role === 'admin' && <span style={{ fontFamily: styles.mono, fontSize: '9px', fontWeight: 600, padding: '1px 6px', color: styles.purpleBright, border: `1px solid ${styles.purpleBright}30`, textTransform: 'uppercase' }}>Admin</span>}
                    {c.is_internal && <span style={{ fontFamily: styles.mono, fontSize: '9px', fontWeight: 600, padding: '1px 6px', color: styles.accentAmber, border: `1px solid ${styles.accentAmber}30`, textTransform: 'uppercase' }}>Internal</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>{fmtUTC(c.created_at)}</span>
                    {(isAdmin || user?.email === c.user_email) && (
                      <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '14px', padding: 0, opacity: 0.5 }} title="Delete">×</button>
                    )}
                  </div>
                </div>
                <p style={{ color: styles.textSecondary, fontSize: '13px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{c.content}</p>
              </div>
            ))}
          </div>
        )}
        {comments.length === 0 && !newComment && (
          <p style={{ color: styles.textDim, fontSize: '13px', margin: 0, fontFamily: styles.mono }}>No comments yet</p>
        )}
      </Panel>

      {/* Export Bundle */}
      <ExportBundle app={app} history={history} comments={comments} isAdmin={isAdmin} />

      {/* Applicant Notes */}
      {app.notes && (
        <Panel>
          <h2 style={PANEL_LABEL}>Applicant Notes</h2>
          <p style={{ color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{app.notes}</p>
        </Panel>
      )}
    </div>
  );
}

export default ApplicationDetail;
