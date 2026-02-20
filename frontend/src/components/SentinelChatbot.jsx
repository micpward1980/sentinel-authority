import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, RotateCcw, ChevronDown } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'https://sentinel-authority-production.up.railway.app';

// ─── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt({ user, applications, certificates, sessions, activeTests }) {
  const role = user?.role || 'customer';
  const name = user?.full_name?.split(' ')[0] || '';
  const apps = applications || [];
  const certs = certificates || [];
  const sess = sessions || [];

  const appList = apps.length
    ? apps.map(a => `  • ${a.system_name} [${a.application_number || a.id}] — state: ${a.state}, updated: ${a.updated_at?.split('T')[0] || '?'}`).join('\n')
    : '  (none)';

  const certList = certs.length
    ? certs.map(c => `  • ${c.certificate_number} — ${c.system_name} — state: ${c.state}${c.expires_at ? ', expires: ' + c.expires_at.split('T')[0] : ''}`).join('\n')
    : '  (none)';

  const onlineSessions = sess.filter(s => {
    const la = s.last_heartbeat_at || s.last_telemetry_at || s.started_at;
    return s.status === 'active' && la && (Date.now() - new Date(la).getTime()) < 120_000;
  });

  const testList = (activeTests || []).length
    ? (activeTests || []).map(t => {
        const started = t.cat72_started_at ? new Date(t.cat72_started_at) : null;
        const elapsed = started ? (Date.now() - started.getTime()) / 1000 : 0;
        const remaining = Math.max(0, (72 * 3600) - elapsed);
        const pct = Math.min(100, (elapsed / (72 * 3600)) * 100).toFixed(0);
        return `  • ${t.system_name} — ${pct}% complete, ${(remaining / 3600).toFixed(1)}h remaining`;
      }).join('\n')
    : '  (none)';

  return `You are the Sentinel Authority operations assistant — an AI built into the certification platform dashboard. You have complete, authoritative knowledge of the ODDC certification process and the ENVELO Interlock system.

IDENTITY: You are the Sentinel Authority AI — not a generic assistant. Speak with operational precision. Be direct, specific, and actionable. Never say "I'm just an AI."

CURRENT USER:
  Name: ${name || 'unknown'}
  Role: ${role}
  Organization: ${user?.organization_name || 'unknown'}

THEIR LIVE DATA:
Applications:
${appList}

Certificates:
${certList}

Active CAT-72 Tests:
${testList}

Live Interlocks: ${onlineSessions.length} online / ${sess.length} total sessions

═══════════════════════════════════════════════════
COMPLETE ODDC WORKFLOW — EVERY STEP
═══════════════════════════════════════════════════

STEP 1 — APPLICATION SUBMITTED
  Customer submits: org info, system description, ODD, boundary definitions
  Boundary types: numeric (speed/temp/etc), geographic (lat/lon/radius), time (hours/days), state (allowed/forbidden modes)
  State becomes: "pending"
  Admin action needed: click "Begin Review"

STEP 2 — ADMIN REVIEW (HUMAN STEP)
  Admin clicks "Begin Review" → state: "under_review"
  Admin evaluates boundary completeness and reasonableness
  Admin writes justification note, clicks "Approve" → state: "approved"
  ON APPROVAL (AUTOMATIC): API key is generated AND emailed to customer
  Customer should NEVER need to generate their own key manually

STEP 3 — CUSTOMER DEPLOYS INTERLOCK (HUMAN STEP)
  Customer receives API key via email (also visible in ENVELO tab)
  Customer downloads envelo_agent.py from ENVELO Interlock tab
  Customer runs:
    pip install httpx
    python envelo_agent.py
  Interlock starts sending heartbeats every 30 seconds to the Railway backend
  Dashboard state: "approved" but interlock not yet confirmed

STEP 4 — ADMIN BEGINS CAT-72 (HUMAN STEP)
  Admin sees interlock online in Monitoring tab (green dot = heartbeat <2 min ago)
  Admin clicks "Begin CAT-72" button for that system → state: "testing"
  72-hour clock starts

STEP 5 — CAT-72 RUNS (FULLY AUTOMATIC — no human action needed)
  Interlock enforces all defined boundaries on every action
  Every enforcement logged as PASS or BLOCK with telemetry
  Telemetry flushes to backend every 10 seconds
  If any violation occurs → test FAILS (admin is notified)
  If 72 hours pass without violations → PASS is auto-triggered

STEP 6 — CERTIFICATE ISSUED (AUTOMATIC ON PASS)
  Certificate auto-issues immediately on PASS
  Certificate number format: ODDC-YYYY-XXXXX
  Customer views/downloads certificate from dashboard
  State: "conformant"

STEP 7 — ONGOING PRODUCTION MONITORING
  Certified interlock continues sending telemetry indefinitely
  Violations logged but don't auto-revoke (admin decision required)
  Certificates expire annually
  Renewal triggers a new CAT-72 cycle

═══════════════════════════════════════════════════
TECHNICAL FACTS
═══════════════════════════════════════════════════
ENVELO = Enforced Non-Violable Execution-Limit Override
ODDC   = Operational Design Domain Conformance
CAT-72 = 72-hour Continuous Autonomy Test
Backend: Railway — sentinel-authority-production.up.railway.app
Frontend: Vercel — app.sentinelauthority.org
Heartbeat: every 30 seconds
"Online" = heartbeat received within last 2 minutes
API key format: sa_live_XXXXXXXX...

COMMON ISSUES:
  "Stuck in pending" → Admin needs to click Begin Review (ENVELO tab → Review Queue)
  "Approved but test not starting" → Customer hasn't deployed interlock yet, OR admin hasn't clicked Begin CAT-72
  "Interlock offline during test" → Customer needs to restart agent. >5 min offline = admin may need to restart test
  "Test failed" → Boundary violation occurred — check telemetry for which parameter and what value caused it
  "No API key" → Emailed on approval; admin can resend from ENVELO tab → Approved section → Resend Key
  "Install error" → Run: pip install httpx, then python envelo_agent.py
  "Can't connect" → Firewall must allow outbound HTTPS to sentinel-authority-production.up.railway.app port 443

${role === 'admin' ? `
ADMIN MODE: You have full visibility across all customers.
When asked "what needs attention?" surface: pending reviews, approved apps where interlock hasn't connected, near-complete CAT-72 tests, any anomalies.
Be direct about operational decisions. Help the admin run a tight, efficient certification operation.
` : `
CUSTOMER MODE: Guide this customer through their certification journey.
Be specific — tell them exactly what to click, where to find things, what commands to run.
Make the complex simple. Acknowledge their progress.
`}

RESPONSE STYLE:
  - 2-4 sentences max unless steps require more
  - Use bullet points only for multi-step instructions
  - Specific UI labels and terminal commands when relevant
  - Never make up data — reference only what's in the live data above
  - If uncertain, say so and direct them where to find the answer`;
}

