import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#2a2f3d',
      padding: 24
    }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{
          fontFamily: "Consolas, 'IBM Plex Mono', monospace",
          fontSize: 9, letterSpacing: 2.5,
          textTransform: 'uppercase',
          color: 'rgba(157,140,207,0.5)',
          marginBottom: 12
        }}>Error 404</div>
        <h1 style={{
          fontFamily: "Georgia, serif",
          fontSize: 32, fontWeight: 200,
          color: '#fff', marginBottom: 8
        }}>Page not found</h1>
        <p style={{
          fontFamily: "Consolas, monospace",
          fontSize: 12, color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6, marginBottom: 24
        }}>The requested resource does not exist.</p>
        <Link to="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid rgba(157,140,207,0.3)',
          color: 'rgba(157,140,207,0.9)',
          padding: '12px 24px',
          fontFamily: "Consolas, monospace",
          fontSize: 10, letterSpacing: 2.5,
          textTransform: 'uppercase', textDecoration: 'none'
        }}>Return to Dashboard</Link>
      </div>
    </div>
  );
}
