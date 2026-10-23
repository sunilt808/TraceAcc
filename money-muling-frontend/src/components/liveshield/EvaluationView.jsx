import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, ProgressBar, Spinner } from 'react-bootstrap';
import {
  BarChart2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Network,
  Activity,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import axios from 'axios';

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



export default function EvaluationView({ simulationId, liveEvaluation }) {
  const [evaluationData, setEvaluationData] = useState(liveEvaluation || null);
  const [loading, setLoading] = useState(!liveEvaluation);

  useEffect(() => {
    if (liveEvaluation) {
      setEvaluationData(liveEvaluation);
      setLoading(false);
      return;
    }

    if (!simulationId) return;

    const fetchEval = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/liveshield/simulations/${simulationId}/evaluation`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEvaluationData(res.data);
      } catch (err) {
        console.error('Failed to fetch evaluation metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEval();
  }, [simulationId, liveEvaluation]);

  if (loading) {
    return (
      <div className="text-center py-5 text-secondary">
        <Spinner animation="border" variant="primary" className="mb-2" />
        <div>Computing statistical ground-truth evaluation...</div>
      </div>
    );
  }

  const ev = evaluationData || {
    total_transactions: 0,
    total_legitimate: 0,
    total_fraudulent: 0,
    true_positives: 0,
    true_negatives: 0,
    false_positives: 0,
    false_negatives: 0,
    precision: 0.0,
    recall: 0.0,
    f1_score: 0.0,
    accuracy: 0.0,
    false_positive_rate: 0.0,
    false_negative_rate: 0.0,
    total_sequences: 0,
    network_true_positives: 0,
    network_precision: 0.0,
    network_recall: 0.0,
    network_f1: 0.0,
    latency_screening_p50: 0.0,
    latency_screening_p95: 0.0,
    latency_screening_p99: 0.0,
    latency_total_p50: 0.0,
    latency_total_p95: 0.0,
    latency_total_p99: 0.0,
    scenario_metrics: {},
  };

  const scenarioMetrics = ev.scenario_metrics || {};

  return (
    <div className="evaluation-view">
      {/* Top High-Level KPI Summary */}
      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="bg-dark border-secondary border-opacity-25 text-light h-100 shadow-sm">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-semibold">Precision (Txn Level)</span>
                <Badge bg="primary">{(ev.precision * 100).toFixed(1)}%</Badge>
              </div>
              <div className="fs-4 fw-bold font-monospace text-primary mb-2">
                {(ev.precision * 100).toFixed(1)}%
              </div>
              <ProgressBar now={ev.precision * 100} variant="primary" style={{ height: '4px' }} />
              <div className="d-flex justify-content-between text-muted small mt-2">
                <span>TP: {ev.true_positives}</span>
                <span>FP: {ev.false_positives}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="bg-dark border-secondary border-opacity-25 text-light h-100 shadow-sm">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-semibold">Recall (Fraud Caught)</span>
                <Badge bg="success">{(ev.recall * 100).toFixed(1)}%</Badge>
              </div>
              <div className="fs-4 fw-bold font-monospace text-success mb-2">
                {(ev.recall * 100).toFixed(1)}%
              </div>
              <ProgressBar now={ev.recall * 100} variant="success" style={{ height: '4px' }} />
              <div className="d-flex justify-content-between text-muted small mt-2">
                <span>Total Fraud: {ev.total_fraudulent}</span>
                <span>Missed (FN): {ev.false_negatives}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="bg-dark border-secondary border-opacity-25 text-light h-100 shadow-sm">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-semibold">F1-Score Balance</span>
                <Badge bg="info">{(ev.f1_score * 100).toFixed(1)}%</Badge>
              </div>
              <div className="fs-4 fw-bold font-monospace text-info mb-2">
                {(ev.f1_score * 100).toFixed(1)}%
              </div>
              <ProgressBar now={ev.f1_score * 100} variant="info" style={{ height: '4px' }} />
              <div className="d-flex justify-content-between text-muted small mt-2">
                <span>FPR: {(ev.false_positive_rate * 100).toFixed(1)}%</span>
                <span>FNR: {(ev.false_negative_rate * 100).toFixed(1)}%</span>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="bg-dark border-secondary border-opacity-25 text-light h-100 shadow-sm">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-semibold">Network Sequence Recall</span>
                <Badge bg="warning" className="text-dark">{(ev.network_recall * 100).toFixed(1)}%</Badge>
              </div>
              <div className="fs-4 fw-bold font-monospace text-warning mb-2">
                {(ev.network_recall * 100).toFixed(1)}%
              </div>
              <ProgressBar now={ev.network_recall * 100} variant="warning" style={{ height: '4px' }} />
              <div className="d-flex justify-content-between text-muted small mt-2">
                <span>Multi-Hop TP: {ev.network_true_positives}</span>
                <span>Total Sequences: {ev.total_sequences}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Confusion Matrix & Latency Percentiles */}
      <Row className="g-3 mb-4">
        {/* Transaction-Level Confusion Matrix */}
        <Col md={6}>
          <Card className="bg-dark border-secondary border-opacity-25 text-light h-100 shadow-sm">
            <Card.Header className="bg-secondary bg-opacity-10 border-bottom border-secondary border-opacity-25 d-flex align-items-center gap-2 py-3">
              <ShieldCheck size={18} className="text-primary" />
              <span className="fw-semibold">Transaction-Level Ground Truth Matrix</span>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="d-flex flex-column gap-3">
                <Row className="g-3">
                  <Col xs={6}>
                    <div className="p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded text-center">
                      <div className="text-success small fw-bold text-uppercase">True Positives (TP)</div>
                      <div className="fs-3 fw-bold font-monospace text-light my-1">{ev.true_positives}</div>
                      <span className="text-muted small">Fraud accurately flagged/blocked</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded text-center">
                      <div className="text-danger small fw-bold text-uppercase">False Positives (FP)</div>
                      <div className="fs-3 fw-bold font-monospace text-light my-1">{ev.false_positives}</div>
                      <span className="text-muted small">Legitimate incorrectly flagged</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded text-center">
                      <div className="text-warning small fw-bold text-uppercase">False Negatives (FN)</div>
                      <div className="fs-3 fw-bold font-monospace text-light my-1">{ev.false_negatives}</div>
                      <span className="text-muted small">Fraud missed (false approval)</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="p-3 bg-info bg-opacity-10 border border-info border-opacity-25 rounded text-center">
                      <div className="text-info small fw-bold text-uppercase">True Negatives (TN)</div>
                      <div className="fs-3 fw-bold font-monospace text-light my-1">{ev.true_negatives}</div>
                      <span className="text-muted small">Legitimate approved cleanly</span>
                    </div>
                  </Col>
                </Row>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Monotonic Latency Percentiles */}
        <Col md={6}>
          <Card className="bg-dark border-secondary border-opacity-25 text-light h-100 shadow-sm">
            <Card.Header className="bg-secondary bg-opacity-10 border-bottom border-secondary border-opacity-25 d-flex align-items-center gap-2 py-3">
              <Clock size={18} className="text-success" />
              <span className="fw-semibold">Recorded Monotonic Latency Profile</span>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="d-flex flex-column gap-4">
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-semibold small">Fast Screening Latency</span>
                    <span className="text-muted small">Sub-millisecond target</span>
                  </div>
                  <Row className="g-2 text-center">
                    <Col xs={4}>
                      <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
                        <div className="text-secondary small">p50</div>
                        <div className="font-monospace fw-bold text-success">{ev.latency_screening_p50} ms</div>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
                        <div className="text-secondary small">p95</div>
                        <div className="font-monospace fw-bold text-success">{ev.latency_screening_p95} ms</div>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
                        <div className="text-secondary small">p99</div>
                        <div className="font-monospace fw-bold text-success">{ev.latency_screening_p99} ms</div>
                      </div>
                    </Col>
                  </Row>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-semibold small">Total Decision Latency</span>
                    <span className="text-muted small">Screening + calibrated policy</span>
                  </div>
                  <Row className="g-2 text-center">
                    <Col xs={4}>
                      <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
                        <div className="text-secondary small">p50</div>
                        <div className="font-monospace fw-bold text-primary">{ev.latency_total_p50} ms</div>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
                        <div className="text-secondary small">p95</div>
                        <div className="font-monospace fw-bold text-primary">{ev.latency_total_p95} ms</div>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="p-2 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
                        <div className="text-secondary small">p99</div>
                        <div className="font-monospace fw-bold text-primary">{ev.latency_total_p99} ms</div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Scenario Breakdown Matrix (F01–F18 Ground Truth) */}
      <Card className="bg-dark border-secondary border-opacity-25 text-light shadow-sm">
        <Card.Header className="bg-secondary bg-opacity-10 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between py-3">
          <div className="d-flex align-items-center gap-2">
            <BarChart2 size={18} className="text-primary" />
            <span className="fw-semibold">Scenario Ground Truth Breakdown</span>
          </div>
          <Badge bg="secondary">{Object.keys(scenarioMetrics).length} Active Scenarios</Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {Object.keys(scenarioMetrics).length === 0 ? (
            <div className="text-center py-5 text-secondary">
              <Activity size={32} className="opacity-50 mb-2" />
              <div>No scenario data recorded yet.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover variant="dark" className="align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="bg-secondary bg-opacity-20 text-secondary">
                  <tr>
                    <th>Typology</th>
                    <th>Total Generated</th>
                    <th>True Positives (TP)</th>
                    <th>False Negatives (Missed)</th>
                    <th>Detection Rate</th>
                    <th>Avg Risk Score</th>
                    <th>Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(scenarioMetrics).map(([scId, data]) => {
                    const detRate = parseFloat(data.detection_rate || 0.0);
                    const isLegit = scId === 'LEGITIMATE';

                    return (
                      <tr key={scId} className="border-bottom border-secondary border-opacity-10">
                        <td style={{ minWidth: '220px' }}>
                          {isLegit ? (
                            <Badge bg="secondary" className="font-monospace">LEGITIMATE</Badge>
                          ) : (
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <Badge bg="primary" className="font-monospace" style={{ fontSize: '10px', flexShrink: 0 }}>
                                {scId}
                              </Badge>
                              <span style={{ fontSize: '12px', color: '#e4e4e7' }}>
                                {scenarioLabel(scId)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="font-monospace fw-semibold">{data.total}</td>
                        <td className="font-monospace text-success">{data.tp}</td>
                        <td className="font-monospace text-danger">{data.fn}</td>
                        <td style={{ minWidth: '160px' }}>
                          {!isLegit ? (
                            <div className="d-flex align-items-center gap-2">
                              <ProgressBar
                                now={detRate * 100}
                                variant={detRate >= 0.8 ? 'success' : detRate >= 0.5 ? 'warning' : 'danger'}
                                style={{ height: '6px', width: '80px' }}
                              />
                              <span className="font-monospace small fw-bold">{(detRate * 100).toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-muted small">N/A (Legitimate)</span>
                          )}
                        </td>
                        <td className="font-monospace text-warning">
                          {(parseFloat(data.avg_risk_score || 0.0) * 100).toFixed(1)}%
                        </td>
                        <td className="font-monospace text-muted">{data.avg_latency_ms || '< 1.0'} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
