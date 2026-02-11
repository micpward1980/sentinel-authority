import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';
import { api } from '../config/api';
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
    if (!await confirm({title: 'Schedule CAT-72 Test', message: 'Schedule a 72-hour Conformance Authorization Test? The applicant will be notified and can start when ready.'})) return;
    setScheduling(true);
    try {
      const res = await api.post('/api/cat72/tests', { application_id: parseInt(id) });
      setTestCreated(res.data);
      toast.show(`CAT-72 Test ${res.data.test_id} scheduled — applicant will be notified to start.`, 'success');
    } catch (err) {
      toast.show('Failed to launch test: ' + (err.response?.data?.detail || err.message), 'error');
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

  const handleQuickState = async (newState, label) => {
    if (!await confirm({title: 'Change State', message: label + '?'})) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=${newState}`);
      await refreshApp();
      toast.show('State updated', 'success');
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleQuickState = async (newState, label) => {
    if (!await confirm({title: 'Change State', message: label + '?'})) return;
    try {
      await api.patch(`/api/applications/${id}/state?new_state=${newState}`);
      await refreshApp();
      toast.show('State updated', 'success');
    } catch (err) {
      toast.show('Failed: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  // Certification pipeline stages
  const PIPELINE_STAGES = [
    { key: 'pending', label: 'Submitted', icon: '1' },
    { key: 'under_review', label: 'In Review', icon: '2' },
    { key: 'approved', label: 'Awaiting Deploy', icon: '3' },
  ];
  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.key === app?.state);
  const isSuspended = app?.state === 'revoked' || app?.state === 'suspended';

  const nextStepText = () => {
    switch(app?.state) {
      case 'pending': return 'Your application is queued for review by the Sentinel Authority team.';
      case 'under_review': return 'Our team is evaluating your ODD specification and boundary definitions.';
      case 'approved': return 'Your system is approved. Install the ENVELO Interlock on your system and connect to Sentinel Authority to begin CAT-72 testing.';
      case 'testing': return 'CAT-72 Conformance Authorization Test is in progress. The ENVELO Interlock is reporting telemetry for a 72-hour evaluation window.';
      case 'conformant': return 'Your system has achieved ODDC Conformance. Certificate issued — ENVELO Interlock is now in permanent production monitoring.';
      case 'revoked': return 'This application has been suspended. Contact info@sentinelauthority.org for remediation steps.';
      default: return '';
    }
  };

  if (!app) return <div style={{color: 'rgba(255,255,255,.50)'}}>Loading...</div>;

  return (
    <div className="space-y-6">
      {emailPreview && ReactDOM.createPortal(
        <div style={{position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)'}}>
          <div style={{background: '#120c1e', border: '1px solid rgba(157,140,207,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,.5)', maxWidth: 'min(650px, 95vw)', width: '95%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            <div style={{padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#120c1e'}}>
              <div>
                <h3 style={{margin: 0, fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#a896d6'}}>Email Preview</h3>
                <p style={{margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,.50)'}}>This email will be sent to <strong style={{color: 'rgba(255,255,255,.94)'}}>{emailPreview.to}</strong></p>
              </div>
              <button onClick={() => setEmailPreview(null)} style={{background: 'none', border: 'none', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: '20px', padding: '4px 8px'}}>X</button>
            </div>
            <div style={{padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.07)', background: '#120c1e'}}>
              <div style={{fontSize: '11px', color: 'rgba(255,255,255,.50)', marginBottom: '2px'}}>Subject</div>
              <div style={{fontSize: '14px', color: 'rgba(255,255,255,.94)', fontWeight: 500}}>{emailPreview.subject}</div>
            </div>
            <div style={{flex: 1, overflow: 'auto', padding: '20px 24px'}}>
              <div style={{background: '#fff', overflow: 'hidden'}} dangerouslySetInnerHTML={{__html: emailPreview.html}} />
            </div>
            <div style={{padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#120c1e'}}>
              <button onClick={() => setEmailPreview(null)} style={{padding: '8px 20px', background: 'transparent', border: '1px solid ' + 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.78)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>Cancel</button>
              <button onClick={confirmStateChange}  style={{padding: '8px 20px', background: emailPreview.newState === 'suspended' ? 'rgba(214,92,92,0.2)' : '#5B4B8A', border: '1px solid ' + (emailPreview.newState === 'suspended' ? 'rgba(214,92,92,0.4)' : '#a896d6'), color: emailPreview.newState === 'suspended' ? '#D65C5C' : '#fff', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>
                {emailPreview.label} + Send Email
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

            <div className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center gap-2 no-underline" style={{color: 'rgba(255,255,255,.50)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
        {user?.role === 'admin' && (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          {app.state === 'under_review' && (
            <button onClick={() => handleQuickState('pending', 'Move back to Pending')} className="px-3 py-2 transition-all btn" style={{fontSize: '11px'}}>
              &#8592; Pending
            </button>
          )}
          {app.state === 'approved' && (
            <button onClick={() => handleQuickState('under_review', 'Move back to Review')} className="px-3 py-2 transition-all btn" style={{fontSize: '11px'}}>
              &#8592; Review
            </button>
          )}
          {app.state === 'pending' && (
            <button onClick={handleAdvanceToReview} className="px-3 py-2 transition-all btn" style={{fontSize: '11px', color: '#a896d6'}}>
              Begin Review &#8594;
            </button>
          )}
          {(app.state === 'pending' || app.state === 'under_review') && (
            <button onClick={handleApprove} className="px-3 py-2 transition-all btn" style={{fontSize: '11px', color: '#5CD685'}}>
              Approve &#8594;
            </button>
          )}
          {['pending','under_review','approved'].includes(app.state) && (
            <button onClick={handleSuspend} className="px-3 py-2 transition-all btn" style={{fontSize: '11px', color: '#D65C5C'}}>
              Withdraw
            </button>
          )}
          {(app.state === 'suspended' || app.state === 'revoked') && (
            <button onClick={handleReinstate} className="px-3 py-2 transition-all btn" style={{fontSize: '11px', color: '#5CD685'}}>
              Reinstate
            </button>
          )}
        </div>
        )}
      </div>
      
      {/* ── Progress Pipeline ── */}
      <Panel>
        <div style={{padding: '8px 0'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px'}}>
            {PIPELINE_STAGES.map((stage, i) => {
              const isActive = stage.key === app.state;
              const isComplete = currentStageIdx > i;
              const isPending = currentStageIdx < i;
              return (
                <React.Fragment key={stage.key}>
                  {i > 0 && <div style={{flex: 1, height: '2px', background: isComplete ? '#5CD685' : 'rgba(255,255,255,.07)', margin: '0 8px'}} />}
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '80px'}}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 'bold',
                      background: isComplete ? 'rgba(92,214,133,0.2)' : isActive ? 'rgba(157,140,207,0.25)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isComplete ? '#5CD685' : isActive ? '#a896d6' : 'rgba(255,255,255,.07)'}`,
                      color: isComplete ? '#5CD685' : isActive ? '#a896d6' : 'rgba(255,255,255,.50)'
                    }}>
                      {isComplete ? '✓' : stage.icon}
                    </div>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase', color: isActive ? '#a896d6' : isComplete ? '#5CD685' : 'rgba(255,255,255,.50)', textAlign: 'center'}}>
                      {stage.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {isSuspended && (
            <div style={{padding: '12px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '12px'}}>
              <span style={{color: '#D65C5C', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}>⚠ SUSPENDED — This application has been suspended pending review.</span>
            </div>
          )}
          <div style={{padding: '12px 16px', background: 'transparent', border: `1px solid ${'rgba(255,255,255,.07)'}` }}>
            <span style={{color: 'rgba(255,255,255,.78)', fontSize: '13px', lineHeight: '1.5'}}>{nextStepText()}</span>
          </div>
        </div>
      </Panel>
      
      {testCreated && (
        <div className="p-4" style={{background: 'transparent', border: '1px solid rgba(255,255,255,0.07)'}}>
          <p style={{color: '#5CD685', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px'}}>
            Test Created: {testCreated.test_id} — <Link to="/cat72" style={{color: '#a896d6'}}>Go to CAT-72 Console</Link>
          </p>
        </div>
      )}
      
      <div>
        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '8px'}}>Application {app.application_number}</p>
        <h1 style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>{app.system_name}</h1>
        <p style={{color: 'rgba(255,255,255,.78)', marginTop: '8px'}}>{app.system_description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <div className="hud-label" style={{marginBottom: '16px'}}>Organization</div>
          <p style={{color: 'rgba(255,255,255,.94)', fontSize: '18px', marginBottom: '8px'}}>{app.organization_name}</p>
          <p style={{color: 'rgba(255,255,255,.78)', marginBottom: '4px'}}><strong>Contact:</strong> {app.contact_name}</p>
          <p style={{color: 'rgba(255,255,255,.78)', marginBottom: '4px'}}><strong>Email:</strong> {app.contact_email}</p>
          {app.contact_phone && <p style={{color: 'rgba(255,255,255,.78)'}}><strong>Phone:</strong> {app.contact_phone}</p>}
        </Panel>
        <Panel>
          <div className="hud-label" style={{marginBottom: '16px'}}>Status</div>
          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1" style={{
              background: app.state === 'conformant' ? 'rgba(92,214,133,0.04)' : app.state === 'revoked' ? 'rgba(214,92,92,0.04)' : 'rgba(214,160,92,0.04)',
              color: app.state === 'conformant' ? '#5CD685' : app.state === 'revoked' ? '#D65C5C' : '#D6A05C',
              fontFamily: "Consolas, 'IBM Plex Mono', monospace",
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              {app.state === 'approved' ? 'Awaiting Deploy' : app.state === 'under_review' ? 'In Review' : app.state === 'conformant' ? 'Certified' : app.state?.replace('_', ' ')}
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
          console.error('Auto-provision:', provErr.message);
        }
      }
                  setApp({...app, state: newState});
                } catch (err) {
                  toast.show('Failed to update state: ' + (err.response?.data?.detail || err.message), 'error');
                }
              }}
              className="px-3 py-2"
              style={{background: 'transparent', border: `1px solid ${'rgba(255,255,255,.07)'}`, color: 'rgba(255,255,255,.94)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px'}}
            >
              <option value="pending">Pending</option>
              <option value="under_review">In Review</option>
              <option value="approved">Awaiting Deploy</option>



            </select>
            )}
          </div>
          <p style={{color: 'rgba(255,255,255,.78)'}}><strong>Submitted:</strong> {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'N/A'}</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <div className="hud-label" style={{marginBottom: '16px'}}>System Details</div>
          <p style={{color: 'rgba(255,255,255,.78)', marginBottom: '8px'}}><strong>Version:</strong> {app.system_version || 'N/A'}</p>
          <p style={{color: 'rgba(255,255,255,.78)', marginBottom: '8px'}}><strong>Manufacturer:</strong> {app.manufacturer || 'N/A'}</p>
          {app.facility_location && <p style={{color: 'rgba(255,255,255,.78)', marginBottom: '8px'}}><strong>Facility:</strong> {app.facility_location}</p>}
          {app.preferred_test_date && <p style={{color: 'rgba(255,255,255,.78)'}}><strong>Preferred Test Date:</strong> {new Date(app.preferred_test_date).toLocaleDateString()}</p>}
        </Panel>
        <Panel>
          <div className="hud-label" style={{marginBottom: '16px'}}>Safety Boundaries & Operational Limits</div>
          {(() => {
            const env = typeof app.envelope_definition === 'string' ? (() => { try { return JSON.parse(app.envelope_definition); } catch { return null; } })() : app.envelope_definition;
            const bounds = env?.boundaries || [];
            if (bounds.length === 0) return <p style={{color: 'rgba(255,255,255,.50)', fontSize: '13px', fontStyle: 'italic'}}>No boundaries defined</p>;
            return (
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '1px solid rgba(255,255,255,.07)'}}>
                    {['Type','Constraint','Unit'].map(h => <th key={h} style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400, padding: '8px 12px', textAlign: 'left'}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {bounds.map((b, i) => {
                    const constraint = b.max && b.min ? `${b.min} - ${b.max}` : b.max ? `<= ${b.max}` : b.min ? `>= ${b.min}` : b.radius_m ? `radius ${b.radius_m}m` : b.corridors ? b.corridors.join(", ") : b.polygon || "-";
                    return (
                      <tr key={i} style={{borderBottom: '1px solid rgba(255,255,255,.04)'}}>
                        <td style={{padding: '8px 12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: '#a896d6', textTransform: 'uppercase', letterSpacing: '0.5px'}}>{b.type}</td>
                        <td style={{padding: '8px 12px', color: 'rgba(255,255,255,.78)', fontSize: '13px'}}>{constraint}</td>
                        <td style={{padding: '8px 12px', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>{b.unit || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </Panel>
      </div>

      {/* Boundary Editor - Admin Only */}
      {user?.role === 'admin' && (() => {
        const env = typeof app.envelope_definition === 'string' ? (() => { try { return JSON.parse(app.envelope_definition); } catch { return null; } })() : app.envelope_definition;
        const hasBoundaries = env?.boundaries?.length > 0;
        if (hasBoundaries) return null;
        return <BoundaryEditor
          applicationId={app.id}
          initialBoundaries={app.envelope_definition || {}}
          onSave={async (boundaries) => {
            try {
              await api.patch(`/api/applicants/${app.id}`, { envelope_definition: boundaries });
              toast.show('Boundaries saved', 'success');
              setApp({...app, envelope_definition: boundaries});
            } catch (e) {
              toast.show('Failed to save: ' + e.message, 'error');
            }
          }}
        />;
      })()}

      {/* State Change Timeline */}
      {history.length > 0 && (
        <Panel>
          <div className="hud-label" style={{marginBottom: '16px'}}>State Change History</div>
          <div style={{position: 'relative', paddingLeft: '28px'}}>
            {/* Vertical line */}
            <div style={{position: 'absolute', left: '8px', top: '4px', bottom: '4px', width: '2px', background: 'rgba(255,255,255,.07)'}} />
            {history.map((entry, i) => {
              const actionColors = {
                submitted: '#a896d6',
                state_changed: (() => {
                  const ns = entry.details?.new_state;
                  if (ns === 'conformant') return '#5CD685';
                  if (ns === 'suspended' || ns === 'revoked') return '#D65C5C';
                  if (ns === 'approved') return '#5CD685';
                  if (ns === 'under_review' || ns === 'testing') return '#a896d6';
                  return '#D6A05C';
                })(),
                certificate_issued: '#5CD685'
              };
              const color = actionColors[entry.action] || 'rgba(255,255,255,.50)';
              const stateLabel = entry.details?.new_state?.replace('_', ' ') || entry.action?.replace('_', ' ');
              const fromLabel = entry.details?.old_state?.replace('_', ' ');
              const ts = entry.timestamp ? new Date(entry.timestamp) : null;
              return (
                <div key={i} style={{position: 'relative', paddingBottom: i < history.length - 1 ? '20px' : '0', marginBottom: i < history.length - 1 ? '0' : '0'}}>
                  {/* Dot */}
                  <div style={{position: 'absolute', left: '-24px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: `${color}08`, border: `2px solid ${color}`}} />
                  {/* Content */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
                    <div>
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 500, color: color, textTransform: 'uppercase', letterSpacing: '0.5px'}}>{stateLabel}</span>
                      {fromLabel && entry.action !== 'submitted' && (
                        <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', marginLeft: '8px'}}>from {fromLabel}</span>
                      )}
                      <div style={{marginTop: '4px'}}>
                        <span style={{fontSize: '12px', color: 'rgba(255,255,255,.50)'}}>{entry.user_email}</span>
                      </div>
                    </div>
                    <div style={{textAlign: 'right', flexShrink: 0}}>
                      {ts && (
                        <>
                          <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,.50)'}}>{ts.toLocaleDateString()}</div>
                          <div style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)'}}>{ts.toLocaleTimeString()}</div>
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
        <div className="hud-label" style={{marginBottom: '16px'}}>ODD Specification</div>
        {(() => {
          const odd = typeof app.odd_specification === 'string' ? (() => { try { return JSON.parse(app.odd_specification); } catch { return null; } })() : app.odd_specification;
          if (!odd || Object.keys(odd).length === 0) return <p style={{color: 'rgba(255,255,255,.50)', fontSize: '13px', fontStyle: 'italic'}}>Not specified</p>;
          return (
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0'}}>
              {Object.entries(odd).map(([k, v]) => (
                <div key={k} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.04)'}}>
                  <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '0.5px'}}>{k.replace(/_/g, ' ')}</span>
                  <span style={{color: 'rgba(255,255,255,.78)', fontSize: '13px', textAlign: 'right'}}>{Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </Panel>

      {/* Comments Thread */}
      <Panel>
        <div className="hud-label" style={{marginBottom: '16px'}}>Comments & Notes</div>
        
        {/* New Comment Form */}
        <div style={{marginBottom: comments.length > 0 ? '20px' : '0'}}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Add a comment or note..."
            className="w-full px-4 py-3 outline-none resize-none"
            style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${'rgba(255,255,255,.07)'}`, color: 'rgba(255,255,255,.94)', fontSize: '13px', fontFamily: 'inherit', transition: 'border-color 0.2s'}}
            onFocus={(e) => e.target.style.borderColor = '#a896d6'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,.07)'}
          />
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '8px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              {user?.role === 'admin' && (
                <button onClick={() => setIsInternal(!isInternal)} className="btn" style={{padding: '4px 10px', color: isInternal ? 'var(--accent-green)' : 'var(--text-tertiary)', borderColor: isInternal ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.06)'}}>
                  Internal {isInternal ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
            <button
              onClick={handlePostComment}
              disabled={postingComment || !newComment.trim()}
              className="px-4 py-2 btn"
            >
              {postingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>
        
        {/* Comment List */}
        {comments.length > 0 && (
          <div style={{borderTop: `1px solid ${'rgba(255,255,255,.07)'}`, paddingTop: '16px'}}>
            {comments.map((c) => (
              <div key={c.id} style={{padding: '12px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '6px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: c.user_role === 'admin' ? '#a896d6' : 'rgba(255,255,255,.78)', fontWeight: 500}}>{c.user_email}</span>
                    {c.user_role === 'admin' && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', padding: '2px 6px', background: 'transparent', color: '#a896d6', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Admin</span>}
                    {c.is_internal && <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', padding: '2px 6px', background: 'transparent', color: '#D6A05C', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Internal</span>}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)'}}>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                    {(user?.role === 'admin' || user?.email === c.user_email) && (
                      <button onClick={() => handleDeleteComment(c.id)} style={{background: 'none', border: 'none', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: '12px', padding: '0', opacity: 0.5}} title="Delete comment">×</button>
                    )}
                  </div>
                </div>
                <p style={{color: 'rgba(255,255,255,.78)', fontSize: '13px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap'}}>{c.content}</p>
              </div>
            ))}
          </div>
        )}
        
        {comments.length === 0 && !newComment && (
          <p style={{color: 'rgba(255,255,255,.50)', fontSize: '13px', fontStyle: 'italic', margin: 0}}>No comments yet</p>
        )}
      </Panel>

      {app.notes && (
        <Panel>
          <div className="hud-label" style={{marginBottom: '16px'}}>Applicant Notes</div>
          <p style={{color: 'rgba(255,255,255,.78)', lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{app.notes}</p>
        </Panel>
      )}
    </div>
  );
}

// CAT-72 Console

export default ApplicationDetail;

