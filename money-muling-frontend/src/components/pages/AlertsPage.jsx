import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '../layout/AppLayout';
import { alertsAPI, adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Users,
  Activity,
  Zap,
} from 'lucide-react';
import { Modal, Table, Button, Badge, Spinner, Form, Row, Col, Card } from 'react-bootstrap';

const STATUS_CONFIG = {
  NEW: { bg: 'rgba(56,139,253,0.15)', color: '#58a6ff', border: 'rgba(56,139,253,0.3)', label: 'New Signal' },
  UNDER_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341', border: 'rgba(227,179,65,0.3)', label: 'Under Review' },
  TRIAGED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e', border: 'rgba(139,148,158,0.3)', label: 'Triaged' },
  FALSE_POSITIVE: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950', border: 'rgba(63,185,80,0.3)', label: 'Legit / False Pos.' },
  DISMISSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e', border: 'rgba(139,148,158,0.3)', label: 'Dismissed' },
  ESCALATED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149', border: 'rgba(248,81,73,0.3)', label: 'Confirmed Fraud / Escalated' },
  CONVERTED_TO_CASE: { bg: 'rgba(163,113,247,0.15)', color: '#a371f7', border: 'rgba(163,113,247,0.3)', label: 'Converted to Case' },
  CLOSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e', border: 'rgba(139,148,158,0.3)', label: 'Closed' },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.TRIAGED;
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        display: 'inline-block',
      }}
    >
      {c.label || (status || '—').replace(/_/g, ' ')}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const colors = {
    LOW: { color: '#3fb950', bg: 'rgba(63,185,80,0.1)' },
    MEDIUM: { color: '#d29922', bg: 'rgba(210,153,34,0.1)' },
    HIGH: { color: '#e3b341', bg: 'rgba(227,179,65,0.1)' },
    CRITICAL: { color: '#f85149', bg: 'rgba(248,81,73,0.1)' },
  };
  const s = colors[severity] || { color: '#8b949e', bg: 'rgba(139,148,158,0.1)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, padding: '2px 6px', borderRadius: 4, background: s.bg }}>
      {severity || '—'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// INVESTIGATOR STEP-BY-STEP WORKFLOW GUIDE
// ─────────────────────────────────────────────────────────────
function InvestigatorGuideBanner({ activeStep = 1, onStepClick }) {
  const steps = [
    { num: 1, title: 'Step 1: Signal Triage', desc: 'Scan anomaly signals & high-risk triggers' },
    { num: 2, title: 'Step 2: Inspect Accounts & Txns', desc: 'Examine accounts, flow amounts & graph paths' },
    { num: 3, title: 'Step 3: Classify Legit vs. Fraud', desc: 'Clear false positives or confirm fraud' },
    { num: 4, title: 'Step 4: Escalate to Case', desc: 'Open forensic case file for report release' },
  ];

  return (
    <Card style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8 }} className="mb-4 shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <Zap size={16} color="#e3b341" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f6fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Investigator Standard Operating Procedure (SOP)
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#8b949e' }}>
            Strict One-Way Triage: Classified alerts are moved out of active queue
          </span>
        </div>

        <div className="row g-2 pt-1">
          {steps.map((step) => {
            const isCurrent = activeStep === step.num;
            return (
              <div key={step.num} className="col-12 col-md-3">
                <div
                  onClick={() => onStepClick && onStepClick(step.num)}
                  style={{
                    background: isCurrent ? 'rgba(56,139,253,0.12)' : '#161b22',
                    border: `1px solid ${isCurrent ? '#388bfd' : '#30363d'}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: isCurrent ? '#1f6feb' : '#21262d',
                        color: isCurrent ? '#ffffff' : '#8b949e',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {step.num}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? '#58a6ff' : '#f0f6fc' }}>
                      {step.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.3, paddingLeft: 28 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
}

// Safe formatter for alert trigger reasons that can be strings, objects or JSON
const getReasonText = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.reason && val.details) return `${val.reason}: ${typeof val.details === 'object' ? JSON.stringify(val.details) : val.details}`;
    if (val.reason) return typeof val.reason === 'object' ? JSON.stringify(val.reason) : String(val.reason);
    if (val.details) return typeof val.details === 'object' ? JSON.stringify(val.details) : String(val.details);
    if (val.message) return String(val.message);
    if (val.description) return String(val.description);
    return JSON.stringify(val);
  }
  return String(val);
};

function AlertsPage() {
  const { role } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'CLEARED' | 'FRAUD' | 'ALL'
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  // Entities Inspection Modal
  const [inspectAlert, setInspectAlert] = useState(null);
  const [inspectData, setInspectData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Escalate / Route / Legit Modals
  const [confirmLegitTarget, setConfirmLegitTarget] = useState(null);
  const [confirmLegitReason, setConfirmLegitReason] = useState('');
  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');
  const [routeTarget, setRouteTarget] = useState(null);
  const [routeAssignee, setRouteAssignee] = useState('');

  const isAnalyst = role === 'TRACE_LAB_ANALYST' || role === 'ADMIN';
  const isInvestigator = role === 'INVESTIGATOR' || role === 'ADMIN';
  const isAdmin = role === 'ADMIN';

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await alertsAPI.list();
      setAlerts(data.items || []);
    } catch (err) {
      setMessage({ type: 'err', text: err.response?.data?.detail || 'Failed to load alerts' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

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

  // Open Entity & Transaction Inspector
  const handleOpenInspect = async (alert) => {
    setInspectAlert(alert);
    setInspectLoading(true);
    try {
      const entities = await alertsAPI.getEntities(alert.id);
      setInspectData(entities);
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Failed to load alert entity details');
    } finally {
      setInspectLoading(false);
    }
  };

  // Classify Alert (Legit vs Fraud) -> Removes from Pending Triage immediately
  const handleClassifyAlert = async (alertId, action, reason = '') => {
    setBusyId(alertId);
    try {
      await alertsAPI.decideAlert(alertId, action, reason);
      const isLegit = action.includes('LEGIT') || action.includes('FALSE') || action.includes('DISMISS');
      const newStatus = isLegit ? 'FALSE_POSITIVE' : 'ESCALATED';

      // Immediately update local state so alert vanishes from pending triage queue
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
      );

      flash(
        'ok',
        isLegit
          ? `Alert #${alertId} marked as Legitimate / False Positive and removed from pending queue.`
          : `Alert #${alertId} confirmed as Fraud and escalated to investigation.`
      );
      if (inspectAlert?.id === alertId) {
        setInspectAlert(null);
      }
      setConfirmLegitTarget(null);
      setConfirmLegitReason('');
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Classification failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleEscalateSubmit = async () => {
    if (!escalateTarget) return;
    const targetId = escalateTarget.id;
    setBusyId(targetId);
    try {
      await alertsAPI.escalate(targetId, {
        reason: escalateReason || null,
        priority: escalateTarget.severity,
      });

      // Immediately update local state to remove from pending triage queue
      setAlerts((prev) =>
        prev.map((a) => (a.id === targetId ? { ...a, status: 'ESCALATED' } : a))
      );

      setEscalateTarget(null);
      setEscalateReason('');
      flash('ok', `Alert #${targetId} confirmed as Fraud & escalated. Removed from pending queue.`);
      await loadAlerts();
    } catch (err) {
      flash('err', err.response?.data?.detail || 'Escalation failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleRouteSubmit = async () => {
    if (!routeTarget || !routeAssignee) return;
    const targetId = routeTarget.id;
    setBusyId(targetId);
    try {
      await alertsAPI.routeToInvestigator(targetId, Number(routeAssignee));
      const inv = investigators.find((i) => i.id === Number(routeAssignee));

      setAlerts((prev) =>
        prev.map((a) => (a.id === targetId ? { ...a, routed_to_id: Number(routeAssignee), status: 'TRIAGED' } : a))
      );

      flash('ok', `Alert #${targetId} routed to ${inv?.username || 'investigator'}.`);
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

      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, status: 'CONVERTED_TO_CASE' } : a))
      );

      flash('ok', `Alert #${alert.id} successfully converted to Case #${res.case.id}.`);
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

  // Filter alerts by active triage tab and search
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Tab filter
      if (activeTab === 'PENDING') {
        if (!['NEW', 'UNDER_REVIEW'].includes(alert.status)) return false;
      } else if (activeTab === 'CLEARED') {
        if (!['FALSE_POSITIVE', 'DISMISSED', 'TRIAGED'].includes(alert.status)) return false;
      } else if (activeTab === 'FRAUD') {
        if (!['ESCALATED', 'CONVERTED_TO_CASE', 'CLOSED'].includes(alert.status)) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const typeMatch = (alert.alert_type || '').toLowerCase().includes(query);
        const reasonText = getReasonText(alert.trigger_reason) || getReasonText(alert.detection_reason);
        const reasonMatch = reasonText.toLowerCase().includes(query);
        const idMatch = String(alert.id).includes(query);
        const accMatch = (alert.related_accounts || []).some((a) => String(a).toLowerCase().includes(query));
        return typeMatch || reasonMatch || idMatch || accMatch;
      }
      return true;
    });
  }, [alerts, activeTab, searchTerm]);

  const pendingCount = useMemo(() => alerts.filter((a) => ['NEW', 'UNDER_REVIEW'].includes(a.status)).length, [alerts]);
  const clearedCount = useMemo(() => alerts.filter((a) => ['FALSE_POSITIVE', 'DISMISSED', 'TRIAGED'].includes(a.status)).length, [alerts]);
  const fraudCount = useMemo(() => alerts.filter((a) => ['ESCALATED', 'CONVERTED_TO_CASE', 'CLOSED'].includes(a.status)).length, [alerts]);

  return (
    <AppLayout title="Fraud & Anomaly Alerts" subtitle="Investigator Triage & Entity Drilldown Studio">
      {/* Investigator SOP Guide Banner */}
      <InvestigatorGuideBanner
        activeStep={activeTab === 'PENDING' ? 1 : activeTab === 'CLEARED' ? 3 : 4}
        onStepClick={(s) => {
          if (s === 1) setActiveTab('PENDING');
          if (s === 3) setActiveTab('CLEARED');
          if (s === 4) setActiveTab('FRAUD');
        }}
      />

      {/* Flash alert banner */}
      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: message.type === 'ok' ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
            border: `1px solid ${message.type === 'ok' ? '#3fb95055' : '#f8514955'}`,
            color: message.type === 'ok' ? '#3fb950' : '#f85149',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {message.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Triage Tabs & Controls */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div className="d-flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            style={{
              background: activeTab === 'PENDING' ? '#1f6feb' : '#161b22',
              color: activeTab === 'PENDING' ? '#ffffff' : '#8b949e',
              border: '1px solid #30363d',
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Zap size={14} /> Pending Triage
            <span style={{ background: activeTab === 'PENDING' ? 'rgba(255,255,255,0.2)' : '#21262d', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLEARED')}
            style={{
              background: activeTab === 'CLEARED' ? '#238636' : '#161b22',
              color: activeTab === 'CLEARED' ? '#ffffff' : '#8b949e',
              border: '1px solid #30363d',
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ShieldCheck size={14} /> Cleared / Legit
            <span style={{ background: activeTab === 'CLEARED' ? 'rgba(255,255,255,0.2)' : '#21262d', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>
              {clearedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FRAUD')}
            style={{
              background: activeTab === 'FRAUD' ? '#da3633' : '#161b22',
              color: activeTab === 'FRAUD' ? '#ffffff' : '#8b949e',
              border: '1px solid #30363d',
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ShieldAlert size={14} /> Confirmed Fraud / Escalated
            <span style={{ background: activeTab === 'FRAUD' ? 'rgba(255,255,255,0.2)' : '#21262d', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>
              {fraudCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            style={{
              background: activeTab === 'ALL' ? '#30363d' : '#161b22',
              color: activeTab === 'ALL' ? '#ffffff' : '#8b949e',
              border: '1px solid #30363d',
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Alerts ({alerts.length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} color="#8b949e" style={{ position: 'absolute', left: 10, top: 10 }} />
          <input
            type="text"
            placeholder="Search accounts, typology, ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '6px 12px 6px 32px',
              color: '#f0f6fc',
              fontSize: 12,
            }}
          />
        </div>
      </div>

      {/* Bulk action bar */}
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
            border: '1px solid #388bfd',
          }}
        >
          <span style={{ fontSize: 12, color: '#c9d1d9', fontWeight: 600 }}>{selected.size} selected:</span>
          <button
            type="button"
            onClick={() => handleBulk('FALSE_POSITIVE')}
            style={{ background: '#21262d', border: '1px solid #30363d', color: '#3fb950', fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}
          >
            ✓ Mark All Legit
          </button>
          <button
            type="button"
            onClick={() => handleBulk('ESCALATE')}
            style={{ background: '#21262d', border: '1px solid #30363d', color: '#ff7b72', fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}
          >
            🚨 Escalate All → InvoSpace
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 11, marginLeft: 'auto', cursor: 'pointer' }}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Alerts Table */}
      <Card style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8 }} className="shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="secondary" size="sm" />
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-5 text-center text-muted">
              <CheckCircle2 size={32} className="mb-2 text-success opacity-50" />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>
                {activeTab === 'PENDING' ? 'No pending unreviewed alerts!' : 'No alerts found matching this filter.'}
              </div>
              <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                {activeTab === 'PENDING' ? 'All anomalous signals have been triaged or escalated.' : 'Try changing your tab or search query.'}
              </div>
            </div>
          ) : (
            <table className="table mb-0 align-middle" style={{ background: '#0d1117', color: '#f0f6fc', borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#161b22', borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: 11, textTransform: 'uppercase' }}>
                  {isAnalyst && <th style={{ width: 30 }} className="ps-3"></th>}
                  <th className="py-2 ps-3">ID</th>
                  <th className="py-2">Typology & Trigger Reason</th>
                  <th className="py-2">Accounts</th>
                  <th className="py-2">Severity</th>
                  <th className="py-2">Score</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                  <th className="py-2 pe-3 text-end">Investigator Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => {
                  const isPending = ['NEW', 'UNDER_REVIEW'].includes(alert.status);
                  const isEscalated = alert.status === 'ESCALATED';
                  const accounts = alert.related_accounts || [];

                  return (
                    <tr key={alert.id} style={{ background: '#0d1117', borderBottom: '1px solid #21262d', fontSize: 12 }}>
                      {isAnalyst && (
                        <td className="ps-3" style={{ background: 'transparent' }}>
                          <input
                            type="checkbox"
                            checked={selected.has(alert.id)}
                            onChange={() => toggleSelect(alert.id)}
                          />
                        </td>
                      )}
                      <td className="ps-3 font-monospace text-muted" style={{ background: 'transparent', fontSize: 11 }}>
                        #{alert.id}
                      </td>
                      <td style={{ background: 'transparent' }}>
                        <div style={{ fontWeight: 600, color: '#f0f6fc' }}>{alert.alert_type}</div>
                        <div style={{ fontSize: 11, color: '#8b949e', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getReasonText(alert.trigger_reason) || getReasonText(alert.detection_reason) || 'Algorithmic anomaly detection trigger'}
                        </div>
                      </td>
                      <td style={{ background: 'transparent' }}>
                        <div className="d-flex gap-1 flex-wrap align-items-center">
                          {accounts.slice(0, 2).map((acc) => (
                            <span key={acc} style={{ background: '#161b22', border: '1px solid #30363d', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11, color: '#79c0ff' }}>
                              {acc}
                            </span>
                          ))}
                          {accounts.length > 2 && (
                            <span style={{ fontSize: 10, color: '#8b949e' }}>+{accounts.length - 2} more</span>
                          )}
                          {accounts.length === 0 && <span style={{ color: '#6e7681', fontSize: 11 }}>—</span>}
                        </div>
                      </td>
                      <td style={{ background: 'transparent' }}><SeverityBadge severity={alert.severity} /></td>
                      <td style={{ background: 'transparent' }}>
                        <span style={{ fontWeight: 700, color: alert.risk_score > 80 ? '#f85149' : alert.risk_score > 50 ? '#e3b341' : '#3fb950' }}>
                          {Number(alert.risk_score || 0).toFixed(0)}
                        </span>
                      </td>
                      <td style={{ background: 'transparent' }}><StatusBadge status={alert.status} /></td>
                      <td style={{ background: 'transparent', fontSize: 11, color: '#8b949e' }}>
                        {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="pe-3 text-end" style={{ background: 'transparent' }}>
                        <div className="d-inline-flex gap-1 align-items-center">
                          {/* Drilldown Accounts & Transactions Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenInspect(alert)}
                            style={{
                              background: '#21262d',
                              border: '1px solid #30363d',
                              color: '#58a6ff',
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '4px 8px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Inspect linked accounts and transactions"
                          >
                            <Eye size={12} /> View Accounts & Txns
                          </button>

                          {/* Quick Triage Buttons for Pending Signals */}
                          {isPending && isAnalyst && (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmLegitTarget(alert)}
                                disabled={busyId === alert.id}
                                style={{
                                  background: 'rgba(63,185,80,0.15)',
                                  border: '1px solid rgba(63,185,80,0.3)',
                                  color: '#3fb950',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                }}
                                title="Mark this alert as Legit / False Positive (Removes from pending triage)"
                              >
                                ✓ Legit
                              </button>
                              <button
                                type="button"
                                onClick={() => setEscalateTarget(alert)}
                                disabled={busyId === alert.id}
                                style={{
                                  background: 'rgba(248,81,73,0.15)',
                                  border: '1px solid rgba(248,81,73,0.3)',
                                  color: '#ff7b72',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                }}
                                title="Confirm Fraud and Escalate to Admin for InvoSpace Investigation"
                              >
                                🚨 Fraud / Escalate
                              </button>
                            </>
                          )}

                          {/* Admin InvoSpace Routing */}
                          {isAdmin && isEscalated && (
                            <button
                              type="button"
                              onClick={() => setRouteTarget(alert)}
                              disabled={busyId === alert.id}
                              style={{
                                background: '#1f6feb',
                                border: '1px solid #388bfd',
                                color: '#ffffff',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Route → Investigator
                            </button>
                          )}

                          {/* Investigator Conversion to Case */}
                          {isInvestigator && isEscalated && (
                            <button
                              type="button"
                              onClick={() => handleConvert(alert)}
                              disabled={busyId === alert.id}
                              style={{
                                background: '#238636',
                                border: '1px solid #2ea043',
                                color: '#ffffff',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              + Convert to Case
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card.Body>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: ACCOUNTS & TRANSACTIONS INSPECTOR */}
      {/* ───────────────────────────────────────────────────────────── */}
      {inspectAlert && (
        <Modal
          show={!!inspectAlert}
          onHide={() => setInspectAlert(null)}
          size="lg"
          centered
          contentClassName="bg-dark text-light border border-secondary"
        >
          <Modal.Header closeButton closeVariant="white" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
            <Modal.Title style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} color="#58a6ff" />
              Alert #{inspectAlert.id} Entity & Transaction Intelligence
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ background: '#0d1117', padding: 20 }}>
            {inspectLoading ? (
              <div className="p-5 text-center">
                <Spinner animation="border" variant="secondary" />
                <div style={{ fontSize: 12, color: '#8b949e', marginTop: 10 }}>Loading account & transaction telemetry…</div>
              </div>
            ) : inspectData ? (
              <>
                {/* Summary bar */}
                <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3 p-3" style={{ background: '#161b22', borderRadius: 6, border: '1px solid #30363d' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Typology Pattern</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>{inspectAlert.alert_type}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Linked Accounts</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#58a6ff' }}>{inspectData.summary.total_accounts}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Total Transactions</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>{inspectData.summary.total_transactions}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Total Flow Volume</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#3fb950' }}>${inspectData.summary.total_volume.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Current Status</div>
                    <StatusBadge status={inspectAlert.status} />
                  </div>
                </div>

                {/* Section 1: Linked Accounts */}
                <div className="mb-4">
                  <h6 style={{ fontSize: 13, fontWeight: 700, color: '#f0f6fc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color="#58a6ff" /> Triggering & Member Accounts
                  </h6>
                  {inspectData.accounts.length === 0 ? (
                    <div className="p-3 text-center text-muted" style={{ background: '#161b22', borderRadius: 6, fontSize: 12 }}>
                      No specific account IDs stored in alert metadata.
                    </div>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {inspectData.accounts.map((acc) => (
                        <div
                          key={acc.account_id}
                          style={{
                            background: '#161b22',
                            border: '1px solid #30363d',
                            borderRadius: 6,
                            padding: '8px 12px',
                            minWidth: 180,
                            flex: '1 1 200px',
                            position: 'relative',
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#79c0ff' }}>
                              {acc.account_id}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(acc.account_id);
                                flash('ok', `Account ${acc.account_id} copied to clipboard.`);
                              }}
                              style={{
                                background: '#21262d',
                                border: '1px solid #30363d',
                                color: '#8b949e',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                cursor: 'pointer',
                              }}
                              title="Copy Account ID"
                            >
                              Copy
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
                            Flow: Out ${acc.sent_volume.toLocaleString()} · In ${acc.recv_volume.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
                            Transactions: {acc.tx_count}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Associated Transactions */}
                <div>
                  <h6 style={{ fontSize: 13, fontWeight: 700, color: '#f0f6fc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={14} color="#58a6ff" /> Telemetry & Flow Transactions
                  </h6>
                  {inspectData.transactions.length === 0 ? (
                    <div className="p-3 text-center text-muted" style={{ background: '#161b22', borderRadius: 6, fontSize: 12 }}>
                      No individual transaction rows found matching these accounts.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #30363d', borderRadius: 6 }}>
                      <table className="table mb-0 align-middle" style={{ background: '#0d1117', color: '#f0f6fc', fontSize: 11, width: '100%' }}>
                        <thead>
                          <tr style={{ background: '#161b22', color: '#8b949e', borderBottom: '1px solid #30363d' }}>
                            <th className="ps-3 py-2">Tx ID</th>
                            <th className="py-2">Sender Account</th>
                            <th className="py-2">Receiver Account</th>
                            <th className="py-2">Amount</th>
                            <th className="py-2">Timestamp</th>
                            <th className="py-2 pe-3 text-end">Risk Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectData.transactions.map((t) => (
                            <tr key={t.id} style={{ borderBottom: '1px solid #21262d' }}>
                              <td className="ps-3 font-monospace" style={{ color: '#c9d1d9' }}>{t.transaction_id}</td>
                              <td className="font-monospace" style={{ color: '#79c0ff' }}>{t.sender_account}</td>
                              <td className="font-monospace" style={{ color: '#a5d6ff' }}>{t.receiver_account}</td>
                              <td style={{ fontWeight: 600, color: t.is_suspicious ? '#ff7b72' : '#f0f6fc' }}>
                                ${t.amount.toLocaleString()} {t.currency}
                              </td>
                              <td style={{ color: '#8b949e' }}>{t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'}</td>
                              <td className="pe-3 text-end">
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: t.is_suspicious ? 'rgba(248,81,73,0.15)' : 'rgba(63,185,80,0.15)',
                                  color: t.is_suspicious ? '#ff7b72' : '#3fb950',
                                  border: `1px solid ${t.is_suspicious ? 'rgba(248,81,73,0.3)' : 'rgba(63,185,80,0.3)'}`,
                                }}>
                                  {t.is_suspicious ? 'SUSPICIOUS' : 'LEGIT'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </Modal.Body>
          <Modal.Header style={{ background: '#161b22', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {inspectAlert && ['NEW', 'UNDER_REVIEW'].includes(inspectAlert.status) && isAnalyst && (
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmLegitTarget(inspectAlert);
                      setInspectAlert(null);
                    }}
                    style={{ background: '#238636', border: '1px solid #2ea043', color: '#ffffff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    ✓ Mark Legit & Remove from Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEscalateTarget(inspectAlert);
                      setInspectAlert(null);
                    }}
                    style={{ background: '#da3633', border: '1px solid #f85149', color: '#ffffff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    🚨 Confirm Fraud & Escalate
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInspectAlert(null)}
              style={{ background: '#21262d', border: '1px solid #30363d', color: '#f0f6fc', fontSize: 12, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              Close
            </button>
          </Modal.Header>
        </Modal>
      )}

      {/* Confirm Legit / False Positive Modal */}
      {confirmLegitTarget && (
        <Modal
          show={!!confirmLegitTarget}
          onHide={() => setConfirmLegitTarget(null)}
          centered
          contentClassName="bg-dark text-light border border-secondary"
        >
          <Modal.Header closeButton closeVariant="white" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
            <Modal.Title style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color="#3fb950" />
              Confirm Legitimate Determination · Alert #{confirmLegitTarget.id}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ background: '#0d1117' }}>
            <p style={{ fontSize: 13, color: '#c9d1d9' }}>
              Are you sure you want to mark <strong>Alert #{confirmLegitTarget.id} ({confirmLegitTarget.alert_type})</strong> as <strong>Legitimate / False Positive</strong>?
            </p>
            <div style={{ padding: '8px 12px', background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.3)', borderRadius: 6, fontSize: 12, color: '#d29922', marginBottom: 14 }}>
              ⚠️ <strong>Strict One-Way Triage:</strong> This decision will clear the alert and permanently remove it from the pending alerts queue.
            </div>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 12, color: '#8b949e' }}>Analyst Rationale / Verification Notes (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g., Verified recurring payroll transfer, standard business supplier relationship…"
                value={confirmLegitReason}
                onChange={(e) => setConfirmLegitReason(e.target.value)}
                style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', fontSize: 13 }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ background: '#161b22', borderTop: '1px solid #30363d' }}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmLegitTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              disabled={busyId === confirmLegitTarget.id}
              onClick={() => handleClassifyAlert(confirmLegitTarget.id, 'MARK_LEGIT', confirmLegitReason || 'Analyst marked as legitimate')}
              style={{ background: '#238636', borderColor: '#2ea043' }}
            >
              ✓ Confirm Legit & Remove from Queue
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Escalate Modal */}
      {escalateTarget && (
        <Modal
          show={!!escalateTarget}
          onHide={() => setEscalateTarget(null)}
          centered
          contentClassName="bg-dark text-light border border-secondary"
        >
          <Modal.Header closeButton closeVariant="white" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
            <Modal.Title style={{ fontSize: 14, fontWeight: 700 }}>
              🚨 Escalate Alert #{escalateTarget.id} to Admin
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ background: '#0d1117' }}>
            <p style={{ fontSize: 13, color: '#8b949e' }}>
              Confirming fraud will escalate this alert to the Admin queue for assignment to an InvoSpace forensic investigator.
            </p>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 12, color: '#c9d1d9' }}>Escalation & Fraud Justification</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Explain the muling indicators, high velocity, or layering pattern observed…"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', fontSize: 13 }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ background: '#161b22', borderTop: '1px solid #30363d' }}>
            <Button variant="secondary" size="sm" onClick={() => setEscalateTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleEscalateSubmit}>
              Confirm Fraud & Escalate →
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Route Modal (Admin) */}
      {routeTarget && (
        <Modal
          show={!!routeTarget}
          onHide={() => setRouteTarget(null)}
          centered
          contentClassName="bg-dark text-light border border-secondary"
        >
          <Modal.Header closeButton closeVariant="white" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
            <Modal.Title style={{ fontSize: 14, fontWeight: 700 }}>
              🔀 Route Alert #{routeTarget.id} to Investigator
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ background: '#0d1117' }}>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 12, color: '#c9d1d9' }}>Select Assigned Investigator</Form.Label>
              <Form.Select
                value={routeAssignee}
                onChange={(e) => setRouteAssignee(e.target.value)}
                style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', fontSize: 13 }}
              >
                <option value="">Select an investigator…</option>
                {investigators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.username} ({i.email || `#${i.id}`})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ background: '#161b22', borderTop: '1px solid #30363d' }}>
            <Button variant="secondary" size="sm" onClick={() => setRouteTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!routeAssignee} onClick={handleRouteSubmit}>
              Route to Investigator
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </AppLayout>
  );
}

export default AlertsPage;
