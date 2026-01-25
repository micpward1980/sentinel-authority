import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, FileText, Activity, Award, Users, Home, LogOut, Menu, X, CheckCircle, AlertTriangle, Clock, Search } from 'lucide-react';
import axios from 'axios';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || '';
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

// Protected Route
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-purple-500" />
            <span className="font-bold text-lg">Sentinel</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {filteredNav.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.href ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div>
              <div className="font-medium">{user?.full_name}</div>
              <div className="text-sm text-gray-400 capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white w-full">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${sidebarOpen ? 'lg:ml-64' : ''}`}>
        <header className="h-16 border-b border-gray-700 flex items-center px-4 gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <Link to="/verify" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <Search className="w-5 h-5" />
            Verify Certificate
          </Link>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

// Login Page
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register({ email, password, full_name: fullName, organization });
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Shield className="w-12 h-12 text-purple-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Sentinel Authority</h1>
            <p className="text-gray-400 text-sm">ODDC Certification Platform</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                required
              />
              <input
                type="text"
                placeholder="Organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            required
          />
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-purple-400 hover:text-purple-300">
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Dashboard Page
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [activeTests, setActiveTests] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, appsRes, testsRes] = await Promise.all([
          api.get('/api/dashboard/stats'),
          api.get('/api/dashboard/recent-applications'),
          api.get('/api/dashboard/active-tests'),
        ]);
        setStats(statsRes.data);
        setRecentApps(appsRes.data);
        setActiveTests(testsRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };
    fetchData();
  }, []);

  const statCards = [
    { label: 'Total Applications', value: stats?.total_applications || 0, icon: FileText, color: 'blue' },
    { label: 'Pending Review', value: stats?.pending_applications || 0, icon: Clock, color: 'yellow' },
    { label: 'Active Tests', value: stats?.active_tests || 0, icon: Activity, color: 'purple' },
    { label: 'Certificates Issued', value: stats?.certificates_issued || 0, icon: Award, color: 'green' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <card.icon className={`w-8 h-8 text-${card.color}-500`} />
              <span className={`text-3xl font-bold text-${card.color}-400`}>{card.value}</span>
            </div>
            <div className="text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Recent Applications</h2>
          <div className="space-y-3">
            {recentApps.slice(0, 5).map((app) => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div>
                  <div className="font-medium">{app.system_name}</div>
                  <div className="text-sm text-gray-400">{app.organization_name}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  app.state === 'conformant' ? 'bg-green-500/20 text-green-400' :
                  app.state === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {app.state}
                </span>
              </div>
            ))}
            {recentApps.length === 0 && <div className="text-gray-500 text-center py-4">No applications yet</div>}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Active CAT-72 Tests</h2>
          <div className="space-y-3">
            {activeTests.map((test) => (
              <div key={test.id} className="p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm">{test.test_id}</span>
                  <span className="text-purple-400">{Math.round((test.elapsed_seconds / (test.duration_hours * 3600)) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all" 
                    style={{ width: `${(test.elapsed_seconds / (test.duration_hours * 3600)) * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Convergence: {(test.convergence_score * 100 || 0).toFixed(1)}% | Interlocks: {test.interlock_activations}
                </div>
              </div>
            ))}
            {activeTests.length === 0 && <div className="text-gray-500 text-center py-4">No active tests</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Applications Page
function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/api/applicants').then(res => setApplications(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Applications</h1>
        {user?.role === 'applicant' && (
          <Link to="/applications/new" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
            New Application
          </Link>
        )}
      </div>
      
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Application #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">System</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-gray-700/30 cursor-pointer">
                <td className="px-6 py-4 font-mono text-sm">{app.application_number}</td>
                <td className="px-6 py-4">{app.system_name}</td>
                <td className="px-6 py-4 text-gray-400">{app.organization_name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    app.state === 'conformant' ? 'bg-green-500/20 text-green-400' :
                    app.state === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    app.state === 'bounded' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {app.state}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 && (
          <div className="text-center py-12 text-gray-500">No applications found</div>
        )}
      </div>
    </div>
  );
}

