import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Card, Badge, Form } from 'react-bootstrap';

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
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

  return (
    <AppLayout title="User Management" subtitle="Manage system access and roles">
      <Card className="bg-dark border-secondary shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center"><Spinner animation="border" variant="primary" /></div>
          ) : (
            <Table hover responsive className="mb-0 align-middle text-light border-secondary">
              <thead>
                <tr className="text-muted bg-darker">
                  <th className="ps-4 border-secondary fw-medium">User</th>
                  <th className="border-secondary fw-medium">Role</th>
                  <th className="border-secondary fw-medium">Status</th>
                  <th className="border-secondary fw-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="ps-4 border-secondary fw-medium">
                      {u.username}
                      <div className="text-muted small fw-normal">{u.email}</div>
                    </td>
                    <td className="border-secondary">
                      <Form.Select 
                        size="sm"
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-darker text-light border-secondary w-auto d-inline-block"
                      >
                        <option value="CLIENT_USER">Client User</option>
                        <option value="TRACE_LAB_ANALYST">TraceLab Analyst</option>
                        <option value="INVESTIGATOR">Investigator</option>
                        <option value="AUDITOR">Auditor</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </Form.Select>
                    </td>
                    <td className="border-secondary">
                      <Form.Check 
                        type="switch"
                        id={`switch-${u.id}`}
                        checked={u.is_active}
                        onChange={(e) => handleStatusChange(u.id, e.target.checked)}
                        label={u.is_active ? <Badge bg="success">Active</Badge> : <Badge bg="danger">Disabled</Badge>}
                      />
                    </td>
                    <td className="border-secondary text-muted small">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </AppLayout>
  );
}

export default AdminUsersPage;
