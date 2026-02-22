// components/TelemetryLog.jsx — Sentinel Authority v4
// Dark terminal telemetry stream.
// Features:
//   - Auto-scrolls to bottom on new entries
//   - Freezes scroll on VIOLATION so operator can inspect
//   - "Audit flash" highlight when a hash-chain record is written
//   - Accepts real telemetry records OR generates demo stream if none provided

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { styles } from '../config/styles';
import { Activity, PauseCircle } from 'lucide-react';

// ── Color map for log line types ──────────────────────────────────────────────
const TYPE_STYLE = {
  PASS:      { tag: '#4ade80', bg: 'transparent',              border: 'transparent' },
  BLOCK:     { tag: '#f87171', bg: 'rgba(248,113,113,0.08)',   border: '#f87171' },
  VIOLATION: { tag: '#f87171', bg: 'rgba(248,113,113,0.12)',   border: '#f87171' },
  WARNING:   { tag: '#fbbf24', bg: 'rgba(251,191,36,0.06)',    border: '#fbbf24' },
  HASH:      { tag: '#a78bfa', bg: 'rgba(167,139,250,0.06)',   border: 'transparent' },
  INFO:      { tag: '#60a5fa', bg: 'transparent',              border: 'transparent' },
  SYSTEM:    { tag: '#888',    bg: 'transparent',              border: 'transparent' },
};

function fmtTs(ts) {
  try {
    return new Date(ts).toISOString().replace('T', ' ').substring(0, 19) + 'Z';
  } catch {
    return String(ts);
  }
}

function getType(record) {
  if (!record) return 'INFO';
  const r = record.result || record.type || record.event_type || '';
  if (r === 'pass' || r === 'PASS') return 'PASS';
  if (r === 'block' || r === 'BLOCK' || r === 'violation' || r === 'VIOLATION') return 'VIOLATION';
  if (r === 'warning' || r === 'WARNING') return 'WARNING';
  if (r === 'hash' || r === 'HASH' || record.hash) return 'HASH';
  return 'INFO';
}

function buildMessage(record) {
  const type = getType(record);
  if (type === 'HASH') {
    const h = record.hash || record.record_hash || '';
    return `CHAIN_WRITE ${h ? h.substring(0, 16) + '...' : 'OK'} — tamper-evident record sealed`;
  }
  if (type === 'VIOLATION' || type === 'BLOCK') {
    return `${record.boundary_name || record.action_type || 'BOUNDARY'} — ${record.violation_message || record.message || 'LIMIT_EXCEEDED'}`;
  }
  if (type === 'PASS') {
    return `${record.action_type || 'ACTION'} — WITHIN_ENVELOPE (${record.execution_time_ms != null ? record.execution_time_ms + 'ms' : 'OK'})`;
  }
  return record.message || record.event_type || JSON.stringify(record).substring(0, 80);
}

// ── Demo stream (fires when no real records provided) ─────────────────────────
const DEMO_TEMPLATES = [
  { result: 'pass',      action_type: 'VELOCITY_CHECK',   execution_time_ms: 2  },
  { result: 'pass',      action_type: 'GEO_BOUNDARY',      execution_time_ms: 1  },
  { result: 'pass',      action_type: 'SENSOR_FUSION',     execution_time_ms: 4  },
  { result: 'pass',      action_type: 'ODD_CONFORMANCE',   execution_time_ms: 3  },
  { result: 'warning',   action_type: 'PROXIMITY_CHECK',   message: 'GEO_PROXIMITY 88% of limit' },
  { result: 'pass',      action_type: 'ENVELO_HEARTBEAT',  execution_time_ms: 1  },
  { result: 'hash',      hash: null,                        message: '' },
];

function makeDemoRecord(i) {
  const t = DEMO_TEMPLATES[i % DEMO_TEMPLATES.length];
  return {
    ...t,
    timestamp: new Date().toISOString(),
    hash: t.result === 'hash' ? Math.random().toString(16).substring(2, 18) : undefined,
    id: Math.random().toString(36).substring(2, 10),
    _isDemo: true,
  };
}