// ─── Greeting builder ──────────────────────────────────────────────────────────

function buildGreeting(user, data) {
  const role = user?.role;
  const name = user?.full_name?.split(' ')[0];
  const apps = data.applications || [];

  if (role === 'admin') {
    const pending  = apps.filter(a => a.state === 'pending').length;
    const review   = apps.filter(a => a.state === 'under_review').length;
    const approved = apps.filter(a => a.state === 'approved').length;
    const testing  = apps.filter(a => a.state === 'testing').length;
    const items = [];
    if (pending)  items.push(`${pending} application${pending > 1 ? 's' : ''} in queue`);
    if (review)   items.push(`${review} under review — awaiting your decision`);
    if (approved) items.push(`${approved} approved — waiting for customer to deploy interlock`);
    if (testing)  items.push(`${testing} CAT-72 test${testing > 1 ? 's' : ''} running`);
    if (items.length) return `${name ? 'Hey ' + name + '.' : 'Hey.'} Here's what's in motion:\n\n${items.map(i => '• ' + i).join('\n')}\n\nWhat do you want to work on?`;
    return `${name ? 'Hey ' + name + '.' : 'Hey.'} Queue is clear. How can I help?`;
  }

  const latest = [...apps].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  if (!latest) return `${name ? 'Hey ' + name + '.' : 'Hey.'} Ready to start your ODDC certification? I can walk you through submitting an application.`;

  const msgs = {
    pending:      `Your application for **${latest.system_name}** is in the review queue. No action needed from you right now.`,
    under_review: `Your application for **${latest.system_name}** is being reviewed. You'll hear back soon.`,
    approved:     `Your application for **${latest.system_name}** is approved — time to deploy the ENVELO Interlock. I can walk you through it step by step.`,
    testing:      `Your CAT-72 test is running for **${latest.system_name}**. Keep the agent running — I'll let you know if anything looks off.`,
    conformant:   `**${latest.system_name}** is ODDC conformant. Certificate active. Anything you need?`,
    rejected:     `Your application for **${latest.system_name}** was returned with required changes. Want help understanding what needs to change?`,
  };

  return `${name ? 'Hey ' + name + '.' : 'Hey.'} ${msgs[latest.state] || 'How can I help with your certification?'}`;
}

