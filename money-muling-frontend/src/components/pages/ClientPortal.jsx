import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { serviceRequestsAPI, reportsAPI } from '../../services/api';
import { Badge, Button, Table, Spinner, Card } from 'react-bootstrap';
import { Plus, CloudDownload } from 'react-bootstrap-icons';

function ClientPortal() {
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqData, repData] = await Promise.all([
          serviceRequestsAPI.list(),
          reportsAPI.list()
        ]);
        setRequests(reqData.items || []);
        setReports(repData.items || []);
      } catch (err) {
        console.error('Failed to load portal data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusBadge = (status) => {
    const map = { PENDING: 'warning', APPROVED: 'primary', IN_PROGRESS: 'info', COMPLETED: 'success', REJECTED: 'danger' };
    return <Badge bg={map[status] || 'secondary'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <AppLayout title="Client Portal">
        <div className="d-flex justify-content-center p-5">
          <Spinner animation="border" variant="primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Client Portal" subtitle="Manage your service requests and reports">
      <div className="d-flex justify-content-end mb-4">
        <Button variant="primary" onClick={() => navigate('/client-requests/new')}>
          <Plus size={20} className="me-1" /> New Request
        </Button>
      </div>

      <div className="row">
        <div className="col-lg-8">
          <Card className="bg-dark border-secondary mb-4 shadow-sm">
            <Card.Header className="bg-darker border-secondary">
              <h6 className="mb-0 text-light py-1">Recent Service Requests</h6>
            </Card.Header>
            <Card.Body className="p-0">
              {requests.length === 0 ? (
                <div className="p-4 text-center text-muted">No requests submitted yet.</div>
              ) : (
                <Table hover responsive className="mb-0 align-middle text-light border-secondary">
                  <thead>
                    <tr className="text-muted">
                      <th className="ps-4 border-secondary">Title</th>
                      <th className="border-secondary">Type</th>
                      <th className="border-secondary">Status</th>
                      <th className="border-secondary text-end pe-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 5).map(req => (
                      <tr key={req.id}>
                        <td className="ps-4 fw-medium border-secondary">{req.title}</td>
                        <td className="border-secondary"><Badge bg="secondary">{req.request_type}</Badge></td>
                        <td className="border-secondary">{getStatusBadge(req.status)}</td>
                        <td className="border-secondary text-end pe-4 text-muted small">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card className="bg-dark border-secondary shadow-sm">
            <Card.Header className="bg-darker border-secondary">
              <h6 className="mb-0 text-light py-1">Recent Reports</h6>
            </Card.Header>
            <Card.Body className="p-0">
              {reports.length === 0 ? (
                <div className="p-4 text-center text-muted">No reports available yet.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {reports.slice(0, 5).map(rep => (
                    <li key={rep.id} className="list-group-item bg-dark border-secondary d-flex justify-content-between align-items-center p-3">
                      <div>
                        <div className="text-light fw-medium mb-1">{rep.title}</div>
                        <div className="text-muted small">{new Date(rep.released_at).toLocaleDateString()}</div>
                      </div>
                      <Button 
                        variant="link" 
                        href={reportsAPI.downloadUrl(rep.id)} 
                        target="_blank" 
                        className="p-0 text-decoration-none"
                      >
                        <CloudDownload size={20} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default ClientPortal;
