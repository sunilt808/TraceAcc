import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Card, Badge, Form, Button, Modal, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';

function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'CLIENT'
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.listUsers();
      setUsers(data.items || []);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminAPI.updateUser(userId, { role: newRole });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update role', err);
      alert('Failed to update user role');
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await adminAPI.updateUser(userId, { is_active: isActive });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      await adminAPI.deleteUser(userId);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);
    try {
      await adminAPI.createUser(newUser);
      setShowCreateModal(false);
      setNewUser({ username: '', email: '', phone: '', password: '', role: 'CLIENT' });
      fetchUsers();
    } catch (err) {
      console.error('Failed to create user', err);
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <AppLayout title="Credential Manager" subtitle="Manage system access, roles, and user details">
      <div className="d-flex justify-content-end mb-3">
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + Create New User
        </Button>
      </div>

      <Card className="bg-dark border-secondary shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center"><Spinner animation="border" variant="primary" /></div>
          ) : (
            <Table hover responsive className="mb-0 align-middle text-light border-secondary">
              <thead>
                <tr className="text-muted bg-darker">
                  <th className="ps-4 border-secondary fw-medium">User</th>
                  <th className="border-secondary fw-medium">Contact</th>
                  <th className="border-secondary fw-medium">Role</th>
                  <th className="border-secondary fw-medium">Status</th>
                  <th className="border-secondary fw-medium text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="ps-4 border-secondary fw-medium">
                      {u.username}
                      <div className="text-muted small fw-normal">ID: {u.id}</div>
                    </td>
                    <td className="border-secondary">
                      <div className="text-light small">{u.email || 'No email'}</div>
                      <div className="text-muted small">{u.phone || 'No phone'}</div>
                    </td>
                    <td className="border-secondary">
                      <Form.Select 
                        size="sm"
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-darker text-light border-secondary w-auto d-inline-block"
                        disabled={u.id === currentUser?.id}
                      >
                        <option value="CLIENT">Client</option>
                        <option value="TRACE_LAB_ANALYST">TraceLab Analyst</option>
                        <option value="INVESTIGATOR">Investigator</option>
                        <option value="ADMIN">Admin</option>
                        {currentUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                      </Form.Select>
                    </td>
                    <td className="border-secondary">
                      <Form.Check 
                        type="switch"
                        id={`switch-${u.id}`}
                        checked={u.is_active}
                        onChange={(e) => handleStatusChange(u.id, e.target.checked)}
                        label={u.is_active ? <Badge bg="success">Active</Badge> : <Badge bg="danger">Disabled</Badge>}
                        disabled={u.id === currentUser?.id}
                      />
                    </td>
                    <td className="border-secondary text-end pe-4">
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === currentUser?.id}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered contentClassName="bg-dark text-light border-secondary">
        <Modal.Header closeButton closeVariant="white" className="border-secondary">
          <Modal.Title>Create New User</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateUser}>
          <Modal.Body>
            {error && <div className="alert alert-danger p-2 small mb-3">{error}</div>}
            
            <Form.Group className="mb-3">
              <Form.Label>Username *</Form.Label>
              <Form.Control 
                type="text" 
                required 
                value={newUser.username} 
                onChange={e => setNewUser({...newUser, username: e.target.value})} 
                className="bg-darker text-light border-secondary"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control 
                    type="email" 
                    value={newUser.email} 
                    onChange={e => setNewUser({...newUser, email: e.target.value})} 
                    className="bg-darker text-light border-secondary"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={newUser.phone} 
                    onChange={e => setNewUser({...newUser, phone: e.target.value})} 
                    className="bg-darker text-light border-secondary"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Password *</Form.Label>
              <Form.Control 
                type="password" 
                required 
                value={newUser.password} 
                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                className="bg-darker text-light border-secondary"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Role *</Form.Label>
              <Form.Select 
                value={newUser.role} 
                onChange={e => setNewUser({...newUser, role: e.target.value})}
                className="bg-darker text-light border-secondary"
              >
                <option value="CLIENT">Client</option>
                <option value="TRACE_LAB_ANALYST">TraceLab Analyst</option>
                <option value="INVESTIGATOR">Investigator</option>
                <option value="ADMIN">Admin</option>
              </Form.Select>
            </Form.Group>

          </Modal.Body>
          <Modal.Footer className="border-secondary">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createLoading}>
              {createLoading ? <Spinner size="sm" animation="border" /> : 'Create User'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </AppLayout>
  );
}

export default AdminUsersPage;
