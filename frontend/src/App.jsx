import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { FileText, Activity, Award, Users, Home, LogOut, Menu, X, CheckCircle, AlertTriangle, Clock, Search, Plus, ArrowLeft, ExternalLink, Shield, Download } from 'lucide-react';
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
    { name: 'ENVELO Agent', href: '/envelo', icon: 'brand', roles: ['admin', 'applicant'], requiresCert: true },
    { name: 'Monitoring', href: '/monitoring', icon: Activity, roles: ['admin', 'applicant'], requiresCert: true },
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
        <header className="h-16 flex items-center px-6 gap-4" style={{borderBottom: `1px solid ${styles.borderGlass}`, background: 'rgba(42,47,61,0.5)', backdropFilter: 'blur(12px)'}}>
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
          <div style={{textAlign: 'center', padding: '12px'}}>
            <div style={{fontSize: '36px', fontWeight: 200, color: styles.purpleBright}}>{applications.length}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Applications</div>
          </div>
        </Panel>
        <Panel>
          <div style={{textAlign: 'center', padding: '12px'}}>
            <div style={{fontSize: '36px', fontWeight: 200, color: styles.accentGreen}}>{certificates.length}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px'}}>Certificates</div>
          </div>
        </Panel>
        <Panel>
          <div style={{textAlign: 'center', padding: '12px'}}>
            <a href="https://sentinel-website-eta.vercel.app/status.html" target="_blank" style={{display: 'block', textDecoration: 'none'}}>
              <div style={{fontSize: '24px', marginBottom: '8px'}}>📊</div>
              <div style={{fontSize: '11px', color: styles.purpleBright, textTransform: 'uppercase', letterSpacing: '1px'}}>Check Test Status</div>
            </a>
          </div>
        </Panel>
      </div>

      {/* Applications */}
      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Applications</h2>
        {applications.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px', color: styles.textTertiary}}>
            <p style={{marginBottom: '16px'}}>No applications yet</p>
            <a href="https://sentinelauthority.org/apply.html" style={{color: styles.purpleBright}}>Apply for Certification →</a>
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

// New Application Form
function NewApplication() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    organization_name: '', contact_name: '', contact_email: '', contact_phone: '',
    system_name: '', system_type: '', system_description: '', system_version: '', manufacturer: '',
    odd_specification: '', envelope_definition: '',
    facility_location: '', preferred_test_date: '', notes: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        odd_specification: formData.odd_specification ? { description: formData.odd_specification } : null,
        envelope_definition: formData.envelope_definition ? { description: formData.envelope_definition } : null,
        preferred_test_date: formData.preferred_test_date || null,
      };
      await api.post('/api/applications/', payload);
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
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Organization Name *</label>
                <input type="text" value={formData.organization_name} onChange={(e) => setFormData({...formData, organization_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} required />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Contact Name</label>
                <input type="text" value={formData.contact_name} onChange={(e) => setFormData({...formData, contact_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Contact Email *</label>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>System Name *</label>
                  <input type="text" value={formData.system_name} onChange={(e) => setFormData({...formData, system_name: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} required />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>System Type *</label>
                  <select value={formData.system_type} onChange={(e) => setFormData({...formData, system_type: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} required>
                    <option value="">Select type...</option>
                    <option value="mobile_robot">Mobile Robot / AMR</option>
                    <option value="industrial_arm">Industrial Robot Arm</option>
                    <option value="drone">Drone / UAV</option>
                    <option value="autonomous_vehicle">Autonomous Vehicle</option>
                    <option value="agv">Automated Guided Vehicle (AGV)</option>
                    <option value="cobot">Collaborative Robot (Cobot)</option>
                    <option value="other">Other Autonomous System</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>System Version</label>
                  <input type="text" value={formData.system_version} onChange={(e) => setFormData({...formData, system_version: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="e.g., 1.0.0" />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Manufacturer</label>
                  <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({...formData, manufacturer: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>System Description *</label>
                <textarea value={formData.system_description} onChange={(e) => setFormData({...formData, system_description: e.target.value})} rows={4} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} required />
              </div>
            </div>
          </div>

          <div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '24px'}}>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>Operational Domain</h2>
            <div className="space-y-4">
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>ODD Specification *</label>
                <textarea value={formData.odd_specification} onChange={(e) => setFormData({...formData, odd_specification: e.target.value})} rows={6} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Example: Indoor warehouse environment, max speed 5 mph, operating temperature 40-90°F, flat concrete surfaces only, no human workers in active zones during operation." required />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Safety Boundaries & Operational Limits</label>
                <textarea value={formData.envelope_definition} onChange={(e) => setFormData({...formData, envelope_definition: e.target.value})} rows={4} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Example: Speed limit 5 mph (hard stop at 6 mph), geofenced to warehouse floor coordinates, emergency stop if human detected within 10ft, operating hours 6am-10pm." />
              </div>
            </div>
          </div>

          <div style={{borderTop: `1px solid ${styles.borderGlass}`, paddingTop: '24px'}}>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '16px'}}>Testing Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Facility Location</label>
                  <input type="text" value={formData.facility_location} onChange={(e) => setFormData({...formData, facility_location: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} placeholder="Testing facility address" />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Preferred Test Date</label>
                  <input type="date" value={formData.preferred_test_date} onChange={(e) => setFormData({...formData, preferred_test_date: e.target.value})} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', color: styles.textSecondary, fontSize: '14px'}}>Additional Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-lg outline-none resize-none" style={inputStyle} placeholder="Any additional information relevant to your application" />
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
        <div className="p-4 rounded-lg" style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)'}}>
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
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    {test.state === 'scheduled' && (
                      <button
                        onClick={() => handleStart(test.test_id)}
                        disabled={loading[test.test_id]}
                        className="px-3 py-1 rounded transition-colors"
                        style={{background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer'}}
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
      const res = await api.get(`/api/verify/${certNumber}`);
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

          {result && (result.status === 'NOT_FOUND' || result.state === 'NOT_FOUND') && (
            <div className="mt-6 p-4 rounded-lg text-center" style={{background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)'}}>
              <span style={{color: styles.accentRed, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase'}}>Certificate Not Found</span>
              <p style={{color: styles.textSecondary, marginTop: '8px', fontSize: '14px'}}>No certificate exists with number: {result.certificate_number}</p>
            </div>
          )}

          {result && result.status !== 'NOT_FOUND' && result.state !== 'NOT_FOUND' && (
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
          <Link to="/dashboard" style={{color: styles.purpleBright, fontFamily: "'Inter', sans-serif", fontSize: '14px'}}>
            Back to Dashboard
          </Link>
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
            fontWeight: 600,
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
          <div style={{padding: '12px 20px', background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)', borderRadius: '6px'}}>
            <div style={{fontSize: '24px', fontWeight: 700, color: styles.accentGreen}}>{stats.pass}</div>
            <div style={{fontSize: '11px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px'}}>Passed</div>
          </div>
          <div style={{padding: '12px 20px', background: 'rgba(214,92,92,0.1)', border: '1px solid rgba(214,92,92,0.3)', borderRadius: '6px'}}>
            <div style={{fontSize: '24px', fontWeight: 700, color: '#D65C5C'}}>{stats.block}</div>
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
          <div style={{fontSize: '28px', fontWeight: 700, color: '#fff'}}>{(session.pass_count || 0) + (session.block_count || 0)}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Total Actions</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(92,214,133,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 700, color: '#5CD685'}}>{session.pass_count || 0}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Passed</div>
        </div>
        <div style={{padding: '16px', background: 'rgba(214,92,92,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 700, color: '#D65C5C'}}>{session.block_count || 0}</div>
          <div style={{fontSize: '11px', color: '#888', textTransform: 'uppercase'}}>Blocked</div>
        </div>
        <div style={{padding: '16px', background: passRate >= 95 ? 'rgba(92,214,133,0.1)' : 'rgba(214,92,92,0.1)', borderRadius: '8px', textAlign: 'center'}}>
          <div style={{fontSize: '28px', fontWeight: 700, color: passRate >= 95 ? '#5CD685' : '#D65C5C'}}>{passRate}%</div>
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
        <tbody>{records.map((r, i) => (<tr key={i} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}><td style={{padding: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#aaa'}}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '-'}</td><td style={{padding: '8px', color: '#fff'}}>{r.action_type}</td><td style={{padding: '8px'}}><span style={{padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: r.result === 'PASS' ? 'rgba(92,214,133,0.2)' : 'rgba(214,92,92,0.2)', color: r.result === 'PASS' ? '#5CD685' : '#D65C5C'}}>{r.result}</span></td><td style={{padding: '8px', color: '#666', fontFamily: 'monospace', fontSize: '10px'}}>{JSON.stringify(r.parameters || {})}</td></tr>))}</tbody>
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
        <div style={{background: 'rgba(92,214,133,0.1)', border: '1px solid rgba(92,214,133,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px'}}>
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
function EnveloPage() {
  const [activeApiKey, setActiveApiKey] = useState(null);
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [userCerts, setUserCerts] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const [cat72Status, setCat72Status] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

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
        setUserCerts(certsRes.data || []);
        setUserApps(appsRes.data || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const hasCert = user?.role === 'admin' || userCerts.some(c => c.status === 'issued' || c.status === 'active');
  const hasApprovedApp = userApps.some(a => a.status === 'approved' || a.status === 'testing');
  const canAccessAgent = hasCert || hasApprovedApp;
  const isTestMode = hasApprovedApp && !hasCert;
  const approvedApps = userApps.filter(a => a.status === 'approved' || a.status === 'testing');

  if (loading) {
    return <div style={{color: styles.textTertiary, padding: '40px', textAlign: 'center'}}>Loading...</div>;
  }

  if (!canAccessAgent) {
    return (
      <div className="space-y-6">
        <Panel>
          <div style={{textAlign: 'center', padding: '40px'}}>
            <Award size={48} style={{color: styles.textTertiary, margin: '0 auto 16px'}} />
            <h2 style={{fontFamily: "'Source Serif 4', serif", fontSize: '24px', fontWeight: 200, marginBottom: '12px'}}>Application Approval Required</h2>
            <p style={{color: styles.textSecondary, marginBottom: '24px'}}>Your application must be approved before you can access the ENVELO Agent.</p>
            <p style={{color: styles.textTertiary, fontSize: '13px'}}>Once approved, you can download the agent and begin CAT-72 testing.</p>
          </div>
        </Panel>
      </div>
    );
  }

  const certifiedSystems = userCerts.filter(c => c.status === 'issued' || c.status === 'active');

  const downloadAgentForSystem = (cert) => {
    const agentCode = `#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
System: ${cert.system_name || 'Unknown'}
Certificate: ${cert.certificate_number}
Generated: ${new Date().toISOString()}

This agent is pre-configured for your certified system.
"""

import os
import json
import time
import hashlib
import requests
from datetime import datetime
from functools import wraps

# Configuration - DO NOT MODIFY
SENTINEL_API = "https://api.sentinelauthority.org"
CERTIFICATE_NUMBER = "${cert.certificate_number}"
SYSTEM_NAME = "${cert.system_name || 'Unknown'}"

class EnveloAgent:
    def __init__(self, api_key):
        self.api_key = api_key
        self.session_id = None
        self.boundaries = {}
        self.violations = []
        
    def start_session(self):
        try:
            res = requests.post(f"{SENTINEL_API}/api/envelo/session/start", 
                headers={"X-API-Key": self.api_key},
                json={"certificate_number": CERTIFICATE_NUMBER, "system_name": SYSTEM_NAME})
            if res.ok:
                self.session_id = res.json().get("session_id")
                print(f"[ENVELO] Session started: {self.session_id}")
                return True
        except Exception as e:
            print(f"[ENVELO] Failed to start session: {e}")
        return False
    
    def add_boundary(self, name, min_val=None, max_val=None, allowed_values=None):
        self.boundaries[name] = {"min": min_val, "max": max_val, "allowed": allowed_values}
    
    def check(self, name, value):
        if name not in self.boundaries:
            return True
        b = self.boundaries[name]
        if b["min"] is not None and value < b["min"]:
            self._report_violation(name, value, f"Below minimum {b['min']}")
            return False
        if b["max"] is not None and value > b["max"]:
            self._report_violation(name, value, f"Above maximum {b['max']}")
            return False
        if b["allowed"] is not None and value not in b["allowed"]:
            self._report_violation(name, value, f"Not in allowed values")
            return False
        return True
    
    def _report_violation(self, name, value, reason):
        violation = {"parameter": name, "value": value, "reason": reason, "timestamp": datetime.utcnow().isoformat()}
        self.violations.append(violation)
        try:
            requests.post(f"{SENTINEL_API}/api/envelo/violation",
                headers={"X-API-Key": self.api_key},
                json={"session_id": self.session_id, **violation})
        except:
            pass
        print(f"[ENVELO] VIOLATION: {name}={value} - {reason}")
    
    def enforce(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    
    def shutdown(self):
        if self.session_id:
            try:
                requests.post(f"{SENTINEL_API}/api/envelo/session/end",
                    headers={"X-API-Key": self.api_key},
                    json={"session_id": self.session_id})
            except:
                pass
        print(f"[ENVELO] Session ended. Violations: {len(self.violations)}")

if __name__ == "__main__":
    print("=" * 60)
    print("  ENVELO Agent - Sentinel Authority")
    print(f"  System: {SYSTEM_NAME}")
    print(f"  Certificate: {CERTIFICATE_NUMBER}")
    print("=" * 60)
    print()
    print("To use this agent, set your API key:")
    print("  agent = EnveloAgent('your-api-key-here')")
    print("  agent.start_session()")
    print("  agent.add_boundary('speed', min_val=0, max_val=100)")
    print("  agent.check('speed', 75)  # Returns True")
    print("  agent.check('speed', 150) # Returns False, reports violation")
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
      <div>
        <p style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: styles.purpleBright, marginBottom: '8px'}}>Runtime Enforcement</p>
        <h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '36px', fontWeight: 200, margin: 0}}>ENVELO Agent</h1>
        <p style={{color: styles.textSecondary, marginTop: '8px'}}>Download and configure the enforcement agent for your certified systems</p>
      </div>

      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Active Sessions</h2>
            <p style={{fontSize: '32px', fontWeight: 200, color: styles.purpleBright}}>{stats?.active_sessions || 0}</p>
          </Panel>
          <Panel>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Total Telemetry</h2>
            <p style={{fontSize: '32px', fontWeight: 200, color: styles.textPrimary}}>{stats?.total_telemetry_records || 0}</p>
          </Panel>
          <Panel>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Violations Blocked</h2>
            <p style={{fontSize: '32px', fontWeight: 200, color: styles.accentRed}}>{stats?.total_violations || 0}</p>
          </Panel>
        </div>
      )}

      {isTestMode && (
        <Panel style={{background: 'linear-gradient(135deg, rgba(91,75,138,0.2), rgba(91,75,138,0.05))', border: '1px solid rgba(157,140,207,0.4)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 2s infinite'}}></div>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#f59e0b', margin: 0}}>Test Mode Active</h2>
          </div>
          <p style={{color: styles.textSecondary, marginBottom: '20px'}}>Your application has been approved. Deploy the ENVELO Agent and complete 72 hours of continuous operation to earn certification.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{marginBottom: '20px'}}>
            {approvedApps.map(app => (
              <div key={app.id} style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)'}}>
                <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>System</div>
                <div style={{fontSize: '14px', color: styles.textPrimary, marginBottom: '12px'}}>{app.system_name}</div>
                <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>CAT-72 Status</div>
                <div style={{fontSize: '14px', color: app.cat72_started ? styles.accentGreen : '#f59e0b'}}>
                  {app.cat72_started ? `In Progress` : 'Ready to Start'}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)'}}>
            <h3 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '12px'}}>Next Steps</h3>
            <ol style={{margin: 0, paddingLeft: '20px', color: styles.textSecondary, fontSize: '13px'}}>
              <li style={{marginBottom: '8px'}}>Generate an API key below</li>
              <li style={{marginBottom: '8px'}}>Download the ENVELO Agent for your system</li>
              <li style={{marginBottom: '8px'}}>Deploy the agent on your autonomous system</li>
              <li style={{marginBottom: '8px'}}>Run continuously for 72 hours with no violations</li>
              <li>Certification issued automatically upon successful completion</li>
            </ol>
          </div>
        </Panel>
      )}

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>{isTestMode ? 'Systems Ready for Testing' : 'Your Certified Systems'}</h2>
        <p style={{color: styles.textSecondary, marginBottom: '20px'}}>{isTestMode ? 'Download the ENVELO Agent for your approved systems. Run continuously for 72 hours to complete certification.' : 'Download the ENVELO Agent pre-configured for each certified system. The agent must remain running to maintain certification compliance.'}</p>
        
        {certifiedSystems.length > 0 ? (
          <div className="space-y-4">
            {certifiedSystems.map(cert => (
              <div key={cert.id} style={{padding: '20px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
                  <div>
                    <h3 style={{fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 500, color: styles.textPrimary, margin: '0 0 8px 0'}}>{cert.system_name || 'Unnamed System'}</h3>
                    <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright, marginBottom: '4px'}}>{cert.certificate_number}</div>
                    <div style={{fontSize: '12px', color: styles.textTertiary}}>
                      Expires: {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <span style={{padding: '4px 12px', background: 'rgba(92,214,133,0.15)', border: '1px solid rgba(92,214,133,0.3)', borderRadius: '20px', fontSize: '11px', color: styles.accentGreen, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase'}}>
                      {cert.status}
                    </span>
                    <button
                      onClick={() => downloadAgentForSystem(cert)}
                      style={{padding: '10px 20px', background: styles.purplePrimary, border: `1px solid ${styles.purpleBright}`, borderRadius: '6px', color: '#fff', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
                    >
                      <Download size={14} /> Download Agent
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{color: styles.textTertiary, fontSize: '14px'}}>No certified systems found.</p>
        )}
      </Panel>

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>API Keys</h2>
        <p style={{color: styles.textSecondary, marginBottom: '16px'}}>Generate API keys to authenticate your ENVELO Agent.</p>
        <APIKeyManager onKeyGenerated={setActiveApiKey} />
      </Panel>

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Configure Boundaries</h2>
        <p style={{color: styles.textSecondary, marginBottom: '16px'}}>Define your ODD boundaries. These will be included in your agent configuration.</p>
        <BoundaryConfigurator />
      </Panel>

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Test Agent (No Install Required)</h2>
        <p style={{color: styles.textSecondary, marginBottom: '16px'}}>Run a live simulation to see ENVELO enforce ODD boundaries in real-time.</p>
        <AgentSimulator apiKey={activeApiKey} />
      </Panel>

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Your Configuration</h2>
        <p style={{color: styles.textSecondary, marginBottom: '16px'}}>Use these values when initializing the ENVELO Agent:</p>
        <div style={{background: 'rgba(0,0,0,0.3)', border: `1px solid ${styles.borderGlass}`, borderRadius: '8px', padding: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px'}}>
          <p style={{color: styles.textTertiary, marginBottom: '8px'}}># Your ENVELO configuration</p>
          <p style={{color: styles.textSecondary}}>certificate_id = <span style={{color: styles.accentGreen}}>"YOUR-CERTIFICATE-ID"</span></p>
          <p style={{color: styles.textSecondary}}>api_key = <span style={{color: styles.accentGreen}}>"{activeApiKey || 'YOUR-API-KEY'}"</span></p>
          <p style={{color: styles.textSecondary}}>api_endpoint = <span style={{color: styles.accentGreen}}>"https://api.sentinelauthority.org"</span></p>
        </div>
        <p style={{color: styles.textTertiary, fontSize: '12px', marginTop: '12px'}}>Replace YOUR-CERTIFICATE-ID with your actual ODDC certificate number after certification.</p>
        <div style={{marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${styles.borderGlass}`}}>
          <a href="https://sentinel-website-eta.vercel.app/status.html" target="_blank" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(157,140,207,0.1)', border: '1px solid rgba(157,140,207,0.3)', borderRadius: '8px', color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '1px', textDecoration: 'none'}}>Check Test Status →</a>
        </div>
      </Panel>

      
      {selectedSession && (
        <Panel>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Session Report</h2>
            <button onClick={() => setSelectedSession(null)} style={{padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#888', cursor: 'pointer', fontSize: '12px'}}>✕ Close</button>
          </div>
          <SessionReport session={selectedSession} />
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '12px'}}><h3 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, margin: 0}}>Telemetry Log</h3><button onClick={async () => {
              try {
                const res = await api.get(`/api/envelo/admin/sessions/${selectedSession.id}/report`, {responseType: 'blob'});
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.download = `CAT72-Report-${selectedSession.session_id}.pdf`;
                link.click();
              } catch(e) { alert('Failed to download: ' + e.message); }
            }} style={{padding: '6px 12px', background: styles.purplePrimary, border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer'}}>Download Report PDF</button></div>
          <TelemetryLog sessionId={selectedSession.id} />
        </Panel>
      )}

      <Panel>
        <h2 style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary, marginBottom: '16px'}}>Active Agent Sessions</h2>
        {sessions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{borderBottom: `1px solid ${styles.borderGlass}`}}>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Session ID</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Certificate</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Status</th>
                <th className="px-4 py-3 text-left" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: styles.textTertiary, fontWeight: 400}}>Records</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i} onClick={() => setSelectedSession(s)} style={{borderBottom: `1px solid ${styles.borderGlass}`, cursor: 'pointer'}}>
                  <td className="px-4 py-4" style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: styles.purpleBright}}>{s.session_id}</td>
                  <td className="px-4 py-4" style={{color: styles.textSecondary}}>{s.certificate_id}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 rounded" style={{
                      background: s.status === 'active' ? 'rgba(92,214,133,0.15)' : 'rgba(157,140,207,0.15)',
                      color: s.status === 'active' ? styles.accentGreen : styles.textTertiary,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', textTransform: 'uppercase'
                    }}>{s.status}</span>
                  </td>
                  <td className="px-4 py-4" style={{color: styles.textTertiary}}>{s.record_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{color: styles.textTertiary, textAlign: 'center', padding: '24px'}}>No active sessions. Install and run the ENVELO Agent to see sessions here.</p>
        )}
      </Panel>
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
          <Route path="/dashboard" element={<ProtectedRoute><Layout><RoleBasedDashboard /></Layout></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Layout><ApplicationsList /></Layout></ProtectedRoute>} />
          <Route path="/applications/new" element={<ProtectedRoute><Layout><NewApplication /></Layout></ProtectedRoute>} />
          <Route path="/applications/:id" element={<ProtectedRoute><Layout><ApplicationDetail /></Layout></ProtectedRoute>} />
          <Route path="/cat72" element={<ProtectedRoute roles={['admin', 'operator']}><Layout><CAT72Console /></Layout></ProtectedRoute>} />
          <Route path="/certificates" element={<ProtectedRoute><Layout><CertificatesPage /></Layout></ProtectedRoute>} />
          <Route path="/envelo" element={<ProtectedRoute><Layout><EnveloPage /></Layout></ProtectedRoute>} />
          <Route path="/monitoring" element={<ProtectedRoute><Layout><MonitoringPage /></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
// Mon Jan 26 10:20:46 CST 2026
