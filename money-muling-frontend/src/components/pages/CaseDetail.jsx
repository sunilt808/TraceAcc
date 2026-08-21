import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { casesAPI, evidenceAPI } from '../../services/api';

// ============================================================
// SHARED BITS
// ============================================================

const STATUS_COLORS = {
  OPEN: '#388bfd',
  ASSIGNED: '#388bfd',
  INVESTIGATING: '#e3b341',
  EVIDENCE_REVIEW: '#e3b341',
  PENDING_REVIEW: '#a371f7',
  REVISION_REQUIRED: '#f85149',
  RESOLVED: '#3fb950',
  CLOSED: '#8b949e',
};

function Pill({ value }) {
  const color = STATUS_COLORS[value] || '#8b949e';
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 700,
        background: `${color}26`,
        color,
      }}
    >
      {(value || '—').replace(/_/g, ' ')}
    </span>
  );
}

const inputStyle = {
  width: '100%',
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '8px 12px',
  color: '#f0f6fc',
  fontSize: 13,
};

const labelStyle = { fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 };

function TabCard({ title, children, action }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">{title}</h3>
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

// ============================================================
// HYPOTHESES TAB
// ============================================================

const HYP_STATUSES = ['OPEN', 'SUPPORTED', 'REJECTED', 'INCONCLUSIVE'];

function HypothesesTab({ caseId, reloadCompleteness }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await casesAPI.getHypotheses(caseId));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await casesAPI.createHypothesis(caseId, form);
      setForm({ title: '', description: '' });
      await load();
      reloadCompleteness?.();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id, status) => {
    await casesAPI.updateHypothesis(caseId, id, { status });
    load();
  };

  return (
    <>
      <TabCard title="Add Hypothesis">
        <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="e.g. Funds cycled back to origin account"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Supporting rationale…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button type="submit" className="btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
            {busy ? 'Adding…' : '+ Add Hypothesis'}
          </button>
        </form>
      </TabCard>

      <TabCard title={`Recorded Hypotheses (${items.length})`}>
        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <p style={{ color: '#8b949e', fontSize: 13 }}>No hypotheses recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hypothesis</th>
                <th>Status</th>
                <th>Set Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>{h.title}</div>
                    {h.description && (
                      <div style={{ fontSize: 11, color: '#8b949e' }}>{h.description}</div>
                    )}
                  </td>
                  <td><Pill value={h.status} /></td>
                  <td>
                    <select
                      value={h.status}
                      onChange={(e) => setStatus(h.id, e.target.value)}
                      style={{ ...inputStyle, width: 160 }}
                    >
                      {HYP_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabCard>
    </>
  );
}

// ============================================================
// TASKS TAB
// ============================================================

const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
const TASK_TYPES = [
  'CUSTOM', 'TRANSACTION_REVIEW', 'KYC_CHECK', 'INTERVIEW',
  'DOCUMENT_COLLECTION', 'NETWORK_ANALYSIS', 'EXTERNAL_QUERY',
];

function TasksTab({ caseId, reloadCompleteness }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', task_type: 'CUSTOM', due_date: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await casesAPI.getTasks(caseId));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await casesAPI.createTask(caseId, {
        title: form.title,
        task_type: form.task_type,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      });
      setForm({ title: '', task_type: 'CUSTOM', due_date: '' });
      await load();
      reloadCompleteness?.();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id, status) => {
    await casesAPI.updateTask(caseId, id, { status });
    await load();
    reloadCompleteness?.();
  };

  return (
    <>
      <TabCard title="Add Task">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="Task title…"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select
            style={inputStyle}
            value={form.task_type}
            onChange={(e) => setForm({ ...form, task_type: e.target.value })}
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="date"
            style={inputStyle}
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '…' : '+ Add'}
          </button>
        </form>
      </TabCard>

      <TabCard title={`Task Board (${items.length})`}>
        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <p style={{ color: '#8b949e', fontSize: 13 }}>No tasks yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Due</th>
                <th>Status</th>
                <th>Set Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const overdue =
                  t.due_date &&
                  t.status !== 'COMPLETED' &&
                  t.status !== 'SKIPPED' &&
                  new Date(t.due_date) < new Date();
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>{t.title}</td>
                    <td style={{ fontSize: 12 }}>{t.task_type.replace(/_/g, ' ')}</td>
                    <td style={{ fontSize: 11, color: overdue ? '#f85149' : '#8b949e' }}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                      {overdue && ' ⚠'}
                    </td>
                    <td><Pill value={t.status} /></td>
                    <td>
                      <select
                        value={t.status}
                        onChange={(e) => setStatus(t.id, e.target.value)}
                        style={{ ...inputStyle, width: 150 }}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TabCard>
    </>
  );
}

