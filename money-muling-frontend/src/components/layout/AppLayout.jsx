import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import '../../assets/sidebar.css';

/**
 * AppLayout — wraps every protected page with the sidebar.
 * The page content renders in `.app-content`.
 */
export default function AppLayout({ children, title = '', subtitle = '' }) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleProfile = () => navigate('/profile');
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        {(title || subtitle) && (
          <header className="app-topbar d-flex align-items-center justify-content-between">
            <div>
              <span className="topbar-title">{title}</span>
              {subtitle && <span className="topbar-subtitle">— {subtitle}</span>}
            </div>
            {isAuthenticated && (
              <div className="d-flex gap-2">
                <Button variant="outline-light" size="sm" onClick={handleProfile}>
                  Profile
                </Button>
                <Button variant="outline-danger" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            )}
          </header>
        )}
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
