import React from 'react';
import Sidebar from './Sidebar';
import '../../assets/sidebar.css';

/**
 * AppLayout — wraps every protected page with the sidebar.
 * The page content renders in `.app-content`.
 */
export default function AppLayout({ children, title = '', subtitle = '' }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        {(title || subtitle) && (
          <header className="app-topbar">
            <span className="topbar-title">{title}</span>
            {subtitle && <span className="topbar-subtitle">— {subtitle}</span>}
          </header>
        )}
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
