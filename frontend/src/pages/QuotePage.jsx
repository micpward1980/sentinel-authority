import React, { useState, useEffect } from 'react';
import { styles } from '../config/styles';
import { api } from '../config/api';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';

const SECTORS = [
  'Autonomous Vehicles', 'Aviation', 'Energy & Critical Infrastructure',
  'Healthcare & Medical AI', 'Defense', 'Logistics & Warehouse',
  'Financial Systems', 'Agriculture & Robotics', 'Other'
];

const SECTOR_GUIDANCE = {
  'Autonomous Vehicles': { typical: '4-8', note: 'One system per ODD (urban, suburban, highway, weather variant)' },
  'Aviation': { typical: '3-6', note: 'Taxiing, cargo drones, maintenance AI, ATC components' },
  'Energy & Critical Infrastructure': { typical: '2-5', note: 'Grid optimization, water treatment, pipeline monitoring' },
  'Healthcare & Medical AI': { typical: '2-4', note: 'Diagnostics, surgical robotics, drug dispensing, triage' },
  'Defense': { typical: '5-12', note: 'Logistics vehicles, surveillance, perimeter, threat assessment' },
  'Logistics & Warehouse': { typical: '1-3', note: 'Forklifts, pick-and-pack, AGVs, yard trucks' },
  'Financial Systems': { typical: '3-8', note: 'Trading, risk management, loan origination, market-making' },
  'Agriculture & Robotics': { typical: '1-4', note: 'Harvesting, crop monitoring, irrigation, livestock' },
  'Other': { typical: '1-6', note: 'Custom assessment based on system description' },
};

const PRICING = {
  standard: { initial: 75000, annual: 50000, expedited: 112500 },
  founding: { initial: 15000, annual: 12000, expedited: 22500 },
  enterpriseThreshold: 6,
};

// ─── Shared Styles ───
const fieldLabel = {
  display: 'block', fontFamily: styles.sans, fontSize: 11.5, fontWeight: 600,
  color: styles.textSecondary, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6,
};
const inputBase = {
  width: '100%', padding: '10px 12px', fontFamily: styles.sans, fontSize: 14,
  color: styles.textPrimary, background: styles.bgDeep || '#fff',
  border: `1px solid ${styles.borderGlass}`, borderRadius: 0, outline: 'none', boxSizing: 'border-box',
};
const monoInput = { ...inputBase, fontFamily: styles.mono, fontSize: 13 };
const textarea = { ...inputBase, minHeight: 80, resize: 'vertical', lineHeight: 1.5 };
const selectInput = { ...inputBase, cursor: 'pointer', appearance: 'none' };
const btnPrimary = (active) => ({
  width: '100%', padding: '14px', fontFamily: styles.mono, fontSize: 12, letterSpacing: '2px',
  background: active ? '#0f1021' : (styles.bgPanel || '#f5f5f3'),
  color: active ? '#fff' : (styles.textTertiary || '#999'),
  border: `1px solid ${active ? '#0f1021' : styles.borderGlass}`,
  cursor: active ? 'pointer' : 'not-allowed',
});
const btnAccent = {
  width: '100%', padding: '14px', fontFamily: styles.mono, fontSize: 12, letterSpacing: '2px',
  background: styles.purpleBright || '#6b5a9e', color: '#fff', border: 'none', cursor: 'pointer',
};

function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

