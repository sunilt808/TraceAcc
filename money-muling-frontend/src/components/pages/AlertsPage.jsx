import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../layout/AppLayout';
import { alertsAPI, adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  NEW: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
  UNDER_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
  TRIAGED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
  FALSE_POSITIVE: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
  DISMISSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
  ESCALATED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
  CONVERTED_TO_CASE: { bg: 'rgba(163,113,247,0.15)', color: '#a371f7' },
  CLOSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.TRIAGED;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
      }}
    >
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const colors = {
    LOW: '#3fb950',
    MEDIUM: '#d29922',
    HIGH: '#e3b341',
    CRITICAL: '#f85149',
  };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: colors[severity] || '#8b949e' }}>
      {severity || '—'}
    </span>
  );
}

function AlertsPage() {
  const { role } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'ok'|'err', text }
  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');
  const [routeTarget, setRouteTarget] = useState(null);
  const [routeAssignee, setRouteAssignee] = useState('');

  const isAnalyst = role === 'TRACE_LAB_ANALYST' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isInvestigator = role === 'INVESTIGATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await alertsAPI.list(filter);
      setAlerts(data.items || []);
    } catch (err) {
      setMessage({ type: 'err', text: err.response?.data?.detail || 'Failed to load alerts' });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Admin needs the investigator list for routing.
  useEffect(() => {
    if (!isAdmin) return;
    adminAPI
      .listUsers()
      .then((data) => {
        const users = Array.isArray(data) ? data : data.items || [];
        setInvestigators(users.filter((u) => u.role === 'INVESTIGATOR'));
      })
      .catch(() => {});
  }, [isAdmin]);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleStatusChange = async (id, status) => {
    setBusyId(id);
    try {
      await alertsAPI.updateStatus(id, status);
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleEscalateSubmit = async () => {
    if (!escalateTarget) return;
    setBusyId(escalateTarget.id);
    try {
      await alertsAPI.escalate(escalateTarget.id, {
        reason: escalateReason || null,
        priority: escalateTarget.severity,
      });
      setEscalateTarget(null);
      setEscalateReason('');
      flash('ok', `Alert #${escalateTarget.id} escalated to Admin for routing.`);
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Escalation failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleRouteSubmit = async () => {
    if (!routeTarget || !routeAssignee) return;
    setBusyId(routeTarget.id);
    try {
      await alertsAPI.routeToInvestigator(routeTarget.id, Number(routeAssignee));
      const inv = investigators.find((i) => i.id === Number(routeAssignee));
      flash('ok', `Alert #${routeTarget.id} routed to ${inv?.username || 'investigator'}.`);
      setRouteTarget(null);
      setRouteAssignee('');
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Routing failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (alert) => {
    setBusyId(alert.id);
    try {
      const res = await alertsAPI.convertToCase(alert.id);
      flash('ok', `Alert #${alert.id} converted to case #${res.case.id}.`);
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Conversion failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulk = async (action) => {
    if (selected.size === 0) return;
    try {
      const res = await alertsAPI.bulkAction([...selected], action);
      flash(
        'ok',
        `${action}: ${res.updated.length} updated${res.skipped.length ? `, ${res.skipped.length} skipped` : ''}.`
      );
      setSelected(new Set());
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Bulk action failed');
    }
  };

  return (
    <AppLayout title="Alerts" subtitle="Triage detected anomalies and route them through the workflow">
      {/* Flash message */}
      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: message.type === 'ok' ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${message.type === 'ok' ? '#3fb95055' : '#f8514955'}`,
            color: message.type === 'ok' ? '#3fb950' : '#f85149',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#f0f6fc',
            fontSize: 13,
          }}
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', color: '#8b949e', fontSize: 13 }}>
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Bulk bar (analyst/admin) */}
      {isAnalyst && selected.size > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '10px 14px',
            marginBottom: 16,
            borderRadius: 8,
            background: '#161b22',
            border: '1px solid #1f6feb44',
          }}
        >
          <span style={{ fontSize: 13, color: '#c9d1d9' }}>{selected.size} selected:</span>
          {['UNDER_REVIEW', 'TRIAGE', 'FALSE_POSITIVE', 'DISMISS'].map((a) => (
            <button key={a} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleBulk(a)}>
              {a.replace(/_/g, ' ')}
            </button>
          ))}
          <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleBulk('ESCALATE')}>
            Escalate all → Admin
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '4px 10px', marginLeft: 'auto' }}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              No alerts found for the selected filter.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {isAnalyst && <th style={{ width: 30 }}></th>}
                  <th>ID</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const immutable = ['CONVERTED_TO_CASE', 'CLOSED'].includes(alert.status);
                  return (
                    <tr key={alert.id}>
                      {isAnalyst && (
                        <td>
                          {!immutable && (
                            <input
                              type="checkbox"
                              checked={selected.has(alert.id)}
                              onChange={() => toggleSelect(alert.id)}
                            />
                          )}
                        </td>
                      )}
                      <td style={{ color: '#8b949e', fontSize: 11 }}>#{alert.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>{alert.alert_type}</div>
                        {alert.detection_reason && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#8b949e',
                              maxWidth: 260,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={alert.detection_reason}
                          >
                            {alert.detection_reason}
                          </div>
                        )}
                      </td>
                      <td><SeverityBadge severity={alert.severity} /></td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: alert.risk_score > 80 ? '#f85149' : alert.risk_score > 50 ? '#e3b341' : '#3fb950',
                        }}
                      >
                        {Number(alert.risk_score).toFixed(1)}
                      </td>
                      <td><StatusBadge status={alert.status} /></td>
                      <td style={{ fontSize: 11, color: '#8b949e' }}>
                        {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {/* Analyst actions */}
                          {isAnalyst && !immutable && alert.status !== 'ESCALATED' && (
                            <>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                disabled={busyId === alert.id}
                                onClick={() => handleStatusChange(alert.id, 'UNDER_REVIEW')}
                              >
                                Review
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                disabled={busyId === alert.id}
                                onClick={() => handleStatusChange(alert.id, 'FALSE_POSITIVE')}
                              >
                                False Pos.
                              </button>
                              <button
                                className="btn-primary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                disabled={busyId === alert.id}
                                onClick={() => setEscalateTarget(alert)}
                              >
                                Escalate
                              </button>
                            </>
                          )}

                          {/* Admin routing */}
                          {isAdmin && alert.status === 'ESCALATED' && (
                            <button
                              className="btn-primary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              disabled={busyId === alert.id}
                              onClick={() => setRouteTarget(alert)}
                            >
                              Route → InvoSpace
                            </button>
                          )}

                          {/* Investigator conversion */}
                          {isInvestigator && alert.status === 'ESCALATED' && (
                            <button
                              className="btn-primary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              disabled={busyId === alert.id}
                              onClick={() => handleConvert(alert)}
                            >
                              Convert → Case
                            </button>
                          )}

                          {/* Terminal states */}
                          {immutable && (
                            <span style={{ fontSize: 11, color: '#8b949e' }}>
                              {alert.status === 'CONVERTED_TO_CASE' && alert.case_id
                                ? `Case #${alert.case_id}`
                                : 'Closed'}
                            </span>
                          )}
                          {alert.status === 'ESCALATED' && !isAdmin && !isInvestigator && (
                            <span style={{ fontSize: 11, color: '#f85149' }}>Awaiting admin routing</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Escalate modal */}
      {escalateTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(1,4,9,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEscalateTarget(null)}
        >
          <div
            className="panel"
            style={{ width: 420, margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <span>⬆️</span>
              <h3 className="panel-title">Escalate Alert #{escalateTarget.id}</h3>
            </div>
            <div className="panel-body">
              <p style={{ fontSize: 13, color: '#8b949e', marginTop: 0 }}>
                Escalation sends this alert to the <strong style={{ color: '#c9d1d9' }}>Admin Hub</strong> for
                routing to an InvoSpace investigator. It does not create a case.
              </p>
              <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>
                Reason (optional)
              </label>
              <textarea
                rows={3}
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Why does this need investigation?"
                style={{
                  width: '100%',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setEscalateTarget(null)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleEscalateSubmit}>
                  Escalate to Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route modal (admin) */}
      {routeTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(1,4,9,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setRouteTarget(null)}
        >
          <div className="panel" style={{ width: 420, margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <span>🔀</span>
              <h3 className="panel-title">Route Alert #{routeTarget.id} to InvoSpace</h3>
            </div>
            <div className="panel-body">
              <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>
                Investigator
              </label>
              <select
                value={routeAssignee}
                onChange={(e) => setRouteAssignee(e.target.value)}
                style={{
                  width: '100%',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: 13,
                }}
              >
                <option value="">Select an investigator…</option>
                {investigators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.username} ({i.email || `#${i.id}`})
                  </option>
                ))}
              </select>
              {investigators.length === 0 && (
                <p style={{ fontSize: 12, color: '#e3b341', marginTop: 8 }}>
                  No investigators found in this organization.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setRouteTarget(null)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={!routeAssignee} onClick={handleRouteSubmit}>
                  Route
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default AlertsPage;
