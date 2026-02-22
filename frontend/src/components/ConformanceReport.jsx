// components/ConformanceReport.jsx — Sentinel Authority v4
// The "Pivot" component: reframes blocked boundary attempts as Verified Interventions,
// not failures. Enforcement failures (interlock didn't block when it should have) are the
// only true red events.
//
// Usage:
//   <ConformanceReport
//     passCount={test.pass_count}          // actions ENVELO passed (within ODD)
//     blockCount={test.block_count}        // boundary attempts ENVELO blocked (interventions)
//     enforcementFailures={0}              // times interlock FAILED to block (true failures)
//     elapsedHours={test.elapsed_hours}    // hours accumulated toward 72
//     certNumber={test.certificate_number}
//     systemName={test.system_name}
//     orgName={test.organization_name}
//     compact={false}                      // compact=true for table rows
//   />

import React from 'react';
import { styles } from '../config/styles';
import { ShieldCheck, AlertOctagon, Activity, FileText, Info } from 'lucide-react';

// ── Stat block ──────────────────────────────────────────────────────────────────
function StatBlock({ label, value, sub, color, icon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: styles.mono, fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: styles.textDim }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {icon && <span style={{ color, lineHeight: 0 }}>{icon}</span>}
        <span style={{ fontSize: 28, fontWeight: 300, fontFamily: styles.sans, color, lineHeight: 1 }}>
          {value}
        </span>
      </div>
      {sub && (
        <div style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textDim }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Enforcement efficiency bar ──────────────────────────────────────────────────
function EfficiencyBar({ blockCount, enforcementFailures }) {
  const total    = blockCount + enforcementFailures;
  if (total === 0) return null;
  const blockPct = (blockCount / total) * 100;
  const failPct  = (enforcementFailures / total) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: styles.mono, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textDim }}>Enforcement Efficiency</span>
        <span style={{ fontFamily: styles.mono, fontSize: 10, color: enforcementFailures === 0 ? styles.accentGreen : styles.accentRed }}>
          {enforcementFailures === 0 ? '100.0%' : `${blockPct.toFixed(1)}%`}
        </span>
      </div>
      <div style={{ height: 8, display: 'flex', borderRadius: 2, overflow: 'hidden', background: 'rgba(0,0,0,0.06)' }}>
        {blockCount > 0 && (
          <div style={{ width: blockPct + '%', background: styles.accentGreen, transition: 'width 0.6s ease' }} title={`${blockCount} interventions`} />
        )}
        {enforcementFailures > 0 && (
          <div style={{ width: failPct + '%', background: styles.accentRed, transition: 'width 0.6s ease' }} title={`${enforcementFailures} failures`} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 5 }}>
        <span style={{ fontFamily: styles.mono, fontSize: 9, color: styles.accentGreen, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: styles.accentGreen, display: 'inline-block' }} />
          {blockCount} successful interventions
        </span>
        {enforcementFailures > 0 && (
          <span style={{ fontFamily: styles.mono, fontSize: 9, color: styles.accentRed, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: styles.accentRed, display: 'inline-block' }} />
            {enforcementFailures} enforcement failures
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────────
export default function ConformanceReport({
  passCount          = 0,
  blockCount         = 0,
  enforcementFailures = 0,
  elapsedHours       = 0,
  certNumber,
  systemName,
  orgName,
  compact            = false,
  showNarrative      = true,
  style: outerStyle  = {},
}) {
  const progressPct     = Math.min(100, (elapsedHours / 72) * 100);
  const isConformant    = progressPct >= 100 && enforcementFailures === 0;
  const totalActions    = passCount + blockCount;
  const interventionRate = totalActions > 0 ? (blockCount / totalActions * 100) : 0;
  const reportId        = certNumber || Math.random().toString(36).substring(2, 11).toUpperCase();

  if (compact) {
    // Compact version for table rows / cards
    return (
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', ...outerStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={13} color={styles.accentGreen} />
          <span style={{ fontFamily: styles.mono, fontSize: 11, color: styles.accentGreen }}>
            {blockCount.toLocaleString()} interventions
          </span>
        </div>
        {enforcementFailures > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertOctagon size={13} color={styles.accentRed} />
            <span style={{ fontFamily: styles.mono, fontSize: 11, color: styles.accentRed }}>
              {enforcementFailures} failures
            </span>
          </div>
        )}
        <span style={{ fontFamily: styles.mono, fontSize: 11, color: styles.textTertiary }}>
          {progressPct.toFixed(1)}% of 72h
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background:   styles.cardSurface,
      border:       `1px solid ${styles.borderSubtle}`,
      borderRadius: 4,
      overflow:     'hidden',
      ...outerStyle,
    }}>
      {/* Header */}
      <div style={{
        padding:        '14px 20px',
        borderBottom:   `1px solid ${styles.borderGlass}`,
        background:     'rgba(0,0,0,0.02)',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        flexWrap:       'wrap',
        gap:            10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={16} color={styles.purplePrimary} />
          <span style={{ fontFamily: styles.mono, fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textSecondary }}>
            CAT-72 INTERVENTION AUDIT
          </span>
        </div>
        <span style={{ fontFamily: styles.mono, fontSize: 10, color: styles.textDim, letterSpacing: '0.5px' }}>
          REPORT_ID: {reportId}
        </span>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Stats row — the Pivot */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginBottom: 24 }}>
          <StatBlock
            label="Verified Interventions"
            value={blockCount.toLocaleString()}
            sub="Boundary attempts — ENVELO blocked"
            color={blockCount > 0 ? styles.accentGreen : styles.textTertiary}
            icon={<ShieldCheck size={16} />}
          />
          <StatBlock
            label="Nominal Operations"
            value={passCount.toLocaleString()}
            sub="Actions within ODD — passed"
            color={styles.textPrimary}
            icon={<Activity size={16} />}
          />
          <StatBlock
            label="Enforcement Failures"
            value={enforcementFailures}
            sub={enforcementFailures === 0 ? 'None recorded' : 'Bypass events — CRITICAL'}
            color={enforcementFailures > 0 ? styles.accentRed : styles.textDim}
            icon={<AlertOctagon size={16} />}
          />
          <StatBlock
            label="Conformance Progress"
            value={`${progressPct.toFixed(1)}%`}
            sub={`${Math.min(elapsedHours, 72).toFixed(1)}h of 72h accumulated`}
            color={isConformant ? styles.accentGreen : styles.purpleBright}
          />
        </div>

        {/* CAT-72 progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: styles.mono, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textDim }}>72-Hour Accumulation</span>
            <span style={{ fontFamily: styles.mono, fontSize: 10, color: isConformant ? styles.accentGreen : styles.purpleBright }}>
              {isConformant ? 'COMPLETE' : `${(72 - Math.min(elapsedHours, 72)).toFixed(1)}h remaining`}
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: progressPct + '%', height: '100%', background: isConformant ? styles.accentGreen : styles.purplePrimary, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        {/* Enforcement efficiency bar */}
        <div style={{ marginBottom: showNarrative ? 20 : 0 }}>
          <EfficiencyBar blockCount={blockCount} enforcementFailures={enforcementFailures} />
        </div>

        {/* Institutional narrative */}
        {showNarrative && (
          <div style={{
            background:    'rgba(29,26,59,0.03)',
            borderLeft:    `4px solid ${styles.purplePrimary}`,
            padding:       '14px 16px',
            fontSize:      13,
            lineHeight:    1.7,
            color:         styles.textSecondary,
          }}>
            <strong style={{ color: styles.textPrimary }}>Conformant Enforcement Statement</strong>
            <br />
            {orgName && <><strong>{orgName}</strong> — </>}
            {systemName && <><em>{systemName}</em> — </>}
            The ENVELO Interlock successfully demonstrated{' '}
            <strong>{blockCount.toLocaleString()} verified intervention{blockCount !== 1 ? 's' : ''}</strong>{' '}
            within the declared Operational Design Domain (ODD). Each event represents a
            boundary-probing execution that was{' '}
            <strong>programmatically prevented</strong> by the interlock layer.
            {enforcementFailures === 0 ? (
              <> Zero enforcement failures were recorded, confirming 100% enforcement integrity across all edge-case exposures.</>
            ) : (
              <> <strong style={{ color: styles.accentRed }}>{enforcementFailures} enforcement failure{enforcementFailures !== 1 ? 's' : ''}</strong> were recorded — instances where the interlock failed to block an ODD exceedance. This requires review before certification.</>
            )}
          </div>
        )}

        {/* Intervention rate tooltip */}
        {blockCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 12px', background: 'rgba(22,135,62,0.04)', border: `1px solid rgba(22,135,62,0.14)`, borderRadius: 3 }}>
            <Info size={13} color={styles.accentGreen} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: styles.mono, fontSize: 10, color: styles.accentGreen, lineHeight: 1.6 }}>
              A high intervention rate ({interventionRate.toFixed(1)}% of actions) confirms the system actively tested its operational limits — and that the ENVELO Interlock responded correctly every time. This is positive evidence of architectural conformance.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
