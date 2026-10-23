import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Spinner,
  Alert,
  Modal,
  Form,
  Tab,
  Nav,
} from 'react-bootstrap';
import {
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Activity,
  UserCheck,
  ChevronRight,
  GitCommit,
} from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';

export default function ContinuousRiskView({ simulationId }) {
  const [activeTab, setActiveTab] = useState('retrospective'); // 'retrospective' | 'cleared' | 'override'
  const [retrospectiveAlerts, setRetrospectiveAlerts] = useState([]);
  const [clearedTxns, setClearedTxns] = useState([]);
  const [reevalStats, setReevalStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Timeline modal state
  const [selectedTxnId, setSelectedTxnId] = useState(null);
  const [timelineRecords, setTimelineRecords] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Manual override form state
  const [overrideAccount, setOverrideAccount] = useState('');
  const [overrideVerifiedClean, setOverrideVerifiedClean] = useState(true);
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState(null);

  const fetchData = async () => {
    if (!simulationId) return;
    setLoading(true);
    setError(null);
    try {
      const [alerts, cleared, stats] = await Promise.all([
        liveshieldApi.getRetrospectiveAlerts(simulationId, 50).catch(() => []),
        liveshieldApi.getClearedTransactions(simulationId, 50).catch(() => []),
        liveshieldApi.getReevaluationStats(simulationId).catch(() => null),
      ]);
      setRetrospectiveAlerts(alerts || []);
      setClearedTxns(cleared || []);
      setReevalStats(stats);
    } catch (err) {
      setError(err.message || 'Failed to fetch continuous risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [simulationId]);

  const handleInspectTimeline = async (txnId) => {
    setSelectedTxnId(txnId);
    setTimelineLoading(true);
    try {
      const records = await liveshieldApi.getRiskTimeline(simulationId, txnId);
      setTimelineRecords(records || []);
    } catch (err) {
      console.error('Error fetching risk timeline:', err);
      setTimelineRecords([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleManualOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideAccount.trim() || !overrideNotes.trim()) return;
    setOverrideSubmitting(true);
    setOverrideSuccess(null);
    try {
      await liveshieldApi.triggerManualReassessment(simulationId, {
        account_id: overrideAccount.trim(),
        verified_clean: overrideVerifiedClean,
        evidence_type: 'INVESTIGATOR_OVERRIDE',
        notes: overrideNotes.trim(),
      });
      setOverrideSuccess(`Successfully queued manual investigation assessment for ${overrideAccount}`);
      setOverrideAccount('');
      setOverrideNotes('');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to submit manual override');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <div className="continuous-risk-view">
      {/* 1. Header & Live Metrics KPI Cards */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-0 text-white d-flex align-items-center gap-2">
            <Activity className="text-primary" size={20} />
            Continuous Risk Re-evaluation (CRRE) Engine
          </h5>
          <small className="text-muted">
            Real-time retrospective graph reassessment & false-positive correction
          </small>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin me-1' : 'me-1'} />
          Refresh
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="bg-dark border-secondary h-100">
            <Card.Body>
              <div className="d-flex justify-content-between text-muted mb-1">
                <small>Total Reassessments</small>
                <RefreshCw size={16} className="text-info" />
              </div>
              <h3 className="mb-0 text-white">{reevalStats?.total_reassessments || 0}</h3>
              <small className="text-muted">
                {reevalStats?.total_duplicates_prevented || 0} duplicates deduped
              </small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="bg-dark border-danger h-100">
            <Card.Body>
              <div className="d-flex justify-content-between text-muted mb-1">
                <small>Retrospective Alerts</small>
                <TrendingUp size={16} className="text-danger" />
              </div>
              <h3 className="mb-0 text-danger">{reevalStats?.total_retrospective_alerts || retrospectiveAlerts.length}</h3>
              <small className="text-muted">Initially approved, subsequently escalated</small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="bg-dark border-success h-100">
            <Card.Body>
              <div className="d-flex justify-content-between text-muted mb-1">
                <small>Cleared Transactions</small>
                <TrendingDown size={16} className="text-success" />
              </div>
              <h3 className="mb-0 text-success">{reevalStats?.total_cleared || clearedTxns.length}</h3>
              <small className="text-muted">False positives evidence-cleared</small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="bg-dark border-secondary h-100">
            <Card.Body>
              <div className="d-flex justify-content-between text-muted mb-1">
                <small>Avg Reassessment Latency</small>
                <Clock size={16} className="text-warning" />
              </div>
              <h3 className="mb-0 text-warning">{reevalStats?.avg_latency_ms || 0} ms</h3>
              <small className="text-muted">Queue backlog: {reevalStats?.queue_backlog || 0}</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 2. Sub-Tabs */}
      <Card className="bg-dark border-secondary">
        <Card.Header className="bg-transparent border-secondary p-0">
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
            <Nav.Item>
              <Nav.Link eventKey="retrospective" className="text-white d-flex align-items-center gap-2">
                <ShieldAlert size={16} className="text-danger" />
                Retrospective Fraud Alerts
                <Badge bg="danger" pill>{retrospectiveAlerts.length}</Badge>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="cleared" className="text-white d-flex align-items-center gap-2">
                <ShieldCheck size={16} className="text-success" />
                Evidence-Cleared Transactions
                <Badge bg="success" pill>{clearedTxns.length}</Badge>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="override" className="text-white d-flex align-items-center gap-2">
                <UserCheck size={16} className="text-info" />
                Investigator Override Action
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>

        <Card.Body>
          {/* TAB 1: RETROSPECTIVE ALERTS */}
          {activeTab === 'retrospective' && (
            <div>
              <p className="text-muted small mb-3">
                Transactions initially evaluated as <code>APPROVED</code> (clean) whose risk was subsequently escalated to <code>HIGH_RISK</code> or <code>SUSPICIOUS</code> after downstream DC-LCG graph inference revealed money muling, circular transfers, or coordinated layering.
              </p>

              {retrospectiveAlerts.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <CheckCircle2 size={36} className="text-success mb-2" />
                  <p>No retrospective fraud escalations observed in current window.</p>
                </div>
              ) : (
                <Table responsive hover variant="dark" className="align-middle mb-0">
                  <thead>
                    <tr className="text-muted small border-secondary">
                      <th>Transaction ID</th>
                      <th>Route</th>
                      <th>Amount</th>
                      <th>Initial Payment</th>
                      <th>Initial Risk</th>
                      <th>Updated Risk</th>
                      <th>Version</th>
                      <th>Escalation Trigger Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retrospectiveAlerts.map((a) => (
                      <tr key={a.transaction_id} className="border-secondary">
                        <td className="font-monospace text-info">{a.transaction_id}</td>
                        <td>
                          <div className="small">
                            <span className="text-muted">{a.sender_account}</span> → <span className="text-white">{a.receiver_account}</span>
                          </div>
                        </td>
                        <td className="fw-semibold">${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <Badge bg="success">{a.initial_decision}</Badge>
                        </td>
                        <td>
                          <Badge bg="secondary">{(a.initial_risk_score * 100).toFixed(0)}%</Badge>
                        </td>
                        <td>
                          <Badge bg={a.current_risk_status === 'HIGH_RISK' ? 'danger' : 'warning'}>
                            {a.current_risk_status} ({(a.current_risk_score * 100).toFixed(0)}%)
                          </Badge>
                        </td>
                        <td>
                          <Badge bg="dark" className="border border-secondary">v{a.assessment_version}</Badge>
                        </td>
                        <td className="small text-muted" style={{ maxWidth: '300px' }}>
                          {a.escalation_reason}
                        </td>
                        <td>
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => handleInspectTimeline(a.transaction_id)}
                          >
                            <FileSearch size={14} className="me-1" />
                            Timeline
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 2: CLEARED TRANSACTIONS */}
          {activeTab === 'cleared' && (
            <div>
              <p className="text-muted small mb-3">
                Transactions initially flagged or held that satisfied evidence-based de-escalation criteria (verified by investigator action or resolved benign by subsequent network topology).
              </p>

              {clearedTxns.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <ShieldCheck size={36} className="text-muted mb-2" />
                  <p>No transactions cleared by evidence in current simulation.</p>
                </div>
              ) : (
                <Table responsive hover variant="dark" className="align-middle mb-0">
                  <thead>
                    <tr className="text-muted small border-secondary">
                      <th>Transaction ID</th>
                      <th>Route</th>
                      <th>Amount</th>
                      <th>Initial Status</th>
                      <th>Current Status</th>
                      <th>Clearance Mode</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clearedTxns.map((c) => (
                      <tr key={c.transaction_id} className="border-secondary">
                        <td className="font-monospace text-info">{c.transaction_id}</td>
                        <td>
                          <div className="small">
                            <span className="text-muted">{c.sender_account}</span> → <span className="text-white">{c.receiver_account}</span>
                          </div>
                        </td>
                        <td className="fw-semibold">${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <Badge bg="danger">{c.initial_risk_status}</Badge>
                        </td>
                        <td>
                          <Badge bg="success">{c.current_risk_status}</Badge>
                        </td>
                        <td>
                          <Badge bg={c.is_investigator_verified ? 'primary' : 'info'}>
                            {c.is_investigator_verified ? 'Investigator Verified' : 'Model Graph Resolution'}
                          </Badge>
                        </td>
                        <td className="small text-muted" style={{ maxWidth: '300px' }}>
                          {c.clearance_reason}
                        </td>
                        <td>
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => handleInspectTimeline(c.transaction_id)}
                          >
                            <FileSearch size={14} className="me-1" />
                            Timeline
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 3: INVESTIGATOR OVERRIDE ACTION */}
          {activeTab === 'override' && (
            <div style={{ maxWidth: '650px' }}>
              <h6 className="text-white mb-2">Submit Verified Investigation Evidence</h6>
              <p className="text-muted small mb-3">
                Manually record verified compliance or forensic evidence for an account entity. This triggers immediate retrospective re-evaluation across all associated historical transactions.
              </p>

              {overrideSuccess && <Alert variant="success">{overrideSuccess}</Alert>}

              <Form onSubmit={handleManualOverrideSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small">Target Account ID</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. ACC0012"
                    value={overrideAccount}
                    onChange={(e) => setOverrideAccount(e.target.value)}
                    required
                    className="bg-dark text-white border-secondary"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small">Verification Verdict</Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      id="verdict-clean"
                      label="Verified Clean / Legitimate Business"
                      name="verdict"
                      checked={overrideVerifiedClean}
                      onChange={() => setOverrideVerifiedClean(true)}
                      className="text-success"
                    />
                    <Form.Check
                      inline
                      type="radio"
                      id="verdict-fraud"
                      label="Confirmed Illicit / Mule Account"
                      name="verdict"
                      checked={!overrideVerifiedClean}
                      onChange={() => setOverrideVerifiedClean(false)}
                      className="text-danger"
                    />
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small">Investigator Notes & Evidence Reference</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Documented verification justification, case file reference, or proof of KYC clearance..."
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    required
                    className="bg-dark text-white border-secondary"
                  />
                </Form.Group>

                <Button
                  variant={overrideVerifiedClean ? 'success' : 'danger'}
                  type="submit"
                  disabled={overrideSubmitting || !overrideAccount.trim()}
                >
                  {overrideSubmitting ? <Spinner size="sm" className="me-2" /> : <UserCheck size={16} className="me-2" />}
                  Submit Evidence & Trigger Re-evaluation
                </Button>
              </Form>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* 3. Transaction Risk Timeline Modal */}
      <Modal
        show={!!selectedTxnId}
        onHide={() => setSelectedTxnId(null)}
        size="lg"
        centered
        contentClassName="bg-dark text-white border-secondary"
      >
        <Modal.Header closeButton closeVariant="white" className="border-secondary">
          <Modal.Title className="d-flex align-items-center gap-2 h6">
            <GitCommit size={18} className="text-info" />
            Risk Evolution Journey: <span className="font-monospace text-primary">{selectedTxnId}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {timelineLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="text-muted mt-2">Loading versioned assessment history...</p>
            </div>
          ) : timelineRecords.length === 0 ? (
            <p className="text-muted text-center py-4">No historical assessments found for this transaction.</p>
          ) : (
            <div className="timeline-container ps-3 border-start border-secondary">
              {timelineRecords.map((r, idx) => (
                <div key={r.id || idx} className="position-relative mb-4 ps-3">
                  <div
                    className="position-absolute"
                    style={{
                      left: '-22px',
                      top: '0px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: r.current_risk_status === 'HIGH_RISK' ? '#f85149' : (r.current_risk_status === 'CLEARED' ? '#3fb950' : '#58a6ff'),
                    }}
                  />
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg="dark" className="border border-secondary">Version {r.assessment_version}</Badge>
                      <Badge bg={r.current_risk_status === 'HIGH_RISK' ? 'danger' : (r.current_risk_status === 'CLEARED' ? 'success' : 'secondary')}>
                        {r.current_risk_status} ({(r.current_risk_score * 100).toFixed(1)}%)
                      </Badge>
                      <Badge bg="outline-info" className="text-muted">{r.assessment_type}</Badge>
                    </div>
                    <small className="text-muted">
                      {r.assessment_timestamp ? new Date(r.assessment_timestamp).toLocaleTimeString() : 'N/A'}
                    </small>
                  </div>

                  <p className="small text-light mb-1">{r.assessment_reason}</p>
                  
                  <div className="d-flex gap-3 text-muted small bg-black bg-opacity-25 p-2 rounded">
                    <span>Payment Status: <strong className="text-white">{r.payment_status}</strong></span>
                    <span>Model: <code>{r.model_version || 'dclcg_prod_e2e'}</code></span>
                    <span>Latency: <code>{r.processing_latency_ms?.toFixed(2)} ms</code></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-secondary">
          <Button variant="secondary" size="sm" onClick={() => setSelectedTxnId(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
