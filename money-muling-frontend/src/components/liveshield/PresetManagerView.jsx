import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Badge, Form, Spinner, Alert, Modal } from 'react-bootstrap';
import {
  Sliders,
  Play,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  Layers,
  Zap,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';

export default function PresetManagerView({ onNavigate }) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await liveshieldApi.getPresets();
      setPresets(data || []);
    } catch (err) {
      console.error('Failed to load presets:', err);
      setError('Failed to fetch simulation presets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this custom preset?')) return;
    try {
      await liveshieldApi.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete preset');
    }
  };

  return (
    <div className="preset-manager">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
            <Sliders className="text-info" size={26} />
            Preset Templates & Benchmarks
          </h2>
          <p className="text-muted mb-0">
            Pre-configured workload archetypes, stress tests, and custom reproducible parameter bundles
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => onNavigate('new')}
          className="d-flex align-items-center gap-1"
        >
          <Zap size={14} /> Create New Template
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="border-0 bg-danger bg-opacity-10 text-danger mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" size="sm" />
        </div>
      ) : (
        <Row className="g-4">
          {presets.map((p) => {
            const isSystem = p.is_system;
            const config = p.config || {};
            return (
              <Col md={6} lg={4} key={p.id}>
                <Card className="bg-dark border-secondary border-opacity-25 h-100 d-flex flex-column">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-white">{p.name}</span>
                    </div>
                    {isSystem ? (
                      <Badge bg="secondary" className="small">SYSTEM</Badge>
                    ) : (
                      <Badge bg="info" className="small">CUSTOM</Badge>
                    )}
                  </Card.Header>
                  <Card.Body className="p-4 flex-grow-1">
                    <p className="text-muted small mb-3">{p.description}</p>
                    <div className="d-flex flex-column gap-2 mb-3">
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Target Throughput:</span>
                        <span className="font-monospace text-primary fw-bold">
                          {config.target_tps || 50} TPS
                        </span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Execution Window:</span>
                        <span className="font-monospace text-white">
                          {config.duration_seconds || 60}s ({Math.floor((config.duration_seconds || 60) / 60)}m)
                        </span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Fraud Allocation:</span>
                        <span className="font-monospace text-danger fw-bold">
                          {config.fraud_percentage || config.fraud_matrix?.fraud_traffic_ratio * 100 || 15}%
                        </span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Configuration Mode:</span>
                        <span className="text-uppercase text-white font-monospace">
                          {p.mode || 'basic'}
                        </span>
                      </div>
                    </div>
                  </Card.Body>
                  <Card.Footer className="bg-dark bg-opacity-50 border-top border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate('new', { presetId: p.id, preset: p })}
                      className="d-flex align-items-center gap-1"
                    >
                      <Play size={12} /> Launch Template
                    </Button>
                    {!isSystem && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </Card.Footer>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
