import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  InputGroup,
  Modal,
  Alert,
  Spinner,
  Badge,
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  ScrollText,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Building,
  Mail,
  CheckCircle,
  Lock,
  Calendar,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Reset Password State
  const [showResetModal, setShowResetModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowResetModal(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Failed to change password.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  const userRole = user?.role || 'USER';

  return (
    <div className="profile-page-container">
      {/* ── 1. Profile Hero / Header Card ─────────────────────────── */}
      <div
        style={{
          background: 'rgba(13, 17, 23, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 24,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
          {/* Avatar + Basic User Info */}
          <div className="d-flex align-items-center gap-3.5">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1f6feb 0%, #1158c7 100%)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 26,
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              }}
            >
              {user?.username ? user.username.charAt(0).toUpperCase() : <User size={28} />}
            </div>

            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h4 className="fw-bold text-light mb-0" style={{ fontSize: 22 }}>
                  {user?.username || 'User Profile'}
                </h4>
                <Badge
                  style={{
                    background: 'rgba(31, 111, 235, 0.15)',
                    color: '#58a6ff',
                    border: '1px solid rgba(31, 111, 235, 0.3)',
                    fontWeight: 600,
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  {userRole}
                </Badge>
              </div>

              <div className="d-flex align-items-center gap-3 text-secondary small flex-wrap">
                <span className="d-flex align-items-center gap-1">
                  <Mail size={14} className="text-secondary" />
                  {user?.username || '—'}
                </span>
                <span>•</span>
                <span className="d-flex align-items-center gap-1 text-success">
                  <CheckCircle size={14} />
                  Active Account
                </span>
                <span>•</span>
                <span className="text-secondary">User ID: #{user?.id || '—'}</span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="d-flex align-items-center gap-2.5 flex-wrap">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => {
                setError('');
                setSuccess('');
                setShowResetModal(true);
              }}
              style={{
                background: 'rgba(31, 111, 235, 0.1)',
                borderColor: 'rgba(31, 111, 235, 0.35)',
                color: '#58a6ff',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 600,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <KeyRound size={15} /> Reset Password
            </Button>

            {user?.role === 'ADMIN' && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => navigate('/audit-history')}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#c9d1d9',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontWeight: 500,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ScrollText size={15} /> Audit Logs
              </Button>
            )}

            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => setShowLogoutModal(true)}
              style={{
                background: 'rgba(248, 81, 73, 0.08)',
                borderColor: 'rgba(248, 81, 73, 0.25)',
                color: '#f85149',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 500,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <LogOut size={15} /> Logout
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. Profile Details Grid ───────────────────────────────── */}
      <Row className="g-4">
        {/* Account & Identity Section */}
        <Col lg={7}>
          <div
            style={{
              background: 'rgba(13, 17, 23, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              backdropFilter: 'blur(10px)',
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <User size={16} className="text-secondary" />
              <span className="fw-bold text-light" style={{ fontSize: 14 }}>
                Account Information
              </span>
            </div>

            <div style={{ padding: 20 }}>
              <div className="d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-center py-2.5 border-bottom border-white border-opacity-5">
                  <span className="text-secondary small fw-semibold">FULL USERNAME / HANDLE</span>
                  <span className="text-light fw-medium">{user?.username || '—'}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2.5 border-bottom border-white border-opacity-5">
                  <span className="text-secondary small fw-semibold">ACCOUNT IDENTIFIER</span>
                  <span className="text-light fw-medium">#{user?.id ?? '—'}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2.5 border-bottom border-white border-opacity-5">
                  <span className="text-secondary small fw-semibold">ASSIGNED ROLE</span>
                  <span className="text-info fw-semibold">{userRole}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2.5 border-bottom border-white border-opacity-5">
                  <span className="text-secondary small fw-semibold">ORGANIZATION ID</span>
                  <span className="text-light fw-medium">{user?.organization_id ? `Org #${user.organization_id}` : 'Default (Org #1)'}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2.5 border-bottom border-white border-opacity-5">
                  <span className="text-secondary small fw-semibold">PRIMARY WORKSPACE</span>
                  <span className="text-light fw-medium">
                    {userRole === 'ADMIN'
                      ? 'Admin Management Hub'
                      : userRole === 'TRACE_LAB_ANALYST'
                      ? 'TraceLab Analysis Workbench'
                      : userRole === 'INVESTIGATOR'
                      ? 'InvoSpace Investigation Portal'
                      : 'Client Portal'}
                  </span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2.5">
                  <span className="text-secondary small fw-semibold">ACCOUNT STATUS</span>
                  <span className="text-success fw-semibold d-flex align-items-center gap-1.5">
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#3fb950',
                        display: 'inline-block',
                      }}
                    />
                    Operational & Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Col>

        {/* Security & Authentication Section */}
        <Col lg={5}>
          <div
            style={{
              background: 'rgba(13, 17, 23, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              backdropFilter: 'blur(10px)',
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <ShieldCheck size={16} className="text-secondary" />
                <span className="fw-bold text-light" style={{ fontSize: 14 }}>
                  Security & Access
                </span>
              </div>

              <div style={{ padding: 20 }}>
                {/* Password Row */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    marginBottom: 16,
                  }}
                  className="d-flex align-items-center justify-content-between gap-3"
                >
                  <div>
                    <div className="small fw-bold text-light mb-0.5 d-flex align-items-center gap-1.5">
                      <Lock size={14} className="text-secondary" /> Account Password
                    </div>
                    <div className="small text-secondary">
                      •••••••••••• (Protected)
                    </div>
                  </div>

                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      setError('');
                      setSuccess('');
                      setShowResetModal(true);
                    }}
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      color: '#f0f6fc',
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 6,
                    }}
                  >
                    Change
                  </Button>
                </div>

                {/* Session Security info */}
                
              </div>
            </div>

            {/* Session Actions Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(255, 255, 255, 0.01)',
              }}
              className="d-flex justify-content-between align-items-center"
            >
              <span className="small text-secondary">Active browser session</span>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setShowLogoutModal(true)}
                style={{
                  fontSize: 12,
                  padding: '4px 12px',
                  borderRadius: 6,
                }}
              >
                End Session
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* ======================================================
          RESET PASSWORD MODAL
      ====================================================== */}
      <Modal
        show={showResetModal}
        onHide={() => {
          if (!loading) setShowResetModal(false);
        }}
        centered
        contentClassName="bg-dark text-light border border-secondary border-opacity-25"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <KeyRound size={17} className="text-warning" /> Reset Password
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={handlePasswordChange}>
          <Modal.Body className="p-4">
            <p className="small text-secondary mb-3">
              Enter your current password and choose a new password (min. 8 characters).
            </p>

            {error && (
              <Alert
                variant="danger"
                className="d-flex align-items-center gap-2 py-2 mb-3 bg-danger bg-opacity-10 text-danger border-danger border-opacity-25 small"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </Alert>
            )}

            {success && (
              <Alert
                variant="success"
                className="d-flex align-items-center gap-2 py-2 mb-3 bg-success bg-opacity-10 text-success border-success border-opacity-25 small"
              >
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{success}</span>
              </Alert>
            )}

            {/* Current Password */}
            <Form.Group className="mb-3" controlId="modalCurrentPassword">
              <Form.Label className="small text-secondary fw-semibold text-uppercase">
                Current Password
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showCurrentPass ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-dark text-light border-secondary border-opacity-50"
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="border-secondary border-opacity-50"
                >
                  {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* New Password */}
            <Form.Group className="mb-3" controlId="modalNewPassword">
              <Form.Label className="small text-secondary fw-semibold text-uppercase">
                New Password (Min. 8 characters)
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showNewPass ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-dark text-light border-secondary border-opacity-50"
                  minLength={8}
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="border-secondary border-opacity-50"
                >
                  {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Confirm New Password */}
            <Form.Group className="mb-2" controlId="modalConfirmPassword">
              <Form.Label className="small text-secondary fw-semibold text-uppercase">
                Confirm New Password
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showConfirmPass ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-dark text-light border-secondary border-opacity-50"
                  minLength={8}
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="border-secondary border-opacity-50"
                >
                  {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </InputGroup>
            </Form.Group>
          </Modal.Body>

          <Modal.Footer className="border-secondary border-opacity-25">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowResetModal(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                'Update Password'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ======================================================
          LOGOUT CONFIRMATION MODAL
      ====================================================== */}
      <Modal
        show={showLogoutModal}
        onHide={() => setShowLogoutModal(false)}
        centered
        contentClassName="bg-dark text-light border border-secondary border-opacity-25"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary border-opacity-25">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-warning">
            <LogOut size={17} /> Confirm Logout
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
};

export default ProfilePage;
