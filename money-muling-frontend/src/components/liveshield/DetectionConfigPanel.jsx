import React, { useState } from 'react';
import { Card, Row, Col, Form, Badge, Button, Collapse } from 'react-bootstrap';
import { Shield, Eye, UserCheck, Zap, Sliders, ChevronDown, ChevronUp, CheckCircle2, Settings } from 'lucide-react';

export default function DetectionConfigPanel({
  detectionMode,
  setDetectionMode,
  detectionConfig,
  setDetectionConfig,
  readOnly = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cfg = detectionConfig || {
    flag_threshold: 0.40,
    hold_threshold: 0.65,
    reject_threshold: 0.85,
    graph_window_size: 1500,
    graph_update_interval: 1.0,
    enable_ctr_rule: true,
    enable_velocity_rule: true,
    enable_passthrough_rule: true,
    enable_dormant_rule: true,
  };

  const updateConfig = (key, value) => {
    if (readOnly) return;
    setDetectionConfig({
      ...cfg,
      [key]: value,
    });
  };

  const modes = [
    {
      id: 'automated',
      name: 'Automated Mode',
      subtitle: 'Autonomous Policy Enforced',
      icon: Zap,
      color: 'danger',
      badge: 'Recommended for LiveShield',
      desc: 'Real-time deterministic decision policies strictly enforce APPROVE, FLAG, HOLD, and REJECT actions based on calibrated GNN and screening probabilities.',
    },
    {
      id: 'assisted',
      name: 'Assisted Mode',
      subtitle: 'Human-in-the-Loop',
      icon: UserCheck,
      color: 'warning',
      badge: 'Analyst Clearance Queue',
      desc: 'Auto-approves low risk, auto-rejects critical risk. Medium-high risk transactions are placed in the Held Review Queue for manual analyst override.',
    },
    {
      id: 'shadow',
      name: 'Shadow Mode',
      subtitle: 'Zero-Impact Audit',
      icon: Eye,
      color: 'info',
      badge: 'Passive Observation',
      desc: 'All transactions execute without blocking. Screening signals, GNN mule embeddings, and risk scores are calculated and logged for benchmarking.',
    },
  ];

  const activeRulesCount = [
    cfg.enable_ctr_rule !== false,
    cfg.enable_velocity_rule !== false,
    cfg.enable_passthrough_rule !== false,
    cfg.enable_dormant_rule !== false,
  ].filter(Boolean).length;

  return (
    <div className="detection-config-panel mb-4">
      {/* Top Compact Mode Selector Bar */}
      <Card className="bg-dark border-secondary border-opacity-25 shadow-sm">
        <Card.Body className="p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded bg-primary bg-opacity-10 text-primary">
                <Shield size={18} />
              </div>
              <div>
                <h6 className="text-white fw-bold mb-0">Detection & Decision Engine Policy</h6>
                <div className="text-muted small">
                  Select how LiveShield handles real-time alerts, blocks, and screening rules
                </div>
              </div>
            </div>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="d-flex align-items-center gap-1 border-opacity-50 text-light px-3 py-1"
            >
              <Settings size={14} className="text-info" />
              <span>{isExpanded ? 'Hide Advanced Settings' : 'Tune Thresholds & Rules'}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {/* 3 Mode Option Chips */}
          <Row className="g-2">
            {modes.map((m) => {
              const Icon = m.icon;
              const isSelected = detectionMode === m.id;
              return (
                <Col md={4} key={m.id}>
                  <div
                    onClick={() => !readOnly && setDetectionMode(m.id)}
                    className={`p-2.5 rounded-3 border transition-all h-100 cursor-pointer ${
                      isSelected
                        ? `border-${m.color} bg-${m.color} bg-opacity-10 shadow-sm`
                        : 'border-secondary border-opacity-25 bg-black bg-opacity-30 hover-card'
                    }`}
                    style={{ cursor: readOnly ? 'default' : 'pointer' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <Icon size={16} className={`text-${m.color}`} />
                        <span className="text-white fw-bold small">{m.name}</span>
                      </div>
                      {isSelected && <CheckCircle2 size={15} className={`text-${m.color}`} />}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small" style={{ fontSize: '11px' }}>
                        {m.subtitle}
                      </span>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          {/* Collapsed Status Summary Line */}
          {!isExpanded && (
            <div className="d-flex flex-wrap align-items-center justify-content-between mt-3 pt-2 border-top border-secondary border-opacity-10 small text-muted">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <span>
                  Alert Threshold: <strong className="text-warning">{(parseFloat(cfg.flag_threshold || 0.40) * 100).toFixed(0)}%</strong>
                </span>
                <span>&bull;</span>
                <span>
                  Hold Threshold: <strong className="text-primary">{(parseFloat(cfg.hold_threshold || 0.65) * 100).toFixed(0)}%</strong>
                </span>
                <span>&bull;</span>
                <span>
                  Auto-Block: <strong className="text-danger">{(parseFloat(cfg.reject_threshold || 0.85) * 100).toFixed(0)}%</strong>
                </span>
                <span>&bull;</span>
                <span>
                  GNN Window: <strong className="text-info">{cfg.graph_window_size || 1500} txns</strong>
                </span>
                <span>&bull;</span>
                <span>
                  Active Rules: <strong className="text-success">{activeRulesCount} of 4</strong>
                </span>
              </div>
              <span className="badge bg-secondary bg-opacity-25 text-muted font-monospace">
                Click 'Tune Thresholds' to adjust
              </span>
            </div>
          )}

          {/* Collapsible Detailed Configuration */}
          <Collapse in={isExpanded}>
            <div className="mt-3 pt-3 border-top border-secondary border-opacity-25">
              {/* Risk Threshold Sliders */}
              <div className="mb-3">
                <span className="text-muted small text-uppercase fw-semibold mb-2 d-block">
                  Calibrated Risk Score Thresholds
                </span>
                <Row className="g-3">
                  <Col md={4}>
                    <div className="p-2.5 bg-black bg-opacity-40 rounded border border-secondary border-opacity-25">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small text-secondary fw-semibold">Flag Alert Score</span>
                        <Badge bg="warning" className="text-dark">
                          {(parseFloat(cfg.flag_threshold || 0.40) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <Form.Range
                        min={0.10}
                        max={0.60}
                        step={0.05}
                        value={cfg.flag_threshold || 0.40}
                        onChange={(e) => updateConfig('flag_threshold', parseFloat(e.target.value))}
                        disabled={readOnly}
                      />
                      <span className="text-muted small" style={{ fontSize: '11px' }}>Triggers anomaly alert & audit log</span>
                    </div>
                  </Col>

                  <Col md={4}>
                    <div className="p-2.5 bg-black bg-opacity-40 rounded border border-secondary border-opacity-25">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small text-secondary fw-semibold">Hold Review Score</span>
                        <Badge bg="primary">
                          {(parseFloat(cfg.hold_threshold || 0.65) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <Form.Range
                        min={0.40}
                        max={0.85}
                        step={0.05}
                        value={cfg.hold_threshold || 0.65}
                        onChange={(e) => updateConfig('hold_threshold', parseFloat(e.target.value))}
                        disabled={readOnly}
                      />
                      <span className="text-muted small" style={{ fontSize: '11px' }}>Queues transaction for human decision</span>
                    </div>
                  </Col>

                  <Col md={4}>
                    <div className="p-2.5 bg-black bg-opacity-40 rounded border border-secondary border-opacity-25">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small text-secondary fw-semibold">Reject / Block Score</span>
                        <Badge bg="danger">
                          {(parseFloat(cfg.reject_threshold || 0.85) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <Form.Range
                        min={0.70}
                        max={0.99}
                        step={0.01}
                        value={cfg.reject_threshold || 0.85}
                        onChange={(e) => updateConfig('reject_threshold', parseFloat(e.target.value))}
                        disabled={readOnly}
                      />
                      <span className="text-muted small" style={{ fontSize: '11px' }}>Immediate automated rejection</span>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* DC-LCG Rolling Graph & Screening Rules Toggles */}
              <Row className="g-3">
                <Col md={5}>
                  <div className="p-2.5 bg-black bg-opacity-40 rounded border border-secondary border-opacity-25 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="text-white fw-semibold small">DC-LCG GNN Window Size</div>
                      <Badge bg="info">{cfg.graph_window_size || 1500} txns</Badge>
                    </div>
                    <Form.Select
                      size="sm"
                      className="bg-dark text-light border-secondary border-opacity-50 my-1.5"
                      value={cfg.graph_window_size || 1500}
                      onChange={(e) => updateConfig('graph_window_size', parseInt(e.target.value))}
                      disabled={readOnly}
                    >
                      <option value={500}>500 Transactions (Ultra Low Latency)</option>
                      <option value={1000}>1,000 Transactions (Balanced)</option>
                      <option value={1500}>1,500 Transactions (Recommended Deep Graph)</option>
                      <option value={3000}>3,000 Transactions (High Topology Depth)</option>
                    </Form.Select>
                    <span className="text-muted small" style={{ fontSize: '11px' }}>
                      Maintains temporal graph edges for structural camouflage detection
                    </span>
                  </div>
                </Col>

                <Col md={7}>
                  <div className="p-2.5 bg-black bg-opacity-40 rounded border border-secondary border-opacity-25 h-100">
                    <div className="text-white fw-semibold small mb-2">Enabled Fast Screening Heuristics</div>
                    <Row className="g-2">
                      <Col xs={6}>
                        <Form.Check
                          type="switch"
                          id="rule-ctr"
                          label="CTR Structuring ($8k-$9.9k)"
                          checked={cfg.enable_ctr_rule !== false}
                          onChange={(e) => updateConfig('enable_ctr_rule', e.target.checked)}
                          disabled={readOnly}
                          className="small text-secondary"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Check
                          type="switch"
                          id="rule-velocity"
                          label="Velocity Anomaly (1m/5m)"
                          checked={cfg.enable_velocity_rule !== false}
                          onChange={(e) => updateConfig('enable_velocity_rule', e.target.checked)}
                          disabled={readOnly}
                          className="small text-secondary"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Check
                          type="switch"
                          id="rule-passthrough"
                          label="Rapid Pass-Through Drain"
                          checked={cfg.enable_passthrough_rule !== false}
                          onChange={(e) => updateConfig('enable_passthrough_rule', e.target.checked)}
                          disabled={readOnly}
                          className="small text-secondary"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Check
                          type="switch"
                          id="rule-dormant"
                          label="Dormant Account Wake-Up"
                          checked={cfg.enable_dormant_rule !== false}
                          onChange={(e) => updateConfig('enable_dormant_rule', e.target.checked)}
                          disabled={readOnly}
                          className="small text-secondary"
                        />
                      </Col>
                    </Row>
                  </div>
                </Col>
              </Row>
            </div>
          </Collapse>
        </Card.Body>
      </Card>
    </div>
  );
}
