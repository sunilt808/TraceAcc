import React, { useEffect, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Button, Badge, Card } from 'react-bootstrap';

export default function AdminReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');

    const loadReports = async () => {
        try {
            setLoading(true);
            setError('');

            const data = await adminAPI.getReportQueue();

            setReports(
                Array.isArray(data)
                    ? data
                    : data?.items || []
            );
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const reviewReport = async (id, status) => {
        try {
            setActionLoading(id);

            await adminAPI.reviewReport(id, { status });

            await loadReports();
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to review report');
        } finally {
            setActionLoading(null);
        }
    };

    const statusVariant = (status) => {
        if (status === 'APPROVED') return 'success';
        if (status === 'REJECTED') return 'danger';
        if (status === 'UNDER_REVIEW') return 'warning';
        return 'secondary';
    };

    return (
        <AppLayout
            title="Client Reports"
            subtitle="Review reports before releasing them to clients"
        >
            <Card
                className="shadow-sm"
                style={{
                    backgroundColor: '#0d1117',
                    borderColor: '#21262d',
                }}
            >
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center p-5">
                            <Spinner animation="border" />
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger m-3">
                            {error}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover variant="dark" className="mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Report</th>
                                        <th>Organization</th>
                                        <th>Case</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {reports.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="text-center py-5 text-secondary"
                                            >
                                                No reports found
                                            </td>
                                        </tr>
                                    ) : (
                                        reports.map((report) => (
                                            <tr key={report.id}>
                                                <td>{report.id}</td>

                                                <td>
                                                    {report.title ||
                                                        report.report_name ||
                                                        `Report #${report.id}`}
                                                </td>

                                                <td>
                                                    {report.organization_name ||
                                                        report.organization?.name ||
                                                        'N/A'}
                                                </td>

                                                <td>
                                                    {report.case_id ||
                                                        report.case?.id ||
                                                        'N/A'}
                                                </td>

                                                <td>
                                                    <Badge bg={statusVariant(report.status)}>
                                                        {report.status || 'UNKNOWN'}
                                                    </Badge>
                                                </td>

                                                <td>
                                                    {report.created_at
                                                        ? new Date(
                                                            report.created_at
                                                        ).toLocaleString()
                                                        : 'N/A'}
                                                </td>

                                                <td>
                                                    <div className="d-flex gap-2">
                                                        {report.status !== 'APPROVED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="success"
                                                                disabled={actionLoading === report.id}
                                                                onClick={() =>
                                                                    reviewReport(
                                                                        report.id,
                                                                        'APPROVED'
                                                                    )
                                                                }
                                                            >
                                                                Approve
                                                            </Button>
                                                        )}

                                                        {report.status !== 'REJECTED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                disabled={actionLoading === report.id}
                                                                onClick={() =>
                                                                    reviewReport(
                                                                        report.id,
                                                                        'REJECTED'
                                                                    )
                                                                }
                                                            >
                                                                Reject
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </AppLayout>
    );
}