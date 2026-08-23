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
import { useAuth } from '../../context/AuthContext';

function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await adminAPI.listUsers();
      setUsers(data.items || []);
    } catch (err) {
      console.error('Failed to load users', err);

      setError(
        err.response?.data?.detail ||
        'Failed to load users'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // Admin provisions operational users into approved organizations;
    // load the org list so the form can offer a target.
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
      await adminAPI.updateUser(userId, {
        role: newRole,
      });

      await fetchUsers();
    } catch (err) {
      console.error('Failed to update role', err);

      setError(
        err.response?.data?.detail ||
        'Failed to update user role'
      );
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await adminAPI.updateUser(userId, {
        is_active: isActive,
      });

      await fetchUsers();
    } catch (err) {
      console.error('Failed to update status', err);

      setError(
        err.response?.data?.detail ||
        'Failed to update user status'
      );
    }
  };

  const handleDeleteUser = async (userId) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this user? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      await adminAPI.deleteUser(userId);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user', err);

      setError(
        err.response?.data?.detail ||
        'Failed to delete user'
      );
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    setCreateLoading(true);
    setError(null);

    try {
      const payload = { ...newUser };
      // Organization is optional: when omitted the backend scopes the new
      // user to the admin's own organization.
      if (payload.organization_id) {
        payload.organization_id = parseInt(payload.organization_id, 10);
      } else {
        delete payload.organization_id;
      }

      await adminAPI.createUser(payload);

      setShowCreateModal(false);

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

      setError(
        err.response?.data?.detail ||
        'Failed to create user'
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const totalUsers = users.length;

  const activeUsers = users.filter(
    (user) => user.is_active
  ).length;

  const clientUsers = users.filter(
    (user) => user.role === 'CLIENT_USER' || user.role === 'CLIENT'
  ).length;

  const internalUsers = users.filter(
    (user) =>
      user.role === 'ADMIN' ||
      user.role === 'TRACE_LAB_ANALYST' ||
      user.role === 'INVESTIGATOR'
  ).length;

  const darkCardStyle = {
    backgroundColor: '#0d1117',
    borderColor: '#21262d',
  };

  return (
    <AppLayout
      title="Credential Manager"
      subtitle="Manage system users, roles, and account access"
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="text-white mb-1">
            User Management
          </h4>

          <div className="text-secondary small">
            Admin-controlled account and access management
          </div>
        </div>

        <Button
          variant="primary"
          className="px-4"
          onClick={() => {
            setError(null);
            setShowCreateModal(true);
          }}
        >
          + Create User
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert
          variant="danger"
          className="bg-danger bg-opacity-10 border-danger text-danger mb-4"
        >
          {error}
        </Alert>
      )}

      {/* Stats */}
      <div className="row g-3 mb-4">

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">
                Total Users
              </div>

              <div className="display-6 text-white fw-bold mt-1">
                {totalUsers}
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">
                Active Users
              </div>

              <div className="display-6 text-success fw-bold mt-1">
                {activeUsers}
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">
                Client Accounts
              </div>

              <div className="display-6 text-info fw-bold mt-1">
                {clientUsers}
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">
                Internal Users
              </div>

              <div className="display-6 text-warning fw-bold mt-1">
                {internalUsers}
              </div>
            </Card.Body>
          </Card>
        </div>

      </div>

      {/* Users Table Card */}
      <Card className="shadow-sm" style={darkCardStyle}>

        <Card.Header className="py-3" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>
          <div className="d-flex justify-content-between align-items-center">

            <div>
              <h5 className="text-white mb-1">
                System Users
              </h5>

              <div className="text-secondary small">
                Roles and account status can be controlled by Admin
              </div>
            </div>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={fetchUsers}
              disabled={loading}
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
            >
              ↻ Refresh
            </Button>

          </div>
        </Card.Header>

        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>

          {loading ? (
            <div className="py-5 text-center">

              <Spinner
                animation="border"
                variant="info"
              />

              <div className="text-secondary mt-3">
                Loading users...
              </div>

            </div>
          ) : users.length === 0 ? (

            <div className="py-5 text-center">

              <div
                style={{
                  fontSize: '42px',
                  opacity: 0.5,
                }}
              >
                👥
              </div>

              <h5 className="text-white mt-3">
                No users found
              </h5>

              <p className="text-secondary">
                Create the first account for this organization.
              </p>

              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Create User
              </Button>

            </div>

          ) : (

            <div className="table-responsive" style={{ backgroundColor: '#0d1117' }}>

              <Table
                hover
                className="mb-0 align-middle"
                style={{
                  backgroundColor: '#0d1117',
                  color: '#c9d1d9',
                  borderColor: '#21262d',
                }}
              >

                <thead>

                  <tr style={{ backgroundColor: '#0d1117', color: '#8b949e', borderBottom: '1px solid #21262d' }}>

                    <th className="ps-4 py-3" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>
                      User
                    </th>

                    <th className="py-3" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>
                      Contact
                    </th>

                    <th className="py-3" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>
                      Role
                    </th>

                    <th className="py-3" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>
                      Status
                    </th>

                    <th className="py-3 text-end pe-4" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {users.map((u) => (

                    <tr key={u.id} style={{ backgroundColor: '#0d1117', color: '#c9d1d9' }}>

                      {/* User */}
                      <td className="ps-4" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>

                        <div className="fw-semibold text-white">
                          {u.username}
                        </div>

                        <div className="text-secondary small">
                          ID: #{u.id}
                        </div>

                      </td>

                      {/* Contact */}
                      <td style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>

                        <div className="text-light small">
                          {u.email || 'No email'}
                        </div>

                        <div className="text-secondary small">
                          {u.phone || 'No phone'}
                        </div>

                      </td>

                      {/* Role */}
                      <td style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>

                        <Form.Select
                          size="sm"
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(
                              u.id,
                              e.target.value
                            )
                          }
                          className="text-light"
                          style={{
                            backgroundColor: '#010409',
                            borderColor: '#30363d',
                            color: '#c9d1d9',
                            width: '190px',
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
                      <td style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>

                        <Form.Check
                          type="switch"
                          id={`switch-${u.id}`}
                          checked={Boolean(u.is_active)}
                          onChange={(e) =>
                            handleStatusChange(
                              u.id,
                              e.target.checked
                            )
                          }
                          label={
                            u.is_active ? (
                              <Badge bg="success">
                                Active
                              </Badge>
                            ) : (
                              <Badge bg="danger">
                                Disabled
                              </Badge>
                            )
                          }
                          disabled={u.id === currentUser?.id}
                        />

                      </td>

                      {/* Actions */}
                      <td className="text-end pe-4" style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>

                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() =>
                            handleDeleteUser(u.id)
                          }
                          disabled={u.id === currentUser?.id}
                        >
                          Delete
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

      {/* Create User Modal */}
      <Modal
        show={showCreateModal}
        onHide={() => {
          if (!createLoading) {
            setShowCreateModal(false);
          }
        }}
        centered
        contentClassName="text-light shadow-lg"
        style={{ color: '#c9d1d9' }}
      >

        <div style={{ backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
          <Modal.Header
            closeButton
            closeVariant="white"
            style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}
          >

            <Modal.Title className="text-white">
              Create New User
            </Modal.Title>

          </Modal.Header>

          <Form onSubmit={handleCreateUser}>

            <Modal.Body style={{ backgroundColor: '#0d1117' }}>

              <div className="mb-4">

                <div className="text-info fw-semibold mb-1">
                  Admin Account Provisioning
                </div>

                <div className="text-secondary small">
                  Create an account and assign its operational role.
                </div>

              </div>

              {error && (
                <Alert
                  variant="danger"
                  className="bg-danger bg-opacity-10 border-danger text-danger"
                >
                  {error}
                </Alert>
              )}

              {/* Username */}
              <Form.Group className="mb-3">

                <Form.Label className="text-light fw-semibold">
                  Username *
                </Form.Label>

                <Form.Control
                  type="text"
                  required
                  placeholder="Enter username"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      username: e.target.value,
                    })
                  }
                  className="text-white"
                  style={{
                    backgroundColor: '#010409',
                    borderColor: '#30363d',
                  }}
                />

              </Form.Group>

              {/* Email + Phone */}
              <Row>

                <Col md={6}>

                  <Form.Group className="mb-3">

                    <Form.Label className="text-light fw-semibold">
                      Email
                    </Form.Label>

                    <Form.Control
                      type="email"
                      placeholder="user@company.com"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          email: e.target.value,
                        })
                      }
                      className="text-white"
                      style={{
                        backgroundColor: '#010409',
                        borderColor: '#30363d',
                      }}
                    />

                  </Form.Group>

                </Col>

                <Col md={6}>

                  <Form.Group className="mb-3">

                    <Form.Label className="text-light fw-semibold">
                      Phone
                    </Form.Label>

                    <Form.Control
                      type="text"
                      placeholder="Phone number"
                      value={newUser.phone}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          phone: e.target.value,
                        })
                      }
                      className="text-white"
                      style={{
                        backgroundColor: '#010409',
                        borderColor: '#30363d',
                      }}
                    />

                  </Form.Group>

                </Col>

              </Row>

              {/* Password */}
              <Form.Group className="mb-3">

                <Form.Label className="text-light fw-semibold">
                  Password *
                </Form.Label>

                <Form.Control
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 chars, 1 letter + 1 digit"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      password: e.target.value,
                    })
                  }
                  className="text-white"
                  style={{
                    backgroundColor: '#010409',
                    borderColor: '#30363d',
                  }}
                />

              </Form.Group>

              {/* Organization (optional — defaults to admin's own org) */}
              {currentUser?.role === 'ADMIN' && (
                <Form.Group className="mb-3">

                  <Form.Label className="text-light fw-semibold">
                    Organization
                  </Form.Label>

                  <Form.Select
                    value={newUser.organization_id}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        organization_id: e.target.value,
                      })
                    }
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
                      <option
                        key={org.id}
                        value={org.id}
                        style={{ backgroundColor: '#010409', color: '#c9d1d9' }}
                      >
                        {org.name} (#{org.id})
                      </option>
                    ))}

                  </Form.Select>

                  <div className="text-secondary small mt-1">
                    Optional. If left empty, the user joins your own organization.
                  </div>

                </Form.Group>
              )}

              {/* Role */}
              <Form.Group className="mb-3">

                <Form.Label className="text-light fw-semibold">
                  Operational Role *
                </Form.Label>

                <Form.Select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      role: e.target.value,
                    })
                  }
                  className="text-white"
                  style={{
                    backgroundColor: '#010409',
                    borderColor: '#30363d',
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

                <Form.Text className="text-secondary">
                  Admin is responsible for provisioning internal accounts.
                </Form.Text>

              </Form.Group>

            </Modal.Body>

            <Modal.Footer style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}>

              <Button
                variant="outline-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
                style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                type="submit"
                disabled={
                  createLoading ||
                  !newUser.username.trim() ||
                  !newUser.password
                }
              >

                {createLoading ? (
                  <>
                    <Spinner
                      size="sm"
                      animation="border"
                      className="me-2"
                    />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}

              </Button>

            </Modal.Footer>

          </Form>
        </div>

      </Modal>

    </AppLayout>
  );
}

export default AdminUsersPage;