import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, FileText, Activity, Award, Users, Home, LogOut, Menu, X, ExternalLink, BookOpen, Clock, BarChart2, Shield } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import BrandMark from './BrandMark';
import SentinelChatbot from './SentinelChatbot';

// ─── Nav structure ────────────────────────────────────────────────────────────
// Operational items first, admin/config last
// Section dividers separate operational from administrative

const NAV = [
  { section: 'Operational' },
  { name: 'Dashboard',       href: '/dashboard',    icon: Home,     roles: ['admin', 'applicant'] },
  { name: 'Applications',    href: '/applications', icon: FileText, roles: ['admin', 'applicant'] },
  { name: 'CAT-72 Console',  href: '/cat72',        icon: Clock,    roles: ['admin', 'applicant'] },
  { name: 'Monitoring',      href: '/monitoring',   icon: BarChart2, roles: ['admin', 'applicant'] },
  { name: 'Certificates',    href: '/certificates', icon: Award,    roles: ['admin', 'applicant'] },
  { name: 'ENVELO Interlock', href: '/envelo',      icon: 'brand',  roles: ['admin', 'applicant'], requiresCert: true },
  { section: 'Registry' },
  { name: 'Activity Log',    href: '/activity',     icon: Activity, roles: ['admin'] },
  { name: 'My Activity',     href: '/my-activity',  icon: Activity, roles: ['admin', 'applicant'] },
  { name: 'Licensees',       href: '/licensees',    icon: Shield,   roles: ['admin'] },
  { section: 'Admin' },
  { name: 'User Management', href: '/users',        icon: Users,    roles: ['admin'] },
  { name: 'Resources',       href: '/resources',    icon: BookOpen, roles: ['admin', 'applicant'] },
  { name: 'API Docs',        href: '/api-docs',     icon: ExternalLink, roles: ['admin'] },
  { name: 'Settings',        href: '/settings',     icon: Settings, roles: ['admin', 'applicant'] },
];

