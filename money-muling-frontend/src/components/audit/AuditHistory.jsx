import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Alert, Table, Badge, Form } from 'react-bootstrap';
import {
  RotateCw,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  XCircle,
  Activity,
  LogIn,
  FlaskConical,
  ScrollText,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { auditAPI } from '../../services/api';

const blackContainerStyle = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  backgroundColor: '#000000',
  minHeight: '100%',
  color: '#e6edf3',
};

const cellStyle = {
  backgroundColor: '#000000',
  borderColor: '#1f242c',
  color: '#c9d1d9',
  fontSize: '12px',
};

// ============================================================
// SKELETON LOADERS
// ============================================================

function SkeletonBox({ width = '100%', height = '14px', borderRadius = '4px', className = '' }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#0d1117',
        backgroundImage: 'linear-gradient(90deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, idx) => (
        <td key={idx} style={cellStyle} className={idx === 0 ? 'ps-3' : idx === cols - 1 ? 'pe-3' : ''}>
          <SkeletonBox width={idx === 0 ? '110px' : idx === cols - 1 ? '160px' : '75px'} height="13px" />
        </td>
      ))}
    </tr>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const AuditHistory = () => {
  // Audit data state
  const [loginHistory, setLoginHistory] = useState([]);
  const [analyzeHistory, setAnalyzeHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [failedAttempts, setFailedAttempts] = useState([]);
  const [activeTab, setActiveTab] = useState('activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const loadAuditData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loginRes, analyzeRes, activityRes, failedRes] = await Promise.all([
        auditAPI.getLoginHistory(50).catch((err) => {
          console.warn('Login history fetch failed', err);
          return { items: [] };
        }),
        auditAPI.getAnalyzeHistory(50).catch((err) => {
          console.warn('Analyze history fetch failed', err);
          return { items: [] };
        }),
        auditAPI.getActivity(100).catch((err) => {
          console.warn('Activity fetch failed', err);
          return { items: [] };
        }),
        auditAPI.getFailedAttempts(50).catch((err) => {
          console.warn('Failed attempts fetch failed', err);
          return { items: [] };
        }),
      ]);

      setLoginHistory(loginRes.items || loginRes || []);
      setAnalyzeHistory(analyzeRes.items || analyzeRes || []);
      setActivity(activityRes.items || activityRes || []);
      setFailedAttempts(failedRes.items || failedRes || []);
    } catch (err) {
      console.error('Failed to load audit data:', err);
      setError('Failed to load audit data: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success' || s === 'succeeded' || s === 'completed') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: 'rgba(63, 185, 80, 0.12)',
            color: '#3fb950',
            border: '1px solid rgba(63, 185, 80, 0.25)',
          }}
        >
          <Check size={11} /> success
        </span>
      );
    }
    if (s === 'failed' || s === 'failure' || s === 'rejected') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: 'rgba(227, 179, 65, 0.12)',
            color: '#e3b341',
            border: '1px solid rgba(227, 179, 65, 0.25)',
          }}
        >
          <AlertTriangle size={11} /> failed
        </span>
      );
    }
    if (s === 'error' || s === 'blocked' || s === 'unauthorized') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: 'rgba(248, 81, 73, 0.12)',
            color: '#f85149',
            border: '1px solid rgba(248, 81, 73, 0.25)',
          }}
        >
          <XCircle size={11} /> error
        </span>
      );
    }
    return <Badge bg="secondary" style={{ fontSize: 10 }}>{status || 'INFO'}</Badge>;
  };

  const parseDetails = (details) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  // Compact summary for the table cell
  const renderDetailsSummary = (details, errorMsg, isExpanded) => {
    if (errorMsg) {
      return <span className="text-danger small">{errorMsg}</span>;
    }
    const parsed = parseDetails(details);
    if (!parsed) return <span className="text-secondary small">—</span>;

    if (typeof parsed === 'string') {
      return (
        <span className="text-light small text-truncate d-inline-block" style={{ maxWidth: 260 }}>
          {parsed}
        </span>
      );
    }

    // Return key tags
    const keys = [];
    if (parsed.role) keys.push(`Role: ${parsed.role}`);
    if (parsed.username) keys.push(`User: ${parsed.username}`);
    if (parsed.filename) keys.push(`File: ${parsed.filename}`);
    if (parsed.fraud_rings !== undefined) keys.push(`${parsed.fraud_rings} Rings`);
    if (parsed.suspicious_accounts !== undefined) keys.push(`${parsed.suspicious_accounts} Suspects`);

    if (keys.length > 0) {
      return (
        <span className="text-light small" style={{ color: '#8b949e' }}>
          {keys.join(' · ')}
        </span>
      );
    }

    const firstVal = Object.entries(parsed)[0];
    if (firstVal) {
      return (
        <span className="text-secondary small">
          {firstVal[0]}: <span className="text-light">{String(firstVal[1]).slice(0, 30)}</span>
        </span>
      );
    }

    return <span className="text-secondary small">Click to view payload</span>;
  };

  // Filter current tab data based on search
  const currentTabItems = useMemo(() => {
    let list = [];
    if (activeTab === 'activity') list = activity;
    else if (activeTab === 'logins') list = loginHistory;
    else if (activeTab === 'analyses') list = analyzeHistory;
    else if (activeTab === 'failed') list = failedAttempts;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((item) => {
      const parsed = parseDetails(item.details);
      const detailsStr = typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed || '');
      return (
        (item.event_action && item.event_action.toLowerCase().includes(q)) ||
        (item.event_type && item.event_type.toLowerCase().includes(q)) ||
        (item.event_status && item.event_status.toLowerCase().includes(q)) ||
        (item.ip_address && item.ip_address.toLowerCase().includes(q)) ||
        (item.error_message && item.error_message.toLowerCase().includes(q)) ||
        detailsStr.toLowerCase().includes(q)
      );
    });
  }, [activeTab, activity, loginHistory, analyzeHistory, failedAttempts, searchQuery]);

  const tabsConfig = [
    { id: 'activity', label: 'All Activity', count: activity.length, icon: Activity },
    { id: 'logins', label: 'Logins', count: loginHistory.length, icon: LogIn },
    { id: 'analyses', label: 'Analyses', count: analyzeHistory.length, icon: FlaskConical },
    { id: 'failed', label: 'Failed Attempts', count: failedAttempts.length, icon: AlertTriangle },
  ];

  return (
    <div style={blackContainerStyle}>
      {/* Shimmer animation keyframe */}
      <style>{`
        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header Bar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="text-white mb-1 fw-bold" style={{ letterSpacing: '-0.02em', fontSize: '18px' }}>
            System Audit & Compliance Log
          </h4>
          <div className="text-secondary small" style={{ fontSize: '12px' }}>
            Cryptographic audit trail of authentication and analysis events
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={loadAuditData}
            disabled={loading}
            className="d-flex align-items-center gap-1.5 px-3 py-1.5"
            style={{ backgroundColor: '#050505', borderColor: '#21262d', color: '#c9d1d9', fontSize: 12 }}
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError('')}
          className="bg-danger bg-opacity-10 border-danger text-danger mb-3 d-flex align-items-center justify-content-between"
        >
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span style={{ fontSize: 12 }}>{error}</span>
          </div>
          <Button variant="outline-danger" size="sm" onClick={loadAuditData} className="py-0 px-2" style={{ fontSize: 11 }}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Segmented Tab Controls & Search Toolbar */}
      <div
        className="d-flex flex-wrap gap-2 align-items-center justify-content-between p-2 mb-3"
        style={{
          backgroundColor: '#050505',
          border: '1px solid #1f242c',
          borderRadius: 8,
        }}
      >
        {/* Segmented Tab Bar */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#000000',
            border: '1px solid #161b22',
            borderRadius: 6,
            padding: 2,
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                style={{
                  border: isSelected ? '1px solid #30363d' : '1px solid transparent',
                  background: isSelected ? '#161b22' : 'transparent',
                  color: isSelected ? '#f0f6fc' : '#8b949e',
                  padding: '5px 10px',
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={12} color={isSelected ? '#58a6ff' : '#8b949e'} />
                <span>{tab.label}</span>
                <span
                  style={{
                    backgroundColor: isSelected ? '#21262d' : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#f0f6fc' : '#8b949e',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 8,
                    marginLeft: 2,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Filter */}
        <div className="position-relative flex-grow-1 flex-md-grow-0" style={{ minWidth: 220 }}>
          <Search
            size={13}
            className="position-absolute"
            style={{ top: 9, left: 10, color: '#8b949e', pointerEvents: 'none' }}
          />
          <Form.Control
            size="sm"
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: 28,
              backgroundColor: '#000000',
              borderColor: '#21262d',
              color: '#c9d1d9',
              fontSize: 12,
            }}
          />
        </div>
      </div>

      {/* Audit Log Table Card */}
      <Card className="shadow-none mb-4" style={{ backgroundColor: '#000000', borderColor: '#1f242c' }}>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle" style={{ borderColor: '#161b22', backgroundColor: '#000000' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f242c', backgroundColor: '#050505' }}>
                  <th style={{ ...cellStyle, width: '36px', backgroundColor: '#050505' }} className="ps-3 py-2"></th>
                  <th className="py-2" style={{ ...cellStyle, fontWeight: 600, textTransform: 'uppercase', fontSize: 11, color: '#8b949e', backgroundColor: '#050505' }}>
                    Timestamp
                  </th>
                  <th className="py-2" style={{ ...cellStyle, fontWeight: 600, textTransform: 'uppercase', fontSize: 11, color: '#8b949e', backgroundColor: '#050505' }}>
                    Type
                  </th>
                  <th className="py-2" style={{ ...cellStyle, fontWeight: 600, textTransform: 'uppercase', fontSize: 11, color: '#8b949e', backgroundColor: '#050505' }}>
                    Action
                  </th>
                  <th className="py-2" style={{ ...cellStyle, fontWeight: 600, textTransform: 'uppercase', fontSize: 11, color: '#8b949e', backgroundColor: '#050505' }}>
                    Status
                  </th>
                  <th className="py-2" style={{ ...cellStyle, fontWeight: 600, textTransform: 'uppercase', fontSize: 11, color: '#8b949e', backgroundColor: '#050505' }}>
                    IP Address
                  </th>
                  <th className="py-2 pe-3" style={{ ...cellStyle, fontWeight: 600, textTransform: 'uppercase', fontSize: 11, color: '#8b949e', backgroundColor: '#050505' }}>
                    Summary / Payload
                  </th>
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
                ) : currentTabItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5" style={{ backgroundColor: '#000000' }}>
                      <div className="text-secondary py-3">
                        <ScrollText size={32} className="opacity-40 mb-2" />
                        <h6 className="text-white mt-1" style={{ fontSize: 13 }}>No logs recorded in this section</h6>
                        <p className="text-secondary small mb-0" style={{ fontSize: 11 }}>
                          {searchQuery
                            ? `No records matching "${searchQuery}".`
                            : 'Activity events will appear here in chronological order.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentTabItems.map((log) => {
                    const rowKey = log.id || `${log.timestamp}-${log.event_action}`;
                    const isExpanded = expandedRows.has(rowKey);
                    const parsedDetails = parseDetails(log.details);

                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          onClick={() => toggleRow(rowKey)}
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid #161b22',
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? '#080c10' : '#000000',
                          }}
                        >
                          {/* Chevron Toggle */}
                          <td className="ps-3 py-2" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            {isExpanded ? (
                              <ChevronDown size={14} color="#58a6ff" />
                            ) : (
                              <ChevronRight size={14} color="#8b949e" />
                            )}
                          </td>

                          {/* Timestamp */}
                          <td className="py-2" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            <span className="text-secondary small font-monospace" style={{ fontSize: 11 }}>
                              {formatDate(log.timestamp)}
                            </span>
                          </td>

                          {/* Event Type */}
                          <td className="py-2" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            <span
                              style={{
                                padding: '1px 5px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                                backgroundColor: '#0d1117',
                                border: '1px solid #21262d',
                                color: '#8b949e',
                              }}
                            >
                              {log.event_type || 'SYSTEM'}
                            </span>
                          </td>

                          {/* Event Action */}
                          <td className="py-2" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            <span className="text-white fw-semibold" style={{ fontSize: 12 }}>
                              {log.event_action || 'action'}
                            </span>
                          </td>

                          {/* Event Status */}
                          <td className="py-2" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            {getStatusBadge(log.event_status)}
                          </td>

                          {/* IP Address */}
                          <td className="py-2" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            <span className="text-secondary small font-monospace" style={{ fontSize: 11 }}>
                              {log.ip_address || '—'}
                            </span>
                          </td>

                          {/* Details / Payload Summary */}
                          <td className="py-2 pe-3" style={{ ...cellStyle, backgroundColor: isExpanded ? '#080c10' : '#000000' }}>
                            {renderDetailsSummary(log.details, log.error_message, isExpanded)}
                          </td>
                        </tr>

                        {/* On-Demand Expandable Details Panel */}
                        {isExpanded && (
                          <tr style={{ borderBottom: '1px solid #1f242c', backgroundColor: '#05070a' }}>
                            <td colSpan="7" className="p-3" style={{ backgroundColor: '#05070a' }}>
                              <div
                                style={{
                                  backgroundColor: '#000000',
                                  border: '1px solid #21262d',
                                  borderRadius: 6,
                                  padding: '12px 16px',
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom border-secondary border-opacity-25">
                                  <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: 10, letterSpacing: '0.5px' }}>
                                    Full Event Payload & Metadata
                                  </span>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 text-decoration-none d-flex align-items-center gap-1"
                                    style={{ color: '#58a6ff', fontSize: 11 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(parsedDetails || log.error_message || log, rowKey);
                                    }}
                                  >
                                    <Copy size={11} />
                                    <span>{copiedId === rowKey ? 'Copied!' : 'Copy Payload'}</span>
                                  </Button>
                                </div>

                                {log.error_message && (
                                  <div className="mb-2">
                                    <span className="text-danger fw-semibold small">Error: </span>
                                    <span className="text-danger small">{log.error_message}</span>
                                  </div>
                                )}

                                {parsedDetails ? (
                                  <pre
                                    className="mb-0 font-monospace text-light p-2 rounded"
                                    style={{
                                      backgroundColor: '#090d13',
                                      border: '1px solid #161b22',
                                      fontSize: 11,
                                      maxHeight: 250,
                                      overflowY: 'auto',
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {typeof parsedDetails === 'object'
                                      ? JSON.stringify(parsedDetails, null, 2)
                                      : String(parsedDetails)}
                                  </pre>
                                ) : (
                                  <span className="text-secondary small font-monospace">No additional payload recorded</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AuditHistory;

