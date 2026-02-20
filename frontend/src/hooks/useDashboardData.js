import { useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '../config/api';

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetch = (url) => () => api.get(url).then(r => r.data);

// ─── Query key factory ────────────────────────────────────────────────────────

export const dashKeys = {
  stats:        ['dashboard', 'stats'],
  recentApps:   ['dashboard', 'recent-applications'],
  activeTests:  ['dashboard', 'active-tests'],
  applications: ['dashboard', 'applications'],
  recentCerts:  ['dashboard', 'recent-certificates'],
  monitoring:   ['dashboard', 'monitoring'],
  certificates: ['dashboard', 'certificates'],
  activity:     ['dashboard', 'activity'],
};

// ─── Admin hook ───────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  const results = useQueries({
    queries: [
      { queryKey: dashKeys.stats,        queryFn: fetch('/api/dashboard/stats') },
      { queryKey: dashKeys.recentApps,   queryFn: fetch('/api/dashboard/recent-applications') },
      { queryKey: dashKeys.activeTests,  queryFn: fetch('/api/dashboard/active-tests') },
      { queryKey: dashKeys.applications, queryFn: fetch('/api/applications/') },
      { queryKey: dashKeys.recentCerts,  queryFn: fetch('/api/dashboard/recent-certificates') },
      { queryKey: dashKeys.monitoring,   queryFn: fetch('/api/envelo/monitoring/overview') },
    ],
  });

  const [statsQ, recentAppsQ, activeTestsQ, allAppsQ, recentCertsQ, monQ] = results;

  const anyLoading = results.some(r => r.isLoading);
  const failCount  = results.filter(r => r.isError).length;
  const degraded   = failCount >= 3;
  const lastUpdated = results
    .map(r => r.dataUpdatedAt)
    .filter(Boolean)
    .reduce((a, b) => Math.max(a, b), 0);

  return {
    stats:        statsQ.data ?? null,
    recentApps:   recentAppsQ.data ?? [],
    activeTests:  activeTestsQ.data ?? [],
    applications: allAppsQ.data?.applications ?? allAppsQ.data ?? [],
    recentCerts:  recentCertsQ.data ?? [],
    monitoring:   monQ.data ?? null,
    loading:      anyLoading,
    degraded,
    lastUpdated:  lastUpdated ? new Date(lastUpdated).toISOString() : null,
    errors: {
      stats:        statsQ.isError,
      recentApps:   recentAppsQ.isError,
      activeTests:  activeTestsQ.isError,
      applications: allAppsQ.isError,
      recentCerts:  recentCertsQ.isError,
      monitoring:   monQ.isError,
    },
  };
}

// ─── Applicant hook ───────────────────────────────────────────────────────────

export function useApplicantDashboard() {
  const results = useQueries({
    queries: [
      { queryKey: dashKeys.applications, queryFn: fetch('/api/applications/') },
      { queryKey: dashKeys.certificates, queryFn: fetch('/api/certificates/') },
      { queryKey: dashKeys.monitoring,   queryFn: fetch('/api/envelo/monitoring/overview') },
      { queryKey: dashKeys.activity,     queryFn: fetch('/api/audit/my-logs?limit=5&offset=0') },
    ],
  });

  const [appsQ, certsQ, monQ, actQ] = results;

  const anyLoading = results.some(r => r.isLoading);
  const failCount  = results.filter(r => r.isError).length;
  const degraded   = failCount >= 2;
  const lastUpdated = results
    .map(r => r.dataUpdatedAt)
    .filter(Boolean)
    .reduce((a, b) => Math.max(a, b), 0);

  return {
    applications:   appsQ.data?.applications ?? appsQ.data ?? [],
    certificates:   certsQ.data ?? [],
    monitoring:     monQ.data ?? null,
    recentActivity: actQ.data?.logs ?? actQ.data ?? [],
    loading:        anyLoading,
    degraded,
    lastUpdated:    lastUpdated ? new Date(lastUpdated).toISOString() : null,
    errors: {
      applications:   appsQ.isError,
      certificates:   certsQ.isError,
      monitoring:     monQ.isError,
      recentActivity: actQ.isError,
    },
  };
}

// ─── Unified hook (role-based) ────────────────────────────────────────────────

export function useDashboardData(role) {
  const qc = useQueryClient();
  const admin = useAdminDashboard();
  const applicant = useApplicantDashboard();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return role === 'admin'
    ? { ...admin, refresh }
    : { ...applicant, refresh };
}
