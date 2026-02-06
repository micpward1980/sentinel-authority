import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import Panel from '../components/Panel';
import BoundaryEditor from '../components/BoundaryEditor';

function ApplicationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [app, setApp] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [testCreated, setTestCreated] = useState(null);
  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const showEmailPreview = async (newState, label) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/api/applications/${id}/email-preview?new_state=${newState}`);
      setEmailPreview({ ...res.data, label, newState });
    } catch (err) { toast.show('Preview failed', 'error'); }
    setPreviewLoading(false);
  };

  const confirmStateChange = async () => {
    if (!emailPreview) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=${emailPreview.newState}`);
      setEmailPreview(null);
      await refreshApp();
      toast.show(`State changed to ${emailPreview.newState}`, 'success');
    } catch (err) { toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error'); }
  };

  useEffect(() => {
    if (id) {
      api.get(`/api/applications/${id}`).then(res => setApp(res.data)).catch(console.error);
      api.get(`/api/applications/${id}/history`).then(res => setHistory(res.data)).catch(console.error);
      api.get(`/api/applications/${id}/comments`).then(res => setComments(res.data)).catch(console.error);
    }
  }, [id]);

  const handleScheduleTest = async () => {
    if (!await confirm({title: 'Schedule Test', message: 'Schedule a CAT-72 test for this application? The test will need to be started manually.'})) return;
    setScheduling(true);
    try {
      const res = await api.post('/api/cat72/tests', { application_id: parseInt(id) });
      setTestCreated(res.data);
      toast.show(`CAT-72 Test created: ${res.data.test_id} — Go to CAT-72 Console to start.`, 'success');
    } catch (err) {
      toast.show('Failed to create test: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setScheduling(false);
  };

  const navigate = useNavigate();
  
  const handleDeleteApplication = async () => {
    if (!await confirm({title: 'Delete Application', message: 'Are you sure? This cannot be undone.', danger: true, confirmLabel: 'Delete'})) return;
    try {
      await api.delete(`/api/applications/${id}`);
      toast.show('Application deleted', 'success');
      navigate('/applications');
    } catch (err) {
      toast.show('Failed to delete: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleApprove = () => showEmailPreview('approved', 'Approve Application');

  const refreshApp = async () => {
    try {
      const res = await api.get(`/api/applications/${id}`);
      setApp(res.data);
      api.get(`/api/applications/${id}/history`).then(res => setHistory(res.data)).catch(console.error);
    } catch (err) {
      console.error('Failed to refresh:', err);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await api.post(`/api/applications/${id}/comments`, { content: newComment, is_internal: isInternal });
      setComments(prev => [res.data, ...prev]);
      setNewComment('');
      setIsInternal(false);
      toast.show('Comment added', 'success');
    } catch (err) {
      toast.show('Failed to post comment: ' + (err.response?.data?.detail || err.message), 'error');
    }
    setPostingComment(false);
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/api/applications/${id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.show('Comment deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete comment: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleAdvanceToReview = () => showEmailPreview('under_review', 'Begin Review');

  const handleSuspend = () => showEmailPreview('suspended', 'Suspend Application');

  const handleReinstate = async () => {
    if (!await confirm({title: 'Reinstate', message: 'Reinstate this application to pending? The applicant will need to go through review again.'})) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=pending`);
      await refreshApp();
    } catch (err) {
      toast.show('Failed to reinstate: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  // Certification pipeline stages
  const PIPELINE_STAGES = [
    { key: 'pending', label: 'Submitted', icon: '1' },
    { key: 'under_review', label: 'Under Review', icon: '2' },
    { key: 'approved', label: 'Approved', icon: '3' },
    { key: 'testing', label: 'CAT-72 Testing', icon: '4' },
    { key: 'conformant', label: 'Conformant', icon: '✓' },
  ];
  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.key === app?.state);
  const isSuspended = app?.state === 'revoked' || app?.state === 'suspended';

  const nextStepText = () => {
    switch(app?.state) {
      case 'pending': return 'Your application is queued for review by the Sentinel Authority team.';
      case 'under_review': return 'Our team is evaluating your ODD specification and boundary definitions.';
      case 'approved': return 'Your system is approved. The ENVELO agent is being configured for CAT-72 testing.';
      case 'testing': return 'CAT-72 continuous conformance test is in progress (72-hour minimum).';
      case 'conformant': return 'Your system has achieved ODDC Conformance. Your certificate and ENVELO agent credentials are active.';
      case 'revoked': return 'This application has been suspended. Contact info@sentinelauthority.org for remediation steps.';
      default: return '';
    }
  };

  if (!app) return <div style={{color: styles.textTertiary}}>Loading...</div>;

  return (
    <div className="space-y-6">
      {emailPreview && (
        <div style={{position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'}}>
          <div style={{background: styles.bgCard, border: '1px solid ' + styles.borderGlass, borderRadius: '16px', maxWidth: '650px', width: '90%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            <div style={{padding: '20px 24px', borderBottom: '1px solid ' + styles.borderGlass, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
              <div>
                <h3 style={{margin: 0, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright}}>Email Preview</h3>
                <p style={{margin: '4px 0 0', fontSize: '12px', color: styles.textTertiary}}>This email will be sent to <strong style={{color: styles.textPrimary}}>{emailPreview.to}</strong></p>
              </div>
              <button onClick={() => setEmailPreview(null)} style={{background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '20px', padding: '4px 8px'}}>X</button>
            </div>
            <div style={{padding: '16px 24px', borderBottom: '1px solid ' + styles.borderGlass, background: 'rgba(0,0,0,0.1)'}}>
              <div style={{fontSize: '11px', color: styles.textTertiary, marginBottom: '2px'}}>Subject</div>
              <div style={{fontSize: '14px', color: styles.textPrimary, fontWeight: 500}}>{emailPreview.subject}</div>
            </div>
            <div style={{flex: 1, overflow: 'auto', padding: '20px 24px'}}>
              <div style={{background: '#fff', borderRadius: '8px', overflow: 'hidden'}} dangerouslySetInnerHTML={{__html: emailPreview.html}} />
            </div>
            <div style={{padding: '16px 24px', borderTop: '1px solid ' + styles.borderGlass, display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button onClick={() => setEmailPreview(null)} style={{padding: '8px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textSecondary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Cancel</button>
              <button onClick={confirmStateChange} className="sexy-btn" style={{padding: '8px 20px', borderRadius: '8px', background: emailPreview.newState === 'suspended' ? 'rgba(214,92,92,0.2)' : styles.purplePrimary, border: '1px solid ' + (emailPreview.newState === 'suspended' ? 'rgba(214,92,92,0.4)' : styles.purpleBright), color: emailPreview.newState === 'suspended' ? '#D65C5C' : '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
                {emailPreview.label} + Send Email
              </button>
            </div>
          </div>
        </div>
      )}

            <div className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center gap-2 no-underline" style={{color: styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
        {user?.role === 'admin' && (
        <div style={{display: 'flex', gap: '12px'}}>
          {app.state === 'pending' && (
            <button onClick={handleAdvanceToReview} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.4)', color: styles.accentAmber, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Begin Review
            </button>
          )}
          {(app.state === 'pending' || app.state === 'under_review') && (
            <button onClick={handleApprove} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.4)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Approve Application
            </button>
          )}
          {app.state === 'approved' && (
            <button onClick={handleScheduleTest} disabled={scheduling} className="px-4 py-2 rounded-lg transition-all" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: scheduling ? 'wait' : 'pointer', opacity: scheduling ? 0.7 : 1}}>
              {scheduling ? 'Scheduling...' : 'Schedule CAT-72 Test'}
            </button>
          )}
          {['pending','under_review','approved','testing','conformant'].includes(app.state) && (
            <button onClick={handleSuspend} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Suspend
            </button>
          )}
          {(app.state === 'suspended' || app.state === 'revoked') && (
            <button onClick={handleReinstate} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.4)', color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Reinstate
            </button>
          )}
          {app.state === 'expired' && (
            <button onClick={handleReinstate} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.purpleBright}`, color: styles.purpleBright, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Re-open
            </button>
          )}
          <button onClick={handleDeleteApplication} className="px-4 py-2 rounded-lg transition-all" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
            Delete
          </button>
        </div>
        )}
      </div>
      
      {/* ── Progress Pipeline ── */}
      <Panel>
        <div style={{padding: '8px 0'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px'}}>
            {PIPELINE_STAGES.map((stage, i) => {
              const isActive = stage.key === app.state;
              const isComplete = currentStageIdx > i;
              const isPending = currentStageIdx < i;
              return (
                <React.Fragment key={stage.key}>
                  {i > 0 && <div style={{flex: 1, height: '2px', background: isComplete ? styles.accentGreen : styles.borderGlass, margin: '0 8px'}} />}
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '80px'}}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 'bold',
                      background: isComplete ? 'rgba(92,214,133,0.2)' : isActive ? 'rgba(157,140,207,0.25)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isComplete ? styles.accentGreen : isActive ? styles.purpleBright : styles.borderGlass}`,
                      color: isComplete ? styles.accentGreen : isActive ? styles.purpleBright : styles.textTertiary,
                    }}>
                      {isComplete ? '✓' : stage.icon}
                    </div>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase', color: isActive ? styles.purpleBright : isComplete ? styles.accentGreen : styles.textTertiary, textAlign: 'center'}}>
                      {stage.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {isSuspended && (
            <div style={{padding: '12px 16px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '8px', marginBottom: '12px'}}>
              <span style={{color: styles.accentRed, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>⚠ SUSPENDED — This application has been suspended pending review.</span>
            </div>
          )}
          <div style={{padding: '12px 16px', background: 'rgba(157,140,207,0.08)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px'}}>
            <span style={{color: styles.textSecondary, fontSize: '13px', lineHeight: '1.5'}}>{nextStepText()}</span>
          </div>
        </div>
      </Panel>
      
      {testCreated && (
        <div className="p-4 rounded-lg" style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(157,140,207,0.3)'}}>
          <p style={{color: styles.accentGreen, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px'}}>
            Test Created: {testCreated.test_id} — <Link to="/cat72" style={{color: styles.purpleBright}}>Go to CAT-72 Console</Link>
          </p>
        </div>
      )}
      
      <div>
        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Application {app.application_number}</p>
        <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>{app.system_name}</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>{app.system_description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Organization</h2>
          <p style={{color: styles.textPrimary, fontSize: '18px', marginBottom: '8px'}}>{app.organization_name}</p>
          <p style={{color: styles.textSecondary, marginBottom: '4px'}}><strong>Contact:</strong> {app.contact_name}</p>
          <p style={{color: styles.textSecondary, marginBottom: '4px'}}><strong>Email:</strong> {app.contact_email}</p>
          {app.contact_phone && <p style={{color: styles.textSecondary}}><strong>Phone:</strong> {app.contact_phone}</p>}
        </Panel>
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Status</h2>
          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1 rounded" style={{
              background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
              color: app.state === 'conformant' ? styles.accentGreen : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
              fontFamily: "Consolas, 'IBM Plex Mono', monospace",
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              {app.state}
            </span>
            {user?.role === 'admin' && (
            <select 
              value={app.state}
              onChange={async (e) => {
                const newState = e.target.value;
                if (!await confirm({title: 'Change Status', message: `Change status to ${newState.toUpperCase()}?`})) return;
                try {
                  await api.patch(`/api/applications/${id}/state?new_state=${newState}`);
      // Auto-provision API key on approval
      if (newState === 'approved') {
        try {
          await api.post('/api/apikeys/admin/provision', null, {
            params: { application_id: id, send_email: true }
          });
        } catch (provErr) {
          console.log('Auto-provision note:', provErr.message);
        }
      }
                  setApp({...app, state: newState});
                } catch (err) {
                  toast.show('Failed to update state: ' + (err.response?.data?.detail || err.message), 'error');
                }
              }}
              className="px-3 py-2 rounded-lg"
              style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}
            >
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved (Agent Access)</option>
              <option value="testing">Testing (CAT-72 Active)</option>
              <option value="conformant">Conformant</option>
              <option value="revoked">Revoked</option>
            </select>
            )}
          </div>
          <p style={{color: styles.textSecondary}}><strong>Submitted:</strong> {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'N/A'}</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>System Details</h2>
          <p style={{color: styles.textSecondary, marginBottom: '8px'}}><strong>Version:</strong> {app.system_version || 'N/A'}</p>
          <p style={{color: styles.textSecondary, marginBottom: '8px'}}><strong>Manufacturer:</strong> {app.manufacturer || 'N/A'}</p>
          {app.facility_location && <p style={{color: styles.textSecondary, marginBottom: '8px'}}><strong>Facility:</strong> {app.facility_location}</p>}
          {app.preferred_test_date && <p style={{color: styles.textSecondary}}><strong>Preferred Test Date:</strong> {new Date(app.preferred_test_date).toLocaleDateString()}</p>}
        </Panel>
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Safety Boundaries & Operational Limits</h2>
          <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{typeof app.envelope_definition === 'object' ? JSON.stringify(app.envelope_definition, null, 2) : (app.envelope_definition || 'Not specified')}</p>
        </Panel>
      </div>

      {/* Boundary Editor - Admin Only */}
      {user?.role === 'admin' && <BoundaryEditor
        applicationId={app.id}
        initialBoundaries={app.envelope_definition || {}}
        onSave={async (boundaries) => {
          try {
            await api.patch(`/api/applicants/${app.id}`, { envelope_definition: boundaries });
            toast.show('Boundaries saved', 'success');
            setApp({...app, envelope_definition: boundaries});
          } catch (e) {/* boundary save error */
            toast.show('Failed to save: ' + e.message, 'error');
          }
        }}
      />}

      {/* State Change Timeline */}
      {history.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px'}}>State Change History</h2>
          <div style={{position: 'relative', paddingLeft: '28px'}}>
            {/* Vertical line */}
            <div style={{position: 'absolute', left: '8px', top: '4px', bottom: '4px', width: '2px', background: styles.borderGlass}} />
            {history.map((entry, i) => {
              const actionColors = {
                submitted: styles.purpleBright,
                state_changed: (() => {
                  const ns = entry.details?.new_state;
                  if (ns === 'conformant') return styles.accentGreen;
                  if (ns === 'suspended' || ns === 'revoked') return '#D65C5C';
                  if (ns === 'approved') return styles.accentGreen;
                  if (ns === 'under_review' || ns === 'testing') return styles.purpleBright;
                  return '#D6A05C';
                })(),
                certificate_issued: styles.accentGreen,
              };
              const color = actionColors[entry.action] || styles.textTertiary;
              const stateLabel = entry.details?.new_state?.replace('_', ' ') || entry.action?.replace('_', ' ');
              const fromLabel = entry.details?.old_state?.replace('_', ' ');
              const ts = entry.timestamp ? new Date(entry.timestamp) : null;
              return (
                <div key={i} style={{position: 'relative', paddingBottom: i < history.length - 1 ? '20px' : '0', marginBottom: i < history.length - 1 ? '0' : '0'}}>
                  {/* Dot */}
                  <div style={{position: 'absolute', left: '-24px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: `${color}30`, border: `2px solid ${color}`}} />
                  {/* Content */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
                    <div>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 500, color: color, textTransform: 'uppercase', letterSpacing: '0.5px'}}>{stateLabel}</span>
                      {fromLabel && entry.action !== 'submitted' && (
                        <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginLeft: '8px'}}>from {fromLabel}</span>
                      )}
                      <div style={{marginTop: '4px'}}>
                        <span style={{fontSize: '12px', color: styles.textTertiary}}>{entry.user_email}</span>
                      </div>
                    </div>
                    <div style={{textAlign: 'right', flexShrink: 0}}>
                      {ts && (
                        <>
                          <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>{ts.toLocaleDateString()}</div>
                          <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>{ts.toLocaleTimeString()}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel>
        <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>ODD Specification</h2>
        <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{typeof app.odd_specification === 'object' ? (app.odd_specification?.description || JSON.stringify(app.odd_specification, null, 2)) : app.odd_specification}</p>
      </Panel>

      {/* Comments Thread */}
      <Panel>
        <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Comments & Notes</h2>
        
        {/* New Comment Form */}
        <div style={{marginBottom: comments.length > 0 ? '20px' : '0'}}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Add a comment or note..."
            className="w-full px-4 py-3 rounded-lg outline-none resize-none"
            style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontSize: '13px', fontFamily: 'inherit', transition: 'border-color 0.2s'}}
            onFocus={(e) => e.target.style.borderColor = styles.purpleBright}
            onBlur={(e) => e.target.style.borderColor = styles.borderGlass}
          />
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '8px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              {user?.role === 'admin' && (
                <label style={{display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}>
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} style={{accentColor: styles.purpleBright}} />
                  <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, letterSpacing: '0.5px', textTransform: 'uppercase'}}>Internal only</span>
                </label>
              )}
            </div>
            <button
              onClick={handlePostComment}
              disabled={postingComment || !newComment.trim()}
              className="px-4 py-2 rounded-lg"
              style={{background: newComment.trim() ? styles.purplePrimary : 'rgba(255,255,255,0.05)', border: `1px solid ${newComment.trim() ? styles.purpleBright : styles.borderGlass}`, color: newComment.trim() ? '#fff' : styles.textTertiary, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: newComment.trim() ? 'pointer' : 'default', opacity: postingComment ? 0.6 : 1}}
            >
              {postingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>
        
        {/* Comment List */}
        {comments.length > 0 && (
          <div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px'}}>
            {comments.map((c) => (
              <div key={c.id} style={{padding: '12px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '6px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: c.user_role === 'admin' ? styles.purpleBright : styles.textSecondary, fontWeight: 500}}>{c.user_email}</span>
                    {c.user_role === 'admin' && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(157,140,207,0.15)', color: styles.purpleBright, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Admin</span>}
                    {c.is_internal && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(214,160,92,0.15)', color: styles.accentAmber, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Internal</span>}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                    {(user?.role === 'admin' || user?.email === c.user_email) && (
                      <button onClick={() => handleDeleteComment(c.id)} style={{background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '12px', padding: '0', opacity: 0.5}} title="Delete comment">×</button>
                    )}
                  </div>
                </div>
                <p style={{color: styles.textSecondary, fontSize: '13px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap'}}>{c.content}</p>
              </div>
            ))}
          </div>
        )}
        
        {comments.length === 0 && !newComment && (
          <p style={{color: styles.textTertiary, fontSize: '13px', fontStyle: 'italic', margin: 0}}>No comments yet</p>
        )}
      </Panel>

      {app.notes && (
        <Panel>
          <h2 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Applicant Notes</h2>
          <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{app.notes}</p>
        </Panel>
      )}
    </div>
  );
}

// CAT-72 Console

export default ApplicationDetail;

