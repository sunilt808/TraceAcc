import React, { useEffect, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Button, Badge, Card } from 'react-bootstrap';

export default function AdminRequestsPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');

    const loadRequests = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await adminAPI.getRequestQueue();
            setRequests(Array.isArray(data) ? data : data?.items || []);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const reviewRequest = async (id, status) => {
        try {
            setActionLoading(id);
            await adminAPI.reviewServiceRequest(id, { status });
            await loadRequests();
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to review request');
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
            title="Service Requests"
            subtitle="Review and manage client service requests"
        >
            <Card
                className="shadow-sm"
                style={{ backgroundColor: '#0d1117', borderColor: '#21262d' }}
            >
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center p-5">
                            <Spinner animation="border" />
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger m-3">{error}</div>
                    ) : (
                        <div className="table-responsive">
                            <Table
                                hover
                                className="mb-0 align-middle"
                                variant="dark"
                            >
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Client</th>
                                        <th>Organization</th>
                                        <th>Service</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {requests.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="text-center py-5 text-secondary">
                                                No service requests found
                                            </td>
                                        </tr>
                                    ) : (
                                        requests.map((request) => (
                                            <tr key={request.id}>
                                                <td>{request.id}</td>

                                                <td>
                                                    {request.client_name ||
                                                        request.username ||
                                                        request.user?.username ||
                                                        'N/A'}
                                                </td>

                                                <td>
                                                    {request.organization_name ||
                                                        request.organization?.name ||
                                                        'N/A'}
                                                </td>

                                                <td>
                                                    {request.service_type ||
                                                        request.request_type ||
                                                        request.title ||
                                                        'N/A'}
                                                </td>

                                                <td>
                                                    <Badge bg={statusVariant(request.status)}>
                                                        {request.status || 'UNKNOWN'}
                                                    </Badge>
                                                </td>

                                                <td>
                                                    {request.created_at
                                                        ? new Date(request.created_at).toLocaleString()
                                                        : 'N/A'}
                                                </td>

                                                <td>
                                                    <div className="d-flex gap-2">
                                                        {request.status !== 'APPROVED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="success"
                                                                disabled={actionLoading === request.id}
                                                                onClick={() =>
                                                                    reviewRequest(request.id, 'APPROVED')
                                                                }
                                                            >
                                                                Approve
                                                            </Button>
                                                        )}

                                                        {request.status !== 'REJECTED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                disabled={actionLoading === request.id}
                                                                onClick={() =>
                                                                    reviewRequest(request.id, 'REJECTED')
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