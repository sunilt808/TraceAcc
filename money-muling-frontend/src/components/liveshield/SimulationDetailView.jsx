import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Badge, Form, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
import {
  ArrowLeft,
  RotateCcw,
  Download,
  Filter,
  Search,
  Database,
  ShieldAlert,
  Clock,
  CheckCircle,
  FileCode,
  Activity,
  Layers,
} from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';

// Maps backend scenario IDs (F01–F19) to human-readable names
const SCENARIO_ID_NAMES = {
  F01: 'Structuring / Smurfing',
  F02: 'Rapid Pass-Through',
  F03: 'Fan-In Aggregation',
  F04: 'Fan-Out Dispersion',
  F05: 'Money-Mule Chain',
  F06: 'Circular Transfers (Cycle)',
  F07: 'Layered Shell Chains',
  F08: 'High-Freq Burst Activity',
  F09: 'Unusual Amount Spikes',
  F10: 'Account Takeover (ATO)',
  F11: 'New High-Risk Beneficiary',
  F12: 'Night-Time Anomaly',
  F13: 'Bipartite Bridge Cluster',
  F14: 'Dormant Account Activation',
  F15: 'Periodic / Bot Transfers',
  F16: 'Round-Amount Laundering',
  F17: 'Community Core Mule Ring',
  F18: 'Temporal Cascade Storm',
  F19: 'Risk Diffusion Hotspot',
};

const scenarioLabel = (id) => SCENARIO_ID_NAMES[id] || id || '—';