// ============================================================
// FINDINGS TAB
// ============================================================

const FINDING_TYPES = [
  'SUSPICIOUS_TRANSACTION', 'SUSPICIOUS_NETWORK', 'IDENTITY_DISCREPANCY',
  'BEHAVIOUR_ANOMALY', 'PATTERN_MATCH', 'RISK_FACTOR', 'EXCULPATORY', 'OTHER',
];
const CONFIDENCES = ['CONFIRMED', 'PROBABLE', 'INCONCLUSIVE', 'REFUTED'];

function FindingsTab({ caseId, reloadCompleteness }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '', description: '', finding_type: 'OTHER', confidence: 'PROBABLE', aml_pattern: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await casesAPI.getFindings(caseId));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    try {
      await casesAPI.createFinding(caseId, form);
      setForm({ title: '', description: '', finding_type: 'OTHER', confidence: 'PROBABLE', aml_pattern: '' });
      await load();
      reloadCompleteness?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TabCard title="Record Finding">
        <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="Finding title…"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Detailed description of the finding…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <select
              style={inputStyle}
              value={form.finding_type}
              onChange={(e) => setForm({ ...form, finding_type: e.target.value })}
            >
              {FINDING_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              style={inputStyle}
              value={form.confidence}
              onChange={(e) => setForm({ ...form, confidence: e.target.value })}
            >
              {CONFIDENCES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              style={inputStyle}
              placeholder="AML pattern (optional)"
              value={form.aml_pattern}
              onChange={(e) => setForm({ ...form, aml_pattern: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
            {busy ? 'Recording…' : '+ Record Finding'}
          </button>
        </form>
      </TabCard>

      <TabCard title={`Findings (${items.length})`}>
        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <p style={{ color: '#8b949e', fontSize: 13 }}>No findings recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Type</th>
                <th>Confidence</th>
                <th>Risk Contrib.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: '#8b949e' }}>{f.description}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{f.finding_type.replace(/_/g, ' ')}</td>
                  <td><Pill value={f.confidence} /></td>
                  <td style={{ color: f.risk_contribution > 0 ? '#f85149' : '#8b949e', fontWeight: 600 }}>
                    {f.risk_contribution > 0 ? `+${f.risk_contribution}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabCard>
    </>
  );
}

// ============================================================
// DECISION TAB
// ============================================================

const DECISIONS = [
  'NO_SUSPICION',
  'SUSPICIOUS_ACTIVITY',
  'ESCALATE',
  'INSUFFICIENT_INFORMATION',
  'INCONCLUSIVE',
];

function DecisionTab({ caseData, onDecisionRecorded }) {
  const [completeness, setCompleteness] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showDraft, setShowDraft] = useState(false);
  const [decision, setDecision] = useState(caseData.decision || '');
  const [reason, setReason] = useState(caseData.decision_reason || '');
  const [riskScore, setRiskScore] = useState(
    caseData.investigation_risk_score != null ? String(caseData.investigation_risk_score) : ''
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const caseId = caseData.id;

  const loadArtifacts = useCallback(async () => {
    try {
      const [comp, dr] = await Promise.all([
        casesAPI.getCompleteness(caseId),
        casesAPI.getReportDraft(caseId).catch(() => null),
      ]);
      setCompleteness(comp);
      setDraft(dr);
    } catch {
      /* non-fatal */
    }
  }, [caseId]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  const submit = async (e) => {
    e.preventDefault();
    if (!decision) return;
    setBusy(true);
    setMessage(null);
    try {
      await casesAPI.recordDecision(caseId, {
        decision,
        reason,
        investigationRiskScore: riskScore,
      });
      setMessage({ ok: true, text: 'Decision recorded — case moved to PENDING_REVIEW.' });
      onDecisionRecorded?.();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.detail || 'Failed to record decision' });
    } finally {
      setBusy(false);
    }
  };

  const total = completeness?.total ?? 0;
  const ready = completeness?.ready_for_report ?? false;

  return (
    <>
      {/* Completeness meter */}
      <TabCard title="Case-File Readiness">
        {completeness ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: `conic-gradient(${ready ? '#3fb950' : '#1f6feb'} ${total * 3.6}deg, #21262d 0deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#0d1117',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: ready ? '#3fb950' : '#58a6ff',
                    fontSize: 14,
                  }}
                >
                  {total}%
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {Object.entries(completeness.dimensions).map(([dim, val]) => (
                  <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#8b949e', width: 90, textTransform: 'capitalize' }}>{dim}</span>
                    <div style={{ flex: 1, background: '#21262d', height: 5, borderRadius: 3 }}>
                      <div
                        style={{
                          width: `${(val / { evidence: 20, hypotheses: 15, tasks: 35, findings: 20, decision: 10 }[dim]) * 100}%`,
                          height: 5,
                          borderRadius: 3,
                          background: val === 0 ? '#30363d' : '#1f6feb',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10, color: '#8b949e', width: 40, textAlign: 'right' }}>{val}/{{ evidence: 20, hypotheses: 15, tasks: 35, findings: 20, decision: 10 }[dim]}</span>
                  </div>
                ))}
              </div>
            </div>
            {!ready && completeness.missing.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#e3b341' }}>
                {completeness.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {ready && (
              <p style={{ fontSize: 12, color: '#3fb950', margin: 0 }}>
                ✓ Case file complete — ready for report generation.
              </p>
            )}
          </>
        ) : (
          <div className="spinner" />
        )}
      </TabCard>

      {/* Decision form */}
      <TabCard title="Investigation Decision">
        {message && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 12,
              background: message.ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
              border: `1px solid ${message.ok ? '#3fb95055' : '#f8514955'}`,
              color: message.ok ? '#3fb950' : '#f85149',
            }}
          >
            {message.text}
          </div>
        )}
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Decision *</label>
              <select style={inputStyle} value={decision} onChange={(e) => setDecision(e.target.value)} required>
                <option value="">Select decision…</option>
                {DECISIONS.map((d) => (
                  <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reassessed Risk Score (0–100)</label>
              <input
                type="number"
                min="0"
                max="100"
                style={inputStyle}
                value={riskScore}
                onChange={(e) => setRiskScore(e.target.value)}
                placeholder="Leave blank to keep pending"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Reasoning</label>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Justify the decision for the audit trail…"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" className="btn-primary" disabled={busy || !decision}>
              {busy ? 'Recording…' : '✓ Record Decision'}
            </button>
            {draft && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDraft(!showDraft)}
              >
                {showDraft ? 'Hide Report Draft' : 'Preview Report Draft'}
              </button>
            )}
            {caseData.decision && (
              <span style={{ fontSize: 12, color: '#3fb950' }}>
                Current: {caseData.decision.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </form>

        {showDraft && draft && (
          <pre
            style={{
              marginTop: 16,
              padding: 16,
              background: '#010409',
              border: '1px solid #30363d',
              borderRadius: 8,
              fontSize: 12,
              color: '#c9d1d9',
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {draft.markdown}
          </pre>
        )}
      </TabCard>
    </>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [tab, setTab] = useState('overview');

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const fileInputRef = useRef(null);

  const loadCase = useCallback(async () => {
    try {
      setLoading(true);
      const [c, t, e] = await Promise.all([
        casesAPI.get(id),
        casesAPI.getTimeline(id),
        evidenceAPI.list(id),
      ]);
      setCaseData(c);
      setTimeline(t);
      setEvidence(e);
    } catch (err) {
      console.error('Failed to load case', err);
      navigate('/cases');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const handleStatusChange = async (newStatus) => {
    try {
      await casesAPI.updateStatus(id, newStatus);
      await loadCase();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      await evidenceAPI.upload(id, file);
      const [eData, tData] = await Promise.all([evidenceAPI.list(id), casesAPI.getTimeline(id)]);
      setEvidence(eData);
      setTimeline(tData);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (item) => {
    try {
      await evidenceAPI.download(id, item.id, item.file_name);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await casesAPI.addNote(id, noteText.trim());
      setNoteText('');
      setTimeline(await casesAPI.getTimeline(id));
    } catch (err) {
      console.error('Note failed', err);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Loading Case...">
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      </AppLayout>
    );
  }

  if (!caseData) return null;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'evidence', label: `Evidence (${evidence.length})` },
    { key: 'hypotheses', label: 'Hypotheses' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'findings', label: 'Findings' },
    { key: 'decision', label: 'Decision & Report' },
    { key: 'timeline', label: `Timeline (${timeline.length})` },
  ];

  return (
    <AppLayout title={`Case #${caseData.id}`} subtitle={caseData.title}>
      {/* Header */}
      <div
        className="panel"
        style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h3 style={{ margin: 0, color: '#f0f6fc' }}>{caseData.title}</h3>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
            Created {new Date(caseData.created_at).toLocaleString()}
            {caseData.alert_id && <> · from alert #{caseData.alert_id}</>}
            {caseData.service_request_id && <> · request #{caseData.service_request_id}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#8b949e' }}>TRACELAB SCORE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f85149' }}>
              {caseData.tracelab_risk_score != null ? Number(caseData.tracelab_risk_score).toFixed(0) : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#8b949e' }}>INVESTIGATION</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e3b341' }}>
              {caseData.investigation_risk_score != null ? Number(caseData.investigation_risk_score).toFixed(0) : 'pending'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 2 }}>STATUS</div>
            <select
              value={caseData.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={caseData.status === 'CLOSED'}
              style={{ ...inputStyle, width: 180 }}
            >
              {Object.keys(STATUS_COLORS).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <Pill value={caseData.priority} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #30363d', marginBottom: 20, overflowX: 'auto' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #1f6feb' : '2px solid transparent',
              color: tab === t.key ? '#f0f6fc' : '#8b949e',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <>
          <TabCard title="Description">
            <p style={{ color: '#c9d1d9', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {caseData.description || 'No description provided.'}
            </p>
          </TabCard>
          <TabCard title="Linked Entities">
            {(caseData.linked_accounts || []).length === 0 ? (
              <p style={{ color: '#8b949e', fontSize: 13 }}>No linked accounts.</p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {caseData.linked_accounts.map((acc) => (
                  <span
                    key={acc}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: '#161b22',
                      border: '1px solid #30363d',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: '#79c0ff',
                    }}
                  >
                    {acc}
                  </span>
                ))}
              </div>
            )}
          </TabCard>
        </>
      )}

      {tab === 'evidence' && (
        <TabCard
          title="Attached Evidence"
          action={
            <>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              <button
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || caseData.status === 'CLOSED'}
              >
                {uploading ? 'Uploading…' : '+ Upload Evidence'}
              </button>
            </>
          }
        >
          {evidence.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: 13 }}>No evidence attached yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500, color: '#f0f6fc', fontSize: 13 }}>{item.file_name}</td>
                    <td style={{ fontSize: 12, color: '#8b949e' }}>{item.mime_type || 'Unknown'}</td>
                    <td style={{ fontSize: 11, color: '#8b949e' }}>
                      {item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleDownload(item)}>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabCard>
      )}

      {tab === 'hypotheses' && (
        <HypothesesTab caseId={id} />
      )}

      {tab === 'tasks' && (
        <TasksTab caseId={id} />
      )}

      {tab === 'findings' && (
        <FindingsTab caseId={id} />
      )}

      {tab === 'decision' && (
        <DecisionTab
          caseData={caseData}
          onDecisionRecorded={loadCase}
        />
      )}

      {tab === 'timeline' && (
        <TabCard title="Add Note">
          <form onSubmit={addNote} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              style={inputStyle}
              placeholder="Add an investigation note to the timeline…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={!noteText.trim()}>
              Add
            </button>
          </form>

          <div style={{ position: 'relative', paddingLeft: 24, borderLeft: '1px solid #30363d', marginLeft: 12 }}>
            {timeline.length === 0 ? (
              <p style={{ color: '#8b949e', fontSize: 13 }}>No events yet.</p>
            ) : (
              timeline.map((event) => (
                <div key={event.id} style={{ marginBottom: 18, position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: -29,
                      top: 4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background:
                        event.event_type === 'DECISION'
                          ? '#a371f7'
                          : event.event_type === 'STATUS_CHANGE'
                          ? '#1f6feb'
                          : '#30363d',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Pill value={event.event_type} />
                    <span style={{ fontSize: 11, color: '#8b949e' }}>
                      {new Date(event.created_at).toLocaleString()} · user #{event.user_id}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#161b22',
                      border: '1px solid #21262d',
                      borderRadius: 6,
                      fontSize: 13,
                      color: '#c9d1d9',
                    }}
                  >
                    {event.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabCard>
      )}
    </AppLayout>
  );
}

export default CaseDetail;
