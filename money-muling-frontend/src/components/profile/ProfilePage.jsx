import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Failed to change password';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="min-vh-100 bg-darker py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          {/* Back to Dashboard */}
          <Button
            variant="outline-secondary"
            size="sm"
            className="mb-3"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </Button>

          {/* Profile Info Card */}
          <Card className="bg-dark text-light border-secondary mb-4">
            <Card.Header className="border-secondary">
              <h5 className="mb-0">Profile Information</h5>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3">
                <Col sm={4} className="text-muted">User ID</Col>
                <Col sm={8}>{user?.id}</Col>
              </Row>
              <Row className="mb-3">
                <Col sm={4} className="text-muted">Username</Col>
                <Col sm={8}>{user?.username}</Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Change Password Card */}
          <Card className="bg-dark text-light border-secondary mb-4">
            <Card.Header className="border-secondary">
              <h5 className="mb-0">Change Password</h5>
            </Card.Header>
            <Card.Body>
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}

              <Form onSubmit={handlePasswordChange}>
                <Form.Group className="mb-3" controlId="currentPassword">
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-dark text-light border-secondary"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="newPassword">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter new password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-dark text-light border-secondary"
                    minLength={8}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-4" controlId="confirmPassword">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-dark text-light border-secondary"
                    minLength={8}
                    required
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  className="w-100"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Change Password'}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {/* Account Actions Card */}
          <Card className="bg-dark text-light border-secondary mb-4">
            <Card.Header className="border-secondary">
              <h5 className="mb-0">Account</h5>
            </Card.Header>
            <Card.Body>
              <Button 
                variant="outline-info" 
                onClick={() => navigate('/audit-history')} 
                className="w-100 mb-3"
              >
                📋 View Audit History
              </Button>
              <Button variant="outline-danger" onClick={logout} className="w-100">
                Logout
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfilePage;