// CAT-72 Console Page
function CAT72Page() {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    api.get('/api/cat72/tests').then(res => setTests(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedTest && selectedTest.state === 'running') {
      const interval = setInterval(() => {
        api.get(`/api/cat72/tests/${selectedTest.test_id}/metrics`)
          .then(res => setMetrics(res.data))
          .catch(console.error);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedTest]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CAT-72 Console</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test List */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Tests</h2>
          <div className="space-y-2">
            {tests.map((test) => (
              <button
                key={test.id}
                onClick={() => setSelectedTest(test)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedTest?.id === test.id ? 'bg-purple-600' : 'bg-gray-700/50 hover:bg-gray-700'
                }`}
              >
                <div className="font-mono text-sm">{test.test_id}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs ${
                    test.state === 'running' ? 'text-green-400' :
                    test.state === 'completed' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {test.state}
                  </span>
                  {test.result && <span className={test.result === 'PASS' ? 'text-green-400' : 'text-red-400'}>{test.result}</span>}
                </div>
              </button>
            ))}
            {tests.length === 0 && <div className="text-gray-500 text-center py-4">No tests</div>}
          </div>
        </div>

        {/* Metrics Panel */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700">
          {selectedTest ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-mono">{selectedTest.test_id}</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedTest.state === 'running' ? 'bg-green-500/20 text-green-400' :
                  selectedTest.state === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {selectedTest.state}
                </span>
              </div>

              {/* Timer */}
              <div className="text-center py-8 bg-gray-900 rounded-xl">
                <div className="text-5xl font-mono text-purple-400">
                  {formatTime(metrics?.elapsed_seconds || selectedTest.elapsed_seconds || 0)}
                </div>
                <div className="text-gray-500 mt-2">
                  / {formatTime(selectedTest.duration_hours * 3600)}
                </div>
                <div className="w-full max-w-md mx-auto mt-4 bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-purple-500 h-3 rounded-full transition-all"
                    style={{ width: `${metrics?.progress_percent || 0}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {((metrics?.conformance_rate || selectedTest.convergence_score || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Convergence</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {(metrics?.current_drift || selectedTest.drift_rate || 0).toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Drift Rate</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {((metrics?.current_stability || selectedTest.stability_index || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Stability</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {metrics?.interlock_activations || selectedTest.interlock_activations || 0}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Interlocks</div>
                </div>
              </div>

              {/* Evidence Hash */}
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Evidence Hash</div>
                <div className="font-mono text-xs text-green-400 break-all">
                  {metrics?.evidence_hash || selectedTest.evidence_hash || 'N/A'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Select a test to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Certificates Page
function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    api.get('/api/certificates').then(res => setCertificates(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Certificates</h1>
      
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Certificate #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">System</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Convergence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {certificates.map((cert) => (
              <tr key={cert.id} className="hover:bg-gray-700/30">
                <td className="px-6 py-4 font-mono text-sm text-purple-400">{cert.certificate_number}</td>
                <td className="px-6 py-4">{cert.system_name}</td>
                <td className="px-6 py-4 text-gray-400">{cert.organization_name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    cert.state === 'conformant' ? 'bg-green-500/20 text-green-400' :
                    cert.state === 'suspended' ? 'bg-yellow-500/20 text-yellow-400' :
                    cert.state === 'revoked' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {cert.state}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-sm text-green-400">
                  {(cert.convergence_score * 100).toFixed(1)}%
                </td>
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {certificates.length === 0 && (
          <div className="text-center py-12 text-gray-500">No certificates issued</div>
        )}
      </div>
    </div>
  );
}

// Licensees Page
function LicenseesPage() {
  const [licensees, setLicensees] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/api/licensees').then(res => setLicensees(res.data)).catch(console.error);
    }
  }, [user]);

  if (user?.role === 'licensee') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Licensee Portal</h1>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">ENVELO™ Documentation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a href="#" className="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <h3 className="font-medium">Architecture Overview</h3>
              <p className="text-sm text-gray-400 mt-1">Non-bypassable interlock architecture</p>
            </a>
            <a href="#" className="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <h3 className="font-medium">Envelope Definition</h3>
              <p className="text-sm text-gray-400 mt-1">How to define operational boundaries</p>
            </a>
            <a href="#" className="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <h3 className="font-medium">Integration API</h3>
              <p className="text-sm text-gray-400 mt-1">Runtime API for ENVELO enforcement</p>
            </a>
            <a href="#" className="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <h3 className="font-medium">Certification Requirements</h3>
              <p className="text-sm text-gray-400 mt-1">What you need for ODDC certification</p>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Licensees</h1>
      
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">License #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {licensees.map((lic) => (
              <tr key={lic.id} className="hover:bg-gray-700/30">
                <td className="px-6 py-4 font-mono text-sm">{lic.license_number}</td>
                <td className="px-6 py-4">{lic.organization_name}</td>
                <td className="px-6 py-4 text-gray-400 capitalize">{lic.license_type}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    lic.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {lic.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {licensees.length === 0 && (
          <div className="text-center py-12 text-gray-500">No licensees registered</div>
        )}
      </div>
    </div>
  );
}

// Public Verification Page
function VerifyPage() {
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.get(`/api/verify/${certNumber}`);
      setResult(res.data);
    } catch (err) {
      setResult({ valid: false, message: 'Certificate not found' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Verify Certificate</h1>
          <p className="text-gray-400 mt-2">Enter a certificate number to verify its status</p>
        </div>

        <form onSubmit={handleVerify} className="bg-gray-800 rounded-xl p-6 mb-6">
          <input
            type="text"
            placeholder="e.g., ODDC-2026-00015"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        {result && (
          <div className={`bg-gray-800 rounded-xl p-6 border ${result.valid ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center gap-3 mb-4">
              {result.valid ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-500" />
              )}
              <span className={`text-xl font-bold ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                {result.valid ? 'Valid Certificate' : 'Invalid Certificate'}
              </span>
            </div>
            
            {result.valid && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Organization</span>
                  <span>{result.organization_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">System</span>
                  <span>{result.system_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Convergence</span>
                  <span className="text-green-400">{(result.convergence_score * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Issued</span>
                  <span>{new Date(result.issued_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expires</span>
                  <span>{new Date(result.expires_at).toLocaleDateString()}</span>
                </div>
                <div className="pt-3 border-t border-gray-700">
                  <div className="text-gray-400 text-xs mb-1">Evidence Hash</div>
                  <div className="font-mono text-xs text-green-400 break-all">{result.evidence_hash}</div>
                </div>
              </div>
            )}
            
            <div className="mt-4 text-sm text-gray-400">{result.message}</div>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-purple-400 hover:text-purple-300">
            ← Back to Platform
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/applications" element={
            <ProtectedRoute>
              <Layout><ApplicationsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/cat72" element={
            <ProtectedRoute roles={['admin', 'operator']}>
              <Layout><CAT72Page /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/certificates" element={
            <ProtectedRoute>
              <Layout><CertificatesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/licensees" element={
            <ProtectedRoute roles={['admin', 'licensee']}>
              <Layout><LicenseesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
