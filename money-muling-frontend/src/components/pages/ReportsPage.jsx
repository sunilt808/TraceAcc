import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';
import { reportsAPI, serviceRequestsAPI } from '../../services/api';

// ============================================================
// WORKFLOW REPORTS SECTION
// ============================================================

const STATUS_COLORS = {
  DRAFT: '#8b949e',
  READY_FOR_REVIEW: '#e3b341',
  UNDER_REVIEW: '#e3b341',
  APPROVED: '#3fb950',
  SIGNED: '#a371f7',
  RELEASED: '#3fb950',
  REJECTED: '#f85149',
  CHANGES_REQUESTED: '#f85149',
};

function StatusPill({ value }) {
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

function WorkflowReports() {
  const [reports, setReports] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    title: '',
    summary: '',
    report_type: 'ANALYSIS',
    service_request_id: '',
  });
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, reqRes] = await Promise.all([
        reportsAPI.list(),
        serviceRequestsAPI.list({ assignedToMe: true }).catch(() => ({ items: [] })),
      ]);
      setReports(repRes.items || []);
      setRequests(reqRes.items || []);
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.detail || 'Failed to load reports' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (ok, text) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const createReport = async (e) => {
    e.preventDefault();
    try {
      await reportsAPI.create({
        title: form.title,
        summary: form.summary || null,
        report_type: form.report_type,
        service_request_id: form.service_request_id ? Number(form.service_request_id) : null,
      });
      setShowCreate(false);
      setForm({ title: '', summary: '', report_type: 'ANALYSIS', service_request_id: '' });
      flash(true, 'Report draft created. Upload the document, then submit for review.');
      load();
    } catch (err) {
      flash(false, err.response?.data?.detail || 'Failed to create report');
    }
  };

  const pickUpload = (report) => {
    uploadTargetRef.current = report;
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    const target = uploadTargetRef.current;
    if (!file || !target) return;
    setBusyId(target.id);
    try {
      await reportsAPI.uploadFile(target.id, file);
      flash(true, `File attached to report #${target.id}.`);
      load();
    } catch (err) {
      flash(false, err.response?.data?.detail || 'Upload failed');
    } finally {
      setBusyId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitForReview = async (report) => {
    setBusyId(report.id);
    try {
      await reportsAPI.submitForReview(report.id);
      flash(true, `Report #${report.id} submitted for admin review.`);
      load();
    } catch (err) {
      flash(false, err.response?.data?.detail || 'Submit failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: message.ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${message.ok ? '#3fb95055' : '#f8514955'}`,
            color: message.ok ? '#3fb950' : '#f85149',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <span style={{ fontSize: 16 }}>📑</span>
          <h3 className="panel-title">Workflow Reports</h3>
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto', fontSize: 12 }}
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? '✕ Cancel' : '+ New Report Draft'}
          </button>
        </div>
        <div className="panel-body">
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 0 }}>
            Create a technical or investigation report tied to an assigned service request, attach the final
            document, and submit it to the Admin Hub for review and release. A file must be attached before
            submission.
          </p>

          {/* Create form */}
          {showCreate && (
            <form
              onSubmit={createReport}
              style={{ display: 'grid', gap: 10, marginBottom: 20, border: '1px solid #1f6feb44', borderRadius: 8, padding: 16 }}
            >
              <input
                required
                style={inputStyle}
                placeholder="Report title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Executive summary…"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select
                  style={inputStyle}
                  value={form.report_type}
                  onChange={(e) => setForm({ ...form, report_type: e.target.value })}
                >
                  <option value="ANALYSIS">ANALYSIS (technical)</option>
                  <option value="INVESTIGATION">INVESTIGATION</option>
                  <option value="COMPLIANCE">COMPLIANCE</option>
                </select>
                <select
                  style={inputStyle}
                  value={form.service_request_id}
                  onChange={(e) => setForm({ ...form, service_request_id: e.target.value })}
                >
                  <option value="">Link to my assigned request…</option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.id} — {r.title} ({r.status})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ justifySelf: 'start' }}>
                Create Draft
              </button>
            </form>
          )}

          {/* Report list */}
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : reports.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: 13 }}>
              No workflow reports yet. Create a draft to start the review pipeline.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Request</th>
                  <th>Status</th>
                  <th>File</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const editable = ['DRAFT', 'CHANGES_REQUESTED', 'REJECTED'].includes(r.status);
                  return (
                    <tr key={r.id}>
                      <td style={{ color: '#8b949e', fontSize: 11 }}>{r.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>{r.title}</div>
                        {r.summary && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#8b949e',
                              maxWidth: 260,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.summary}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{r.report_type}</td>
                      <td style={{ fontSize: 12, color: '#8b949e' }}>
                        {r.service_request_id ? `#${r.service_request_id}` : '—'}
                      </td>
                      <td><StatusPill value={r.status} /></td>
                      <td style={{ fontSize: 12, color: r.has_file ? '#3fb950' : '#8b949e' }}>
                        {r.has_file ? 'attached' : 'missing'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {editable && !r.is_released && (
                            <>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                disabled={busyId === r.id}
                                onClick={() => pickUpload(r)}
                              >
                                {r.has_file ? 'Replace File' : 'Attach File'}
                              </button>
                              <button
                                className="btn-primary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                disabled={busyId === r.id || !r.has_file}
                                onClick={() => submitForReview(r)}
                                title={r.has_file ? '' : 'Attach a file first'}
                              >
                                Submit → Review
                              </button>
                            </>
                          )}
                          {!editable && (
                            <span style={{ fontSize: 11, color: '#8b949e' }}>
                              in review pipeline
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Hidden file input */}
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} />
        </div>
      </div>
    </>
  );
}

// ============================================================
// EXPORT SECTION (analysis session results)
// ============================================================

function ExportSection() {
  const { analysisResult: data } = useAnalysis();

  const handleDownload = (type) => {
    if (!data) {
      alert('No analysis data to download.');
      return;
    }

    let content = '';
    let filename = `aml_report_${Date.now()}`;
    let mime = 'text/plain';

    if (type === 'json') {
      content = JSON.stringify(data, null, 2);
      filename += '.json';
      mime = 'application/json';
    } else if (type === 'csv') {
      const rows = [
        ['Account', 'Risk Tier', 'Final Score', 'Graph', 'Behaviour', 'Temporal', 'ML', 'Community'],
      ];
      (data.hybrid_scores || []).forEach((h) => {
        rows.push([
          h.account_id,
          h.risk_tier,
          h.final_score,
          h.breakdown?.graph_score || 0,
          h.breakdown?.behaviour_score || 0,
          h.breakdown?.temporal_score || 0,
          h.breakdown?.ml_score || 0,
          h.breakdown?.community_score || 0,
        ]);
      });
      content = rows.map((r) => r.join(',')).join(String.fromCharCode(10));
      filename += '.csv';
      mime = 'text/csv';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span style={{ fontSize: 16 }}>📊</span>
        <h3 className="panel-title">Export Current Analysis</h3>
      </div>
      <div className="panel-body">
        <p style={{ color: '#8b949e', marginBottom: 20, fontSize: 13 }}>
          Export the current analysis session results for external review, audit compliance, or archiving.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            style={{
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: 20,
              cursor: 'pointer',
              transition: 'border 0.2s',
              background: '#161b22',
            }}
            onClick={() => handleDownload('csv')}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#388bfd')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#30363d')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>📈</div>
            <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>CSV Export</div>
            <div style={{ fontSize: 12, color: '#8b949e' }}>
              Tabular risk scores and breakdowns. Suitable for Excel.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: 20,
              cursor: 'pointer',
              transition: 'border 0.2s',
              background: '#161b22',
            }}
            onClick={() => handleDownload('json')}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3fb950')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#30363d')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{'{ }'}</div>
            <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>Full JSON Dump</div>
            <div style={{ fontSize: 12, color: '#8b949e' }}>
              Complete raw output including all detector payloads.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

function ReportsPage() {
  return (
    <AppLayout title="Reports" subtitle="Workflow reports and analysis exports">
      <div style={{ maxWidth: 1000 }}>
        <WorkflowReports />
        <ExportSection />
      </div>
    </AppLayout>
  );
}

export default ReportsPage;
