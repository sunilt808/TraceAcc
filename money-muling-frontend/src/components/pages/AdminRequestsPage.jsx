import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Table,
  Spinner,
  Alert,
  Dropdown,
  Modal,
  Form,
} from 'react-bootstrap';
import {
  Inbox,
  RotateCw,
  CheckCircle2,
  XCircle,
  UserCheck,
  Calendar,
  Building2,
  FileText,
  AlertCircle,
  MoreVertical,
  Layers,
} from 'lucide-react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';

const statusBadge = (status) => {
  const map = {
    SUBMITTED: { bg: 'secondary', label: 'SUBMITTED' },
    APPROVED: { bg: 'success', label: 'APPROVED' },
    REJECTED: { bg: 'danger', label: 'REJECTED' },
    IN_PROGRESS: { bg: 'primary', label: 'IN PROGRESS' },
    COMPLETED: { bg: 'info', label: 'COMPLETED' },
  };
  return map[status] || { bg: 'secondary', label: status || 'UNKNOWN' };
};

const darkCardStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
};

const cellStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
  color: '#c9d1d9',
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // --- Modal state for Accept/Reject ---
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // --- Modal state for Assign ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAction, setAssignAction] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminAPI.getRequestQueue(filterStatus || undefined);
      setRequests(data.items || []);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openActionModal = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setActionNote('');
    setShowActionModal(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      await adminAPI.reviewRequest(selectedRequest.id, {
        action: actionType,
        note: actionNote,
      });
      setShowActionModal(false);
      setActionSuccess(`Request #${selectedRequest.id} marked as ${actionType}.`);
      setTimeout(() => setActionSuccess(''), 4000);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const openAssignModal = async (request, action) => {
    setSelectedRequest(request);
    setAssignAction(action);
    setAssigneeId('');
    setDueAt('');
    setAssignNote('');
    setShowAssignModal(true);

    let roleFilter = '';
    if (action === 'ASSIGN_TRACELAB') roleFilter = 'TRACE_LAB_ANALYST';
    else if (action === 'ASSIGN_INVOSPACE') roleFilter = 'INVESTIGATOR';

    setLoadingAssignees(true);
    try {
      const data = await adminAPI.listUsers(200);
      let users = data.items || [];
      if (roleFilter) {
        users = users.filter((u) => u.role === roleFilter && u.is_active);
      } else {
        users = users.filter(
          (u) => ['TRACE_LAB_ANALYST', 'INVESTIGATOR'].includes(u.role) && u.is_active
        );
      }
      setAssignees(users);
    } catch (err) {
      setError('Could not fetch assignees.');
    } finally {
      setLoadingAssignees(false);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedRequest || !assigneeId) return;
    setAssignSubmitting(true);
    try {
      await adminAPI.reviewRequest(selectedRequest.id, {
        action: assignAction,
        assignee_id: parseInt(assigneeId, 10),
        note: assignNote,
        due_at: dueAt || null,
      });
      setShowAssignModal(false);
      setActionSuccess(`Request #${selectedRequest.id} successfully assigned.`);
      setTimeout(() => setActionSuccess(''), 4000);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Assignment failed.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Service Requests"
      >
      {/* Alerts */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError(null)}
          className="bg-danger bg-opacity-10 border-danger text-danger mb-4"
        >
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {actionSuccess && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setActionSuccess('')}
          className="bg-success bg-opacity-10 border-success text-success mb-4"
        >
          <div className="d-flex align-items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        </Alert>
      )}

      {/* Summary Stat Badges */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Total Requests</div>
              <div className="display-6 text-white fw-bold mt-1">{total}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Submitted</div>
              <div className="display-6 text-warning fw-bold mt-1">{counts.SUBMITTED || 0}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">In Progress</div>
              <div className="display-6 text-primary fw-bold mt-1">{counts.IN_PROGRESS || 0}</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body>
              <div className="text-secondary small text-uppercase fw-semibold">Completed</div>
              <div className="display-6 text-success fw-bold mt-1">{counts.COMPLETED || 0}</div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Header
          className="py-3 d-flex flex-wrap justify-content-between align-items-center gap-3"
          style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}
        >
          <div>
            <h5 className="text-white mb-1">Request Queue</h5>
            <div className="text-secondary small">Filter by lifecycle status and assign investigators</div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Form.Select
              size="sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                backgroundColor: '#010409',
                borderColor: '#30363d',
                color: '#c9d1d9',
                width: '180px',
              }}
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </Form.Select>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={fetchRequests}
              disabled={loading}
              className="d-flex align-items-center gap-1.5"
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        </Card.Header>

        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>
          {loading ? (
            <div className="py-5 text-center">
              <Spinner animation="border" variant="info" />
              <div className="text-secondary mt-3">Loading requests...</div>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-5 text-center text-secondary">
              <Inbox size={48} className="text-secondary opacity-50 mb-3" />
              <h5 className="text-white">No requests found</h5>
              <p className="text-secondary mb-0">There are no service requests matching your filter.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle" style={{ borderColor: '#21262d' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <th className="ps-4 py-3" style={cellStyle}>#</th>
                    <th className="py-3" style={cellStyle}>Title</th>
                    <th className="py-3" style={cellStyle}>Type</th>
                    <th className="py-3" style={cellStyle}>Status</th>
                    <th className="py-3" style={cellStyle}>Organization</th>
                    <th className="py-3" style={cellStyle}>Assigned To</th>
                    <th className="py-3" style={cellStyle}>Team</th>
                    <th className="py-3" style={cellStyle}>Due Date</th>
                    <th className="py-3 text-end pe-4" style={cellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const badgeInfo = statusBadge(req.status);
                    return (
                      <tr key={req.id}>
                        <td className="ps-4" style={cellStyle}>
                          <span className="text-secondary small">#{req.id}</span>
                        </td>
                        <td style={cellStyle}>
                          <div className="fw-semibold text-white">{req.title}</div>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">{req.request_type || 'STANDARD'}</span>
                        </td>
                        <td style={cellStyle}>
                          <Badge bg={badgeInfo.bg}>{badgeInfo.label}</Badge>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-light small">{req.organization_name || 'N/A'}</span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-light small">{req.assigned_user || 'Unassigned'}</span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">{req.assigned_team || '—'}</span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">
                            {req.due_at ? new Date(req.due_at).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td className="text-end pe-4" style={cellStyle}>
                          <Dropdown align="end">
                            <Dropdown.Toggle
                              variant="outline-secondary"
                              size="sm"
                              className="px-2 py-1"
                              style={{
                                backgroundColor: '#161b22',
                                borderColor: '#30363d',
                                color: '#c9d1d9',
                              }}
                            >
                              <MoreVertical size={14} />
                            </Dropdown.Toggle>
                            <Dropdown.Menu
                              style={{
                                backgroundColor: '#161b22',
                                borderColor: '#30363d',
                              }}
                            >
                              {req.status === 'SUBMITTED' && (
                                <>
                                  <Dropdown.Item
                                    onClick={() => openActionModal(req, 'ACCEPT')}
                                    className="text-success d-flex align-items-center gap-2"
                                  >
                                    <CheckCircle2 size={14} /> Accept Request
                                  </Dropdown.Item>
                                  <Dropdown.Item
                                    onClick={() => openActionModal(req, 'REJECT')}
                                    className="text-danger d-flex align-items-center gap-2"
                                  >
                                    <XCircle size={14} /> Reject Request
                                  </Dropdown.Item>
                                  <Dropdown.Divider style={{ borderColor: '#30363d' }} />
                                </>
                              )}
                              {(req.status === 'APPROVED' || req.status === 'SUBMITTED') && (
                                <>
                                  <Dropdown.Item
                                    onClick={() => openAssignModal(req, 'ASSIGN_TRACELAB')}
                                    className="text-info d-flex align-items-center gap-2"
                                  >
                                    <UserCheck size={14} /> Assign to TraceLab
                                  </Dropdown.Item>
                                  <Dropdown.Item
                                    onClick={() => openAssignModal(req, 'ASSIGN_INVOSPACE')}
                                    className="text-warning d-flex align-items-center gap-2"
                                  >
                                    <UserCheck size={14} /> Assign to InvoSpace
                                  </Dropdown.Item>
                                </>
                              )}
                              {req.status === 'IN_PROGRESS' && (
                                <Dropdown.Item
                                  onClick={() => openAssignModal(req, 'REASSIGN')}
                                  className="text-light d-flex align-items-center gap-2"
                                >
                                  <UserCheck size={14} /> Reassign
                                </Dropdown.Item>
                              )}
                            </Dropdown.Menu>
                          </Dropdown>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Action Modal (Accept / Reject) */}
      <Modal
        show={showActionModal}
        onHide={() => !actionLoading && setShowActionModal(false)}
        centered
        contentClassName="text-light shadow-lg"
      >
        <div style={{ backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
          <Modal.Header closeButton closeVariant="white" style={{ borderColor: '#21262d' }}>
            <Modal.Title className="text-white fs-6 fw-bold">
              {actionType === 'ACCEPT' ? 'Accept Request' : 'Reject Request'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ backgroundColor: '#0d1117' }}>
            <p className="text-secondary small mb-3">
              Request: <strong className="text-white">{selectedRequest?.title}</strong> (#{selectedRequest?.id})
            </p>
            <Form.Group className="mb-3">
              <Form.Label className="text-light fw-semibold">Note / Remarks (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Add instructions or reason..."
                className="text-white"
                style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ borderColor: '#21262d' }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowActionModal(false)}
              disabled={actionLoading}
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'ACCEPT' ? 'success' : 'danger'}
              size="sm"
              onClick={handleActionSubmit}
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner size="sm" animation="border" className="me-1" /> : null}
              Confirm {actionType}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        show={showAssignModal}
        onHide={() => !assignSubmitting && setShowAssignModal(false)}
        centered
        size="lg"
        contentClassName="text-light shadow-lg"
      >
        <div style={{ backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
          <Modal.Header closeButton closeVariant="white" style={{ borderColor: '#21262d' }}>
            <Modal.Title className="text-white fs-6 fw-bold">
              {assignAction === 'ASSIGN_TRACELAB' && 'Assign to TraceLab Analyst'}
              {assignAction === 'ASSIGN_INVOSPACE' && 'Assign to Investigator'}
              {assignAction === 'REASSIGN' && 'Reassign Request'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ backgroundColor: '#0d1117' }}>
            {loadingAssignees ? (
              <div className="py-4 text-center">
                <Spinner animation="border" variant="info" />
                <div className="text-secondary mt-2">Loading active personnel...</div>
              </div>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="text-light fw-semibold">Select Assignee *</Form.Label>
                  <Form.Select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    required
                    style={{
                      backgroundColor: '#010409',
                      borderColor: '#30363d',
                      color: '#c9d1d9',
                    }}
                  >
                    <option value="">Choose an assignee...</option>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id} style={{ backgroundColor: '#010409', color: '#c9d1d9' }}>
                        {u.username} ({u.role.replace(/_/g, ' ')}) - {u.email || 'No email'}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-light fw-semibold">Due Date (optional)</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="text-white"
                    style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-light fw-semibold">Assignment Note (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="Provide scope details, priority notes..."
                    className="text-white"
                    style={{ backgroundColor: '#010409', borderColor: '#30363d' }}
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer style={{ borderColor: '#21262d' }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowAssignModal(false)}
              disabled={assignSubmitting}
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAssignSubmit}
              disabled={!assigneeId || loadingAssignees || assignSubmitting}
            >
              {assignSubmitting ? <Spinner size="sm" animation="border" className="me-1" /> : null}
              Confirm Assignment
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </AppLayout>
  );
}