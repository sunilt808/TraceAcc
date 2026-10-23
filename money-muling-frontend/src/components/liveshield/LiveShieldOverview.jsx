import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import {
  Activity,
  Zap,
  ShieldAlert,
  Play,
  Pause,
  Square,
  Clock,
  ArrowRight,
  RefreshCw,
  Sliders,
  Layers,
  Database,
  CheckCircle2,
  TrendingUp,
  Radio,
  FileSpreadsheet
} from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';

export default function LiveShieldOverview({ onNavigate, onSelectSimulation }) {
  const [loading, setLoading] = useState(true);
  const [simulations, setSimulations] = useState([]);
  const [presets, setPresets] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [simsRes, presetsRes] = await Promise.all([
        liveshieldApi.listSimulations({ limit: 10 }),
        liveshieldApi.getPresets(),
      ]);
      setSimulations(simsRes || []);
      setPresets(presetsRes || []);
    } catch (err) {
      console.error('Failed to load LiveShield overview data:', err);
      setError(err.response?.data?.detail || 'Failed to load simulation status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeSimulations = simulations.filter(
    (s) => s.status === 'RUNNING' || s.status === 'PAUSED'
  );

  const totalSimulatedCount = simulations.reduce(
    (acc, s) => acc + (s.stats?.total_generated || 0),
    0
  );

  const totalSimulatedVolume = simulations.reduce(
    (acc, s) => acc + (s.stats?.total_volume || 0),
    0
  );

  const totalFraudCount = simulations.reduce(
    (acc, s) => acc + (s.stats?.total_fraudulent || 0),
    0
  );

  return (
    <div className="liveshield-overview">
      {/* Header Banner */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
            <Activity className="text-primary" size={28} />
            TraceAcc LiveShield Simulator
          </h2>
          <p className="text-muted mb-0">
            Real-Time Synthetic Financial Transaction Generator, Simulation Engine & Live Monitor
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchData}
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
            className="d-flex align-items-center gap-1 fw-semibold"
          >
            <Zap size={14} />
            New Simulation
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="border-0 bg-danger bg-opacity-10 text-danger mb-4">
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      <Row className="g-3 mb-4">
        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted small text-uppercase fw-semibold">Active Simulations</span>
                  <h3 className="text-white fw-bold mt-2 mb-0">
                    {activeSimulations.length}
                  </h3>
                </div>
                <div className="p-2 rounded bg-primary bg-opacity-10 text-primary">
                  <Radio size={20} className={activeSimulations.length > 0 ? 'pulse-icon' : ''} />
                </div>
              </div>
              <div className="mt-3 small text-muted">
                {activeSimulations.length > 0 ? (
                  <span className="text-success d-flex align-items-center gap-1">
                    <span className="live-dot" /> Engines executing live
                  </span>
                ) : (
                  <span>All worker engines idle</span>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted small text-uppercase fw-semibold">Total Generated</span>
                  <h3 className="text-white fw-bold mt-2 mb-0">
                    {totalSimulatedCount.toLocaleString()}
                  </h3>
                </div>
                <div className="p-2 rounded bg-info bg-opacity-10 text-info">
                  <Database size={20} />
                </div>
              </div>
              <div className="mt-3 small text-muted">
                Synthetic transactions created
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted small text-uppercase fw-semibold">Simulated Volume</span>
                  <h3 className="text-white fw-bold mt-2 mb-0">
                    ${totalSimulatedVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="p-2 rounded bg-success bg-opacity-10 text-success">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="mt-3 small text-muted">
                Total synthetic capital flow
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted small text-uppercase fw-semibold">Labeled Fraud Units</span>
                  <h3 className="text-white fw-bold mt-2 mb-0">
                    {totalFraudCount.toLocaleString()}
                  </h3>
                </div>
                <div className="p-2 rounded bg-danger bg-opacity-10 text-danger">
                  <ShieldAlert size={20} />
                </div>
              </div>
              <div className="mt-3 small text-muted">
                F01–F18 Ground-truth sequences
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Active Runs Section */}
      {activeSimulations.length > 0 && (
        <Card className="bg-dark border-primary border-opacity-50 mb-4">
          <Card.Header className="bg-dark bg-opacity-50 border-bottom border-primary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <span className="live-dot" />
              <h5 className="text-white fw-bold mb-0">Active Running Simulations</h5>
            </div>
            <Badge bg="primary">{activeSimulations.length} Running</Badge>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0 align-middle">
                <thead>
                  <tr className="text-muted small text-uppercase border-secondary border-opacity-25">
                    <th>Simulation</th>
                    <th>Mode</th>
                    <th>Target TPS</th>
                    <th>Actual TPS</th>
                    <th>Generated</th>
                    <th>Fraud Ratio</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSimulations.map((sim) => (
                    <tr key={sim.id} className="border-secondary border-opacity-10">
                      <td>
                        <div className="fw-semibold text-white">{sim.name}</div>
                        <div className="text-muted small d-flex align-items-center gap-2">
                          <span>ID: #{sim.id}</span>
                          {sim.case_id && (
                            <a
                              href={`/invospace/cases/${sim.case_id}`}
                              className="badge bg-primary bg-opacity-25 text-primary text-decoration-none border border-primary border-opacity-50"
                              onClick={(e) => e.stopPropagation()}
                              title="Open investigation Case"
                            >
                              Case #{sim.case_id}
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge bg={sim.mode === 'advanced' ? 'warning' : 'info'} className="text-uppercase">
                          {sim.mode}
                        </Badge>
                      </td>
                      <td className="text-white font-monospace">{sim.config?.target_tps || 50} TPS</td>
                      <td className="text-primary font-monospace fw-bold">
                        {(sim.stats?.actual_tps || 0).toFixed(1)} TPS
                      </td>
                      <td className="text-white font-monospace">
                        {(sim.stats?.total_generated || 0).toLocaleString()}
                      </td>
                      <td>
                        <span className="text-danger fw-semibold">
                          {(sim.stats?.fraud_percentage || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <Badge bg={sim.status === 'RUNNING' ? 'success' : 'warning'}>
                          {sim.status}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            if (onSelectSimulation) onSelectSimulation(sim.id);
                            onNavigate('monitor');
                          }}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          <Radio size={14} /> Monitor Live
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Preset Quick Launch & Recent Runs */}
      <Row className="g-4 mb-4">
        <Col lg={5}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
              <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                <Sliders size={18} className="text-info" />
                Quick Launch Templates
              </h5>
              <Button
                variant="link"
                size="sm"
                className="text-muted p-0"
                onClick={() => onNavigate('presets')}
              >
                View all presets
              </Button>
            </Card.Header>
            <Card.Body className="p-3">
              <div className="d-flex flex-column gap-2">
                {presets.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-25 d-flex justify-content-between align-items-center hover-card"
                  >
                    <div>
                      <div className="fw-semibold text-white">{p.name}</div>
                      <div className="text-muted small">{p.description}</div>
                      <div className="mt-1 d-flex gap-2">
                        <Badge bg="secondary" className="font-monospace">
                          {p.config?.target_tps || 50} TPS
                        </Badge>
                        <Badge bg="danger" className="font-monospace">
                          {p.config?.fraud_percentage || 15}% Fraud
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => {
                        onNavigate('new', { presetId: p.id, preset: p });
                      }}
                      className="d-flex align-items-center gap-1"
                    >
                      <Play size={12} /> Launch
                    </Button>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
              <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                <Clock size={18} className="text-warning" />
                Recent Simulations
              </h5>
              <Button
                variant="link"
                size="sm"
                className="text-muted p-0"
                onClick={() => onNavigate('history')}
              >
                View full history
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" size="sm" />
                </div>
              ) : simulations.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  No simulations created yet. Click "New Simulation" to start.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-dark table-hover mb-0 align-middle">
                    <thead>
                      <tr className="text-muted small text-uppercase border-secondary border-opacity-25">
                        <th>Simulation</th>
                        <th>Created</th>
                        <th>Status</th>
                        <th>Volume</th>
                        <th className="text-end">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulations.slice(0, 5).map((sim) => (
                        <tr key={sim.id} className="border-secondary border-opacity-10">
                          <td>
                            <div className="fw-semibold text-white">{sim.name}</div>
                            <div className="text-muted small">
                              {sim.config?.target_tps || 50} TPS &bull; {sim.mode}
                            </div>
                          </td>
                          <td className="text-muted small">
                            {new Date(sim.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <Badge
                              bg={
                                sim.status === 'RUNNING'
                                  ? 'success'
                                  : sim.status === 'COMPLETED'
                                  ? 'info'
                                  : sim.status === 'PAUSED'
                                  ? 'warning'
                                  : 'secondary'
                              }
                            >
                              {sim.status}
                            </Badge>
                          </td>
                          <td className="text-white font-monospace small">
                            ${(sim.stats?.total_volume || 0).toLocaleString()}
                          </td>
                          <td className="text-end">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => {
                                if (onSelectSimulation) onSelectSimulation(sim.id);
                                onNavigate(
                                  sim.status === 'RUNNING' || sim.status === 'PAUSED'
                                    ? 'monitor'
                                    : 'detail'
                                );
                              }}
                            >
                              <ArrowRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
