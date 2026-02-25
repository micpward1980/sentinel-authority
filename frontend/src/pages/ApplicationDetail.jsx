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
import BoundaryEditor from '../components/BoundaryEditor';
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
  if (state === 'testing' || state === 'approved') return styles.purpleBright;
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

const PIPELINE_STAGES = [
  { key: 'pending',      label: 'Submitted',     icon: '1' },
  { key: 'under_review', label: 'Under Review',  icon: '2' },
  { key: 'approved',     label: 'Approved',      icon: '3' },
  { key: 'testing',      label: 'CAT-72 Testing', icon: '4' },
  { key: 'conformant',   label: 'Conformant',    icon: '✓' },
];

const NEXT_STEP = {
  pending:      'Your application is queued for review by the Sentinel Authority team.',
  under_review: 'Our team is evaluating your ODD specification and boundary definitions.',
  approved:     'Your system is approved. The ENVELO agent is being configured for CAT-72 testing.',
  testing:      'CAT-72 continuous conformance test is in progress (72-hour minimum).',
  conformant:   'Your system has achieved ODDC Conformance. Your certificate and ENVELO agent credentials are active.',
  revoked:      'This application has been suspended. Contact info@sentinelauthority.org for remediation steps.',
  suspended:    'This application has been suspended. Contact info@sentinelauthority.org for remediation steps.',
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

  const [scheduling, setScheduling] = useState(false);
  const [testCreated, setTestCreated] = useState(null);
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
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, { params: { application_id: id, send_email: true } });
        } catch { /* non-fatal */ }
      }
      invalidate();
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  const handleScheduleTest = async () => {
    if (!await confirm({ title: 'Schedule Test', message: 'Schedule a CAT-72 test? It will need to be started manually.' })) return;
    setScheduling(true);
    try {
      const res = await api.post('/api/cat72/tests', { application_id: parseInt(id) });
      setTestCreated(res.data);
      toast.show(`CAT-72 Test created: ${res.data.test_id} — Go to CAT-72 Console to start.`, 'success');
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
    setScheduling(false);
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
            {app.state === 'pending' && <button onClick={() => showEmailPreview('under_review', 'Begin Review')} disabled={previewLoading} style={ACTION_BTN(styles.accentAmber)}>Begin Review</button>}
            {(app.state === 'pending' || app.state === 'under_review') && <button onClick={() => showEmailPreview('approved', 'Approve Application')} disabled={previewLoading} style={ACTION_BTN(styles.accentGreen)}>Approve</button>}
            {app.state === 'under_review' app.state === 'approved' && <button onClick={() => navigateapp.state === 'approved' && <button onClick={() => navigate <button onClick={() => navigate(`/applications/${id}/pre-review`)} style={ACTION_BTN(styles.purpleBright, true)}>Pre-CAT-72 Review</button>}
            {['pending','under_review','approved','testing','conformant'].includes(app.state) && <button onClick={() => showEmailPreview('suspended', 'Suspend Application')} style={ACTION_BTN(styles.accentRed)}>Suspend</button>}
            {(app.state === 'suspended' || app.state === 'revoked') && <button onClick={handleReinstate} style={ACTION_BTN(styles.accentGreen)}>Reinstate</button>}
            {app.state === 'expired' && <button onClick={handleReinstate} style={ACTION_BTN(styles.purpleBright)}>Re-open</button>}
            <button onClick={handleDelete} style={ACTION_BTN(styles.accentRed)}>Delete</button>
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
                {i > 0 && <div style={{ flex: 1, height: '2px', background: isComplete ? styles.accentGreen : styles.borderGlass, margin: '0 8px' , borderRadius: 8}} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '72px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: styles.mono, fontSize: '11px', fontWeight: 700, background: isComplete ? 'rgba(22,135,62,0.08)' : isActive ? 'rgba(29,26,59,0.12)' : 'transparent', border: `2px solid ${color}`, color }}>
                    {isComplete ? '✓' : stage.icon}
                  </div>
                  <span style={{ fontFamily: styles.mono, fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? styles.purpleBright : isComplete ? styles.accentGreen : styles.textDim, textAlign: 'center' }}>
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

      {/* Test created banner */}
      {testCreated && (
        <div style={{ padding: '14px 16px', border: `1px solid ${styles.accentGreen}30`, background: `${styles.accentGreen}06` }}>
          <span style={{ color: styles.accentGreen, fontFamily: styles.mono, fontSize: '12px', fontWeight: 600 }}>
            Test Created: {testCreated.test_id} — <Link to="/cat72" style={{ color: styles.purpleBright }}>Go to CAT-72 Console →</Link>
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <p style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <span style={{ fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', background: `${stateColor(app.state)}10`, color: stateColor(app.state) }}>
              {app.state}
            </span>
            {isAdmin && (
              <select value={app.state} onChange={e => handleStateDropdown(e.target.value)}
                style={{ background: styles.cardSurface, border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="testing">Testing</option>
                <option value="conformant">Conformant</option>
                <option value="revoked">Revoked</option>
              </select>
            )}
          </div>
          <p style={{ color: styles.textSecondary, margin: 0, fontFamily: styles.mono, fontSize: '12px' }}>
            Submitted: {fmtUTC(app.submitted_at)}
          </p>
        </Panel>
      </div>

      {/* System Details + ODD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <Panel>
          <h2 style={PANEL_LABEL}>System Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Version:</strong> {app.system_version || '—'}</p>
            <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Manufacturer:</strong> {app.manufacturer || '—'}</p>
            {app.facility_location && <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Facility:</strong> {app.facility_location}</p>}
            {app.preferred_test_date && <p style={{ color: styles.textSecondary, margin: 0 }}><strong>Preferred Test Date:</strong> {fmtUTC(app.preferred_test_date).substring(0, 10)}</p>}
          </div>
        </Panel>
        <Panel>
          <h2 style={PANEL_LABEL}>Safety Boundaries & Operational Limits</h2>
          <pre style={{ color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0, fontSize: '12px', fontFamily: styles.mono, wordBreak: 'break-word' }}>
            {typeof app.envelope_definition === 'object' ? JSON.stringify(app.envelope_definition, null, 2) : (app.envelope_definition || 'Not specified')}
          </pre>
        </Panel>
      </div>

      {/* ODD Specification */}
      <Panel>
        <h2 style={PANEL_LABEL}>ODD Specification</h2>
        <p style={{ color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
          {typeof app.odd_specification === 'object' ? (app.odd_specification?.description || JSON.stringify(app.odd_specification, null, 2)) : app.odd_specification}
        </p>
      </Panel>

      {/* Boundary Editor */}
      {isAdmin && (
        <BoundaryEditor
          applicationId={app.id}
          initialBoundaries={app.envelope_definition || {}}
          onSave={async (boundaries) => {
            try {
              await api.patch(`/api/applications/${app.id}`, { envelope_definition: boundaries });
              toast.show('Boundaries saved', 'success');
              invalidate();
            } catch (e) { toast.show('Failed to save: ' + e.message, 'error'); }
          }}
        />
      )}

      {/* State History */}
      {history.length > 0 && (
        <Panel>
          <h2 style={PANEL_LABEL}>State Change History</h2>
          <div style={{ position: 'relative', paddingLeft: '28px' }}>
            <div style={{ position: 'absolute', left: '8px', top: '4px', bottom: '4px', width: '1px', background: styles.borderGlass , borderRadius: 8}} />
            {history.map((entry, i) => {
              const ns = entry.details?.new_state;
              const color = ns === 'conformant' || ns === 'approved' ? styles.accentGreen
                : ns === 'suspended' || ns === 'revoked' ? styles.accentRed
                : ns === 'under_review' || ns === 'testing' ? styles.purpleBright
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
              style={{ ...ACTION_BTN('#fff', true), background: newComment.trim() ? styles.purplePrimary : 'transparent', borderColor: newComment.trim() ? styles.purpleBright : styles.borderGlass, color: newComment.trim() ? '#fff' : styles.textTertiary, opacity: postingComment ? 0.6 : 1, cursor: newComment.trim() ? 'pointer' : 'default' , borderRadius: 8}}>
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
