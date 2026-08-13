import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Card, Button, Modal, Form } from 'react-bootstrap';

function AdminOrgsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.listOrganizations();
      setOrgs(data || []);
    } catch (err) {
      console.error('Failed to load orgs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);
    try {
      await adminAPI.createOrganization({ name: newOrgName });
      setShowCreateModal(false);
      setNewOrgName('');
      fetchOrgs();
    } catch (err) {
      console.error('Failed to create org', err);
      setError(err.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <AppLayout title="Organizations" subtitle="Manage client organizations in the platform">
      <div className="d-flex justify-content-end mb-3">
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + Create Organization
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
                  <th className="ps-4 border-secondary fw-medium">ID</th>
                  <th className="border-secondary fw-medium">Organization Name</th>
                  <th className="border-secondary fw-medium">Created At</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id}>
                    <td className="ps-4 border-secondary fw-medium">{o.id}</td>
                    <td className="border-secondary text-light fw-bold">{o.name}</td>
                    <td className="border-secondary text-muted">
                      {o.created_at ? new Date(o.created_at).toLocaleString() : 'N/A'}
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
          <Modal.Title>Create New Organization</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateOrg}>
          <Modal.Body>
            {error && <div className="alert alert-danger p-2 small mb-3">{error}</div>}
            <Form.Group className="mb-3">
              <Form.Label>Organization Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                className="bg-darker text-light border-secondary"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-secondary">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createLoading}>
              {createLoading ? <Spinner size="sm" animation="border" /> : 'Create Organization'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </AppLayout>
  );
}

export default AdminOrgsPage;
