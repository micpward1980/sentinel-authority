import { styles } from '../config/styles';
import React from 'react';

const V = {
  green:  { bc: 'rgba(22,135,62,.22)',  c: 'rgba(22,135,62,.90)',  bg: 'rgba(22,135,62,.06)',  dot: 'rgba(22,135,62,1.00)' },
  amber:  { bc: 'rgba(158,110,18,.22)',  c: 'rgba(158,110,18,.95)',  bg: 'rgba(158,110,18,.06)',  dot: 'rgba(158,110,18,1.00)' },
  red:    { bc: 'rgba(180,52,52,.22)',   c: 'rgba(180,52,52,.95)',   bg: 'rgba(180,52,52,.06)',   dot: 'rgba(180,52,52,1.00)' },
};
const ALIAS = { active:'green', conformant:'green', approved:'green', passed:'green', pending:'amber', bounded:'amber', review:'amber', warning:'amber', revoked:'red', suspended:'red', failed:'red', error:'red' };
const DEF = { bc: 'rgba(0,0,0,.09)', c: 'rgba(15,18,30,.64)', bg: 'transparent', dot: 'rgba(15,18,30,.40)' };

export default function StatusBadge({ status = '', label, children, showDot = true }) {
  const k = status.toLowerCase().replace(/[^a-z]/g, '');
  const v = V[k] || V[ALIAS[k]] || DEF;
  return (
    <span data-badge="true" style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', padding: '6px 10px', borderRadius: '999px', border: '1px solid '+v.bc, color: v.c, background: v.bg, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {showDot && <span data-dot="true" style={{ width: '4px', height: '4px', borderRadius: '50%', background: v.dot, flexShrink: 0 }} />}
      {label || children || status}
    </span>
  );
}
