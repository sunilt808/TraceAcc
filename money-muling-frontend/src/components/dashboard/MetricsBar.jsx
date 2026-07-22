import React from 'react';
import { Row, Col, Card, Spinner } from 'react-bootstrap';

const MetricsBar = ({ summary, loading }) => {
  const metrics = [
    { label: 'Total Accounts', value: summary?.total_accounts_analyzed, default: '—' },
    { label: 'Suspicious Accounts', value: summary?.suspicious_accounts_flagged, default: '—' },
    { label: 'Fraud Rings', value: summary?.fraud_rings_detected, default: '—' },
    { label: 'Processing Time', value: summary?.processing_time_seconds, suffix: 's', default: '—' },
  ];

  return (
    <Row className="mt-3 g-3">
      {metrics.map((metric, idx) => (
        <Col key={idx} xs={6} md={3}>
          <Card className="bg-darker border-secondary text-center h-100">
            <Card.Body className="py-2">
              <div className="text-muted small text-uppercase">{metric.label}</div>
              <div className="text-light fw-bold" style={{ fontSize: '1.75rem' }}>
                {loading ? (
                  <Spinner animation="border" size="sm" variant="primary" />
                ) : (
                  <>
                    {metric.value ?? metric.default}
                    {metric.suffix && metric.value && metric.suffix}
                  </>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default MetricsBar;