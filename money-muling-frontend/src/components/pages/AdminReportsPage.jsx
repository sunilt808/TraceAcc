import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI, reportsAPI } from '../../services/api';

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

// Digital seal badge — verifies the SHA-256 seal against current content.
function SealBadge({ report }) {
  const [seal, setSeal] = useState(null);

  useEffect(() => {
    if (!report.signature_hash) {
      setSeal(null);
      return;
    }
    let alive = true;
    reportsAPI
      .verifySignature(report.id)
      .then((res) => {
        if (alive) setSeal(res);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [report.id, report.signature_hash, report.updated_at]);

  if (!report.signature_hash) {
    return (
      <span style={{ fontSize: 11, color: '#8b949e' }}>unsigned</span>
    );
  }

  if (!seal) {
    return <span style={{ fontSize: 11, color: '#8b949e' }}>checking seal…</span>;
  }

  const valid = seal.valid;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 14,
        border: `1px solid ${valid ? '#3fb950' : '#f85149'}`,
        background: valid ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
        fontSize: 11,
        fontWeight: 600,
        color: valid ? '#3fb950' : '#f85149',
        cursor: 'default',
      }}
      title={
        valid
          ? `Seal ${seal.seal_id} · signed by ${seal.signed_by} at ${new Date(seal.signed_at).toLocaleString()}`
          : seal.reason
      }
    >
      {valid ? '✓ Sealed' : '✕ Seal INVALID'}
    </div>
  );
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminAPI.getReportQueue();
      setReports(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const flash = (ok, text) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const runAction = async (report, action) => {
    setActionLoading(report.id);
    try {
      if (action === 'approve') {
        await reportsAPI.approve(report.id);
        flash(true, `Report #${report.id} approved. You can now sign it.`);
      } else if (action === 'sign') {
        const signed = await reportsAPI.sign(report.id);
        flash(true, `Report #${report.id} sealed — ${signed.seal_id}`);
      } else if (action === 'release') {
        await reportsAPI.release(report.id);
        flash(true, `Report #${report.id} released to the client portal.`);
      } else if (action === 'reject') {
        await adminAPI.reviewReport(report.id, { status: 'REJECTED' });
        flash(true, `Report #${report.id} rejected.`);
      }
      await loadReports();
    } catch (err) {
      flash(false, err.response?.data?.detail || `${action} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  const download = async (report) => {
    try {
      await reportsAPI.download(report);
    } catch (err) {
      flash(false, err.response?.data?.detail || 'Download failed');
    }
  };

  const btn = (label, variant, disabled, onClick) => (
    <button
      className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
      style={{ fontSize: 11, padding: '4px 10px' }}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <AppLayout title="Report Review" subtitle="Approve, seal and release client reports">
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
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: '#f85149' }}>{error}</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              No reports in the review queue.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Report</th>
                  <th>Type</th>
                  <th>Request</th>
                  <th>Status</th>
                  <th>File</th>
                  <th>Seal</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const busy = actionLoading === report.id;
                  const hasFile = report.has_file;
                  const status = report.status;
                  return (
                    <tr key={report.id}>
                      <td style={{ color: '#8b949e', fontSize: 11 }}>{report.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>
                          {report.title || `Report #${report.id}`}
                        </div>
                        {report.summary && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#8b949e',
                              maxWidth: 240,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={report.summary}
                          >
                            {report.summary}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{report.report_type}</td>
                      <td style={{ fontSize: 12, color: '#8b949e' }}>
                        {report.service_request_id ? `#${report.service_request_id}` : '—'}
                      </td>
                      <td><StatusPill value={status} /></td>
                      <td style={{ fontSize: 12, color: hasFile ? '#3fb950' : '#8b949e' }}>
                        {hasFile ? 'attached' : 'missing'}
                      </td>
                      <td><SealBadge report={report} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {hasFile && (
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              disabled={busy}
                              onClick={() => download(report)}
                            >
                              File
                            </button>
                          )}

                          {/* Approve: READY_FOR_REVIEW / UNDER_REVIEW */}
                          {['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(status) &&
                            btn('Approve', 'secondary', busy, () => runAction(report, 'approve'))}

                          {/* Sign: APPROVED (or re-seal after SIGNED) */}
                          {['APPROVED', 'SIGNED'].includes(status) &&
                            btn(
                              status === 'SIGNED' ? 'Re-seal' : 'Seal',
                              'primary',
                              busy || !hasFile,
                              () => runAction(report, 'sign')
                            )}

                          {/* Release: APPROVED or SIGNED */}
                          {['APPROVED', 'SIGNED'].includes(status) &&
                            btn('Release', 'primary', busy || !hasFile, () =>
                              runAction(report, 'release')
                            )}

                          {/* Reject while pre-release */}
                          {['READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED'].includes(status) &&
                            btn('Reject', 'secondary', busy, () => runAction(report, 'reject'))}

                          {status === 'RELEASED' && (
                            <span style={{ fontSize: 11, color: '#3fb950' }}>
                              Released {report.released_at ? new Date(report.released_at).toLocaleDateString() : ''}
                            </span>
                          )}

                          {status === 'REJECTED' && (
                            <span style={{ fontSize: 11, color: '#f85149' }}>Rejected — creator can revise</span>
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

      <p style={{ fontSize: 11, color: '#8b949e', marginTop: 10 }}>
        Pipeline: submit → approve → <strong style={{ color: '#a371f7' }}>seal (SHA-256 digital signature)</strong> →
        release. Releasing requires an attached file. Editing a sealed report invalidates its seal automatically.
      </p>
    </AppLayout>
  );
}
