import React from 'react';

const V = {
  green:  { bc: 'rgba(92,214,133,.22)',  c: 'rgba(92,214,133,.90)',  bg: 'rgba(92,214,133,.06)',  dot: '#5CD685' },
  amber:  { bc: 'rgba(214,160,92,.22)',  c: 'rgba(214,160,92,.95)',  bg: 'rgba(214,160,92,.06)',  dot: '#D6A05C' },
  red:    { bc: 'rgba(214,92,92,.22)',   c: 'rgba(214,92,92,.95)',   bg: 'rgba(214,92,92,.06)',   dot: '#D65C5C' },
};
const ALIAS = { active:'green', conformant:'green', approved:'green', passed:'green', pending:'amber', bounded:'amber', review:'amber', warning:'amber', revoked:'red', suspended:'red', failed:'red', error:'red' };
const DEF = { bc: 'rgba(255,255,255,.14)', c: 'rgba(255,255,255,.80)', bg: 'rgba(255,255,255,.03)', dot: 'rgba(255,255,255,.40)' };

export default function StatusBadge({ status = '', label, children, showDot = true }) {
  const k = status.toLowerCase().replace(/[^a-z]/g, '');
  const v = V[k] || V[ALIAS[k]] || DEF;
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', padding: '6px 8px', borderRadius: '999px', border: '1px solid '+v.bc, color: v.c, background: v.bg, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {showDot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: v.dot, flexShrink: 0 }} />}
      {label || children || status}
    </span>
  );
}
