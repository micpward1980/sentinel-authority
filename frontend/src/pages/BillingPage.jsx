import React, { useState, useEffect } from 'react';
import { styles } from '../config/styles';
import { api } from '../config/api';
import Panel from '../components/Panel';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';

const INVOICE_TYPES = { initial_assessment: 'Initial Assessment', annual_maintenance: 'Annual Maintenance', expedited: 'Expedited Review', reassessment: 'Re-Assessment', scope_adjustment: 'Scope Adjustment' };
const RATES = { initial_assessment: 15000, annual_maintenance: 12000, expedited: 22500, reassessment: 10000, scope_adjustment: 15000 };
const STATUS_CFG = {
  draft: { color: '#888' }, sent: { color: styles.accentAmber }, viewed: { color: styles.purpleBright },
  paid: { color: styles.accentGreen }, overdue: { color: styles.accentRed }, lapsed: { color: styles.accentRed }, cancelled: { color: '#888' },
};

const fl = { display: 'block', fontFamily: styles.sans, fontSize: 11.5, fontWeight: 600, color: styles.textSecondary, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 };
const inp = { width: '100%', padding: '10px 12px', fontFamily: styles.sans, fontSize: 14, color: styles.textPrimary, background: '#fff', border: '1px solid ' + styles.borderGlass, borderRadius: 0, outline: 'none', boxSizing: 'border-box' };

function Field({ label, children }) { return <div style={{ marginBottom: 16 }}><label style={fl}>{label}</label>{children}</div>; }
function Badge({ status }) {
  const c = (STATUS_CFG[status] || STATUS_CFG.draft).color;
  return <span style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', padding: '4px 10px', color: c, border: '1px solid ' + c + '30', background: c + '10', textTransform: 'uppercase' }}>{status.replace('_',' ')}</span>;
}

