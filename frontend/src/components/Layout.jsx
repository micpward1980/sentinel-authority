import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, FileText, Activity, Award, Users, Home, LogOut, Menu, X, Search, ExternalLink, BookOpen } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import BrandMark from './BrandMark';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [userCerts, setUserCerts] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const location = useLocation();
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      api.get('/api/certificates/').then(res => setUserCerts(res.data || [])).catch(() => setUserCerts([]));
      api.get('/api/applications/').then(res => setUserApps(res.data.applications || res.data || [])).catch(() => setUserApps([]));
      if (localStorage.getItem('token')) api.get('/api/users/notifications').then(res => { setNotifs(res.data.notifications || []); setUnreadCount(res.data.unread_count || 0); }).catch(() => {});
    }
  }, [user]);

  // Poll notifications
  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => { if (!localStorage.getItem('token')) return; api.get('/api/users/notifications').then(r => { setNotifs(r.data.notifications || []); setUnreadCount(r.data.unread_count || 0); }).catch(() => {}); }, 60000);
    return () => clearInterval(iv);
  }, [user]);

  
  const markAllRead = () => { api.post('/api/users/notifications/mark-read').then(() => setUnreadCount(0)).catch(() => {}); setNotifOpen(false); };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'applicant'] },
    { name: 'Applications', href: '/applications', icon: FileText, roles: ['admin', 'applicant'] },
    { name: 'CAT-72 Console', href: '/cat72', icon: Activity, roles: ['admin'] },
    { name: 'Certificates', href: '/certificates', icon: Award, roles: ['admin', 'applicant'] },
    { name: 'Resources', href: '/resources', icon: BookOpen, roles: ['admin', 'applicant'] },
    { name: 'ENVELO Agent', href: '/envelo', icon: 'brand', roles: ['admin', 'applicant'], requiresCert: true },
    { name: 'Monitoring', href: '/monitoring', icon: Activity, roles: ['admin', 'applicant'], requiresCert: true },
    { name: 'User Management', href: '/users', icon: Users, roles: ['admin'] },
    { name: 'My Activity', href: '/my-activity', icon: Activity, roles: ['admin', 'applicant'] },
    { name: 'Activity Log', href: '/activity', icon: FileText, roles: ['admin'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'applicant'] },
    { name: 'API Docs', href: '/api-docs', icon: ExternalLink, roles: ['admin'] },
  ];

  const hasCert = Array.isArray(userCerts) && userCerts.some(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const hasApprovedApp = Array.isArray(userApps) && userApps.some(a => a.state === 'approved' || a.state === 'testing');
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
        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .sa-main-content { padding: 16px !important; }
          .sa-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .sa-stat-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .sa-header-links { display: none !important; }
          .sa-page-title { font-size: 22px !important; }
          .sa-table-wrap { margin: 0 -16px; border-radius: 0 !important; }
          .sa-table-wrap table { font-size: 12px; }
        }
        @media (max-width: 480px) {
          .sa-main-content { padding: 12px !important; }
          .sa-stat-grid { grid-template-columns: 1fr !important; }
          .sa-stat-grid-3 { grid-template-columns: 1fr !important; }
        }
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
      <div className="lg:ml-64 relative z-10">
        <header className="h-16 flex items-center px-6 gap-4" style={{borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(42,47,61,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'}}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden" style={{color: styles.textSecondary, background: 'none', border: 'none'}}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer" className="sa-header-links flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <ExternalLink className="w-4 h-4" />
            Main Site
          </a>
          {user?.role === 'admin' && (
          <a href="https://api.sentinelauthority.org/docs" target="_blank" rel="noopener noreferrer" className="sa-header-links flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <FileText className="w-4 h-4" />
            API Docs
          </a>
          )}
          <Link to="/verify" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <Search className="w-4 h-4" />
            Verify
          </Link>
          {/* Notification Bell */}
          <div style={{position: 'relative'}}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px', color: notifOpen ? styles.purpleBright : styles.textTertiary, transition: 'color 0.2s'}}>
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span style={{position: 'absolute', top: '-2px', right: '-2px', minWidth: '16px', height: '16px', borderRadius: '50%', background: '#D65C5C', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Mono', monospace", padding: '0 3px'}}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (<>
              <div onClick={() => setNotifOpen(false)} style={{position: 'fixed', inset: 0, zIndex: 90}} />
              <div style={{position: 'absolute', right: 0, top: '40px', width: '360px', maxHeight: '480px', overflowY: 'auto', background: 'rgba(42,47,61,0.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 100}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
                  <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Notifications</span>
                  {unreadCount > 0 && <button onClick={markAllRead} style={{background: 'none', border: 'none', color: styles.purpleBright, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer'}}>Mark all read</button>}
                </div>
                {notifs.length === 0 ? (
                  <div style={{padding: '32px 16px', textAlign: 'center', color: styles.textTertiary, fontSize: '13px', fontStyle: 'italic'}}>No recent activity</div>
                ) : notifs.map((n, i) => {
                  const isUnread = !n.read;
                  const typeColor = {success: styles.accentGreen, warning: '#D6A05C', info: styles.purpleBright, error: '#D65C5C'}[n.type] || styles.purpleBright;
                  const typeIcon = {success: '✓', warning: '⚠', info: '●', error: '✗'}[n.type] || '●';
                  return (
                    <div key={n.id || i} onClick={() => { if (n.resource_type === 'application' && n.resource_id) { setNotifOpen(false); window.location.hash = '#/applications/' + n.resource_id; } }} style={{padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: isUnread ? 'rgba(157,140,207,0.06)' : 'transparent', cursor: n.resource_id ? 'pointer' : 'default', transition: 'background 0.15s'}}>
                      <div style={{display: 'flex', gap: '10px', alignItems: 'flex-start'}}>
                        <span style={{color: typeColor, fontSize: '12px', marginTop: '2px', flexShrink: 0}}>{typeIcon}</span>
                        <div style={{flex: 1, minWidth: 0}}>
                          <p style={{margin: 0, fontSize: '13px', color: isUnread ? styles.textPrimary : styles.textSecondary, lineHeight: 1.4, fontWeight: isUnread ? 500 : 400}}>{n.message}</p>
                          <div style={{display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap'}}>
                            <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</span>
                            {n.user_email && <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: styles.textTertiary}}>by {n.user_email}</span>}
                          </div>
                        </div>
                        {isUnread && <span style={{width: '6px', height: '6px', borderRadius: '50%', background: styles.purpleBright, marginTop: '6px', flexShrink: 0}} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>)}
          </div>
        </header>
        <main className="sa-main-content" style={{padding: '32px', position: 'relative', zIndex: 1}}>{children}</main>
      </div>
    </div>
  );
}

export default Layout;

