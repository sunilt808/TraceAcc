import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { casesAPI } from '../../services/api';

const STATUS_COLORS = {
  OPEN: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
  ASSIGNED: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
  INVESTIGATING: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
  EVIDENCE_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
  PENDING_REVIEW: { bg: 'rgba(163,113,247,0.15)', color: '#a371f7' },
  REVISION_REQUIRED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
  RESOLVED: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950' },
  CLOSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
};

function CaseBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.OPEN;
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

function PriorityDot({ priority }) {
  const colors = { LOW: '#3fb950', MEDIUM: '#d29922', HIGH: '#e3b341', CRITICAL: '#f85149' };
  return (
    <>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colors[priority] || '#8b949e',
          marginRight: 6,
        }}
      />
      <span style={{ fontSize: 12, color: '#c9d1d9' }}>{priority}</span>
    </>
  );
}

// Matches backend VALID_CASE_STATUSES.
const CASE_STATUSES = Object.keys(STATUS_COLORS);

function CasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', notes: '' });
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
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
      setForm({ title: '', description: '', priority: 'MEDIUM', notes: '' });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await casesAPI.updateStatus(id, newStatus);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Status change failed');
    }
  };

  return (
    <AppLayout title="Cases" subtitle="Investigation case management">
      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: 'rgba(248,81,73,0.1)',
            border: '1px solid #f8514955',
            color: '#f85149',
          }}
        >
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Case'}
        </button>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
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
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#c9d1d9', cursor: 'pointer' }}>
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          My cases only
        </label>

        <div style={{ marginLeft: 'auto', color: '#8b949e', fontSize: 13 }}>
          {cases.length} case{cases.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel" style={{ marginBottom: 20, border: '1px solid #1f6feb44' }}>
          <div className="panel-header">
            <span>📁</span>
            <h3 className="panel-title">New Investigation Case</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Title *</label>
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
                  placeholder="e.g. Suspicious ring RING_0001"
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
                    placeholder="Brief description"
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Notes</label>
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
                  placeholder="Investigation notes…"
                />
              </div>
              <div>
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
          ) : cases.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              No cases found. Convert a routed alert on the Alerts page to open your first case.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Risk (TraceLab)</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td style={{ color: '#8b949e', fontSize: 11 }}>{c.id}</td>
                    <td>
                      <div
                        style={{ fontWeight: 600, color: '#388bfd', fontSize: 13, cursor: 'pointer' }}
                        onClick={() => navigate(`/cases/${c.id}`)}
                      >
                        {c.title}
                      </div>
                      {c.alert_id && (
                        <div style={{ fontSize: 11, color: '#a371f7', marginTop: 2 }}>from alert #{c.alert_id}</div>
                      )}
                    </td>
                    <td><CaseBadge status={c.status} /></td>
                    <td><PriorityDot priority={c.priority} /></td>
                    <td style={{ fontWeight: 600, color: c.tracelab_risk_score > 80 ? '#f85149' : '#e3b341' }}>
                      {c.tracelab_risk_score != null ? Number(c.tracelab_risk_score).toFixed(0) : '—'}
                    </td>
                    <td style={{ fontSize: 11, color: '#8b949e' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status !== 'CLOSED' && c.status !== 'INVESTIGATING' && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => handleStatusChange(c.id, 'INVESTIGATING')}
                          >
                            Investigate
                          </button>
                        )}
                        {c.status !== 'CLOSED' && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => handleStatusChange(c.id, 'CLOSED')}
                          >
                            Close
                          </button>
                        )}
                        {c.status === 'CLOSED' && (
                          <span style={{ fontSize: 11, color: '#8b949e' }}>Immutable</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#8b949e', marginTop: 10 }}>
        Cases are immutable audit records — deletion is not permitted for regulator compliance.
      </p>
    </AppLayout>
  );
}

export default CasesPage;
