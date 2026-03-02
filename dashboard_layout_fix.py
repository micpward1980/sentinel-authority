import os

BASE = os.path.expanduser('~/Downloads/sentinel-authority')
path = os.path.join(BASE, 'frontend/src/pages/DashboardPage.jsx')

with open(path) as f:
    code = f.read()

# ── 1. Replace the two-column Portfolio + Pipeline row ──

old_row = """      {/* ── Row 1: Portfolio Health + Pipeline Funnel ─────────────────────── */}
      <div style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: '16px', marginBottom: '24px'}}>

        {/* Portfolio Donut */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Certificate Portfolio', null, '/certificates', 'Registry →')}
          <div style={{display: 'flex', alignItems: 'center', gap: '24px'}}>
            <DonutChart data={[
              { label: 'Conformant', value: portfolio.conformant, color: styles.accentGreen },
              { label: 'Expiring 30d', value: portfolio.expiringSoon, color: styles.accentAmber },
              { label: 'Suspended', value: portfolio.suspended, color: styles.accentRed },
              { label: 'Expired', value: portfolio.expired, color: styles.textDim },
            ]} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', flex: 1}}>
              {[
                { label: 'Conformant', value: portfolio.conformant, color: styles.accentGreen },
                { label: 'Expiring < 30d', value: portfolio.expiringSoon, color: styles.accentAmber },
                { label: 'Suspended', value: portfolio.suspended, color: styles.accentRed },
                { label: 'Expired', value: portfolio.expired, color: styles.textDim },
              ].map(row => (
                <div key={row.label} style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '2px', background: row.color, flexShrink: 0}} />
                  <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, flex: 1, letterSpacing: '0.5px'}}>{row.label}</span>
                  <span style={{fontFamily: styles.mono, fontSize: '13px', fontWeight: 600, color: row.value > 0 ? row.color : styles.textDim}}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Application Pipeline', null, '/applications', 'All Applications →')}
          <PipelineBar />
          {(pipelineCounts.suspended + pipelineCounts.rejected) > 0 && (
            <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid ' + styles.borderSubtle, display: 'flex', gap: '16px'}}>
              {pipelineCounts.suspended > 0 && <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.accentRed}}>{pipelineCounts.suspended} suspended</span>}
              {pipelineCounts.rejected > 0 && <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{pipelineCounts.rejected} rejected</span>}
            </div>
          )}
        </div>
      </div>"""

