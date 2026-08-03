import React, { useState } from 'react';
import { Form, Alert, Spinner } from 'react-bootstrap';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/landing.css';

const LoginCard = () => {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'CLIENT_USER') {
        navigate('/client-dashboard', { replace: true });
      } else {
        navigate('/overview', { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Something went wrong';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // 3D Mouse Movement effect on card
  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;
  };

  const handleMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
  };

  return (
    <div className="landing-shell d-flex align-items-center justify-content-center min-vh-100 position-relative py-5">
      {/* Dynamic Background Elements */}
      <div className="bg-grid"></div>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      <div 
        className="login-card-3d-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ zIndex: 10, width: '100%', maxWidth: '440px', padding: '0 20px' }}
      >
        <div className="login-card-inner">
          {/* Logo Branding Header */}
          <div className="text-center mb-4">
            <Link to="/" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
              <div className="logo-icon fs-2">⬡</div>
              <span className="logo-text text-light fs-3">TraceAcc</span>
              <span className="logo-version-tag ms-1">v3.0</span>
            </Link>
            <p className="text-secondary small mb-0">Graph-Based Financial Fraud Intelligence</p>
          </div>

          {error && <Alert variant="danger" className="py-2 small bg-danger bg-opacity-20 text-danger border-danger border-opacity-30">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="username">
              <Form.Label className="small text-secondary fw-semibold">USERNAME</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter analyst username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="custom-glass-input"
                minLength={3}
                required
              />
            </Form.Group>
            <Form.Group className="mb-4" controlId="password">
              <Form.Label className="small text-secondary fw-semibold">PASSWORD</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="custom-glass-input"
                minLength={8}
                required
              />
            </Form.Group>

            <button type="submit" className="btn-glow w-100 py-3 justify-content-center mb-4" disabled={loading}>
              {loading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <span>Sign In to TraceAcc</span>
              )}
            </button>
          </Form>

          {/* Quick Demo Login */}
          <div className="text-center mt-2 border-top border-white border-opacity-10 pt-3">
            <span className="text-secondary small fw-semibold d-block mb-3">QUICK TEST LOGIN</span>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              <button 
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => { setUsername('client'); setPassword('Password123!'); }}
              >
                Client
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-info"
                onClick={() => { setUsername('analyst'); setPassword('Password123!'); }}
              >
                Analyst
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={() => { setUsername('investigator'); setPassword('Password123!'); }}
              >
                Investigator
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => { setUsername('auditor'); setPassword('Password123!'); }}
              >
                Auditor
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => { setUsername('admin'); setPassword('Password123!'); }}
              >
                Admin
              </button>
            </div>
            <div className="small text-muted mt-2" style={{ fontSize: '11px' }}>
              Click a role above, then click Sign In
            </div>
          </div>

          <div className="text-center mt-3 pt-3 border-top border-white border-opacity-10">
            <Link to="/" className="text-secondary small text-decoration-none hover-blue">
              ← Return to TraceAcc Landing Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginCard;