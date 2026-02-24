import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, FileText, Activity, Users, Home, LogOut, Menu, X, ExternalLink, BookOpen } from 'lucide-react';
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

  const typeColor = { success: styles.accentGreen, warning: styles.accentAmber, info: styles.purpleBright, error: styles.accentRed };

  return (
    <div className="min-h-screen font-sans" style={{ color: styles.textPrimary, background: styles.bgDeep }}>
      <div className="sa-grid-overlay" />
      <div className="sa-noise" />

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/10 z-40" />
      )}

      {/* ── Sidebar ── */}
      <div className="fixed top-0 left-0 bottom-0 z-50 w-60 flex flex-col overflow-hidden transition-transform duration-200"
        style={{
          transform: (sidebarOpen || !isMobile) ? 'translateX(0)' : 'translateX(-100%)',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderRight: '1px solid rgba(15,18,30,0.06)',
        }}>

        {/* Brand */}
        <div className="flex items-center justify-between shrink-0 px-4"
          style={{ height: isMobile ? 52 : 72, borderBottom: '1px solid rgba(15,18,30,0.06)' }}>
          <Link to="/dashboard" className="flex items-center no-underline">
            <Logo height={isMobile ? 36 : 52} />
          </Link>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="bg-transparent border-none cursor-pointer p-1 text-txt-tertiary">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 min-h-0 overflow-y-auto" style={{ padding: isMobile ? '4px 0' : '12px 0', WebkitOverflowScrolling: 'touch' }}>
          {filteredNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.name} to={item.href}
                className="flex items-center gap-2.5 no-underline font-mono uppercase transition-colors"
                style={{
                  padding: isMobile ? '7px 16px' : '9px 16px',
                  fontSize: '9px', letterSpacing: '1.5px',
                  color: active ? styles.textPrimary : 'rgba(15,18,30,0.72)',
                  borderLeft: active ? `2px solid ${styles.purpleBright}` : '2px solid transparent',
                  background: active ? 'rgba(74,61,117,.06)' : 'transparent',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = styles.textPrimary; e.currentTarget.style.background = 'rgba(0,0,0,.025)'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(15,18,30,0.72)'; e.currentTarget.style.background = 'transparent'; }}}
              >
                {item.icon === 'brand' ? <BrandMark size={14} /> : <item.icon size={14} style={{ opacity: active ? 1 : 0.6 }} />}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User panel */}
        <div className="shrink-0" style={{ padding: isMobile ? '10px 16px' : '16px', borderTop: '1px solid rgba(15,18,30,0.06)' }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: isMobile ? 8 : 12 }}>
            <div data-avatar="true" className="flex items-center justify-center bg-brand" style={{ width: 28, height: 28, border: '1px solid rgba(107,90,158,0.3)' }}>
              <span className="text-white text-xs font-medium">{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div>
              <div className="text-sm text-txt">{user?.full_name}</div>
              <div className="font-mono text-txt-tertiary uppercase" style={{ fontSize: '9px', letterSpacing: '2px' }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 font-mono uppercase bg-transparent border-none cursor-pointer p-0 text-txt-tertiary hover:text-txt transition-colors"
            style={{ fontSize: '9px', letterSpacing: '2px' }}>
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10" style={{ marginLeft: isMobile ? 0 : 240 }}>

        {/* Header */}
        <header className="flex items-center sticky top-0 z-30"
          style={{
            height: isMobile ? 48 : 72,
            padding: isMobile ? '0 12px' : '0 20px',
            gap: 14,
            borderBottom: '1px solid rgba(15,18,30,0.06)',
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-transparent border-none cursor-pointer p-1 text-txt-tertiary">
              <Menu size={18} />
            </button>
          )}
          <div className="flex-1" />

          <a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-mono uppercase no-underline text-txt-tertiary hover:text-txt transition-colors"
            style={{ fontSize: '9px', letterSpacing: '1.5px', padding: '8px 4px' }}>
            <ExternalLink size={12} />
            {!isMobile && 'Main Site'}
          </a>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)}
              className="bg-transparent border-none cursor-pointer p-1"
              style={{ color: notifOpen ? styles.purpleBright : styles.textTertiary }}>
              <Bell size={16} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span data-dot="true" className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 rounded-full bg-accent-red text-white font-mono font-bold flex items-center justify-center"
                  style={{ fontSize: '8px', padding: '0 2px' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (<>
              <div onClick={() => setNotifOpen(false)} className="fixed inset-0 z-[90]" />
              <div className="absolute right-0 z-[100] overflow-y-auto"
                style={{
                  top: 44, width: 'min(340px, 90vw)', maxHeight: '70vh',
                  background: 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(20px) saturate(1.3)',
                  WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
                  border: '1px solid rgba(15,18,30,0.06)',
                }}>
                <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: '1px solid rgba(15,18,30,0.06)' }}>
                  <span className="font-mono text-txt-tertiary uppercase" style={{ fontSize: '10px', letterSpacing: '2px' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="bg-transparent border-none text-brand font-mono cursor-pointer p-0" style={{ fontSize: '9px', letterSpacing: '1px' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <div className="py-8 px-4 text-center text-txt-dim text-xs">No recent activity</div>
                ) : notifs.map((n, i) => (
                  <div key={n.id || i}
                    onClick={() => { if (n.resource_type === 'application' && n.resource_id) { setNotifOpen(false); window.location.hash = '#/applications/' + n.resource_id; }}}
                    className="px-4 py-3" style={{ borderBottom: '1px solid rgba(15,18,30,0.04)', cursor: n.resource_id ? 'pointer' : 'default' }}>
                    <div className="flex gap-2.5 items-start">
                      <span data-dot="true" className="inline-block w-1 h-1 rounded-full shrink-0 mt-1.5"
                        style={{ background: typeColor[n.type] || styles.purpleBright }} />
                      <div className="flex-1 min-w-0">
                        <p className="m-0 text-sm leading-snug"
                          style={{ color: !n.read ? styles.textPrimary : styles.textSecondary }}>
                          {n.message}
                        </p>
                        <span className="font-mono text-txt-dim mt-1 block" style={{ fontSize: '9px' }}>
                          {n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}{n.user_email ? ' · ' + n.user_email : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </header>

        <main className="sa-main-content relative z-[1]" style={{ padding: 'clamp(16px, 3vw, 32px)' }}>
          {children}
        </main>
      </div>

      <SentinelChatbot />
    </div>
  );
}

export default Layout;
