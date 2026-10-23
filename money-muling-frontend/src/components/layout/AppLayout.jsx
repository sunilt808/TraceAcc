import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import {
  User,
  LogOut,
  Shield,
  FlaskConical,
  Search,
  ChevronDown,
  ArrowLeftRight,
  Check,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import '../../assets/sidebar.css';

const WORKSPACE_OPTIONS = [
  {
    id: 'admin',
    label: 'Admin Hub',
    path: '/admin',
    icon: Shield,
    color: '#58a6ff',
  },
  {
    id: 'tracelab',
    label: 'TraceLab',
    path: '/tracelab/overview',
    icon: FlaskConical,
    color: '#3fb950',
  },
  {
    id: 'invospace',
    label: 'InvoSpace',
    path: '/invospace/overview',
    icon: Search,
    color: '#d29922',
  },
];

/**
 * AppLayout — wraps every protected page with the sidebar.
 * The page content renders in `.app-content`.
 */
export default function AppLayout({ children, title = '', subtitle = '' }) {
  const { isAuthenticated, logout, user, role, workspace, setWorkspace } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const topbarWorkspaceRef = useRef(null);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (topbarWorkspaceRef.current && !topbarWorkspaceRef.current.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeWorkspaceId = role === 'ADMIN' ? workspace || 'admin' : null;
  const currentWorkspaceInfo =
    WORKSPACE_OPTIONS.find((w) => w.id === activeWorkspaceId) || WORKSPACE_OPTIONS[0];

  const handleProfile = () => navigate('/profile');

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  const handleSwitchWorkspace = (ws) => {
    setWorkspace(ws.id);
    setWorkspaceMenuOpen(false);
    navigate(ws.path, { replace: true });
  };

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        onRequestLogout={() => setShowLogoutModal(true)}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className="app-content">
        {(title || subtitle) && (
          <header className="app-topbar d-flex align-items-center justify-content-between px-3 px-md-4">
            <div className="d-flex align-items-center gap-2">
              <button
                onClick={handleToggleCollapse}
                className="sidebar-collapse-toggle d-none d-md-flex me-1"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label="Toggle sidebar"
              >
                <PanelLeft size={18} />
              </button>
              <div>
                <span className="topbar-title">{title}</span>
                {subtitle && <span className="topbar-subtitle ms-2">— {subtitle}</span>}
              </div>
            </div>

            {isAuthenticated && (
              <div className="d-flex align-items-center gap-2">
                {/* Admin Workspace Quick Switcher in Topbar */}
                {role === 'ADMIN' && (
                  <div ref={topbarWorkspaceRef} style={{ position: 'relative' }}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                      className="d-flex align-items-center gap-1.5 text-light"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderColor: '#30363d',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {(() => {
                        const Icon = currentWorkspaceInfo.icon;
                        return <Icon size={14} color={currentWorkspaceInfo.color} />;
                      })()}
                      <span className="d-none d-sm-inline">{currentWorkspaceInfo.label}</span>
                      <ChevronDown size={13} style={{ color: '#8b949e' }} />
                    </Button>

                    {workspaceMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          right: 0,
                          width: 200,
                          backgroundColor: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: 8,
                          padding: 4,
                          zIndex: 300,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        }}
                      >
                        <div
                          style={{
                            padding: '6px 8px 4px',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#8b949e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Switch Workspace
                        </div>

                        {WORKSPACE_OPTIONS.map((ws) => {
                          const Icon = ws.icon;
                          const isSelected = ws.id === activeWorkspaceId;

                          return (
                            <button
                              key={ws.id}
                              onClick={() => handleSwitchWorkspace(ws)}
                              style={{
                                width: '100%',
                                background: isSelected ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: isSelected ? '#58a6ff' : '#c9d1d9',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: 12,
                                marginBottom: 2,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div className="d-flex align-items-center gap-2">
                                <Icon size={14} color={ws.color} />
                                <span>{ws.label}</span>
                              </div>
                              {isSelected && <Check size={13} color="#58a6ff" />}
                            </button>
                          );
                        })}

                        <div style={{ borderTop: '1px solid #30363d', margin: '4px 0', padding: '4px 2px 2px' }}>
                          <button
                            onClick={() => {
                              setWorkspaceMenuOpen(false);
                              navigate('/workspace-selector');
                            }}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: 'none',
                              borderRadius: 4,
                              padding: '5px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 11,
                              color: '#8b949e',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#f0f6fc';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#8b949e';
                            }}
                          >
                            <ArrowLeftRight size={12} />
                            <span>Workspace Selector</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleProfile}
                  className="d-flex align-items-center gap-1.5 border-secondary border-opacity-50 text-light"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <User size={14} />
                  <span>{user?.username || 'Profile'}</span>
                </Button>

                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setShowLogoutModal(true)}
                  className="d-flex align-items-center gap-1.5"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </header>
        )}
        <main className="page-container">{children}</main>
      </div>

      {/* Logout Confirmation Modal */}
      <Modal
        show={showLogoutModal}
        onHide={() => setShowLogoutModal(false)}
        centered
        contentClassName="bg-dark text-light border border-secondary border-opacity-25"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-warning">
            <LogOut size={18} /> Confirm Logout
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4">
          <p className="mb-0 text-secondary">
            Are you sure you want to end your current session and return to the login screen?
          </p>
        </Modal.Body>
        <Modal.Footer className="border-secondary border-opacity-25">
          <Button variant="outline-secondary" size="sm" onClick={() => setShowLogoutModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmLogout}>
            Confirm Logout
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
