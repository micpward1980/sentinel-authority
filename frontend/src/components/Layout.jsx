import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, FileText, Activity, Users, Home, LogOut, Menu, X, ExternalLink, BookOpen, Shield} from 'lucide-react';
import { api } from '../config/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import Logo from './Logo';
import BrandMark from './BrandMark';
import SentinelChatbot from './SentinelChatbot';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [userCerts] = useState([]);
  const [userApps] = useState([]);
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const qc = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/users/notifications').then(r => r.data),
    refetchInterval: 60000,
    enabled: !!localStorage.getItem('token'),
    retry: false,
  });
  const notifs = notifData?.notifications || [];
  const unreadCount = notifData?.unread_count || 0;
  const markAllRead = () => {
    api.post('/api/users/notifications/mark-read')
      .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {});
    setNotifOpen(false);
  };

  const navigation = [
    { name: 'Dashboard',       href: '/dashboard',     icon: Home,         roles: ['admin', 'applicant'] },
    { name: 'Applications',    href: '/applications',  icon: FileText,     roles: ['admin', 'applicant'] },
    { name: 'ENVELO',          href: '/envelo',        icon: 'brand',      roles: ['admin', 'applicant'] },
    { name: 'Resources',       href: '/resources',     icon: BookOpen,     roles: ['admin', 'applicant'] },
    { name: 'Activity',        href: '/activity',      icon: Activity,     roles: ['admin', 'applicant'] },
    { name: 'Surveillance',   href: '/surveillance', icon: Shield,      roles: ['admin'] },
    { name: 'User Management', href: '/users',         icon: Users,        roles: ['admin'] },
    { name: 'Settings',        href: '/settings',      icon: Settings,     roles: ['admin', 'applicant'] },
    { name: 'API Docs',        href: '/api-docs',      icon: ExternalLink, roles: ['admin'] },
  ];

  const hasCert = Array.isArray(userCerts) && userCerts.some(c => ['conformant','active','issued'].includes(c.state));
  const hasApprovedApp = Array.isArray(userApps) && userApps.some(a => ['approved','testing'].includes(a.state));
  const canAccessAgent = hasCert || hasApprovedApp;
  const filteredNav = navigation.filter(item => {
    if (!item.roles.includes(user?.role || '')) return false;
    if (item.requiresCert && user?.role !== 'admin' && !canAccessAgent) return false;
    return true;
  });

  const isActive = (href) => location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href));

  const navLinkStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 16px',
    textDecoration: 'none',
    fontFamily: styles.mono,
    fontSize: '9px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: active ? styles.textPrimary : 'rgba(15,18,30,0.72)',
    borderLeft: active ? '2px solid ' + styles.purpleBright : '2px solid transparent',
    background: active ? 'rgba(74,61,117,.06)' : 'transparent',
    transition: 'color 0.25s ease, background 0.15s'
  });

  return (
    <div style={{minHeight: '100vh', color: styles.textPrimary, fontFamily: styles.sans, background: styles.bgDeep}}>
      <div className="sa-grid-overlay" />
      <div className="sa-noise" />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,.12)', zIndex: 40}} />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        width: '240px',
        transform: (sidebarOpen || !isMobile) ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderRight: '1px solid rgba(15,18,30,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{
          height: isMobile ? '52px' : '72px', minHeight: isMobile ? '52px' : '72px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', borderBottom: '1px solid rgba(15,18,30,0.06)', flexShrink: 0,
        }}>
          <Link to="/dashboard" style={{display: 'flex', alignItems: 'center', textDecoration: 'none'}}>
            <Logo height={isMobile ? 36 : 52} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} style={{color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: isMobile ? 'block' : 'none'}}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{padding: isMobile ? '4px 0' : '12px 0', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch'}}>
          {filteredNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.name} to={item.href} style={{...navLinkStyle(active), padding: isMobile ? '7px 16px' : '9px 16px'}}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = styles.textPrimary; e.currentTarget.style.background = 'rgba(0,0,0,.025)'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(15,18,30,0.72)'; e.currentTarget.style.background = 'transparent'; }}}
              >
                {item.icon === 'brand' ? <BrandMark size={14} /> : <item.icon size={14} style={{opacity: active ? 1 : 0.6}} />}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{padding: isMobile ? '10px 16px' : '16px', borderTop: '1px solid rgba(15,18,30,0.06)', flexShrink: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isMobile ? '8px' : '12px'}}>
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

      {/* Main */}
      <div style={{marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10}}>
        <header style={{
          height: isMobile ? '48px' : '72px',
          display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 20px', gap: '14px',
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
            {!isMobile && 'Main Site'}
          </a>

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
                  const tc = {success: styles.accentGreen, warning: styles.accentAmber, info: styles.purpleBright, error: styles.accentRed}[n.type] || styles.purpleBright;
                  return (
                    <div key={n.id || i}
                      onClick={() => { if (n.resource_type === 'application' && n.resource_id) { setNotifOpen(false); window.location.href = '/applications/' + n.resource_id; }}}
                      style={{padding: '12px 16px', borderBottom: '1px solid rgba(15,18,30,0.04)', cursor: n.resource_id ? 'pointer' : 'default'}}>
                      <div style={{display: 'flex', gap: '10px', alignItems: 'flex-start'}}>
                        <span data-dot="true" style={{display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: tc, marginTop: '6px', flexShrink: 0}} />
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
          {children}
        </main>
      </div>

      <SentinelChatbot />
    </div>
  );
}

export default Layout;
