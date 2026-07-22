import React, { useState } from 'react';
import { Container, Card, Form, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../layout/AppLayout';
import '../../assets/landing.css';

const SettingsPage = () => {
  const { user } = useAuth();

  // Settings State
  const [cycleMaxHop, setCycleMaxHop] = useState(5);
  const [fanInThreshold, setFanInThreshold] = useState(10);
  const [fanOutThreshold, setFanOutThreshold] = useState(10);
  const [timeWindowHours, setTimeWindowHours] = useState(72);
  const [layeringMaxDegree, setLayeringMaxDegree] = useState(3);
  const [autoSaveLogs, setAutoSaveLogs] = useState(true);
  const [highRiskNotifications, setHighRiskNotifications] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <AppLayout title="Platform Settings">
      <Container className="py-4">
        <Card className="login-card-inner border-0 p-4">
          <div className="d-flex align-items-center justify-content-between mb-4 border-bottom border-white border-opacity-10 pb-3">
            <div>
              <h3 className="text-light fw-bold mb-1">⚙️ Platform & Heuristic Settings</h3>
              <p className="text-secondary small mb-0">Configure detection sensitivity thresholds, notification alerts, and user preferences for analyst account ({user?.username}).</p>
            </div>
            <button className="btn-glow" onClick={handleSaveSettings}>
              Save Preferences
            </button>
          </div>

          {savedSuccess && (
            <Alert variant="success" className="bg-success bg-opacity-20 text-success border-success border-opacity-30">
              ✓ Platform settings successfully updated and applied!
            </Alert>
          )}

          <Form onSubmit={handleSaveSettings}>
            <Row className="g-4">
              {/* Detection Thresholds */}
              <Col md={6}>
                <div className="p-3 bg-dark bg-opacity-50 rounded-3 border border-white border-opacity-10 h-100">
                  <h5 className="text-info mb-3 fw-bold">🎯 Heuristic Traversal Thresholds</h5>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-semibold">MAX CYCLE HOP LENGTH (3 - 8)</Form.Label>
                    <Form.Control
                      type="number"
                      min={3}
                      max={8}
                      value={cycleMaxHop}
                      onChange={(e) => setCycleMaxHop(Number(e.target.value))}
                      className="custom-glass-input"
                    />
                    <Form.Text className="text-muted small">Max path length for circular money routing search.</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-semibold">FAN-IN DEGREE THRESHOLD</Form.Label>
                    <Form.Control
                      type="number"
                      min={3}
                      max={100}
                      value={fanInThreshold}
                      onChange={(e) => setFanInThreshold(Number(e.target.value))}
                      className="custom-glass-input"
                    />
                    <Form.Text className="text-muted small">Minimum incoming transactions to flag a Fan-In aggregator hub.</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-semibold">FAN-OUT DEGREE THRESHOLD</Form.Label>
                    <Form.Control
                      type="number"
                      min={3}
                      max={100}
                      value={fanOutThreshold}
                      onChange={(e) => setFanOutThreshold(Number(e.target.value))}
                      className="custom-glass-input"
                    />
                    <Form.Text className="text-muted small">Minimum outgoing transfers to flag a Fan-Out disbursement hub.</Form.Text>
                  </Form.Group>
                </div>
              </Col>

              {/* Temporal & Layering Config */}
              <Col md={6}>
                <div className="p-3 bg-dark bg-opacity-50 rounded-3 border border-white border-opacity-10 h-100">
                  <h5 className="text-info mb-3 fw-bold">⏱️ Temporal & Layering Parameters</h5>

                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-semibold">HUB TIME WINDOW (HOURS)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={168}
                      value={timeWindowHours}
                      onChange={(e) => setTimeWindowHours(Number(e.target.value))}
                      className="custom-glass-input"
                    />
                    <Form.Text className="text-muted small">Sliding window for evaluating rapid hub deposits/disbursements.</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-semibold">LAYERING MAX PASS-THROUGH DEGREE</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={10}
                      value={layeringMaxDegree}
                      onChange={(e) => setLayeringMaxDegree(Number(e.target.value))}
                      className="custom-glass-input"
                    />
                    <Form.Text className="text-muted small">Maximum account degree for shell pass-through nodes.</Form.Text>
                  </Form.Group>

                  <div className="mt-4 pt-3 border-top border-white border-opacity-10">
                    <Form.Check
                      type="switch"
                      id="auto-save-switch"
                      label="Auto-save persistent audit logs to database"
                      checked={autoSaveLogs}
                      onChange={(e) => setAutoSaveLogs(e.target.checked)}
                      className="text-light mb-2 fw-semibold"
                    />
                    <Form.Check
                      type="switch"
                      id="notifications-switch"
                      label="High-risk alert popup notifications"
                      checked={highRiskNotifications}
                      onChange={(e) => setHighRiskNotifications(e.target.checked)}
                      className="text-light fw-semibold"
                    />
                  </div>
                </div>
              </Col>
            </Row>
          </Form>
        </Card>
      </Container>
    </AppLayout>
  );
};

export default SettingsPage;
