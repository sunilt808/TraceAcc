import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Badge, Form, Spinner, Alert } from 'react-bootstrap';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Play,
  ArrowRight,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Database,
  Radio,
} from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';

export default function SimulationHistoryView({ onSelectSimulation, onNavigate }) {
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSimulations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await liveshieldApi.listSimulations(params);
      setSimulations(data || []);
    } catch (err) {
      console.error('Failed to load simulations history:', err);
      setError('Failed to load simulation records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulations();
  }, [statusFilter]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete Simulation #${id}? This will remove its synthetic transactions.`)) {
      return;
    }
    try {
      await liveshieldApi.deleteSimulation(id);
      setSimulations((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete simulation');
    }
  };

  const filtered = simulations.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.id.toString().includes(q);
  });

  return (
    <div className="liveshield-history">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
            <History className="text-warning" size={26} />
            Simulation History & Archive
          </h2>
          <p className="text-muted mb-0">
            Audit logs, performance metrics, and replay archives of previous synthetic generation runs
          </p>
        </div>

        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchSimulations}
            disabled={loading}
            className="d-flex align-items-center gap-1"
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('new')}
            className="d-flex align-items-center gap-1"
          >
            <Play size={14} />
            New Simulation
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="border-0 bg-danger bg-opacity-10 text-danger mb-4">
          <AlertCircle size={16} className="me-2" />
          {error}
        </Alert>
      )}

      {/* Filter & Search Bar */}
      <Card className="bg-dark border-secondary border-opacity-25 mb-4">
        <Card.Body className="p-3">
          <Row className="g-3">
            <Col md={6}>
              <div className="input-group">
                <span className="input-group-text bg-black border-secondary border-opacity-25 text-muted">
                  <Search size={16} />
                </span>
                <Form.Control
                  type="text"
                  placeholder="Search by name or simulation ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black border-secondary border-opacity-25 text-white"
                />
              </div>
            </Col>

            <Col md={3}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-black border-secondary border-opacity-25 text-white"
              >
                <option value="">All Statuses</option>
                <option value="RUNNING">RUNNING</option>
                <option value="PAUSED">PAUSED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="STOPPED">STOPPED</option>
                <option value="FAILED">FAILED</option>
              </Form.Select>
            </Col>

            <Col md={3} className="text-end text-muted small d-flex align-items-center justify-content-end">
              Showing {filtered.length} simulation records
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Table */}
      <Card className="bg-dark border-secondary border-opacity-25 mb-4">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" size="sm" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              No simulations found matching your criteria.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0 align-middle">
                <thead>
                  <tr className="text-muted small text-uppercase border-secondary border-opacity-25">
                    <th>ID</th>
                    <th>Simulation Name</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Target TPS</th>
                    <th>Actual Generated</th>
                    <th>Fraud Ratio</th>
                    <th>Simulated Volume</th>
                    <th>Created At</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const stats = s.stats || {};
                    const isRunning = s.status === 'RUNNING' || s.status === 'PAUSED';
                    return (
                      <tr
                        key={s.id}
                        className="border-secondary border-opacity-10 cursor-pointer"
                        onClick={() => {
                          if (onSelectSimulation) onSelectSimulation(s.id);
                          onNavigate(isRunning ? 'monitor' : 'detail');
                        }}
                      >
                        <td className="font-monospace text-muted small">#{s.id}</td>
                        <td>
                          <div className="fw-semibold text-white">{s.name}</div>
                          {s.case_id && (
                            <div className="mt-1">
                              <a
                                href={`/invospace/cases/${s.case_id}`}
                                className="badge bg-primary bg-opacity-25 text-primary text-decoration-none border border-primary border-opacity-50"
                                onClick={(e) => e.stopPropagation()}
                                title="Open linked investigation Case"
                              >
                                Case #{s.case_id}
                              </a>
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge bg={s.mode === 'advanced' ? 'warning' : 'info'} className="text-uppercase">
                            {s.mode}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            bg={
                              s.status === 'RUNNING'
                                ? 'success'
                                : s.status === 'COMPLETED'
                                ? 'info'
                                : s.status === 'PAUSED'
                                ? 'warning'
                                : s.status === 'FAILED'
                                ? 'danger'
                                : 'secondary'
                            }
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="font-monospace text-white small">{s.config?.target_tps || 50} TPS</td>
                        <td className="font-monospace text-white fw-semibold">
                          {(stats.total_generated || 0).toLocaleString()}
                        </td>
                        <td>
                          <span className="text-danger fw-semibold">
                            {(stats.fraud_percentage || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="font-monospace text-success small">
                          ${(stats.total_volume || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-muted small">
                          {new Date(s.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="d-flex justify-content-end gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                if (onSelectSimulation) onSelectSimulation(s.id);
                                onNavigate(isRunning ? 'monitor' : 'detail');
                              }}
                            >
                              {isRunning ? <Radio size={14} /> : <ArrowRight size={14} />}
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => handleDelete(s.id, e)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