export default function SimulationDetailView({ simulationId, onNavigate }) {
  const [simulation, setSimulation] = useState(null);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for ledger
  const [filterScenario, setFilterScenario] = useState('');
  const [filterTruth, setFilterTruth] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const PAGE_LIMIT = 50;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [simData, statsData, txnsData] = await Promise.all([
        liveshieldApi.getSimulation(simulationId),
        liveshieldApi.getStats(simulationId),
        liveshieldApi.getTransactions(simulationId, {
          limit: PAGE_LIMIT,
          offset: pageOffset,
          scenario_id: filterScenario || undefined,
          ground_truth: filterTruth || undefined,
          account_id: filterAccount || undefined,
        }),
      ]);
      setSimulation(simData);
      setStats(statsData);
      setTransactions(txnsData || []);
    } catch (err) {
      console.error('Failed to load simulation detail:', err);
      setError('Failed to fetch simulation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (simulationId) {
      fetchData();
    }
  }, [simulationId, pageOffset, filterScenario, filterTruth, filterAccount]);

  const handleExportCSV = () => {
    if (!transactions.length) return;
    const headers = [
      'transaction_id',
      'timestamp',
      'sender_account',
      'receiver_account',
      'amount',
      'channel',
      'synthetic_ground_truth',
      'scenario_id',
      'sequence_id',
      'step_index',
    ];
    const rows = transactions.map((t) => [
      t.transaction_id,
      t.timestamp,
      t.sender_account,
      t.receiver_account,
      t.amount,
      t.channel,
      t.synthetic_ground_truth,
      t.scenario_id || '',
      t.sequence_id || '',
      t.step_index || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `simulation_${simulationId}_transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!simulationId) {
    return (
      <div className="text-center py-5 text-muted">
        <h5>No Simulation Selected</h5>
        <Button variant="primary" onClick={() => onNavigate('history')}>
          Back to History
        </Button>
      </div>
    );
  }

  return (
    <div className="simulation-detail">
      {/* Top Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => onNavigate('history')}
            className="d-flex align-items-center gap-1"
          >
            <ArrowLeft size={14} /> Back
          </Button>
          <div>
            <h2 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              {simulation?.name || `Simulation #${simulationId}`}
              <Badge
                bg={
                  simulation?.status === 'RUNNING'
                    ? 'success'
                    : simulation?.status === 'COMPLETED'
                    ? 'info'
                    : simulation?.status === 'PAUSED'
                    ? 'warning'
                    : 'secondary'
                }
                className="text-uppercase fs-6"
              >
                {simulation?.status}
              </Badge>
            </h2>
            <div className="text-muted small mt-1">
              Simulation ID: #{simulationId} &bull; Mode: {simulation?.mode} &bull; Target Rate: {simulation?.config?.target_tps || 50} TPS
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center">
          {simulation?.case_id && (
            <Button
              variant="outline-warning"
              size="sm"
              onClick={() => onNavigate('cases', simulation.case_id)}
              className="d-flex align-items-center gap-1"
            >
              <ShieldAlert size={14} /> View Linked Case #{simulation.case_id}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('monitor')}
            className="d-flex align-items-center gap-1"
          >
            <Activity size={14} /> Open Live Monitor & Graph
          </Button>

          {simulation?.status !== 'RUNNING' && simulation?.status !== 'PAUSED' && (
            <Button
              variant="outline-info"
              size="sm"
              onClick={async () => {
                await liveshieldApi.restartSimulation(simulationId);
                onNavigate('monitor');
              }}
              className="d-flex align-items-center gap-1"
            >
              <RotateCcw size={14} /> Re-run Simulation
            </Button>
          )}

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleExportCSV}
            className="d-flex align-items-center gap-1"
          >
            <Download size={14} /> Export CSV
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
              <span className="text-muted small text-uppercase fw-semibold">Total Emitted</span>
              <h3 className="text-white font-monospace fw-bold mt-2 mb-0">
                {(stats?.total_generated || 0).toLocaleString()}
              </h3>
              <div className="mt-2 text-muted small">Synthetic transactions</div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Cumulative Volume</span>
              <h3 className="text-success font-monospace fw-bold mt-2 mb-0">
                ${(stats?.total_volume || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
              <div className="mt-2 text-muted small">Synthetic USD flow</div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Fraud Proportion</span>
              <h3 className="text-danger font-monospace fw-bold mt-2 mb-0">
                {(stats?.fraud_percentage || 0).toFixed(1)}%
              </h3>
              <div className="mt-2 text-muted small">
                {(stats?.total_fraudulent || 0).toLocaleString()} fraud events
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Execution Duration</span>
              <h3 className="text-info font-monospace fw-bold mt-2 mb-0">
                {(stats?.elapsed_seconds || 0).toFixed(1)}s
              </h3>
              <div className="mt-2 text-muted small">
                Configured: {simulation?.config?.duration_seconds || 60}s
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabs for Detailed Inspection */}
      <Tabs defaultActiveKey="ledger" className="custom-dark-tabs mb-4">
        {/* Tab 1: Synthetic Transactions Ledger */}
        <Tab eventKey="ledger" title="Synthetic Ledger">
          <Card className="bg-dark border-secondary border-opacity-25 mb-4">
            <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
              <Row className="g-2 align-items-center">
                <Col md={3}>
                  <Form.Select
                    size="sm"
                    value={filterScenario}
                    onChange={(e) => setFilterScenario(e.target.value)}
                    className="bg-black border-secondary border-opacity-25 text-white"
                  >
                    <option value="">All Typologies</option>
                    {Array.from({ length: 19 }, (_, i) => {
                      const id = `F${String(i + 1).padStart(2, '0')}`;
                      return (
                        <option key={id} value={id}>
                          {id} — {scenarioLabel(id)}
                        </option>
                      );
                    })}
                  </Form.Select>
                </Col>

                <Col md={3}>
                  <Form.Select
                    size="sm"
                    value={filterTruth}
                    onChange={(e) => setFilterTruth(e.target.value)}
                    className="bg-black border-secondary border-opacity-25 text-white"
                  >
                    <option value="">All Ground Truths</option>
                    <option value="legitimate">Legitimate</option>
                    <option value="fraudulent">Fraudulent</option>
                  </Form.Select>
                </Col>

                <Col md={4}>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Filter by account ID..."
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="bg-black border-secondary border-opacity-25 text-white"
                  >
                  </Form.Control>
                </Col>

                <Col md={2} className="text-end">
                  <Badge bg="secondary" className="font-monospace">
                    {transactions.length} rows loaded
                  </Badge>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover mb-0 align-middle">
                  <thead>
                    <tr className="text-muted small text-uppercase border-secondary border-opacity-25">
                      <th>Txn ID</th>
                      <th>Timestamp</th>
                      <th>Ground Truth</th>
                      <th>Typology</th>
                      <th>Sender</th>
                      <th>Receiver</th>
                      <th>Amount (USD)</th>
                      <th>Channel</th>
                      <th>Step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-4 text-muted">
                          No transactions found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => {
                        const isFraud = t.synthetic_ground_truth === 'fraudulent';
                        return (
                          <tr key={t.id} className="border-secondary border-opacity-10">
                            <td className="font-monospace text-muted small">{t.transaction_id}</td>
                            <td className="text-muted small">
                              {new Date(t.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td>
                              <Badge bg={isFraud ? 'danger' : 'success'}>
                                {t.synthetic_ground_truth}
                              </Badge>
                            </td>
                            <td>
                              {isFraud ? (
                                <Badge bg="dark" className="border border-danger border-opacity-50 text-danger" title={t.scenario_id} style={{ fontSize: '11px' }}>
                                  {scenarioLabel(t.scenario_id)}
                                </Badge>
                              ) : (
                                <span className="text-muted small">LEGIT</span>
                              )}
                            </td>
                            <td className="font-monospace text-white small">{t.sender_account}</td>
                            <td className="font-monospace text-white small">{t.receiver_account}</td>
                            <td className="font-monospace text-white fw-bold">
                              ${parseFloat(t.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td>
                              <span className="badge bg-secondary bg-opacity-25 text-white small">
                                {t.channel || 'ONLINE'}
                              </span>
                            </td>
                            <td className="font-monospace text-muted small">
                              {t.step_index !== null && t.step_index !== undefined ? `#${t.step_index}` : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </Tab>

        {/* Tab 2: Configuration & Parameters */}
        <Tab eventKey="config" title="Configuration & Parameters">
          <Card className="bg-dark border-secondary border-opacity-25 mb-4">
            <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
              <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                <FileCode size={16} className="text-info" /> Simulation Config JSON
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              <pre className="text-success bg-black p-3 rounded font-monospace small mb-0 overflow-auto" style={{ maxHeight: '400px' }}>
                {JSON.stringify(simulation?.config, null, 2)}
              </pre>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
}
