import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { FileText, Activity, Award, Users, Home, LogOut, Menu, X, CheckCircle, AlertTriangle, Clock, Search, Plus, ArrowLeft, ExternalLink } from 'lucide-react';
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
        className="rounded-full animate-pulse"
        style={{
          width: size * 0.33,
          height: size * 0.33,
          background: '#c4b8e8',
          boxShadow: '0 0 10px rgba(157,140,207,0.5)',
        }}
      />
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
  bgPanel: 'rgba(255,255,255,0.05)',
  purplePrimary: '#5B4B8A',
  purpleBright: '#9d8ccf',
  purpleGlow: 'rgba(157,140,207,0.20)',
  accentGreen: '#5CD685',
  accentAmber: '#D6A05C',
  accentRed: '#D65C5C',
  textPrimary: 'rgba(255,255,255,0.94)',
  textSecondary: 'rgba(255,255,255,0.75)',
  textTertiary: 'rgba(255,255,255,0.50)',
  borderGlass: 'rgba(255,255,255,0.10)',
};

// Layout
function Layout({ children }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'operator', 'applicant', 'licensee'] },
    { name: 'Applications', href: '/applications', icon: FileText, roles: ['admin', 'operator', 'applicant'] },
    { name: 'CAT-72 Console', href: '/cat72', icon: Activity, roles: ['admin', 'operator'] },
    { name: 'Certificates', href: '/certificates', icon: Award, roles: ['admin', 'operator', 'applicant'] },
    { name: 'Licensees', href: '/licensees', icon: Users, roles: ['admin', 'licensee'] },
  ];

  const filteredNav = navigation.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen" style={{background: `radial-gradient(1200px 700px at 15% 10%, rgba(91,75,138,0.15), transparent 55%), radial-gradient(900px 600px at 85% 80%, rgba(92,214,133,0.06), transparent 55%), ${styles.bgDeep}`, color: styles.textPrimary, fontFamily: "'Inter', system-ui, -apple-system, sans-serif"}}>
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '120px 120px',
        opacity: 0.15,
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.95) 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.95) 20%, transparent 70%)',
      }} />

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} style={{background: 'rgba(42,47,61,0.95)', backdropFilter: 'blur(18px)', borderRight: `1px solid ${styles.borderGlass}`}}>
        <div className="flex items-center justify-between h-16 px-4" style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
          <Link to="/dashboard" className="flex items-center gap-3 no-underline">
            <BrandMark size={24} />
            <span style={{fontFamily: "'Inter', sans-serif", fontWeight: 400, color: styles.textPrimary}}>Sentinel Authority</span>
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
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all no-underline"
              style={{
                background: location.pathname.startsWith(item.href) ? styles.purplePrimary : 'transparent',
                color: location.pathname.startsWith(item.href) ? '#fff' : styles.textTertiary,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              <item.icon className="w-4 h-4" />
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
        <header className="h-16 flex items-center px-6 gap-4" style={{borderBottom: `1px solid ${styles.borderGlass}`, background: 'rgba(42,47,61,0.5)', backdropFilter: 'blur(12px)'}}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden" style={{color: styles.textSecondary, background: 'none', border: 'none'}}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <ExternalLink className="w-4 h-4" />
            Main Site
          </a>
          <a href="https://api.sentinelauthority.org/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <FileText className="w-4 h-4" />
            API Docs
          </a>
          <Link to="/verify" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <Search className="w-4 h-4" />
            Verify
          </Link>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

// Panel Component
function Panel({ children, className = '' }) {
  return (
    <div className={`rounded-xl p-6 ${className}`} style={{background: styles.bgPanel, border: `1px solid ${styles.borderGlass}`, backdropFilter: 'blur(12px)'}}>
      {children}
    </div>
  );
}

// Login Page
function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '', organization_name: '' });

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
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: `radial-gradient(1200px 700px at 15% 10%, rgba(91,75,138,0.15), transparent 55%), radial-gradient(900px 600px at 85% 80%, rgba(92,214,133,0.06), transparent 55%), ${styles.bgDeep}`}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandMark size={48} />
          </div>
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '32px', fontWeight: 200, color: styles.textPrimary, margin: 0}}>ODDC Platform</h1>
          <p style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '8px'}}>Sentinel Authority</p>
          <a href="https://sentinelauthority.org" className="mt-4 inline-block" style={{color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px'}}>← MAIN SITE</a>
        </div>
        
        <Panel>
          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{background: 'rgba(214,92,92,0.15)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed}}>{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
                  style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'Inter', sans-serif"}}
                  required
                />
                <input
                  type="text"
                  placeholder="Organization Name"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
                  style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'Inter', sans-serif"}}
                  required
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
              style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'Inter', sans-serif"}}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
              style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'Inter', sans-serif"}}
              required
            />
            <button 
              type="submit" 
              className="w-full py-3 rounded-lg font-medium transition-all"
              style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer'}}
            >
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)} 
              style={{color: styles.purpleBright, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '14px'}}
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// Dashboard
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [activeTests, setActiveTests] = useState([]);

  useEffect(() => {
    api.get('/api/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
    api.get('/api/dashboard/recent-applications').then(res => setRecentApps(res.data)).catch(console.error);
    api.get('/api/dashboard/active-tests').then(res => setActiveTests(res.data)).catch(console.error);
  }, []);

  const statCards = [
    { label: 'Total Applications', value: stats?.total_applications || 0, color: styles.purpleBright },
    { label: 'Active Tests', value: stats?.active_tests || 0, color: styles.accentAmber },
    { label: 'Certificates Issued', value: stats?.certificates_issued || 0, color: styles.accentGreen },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Overview</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <Panel key={i}>
            <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '8px'}}>{stat.label}</p>
            <p style={{fontFamily: "'Source Serif 4', serif", fontSize: '42px', fontWeight: 200, color: stat.color, margin: 0}}>{stat.value}</p>
          </Panel>
        ))}
      </div>

      {/* Active Tests */}
      {activeTests.length > 0 && (
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Active CAT-72 Tests</h2>
          <div className="space-y-3">
            {activeTests.map((test) => (
              <div key={test.id} className="p-4 rounded-lg" style={{background: 'rgba(255,255,255,0.03)', border: `1px solid ${styles.borderGlass}`}}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{test.test_id}</span>
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
          <Link to="/applications/new" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors no-underline" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>
            <Plus className="w-4 h-4" />
            New Application
          </Link>
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
                  <td className="px-4 py-3" style={{color: styles.textTertiary, fontSize: '14px'}}>{new Date(app.created_at).toLocaleDateString()}</td>
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
        <Link to="/applications/new" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors no-underline" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <Plus className="w-4 h-4" />
          New Application
        </Link>
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
                <td className="px-4 py-4" style={{color: styles.textTertiary, fontSize: '14px'}}>{new Date(app.created_at).toLocaleDateString()}</td>
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

// New Application Form
function NewApplication() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    organization_name: '', system_name: '', system_description: '',
    odd_specification: '', contact_email: '', contact_phone: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/applications/', formData);
      navigate('/applications');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit application');
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${styles.borderGlass}`,
    color: styles.textPrimary,
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/applications" className="flex items-center gap-2 mb-4 no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>New Submission</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>ODDC Application</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Submit your autonomous system for conformance determination</p>
      </div>

      <Panel>
        {error && <div className="mb-4 p-3 rounded-lg" style={{background: 'rgba(214,92,92,0.15)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed}}>{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>Organization Information</h2>
            <div className="space-y-4">
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Organization Name</label>
                <input type="text" value={formData.organization_name} onChange={(e) => setFormData({...formData, organization_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Contact Email</label>
                  <input type="email" value={formData.contact_email} onChange={(e) => setFormData({...formData, contact_email: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} required />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Contact Phone</label>
                  <input type="tel" value={formData.contact_phone} onChange={(e) => setFormData({...formData, contact_phone: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          <div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '24px'}}>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>System Information</h2>
            <div className="space-y-4">
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>System Name</label>
                <input type="text" value={formData.system_name} onChange={(e) => setFormData({...formData, system_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} required />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>System Description</label>
                <textarea value={formData.system_description} onChange={(e) => setFormData({...formData, system_description: e.target.value})} rows={4} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} required />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>ODD Specification</label>
                <textarea value={formData.odd_specification} onChange={(e) => setFormData({...formData, odd_specification: e.target.value})} rows={6} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Describe the Operational Design Domain including environment type, speed limits, geographic constraints, weather conditions, etc." required />
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-3 rounded-lg transition-all" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer'}}>
            Submit Application
          </button>
        </form>
      </Panel>
    </div>
  );
}

// Application Detail
function ApplicationDetail() {
  const { id } = useLocation().pathname.match(/\/applications\/(\d+)/)?.slice(1) || [];
  const [app, setApp] = useState(null);

  useEffect(() => {
    if (id) {
      api.get(`/api/applications/${id}`).then(res => setApp(res.data)).catch(console.error);
    }
  }, [id]);

  if (!app) return <div style={{color: styles.textTertiary}}>Loading...</div>;

  return (
    <div className="space-y-6">
      <Link to="/applications" className="flex items-center gap-2 no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>
        <ArrowLeft className="w-4 h-4" />
        Back to Applications
      </Link>
      
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Application Detail</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>{app.system_name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Organization</h2>
          <p style={{color: styles.textPrimary, fontSize: '18px', marginBottom: '8px'}}>{app.organization_name}</p>
          <p style={{color: styles.textSecondary}}>{app.contact_email}</p>
        </Panel>
        <Panel>
          <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Status</h2>
          <span className="px-3 py-1 rounded" style={{
            background: app.state === 'conformant' ? 'rgba(92,214,133,0.15)' : 'rgba(214,160,92,0.15)',
            color: app.state === 'conformant' ? styles.accentGreen : styles.accentAmber,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {app.state}
          </span>
        </Panel>
      </div>

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>ODD Specification</h2>
        <p style={{color: styles.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{app.odd_specification}</p>
      </Panel>
    </div>
  );
}

// CAT-72 Console
function CAT72Console() {
  const [tests, setTests] = useState([]);

  useEffect(() => {
    api.get('/api/cat72/tests').then(res => setTests(res.data)).catch(console.error);
  }, []);

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
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id} style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <td className="px-4 py-4" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{test.test_id}</td>
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

  useEffect(() => {
    api.get('/api/certificates/').then(res => setCertificates(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Records</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>Certificates</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Issued ODDC conformance determinations</p>
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
            {certificates.map((cert) => (
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
        {certificates.length === 0 && (
          <div className="text-center py-12" style={{color: styles.textTertiary}}>No certificates issued</div>
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
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      const res = await api.get(`/api/certificates/verify/${certNumber}`);
      setResult(res.data);
    } catch (err) {
      setError('Certificate not found');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: `radial-gradient(1200px 700px at 15% 10%, rgba(91,75,138,0.15), transparent 55%), radial-gradient(900px 600px at 85% 80%, rgba(92,214,133,0.06), transparent 55%), ${styles.bgDeep}`}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandMark size={48} />
          </div>
          <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '32px', fontWeight: 200, color: styles.textPrimary, margin: 0}}>Verify Certificate</h1>
          <p style={{color: styles.textTertiary, marginTop: '8px'}}>Enter a certificate number to verify its status</p>
        </div>

        <Panel>
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              placeholder="e.g., ODDC-2026-00001"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-lg outline-none"
              style={{background: 'rgba(255,255,255,0.05)', border: `1px solid ${styles.borderGlass}`, color: styles.textPrimary, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center'}}
            />
            <button type="submit" className="w-full py-3 rounded-lg transition-all" style={{background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer'}}>
              Verify
            </button>
          </form>

          {error && <div className="mt-4 p-4 rounded-lg text-center" style={{background: 'rgba(214,92,92,0.15)', border: '1px solid rgba(214,92,92,0.3)', color: styles.accentRed}}>{error}</div>}

          {result && (
            <div className="mt-6 p-4 rounded-lg" style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)'}}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5" style={{color: styles.accentGreen}} />
                <span style={{color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Valid Certificate</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span style={{color: styles.textTertiary, fontSize: '14px'}}>Organization</span>
                  <span style={{color: styles.textPrimary}}>{result.organization_name}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{color: styles.textTertiary, fontSize: '14px'}}>System</span>
                  <span style={{color: styles.textPrimary}}>{result.system_name}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{color: styles.textTertiary, fontSize: '14px'}}>Status</span>
                  <span style={{color: styles.accentGreen, textTransform: 'uppercase'}}>{result.state}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{color: styles.textTertiary, fontSize: '14px'}}>Expires</span>
                  <span style={{color: styles.textPrimary}}>{new Date(result.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <div className="mt-6 text-center">
          <Link to="/login" style={{color: styles.purpleBright, fontFamily: "'Inter', sans-serif", fontSize: '14px'}}>
            Back to Platform
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main App
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Layout><ApplicationsList /></Layout></ProtectedRoute>} />
          <Route path="/applications/new" element={<ProtectedRoute><Layout><NewApplication /></Layout></ProtectedRoute>} />
          <Route path="/applications/:id" element={<ProtectedRoute><Layout><ApplicationDetail /></Layout></ProtectedRoute>} />
          <Route path="/cat72" element={<ProtectedRoute roles={['admin', 'operator']}><Layout><CAT72Console /></Layout></ProtectedRoute>} />
          <Route path="/certificates" element={<ProtectedRoute><Layout><CertificatesPage /></Layout></ProtectedRoute>} />
          <Route path="/licensees" element={<ProtectedRoute><Layout><LicenseesPage /></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
