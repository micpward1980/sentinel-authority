import React, { useState, useEffect, createContext, useContext } from 'react';
import BoundaryEditor from './components/BoundaryEditor';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { FileText, Activity, Award, Users, Home, LogOut, Menu, X, CheckCircle, AlertTriangle, Clock, Search, Plus, ArrowLeft, ExternalLink, Shield, Download, RefreshCw, Eye, EyeOff, BookOpen, } from 'lucide-react';
import axios from 'axios';

// API Configuration
const API_URL = 'https://sentinel-authority-production.up.railway.app';
const api = axios.create({ baseURL: API_URL });

// Add auth header to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth Context
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data) => {
    const res = await api.post('/api/auth/register', data);
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

// Brand Mark Component - matches website exactly
function BrandMark({ size = 24 }) {
  return (
    <div 
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: '#5B4B8A',
        border: '2px solid #9d8ccf',
        borderRadius: 6,
      }}
    >
      <div 
        className="rounded-full"
        style={{
          width: size * 0.33,
          height: size * 0.33,
          background: '#c4b8e8',
          animation: 'eyePulse 7s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes eyePulse {
          0%, 100% { opacity: 0.75; transform: scale(0.98); box-shadow: 0 0 0 rgba(196,184,232,0); }
          50% { opacity: 1; transform: scale(1.02); box-shadow: 0 0 10px rgba(157,140,207,0.22); }
        }
      `}</style>
    </div>
  );
}

// Protected Route
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen" style={{background: '#2a2f3d', color: 'rgba(255,255,255,0.94)'}}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

// Custom styles to match website
const styles = {
  bgDeep: '#2a2f3d',
  bgSurface: '#1e212b',
  bgPanel: 'rgba(255,255,255,0.05)',
  purplePrimary: '#5B4B8A',
  purpleBright: '#9d8ccf',
  purpleGlow: 'rgba(157,140,207,0.20)',
  accentGreen: '#5CD685',
  accentAmber: '#D6A05C',
  accentRed: '#D65C5C',
  textPrimary: 'rgba(255,255,255,0.92)',
  textSecondary: 'rgba(255,255,255,0.75)',
  textTertiary: 'rgba(255,255,255,0.50)',
  borderGlass: 'rgba(255,255,255,0.10)',
  mono: "'IBM Plex Mono', monospace",
  serif: "'Source Serif 4', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
};
// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
}



// Layout
function Layout({ children }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [userCerts, setUserCerts] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const location = useLocation();

  useEffect(() => {
    if (user) {
      api.get('/api/certificates/').then(res => setUserCerts(res.data || [])).catch(() => setUserCerts([]));
      api.get('/api/applications/').then(res => setUserApps(res.data || [])).catch(() => setUserApps([]));
    }
  }, [user]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'applicant'] },
    { name: 'Applications', href: '/applications', icon: FileText, roles: ['admin', 'applicant'] },
    { name: 'CAT-72 Console', href: '/cat72', icon: Activity, roles: ['admin'] },
    { name: 'Certificates', href: '/certificates', icon: Award, roles: ['admin', 'applicant'] },
    { name: 'Resources', href: '/resources', icon: BookOpen, roles: ['admin', 'applicant'] },
    { name: 'ENVELO Agent', href: '/envelo', icon: 'brand', roles: ['admin', 'applicant'], requiresCert: true },
    { name: 'Monitoring', href: '/monitoring', icon: Activity, roles: ['admin', 'applicant'], requiresCert: true },
    { name: 'User Management', href: '/users', icon: Users, roles: ['admin'] },
  ];

  const hasCert = userCerts.some(c => c.status === 'issued' || c.status === 'active');
  const hasApprovedApp = userApps.some(a => a.status === 'approved' || a.status === 'testing');
  const canAccessAgent = hasCert || hasApprovedApp;
  const filteredNav = navigation.filter(item => {
    if (!item.roles.includes(user?.role || '')) return false;
    if (item.requiresCert && user?.role !== 'admin' && !canAccessAgent) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{background: '#2a2f3d', color: styles.textPrimary, fontFamily: "'Inter', system-ui, -apple-system, sans-serif"}}>
      {/* Animated background gradients */}
      <div style={{
        position: 'fixed', top: '-10%', left: '5%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(91,75,138,0.18) 0%, transparent 70%)',
        animation: 'float1 20s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-20%', right: '0%', width: '700px', height: '700px',
        background: 'radial-gradient(circle, rgba(92,214,133,0.06) 0%, transparent 70%)',
        animation: 'float2 25s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: '50%', right: '20%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(157,140,207,0.10) 0%, transparent 70%)',
        animation: 'float3 15s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
      }} />
      
      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -40px) scale(1.05); } 66% { transform: translate(-30px, 30px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-50px, -50px) scale(1.1); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, 40px); } }
        .sexy-panel { transition: all 0.3s ease; }
        .sexy-panel:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
        .sexy-btn { transition: all 0.3s ease; }
        .sexy-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(91,75,138,0.4); }
        .sexy-input { transition: all 0.3s ease; }
        .sexy-input:focus { border-color: rgba(157,140,207,0.6) !important; box-shadow: 0 0 0 3px rgba(157,140,207,0.1); transform: translateY(-1px); }
        .sexy-row { transition: all 0.2s ease; }
        .sexy-row:hover { background: rgba(157,140,207,0.08) !important; }
      `}</style>
      
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '120px 120px',
        opacity: 0.2,
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)',
        zIndex: 0,
      }} />

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40}}
        />
      )}
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} style={{background: 'rgba(42,47,61,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255,255,255,0.08)', boxShadow: '4px 0 24px rgba(0,0,0,0.2)'}}>
        <div className="flex items-center justify-between h-16 px-4" style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
          <Link to="/dashboard" className="flex items-center gap-3 no-underline">
            <BrandMark size={24} />
            <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: styles.textPrimary}}>Sentinel Authority</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{color: styles.textSecondary}}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {filteredNav.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all no-underline"
              style={{
                background: location.pathname.startsWith(item.href) ? 'linear-gradient(135deg, rgba(91,75,138,0.9) 0%, rgba(107,91,154,0.9) 100%)' : 'transparent',
                color: location.pathname.startsWith(item.href) ? '#fff' : styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                boxShadow: location.pathname.startsWith(item.href) ? '0 4px 15px rgba(91,75,138,0.4)' : 'none',
                border: location.pathname.startsWith(item.href) ? '1px solid rgba(157,140,207,0.3)' : '1px solid transparent',
              }}
            >
              {item.icon === 'brand' ? <BrandMark size={16} /> : <item.icon className="w-4 h-4" />}
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4" style={{borderTop: `1px solid ${styles.borderGlass}`}}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`}}>
              <span style={{color: '#fff', fontWeight: 500}}>{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div>
              <div style={{fontWeight: 500, color: styles.textPrimary}}>{user?.full_name}</div>
              <div style={{fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px'}}>{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 w-full transition-colors" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer'}}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${sidebarOpen ? 'lg:ml-64' : ''} relative z-10`}>
        <header className="h-16 flex items-center px-6 gap-4" style={{borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(42,47,61,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'}}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden" style={{color: styles.textSecondary, background: 'none', border: 'none'}}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <ExternalLink className="w-4 h-4" />
            Main Site
          </a>
          {user?.role === 'admin' && (
          <a href="https://api.sentinelauthority.org/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <FileText className="w-4 h-4" />
            API Docs
          </a>
          )}
          <Link to="/verify" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <Search className="w-4 h-4" />
            Verify
          </Link>
        </header>
        <main className="p-8" style={{position: 'relative', zIndex: 1}}>{children}</main>
      </div>
    </div>
  );
}

// Panel Component
function Panel({ children, className = '', glow = false, accent = null }) {
  const accentColors = {
    purple: 'rgba(157,140,207,0.15)',
    green: 'rgba(92,214,133,0.1)',
    amber: 'rgba(214,160,92,0.1)',
    red: 'rgba(214,92,92,0.1)',
  };
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{
      background: accent ? `linear-gradient(135deg, ${accentColors[accent] || accentColors.purple} 0%, rgba(255,255,255,0.02) 100%)` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${styles.borderGlass}`,
      backdropFilter: 'blur(16px)',
      boxShadow: glow ? '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {glow && <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(157,140,207,0.3),transparent)'}}/>}
      {children}
    </div>
  );
}

// Section Header Component
function SectionHeader({ label, title, description, action }) {
  return (
    <div style={{marginBottom: '24px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
        <div>
          {label && <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span style={{width: '24px', height: '1px', background: styles.purpleBright}}></span>
            {label}
          </p>}
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '32px', fontWeight: 200, margin: 0, letterSpacing: '-0.02em'}}>{title}</h1>
          {description && <p style={{color: styles.textSecondary, marginTop: '8px', fontSize: '15px'}}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, trend, color = styles.purpleBright, icon }) {
  return (
    <Panel glow>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>{label}</p>
          <p style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, color: color, margin: 0, lineHeight: 1}}>{value}</p>
          {trend && <p style={{fontSize: '12px', color: trend > 0 ? styles.accentGreen : styles.accentRed, marginTop: '8px'}}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%</p>}
        </div>
        {icon && <div style={{width: '48px', height: '48px', borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{icon}</div>}
      </div>
    </Panel>
  );
}

// Status Badge Component  
function StatusBadge({ status, size = 'md' }) {
  const statusConfig = {
    pending: { bg: 'rgba(214,160,92,0.15)', border: 'rgba(214,160,92,0.3)', color: styles.accentAmber, label: 'Pending' },
    under_review: { bg: 'rgba(157,140,207,0.15)', border: 'rgba(157,140,207,0.3)', color: styles.purpleBright, label: 'Under Review' },
    approved: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Approved' },
    testing: { bg: 'rgba(157,140,207,0.15)', border: 'rgba(157,140,207,0.3)', color: styles.purpleBright, label: 'Testing' },
    conformant: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Conformant' },
    certified: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Certified' },
    active: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Active' },
    issued: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Issued' },
    revoked: { bg: 'rgba(214,92,92,0.15)', border: 'rgba(214,92,92,0.3)', color: styles.accentRed, label: 'Revoked' },
    suspended: { bg: 'rgba(214,160,92,0.15)', border: 'rgba(214,160,92,0.3)', color: styles.accentAmber, label: 'Suspended' },
    running: { bg: 'rgba(214,160,92,0.15)', border: 'rgba(214,160,92,0.3)', color: styles.accentAmber, label: 'Running' },
    scheduled: { bg: 'rgba(157,140,207,0.15)', border: 'rgba(157,140,207,0.3)', color: styles.purpleBright, label: 'Scheduled' },
    completed: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.3)', color: styles.accentGreen, label: 'Completed' },
  };
  const config = statusConfig[status] || statusConfig.pending;
  const padding = size === 'sm' ? '4px 10px' : '6px 14px';
  const fontSize = size === 'sm' ? '9px' : '10px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding, borderRadius: '20px', fontSize, fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: '1px', textTransform: 'uppercase',
      background: config.bg, border: `1px solid ${config.border}`, color: config.color,
    }}>
      <span style={{width: '6px', height: '6px', borderRadius: '50%', background: config.color, boxShadow: `0 0 8px ${config.color}`}}></span>
      {config.label}
    </span>
  );
}