export default function BillingPage() {
  const [view, setView] = useState('overview');
  const [invoices, setInvoices] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('all');
  // Create form
  const [nc, setNc] = useState(''); const [ne, setNe] = useState(''); const [nn, setNn] = useState('');
  const [nt, setNt] = useState('initial_assessment'); const [ns, setNs] = useState(''); const [nsc, setNsc] = useState(1);
  // Payment
  const [showManual, setShowManual] = useState(false); const [stripeLoading, setStripeLoading] = useState(false);
  const [pa, setPa] = useState(''); const [pm, setPm] = useState('wire'); const [pr, setPr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([api.get('/api/billing/invoices'), api.get('/api/billing/dashboard/summary'), api.get('/api/billing/renewals/upcoming')]);
      setInvoices(a.data.invoices || []); setSummary(b.data); setRenewals(c.data.renewals || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function createInv() {
    if (!nc || !ne) return;
    await api.post('/api/billing/invoices', { company_name: nc, contact_name: nn, contact_email: ne, invoice_type: nt, system_name: ns, system_count: nsc });
    setView('invoices'); load(); setNc(''); setNe(''); setNn(''); setNs(''); setNsc(1);
  }

  async function pay(id) {
    if (!pa) return;
    await api.post('/api/billing/invoices/' + id + '/pay', { paid_amount: parseInt(pa), payment_method: pm, payment_reference: pr });
    setPa(''); setPr(''); load(); setSel(null);
  }

  async function sendToStripe(id) {
    setStripeLoading(true);
    try {
      const r = await api.post("/api/billing/invoices/" + id + "/stripe");
      if (r.data.stripe_payment_url) {
        setSel(prev => ({ ...prev, stripe_hosted_url: r.data.stripe_payment_url, stripe_invoice_id: r.data.stripe_invoice_id }));
      } else { alert("Stripe error: " + (r.data.error || "Unknown")); }
    } catch(e) { alert("Failed: " + (e.response?.data?.detail || e.message)); }
    setStripeLoading(false);
  }

  async function cron() {
    const r = await api.post('/api/billing/cron/renewals');
    alert('Created: ' + r.data.invoices_created + ' | Reminders: ' + r.data.reminders_sent + ' | Lapsed: ' + r.data.lapsed);
    load();
  }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const ink = '#0f1021';

  return (
    <div>
      <SectionHeader label="BILLING" title="Invoices & Renewals" />
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid ' + styles.borderGlass }}>
        {[['overview','OVERVIEW'],['invoices','INVOICES ('+invoices.length+')'],['renewals','RENEWALS ('+renewals.length+')'],['create','NEW INVOICE']].map(([k,l]) => (
          <button key={k} onClick={() => { setView(k); setSel(null); }} style={{
            fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
            color: view === k ? styles.purpleBright : styles.textTertiary, borderBottom: view === k ? '2px solid ' + styles.purpleBright : '2px solid transparent', marginBottom: -2, fontWeight: view === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>

      {view === 'overview' && <div>
        {summary && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Invoiced" value={'$' + (summary.total_invoiced||0).toLocaleString()} color={styles.purplePrimary} />
          <StatCard label="Collected" value={'$' + (summary.total_collected||0).toLocaleString()} color={styles.accentGreen} />
          <StatCard label="Outstanding" value={'$' + (summary.outstanding||0).toLocaleString()} color={styles.accentAmber} />
          <StatCard label="Overdue" value={summary.overdue_count||0} color={styles.accentRed} />
        </div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Panel>
            <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 14 }}>RECENT INVOICES</div>
            {invoices.slice(0,8).map((inv,i) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i<7 ? '1px solid ' + styles.borderGlass : 'none' }}>
                <div><div style={{ fontFamily: styles.sans, fontSize: 13, fontWeight: 600 }}>{inv.company_name}</div>
                  <div style={{ fontFamily: styles.mono, fontSize: 10.5, color: styles.textTertiary }}>{inv.invoice_number}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Badge status={inv.status} />
                  <span style={{ fontFamily: styles.mono, fontSize: 13, fontWeight: 700, color: ink }}>${(inv.total_amount||0).toLocaleString()}</span></div>
              </div>
            ))}
          </Panel>
          <Panel>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px' }}>UPCOMING RENEWALS</div>
              <button onClick={cron} style={{ fontFamily: styles.mono, fontSize: 10, padding: '4px 12px', background: 'transparent', border: '1px solid ' + styles.borderGlass, color: styles.textTertiary, cursor: 'pointer' }}>RUN CRON</button>
            </div>
            {renewals.slice(0,8).map((r,i) => (
              <div key={r.id||i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i<7 ? '1px solid ' + styles.borderGlass : 'none' }}>
                <div><div style={{ fontFamily: styles.sans, fontSize: 13, fontWeight: 600 }}>{r.company_name||r.applicant_name}</div>
                  <div style={{ fontFamily: styles.mono, fontSize: 10.5, color: styles.textTertiary }}>{r.system_name||'System'}</div></div>
                <div style={{ fontFamily: styles.mono, fontSize: 12, fontWeight: 600, color: r.days_until<=30 ? styles.accentRed : r.days_until<=60 ? styles.accentAmber : styles.accentGreen }}>{r.days_until} days</div>
              </div>
            ))}
            {renewals.length === 0 && <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: styles.sans, fontSize: 13, color: styles.textTertiary }}>No renewals in next 90 days</div>}
          </Panel>
        </div>
      </div>}

      {view === 'invoices' && !sel && <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['all','sent','overdue','paid','cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontFamily: styles.mono, fontSize: 10, letterSpacing: '1px', padding: '6px 14px',
              background: filter===f ? ink : 'transparent', color: filter===f ? '#fff' : styles.textTertiary,
              border: '1px solid ' + (filter===f ? ink : styles.borderGlass), cursor: 'pointer', textTransform: 'uppercase' }}>{f}</button>
          ))}
        </div>
        <Panel style={{ padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 0.8fr 1fr', padding: '12px 24px', borderBottom: '2px solid ' + styles.borderGlass, background: styles.bgPanel }}>
            {['Company','Invoice','Type','Due','Status','Amount'].map(h => (
              <div key={h} style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1px', textAlign: h==='Amount'?'right':'left' }}>{h.toUpperCase()}</div>
            ))}
          </div>
          {filtered.map((inv,i) => (
            <div key={inv.id} onClick={() => setSel(inv)} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 0.8fr 1fr', padding: '14px 24px',
              borderBottom: i<filtered.length-1 ? '1px solid ' + styles.borderGlass : 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = styles.bgPanel} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontFamily: styles.sans, fontSize: 13, fontWeight: 600 }}>{inv.company_name}</div>
              <div style={{ fontFamily: styles.mono, fontSize: 12, color: styles.textSecondary }}>{inv.invoice_number}</div>
              <div style={{ fontFamily: styles.sans, fontSize: 12, color: styles.textTertiary }}>{INVOICE_TYPES[inv.invoice_type]}</div>
              <div style={{ fontFamily: styles.mono, fontSize: 12, color: styles.textSecondary }}>{inv.due_date}</div>
              <div><Badge status={inv.status} /></div>
              <div style={{ fontFamily: styles.mono, fontSize: 13, fontWeight: 700, color: ink, textAlign: 'right' }}>${(inv.total_amount||0).toLocaleString()}</div>
            </div>
          ))}
        </Panel>
      </div>}

      {view === 'invoices' && sel && <div>
        <button onClick={() => setSel(null)} style={{ marginBottom: 20, padding: '10px 20px', fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', background: 'transparent', border: '1px solid ' + styles.borderGlass, color: styles.textSecondary, cursor: 'pointer' }}>&larr; BACK</button>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <Panel>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 4 }}>{sel.invoice_number}</div>
                <h3 style={{ fontFamily: styles.serif, fontSize: 20, fontWeight: 700, color: ink, margin: 0 }}>{sel.company_name}</h3>
                <div style={{ fontFamily: styles.sans, fontSize: 13, color: styles.textTertiary, marginTop: 4 }}>{sel.description}</div></div>
              <Badge status={sel.status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[['Due', sel.due_date ? new Date(sel.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'],['Email',sel.contact_email],['System',sel.system_name||'N/A']].map(([l,v]) => (
                <div key={l}><div style={{ fontFamily: styles.mono, fontSize: 9.5, color: styles.textTertiary, letterSpacing: '1px', marginBottom: 4 }}>{l.toUpperCase()}</div>
                  <div style={{ fontFamily: styles.sans, fontSize: 13 }}>{v}</div></div>
              ))}
            </div>
            <div style={{ padding: '16px 20px', background: 'rgba(15,16,33,.03)', border: '1px solid ' + styles.borderGlass }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: styles.textSecondary }}>Total</span>
                <span style={{ fontFamily: styles.mono, fontSize: 20, fontWeight: 700, color: ink }}>${(sel.total_amount||0).toLocaleString()}</span>
              </div>
            </div>
          </Panel>
          {sel.status !== "paid" && sel.status !== "cancelled" && <Panel>
            {sel.stripe_hosted_url ? (
              <div>
                <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.accentGreen, letterSpacing: "1.5px", marginBottom: 14 }}>STRIPE INVOICE ACTIVE</div>
                <a href={sel.stripe_hosted_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", padding: "14px", fontFamily: styles.mono, fontSize: 12, letterSpacing: "2px", background: styles.purplePrimary, color: "#fff", border: "none", textAlign: "center", textDecoration: "none", cursor: "pointer", marginBottom: 12 }}>VIEW PAYMENT PAGE &rarr;</a>
                <button onClick={() => { navigator.clipboard.writeText(sel.stripe_hosted_url); alert("Link copied!"); }} style={{ width: "100%", padding: "10px", fontFamily: styles.mono, fontSize: 10, letterSpacing: "1.5px", background: "transparent", border: "1px solid " + styles.borderGlass, color: styles.textSecondary, cursor: "pointer", marginBottom: 16 }}>COPY PAYMENT LINK</button>
                <div style={{ fontFamily: styles.mono, fontSize: 9, color: styles.textTertiary, wordBreak: "break-all" }}>{sel.stripe_hosted_url}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: "1.5px", marginBottom: 14 }}>COLLECT PAYMENT</div>
                <button onClick={() => sendToStripe(sel.id)} disabled={stripeLoading} style={{ width: "100%", padding: "14px", fontFamily: styles.mono, fontSize: 12, letterSpacing: "2px", background: stripeLoading ? styles.bgPanel : styles.purplePrimary, color: stripeLoading ? styles.textTertiary : "#fff", border: "none", cursor: stripeLoading ? "wait" : "pointer", marginBottom: 16 }}>{stripeLoading ? "CREATING..." : "SEND TO STRIPE"}</button>
                <p style={{ fontFamily: styles.sans, fontSize: 12, color: styles.textTertiary, lineHeight: "1.5", margin: "0 0 16px" }}>Creates a Stripe invoice and emails the customer a secure payment link. Accepts card, ACH, and wire transfer.</p>
              </div>
            )}
            <div style={{ borderTop: "1px solid " + styles.borderGlass, paddingTop: 16 }}>
              <button onClick={() => setShowManual(!showManual)} style={{ background: "none", border: "none", fontFamily: styles.mono, fontSize: 9.5, letterSpacing: "1px", color: styles.textDim, cursor: "pointer", padding: 0 }}>{showManual ? "HIDE" : "RECORD OFFLINE PAYMENT"}</button>
              {showManual && <div style={{ marginTop: 12 }}>
                <Field label="Amount"><input style={{ ...inp, fontFamily: styles.mono }} type="number" value={pa} onChange={e => setPa(e.target.value)} placeholder={String(sel.total_amount)} /></Field>
                <Field label="Method"><select style={{ ...inp, cursor: "pointer" }} value={pm} onChange={e => setPm(e.target.value)}>
                  <option value="wire">Wire</option><option value="ach">ACH</option><option value="check">Check</option></select></Field>
                <Field label="Reference"><input style={inp} value={pr} onChange={e => setPr(e.target.value)} placeholder="Wire ref, check #" /></Field>
                <button onClick={() => pay(sel.id)} disabled={!pa} style={{ width: "100%", padding: "12px", fontFamily: styles.mono, fontSize: 12, letterSpacing: "2px", background: pa ? styles.accentGreen : styles.bgPanel, color: pa ? "#fff" : styles.textTertiary, border: "none", cursor: pa ? "pointer" : "not-allowed" }}>RECORD PAYMENT</button>
              </div>}
            </div>
          </Panel>}
          {sel.status === 'paid' && <Panel style={{ borderLeft: '3px solid ' + styles.accentGreen }}>
            <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.accentGreen, letterSpacing: '1.5px', marginBottom: 10 }}>PAID</div>
            <div style={{ fontFamily: styles.mono, fontSize: 20, fontWeight: 700 }}>${(sel.paid_amount||0).toLocaleString()}</div>
            <div style={{ fontSize: 12, color: styles.textTertiary, marginTop: 8 }}>{sel.payment_method?.toUpperCase()} &middot; {sel.paid_at ? new Date(sel.paid_at).toLocaleDateString() : ''}</div>
          </Panel>}
        </div>
      </div>}

      {view === 'renewals' && <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={cron} style={{ padding: '10px 20px', fontFamily: styles.mono, fontSize: 11, letterSpacing: '1.5px', background: ink, color: '#fff', border: 'none', cursor: 'pointer' }}>RUN RENEWAL CRON</button>
        </div>
        <Panel style={{ padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', padding: '12px 24px', borderBottom: '2px solid ' + styles.borderGlass, background: styles.bgPanel }}>
            {['Company','System','Anniversary','Days'].map(h => <div key={h} style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1px' }}>{h.toUpperCase()}</div>)}
          </div>
          {renewals.map((r,i) => (
            <div key={r.id||i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', padding: '14px 24px', borderBottom: i<renewals.length-1 ? '1px solid ' + styles.borderGlass : 'none' }}>
              <div style={{ fontFamily: styles.sans, fontSize: 13, fontWeight: 600 }}>{r.company_name||r.applicant_name}</div>
              <div style={{ fontSize: 13, color: styles.textSecondary }}>{r.system_name||'System'}</div>
              <div style={{ fontFamily: styles.mono, fontSize: 12, color: styles.textSecondary }}>{r.anniversary}</div>
              <div style={{ fontFamily: styles.mono, fontSize: 13, fontWeight: 700, color: r.days_until<=30 ? styles.accentRed : r.days_until<=60 ? styles.accentAmber : styles.accentGreen }}>{r.days_until} days</div>
            </div>
          ))}
        </Panel>
      </div>}

      {view === 'create' && <div style={{ maxWidth: 600 }}>
        <Panel>
          <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textTertiary, letterSpacing: '1.5px', marginBottom: 16 }}>NEW INVOICE</div>
          <Field label="Company"><input style={inp} value={nc} onChange={e => setNc(e.target.value)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Contact"><input style={inp} value={nn} onChange={e => setNn(e.target.value)} /></Field>
            <Field label="Email"><input style={inp} value={ne} onChange={e => setNe(e.target.value)} /></Field>
          </div>
          <Field label="Type"><select style={{ ...inp, cursor: 'pointer' }} value={nt} onChange={e => setNt(e.target.value)}>
            {Object.entries(INVOICE_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="System"><input style={inp} value={ns} onChange={e => setNs(e.target.value)} placeholder="Urban AV Platform" /></Field>
            <Field label="Count"><input style={{ ...inp, fontFamily: styles.mono }} type="number" min={1} value={nsc} onChange={e => setNsc(parseInt(e.target.value)||1)} /></Field>
          </div>
          <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(15,16,33,.03)', border: '1px solid ' + styles.borderGlass }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: styles.textSecondary }}>{INVOICE_TYPES[nt]} x{nsc}</span>
              <span style={{ fontFamily: styles.mono, fontSize: 16, fontWeight: 700, color: ink }}>${((RATES[nt]||15000)*nsc).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={createInv} disabled={!nc||!ne} style={{ width: '100%', marginTop: 20, padding: '14px', fontFamily: styles.mono, fontSize: 12, letterSpacing: '2px',
            background: nc&&ne ? ink : styles.bgPanel, color: nc&&ne ? '#fff' : styles.textTertiary, border: '1px solid ' + (nc&&ne ? ink : styles.borderGlass), cursor: nc&&ne ? 'pointer' : 'not-allowed' }}>CREATE & SEND</button>
        </Panel>
      </div>}
    </div>
  );
}
