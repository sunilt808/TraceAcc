import React, { useState } from 'react';
import { Card, Container, Nav, Alert } from 'react-bootstrap';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import traceAccBadge from '../../assets/traceaccbadge.png';
import { ROLES, getRedirectPath } from './authConstants';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

function LoginCard() {
  const { login, clientRegister, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [rememberMe, setRememberMe] = useState(false);

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Client registration state
  const [registerData, setRegisterData] = useState({
    org_name: '',
    org_type: 'Bank',
    registration_number: '',
    contact_person: '',
    org_email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRedirect = (user) => {
    navigate(getRedirectPath(user.role), { replace: true });
  };

  // Already authenticated guard
  if (isAuthenticated) {
    return <Navigate to={getRedirectPath(role)} replace />;
  }

  // Handle Login submission
  const submitLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const user = await login(username, password);

      if (
        user.role !== selectedRole &&
        !(selectedRole === 'CLIENT' && user.role === 'CLIENT_USER')
      ) {
        setError(
          `Access denied. Your account is registered as "${user.role}". Please select the correct role.`
        );
        setLoading(false);
        return;
      }

      handleRedirect(user);
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Sign in failed';

      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup submission
  const submitSignup = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (registerData.password !== registerData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (registerData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        org_name: registerData.org_name.trim(),
        org_type: registerData.org_type,
        registration_number: registerData.registration_number.trim(),
        contact_person: registerData.contact_person.trim(),
        org_email: registerData.org_email.trim(),
        phone: registerData.phone.trim(),
        password: registerData.password,
        confirm_password: registerData.confirm_password,
      };

      await clientRegister(payload);

      setSuccessMsg(
        'Registration successful! Your organization is pending admin approval.'
      );

      setActiveTab('login');
      setUsername(registerData.org_email.split('@')[0]);
      setPassword('');
      setSelectedRole('CLIENT');

      setRegisterData({
        org_name: '',
        org_type: 'Bank',
        registration_number: '',
        contact_person: '',
        org_email: '',
        phone: '',
        password: '',
        confirm_password: '',
      });
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed';

      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  const currentRole = ROLES.find((r) => r.value === selectedRole) || ROLES[0];
  const currentRoleColor = currentRole.color;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Background Ambient Orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '55vw',
          height: '55vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${currentRoleColor}18, transparent 70%)`,
          filter: 'blur(90px)',
          animation: 'loginOrbFloat 14s ease-in-out infinite alternate',
          transition: 'background 0.8s ease',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '50vw',
          height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.12), transparent 70%)',
          filter: 'blur(90px)',
          animation: 'loginOrbFloat 18s ease-in-out infinite alternate-reverse',
          pointerEvents: 'none',
        }}
      />

      {/* Grid Pattern Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Main Container */}
      <Container
        style={{
          maxWidth: activeTab === 'signup' ? '540px' : '470px',
          position: 'relative',
          zIndex: 10,
          transition: 'max-width 0.3s ease',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card
            style={{
              background: 'rgba(15, 23, 42, 0.82)',
              backdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '26px',
              boxShadow: `0 32px 64px -16px rgba(0, 0, 0, 0.65), 0 0 48px ${currentRoleColor}12`,
              overflow: 'hidden',
              transition: 'box-shadow 0.5s ease',
            }}
          >
            <Card.Body className="p-4 p-md-5">
              {/* Brand / Logo Header */}
              <motion.div
                className="text-center mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <Link
                  to="/"
                  className="text-decoration-none d-inline-flex align-items-center gap-2"
                >
                  <motion.img
                    src={traceAccBadge}
                    alt="TraceAcc"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                    }}
                    whileHover={{ rotate: 8, scale: 1.08 }}
                  />
                  <span
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 700,
                      fontSize: 26,
                      background: 'linear-gradient(135deg, #F9FAFB, #94A3B8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    TraceAcc
                  </span>
                </Link>

                <div
                  style={{
                    color: '#64748B',
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: 500,
                    letterSpacing: '0.4px',
                  }}
                >
                  AML Operations · Zero Trust · Enterprise Intelligence
                </div>
              </motion.div>

              {/* Navigation Pill Tabs */}
              <Nav variant="pills" className="justify-content-center mb-4 gap-2">
                {['login', 'signup'].map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <Nav.Item key={tab}>
                      <Nav.Link
                        active={isActive}
                        onClick={() => {
                          setActiveTab(tab);
                          setError('');
                          setSuccessMsg('');
                        }}
                        style={{
                          background: isActive
                            ? `linear-gradient(135deg, ${currentRoleColor}, #7C3AED)`
                            : 'rgba(255, 255, 255, 0.03)',
                          color: isActive ? '#F8FAFC' : '#94A3B8',
                          border: isActive
                            ? '1px solid rgba(255, 255, 255, 0.12)'
                            : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '8px 28px',
                          boxShadow: isActive
                            ? `0 4px 14px ${currentRoleColor}30`
                            : 'none',
                          transition: 'all 0.25s ease',
                        }}
                      >
                        {tab === 'login' ? 'Sign In' : 'Sign Up'}
                      </Nav.Link>
                    </Nav.Item>
                  );
                })}
              </Nav>

              {/* Feedback Alerts */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className="mb-3"
                  >
                    <Alert
                      variant="danger"
                      className="py-2 px-3 m-0 d-flex align-items-center gap-2"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#FCA5A5',
                        borderRadius: 12,
                        fontSize: 13,
                      }}
                    >
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>{error}</span>
                    </Alert>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className="mb-3"
                  >
                    <Alert
                      variant="success"
                      className="py-2 px-3 m-0 d-flex align-items-center gap-2"
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#34D399',
                        borderRadius: 12,
                        fontSize: 13,
                      }}
                    >
                      <CheckCircle2 size={16} className="flex-shrink-0" />
                      <span>{successMsg}</span>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Content Switching with Animations */}
              <AnimatePresence mode="wait">
                {activeTab === 'login' ? (
                  <motion.div
                    key="login-view"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.25 }}
                  >
                    <LoginForm
                      username={username}
                      setUsername={setUsername}
                      password={password}
                      setPassword={setPassword}
                      selectedRole={selectedRole}
                      setSelectedRole={setSelectedRole}
                      rememberMe={rememberMe}
                      setRememberMe={setRememberMe}
                      loading={loading}
                      onSubmit={submitLogin}
                      currentRoleColor={currentRoleColor}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="signup-view"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25 }}
                  >
                    <RegisterForm
                      registerData={registerData}
                      handleRegisterChange={handleRegisterChange}
                      loading={loading}
                      onSubmit={submitSignup}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Card Footer */}
              <div className="text-center mt-4 pt-2">
                <Link
                  to="/"
                  style={{
                    color: '#64748B',
                    fontSize: 12,
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#94A3B8')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
                >
                  <ArrowLeft size={14} /> Back to Landing Page
                </Link>
              </div>
            </Card.Body>
          </Card>
        </motion.div>
      </Container>

      {/* Global Component Styles */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

          @keyframes loginOrbFloat {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(25px, -25px) scale(1.1); }
          }

          .form-control:focus, .form-select:focus {
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25) !important;
            border-color: rgba(99, 102, 241, 0.5) !important;
            background: rgba(255, 255, 255, 0.07) !important;
            color: #F8FAFC !important;
          }

          .input-group:focus-within .input-group-text {
            border-color: rgba(99, 102, 241, 0.5) !important;
            color: #A5B4FC !important;
          }

          .btn:focus { box-shadow: none; }

          .form-check-input:checked {
            background-color: #4F46E5;
            border-color: #4F46E5;
          }
        `}
      </style>
    </div>
  );
}

export default LoginCard;