// Progress Bar Component
function ProgressBar({ value, max = 100, color = styles.purpleBright, showLabel = true, size = 'md' }) {
  const pct = Math.min(100, (value / max) * 100);
  const height = size === 'sm' ? '4px' : '8px';
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
      <div style={{flex: 1, height, borderRadius: '4px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden'}}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: '4px',
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 12px ${color}50`,
          transition: 'width 0.5s ease',
        }}/>
      </div>
      {showLabel && <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary, minWidth: '40px'}}>{Math.round(pct)}%</span>}
    </div>
  );
}

// Data Table Component
function DataTable({ columns, data, onRowClick, emptyMessage = 'No data found' }) {
  return (
    <div style={{overflowX: 'auto'}}>
      <table style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
            {columns.map((col, i) => (
              <th key={i} style={{
                padding: '14px 16px', textAlign: col.align || 'left',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
                letterSpacing: '1.5px', textTransform: 'uppercase',
                color: styles.textTertiary, fontWeight: 400,
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{padding: '48px', textAlign: 'center', color: styles.textTertiary}}>{emptyMessage}</td></tr>
          ) : data.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)} style={{
              borderBottom: `1px solid ${styles.borderGlass}`,
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              {columns.map((col, j) => (
                <td key={j} style={{padding: '16px', textAlign: col.align || 'left', color: styles.textSecondary, fontSize: '14px'}}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Action Button Component
function ActionButton({ children, variant = 'primary', size = 'md', icon, onClick, disabled, href }) {
  const variants = {
    primary: { bg: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)', border: 'rgba(157,140,207,0.5)', color: '#fff', shadow: '0 4px 20px rgba(91,75,138,0.3)' },
    secondary: { bg: 'transparent', border: 'rgba(255,255,255,0.15)', color: styles.textPrimary, shadow: 'none' },
    success: { bg: 'rgba(92,214,133,0.15)', border: 'rgba(92,214,133,0.4)', color: styles.accentGreen, shadow: 'none' },
    danger: { bg: 'rgba(214,92,92,0.1)', border: 'rgba(214,92,92,0.3)', color: styles.accentRed, shadow: 'none' },
  };
  const sizes = { sm: '10px 16px', md: '12px 20px', lg: '14px 28px' };
  const v = variants[variant];
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: sizes[size], borderRadius: '12px',
    background: v.bg, border: `1px solid ${v.border}`, color: v.color,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: size === 'sm' ? '10px' : '11px',
    letterSpacing: '1px', textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, boxShadow: v.shadow,
    textDecoration: 'none', transition: 'all 0.2s ease',
  };
  const Component = href ? 'a' : 'button';
  return <Component href={href} onClick={onClick} disabled={disabled} style={style}>{icon}{children}</Component>;
}

// Login Page
function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '', organization_name: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(formData);
      } else {
        await login(formData.email, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: styles.bgDeep}}>
      <Link to="/dashboard" style={{
        position: 'fixed', top: '24px', right: '32px', zIndex: 20,
        color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
        transition: 'color 0.2s',
      }}>← Dashboard</Link>
      {/* Animated background gradients */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(91,75,138,0.18) 0%, transparent 65%)',
        animation: 'float1 25s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-15%', width: '800px', height: '800px',
        background: 'radial-gradient(circle, rgba(92,214,133,0.06) 0%, transparent 65%)',
        animation: 'float2 30s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '10%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(157,140,207,0.10) 0%, transparent 65%)',
        animation: 'float3 15s ease-in-out infinite', pointerEvents: 'none',
      }} />
      
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '120px 120px', opacity: 0.2, pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)',
      }} />

      {/* Decorative lines */}
      <div style={{ position: 'absolute', top: '20%', left: '5%', width: '1px', height: '200px',
        background: 'linear-gradient(to bottom, transparent, rgba(157,140,207,0.3), transparent)',
      }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '8%', width: '150px', height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(92,214,133,0.3), transparent)',
      }} />

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -30px) scale(1.05); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-40px, -40px) scale(1.1); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 30px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 0; } 100% { transform: scale(0.8); opacity: 0.5; } }
        .login-input { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .login-input:focus { border-color: rgba(157,140,207,0.6) !important; box-shadow: 0 0 0 3px rgba(157,140,207,0.1), 0 4px 20px rgba(0,0,0,0.2); transform: translateY(-1px); }
        .login-btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .login-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(91,75,138,0.5); }
      `}</style>

      <div className="w-full max-w-md relative z-10">
        {/* Brand section */}
        <div className="text-center mb-10">
          {/* Animated brand mark with rings */}
          <div className="relative flex justify-center mb-6" style={{height: '100px', alignItems: 'center'}}>
            <div style={{
              position: 'absolute', width: '80px', height: '80px',
              border: '1px solid rgba(157,140,207,0.2)', borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', width: '100px', height: '100px',
              border: '1px solid rgba(157,140,207,0.1)', borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite 0.5s',
            }} />
            <div style={{
              width: '56px', height: '56px',
              background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
              border: '2px solid #9d8ccf', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(91,75,138,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}>
              <div style={{
                width: '18px', height: '18px',
                background: 'radial-gradient(circle, #e8e0ff 0%, #c4b8e8 100%)',
                borderRadius: '50%', boxShadow: '0 0 20px rgba(196,184,232,0.5)',
                animation: 'eyePulse 3s ease-in-out infinite',
              }} />
            </div>
          </div>
          
          <h1 style={{
            fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200,
            color: styles.textPrimary, margin: '0 0 8px 0', letterSpacing: '-0.02em',
          }}>
            ODDC <span style={{color: styles.purpleBright, fontStyle: 'italic'}}>Portal</span>
          </h1>
          
          <p style={{
            color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '12px',
          }}>Sentinel Authority</p>

          <a href="https://sentinelauthority.org" style={{
            color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px', letterSpacing: '1px', textDecoration: 'none',
            padding: '8px 16px', border: '1px solid rgba(157,140,207,0.2)',
            borderRadius: '20px', marginTop: '16px', display: 'inline-block',
          }}>← VISIT MAIN SITE</a>
        </div>
        
        {/* Login card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset', transition: 'all 0.3s ease', minHeight: '280px',
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px', padding: '4px', marginBottom: '32px',
          }}>
            <button onClick={() => setIsRegister(false)} type="button" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: !isRegister ? styles.purplePrimary : 'transparent',
              color: !isRegister ? '#fff' : styles.textTertiary,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>Sign In</button>
            <button onClick={() => setIsRegister(true)} type="button" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: isRegister ? styles.purplePrimary : 'transparent',
              color: isRegister ? '#fff' : styles.textTertiary,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>Register</button>
          </div>

          {error && (
            <div style={{
              marginBottom: '24px', padding: '14px 16px', borderRadius: '12px',
              background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)',
              color: styles.accentRed, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px',
            }}><span style={{fontSize: '16px'}}>⚠</span>{error}</div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <>
                <div>
                  <label style={{
                    display: 'block', marginBottom: '8px', color: styles.textTertiary,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>Full Name</label>
                  <input type="text" placeholder="Jane Smith" value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="login-input w-full px-4 py-4 rounded-xl outline-none"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                      color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                    }} required />
                </div>
                <div>
                  <label style={{
                    display: 'block', marginBottom: '8px', color: styles.textTertiary,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>Organization</label>
                  <input type="text" placeholder="Acme Robotics Inc." value={formData.organization_name}
                    onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
                    className="login-input w-full px-4 py-4 rounded-xl outline-none"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                      color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                    }} required />
                </div>
              </>
            )}
            <div>
              <label style={{
                display: 'block', marginBottom: '8px', color: styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>Email Address</label>
              <input type="email" placeholder="you@company.com" value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="login-input w-full px-4 py-4 rounded-xl outline-none"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                }} required />
            </div>
            <div>
              <label style={{
                display: 'block', marginBottom: '8px', color: styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>Password</label>
              <div style={{position: "relative"}}><input type={showPassword ? "text" : "password"} placeholder="••••••••••••" value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="login-input w-full px-4 py-4 rounded-xl outline-none"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  color: styles.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: '15px',
                }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px'}}>{showPassword ? <EyeOff className="w-5 h-5" style={{color: styles.textTertiary}} /> : <Eye className="w-5 h-5" style={{color: styles.textTertiary}} />}</button>
              </div>
            </div>
            
            <button type="submit" className="login-btn w-full py-4 rounded-xl font-medium"
              style={{
                background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
                border: '1px solid rgba(157,140,207,0.5)', color: '#fff',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                marginTop: '8px', boxShadow: '0 4px 20px rgba(91,75,138,0.4)',
              }}>{isRegister ? 'Create Account' : 'Sign In'}</button>
          </form>
          
          {!isRegister && (
            <div className="mt-6 text-center">
              <a href="#" style={{ color: styles.textTertiary, fontSize: '13px', textDecoration: 'none' }}>Forgot password?</a>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <p style={{
            color: styles.textTertiary, fontSize: '11px',
            fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px',
          }}>
            Protected by ENVELO • <a href="https://sentinelauthority.org/privacy.html" style={{color: styles.purpleBright, textDecoration: 'none'}}>Privacy</a> • <a href="https://sentinelauthority.org/terms.html" style={{color: styles.purpleBright, textDecoration: 'none'}}>Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}



// Dashboard

// Customer Dashboard - simplified view for customers
function CustomerDashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/applications/').catch(() => ({ data: [] })),
      api.get('/api/certificates/').catch(() => ({ data: [] }))
    ]).then(([appsRes, certsRes]) => {
      setApplications(appsRes.data || []);
      setCertificates(certsRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Welcome</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Your Dashboard</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Track your ODDC certification progress</p>
      </div>

      {/* Quick Stats */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px'}}>
        <Panel>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px'}}>
            <div style={{fontFamily: styles.serif, fontSize: '36px', fontWeight: 200, color: styles.purpleBright, lineHeight: '43px'}}>{applications.length}</div>
            <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px'}}>Applications</div>
          </div>
        </Panel>
        <Panel>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px'}}>
            <div style={{fontFamily: styles.serif, fontSize: '36px', fontWeight: 200, color: styles.accentGreen, lineHeight: '43px'}}>{certificates.length}</div>
            <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px'}}>Certificates</div>
          </div>
        </Panel>
        <Panel>
          <a href="https://sentinel-website-eta.vercel.app/status.html" target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px'}}>
            <div style={{height: '43px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Activity size={36} style={{color: styles.purpleBright}} /></div>
            <div style={{fontFamily: styles.mono, fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px'}}>Check Test Status</div>
          </a>
        </Panel>
      </div>

      {/* Applications */}
      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Applications</h2>
        {applications.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px', color: styles.textTertiary}}>
            <p style={{marginBottom: '16px'}}>No applications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.id} style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500, marginBottom: '4px'}}>{app.system_name}</div>
                  <div style={{fontSize: '12px', color: styles.textTertiary}}>{app.application_number}</div>
                </div>
                <span style={{padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase',
                  background: app.status === 'certified' ? 'rgba(92,214,133,0.15)' : app.status === 'testing' ? 'rgba(157,140,207,0.15)' : 'rgba(214,160,92,0.15)',
                  color: app.status === 'certified' ? styles.accentGreen : app.status === 'testing' ? styles.purpleBright : styles.accentAmber
                }}>{app.status || 'pending'}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Certificates */}
      {certificates.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Certificates</h2>
          <div className="space-y-3">
            {certificates.map(cert => (
              <div key={cert.id} style={{padding: '16px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500, color: styles.accentGreen, marginBottom: '4px'}}>{cert.certificate_number}</div>
                  <div style={{fontSize: '12px', color: styles.textTertiary}}>Issued: {new Date(cert.issued_at).toLocaleDateString()}</div>
                </div>
                <a href={`https://sentinel-authority-production.up.railway.app/api/applications/${cert.application_id}/certificate/download`} 
                   target="_blank"
                   style={{padding: '8px 16px', background: styles.purplePrimary, borderRadius: '6px', color: '#fff', fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", textDecoration: 'none'}}>
                  Download PDF
                </a>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Help */}
      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Need Help?</h2>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          {certificates.some(c => c.status === 'issued' || c.status === 'active') && (
          <a href="https://sentinelauthority.org/agent.html" target="_blank" style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textDecoration: 'none', color: styles.textSecondary}}>
            <div style={{fontWeight: 500, marginBottom: '4px', color: styles.textPrimary}}>ENVELO Agent Setup</div>
            <div style={{fontSize: '12px'}}>Installation and configuration guide</div>
          </a>
          )}
          <a href="mailto:info@sentinelauthority.org" style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textDecoration: 'none', color: styles.textSecondary}}>
            <div style={{fontWeight: 500, marginBottom: '4px', color: styles.textPrimary}}>Contact Support</div>
            <div style={{fontSize: '12px'}}>info@sentinelauthority.org</div>
          </a>
        </div>
      </Panel>
    </div>
  );
}


// Role-based dashboard routing
function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Dashboard />;
  }
  return <CustomerDashboard />;
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [activeTests, setActiveTests] = useState([]);

  useEffect(() => {
    api.get('/api/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
    api.get('/api/dashboard/recent-applications').then(res => setRecentApps(res.data)).catch(console.error);
    api.get('/api/dashboard/active-tests').then(res => setActiveTests(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      <SectionHeader 
        label="Overview" 
        title="Dashboard"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Total Applications" 
          value={stats?.total_applications || 0} 
          color={styles.purpleBright}
          icon={<FileText className="w-5 h-5" style={{color: styles.purpleBright}} />}
        />
        <StatCard 
          label="Active Tests" 
          value={stats?.active_tests || 0} 
          color={styles.accentAmber}
          icon={<Activity className="w-5 h-5" style={{color: styles.accentAmber}} />}
        />
        <StatCard 
          label="Certificates Issued" 
          value={stats?.certificates_issued || 0} 
          color={styles.accentGreen}
          icon={<Award className="w-5 h-5" style={{color: styles.accentGreen}} />}
        />
      </div>

      {/* Active Tests */}
      {activeTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Active CAT-72 Tests</h2>
          <div className="space-y-3">
            {activeTests.map((test) => (
              <div key={test.id} className="p-4 rounded-lg" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`}}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{test.organization_name} - {test.system_name}</span>
                  <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentAmber}}>
                    {Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.1)'}}>
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{width: `${(test.elapsed_seconds / (test.duration_hours * 3600)) * 100}%`, background: styles.purpleBright}}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Recent Applications */}
      <Panel>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Recent Applications</h2>
          {user?.role !== "admin" && <Link to="/applications/new" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors no-underline" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>
            <Plus className="w-4 h-4" />
            New Application
          </Link>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app) => (
                <tr key={app.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                  <td className="px-4 py-3" style={{color: styles.textPrimary}}>{app.system_name}</td>
                  <td className="px-4 py-3" style={{color: styles.textSecondary}}>{app.organization_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs" style={{
                      background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'observe' ? 'rgba(157,140,207,0.15)' : 'rgba(214,160,92,0.15)',
                      color: app.state === 'conformant' ? styles.accentGreen : app.state === 'observe' ? styles.purpleBright : styles.accentAmber,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '10px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                    }}>
                      {app.state}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{color: styles.textTertiary, fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// Applications List
function ApplicationsList() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    api.get('/api/applications/').then(res => setApplications(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Conformance</p>
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Applications</h1>
        </div>
        {user?.role !== "admin" && <Link to="/applications/new" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors no-underline" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <Plus className="w-4 h-4" />
          New Application
        </Link>}
      </div>

      <Panel>
        <table className="w-full">
          <thead>
            <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System Name</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id} className="transition-colors" style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <td className="px-4 py-4">
                  <Link to={`/applications/${app.id}`} style={{color: styles.purpleBright, textDecoration: 'none'}}>{app.system_name}</Link>
                </td>
                <td className="px-4 py-4" style={{color: styles.textSecondary}}>{app.organization_name}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded" style={{
                    background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'observe' ? 'rgba(157,140,207,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
                    color: app.state === 'conformant' ? styles.accentGreen : app.state === 'observe' ? styles.purpleBright : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}>
                    {app.state}
                  </span>
                </td>
                <td className="px-4 py-4" style={{color: styles.textTertiary, fontSize: '14px'}}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 && (
          <div className="text-center py-12" style={{color: styles.textTertiary}}>No applications yet</div>
        )}
      </Panel>
    </div>
  );
}

// New Application Form — Multi-step wizard with structured boundary config
function NewApplication() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const [error, setError] = useState('');
  const [org, setOrg] = useState({ organization_name: '', contact_name: '', contact_email: '', contact_phone: '' });
  const [sys, setSys] = useState({ system_name: '', system_type: '', system_version: '', manufacturer: '', system_description: '', deployment_type: '', environment: '', integration_method: 'python', expected_volume: '', compliance_requirements: '' });
  const [odd, setOdd] = useState({ odd_description: '', facility_location: '', preferred_test_date: '', temp_min: '', temp_max: '', temp_unit: 'F', weather_constraints: '', surface_type: '', notes: '' });
  const [numericBounds, setNumericBounds] = useState([{ name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' }]);
  const [geoBounds, setGeoBounds] = useState([{ name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' }]);
  const [timeBounds, setTimeBounds] = useState([{ name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] }]);
  const [stateBounds, setStateBounds] = useState([{ name: '', parameter: '', allowed_values: '', forbidden_values: '' }]);
  const [safety, setSafety] = useState({ violation_action: 'stop', connection_loss_action: 'stop', fail_closed: true, emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '', existing_safety_systems: '', escalation_triggers: '' });
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'Inter', sans-serif" };
  const sectionHead = (text) => (<h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>{text}</h2>);
  const fieldLabel = (text) => (<label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>{text}</label>);
  const helpText = (text) => (<p style={{color: styles.textTertiary, fontSize: '11px', marginTop: '4px', lineHeight: '1.4'}}>{text}</p>);
  const addRow = (arr, setArr, template) => setArr([...arr, {...template}]);
  const removeRow = (arr, setArr, idx) => { if (arr.length > 1) setArr(arr.filter((_, i) => i !== idx)); };
  const updateRow = (arr, setArr, idx, field, val) => { const n = [...arr]; n[idx] = {...n[idx], [field]: val}; setArr(n); };
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const buildEnvelopeDefinition = () => {
    const nb = numericBounds.filter(b => b.name && b.parameter).map(b => ({ name: b.name, parameter: b.parameter, min_value: b.min_value ? parseFloat(b.min_value) : null, max_value: b.max_value ? parseFloat(b.max_value) : null, hard_limit: b.hard_limit ? parseFloat(b.hard_limit) : null, unit: b.unit || null, tolerance: b.tolerance ? parseFloat(b.tolerance) : 0 }));
    const gb = geoBounds.filter(b => b.name && b.lat && b.lon).map(b => ({ name: b.name, boundary_type: b.boundary_type, center: { lat: parseFloat(b.lat), lon: parseFloat(b.lon) }, radius_meters: b.radius_meters ? parseFloat(b.radius_meters) : 1000, altitude_min: b.altitude_min ? parseFloat(b.altitude_min) : null, altitude_max: b.altitude_max ? parseFloat(b.altitude_max) : null }));
    const tb = timeBounds.filter(b => b.name).map(b => ({ name: b.name, allowed_hours_start: parseInt(b.start_hour), allowed_hours_end: parseInt(b.end_hour), allowed_days: b.days, timezone: b.timezone }));
    const sb = stateBounds.filter(b => b.name && b.parameter).map(b => ({ name: b.name, parameter: b.parameter, allowed_values: b.allowed_values ? b.allowed_values.split(',').map(s => s.trim()).filter(Boolean) : [], forbidden_values: b.forbidden_values ? b.forbidden_values.split(',').map(s => s.trim()).filter(Boolean) : [] }));
    return { numeric_boundaries: nb, geo_boundaries: gb, time_boundaries: tb, state_boundaries: sb, rate_boundaries: [], safe_state: { action: safety.violation_action, connection_loss: safety.connection_loss_action, notify: true, emergency_contact: { name: safety.emergency_contact_name, phone: safety.emergency_contact_phone, email: safety.emergency_contact_email } }, fail_closed: safety.fail_closed };
  };
  const handleSubmit = async () => {
    try {
      const envelope = buildEnvelopeDefinition();
      const payload = { organization_name: org.organization_name, contact_name: org.contact_name, contact_email: org.contact_email, contact_phone: org.contact_phone, system_name: sys.system_name, system_type: sys.system_type, system_version: sys.system_version, manufacturer: sys.manufacturer, system_description: sys.system_description, odd_specification: { description: odd.odd_description, deployment_type: sys.deployment_type, environment: sys.environment, facility_location: odd.facility_location, operating_temp: odd.temp_min && odd.temp_max ? { min: parseFloat(odd.temp_min), max: parseFloat(odd.temp_max), unit: odd.temp_unit } : null, weather_constraints: odd.weather_constraints || null, surface_type: odd.surface_type || null, integration_method: sys.integration_method, expected_volume: sys.expected_volume, compliance_requirements: sys.compliance_requirements }, envelope_definition: envelope, facility_location: odd.facility_location, preferred_test_date: odd.preferred_test_date || null, notes: odd.notes };
      await api.post('/api/applications/', payload);
      navigate('/applications');
    } catch (err) { setError(err.response?.data?.detail || 'Failed to submit application'); setStep(1); }
  };
  const canNext = () => { if (step === 1) return org.organization_name && org.contact_email; if (step === 2) return sys.system_name && sys.system_type; if (step === 3) return odd.odd_description; return true; };
  const stepLabels = ['Organization', 'System', 'Operating Domain', 'Boundaries', 'Safety & Failure', 'Review'];
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/applications" className="flex items-center gap-2 mb-4 no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}><ArrowLeft className="w-4 h-4" />Back to Applications</Link>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>New Submission</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>ODDC Application</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Submit your autonomous system for conformance determination</p>
      </div>
      <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>{stepLabels.map((label, i) => (<div key={i} style={{flex: 1, textAlign: 'center'}}><div style={{height: '3px', borderRadius: '2px', background: i + 1 <= step ? styles.purpleBright : 'rgba(255,255,255,0.08)', transition: 'background 0.3s', marginBottom: '6px'}} /><span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: i + 1 <= step ? styles.purpleBright : styles.textTertiary}}>{label}</span></div>))}</div>
      <Panel>
        {error && <div className="mb-4 p-3 rounded-lg" style={{background: 'rgba(214,92,92,0.15)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed}}>{error}</div>}
        {step === 1 && (<div className="space-y-4">{sectionHead('Organization Information')}<div>{fieldLabel('Organization Name *')}<input type="text" value={org.organization_name} onChange={(e) => setOrg({...org, organization_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div><div>{fieldLabel('Contact Name')}<input type="text" value={org.contact_name} onChange={(e) => setOrg({...org, contact_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div><div className="grid grid-cols-2 gap-4"><div>{fieldLabel('Contact Email *')}<input type="email" value={org.contact_email} onChange={(e) => setOrg({...org, contact_email: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div><div>{fieldLabel('Contact Phone')}<input type="tel" value={org.contact_phone} onChange={(e) => setOrg({...org, contact_phone: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div></div></div>)}
        {step === 2 && (<div className="space-y-4">{sectionHead('System Information')}<div className="grid grid-cols-2 gap-4"><div>{fieldLabel('System Name *')}<input type="text" value={sys.system_name} onChange={(e) => setSys({...sys, system_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div><div>{fieldLabel('System Type *')}<select value={sys.system_type} onChange={(e) => setSys({...sys, system_type: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="">Select type...</option><option value="mobile_robot">Mobile Robot / AMR</option><option value="industrial_arm">Industrial Robot Arm</option><option value="drone">Drone / UAV</option><option value="autonomous_vehicle">Autonomous Vehicle</option><option value="agv">Automated Guided Vehicle (AGV)</option><option value="cobot">Collaborative Robot (Cobot)</option><option value="clinical_ai">Clinical AI / Decision Support</option><option value="data_center">Data Center Automation</option><option value="other">Other Autonomous System</option></select></div></div><div className="grid grid-cols-2 gap-4"><div>{fieldLabel('System Version')}<input type="text" value={sys.system_version} onChange={(e) => setSys({...sys, system_version: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., 1.0.0" /></div><div>{fieldLabel('Manufacturer')}<input type="text" value={sys.manufacturer} onChange={(e) => setSys({...sys, manufacturer: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div></div><div>{fieldLabel('System Description *')}<textarea value={sys.system_description} onChange={(e) => setSys({...sys, system_description: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} /></div><div className="grid grid-cols-2 gap-4"><div>{fieldLabel('Deployment Type')}<select value={sys.deployment_type} onChange={(e) => setSys({...sys, deployment_type: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="">Select...</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option><option value="hybrid">Indoor + Outdoor</option><option value="virtual">Virtual / Cloud</option></select></div><div>{fieldLabel('Environment')}<select value={sys.environment} onChange={(e) => setSys({...sys, environment: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="">Select...</option><option value="warehouse">Warehouse / Logistics</option><option value="manufacturing">Manufacturing Floor</option><option value="road">Public Road</option><option value="airspace">Airspace</option><option value="clinical">Clinical / Hospital</option><option value="data_center">Data Center</option><option value="agriculture">Agriculture / Field</option><option value="construction">Construction Site</option><option value="other">Other</option></select></div></div><div className="grid grid-cols-2 gap-4"><div>{fieldLabel('Agent Deployment Method')}<select value={sys.integration_method} onChange={(e) => setSys({...sys, integration_method: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="python">Python Package</option><option value="docker">Docker Container</option><option value="kubernetes">Kubernetes</option></select></div><div>{fieldLabel('Expected Actions / Day')}<select value={sys.expected_volume} onChange={(e) => setSys({...sys, expected_volume: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="">Select...</option><option value="low">{"Low (< 1,000)"}</option><option value="medium">Medium (1K — 10K)</option><option value="high">High (10K — 100K)</option><option value="very_high">Very High (100K+)</option></select></div></div><div>{fieldLabel('Compliance Requirements')}<input type="text" value={sys.compliance_requirements} onChange={(e) => setSys({...sys, compliance_requirements: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., ISO 26262, FDA 510(k), FAA Part 107, SOC 2" />{helpText('List any regulatory or compliance frameworks your system must adhere to.')}</div></div>)}
        {step === 3 && (<div className="space-y-4">{sectionHead('Operational Design Domain')}<div>{fieldLabel('ODD Description *')}<textarea value={odd.odd_description} onChange={(e) => setOdd({...odd, odd_description: e.target.value})} rows={5} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Describe the operating domain in plain language: where, how, and under what conditions the system operates." />{helpText("This is the human-readable description of your system's intended operating domain. Specific numeric limits will be defined in the next step.")}</div><div className="grid grid-cols-2 gap-4"><div>{fieldLabel('Facility / Deployment Location')}<input type="text" value={odd.facility_location} onChange={(e) => setOdd({...odd, facility_location: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="Address or region" /></div><div>{fieldLabel('Preferred Test Start Date')}<input type="date" value={odd.preferred_test_date} onChange={(e) => setOdd({...odd, preferred_test_date: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div></div><div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px', marginTop: '8px'}}>{sectionHead('Environmental Conditions')}</div><div className="grid grid-cols-3 gap-4"><div>{fieldLabel('Temp Min')}<input type="number" value={odd.temp_min} onChange={(e) => setOdd({...odd, temp_min: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., 32" /></div><div>{fieldLabel('Temp Max')}<input type="number" value={odd.temp_max} onChange={(e) => setOdd({...odd, temp_max: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., 110" /></div><div>{fieldLabel('Unit')}<select value={odd.temp_unit} onChange={(e) => setOdd({...odd, temp_unit: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="F">°F</option><option value="C">°C</option></select></div></div><div>{fieldLabel('Surface / Terrain Type')}<input type="text" value={odd.surface_type} onChange={(e) => setOdd({...odd, surface_type: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., flat concrete, paved road, gravel" /></div><div>{fieldLabel('Weather Constraints')}<input type="text" value={odd.weather_constraints} onChange={(e) => setOdd({...odd, weather_constraints: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., no operation in rain/snow, wind < 25 mph" /></div><div>{fieldLabel('Additional Notes')}<textarea value={odd.notes} onChange={(e) => setOdd({...odd, notes: e.target.value})} rows={2} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Anything else relevant to the operating domain" /></div></div>)}
        {step === 4 && (<div className="space-y-6"><div>{sectionHead('Numeric Boundaries')}{helpText('Define measurable limits: speed, temperature, altitude, weight, pressure, distance, etc.')}{numericBounds.map((b, i) => (<div key={i} style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '12px', marginTop: '8px'}}><div className="grid grid-cols-2 gap-3" style={{marginBottom: '8px'}}><input type="text" value={b.name} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'name', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Name (e.g., Speed Limit)" /><input type="text" value={b.parameter} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'parameter', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Parameter (e.g., speed)" /></div><div className="grid grid-cols-5 gap-3"><input type="number" value={b.min_value} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'min_value', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Min" /><input type="number" value={b.max_value} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'max_value', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Max" /><input type="number" value={b.hard_limit} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'hard_limit', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Hard limit" /><input type="text" value={b.unit} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'unit', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Unit" /><div style={{display: 'flex', gap: '4px'}}><input type="number" value={b.tolerance} onChange={(e) => updateRow(numericBounds, setNumericBounds, i, 'tolerance', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px', flex: 1}} placeholder="±Tol" />{numericBounds.length > 1 && <button onClick={() => removeRow(numericBounds, setNumericBounds, i)} style={{background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '0 8px', fontSize: '14px'}}>×</button>}</div></div></div>))}<button onClick={() => addRow(numericBounds, setNumericBounds, { name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' })} style={{marginTop: '8px', background: 'transparent', border: `1px dashed ${styles.borderGlass}`, borderRadius: '6px', padding: '8px 16px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', width: '100%'}}>+ Add Numeric Boundary</button></div><div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px'}}>{sectionHead('Geographic Boundaries')}{helpText('Define the physical operating zone. Enter center coordinates and radius.')}{geoBounds.map((b, i) => (<div key={i} style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '12px', marginTop: '8px'}}><div className="grid grid-cols-2 gap-3" style={{marginBottom: '8px'}}><input type="text" value={b.name} onChange={(e) => updateRow(geoBounds, setGeoBounds, i, 'name', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Name (e.g., Operating Zone)" /><select value={b.boundary_type} onChange={(e) => updateRow(geoBounds, setGeoBounds, i, 'boundary_type', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}}><option value="circle">Radius from Point</option><option value="polygon">Polygon (contact us)</option></select></div><div className="grid grid-cols-4 gap-3"><input type="number" step="any" value={b.lat} onChange={(e) => updateRow(geoBounds, setGeoBounds, i, 'lat', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Latitude" /><input type="number" step="any" value={b.lon} onChange={(e) => updateRow(geoBounds, setGeoBounds, i, 'lon', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Longitude" /><input type="number" value={b.radius_meters} onChange={(e) => updateRow(geoBounds, setGeoBounds, i, 'radius_meters', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Radius (m)" /><div style={{display: 'flex', gap: '4px'}}><input type="number" value={b.altitude_max} onChange={(e) => updateRow(geoBounds, setGeoBounds, i, 'altitude_max', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px', flex: 1}} placeholder="Alt max (m)" />{geoBounds.length > 1 && <button onClick={() => removeRow(geoBounds, setGeoBounds, i)} style={{background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '0 8px', fontSize: '14px'}}>×</button>}</div></div></div>))}<button onClick={() => addRow(geoBounds, setGeoBounds, { name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' })} style={{marginTop: '8px', background: 'transparent', border: `1px dashed ${styles.borderGlass}`, borderRadius: '6px', padding: '8px 16px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', width: '100%'}}>+ Add Geographic Boundary</button></div><div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px'}}>{sectionHead('Time Boundaries')}{helpText('Define allowed operating hours and days.')}{timeBounds.map((b, i) => (<div key={i} style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '12px', marginTop: '8px'}}><div className="grid grid-cols-4 gap-3" style={{marginBottom: '8px'}}><input type="text" value={b.name} onChange={(e) => updateRow(timeBounds, setTimeBounds, i, 'name', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Name" /><input type="number" min="0" max="23" value={b.start_hour} onChange={(e) => updateRow(timeBounds, setTimeBounds, i, 'start_hour', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Start hour" /><input type="number" min="0" max="23" value={b.end_hour} onChange={(e) => updateRow(timeBounds, setTimeBounds, i, 'end_hour', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="End hour" /><select value={b.timezone} onChange={(e) => updateRow(timeBounds, setTimeBounds, i, 'timezone', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}}><option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Los_Angeles">Pacific</option><option value="UTC">UTC</option><option value="Europe/London">UK</option><option value="Europe/Berlin">CET</option><option value="Asia/Tokyo">JST</option></select></div><div style={{display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center'}}><span style={{color: styles.textTertiary, fontSize: '11px', marginRight: '4px'}}>Days:</span>{dayNames.map((d, di) => (<label key={di} style={{display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '11px', color: b.days.includes(di) ? styles.purpleBright : styles.textTertiary}}><input type="checkbox" checked={b.days.includes(di)} onChange={(e) => { const newDays = e.target.checked ? [...b.days, di].sort() : b.days.filter(x => x !== di); updateRow(timeBounds, setTimeBounds, i, 'days', newDays); }} style={{accentColor: styles.purpleBright, width: '12px', height: '12px'}} />{d}</label>))}{timeBounds.length > 1 && <button onClick={() => removeRow(timeBounds, setTimeBounds, i)} style={{marginLeft: 'auto', background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '2px 8px', fontSize: '14px'}}>×</button>}</div></div>))}<button onClick={() => addRow(timeBounds, setTimeBounds, { name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] })} style={{marginTop: '8px', background: 'transparent', border: `1px dashed ${styles.borderGlass}`, borderRadius: '6px', padding: '8px 16px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', width: '100%'}}>+ Add Time Boundary</button></div><div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px'}}>{sectionHead('State Boundaries')}{helpText('Define allowed/forbidden operational states and modes.')}{stateBounds.map((b, i) => (<div key={i} style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '12px', marginTop: '8px'}}><div className="grid grid-cols-2 gap-3" style={{marginBottom: '8px'}}><input type="text" value={b.name} onChange={(e) => updateRow(stateBounds, setStateBounds, i, 'name', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Name (e.g., Mode Check)" /><input type="text" value={b.parameter} onChange={(e) => updateRow(stateBounds, setStateBounds, i, 'parameter', e.target.value)} className="px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Parameter (e.g., mode)" /></div><div className="grid grid-cols-2 gap-3"><div><input type="text" value={b.allowed_values} onChange={(e) => updateRow(stateBounds, setStateBounds, i, 'allowed_values', e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Allowed (comma-sep)" /><span style={{fontSize: '9px', color: styles.textTertiary}}>e.g., autonomous, semi-autonomous</span></div><div style={{display: 'flex', gap: '4px'}}><div style={{flex: 1}}><input type="text" value={b.forbidden_values} onChange={(e) => updateRow(stateBounds, setStateBounds, i, 'forbidden_values', e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none" style={{...inputStyle, fontSize: '13px'}} placeholder="Forbidden (comma-sep)" /><span style={{fontSize: '9px', color: styles.textTertiary}}>e.g., manual_override, degraded</span></div>{stateBounds.length > 1 && <button onClick={() => removeRow(stateBounds, setStateBounds, i)} style={{background: 'rgba(214,92,92,0.15)', border: 'none', borderRadius: '6px', color: styles.accentRed, cursor: 'pointer', padding: '0 8px', fontSize: '14px', alignSelf: 'flex-start'}}>×</button>}</div></div></div>))}<button onClick={() => addRow(stateBounds, setStateBounds, { name: '', parameter: '', allowed_values: '', forbidden_values: '' })} style={{marginTop: '8px', background: 'transparent', border: `1px dashed ${styles.borderGlass}`, borderRadius: '6px', padding: '8px 16px', color: styles.purpleBright, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', width: '100%'}}>+ Add State Boundary</button></div></div>)}
        {step === 5 && (<div className="space-y-4">{sectionHead('Safety & Failure Mode')}<div className="grid grid-cols-2 gap-4"><div>{fieldLabel('On Boundary Violation *')}<select value={safety.violation_action} onChange={(e) => setSafety({...safety, violation_action: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="stop">Full Stop</option><option value="slow">Slow / Degrade</option><option value="alert">Alert Only (log + notify)</option><option value="revert">Revert to Last Safe State</option><option value="handoff">Hand Off to Human Operator</option></select></div><div>{fieldLabel('On Connection Loss *')}<select value={safety.connection_loss_action} onChange={(e) => setSafety({...safety, connection_loss_action: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="stop">Full Stop</option><option value="continue">Continue (local enforcement)</option><option value="degrade">Degrade to Reduced Capability</option></select></div></div><div><label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: styles.textSecondary, fontSize: '14px'}}><input type="checkbox" checked={safety.fail_closed} onChange={(e) => setSafety({...safety, fail_closed: e.target.checked})} style={{accentColor: styles.purpleBright}} />Fail-Closed Mode (recommended)</label>{helpText('When enabled, the agent blocks ALL actions if it cannot verify boundaries.')}</div><div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '16px'}}>{sectionHead('Emergency Contact')}</div><div className="grid grid-cols-3 gap-4"><div>{fieldLabel('Name')}<input type="text" value={safety.emergency_contact_name} onChange={(e) => setSafety({...safety, emergency_contact_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div><div>{fieldLabel('Phone')}<input type="tel" value={safety.emergency_contact_phone} onChange={(e) => setSafety({...safety, emergency_contact_phone: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div><div>{fieldLabel('Email')}<input type="email" value={safety.emergency_contact_email} onChange={(e) => setSafety({...safety, emergency_contact_email: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} /></div></div><div>{fieldLabel('Escalation Triggers')}<textarea value={safety.escalation_triggers} onChange={(e) => setSafety({...safety, escalation_triggers: e.target.value})} rows={2} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Conditions requiring immediate human takeover (e.g., sensor failure, repeated violations)" /></div><div>{fieldLabel('Existing Safety Systems')}<textarea value={safety.existing_safety_systems} onChange={(e) => setSafety({...safety, existing_safety_systems: e.target.value})} rows={2} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Other safety mechanisms in place (e.g., physical e-stop, LIDAR, safety PLC)" /></div></div>)}
        {step === 6 && (<div className="space-y-4">{sectionHead('Review Application')}<p style={{color: styles.textSecondary, fontSize: '13px', lineHeight: '1.5'}}>Review your application. After submission, our team will review your boundary definitions and configure the ENVELO agent for your system.</p><div style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '16px'}}><div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Organization</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{org.organization_name}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Contact</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{org.contact_name || org.contact_email}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>System</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{sys.system_name} ({sys.system_type})</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Deployment</span><br/><span style={{color: styles.textPrimary, fontSize: '14px'}}>{sys.deployment_type || 'Not specified'} — {sys.environment || 'Not specified'}</span></div></div></div><div style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '16px'}}><span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.purpleBright}}>Boundary Summary</span><div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '12px'}}><div style={{textAlign: 'center', padding: '12px', background: 'rgba(91,75,138,0.1)', borderRadius: '6px'}}><div style={{fontSize: '20px', fontWeight: 'bold', color: styles.purpleBright}}>{numericBounds.filter(b => b.name).length}</div><div style={{fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>Numeric</div></div><div style={{textAlign: 'center', padding: '12px', background: 'rgba(91,75,138,0.1)', borderRadius: '6px'}}><div style={{fontSize: '20px', fontWeight: 'bold', color: styles.purpleBright}}>{geoBounds.filter(b => b.name).length}</div><div style={{fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>Geographic</div></div><div style={{textAlign: 'center', padding: '12px', background: 'rgba(91,75,138,0.1)', borderRadius: '6px'}}><div style={{fontSize: '20px', fontWeight: 'bold', color: styles.purpleBright}}>{timeBounds.filter(b => b.name).length}</div><div style={{fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>Time</div></div><div style={{textAlign: 'center', padding: '12px', background: 'rgba(91,75,138,0.1)', borderRadius: '6px'}}><div style={{fontSize: '20px', fontWeight: 'bold', color: styles.purpleBright}}>{stateBounds.filter(b => b.name).length}</div><div style={{fontSize: '10px', color: styles.textTertiary, marginTop: '2px'}}>State</div></div></div></div><div style={{background: 'rgba(255,255,255,0.02)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '16px'}}><span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.purpleBright}}>Safety Configuration</span><div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px'}}><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>On Violation</span><br/><span style={{color: styles.textPrimary, fontSize: '13px'}}>{safety.violation_action}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>On Connection Loss</span><br/><span style={{color: styles.textPrimary, fontSize: '13px'}}>{safety.connection_loss_action}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Fail-Closed</span><br/><span style={{color: safety.fail_closed ? '#5CD685' : styles.accentRed, fontSize: '13px'}}>{safety.fail_closed ? 'Enabled' : 'Disabled'}</span></div><div><span style={{color: styles.textTertiary, fontSize: '11px'}}>Agent Method</span><br/><span style={{color: styles.textPrimary, fontSize: '13px'}}>{sys.integration_method}</span></div></div></div></div>)}
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${styles.borderGlass}`}}>{step > 1 ? (<button onClick={() => setStep(step - 1)} style={{background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '10px 24px', color: styles.textSecondary, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Back</button>) : <div />}{step < totalSteps ? (<button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} style={{background: canNext() ? styles.purplePrimary : 'rgba(255,255,255,0.05)', border: `1px solid ${canNext() ? styles.purpleBright : styles.borderGlass}`, borderRadius: '8px', padding: '10px 32px', color: canNext() ? '#fff' : styles.textTertiary, cursor: canNext() ? 'pointer' : 'not-allowed', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Continue</button>) : (<button onClick={handleSubmit} style={{background: '#5CD685', border: '1px solid #5CD685', borderRadius: '8px', padding: '10px 32px', color: '#1a1f2e', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold'}}>Submit Application</button>)}</div>
      </Panel>
    </div>
  );
}

// Application Detail
function ApplicationDetail() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [testCreated, setTestCreated] = useState(null);

  useEffect(() => {
    if (id) {
      api.get(`/api/applications/${id}`).then(res => setApp(res.data)).catch(console.error);
    }
  }, [id]);

  const handleScheduleTest = async () => {
    if (!window.confirm('Schedule a CAT-72 test for this application? The test will need to be started manually.')) return;
    setScheduling(true);
    try {
      const res = await api.post('/api/cat72/tests', { application_id: parseInt(id) });
      setTestCreated(res.data);
      alert(`CAT-72 Test created: ${res.data.test_id}\nGo to CAT-72 Console to start the test.`);
    } catch (err) {
      alert('Failed to create test: ' + (err.response?.data?.detail || err.message));
    }
    setScheduling(false);
  };

  const navigate = useNavigate();
  
  const handleDeleteApplication = async () => {
    if (!window.confirm('Are you sure you want to delete this application? This cannot be undone.')) return;
    try {
      await api.delete(`/api/applications/${id}`);
      alert('Application deleted');
      navigate('/applications');
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (!app) return <div style={{color: styles.textTertiary}}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center gap-2 no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
        <div style={{display: 'flex', gap: '12px'}}>
          {(app.state === 'pending' || app.state === 'under_review') && (
            <button
              onClick={handleApprove}
              className="px-4 py-2 rounded-lg transition-all"
              style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.4)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
            >
              Approve Application
            </button>
          )}
          {app.state === 'approved' && (
            <button
              onClick={handleScheduleTest}
              disabled={scheduling}
              className="px-4 py-2 rounded-lg transition-all"
              style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: scheduling ? 'wait' : 'pointer', opacity: scheduling ? 0.7 : 1}}
            >
              {scheduling ? 'Scheduling...' : 'Schedule CAT-72 Test'}
            </button>
          )}
          <button
            onClick={handleDeleteApplication}
            className="px-4 py-2 rounded-lg transition-all"
            style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
          >
            Delete
          </button>
        </div>
      </div>
      
      {testCreated && (
        <div className="p-4 rounded-lg" style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(157,140,207,0.3)'}}>
          <p style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}>
            Test Created: {testCreated.test_id} — <Link to="/cat72" style={{color: styles.purpleBright}}>Go to CAT-72 Console</Link>
          </p>
        </div>
      )}
      
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Application {app.application_number}</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>{app.system_name}</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>{app.system_description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Organization</h2>
          <p style={{color: styles.textPrimary, fontSize: '18px', marginBottom: '8px'}}>{app.organization_name}</p>
          <p style={{color: styles.textSecondary, marginBottom: '4px'}}><strong>Contact:</strong> {app.contact_name}</p>
          <p style={{color: styles.textSecondary, marginBottom: '4px'}}><strong>Email:</strong> {app.contact_email}</p>
          {app.contact_phone && <p style={{color: styles.textSecondary}}><strong>Phone:</strong> {app.contact_phone}</p>}
        </Panel>
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Status</h2>
          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1 rounded" style={{
              background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : app.state === 'revoked' ? 'rgba(214,92,92,0.15)' : 'rgba(214,160,92,0.15)',
              color: app.state === 'conformant' ? styles.accentGreen : app.state === 'revoked' ? styles.accentRed : styles.accentAmber,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              {app.state}
            </span>
            <select 
              value={app.state}
              onChange={async (e) => {
                const newState = e.target.value;
                if (!window.confirm(`Change status to ${newState.toUpperCase()}?`)) return;
                try {
                  await api.patch(`/api/applications/${id}/state?new_state=${newState}`);
                  setApp({...app, state: newState});
                } catch (err) {
                  alert('Failed to update state: ' + (err.response?.data?.detail || err.message));
                }
              }}
              className="px-3 py-2 rounded-lg"
              style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px'}}
            >
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved (Agent Access)</option>
              <option value="testing">Testing (CAT-72 Active)</option>
              <option value="conformant">Conformant</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <p style={{color: styles.textSecondary}}><strong>Submitted:</strong> {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'N/A'}</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>System Details</h2>
          <p style={{color: styles.textSecondary, marginBottom: '8px'}}><strong>Version:</strong> {app.system_version || 'N/A'}</p>
          <p style={{color: styles.textSecondary, marginBottom: '8px'}}><strong>Manufacturer:</strong> {app.manufacturer || 'N/A'}</p>
          {app.facility_location && <p style={{color: styles.textSecondary, marginBottom: '8px'}}><strong>Facility:</strong> {app.facility_location}</p>}
          {app.preferred_test_date && <p style={{color: styles.textSecondary}}><strong>Preferred Test Date:</strong> {new Date(app.preferred_test_date).toLocaleDateString()}</p>}
        </Panel>
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Safety Boundaries & Operational Limits</h2>
          <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{typeof app.envelope_definition === 'object' ? JSON.stringify(app.envelope_definition, null, 2) : (app.envelope_definition || 'Not specified')}</p>
        </Panel>
      </div>

      {/* Boundary Editor - Admin Only */}
      <BoundaryEditor
        applicationId={app.id}
        initialBoundaries={app.envelope_definition || {}}
        onSave={async (boundaries) => {
          try {
            await api.patch(`/api/applicants/${app.id}`, { envelope_definition: boundaries });
            alert("Boundaries saved!");
            setApp({...app, envelope_definition: boundaries});
          } catch (e) {
            alert("Failed to save: " + e.message);
          }
        }}
      />

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>ODD Specification</h2>
        <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{typeof app.odd_specification === 'object' ? (app.odd_specification?.description || JSON.stringify(app.odd_specification, null, 2)) : app.odd_specification}</p>
      </Panel>

      {app.notes && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Notes</h2>
          <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{app.notes}</p>
        </Panel>
      )}
    </div>
  );
}

// CAT-72 Console
function CAT72Console() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState({});

  const loadTests = () => {
    api.get('/api/cat72/tests').then(res => setTests(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadTests();
  }, []);

  const handleStart = async (testId) => {
    if (!window.confirm('Start this CAT-72 test? The 72-hour timer will begin.')) return;
    setLoading(prev => ({...prev, [testId]: 'starting'}));
    try {
      await api.post(`/api/cat72/tests/${testId}/start`);
      loadTests();
    } catch (err) {
      alert('Failed to start test: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const handleStop = async (testId) => {
    if (!window.confirm('Stop this CAT-72 test and evaluate results?')) return;
    setLoading(prev => ({...prev, [testId]: 'stopping'}));
    try {
      await api.post(`/api/cat72/tests/${testId}/stop`);
      loadTests();
    } catch (err) {
      alert('Failed to stop test: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  const handleIssueCertificate = async (testId) => {
    if (!window.confirm('Issue ODDC certificate for this passed test?')) return;
    setLoading(prev => ({...prev, [testId]: 'issuing'}));
    try {
      const res = await api.post(`/api/certificates/issue/${testId}`);
      alert(`Certificate issued: ${res.data.certificate_number}\nVerification URL: ${res.data.verification_url}`);
      loadTests();
    } catch (err) {
      alert('Failed to issue certificate: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(prev => ({...prev, [testId]: null}));
  };

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Testing</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>CAT-72 Console</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>72-hour Convergence Authorization Tests</p>
      </div>

      <Panel>
        <table className="w-full">
          <thead>
            <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Test ID</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>State</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Progress</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Result</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <td className="px-4 py-4" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{test.organization_name} - {test.system_name}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded" style={{
                    background: test.state === 'running' ? 'rgba(214,160,92,0.15)' : test.state === 'completed' ? 'rgba(92,214,133,0.15)' : 'rgba(157,140,207,0.15)',
                    color: test.state === 'running' ? styles.accentAmber : test.state === 'completed' ? styles.accentGreen : styles.purpleBright,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}>
                    {test.state}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1 rounded-full overflow-hidden" style={{background: 'rgba(255,255,255,0.1)'}}>
                      <div className="h-full rounded-full" style={{width: `${test.state === 'completed' ? 100 : (test.elapsed_seconds / (test.duration_hours * 3600)) * 100}%`, background: styles.purpleBright}} />
                    </div>
                    <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary}}>
                      {test.state === 'completed' ? '100%' : `${Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100)}%`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {test.result && (
                    <span style={{
                      color: test.result === 'PASS' ? styles.accentGreen : styles.accentRed,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '11px',
                      fontWeight: 500,
                    }}>
                      {test.result}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    {test.state === 'scheduled' && (
                      <button
                        onClick={() => handleStart(test.test_id)}
                        disabled={loading[test.test_id]}
                        className="px-3 py-1 rounded transition-colors"
                        style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(157,140,207,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
                      >
                        {loading[test.test_id] === 'starting' ? '...' : 'Start'}
                      </button>
                    )}
                    {test.state === 'running' && (
                      <button
                        onClick={() => handleStop(test.test_id)}
                        disabled={loading[test.test_id]}
                        className="px-3 py-1 rounded transition-colors"
                        style={{background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
                      >
                        {loading[test.test_id] === 'stopping' ? '...' : 'Stop & Evaluate'}
                      </button>
                    )}
                    {test.state === 'completed' && test.result === 'PASS' && !test.certificate_issued && (
                      <button
                        onClick={() => handleIssueCertificate(test.test_id)}
                        disabled={loading[test.test_id]}
                        className="px-3 py-1 rounded transition-colors"
                        style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
                      >
                        {loading[test.test_id] === 'issuing' ? '...' : 'Issue Certificate'}
                      </button>
                    )}
                    {test.certificate_issued && (
                      <><span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px'}}>✓ Certified</span><a href={`${API_BASE}/api/applications/${test.application_id}/certificate/download`} target="_blank" style={{marginLeft: '8px', padding: '2px 8px', background: styles.purplePrimary, borderRadius: '4px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', textDecoration: 'none'}}>Download PDF</a></>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tests.length === 0 && (
          <div className="text-center py-12" style={{color: styles.textTertiary}}>No tests yet</div>
        )}
      </Panel>
    </div>
  );
}

// Certificates
function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    api.get('/api/certificates/').then(res => setCertificates(res.data)).catch(console.error);
  }, []);

  const filteredCerts = certificates.filter(cert => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return cert.state === 'conformant' || cert.state === 'active' || cert.state === 'issued';
    return cert.state === statusFilter;
  });

  const counts = {
    all: certificates.length,
    active: certificates.filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued').length,
    suspended: certificates.filter(c => c.state === 'suspended').length,
    revoked: certificates.filter(c => c.state === 'revoked').length,
  };

  const filterTabs = [
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'revoked', label: 'Revoked' },
    { key: 'all', label: 'All Records' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Records</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Certificates</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Issued ODDC conformance determinations</p>
      </div>

      {/* Filter Tabs */}
      <div style={{display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', border: `1px solid ${styles.borderGlass}`}}>
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              background: statusFilter === tab.key ? styles.purplePrimary : 'transparent',
              color: statusFilter === tab.key ? '#fff' : styles.textTertiary,
            }}
          >
            {tab.label} {counts[tab.key] > 0 ? `(${counts[tab.key]})` : ''}
          </button>
        ))}
      </div>

      <Panel>
        <table className="w-full">
          <thead>
            <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Certificate #</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>System</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Organization</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Status</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Expires</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCerts.map((cert) => (
              <tr key={cert.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <td className="px-4 py-4" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{cert.certificate_number}</td>
                <td className="px-4 py-4" style={{color: styles.textPrimary}}>{cert.system_name}</td>
                <td className="px-4 py-4" style={{color: styles.textSecondary}}>{cert.organization_name}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded" style={{
                    background: cert.state === 'conformant' ? 'rgba(92,214,133,0.15)' : cert.state === 'suspended' ? 'rgba(214,160,92,0.15)' : 'rgba(214,92,92,0.15)',
                    color: cert.state === 'conformant' ? styles.accentGreen : cert.state === 'suspended' ? styles.accentAmber : styles.accentRed,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}>
                    {cert.state}
                  </span>
                </td>
                <td className="px-4 py-4" style={{color: styles.textTertiary, fontSize: '14px'}}>{cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-4">
                  <a 
                    href={`https://sentinel-authority-production.up.railway.app/api/certificates/${cert.certificate_number}/pdf`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-3 py-1 rounded transition-colors no-underline"
                    style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}
                  >
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCerts.length === 0 && (
          <div className="text-center py-12" style={{color: styles.textTertiary}}>
            {certificates.length === 0 ? 'No certificates issued' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}certificates`}
          </div>
        )}
      </Panel>
    </div>
  );
}

// Licensees
function LicenseesPage() {
  const [licensees, setLicensees] = useState([]);

  useEffect(() => {
    api.get('/api/licensees/').then(res => setLicensees(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Partners</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Licensed Implementers</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Authorized ENVELO integrators</p>
      </div>

      <Panel>
        <table className="w-full">
          <thead>
            <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Company</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Contact</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {licensees.map((lic) => (
              <tr key={lic.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <td className="px-4 py-4" style={{color: styles.textPrimary}}>{lic.company_name}</td>
                <td className="px-4 py-4" style={{color: styles.textSecondary}}>{lic.contact_email}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1 rounded" style={{
                    background: lic.status === 'active' ? 'rgba(92,214,133,0.15)' : 'rgba(214,160,92,0.15)',
                    color: lic.status === 'active' ? styles.accentGreen : styles.accentAmber,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}>
                    {lic.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {licensees.length === 0 && (
          <div className="text-center py-12" style={{color: styles.textTertiary}}>No licensees yet</div>
        )}
      </Panel>
    </div>
  );
}

// Verify Page (Public)
function VerifyPage() {
  const [mode, setMode] = useState("verify"); // verify or search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!certNumber.trim()) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.get(`/api/verify/${certNumber}`);
      setResult(res.data);
    } catch (err) {
      setError('Certificate not found');
    }
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setError("");
    setSearchResults([]);
    setLoading(true);
    try {
      const res = await api.get(`/api/registry/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.results || []); if (!res.data.results || res.data.results.length === 0) setError("No certificates found for that search");
    } catch (err) {
      setError("Unable to connect to registry");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: styles.bgDeep}}>
      <Link to="/dashboard" style={{
        position: 'fixed', top: '24px', right: '32px', zIndex: 20,
        color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
        transition: 'color 0.2s',
      }}><Home className="w-3.5 h-3.5" /> Dashboard</Link>
      {/* Animated background gradients */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(91,75,138,0.18) 0%, transparent 65%)',
        animation: 'float1 25s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-15%', width: '800px', height: '800px',
        background: 'radial-gradient(circle, rgba(92,214,133,0.06) 0%, transparent 65%)',
        animation: 'float2 30s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '10%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(157,140,207,0.10) 0%, transparent 65%)',
        animation: 'float3 15s ease-in-out infinite', pointerEvents: 'none',
      }} />
      
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '120px 120px', opacity: 0.2, pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 20%, transparent 70%)',
      }} />

      {/* Decorative elements */}
      <div style={{ position: 'absolute', top: '15%', left: '8%', width: '1px', height: '150px',
        background: 'linear-gradient(to bottom, transparent, rgba(157,140,207,0.4), transparent)',
      }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '5%', width: '100px', height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(92,214,133,0.4), transparent)',
      }} />

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -30px) scale(1.05); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-40px, -40px) scale(1.1); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 30px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 0; } 100% { transform: scale(0.9); opacity: 0.6; } }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        .verify-input { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .verify-input:focus { border-color: rgba(157,140,207,0.6) !important; box-shadow: 0 0 0 3px rgba(157,140,207,0.1), 0 4px 20px rgba(0,0,0,0.2); transform: translateY(-1px); }
        .verify-btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .verify-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(91,75,138,0.5); }
        .verify-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      `}</style>

      <div className="w-full max-w-lg relative z-10">
        {/* Brand section */}
        <div className="text-center mb-10">
          <div className="relative flex justify-center mb-6" style={{height: '100px', alignItems: 'center'}}>
            <div style={{
              position: 'absolute', width: '80px', height: '80px',
              border: '1px solid rgba(157,140,207,0.3)', borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', width: '100px', height: '100px',
              border: '1px solid rgba(157,140,207,0.15)', borderRadius: '50%',
              animation: 'pulse-ring 3s ease-out infinite 0.5s',
            }} />
            <div style={{
              width: '56px', height: '56px',
              background: 'linear-gradient(135deg, #5B4B8A 0%, #8b5cf6 100%)',
              border: '2px solid #9d8ccf', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(157,140,207,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
              <div style={{
                width: '18px', height: '18px',
                background: 'radial-gradient(circle, #e8e0ff 0%, #c4b8e8 100%)',
                borderRadius: '50%', boxShadow: '0 0 20px rgba(196,184,232,0.5)',
              }} />
            </div>
          </div>
          
          <h1 style={{
            fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200,
            color: styles.textPrimary, margin: '0 0 8px 0', letterSpacing: '-0.02em',
          }}>
            Certificate <span style={{color: styles.purpleBright, fontStyle: 'italic'}}>Verification</span>
          </h1>
          
          <p style={{
            color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '16px',
          }}>Sentinel Authority • ODDC Registry</p>

        {/* Mode Tabs */}
        <div style={{display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px"}}>
          <button onClick={() => setMode("verify")} style={{
            padding: "10px 24px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "1px",
            background: mode === "verify" ? styles.purplePrimary : "rgba(255,255,255,0.05)",
            color: mode === "verify" ? "#fff" : styles.textTertiary,
            transition: "all 0.2s"
          }}>Verify Certificate</button>
          <button onClick={() => setMode("search")} style={{
            padding: "10px 24px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "1px",
            background: mode === "search" ? styles.purplePrimary : "rgba(255,255,255,0.05)",
            color: mode === "search" ? "#fff" : styles.textTertiary,
            transition: "all 0.2s"
          }}>Search Registry</button>
        </div>
        </div>
        
        {/* Verification card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset', transition: 'all 0.3s ease', minHeight: '280px',
        }}>
{mode === "verify" && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label style={{
                display: 'block', marginBottom: '10px', color: styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center',
              }}>Certificate Number</label>
              <input
                type="text"
                placeholder="ODDC-2026-00001"
                value={certNumber}
                onChange={(e) => { setCertNumber(e.target.value.toUpperCase()); setError(""); setResult(null); }}
                className="verify-input w-full px-5 py-4 rounded-xl outline-none"
                style={{
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '18px', textAlign: 'center', letterSpacing: '2px',
                }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !certNumber.trim()}
              className="verify-btn w-full py-4 rounded-xl font-medium"
              style={{
                background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
                border: '1px solid rgba(157,140,207,0.5)', color: '#fff',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(91,75,138,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              }}>
              {loading ? (
                <><RefreshCw className="w-4 h-4" style={{animation: 'spin 1s linear infinite'}} /> Verifying...</>
              ) : (
                <><Search className="w-4 h-4" /> Verify Certificate</>
              )}
            </button>
          </form>

          )}

          {mode === "search" && (<>
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label style={{
                display: 'block', marginBottom: '10px', color: styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center',
              }}>Organization or System Name</label>
              <input
                type="text"
                placeholder="Company name or system..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setError(""); }}
                className="verify-input w-full px-5 py-4 rounded-xl outline-none"
                style={{
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                  color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '18px', textAlign: 'center', letterSpacing: '2px',
                }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !searchQuery.trim()}
              className="verify-btn w-full py-4 rounded-xl font-medium"
              style={{
                background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
                border: '1px solid rgba(157,140,207,0.5)', color: '#fff',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(91,75,138,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              }}>
              {loading ? (
                <><RefreshCw className="w-4 h-4" style={{animation: 'spin 1s linear infinite'}} /> Searching...</>
              ) : (
                <><Search className="w-4 h-4" /> Search Registry</>
              )}
            </button>
          </form>
          {searchResults.length > 0 && (
                <div style={{marginTop: "24px"}}>
                  <p style={{color: styles.textTertiary, fontSize: "12px", marginBottom: "12px", textAlign: "center"}}>
                    {searchResults.length} certificate(s) found
                  </p>
                  {searchResults.map((cert) => (
                    <div key={cert.certificate_number} onClick={() => {setCertNumber(cert.certificate_number); setMode("verify"); setTimeout(() => document.querySelector("form").requestSubmit(), 100);}} style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px", padding: "16px", marginBottom: "8px", cursor: "pointer",
                      transition: "all 0.2s",
                    }}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                        <div>
                          <div style={{color: styles.textPrimary, fontWeight: 500}}>{cert.organization_name}</div>
                          <div style={{color: styles.textTertiary, fontSize: "12px"}}>{cert.system_name}</div>
                        </div>
                        <div style={{textAlign: "right"}}>
                          <div style={{color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px"}}>{cert.certificate_number}</div>
                          <div style={{color: styles.accentGreen, fontSize: "10px", textTransform: "uppercase"}}>{cert.state}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          )}
          </>)}
          <div style={{minHeight: '80px', marginTop: '16px'}}>
          {error && (
            <div className="p-5 rounded-xl text-center" style={{
              background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)',
            }}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px'}}>
                <AlertTriangle className="w-5 h-5" style={{color: styles.accentRed}} />
                <span style={{color: styles.accentRed, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Not Found</span>
              </div>
              <p style={{color: styles.textSecondary, fontSize: '14px'}}>{error}</p>
            </div>
          )}

          {result && (result.status === 'NOT_FOUND' || result.state === 'NOT_FOUND') && (
            <div className="mt-6 p-5 rounded-xl text-center" style={{
              background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)',
            }}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px'}}>
                <AlertTriangle className="w-5 h-5" style={{color: styles.accentRed}} />
                <span style={{color: styles.accentRed, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Certificate Not Found</span>
              </div>
              <p style={{color: styles.textSecondary, fontSize: '14px'}}>No certificate exists with number: <strong>{result.certificate_number}</strong></p>
            </div>
          )}

          {result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (
            <div className="mt-6 rounded-xl overflow-hidden" style={{
              background: 'rgba(92,214,133,0.08)', border: '1px solid rgba(92,214,133,0.25)',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px', background: 'rgba(92,214,133,0.15)',
                borderBottom: '1px solid rgba(92,214,133,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <CheckCircle className="w-5 h-5" style={{color: styles.accentGreen}} />
                  <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500}}>Valid Certificate</span>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '10px',
                  background: 'rgba(92,214,133,0.2)', color: styles.accentGreen,
                  fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{width: '6px', height: '6px', borderRadius: '50%', background: styles.accentGreen, boxShadow: '0 0 8px rgba(92,214,133,0.8)'}}></span>
                  {result.state || 'CONFORMANT'}
                </span>
              </div>
              
              {/* Details */}
              <div style={{padding: '20px'}}>
                <div style={{display: 'grid', gap: '16px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Certificate</span>
                    <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', fontWeight: 500}}>{result.certificate_number}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Organization</span>
                    <span style={{color: styles.textPrimary, fontSize: '14px'}}>{result.organization_name}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>System</span>
                    <span style={{color: styles.textPrimary, fontSize: '14px'}}>{result.system_name}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px'}}>Expires</span>
                    <span style={{color: styles.textPrimary, fontSize: '14px'}}>{result.expires_at ? new Date(result.expires_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        </div>

      </div>
    </div>
  );
}





// Web-based Agent Simulator
function AgentSimulator({ apiKey }) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ pass: 0, block: 0 });

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const runSimulation = async () => {
    if (!apiKey) {
      alert('Generate an API key first');
      return;
    }
    
    setRunning(true);
    setLogs([]);
    setStats({ pass: 0, block: 0 });
    
    const sessionId = Math.random().toString(36).substring(2, 18);
    const certId = 'ODDC-2026-DEMO';
    
    addLog('ENVELO Agent starting...', 'info');
    addLog(`Session: ${sessionId}`, 'info');
    addLog('', 'info');
    
    // Register session
    addLog('Registering session...', 'info');
    try {
      await api.post('/api/envelo/sessions', {
        certificate_id: certId,
        session_id: sessionId,
        started_at: new Date().toISOString(),
        agent_version: '1.0.0-web',
        boundaries: [
          { name: 'speed', min: 0, max: 100 },
          { name: 'temperature', min: -20, max: 50 }
        ]
      }, { headers: { Authorization: `Bearer ${apiKey}` }});
      addLog('✓ Session registered', 'success');
    } catch (e) {
      addLog('✓ Session registered (simulated)', 'success');
    }
    
    addLog('', 'info');
    addLog('Boundaries defined:', 'info');
    addLog('  • speed: 0-100 km/h', 'info');
    addLog('  • temperature: -20 to 50°C', 'info');
    addLog('', 'info');
    
    // Simulate actions
    const testCases = [
      { speed: 50, temperature: 25, shouldPass: true, desc: 'Normal operation' },
      { speed: 80, temperature: 30, shouldPass: true, desc: 'Highway speed' },
      { speed: 150, temperature: 25, shouldPass: false, desc: 'Speed violation' },
      { speed: 60, temperature: 60, shouldPass: false, desc: 'Temperature violation' },
      { speed: 40, temperature: 20, shouldPass: true, desc: 'City driving' },
    ];
    
    const records = [];
    let passCount = 0;
    let blockCount = 0;
    
    for (let i = 0; i < testCases.length; i++) {
      await new Promise(r => setTimeout(r, 800));
      const tc = testCases[i];
      const result = tc.shouldPass ? 'PASS' : 'BLOCK';
      
      if (tc.shouldPass) {
        passCount++;
        addLog(`Action ${i+1}: ${tc.desc}`, 'info');
        addLog(`  speed=${tc.speed}, temp=${tc.temperature}`, 'info');
        addLog(`  ✓ PASSED`, 'success');
      } else {
        blockCount++;
        addLog(`Action ${i+1}: ${tc.desc}`, 'info');
        addLog(`  speed=${tc.speed}, temp=${tc.temperature}`, 'info');
        addLog(`  ✗ BLOCKED - Outside ODD boundaries`, 'error');
      }
      
      setStats({ pass: passCount, block: blockCount });
      
      records.push({
        timestamp: new Date().toISOString(),
        action_id: Math.random().toString(36).substring(2, 10),
        action_type: 'autonomous_action',
        result,
        execution_time_ms: Math.random() * 5,
        parameters: { speed: tc.speed, temperature: tc.temperature },
        boundary_evaluations: [
          { boundary: 'speed', passed: tc.speed <= 100 },
          { boundary: 'temperature', passed: tc.temperature <= 50 }
        ]
      });
    }
    
    addLog('', 'info');
    addLog('Sending telemetry...', 'info');
    
    // Send telemetry
    try {
      await api.post('/api/envelo/telemetry', {
        certificate_id: certId,
        session_id: sessionId,
        records,
        stats: { pass_count: passCount, block_count: blockCount }
      }, { headers: { Authorization: `Bearer ${apiKey}` }});
      addLog(`✓ Sent ${records.length} records`, 'success');
    } catch (e) {
      addLog(`✓ Sent ${records.length} records (simulated)`, 'success');
    }
    
    // End session
    try {
      await api.post(`/api/envelo/sessions/${sessionId}/end`, {
        ended_at: new Date().toISOString(),
        final_stats: { pass_count: passCount, block_count: blockCount }
      }, { headers: { Authorization: `Bearer ${apiKey}` }});
    } catch (e) {}
    
    addLog('', 'info');
    addLog('═══════════════════════════════════════', 'info');
    addLog(`Session complete: ${passCount} passed, ${blockCount} blocked`, 'success');
    addLog('Telemetry visible in dashboard below ↓', 'info');
    
    setRunning(false);
  };

  return (
    <div>
      <div style={{display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px'}}>
        <button
          onClick={runSimulation}
          disabled={running || !apiKey}
          style={{
            padding: '12px 24px',
            background: running ? 'rgba(0,0,0,0.3)' : styles.accentGreen,
            border: 'none',
            borderRadius: '6px',
            color: running ? styles.textTertiary : '#000',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px',
            fontWeight: 400,
            cursor: running || !apiKey ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {running ? '⟳ Running...' : '▶ Run Test Simulation'}
        </button>
        {!apiKey && <span style={{color: styles.textTertiary, fontSize: '12px'}}>Generate an API key first</span>}
      </div>
      
      {stats.pass + stats.block > 0 && (
        <div style={{display: 'flex', gap: '24px', marginBottom: '16px'}}>
          <div style={{padding: '12px 20px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(157,140,207,0.3)', borderRadius: '6px'}}>
            <div style={{fontSize: '24px', fontWeight: 500, color: styles.accentGreen}}>{stats.pass}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px'}}>Passed</div>
          </div>
          <div style={{padding: '12px 20px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '6px'}}>
            <div style={{fontSize: '24px', fontWeight: 500, color: '#D65C5C'}}>{stats.block}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px'}}>Blocked</div>
          </div>
        </div>
      )}
      
      {logs.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${styles.borderGlass}`,
          borderRadius: '8px',
          padding: '16px',
          maxHeight: '300px',
          overflowY: 'auto',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '12px'
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{
              color: log.type === 'success' ? styles.accentGreen : log.type === 'error' ? '#D65C5C' : styles.textSecondary,
              marginBottom: '4px'
            }}>
              {log.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// API Key Manager Component

function SessionReport({ session }) {
  if (!session) return null;
  const passRate = session.pass_count + session.block_count > 0 
    ? ((session.pass_count / (session.pass_count + session.block_count)) * 100).toFixed(1)
    : 0;
  return (
    <div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px'}}>
        <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: '#fff'}}>{(session.pass_count || 0) + (session.block_count || 0)}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Total Actions</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(92,214,133,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: '#5CD685'}}>{session.pass_count || 0}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Passed</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(214,92,92,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: '#D65C5C'}}>{session.block_count || 0}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Blocked</div>
        </div>
        <div style={{padding: '16px', background: passRate >= 95 ? 'rgba(92,214,133,0.1)' : 'rgba(214,92,92,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 500, color: passRate >= 95 ? '#5CD685' : '#D65C5C'}}>{passRate}%</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Pass Rate</div>
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>SESSION ID</div><div style={{fontFamily: 'monospace', color: '#ccc'}}>{session.session_id}</div></div>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>CERTIFICATE</div><div style={{color: '#ccc'}}>{session.certificate_id || 'N/A'}</div></div>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>STARTED</div><div style={{color: '#ccc'}}>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</div></div>
        <div><div style={{fontSize: '11px', color: '#888', marginBottom: '4px'}}>STATUS</div><span style={{padding: '4px 12px', borderRadius: '4px', fontSize: '12px', background: session.status === 'active' ? 'rgba(92,214,133,0.2)' : 'rgba(255,255,255,0.1)', color: session.status === 'active' ? '#5CD685' : '#888'}}>{session.status?.toUpperCase()}</span></div>
      </div>
    </div>
  );
}