// ─── Message renderer ──────────────────────────────────────────────────────────

function Msg({ msg }) {
  if (msg.role === 'note') return (
    <div style={{ textAlign: 'center', padding: '4px 0', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px' }}>{msg.content}</div>
  );

  const isUser = msg.role === 'user';

  // Render basic markdown: **bold**, newlines, bullets
  const renderText = (text) => text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g).map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
    const isBullet = /^[•\-*] /.test(line);
    return (
      <div key={i} style={{ marginBottom: line === '' ? '7px' : '1px', paddingLeft: isBullet ? '14px' : 0, position: 'relative' }}>
        {isBullet && <span style={{ position: 'absolute', left: 0, color: styles.purpleBright, fontSize: '12px' }}>•</span>}
        <span>{isBullet ? parts.slice(1) : parts}</span>
      </div>
    );
  });

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '9px', gap: '7px', alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '4px', borderRadius: '50%', background: 'rgba(74,61,117,0.09)', border: '1px solid rgba(74,61,117,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>⬡</div>
      )}
      <div style={{
        maxWidth: '84%', padding: '9px 12px',
        background: isUser ? 'rgba(74,61,117,0.07)' : 'rgba(255,255,255,0.75)',
        border: `1px solid ${isUser ? 'rgba(74,61,117,0.14)' : styles.borderGlass}`,
        borderRadius: isUser ? '11px 3px 11px 11px' : '3px 11px 11px 11px',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}>
        <div style={{ fontSize: '13px', lineHeight: '1.65', color: styles.textPrimary, fontFamily: styles.sans }}>
          {renderText(msg.content)}
          {msg.streaming && <span style={{ display: 'inline-block', width: '2px', height: '13px', background: styles.purpleBright, marginLeft: '2px', verticalAlign: 'middle', animation: 'sa-blink 0.7s step-end infinite' }} />}
        </div>
      </div>
    </div>
  );
}

// ─── Quick chips ───────────────────────────────────────────────────────────────

