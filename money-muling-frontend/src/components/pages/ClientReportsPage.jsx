import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { reportsAPI } from '../../services/api';
import { Table, Spinner, Card, Button, Modal } from 'react-bootstrap';
import { CloudDownload, FileEarmarkText, Eye } from 'react-bootstrap-icons';
import traceAccBadge from '../../assets/traceaccbadge.png';

function ClientReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState(null);

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

  return (
    <AppLayout title="My Reports" subtitle="Download finalized analysis and investigation reports">
      <Card className="bg-dark border-secondary shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-5 text-center text-muted">
              <FileEarmarkText size={48} className="mb-3 opacity-50" />
              <p>No reports available yet.</p>
            </div>
          ) : (
            <Table hover responsive className="mb-0 align-middle text-light border-secondary">
              <thead>
                <tr className="text-muted bg-darker">
                  <th className="ps-4 border-secondary fw-medium">Report Title</th>
                  <th className="border-secondary fw-medium">Type</th>
                  <th className="border-secondary fw-medium">Date Released</th>
                  <th className="border-secondary text-end pe-4 fw-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="ps-4 border-secondary fw-bold text-light">
                      {report.title}
                      <div className="text-muted small fw-normal">{report.summary}</div>
                    </td>
                    <td className="border-secondary text-muted">{report.report_type}</td>
                    <td className="border-secondary text-muted">
                      {report.released_at ? new Date(report.released_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="border-secondary text-end pe-4">
                      <Button 
                        variant="outline-info" 
                        size="sm"
                        className="me-2"
                        onClick={() => setViewReport(report)}
                      >
                        <Eye className="me-2" /> View Report
                      </Button>
                      <Button 
                        variant="primary" 
                        size="sm"
                        href={reportsAPI.downloadUrl(report.id)}
                        target="_blank"
                      >
                        <CloudDownload className="me-2" /> Download PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Report Viewer Modal with TraceAcc Watermark */}
      <Modal show={!!viewReport} onHide={() => setViewReport(null)} size="lg" centered bg="dark" className="text-light">
        <Modal.Header closeButton className="border-secondary bg-dark text-light">
          <Modal.Title>{viewReport?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark position-relative" style={{ minHeight: '400px' }}>
          {/* WATERMARK SEAL */}
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-15deg)',
              opacity: 0.15,
              pointerEvents: 'none',
              zIndex: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <img src={traceAccBadge} alt="TraceAcc Seal" style={{ width: '250px', filter: 'grayscale(100%) brightness(200%)' }} />
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '10px', color: '#fff', border: '3px solid #fff', padding: '5px 15px', borderRadius: '5px', letterSpacing: '4px' }}>
              OFFICIALLY RELEASED
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h4 className="text-primary border-bottom border-secondary pb-2 mb-3">Executive Summary</h4>
            <p className="text-light">{viewReport?.summary || 'No summary provided.'}</p>
            
            <h5 className="text-info mt-4">Details</h5>
            <ul>
              <li><strong>Type:</strong> {viewReport?.report_type}</li>
              <li><strong>Status:</strong> <span className="text-success">{viewReport?.status}</span></li>
              <li><strong>Released At:</strong> {viewReport?.released_at ? new Date(viewReport?.released_at).toLocaleString() : 'N/A'}</li>
            </ul>
            <div className="mt-4 p-3 bg-darker border border-secondary rounded">
              <small className="text-muted">This is an officially sealed document generated by TraceAcc Pro. It contains confidential AML findings intended solely for the authorized client.</small>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-secondary bg-dark">
          <Button variant="secondary" onClick={() => setViewReport(null)}>
            Close
          </Button>
          <Button variant="primary" href={viewReport ? reportsAPI.downloadUrl(viewReport.id) : '#'} target="_blank">
            Download PDF
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}

export default ClientReportsPage;
