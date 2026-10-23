import React, { useEffect, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Badge, Card, Button, Alert } from 'react-bootstrap';
import { Zap, RotateCw, Activity, Layers, AlertCircle } from 'lucide-react';

const darkCardStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
};

const cellStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
  color: '#c9d1d9',
};

export default function AdminOperationsPage() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOperations = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminAPI.getOperationsQueue();
      setOperations(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load operations queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperations();
  }, []);

  const statusVariant = (status) => {
    if (['COMPLETED', 'CLOSED', 'APPROVED'].includes(status)) {
      return 'success';
    }
    if (['FAILED', 'REJECTED', 'ERROR'].includes(status)) {
      return 'danger';
    }
    if (['IN_PROGRESS', 'PROCESSING', 'ANALYSIS'].includes(status)) {
      return 'warning';
    }
    return 'secondary';
  };

  return (
    <AppLayout
      title="Operations Queue"
       >
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

      {/* Header Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="text-white mb-1">Live Operations Stream</h4>
          <div className="text-secondary small">Total Active Queue Items: {operations.length}</div>
        </div>

        <Button
          variant="outline-secondary"
          size="sm"
          onClick={loadOperations}
          disabled={loading}
          className="d-flex align-items-center gap-1.5"
          style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Queue</span>
        </Button>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" variant="info" />
              <div className="text-secondary mt-3">Loading operations queue...</div>
            </div>
          ) : operations.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              <Activity size={48} className="text-secondary opacity-50 mb-3" />
              <h5 className="text-white">No active operations in queue</h5>
              <p className="text-secondary mb-0">System operations and batch triage tasks will appear here as they run.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle" style={{ borderColor: '#21262d' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <th className="ps-4 py-3" style={cellStyle}>ID</th>
                    <th className="py-3" style={cellStyle}>Operation Type</th>
                    <th className="py-3" style={cellStyle}>Organization</th>
                    <th className="py-3" style={cellStyle}>Assigned Operator</th>
                    <th className="py-3" style={cellStyle}>Status</th>
                    <th className="py-3 text-end pe-4" style={cellStyle}>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((op) => (
                    <tr key={op.id}>
                      <td className="ps-4" style={cellStyle}>
                        <span className="text-secondary small">#{op.id}</span>
                      </td>
                      <td style={cellStyle}>
                        <div className="fw-semibold text-white">
                          {op.type || op.operation_type || op.service_type || 'Forensic Task'}
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <span className="text-light small">
                          {op.organization_name || op.organization?.name || 'Global System'}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <span className="text-light small">
                          {op.assigned_to_name || op.assigned_user?.username || op.assignee || 'Unassigned'}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <Badge bg={statusVariant(op.status)}>
                          {op.status || 'ACTIVE'}
                        </Badge>
                      </td>
                      <td className="text-end pe-4" style={cellStyle}>
                        <span className="text-secondary small">
                          {op.updated_at
                            ? new Date(op.updated_at).toLocaleString()
                            : op.created_at
                            ? new Date(op.created_at).toLocaleString()
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </AppLayout>
  );
}