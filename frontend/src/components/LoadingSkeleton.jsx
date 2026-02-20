import React from 'react';

const shimmer = {
  background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)',
  backgroundSize: '200% 100%',
  animation: 'sa-shimmer 1.5s ease infinite',
  borderRadius: 0,
};

export function SkeletonLine({ width = '100%', height = 12, style = {} }) {
  return <div style={{ ...shimmer, width, height, marginBottom: 8, ...style }} />;
}

export function SkeletonCard({ style = {} }) {
  return (
    <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', ...style }}>
      <div style={{ ...shimmer, width: 60, height: 8, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: 80, height: 24, marginBottom: 8 }} />
      <div style={{ ...shimmer, width: '70%', height: 8 }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '0 0 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        {[80, 120, 100, 60].map((w, i) => (
          <div key={i} style={{ ...shimmer, width: w, height: 8 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          {[80, 120, 100, 60].map((w, j) => (
            <div key={j} style={{ ...shimmer, width: w + Math.random() * 40, height: 10 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 0' }}>
      <div style={{ ...shimmer, width: 200, height: 24, marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable rows={4} />
    </div>
  );
}

export default DashboardSkeleton;
