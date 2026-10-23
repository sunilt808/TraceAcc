import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import {
  Table,
  Spinner,
  Card,
  Badge,
  Form,
  Button,
  Modal,
  Row,
  Col,
  Alert,
} from 'react-bootstrap';
import {
  Users,
  Plus,
  RotateCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Shield,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'CLIENT_USER',
    organization_id: '',
  });

  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await adminAPI.listUsers();
      setUsers(data.items || []);
    } catch (err) {
      console.error('Failed to load users', err);
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (currentUser?.role === 'ADMIN') {
      adminAPI
        .listOrganizations()
        .then((data) => {
          const items = data.items || data || [];
          setOrgs(items.filter((o) => o.status === 'APPROVED'));
        })
        .catch(() => {});
    }
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminAPI.updateUser(userId, { role: newRole });
      setSuccess('User role updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update role', err);
      setError(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await adminAPI.updateUser(userId, { is_active: isActive });
      setSuccess(`User account ${isActive ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update status', err);
      setError(err.response?.data?.detail || 'Failed to update user status');
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await adminAPI.deleteUser(userToDelete.id);
      setUserToDelete(null);
      setSuccess('User account removed.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user', err);
      setError(err.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const payload = { ...newUser };
      if (payload.organization_id) {
        payload.organization_id = parseInt(payload.organization_id, 10);
      } else {
        delete payload.organization_id;
      }

      await adminAPI.createUser(payload);
      setShowCreateModal(false);
      setSuccess(`User "${newUser.username}" created successfully.`);
      setTimeout(() => setSuccess(null), 3500);

      setNewUser({
        username: '',
        email: '',
        phone: '',
        password: '',
        role: 'CLIENT_USER',
        organization_id: '',
      });

      await fetchUsers();
    } catch (err) {
      console.error('Failed to create user', err);
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.is_active).length;
  const clientUsers = users.filter((user) => user.role === 'CLIENT_USER' || user.role === 'CLIENT').length;
  const internalUsers = users.filter(
    (user) => user.role === 'ADMIN' || user.role === 'TRACE_LAB_ANALYST' || user.role === 'INVESTIGATOR'
  ).length;

  const darkCardStyle = {
    backgroundColor: '#0d1117',
    borderColor: '#21262d',
  };

  const cellStyle = {
    backgroundColor: '#0d1117',
    borderColor: '#21262d',
    color: '#c9d1d9',
  };

  return (
    <AppLayout
      title="Credential Manager"
       >
      {/* Header Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="text-white mb-1">User Management</h4>
          <div className="text-secondary small">Admin-controlled account provisioning and role assignments</div>
        </div>

        <Button
          variant="primary"
          className="d-flex align-items-center gap-1.5 px-3"
          onClick={() => {
            setError(null);
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} />
          <span>Create User</span>
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError(null)}
          className="bg-danger bg-opacity-10 border-danger text-danger mb-4"
        >
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSuccess(null)}
          className="bg-success bg-opacity-10 border-success text-success mb-4"
        >
          <div className="d-flex align-items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        </Alert>
      )}

      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Total Users</div>
              <div className="display-6 text-white fw-bold mt-1">{totalUsers}</div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Active Users</div>
              <div className="display-6 text-success fw-bold mt-1">{activeUsers}</div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Client Accounts</div>
              <div className="display-6 text-info fw-bold mt-1">{clientUsers}</div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Internal Team</div>
              <div className="display-6 text-warning fw-bold mt-1">{internalUsers}</div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Users Table Card */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Header
          className="py-3 d-flex justify-content-between align-items-center"
          style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}
        >
          <div>
            <h5 className="text-white mb-1">System Users</h5>
            <div className="text-secondary small">Roles and account statuses managed by Admin</div>
          </div>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
            className="d-flex align-items-center gap-1.5"
            style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        </Card.Header>

        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>
          {loading ? (
            <div className="py-5 text-center">
              <Spinner animation="border" variant="info" />
              <div className="text-secondary mt-3">Loading users...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="py-5 text-center text-secondary">
              <Users size={48} className="text-secondary opacity-50 mb-3" />
              <h5 className="text-white">No users found</h5>
              <p className="text-secondary mb-3">Create the first user account to get started.</p>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} className="me-1" /> Create User
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle" style={{ borderColor: '#21262d' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <th className="ps-4 py-3" style={cellStyle}>User</th>
                    <th className="py-3" style={cellStyle}>Contact</th>
                    <th className="py-3" style={cellStyle}>Role</th>
                    <th className="py-3" style={cellStyle}>Status</th>
                    <th className="py-3 text-end pe-4" style={cellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      {/* User */}
                      <td className="ps-4" style={cellStyle}>
                        <div className="fw-semibold text-white">{u.username}</div>
                        <div className="text-secondary small">ID: #{u.id}</div>
                      </td>

                      {/* Contact */}
                      <td style={cellStyle}>
                        <div className="text-light small">{u.email || 'No email'}</div>
                        <div className="text-secondary small">{u.phone || 'No phone'}</div>
                      </td>

                      {/* Role */}
                      <td style={cellStyle}>
                        <Form.Select
                          size="sm"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{
                            backgroundColor: '#010409',
                            borderColor: '#30363d',
                            color: '#c9d1d9',
                            width: '180px',
                          }}
                          disabled={u.id === currentUser?.id}
                        >
                          <option value="CLIENT_USER" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                            Client
                          </option>
                          <option value="TRACE_LAB_ANALYST" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                            TraceLab Analyst
                          </option>
                          <option value="INVESTIGATOR" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                            Investigator
                          </option>
                          <option value="ADMIN" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                            Admin
                          </option>
                        </Form.Select>
                      </td>

                      {/* Status */}
                      <td style={cellStyle}>
                        <Form.Check
                          type="switch"
                          id={`switch-${u.id}`}
                          checked={Boolean(u.is_active)}
                          onChange={(e) => handleStatusChange(u.id, e.target.checked)}
                          label={
                            u.is_active ? (
                              <Badge bg="success">Active</Badge>
                            ) : (
                              <Badge bg="danger">Disabled</Badge>
                            )
                          }
                          disabled={u.id === currentUser?.id}
                        />
                      </td>

                      {/* Actions */}
                      <td className="text-end pe-4" style={cellStyle}>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => setUserToDelete(u)}
                          disabled={u.id === currentUser?.id}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Delete User Confirmation Modal */}
      <Modal
        show={Boolean(userToDelete)}
        onHide={() => !deleteLoading && setUserToDelete(null)}
        centered
        contentClassName="text-light shadow-lg"
      >
        <div style={{ backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
          <Modal.Header closeButton closeVariant="white" style={{ borderColor: '#21262d' }}>
            <Modal.Title className="text-danger fs-6 fw-bold d-flex align-items-center gap-2">
              <Trash2 size={18} /> Confirm User Deletion
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ backgroundColor: '#0d1117' }}>
            <p className="text-secondary mb-0">
              Are you sure you want to delete user <strong className="text-white">{userToDelete?.username}</strong> (#{userToDelete?.id})? This action cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer style={{ borderColor: '#21262d' }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setUserToDelete(null)}
              disabled={deleteLoading}
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Spinner size="sm" animation="border" className="me-1" /> : null}
              Delete User
            </Button>
          </Modal.Footer>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal
        show={showCreateModal}
        onHide={() => !createLoading && setShowCreateModal(false)}
        centered
        contentClassName="text-light shadow-lg"
      >
        <div style={{ backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
          <Modal.Header closeButton closeVariant="white" style={{ borderColor: '#21262d' }}>
            <Modal.Title className="text-white fs-6 fw-bold">Create New User</Modal.Title>
          </Modal.Header>

          <Form onSubmit={handleCreateUser}>
            <Modal.Body style={{ backgroundColor: '#0d1117' }}>
              <div className="mb-4">
                <div className="text-info fw-semibold mb-1">Admin Account Provisioning</div>
                <div className="text-secondary small">Create an account and assign its operational role.</div>
              </div>

              {/* Username */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light fw-semibold">Username *</Form.Label>
                <Form.Control
                  type="text"
                  required
                  placeholder="Enter username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="text-white"
                  style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
                />
              </Form.Group>

              {/* Email + Phone */}
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="text-light fw-semibold">Email</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="user@company.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="text-white"
                      style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="text-light fw-semibold">Phone</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Phone number"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      className="text-white"
                      style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Password */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light fw-semibold">Password *</Form.Label>
                <Form.Control
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 chars, 1 letter + 1 digit"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="text-white"
                  style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
                />
              </Form.Group>

              {/* Organization */}
              {currentUser?.role === 'ADMIN' && (
                <Form.Group className="mb-3">
                  <Form.Label className="text-light fw-semibold">Organization</Form.Label>
                  <Form.Select
                    value={newUser.organization_id}
                    onChange={(e) => setNewUser({ ...newUser, organization_id: e.target.value })}
                    style={{
                      backgroundColor: '#010409',
                      color: '#c9d1d9',
                      borderColor: '#30363d',
                    }}
                  >
                    <option value="" style={{ backgroundColor: '#010409' }}>
                      Default to my organization
                    </option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id} style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                        {org.name} (#{org.id})
                      </option>
                    ))}
                  </Form.Select>
                  <div className="text-secondary small mt-1">
                    Optional. If left empty, the user joins your default organization.
                  </div>
                </Form.Group>
              )}

              {/* Role */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light fw-semibold">Operational Role *</Form.Label>
                <Form.Select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  style={{
                    backgroundColor: '#010409',
                    borderColor: '#30363d',
                    color: '#c9d1d9',
                  }}
                >
                  <option value="CLIENT_USER" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                    Client
                  </option>
                  <option value="TRACE_LAB_ANALYST" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                    TraceLab Analyst
                  </option>
                  <option value="INVESTIGATOR" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                    Investigator
                  </option>
                  <option value="ADMIN" style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                    Admin
                  </option>
                </Form.Select>
              </Form.Group>
            </Modal.Body>

            <Modal.Footer style={{ borderColor: '#21262d' }}>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
                style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={createLoading || !newUser.username.trim() || !newUser.password}
              >
                {createLoading ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                Create User
              </Button>
            </Modal.Footer>
          </Form>
        </div>
      </Modal>
    </AppLayout>
  );
}

export default AdminUsersPage;