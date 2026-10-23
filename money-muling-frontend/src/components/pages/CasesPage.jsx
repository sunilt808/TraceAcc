import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { casesAPI } from '../../services/api';
import CaseDetailModal from '../cases/CaseDetailModal';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  SUBMITTED: { bg: 'rgba(210,153,34,0.15)', color: '#d29922' },
  OPEN: { bg: 'rgba(56,139,253,0.15)', color: '#58a6ff' },
  ASSIGNED: { bg: 'rgba(56,139,253,0.15)', color: '#79c0ff' },
  IN_PROGRESS: { bg: 'rgba(219,109,40,0.15)', color: '#f0883e' },
  INVESTIGATING: { bg: 'rgba(219,109,40,0.15)', color: '#f0883e' },
  EVIDENCE_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
  PENDING_REVIEW: { bg: 'rgba(163,113,247,0.15)', color: '#a371f7' },
  APPROVED: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950' },
  CLOSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
  REVISION_REQUIRED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
  REOPENED: { bg: 'rgba(210,153,34,0.15)', color: '#e3b341' },
};

function CaseBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.OPEN;
  return (
    <span
      style={{
        padding: '3px 9px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.color}33`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

function OriginBadge({ origin, isSynthetic, simId }) {
  if (isSynthetic || origin === 'LIVESHIELD_SIMULATION') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          background: 'rgba(163, 113, 247, 0.15)',
          color: '#d2a8ff',
          border: '1px solid rgba(163, 113, 247, 0.35)',
        }}
        title={`LiveShield Synthetic Simulation Data ${simId ? `(#${simId})` : ''}`}
      >
        🧪 SYNTHETIC SIM
      </span>
    );
  }

  if (origin === 'CLIENT_UPLOAD') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          background: 'rgba(56, 139, 253, 0.15)',
          color: '#58a6ff',
          border: '1px solid rgba(56, 139, 253, 0.35)',
        }}
      >
        📁 CLIENT UPLOAD
      </span>
    );
  }

  if (origin === 'LIVE_ALERT') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          background: 'rgba(248, 81, 73, 0.15)',
          color: '#f85149',
          border: '1px solid rgba(248, 81, 73, 0.35)',
        }}
      >
        🚨 LIVE ALERT
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        background: 'rgba(139, 148, 158, 0.15)',
        color: '#8b949e',
        border: '1px solid rgba(139, 148, 158, 0.3)',
      }}
    >
      🏢 INTERNAL
    </span>
  );
}

function PriorityDot({ priority }) {
  const colors = { LOW: '#3fb950', MEDIUM: '#d29922', HIGH: '#f0883e', CRITICAL: '#f85149' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colors[priority] || '#8b949e',
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{priority || 'MEDIUM'}</span>
    </div>
  );
}

const CASE_STATUSES = [
  'SUBMITTED',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'APPROVED',
  'CLOSED',
  'REVISION_REQUIRED',
  'REOPENED'
];

function CasesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isClient = user?.role === 'CLIENT_USER';

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', notes: '', case_origin: 'MANUAL_INTERNAL' });
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await casesAPI.list({ status: filterStatus, mineOnly });
      setCases(data.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, mineOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await casesAPI.create(form);
      setForm({ title: '', description: '', priority: 'MEDIUM', notes: '', case_origin: 'MANUAL_INTERNAL' });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (filterOrigin) {
        if (filterOrigin === 'SYNTHETIC' && !c.is_synthetic && c.case_origin !== 'LIVESHIELD_SIMULATION') return false;
        if (filterOrigin === 'CLIENT' && c.case_origin !== 'CLIENT_UPLOAD') return false;
        if (filterOrigin === 'ALERT' && c.case_origin !== 'LIVE_ALERT' && !c.alert_id) return false;
        if (filterOrigin === 'INTERNAL' && c.case_origin !== 'MANUAL_INTERNAL') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title?.toLowerCase().includes(q);
        const matchesId = String(c.id).includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesId && !matchesDesc) return false;
      }
      return true;
    });
  }, [cases, filterOrigin, searchQuery]);

  return (
    <AppLayout title="Forensic Cases" subtitle="Case Triage, Lifecycle State Machine & Official Delivery">
      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: 'rgba(248,81,73,0.15)',
            border: '1px solid #f85149',
            color: '#ff7b72',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {!isClient && (
          <button className="btn-primary" onClick={() => setShowCreate(!showCreate)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {showCreate ? '✕ Cancel' : '+ New Forensic Case'}
          </button>
        )}

        <div style={{ position: 'relative', minWidth: 200, flex: '1 1 200px' }}>
          <input
            type="text"
            placeholder="Search cases by #, title, or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '7px 12px',
              color: '#f0f6fc',
              fontSize: 13,
            }}
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '7px 12px',
            color: '#f0f6fc',
            fontSize: 13,
          }}
        >
          <option value="">All Lifecycle Stages</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={filterOrigin}
          onChange={(e) => setFilterOrigin(e.target.value)}
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '7px 12px',
            color: '#f0f6fc',
            fontSize: 13,
          }}
        >
          <option value="">All Origins</option>
          <option value="SYNTHETIC">🧪 Synthetic Simulations</option>
          <option value="CLIENT">📁 Client Uploads</option>
          <option value="ALERT">🚨 Live Detection Alerts</option>
          <option value="INTERNAL">🏢 Manual Internal Ingestion</option>
        </select>

        {!isClient && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#c9d1d9', cursor: 'pointer', marginLeft: 6 }}>
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Assigned to me
          </label>
        )}

        <div style={{ marginLeft: 'auto', color: '#8b949e', fontSize: 13, fontWeight: 500 }}>
          {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel" style={{ marginBottom: 20, border: '1px solid #1f6feb66', background: '#0d1117' }}>
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>📁</span>
            <h3 className="panel-title">Initialize New Forensic Investigation Case</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Case Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: '#f0f6fc',
                    fontSize: 13,
                  }}
                  placeholder="e.g. Suspicious money laundering ring via shell company accounts"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
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
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Description</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#f0f6fc',
                      fontSize: 13,
                    }}
                    placeholder="Brief description of observed typologies"
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Initial Investigation Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
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
                  placeholder="Investigation hypotheses, lead accounts, or trigger details…"
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : '✓ Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cases table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              No cases matching the current filters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Case Title & Details</th>
                    <th>Origin</th>
                    <th>Lifecycle Stage</th>
                    <th>Priority</th>
                    <th>Assigned To</th>
                    <th>Risk Score</th>
                    <th>Delivery Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c) => {
                    const score = c.investigation_risk_score != null ? c.investigation_risk_score : c.tracelab_risk_score;
                    const scorePct = score != null ? Math.round(Number(score) * 100) : null;
                    const hasActiveRelease = !!c.active_release;

                    return (
                      <tr key={c.id}>
                        <td style={{ color: '#8b949e', fontSize: 11, fontWeight: 600 }}>#{c.id}</td>
                        <td>
                          <div
                            style={{ fontWeight: 600, color: '#58a6ff', fontSize: '13.5px', cursor: 'pointer' }}
                            onClick={() => setSelectedCaseId(c.id)}
                            title="Click to open full Case Intelligence & Forensic Studio"
                          >
                            {c.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                            {c.alert_id && <span style={{ color: '#a371f7', marginLeft: 6 }}>· from alert #{c.alert_id}</span>}
                            {c.service_request_id && <span style={{ color: '#79c0ff', marginLeft: 6 }}>· request #{c.service_request_id}</span>}
                          </div>
                        </td>
                        <td>
                          <OriginBadge origin={c.case_origin} isSynthetic={c.is_synthetic} simId={c.simulation_id} />
                        </td>
                        <td><CaseBadge status={c.status} /></td>
                        <td><PriorityDot priority={c.priority} /></td>
                        <td>
                          {c.assignee_id || c.assigned_investigator_id ? (
                            <span style={{ fontSize: 12, color: '#c9d1d9', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              👤 User #{c.assignee_id || c.assigned_investigator_id}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#8b949e', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td>
                          {scorePct != null ? (
                            <span
                              style={{
                                fontWeight: 700,
                                color: scorePct >= 75 ? '#f85149' : scorePct >= 40 ? '#e3b341' : '#3fb950',
                                fontSize: 13,
                              }}
                            >
                              {scorePct}%
                            </span>
                          ) : (
                            <span style={{ color: '#8b949e', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          {hasActiveRelease ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                background: 'rgba(63, 185, 80, 0.15)',
                                color: '#3fb950',
                                border: '1px solid rgba(63, 185, 80, 0.35)',
                              }}
                            >
                              ✓ RELEASED v{c.active_release.version_number}
                            </span>
                          ) : c.status === 'CLOSED' ? (
                            <span style={{ fontSize: 11, color: '#8b949e' }}>Closed (Internal)</span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#6e7681' }}>In Investigation</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              className="btn-primary"
                              style={{ fontSize: 11, padding: '4px 10px', background: '#238636' }}
                              onClick={() => setSelectedCaseId(c.id)}
                            >
                              Investigate
                            </button>
                            <button
                              style={{
                                fontSize: 11,
                                padding: '4px 8px',
                                background: c.status === 'CLOSED' || hasActiveRelease ? '#1f6feb' : 'transparent',
                                color: '#fff',
                                border: '1px solid #388bfd',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              onClick={() => window.open(`/cases/${c.id}/pdf`, '_blank')}
                              title="Open official PDF document in print viewer"
                            >
                              📄 PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Complete Case Intelligence Report Modal */}
      <CaseDetailModal
        show={!!selectedCaseId}
        onHide={() => setSelectedCaseId(null)}
        caseId={selectedCaseId}
        onCaseUpdated={load}
      />
    </AppLayout>
  );
}

export default CasesPage;


