// components/CAT72Path.jsx — Sentinel Authority v4
// "Lightning Path" chevron tracker for the CAT-72 certification pipeline
// Replaces the basic ProgressBar on the CAT-72 Console and Application Detail pages
//
// Usage:
//   <CAT72Path currentStage="cat72" />
//   <CAT72Path currentStage="certified" compact />
//
// Stages (in order):
//   application → odd_review → envelo_deploy → cat72 → certified

import React from 'react';
import { styles } from '../config/styles';
import { CheckCircle2, Circle, Loader } from 'lucide-react';

// ── Stage definitions ─────────────────────────────────────────────────────────
const STAGES = [
  {
    key:         'application',
    label:       'Application',
    shortLabel:  'APP',
    description: 'Initial submission and documentation review',
  },
  {
    key:         'odd_review',
    label:       'ODD Review',
    shortLabel:  'ODD',
    description: 'Operational Design Domain boundary verification',
  },
  {
    key:         'envelo_deploy',
    label:       'ENVELO Deploy',
    shortLabel:  'ENV',
    description: 'ENVELO Interlock configuration and deployment',
  },
  {
    key:         'cat72',
    label:       'CAT-72',
    shortLabel:  '72H',
    description: '72-hour continuous conformance observation window',
    isActive:    true, // highlight this stage differently (timed)
  },
  {
    key:         'certified',
    label:       'Certified',
    shortLabel:  'CERT',
    description: 'ODDC Certificate issued',
  },
];

function getStageIndex(stageKey) {
  const k = (stageKey || '').toLowerCase().replace(/[\s-]/g, '_');
  // Alias mapping
  const aliases = {
    submitted:    'application',
    pending:      'application',
    review:       'odd_review',
    testing:      'cat72',
    active:       'certified',
    conformant:   'certified',
    issued:       'certified',
  };
  const resolved = aliases[k] || k;
  return STAGES.findIndex(s => s.key === resolved);
}

// ── Individual chevron stage ──────────────────────────────────────────────────
function ChevronStage({ stage, status, index, total, compact, onClick }) {
  // status: 'complete' | 'active' | 'pending'
  const isComplete = status === 'complete';
  const isActive   = status === 'active';
  const isPending  = status === 'pending';
  const isLast     = index === total - 1;

  const bgColor = isComplete
    ? 'rgba(22,135,62,0.10)'
    : isActive
      ? 'rgba(107,90,158,0.12)'
      : 'rgba(0,0,0,0.03)';

  const borderColor = isComplete
    ? 'rgba(22,135,62,0.30)'
    : isActive
      ? 'rgba(107,90,158,0.35)'
      : styles.borderGlass;

  const labelColor = isComplete
    ? styles.accentGreen
    : isActive
      ? styles.purpleBright
      : styles.textDim;

  const CLIP_SIZE = compact ? 10 : 14;  // chevron notch depth

  return (
    <div
      onClick={onClick}
      title={stage.description}
      style={{
        position:   'relative',
        flex:       1,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth:   0,
        cursor:     onClick ? 'pointer' : 'default',

        // Chevron shape via clip-path
        // All stages except last have a right-pointing notch
        // First stage has square left edge; others have left notch to receive previous chevron
        padding:    compact
          ? `8px ${CLIP_SIZE + 4}px 8px ${index === 0 ? 10 : CLIP_SIZE + 4}px`
          : `12px ${CLIP_SIZE + 8}px 12px ${index === 0 ? 16 : CLIP_SIZE + 8}px`,

        background:   bgColor,
        border:       `1px solid ${borderColor}`,
        borderRadius: index === 0
          ? `4px 0 0 4px`
          : isLast
            ? `0 4px 4px 0`
            : '0',
        marginRight: isLast ? 0 : '-1px',

        // Chevron cut: the right side of each non-last segment is clipped
        // and the left side of each non-first segment receives it
        clipPath: !isLast
          ? `polygon(0 0, calc(100% - ${CLIP_SIZE}px) 0, 100% 50%, calc(100% - ${CLIP_SIZE}px) 100%, 0 100%, ${index === 0 ? '0' : `${CLIP_SIZE}px`} 50%)`
          : index === 0
            ? 'none'
            : `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${CLIP_SIZE}px 50%)`,

        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <div style={{
        display:        'flex',
        flexDirection:  compact ? 'row' : 'column',
        alignItems:     'center',
        gap:            compact ? '5px' : '4px',
        textAlign:      'center',
      }}>
        {/* Icon */}
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          {isComplete
            ? <CheckCircle2 size={compact ? 12 : 14} color={styles.accentGreen} />
            : isActive
              ? <Loader size={compact ? 12 : 14} color={styles.purpleBright}
                  style={{ animation: 'spin 2s linear infinite' }} />
              : <Circle size={compact ? 12 : 14} color={styles.textDim} />
          }
        </span>

        {/* Label */}
        <span style={{
          fontFamily:    styles.mono,
          fontSize:      compact ? '9px' : '10px',
          fontWeight:    isActive ? 700 : isComplete ? 600 : 400,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color:         labelColor,
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          maxWidth:      compact ? '52px' : '80px',
        }}>
          {compact ? stage.shortLabel : stage.label}
        </span>

        {/* Active badge */}
        {isActive && stage.isActive && !compact && (
          <span style={{
            fontFamily:  styles.mono,
            fontSize:    '8px',
            fontWeight:  700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color:       '#fff',
            background:  styles.purpleBright,
            borderRadius:'2px',
            padding:     '1px 5px',
            lineHeight:  '14px',
          }}>
            LIVE
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CAT72Path({
  currentStage = '',
  compact      = false,
  onStageClick,
  style:       overrideStyle = {},
}) {
  const activeIndex = getStageIndex(currentStage);

  return (
    <div style={{ width: '100%', ...overrideStyle }}>
      {/* Track label */}
      {!compact && (
        <div style={{
          fontFamily:    styles.mono,
          fontSize:      '9px',
          fontWeight:    600,
          letterSpacing: '2.5px',
          textTransform: 'uppercase',
          color:         styles.textDim,
          marginBottom:  styles.spacing.xs,
        }}>
          Certification Path
        </div>
      )}

      {/* Chevron row */}
      <div style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
        {STAGES.map((stage, i) => {
          const status = i < activeIndex
            ? 'complete'
            : i === activeIndex
              ? 'active'
              : 'pending';
          return (
            <ChevronStage
              key={stage.key}
              stage={stage}
              status={status}
              index={i}
              total={STAGES.length}
              compact={compact}
              onClick={onStageClick ? () => onStageClick(stage, i, status) : undefined}
            />
          );
        })}
      </div>

      {/* Active stage description (full mode only) */}
      {!compact && activeIndex >= 0 && (
        <div style={{
          marginTop:  styles.spacing.xs,
          fontFamily: styles.mono,
          fontSize:   '11px',
          color:      styles.textTertiary,
          letterSpacing: '0.04em',
        }}>
          <strong style={{ color: styles.purpleBright }}>
            {STAGES[activeIndex]?.label}
          </strong>
          {' — '}
          {STAGES[activeIndex]?.description}
        </div>
      )}

      {/* Spinner keyframe (injected once) */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
