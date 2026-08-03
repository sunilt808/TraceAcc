import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { reportsAPI } from '../../services/api';
import { Table, Spinner, Card, Button } from 'react-bootstrap';
import { CloudDownload, FileEarmarkText } from 'react-bootstrap-icons';

function ClientReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

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
                  <th className="border-secondary text-end pe-4 fw-medium">Download</th>
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
                      {new Date(report.released_at).toLocaleDateString()}
                    </td>
                    <td className="border-secondary text-end pe-4">
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
    </AppLayout>
  );
}

export default ClientReportsPage;
