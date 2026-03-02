import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, FileText, Activity, Award, Users, Home, LogOut, Menu, X, ExternalLink, BookOpen, Clock, BarChart2, CheckCircle } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import BrandMark from './BrandMark';
import Logo from './Logo';
import SentinelChatbot from './SentinelChatbot';

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

  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => {
      if (!localStorage.getItem('token')) return;
      api.get('/api/users/notifications').then(r => { setNotifs(r.data.notifications || []); setUnreadCount(r.data.unread_count || 0); }).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, [user]);

  const markAllRead = () => { api.post('/api/users/notifications/mark-read').then(() => setUnreadCount(0)).catch(() => {}); setNotifOpen(false); };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'applicant'] },
    { name: 'Applications', href: '/applications', icon: FileText, roles: ['admin'] },
    { name: 'My Application', href: '/applications', icon: FileText, roles: ['applicant'] },
    { name: 'Testing', href: '/cat72', icon: Activity, roles: ['admin'] },
    { name: 'Conformance', href: '/surveillance', icon: CheckCircle, roles: ['admin'] },
    { name: 'Registry', href: '/certificates', icon: Award, roles: ['admin'] },
  ];

  const hasCert = Array.isArray(userCerts) && userCerts.some(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued');
  const hasApprovedApp = Array.isArray(userApps) && userApps.some(a => a.state === 'approved' || a.state === 'testing');
  const canAccessAgent = hasCert || hasApprovedApp;
  const filteredNav = navigation.filter(item => {
    if (!item.roles.includes(user?.role || '')) return false;
    if (item.requiresCert && user?.role !== 'admin' && !canAccessAgent) return false;
    return true;
  });

  const isActive = (item) => {
    if (item.group) return item.group.some(p => location.pathname.startsWith(p));
    return location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
  };

  // Sub-tabs for grouped pages — workflow-driven
  const subTabs = (() => {
    const p = location.pathname;
    if (user?.role === 'admin') {


      // Settings (accessed from footer gear)
      if (['/settings', '/users', '/resources'].some(r => p.startsWith(r)))
        return [
          { label: 'Account', href: '/settings' },
          { label: 'Users', href: '/users' },
          { label: 'Resources', href: '/resources' },
        ];
    }
    return null;
  })();

  const navLinkStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 16px',
    textDecoration: 'none',
    fontFamily: styles.mono,
    fontSize: '9px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: active ? styles.textPrimary : styles.textTertiary,
    borderLeft: active ? '2px solid ' + styles.purpleBright : '2px solid transparent',
    background: active ? 'rgba(74,61,117,.06)' : 'transparent',
    transition: 'color 0.25s ease, background 0.15s'
  });

  return (
    <div style={{minHeight: '100vh', color: styles.textPrimary, fontFamily: styles.sans, background: styles.bgDeep}}>
      {/* Grid overlay — matches main site (opacity:0 = hidden by default) */}
      <div className="sa-grid-overlay" />

      {/* Noise texture — matches main site exactly */}
      <div className="sa-noise" />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,.12)', zIndex: 40}} />
      )}

      {/* Sidebar — frosted glass matching main site nav */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          width: '240px',
          transform: (sidebarOpen || !isMobile) ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderRight: '1px solid rgba(15,18,30,0.06)'
        }}>

        {/* Brand */}
        <div style={{
          height: '72px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(15,18,30,0.06)'
        }}>
          <Link to="/dashboard" style={{display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none'}}>
            <Logo height={52} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} style={{color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: isMobile ? 'block' : 'none'}}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{padding: '12px 0'}}>
          {filteredNav.map((item) => {
            const active = isActive(item);
            return (
              <Link key={item.name} to={item.href} style={navLinkStyle(active)}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = styles.textPrimary; e.currentTarget.style.background = 'rgba(0,0,0,.025)'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = styles.textTertiary; e.currentTarget.style.background = 'transparent'; }}}
              >
                {item.icon === 'brand' ? <BrandMark size={14} /> : <item.icon size={14} style={{opacity: active ? 0.9 : 0.45}} />}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Settings + User */}
        <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid rgba(15,18,30,0.06)'}}>
          <Link to="/settings" style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 16px',
            textDecoration: 'none',
            fontFamily: styles.mono,
            fontSize: '9px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: ['/settings', '/users', '/resources'].some(r => location.pathname.startsWith(r)) ? styles.textPrimary : styles.textTertiary,
            borderLeft: ['/settings', '/users', '/resources'].some(r => location.pathname.startsWith(r)) ? '2px solid ' + styles.purpleBright : '2px solid transparent',
            background: ['/settings', '/users', '/resources'].some(r => location.pathname.startsWith(r)) ? 'rgba(74,61,117,.06)' : 'transparent',
            borderBottom: '1px solid rgba(15,18,30,0.04)',
            transition: 'color 0.25s ease',
          }}>
            <Settings size={14} style={{opacity: ['/settings', '/users', '/resources'].some(r => location.pathname.startsWith(r)) ? 0.9 : 0.45}} />
            Settings
          </Link>
          <div style={{padding: '12px 16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
            <div data-avatar="true" style={{width: '28px', height: '28px', background: styles.purplePrimary, border: '1px solid rgba(107,90,158,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <span style={{color: '#fff', fontSize: '11px', fontWeight: 500}}>{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div>
              <div style={{fontSize: '13px', color: styles.textPrimary}}>{user?.full_name}</div>
              <div style={{fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase',
            color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: 0
          }}
            onMouseEnter={e => e.currentTarget.style.color = styles.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = styles.textTertiary}>
            <LogOut size={12} />
            Sign Out
          </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10}}>
        {/* Header — frosted glass matching main site */}
        <header style={{
          height: '72px',
          display: 'flex', alignItems: 'center',
          padding: '0 20px',
          gap: '14px',
          borderBottom: '1px solid rgba(15,18,30,0.06)',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          position: 'sticky', top: 0, zIndex: 30
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: isMobile ? 'block' : 'none'}}>
            <Menu size={18} />
          </button>
          <div style={{flex: 1}} />

          <a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer"
            style={{display: 'flex', alignItems: 'center', gap: '6px', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none', padding: '8px 4px', transition: 'color 0.25s ease'}}
            onMouseEnter={e => e.currentTarget.style.color = styles.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = styles.textTertiary}>
            <ExternalLink size={12} />
            Main Site
          </a>

          {/* Notifications */}
          <div style={{position: 'relative'}}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: notifOpen ? styles.purpleBright : styles.textTertiary}}>
              <Bell size={16} strokeWidth={1.5} />
              {unreadCount > 0 && <span data-dot="true" style={{position: 'absolute', top: '-2px', right: '-2px', minWidth: '14px', height: '14px', borderRadius: '50%', background: styles.accentRed, color: '#fff', fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: styles.mono, padding: '0 2px'}}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (<>
              <div onClick={() => setNotifOpen(false)} style={{position: 'fixed', inset: 0, zIndex: 90}} />
              <div style={{position: 'absolute', right: 0, top: '44px', width: 'min(340px, 90vw)', maxHeight: '70vh', overflowY: 'auto', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)', border: '1px solid rgba(15,18,30,0.06)', zIndex: 100}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(15,18,30,0.06)'}}>
                  <span style={{fontFamily: styles.mono, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: styles.textTertiary}}>Notifications</span>
                  {unreadCount > 0 && <button onClick={markAllRead} style={{background: 'none', border: 'none', color: styles.purpleBright, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', cursor: 'pointer', padding: 0}}>Mark all read</button>}
                </div>
                {notifs.length === 0 ? (
                  <div style={{padding: '32px 16px', textAlign: 'center', color: styles.textDim, fontSize: '12px'}}>No recent activity</div>
                ) : notifs.map((n, i) => {
                  const typeColor = {success: styles.accentGreen, warning: styles.accentAmber, info: styles.purpleBright, error: styles.accentRed}[n.type] || styles.purpleBright;
                  return (
                    <div key={n.id || i}
                      onClick={() => { if (n.resource_type === 'application' && n.resource_id) { setNotifOpen(false); window.location.hash = '#/applications/' + n.resource_id; }}}
                      style={{padding: '12px 16px', borderBottom: '1px solid rgba(15,18,30,0.04)', cursor: n.resource_id ? 'pointer' : 'default'}}>
                      <div style={{display: 'flex', gap: '10px', alignItems: 'flex-start'}}>
                        <span data-dot="true" style={{display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: typeColor, marginTop: '6px', flexShrink: 0}} />
                        <div style={{flex: 1, minWidth: 0}}>
                          <p style={{margin: 0, fontSize: '13px', color: !n.read ? styles.textPrimary : styles.textSecondary, lineHeight: 1.4}}>{n.message}</p>
                          <span style={{fontFamily: styles.mono, fontSize: '9px', color: styles.textDim, marginTop: '4px', display: 'block'}}>
                            {n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}{n.user_email ? ' · ' + n.user_email : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>)}
          </div>
        </header>

        <main className="sa-main-content" style={{padding: 'clamp(16px, 3vw, 32px)', position: 'relative', zIndex: 1}}>
          {subTabs && (
            <div style={{display: 'flex', gap: '0', borderBottom: '1px solid ' + styles.borderSubtle, marginBottom: '24px', marginTop: '-8px'}}>
              {subTabs.map(tab => {
                const tabActive = location.pathname === tab.href || location.pathname.startsWith(tab.href + '/');
                return (
                  <Link key={tab.href} to={tab.href} style={{
                    padding: '10px 20px',
                    fontFamily: styles.mono,
                    fontSize: '10px',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: tabActive ? styles.purpleBright : styles.textTertiary,
                    textDecoration: 'none',
                    borderBottom: tabActive ? '2px solid ' + styles.purpleBright : '2px solid transparent',
                    transition: 'color 0.2s',
                  }}>{tab.label}</Link>
                );
              })}
            </div>
          )}
          {children}
        </main>
      </div>
          <SentinelChatbot />
    </div>
  );
}

export default Layout;
