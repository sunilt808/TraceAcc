import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { alertsAPI } from '../../services/api';
import { Badge, Button, Table, Dropdown, ButtonGroup, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await alertsAPI.list(filter);
      setAlerts(data.items || []);
    } catch (err) {
      console.error('Failed to load alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const handleStatusChange = async (id, status) => {
    try {
      await alertsAPI.updateStatus(id, status);
      loadAlerts();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleEscalate = async (id) => {
    try {
      const res = await alertsAPI.escalate(id);
      navigate(`/cases?id=${res.case_id}`); // or handle redirect appropriately
    } catch (err) {
      console.error('Failed to escalate alert', err);
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger', CRITICAL: 'danger' };
    return <Badge bg={colors[severity] || 'secondary'}>{severity}</Badge>;
  };

  const getStatusBadge = (status) => {
    const colors = { NEW: 'primary', TRIAGED: 'info', FALSE_POSITIVE: 'secondary', ESCALATED: 'dark' };
    return <Badge bg={colors[status] || 'light'} text={status === 'ESCALATED' ? 'light' : 'dark'}>{status}</Badge>;
  };

  return (
    <AppLayout title="Alerts" subtitle="Review and triage detected anomalies">
      <div className="d-flex justify-content-between mb-3 align-items-center">
        <div>
          <select
            className="form-select bg-dark text-light border-secondary"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="TRIAGED">Triaged</option>
            <option value="FALSE_POSITIVE">False Positive</option>
            <option value="ESCALATED">Escalated</option>
          </select>
        </div>
        <div className="text-muted small">
          Showing {alerts.length} alerts
        </div>
      </div>

      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-5 text-center text-muted">
              No alerts found for the selected filter.
            </div>
          ) : (
            <Table hover responsive className="mb-0 align-middle text-nowrap">
              <thead className="bg-darker text-muted">
                <tr>
                  <th className="ps-4 fw-medium">ID</th>
                  <th className="fw-medium">Type</th>
                  <th className="fw-medium">Severity</th>
                  <th className="fw-medium">Score</th>
                  <th className="fw-medium">Status</th>
                  <th className="fw-medium">Created</th>
                  <th className="pe-4 text-end fw-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="ps-4 text-muted">#{alert.id}</td>
                    <td className="fw-bold">{alert.alert_type}</td>
                    <td>{getSeverityBadge(alert.severity)}</td>
                    <td>
                      <span className={`text-${alert.risk_score > 80 ? 'danger' : alert.risk_score > 50 ? 'warning' : 'success'} fw-bold`}>
                        {alert.risk_score.toFixed(1)}
                      </span>
                    </td>
                    <td>{getStatusBadge(alert.status)}</td>
                    <td className="text-muted small">
                      {new Date(alert.created_at).toLocaleString()}
                    </td>
                    <td className="pe-4 text-end">
                      {alert.status !== 'ESCALATED' && (
                        <Dropdown as={ButtonGroup} size="sm">
                          <Button variant="outline-primary" onClick={() => handleEscalate(alert.id)}>
                            Escalate
                          </Button>
                          <Dropdown.Toggle split variant="outline-primary" id={`dropdown-split-${alert.id}`} />
                          <Dropdown.Menu variant="dark">
                            <Dropdown.Item onClick={() => handleStatusChange(alert.id, 'TRIAGED')}>Mark Triaged</Dropdown.Item>
                            <Dropdown.Item onClick={() => handleStatusChange(alert.id, 'FALSE_POSITIVE')}>False Positive</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      )}
                      {alert.status === 'ESCALATED' && (
                         <Button variant="outline-secondary" size="sm" disabled>
                           Escalated to #{alert.case_id}
                         </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
