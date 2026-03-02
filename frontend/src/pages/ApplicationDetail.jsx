import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

const STATE_LABEL = {
  pending: "Submitted",
  approved: "Accepted",
  observe: "Interlock Deploy",
  bounded: "Boundaries Review",
  testing: "CAT-72 Testing",
  conformant: "Conformant",
  suspended: "Non-Conformant",
  revoked: "Revoked",
  expired: "Expired",
  rejected: "Rejected",
};


function describeBoundary(b) {
  const t = b.type || 'unknown';
  switch (t) {
    // ── Physical ──
    case 'numeric':
      return { label: b.name, detail: `${b.min_value ?? '—'} → ${b.max_value ?? '—'} ${b.unit || ''}${b.tolerance ? ` (±${b.tolerance})` : ''}`, cat: 'Physical' };
    case 'categorical':
      return { label: b.name, detail: `Allowed: ${(b.allowed_values || b.allowed_states || []).join(', ')}`, cat: 'Physical', chips: b.allowed_values || b.allowed_states };
    case 'geographic':
    case 'radius':
      return { label: b.name, detail: `${b.radius_m ? (b.radius_m/1000).toFixed(1) + 'km radius' : '—'} from ${b.center_lat?.toFixed(4) ?? '?'}, ${b.center_lng?.toFixed(4) ?? '?'}`, cat: 'Physical', geo: true };
    case 'polygon':
      return { label: b.name, detail: `${(b.vertices || b.points || []).length}-point geofence boundary`, cat: 'Physical', geo: true };
    case 'temporal':
      return { label: b.name, detail: `${b.start || '—'} → ${b.end || '—'}${b.timezone ? ` (${b.timezone})` : ''}${b.days ? ` · ${b.days.join(', ')}` : ''}`, cat: 'Physical' };
    case 'rate_of_change':
      return { label: b.name || b.variable, detail: `Max change: ${b.max_rate ?? b.max_delta ?? '—'} ${b.unit || ''}/s${b.window ? ` over ${b.window}s` : ''}`, cat: 'Physical' };
    case 'compound': case 'conditional':
      return { label: b.name, detail: `${b.condition || b.when || '—'} → limit ${b.then_max ?? b.limit ?? '—'} ${b.unit || ''}`, cat: 'Physical' };
    case 'boolean':
      return { label: b.name || b.variable, detail: `Must be ${b.required_value ?? b.expected ?? 'true'} during operation`, cat: 'Physical' };
    case 'connectivity':
      return { label: b.name || 'Heartbeat', detail: `Max gap: ${b.max_gap_seconds ?? b.timeout ?? '—'}s between signals`, cat: 'Physical' };

    // ── Analytical ──
    case 'cumulative':
      return { label: b.name || b.variable, detail: `Running total must stay below ${b.max_cumulative ?? b.threshold ?? '—'} ${b.unit || ''}${b.reset_period ? ` (resets ${b.reset_period})` : ''}`, cat: 'Analytical' };
    case 'statistical': case 'rolling_window':
      return { label: b.name || b.variable, detail: `Rolling ${b.window_samples || b.window || '—'}-sample ${b.metric || 'avg'} must stay within ${b.min ?? '—'} → ${b.max ?? '—'}`, cat: 'Analytical' };
    case 'frequency': case 'count':
      return { label: b.name || b.event, detail: `Max ${b.max_count ?? b.threshold ?? '—'} occurrences per ${b.period || b.window || '—'}`, cat: 'Analytical' };
    case 'sequence': case 'state_machine':
      return { label: b.name, detail: `Required order: ${(b.required_sequence || b.steps || []).join(' → ')}`, cat: 'Analytical' };
    case 'drift': case 'baseline':
      return { label: b.name || b.variable, detail: `Must not drift more than ${b.max_drift ?? b.threshold ?? '—'}% from baseline over ${b.window_samples || '—'} samples`, cat: 'Analytical' };
    case 'multi_condition': case 'multi_variable':
      return { label: b.name, detail: `${(b.conditions || []).length || '—'} conditions must all be met simultaneously`, cat: 'Analytical' };

    // ── Aviation / Spatial ──
    case 'exclusion_zone': case 'no_fly': case 'restricted_area':
      return { label: b.name, detail: `Exclusion zone — ${b.radius_m ? (b.radius_m/1000).toFixed(1) + 'km' : '—'} around ${b.center_lat?.toFixed(4) ?? '?'}, ${b.center_lng?.toFixed(4) ?? '?'}`, cat: 'Aviation', geo: true, exclusion: true };
    case 'proximity': case 'separation': case 'daa':
      return { label: b.name || 'Separation', detail: `Min ${b.min_distance ?? b.separation ?? '—'}${b.unit || 'm'} from ${b.target || 'other objects'}`, cat: 'Aviation' };
    case 'redundancy': case 'min_count':
      return { label: b.name || b.system, detail: `Min ${b.min_operational ?? b.min_count ?? '—'} of ${b.total ?? '—'} ${b.component || 'units'} must be operational`, cat: 'Aviation' };
    case 'energy_reserve': case 'fuel_reserve': case 'battery_reserve':
      return { label: b.name || 'Energy reserve', detail: `Min ${b.min_reserve_pct ?? b.min_level ?? '—'}% ${b.resource || 'charge'} required`, cat: 'Aviation' };
    case 'dynamic': case 'notam': case 'live_boundary':
      return { label: b.name, detail: 'Live-updated boundary from external feed', cat: 'Aviation' };
    case 'envelope_curve': case 'function_boundary': case 'lookup_table':
      return { label: b.name, detail: `${b.curve_type || 'Curve'}: ${b.x_variable || '—'} vs ${b.y_variable || '—'} (${(b.points || []).length || '—'} control points)`, cat: 'Aviation' };

    // ── Healthcare / Process ──
    case 'calculated': case 'formula': case 'composite_score':
      return { label: b.name, detail: `Computed score must stay within ${b.result_min ?? '—'} → ${b.result_max ?? '—'}${b.inputs ? ` (${b.inputs.length} inputs)` : ''}`, cat: 'Process' };
    case 'contraindication': case 'prohibition': case 'never':
      return { label: b.name, detail: `PROHIBITED: ${b.description || (b.prohibited_actions ? Object.entries(b.prohibited_actions).map(([k,v]) => `${k}: ${v.join(', ')}`).join('; ') : '—')}`, cat: 'Process', alert: true };
    case 'escalation': case 'response_time': case 'time_to_action':
      return { label: b.name || b.trigger, detail: `Must respond within ${b.max_seconds ?? b.max_time ?? '—'}s of ${b.trigger || 'event'}`, cat: 'Process' };
    case 'protocol': case 'checklist': case 'care_bundle':
      return { label: b.name, detail: `${(b.required_steps || b.steps || []).length || '—'} required steps must be completed${b.max_time ? ` within ${b.max_time}` : ''}`, cat: 'Process' };
    case 'ratio': case 'proportion': case 'staffing':
      return { label: b.name, detail: `${b.numerator || '—'} : ${b.denominator || '—'} ratio must be ≥ ${b.min_ratio ?? '—'}`, cat: 'Process' };
    case 'jurisdiction': case 'scope': case 'authorization':
      return { label: b.name || b.role_key, detail: `${b.role_key || 'Role'} restricted from: ${b.prohibited_actions ? Object.values(b.prohibited_actions).flat().join(', ') : '—'}`, cat: 'Process', alert: true };

    default: {
      // Smart fallback: inspect fields and generate human-readable description
      let detail = '';
      let cat = 'Other';
      if (b.min_value != null && b.max_value != null) {
        detail = `${b.min_value} → ${b.max_value} ${b.unit || ''}${b.tolerance ? ` (±${b.tolerance})` : ''}`;
        cat = 'Physical';
      } else if (b.allowed_values || b.allowed_states) {
        detail = `Allowed: ${(b.allowed_values || b.allowed_states || []).join(', ')}`;
        cat = 'Physical';
        return { label: b.name || t, detail, cat, chips: b.allowed_values || b.allowed_states };
      } else if (b.forbidden_states || b.prohibited_actions) {
        const items = b.forbidden_states || Object.values(b.prohibited_actions || {}).flat();
        detail = `Prohibited: ${items.join(', ')}`;
        cat = 'Process';
        return { label: b.name || t, detail, cat, alert: true };
      } else if (b.max_rate != null || b.max_delta != null) {
        detail = `Max change: ${b.max_rate ?? b.max_delta} ${b.unit || ''}/s`;
        cat = 'Physical';
      } else if (b.start && b.end) {
        detail = `${b.start} → ${b.end}${b.timezone ? ` (${b.timezone})` : ''}`;
        cat = 'Physical';
      } else if (b.center_lat != null && b.center_lng != null) {
        detail = `${b.radius_m ? (b.radius_m/1000).toFixed(1) + 'km from' : 'At'} ${b.center_lat.toFixed(4)}, ${b.center_lng.toFixed(4)}`;
        cat = 'Physical';
        return { label: b.name || t, detail, cat, geo: true };
      } else if (b.max_gap_seconds != null || b.timeout != null) {
        detail = `Max gap: ${b.max_gap_seconds ?? b.timeout}s between signals`;
        cat = 'Physical';
      } else if (b.min_operational != null || b.min_count != null) {
        detail = `Min ${b.min_operational ?? b.min_count} of ${b.total ?? '?'} ${b.component || 'units'} operational`;
        cat = 'Aviation';
      } else if (b.min_reserve_pct != null || b.min_level != null) {
        detail = `Min ${b.min_reserve_pct ?? b.min_level}% ${b.resource || 'reserve'} required`;
        cat = 'Aviation';
      } else if (b.max_count != null || b.threshold != null) {
        detail = `Max ${b.max_count ?? b.threshold} occurrences per ${b.period || b.window || '?'}`;
        cat = 'Analytical';
      } else if (b.max_drift != null) {
        detail = `Max ${b.max_drift}% drift over ${b.window_samples || '?'} samples`;
        cat = 'Analytical';
      } else if (b.required_sequence || b.steps) {
        detail = `Required: ${(b.required_sequence || b.steps || []).join(' → ')}`;
        cat = 'Analytical';
      } else if (b.required_value != null || b.expected != null) {
        detail = `Must be ${b.required_value ?? b.expected} during operation`;
        cat = 'Physical';
      } else if (b.conditions) {
        detail = `${(b.conditions || []).length} conditions must all be met`;
        cat = 'Analytical';
      } else if (b.description) {
        detail = b.description;
      } else {
        // Last resort: show key-value pairs, skip metadata
        const skip = new Set(['name','type','id','created_at','updated_at']);
        const pairs = Object.entries(b).filter(([k]) => !skip.has(k)).slice(0, 4);
        detail = pairs.map(([k, v]) => `${k.replace(/_/g,' ')}: ${typeof v === 'object' ? JSON.stringify(v).substring(0,30) : v}`).join(' · ');
      }
      return { label: b.name || t, detail, cat };
    }
  }
}

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
  { key: 'approved',     label: 'Accepted',             icon: '2' },
  { key: 'observe',      label: 'Interlock Deploy',     icon: '3' },
  { key: 'bounded',      label: 'Boundaries Review',    icon: '4' },
  { key: 'testing',      label: 'CAT-72 Testing',       icon: '5' },
  { key: 'conformant',   label: 'Conformant',           icon: '✓' },
];

