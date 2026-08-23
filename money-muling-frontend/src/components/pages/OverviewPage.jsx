import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { workbenchAPI, alertsAPI, serviceRequestsAPI } from '../../services/api';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAnalysis } from '../../context/AnalysisContext';

// ============================================================
// SMALL PRESENTATIONAL HELPERS
// ============================================================

const StatCard = ({ label, value, sub, accent }) => (
  <div className={`stat-card ${accent || ''}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value ?? '—'}</div>
    {sub && <div className="stat-card-sub">{sub}</div>}
  </div>
);

const StatusPill = ({ value }) => {
  const colors = {
    SUBMITTED: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    UNDER_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
    APPROVED: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950' },
    IN_PROGRESS: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    ANALYSIS_IN_PROGRESS: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    INVESTIGATION_IN_PROGRESS: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    ALERT_ESCALATED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
    REPORT_SUBMITTED: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
    RELEASED: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950' },
    CLOSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
    REJECTED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
    NEW: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    UNDER_REVIEW_ALERT: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
    TRIAGED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
    FALSE_POSITIVE: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
    ESCALATED: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
    CONVERTED_TO_CASE: { bg: 'rgba(163,113,247,0.15)', color: '#a371f7' },
    DISMISSED: { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
    OPEN: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    ASSIGNED: { bg: 'rgba(31,111,235,0.15)', color: '#388bfd' },
    INVESTIGATING: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
    EVIDENCE_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
    PENDING_REVIEW: { bg: 'rgba(227,179,65,0.15)', color: '#e3b341' },
    RESOLVED: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950' },
  };
  const key = value === 'UNDER_REVIEW' ? value : value;
  const c = colors[value] || { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' };
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
      {(value || '—').replace(/_/g, ' ')}
    </span>
  );
};

const MiniBar = ({ value, max = 100, color = '#1f6feb' }) => (
  <div style={{ background: '#21262d', borderRadius: 4, height: 6, width: '100%' }}>
    <div
      style={{
        background: color,
        height: 6,
        borderRadius: 4,
        width: `${Math.min(100, Math.round((value / max) * 100))}%`,
      }}
    />
  </div>
);

// ============================================================
// ANALYST WORKBENCH VIEW
// ============================================================

function AnalystOverview() {
  const navigate = useNavigate();
  const { runAnalysis, isAnalyzing } = useAnalysis();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [busyRequest, setBusyRequest] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await workbenchAPI.analyst();
        setData(res);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load workbench');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDownloadDataset = async (r) => {
    setBusyRequest(r.id);
    setActionMsg('');
    try {
      await serviceRequestsAPI.downloadDataset(r.id);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || `Could not download dataset for request #${r.id}`);
    } finally {
      setBusyRequest(null);
    }
  };

  // Pull the server-side dataset and run the advanced analysis against it,
  // linking the job to the request so the result is stored for the team.
  const handleAnalyzeDataset = async (r) => {
    if (!r.has_dataset) return;
    setBusyRequest(r.id);
    setActionMsg('');
    try {
      const res = await api.get(`/service-requests/${r.id}/dataset/download`, {
        responseType: 'blob',
      });
      const file = new File([res.data], r.dataset_filename || `request_${r.id}.csv`, {
        type: 'text/csv',
      });
      await runAnalysis(file, { serviceRequestId: r.id });
      navigate('/tracelab/graph-viewer');
    } catch (err) {
      setActionMsg(err.message || err.response?.data?.detail || `Analysis failed for request #${r.id}`);
    } finally {
      setBusyRequest(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ color: '#f85149' }}>
          {error || 'Workbench unavailable.'}
        </div>
      </div>
    );
  }

  const { kpis, assigned_requests: assignedRequests, triage_queue: triageQueue, recent_jobs: recentJobs, risk_trend: riskTrend } = data;

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Assigned Requests" value={kpis.assigned_requests} sub="my work queue" accent="accent" />
        <StatCard label="In Progress" value={kpis.in_progress} sub="actively being analyzed" />
        <StatCard label="Alerts To Triage" value={kpis.alerts_new} sub="NEW + UNDER_REVIEW" accent="warning" />
        <StatCard label="Escalated" value={kpis.alerts_escalated} sub="awaiting admin routing" accent="danger" />
        <StatCard label="Critical Alerts" value={kpis.critical_alerts} sub="severity CRITICAL" accent="danger" />
        <StatCard label="Jobs Run" value={kpis.jobs_run} sub="recent analyses" accent="success" />
      </div>

      {actionMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(248,81,73,0.1)', border: '1px solid #f8514955', color: '#f85149', fontSize: 13, marginBottom: 16 }}>
          {actionMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Assigned service requests */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>📥</span>
            <h3 className="panel-title">My Assigned Requests</h3>
            <button
              className="btn-secondary"
              style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}
              onClick={() => navigate('/dashboard')}
            >
              Run Analysis
            </button>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {assignedRequests.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                No requests assigned to you yet. Admin routes requests from the Admin Hub.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedRequests.slice(0, 8).map((r) => (
                    <tr key={r.id}>
                      <td style={{ color: '#f0f6fc', fontWeight: 500 }}>#{r.id} {r.title}</td>
                      <td style={{ fontSize: 12 }}>{r.request_type}</td>
                      <td><StatusPill value={r.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            disabled={!r.has_dataset || busyRequest === r.id}
                            title={r.has_dataset ? 'Download the attached dataset' : 'No dataset uploaded yet'}
                            onClick={() => handleDownloadDataset(r)}
                          >
                            Download
                          </button>
                          <button
                            className="btn-primary"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            disabled={!r.has_dataset || busyRequest === r.id || isAnalyzing}
                            title={r.has_dataset ? 'Run advanced analysis on this dataset' : 'No dataset uploaded yet'}
                            onClick={() => handleAnalyzeDataset(r)}
                          >
                            {busyRequest === r.id ? '…' : 'Analyze'}
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

        {/* Triage queue */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>🚨</span>
            <h3 className="panel-title">Alert Triage Queue</h3>
            <button
              className="btn-secondary"
              style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}
              onClick={() => navigate('/alerts')}
            >
              Open Alerts
            </button>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {triageQueue.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                No alerts waiting. Run an advanced analysis to auto-generate alerts.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Score</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {triageQueue.slice(0, 8).map((a) => (
                    <tr
                      key={a.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/alerts')}
                    >
                      <td style={{ color: '#f0f6fc', fontWeight: 500 }}>#{a.id} {a.alert_type}</td>
                      <td style={{ color: a.risk_score > 80 ? '#f85149' : a.risk_score > 50 ? '#e3b341' : '#3fb950', fontWeight: 700 }}>
                        {Number(a.risk_score).toFixed(0)}
                      </td>
                      <td style={{ fontSize: 12 }}>{a.severity}</td>
                      <td><StatusPill value={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Risk trend */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>📈</span>
            <h3 className="panel-title">Risk Trend (last {riskTrend.length} jobs)</h3>
          </div>
          <div className="panel-body">
            {riskTrend.length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: 13 }}>No jobs yet — run your first analysis.</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '8px 0' }}>
                {riskTrend.map((j) => {
                  const maxVal = Math.max(...riskTrend.map((x) => Math.max(x.suspicious_accounts, x.fraud_rings)), 1);
                  return (
                    <div key={j.job_id} style={{ flex: 1, textAlign: 'center' }} title={`Job #${j.job_id}: ${j.suspicious_accounts} suspicious, ${j.fraud_rings} rings`}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90, justifyContent: 'center' }}>
                        <div style={{ width: 10, height: `${(j.suspicious_accounts / maxVal) * 90}px`, background: '#f85149', borderRadius: 2 }} />
                        <div style={{ width: 10, height: `${(j.fraud_rings / maxVal) * 90}px`, background: '#e3b341', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 9, color: '#8b949e', marginTop: 4 }}>#{j.job_id}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6 }}>
              <span style={{ color: '#f85149' }}>■</span> suspicious · <span style={{ color: '#e3b341' }}>■</span> fraud rings
            </div>
          </div>
        </div>

        {/* Recent jobs */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>🗂️</span>
            <h3 className="panel-title">Recent Analysis Jobs</h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {recentJobs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                No analyses yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Accounts</th>
                    <th>Rings</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((j) => (
                    <tr key={j.id}>
                      <td style={{ color: '#f0f6fc', fontWeight: 500 }}>{j.filename}</td>
                      <td>{j.total_accounts}</td>
                      <td style={{ color: '#e3b341', fontWeight: 600 }}>{j.fraud_rings}</td>
                      <td style={{ color: '#8b949e' }}>{j.processing_time_seconds?.toFixed?.(2)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// INVESTIGATOR WORKBENCH VIEW
// ============================================================

function InvestigatorOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [converting, setConverting] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const res = await workbenchAPI.investigator();
      setData(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load workbench');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConvert = async (alertId) => {
    setConverting(alertId);
    setMessage('');
    try {
      const res = await alertsAPI.convertToCase(alertId);
      setMessage(`Alert #${alertId} converted to case #${res.case.id}`);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Conversion failed');
    } finally {
      setConverting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ color: '#f85149' }}>
          {error || 'Workbench unavailable.'}
        </div>
      </div>
    );
  }

  const { kpis, routed_alerts: routedAlerts, cases, task_stats: taskStats, overdue_tasks: overdueTasks } = data;

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Routed Alerts" value={kpis.routed_alerts} sub="awaiting case conversion" accent="danger" />
        <StatCard label="Open Cases" value={kpis.open_cases} sub="active investigations" accent="accent" />
        <StatCard label="Pending Review" value={kpis.pending_review_cases} sub="awaiting admin" accent="warning" />
        <StatCard label="Closed Cases" value={kpis.closed_cases} sub="completed" accent="success" />
        <StatCard label="Decisions Made" value={kpis.decisions_made} sub="final determinations" />
        <StatCard label="Overdue Tasks" value={kpis.overdue_tasks} sub="past due date" accent={kpis.overdue_tasks > 0 ? 'danger' : ''} />
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(63,185,80,0.1)', border: '1px solid #3fb95055', color: '#3fb950', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Routed alerts → convert */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>⚡</span>
            <h3 className="panel-title">Alerts Routed To Me</h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {routedAlerts.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                No escalated alerts routed to you yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Score</th>
                    <th>Reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {routedAlerts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ color: '#f0f6fc', fontWeight: 500 }}>
                        #{a.id} {a.alert_type}
                        <div style={{ fontSize: 11, color: '#8b949e' }}>
                          {(a.related_accounts || []).slice(0, 3).join(', ')}
                          {(a.related_accounts || []).length > 3 && ` +${a.related_accounts.length - 3}`}
                        </div>
                      </td>
                      <td style={{ color: a.risk_score > 80 ? '#f85149' : '#e3b341', fontWeight: 700 }}>
                        {Number(a.risk_score).toFixed(0)}
                      </td>
                      <td style={{ fontSize: 11, color: '#8b949e', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(a.detection_reason || a.trigger_reason || '—').slice(0, 60)}
                      </td>
                      <td>
                        <button
                          className="btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          disabled={converting === a.id}
                          onClick={() => handleConvert(a.id)}
                        >
                          {converting === a.id ? '…' : 'Convert → Case'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* My cases with completeness */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>📁</span>
            <h3 className="panel-title">My Cases</h3>
            <button
              className="btn-secondary"
              style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}
              onClick={() => navigate('/cases')}
            >
              All Cases
            </button>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {cases.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                No cases yet. Convert a routed alert to open your first case.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Status</th>
                    <th>Completeness</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.slice(0, 8).map((c) => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                      <td style={{ color: '#f0f6fc', fontWeight: 500 }}>#{c.id} {c.title}</td>
                      <td><StatusPill value={c.status} /></td>
                      <td style={{ minWidth: 110 }}>
                        <MiniBar
                          value={c.completeness}
                          color={c.completeness >= 100 ? '#3fb950' : c.completeness >= 50 ? '#e3b341' : '#1f6feb'}
                        />
                        <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{c.completeness}%</div>
                      </td>
                      <td style={{ fontSize: 11, color: c.decision ? '#3fb950' : '#8b949e' }}>
                        {c.decision ? c.decision.replace(/_/g, ' ') : 'pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Task board */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>✅</span>
            <h3 className="panel-title">Task Board</h3>
          </div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'].map((s) => (
                <div key={s} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f6fc' }}>{taskStats[s] || 0}</div>
                  <div style={{ fontSize: 10, color: '#8b949e' }}>{s.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
            {overdueTasks.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: '#f85149', fontWeight: 600, marginBottom: 6 }}>
                  Overdue tasks
                </div>
                {overdueTasks.slice(0, 4).map((t) => (
                  <div key={t.id} style={{ fontSize: 12, color: '#c9d1d9', padding: '4px 0', borderBottom: '1px solid #21262d' }}>
                    Case #{t.case_id} — {t.title} <span style={{ color: '#8b949e' }}>(due {new Date(t.due_date).toLocaleDateString()})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="panel">
          <div className="panel-header">
            <span style={{ fontSize: 16 }}>📊</span>
            <h3 className="panel-title">Case Pipeline</h3>
          </div>
          <div className="panel-body">
            {Object.entries(data.status_counts || {}).length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: 13 }}>No cases yet.</div>
            ) : (
              Object.entries(data.status_counts).map(([status, count]) => (
                <div key={status} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: '#c9d1d9' }}>{status.replace(/_/g, ' ')}</span>
                    <span style={{ color: '#8b949e' }}>{count}</span>
                  </div>
                  <MiniBar value={count} max={Math.max(...Object.values(data.status_counts))} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ROUTER — pick view by role / workspace path
// ============================================================

function OverviewPage() {
  const { role } = useAuth();
  const location = useLocation();

  // Admin picks the view from the workspace path.
  if (role === 'ADMIN') {
    return location.pathname.startsWith('/invospace') ? (
      <AppLayout title="InvoSpace Overview" subtitle="Investigation workbench">
        <InvestigatorOverview />
      </AppLayout>
    ) : (
      <AppLayout title="TraceLab Overview" subtitle="Analysis workbench">
        <AnalystOverview />
      </AppLayout>
    );
  }

  if (role === 'INVESTIGATOR') {
    return (
      <AppLayout title="InvoSpace Overview" subtitle="Investigation workbench">
        <InvestigatorOverview />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="TraceLab Overview" subtitle="Analysis workbench">
      <AnalystOverview />
    </AppLayout>
  );
}

export default OverviewPage;