function Chips({ role, onSend }) {
  const chips = role === 'admin'
    ? ["What needs my attention?", "Show pending apps", "Any interlocks offline?", "CAT-72 status?"]
    : ["What's my next step?", "How do I install the interlock?", "Where's my API key?", "How long does the test take?"];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '7px 11px 3px', borderTop: `1px solid ${styles.borderSubtle}` }}>
      {chips.map((chip, i) => (
        <button key={i} onClick={() => onSend(chip)} style={{
          padding: '4px 9px', background: 'rgba(74,61,117,0.05)', border: '1px solid rgba(74,61,117,0.15)',
          color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', cursor: 'pointer',
          borderRadius: '999px', whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,61,117,0.11)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,61,117,0.05)'}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

// ─── Main chatbot ──────────────────────────────────────────────────────────────

export default function SentinelChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [ctx, setCtx] = useState({});
  const [chips, setChips] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (open && !ready) loadCtx();
  }, [open]);

  const loadCtx = async () => {
    try {
      const [a, c, s] = await Promise.all([
        api.get('/api/applications/').catch(() => ({ data: [] })),
        api.get('/api/certificates/').catch(() => ({ data: [] })),
        api.get('/api/envelo/sessions').catch(() => ({ data: { sessions: [] } })),
      ]);
      const data = {
        applications: a.data?.applications || a.data || [],
        certificates:  c.data || [],
        sessions:      s.data?.sessions || [],
        activeTests:   (a.data?.applications || a.data || []).filter(x => x.state === 'testing'),
      };
      setCtx(data);
      setReady(true);
      setMsgs([{ role: 'assistant', content: buildGreeting(user, data) }]);
    } catch {
      setReady(true);
      setMsgs([{ role: 'assistant', content: `Hey${user?.full_name ? ' ' + user.full_name.split(' ')[0] : ''}! I'm your Sentinel Authority assistant. How can I help?` }]);
    }
  };

  const send = useCallback(async (text) => {
    const m = (text || input).trim();
    if (!m || busy) return;
    setInput('');
    setChips(false);

    const history = msgs
      .filter(x => (x.role === 'user' || x.role === 'assistant') && x.content && !x.streaming)
      .map(x => ({ role: x.role, content: x.content }));
    history.push({ role: 'user', content: m });

    setMsgs(prev => [...prev, { role: 'user', content: m }, { role: 'assistant', content: '', streaming: true }]);
    setBusy(true);

    const sys = buildSystemPrompt({ user, ...ctx });

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ system: sys, messages: history, stream: true }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const p = JSON.parse(raw);
            const delta = p.delta?.text || p.choices?.[0]?.delta?.content || p.content?.[0]?.text || '';
            if (delta) {
              acc += delta;
              setMsgs(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: acc, streaming: true }; return u; });
            }
          } catch (_) {}
        }
      }

      setMsgs(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: acc || 'Sorry, try again.', streaming: false }; return u; });

    } catch (err) {
      let errMsg = 'Connection error. Try again.';
      if (err.message?.includes('404')) errMsg = 'The /api/chat endpoint is not deployed yet. Add chat.py to Railway and set ANTHROPIC_API_KEY.';
      if (err.message?.includes('401')) errMsg = 'Auth error — try refreshing.';
      setMsgs(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: errMsg, streaming: false }; return u; });
    } finally {
      setBusy(false);
    }
  }, [input, busy, msgs, user, ctx]);

  const reset = () => { setMsgs([]); setReady(false); setCtx({}); setChips(true); setOpen(false); setTimeout(() => setOpen(true), 60); };

  return (
    <>
      <style>{`@keyframes sa-blink{0%,100%{opacity:1}50%{opacity:0}} @keyframes sa-up{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          style={{ position:'fixed', bottom:'24px', right:'24px', zIndex:1000, width:'50px', height:'50px', borderRadius:'50%', background:styles.purplePrimary, border:'1px solid rgba(100,80,160,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(74,61,117,0.35)', transition:'all 0.2s', fontSize:'22px', color:'#fff' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.07)';e.currentTarget.style.boxShadow='0 6px 28px rgba(74,61,117,0.5)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='0 4px 20px rgba(74,61,117,0.35)';}}
          title="Sentinel Assistant">⬡</button>
      )}

      {/* Panel */}
      {open && (
        <div style={{ position:'fixed', bottom:'24px', right:'24px', zIndex:1001, width:'min(390px, calc(100vw - 40px))', height:'min(570px, calc(100vh - 96px))', display:'flex', flexDirection:'column', background:'rgba(248,248,252,0.94)', backdropFilter:'blur(24px) saturate(1.5)', WebkitBackdropFilter:'blur(24px) saturate(1.5)', border:`1px solid ${styles.borderGlass}`, borderRadius:'16px', boxShadow:'0 12px 56px rgba(15,18,30,0.14), 0 2px 8px rgba(15,18,30,0.06)', animation:'sa-up 0.2s ease-out', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'13px 16px', borderBottom:`1px solid ${styles.borderSubtle}`, background:'rgba(255,255,255,0.55)', flexShrink:0 }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(74,61,117,0.08)', border:'1px solid rgba(74,61,117,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0 }}>⬡</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:styles.mono, fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', color:styles.textPrimary, fontWeight:500 }}>Sentinel Assistant</div>
              <div style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'2px' }}>
                <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:ready?styles.accentGreen:styles.accentAmber }} />
                <span style={{ fontFamily:styles.mono, fontSize:'9px', color:ready?styles.accentGreen:styles.accentAmber, letterSpacing:'0.5px' }}>{ready?'Ready':'Loading…'}</span>
              </div>
            </div>
            <button onClick={reset} title="Reset" style={{ background:'none', border:'none', cursor:'pointer', padding:'5px', color:styles.textTertiary, display:'flex' }}
              onMouseEnter={e=>e.currentTarget.style.color=styles.textSecondary} onMouseLeave={e=>e.currentTarget.style.color=styles.textTertiary}>
              <RotateCcw size={13} />
            </button>
            <button onClick={()=>setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:'5px', color:styles.textTertiary, display:'flex' }}
              onMouseEnter={e=>e.currentTarget.style.color=styles.textSecondary} onMouseLeave={e=>e.currentTarget.style.color=styles.textTertiary}>
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'13px 11px', display:'flex', flexDirection:'column' }}>
            {!ready && msgs.length === 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'12px', color:styles.textTertiary }}>
                <div style={{ width:'26px', height:'26px', border:`2px solid ${styles.borderGlass}`, borderTopColor:styles.purpleBright, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                <span style={{ fontFamily:styles.mono, fontSize:'11px', letterSpacing:'1px' }}>Loading your context…</span>
              </div>
            )}
            {msgs.map((msg, i) => <Msg key={i} msg={msg} />)}
          </div>

          {/* Chips */}
          {chips && msgs.length <= 1 && ready && <Chips role={user?.role} onSend={send} />}

          {/* Input */}
          <div style={{ padding:'10px', borderTop:`1px solid ${styles.borderSubtle}`, background:'rgba(255,255,255,0.45)', flexShrink:0 }}>
            <div style={{ display:'flex', gap:'7px', alignItems:'flex-end', background:'rgba(255,255,255,0.65)', border:`1px solid ${styles.borderGlass}`, borderRadius:'10px', padding:'7px 10px' }}>
              <textarea
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
                placeholder="Ask about your certification…" rows={1} disabled={busy}
                style={{ flex:1, background:'none', border:'none', outline:'none', resize:'none', fontFamily:styles.sans, fontSize:'13px', color:styles.textPrimary, lineHeight:'1.5', maxHeight:'72px', overflowY:'auto' }}
                onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,72)+'px'; }}
              />
              <button onClick={()=>send()} disabled={!input.trim()||busy}
                style={{ width:'29px', height:'29px', borderRadius:'6px', flexShrink:0, background:input.trim()&&!busy?styles.purplePrimary:'transparent', border:`1px solid ${input.trim()&&!busy?'transparent':styles.borderGlass}`, cursor:input.trim()&&!busy?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                {busy ? <div style={{ width:'13px', height:'13px', border:`2px solid ${styles.textTertiary}`, borderTopColor:styles.purpleBright, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> : <Send size={12} color={input.trim()?'#fff':styles.textTertiary} />}
              </button>
            </div>
            <div style={{ textAlign:'center', marginTop:'5px', fontFamily:styles.mono, fontSize:'9px', color:styles.textTertiary, letterSpacing:'0.3px' }}>Enter to send · Shift+Enter new line</div>
          </div>
        </div>
      )}
    </>
  );
}
