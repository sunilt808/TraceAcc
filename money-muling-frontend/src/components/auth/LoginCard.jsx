import React, { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../assets/landing.css';

const workspaceCopy = [
  'Admin is the only communication hub',
  'TraceLab handles technical analysis',
  'InvoSpace owns investigations',
  'Clients receive only approved reports',
];

function LoginCard() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        <Row className="align-items-stretch g-4">
          <Col lg={7} className="d-flex">
            <Card className="w-100 bg-transparent border-0 shadow-none text-light h-100">
              <Card.Body className="p-0 d-flex flex-column justify-content-center pe-lg-4">
                <Badge bg="info" className="align-self-start mb-3 text-dark">TraceAcc</Badge>
                <h1 className="display-4 fw-bold mb-3 text-light" style={{ maxWidth: '12ch' }}>
                  Secure access to TraceAcc.
                </h1>
                <p className="lead text-secondary mb-4" style={{ maxWidth: '54ch' }}>
                  Admin owns communication. TraceLab finds suspicious activity. InvoSpace investigates it. Clients only receive approved reports.
                </p>

                <div className="d-grid gap-3 mb-4">
                  {workspaceCopy.map((line) => (
                    <div key={line} className="d-flex align-items-center gap-3 text-light">
                      <span className="badge rounded-pill bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25">•</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <Badge bg="success">Workflow Timeline</Badge>
                  <Badge bg="secondary">Request Queue</Badge>
                  <Badge bg="warning" text="dark">Report Review</Badge>
                  <Badge bg="danger">Client Release</Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5} className="d-flex">
            <Card className="login-panel w-100 border-0 shadow-lg bg-dark bg-opacity-75 text-light">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <Link to="/" className="text-decoration-none d-inline-flex align-items-center gap-2 mb-2">
                    <span className="logo-icon fs-2">⬡</span>
                    <span className="logo-text text-light fs-3">TraceAcc</span>
                    <span className="logo-version-tag">Enterprise AML</span>
                  </Link>
                  <div className="text-muted small">Enterprise AML Operations Sign In</div>
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
                    <Form.Control
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="custom-glass-input"
                      autoComplete="current-password"
                      required
                    />
                  </Form.Group>

                  <Button type="submit" className="btn-glow w-100 py-3 mb-3 justify-content-center" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
                  </Button>
                </Form>

                <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('client'); setPassword('Password123!'); }}>Client</Button>
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('analyst'); setPassword('Password123!'); }}>TraceLab</Button>
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('investigator'); setPassword('Password123!'); }}>InvoSpace</Button>
                  <Button size="sm" variant="outline-info" onClick={() => { setUsername('admin'); setPassword('Password123!'); }}>Admin</Button>
                </div>

                <div className="text-center text-muted small">
                  Demo users are seeded with the shared password: Password123!.
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