// ─── Quote Preview ───
function QuotePreview({ quote }) {
  if (!quote) return null;
  const isEnt = quote.system_count >= PRICING.enterpriseThreshold;
  const ink = '#0f1021';
  return (
    <div style={{ border: `2px solid ${ink}`, background: '#fff' }}>
      <div style={{ background: ink, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: styles.serif, fontSize: 14, fontWeight: 700, color: '#fff' }}>SENTINEL AUTHORITY</div>
        <div style={{ fontFamily: styles.mono, fontSize: 10.5, color: 'rgba(255,255,255,.6)', letterSpacing: '1px' }}>{quote.quote_number}</div>
      </div>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.purpleBright, letterSpacing: '2px', marginBottom: 6 }}>ODDC CERTIFICATION SERVICES</div>
        <h2 style={{ fontFamily: styles.serif, fontSize: 22, fontWeight: 700, color: ink, margin: '0 0 4px 0' }}>Certification Fee Proposal</h2>
        <div style={{ fontFamily: styles.sans, fontSize: 13, color: styles.textTertiary }}>
          Prepared for {quote.company_name} &middot; {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      {quote.executive_summary && (
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 8 }}>EXECUTIVE SUMMARY</div>
          <div style={{ fontFamily: styles.sans, fontSize: 13, color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{quote.executive_summary}</div>
        </div>
      )}
      <div style={{ padding: '0 24px 20px' }}>
        <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 12 }}>SYSTEM PROFILE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: styles.borderGlass }}>
          {[['Sector', quote.sector], ['Systems', `${quote.system_count} certified system${quote.system_count > 1 ? 's' : ''}`], ['Tier', isEnt ? 'Enterprise (MCA)' : 'Standard']].map(([l, v]) => (
            <div key={l} style={{ background: '#fff', padding: '12px 16px' }}>
              <div style={{ fontFamily: styles.mono, fontSize: 9.5, color: styles.textTertiary, letterSpacing: '1px', marginBottom: 4 }}>{l.toUpperCase()}</div>
              <div style={{ fontFamily: styles.sans, fontSize: 13.5, fontWeight: 600, color: styles.textPrimary }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 12 }}>FEE SCHEDULE</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: styles.sans, fontSize: 13 }}>
          <thead><tr style={{ background: ink }}>
            {['Item', 'Per System', 'Systems', 'Total'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Item' ? 'left' : 'right', fontFamily: styles.mono, fontSize: 10.5, color: 'rgba(255,255,255,.8)', letterSpacing: '1px', fontWeight: 600 }}>{h.toUpperCase()}</th>
            ))}
          </tr></thead>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${styles.borderGlass}` }}>
              <td style={{ padding: '12px 14px', fontWeight: 600 }}>Initial Conformance Assessment</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: styles.mono, color: styles.textSecondary }}>${(quote.price_per_system || 15000).toLocaleString()}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: styles.mono, color: styles.textSecondary }}>&times;{quote.system_count}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: styles.mono, fontWeight: 700, color: ink }}>${quote.initial_total.toLocaleString()}</td>
            </tr>
            <tr style={{ background: styles.bgPanel, borderBottom: `1px solid ${styles.borderGlass}` }}>
              <td style={{ padding: '12px 14px', fontWeight: 600 }}>Annual Maintenance</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: styles.mono, color: styles.textSecondary }}>$12,000</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: styles.mono, color: styles.textSecondary }}>&times;{quote.system_count}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: styles.mono, fontWeight: 700, color: ink }}>${quote.annual_total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(15,16,33,.03)', border: `1px solid ${styles.borderGlass}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {quote.discount_percent > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: styles.sans, fontSize: 13, color: styles.accentGreen }}>Discount ({quote.discount_percent}%){quote.discount_reason ? " — " + quote.discount_reason : ""}</span>
            <span style={{ fontFamily: styles.mono, fontSize: 15, fontWeight: 700, color: styles.accentGreen }}>-${Math.round((quote.price_per_system * quote.system_count + quote.annual_per_system * quote.system_count) * quote.discount_percent / 100).toLocaleString()}</span>
          </div>}
            <span style={{ fontFamily: styles.sans, fontSize: 13, color: styles.textSecondary }}>Year One Total</span>
            <span style={{ fontFamily: styles.mono, fontSize: 15, fontWeight: 700, color: ink }}>${quote.year_one_total.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: styles.sans, fontSize: 13, color: styles.textSecondary }}>Annual Renewal</span>
            <span style={{ fontFamily: styles.mono, fontSize: 15, fontWeight: 700, color: ink }}>${quote.annual_total.toLocaleString()}</span>
          </div>
        </div>
        {isEnt && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: `rgba(107,90,158,.05)`, borderLeft: `3px solid ${styles.purpleBright}` }}>
            <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.purpleBright, letterSpacing: '1.5px', marginBottom: 4 }}>ENTERPRISE</div>
            <div style={{ fontFamily: styles.sans, fontSize: 12.5, color: styles.textSecondary, lineHeight: 1.5 }}>
              Qualifies for Master Certification Agreement (MCA). Published rates serve as basis for negotiation. Volume consideration and multi-year terms available.
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 24px', background: styles.bgPanel, borderTop: `1px solid ${styles.borderGlass}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1px' }}>VALID 30 DAYS &middot; CONFIDENTIAL</span>
        <span style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, fontStyle: 'italic' }}>Sentinel Authority &middot; The Physics of Permission</span>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function QuotePage() {
  const [view, setView] = useState('queue');  // queue | new | detail
  const [quotes, setQuotes] = useState([]);
  const [discInitialPct, setDiscInitialPct] = useState(""); const [discAnnualPct, setDiscAnnualPct] = useState(""); const [discReason, setDiscReason] = useState("");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pipelineStats, setPipelineStats] = useState(null);

  // Intake form state
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [systemDesc, setSystemDesc] = useState('');
  const [oddDesc, setOddDesc] = useState('');
  const [systemCount, setSystemCount] = useState(1);
  const [expedited, setExpedited] = useState(false);
  const [founding, setFounding] = useState(false);
  const [notes, setNotes] = useState('');

  const sectorInfo = SECTOR_GUIDANCE[sector];

  useEffect(() => { loadQuotes(); }, []);

  async function loadQuotes() {
    setLoading(true);
    try {
      const res = await api.get('/api/quotes/');
      setQuotes(res.data.quotes || []);
    } catch (e) { console.error('Failed to load quotes:', e); }
    setLoading(false);
  }

  async function submitIntake() {
    if (!company || !sector || !systemDesc) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/quotes/intake', {
        company_name: company, contact_name: contact, contact_email: email,
        sector, system_description: systemDesc, odd_description: oddDesc,
        estimated_systems: systemCount, expedited, founding, source: 'manual', internal_notes: notes,
      });
      setSelectedQuote(res.data.quote);
      setView('detail');
      loadQuotes();
      // Reset form
      setCompany(''); setContact(''); setEmail(''); setSector('');
      setSystemDesc(''); setOddDesc(''); setSystemCount(1); setExpedited(false); setFounding(false); setNotes('');
    } catch (e) { console.error('Intake failed:', e); alert('Quote generation failed. Check console.'); }
    setSubmitting(false);
  }

  async function approveQuote(id) {
    try {
      const res = await api.post(`/api/quotes/${id}/approve`, { approved_by: 'admin' });
      setSelectedQuote(res.data);
      loadQuotes();
    } catch (e) { console.error('Approve failed:', e); }
  }

  async function sendQuote(id) {
    try {
      const res = await api.post(`/api/quotes/${id}/send`);
      setSelectedQuote(res.data);
      loadQuotes();
    } catch (e) { console.error('Send failed:', e); }
  }

  async function deleteQuote(id) {
    if (!confirm("Delete this quote? This cannot be undone.")) return;
    try {
      await api.delete(`/api/quotes/${id}`);
      setSelectedQuote(null);
      loadQuotes();
    } catch(e) { alert("Delete failed: " + (e.response?.data?.detail || e.message)); }
  }
  async function applyDiscount(id) {
    const iPct = parseInt(discInitialPct) || 0;
    const aPct = parseInt(discAnnualPct) || 0;
    if (iPct < 0 || iPct > 100 || aPct < 0 || aPct > 100) return alert("Enter 0-100");
    try {
      const res = await api.post(`/api/quotes/${id}/discount`, {
        initial_discount_percent: iPct,
        annual_discount_percent: aPct,
        reason: discReason
      });
      setSelectedQuote(prev => ({
        ...prev,
        initial_discount_percent: iPct,
        annual_discount_percent: aPct,
        discount_reason: discReason,
        initial_total: res.data.initial_total,
        annual_total: res.data.annual_total,
        year_one_total: res.data.year_one_total
      }));
      setDiscInitialPct(""); setDiscAnnualPct(""); setDiscReason("");
      loadQuotes();
    } catch(e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
  }

  async function acceptQuote(id) {
    try {
      const res = await api.post(`/api/quotes/${id}/accept`);
      if (res.data.stripe_payment_url) {
        alert(`Invoice ${res.data.invoice_number} created!\n\nStripe payment link:\n${res.data.stripe_payment_url}`);
      }
      setSelectedQuote(res.data.quote);
      loadQuotes();
    } catch (e) { alert(e.response?.data?.detail || "Accept failed"); }
  }

  const statusColor = (s) => {
    if (s === 'pending_review') return styles.accentAmber;
    if (s === 'approved') return styles.purpleBright;
    if (s === 'sent') return styles.accentGreen;
    if (s === 'accepted') return styles.accentGreen;
    if (s === 'expired' || s === 'declined') return styles.accentRed;
    return styles.textTertiary;
  };

  return (
    <div>
      <SectionHeader label="QUOTE ENGINE" title="Certification Fee Proposals" />

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `2px solid ${styles.borderGlass}` }}>
        {[['queue', `PIPELINE (${quotes.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => { setView(k); setSelectedQuote(null); }} style={{
            fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', padding: '10px 20px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: view === k ? (styles.purpleBright || '#6b5a9e') : styles.textTertiary,
            borderBottom: view === k ? `2px solid ${styles.purpleBright || '#6b5a9e'}` : '2px solid transparent',
            marginBottom: -2, fontWeight: view === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>

      {/* ─── QUEUE VIEW ─── */}
      {view === 'queue' && !selectedQuote && (
        <div>
          {/* Pipeline Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div onClick={() => setStatusFilter(statusFilter === "pending_review" ? null : "pending_review")} style={{cursor:"pointer",opacity:statusFilter && statusFilter !== "pending_review" ? 0.4 : 1}}><StatCard label="Pending Review" value={quotes.filter(q => q.status === "pending_review").length} color={styles.accentAmber} /></div>
            <div onClick={() => setStatusFilter(statusFilter === "approved" ? null : "approved")} style={{cursor:"pointer",opacity:statusFilter && statusFilter !== "approved" ? 0.4 : 1}}><StatCard label="Approved" value={quotes.filter(q => q.status === "approved").length} color={styles.purpleBright} /></div>
            <div onClick={() => setStatusFilter(statusFilter === "sent" ? null : "sent")} style={{cursor:"pointer",opacity:statusFilter && statusFilter !== "sent" ? 0.4 : 1}}><StatCard label="Sent" value={quotes.filter(q => q.status === "sent").length} color={styles.accentGreen} /></div>
            <div onClick={() => setStatusFilter(null)} style={{cursor:"pointer"}}><StatCard label="Pipeline Value" value={`$${quotes.filter(q => !['expired','declined'].includes(q.status)).reduce((s, q) => s + (q.year_one_total || 0), 0).toLocaleString()}`} color={styles.purplePrimary} /></div>
          </div>

          {loading ? (
            <Panel><div style={{ textAlign: 'center', padding: 40, fontFamily: styles.mono, fontSize: 12, color: styles.textTertiary }}>LOADING...</div></Panel>
          ) : quotes.length === 0 ? (
            <Panel>
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary, letterSpacing: '1.5px' }}>NO QUOTES IN PIPELINE</div>
                <p style={{ fontFamily: styles.sans, fontSize: 13, color: styles.textTertiary, marginTop: 8 }}>Create a new quote or wait for website inquiries</p>
              </div>
            </Panel>
          ) : (
            <Panel style={{ padding: 0 }}>
              {quotes.filter(q => !statusFilter || q.status === statusFilter).map((q, i) => (
                <div key={q.id} onClick={() => { setSelectedQuote(q); setView('queue'); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 24px', cursor: 'pointer',
                    borderBottom: i < quotes.length - 1 ? `1px solid ${styles.borderSubtle || styles.borderGlass}` : 'none',
                    transition: 'background 0.15s', }}
                  onMouseEnter={e => e.currentTarget.style.background = styles.bgPanel || 'rgba(0,0,0,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontFamily: styles.sans, fontWeight: 600, fontSize: 14, color: styles.textPrimary }}>{q.company_name}</div>
                    <div style={{ fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary, marginTop: 2 }}>
                      {q.quote_number} &middot; {q.sector} &middot; {q.system_count} system{q.system_count > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', padding: '4px 10px',
                      color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}30`,
                      background: `${statusColor(q.status)}10`, textTransform: 'uppercase' }}>
                      {q.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontFamily: styles.mono, fontSize: 14, fontWeight: 700, color: '#0f1021' }}>
                      ${(q.year_one_total || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </Panel>
          )}
        </div>
      )}

      {/* ─── QUOTE DETAIL ─── */}
      {view === 'queue' && selectedQuote && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setSelectedQuote(null)} style={{ padding: '10px 20px', fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, color: styles.textSecondary, cursor: 'pointer' }}>&larr; BACK</button>
            {selectedQuote.status === 'pending_review' && (
              <button onClick={() => approveQuote(selectedQuote.id)} style={{ padding: '10px 20px', fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', background: styles.purpleBright, border: 'none', color: '#fff', cursor: 'pointer' }}>APPROVE</button>
            )}
            {selectedQuote.status === 'approved' && (
              <button onClick={() => sendQuote(selectedQuote.id)} style={{ padding: '10px 20px', fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', background: styles.accentGreen, border: 'none', color: '#fff', cursor: 'pointer' }}>MARK SENT</button>
            )}
            {selectedQuote.status === "sent" && (
              <button onClick={() => acceptQuote(selectedQuote.id)} style={{ padding: "10px 20px", fontFamily: styles.mono, fontSize: 11, letterSpacing: "1.5px", background: "#0066ff", border: "none", color: "#fff", cursor: "pointer" }}>ACCEPT — CREATE INVOICE</button>
            )}
            <button onClick={() => deleteQuote(selectedQuote.id)} style={{ padding: "10px 20px", fontFamily: styles.mono, fontSize: 11, letterSpacing: "1.5px", background: "transparent", border: "1px solid " + styles.accentRed, color: styles.accentRed, cursor: "pointer", marginLeft: "auto" }}>DELETE</button>

          {/* Discount */}
          <div style={{ marginTop: 16, padding: "16px 20px", background: "rgba(15,16,33,.03)", border: "1px solid " + styles.borderGlass }}>
            <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: "1.5px", marginBottom: 10 }}>APPLY DISCOUNT</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
              <div style={{ width: 100 }}>
                <label style={{ display: "block", fontFamily: styles.mono, fontSize: 9, color: styles.textTertiary, marginBottom: 4 }}>INITIAL %</label>
                <input type="number" min="0" max="100" value={discInitialPct} onChange={e => setDiscInitialPct(e.target.value)} placeholder="0" style={{ width: "100%", padding: "8px", fontFamily: styles.mono, fontSize: 14, border: "1px solid " + styles.borderGlass, outline: "none" }} />
              </div>
              <div style={{ width: 100 }}>
                <label style={{ display: "block", fontFamily: styles.mono, fontSize: 9, color: styles.textTertiary, marginBottom: 4 }}>ANNUAL %</label>
                <input type="number" min="0" max="100" value={discAnnualPct} onChange={e => setDiscAnnualPct(e.target.value)} placeholder="0" style={{ width: "100%", padding: "8px", fontFamily: styles.mono, fontSize: 14, border: "1px solid " + styles.borderGlass, outline: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontFamily: styles.mono, fontSize: 9, color: styles.textTertiary, marginBottom: 4 }}>REASON</label>
                <input value={discReason} onChange={e => setDiscReason(e.target.value)} placeholder="e.g. Early adopter, founding program" style={{ width: "100%", padding: "8px", fontFamily: styles.sans, fontSize: 13, border: "1px solid " + styles.borderGlass, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => applyDiscount(selectedQuote.id)} onMouseEnter={e => { e.currentTarget.style.background = "#2a2660"; e.currentTarget.style.transform = "scale(1.03)"; }} onMouseLeave={e => { e.currentTarget.style.background = styles.purplePrimary; e.currentTarget.style.transform = "scale(1)"; }} onMouseDown={e => { e.currentTarget.style.transform = "scale(0.96)"; }} onMouseUp={e => { e.currentTarget.style.transform = "scale(1.03)"; }} style={{ padding: "8px 16px", fontFamily: styles.mono, fontSize: 10, letterSpacing: "1px", background: styles.purplePrimary, color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease", borderRadius: 2 }}>APPLY</button>
            </div>
          </div>
          </div>

          {/* AI Analysis */}
          {selectedQuote.ai_analysis && (
            <Panel style={{ marginBottom: 20, borderLeft: `3px solid ${styles.accentGreen}`, background: `${styles.accentGreen}08` }}>
              <div style={{ fontFamily: styles.mono, fontSize: 10.5, color: styles.accentGreen, letterSpacing: '1.5px', marginBottom: 10 }}>AI ANALYSIS</div>
              <div style={{ fontFamily: styles.sans, fontSize: 13.5, color: styles.textPrimary, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {(typeof selectedQuote.ai_analysis === 'string' ? JSON.parse(selectedQuote.ai_analysis) : selectedQuote.ai_analysis).summary}
              </div>
              {(() => {
                const a = typeof selectedQuote.ai_analysis === 'string' ? JSON.parse(selectedQuote.ai_analysis) : selectedQuote.ai_analysis;
                return a.flags?.length > 0 ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${styles.borderSubtle || styles.borderGlass}` }}>
                    <div style={{ fontFamily: styles.mono, fontSize: 10.5, color: styles.accentAmber, letterSpacing: '1.5px', marginBottom: 8 }}>FLAGS</div>
                    {a.flags.map((f, i) => (
                      <div key={i} style={{ fontFamily: styles.sans, fontSize: 12.5, color: styles.accentAmber, marginBottom: 4, paddingLeft: 12, borderLeft: `2px solid ${styles.accentAmber}50` }}>{f}</div>
                    ))}
                  </div>
                ) : null;
              })()}
            </Panel>
          )}

          <QuotePreview quote={selectedQuote} />
        </div>
      )}

      {/* ─── NEW QUOTE FORM ─── */}
      {view === 'new' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel>
              <div style={{ fontFamily: styles.mono, fontSize: 11, color: styles.purpleBright, letterSpacing: '1.5px', marginBottom: 12 }}>01</div>
              <h3 style={{ fontFamily: styles.serif, fontSize: 17, fontWeight: 700, color: styles.textPrimary, margin: '0 0 16px 0' }}>Prospect Information</h3>
              <Field label="Company Name"><input style={inputBase} value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Waymo, Shield AI, Nuro" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Contact"><input style={inputBase} value={contact} onChange={e => setContact(e.target.value)} placeholder="Name" /></Field>
                <Field label="Email"><input style={inputBase} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" /></Field>
              </div>
              <Field label="Sector">
                <select style={selectInput} value={sector} onChange={e => setSector(e.target.value)}>
                  <option value="">Select sector...</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              {sectorInfo && (
                <div style={{ padding: '10px 14px', background: `${styles.purpleBright}0A`, borderLeft: `2px solid ${styles.purpleBright}`, marginBottom: 12 }}>
                  <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.purpleBright, letterSpacing: '1px' }}>TYPICAL: {sectorInfo.typical} SYSTEMS</div>
                  <div style={{ fontFamily: styles.sans, fontSize: 12, color: styles.textTertiary, marginTop: 2 }}>{sectorInfo.note}</div>
                </div>
              )}
            </Panel>
            <Panel>
              <div style={{ fontFamily: styles.mono, fontSize: 11, color: styles.purpleBright, letterSpacing: '1.5px', marginBottom: 12 }}>02</div>
              <h3 style={{ fontFamily: styles.serif, fontSize: 17, fontWeight: 700, color: styles.textPrimary, margin: '0 0 16px 0' }}>System Profile</h3>
              <Field label="System Description"><textarea style={textarea} value={systemDesc} onChange={e => setSystemDesc(e.target.value)} placeholder="What the system does, how it operates, what decisions it makes autonomously..." /></Field>
              <Field label="Operational Design Domains"><textarea style={textarea} value={oddDesc} onChange={e => setOddDesc(e.target.value)} placeholder="Where and under what conditions (urban streets, warehouse, hospital OR, highway...)" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Est. System Count"><input style={monoInput} type="number" min={1} max={50} value={systemCount} onChange={e => setSystemCount(parseInt(e.target.value) || 1)} /></Field>
                <Field label="Expedited">
                  <div onClick={() => setExpedited(!expedited)} style={{ ...inputBase, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    background: expedited ? `${styles.accentAmber}0F` : '#fff',
                    borderColor: expedited ? `${styles.accentAmber}50` : styles.borderGlass }}>
                    <div style={{ width: 16, height: 16, border: `2px solid ${expedited ? styles.accentAmber : styles.borderGlass}`,
                      background: expedited ? styles.accentAmber : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {expedited && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>&#10003;</span>}
                    </div>
                    <span style={{ fontSize: 13, color: expedited ? styles.accentAmber : styles.textTertiary }}>
                      {expedited ? 'Yes — < 30 days (+50%)' : 'Standard timeline'}
                    </span>
                  </div>
                </Field>
                <Field label="Program Tier">
                  <div onClick={() => setFounding(!founding)} style={{ ...inputBase, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    background: founding ? 'rgba(42,37,96,0.06)' : '#fff',
                    borderColor: founding ? 'rgba(42,37,96,0.40)' : styles.borderGlass }}>
                    <div style={{ width: 16, height: 16, border: `2px solid ${founding ? '#2a2560' : styles.borderGlass}`,
                      background: founding ? '#2a2560' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {founding && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>&#10003;</span>}
                    </div>
                    <span style={{ fontSize: 13, color: founding ? '#2a2560' : styles.textTertiary }}>
                      {founding ? 'Founding Program — $15K / $12K' : 'Standard — $75K / $50K'}
                    </span>
                  </div>
                </Field>
              </div>
              <Field label="Internal Notes"><textarea style={{ ...textarea, minHeight: 50 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Source, urgency, context..." /></Field>
            </Panel>
            <button onClick={submitIntake} disabled={!company || !sector || !systemDesc || submitting} style={btnPrimary(company && sector && systemDesc && !submitting)}>
              {submitting ? 'ANALYZING & GENERATING QUOTE...' : 'GENERATE QUOTE →'}
            </button>
          </div>

          {/* Right: Live Calculator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24 }}>
            <Panel style={{ background: 'rgba(15,16,33,.02)' }}>
              <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 14 }}>LIVE ESTIMATE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary }}>YEAR ONE</div>
                  <div style={{ fontFamily: styles.mono, fontSize: 24, fontWeight: 700, color: '#0f1021' }}>${(systemCount * ((founding ? PRICING.founding.initial : PRICING.standard.initial) + (founding ? PRICING.founding.annual : PRICING.standard.annual))).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary }}>ANNUAL</div>
                  <div style={{ fontFamily: styles.mono, fontSize: 24, fontWeight: 700, color: '#0f1021' }}>${(systemCount * (founding ? PRICING.founding.annual : PRICING.standard.annual)).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                <span style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', padding: '4px 10px',
                  background: systemCount >= PRICING.enterpriseThreshold ? `${styles.purpleBright}18` : `${styles.accentGreen}14`,
                  color: systemCount >= PRICING.enterpriseThreshold ? styles.purpleBright : styles.accentGreen,
                  border: `1px solid ${systemCount >= PRICING.enterpriseThreshold ? styles.purpleBright + '30' : styles.accentGreen + '25'}` }}>
                  {founding ? 'FOUNDING PROGRAM' : systemCount >= PRICING.enterpriseThreshold ? 'ENTERPRISE · MCA' : 'STANDARD'}
                </span>
                <span style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', padding: '4px 10px', color: styles.textTertiary, border: `1px solid ${styles.borderGlass}` }}>
                  {systemCount} SYSTEM{systemCount > 1 ? 'S' : ''}
                </span>
              </div>
            </Panel>

            <Panel>
              <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 12 }}>WORKFLOW</div>
              {['Fill intake form', 'AI analyzes systems & ODDs', 'Quote generated with exec summary', 'Admin reviews & approves', 'Quote sent to prospect'].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: styles.mono, fontSize: 10, color: styles.purpleBright, minWidth: 20 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: styles.sans, fontSize: 12.5, color: styles.textSecondary }}>{step}</span>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