const NEXT_STEP = {
  pending:      'Your application has been received. Awaiting accept or reject decision.',
  approved:     'API key provisioned and sent. Waiting for customer to deploy the ENVELO Interlock.',
  observe:      'ENVELO Interlock is deployed and observing the system. Auto-discovering operational boundaries from live telemetry.',
  bounded:      'Auto-discovery complete. Review the detected operational boundaries before authorizing CAT-72 testing.',
  conformant:   'Your system has achieved ODDC Conformance. Certificate and ENVELO Interlock credentials are active.',
  suspended:    'This system is non-conformant based on enforcement data. Contact conformance@sentinelauthority.org for remediation steps.',
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
          <div dangerouslySetInnerHTML={{ __html: preview.html }} className="sa-email-preview" />
          <style>{`
.sa-email-preview td[style*="background"] { background: #1d1a3b !important; }
.sa-email-preview td[bgcolor] { background: #1d1a3b !important; }
.sa-email-preview table[style*="background"] { background: #1d1a3b !important; }
.sa-email-preview h1, .sa-email-preview h2 { font-family: ${styles.serif} !important; }
          `}</style>
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onCancel} style={ACTION_BTN(styles.textSecondary)}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px',
            background: preview.newState === 'suspended' ? 'transparent' : styles.accentGreen,
            border: '1px solid ' + (preview.newState === 'suspended' ? styles.accentRed : styles.accentGreen),
            color: preview.newState === 'suspended' ? styles.accentRed : '#fff',
            fontFamily: styles.mono, fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
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

  const [showCorForm, setShowCorForm] = useState(false);
  const [corType, setCorType] = useState('rfi');
  const [corDetails, setCorDetails] = useState('');
  const [corResponseReq, setCorResponseReq] = useState(true);
  const [correspondence, setCorrespondence] = useState([]);
  const [conformanceEvents, setConformanceEvents] = useState([]);
  
  const fetchCorrespondence = useCallback(async () => {
    try {
      const res = await api.get('/api/applications/' + id + '/correspondence');
      setCorrespondence(res.data || []);
    } catch {}
  }, [id]);
  
  useEffect(() => { fetchCorrespondence(); }, [fetchCorrespondence]);
  
  useEffect(() => {
    (async () => {
      try {
        const certRes = await api.get('/api/applications/' + id);
        const certId = certRes.data?.certificate?.certificate_number;
        if (certId) {
          const alertRes = await api.get('/api/surveillance/alerts?limit=50');
          const relevant = (alertRes.data?.alerts ?? []).filter(a => a.certificate_id === certId);
          setConformanceEvents(relevant);
        }
      } catch {}
    })();
  }, [id]);

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
          toast.show('Accepted — API key generated and emailed to customer', 'success');
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
            {app.state === 'under_review' && (<>
              <button onClick={() => showEmailPreview('approved', 'Approve')} disabled={previewLoading} style={ACTION_BTN(styles.accentGreen, true)}>Approve</button>
              <button onClick={() => showEmailPreview('suspended', 'Reject')} disabled={previewLoading} style={ACTION_BTN(styles.accentRed)}>Reject</button>
            </>)}
            {app.state === 'approved' && (
              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim, padding: '8px 0' }}>Awaiting customer interlock deployment</span>
            )}
            {app.state === 'testing' && (
              <Link to="/cat72" style={{ ...ACTION_BTN(styles.purpleBright), textDecoration: 'none' }}>View CAT-72 Console</Link>
            )}

            {(app.state === 'failed' || app.state === 'test_failed') && (
              <button onClick={() => showEmailPreview('testing', 'Retry Test')} disabled={previewLoading} style={ACTION_BTN(styles.accentAmber)}>Retry Test</button>
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
            const isFinal = isActive && stage.key === 'conformant';
            const isNonConformant = (app.state === 'suspended' || app.state === 'expired' || app.state === 'revoked') && stage.key === 'conformant';
            const color = isNonConformant ? styles.accentRed : (isComplete || isFinal) ? styles.accentGreen : isActive ? styles.purpleBright : styles.borderGlass;
            return (
              <React.Fragment key={stage.key}>
                {i > 0 && <div style={{ flex: 1, height: '2px', background: isComplete ? styles.accentGreen : styles.borderGlass, margin: '0 8px', borderRadius: 8 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '72px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: styles.mono, fontSize: '11px', fontWeight: 700,
                    background: isNonConformant ? 'rgba(220,38,38,0.08)' : (isComplete || isFinal) ? 'rgba(22,135,62,0.08)' : isActive ? 'rgba(29,26,59,0.12)' : 'transparent',
                    border: `2px solid ${color}`, color,
                  }}>
                    {isNonConformant ? '✕' : (isComplete || isFinal) ? '✓' : stage.icon}
                  </div>
                  <span style={{
                    fontFamily: styles.mono, fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: isNonConformant ? styles.accentRed : (isActive && stage.key === 'conformant') ? styles.accentGreen : isActive ? styles.purpleBright : isComplete ? styles.accentGreen : styles.textDim, textAlign: 'center',
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
            <span style={{ color: styles.accentRed, fontFamily: styles.mono, fontSize: '11px', fontWeight: 600 }}>⚠ MARK NON-CONFORMANTED — Pending review.</span>
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
              {STATE_LABEL[app.state] || app.state?.replace('_', ' ')}
            </span>

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
        let env;
        try { env = typeof app.envelope_definition === 'string' ? JSON.parse(app.envelope_definition) : app.envelope_definition; } catch { env = null; }
        if (!env || typeof env !== 'object') return null;
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

            {/* ── Plain-English Summary ── */}
            {(() => {
              const lines = [];
              const numByName = {};
              nb.forEach(b => { numByName[b.name] = b; });
              if (numByName.speed) {
                const s = numByName.speed;
                lines.push(`Your system was observed operating at speeds up to ${s.observed_max ?? s.max_value} ${s.unit || 'km/h'}. The enforced limit is set at ${s.max_value} ${s.unit || 'km/h'}.`);
              }
              if (numByName.altitude) {
                const a = numByName.altitude;
                lines.push(`Maximum observed altitude was ${a.observed_max ?? a.max_value} ${a.unit || 'm'}. The enforced ceiling is ${a.max_value} ${a.unit || 'm'}.`);
              }
              if (numByName.payload_weight || numByName.payload) {
                const p = numByName.payload_weight || numByName.payload;
                lines.push(`Payload capacity observed up to ${p.observed_max ?? p.max_value} ${p.unit || 'kg'}. Enforced limit: ${p.max_value} ${p.unit || 'kg'}.`);
              }
              if (gb.length > 0) {
                const zones = gb.filter(b => b.type !== 'exclusion_zone' && b.type !== 'exclusion');
                const excl = gb.filter(b => b.type === 'exclusion_zone' || b.type === 'exclusion');
                if (zones.length > 0) lines.push(`Your system operates within ${zones.length === 1 ? 'a' : zones.length} defined geographic zone${zones.length > 1 ? 's' : ''} (${zones.map(z => z.radius_m ? (z.radius_m/1000).toFixed(1) + 'km radius' : 'custom area').join(', ')}).`);
                if (excl.length > 0) lines.push(`${excl.length} exclusion zone${excl.length > 1 ? 's' : ''} (no-go area${excl.length > 1 ? 's' : ''}) ${excl.length > 1 ? 'are' : 'is'} enforced.`);
              }
              const opHours = tb.find(b => b.name?.toLowerCase().includes('operating') || b.name?.toLowerCase().includes('hours'));
              if (opHours) lines.push(`Operating hours: ${opHours.start} to ${opHours.end}${opHours.timezone ? ' (' + opHours.timezone.split('/').pop().replace('_',' ') + ')' : ''}. The system will be interlocked outside these hours.`);
              const weather = sb.find(b => b.name?.toLowerCase().includes('weather'));
              if (weather) lines.push(`Approved weather conditions: ${(weather.allowed_states || []).join(', ')}. Operations in other conditions will be blocked.`);
              const allFlat = [...nb, ...gb, ...tb, ...sb].concat(Object.values(env || {}).filter(Array.isArray).flat());
              const conn = allFlat.find(b => b.type === 'connectivity');
              if (conn) lines.push(`Your system must maintain a communication link. If no signal is received for ${conn.max_gap_seconds || conn.timeout || '?'} seconds, the Interlock activates.`);
              const maxSamples = Math.max(...allFlat.map(b => b.sample_count || 0).filter(Boolean), 0);
              if (maxSamples > 0) lines.push(`These boundaries were auto-discovered from ${maxSamples.toLocaleString()} telemetry samples collected during the observation period.`);
              if (lines.length === 0) return null;
              return (
                <div style={{ padding: '16px', background: 'rgba(29,26,59,0.03)', borderRadius: '8px', marginBottom: '20px', lineHeight: 1.8 }}>
                  <p style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px' }}>What We Observed</p>
                  <p style={{ fontSize: '13px', color: styles.textPrimary, margin: 0 }}>{lines.join(' ')}</p>
                  <p style={{ fontSize: '11px', color: styles.textTertiary, marginTop: '10px', marginBottom: 0, fontStyle: 'italic' }}>Review the details below. If anything does not match your system's expected behavior, use the correspondence form to let us know.</p>
                </div>
              );
            })()}

            {(() => {
              const allBoundaries = [...nb, ...gb.map(b => ({...b, type: b.type || 'geographic'})), ...tb.map(b => ({...b, type: b.type || 'temporal'})), ...sb.map(b => ({...b, type: b.type || 'categorical'}))];
              const extraKeys = Object.keys(env || {}).filter(k => !['numeric_boundaries','geo_boundaries','geographic_boundaries','time_boundaries','state_boundaries'].includes(k));
              extraKeys.forEach(k => { if (Array.isArray(env[k])) env[k].forEach(b => allBoundaries.push({...b, type: b.type || k.replace('_boundaries','')})); });

              const described = allBoundaries.map(b => ({ ...b, desc: describeBoundary(b) }));
              const cats = ['Physical', 'Analytical', 'Aviation', 'Process', 'Other'];
              const grouped = {};
              described.forEach(d => { const c = d.desc.cat; if (!grouped[c]) grouped[c] = []; grouped[c].push(d); });

              const catColors = { Physical: styles.purpleBright, Analytical: styles.accentBlue || '#4A90D9', Aviation: styles.accentAmber, Process: styles.accentGreen, Other: styles.textTertiary };

              return (<>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: '8px', textAlign: 'center', marginBottom: '16px' }}>
                  {cats.filter(c => grouped[c]?.length > 0).map(c => (
                    <div key={c} style={{ padding: '10px', background: 'rgba(29,26,59,0.05)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 500, color: catColors[c] }}>{grouped[c].length}</div>
                      <div style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary, marginTop: '2px' }}>{c}</div>
                    </div>
                  ))}
                  <div style={{ padding: '10px', background: 'rgba(29,26,59,0.05)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 500, color: styles.textPrimary }}>{allBoundaries.length}</div>
                    <div style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary, marginTop: '2px' }}>Total</div>
                  </div>
                </div>

                {cats.filter(c => grouped[c]?.length > 0).map(c => (
                  <div key={c} style={{ marginTop: '16px' }}>
                    <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: catColors[c], marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: catColors[c], display: 'inline-block' }} />
                      {c} Boundaries
                    </p>
                    {grouped[c].map((d, i) => (
                      <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${styles.borderSubtle}`, fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          <span style={{ color: styles.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {d.desc.exclusion && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: styles.accentRed + '33', border: '1px solid ' + styles.accentRed, flexShrink: 0 }} />}
                            {d.desc.alert && <span style={{ color: styles.accentRed, fontSize: '11px', marginRight: 2 }}>⚠</span>}
                            {d.desc.label}
                            <span style={{ fontFamily: styles.mono, fontSize: '9px', color: styles.textDim, padding: '1px 5px', background: styles.textDim + '08', borderRadius: 2 }}>{d.type || d.b?.type}</span>
                          </span>
                          {d.desc.chips ? (
                            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {d.desc.chips.map((s, j) => (
                                <span key={j} style={{ fontFamily: styles.mono, fontSize: '10px', padding: '2px 6px', borderRadius: 3, background: styles.accentGreen + '10', color: styles.accentGreen, border: '1px solid ' + styles.accentGreen + '22' }}>{s}</span>
                              ))}
                            </span>
                          ) : (
                            <span style={{ fontFamily: styles.mono, color: styles.purpleBright, fontSize: '11px' }}>{d.desc.detail}</span>
                          )}
                        </div>
                        {(d.observed_min != null || d.observed_max != null || d.sample_count || d.observed_max_rate != null) && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 3, paddingLeft: 14 }}>
                            {d.observed_min != null && d.observed_max != null && (
                              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary }}>
                                Observed: {d.observed_min} – {d.observed_max} {d.unit || ''}
                              </span>
                            )}
                            {d.observed_max_rate != null && (
                              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary }}>
                                Observed max rate: {d.observed_max_rate} {d.unit || ''}/s
                              </span>
                            )}
                            {d.sample_count && (
                              <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>
                                {d.sample_count} samples
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>);
            })()}


            {isAdmin && (app.state === 'observe' || app.state === 'bounded') && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={() => navigate(`/applications/${id}/pre-review`)}
                  disabled={previewLoading}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${styles.accentGreen}`, color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px' }}>
                  ✓ Approve Boundaries — Begin CAT-72
                </button>
              </div>
            )}

            {!isAdmin && (app.state === 'observe' || app.state === 'bounded') && (
              <div style={{ marginTop: '16px' }}>
                {app.boundaries_acknowledged ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: styles.accentGreen + '08', border: '1px solid ' + styles.accentGreen + '33', borderRadius: '6px' }}>
                    <span style={{ color: styles.accentGreen, fontSize: '14px' }}>✓</span>
                    <span style={{ fontFamily: styles.mono, fontSize: '11px', color: styles.accentGreen }}>BOUNDARIES ACKNOWLEDGED — CERTIFICATION ENVELOPE CONFIRMED</span>
                    <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, marginLeft: 'auto' }}>{app.boundaries_acknowledged_at ? new Date(app.boundaries_acknowledged_at).toLocaleDateString() : ''}</span>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '12px', color: styles.textSecondary, marginBottom: '8px' }}>
                      By acknowledging, you confirm that the boundaries above accurately represent your system\'s operational parameters as observed during the monitoring period. If any boundary does not match your system\'s expected behavior, raise it now using the correspondence form. Once acknowledged, these boundaries become the enforced certification envelope.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={async () => {
                        try {
                          await api.post('/api/applications/' + app.id + '/acknowledge-boundaries');
                          toast.show('Boundaries acknowledged', 'success');
                          window.location.reload();
                        } catch (e) { toast.show('Failed: ' + (e.response?.data?.detail || e.message), 'error'); }
                      }} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid ' + styles.accentGreen, color: styles.accentGreen, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px' }}>
                        ✓ I Acknowledge These Boundaries As Accurate
                      </button>
                      <button onClick={() => { setShowCorForm(true); setCorType('response'); }} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid ' + styles.accentAmber, color: styles.accentAmber, fontFamily: styles.mono, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px' }}>
                        ? I Have Questions
                      </button>
                    </div>
                  </div>
                )}
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

      

      {/* ═══ Conformance Events ═══ */}
      {(app.state === 'conformant' || app.state === 'suspended' || app.state === 'expired' || app.state === 'revoked') && conformanceEvents.length > 0 && (
        <Panel style={{ marginTop: '24px' }}>
          <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px' }}>Conformance Events</p>
          {conformanceEvents.map((evt, i) => (
            <div key={evt.id || i} style={{
              borderLeft: '3px solid ' + (evt.severity === 'critical' || evt.severity === 'suspension' ? styles.accentRed : evt.severity === 'warn' ? styles.accentAmber : styles.textDim),
              padding: '8px 12px', marginBottom: '6px', background: styles.surfaceAlt || '#fafafa',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontFamily: styles.mono, fontSize: '9px', textTransform: 'uppercase', padding: '1px 5px',
                  background: (evt.severity === 'critical' ? styles.accentRed : evt.severity === 'warn' ? styles.accentAmber : styles.textDim) + '15',
                  color: evt.severity === 'critical' ? styles.accentRed : evt.severity === 'warn' ? styles.accentAmber : styles.textDim,
                }}>{evt.severity}</span>
                <span style={{ fontFamily: styles.mono, fontSize: '9px', color: styles.textDim }}>{evt.created_at ? new Date(evt.created_at).toLocaleString() : ''}</span>
              </div>
              <p style={{ fontSize: '12px', color: styles.textPrimary, margin: '4px 0 0' }}>{evt.message}</p>
            </div>
          ))}
        </Panel>
      )}

      {/* ═══ Formal Correspondence ═══ */}
      <Panel style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0 }}>Official Correspondence</p>
            <button onClick={() => setShowCorForm(!showCorForm)} style={{
              fontFamily: styles.mono, fontSize: '10px', letterSpacing: '0.5px',
              padding: '5px 12px', border: '1px solid ' + styles.purpleBright, color: styles.purpleBright,
              background: 'transparent', cursor: 'pointer',
            }}>{showCorForm ? '✕ Cancel' : isAdmin ? '+ New Correspondence' : '+ Reply'}</button>
          </div>
          
          {showCorForm && (
            <div style={{ background: styles.surfaceAlt || '#fafafa', border: '1px solid ' + (styles.border || '#e5e5e5'), borderRadius: '4px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {(isAdmin ? ['rfi', 'deficiency', 'remediation', 'general'] : ['response', 'general']).map(t => (
                  <button key={t} onClick={() => setCorType(t)} style={{
                    fontFamily: styles.mono, fontSize: '10px', letterSpacing: '0.5px',
                    padding: '5px 12px', cursor: 'pointer',
                    background: corType === t ? styles.purpleBright : 'transparent',
                    color: corType === t ? '#fff' : styles.textSecondary,
                    border: '1px solid ' + (corType === t ? styles.purpleBright : (styles.border || '#ddd')),
                  }}>{({rfi:'Request for Info', deficiency:'Deficiency Notice', remediation:'Remediation', general:'General', response:'Response'})[t]}</button>
                ))}
              </div>
              <textarea
                value={corDetails}
                onChange={e => setCorDetails(e.target.value)}
                placeholder={corType === 'rfi' ? 'What information do you need from the applicant?' : corType === 'deficiency' ? 'Describe the deficiencies identified...' : corType === 'remediation' ? 'Describe the recommended remediation steps...' : corType === 'response' ? 'Enter your response...' : 'Enter your message...'}
                style={{
                  width: '100%', minHeight: '120px', padding: '12px', fontFamily: 'inherit', fontSize: '13px',
                  border: '1px solid ' + (styles.border || '#ddd'), borderRadius: '4px', resize: 'vertical',
                  background: styles.surface || '#fff', color: styles.textPrimary,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                {isAdmin && <label style={{ fontSize: '12px', color: styles.textSecondary }}>
                  <input type="checkbox" checked={corResponseReq} onChange={e => setCorResponseReq(e.target.checked)} style={{ marginRight: '6px' }} />
                  Response required (10 business days)
                </label>}
                <button onClick={async () => {
                  if (!corDetails.trim()) return;
                  try {
                    await api.post('/api/applications/' + app.id + '/correspondence', {
                      type: corType, details: corDetails, response_required: corResponseReq,
                    });
                    toast.show('Correspondence sent to ' + (app.contact_email || 'applicant'), 'success');
                    setCorDetails(''); setShowCorForm(false);
                    fetchCorrespondence();
                  } catch (e) { toast.show('Failed to send: ' + (e.response?.data?.detail || e.message), 'error'); }
                }} style={{
                  fontFamily: styles.mono, fontSize: '11px', letterSpacing: '0.5px',
                  padding: '8px 20px', background: styles.purpleBright, color: '#fff',
                  border: 'none', cursor: 'pointer',
                }}>Send Official Correspondence</button>
              </div>
            </div>
          )}
          
          {correspondence.length > 0 && correspondence.map(c => (
            <div key={c.id} style={{
              borderLeft: '3px solid ' + ({rfi: styles.purpleBright, deficiency: styles.accentAmber, remediation: styles.accentGreen, general: styles.textTertiary}[c.type] || styles.textTertiary),
              padding: '12px 16px', marginBottom: '8px', background: styles.surfaceAlt || '#fafafa',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary }}>{c.reference_number} · {({rfi:'REQUEST FOR INFORMATION', deficiency:'DEFICIENCY NOTICE', remediation:'REMEDIATION GUIDANCE', general:'GENERAL', response:'RESPONSE'})[c.type]}</span>
                <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : ''}</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: styles.textPrimary, margin: '4px 0' }}>{c.subject}</p>
              <p style={{ fontSize: '12px', color: styles.textSecondary, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{c.body}</p>
              {c.response_required && (
                <span style={{ fontFamily: styles.mono, fontSize: '10px', padding: '2px 6px',
                  background: c.status === 'awaiting_response' ? styles.accentAmber + '15' : styles.accentGreen + '15',
                  color: c.status === 'awaiting_response' ? styles.accentAmber : styles.accentGreen,
                }}>{c.status === 'awaiting_response' ? 'AWAITING RESPONSE' : c.status.toUpperCase()}</span>
              )}
            </div>
          ))}
          {correspondence.length === 0 && !showCorForm && (
            <p style={{ fontSize: '12px', color: styles.textDim, fontStyle: 'italic' }}>No formal correspondence sent.</p>
          )}
        </Panel>

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
