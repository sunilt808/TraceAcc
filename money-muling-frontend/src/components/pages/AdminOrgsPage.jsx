import React, { useEffect, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import {
  Table,
  Spinner,
  Card,
  Button,
  Modal,
  Form,
  Badge,
  Alert,
} from 'react-bootstrap';

function AdminOrgsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState(null);

  const [form, setForm] = useState({
    name: '',
    org_type: '',
    registration_number: '',
    phone: '',
    email: '',
    contact_person: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============================================================
  // LOAD ORGANIZATIONS
  // ============================================================

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await adminAPI.listOrganizations();

      setOrgs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load organizations:', err);

      setError(
        err.response?.data?.detail ||
        'Failed to load organizations.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // ============================================================
  // FORM
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      org_type: '',
      registration_number: '',
      phone: '',
      email: '',
      contact_person: '',
    });
  };

  // ============================================================
  // CREATE
  // ============================================================

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      setActionLoading('create');
      setError('');
      setSuccess('');

      await adminAPI.createOrganization(form);

      setSuccess('Organization created successfully.');

      setShowCreate(false);
      resetForm();

      await fetchOrganizations();
    } catch (err) {
      console.error('Create organization failed:', err);

      setError(
        err.response?.data?.detail ||
        'Failed to create organization.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  // EDIT
  // ============================================================

  const openEdit = (org) => {
    setSelectedOrg(org);

    setForm({
      name: org.name || '',
      org_type: org.org_type || '',
      registration_number: org.registration_number || '',
      phone: org.phone || '',
      email: org.email || '',
      contact_person: org.contact_person || '',
    });

    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();

    if (!selectedOrg) return;

    try {
      setActionLoading(`edit-${selectedOrg.id}`);
      setError('');
      setSuccess('');

      await adminAPI.updateOrganization(
        selectedOrg.id,
        form
      );

      setSuccess('Organization updated successfully.');

      setShowEdit(false);
      setSelectedOrg(null);
      resetForm();

      await fetchOrganizations();
    } catch (err) {
      console.error('Update organization failed:', err);

      setError(
        err.response?.data?.detail ||
        'Failed to update organization.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  // APPROVE / REJECT
  // ============================================================

  const updateStatus = async (org, status) => {
    try {
      setActionLoading(`${status}-${org.id}`);
      setError('');
      setSuccess('');

      await adminAPI.updateOrganization(org.id, {
        status,
      });

      setSuccess(
        `${org.name} has been ${status.toLowerCase()}.`
      );

      await fetchOrganizations();
    } catch (err) {
      console.error(`Failed to ${status} organization:`, err);

      setError(
        err.response?.data?.detail ||
        `Failed to ${status.toLowerCase()} organization.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  // STATUS BADGE
  // ============================================================

  const renderStatus = (status) => {
    const value = String(status || 'UNKNOWN').toUpperCase();

    if (value === 'APPROVED') {
      return <Badge bg="success">APPROVED</Badge>;
    }

    if (value === 'REJECTED') {
      return <Badge bg="danger">REJECTED</Badge>;
    }

    if (value === 'PENDING') {
      return <Badge bg="warning" text="dark">PENDING</Badge>;
    }

    return <Badge bg="secondary">{value}</Badge>;
  };

  // ============================================================
  // STYLES
  // ============================================================

  const darkCardStyle = {
    backgroundColor: '#0d1117',
    borderColor: '#21262d',
  };

  const cellStyle = {
    backgroundColor: '#0d1117',
    borderColor: '#21262d',
    color: '#c9d1d9',
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <AppLayout
      title="Organizations"
      subtitle="Manage, review and approve client organizations"
    >
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSuccess('')}
        >
          {success}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span className="text-secondary">
            Total: {orgs.length}
          </span>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          + Create Organization
        </Button>
      </div>

      <Card className="shadow-sm" style={darkCardStyle}>
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              No organizations found.
            </div>
          ) : (
            <div className="table-responsive">
              <Table
                hover
                className="mb-0 align-middle"
              >
                <thead>
                  <tr>
                    <th style={cellStyle}>ID</th>
                    <th style={cellStyle}>Organization</th>
                    <th style={cellStyle}>Type</th>
                    <th style={cellStyle}>Contact</th>
                    <th style={cellStyle}>Email</th>
                    <th style={cellStyle}>Status</th>
                    <th style={cellStyle}>Created</th>
                    <th
                      style={cellStyle}
                      className="text-end pe-4"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id}>
                      <td style={cellStyle}>
                        {org.id}
                      </td>

                      <td
                        style={cellStyle}
                        className="fw-bold text-light"
                      >
                        {org.name || 'N/A'}
                      </td>

                      <td style={cellStyle}>
                        {org.org_type || 'N/A'}
                      </td>

                      <td style={cellStyle}>
                        {org.contact_person || 'N/A'}
                      </td>

                      <td style={cellStyle}>
                        {org.email || 'N/A'}
                      </td>

                      <td style={cellStyle}>
                        {renderStatus(org.status)}
                      </td>

                      <td
                        style={cellStyle}
                        className="text-secondary"
                      >
                        {org.created_at
                          ? new Date(
                            org.created_at
                          ).toLocaleString()
                          : 'N/A'}
                      </td>

                      <td
                        style={cellStyle}
                        className="text-end pe-4"
                      >
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant="outline-light"
                            onClick={() => openEdit(org)}
                            disabled={
                              actionLoading ===
                              `edit-${org.id}`
                            }
                          >
                            Edit
                          </Button>

                          {String(org.status).toUpperCase() ===
                            'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  disabled={
                                    actionLoading ===
                                    `APPROVED-${org.id}`
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      org,
                                      'APPROVED'
                                    )
                                  }
                                >
                                  {actionLoading ===
                                    `APPROVED-${org.id}` ? (
                                    <Spinner
                                      size="sm"
                                      animation="border"
                                    />
                                  ) : (
                                    'Approve'
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="danger"
                                  disabled={
                                    actionLoading ===
                                    `REJECTED-${org.id}`
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      org,
                                      'REJECTED'
                                    )
                                  }
                                >
                                  {actionLoading ===
                                    `REJECTED-${org.id}` ? (
                                    <Spinner
                                      size="sm"
                                      animation="border"
                                    />
                                  ) : (
                                    'Reject'
                                  )}
                                </Button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ========================================================
          CREATE MODAL
      ======================================================== */}

      <Modal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        centered
        contentClassName="text-light"
      >
        <div
          style={{
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '8px',
          }}
        >
          <Modal.Header
            closeButton
            closeVariant="white"
            style={{
              backgroundColor: '#0d1117',
              borderColor: '#21262d',
            }}
          >
            <Modal.Title>
              Create Organization
            </Modal.Title>
          </Modal.Header>

          <Form onSubmit={handleCreate}>
            <Modal.Body
              style={{ backgroundColor: '#0d1117' }}
            >
              <OrganizationForm
                form={form}
                handleChange={handleChange}
              />
            </Modal.Body>

            <Modal.Footer
              style={{
                backgroundColor: '#0d1117',
                borderColor: '#21262d',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                type="submit"
                disabled={actionLoading === 'create'}
              >
                {actionLoading === 'create' ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  'Create'
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </div>
      </Modal>

      {/* ========================================================
          EDIT MODAL
      ======================================================== */}

      <Modal
        show={showEdit}
        onHide={() => setShowEdit(false)}
        centered
        contentClassName="text-light"
      >
        <div
          style={{
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '8px',
          }}
        >
          <Modal.Header
            closeButton
            closeVariant="white"
            style={{
              backgroundColor: '#0d1117',
              borderColor: '#21262d',
            }}
          >
            <Modal.Title>
              Edit Organization
            </Modal.Title>
          </Modal.Header>

          <Form onSubmit={handleEdit}>
            <Modal.Body
              style={{ backgroundColor: '#0d1117' }}
            >
              <OrganizationForm
                form={form}
                handleChange={handleChange}
              />
            </Modal.Body>

            <Modal.Footer
              style={{
                backgroundColor: '#0d1117',
                borderColor: '#21262d',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowEdit(false)}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                type="submit"
                disabled={
                  actionLoading ===
                  `edit-${selectedOrg?.id}`
                }
              >
                {actionLoading ===
                  `edit-${selectedOrg?.id}` ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </div>
      </Modal>
    </AppLayout>
  );
}

// ============================================================
// ORGANIZATION FORM
// ============================================================

function OrganizationForm({ form, handleChange }) {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Organization Name *</Form.Label>
        <Form.Control
          name="name"
          required
          value={form.name}
          onChange={handleChange}
          placeholder="Organization name"
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Organization Type</Form.Label>
        <Form.Control
          name="org_type"
          value={form.org_type}
          onChange={handleChange}
          placeholder="Bank / Financial Institution / etc."
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Registration Number</Form.Label>
        <Form.Control
          name="registration_number"
          value={form.registration_number}
          onChange={handleChange}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Contact Person</Form.Label>
        <Form.Control
          name="contact_person"
          value={form.contact_person}
          onChange={handleChange}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Phone</Form.Label>
        <Form.Control
          name="phone"
          value={form.phone}
          onChange={handleChange}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Email</Form.Label>
        <Form.Control
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
        />
      </Form.Group>
    </>
  );
}

export default AdminOrgsPage;