function fmtUTC(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().replace('T', ' ').substring(0, 16) + 'Z';
}

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
    if (!user) return;
    api.get('/api/certificates/').then(r => setUserCerts(r.data || [])).catch(() => {});
    api.get('/api/applications/').then(r => setUserApps(r.data.applications || r.data || [])).catch(() => {});
    if (localStorage.getItem('token')) {
      api.get('/api/users/notifications').then(r => {
        setNotifs(r.data.notifications || []);
        setUnreadCount(r.data.unread_count || 0);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => {
      if (!localStorage.getItem('token')) return;
      api.get('/api/users/notifications').then(r => {
        setNotifs(r.data.notifications || []);
        setUnreadCount(r.data.unread_count || 0);
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, [user]);

  const markAllRead = () => {
    api.post('/api/users/notifications/mark-read').then(() => setUnreadCount(0)).catch(() => {});
    setNotifOpen(false);
  };

  const hasCert = userCerts.some(c => ['conformant', 'active', 'issued'].includes(c.state));
  const hasApprovedApp = userApps.some(a => ['approved', 'testing'].includes(a.state));
  const canAccessAgent = hasCert || hasApprovedApp;

  const filteredNav = NAV.filter(item => {
    if (item.section) return true;
    if (!item.roles.includes(user?.role || '')) return false;
    if (item.requiresCert && user?.role !== 'admin' && !canAccessAgent) return false;
    return true;
  });

  // Remove sections with no following items
  const visibleNav = filteredNav.filter((item, i) => {
    if (!item.section) return true;
    const next = filteredNav[i + 1];
    return next && !next.section;
  });

  const isActive = (href) =>
    location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href));

  const frost = {
    background: 'rgba(245,245,247,0.92)',
    backdropFilter: 'blur(24px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
    borderColor: 'rgba(15,18,30,0.06)',
  };

  const navLink = (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 16px',
    textDecoration: 'none',
    fontFamily: styles.mono,
    fontSize: '11px',
    fontWeight: active ? 600 : 400,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: active ? styles.textPrimary : styles.textTertiary,
    borderLeft: `2px solid ${active ? styles.purpleBright : 'transparent'}`,
    background: active ? 'rgba(74,61,117,.06)' : 'transparent',
    transition: 'color 0.15s, background 0.15s',
  });

  const sectionLabel = {
    fontFamily: styles.mono, fontSize: '9px',
    fontWeight: 600, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: styles.textDim,
    padding: '16px 16px 4px',
  };

  return (
    <div style={{ minHeight: '100vh', color: styles.textPrimary, fontFamily: styles.sans, background: styles.bgDeep }}>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.12)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        width: '220px',
        transform: (sidebarOpen || !isMobile) ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
        background: frost.background,
        backdropFilter: frost.backdropFilter,
        WebkitBackdropFilter: frost.WebkitBackdropFilter,
        borderRight: `1px solid ${frost.borderColor}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Brand */}
        <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${frost.borderColor}`, flexShrink: 0 }}>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <BrandMark size={32} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontFamily: styles.mono, fontSize: '10px', letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.textPrimary, whiteSpace: 'nowrap' }}>SENTINEL</span>
              <span style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '0.20em', textTransform: 'uppercase', color: styles.textTertiary, whiteSpace: 'nowrap' }}>AUTHORITY</span>
            </div>
          </Link>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} style={{ color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {visibleNav.map((item, i) => {
            if (item.section) {
              return <div key={`section-${i}`} style={sectionLabel}>{item.section}</div>;
            }
            const active = isActive(item.href);
            return (
              <Link key={item.href} to={item.href} style={navLink(active)}
                onClick={() => isMobile && setSidebarOpen(false)}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = styles.textPrimary; e.currentTarget.style.background = 'rgba(0,0,0,.025)'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = styles.textTertiary; e.currentTarget.style.background = 'transparent'; }}}
              >
                {item.icon === 'brand'
                  ? <BrandMark size={13} />
                  : <item.icon size={13} style={{ opacity: active ? 0.9 : 0.5, flexShrink: 0 }} />
                }
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${frost.borderColor}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <BrandMark size={26} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: styles.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
              <div style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '0.10em', textTransform: 'uppercase', color: styles.textTertiary }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: styles.mono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = styles.accentRed}
            onMouseLeave={e => e.currentTarget.style.color = styles.textTertiary}>
            <LogOut size={11} />
            Sign Out
          </button>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <a href="https://sentinelauthority.org/terms.html" target="_blank" rel="noreferrer noopener" style={{ fontFamily: 'var(--mono, monospace)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textDecoration: 'none', opacity: 0.6 }}>Terms</a>
            <a href="https://sentinelauthority.org/privacy.html" target="_blank" rel="noreferrer noopener" style={{ fontFamily: 'var(--mono, monospace)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textDecoration: 'none', opacity: 0.6 }}>Privacy</a>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ marginLeft: isMobile ? 0 : '220px', position: 'relative', zIndex: 10 }}>

        {/* Header */}
        <header style={{
          height: '72px', display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: '14px',
          borderBottom: `1px solid ${frost.borderColor}`,
          background: frost.background,
          backdropFilter: frost.backdropFilter,
          WebkitBackdropFilter: frost.WebkitBackdropFilter,
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ color: styles.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <Menu size={16} />
            </button>
          )}
          <div style={{ flex: 1 }} />

          <a href="https://sentinelauthority.org" target="_blank" rel="noreferrer noopener"
            style={{ position: 'relative', fontFamily: styles.mono, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'none', color: '#3d3262', padding: '6px 14px', border: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4a3d75'; Array.from(e.currentTarget.querySelectorAll('span')).forEach(s => s.style.borderColor = 'rgba(61,50,98,0.80)'); }}
            onMouseLeave={e => { e.currentTarget.style.color = '#3d3262'; Array.from(e.currentTarget.querySelectorAll('span')).forEach(s => s.style.borderColor = 'rgba(61,50,98,0.35)'); }}>
            <span style={{ position: 'absolute', top: 0, left: 0, width: '8px', height: '8px', borderTop: '1px solid rgba(61,50,98,0.35)', borderLeft: '1px solid rgba(61,50,98,0.35)', transition: 'border-color 0.2s' }} />
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderBottom: '1px solid rgba(61,50,98,0.35)', borderRight: '1px solid rgba(61,50,98,0.35)', transition: 'border-color 0.2s' }} />
            Public Site
          </a>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: notifOpen ? styles.purpleBright : styles.textTertiary, position: 'relative' }}>
              <Bell size={15} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '1px', right: '1px', minWidth: '13px', height: '13px', borderRadius: '50%', background: styles.accentRed, color: '#fff', fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: styles.mono, padding: '0 2px' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                <div style={{ position: 'absolute', right: 0, top: '44px', width: 'min(340px, 90vw)', maxHeight: '70vh', overflowY: 'auto', background: frost.background, backdropFilter: frost.backdropFilter, WebkitBackdropFilter: frost.WebkitBackdropFilter, border: `1px solid ${frost.borderColor}`, zIndex: 100 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${frost.borderColor}` }}>
                    <span style={{ fontFamily: styles.mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: styles.textTertiary }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '0.06em', cursor: 'pointer', padding: 0 }}>Mark all read</button>
                    )}
                  </div>
                  {notifs.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: styles.textDim, fontSize: '12px', fontFamily: styles.mono }}>No recent activity</div>
                  ) : notifs.map((n, i) => {
                    const typeColor = { success: styles.accentGreen, warning: styles.accentAmber, info: styles.purpleBright, error: styles.accentRed }[n.type] || styles.purpleBright;
                    return (
                      <div key={n.id || i}
                        onClick={() => { if (n.resource_type === 'application' && n.resource_id) { setNotifOpen(false); window.location.href = `/applications/${n.resource_id}`; }}}
                        style={{ padding: '10px 16px', borderBottom: `1px solid ${styles.borderSubtle}`, cursor: n.resource_id ? 'pointer' : 'default' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: typeColor, marginTop: '7px', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 3px', fontSize: '13px', color: !n.read ? styles.textPrimary : styles.textSecondary, lineHeight: 1.4 }}>{n.message}</p>
                            <span style={{ fontFamily: styles.mono, fontSize: '10px', color: styles.textDim }}>
                              {fmtUTC(n.timestamp)}{n.user_email ? ' · ' + n.user_email : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </header>

        <main style={{ padding: 'clamp(16px, 3vw, 32px)', position: 'relative', zIndex: 1 }}>
          {children}
        </main>
      </div>
    <SentinelChatbot />
      </div>
  );
}

export default Layout;