// ── LogLine ───────────────────────────────────────────────────────────────────
function LogLine({ record, flash }) {
  const type = getType(record);
  const cfg  = TYPE_STYLE[type] || TYPE_STYLE.INFO;
  const msg  = buildMessage(record);

  return (
    <div style={{
      display:     'flex',
      gap:         '12px',
      marginBottom:'3px',
      borderLeft:  `2px solid ${cfg.border === 'transparent' ? 'transparent' : cfg.border}`,
      paddingLeft: '8px',
      background:  flash ? 'rgba(167,139,250,0.15)' : cfg.bg,
      transition:  flash ? 'background 0.4s ease' : 'background 0.1s ease',
      paddingTop:  '2px',
      paddingBottom:'2px',
    }}>
      <span style={{ fontFamily: styles.mono, fontSize: '10px', color: '#444', minWidth: '160px', flexShrink: 0 }}>
        {fmtTs(record.timestamp)}
      </span>
      <span style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 700, color: cfg.tag, minWidth: '80px', flexShrink: 0 }}>
        [{type}]
      </span>
      <span style={{ fontFamily: styles.mono, fontSize: '10px', color: type === 'VIOLATION' || type === 'BLOCK' ? '#fca5a5' : '#c8c8c8', flex: 1, wordBreak: 'break-all' }}>
        {msg}
      </span>
    </div>
  );
}

// ── TelemetryLog ──────────────────────────────────────────────────────────────
export default function TelemetryLog({
  records = [],       // real records from API — array of telemetry objects
  demo    = false,    // force demo mode
  maxLines = 200,     // cap lines kept in memory
}) {
  const useDemo        = demo || records.length === 0;
  const [lines, setLines]   = useState([]);
  const [frozen, setFrozen] = useState(false);  // freeze on violation
  const [flashId, setFlashId] = useState(null); // line id to flash
  const [counter, setCounter] = useState(0);    // demo tick
  const scrollRef      = useRef(null);
  const frozenRef      = useRef(false);

  frozenRef.current = frozen;

  // Demo mode: add a new record every 1.2s
  useEffect(() => {
    if (!useDemo) return;
    const iv = setInterval(() => {
      setCounter(c => c + 1);
    }, 1200);
    return () => clearInterval(iv);
  }, [useDemo]);

  useEffect(() => {
    if (!useDemo) return;
    const rec = makeDemoRecord(counter);
    addLine(rec);
  }, [counter]);

  // Real records mode: diff incoming records into lines
  useEffect(() => {
    if (useDemo || records.length === 0) return;
    setLines(records.slice(-maxLines).map(r => ({ ...r, id: r.id || r.action_id || Math.random().toString(36) })));
  }, [records, useDemo]);

  const addLine = useCallback((rec) => {
    const id = rec.id || Math.random().toString(36).substring(2, 10);
    const newRec = { ...rec, id };
    const type = getType(newRec);

    // Hash write: trigger flash
    if (type === 'HASH') {
      setFlashId(id);
      setTimeout(() => setFlashId(null), 500);
    }

    // Violation: freeze scroll
    if (type === 'VIOLATION' || type === 'BLOCK') {
      frozenRef.current = true;
      setFrozen(true);
    }

    setLines(prev => {
      const next = [...prev, newRec];
      return next.length > maxLines ? next.slice(-maxLines) : next;
    });
  }, [maxLines]);

  // Auto-scroll unless frozen
  useEffect(() => {
    if (!frozenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const resume = () => { setFrozen(false); frozenRef.current = false; };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding:      '10px 14px',
        borderBottom: '1px solid #1a1f2e',
        display:      'flex',
        justifyContent:'space-between',
        alignItems:   'center',
        flexShrink:   0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={13} color="#4ade80" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', color: '#4ade80', textTransform: 'uppercase' }}>
            LIVE TELEMETRY STREAM
          </span>
          {useDemo && (
            <span style={{ fontFamily: styles.mono, fontSize: '9px', color: '#555', letterSpacing: '1px' }}>DEMO</span>
          )}
        </div>
        {frozen && (
          <button
            onClick={resume}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.40)', color: '#f87171', fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '3px 8px', borderRadius: '2px' }}
          >
            <PauseCircle size={10} />
            FROZEN — CLICK TO RESUME
          </button>
        )}
      </div>

      {/* Log stream */}
      <div
        ref={scrollRef}
        style={{
          flex:      1,
          overflowY: 'auto',
          padding:   '10px 14px',
          background:'#0b0e17',
        }}
      >
        {lines.length === 0 && (
          <div style={{ fontFamily: styles.mono, fontSize: '11px', color: '#333', paddingTop: '20px' }}>
            Awaiting telemetry...
          </div>
        )}
        {lines.map((rec) => (
          <LogLine key={rec.id} record={rec} flash={flashId === rec.id} />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
