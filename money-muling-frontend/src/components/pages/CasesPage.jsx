import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import api from '../../services/api';

function CaseBadge({ status }) {
  const colors = {
    OPEN:          { bg: 'rgba(31,111,235,0.15)',  color: '#388bfd' },
    INVESTIGATING: { bg: 'rgba(227,179,65,0.15)',  color: '#e3b341' },
    ESCALATED:     { bg: 'rgba(248,81,73,0.15)',   color: '#f85149' },
    CLOSED:        { bg: 'rgba(63,185,80,0.15)',   color: '#3fb950' },
  };
  const c = colors[status] || colors.OPEN;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.color,
    }}>
      {status}
    </span>
  );
}

function PriorityDot({ priority }) {
  const colors = { LOW: '#3fb950', MEDIUM: '#d29922', HIGH: '#e3b341', CRITICAL: '#f85149' };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: colors[priority] || '#8b949e', marginRight: 6,
    }} />
  );
}

export default function CasesPage() {
  const [cases, setCases]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', notes: '' });
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/cases?status=${filterStatus}` : '/cases';
      const res = await api.get(url);
      setCases(res.data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/cases', form);
      setForm({ title: '', description: '', priority: 'MEDIUM', notes: '' });
      setShowCreate(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    await api.patch(`/cases/${id}`, { status: newStatus });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this case?')) return;
    await api.delete(`/cases/${id}`);
    load();
  };

  return (
    <AppLayout title="Cases" subtitle="Investigation case management">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Case'}
        </button>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
            padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
          }}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="ESCALATED">Escalated</option>
          <option value="CLOSED">Closed</option>
        </select>

        <div style={{ marginLeft: 'auto', color: '#8b949e', fontSize: 13 }}>
          {cases.length} case{cases.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel" style={{ marginBottom: 20, border: '1px solid #1f6feb44' }}>
          <div className="panel-header"><span>📁</span><h3 className="panel-title">New Investigation Case</h3></div>
          <div className="panel-body">
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{
                    width: '100%', background: '#161b22', border: '1px solid #30363d',
                    borderRadius: 6, padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
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
                      width: '100%', background: '#161b22', border: '1px solid #30363d',
                      borderRadius: 6, padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
                    }}
                  >
                    {['LOW','MEDIUM','HIGH','CRITICAL'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>Description</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    style={{
                      width: '100%', background: '#161b22', border: '1px solid #30363d',
                      borderRadius: 6, padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
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
                    width: '100%', background: '#161b22', border: '1px solid #30363d',
                    borderRadius: 6, padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
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
              No cases found. Create one to start an investigation.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
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
                      {c.description && (
                        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{c.description}</div>
                      )}
                    </td>
                    <td><CaseBadge status={c.status} /></td>
                    <td>
                      <PriorityDot priority={c.priority} />
                      <span style={{ fontSize: 12, color: '#c9d1d9' }}>{c.priority}</span>
                    </td>
                    <td style={{ fontSize: 11, color: '#8b949e' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status !== 'CLOSED' && (
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
                        <button
                          style={{
                            background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149',
                            borderRadius: 5, padding: '4px 8px', color: '#f85149',
                            fontSize: 11, cursor: 'pointer',
                          }}
                          onClick={() => handleDelete(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
