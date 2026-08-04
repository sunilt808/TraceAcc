import React, { useState, useEffect } from 'react';
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

  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaExpected, setCaptchaExpected] = useState(0);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  
  const [step, setStep] = useState('login');
  const [otp, setOtp] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('');
  const [tempUser, setTempUser] = useState(null);

  useEffect(() => {
    generateCaptcha();
  }, []);

  const generateCaptcha = () => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    setCaptchaQuestion(`${a} + ${b} = ?`);
    setCaptchaExpected(a + b);
    setCaptchaAnswer('');
  };

  if (isAuthenticated) {
    if (role === 'CLIENT') return <Navigate to="/client-dashboard" replace />;
    if (role === 'ADMIN') return <Navigate to="/workspace-selector" replace />;
    if (role === 'TRACE_LAB_ANALYST') return <Navigate to="/tracelab/overview" replace />;
    if (role === 'INVESTIGATOR') return <Navigate to="/invospace/overview" replace />;
    return <Navigate to="/login" replace />;
  }

  const handleRedirect = (user) => {
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
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setError('');
    
    if (parseInt(captchaAnswer) !== captchaExpected) {
      setError('Incorrect CAPTCHA answer. Please try again.');
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'CLIENT') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setExpectedOtp(code);
        setTempUser(user);
        setStep('otp');
        window.alert(`[DEMO] Your TraceAcc OTP code is: ${code}`);
      } else {
        handleRedirect(user);
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.message || err.message || 'Sign in failed';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = (event) => {
    event.preventDefault();
    setError('');
    if (otp !== expectedOtp) {
      setError('Invalid OTP code. Please try again.');
      return;
    }
    handleRedirect(tempUser);
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
                  <div className="text-muted small">
                    {step === 'login' ? 'Sign in to access your workspace' : 'Two-Factor Authentication'}
                  </div>
                </div>

                {error && (
                  <Alert variant="danger" className="bg-danger bg-opacity-20 border-danger text-danger small">
                    {error}
                  </Alert>
                )}

                {step === 'login' ? (
                  <Form onSubmit={submitLogin}>
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

                    <Form.Group className="mb-4" controlId="loginCaptcha">
                      <Form.Label className="small text-secondary fw-semibold text-uppercase">Security Check: {captchaQuestion}</Form.Label>
                      <Form.Control
                        type="number"
                        placeholder="Enter the result"
                        value={captchaAnswer}
                        onChange={(event) => setCaptchaAnswer(event.target.value)}
                        className="custom-glass-input"
                        required
                      />
                    </Form.Group>

                    <Button type="submit" className="btn-glow w-100 py-3 mb-3 justify-content-center" disabled={loading}>
                      {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
                    </Button>
                  </Form>
                ) : (
                  <Form onSubmit={submitOtp}>
                    <Form.Group className="mb-4" controlId="loginOtp">
                      <Form.Label className="small text-secondary fw-semibold text-uppercase">Enter 6-digit OTP</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value)}
                        className="custom-glass-input text-center fs-4 letter-spacing-2"
                        maxLength="6"
                        autoComplete="one-time-code"
                        required
                      />
                      <Form.Text className="text-muted small">
                        A demo OTP was shown in a browser alert.
                      </Form.Text>
                    </Form.Group>
                    <Button type="submit" className="btn-glow w-100 py-3 mb-3 justify-content-center" disabled={loading}>
                      {loading ? <Spinner animation="border" size="sm" /> : 'Verify & Continue'}
                    </Button>
                    <div className="text-center">
                      <Button variant="link" className="text-info text-decoration-none small" onClick={() => { setStep('login'); setOtp(''); }} type="button">
                        Back to Login
                      </Button>
                    </div>
                  </Form>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default LoginCard;
