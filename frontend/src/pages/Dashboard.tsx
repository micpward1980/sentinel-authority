import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Cpu, CheckCircle, Timer } from 'lucide-react';
import api from '../services/api';
import { Card, MetricCard, StatusBadge, ProgressRing, Button, Spinner } from '../components/ui';
import type { CAT72Test } from '../types';

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.getAccounts({ per_page: 100 }),
  });

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: () => api.getSystems({ per_page: 100 }),
  });

  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['cat72-tests'],
    queryFn: () => api.getCAT72Tests({ per_page: 100 }),
  });

  // Calculate metrics
  const totalAccounts = accounts?.total || 0;
  const totalSystems = systems?.total || 0;
  const certifiedSystems = systems?.items?.filter(s => s.certification_state === 'certified').length || 0;
  const activeTests = tests?.items?.filter(t => t.status === 'in_progress').length || 0;

  const inProgressTests = tests?.items?.filter(t => t.status === 'in_progress') || [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Sentinel Authority Certification Management System</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Active Accounts"
          value={totalAccounts}
          trend={12}
          icon={<Building2 className="text-indigo-400" />}
        />
        <MetricCard
          label="Registered Systems"
          value={totalSystems}
          icon={<Cpu className="text-indigo-400" />}
        />
        <MetricCard
          label="Certified Systems"
          value={certifiedSystems}
          trend={8}
          icon={<CheckCircle className="text-emerald-400" />}
        />
        <MetricCard
          label="Active CAT-72 Tests"
          value={activeTests}
          icon={<Timer className="text-amber-400" />}
        />
      </div>

      {/* Active CAT-72 Tests */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">Active CAT-72 Tests</h2>
          <Button variant="secondary" size="sm" onClick={() => navigate('/cat72')}>
            View All →
          </Button>
        </div>

        {testsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : inProgressTests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No active CAT-72 tests
          </div>
        ) : (
          <div className="space-y-3">
            {inProgressTests.map((test: CAT72Test) => {
              const progress = (test.elapsed_hours / test.required_duration_hours) * 100;
              const hasViolations = test.violation_count > 0 || test.envelope_breach_count > 0;
              
              return (
                <div
                  key={test.id}
                  className="flex items-center gap-5 p-4 bg-[#1a1e28] rounded-lg cursor-pointer hover:bg-[#222733] transition-colors"
                  onClick={() => navigate(`/cat72/${test.id}`)}
                >
                  <div className="relative">
                    <ProgressRing
                      progress={progress}
                      size={70}
                      strokeWidth={5}
                      color={hasViolations ? '#f59e0b' : '#10b981'}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold font-mono">
                        {test.elapsed_hours.toFixed(1)}h
                      </span>
                      <span className="text-[10px] text-gray-500">of 72h</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="font-medium mb-1">System #{test.system_id.slice(0, 8)}</div>
                    <div className="text-sm text-gray-400">
                      Test ID: {test.test_number}
                    </div>
                  </div>

                  <div className="flex gap-8 text-center">
                    <div>
                      <div className={`text-lg font-bold font-mono ${test.violation_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {test.violation_count}
                      </div>
                      <div className="text-xs text-gray-500">Violations</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold font-mono ${test.intervention_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {test.intervention_count}
                      </div>
                      <div className="text-xs text-gray-500">Interventions</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold font-mono ${test.envelope_breach_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {test.envelope_breach_count}
                      </div>
                      <div className="text-xs text-gray-500">Breaches</div>
                    </div>
                  </div>

                  <StatusBadge status={test.status} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card>
        <h2 className="text-lg font-semibold mb-5">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { time: '2 hours ago', event: 'CAT-72 test reached 50-hour mark', type: 'info' },
            { time: '6 hours ago', event: 'Aurora Robotics submitted envelope revision 1.2.1', type: 'update' },
            { time: '1 day ago', event: 'M-Drive Urban Navigator failed CAT-72', type: 'alert' },
            { time: '2 days ago', event: 'New account created: Titan Industrial AI', type: 'success' },
            { time: '3 days ago', event: 'M-Drive Highway Pilot certification renewed', type: 'success' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-[#1a1e28] rounded-lg"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  item.type === 'alert' ? 'bg-red-500' :
                  item.type === 'success' ? 'bg-emerald-500' :
                  'bg-indigo-500'
                }`}
              />
              <span className="flex-1 text-sm">{item.event}</span>
              <span className="text-xs text-gray-500">{item.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default DashboardPage;
