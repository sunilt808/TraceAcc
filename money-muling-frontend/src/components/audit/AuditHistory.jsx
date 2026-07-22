import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Table, Badge, Tab, Tabs } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { auditAPI } from '../../services/api';

const AuditHistory = () => {
  const navigate = useNavigate();

  // Audit data
  const [loginHistory, setLoginHistory] = useState([]);
  const [analyzeHistory, setAnalyzeHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [failedAttempts, setFailedAttempts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching audit data...');
      const [loginRes, analyzeRes, activityRes, failedRes, statsRes] = await Promise.all([
        auditAPI.getLoginHistory(20),
        auditAPI.getAnalyzeHistory(20),
        auditAPI.getActivity(50),
        auditAPI.getFailedAttempts(20),
        auditAPI.getStats(),
      ]);
      
      console.log('Login history response:', loginRes);
      console.log('Analyze history response:', analyzeRes);
      console.log('Activity response:', activityRes);
      console.log('Failed attempts response:', failedRes);
      console.log('Stats response:', statsRes);

      // Backend returns 'items', not 'logs'
      setLoginHistory(loginRes.items || []);
      setAnalyzeHistory(analyzeRes.items || []);
      setActivity(activityRes.items || []);
      setFailedAttempts(failedRes.items || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load audit data:', err);
      setError('Failed to load audit data: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getStatusBadge = (status) => {
    const variants = {
      success: 'success',
      error: 'danger',
      failed: 'warning',
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const parseDetails = (details) => {
    if (!details) return {};
    if (typeof details === 'object') return details;
    try {
      return JSON.parse(details);
    } catch {
      return {};
    }
  };

  return (
    <Container fluid className="min-vh-100 bg-darker py-4">
      <Row className="justify-content-center">
        <Col xs={12} lg={10}>
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="text-light mb-0">Audit History</h3>
            <div>
              <Button
                variant="outline-primary"
                size="sm"
                className="me-2"
                onClick={loadAuditData}
                disabled={loading}
              >
                {loading ? <Spinner animation="border" size="sm" /> : '↻ Refresh'}
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => navigate('/profile')}
              >
                ← Back to Profile
              </Button>
            </div>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          {/* Stats Card */}
          {stats && (
            <Card className="bg-dark text-light border-secondary mb-4">
              <Card.Header className="border-secondary">
                <h5 className="mb-0">Activity Statistics</h5>
              </Card.Header>
              <Card.Body>
                <Row className="text-center">
                  <Col xs={4} md={2}>
                    <div className="text-info fs-4 fw-bold">{stats.total_events || 0}</div>
                    <small className="text-muted">Total Events</small>
                  </Col>
                  <Col xs={4} md={2}>
                    <div className="text-primary fs-4 fw-bold">{stats.login_count || 0}</div>
                    <small className="text-muted">Logins</small>
                  </Col>
                  <Col xs={4} md={2}>
                    <div className="text-success fs-4 fw-bold">{stats.analyze_count || 0}</div>
                    <small className="text-muted">Analyses</small>
                  </Col>
                  <Col xs={4} md={2}>
                    <div className="text-success fs-4 fw-bold">{stats.success_count || 0}</div>
                    <small className="text-muted">Succeeded</small>
                  </Col>
                  <Col xs={4} md={2}>
                    <div className="text-warning fs-4 fw-bold">{stats.failure_count || 0}</div>
                    <small className="text-muted">Failed</small>
                  </Col>
                  <Col xs={4} md={2}>
                    <div className="text-danger fs-4 fw-bold">{stats.error_count || 0}</div>
                    <small className="text-muted">Errors</small>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* Audit History Tabs */}
          <Card className="bg-dark text-light border-secondary">
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Loading audit data...</p>
                </div>
              ) : (
                <Tabs defaultActiveKey="activity" className="mb-3" variant="pills">
                  {/* Recent Activity Tab */}
                  <Tab eventKey="activity" title={`All Activity (${activity.length})`}>
                    {activity.length === 0 ? (
                      <p className="text-muted py-3">No activity recorded yet</p>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '400px', overflow: 'auto' }}>
                        <Table variant="dark" size="sm" hover striped>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#212529' }}>
                            <tr>
                              <th>Time</th>
                              <th>Type</th>
                              <th>Action</th>
                              <th>Status</th>
                              <th>IP Address</th>
                              <th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activity.map((log) => (
                              <tr key={log.id}>
                                <td className="small">{formatDate(log.timestamp)}</td>
                                <td className="small">{log.event_type}</td>
                                <td className="small">{log.event_action}</td>
                                <td>{getStatusBadge(log.event_status)}</td>
                                <td className="small">{log.ip_address || '-'}</td>
                                <td className="small text-truncate" style={{ maxWidth: '200px' }}>
                                  {log.error_message || JSON.stringify(parseDetails(log.details)) || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Tab>

                  {/* Login History Tab */}
                  <Tab eventKey="logins" title={`Logins (${loginHistory.length})`}>
                    {loginHistory.length === 0 ? (
                      <p className="text-muted py-3">No login history recorded</p>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '400px', overflow: 'auto' }}>
                        <Table variant="dark" size="sm" hover striped>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#212529' }}>
                            <tr>
                              <th>Time</th>
                              <th>Action</th>
                              <th>Status</th>
                              <th>IP Address</th>
                              <th>User Agent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loginHistory.map((log) => (
                              <tr key={log.id}>
                                <td className="small">{formatDate(log.timestamp)}</td>
                                <td className="small">{log.event_action}</td>
                                <td>{getStatusBadge(log.event_status)}</td>
                                <td className="small">{log.ip_address || '-'}</td>
                                <td className="small text-truncate" style={{ maxWidth: '200px' }}>
                                  {parseDetails(log.details)?.user_agent || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Tab>

                  {/* Analyze History Tab */}
                  <Tab eventKey="analyses" title={`Analyses (${analyzeHistory.length})`}>
                    {analyzeHistory.length === 0 ? (
                      <p className="text-muted py-3">No analysis history recorded</p>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '400px', overflow: 'auto' }}>
                        <Table variant="dark" size="sm" hover striped>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#212529' }}>
                            <tr>
                              <th>Time</th>
                              <th>Action</th>
                              <th>File</th>
                              <th>Duration</th>
                              <th>Status</th>
                              <th>Results</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyzeHistory.map((log) => {
                              const details = parseDetails(log.details);
                              return (
                                <tr key={log.id}>
                                  <td className="small">{formatDate(log.timestamp)}</td>
                                  <td className="small">{log.event_action}</td>
                                  <td className="small">{details?.filename || '-'}</td>
                                  <td className="small">{log.duration_ms ? `${log.duration_ms}ms` : '-'}</td>
                                  <td>{getStatusBadge(log.event_status)}</td>
                                  <td className="small">
                                    {details?.fraud_rings !== undefined
                                      ? `${details.fraud_rings} rings, ${details.suspicious_accounts} suspicious`
                                      : log.error_message || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Tab>

                  {/* Failed Attempts Tab */}
                  <Tab eventKey="failed" title={`Failed (${failedAttempts.length})`}>
                    {failedAttempts.length === 0 ? (
                      <p className="text-muted py-3">No failed attempts recorded</p>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '400px', overflow: 'auto' }}>
                        <Table variant="dark" size="sm" hover striped>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#212529' }}>
                            <tr>
                              <th>Time</th>
                              <th>Type</th>
                              <th>Action</th>
                              <th>IP Address</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {failedAttempts.map((log) => (
                              <tr key={log.id}>
                                <td className="small">{formatDate(log.timestamp)}</td>
                                <td className="small">{log.event_type}</td>
                                <td className="small">{log.event_action}</td>
                                <td className="small">{log.ip_address || '-'}</td>
                                <td className="small text-danger">{log.error_message || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Tab>
                </Tabs>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AuditHistory;
