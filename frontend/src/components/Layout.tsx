import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  LayoutDashboard,
  Building2,
  Cpu,
  Timer,
  FileCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/accounts', label: 'Accounts', icon: <Building2 size={20} /> },
  { path: '/systems', label: 'Systems', icon: <Cpu size={20} /> },
  { path: '/cat72', label: 'CAT-72 Tests', icon: <Timer size={20} /> },
  { path: '/conformance', label: 'Conformance Records', icon: <FileCheck size={20} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-[#12151c] border-r border-white/[0.08] transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center font-bold text-lg">
              S
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="font-semibold text-sm">Sentinel Authority</div>
                <div className="text-[10px] text-gray-500 font-mono">ENVELO™ Platform</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {item.icon}
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1a1e28]">
            <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center font-semibold text-sm">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium truncate">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-500 truncate">{user?.role || 'Member'}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#12151c] border-b border-white/[0.08] flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="text-sm text-gray-400">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300"
              >
                <span className="text-sm">{user?.email}</span>
                <ChevronDown size={16} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1a1e28] border border-white/[0.08] rounded-lg shadow-xl z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
