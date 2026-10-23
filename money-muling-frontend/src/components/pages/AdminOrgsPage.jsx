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
import {
  Building2,
  Plus,
  RotateCw,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  User,
} from 'lucide-react';

export default function AdminOrgsPage() {
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

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminAPI.listOrganizations();
      setOrgs(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError(err.response?.data?.detail || 'Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setActionLoading('create');
      setError('');
      setSuccess('');
      await adminAPI.createOrganization(form);
      setSuccess('Organization created successfully.');
      setTimeout(() => setSuccess(''), 3500);
      setShowCreate(false);
      resetForm();
      await fetchOrganizations();
    } catch (err) {
      console.error('Create organization failed:', err);
      setError(err.response?.data?.detail || 'Failed to create organization.');
    } finally {
      setActionLoading(null);
    }
  };

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
      await adminAPI.updateOrganization(selectedOrg.id, form);
      setSuccess('Organization updated successfully.');
      setTimeout(() => setSuccess(''), 3500);
      setShowEdit(false);
      setSelectedOrg(null);
      resetForm();
      await fetchOrganizations();
    } catch (err) {
      console.error('Update organization failed:', err);
      setError(err.response?.data?.detail || 'Failed to update organization.');
    } finally {
      setActionLoading(null);
    }
  };

  const updateStatus = async (org, status) => {
    try {
      setActionLoading(`${status}-${org.id}`);
      setError('');
      setSuccess('');
      await adminAPI.updateOrganization(org.id, { status });
      setSuccess(`${org.name} status updated to ${status.toLowerCase()}.`);
      setTimeout(() => setSuccess(''), 3500);
      await fetchOrganizations();
    } catch (err) {
      console.error(`Failed to ${status} organization:`, err);
      setError(err.response?.data?.detail || `Failed to ${status.toLowerCase()} organization.`);
    } finally {
      setActionLoading(null);
    }
  };

  const renderStatus = (status) => {
    const value = String(status || 'UNKNOWN').toUpperCase();
    if (value === 'APPROVED') return <Badge bg="success">APPROVED</Badge>;
    if (value === 'REJECTED') return <Badge bg="danger">REJECTED</Badge>;
    if (value === 'PENDING') return <Badge bg="warning" text="dark">PENDING</Badge>;
    return <Badge bg="secondary">{value}</Badge>;
  };

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
      title="Organizations"
     
    >
      {/* Header Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="text-white mb-1">Organization Directory</h4>
          <div className="text-secondary small">Total Registered Organizations: {orgs.length}</div>
        </div>

        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchOrganizations}
            disabled={loading}
            className="d-flex align-items-center gap-1.5"
            style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
            className="d-flex align-items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Create Organization</span>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError('')}
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
          onClose={() => setSuccess('')}
          className="bg-success bg-opacity-10 border-success text-success mb-4"
        >
          <div className="d-flex align-items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        </Alert>
      )}

      {/* Organizations Table Card */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="info" />
              <div className="text-secondary mt-3">Loading organizations...</div>
            </div>
          ) : orgs.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              <Building2 size={48} className="text-secondary opacity-50 mb-3" />
              <h5 className="text-white">No organizations found</h5>
              <p className="text-secondary mb-3">Add your first organization to establish institutional boundaries.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
              >
                <Plus size={14} className="me-1" /> Create Organization
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle" style={{ borderColor: '#21262d' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <th className="ps-4 py-3" style={cellStyle}>ID</th>
                    <th className="py-3" style={cellStyle}>Organization</th>
                    <th className="py-3" style={cellStyle}>Type</th>
                    <th className="py-3" style={cellStyle}>Contact Person</th>
                    <th className="py-3" style={cellStyle}>Email</th>
                    <th className="py-3" style={cellStyle}>Status</th>
                    <th className="py-3" style={cellStyle}>Created</th>
                    <th className="py-3 text-end pe-4" style={cellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id}>
                      <td className="ps-4" style={cellStyle}>
                        <span className="text-secondary small">#{org.id}</span>
                      </td>
                      <td style={cellStyle}>
                        <div className="fw-semibold text-white">{org.name || 'N/A'}</div>
                        {org.registration_number && (
                          <div className="text-secondary small">Reg: {org.registration_number}</div>
                        )}
                      </td>
                      <td style={cellStyle}>
                        <span className="text-light small">{org.org_type || '—'}</span>
                      </td>
                      <td style={cellStyle}>
                        <span className="text-light small">{org.contact_person || '—'}</span>
                      </td>
                      <td style={cellStyle}>
                        <span className="text-secondary small">{org.email || '—'}</span>
                      </td>
                      <td style={cellStyle}>{renderStatus(org.status)}</td>
                      <td style={cellStyle}>
                        <span className="text-secondary small">
                          {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="text-end pe-4" style={cellStyle}>
                        <div className="d-flex justify-content-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => openEdit(org)}
                            disabled={actionLoading === `edit-${org.id}`}
                            className="d-inline-flex align-items-center gap-1"
                            style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </Button>

                          {String(org.status).toUpperCase() === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline-success"
                                disabled={actionLoading === `APPROVED-${org.id}`}
                                onClick={() => updateStatus(org, 'APPROVED')}
                              >
                                {actionLoading === `APPROVED-${org.id}` ? (
                                  <Spinner size="sm" animation="border" />
                                ) : (
                                  'Approve'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                disabled={actionLoading === `REJECTED-${org.id}`}
                                onClick={() => updateStatus(org, 'REJECTED')}
                              >
                                {actionLoading === `REJECTED-${org.id}` ? (
                                  <Spinner size="sm" animation="border" />
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

      {/* Create Modal */}
      <Modal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        centered
        contentClassName="text-light shadow-lg"
      >
        <div style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px' }}>
          <Modal.Header closeButton closeVariant="white" style={{ borderColor: '#21262d' }}>
            <Modal.Title className="text-white fs-6 fw-bold">Create Organization</Modal.Title>
          </Modal.Header>

          <Form onSubmit={handleCreate}>
            <Modal.Body style={{ backgroundColor: '#0d1117' }}>
              <OrganizationForm form={form} handleChange={handleChange} />
            </Modal.Body>

            <Modal.Footer style={{ borderColor: '#21262d' }}>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowCreate(false)}
                style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={actionLoading === 'create'}>
                {actionLoading === 'create' ? <Spinner size="sm" animation="border" className="me-1" /> : null}
                Create Organization
              </Button>
            </Modal.Footer>
          </Form>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        show={showEdit}
        onHide={() => setShowEdit(false)}
        centered
        contentClassName="text-light shadow-lg"
      >
        <div style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px' }}>
          <Modal.Header closeButton closeVariant="white" style={{ borderColor: '#21262d' }}>
            <Modal.Title className="text-white fs-6 fw-bold">Edit Organization</Modal.Title>
          </Modal.Header>

          <Form onSubmit={handleEdit}>
            <Modal.Body style={{ backgroundColor: '#0d1117' }}>
              <OrganizationForm form={form} handleChange={handleChange} />
            </Modal.Body>

            <Modal.Footer style={{ borderColor: '#21262d' }}>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowEdit(false)}
                style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={actionLoading === `edit-${selectedOrg?.id}`}
              >
                {actionLoading === `edit-${selectedOrg?.id}` ? (
                  <Spinner size="sm" animation="border" className="me-1" />
                ) : null}
                Save Changes
              </Button>
            </Modal.Footer>
          </Form>
        </div>
      </Modal>
    </AppLayout>
  );
}

function OrganizationForm({ form, handleChange }) {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label className="text-light fw-semibold">Organization Name *</Form.Label>
        <Form.Control
          name="name"
          required
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. Apex Financial Corp"
          className="text-white"
          style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="text-light fw-semibold">Organization Type</Form.Label>
        <Form.Control
          name="org_type"
          value={form.org_type}
          onChange={handleChange}
          placeholder="e.g. Commercial Bank / FinTech"
          className="text-white"
          style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="text-light fw-semibold">Registration / License Number</Form.Label>
        <Form.Control
          name="registration_number"
          value={form.registration_number}
          onChange={handleChange}
          placeholder="e.g. REG-984210"
          className="text-white"
          style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="text-light fw-semibold">Primary Contact Person</Form.Label>
        <Form.Control
          name="contact_person"
          value={form.contact_person}
          onChange={handleChange}
          placeholder="e.g. Jane Doe"
          className="text-white"
          style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="text-light fw-semibold">Phone Number</Form.Label>
        <Form.Control
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="+1 (555) 000-0000"
          className="text-white"
          style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="text-light fw-semibold">Contact Email</Form.Label>
        <Form.Control
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="compliance@apexbank.com"
          className="text-white"
          style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
        />
      </Form.Group>
    </>
  );
}