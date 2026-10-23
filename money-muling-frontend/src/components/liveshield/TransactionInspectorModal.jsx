import React from 'react';
import { Modal, Row, Col, Badge, Table, Button } from 'react-bootstrap';
import { ShieldAlert, Zap, Network, Clock, CheckCircle, AlertTriangle, ArrowRight, X } from 'lucide-react';

export default function TransactionInspectorModal({ show, onHide, transaction }) {
  if (!transaction) return null;

  const riskScore = parseFloat(transaction.combined_risk_score || transaction.fast_screening_score || 0.0);
  const signals = transaction.fast_screening_signals || [];
  const topPaths = transaction.dclcg_top_paths || [];
  const groundTruth = transaction.synthetic_ground_truth || 'legitimate';
  const isFraud = groundTruth === 'fraudulent';

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="dark-modal">
      <Modal.Header closeButton className="bg-dark text-light border-secondary border-opacity-25 py-3">
        <Modal.Title className="d-flex align-items-center gap-2 fs-6">
          <ShieldAlert size={18} className="text-primary" />
          <span>LiveShield Transaction Deep Inspector</span>
          <Badge bg="secondary" className="ms-2 font-monospace">
            {transaction.transaction_id}
          </Badge>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light border-secondary border-opacity-25 p-4">
        {/* Core Header Card */}
        <div className="p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25 mb-4">
          <Row className="g-3 align-items-center">
            <Col md={3}>
              <div className="text-secondary small">Amount & Currency</div>
              <div className="fs-5 fw-bold font-monospace text-light">
                ${parseFloat(transaction.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {transaction.currency || 'USD'}
              </div>
            </Col>
            <Col md={3}>
              <div className="text-secondary small">Final Decision</div>
              <div>
                <Badge
                  bg={
                    transaction.final_decision === 'REJECT' || transaction.final_decision === 'MANUAL_REJECT'
                      ? 'danger'
                      : transaction.final_decision === 'HOLD'
                      ? 'warning'
                      : transaction.final_decision === 'FLAG'
                      ? 'info'
                      : 'success'
                  }
                  className={transaction.final_decision === 'HOLD' ? 'text-dark fw-bold' : 'fw-bold'}
                >
                  {transaction.final_decision || 'APPROVE'}
                </Badge>
                {transaction.operator_action && (
                  <Badge bg="light" className="text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                    MANUAL OVERRIDE
                  </Badge>
                )}
              </div>
            </Col>
            <Col md={3}>
              <div className="text-secondary small">Calibrated Risk Score</div>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-5 fw-bold font-monospace text-warning">
                  {(riskScore * 100).toFixed(1)}%
                </span>
                <Badge bg={transaction.risk_tier === 'CRITICAL' ? 'danger' : transaction.risk_tier === 'HIGH' ? 'warning' : 'secondary'} className={transaction.risk_tier === 'HIGH' ? 'text-dark' : ''}>
                  {transaction.risk_tier || 'LOW'}
                </Badge>
              </div>
            </Col>
            <Col md={3}>
              <div className="text-secondary small">Ground Truth (Simulator)</div>
              <div>
                <Badge bg={isFraud ? 'danger' : 'success'} className="fw-bold">
                  {groundTruth.toUpperCase()}
                </Badge>
                {transaction.scenario_id && (
                  <div className="text-secondary font-monospace small mt-1">
                    Scenario: {transaction.scenario_id}
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </div>

        {/* Transfer Route */}
        <div className="p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25 mb-4">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="text-secondary small">Sender Account</div>
              <div className="font-monospace fw-semibold text-primary">{transaction.sender_account}</div>
              <div className="text-muted small">Origin Country: {transaction.source_country || 'US'}</div>
            </div>
            <div className="d-flex flex-column align-items-center px-3">
              <ArrowRight size={20} className="text-secondary" />
              <span className="text-muted small mt-1">{transaction.channel || 'ONLINE'}</span>
            </div>
            <div className="text-end">
              <div className="text-secondary small">Receiver Account</div>
              <div className="font-monospace fw-semibold text-success">{transaction.receiver_account}</div>
              <div className="text-muted small">Destination: {transaction.dest_country || 'US'}</div>
            </div>
          </div>
        </div>

        {/* Fast Screening Rules Breakdown */}
        <div className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-2">
            <Zap size={16} className="text-warning" />
            <span className="fw-bold text-uppercase small text-secondary">Fast Screening Heuristic Signals</span>
            <Badge bg="secondary" className="ms-1">{signals.length} Signals</Badge>
          </div>
          {signals.length === 0 ? (
            <div className="p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25 text-secondary small">
              No heuristic rules triggered. Transaction conforms to normal velocity and baseline thresholds.
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover variant="dark" className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                <thead className="bg-secondary bg-opacity-20 text-secondary">
                  <tr>
                    <th>Rule Name</th>
                    <th>Severity</th>
                    <th>Detection Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((sig, idx) => (
                    <tr key={idx} className="border-bottom border-secondary border-opacity-10">
                      <td className="fw-semibold text-primary">{sig.rule_name || sig.rule_id}</td>
                      <td>
                        <Badge bg={sig.severity >= 0.75 ? 'danger' : 'warning'} className={sig.severity < 0.75 ? 'text-dark' : ''}>
                          {(parseFloat(sig.severity || 0) * 100).toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="text-secondary">{sig.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>

        {/* DC-LCG Graph Inference Details */}
        <div className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-2">
            <Network size={16} className="text-info" />
            <span className="fw-bold text-uppercase small text-secondary">DC-LCG Graph Inference & Camouflage</span>
          </div>
          <div className="p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
            <Row className="g-3">
              <Col md={4}>
                <div className="text-secondary small">Model Version</div>
                <div className="font-monospace text-light small">{transaction.model_version || 'dclcg_prod_e2e_v1'}</div>
              </Col>
              <Col md={4}>
                <div className="text-secondary small">Graph Illicit Probability</div>
                <div className="fw-bold text-light font-monospace">
                  {transaction.dclcg_score !== null && transaction.dclcg_score !== undefined
                    ? `${(parseFloat(transaction.dclcg_score) * 100).toFixed(1)}%`
                    : 'Awaiting Async Cycle'}
                </div>
              </Col>
              <Col md={4}>
                <div className="text-secondary small">Camouflage / Disguise Score</div>
                <div className="fw-bold text-light font-monospace">
                  {transaction.dclcg_disguise_score !== null && transaction.dclcg_disguise_score !== undefined
                    ? `${(parseFloat(transaction.dclcg_disguise_score) * 100).toFixed(1)}%`
                    : 'N/A'}
                </div>
              </Col>
            </Row>

            {topPaths.length > 0 && (
              <div className="mt-3 pt-3 border-top border-secondary border-opacity-25">
                <div className="text-secondary small mb-2">Identified Graph Walk Paths (Muling Flow):</div>
                <div className="d-flex flex-column gap-1">
                  {topPaths.map((p, idx) => (
                    <div key={idx} className="p-2 bg-dark rounded border border-secondary border-opacity-25 font-monospace small text-info">
                      {Array.isArray(p) ? p.join(' ➔ ') : String(p)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Latency & Audit Timings */}
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <Clock size={16} className="text-success" />
            <span className="fw-bold text-uppercase small text-secondary">Latency Monotonic Timers</span>
          </div>
          <Row className="g-2">
            <Col md={4}>
              <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25 text-center">
                <div className="text-secondary small">Fast Screening Latency</div>
                <div className="fw-bold font-monospace text-success">
                  {transaction.latency_screening_ms ? `${transaction.latency_screening_ms.toFixed(2)} ms` : '< 1.00 ms'}
                </div>
              </div>
            </Col>
            <Col md={4}>
              <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25 text-center">
                <div className="text-secondary small">Total Decision Latency</div>
                <div className="fw-bold font-monospace text-primary">
                  {transaction.latency_total_ms ? `${transaction.latency_total_ms.toFixed(2)} ms` : '< 1.50 ms'}
                </div>
              </div>
            </Col>
            <Col md={4}>
              <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25 text-center">
                <div className="text-secondary small">Evaluation Outcome</div>
                <div className="fw-bold font-monospace text-light">
                  {transaction.evaluation_label || 'EVALUATED'}
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-dark border-secondary border-opacity-25 py-2">
        <Button variant="secondary" size="sm" onClick={onHide}>
          Close Inspector
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
