import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/sidebar.css';

const NAV_ITEMS = [
  {
    section: 'Client Portal',
    roles: ['CLIENT_USER', 'ADMIN', 'SUPER_ADMIN'],
    items: [
      { path: '/client-dashboard', icon: '🏠', label: 'My Requests', roles: ['CLIENT_USER'] },
      { path: '/client-requests/new', icon: '📝', label: 'New Request', roles: ['CLIENT_USER'] },
      { path: '/client-reports', icon: '📄', label: 'My Reports', roles: ['CLIENT_USER'] },
    ],
  },
  {
    section: 'Main',
    roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'],
    items: [
      { path: '/overview',   icon: '📊', label: 'Overview', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
      { path: '/dashboard',  icon: '🔍', label: 'Analyze', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
      { path: '/upload',     icon: '📤', label: 'Upload CSV', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    section: 'Detection',
    roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'],
    items: [
      { path: '/graph-viewer',  icon: '🕸️',  label: 'Graph Viewer', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
      { path: '/communities',   icon: '👥',  label: 'Communities', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
      { path: '/risk-map',      icon: '🗺️',  label: 'Risk Map', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
      { path: '/timeline',      icon: '⏱️',  label: 'Timeline', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    section: 'Analytics & Cases',
    roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR'],
    items: [
      { path: '/alerts',     icon: '🚨', label: 'Alerts', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
      { path: '/cases',      icon: '🗂️', label: 'Cases', roles: ['INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
      { path: '/statistics', icon: '📈', label: 'Statistics', roles: ['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN'] },
      { path: '/reports',    icon: '📄', label: 'Reports', roles: ['INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
    ],
  },
  {
    section: 'Admin',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    items: [
      { path: '/admin',       icon: '⚙️', label: 'Dashboard', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { path: '/admin/users', icon: '👥', label: 'Users', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    section: 'Account',
    roles: ['CLIENT_USER', 'TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR'],
    items: [
      { path: '/audit-history', icon: '📋', label: 'Audit Logs', roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'CLIENT_USER'] },
      { path: '/profile',       icon: '👤', label: 'Profile', roles: ['CLIENT_USER', 'TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
    ],
  },
];

export default function Sidebar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

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
            const visibleItems = group.items.filter(item => !item.roles || item.roles.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.section}>
                <p className="sidebar-section-label">{group.section}</p>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
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
