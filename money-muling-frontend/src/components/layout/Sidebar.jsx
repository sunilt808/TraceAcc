import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  PlusCircle,
  FileText,
  LayoutDashboard,
  Search,
  Upload,
  Network,
  Users,
  Map,
  Clock,
  Puzzle,
  Radio,
  Bell,
  Briefcase,
  BarChart2,
  FileCheck,
  Settings,
  Building2,
  Inbox,
  Zap,
  ScrollText,
  User,
  Shield,
  Menu,
  LogOut,
  ChevronDown,
  ArrowLeftRight,
  FlaskConical,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
  Database,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../assets/sidebar.css';

const WORKSPACE_OPTIONS = [
  {
    id: 'admin',
    label: 'Admin Hub',
    sublabel: 'Governance & Queues',
    path: '/admin',
    icon: Shield,
    color: '#58a6ff',
  },
  {
    id: 'tracelab',
    label: 'TraceLab',
    sublabel: 'Analytics Engine',
    path: '/tracelab/overview',
    icon: FlaskConical,
    color: '#3fb950',
  },
  {
    id: 'invospace',
    label: 'InvoSpace',
    sublabel: 'Investigation Hub',
    path: '/invospace/overview',
    icon: Search,
    color: '#d29922',
  },
];

const NAV_ITEMS = [
  // ============================================================
  // CLIENT PORTAL
  // ============================================================
  {
    section: 'Client Portal',
    roles: ['CLIENT', 'ADMIN', 'TRACE_LAB_ANALYST'],
    items: [
      {
        path: '/client-dashboard',
        icon: FolderOpen,
        label: 'My Requests',
        roles: ['CLIENT'],
      },
      {
        path: '/client-requests/new',
        icon: PlusCircle,
        label: 'New Request',
        roles: ['CLIENT'],
      },
      {
        path: '/client-reports',
        icon: FileText,
        label: 'My Reports',
        roles: ['CLIENT'],
      },
    ],
  },

  // ============================================================
  // MAIN STUDIO
  // ============================================================
  {
    section: 'Main',
    roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
    items: [
      {
        path: '/overview',
        icon: LayoutDashboard,
        label: 'Overview',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/liveshield',
        icon: Activity,
        label: 'LiveShield Studio',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/cases',
        icon: Briefcase,
        label: 'Case Tracking',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/alerts',
        icon: Bell,
        label: 'Alerts Queue',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
    ],
  },

  // ============================================================
  // FORENSIC INTELLIGENCE
  // ============================================================
  {
    section: 'Forensics & Intelligence',
    roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
    items: [
      {
        path: '/graph-viewer',
        icon: Network,
        label: 'Graph Explorer',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/risk-map',
        icon: Map,
        label: 'Risk Map & Typologies',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/timeline',
        icon: Clock,
        label: 'Transaction Timeline',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/communities',
        icon: Users,
        label: 'Mule Communities',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
      {
        path: '/reports',
        icon: FileText,
        label: 'Audit & Reports',
        roles: ['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN'],
      },
    ],
  },

  // ============================================================
  // ADMIN
  // ============================================================
  {
    section: 'Admin',
    roles: ['ADMIN'],
    items: [
      {
        path: '/admin',
        icon: Settings,
        label: 'Dashboard',
        roles: ['ADMIN'],
      },
      {
        path: '/admin/users',
        icon: Users,
        label: 'Users',
        roles: ['ADMIN'],
      },
      {
        path: '/admin/organizations',
        icon: Building2,
        label: 'Organizations',
        roles: ['ADMIN'],
      },
      {
        path: '/admin/requests',
        icon: Inbox,
        label: 'Service Requests',
        roles: ['ADMIN'],
      },
      {
        path: '/admin/reports',
        icon: FileCheck,
        label: 'Report Review',
        roles: ['ADMIN'],
      },
      {
        path: '/admin/operations',
        icon: Zap,
        label: 'Operations Queue',
        roles: ['ADMIN'],
      },
    ],
  },

  // ============================================================
  // ACCOUNT
  // ============================================================
  {
    section: 'Account',
    roles: [
      'CLIENT',
      'TRACE_LAB_ANALYST',
      'INVESTIGATOR',
      'ADMIN',
    ],
    items: [
      {
        path: '/audit-history',
        icon: ScrollText,
        label: 'Audit Logs',
        roles: ['ADMIN'],
      },
      {
        path: '/profile',
        icon: User,
        label: 'Profile',
        roles: [
          'CLIENT',
          'TRACE_LAB_ANALYST',
          'INVESTIGATOR',
          'ADMIN',
        ],
      },
    ],
  },
];

export default function Sidebar({ onRequestLogout, collapsed = false, onToggleCollapse }) {
  const { user, role, workspace, setWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================
  // WORKSPACE
  // ============================================================

  const getWorkspaceName = () => {
    if (role === 'CLIENT') {
      return 'client';
    }

    if (role === 'TRACE_LAB_ANALYST') {
      return 'tracelab';
    }

    if (role === 'INVESTIGATOR') {
      return 'invospace';
    }

    if (role === 'ADMIN') {
      return workspace || 'admin';
    }

    return null;
  };

  const workspaceName = getWorkspaceName();

  const currentWorkspaceInfo =
    WORKSPACE_OPTIONS.find((w) => w.id === workspaceName) || WORKSPACE_OPTIONS[0];

  const handleSwitchWorkspace = (targetWorkspace) => {
    setWorkspace(targetWorkspace.id);
    setWorkspaceMenuOpen(false);
    navigate(targetWorkspace.path, { replace: true });
  };

  const prefix =
    role === 'CLIENT' || workspaceName === 'admin'
      ? ''
      : workspaceName
        ? `/${workspaceName}`
        : '';

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    if (onRequestLogout) {
      onRequestLogout();
    } else {
      logout();
      navigate('/login');
    }
  };

  // ============================================================
  // USER INITIALS
  // ============================================================

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  // ============================================================
  // ABSOLUTE PATHS
  // ============================================================

  const commonAbsolutePaths = [
    '/admin',
    '/profile',
    '/settings',
    '/audit-history',
    '/sample-generator',
    '/workspace-selector',
    '/client-dashboard',
    '/client-requests/new',
    '/client-reports',
  ];

  const resolvePath = (path) => {
    if (role === 'CLIENT') {
      return path;
    }

    if (
      commonAbsolutePaths.some((absolutePath) =>
        path.startsWith(absolutePath)
      )
    ) {
      return path;
    }

    return `${prefix}${path}`;
  };

  // ============================================================
  // VISIBILITY
  // ============================================================

  const shouldShowItem = (item) => {
    // NON-ADMIN
    if (role !== 'ADMIN') {
      return !item.roles || item.roles.includes(role);
    }

    // ADMIN WORKSPACE
    if (workspaceName === 'admin') {
      return (
        item.path.startsWith('/admin') ||
        ['profile', 'settings', 'audit-history'].some((suffix) =>
          item.path.endsWith(suffix)
        )
      );
    }

    // TRACELAB WORKSPACE
    if (workspaceName === 'tracelab') {
      return !item.path.startsWith('/client') && !item.path.startsWith('/admin');
    }

    // INVOSPACE WORKSPACE
    if (workspaceName === 'invospace') {
      return !item.path.startsWith('/client') && !item.path.startsWith('/admin');
    }

    return false;
  };

  return (
    <>
      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 199,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* MOBILE TOGGLE */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 300,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '7px 10px',
          color: '#f0f6fc',
          cursor: 'pointer',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="sidebar-mobile-toggle"
        aria-label="Toggle navigation"
      >
        <Menu size={18} />
      </button>

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* BRAND & WORKSPACE HEADER */}
        <div
          ref={workspaceRef}
          style={{
            position: 'relative',
            borderBottom: '1px solid #21262d',
            flexShrink: 0,
          }}
        >
          <div
            className="sidebar-header-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 14px 14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
                flex: 1,
              }}
            >
              <NavLink
                to={role === 'ADMIN' ? (workspaceName === 'admin' ? '/admin' : resolvePath('/overview')) : '/overview'}
                style={{ textDecoration: 'none', flexShrink: 0 }}
                title="TraceAcc"
              >
                <div
                  className="sidebar-logo-icon"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #1f6feb, #388bfd)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Shield size={18} color="#FFFFFF" />
                </div>
              </NavLink>

              <div className="sidebar-brand-text" style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#f0f6fc',
                    letterSpacing: '0.2px',
                  }}
                >
                  TraceAcc
                </div>

                {role === 'ADMIN' ? (
                  <button
                    onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      color: currentWorkspaceInfo.color,
                      fontSize: 11,
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                    title="Click to switch workspace"
                  >
                    <span>{currentWorkspaceInfo.label}</span>
                    <ChevronDown
                      size={12}
                      style={{
                        opacity: 0.8,
                        transform: workspaceMenuOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                ) : (
                  <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 400 }}>
                    Crime Detection
                  </div>
                )}
              </div>
            </div>

            {/* Collapse Toggle Button */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="sidebar-collapse-toggle sidebar-brand-text"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label="Toggle sidebar"
              >
                <PanelLeft size={16} />
              </button>
            )}
          </div>

          {/* SLEEK DROPDOWN MENU */}
          {role === 'ADMIN' && workspaceMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 10,
                right: 10,
                minWidth: 200,
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 8,
                padding: 4,
                zIndex: 350,
                boxShadow: '0 10px 28px rgba(0,0,0,0.65)',
              }}
            >
              <div
                style={{
                  padding: '6px 8px 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#8b949e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }}
              >
                Switch Workspace
              </div>

              {WORKSPACE_OPTIONS.map((ws) => {
                const Icon = ws.icon;
                const isSelected = ws.id === workspaceName;

                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitchWorkspace(ws)}
                    style={{
                      width: '100%',
                      background: isSelected ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: isSelected ? '#58a6ff' : '#c9d1d9',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: 2,
                      transition: 'background 0.1s',
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
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{ws.label}</div>
                        <div style={{ fontSize: 10, color: '#8b949e' }}>{ws.sublabel}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={13} color="#58a6ff" />}
                  </button>
                );
              })}

              <div style={{ borderTop: '1px solid #21262d', margin: '4px 0', padding: '4px 2px 2px' }}>
                <NavLink
                  to="/workspace-selector"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    setMobileOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#8b949e',
                    textDecoration: 'none',
                    padding: '6px 8px',
                    borderRadius: 4,
                  }}
                >
                  <ArrowLeftRight size={12} />
                  <span>Workspace Selector Hub</span>
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* NAVIGATION */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter(
            (group) => !group.roles || group.roles.includes(role)
          ).map((group) => {
            const visibleItems = group.items.filter(shouldShowItem);

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={group.section}>
                <p className="sidebar-section-label">{group.section}</p>

                {visibleItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={resolvePath(item.path)}
                      end={item.path === '/admin' || item.path === '/overview' || item.path === '/dashboard' || item.path === '/client-dashboard'}
                      className={({ isActive }) =>
                        `sidebar-link${isActive ? ' active' : ''}`
                      }
                      onClick={() => setMobileOpen(false)}
                      title={item.label}
                    >
                      <span className="sidebar-link-icon d-inline-flex align-items-center justify-content-center">
                        <ItemIcon size={16} />
                      </span>

                      <span className="sidebar-link-text">{item.label}</span>

                      {item.badge && (
                        <span
                          className={`sidebar-badge ${
                            item.badgeType || ''
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* USER FOOTER */}
        <div className="sidebar-footer">
          <div className="sidebar-user" title={user?.username || 'User'}>
            <div className="sidebar-avatar">{initials}</div>

            <span className="sidebar-username">
              {user?.username || 'User'}
            </span>

            <button
              className="sidebar-logout-btn sidebar-brand-text d-flex align-items-center justify-content-center"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}