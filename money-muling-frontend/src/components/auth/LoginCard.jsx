import React, { useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner, InputGroup } from 'react-bootstrap';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/landing.css';

function LoginCard() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    if (role === 'CLIENT') return <Navigate to="/client-dashboard" replace />;
    if (role === 'ADMIN') return <Navigate to="/workspace-selector" replace />;
    if (role === 'TRACE_LAB_ANALYST') return <Navigate to="/tracelab/overview" replace />;
    if (role === 'INVESTIGATOR') return <Navigate to="/invospace/overview" replace />;
    return <Navigate to="/login" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'CLIENT') {
        navigate('/client-dashboard', { replace: true });
      } else if (user.role === 'ADMIN') {
        navigate('/workspace-selector', { replace: true });
      } else if (user.role === 'TRACE_LAB_ANALYST') {
        navigate('/tracelab/overview', { replace: true });
      } else if (user.role === 'INVESTIGATOR') {
        navigate('/invospace/overview', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.message || err.message || 'Sign in failed';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-shell min-vh-100 d-flex align-items-center py-4 position-relative">
      <div className="bg-grid" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      <Container className="position-relative" style={{ zIndex: 2 }}>
        <Row className="justify-content-center g-4">
          <Col lg={5} className="d-flex">
            <Card className="login-panel w-100 border-0 shadow-lg bg-dark bg-opacity-75 text-light">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <Link to="/" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
                    <span className="logo-icon fs-2">⬡</span>
                    <span className="logo-text text-light fs-3">TraceAcc</span>
                  </Link>
                  <div className="text-muted small">Sign in to access your workspace</div>
                </div>

                {error && (
                  <Alert variant="danger" className="bg-danger bg-opacity-20 border-danger text-danger small">
                    {error}
                  </Alert>
                )}

                <Form onSubmit={submit}>
                  <Form.Group className="mb-3" controlId="loginUsername">
                    <Form.Label className="small text-secondary fw-semibold text-uppercase">Username</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="custom-glass-input"
                      autoComplete="username"
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-4" controlId="loginPassword">
                    <Form.Label className="small text-secondary fw-semibold text-uppercase">Password</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="custom-glass-input"
                        autoComplete="current-password"
                        required
                      />
                      <Button variant="outline-info" onClick={() => setShowPassword((visible) => !visible)} type="button">
                        {showPassword ? 'Hide' : 'Show'}
                      </Button>
                    </InputGroup>
                  </Form.Group>

                  <Button type="submit" className="btn-glow w-100 py-3 mb-3 justify-content-center" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
                  </Button>
                </Form>

                <div className="d-grid gap-2 mb-3">
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('client'); setPassword('Password123!'); }}>Demo Client</Button>
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('analyst'); setPassword('Password123!'); }}>Demo TraceLab</Button>
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('investigator'); setPassword('Password123!'); }}>Demo InvoSpace</Button>
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('admin'); setPassword('Password123!'); }}>Demo Admin</Button>
                </div>

                <div className="text-center text-muted small">
                  Shared demo password: Password123!.
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default LoginCard;
