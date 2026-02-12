import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, FileText, Activity, Award, Users, Home, LogOut, Menu, X, ExternalLink, BookOpen, Clock, BarChart2 } from 'lucide-react';
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
      api.get('/api/certificates/').then(r => setUserCerts(r.data || [])).catch(() => setUserCerts([]));
      api.get('/api/applications/').then(r => setUserApps(r.data.applications || r.data || [])).catch(() => setUserApps([]));
      if (localStorage.getItem('token')) api.get('/api/users/notifications').then(r => { setNotifs(r.data.notifications || []); setUnreadCount(r.data.unread_count || 0); }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => {
      if (document.hidden) return;
      if (!localStorage.getItem('token')) return;
      api.get('/api/users/notifications').then(r => { setNotifs(r.data.notifications || []); setUnreadCount(r.data.unread_count || 0); }).catch(() => {});
    }, 300000);
    return () => clearInterval(iv);
  }, [user]);

  const markAllRead = () => { api.post('/api/users/notifications/mark-read').then(() => setUnreadCount(0)).catch(() => {}); setNotifOpen(false); };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'applicant'] },
    { name: 'Applications', href: '/applications', icon: FileText, roles: ['admin', 'applicant'] },
    { name: 'CAT-72 Console', href: '/cat72', icon: Clock, roles: ['admin', 'applicant'] },
    { name: 'Certificates', href: '/certificates', icon: Award, roles: ['admin', 'applicant'] },
    { name: 'Monitoring', href: '/monitoring', icon: BarChart2, roles: ['admin', 'applicant'] },
    { name: 'Licensees', href: '/licensees', icon: Users, roles: ['admin'] },
    { name: 'Resources', href: '/resources', icon: BookOpen, roles: ['admin', 'applicant'] },
    { name: 'User Management', href: '/users', icon: Users, roles: ['admin'] },
    { name: 'Activity Log', href: '/activity', icon: FileText, roles: ['admin'] },
    { name: 'My Activity', href: '/my-activity', icon: Activity, roles: ['admin', 'applicant'] },
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

  const isActive = (href) => location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href));

  return (
    <div style={{ minHeight: '100vh', color: styles.textPrimary, fontFamily: styles.sans }}>
      <div className="sa-grid-overlay" />
      <div className="sa-vignette" />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '240px',
        background: 'rgba(42,47,61,.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,.06)',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        transform: (!isMobile || sidebarOpen) ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .2s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <BrandMark size={22} />
            <span style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>Sentinel Authority</span>
          </Link>
          {isMobile && <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filteredNav.map(item => {
            const active = isActive(item.href);
            return (
              <Link key={item.name} to={item.href} onClick={() => isMobile && setSidebarOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px',
                  fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase',
                  color: active ? styles.textPrimary : 'rgba(255,255,255,.35)',
                  borderLeft: active ? `2px solid ${styles.purpleBright}` : '2px solid transparent',
                  background: active ? 'rgba(157,140,207,.06)' : 'transparent',
                  transition: 'color .2s, background .15s', textDecoration: 'none',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,.65)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,.35)'; e.currentTarget.style.background = 'transparent'; }}}
              >
                {item.icon === 'brand' ? <BrandMark size={13} /> : <item.icon size={13} style={{ opacity: active ? .85 : .4 }} />}
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div className="sa-avatar" style={{ width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: styles.textPrimary, lineHeight: 1.2 }}>{user?.full_name}</div>
              <div style={{ fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = styles.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.3)'}
          ><LogOut size={11} /> Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: isMobile ? 0 : '240px', position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          height: '56px', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '14px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          background: 'rgba(42,47,61,.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Menu size={18} /></button>}
          <div style={{ flex: 1 }} />
          <a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(255,255,255,.35)', fontFamily: styles.mono, fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', textDecoration: 'none', transition: 'color .2s' }}
            onMouseEnter={e => e.currentTarget.style.color = styles.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.35)'}
          ><ExternalLink size={11} /> Main Site</a>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: notifOpen ? styles.purpleBright : 'rgba(255,255,255,.4)', transition: 'color .2s' }}>
              <Bell size={15} strokeWidth={1.5} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-1px', right: '-1px', minWidth: '13px', height: '13px', borderRadius: '50%', background: '#D65C5C', color: '#fff', fontSize: '7px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: styles.mono, padding: '0 2px' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (<>
              <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
              <div style={{ position: 'absolute', right: 0, top: '40px', width: 'min(320px, 88vw)', maxHeight: '65vh', overflowY: 'auto', background: 'rgba(42,47,61,.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.07)', zIndex: 100 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <span style={{ fontFamily: styles.mono, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>Notifications</span>
                  {unreadCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: styles.purpleBright, fontFamily: styles.mono, fontSize: '9px', letterSpacing: '1px', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
                </div>
                {notifs.length === 0 ? (
                  <div style={{ padding: '28px 14px', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: '11px', fontFamily: styles.mono }}>No recent activity</div>
                ) : notifs.map((n, i) => {
                  const tc = { success: styles.accentGreen, warning: '#D6A05C', info: styles.purpleBright, error: '#D65C5C' }[n.type] || styles.purpleBright;
                  return (
                    <div key={n.id || i} className="sa-hover-row"
                      onClick={() => { if (n.resource_type === 'application' && n.resource_id) { setNotifOpen(false); window.location.hash = '#/applications/' + n.resource_id; }}}
                      style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: n.resource_id ? 'pointer' : 'default' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: tc, marginTop: '6px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '12px', color: !n.read ? styles.textPrimary : styles.textSecondary, lineHeight: 1.4 }}>{n.message}</p>
                          <span style={{ fontFamily: styles.mono, fontSize: '8px', color: 'rgba(255,255,255,.3)', marginTop: '3px', display: 'block' }}>
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

        <main className="sa-main-content" style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', position: 'relative', zIndex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
