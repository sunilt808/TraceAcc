import React from 'react';
import { Card, Spinner } from 'react-bootstrap';
import { Users, AlertTriangle, ShieldAlert, Timer } from 'lucide-react';

const MetricsBar = ({ summary, loading }) => {
  const metrics = [
    {
      label: 'Accounts Analyzed',
      value: summary?.total_accounts_analyzed,
      icon: Users,
      color: '#58a6ff',
      default: '—',
    },
    {
      label: 'Suspicious Accounts',
      value: summary?.suspicious_accounts_flagged,
      icon: ShieldAlert,
      color: '#f85149',
      default: '—',
    },
    {
      label: 'Fraud Rings Detected',
      value: summary?.fraud_rings_detected,
      icon: AlertTriangle,
      color: '#e3b341',
      default: '—',
    },
    {
      label: 'Processing Time',
      value: summary?.processing_time_seconds,
      suffix: 's',
      icon: Timer,
      color: '#3fb950',
      default: '—',
    },
  ];

  return (
    <div className="row g-2 mt-2">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <div key={idx} className="col-6 col-md-3">
            <Card
              style={{
                backgroundColor: '#05070a',
                borderColor: '#1f242c',
                borderRadius: 6,
              }}
            >
              <Card.Body className="p-2.5 px-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span
                    className="text-secondary small fw-medium"
                    style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}
                  >
                    {metric.label}
                  </span>
                  <Icon size={13} color={metric.color} />
                </div>
                <div className="text-white fw-bold" style={{ fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  {loading ? (
                    <Spinner animation="border" size="sm" style={{ width: 14, height: 14 }} />
                  ) : (
                    <>
                      {metric.value ?? metric.default}
                      {metric.suffix && metric.value !== undefined && metric.value !== null && metric.suffix}
                    </>
                  )}
                </div>
              </Card.Body>
            </Card>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsBar;