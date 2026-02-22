export const processAuditTrail = (logs = []) => {
  const summary = {
    total_exposure_seconds: 0,
    successful_interventions: 0,
    enforcement_failures: 0,
    boundary_proximity_events: 0,
    integrity_status: 'VALIDATED',
  };

  let lastTimestamp = null;
  const GAP_THRESHOLD_MS = 5 * 60 * 1000;

  const processedLogs = logs.map(log => {
    if (lastTimestamp && log.timestamp) {
      const gap = new Date(log.timestamp) - new Date(lastTimestamp);
      if (gap > GAP_THRESHOLD_MS) summary.integrity_status = 'INTEGRITY_COMPROMISED';
    }
    if (log.timestamp) lastTimestamp = log.timestamp;

    if (log.state === 'autonomous') summary.total_exposure_seconds += log.interval_duration || 0;

    let classification = 'NOMINAL';
    let intent = 'NOMINAL';

    if (log.boundary_hit) {
      if (log.interlock_action === 'BLOCK' || log.interlock_action === 'HALT') {
        classification = 'INTERVENTION'; intent = 'SUCCESS'; summary.successful_interventions++;
      } else {
        classification = 'EXCEEDANCE'; intent = 'FAILURE'; summary.enforcement_failures++;
      }
    } else if (log.proximity > 0.9) {
      classification = 'PROXIMITY_ALERT'; intent = 'WARNING'; summary.boundary_proximity_events++;
    }

    return { ...log, classification, intent, timestamp: log.timestamp || new Date().toISOString() };
  });

  return {
    summary,
    logs: processedLogs,
    conformance_score: summary.enforcement_failures === 0 && summary.integrity_status === 'VALIDATED' ? 100 : 0,
  };
};