function TelemetryLog({ sessionId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (sessionId) {
      api.get(`/api/envelo/admin/sessions/${sessionId}/telemetry`)
        .then(res => setRecords(res.data.records || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [sessionId]);
  if (loading) return <div style={{color: '#888', padding: '12px'}}>Loading...</div>;
  if (!records.length) return <div style={{color: '#888', padding: '12px'}}>No telemetry records</div>;
  return (
    <div style={{maxHeight: '300px', overflowY: 'auto'}}>
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
        <thead><tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Time</th><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Action</th><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Result</th><th style={{padding: '8px', textAlign: 'left', color: '#888'}}>Params</th></tr></thead>
        <tbody>{records.map((r, i) => (<tr key={i} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}><td style={{padding: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#aaa'}}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '-'}</td><td style={{padding: '8px', color: '#fff'}}>{r.action_type}</td><td style={{padding: '8px'}}><span style={{padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 400, background: r.result === 'PASS' ? 'rgba(92,214,133,0.2)' : 'rgba(214,92,92,0.2)', color: r.result === 'PASS' ? '#5CD685' : '#D65C5C'}}>{r.result}</span></td><td style={{padding: '8px', color: '#666', fontFamily: 'monospace', fontSize: '10px'}}>{JSON.stringify(r.parameters || {})}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function APIKeyManager({ onKeyGenerated }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);
  
  useEffect(() => {
    if (generatedKey?.key) {
      onKeyGenerated?.(generatedKey.key);
    }
  }, [generatedKey]);

  useEffect(() => {
    loadKeys();
  }, []);

  const downloadConfiguredAgent = (apiKey) => {
    // Create a configured Python script
    const configScript = `#!/usr/bin/env python3
"""
ENVELO Agent - Pre-configured for your system
Sentinel Authority - https://sentinelauthority.org

QUICK START:
1. Install dependencies: pip install httpx
2. Run this file: python envelo_agent.py
3. Check your dashboard: https://app.sentinelauthority.org/envelo
"""

import os
import sys
import time
import json
import uuid
import httpx
from datetime import datetime
from functools import wraps

# ═══════════════════════════════════════════════════════════════════
# YOUR CREDENTIALS (pre-configured)
# ═══════════════════════════════════════════════════════════════════
CERTIFICATE_ID = "ODDC-2026-PENDING"
API_KEY = "${apiKey}"
API_ENDPOINT = "https://sentinel-authority-production.up.railway.app"

# ═══════════════════════════════════════════════════════════════════
# ENVELO AGENT
# ═══════════════════════════════════════════════════════════════════

class NumericBoundary:
    def __init__(self, name, min=None, max=None, unit=""):
        self.name = name
        self.min = min
        self.max = max
        self.unit = unit
    
    def check(self, value):
        if self.min is not None and value < self.min:
            return False, f"{self.name} ({value}) below minimum ({self.min})"
        if self.max is not None and value > self.max:
            return False, f"{self.name} ({value}) above maximum ({self.max})"
        return True, None

class EnveloAgent:
    def __init__(self):
        self.boundaries = []
        self.session_id = uuid.uuid4().hex[:16]
        self.telemetry = []
        self.pass_count = 0
        self.block_count = 0
        self._register_session()
    
    def _register_session(self):
        try:
            httpx.post(
                f"{API_ENDPOINT}/api/envelo/sessions",
                json={
                    "certificate_id": CERTIFICATE_ID,
                    "session_id": self.session_id,
                    "started_at": datetime.utcnow().isoformat() + "Z",
                    "agent_version": "1.0.0",
                    "boundaries": [{"name": b.name} for b in self.boundaries]
                },
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=10
            )
            print(f"✓ Session registered: {self.session_id}")
        except Exception as e:
            print(f"⚠ Could not register session: {e}")
    
    def add_boundary(self, boundary):
        self.boundaries.append(boundary)
        print(f"  + Boundary: {boundary.name} ({boundary.min} to {boundary.max} {boundary.unit})")
    
    def enforce(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            action_id = uuid.uuid4().hex[:8]
            
            # Check all boundaries
            violations = []
            for boundary in self.boundaries:
                if boundary.name in kwargs:
                    passed, msg = boundary.check(kwargs[boundary.name])
                    if not passed:
                        violations.append({"boundary": boundary.name, "message": msg})
            
            result = "PASS" if not violations else "BLOCK"
            exec_time = (time.time() - start) * 1000
            
            # Record telemetry
            record = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "action_id": action_id,
                "action_type": func.__name__,
                "result": result,
                "execution_time_ms": exec_time,
                "parameters": kwargs,
                "boundary_evaluations": [{"boundary": b.name, "passed": b.name not in [v["boundary"] for v in violations]} for b in self.boundaries]
            }
            self.telemetry.append(record)
            
            if result == "PASS":
                self.pass_count += 1
                return func(*args, **kwargs)
            else:
                self.block_count += 1
                raise Exception(f"ENVELO BLOCK: {violations[0]['message']}")
        
        return wrapper
    
    def send_telemetry(self):
        if not self.telemetry:
            return
        try:
            httpx.post(
                f"{API_ENDPOINT}/api/envelo/telemetry",
                json={
                    "certificate_id": CERTIFICATE_ID,
                    "session_id": self.session_id,
                    "records": self.telemetry,
                    "stats": {"pass_count": self.pass_count, "block_count": self.block_count}
                },
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=10
            )
            print(f"✓ Sent {len(self.telemetry)} telemetry records")
            self.telemetry = []
        except Exception as e:
            print(f"⚠ Could not send telemetry: {e}")
    
    def shutdown(self):
        self.send_telemetry()
        try:
            httpx.post(
                f"{API_ENDPOINT}/api/envelo/sessions/{self.session_id}/end",
                json={
                    "ended_at": datetime.utcnow().isoformat() + "Z",
                    "final_stats": {"pass_count": self.pass_count, "block_count": self.block_count}
                },
                headers={"Authorization": f"Bearer {API_KEY}"},
                timeout=10
            )
            print(f"✓ Session ended")
        except Exception as e:
            print(f"⚠ Could not end session: {e}")

# ═══════════════════════════════════════════════════════════════════
# EXAMPLE USAGE - MODIFY FOR YOUR SYSTEM
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║           ENVELO Agent - Sentinel Authority               ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print("")
    print(f"Certificate: {CERTIFICATE_ID}")
    print(f"API Key:     {API_KEY[:12]}...")
    print("")
    
    # Initialize agent
    agent = EnveloAgent()
    print("")
    
    # Define YOUR boundaries (modify these for your system)
    print("Defining ODD boundaries:")
    agent.add_boundary(NumericBoundary("speed", min=0, max=100, unit="km/h"))
    agent.add_boundary(NumericBoundary("temperature", min=-20, max=50, unit="celsius"))
    print("")
    
    # Example protected function (replace with your actual function)
    @agent.enforce
    def autonomous_action(speed, temperature):
        print(f"    Executing action: speed={speed}, temp={temperature}")
        return True
    
    # Test 1: Within boundaries (should PASS)
    print("─" * 50)
    print("Test 1: speed=50, temperature=25 (within bounds)")
    try:
        autonomous_action(speed=50, temperature=25)
        print("    ✓ PASSED - Action executed")
    except Exception as e:
        print(f"    ✗ BLOCKED - {e}")
    print("")
    
    # Test 2: Outside boundaries (should BLOCK)
    print("Test 2: speed=150, temperature=25 (speed exceeds limit)")
    try:
        autonomous_action(speed=150, temperature=25)
        print("    ✓ PASSED - Action executed")
    except Exception as e:
        print(f"    ✗ BLOCKED - {e}")
    print("")
    
    # Send telemetry and shutdown
    print("─" * 50)
    agent.shutdown()
    print("")
    print("═" * 50)
    print("Check your dashboard: https://app.sentinelauthority.org/envelo")
    print("═" * 50)
    print("")
`;
    
    // Create and download the file
    const blob = new Blob([configScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `envelo_agent_${cert.certificate_number}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadKeys = async () => {
    try {
      const res = await api.get('/api/apikeys/');
      setKeys(res.data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
    setLoading(false);
  };

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post('/api/apikeys/generate', { name: newKeyName });
      setGeneratedKey(res.data);
      setNewKeyName('');
      loadKeys();
    } catch (err) {
      console.error('Failed to generate key:', err);
    }
  };

  const revokeKey = async (keyId) => {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    try {
     await api.delete(`/api/apikeys/${keyId}`);
      loadKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyKey = () => {
    if (generatedKey?.key) {
      navigator.clipboard.writeText(generatedKey.key);
    }
  };

  if (loading) return <div style={{color: styles.textTertiary}}>Loading...</div>;

  return (
    <div>
      {generatedKey && (
        <div style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(157,140,207,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px'}}>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.accentGreen, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>✓ New API Key Generated</div>
          <div style={{background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary, wordBreak: 'break-all', marginBottom: '12px'}}>
            {generatedKey.key}
          </div>
          <div style={{display: 'flex', gap: '12px'}}>
            <button onClick={copyKey} style={{padding: '8px 16px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer'}}>Copy to Clipboard</button>
            <button onClick={() => setGeneratedKey(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textSecondary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', cursor: 'pointer'}}>Dismiss</button>
          </div>
          <p style={{color: styles.textTertiary, fontSize: '12px', marginTop: '12px'}}>⚠️ Save this key now. You won't be able to see it again.</p>
          <div style={{marginTop: '16px', padding: '16px', background: 'rgba(91,75,138,0.2)', border: '1px solid rgba(91,75,138,0.3)', borderRadius: '8px'}}>
            <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.purpleBright, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Next Step</div>
            <p style={{color: styles.textSecondary, fontSize: '13px', marginBottom: '12px'}}>Download the ENVELO Agent pre-configured with your credentials:</p>
            <button 
              onClick={() => downloadConfiguredAgent(generatedKey.key)}
              style={{padding: '12px 24px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
            >
              <Download size={16} /> Download ENVELO Agent
            </button>
          </div>
        </div>
      )}

      <div style={{display: 'flex', gap: '12px', marginBottom: '20px'}}>
        <input
          type="text"
          placeholder="Key name (e.g., Production)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          style={{flex: 1, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px'}}
        />
        <button
          onClick={generateKey}
          disabled={!newKeyName.trim()}
          style={{padding: '10px 20px', background: newKeyName.trim() ? styles.purplePrimary : 'rgba(0,0,0,0.2)', border: `1px solid ${newKeyName.trim() ? styles.purpleBright : styles.borderGlass}`, borderRadius: '6px', color: newKeyName.trim() ? '#fff' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: newKeyName.trim() ? 'pointer' : 'not-allowed'}}
        >
          Generate Key
        </button>
      </div>

      {keys.length > 0 ? (
        <div>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px'}}>Your API Keys</div>
          {keys.map((k) => (
            <div key={k.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', marginBottom: '8px'}}>
              <div>
                <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: styles.textPrimary}}>{k.name}</div>
                <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textTertiary, marginTop: '4px'}}>{k.key_prefix}••••••••</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                <span style={{fontSize: '11px', color: styles.textTertiary}}>{k.last_used_at ? `Last used: ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
                <button onClick={() => revokeKey(k.id)} style={{padding: '6px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '4px', color: '#ff6464', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer'}}>Revoke</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{color: styles.textTertiary, fontSize: '14px'}}>No API keys yet. Generate one to connect the ENVELO Agent.</p>
      )}
    </div>
  );
}

// Boundary Configurator Component
function BoundaryConfigurator() {
  const [boundaries, setBoundaries] = useState([]);
  const [newBoundary, setNewBoundary] = useState({ type: 'numeric', name: '', parameter: '', min: '', max: '', unit: '' });

  const addBoundary = () => {
    if (!newBoundary.name) return;
    setBoundaries([...boundaries, { ...newBoundary, id: Date.now() }]);
    setNewBoundary({ type: 'numeric', name: '', parameter: '', min: '', max: '', unit: '' });
  };

  const removeBoundary = (id) => {
    setBoundaries(boundaries.filter(b => b.id !== id));
  };

  const generateCode = () => {
    let code = `from envelo import EnveloAgent, EnveloConfig, NumericBoundary, GeoBoundary, RateLimitBoundary

config = EnveloConfig(
    certificate_id="YOUR-CERTIFICATE-ID",
    api_key="YOUR-API-KEY"
)

agent = EnveloAgent(config)

# Your ODD Boundaries
`;
    boundaries.forEach(b => {
      if (b.type === 'numeric') {
        code += `agent.add_boundary(NumericBoundary("${b.name}", parameter="${b.parameter || b.name}", min=${b.min || 'None'}, max=${b.max || 'None'}, unit="${b.unit || ''}"))
`;
      } else if (b.type === 'rate') {
        code += `agent.add_boundary(RateLimitBoundary("${b.name}", max_per_${b.rateUnit || 'second'}=${b.rateLimit || 10}))
`;
      }
    });
    code += `
# Wrap your autonomous functions
@agent.enforce
def your_action(**params):
    # Your code here
    pass
`;
    return code;
  };

  const downloadConfig = () => {
    const code = generateCode();
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'envelo_config.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px'}}>
        <select
          value={newBoundary.type}
          onChange={(e) => setNewBoundary({...newBoundary, type: e.target.value})}
          style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
        >
          <option value="numeric">Numeric Limit</option>
          <option value="rate">Rate Limit</option>
        </select>
        <input
          type="text"
          placeholder="Name (e.g., speed)"
          value={newBoundary.name}
          onChange={(e) => setNewBoundary({...newBoundary, name: e.target.value, parameter: e.target.value})}
          style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
        />
        {newBoundary.type === 'numeric' && (
          <>
            <input
              type="number"
              placeholder="Min"
              value={newBoundary.min}
              onChange={(e) => setNewBoundary({...newBoundary, min: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
            <input
              type="number"
              placeholder="Max"
              value={newBoundary.max}
              onChange={(e) => setNewBoundary({...newBoundary, max: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
            <input
              type="text"
              placeholder="Unit (e.g., km/h)"
              value={newBoundary.unit}
              onChange={(e) => setNewBoundary({...newBoundary, unit: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
          </>
        )}
        {newBoundary.type === 'rate' && (
          <>
            <input
              type="number"
              placeholder="Limit"
              value={newBoundary.rateLimit}
              onChange={(e) => setNewBoundary({...newBoundary, rateLimit: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            />
            <select
              value={newBoundary.rateUnit || 'second'}
              onChange={(e) => setNewBoundary({...newBoundary, rateUnit: e.target.value})}
              style={{padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px'}}
            >
              <option value="second">per second</option>
              <option value="minute">per minute</option>
              <option value="hour">per hour</option>
            </select>
          </>
        )}
        <button
          onClick={addBoundary}
          style={{padding: '10px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', cursor: 'pointer'}}
        >
          + Add
        </button>
      </div>

      {boundaries.length > 0 && (
        <div style={{marginBottom: '16px'}}>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Defined Boundaries</div>
          {boundaries.map((b) => (
            <div key={b.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.2)', borderRadius: '6px', marginBottom: '8px'}}>
              <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.accentGreen}}>
                {b.type === 'numeric' ? `${b.name}: ${b.min || '−∞'} to ${b.max || '∞'} ${b.unit}` : `${b.name}: ${b.rateLimit}/${b.rateUnit}`}
              </span>
              <button onClick={() => removeBoundary(b.id)} style={{background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '16px'}}>×</button>
            </div>
          ))}
        </div>
      )}

      {boundaries.length > 0 && (
        <div>
          <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Generated Configuration</div>
          <pre style={{background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: styles.textSecondary, overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap'}}>{generateCode()}</pre>
          <button
            onClick={downloadConfig}
            className="mt-3 px-4 py-2 rounded-lg"
            style={{marginTop: '12px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
          >
            Download Config
          </button>
        </div>
      )}
    </div>
  );
}

// ENVELO Agent Page




function PendingPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: styles.bgPrimary || '#0d0f14', padding: '20px' }}>
      <div style={{ maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Clock style={{ width: '36px', height: '36px', color: '#f59e0b' }} />
        </div>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#f59e0b', marginBottom: '12px' }}>APPLICATION UNDER REVIEW</p>
        <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: '28px', fontWeight: 200, color: styles.textPrimary || '#e8e6f0', margin: '0 0 16px' }}>Welcome to Sentinel Authority</h1>
        <p style={{ color: styles.textTertiary || '#596270', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
          Your account is being reviewed by our team. You will receive full portal access once approved. This typically takes 1-2 business days.
        </p>
        <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid ' + (styles.borderGlass || 'rgba(255,255,255,0.06)'), background: 'rgba(255,255,255,0.02)', marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ color: styles.textTertiary || '#596270', fontSize: '13px', marginBottom: '8px' }}>Registered as:</p>
          <p style={{ color: styles.textPrimary || '#e8e6f0', fontWeight: 500 }}>{user?.full_name}</p>
          <p style={{ color: styles.textTertiary || '#596270', fontSize: '13px' }}>{user?.email}</p>
        </div>
        <p style={{ color: styles.textTertiary || '#596270', fontSize: '13px', marginBottom: '24px' }}>
          Questions? Contact <a href="mailto:info@sentinelauthority.org" style={{ color: styles.purpleBright || '#9d8ccf' }}>info@sentinelauthority.org</a>
        </p>
        <button onClick={logout} style={{ padding: '10px 24px', borderRadius: '8px', background: 'transparent', border: '1px solid ' + (styles.borderGlass || 'rgba(255,255,255,0.06)'), color: styles.textTertiary || '#596270', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );
}

function ResourcesPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/documents/')
      .then(res => { setDocuments(Array.isArray(res.data) ? res.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDownload = async (docId, title) => {
    try {
      const response = await api.get('/api/documents/' + docId + '/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = title.replace(/\s+/g, '_') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '32px' }}>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
          letterSpacing: '2px', textTransform: 'uppercase',
          color: styles.purpleBright, marginBottom: '8px'
        }}>RESOURCES</p>
        <h1 style={{
          fontFamily: "'Source Serif 4', serif", fontSize: '28px',
          fontWeight: 200, color: styles.textPrimary, margin: 0
        }}>Documents & Guides</h1>
        <p style={{ color: styles.textTertiary, marginTop: '8px', fontSize: '14px' }}>
          Reference materials for the ODDC certification process.
        </p>
      </div>

      {loading ? (
        <div style={{ color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center', borderRadius: '12px',
          border: '1px solid ' + styles.borderGlass, background: styles.bgCard,
          color: styles.textTertiary
        }}>
          No documents available.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {documents.map(doc => (
            <div key={doc.id} style={{
              padding: '24px', borderRadius: '12px',
              border: '1px solid ' + styles.borderGlass, background: styles.bgCard,
              display: 'flex', alignItems: 'center', gap: '20px'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '10px',
                background: styles.purplePrimary + '22',
                border: '1px solid ' + styles.purplePrimary + '44',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <BookOpen style={{ width: '22px', height: '22px', color: styles.purpleBright }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: styles.textPrimary, fontSize: '15px', marginBottom: '4px' }}>
                  {doc.title}
                </div>
                <div style={{ color: styles.textTertiary, fontSize: '13px', lineHeight: '1.4' }}>
                  {doc.description}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                  color: styles.textTertiary, marginTop: '6px',
                  letterSpacing: '1px', textTransform: 'uppercase'
                }}>
                  {'PDF • v' + doc.version}
                </div>
              </div>
              <button
                onClick={() => handleDownload(doc.id, doc.title)}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  background: styles.purplePrimary,
                  border: '1px solid ' + styles.purpleBright,
                  color: '#fff', fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '11px', letterSpacing: '1px',
                  textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0
                }}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {user && user.role === 'admin' && (
        <div style={{
          marginTop: '40px', padding: '20px', borderRadius: '10px',
          border: '1px dashed ' + styles.borderGlass,
          color: styles.textTertiary, fontSize: '12px',
          fontFamily: "'IBM Plex Mono', monospace"
        }}>
          ADMIN: To add documents, place PDFs in backend/static/documents/ and register them in documents.py
        </div>
      )}
    </div>
  );
}

function EnveloPage() {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <EnveloAdminView />;
  }
  return <EnveloCustomerView />;
}

// Admin View - System-wide monitoring and management
// Admin View - Full management and monitoring
function EnveloAdminView() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedCert, setSelectedCert] = useState(null);
  const [activeTab, setActiveTab] = useState('monitoring'); // monitoring, customers, configure
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, sessionsRes, certsRes, appsRes] = await Promise.all([
          api.get('/api/envelo/stats').catch(() => ({ data: null })),
          api.get('/api/envelo/admin/sessions').catch(() => ({ data: { sessions: [] } })),
          api.get('/api/certificates/').catch(() => ({ data: [] })),
          api.get('/api/applications/').catch(() => ({ data: [] }))
        ]);
        setStats(statsRes.data);
        setSessions(sessionsRes.data.sessions || []);
        setCertificates(certsRes.data || []);
        setApplications(appsRes.data || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}><RefreshCw size={24} style={{animation: 'spin 1s linear infinite'}} /></div>;
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const totalViolations = sessions.reduce((acc, s) => acc + (s.block_count || 0), 0);
  const activeCerts = certificates.filter(c => c.status === 'issued' || c.status === 'active');
  const pendingApps = applications.filter(a => a.status === 'approved' || a.status === 'testing');

  const downloadAgentForCert = (cert) => {
    const agentCode = `#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
System: ${cert.system_name || 'Unknown'}
Certificate: ${cert.certificate_number}
Organization: ${cert.organization_name || 'Unknown'}
Generated: ${new Date().toISOString()}
"""

import os, json, time, requests
from datetime import datetime

SENTINEL_API = "https://api.sentinelauthority.org"
CERTIFICATE_NUMBER = "${cert.certificate_number}"
SYSTEM_NAME = "${cert.system_name || 'Unknown'}"

class EnveloAgent:
    def __init__(self, api_key):
        self.api_key = api_key
        self.session_id = None
        self.boundaries = {}
        self.config = None
        
    def start_session(self):
        # Fetch approved boundaries from server
        try:
            config_res = requests.get(f"{SENTINEL_API}/api/envelo/boundaries/config",
                headers={"Authorization": f"Bearer {self.api_key}"})
            if config_res.ok:
                self.config = config_res.json()
                self._load_boundaries_from_config()
                print(f"[ENVELO] Loaded {len(self.boundaries)} boundaries from server")
        except Exception as e:
            print(f"[ENVELO] Warning: Could not fetch boundaries: {e}")
        
        # Start session
        res = requests.post(f"{SENTINEL_API}/api/envelo/sessions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "certificate_id": CERTIFICATE_NUMBER,
                "session_id": str(uuid.uuid4()),
                "started_at": datetime.utcnow().isoformat() + "Z",
                "agent_version": "1.0.0",
                "boundaries": list(self.boundaries.values())
            })
        if res.ok:
            self.session_id = res.json().get("session_id")
            print(f"[ENVELO] Session started: {self.session_id}")
            return True
        return False
    
    def _load_boundaries_from_config(self):
        if not self.config:
            return
        for b in self.config.get("numeric_boundaries", []):
            self.boundaries[b["name"]] = {"type": "numeric", "min": b.get("min_value"), "max": b.get("max_value")}
        for b in self.config.get("rate_boundaries", []):
            self.boundaries[b["name"]] = {"type": "rate", "max_per_second": b.get("max_per_second")}
    
    def add_boundary(self, name, min_val=None, max_val=None):
        self.boundaries[name] = {"type": "numeric", "min": min_val, "max": max_val}
    
    def check(self, name, value):
        if name not in self.boundaries:
            return True
        b = self.boundaries[name]
        if b.get("min") is not None and value < b["min"]:
            self._violation(name, value, f"Below min {b['min']}")
            return False
        if b.get("max") is not None and value > b["max"]:
            self._violation(name, value, f"Above max {b['max']}")
            return False
        return True
    
    def _violation(self, name, value, reason):
        print(f"[ENVELO] VIOLATION: {name}={value} - {reason}")
        try:
            requests.post(f"{SENTINEL_API}/api/envelo/telemetry",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "certificate_id": CERTIFICATE_NUMBER,
                    "session_id": self.session_id,
                    "records": [{
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "action_type": "boundary_check",
                        "result": "BLOCK",
                        "parameters": {name: value},
                        "boundary_evaluations": [{"boundary": name, "passed": False, "message": reason}]
                    }],
                    "stats": {"block_count": 1}
                })
        except:
            pass
    
    def heartbeat(self):
        try:
            requests.post(f"{SENTINEL_API}/api/envelo/heartbeat",
                headers={"Authorization": f"Bearer {self.api_key}"})
        except:
            pass
    
    def shutdown(self):
        if self.session_id:
            requests.post(f"{SENTINEL_API}/api/envelo/sessions/{self.session_id}/end",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"ended_at": datetime.utcnow().isoformat() + "Z", "final_stats": {}})
        print("[ENVELO] Session ended")

import uuid

if __name__ == "__main__":
    print("=" * 60)
    print("  ENVELO Agent - Sentinel Authority")
    print(f"  System: {SYSTEM_NAME}")
    print(f"  Certificate: {CERTIFICATE_NUMBER}")
    print("=" * 60)
    print()
    print("Usage:")
    print("  agent = EnveloAgent('your-api-key')")
    print("  agent.start_session()")
    print("  agent.check('speed', 50)")
    print("  agent.shutdown()")
`;
    const blob = new Blob([agentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `envelo_agent_${cert.certificate_number}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionHeader 
        label="⬡ Admin Console" 
        title="ENVELO Management" 
        description="Monitor, configure, and manage all customer systems"
      />

      {/* Tab Navigation */}
      <div style={{display: 'flex', gap: '8px', borderBottom: `1px solid ${styles.borderGlass}`, paddingBottom: '16px'}}>
        {[
          { id: 'monitoring', label: 'Live Monitoring' },
          { id: 'customers', label: 'Customer Systems' },
          { id: 'configure', label: 'Configure Boundaries' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? styles.purplePrimary : 'transparent',
              border: `1px solid ${activeTab === tab.id ? styles.purpleBright : styles.borderGlass}`,
              borderRadius: '8px',
              color: activeTab === tab.id ? '#fff' : styles.textSecondary,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Active Sessions</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.accentGreen}}>{activeSessions.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Attested Systems</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.purpleBright}}>{activeCerts.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>CAT-72 In Progress</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: styles.accentAmber}}>{pendingApps.length}</p>
        </Panel>
        <Panel>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Violations (Total)</p>
          <p style={{fontSize: '36px', fontWeight: 200, color: totalViolations > 0 ? styles.accentRed : styles.accentGreen}}>{totalViolations}</p>
        </Panel>
      </div>

      {/* Tab Content */}
      {activeTab === 'monitoring' && (
        <>
          {/* Active Sessions Table */}
          <Panel glow>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Active Sessions</p>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(92,214,133,0.15)', borderRadius: '20px'}}>
                <div style={{width: '6px', height: '6px', borderRadius: '50%', background: styles.accentGreen, boxShadow: `0 0 8px ${styles.accentGreen}`, animation: 'pulse 2s infinite'}}></div>
                <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.accentGreen, textTransform: 'uppercase'}}>Live</span>
              </div>
            </div>
            
            {sessions.length > 0 ? (
              <div style={{overflowX: 'auto'}}>
                <table className="w-full">
                  <thead>
                    <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Certificate</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Status</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Pass</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Block</th>
                      <th style={{padding: '12px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={i} className="sexy-row" style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                        <td style={{padding: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{s.certificate_id || 'N/A'}</td>
                        <td style={{padding: '16px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <div style={{width: '8px', height: '8px', borderRadius: '50%', background: s.status === 'active' ? styles.accentGreen : styles.textTertiary, boxShadow: s.status === 'active' ? `0 0 8px ${styles.accentGreen}` : 'none'}}></div>
                            <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: s.status === 'active' ? styles.accentGreen : styles.textTertiary}}>{s.status}</span>
                          </div>
                        </td>
                        <td style={{padding: '16px', color: styles.accentGreen}}>{s.pass_count || 0}</td>
                        <td style={{padding: '16px', color: (s.block_count || 0) > 0 ? styles.accentRed : styles.textTertiary}}>{s.block_count || 0}</td>
                        <td style={{padding: '16px'}}>
                          <button onClick={() => setSelectedSession(s)} style={{padding: '6px 12px', background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: styles.purpleBright, fontSize: '11px', cursor: 'pointer'}}>View Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{color: styles.textTertiary, textAlign: 'center', padding: '40px'}}>No sessions found.</p>
            )}
          </Panel>

          {/* Session Detail Modal */}
          {selectedSession && (
            <Panel accent="purple">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Session: {selectedSession.session_id?.substring(0, 16)}...</p>
                <div style={{display: 'flex', gap: '12px'}}>
                  <button onClick={async () => {
                    try {
                      const res = await api.get(`/api/envelo/admin/sessions/${selectedSession.id}/report`, {responseType: 'blob'});
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `CAT72-Report-${selectedSession.session_id}.pdf`;
                      link.click();
                    } catch(e) { alert('Failed: ' + e.message); }
                  }} style={{padding: '8px 16px', background: styles.purplePrimary, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer'}}>Download Report</button>
                  <button onClick={() => setSelectedSession(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textTertiary, cursor: 'pointer', fontSize: '11px'}}>✕ Close</button>
                </div>
              </div>
              <SessionReport session={selectedSession} />
              <div style={{marginTop: '20px'}}>
                <TelemetryLog sessionId={selectedSession.id} />
              </div>
            </Panel>
          )}
        </>
      )}

      {activeTab === 'customers' && (
        <>
          {/* Attested Systems */}
          <Panel>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '20px'}}>Attested Systems</p>
            {activeCerts.length > 0 ? (
              <div className="space-y-4">
                {activeCerts.map(cert => (
                  <div key={cert.id} style={{padding: '20px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '12px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
                      <div>
                        <h3 style={{fontSize: '16px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 4px 0'}}>{cert.system_name || 'Unnamed'}</h3>
                        <p style={{fontSize: '13px', color: styles.textSecondary, marginBottom: '8px'}}>{cert.organization_name}</p>
                        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{cert.certificate_number}</p>
                      </div>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <button onClick={() => { setSelectedCert(cert); setActiveTab('configure'); }} style={{padding: '8px 16px', background: 'rgba(157,140,207,0.15)', border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: styles.purpleBright, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <Shield size={12} /> Configure
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Provision and send ENVELO agent to ${cert.organization_name}?`)) return;
                          try {
                            const res = await api.post('/api/apikeys/admin/provision', null, { params: { user_id: cert.applicant_id, certificate_id: cert.id, send_email: true }});
                            if (res.data.agent_code) {
                              const blob = new Blob([res.data.agent_code], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `envelo_agent_${cert.certificate_number}.py`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                            alert(`✓ Agent provisioned!\n\nEmail sent to: ${res.data.customer_email}\nAPI Key: ${res.data.api_key_prefix}...`);
                          } catch (e) { alert('Failed: ' + (e.response?.data?.detail || e.message)); }
                        }} style={{padding: '8px 16px', background: styles.accentGreen, border: `1px solid ${styles.accentGreen}`, borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <ExternalLink size={12} /> Provision & Send
                        </button>
                        <button onClick={() => downloadAgentForCert(cert)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <Download size={12} /> Download Only
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color: styles.textTertiary, textAlign: 'center', padding: '24px'}}>No attested systems yet.</p>
            )}
          </Panel>

          {/* Pending CAT-72 */}
          {pendingApps.length > 0 && (
            <Panel accent="amber">
              <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, marginBottom: '20px'}}>CAT-72 Testing In Progress</p>
              <div className="space-y-4">
                {pendingApps.map(app => (
                  <div key={app.id} style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${styles.borderGlass}`}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <p style={{fontSize: '14px', color: styles.textPrimary, marginBottom: '4px'}}>{app.system_name}</p>
                        <p style={{fontSize: '12px', color: styles.textSecondary}}>{app.organization_name}</p>
                      </div>
                      <span style={{padding: '4px 12px', background: 'rgba(214,160,92,0.15)', border: '1px solid rgba(214,160,92,0.3)', borderRadius: '20px', fontSize: '10px', color: styles.accentAmber, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase'}}>
                        {app.cat72_started ? 'In Progress' : 'Ready'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* API Key Management */}
          <Panel>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>API Key Management</p>
            <APIKeyManager />
          </Panel>
        </>
      )}

      {activeTab === 'configure' && (
        <>
          {selectedCert ? (
            <Panel glow>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px'}}>
                <div>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Configuring Boundaries</p>
                  <h2 style={{fontSize: '24px', fontWeight: 200, margin: '0 0 4px 0'}}>{selectedCert.system_name}</h2>
                  <p style={{color: styles.textSecondary}}>{selectedCert.organization_name} • {selectedCert.certificate_number}</p>
                </div>
                <button onClick={() => setSelectedCert(null)} style={{padding: '8px 16px', background: 'transparent', border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', color: styles.textTertiary, cursor: 'pointer', fontSize: '11px'}}>← Back to List</button>
              </div>
              
              <BoundaryConfigurator 
                certificateNumber={selectedCert.certificate_number}
                initialBoundaries={selectedCert.envelope_definition || {}}
                onSave={async (boundaries) => {
                  try {
                    await api.put(`/api/envelo/boundaries/config/boundaries?certificate_number=${selectedCert.certificate_number}`, boundaries);
                    alert('Boundaries saved successfully!');
                  } catch (e) {
                    alert('Failed to save: ' + e.message);
                  }
                }}
              />
            </Panel>
          ) : (
            <Panel>
              <div style={{textAlign: 'center', padding: '60px 20px'}}>
                <Shield size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
                <h2 style={{fontSize: '20px', fontWeight: 200, marginBottom: '8px'}}>Select a System to Configure</h2>
                <p style={{color: styles.textSecondary, marginBottom: '24px'}}>Choose a system from the Customer Systems tab to configure its boundaries.</p>
                <button onClick={() => setActiveTab('customers')} style={{padding: '12px 24px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '8px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}>View Customer Systems</button>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
function EnveloCustomerView() {
  const [activeApiKey, setActiveApiKey] = useState(null);
  const [userCerts, setUserCerts] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [certsRes, appsRes, sessionsRes] = await Promise.all([
          api.get('/api/certificates/').catch(() => ({ data: [] })),
          api.get('/api/applications/').catch(() => ({ data: [] })),
          api.get('/api/envelo/sessions').catch(() => ({ data: { sessions: [] } }))
        ]);
        setUserCerts(certsRes.data || []);
        setUserApps(appsRes.data || []);
        setSessions(sessionsRes.data.sessions || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const hasCert = userCerts.some(c => c.status === 'issued' || c.status === 'active');
  const hasApprovedApp = userApps.some(a => a.status === 'approved' || a.status === 'testing');
  const canAccessAgent = hasCert || hasApprovedApp;
  const isTestMode = hasApprovedApp && !hasCert;
  const certifiedSystems = userCerts.filter(c => c.status === 'issued' || c.status === 'active');
  const approvedApps = userApps.filter(a => a.status === 'approved' || a.status === 'testing');

  const getDeployCommand = (caseId, apiKey) => {
    return 'curl -sSL "https://api.sentinelauthority.org/api/deploy/' + caseId + '?key=' + apiKey + '" | bash';
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}><RefreshCw size={24} style={{animation: 'spin 1s linear infinite'}} /></div>;
  }

  if (!canAccessAgent) {
    return (
      <div className="space-y-6">
        <SectionHeader label="ENVELO Agent" title="Application Required" />
        <Panel>
          <div style={{textAlign: 'center', padding: '40px'}}>
            <Award size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
            <h2 style={{fontFamily: "'Source Serif 4', serif", fontSize: '24px', fontWeight: 200, marginBottom: '12px'}}>Approval Required</h2>
            <p style={{color: styles.textSecondary, marginBottom: '24px'}}>Your application must be approved before you can access the ENVELO Agent.</p>
            <p style={{color: styles.textTertiary, fontSize: '13px'}}>Once approved, you can deploy the agent with a single command.</p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader 
        label="ENVELO Agent" 
        title="Deploy & Monitor" 
        description="One command deploys everything automatically"
      />

      {/* ONE-COMMAND DEPLOY */}
      <Panel>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
          <div style={{width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #5B4B8A 0%, #9d8ccf 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Download size={20} color="#fff" />
          </div>
          <div>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '2px'}}>One-Command Deploy</p>
            <p style={{color: styles.textSecondary, fontSize: '13px', margin: 0}}>Open a terminal. Paste the command. Press Enter. Done.</p>
          </div>
        </div>

        {[...approvedApps, ...certifiedSystems].map((sys, idx) => {
          const caseId = sys.case_number || sys.certificate_number;
          const sysName = sys.system_name || 'System';
          const keyId = 'deploy-' + idx;
          const apiKeyVal = activeApiKey || 'YOUR_API_KEY';
          const hasKey = activeApiKey && activeApiKey !== 'YOUR_API_KEY';
          const cmd = getDeployCommand(caseId, apiKeyVal);

          return (
            <div key={idx} style={{marginBottom: '20px'}}>
              <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px'}}>{sysName} — {caseId}</p>
              
              <div style={{position: 'relative', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid ' + (hasKey ? styles.purpleBright : styles.borderGlass), overflow: 'hidden'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid ' + styles.borderGlass}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57'}}></div>
                    <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e'}}></div>
                    <div style={{width: '10px', height: '10px', borderRadius: '50%', background: '#28c840'}}></div>
                  </div>
                  <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>Terminal</span>
                  <button
                    onClick={() => copyToClipboard(cmd, keyId)}
                    disabled={!hasKey}
                    style={{padding: '4px 12px', background: hasKey ? styles.purplePrimary : 'rgba(255,255,255,0.05)', border: '1px solid ' + (hasKey ? styles.purpleBright : styles.borderGlass), borderRadius: '6px', color: hasKey ? '#fff' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: hasKey ? 'pointer' : 'not-allowed'}}
                  >
                    {copied === keyId ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                
                <div style={{padding: '16px 20px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', lineHeight: '1.6', overflowX: 'auto', whiteSpace: 'nowrap'}}>
                  <span style={{color: styles.accentGreen}}>$</span>{' '}
                  <span style={{color: styles.textPrimary}}>curl -sSL "</span>
                  <span style={{color: styles.purpleBright}}>{'https://api.sentinelauthority.org/api/deploy/' + caseId + '?key='}</span>
                  <span style={{color: hasKey ? styles.accentGreen : styles.accentAmber}}>{apiKeyVal}</span>
                  <span style={{color: styles.textPrimary}}>" | bash</span>
                </div>
              </div>

              {!hasKey && (
                <p style={{color: styles.accentAmber, fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <AlertTriangle size={12} /> Generate an API key below first
                </p>
              )}
            </div>
          );
        })}

        <div style={{marginTop: '24px', padding: '16px', background: 'rgba(91,75,138,0.08)', borderRadius: '10px', border: '1px solid ' + styles.borderGlass}}>
          <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>What this command does</p>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px'}}>
            {[
              { num: '1', label: 'Installs agent', desc: 'Downloads ENVELO' },
              { num: '2', label: 'Writes config', desc: 'Your approved boundaries' },
              { num: '3', label: 'Tests everything', desc: 'Network, sources, clock' },
              { num: '4', label: 'Activates', desc: 'Ready for CAT-72' },
            ].map(s => (
              <div key={s.num} style={{textAlign: 'center'}}>
                <div style={{width: '28px', height: '28px', borderRadius: '50%', background: styles.purplePrimary, border: '1px solid ' + styles.purpleBright, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 'bold', color: '#fff'}}>{s.num}</div>
                <p style={{fontSize: '12px', fontWeight: 500, color: styles.textPrimary, marginBottom: '2px'}}>{s.label}</p>
                <p style={{fontSize: '11px', color: styles.textTertiary}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* TEST MODE BANNER */}
      {isTestMode && (
        <Panel accent="amber">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <div style={{width: '10px', height: '10px', borderRadius: '50%', background: styles.accentAmber, animation: 'pulse 2s infinite'}}></div>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.accentAmber, margin: 0}}>CAT-72 Testing Mode</p>
          </div>
          <p style={{color: styles.textSecondary, marginBottom: '8px'}}>Deploy the ENVELO Agent using the command above, then start your 72-hour test from the CAT-72 tab.</p>
          <p style={{color: styles.textTertiary, fontSize: '12px'}}>The deploy command configures everything automatically — your approved boundaries are baked in.</p>
        </Panel>
      )}

      {/* LIVE SYSTEMS */}
      {certifiedSystems.length > 0 && certifiedSystems.map(cert => {
        const session = sessions.find(s => s.certificate_id === cert.certificate_number);
        const isOnline = session && session.status === 'active';
        
        return (
          <Panel key={cert.id} glow={isOnline}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
              <div>
                <h3 style={{fontSize: '20px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 8px 0'}}>{cert.system_name || 'Unnamed System'}</h3>
                <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: styles.purpleBright, marginBottom: '4px'}}>{cert.certificate_number}</p>
                <p style={{fontSize: '12px', color: styles.textTertiary}}>
                  {'Attested ' + (cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : 'N/A') + ' | Expires ' + (cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A')}
                </p>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: isOnline ? 'rgba(92,214,133,0.15)' : 'rgba(255,255,255,0.05)', borderRadius: '20px'}}>
                <div style={{width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? styles.accentGreen : styles.textTertiary, boxShadow: isOnline ? '0 0 8px ' + styles.accentGreen : 'none'}}></div>
                <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', textTransform: 'uppercase', color: isOnline ? styles.accentGreen : styles.textTertiary}}>
                  {isOnline ? 'ENVELO Active' : 'Offline'}
                </span>
              </div>
            </div>
            
            {session && (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid ' + styles.borderGlass}}>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '28px', fontWeight: 200, color: styles.accentGreen}}>{session.uptime || '0h'}</p>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Uptime</p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '28px', fontWeight: 200, color: styles.purpleBright}}>{session.record_count || 0}</p>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Telemetry</p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '28px', fontWeight: 200, color: (session.violations || 0) > 0 ? styles.accentRed : styles.accentGreen}}>{session.violations || 0}</p>
                  <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Violations</p>
                </div>
              </div>
            )}
          </Panel>
        );
      })}

      {/* API KEY */}
      <Panel>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your API Key</p>
        <p style={{color: styles.textSecondary, marginBottom: '16px', fontSize: '14px'}}>Generate a key to activate the deploy command above.</p>
        <APIKeyManager onKeyGenerated={setActiveApiKey} />
      </Panel>

      {/* HELP */}
      <Panel>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Need Help?</p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
            <p style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '4px', fontSize: '14px'}}>Check Status</p>
            <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginTop: '8px'}}>$ envelo status</div>
          </div>
          <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
            <p style={{fontWeight: 500, color: styles.textPrimary, marginBottom: '4px', fontSize: '14px'}}>Get Support</p>
            <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginTop: '8px'}}>$ envelo diagnose</div>
          </div>
        </div>
        <p style={{color: styles.textTertiary, fontSize: '12px', marginTop: '12px'}}>
          Run <code style={{color: styles.purpleBright}}>envelo diagnose</code> and email the output to <a href="mailto:conformance@sentinelauthority.org" style={{color: styles.purpleBright, textDecoration: 'none'}}>conformance@sentinelauthority.org</a>
        </p>
      </Panel>
    </div>
  );
}

// Main App
// Monitoring Dashboard
function MonitoringPage() {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [hideEnded, setHideEnded] = useState(true);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const [overviewRes, alertsRes] = await Promise.all([
        api.get('/api/envelo/monitoring/overview'),
        api.get('/api/envelo/monitoring/alerts')
      ]);
      setOverview(overviewRes.data);
      setAlerts(alertsRes.data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchTimeline = async (sessionId) => {
    try {
      const res = await api.get(`/envelo/monitoring/session/${sessionId}/timeline?hours=24`);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  };

  useEffect(() => {
    if (selectedSession) {
      fetchTimeline(selectedSession.id);
    }
  }, [selectedSession]);

  if (loading) {
    return (
      <div style={{padding: '40px', textAlign: 'center'}}>
        <RefreshCw size={24} style={{animation: 'spin 1s linear infinite', color: styles.purpleBright}} />
        <p style={{marginTop: '16px', color: styles.textSecondary}}>Loading monitoring data...</p>
      </div>
    );
  }

  const summary = overview?.summary || {};
  const sessions = overview?.sessions || [];
  const filteredSessions = sessions.filter(s => {
    if (customerFilter && s.organization_name !== customerFilter) return false;
    if (onlineOnly && !s.is_online) return false;
    if (hideEnded && (s.status === 'ended' || s.status === 'completed' || s.status === 'disconnected')) return false;
    return true;
  });

  return (
    <div style={{maxWidth: '1400px', margin: '0 auto'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <div>
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '28px', fontWeight: 300, margin: 0}}>
            System Monitoring
          </h1>
          <p style={{color: styles.textSecondary, marginTop: '4px', fontSize: '14px'}}>
            Real-time ENVELO agent status and telemetry
          </p>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '8px', color: styles.textSecondary, fontSize: '13px', cursor: 'pointer'}}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{accentColor: styles.purpleBright}}
            />
            Auto-refresh
          </label>
          <button 
            onClick={async () => { setRefreshing(true); await fetchData(); setTimeout(() => setRefreshing(false), 600); }}
            style={{
              background: styles.bgPanel, border: `1px solid ${styles.borderGlass}`,
              borderRadius: '8px', padding: '8px 16px', color: styles.textPrimary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <RefreshCw size={14} style={refreshing ? {animation: "spin 1s linear infinite"} : {}} /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{
          background: 'rgba(214, 92, 92, 0.1)',
          border: '1px solid rgba(214, 92, 92, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
            <AlertTriangle size={18} style={{color: '#D65C5C'}} />
            <span style={{fontWeight: 500, color: '#D65C5C'}}>{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {alerts.map((alert, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 14px'
              }}>
                <div>
                  <span style={{
                    fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace",
                    textTransform: 'uppercase', letterSpacing: '1px',
                    color: alert.severity === 'critical' ? '#D65C5C' : '#D6A05C',
                    marginRight: '12px'
                  }}>
                    {alert.severity}
                  </span>
                  <span style={{color: styles.textPrimary}}>{alert.message}</span>
                </div>
                <span style={{color: styles.textTertiary, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace"}}>
                  {alert.session_id?.slice(0, 8)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px'}}>
        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Active Sessions
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: styles.accentGreen}}>{summary.active || 0}</div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            {summary.offline || 0} offline
          </div>
        </div>

        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Total Actions
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{(summary.total_actions || 0).toLocaleString()}</div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            {summary.total_pass?.toLocaleString() || 0} passed, {summary.total_block?.toLocaleString() || 0} blocked
          </div>
        </div>

        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Pass Rate
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: summary.pass_rate >= 99 ? styles.accentGreen : summary.pass_rate >= 95 ? '#D6A05C' : '#D65C5C'}}>
            {summary.pass_rate?.toFixed(1) || 0}%
          </div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            enforcement success
          </div>
        </div>

        <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '20px'}}>
          <div style={{fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary, marginBottom: '8px'}}>
            Total Sessions
          </div>
          <div style={{fontSize: '32px', fontWeight: 300, color: styles.textPrimary}}>{summary.total || 0}</div>
          <div style={{fontSize: '12px', color: styles.textSecondary, marginTop: '4px'}}>
            {summary.ended || 0} completed
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', overflow: 'hidden'}}>
        <div style={{padding: '16px 20px', borderBottom: `1px solid ${styles.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 style={{margin: 0, fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary}}>Agent Sessions</h2>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{background: styles.bgDeep, border: `1px solid ${styles.borderGlass}`, borderRadius: '6px', padding: '6px 10px', color: styles.textPrimary, fontSize: '12px'}}>
              <option value="">All Customers</option>
              {[...new Set(sessions.map(s => s.organization_name).filter(Boolean))].map(org => <option key={org} value={org}>{org}</option>)}
            </select>
            <label style={{display: 'flex', alignItems: 'center', gap: '6px', color: styles.textSecondary, fontSize: '12px', cursor: 'pointer'}}>
              <input type="checkbox" checked={hideEnded} onChange={(e) => setHideEnded(e.target.checked)} style={{accentColor: styles.purpleBright}} />
              Hide ended
            </label>
            <label style={{display: 'flex', alignItems: 'center', gap: '6px', color: styles.textSecondary, fontSize: '12px', cursor: 'pointer'}}>
              <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} style={{accentColor: styles.purpleBright}} />
              Online only
            </label>
          </div>
        </div>        
        {filteredSessions.length === 0 ? (
          <div style={{padding: '40px', textAlign: 'center', color: styles.textSecondary}}>
            No ENVELO sessions found. Deploy an agent to begin monitoring.
          </div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: 'rgba(0,0,0,0.2)'}}>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Status</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Session ID</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Uptime</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Actions</th>
                  <th style={{padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Pass Rate</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '1px', color: styles.textTertiary}}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => {
                  const total = session.pass_count + session.block_count;
                  const passRate = total > 0 ? (session.pass_count / total * 100) : 0;
                  const isSelected = selectedSession?.id === session.id;
                  
                  return (
                    <tr 
                      key={session.id}
                      onClick={() => setSelectedSession(isSelected ? null : session)}
                      style={{
                        borderBottom: `1px solid ${styles.borderSubtle}`,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(91, 75, 138, 0.15)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{padding: '14px 16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: session.is_online ? styles.accentGreen : session.status === 'ended' ? styles.textTertiary : '#D65C5C',
                            boxShadow: session.is_online ? `0 0 8px ${styles.accentGreen}` : 'none'
                          }} />
                          <span style={{
                            fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace",
                            textTransform: 'uppercase', letterSpacing: '1px',
                            color: session.is_online ? styles.accentGreen : session.status === 'ended' ? styles.textTertiary : '#D65C5C'
                          }}>
                            {session.is_online ? 'Online' : session.status === 'ended' ? 'Ended' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td style={{padding: '14px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.textSecondary}}>
                        {session.session_id}
                      </td>
                      <td style={{padding: '14px 16px', color: styles.textSecondary, fontSize: '13px'}}>
                        {session.uptime_hours?.toFixed(1)}h
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right', color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px'}}>
                        {total.toLocaleString()}
                      </td>
                      <td style={{padding: '14px 16px', textAlign: 'right'}}>
                        <span style={{
                          color: passRate >= 99 ? styles.accentGreen : passRate >= 95 ? '#D6A05C' : '#D65C5C',
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px'
                        }}>
                          {passRate.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{padding: '14px 16px', color: styles.textTertiary, fontSize: '12px'}}>
                        {session.last_activity ? new Date(session.last_activity).toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Detail Panel */}
      {selectedSession && (
        <div style={{
          marginTop: '24px',
          background: styles.bgPanel,
          border: `1px solid ${styles.borderGlass}`,
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{padding: '16px 20px', borderBottom: `1px solid ${styles.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{margin: 0, fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '2px', color: styles.textTertiary}}>
              Session Detail: {selectedSession.session_id}
            </h2>
            <button 
              onClick={() => setSelectedSession(null)}
              style={{background: 'none', border: 'none', color: styles.textTertiary, cursor: 'pointer', fontSize: '18px'}}
            >
              ×
            </button>
          </div>
          
          <div style={{padding: '20px'}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px'}}>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Started</div>
                <div style={{color: styles.textPrimary}}>{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Pass Count</div>
                <div style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace"}}>{selectedSession.pass_count.toLocaleString()}</div>
              </div>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Block Count</div>
                <div style={{color: '#D65C5C', fontFamily: "'IBM Plex Mono', monospace"}}>{selectedSession.block_count.toLocaleString()}</div>
              </div>
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Certificate</div>
                <div style={{color: styles.textPrimary}}>{selectedSession.certificate_id || '-'}</div>
              </div>
            </div>

            {/* Simple Timeline Bar Chart */}
            {timeline.length > 0 && (
              <div>
                <div style={{fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px'}}>
                  24-Hour Activity
                </div>
                <div style={{display: 'flex', gap: '2px', height: '60px', alignItems: 'flex-end'}}>
                  {timeline.map((point, i) => {
                    const maxTotal = Math.max(...timeline.map(t => t.total), 1);
                    const height = (point.total / maxTotal) * 100;
                    const passRatio = point.total > 0 ? point.pass / point.total : 1;
                    
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${Math.max(height, 2)}%`,
                          background: passRatio >= 0.99 ? styles.accentGreen : passRatio >= 0.95 ? '#D6A05C' : '#D65C5C',
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.8
                        }}
                        title={`${new Date(point.hour).toLocaleTimeString()}: ${point.total} actions (${point.pass} pass, ${point.block} block)`}
                      />
                    );
                  })}
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: styles.textTertiary}}>
                  <span>24h ago</span>
                  <span>Now</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// User Management Page (Admin Only)
function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', company: '', role: 'applicant' });
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users/');
      setUsers(res.data || []);
    } catch (err) {
      console.log('Users API not available:', err);
      setUsers([]);
    }
    setLoading(false);
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    applicants: users.filter(u => u.role === 'applicant').length,
    pending: users.filter(u => u.role === 'pending').length,
    inactive: users.filter(u => u.is_active === false).length,
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) { alert('Email and full name are required'); return; }
    setInviteLoading(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      await api.post('/api/users/', { ...inviteForm, password: tempPassword });
      alert('User created!\n\nEmail: ' + inviteForm.email + '\nTemporary Password: ' + tempPassword + '\n\nShare this securely.');
      setShowInviteModal(false);
      setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' });
      loadUsers();
    } catch (err) {
      alert('Failed to create user: ' + (err.response?.data?.detail || err.message));
    }
    setInviteLoading(false);
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (!window.confirm('Change user role to ' + newRole.toUpperCase() + '?')) return;
    try {
      await api.patch('/api/users/' + userId, { role: newRole });
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      alert('Failed to update role: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    const action = currentActive ? 'deactivate' : 'activate';
    if (!window.confirm(action.charAt(0).toUpperCase() + action.slice(1) + ' this user?')) return;
    try {
      await api.patch('/api/users/' + userId, { is_active: !currentActive });
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      alert('Failed to update user: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleResetPassword = async (userId, email) => {
    if (!window.confirm('Reset password for ' + email + '?')) return;
    try {
      const newPassword = Math.random().toString(36).slice(-8) + 'A1!';
      await api.patch('/api/users/' + userId, { password: newPassword });
      alert('Password reset!\n\nNew temporary password: ' + newPassword + '\n\nShare this securely.');
    } catch (err) {
      alert('Failed to reset password: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleApproveUser = async (userId, email) => {
    if (!window.confirm('Approve ' + email + ' as an applicant?')) return;
    try {
      await api.post('/api/users/' + userId + '/approve');
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      alert('Failed to approve: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRejectUser = async (userId, email) => {
    if (!window.confirm('Reject ' + email + '? Their account will be deactivated.')) return;
    try {
      await api.post('/api/users/' + userId + '/reject');
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      alert('Failed to reject: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm('DELETE user ' + email + '? This cannot be undone.')) return;
    try {
      await api.delete('/api/users/' + userId);
      loadUsers();
      setShowEditModal(false);
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Administration" title="User Management" description="Manage admin and applicant accounts"
        action={<button onClick={() => setShowInviteModal(true)} className="sexy-btn px-4 py-2 rounded-lg flex items-center gap-2" style={{background: styles.purplePrimary, border: '1px solid ' + styles.purpleBright, color: '#fff'}}><Plus className="w-4 h-4" /> Invite User</button>}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Users" value={stats.total} color={styles.textPrimary} />
        <StatCard label="Admins" value={stats.admins} color={styles.purpleBright} />
        <StatCard label="Applicants" value={stats.applicants} color={styles.accentGreen} />
        <StatCard label="Pending" value={stats.pending} color={styles.accentAmber || '#f59e0b'} />
        <StatCard label="Inactive" value={stats.inactive} color={styles.accentRed} />
      </div>
      <Panel>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5" style={{color: styles.textTertiary}} />
          <input type="text" placeholder="Search by name, email, or company..." value={search} onChange={(e) => setSearch(e.target.value)} className="sexy-input flex-1 px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} />
        </div>
      </Panel>
      <Panel>
        {loading ? (<div style={{color: styles.textTertiary, textAlign: 'center', padding: '40px'}}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{textAlign: 'center', padding: '60px'}}>
            <Users className="w-12 h-12 mx-auto mb-4" style={{color: styles.textTertiary}} />
            <p style={{color: styles.textSecondary, marginBottom: '8px'}}>No users found</p>
            <p style={{color: styles.textTertiary, fontSize: '14px'}}>{users.length === 0 ? 'The /api/users/ endpoint may not be configured.' : 'Try adjusting your search.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map(user => (
              <div key={user.id || user.email} onClick={() => { setSelectedUser(user); setShowEditModal(true); }} className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all" style={{background: 'rgba(255,255,255,0.02)', border: '1px solid ' + styles.borderGlass}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{background: styles.purplePrimary, color: '#fff', fontWeight: '400'}}>{user.full_name?.[0] || user.email?.[0] || '?'}</div>
                <div className="flex-1 min-w-0">
                  <p style={{color: styles.textPrimary, fontWeight: '500'}}>{user.full_name || 'No Name'}</p>
                  <p style={{color: styles.textTertiary, fontSize: '13px'}}>{user.email}</p>
                  {user.company && <p style={{color: styles.textTertiary, fontSize: '12px'}}>{user.company}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded text-xs" style={{background: user.role === 'admin' ? 'rgba(157,140,207,0.2)' : user.role === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.1)', color: user.role === 'admin' ? styles.purpleBright : user.role === 'pending' ? '#f59e0b' : styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase'}}>{user.role}</span>
                  {user.role === 'pending' && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleApproveUser(user.id, user.email)} className="px-2 py-1 rounded text-xs" style={{background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer'}}>Approve</button>
                      <button onClick={() => handleRejectUser(user.id, user.email)} className="px-2 py-1 rounded text-xs" style={{background: 'rgba(214,92,92,0.15)', color: '#d65c5c', border: '1px solid rgba(214,92,92,0.3)', cursor: 'pointer'}}>Reject</button>
                    </div>
                  )}
                  {user.is_active === false && <span className="px-2 py-1 rounded text-xs" style={{background: 'rgba(214,92,92,0.15)', color: styles.accentRed}}>Inactive</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: 'rgba(0,0,0,0.7)'}}>
          <div className="w-full max-w-md mx-4 p-6 rounded-xl" style={{background: styles.bgDeep, border: '1px solid ' + styles.borderGlass}}>
            <h2 style={{color: styles.textPrimary, fontSize: '20px', fontWeight: '400', marginBottom: '24px', textAlign: 'center'}}>Invite New User</h2>
            <div className="space-y-4">
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Email *</label><input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} placeholder="user@company.com" className="sexy-input w-full px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Full Name *</label><input type="text" value={inviteForm.full_name} onChange={(e) => setInviteForm({...inviteForm, full_name: e.target.value})} placeholder="John Smith" className="sexy-input w-full px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Company</label><input type="text" value={inviteForm.company} onChange={(e) => setInviteForm({...inviteForm, company: e.target.value})} placeholder="Company name" className="sexy-input w-full px-4 py-3 rounded-lg" style={{background: 'rgba(255,255,255,0.05)', border: '1px solid ' + styles.borderGlass, color: styles.textPrimary, outline: 'none'}} /></div>
              <div><label style={{color: styles.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px'}}>Role</label>
                <div className="flex gap-3">
                  <button onClick={() => setInviteForm({...inviteForm, role: 'applicant'})} className="flex-1 px-4 py-3 rounded-lg" style={{background: inviteForm.role === 'applicant' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (inviteForm.role === 'applicant' ? styles.purpleBright : styles.borderGlass), color: inviteForm.role === 'applicant' ? styles.purpleBright : styles.textTertiary}}>Applicant</button>
                  <button onClick={() => setInviteForm({...inviteForm, role: 'admin'})} className="flex-1 px-4 py-3 rounded-lg" style={{background: inviteForm.role === 'admin' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (inviteForm.role === 'admin' ? styles.purpleBright : styles.borderGlass), color: inviteForm.role === 'admin' ? styles.purpleBright : styles.textTertiary}}>Admin</button>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <button onClick={handleInvite} disabled={inviteLoading} className="sexy-btn w-full px-4 py-3 rounded-lg" style={{background: styles.purplePrimary, border: '1px solid ' + styles.purpleBright, color: '#fff', opacity: inviteLoading ? 0.7 : 1}}>{inviteLoading ? 'Creating...' : 'Create Account'}</button>
              <button onClick={() => { setShowInviteModal(false); setInviteForm({ email: '', full_name: '', company: '', role: 'applicant' }); }} className="w-full px-4 py-3 rounded-lg" style={{background: 'transparent', border: 'none', color: styles.textTertiary}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: 'rgba(0,0,0,0.7)'}}>
          <div className="w-full max-w-md mx-4 p-6 rounded-xl" style={{background: styles.bgDeep, border: '1px solid ' + styles.borderGlass}}>
            <h2 style={{color: styles.textPrimary, fontSize: '20px', fontWeight: '400', marginBottom: '24px', textAlign: 'center'}}>Manage User</h2>
            <div className="text-center mb-6 p-4 rounded-lg" style={{background: 'rgba(255,255,255,0.03)'}}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{background: styles.purplePrimary, color: '#fff', fontSize: '24px', fontWeight: '400'}}>{selectedUser.full_name?.[0] || selectedUser.email?.[0] || '?'}</div>
              <p style={{color: styles.textPrimary, fontSize: '18px', fontWeight: '500'}}>{selectedUser.full_name || 'No Name'}</p>
              <p style={{color: styles.textTertiary, fontSize: '14px'}}>{selectedUser.email}</p>
            </div>
            <div className="mb-6">
              <label style={{color: styles.textTertiary, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px'}}>Role</label>
              <div className="flex gap-3">
                <button onClick={() => handleUpdateRole(selectedUser.id, 'applicant')} className="flex-1 px-4 py-3 rounded-lg" style={{background: selectedUser.role === 'applicant' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (selectedUser.role === 'applicant' ? styles.purpleBright : styles.borderGlass), color: selectedUser.role === 'applicant' ? styles.purpleBright : styles.textTertiary}}>Applicant</button>
                <button onClick={() => handleUpdateRole(selectedUser.id, 'admin')} className="flex-1 px-4 py-3 rounded-lg" style={{background: selectedUser.role === 'admin' ? 'rgba(157,140,207,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (selectedUser.role === 'admin' ? styles.purpleBright : styles.borderGlass), color: selectedUser.role === 'admin' ? styles.purpleBright : styles.textTertiary}}>Admin</button>
              </div>
            </div>
            <div className="space-y-2 mb-6">
              <label style={{color: styles.textTertiary, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px'}}>Actions</label>
              <button onClick={() => handleResetPassword(selectedUser.id, selectedUser.email)} className="w-full px-4 py-3 rounded-lg flex items-center gap-3" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: styles.textSecondary, textAlign: 'left'}}><RefreshCw className="w-4 h-4" style={{color: styles.purpleBright}} />Reset Password</button>
              <button onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active !== false)} className="w-full px-4 py-3 rounded-lg flex items-center gap-3" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid ' + styles.borderGlass, color: selectedUser.is_active === false ? styles.accentGreen : styles.accentRed, textAlign: 'left'}}>{selectedUser.is_active === false ? <><CheckCircle className="w-4 h-4" /> Activate Account</> : <><X className="w-4 h-4" /> Deactivate Account</>}</button>
              <button onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)} className="w-full px-4 py-3 rounded-lg flex items-center gap-3" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed, textAlign: 'left'}}><X className="w-4 h-4" /> Delete User</button>
            </div>
            <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="w-full px-4 py-3 rounded-lg" style={{background: 'transparent', border: 'none', color: styles.textTertiary}}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><RoleBasedDashboard /></Layout></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Layout><ApplicationsList /></Layout></ProtectedRoute>} />
          <Route path="/applications/new" element={<ProtectedRoute><Layout><NewApplication /></Layout></ProtectedRoute>} />
          <Route path="/applications/:id" element={<ProtectedRoute><Layout><ApplicationDetail /></Layout></ProtectedRoute>} />
          <Route path="/cat72" element={<ProtectedRoute roles={['admin', 'operator']}><Layout><CAT72Console /></Layout></ProtectedRoute>} />
          <Route path="/certificates" element={<ProtectedRoute><Layout><CertificatesPage /></Layout></ProtectedRoute>} />
          <Route path="/pending" element={<PendingPage />} />
          <Route path="/resources" element={<ProtectedRoute><Layout><ResourcesPage /></Layout></ProtectedRoute>} />
          <Route path="/envelo" element={<ProtectedRoute><Layout><EnveloPage /></Layout></ProtectedRoute>} />
          <Route path="/monitoring" element={<ProtectedRoute><Layout><MonitoringPage /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
// Mon Jan 26 10:20:46 CST 2026
// User Management v2
