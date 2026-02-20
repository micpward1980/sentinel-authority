import React from 'react';
import { styles } from '../config/styles';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: styles.bgDeep,
          padding: '24px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{
              fontFamily: "Consolas, 'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: 'rgba(180,52,52,0.6)',
              marginBottom: 12
            }}>System Error</div>
            <h1 style={{
              fontFamily: "Georgia, 'Source Serif 4', serif",
              fontSize: 28,
              fontWeight: 200,
              color: styles.textPrimary,
              marginBottom: 8
            }}>Something went wrong</h1>
            <p style={{
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              color: 'rgba(15,18,30,.56)',
              lineHeight: 1.6,
              marginBottom: 24
            }}>
              An unexpected error occurred. Your data is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: '1px solid rgba(74,61,117,0.25)',
                color: styles.purpleBright,
                padding: '12px 24px',
                fontFamily: "Consolas, monospace",
                fontSize: 10,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
