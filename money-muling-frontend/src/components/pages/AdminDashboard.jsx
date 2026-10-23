import React, { useEffect, useMemo, useState, useCallback } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Badge, Button, ButtonGroup, Card, Form, Table, Alert } from 'react-bootstrap';
import {
  RotateCw,
  Inbox,
  FileText,
  AlertTriangle,
  Briefcase,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Send,
  Building2,
  Users,
  Search,
  Check,
  ArrowRight,
  Filter,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import traceAccBadge from '../../assets/traceaccbadge.png';

const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'];
const REPORT_STATUSES = ['DRAFT', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'RELEASED'];

const darkCardStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
};

const cellStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
  color: '#c9d1d9',
};

// ============================================================
// SKELETON PLACEHOLDERS
// ============================================================

function SkeletonBox({ width = '100%', height = '16px', borderRadius = '4px', className = '' }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#161b22',
        backgroundImage: 'linear-gradient(90deg, #161b22 0%, #21262d 50%, #161b22 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

function StatCardSkeleton() {
  return (
    <Card className="shadow-sm h-100" style={darkCardStyle}>
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <SkeletonBox width="90px" height="12px" />
          <SkeletonBox width="28px" height="28px" borderRadius="6px" />
        </div>
        <SkeletonBox width="60px" height="32px" className="mb-2" />
        <SkeletonBox width="110px" height="11px" />
      </Card.Body>
    </Card>
  );
}

function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, idx) => (
        <td key={idx} style={cellStyle} className={idx === 0 ? 'ps-4' : idx === cols - 1 ? 'pe-4 text-end' : ''}>
          <SkeletonBox width={idx === 0 ? '140px' : idx === cols - 1 ? '160px' : '80px'} height="14px" />
        </td>
      ))}
    </tr>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeView, setActiveView] = useState('requests');
  const [requestStatus, setRequestStatus] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      setLoading(true);
      const [dashboardData, requestQueueData, reportQueueData, userData] = await Promise.all([
        adminAPI.getDashboard().catch((err) => {
          console.warn('Could not fetch dashboard metrics', err);
          return {};
        }),
        adminAPI.getRequestQueue(requestStatus || undefined).catch((err) => {
          console.warn('Could not fetch request queue', err);
          return { items: [] };
        }),
        adminAPI.getReportQueue(reportStatus || undefined).catch((err) => {
          console.warn('Could not fetch report queue', err);
          return { items: [] };
        }),
        adminAPI.listUsers(200).catch((err) => {
          console.warn('Could not fetch users list', err);
          return { items: [] };
        }),
      ]);

      setDashboard(dashboardData || {});
      setRequests(Array.isArray(requestQueueData) ? requestQueueData : requestQueueData?.items || []);
      setReports(Array.isArray(reportQueueData) ? reportQueueData : reportQueueData?.items || []);
      setUsers(Array.isArray(userData) ? userData : userData?.items || []);
    } catch (err) {
      console.error('Failed to load admin dashboard data', err);
      setError(err.response?.data?.detail || 'Failed to connect to the operations service. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [requestStatus, reportStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash message helper
  const flashSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const usersByRole = useMemo(() => ({
    TRACE_LAB_ANALYST: (users || []).filter((user) => user.role === 'TRACE_LAB_ANALYST' && user.is_active !== false),
    INVESTIGATOR: (users || []).filter((user) => user.role === 'INVESTIGATOR' && user.is_active !== false),
  }), [users]);

  const chooseAssignee = (role) => {
    const pool = usersByRole[role] || [];
    return pool.length > 0 ? pool[0].id : null;
  };

  const runRequestAction = async (id, action, assigneeRole = null) => {
    setBusyId(`request-${id}-${action}`);
    setError('');
    try {
      const assigneeId = assigneeRole ? chooseAssignee(assigneeRole) : null;
      if (assigneeRole && !assigneeId) {
        throw new Error(`No active ${assigneeRole === 'TRACE_LAB_ANALYST' ? 'TraceLab Analyst' : 'Investigator'} available for assignment.`);
      }
      await adminAPI.reviewRequest(id, {
        action,
        assignee_id: assigneeId,
      });
      flashSuccess(`Request #${id} marked as ${action.replace(/_/g, ' ')}.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Request action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const runReportAction = async (id, action) => {
    setBusyId(`report-${id}-${action}`);
    setError('');
    try {
      await adminAPI.reviewReport(id, { action });
      flashSuccess(`Report #${id} marked as ${action.replace(/_/g, ' ')}.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Report action failed.');
    } finally {
      setBusyId(null);
    }
  };

  // Status Badge Mapper
  const getRequestBadge = (status) => {
    switch (status) {
      case 'PENDING':
      case 'SUBMITTED':
        return <Badge bg="warning" text="dark">PENDING</Badge>;
      case 'APPROVED':
        return <Badge bg="success">APPROVED</Badge>;
      case 'IN_PROGRESS':
        return <Badge bg="primary">IN PROGRESS</Badge>;
      case 'COMPLETED':
        return <Badge bg="info">COMPLETED</Badge>;
      case 'REJECTED':
        return <Badge bg="danger">REJECTED</Badge>;
      default:
        return <Badge bg="secondary">{status || 'UNKNOWN'}</Badge>;
    }
  };

  const getReportBadge = (status) => {
    switch (status) {
      case 'READY_FOR_REVIEW':
      case 'UNDER_REVIEW':
        return <Badge bg="warning" text="dark">REVIEW</Badge>;
      case 'APPROVED':
        return <Badge bg="info">APPROVED</Badge>;
      case 'SIGNED':
        return <Badge bg="secondary" style={{ color: '#a371f7' }}>SIGNED</Badge>;
      case 'RELEASED':
        return <Badge bg="success">RELEASED</Badge>;
      case 'CHANGES_REQUESTED':
      case 'REJECTED':
        return <Badge bg="danger">REJECTED</Badge>;
      default:
        return <Badge bg="secondary">{status || 'DRAFT'}</Badge>;
    }
  };

  // Filter items by search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.request_type && r.request_type.toLowerCase().includes(q)) ||
        (r.assigned_user && r.assigned_user.toLowerCase().includes(q)) ||
        (r.organization_name && r.organization_name.toLowerCase().includes(q)) ||
        String(r.id).includes(q)
    );
  }, [requests, searchQuery]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.report_type && r.report_type.toLowerCase().includes(q)) ||
        (r.summary && r.summary.toLowerCase().includes(q)) ||
        String(r.id).includes(q) ||
        (r.case_id && String(r.case_id).includes(q))
    );
  }, [reports, searchQuery]);

  const activeItems = activeView === 'requests' ? filteredRequests : filteredReports;

  return (
    <AppLayout title="Admin Operations Hub">
      {/* Inline styles for custom skeleton animation */}
      <style>{`
        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Global Alerts */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError('')}
          className="bg-danger bg-opacity-10 border-danger text-danger mb-4 d-flex align-items-center justify-content-between"
        >
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline-danger" size="sm" onClick={loadData} className="ms-3 py-0 px-2" style={{ fontSize: 11 }}>
            Retry
          </Button>
        </Alert>
      )}

      {successMessage && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSuccessMessage('')}
          className="bg-success bg-opacity-10 border-success text-success mb-4 d-flex align-items-center gap-2"
        >
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {/* Top Stat Counters */}
      <div className="row g-3 mb-4">
        {loading ? (
          <>
            <div className="col-6 col-md-3"><StatCardSkeleton /></div>
            <div className="col-6 col-md-3"><StatCardSkeleton /></div>
            <div className="col-6 col-md-3"><StatCardSkeleton /></div>
            <div className="col-6 col-md-3"><StatCardSkeleton /></div>
          </>
        ) : (
          <>
            <div className="col-6 col-md-3">
              <Card className="shadow-sm h-100" style={darkCardStyle}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small text-uppercase fw-semibold" style={{ fontSize: 11 }}>
                      Pending Requests
                    </span>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: 'rgba(227, 179, 65, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#e3b341',
                      }}
                    >
                      <Clock size={15} />
                    </div>
                  </div>
                  <div className="display-6 text-warning fw-bold mt-1 mb-1" style={{ fontSize: 28 }}>
                    {dashboard?.pending_requests ?? (requests.filter((r) => r.status === 'PENDING' || r.status === 'SUBMITTED').length)}
                  </div>
                  <div className="text-secondary small" style={{ fontSize: 11 }}>
                    Waiting for admin triage
                  </div>
                </Card.Body>
              </Card>
            </div>

            <div className="col-6 col-md-3">
              <Card className="shadow-sm h-100" style={darkCardStyle}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small text-uppercase fw-semibold" style={{ fontSize: 11 }}>
                      Active Cases
                    </span>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: 'rgba(88, 166, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#58a6ff',
                      }}
                    >
                      <Briefcase size={15} />
                    </div>
                  </div>
                  <div className="display-6 text-white fw-bold mt-1 mb-1" style={{ fontSize: 28 }}>
                    {dashboard?.open_cases ?? 0}
                  </div>
                  <div className="text-secondary small" style={{ fontSize: 11 }}>
                    Under forensic analysis
                  </div>
                </Card.Body>
              </Card>
            </div>

            <div className="col-6 col-md-3">
              <Card className="shadow-sm h-100" style={darkCardStyle}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small text-uppercase fw-semibold" style={{ fontSize: 11 }}>
                      Live Alerts
                    </span>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: 'rgba(248, 81, 73, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f85149',
                      }}
                    >
                      <AlertTriangle size={15} />
                    </div>
                  </div>
                  <div className="display-6 text-danger fw-bold mt-1 mb-1" style={{ fontSize: 28 }}>
                    {dashboard?.new_alerts ?? 0}
                  </div>
                  <div className="text-secondary small" style={{ fontSize: 11 }}>
                    Unresolved mule detections
                  </div>
                </Card.Body>
              </Card>
            </div>

            <div className="col-6 col-md-3">
              <Card className="shadow-sm h-100" style={darkCardStyle}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small text-uppercase fw-semibold" style={{ fontSize: 11 }}>
                      Waiting Review
                    </span>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: 'rgba(63, 185, 80, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3fb950',
                      }}
                    >
                      <FileText size={15} />
                    </div>
                  </div>
                  <div className="display-6 text-info fw-bold mt-1 mb-1" style={{ fontSize: 28 }}>
                    {reports.filter((r) => r.status === 'READY_FOR_REVIEW' || r.status === 'UNDER_REVIEW').length}
                  </div>
                  <div className="text-secondary small" style={{ fontSize: 11 }}>
                    Reports pending release
                  </div>
                </Card.Body>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Queue View Switcher & Search Bar */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Body className="p-3 d-flex flex-wrap gap-3 align-items-center justify-content-between">
          {/* Segmented Queue View Toggler */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#010409',
              border: '1px solid #21262d',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveView('requests');
                setSearchQuery('');
              }}
              style={{
                border: activeView === 'requests' ? '1px solid #30363d' : '1px solid transparent',
                background: activeView === 'requests' ? '#161b22' : 'transparent',
                color: activeView === 'requests' ? '#f0f6fc' : '#8b949e',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: activeView === 'requests' ? 600 : 500,
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: activeView === 'requests' ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'requests') {
                  e.currentTarget.style.color = '#c9d1d9';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'requests') {
                  e.currentTarget.style.color = '#8b949e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Inbox size={14} color={activeView === 'requests' ? '#58a6ff' : '#8b949e'} />
              <span>Client Requests</span>
              <span
                style={{
                  backgroundColor: activeView === 'requests' ? '#21262d' : 'rgba(255, 255, 255, 0.05)',
                  color: activeView === 'requests' ? '#f0f6fc' : '#8b949e',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 10,
                  marginLeft: 4,
                  border: '1px solid',
                  borderColor: activeView === 'requests' ? '#30363d' : 'transparent',
                }}
              >
                {requests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('reports');
                setSearchQuery('');
              }}
              style={{
                border: activeView === 'reports' ? '1px solid #30363d' : '1px solid transparent',
                background: activeView === 'reports' ? '#161b22' : 'transparent',
                color: activeView === 'reports' ? '#f0f6fc' : '#8b949e',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: activeView === 'reports' ? 600 : 500,
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: activeView === 'reports' ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'reports') {
                  e.currentTarget.style.color = '#c9d1d9';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'reports') {
                  e.currentTarget.style.color = '#8b949e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FileText size={14} color={activeView === 'reports' ? '#58a6ff' : '#8b949e'} />
              <span>Report Review</span>
              <span
                style={{
                  backgroundColor: activeView === 'reports' ? '#21262d' : 'rgba(255, 255, 255, 0.05)',
                  color: activeView === 'reports' ? '#f0f6fc' : '#8b949e',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 10,
                  marginLeft: 4,
                  border: '1px solid',
                  borderColor: activeView === 'reports' ? '#30363d' : 'transparent',
                }}
              >
                {reports.length}
              </span>
            </button>
          </div>

          {/* Search Input and Refresh */}
          <div className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: 260 }}>
            <div className="position-relative flex-grow-1">
              <Search
                size={14}
                className="position-absolute"
                style={{ top: 10, left: 10, color: '#8b949e', pointerEvents: 'none' }}
              />
              <Form.Control
                size="sm"
                type="text"
                placeholder={activeView === 'requests' ? 'Search requests...' : 'Search reports...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: 30,
                  backgroundColor: '#010409',
                  borderColor: '#30363d',
                  color: '#c9d1d9',
                }}
              />
            </div>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={loadData}
              disabled={loading}
              title="Refresh queue data"
              className="d-flex align-items-center justify-content-center px-2 py-1.5"
              style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Main Queue Table Card */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Header
          className="py-3 d-flex flex-wrap justify-content-between align-items-center gap-3"
          style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}
        >
          <div>
            <h5 className="mb-0 text-white fw-semibold">
              {activeView === 'requests' ? 'Inbound Request Queue' : 'Cryptographic Report Queue'}
            </h5>
            <div className="text-secondary small mt-0.5">
              {activeView === 'requests'
                ? 'Triage incoming bank inquiries and assign forensic analysts'
                : 'Verify SHA-256 digital seals and approve client releases'}
            </div>
          </div>

          {/* Status Filter Dropdown */}
          <div className="d-flex align-items-center gap-2">
            <Filter size={14} className="text-secondary" />
            {activeView === 'requests' ? (
              <Form.Select
                size="sm"
                value={requestStatus}
                onChange={(e) => setRequestStatus(e.target.value)}
                style={{
                  backgroundColor: '#010409',
                  borderColor: '#30363d',
                  color: '#c9d1d9',
                  width: '180px',
                }}
              >
                <option value="">All Statuses</option>
                {REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <Form.Select
                size="sm"
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value)}
                style={{
                  backgroundColor: '#010409',
                  borderColor: '#30363d',
                  color: '#c9d1d9',
                  width: '180px',
                }}
              >
                <option value="">All Statuses</option>
                {REPORT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </Form.Select>
            )}
          </div>
        </Card.Header>

        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle" style={{ borderColor: '#21262d' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #21262d' }}>
                  <th className="ps-4 py-3" style={cellStyle}>#</th>
                  <th className="py-3" style={cellStyle}>Title / Details</th>
                  <th className="py-3" style={cellStyle}>Status</th>
                  <th className="py-3" style={cellStyle}>Unit / Scope</th>
                  <th className="py-3" style={cellStyle}>Assignee</th>
                  <th className="py-3" style={cellStyle}>Timestamp</th>
                  <th className="py-3 text-end pe-4" style={cellStyle}>Operations</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <TableRowSkeleton cols={7} />
                    <TableRowSkeleton cols={7} />
                    <TableRowSkeleton cols={7} />
                    <TableRowSkeleton cols={7} />
                  </>
                ) : activeItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5" style={{ backgroundColor: '#0d1117' }}>
                      <div className="py-3 text-secondary">
                        {activeView === 'requests' ? (
                          <Inbox size={42} className="opacity-40 mb-2" />
                        ) : (
                          <FileText size={42} className="opacity-40 mb-2" />
                        )}
                        <h6 className="text-white mt-1">No items found in this queue</h6>
                        <p className="text-secondary small mb-0">
                          {searchQuery
                            ? `No results matching "${searchQuery}". Try clearing the search query.`
                            : 'All queue items have been processed or none match the active filter.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : activeView === 'requests' ? (
                  activeItems.map((item) => {
                    const isBusy = busyId?.startsWith(`request-${item.id}`);
                    const hasAnalyst = usersByRole.TRACE_LAB_ANALYST.length > 0;
                    const hasInvestigator = usersByRole.INVESTIGATOR.length > 0;

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #161b22' }}>
                        <td className="ps-4" style={cellStyle}>
                          <span className="text-secondary small">#{item.id}</span>
                        </td>
                        <td style={cellStyle}>
                          <div className="fw-semibold text-white">{item.title || 'Untitled Request'}</div>
                          <div className="small text-secondary mt-0.5">
                            {item.request_type || 'STANDARD'} • Stage: {item.current_stage || 'ADMIN_REVIEW'}
                          </div>
                        </td>
                        <td style={cellStyle}>{getRequestBadge(item.status)}</td>
                        <td style={cellStyle}>
                          <span className="text-light small">{item.assigned_team || 'Unassigned'}</span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-light small">{item.assigned_user || '—'}</span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">
                            {item.due_at
                              ? new Date(item.due_at).toLocaleDateString()
                              : item.created_at
                              ? new Date(item.created_at).toLocaleDateString()
                              : '—'}
                          </span>
                        </td>
                        <td className="text-end pe-4" style={cellStyle}>
                          <ButtonGroup size="sm">
                            <Button
                              variant="outline-success"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runRequestAction(item.id, 'ACCEPT')}
                              style={{ fontSize: 11 }}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runRequestAction(item.id, 'REJECT')}
                              style={{ fontSize: 11 }}
                            >
                              Reject
                            </Button>
                            <Button
                              variant="outline-info"
                              size="sm"
                              disabled={isBusy || !hasAnalyst}
                              title={!hasAnalyst ? 'No active TraceLab Analyst available' : 'Assign to TraceLab'}
                              onClick={() => runRequestAction(item.id, 'ASSIGN_TRACELAB', 'TRACE_LAB_ANALYST')}
                              style={{ fontSize: 11 }}
                            >
                              TraceLab
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              disabled={isBusy || !hasInvestigator}
                              title={!hasInvestigator ? 'No active Investigator available' : 'Assign to InvoSpace'}
                              onClick={() => runRequestAction(item.id, 'ASSIGN_INVOSPACE', 'INVESTIGATOR')}
                              style={{ fontSize: 11, color: '#c9d1d9' }}
                            >
                              InvoSpace
                            </Button>
                          </ButtonGroup>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  activeItems.map((item) => {
                    const isBusy = busyId?.startsWith(`report-${item.id}`);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #161b22' }}>
                        <td className="ps-4" style={cellStyle}>
                          <span className="text-secondary small">#{item.id}</span>
                        </td>
                        <td style={cellStyle}>
                          <div className="fw-semibold text-white">{item.title || `Report #${item.id}`}</div>
                          <div className="small text-secondary mt-0.5">
                            {item.report_type || 'AUDIT'} • {item.case_id ? `Case #${item.case_id}` : 'Direct Assessment'}
                          </div>
                        </td>
                        <td style={cellStyle}>{getReportBadge(item.status)}</td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">
                            {item.service_request_id ? `Req #${item.service_request_id}` : 'Internal'}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">
                            {item.has_file ? (
                              <span className="text-success fw-semibold">Attached</span>
                            ) : (
                              <span className="text-secondary">No File</span>
                            )}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td className="text-end pe-4" style={cellStyle}>
                          <ButtonGroup size="sm">
                            <Button
                              variant="outline-success"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runReportAction(item.id, 'APPROVE')}
                              style={{ fontSize: 11 }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline-warning"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runReportAction(item.id, 'REQUEST_CHANGES')}
                              style={{ fontSize: 11 }}
                            >
                              Changes
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runReportAction(item.id, 'REJECT')}
                              style={{ fontSize: 11 }}
                            >
                              Reject
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => runReportAction(item.id, 'RELEASE')}
                              className="d-inline-flex align-items-center gap-1"
                              style={{ fontSize: 11 }}
                            >
                              <img src={traceAccBadge} alt="Stamp" style={{ width: 13, height: 13 }} />
                              <span>Release</span>
                            </Button>
                          </ButtonGroup>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Footer Info & Progress Stages */}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body className="p-3">
              <div className="text-secondary small text-uppercase fw-semibold mb-2">
                Operational Pipeline Stages
              </div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {['1. Intake', '2. Triage & Assign', '3. Lab Forensic', '4. Admin Review', '5. Digital Release'].map((step, idx) => (
                  <Badge
                    key={step}
                    bg="secondary"
                    className="px-2 py-1 font-monospace"
                    style={{ backgroundColor: idx === 3 ? '#1f6feb22' : '#161b22', color: idx === 3 ? '#58a6ff' : '#8b949e', border: '1px solid #30363d' }}
                  >
                    {step}
                  </Badge>
                ))}
              </div>
              <div className="text-secondary small mt-2" style={{ lineHeight: 1.5 }}>
                TraceAcc coordinates bank requests, forensic ML graph detection, and digitally-signed releases across isolated workspaces.
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-6">
          <Card className="shadow-sm h-100" style={darkCardStyle}>
            <Card.Body className="p-3">
              <div className="text-secondary small text-uppercase fw-semibold mb-2">
                Global Operations Metric Summary
              </div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <Badge bg="primary">{dashboard?.total_requests ?? requests.length} Requests</Badge>
                <Badge bg="warning" text="dark">{dashboard?.open_cases ?? 0} Active Cases</Badge>
                <Badge bg="danger">{dashboard?.new_alerts ?? 0} Muling Alerts</Badge>
                <Badge bg="success">
                  {reports.filter((r) => r.status === 'RELEASED').length} Released Reports
                </Badge>
              </div>
              <div className="text-secondary small mt-2" style={{ lineHeight: 1.5 }}>
                All governance decisions, user provisioning, and institution approvals remain scoped to the Admin Operations Hub.
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default AdminDashboard;
