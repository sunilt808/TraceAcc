import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI, reportsAPI } from '../../services/api';
import {
  ShieldCheck,
  XCircle,
  FileText,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Lock,
  Send,
  FileCheck,
} from 'lucide-react';
import { Card, Table, Button, Spinner, Badge } from 'react-bootstrap';

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
        fontSize: 11,
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
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
      <span className="text-secondary small">unsigned</span>
    );
  }

  if (!seal) {
    return <span className="text-secondary small">checking seal…</span>;
  }

  const valid = seal.valid;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 14,
        border: `1px solid ${valid ? '#3fb950' : '#f85149'}`,
        background: valid ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
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
      {valid ? (
        <>
          <ShieldCheck size={13} />
          <span>Sealed</span>
        </>
      ) : (
        <>
          <XCircle size={13} />
          <span>Seal Invalid</span>
        </>
      )}
    </div>
  );
}

const darkCardStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
};

const cellStyle = {
  backgroundColor: '#0d1117',
  borderColor: '#21262d',
  color: '#c9d1d9',
};

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
        flash(true, `Report #${report.id} approved. You can now sign and seal it.`);
      } else if (action === 'sign') {
        const signed = await reportsAPI.sign(report.id);
        flash(true, `Report #${report.id} digitally sealed — ${signed.seal_id}`);
      } else if (action === 'release') {
        await reportsAPI.release(report.id);
        flash(true, `Report #${report.id} successfully released to client portal.`);
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

  return (
    <AppLayout
      title="Report Review"
       >
      {/* Messages */}
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
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {message.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="text-white mb-1">Reports Review Queue</h4>
          <div className="text-secondary small">Total Pending / Completed Reports: {reports.length}</div>
        </div>

        <Button
          variant="outline-secondary"
          size="sm"
          onClick={loadReports}
          disabled={loading}
          className="d-flex align-items-center gap-1.5"
          style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm mb-4" style={darkCardStyle}>
        <Card.Body className="p-0" style={{ backgroundColor: '#0d1117' }}>
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="info" />
              <div className="text-secondary mt-3">Loading reports queue...</div>
            </div>
          ) : error ? (
            <div className="p-4 text-danger">{error}</div>
          ) : reports.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              <FileCheck size={48} className="text-secondary opacity-50 mb-3" />
              <h5 className="text-white">No reports in review queue</h5>
              <p className="text-secondary mb-0">Reports created by TraceLab and InvoSpace will appear here for verification.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle" style={{ borderColor: '#21262d' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <th className="ps-4 py-3" style={cellStyle}>#</th>
                    <th className="py-3" style={cellStyle}>Report</th>
                    <th className="py-3" style={cellStyle}>Type</th>
                    <th className="py-3" style={cellStyle}>Request</th>
                    <th className="py-3" style={cellStyle}>Status</th>
                    <th className="py-3" style={cellStyle}>File</th>
                    <th className="py-3" style={cellStyle}>Seal</th>
                    <th className="py-3 text-end pe-4" style={cellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const busy = actionLoading === report.id;
                    const hasFile = report.has_file;
                    const status = report.status;
                    return (
                      <tr key={report.id}>
                        <td className="ps-4" style={cellStyle}>
                          <span className="text-secondary small">#{report.id}</span>
                        </td>
                        <td style={cellStyle}>
                          <div className="fw-semibold text-white">
                            {report.title || `Report #${report.id}`}
                          </div>
                          {report.summary && (
                            <div
                              className="text-secondary small text-truncate"
                              style={{ maxWidth: 260 }}
                              title={report.summary}
                            >
                              {report.summary}
                            </div>
                          )}
                        </td>
                        <td style={cellStyle}>
                          <span className="text-light small">{report.report_type}</span>
                        </td>
                        <td style={cellStyle}>
                          <span className="text-secondary small">
                            {report.service_request_id ? `#${report.service_request_id}` : '—'}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <StatusPill value={status} />
                        </td>
                        <td style={cellStyle}>
                          <span className={hasFile ? 'text-success small fw-semibold' : 'text-secondary small'}>
                            {hasFile ? 'Attached' : 'Missing'}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <SealBadge report={report} />
                        </td>
                        <td className="text-end pe-4" style={cellStyle}>
                          <div className="d-inline-flex gap-1.5 align-items-center">
                            {hasFile && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => download(report)}
                                className="d-inline-flex align-items-center gap-1"
                                style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9', fontSize: 11 }}
                              >
                                <Download size={12} />
                                <span>File</span>
                              </Button>
                            )}

                            {/* Approve */}
                            {['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(status) && (
                              <Button
                                variant="outline-success"
                                size="sm"
                                disabled={busy}
                                onClick={() => runAction(report, 'approve')}
                                style={{ fontSize: 11 }}
                              >
                                Approve
                              </Button>
                            )}

                            {/* Sign / Seal */}
                            {['APPROVED', 'SIGNED'].includes(status) && (
                              <Button
                                variant="outline-info"
                                size="sm"
                                disabled={busy || !hasFile}
                                onClick={() => runAction(report, 'sign')}
                                className="d-inline-flex align-items-center gap-1"
                                style={{ fontSize: 11 }}
                              >
                                <Lock size={12} />
                                <span>{status === 'SIGNED' ? 'Re-seal' : 'Seal'}</span>
                              </Button>
                            )}

                            {/* Release */}
                            {['APPROVED', 'SIGNED'].includes(status) && (
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={busy || !hasFile}
                                onClick={() => runAction(report, 'release')}
                                className="d-inline-flex align-items-center gap-1"
                                style={{ fontSize: 11 }}
                              >
                                <Send size={12} />
                                <span>Release</span>
                              </Button>
                            )}

                            {/* Reject */}
                            {['READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED'].includes(status) && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                disabled={busy}
                                onClick={() => runAction(report, 'reject')}
                                style={{ fontSize: 11 }}
                              >
                                Reject
                              </Button>
                            )}

                            {status === 'RELEASED' && (
                              <span className="text-success small fw-semibold">
                                Released {report.released_at ? new Date(report.released_at).toLocaleDateString() : ''}
                              </span>
                            )}

                            {status === 'REJECTED' && (
                              <span className="text-danger small">Rejected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <div className="text-secondary small" style={{ lineHeight: 1.6 }}>
        Pipeline: submit → approve → <strong style={{ color: '#a371f7' }}>seal (SHA-256 digital signature)</strong> →
        release. Releasing requires an attached file. Modifying a sealed report invalidates its digital seal automatically.
      </div>
    </AppLayout>
  );
}
