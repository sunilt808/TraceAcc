import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Badge, Button, ButtonGroup, Card, Form, Spinner, Table, Alert } from 'react-bootstrap';
import { FolderCheck, ArrowRepeat, CheckCircleFill, DashCircleFill, Diagram3Fill, FileEarmarkTextFill } from 'react-bootstrap-icons';

const requestStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'];
const reportStatuses = ['DRAFT', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'RELEASED'];

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeView, setActiveView] = useState('requests');
  const [requestStatus, setRequestStatus] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const [dashboardData, requestQueueData, reportQueueData, userData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getRequestQueue(requestStatus),
        adminAPI.getReportQueue(reportStatus),
        adminAPI.listUsers(200),
      ]);
      setDashboard(dashboardData);
      setRequests(requestQueueData.items || []);
      setReports(reportQueueData.items || []);
      setUsers(userData.items || []);
    } catch (err) {
      console.error('Failed to load admin dashboard', err);
      setError(err.response?.data?.detail || 'Failed to load operations hub');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [requestStatus, reportStatus]);

  const usersByRole = useMemo(() => ({
    TRACE_LAB_ANALYST: users.filter((user) => user.role === 'TRACE_LAB_ANALYST'),
    INVESTIGATOR: users.filter((user) => user.role === 'INVESTIGATOR'),
  }), [users]);

  const chooseAssignee = (role) => {
    const pool = usersByRole[role] || [];
    return pool.length ? pool[0].id : null;
  };

  const runRequestAction = async (id, action, assigneeRole = null) => {
    setBusyId(`request-${id}-${action}`);
    try {
      await adminAPI.reviewRequest(id, {
        action,
        assignee_id: assigneeRole ? chooseAssignee(assigneeRole) : null,
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Request action failed');
    } finally {
      setBusyId(null);
    }
  };

  const runReportAction = async (id, action) => {
    setBusyId(`report-${id}-${action}`);
    try {
      await adminAPI.reviewReport(id, { action });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Report action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Admin Operations Hub">
        <div className="p-5 text-center"><Spinner animation="border" variant="info" /></div>
      </AppLayout>
    );
  }

  const activeItems = activeView === 'requests' ? requests : reports;

  return (
    <AppLayout title="Admin Operations Hub" subtitle="TraceAcc Pro central intake, assignment, review, and release control">
      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small text-uppercase fw-bold">Pending Requests</div>
              <div className="display-6 text-light">{dashboard?.pending_requests || 0}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small text-uppercase fw-bold">Active Cases</div>
              <div className="display-6 text-light">{dashboard?.open_cases || 0}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small text-uppercase fw-bold">New Alerts</div>
              <div className="display-6 text-light">{dashboard?.new_alerts || 0}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small text-uppercase fw-bold">Waiting Review</div>
              <div className="display-6 text-light">{reports.filter((report) => report.status === 'READY_FOR_REVIEW').length}</div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Card className="bg-dark border-secondary shadow-sm mb-4">
        <Card.Body className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div>
            <div className="text-muted small text-uppercase fw-bold">Workspace Filters</div>
            <div className="text-light">Monitor request intake and report review from one control panel.</div>
          </div>
          <div className="d-flex gap-2">
            <Button variant={activeView === 'requests' ? 'primary' : 'outline-light'} onClick={() => setActiveView('requests')}>
              <Diagram3Fill className="me-2" />Client Requests
            </Button>
            <Button variant={activeView === 'reports' ? 'primary' : 'outline-light'} onClick={() => setActiveView('reports')}>
              <FileEarmarkTextFill className="me-2" />Reports
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Card className="bg-dark border-secondary shadow-sm">
        <Card.Header className="bg-transparent border-secondary d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h5 className="mb-0 text-light">{activeView === 'requests' ? 'Client Request Queue' : 'Report Review Queue'}</h5>
            <div className="text-muted small">Admin accepts, assigns, reviews, and releases items from here.</div>
          </div>
          {activeView === 'requests' ? (
            <Form.Select
              className="bg-dark text-light border-secondary"
              value={requestStatus}
              onChange={(e) => setRequestStatus(e.target.value)}
              style={{ maxWidth: 240 }}
            >
              <option value="">All request statuses</option>
              {requestStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </Form.Select>
          ) : (
            <Form.Select
              className="bg-dark text-light border-secondary"
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              style={{ maxWidth: 240 }}
            >
              <option value="">All report statuses</option>
              {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </Form.Select>
          )}
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive bordered hover variant="dark" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Team</th>
                <th>Assignee</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">No items in this queue.</td>
                </tr>
              ) : activeView === 'requests' ? activeItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="fw-semibold text-light">{item.title}</div>
                    <div className="small text-muted">{item.request_type} • {item.current_stage || 'ADMIN_REVIEW'}</div>
                  </td>
                  <td><Badge bg={item.status === 'PENDING' ? 'warning' : item.status === 'REJECTED' ? 'danger' : 'success'}>{item.status}</Badge></td>
                  <td>{item.assigned_team || 'Unassigned'}</td>
                  <td>{item.assigned_user || '-'}</td>
                  <td>{item.due_at ? new Date(item.due_at).toLocaleString() : '-'}</td>
                  <td>
                    <ButtonGroup size="sm">
                      <Button variant="success" disabled={busyId === `request-${item.id}-ACCEPT`} onClick={() => runRequestAction(item.id, 'ACCEPT')}>
                        Accept
                      </Button>
                      <Button variant="danger" disabled={busyId === `request-${item.id}-REJECT`} onClick={() => runRequestAction(item.id, 'REJECT')}>
                        Reject
                      </Button>
                      <Button variant="info" disabled={busyId === `request-${item.id}-ASSIGN_TRACELAB` || !chooseAssignee('TRACE_LAB_ANALYST')} onClick={() => runRequestAction(item.id, 'ASSIGN_TRACELAB', 'TRACE_LAB_ANALYST')}>
                        Assign TraceLab
                      </Button>
                      <Button variant="secondary" disabled={busyId === `request-${item.id}-ASSIGN_INVOSPACE` || !chooseAssignee('INVESTIGATOR')} onClick={() => runRequestAction(item.id, 'ASSIGN_INVOSPACE', 'INVESTIGATOR')}>
                        Assign InvoSpace
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              )) : activeItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="fw-semibold text-light">{item.title}</div>
                    <div className="small text-muted">{item.report_type} • {item.case_id ? `Case #${item.case_id}` : 'No case'}</div>
                  </td>
                  <td><Badge bg={item.status === 'READY_FOR_REVIEW' ? 'warning' : item.status === 'RELEASED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'secondary'}>{item.status}</Badge></td>
                  <td>-</td>
                  <td>-</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  <td>
                    <ButtonGroup size="sm">
                      <Button variant="success" disabled={busyId === `report-${item.id}-APPROVE`} onClick={() => runReportAction(item.id, 'APPROVE')}>
                        Approve
                      </Button>
                      <Button variant="warning" disabled={busyId === `report-${item.id}-REQUEST_CHANGES`} onClick={() => runReportAction(item.id, 'REQUEST_CHANGES')}>
                        Request Changes
                      </Button>
                      <Button variant="danger" disabled={busyId === `report-${item.id}-REJECT`} onClick={() => runReportAction(item.id, 'REJECT')}>
                        Reject
                      </Button>
                      <Button variant="info" disabled={busyId === `report-${item.id}-RELEASE`} onClick={() => runReportAction(item.id, 'RELEASE')}>
                        Release
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <div className="row g-3 mt-4">
        <div className="col-md-6">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small text-uppercase fw-bold mb-2">Progress Monitoring</div>
              <div className="d-flex flex-wrap gap-2">
                {['Waiting', 'Assigned', 'In Progress', 'Under Review', 'Completed'].map((step) => (
                  <Badge bg="secondary" key={step}>{step}</Badge>
                ))}
              </div>
              <div className="text-muted small mt-3">Workflow state is derived from the service-request, case, alert, and report lifecycle already in the backend.</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-6">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small text-uppercase fw-bold mb-2">Operations Summary</div>
              <div className="d-flex flex-wrap gap-2">
                <Badge bg="primary">{dashboard?.total_requests || 0} Requests</Badge>
                <Badge bg="warning">{dashboard?.open_cases || 0} Active Cases</Badge>
                <Badge bg="danger">{dashboard?.new_alerts || 0} Alerts</Badge>
                <Badge bg="success">{reports.filter((report) => report.status === 'RELEASED').length} Released Reports</Badge>
              </div>
              <div className="text-muted small mt-3">All actions stay within the admin hub; TraceLab and InvoSpace remain execution units only.</div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <div className="d-flex justify-content-end mt-3">
        <Button variant="outline-light" onClick={loadData}>
          <ArrowRepeat className="me-2" />Refresh Queue
        </Button>
      </div>
    </AppLayout>
  );
}

export default AdminDashboard;
