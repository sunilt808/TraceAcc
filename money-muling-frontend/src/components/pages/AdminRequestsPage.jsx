import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
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
  InputGroup,
} from 'react-bootstrap';
import { adminAPI } from '../../services/api'; // use the pre‑defined admin API

// Helper to map status to badge variant
const statusBadge = (status) => {
  const map = {
    SUBMITTED: 'secondary',
    APPROVED: 'success',
    REJECTED: 'danger',
    IN_PROGRESS: 'primary',
    COMPLETED: 'info',
  };
  return map[status] || 'light';
};

const AdminRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  // --- Modal state for Accept/Reject ---
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // 'ACCEPT' or 'REJECT'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionNote, setActionNote] = useState('');

  // --- Modal state for Assign ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAction, setAssignAction] = useState(''); // 'ASSIGN_TRACELAB' or 'ASSIGN_INVOSPACE' or 'REASSIGN'
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);

  // Fetch requests using adminAPI
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // adminAPI.getRequestQueue expects a status string; empty means all
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

  // Open Accept/Reject modal
  const openActionModal = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setActionNote('');
    setShowActionModal(true);
  };

  // Handle Accept/Reject using adminAPI
  const handleActionSubmit = async () => {
    if (!selectedRequest) return;
    try {
      await adminAPI.reviewRequest(selectedRequest.id, {
        action: actionType,
        note: actionNote,
      });
      setShowActionModal(false);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed.');
    }
  };

  // Open Assign modal and fetch assignees
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
    // REASSIGN will fetch all and filter client‑side

    setLoadingAssignees(true);
    try {
      // Fetch users from adminAPI (limit 200)
      const data = await adminAPI.listUsers(200);
      let users = data.items || [];
      if (roleFilter) {
        users = users.filter(u => u.role === roleFilter && u.is_active);
      } else {
        // For reassign, only analysts and investigators
        users = users.filter(
          u => ['TRACE_LAB_ANALYST', 'INVESTIGATOR'].includes(u.role) && u.is_active
        );
      }
      setAssignees(users);
    } catch (err) {
      alert('Could not fetch assignees.');
    } finally {
      setLoadingAssignees(false);
    }
  };

  // Handle assignment using adminAPI
  const handleAssignSubmit = async () => {
    if (!selectedRequest || !assigneeId) return;
    try {
      await adminAPI.reviewRequest(selectedRequest.id, {
        action: assignAction,
        assignee_id: parseInt(assigneeId, 10),
        note: assignNote,
        due_at: dueAt || null,
      });
      setShowAssignModal(false);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.detail || 'Assignment failed.');
    }
  };

  // Render each request row
  const renderRequestRow = (req) => (
    <tr key={req.id}>
      <td>{req.id}</td>
      <td>{req.title}</td>
      <td>{req.request_type}</td>
      <td>
        <Badge bg={statusBadge(req.status)}>{req.status}</Badge>
      </td>
      <td>{req.organization_name || 'N/A'}</td>
      <td>{req.assigned_user || 'Unassigned'}</td>
      <td>{req.assigned_team || '-'}</td>
      <td>{req.due_at ? new Date(req.due_at).toLocaleDateString() : '-'}</td>
      <td>
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            Actions
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {req.status === 'SUBMITTED' && (
              <>
                <Dropdown.Item onClick={() => openActionModal(req, 'ACCEPT')}>
                  Accept
                </Dropdown.Item>
                <Dropdown.Item onClick={() => openActionModal(req, 'REJECT')}>
                  Reject
                </Dropdown.Item>
              </>
            )}
            {(req.status === 'APPROVED' || req.status === 'SUBMITTED') && (
              <>
                <Dropdown.Item onClick={() => openAssignModal(req, 'ASSIGN_TRACELAB')}>
                  Assign to TraceLab
                </Dropdown.Item>
                <Dropdown.Item onClick={() => openAssignModal(req, 'ASSIGN_INVOSPACE')}>
                  Assign to InvoSpace
                </Dropdown.Item>
              </>
            )}
            {req.status === 'IN_PROGRESS' && (
              <Dropdown.Item onClick={() => openAssignModal(req, 'REASSIGN')}>
                Reassign
              </Dropdown.Item>
            )}
            {req.status === 'IN_PROGRESS' && (
              <Dropdown.Item onClick={() => openActionModal(req, 'COMPLETE')} disabled>
                Complete (not implemented)
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
      </td>
    </tr>
  );

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h2>Service Request Queue</h2>
        </Col>
        <Col xs="auto">
          <InputGroup>
            <Form.Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </Form.Select>
          </InputGroup>
        </Col>
      </Row>

      {/* Counts summary */}
      <Row className="mb-3">
        <Col>
          <Card className="p-2">
            <Row>
              {Object.entries(counts).map(([status, count]) => (
                <Col key={status} xs="auto">
                  <Badge bg={statusBadge(status)} className="me-1">
                    {status}: {count}
                  </Badge>
                </Col>
              ))}
              <Col xs="auto">
                <Badge bg="light" text="dark">
                  Total: {total}
                </Badge>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Organization</th>
              <th>Assigned To</th>
              <th>Team</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center">No requests found.</td>
              </tr>
            ) : (
              requests.map(renderRequestRow)
            )}
          </tbody>
        </Table>
      )}

      {/* Action Modal (Accept / Reject) */}
      <Modal show={showActionModal} onHide={() => setShowActionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{actionType === 'ACCEPT' ? 'Accept' : 'Reject'} Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Note (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Add a note..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowActionModal(false)}>Cancel</Button>
          <Button variant={actionType === 'ACCEPT' ? 'success' : 'danger'} onClick={handleActionSubmit}>
            Confirm {actionType}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Assign Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {assignAction === 'ASSIGN_TRACELAB' && 'Assign to TraceLab'}
            {assignAction === 'ASSIGN_INVOSPACE' && 'Assign to InvoSpace'}
            {assignAction === 'REASSIGN' && 'Reassign Request'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingAssignees ? (
            <Spinner animation="border" />
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Select Assignee</Form.Label>
                <Form.Select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  required
                >
                  <option value="">Choose...</option>
                  {assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Due Date (optional)</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Note (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Add a note..."
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAssignSubmit}
            disabled={!assigneeId || loadingAssignees}
          >
            Confirm Assignment
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminRequestsPage;