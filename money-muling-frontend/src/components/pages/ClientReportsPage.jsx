import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { reportsAPI } from '../../services/api';
import traceAccBadge from '../../assets/traceaccbadge.png';

// Digital seal badge shown next to released reports.
function SealBadge({ report }) {
  const [seal, setSeal] = useState(null);

  useEffect(() => {
    if (!report.signature_hash) return;
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
  }, [report.id, report.signature_hash]);

  if (!report.signature_hash || !seal) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 14,
        border: `1px solid ${seal.valid ? '#a371f7' : '#f85149'}`,
        background: seal.valid ? 'rgba(163,113,247,0.1)' : 'rgba(248,81,73,0.1)',
        fontSize: 11,
        fontWeight: 600,
        color: seal.valid ? '#a371f7' : '#f85149',
        marginTop: 6,
      }}
      title={
        seal.valid
          ? `Officially sealed · ${seal.seal_id} · signed by ${seal.signed_by} on ${new Date(seal.signed_at).toLocaleString()}`
          : seal.reason
      }
    >
      {seal.valid ? '✓ Officially Sealed' : '✕ Seal Invalid — Contact Support'}
    </div>
  );
}

function ClientReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await reportsAPI.list();
        setReports(res.items || []);
      } catch (err) {
        console.error('Failed to load reports', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const handleDownload = async (report) => {
    try {
      setDownloadingId(report.id);
      await reportsAPI.download(report);
    } catch (err) {
      console.error('Download failed', err);
      alert(err.response?.data?.detail || 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout title="My Reports" subtitle="Download finalized analysis and investigation reports">
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              No reports released to your portal yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Type</th>
                  <th>Seal</th>
                  <th>Released</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f0f6fc', fontSize: 13 }}>{report.title}</div>
                      {report.summary && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#8b949e',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {report.summary}
                        </div>
                      )}
                      <SealBadge report={report} />
                    </td>
                    <td style={{ fontSize: 12 }}>{report.report_type}</td>
                    <td>
                      {report.signature_hash ? (
                        <span style={{ fontSize: 12, color: '#a371f7' }}>✓ sealed</span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#8b949e' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: '#8b949e' }}>
                      {report.released_at ? new Date(report.released_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => setViewReport(report)}
                        >
                          View
                        </button>
                        <button
                          className="btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          disabled={downloadingId === report.id}
                          onClick={() => handleDownload(report)}
                        >
                          {downloadingId === report.id ? 'Downloading…' : 'Download PDF'}
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

      {/* Report Viewer Modal with TraceAcc watermark */}
      {viewReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(1,4,9,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setViewReport(null)}
        >
          <div
            className="panel"
            style={{ width: 640, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto', margin: 0, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Watermark */}
            <div
              style={{
                position: 'absolute',
                top: '45%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-15deg)',
                opacity: 0.12,
                pointerEvents: 'none',
                zIndex: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <img
                src={traceAccBadge}
                alt="TraceAcc Seal"
                style={{ width: 220, filter: 'grayscale(100%) brightness(200%)' }}
              />
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  marginTop: 8,
                  color: '#fff',
                  border: '3px solid #fff',
                  padding: '4px 14px',
                  borderRadius: 5,
                  letterSpacing: 4,
                }}
              >
                OFFICIALLY RELEASED
              </div>
            </div>

            <div className="panel-header">
              <h3 className="panel-title">{viewReport.title}</h3>
              <button
                className="btn-secondary"
                style={{ marginLeft: 'auto', fontSize: 12 }}
                onClick={() => setViewReport(null)}
              >
                ✕ Close
              </button>
            </div>
            <div className="panel-body" style={{ position: 'relative', zIndex: 1 }}>
              <SealBadge report={viewReport} />

              <h4 style={{ color: '#58a6ff', borderBottom: '1px solid #30363d', paddingBottom: 8, marginTop: 16 }}>
                Executive Summary
              </h4>
              <p style={{ color: '#c9d1d9', fontSize: 13 }}>{viewReport.summary || 'No summary provided.'}</p>

              <h4 style={{ color: '#58a6ff', borderBottom: '1px solid #30363d', paddingBottom: 8, marginTop: 16 }}>
                Details
              </h4>
              <ul style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.8 }}>
                <li><strong>Type:</strong> {viewReport.report_type}</li>
                <li><strong>Status:</strong> {viewReport.status}</li>
                <li>
                  <strong>Released:</strong>{' '}
                  {viewReport.released_at ? new Date(viewReport.released_at).toLocaleString() : 'N/A'}
                </li>
                {viewReport.signature_hash && (
                  <li style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    <strong>Seal hash:</strong> {viewReport.signature_hash.slice(0, 32)}…
                  </li>
                )}
              </ul>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: 6,
                }}
              >
                <small style={{ color: '#8b949e', fontSize: 11 }}>
                  This is an officially sealed document generated by TraceAcc Pro. It contains confidential AML
                  findings intended solely for the authorized client.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  className="btn-primary"
                  disabled={downloadingId === viewReport.id}
                  onClick={() => handleDownload(viewReport)}
                >
                  {downloadingId === viewReport.id ? 'Downloading…' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default ClientReportsPage;