new_row = """      {/* ── Row 1: Portfolio Health + Expiration Timeline ────────────────── */}
      <div style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '24px'}}>

        {/* Portfolio Donut + Compact Pipeline */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Certificate Portfolio', null, '/certificates', 'Registry →')}
          <div style={{display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px'}}>
            <DonutChart data={[
              { label: 'Conformant', value: portfolio.conformant, color: styles.accentGreen },
              { label: 'Expiring 30d', value: portfolio.expiringSoon, color: styles.accentAmber },
              { label: 'Suspended', value: portfolio.suspended, color: styles.accentRed },
              { label: 'Expired', value: portfolio.expired, color: styles.textDim },
            ]} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', flex: 1}}>
              {[
                { label: 'Conformant', value: portfolio.conformant, color: styles.accentGreen },
                { label: 'Expiring < 30d', value: portfolio.expiringSoon, color: styles.accentAmber },
                { label: 'Suspended', value: portfolio.suspended, color: styles.accentRed },
                { label: 'Expired', value: portfolio.expired, color: styles.textDim },
              ].map(row => (
                <div key={row.label} style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '2px', background: row.color, flexShrink: 0}} />
                  <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textTertiary, flex: 1, letterSpacing: '0.5px'}}>{row.label}</span>
                  <span style={{fontFamily: styles.mono, fontSize: '13px', fontWeight: 600, color: row.value > 0 ? row.color : styles.textDim}}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Compact pipeline flow */}
          <div style={{borderTop: '1px solid ' + styles.borderSubtle, paddingTop: '16px'}}>
            <div style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textDim, marginBottom: '10px'}}>Pipeline</div>
            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
              {[
                { label: 'New', count: pipelineCounts.pending + pipelineCounts.under_review, color: styles.accentAmber },
                { label: 'Accepted', count: pipelineCounts.approved, color: 'rgba(29,26,59,0.5)' },
                { label: 'Interlock', count: pipelineCounts.observe, color: 'rgba(29,26,59,0.5)' },
                { label: 'Boundaries', count: pipelineCounts.bounded, color: 'rgba(29,26,59,0.5)' },
                { label: 'CAT-72', count: pipelineCounts.testing, color: styles.purpleBright },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <span style={{color: styles.textDim, fontSize: '10px', margin: '0 2px'}}>→</span>}
                  <div style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: s.count > 0 ? s.color + '10' : 'transparent', border: s.count > 0 ? '1px solid ' + s.color + '30' : '1px solid ' + styles.borderSubtle, borderRadius: '3px'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '12px', fontWeight: 600, color: s.count > 0 ? s.color : styles.textDim}}>{s.count}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '8px', letterSpacing: '0.5px', color: styles.textDim, textTransform: 'uppercase'}}>{s.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {(pipelineCounts.suspended + pipelineCounts.rejected) > 0 && (
              <div style={{marginTop: '8px', display: 'flex', gap: '12px'}}>
                {pipelineCounts.suspended > 0 && <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.accentRed}}>{pipelineCounts.suspended} suspended</span>}
                {pipelineCounts.rejected > 0 && <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{pipelineCounts.rejected} rejected</span>}
              </div>
            )}
          </div>
        </div>

        {/* Expiration Timeline — promoted to row 1 */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Expiration Timeline (90d)', expirationTimeline.length > 0 ? styles.accentAmber : styles.textTertiary, '/certificates', 'Registry →')}
          {expirationTimeline.length === 0 ? (
            <div style={{padding: '40px 0', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim}}>No certificates expiring in 90 days</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              {expirationTimeline.slice(0, 8).map(c => {
                const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
                const urgent = daysLeft <= 14;
                const critical = daysLeft <= 7;
                return (
                  <Link key={c.id} to={c.application_id ? '/applications/' + c.application_id : '/certificates'} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + styles.borderSubtle, textDecoration: 'none', gap: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0}}>
                      <div style={{width: '6px', height: '6px', borderRadius: '50%', background: critical ? styles.accentRed : urgent ? styles.accentAmber : styles.textDim, flexShrink: 0}} />
                      <span style={{fontSize: '13px', color: styles.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.system_name}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{c.organization_name}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0}}>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 500, color: critical ? styles.accentRed : urgent ? styles.accentAmber : styles.textTertiary}}>{daysLeft}d</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{c.certificate_number}</span>
                    </div>
                  </Link>
                );
              })}
              {expirationTimeline.length > 8 && (
                <Link to="/certificates" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px', padding: '8px 0', textAlign: 'center'}}>+{expirationTimeline.length - 8} more →</Link>
              )}
            </div>
          )}
        </div>
      </div>"""

code = code.replace(old_row, new_row)

# ── 2. Remove the old standalone expiration timeline section ──
old_timeline = """      {/* ── Row 3: Active Tests + Expiration Timeline ────────────────────── */}
      <div style={{display: 'grid', gridTemplateColumns: activeTests.length > 0 ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: '16px', marginBottom: '24px'}}>

        {/* Active Tests */}
        {activeTests.length > 0 && (
          <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
            {sectionHeader(`Active Tests (${activeTests.length})`, styles.purpleBright, '/cat72', 'Console →')}
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {activeTests.map(test => {
                const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
                const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
                return (
                  <div key={test.id}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                      <span style={{fontSize: '13px', fontWeight: 500, color: styles.textPrimary}}>{test.system_name}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, color: pct >= 100 ? styles.accentGreen : styles.purpleBright}}>{pct}%</span>
                    </div>
                    <div style={{height: '4px', background: 'rgba(0,0,0,0.04)', marginBottom: '4px'}}>
                      <div style={{width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? styles.accentGreen : styles.purpleBright, transition: 'width 0.5s ease'}} />
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{test.organization_name}</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{hoursLeft}h left</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expiration Timeline */}
        <div style={{background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader('Expiration Timeline (90d)', expirationTimeline.length > 0 ? styles.accentAmber : styles.textTertiary, '/certificates', 'Registry →')}
          {expirationTimeline.length === 0 ? (
            <div style={{padding: '20px 0', textAlign: 'center', fontFamily: styles.mono, fontSize: '11px', color: styles.textDim}}>No certificates expiring in 90 days</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              {expirationTimeline.slice(0, 6).map(c => {
                const daysLeft = Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24));
                const urgent = daysLeft <= 14;
                const critical = daysLeft <= 7;
                return (
                  <Link key={c.id} to={c.application_id ? '/applications/' + c.application_id : '/certificates'} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + styles.borderSubtle, textDecoration: 'none', gap: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0}}>
                      <div style={{width: '6px', height: '6px', borderRadius: '50%', background: critical ? styles.accentRed : urgent ? styles.accentAmber : styles.textDim, flexShrink: 0}} />
                      <span style={{fontSize: '13px', color: styles.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.system_name}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0}}>
                      <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 500, color: critical ? styles.accentRed : urgent ? styles.accentAmber : styles.textTertiary}}>{daysLeft}d</span>
                      <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{c.certificate_number}</span>
                    </div>
                  </Link>
                );
              })}
              {expirationTimeline.length > 6 && (
                <Link to="/certificates" style={{fontFamily: styles.mono, fontSize: '10px', color: styles.purpleBright, textDecoration: 'none', letterSpacing: '1px', padding: '8px 0', textAlign: 'center'}}>+{expirationTimeline.length - 6} more →</Link>
              )}
            </div>
          )}
        </div>
      </div>"""

