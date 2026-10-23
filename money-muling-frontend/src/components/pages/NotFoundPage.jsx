import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from 'react-bootstrap';
import {
  FileQuestion,
  LayoutDashboard,
  ArrowLeft,
  Shield,
  LogIn,
  Home,
} from 'lucide-react';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../../context/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated, role, workspace } = useAuth();
  const navigate = useNavigate();

  // Helper to determine role-appropriate home/dashboard route
  const getDashboardPath = () => {
    if (role === 'CLIENT') return '/client-dashboard';
    if (role === 'ADMIN') {
      if (workspace === 'tracelab') return '/tracelab/overview';
      if (workspace === 'invospace') return '/invospace/overview';
      return '/admin';
    }
    if (role === 'TRACE_LAB_ANALYST') return '/tracelab/overview';
    if (role === 'INVESTIGATOR') return '/invospace/overview';
    return '/overview';
  };

  // ============================================================
  // AUTHENTICATED USER (Render inside AppLayout with Sidebar/Topbar)
  // ============================================================
  if (isAuthenticated) {
    return (
      <AppLayout title="Page Not Found" subtitle="Error 404">
        <div
          className="d-flex align-items-center justify-content-center"
          style={{ minHeight: 'calc(100vh - 180px)', padding: '24px 0' }}
        >
          <Card
            className="shadow-lg text-center p-4 p-md-5"
            style={{
              maxWidth: 540,
              width: '100%',
              backgroundColor: '#0d1117',
              borderColor: '#21262d',
              borderRadius: 16,
            }}
          >
            <Card.Body className="p-0">
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid #30363d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  color: '#8b949e',
                }}
              >
                <FileQuestion size={32} />
              </div>

              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  letterSpacing: '2px',
                  color: '#f0f6fc',
                  lineHeight: 1,
                  marginBottom: 8,
                }}
              >
                404
              </div>

              <h4 className="text-white mb-2 fw-semibold">Page Not Found</h4>
              <p className="text-secondary small mb-4" style={{ lineHeight: 1.6 }}>
                The page you are looking for does not exist, has been removed, or you may not have sufficient access permissions.
              </p>

              <div className="d-flex flex-wrap gap-2 justify-content-center">
                <Button
                  variant="primary"
                  onClick={() => navigate(getDashboardPath())}
                  className="d-inline-flex align-items-center gap-2 px-3 py-2"
                >
                  <LayoutDashboard size={16} />
                  <span>Go to Dashboard</span>
                </Button>

                <Button
                  variant="outline-secondary"
                  onClick={() => navigate(-1)}
                  className="d-inline-flex align-items-center gap-2 px-3 py-2 text-light"
                  style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
                >
                  <ArrowLeft size={16} />
                  <span>Go Back</span>
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ============================================================
  // UNAUTHENTICATED USER (Standalone Full-Screen 404)
  // ============================================================
  return (
    <div
      className="vh-100 d-flex flex-column align-items-center justify-content-center px-3"
      style={{ backgroundColor: '#010409', color: '#f0f6fc' }}
    >
      <div className="text-center" style={{ maxWidth: 480, width: '100%' }}>
        {/* Brand Logo */}
        <div className="d-inline-flex align-items-center gap-2 mb-4">
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1f6feb, #388bfd)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={22} color="#FFFFFF" />
          </div>
          <div className="text-start" style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>TraceAcc</div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>Crime Detection</div>
          </div>
        </div>

        {/* 404 Box */}
        <Card
          className="shadow-lg text-center p-4 p-md-5"
          style={{
            backgroundColor: '#0d1117',
            borderColor: '#21262d',
            borderRadius: 16,
          }}
        >
          <Card.Body className="p-0">
            <div
              style={{
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: '3px',
                color: '#58a6ff',
                lineHeight: 1,
                marginBottom: 12,
              }}
            >
              404
            </div>

            <h4 className="text-white mb-2 fw-semibold">Page Not Found</h4>
            <p className="text-secondary small mb-4" style={{ lineHeight: 1.6 }}>
              The requested URL was not found on this server. Please check the address or sign in to your account.
            </p>

            <div className="d-flex flex-wrap gap-2 justify-content-center">
              <Button
                variant="primary"
                onClick={() => navigate('/login')}
                className="d-inline-flex align-items-center gap-2 px-3 py-2"
              >
                <LogIn size={16} />
                <span>Go to Login</span>
              </Button>

              <Button
                variant="outline-secondary"
                onClick={() => navigate('/')}
                className="d-inline-flex align-items-center gap-2 px-3 py-2 text-light"
                style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
              >
                <Home size={16} />
                <span>Landing Page</span>
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
