import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/sidebar.css';

const NAV_ITEMS = [
  {
    section: 'Client Portal',
    roles: ['CLIENT', 'ADMIN', 'TRACE_LAB_ANALYST'],
    items: [
      { path: '/client-dashboard', icon: '🏠', label: 'My Requests', roles: ['CLIENT'] },
      { path: '/client-requests/new', icon: '📝', label: 'New Request', roles: ['CLIENT'] },
      { path: '/client-reports', icon: '📄', label: 'My Reports', roles: ['CLIENT'] },
    ],
  },
  {
    section: 'Main',
    roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
    items: [
      { path: '/overview',   icon: '📊', label: 'Overview', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/dashboard',  icon: '🔍', label: 'Analyze', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/upload',     icon: '📤', label: 'Upload CSV', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
    ],
  },
  {
    section: 'Detection',
    roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
    items: [
      { path: '/graph-viewer',  icon: '🕸️',  label: 'Graph Viewer', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/communities',   icon: '👥',  label: 'Communities', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/risk-map',      icon: '🗺️',  label: 'Risk Map', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/timeline',      icon: '⏱️',  label: 'Timeline', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
    ],
  },
  {
    section: 'Analytics & Cases',
    roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
    items: [
      { path: '/alerts',     icon: '🚨', label: 'Alerts', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/cases',      icon: '🗂️', label: 'Cases', roles: ['INVESTIGATOR', 'ADMIN'] },
      { path: '/statistics', icon: '📈', label: 'Statistics', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/reports',    icon: '📄', label: 'Reports', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
    ],
  },
  {
    section: 'Admin',
    roles: ['ADMIN'],
    items: [
      { path: '/admin',       icon: '⚙️', label: 'Dashboard', roles: ['ADMIN'] },
      { path: '/admin/users', icon: '👥', label: 'Users', roles: ['ADMIN'] },
      { path: '/admin/organizations', icon: '🏢', label: 'Organizations', roles: ['ADMIN'] },
    ],
  },
  {
    section: 'Account',
    roles: ['CLIENT', 'TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
    items: [
      { path: '/audit-history', icon: '📋', label: 'Audit Logs', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
      { path: '/profile',       icon: '👤', label: 'Profile', roles: ['CLIENT', 'TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'] },
    ],
  },
];

export default function Sidebar() {
  const { user, role, workspace, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getWorkspaceName = () => {
    if (role === 'CLIENT') return 'client';
    if (role === 'TRACE_LAB_ANALYST') return 'tracelab';
    if (role === 'INVESTIGATOR') return 'invospace';
    if (role === 'ADMIN') return workspace || 'admin';
    return null;
  };

  const workspaceName = getWorkspaceName();
  const prefix = role === 'CLIENT' || workspaceName === 'admin' ? '' : workspaceName ? `/${workspaceName}` : '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  const commonAbsolutePaths = ['/admin', '/profile', '/settings', '/audit-history', '/client-dashboard', '/client-requests/new', '/client-reports'];
  const resolvePath = (path) => {
    if (role === 'CLIENT') return path;
    if (commonAbsolutePaths.some((absolutePath) => path.startsWith(absolutePath))) return path;
    return `${prefix}${path}`;
  };

  const shouldShowItem = (item) => {
    if (role !== 'ADMIN') {
      return !item.roles || item.roles.includes(role);
    }

    if (workspaceName === 'admin') {
      return item.path.startsWith('/admin') || ['profile', 'settings', 'audit-history'].some((suffix) => item.path.endsWith(suffix));
    }

    if (workspaceName === 'tracelab') {
      return !item.path.startsWith('/client') && !item.path.startsWith('/admin');
    }

    if (workspaceName === 'invospace') {
      return !item.path.startsWith('/client') && !item.path.startsWith('/admin');
    }

    return false;
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 199,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 300,
          background: '#161b22', border: '1px solid #30363d',
          borderRadius: 6, padding: '6px 10px', color: '#f0f6fc',
          cursor: 'pointer', display: 'none',
        }}
        className="sidebar-mobile-toggle"
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <NavLink to="/overview" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
          <div className="sidebar-logo-icon">🛡️</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">TraceAcc</span>
            <span className="sidebar-logo-sub">Crime Detection</span>
          </div>
        </NavLink>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter(group => !group.roles || group.roles.includes(role)).map((group) => {
            const visibleItems = group.items.filter(item => shouldShowItem(item));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.section}>
                <p className="sidebar-section-label">{group.section}</p>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={resolvePath(item.path)}
                    className={({ isActive }) =>
                      `sidebar-link${isActive ? ' active' : ''}`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    {item.label}
                    {item.badge && (
                      <span className={`sidebar-badge ${item.badgeType || ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <span className="sidebar-username">{user?.username || 'User'}</span>
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Logout"
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