# Replace with just active tests (standalone, only when present)
new_tests = """      {/* ── Active Tests (auto-hides when empty) ─────────────────────────── */}
      {activeTests.length > 0 && (
        <div style={{marginBottom: '24px', background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, padding: '24px'}}>
          {sectionHeader(`Active Tests (${activeTests.length})`, styles.purpleBright, '/cat72', 'Console →')}
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {activeTests.map(test => {
              const pct = Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100);
              const hoursLeft = Math.max(0, ((test.duration_hours * 3600) - test.elapsed_seconds) / 3600).toFixed(1);
              return (
                <div key={test.id}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                    <span style={{fontSize: '13px', fontWeight: 500, color: styles.textPrimary}}>{test.system_name}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '11px', fontWeight: 600, color: pct >= 100 ? styles.accentGreen : styles.purpleBright}}>{pct}%</span>
                  </div>
                  <div style={{height: '4px', background: 'rgba(0,0,0,0.04)', marginBottom: '4px'}}>
                    <div style={{width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? styles.accentGreen : styles.purpleBright, transition: 'width 0.5s ease'}} />
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{test.organization_name}</span>
                    <span style={{fontFamily: styles.mono, fontSize: '10px', color: styles.textDim}}>{hoursLeft}h left</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}"""

code = code.replace(old_timeline, new_tests)

# ── 3. Remove PipelineBar component (no longer needed) ──
old_pipeline_bar = """  // Pipeline bar
  const PipelineBar = () => {
    const stages = [
      { key: 'pending', label: 'Submitted', count: pipelineCounts.pending + pipelineCounts.under_review },
      { key: 'approved', label: 'Accepted', count: pipelineCounts.approved },
      { key: 'observe', label: 'Interlock', count: pipelineCounts.observe },
      { key: 'bounded', label: 'Boundaries', count: pipelineCounts.bounded },
      { key: 'testing', label: 'CAT-72', count: pipelineCounts.testing },
    ];
    const maxCount = Math.max(...stages.map(s => s.count), 1);
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
        {stages.map(s => (
          <div key={s.key} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <div style={{width: '72px', fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.5px', color: styles.textTertiary, textAlign: 'right', textTransform: 'uppercase', flexShrink: 0}}>{s.label}</div>
            <div style={{flex: 1, height: '20px', background: 'rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden'}}>
              <div style={{width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 8 : 0)}%`, height: '100%', background: s.key === 'conformant' ? styles.accentGreen : s.key === 'testing' ? styles.purpleBright : s.key === 'pending' ? styles.accentAmber : 'rgba(29,26,59,0.15)', transition: 'width 0.4s ease'}} />
            </div>
            <span style={{fontFamily: styles.mono, fontSize: '12px', fontWeight: 600, color: s.count > 0 ? styles.textPrimary : styles.textDim, width: '24px', textAlign: 'right', flexShrink: 0}}>{s.count}</span>
          </div>
        ))}
      </div>
    );
  };"""

code = code.replace(old_pipeline_bar, '')

with open(path, 'w') as f:
    f.write(code)

print('Done:')
print('  ✓ Portfolio card now includes compact pipeline flow')
print('  ✓ Expiration timeline promoted to row 1')
print('  ✓ Active tests standalone section')
print('  ✓ Removed PipelineBar component')
