import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Container,
  Form,
  InputGroup,
  Nav,
  Spinner,
  Row,
  Col
} from 'react-bootstrap';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import traceAccBadge from '../../assets/traceaccbadge.png';

// Role definitions
const ROLES = [
  {
    value: 'ADMIN',
    label: 'Admin',
    icon: '⚙️',
    color: '#3B82F6'
  },
  {
    value: 'TRACE_LAB_ANALYST',
    label: 'Analyst',
    icon: '🔬',
    color: '#8B5CF6'
  },
  {
    value: 'INVESTIGATOR',
    label: 'InvoSpace',
    icon: '🛡️',
    color: '#F59E0B'
  },
  {
    value: 'CLIENT',
    label: 'Client',
    icon: '📋',
    color: '#10B981'
  }
];

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: '13px 18px',
  color: '#F8FAFC',
  fontSize: 14,
  transition: 'all 0.3s'
};

const labelStyle = {
  color: '#94A3B8',
  letterSpacing: '0.5px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase'
};

function LoginCard() {
  const {
    login,
    clientRegister,
    isAuthenticated,
    role
  } = useAuth();

  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('ADMIN');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Client registration
  const [registerData, setRegisterData] = useState({
    org_name: '',
    org_type: 'Bank',
    registration_number: '',
    contact_person: '',
    org_email: '',
    phone: '',
    password: '',
    confirm_password: ''
  });

  // Handle registration input
  const handleRegisterChange = (e) => {
    const { name, value } = e.target;

    setRegisterData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Role based redirect
  const getRedirectPath = (userRole) => {
    switch (userRole) {
      case 'CLIENT':
      case 'CLIENT_USER':
        return '/client-dashboard';

      case 'ADMIN':
      case 'SUPER_ADMIN':
        return '/workspace-selector';

      case 'TRACE_LAB_ANALYST':
        return '/tracelab/overview';

      case 'INVESTIGATOR':
        return '/invospace/overview';

      default:
        return '/login';
    }
  };

  const handleRedirect = (user) => {
    navigate(getRedirectPath(user.role), {
      replace: true
    });
  };

  // Already authenticated
  if (isAuthenticated) {
    return (
      <Navigate
        to={getRedirectPath(role)}
        replace
      />
    );
  }

  // Login
  const submitLogin = async (event) => {
    event.preventDefault();

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const user = await login(username, password);

      if (
        user.role !== selectedRole &&
        !(
          selectedRole === 'CLIENT' &&
          user.role === 'CLIENT_USER'
        )
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

      setError(
        typeof message === 'string'
          ? message
          : JSON.stringify(message)
      );

    } finally {
      setLoading(false);
    }
  };

  // Client registration
  const submitSignup = async (event) => {
    event.preventDefault();

    setError('');
    setSuccessMsg('');

    // Password validation
    if (
      registerData.password !==
      registerData.confirm_password
    ) {
      setError('Passwords do not match');
      return;
    }

    // Password length
    if (registerData.password.length < 8) {
      setError(
        'Password must be at least 8 characters long'
      );
      return;
    }

    setLoading(true);

    try {
      // Send only required registration fields
      const payload = {
        org_name: registerData.org_name.trim(),
        org_type: registerData.org_type,
        registration_number:
          registerData.registration_number.trim(),
        contact_person:
          registerData.contact_person.trim(),
        org_email:
          registerData.org_email.trim(),
        phone: registerData.phone.trim(),
        password: registerData.password,
        confirm_password:
          registerData.confirm_password
      };

      console.log(
        'CLIENT REGISTRATION PAYLOAD:',
        payload
      );

      await clientRegister(payload);

      setSuccessMsg(
        'Registration successful! Your organization is pending admin approval.'
      );

      // Move to login
      setActiveTab('login');

      // Use organization email as login username
      setUsername(registerData.org_email.split('@')[0]);

      setPassword('');

      // Select client role
      setSelectedRole('CLIENT');

      // Clear registration form
      setRegisterData({
        org_name: '',
        org_type: 'Bank',
        registration_number: '',
        contact_person: '',
        org_email: '',
        phone: '',
        password: '',
        confirm_password: ''
      });

    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed';

      setError(
        typeof message === 'string'
          ? message
          : JSON.stringify(message)
      );

    } finally {
      setLoading(false);
    }
  };

  const currentRoleColor =
    ROLES.find(
      (r) => r.value === selectedRole
    )?.color || '#4F46E5';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >

      {/* Animated background orb */}
      <div
        style={{
          position: 'absolute',
          top: '-25%',
          left: '-15%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${currentRoleColor}15, transparent 70%)`,
          filter: 'blur(100px)',
          animation:
            'loginOrbFloat 15s ease-in-out infinite alternate',
          transition: 'background 1s ease'
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '-25%',
          right: '-15%',
          width: '55vw',
          height: '55vw',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(124,58,237,0.1), transparent 70%)',
          filter: 'blur(100px)',
          animation:
            'loginOrbFloat 18s ease-in-out infinite alternate-reverse'
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.01) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          zIndex: 0
        }}
      />

      {/* Main container */}
      <Container
        style={{
          maxWidth: '460px',
          position: 'relative',
          zIndex: 10
        }}
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 30,
            scale: 0.95
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          transition={{
            duration: 0.6,
            ease: [0.4, 0, 0.2, 1]
          }}
        >
          <Card
            style={{
              background:
                'rgba(15, 23, 42, 0.85)',
              backdropFilter:
                'blur(30px) saturate(180%)',
              border:
                '1px solid rgba(255,255,255,0.06)',
              borderRadius: '28px',
              boxShadow: `0 40px 80px rgba(0,0,0,0.5), 0 0 60px ${currentRoleColor}08`,
              padding: '2px',
              transition: 'box-shadow 0.5s ease'
            }}
          >
            <Card.Body className="p-4 p-md-5">

              {/* Logo */}
              <motion.div
                className="text-center mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Link
                  to="/"
                  className="text-decoration-none d-inline-flex align-items-center gap-2"
                >
                  <motion.img
                    src={traceAccBadge}
                    alt="TraceAcc"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14
                    }}
                    whileHover={{
                      rotate: 10,
                      scale: 1.1
                    }}
                  />

                  <span
                    style={{
                      fontFamily:
                        'Outfit, sans-serif',
                      fontWeight: 700,
                      fontSize: 28,
                      background:
                        'linear-gradient(135deg, #F9FAFB, #94A3B8)',
                      WebkitBackgroundClip:
                        'text',
                      WebkitTextFillColor:
                        'transparent'
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
                    fontWeight: 500
                  }}
                >
                  AML Operations · Zero Trust · Enterprise
                </div>
              </motion.div>

              {/* Tabs */}
              <Nav
                variant="pills"
                className="justify-content-center mb-4 gap-2"
              >
                {['login', 'signup'].map(
                  (tab) => (
                    <Nav.Item key={tab}>
                      <Nav.Link
                        active={
                          activeTab === tab
                        }
                        onClick={() => {
                          setActiveTab(tab);
                          setError('');
                          setSuccessMsg('');
                        }}
                        style={{
                          background:
                            activeTab === tab
                              ? `linear-gradient(135deg, ${currentRoleColor}, #7C3AED)`
                              : 'transparent',
                          color: '#F8FAFC',
                          border:
                            '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '14px',
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '9px 32px',
                          transition: 'all 0.3s'
                        }}
                      >
                        {tab === 'login'
                          ? 'Sign In'
                          : 'Sign Up'}
                      </Nav.Link>
                    </Nav.Item>
                  )
                )}
              </Nav>

              {/* Messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      height: 0
                    }}
                    animate={{
                      opacity: 1,
                      height: 'auto'
                    }}
                    exit={{
                      opacity: 0,
                      height: 0
                    }}
                  >
                    <Alert
                      variant="danger"
                      className="py-2 small"
                      style={{
                        background:
                          'rgba(239, 68, 68, 0.08)',
                        border:
                          '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#FCA5A5',
                        borderRadius: 14,
                        fontSize: 13
                      }}
                    >
                      {error}
                    </Alert>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      height: 0
                    }}
                    animate={{
                      opacity: 1,
                      height: 'auto'
                    }}
                    exit={{
                      opacity: 0,
                      height: 0
                    }}
                  >
                    <Alert
                      variant="success"
                      className="py-2 small"
                      style={{
                        background:
                          'rgba(16, 185, 129, 0.08)',
                        border:
                          '1px solid rgba(16, 185, 129, 0.12)',
                        color: '#34D399',
                        borderRadius: 14,
                        fontSize: 13
                      }}
                    >
                      {successMsg}
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ================= LOGIN ================= */}
              <AnimatePresence mode="wait">
                {activeTab === 'login' && (
                  <motion.div
                    key="login"
                    initial={{
                      opacity: 0,
                      x: -20
                    }}
                    animate={{
                      opacity: 1,
                      x: 0
                    }}
                    exit={{
                      opacity: 0,
                      x: 20
                    }}
                    transition={{
                      duration: 0.3
                    }}
                  >
                    <Form
                      id="loginForm"
                      onSubmit={submitLogin}
                    >

                      {/* Role selector */}
                      <Form.Group className="mb-3">
                        <Form.Label
                          style={labelStyle}
                        >
                          Your Role
                        </Form.Label>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(4, 1fr)',
                            gap: 8
                          }}
                        >
                          {ROLES.map((r) => (
                            <motion.button
                              key={r.value}
                              type="button"
                              whileHover={{
                                scale: 1.05
                              }}
                              whileTap={{
                                scale: 0.95
                              }}
                              onClick={() =>
                                setSelectedRole(
                                  r.value
                                )
                              }
                              style={{
                                background:
                                  selectedRole ===
                                    r.value
                                    ? `${r.color}20`
                                    : 'rgba(255,255,255,0.03)',
                                border:
                                  selectedRole ===
                                    r.value
                                    ? `2px solid ${r.color}60`
                                    : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 14,
                                padding:
                                  '12px 4px',
                                color:
                                  selectedRole ===
                                    r.value
                                    ? r.color
                                    : '#94A3B8',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection:
                                  'column',
                                alignItems:
                                  'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                transition:
                                  'all 0.3s'
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 20
                                }}
                              >
                                {r.icon}
                              </span>

                              {r.label}
                            </motion.button>
                          ))}
                        </div>
                      </Form.Group>

                      {/* Username */}
                      <Form.Group className="mb-3">
                        <Form.Label
                          style={labelStyle}
                        >
                          Username / Email
                        </Form.Label>

                        <Form.Control
                          type="text"
                          placeholder="Enter your username"
                          value={username}
                          onChange={(e) =>
                            setUsername(
                              e.target.value
                            )
                          }
                          style={inputStyle}
                          required
                          autoFocus
                        />
                      </Form.Group>

                      {/* Password */}
                      <Form.Group className="mb-3">
                        <Form.Label
                          style={labelStyle}
                        >
                          Password
                        </Form.Label>

                        <InputGroup>
                          <Form.Control
                            type={
                              showPassword
                                ? 'text'
                                : 'password'
                            }
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) =>
                              setPassword(
                                e.target.value
                              )
                            }
                            style={{
                              ...inputStyle,
                              borderRadius:
                                '14px 0 0 14px'
                            }}
                            required
                          />

                          <Button
                            variant="outline-secondary"
                            type="button"
                            onClick={() =>
                              setShowPassword(
                                !showPassword
                              )
                            }
                            style={{
                              background:
                                'rgba(255,255,255,0.04)',
                              border:
                                '1px solid rgba(255,255,255,0.08)',
                              color: '#94A3B8',
                              borderRadius:
                                '0 14px 14px 0',
                              padding: '0 16px'
                            }}
                          >
                            {showPassword
                              ? '🙈'
                              : '👁️'}
                          </Button>
                        </InputGroup>

                        <div className="d-flex justify-content-between align-items-center mt-2">
                          <Form.Check
                            type="checkbox"
                            label="Remember me"
                            checked={
                              rememberMe
                            }
                            onChange={(e) =>
                              setRememberMe(
                                e.target.checked
                              )
                            }
                            style={{
                              color: '#64748B',
                              fontSize: 12
                            }}
                          />

                          <Link
                            to="#"
                            style={{
                              color: '#60A5FA',
                              fontSize: 12,
                              textDecoration:
                                'none'
                            }}
                          >
                            Forgot password?
                          </Link>
                        </div>
                      </Form.Group>

                      <motion.div
                        whileHover={{
                          scale: 1.01
                        }}
                        whileTap={{
                          scale: 0.98
                        }}
                      >
                        <Button
                          type="submit"
                          disabled={loading}
                          style={{
                            width: '100%',
                            padding: '14px',
                            background:
                              `linear-gradient(135deg, ${currentRoleColor}, #7C3AED)`,
                            border: 'none',
                            borderRadius: 14,
                            fontWeight: 700,
                            fontSize: 15,
                            boxShadow:
                              `0 8px 30px ${currentRoleColor}30`,
                            transition:
                              'all 0.3s'
                          }}
                        >
                          {loading ? (
                            <Spinner
                              animation="border"
                              size="sm"
                            />
                          ) : (
                            'Sign In →'
                          )}
                        </Button>
                      </motion.div>

                    </Form>
                  </motion.div>
                )}

                {/* ================= SIGNUP ================= */}
                {activeTab === 'signup' && (
                  <motion.div
                    key="signup"
                    initial={{
                      opacity: 0,
                      x: 20
                    }}
                    animate={{
                      opacity: 1,
                      x: 0
                    }}
                    exit={{
                      opacity: 0,
                      x: -20
                    }}
                    transition={{
                      duration: 0.3
                    }}
                  >
                    <Form
                      onSubmit={submitSignup}
                    >

                      {/* Header */}
                      <div
                        style={{
                          padding:
                            '12px 16px',
                          marginBottom: 20,
                          borderRadius: 14,
                          background:
                            'rgba(16, 185, 129, 0.06)',
                          border:
                            '1px solid rgba(16, 185, 129, 0.12)'
                        }}
                      >
                        <div
                          style={{
                            color: '#34D399',
                            fontSize: 12,
                            fontWeight: 700
                          }}
                        >
                          📋 Client Registration
                        </div>

                        <div
                          style={{
                            color: '#6EE7B7',
                            fontSize: 11,
                            marginTop: 2
                          }}
                        >
                          Only clients can self-register.
                          Other roles are provisioned by an Admin.
                        </div>
                      </div>

                      {/* Organization */}
                      <h6
                        style={{
                          color: '#10B981',
                          fontSize: 13,
                          marginBottom: 15
                        }}
                      >
                        Organization Details
                      </h6>

                      <Row>

                        <Col md={8}>
                          <Form.Group className="mb-3">
                            <Form.Label
                              style={labelStyle}
                            >
                              Organization Name *
                            </Form.Label>

                            <Form.Control
                              type="text"
                              name="org_name"
                              placeholder="ABC Financial Services"
                              style={inputStyle}
                              required
                              value={
                                registerData.org_name
                              }
                              onChange={
                                handleRegisterChange
                              }
                            />
                          </Form.Group>
                        </Col>

                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label
                              style={labelStyle}
                            >
                              Type *
                            </Form.Label>

                            <Form.Select
                              name="org_type"
                              style={inputStyle}
                              required
                              value={
                                registerData.org_type
                              }
                              onChange={
                                handleRegisterChange
                              }
                            >
                              <option value="Bank">
                                Bank
                              </option>

                              <option value="FinTech">
                                FinTech
                              </option>

                              <option value="Company">
                                Company
                              </option>

                              <option value="General Business">
                                General Business
                              </option>
                            </Form.Select>
                          </Form.Group>
                        </Col>

                      </Row>

                      <Form.Group className="mb-4">
                        <Form.Label
                          style={labelStyle}
                        >
                          Registration Number
                        </Form.Label>

                        <Form.Control
                          type="text"
                          name="registration_number"
                          placeholder="U65990KA2021PTC123456"
                          style={inputStyle}
                          value={
                            registerData.registration_number
                          }
                          onChange={
                            handleRegisterChange
                          }
                        />
                      </Form.Group>

                      {/* Contact */}
                      <h6
                        style={{
                          color: '#10B981',
                          fontSize: 13,
                          marginBottom: 15
                        }}
                      >
                        Primary Contact
                      </h6>

                      <Row>

                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label
                              style={labelStyle}
                            >
                              Contact Person *
                            </Form.Label>

                            <Form.Control
                              type="text"
                              name="contact_person"
                              placeholder="Rahul Sharma"
                              style={inputStyle}
                              required
                              value={
                                registerData.contact_person
                              }
                              onChange={
                                handleRegisterChange
                              }
                            />
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label
                              style={labelStyle}
                            >
                              Phone *
                            </Form.Label>

                            <Form.Control
                              type="tel"
                              name="phone"
                              placeholder="+919876543210"
                              style={inputStyle}
                              required
                              value={
                                registerData.phone
                              }
                              onChange={
                                handleRegisterChange
                              }
                            />
                          </Form.Group>
                        </Col>

                      </Row>

                      <Form.Group className="mb-4">
                        <Form.Label
                          style={labelStyle}
                        >
                          Organization Email *
                        </Form.Label>

                        <Form.Control
                          type="email"
                          name="org_email"
                          placeholder="compliance@company.com"
                          style={inputStyle}
                          required
                          value={
                            registerData.org_email
                          }
                          onChange={
                            handleRegisterChange
                          }
                        />

                        <div
                          style={{
                            color: '#64748B',
                            fontSize: 10,
                            marginTop: 5
                          }}
                        >
                          This email will also be used
                          for the client account login.
                        </div>
                      </Form.Group>

                      {/* Security */}
                      <h6
                        style={{
                          color: '#10B981',
                          fontSize: 13,
                          marginBottom: 15
                        }}
                      >
                        Account Security
                      </h6>

                      <Row>

                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label
                              style={labelStyle}
                            >
                              Password *
                            </Form.Label>

                            <Form.Control
                              type="password"
                              name="password"
                              placeholder="Minimum 8 characters"
                              style={inputStyle}
                              required
                              minLength={8}
                              value={
                                registerData.password
                              }
                              onChange={
                                handleRegisterChange
                              }
                            />
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Form.Group className="mb-4">
                            <Form.Label
                              style={labelStyle}
                            >
                              Confirm Password *
                            </Form.Label>

                            <Form.Control
                              type="password"
                              name="confirm_password"
                              placeholder="Re-enter password"
                              style={inputStyle}
                              required
                              minLength={8}
                              value={
                                registerData.confirm_password
                              }
                              onChange={
                                handleRegisterChange
                              }
                            />
                          </Form.Group>
                        </Col>

                      </Row>

                      {/* Submit */}
                      <motion.div
                        whileHover={{
                          scale: 1.01
                        }}
                        whileTap={{
                          scale: 0.98
                        }}
                      >
                        <Button
                          type="submit"
                          disabled={loading}
                          style={{
                            width: '100%',
                            padding: '14px',
                            background:
                              'linear-gradient(135deg, #10B981, #059669)',
                            border: 'none',
                            borderRadius: 14,
                            fontWeight: 700,
                            fontSize: 15,
                            boxShadow:
                              '0 8px 30px rgba(16,185,129,0.2)'
                          }}
                        >
                          {loading ? (
                            <Spinner
                              animation="border"
                              size="sm"
                            />
                          ) : (
                            'Create Client Account →'
                          )}
                        </Button>
                      </motion.div>

                    </Form>
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Footer */}
              <div className="text-center mt-4">

                <Link
                  to="/"
                  style={{
                    color: '#475569',
                    fontSize: 12,
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) =>
                  (e.target.style.color =
                    '#94A3B8')
                  }
                  onMouseLeave={(e) =>
                  (e.target.style.color =
                    '#475569')
                  }
                >
                  ← Back to Landing Page
                </Link>

              </div>

            </Card.Body>
          </Card>
        </motion.div>
      </Container>

      {/* Styles */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

          @keyframes loginOrbFloat {
            0% {
              transform: translate(0, 0) scale(1);
            }

            100% {
              transform: translate(30px, -30px) scale(1.15);
            }
          }

          .form-control:focus {
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
            border-color: rgba(79, 70, 229, 0.4) !important;
            background: rgba(255,255,255,0.07) !important;
          }

          .form-select:focus {
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
            border-color: rgba(79, 70, 229, 0.4) !important;
            background: rgba(255,255,255,0.07) !important;
          }

          .btn:focus {
            box-shadow: none;
          }

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