import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/sidebar.css';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { path: '/overview',   icon: '📊', label: 'Overview' },
      { path: '/dashboard',  icon: '🔍', label: 'Analyze' },
      { path: '/upload',     icon: '📤', label: 'Upload CSV' },
    ],
  },
  {
    section: 'Detection',
    items: [
      { path: '/graph-viewer',  icon: '🕸️',  label: 'Graph Viewer' },
      { path: '/communities',   icon: '👥',  label: 'Communities' },
      { path: '/risk-map',      icon: '🗺️',  label: 'Risk Map' },
      { path: '/timeline',      icon: '⏱️',  label: 'Timeline' },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { path: '/statistics', icon: '📈', label: 'Statistics' },
      { path: '/reports',    icon: '📄', label: 'Reports' },
      { path: '/cases',      icon: '🗂️', label: 'Cases' },
    ],
  },
  {
    section: 'Account',
    items: [
      { path: '/audit-history', icon: '📋', label: 'Audit Logs' },
      { path: '/profile',       icon: '👤', label: 'Profile' },
      { path: '/settings',      icon: '⚙️', label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
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
          {NAV_ITEMS.map((group) => (
            <div key={group.section}>
              <p className="sidebar-section-label">{group.section}</p>
              {group.items.map((item) => (
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
          ))}
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
