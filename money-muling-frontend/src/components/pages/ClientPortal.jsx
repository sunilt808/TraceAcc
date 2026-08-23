import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { serviceRequestsAPI, reportsAPI } from '../../services/api';
import { Badge, Button, Table, Spinner, Card } from 'react-bootstrap';
import { Plus, CloudDownload } from 'react-bootstrap-icons';

function ClientPortal() {
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [lastRequest, setLastRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const navigate = useNavigate();

  const handleDownload = async (report) => {
    try {
      setDownloadingId(report.id);
      await reportsAPI.download(report);
    } catch (err) {
      console.error('Download failed', err);
      alert(err.response?.data?.detail || 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqData, repData] = await Promise.all([
          serviceRequestsAPI.list(),
          reportsAPI.list(),
        ]);

        const cached = localStorage.getItem('traceacc:last_service_request');
        const parsedCached = cached ? JSON.parse(cached) : null;
        const items = reqData.items || [];

        if (parsedCached?.id && !items.some((request) => request.id === parsedCached.id)) {
          items.unshift(parsedCached);
        }

        setRequests(items);
        setReports(repData.items || []);
        setLastRequest(parsedCached);
      } catch (err) {
        console.error('Failed to load portal data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const latestRequest = useMemo(() => requests[0] || lastRequest, [requests, lastRequest]);

  const getStatusBadge = (status) => {
    const map = {
      SUBMITTED: 'warning',
      PENDING: 'warning',
      APPROVED: 'primary',
      IN_PROGRESS: 'info',
      COMPLETED: 'success',
      REJECTED: 'danger',
    };
    return <Badge bg={map[status] || 'secondary'}>{status}</Badge>;
  };

  const getWorkflowBadge = (item) => {
    if (!item?.workflow_instance_id) {
      return <Badge bg="secondary">Not queued</Badge>;
    }
    if (item.workflow_current_stage === 'REQUEST_CREATED') {
      return <Badge bg="warning" text="dark">Queued for Admin</Badge>;
    }
    if (item.workflow_current_stage === 'ADMIN_REVIEW') {
      return <Badge bg="info">In Admin Review</Badge>;
    }
    return <Badge bg="success">Workflow Active</Badge>;
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
      {latestRequest && (
        <Card className="bg-dark border-secondary mb-4 shadow-sm">
          <Card.Body className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="text-muted small text-uppercase fw-bold">Latest Submission</div>
              <div className="text-light fw-semibold">{latestRequest.title || 'Untitled request'}</div>
              <div className="text-muted small">
                Request #{latestRequest.id || '-'} · Workflow #{latestRequest.workflow_instance_id || '-'} · {latestRequest.workflow_current_stage || latestRequest.status || 'Pending'}
              </div>
            </div>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              {getStatusBadge(latestRequest.status)}
              {getWorkflowBadge(latestRequest)}
            </div>
          </Card.Body>
        </Card>
      )}

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
                      <th className="border-secondary">Workflow</th>
                      <th className="border-secondary text-end pe-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 5).map((req) => (
                      <tr key={req.id}>
                        <td className="ps-4 fw-medium border-secondary">{req.title}</td>
                        <td className="border-secondary"><Badge bg="secondary">{req.request_type}</Badge></td>
                        <td className="border-secondary">{getStatusBadge(req.status)}</td>
                        <td className="border-secondary">{getWorkflowBadge(req)}</td>
                        <td className="border-secondary text-end pe-4 text-muted small">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString() : '-'}
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
                  {reports.slice(0, 5).map((rep) => (
                    <li key={rep.id} className="list-group-item bg-dark border-secondary d-flex justify-content-between align-items-center p-3">
                      <div>
                        <div className="text-light fw-medium mb-1">{rep.title}</div>
                        <div className="text-muted small">{rep.released_at ? new Date(rep.released_at).toLocaleDateString() : 'Pending release'}</div>
                      </div>
                      <Button
                        variant="link"
                        disabled={downloadingId === rep.id}
                        onClick={() => handleDownload(rep)}
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
