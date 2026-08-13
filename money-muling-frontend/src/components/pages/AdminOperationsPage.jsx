import React, { useEffect, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Table, Spinner, Badge, Card, Button } from 'react-bootstrap';

export default function AdminOperationsPage() {
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadOperations = async () => {
        try {
            setLoading(true);
            setError('');

            const data = await adminAPI.getOperationsQueue();

            setOperations(
                Array.isArray(data)
                    ? data
                    : data?.items || []
            );
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                'Failed to load operations queue'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOperations();
    }, []);

    const statusVariant = (status) => {
        if (
            ['COMPLETED', 'CLOSED', 'APPROVED'].includes(status)
        ) {
            return 'success';
        }

        if (
            ['FAILED', 'REJECTED', 'ERROR'].includes(status)
        ) {
            return 'danger';
        }

        if (
            ['IN_PROGRESS', 'PROCESSING', 'ANALYSIS'].includes(status)
        ) {
            return 'warning';
        }

        return 'secondary';
    };

    return (
        <AppLayout
            title="Operations Queue"
            subtitle="Monitor active AML operations and workflow progress"
        >
            <div className="d-flex justify-content-end mb-3">
                <Button
                    variant="outline-light"
                    onClick={loadOperations}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </div>

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
                                        <th>Type</th>
                                        <th>Organization</th>
                                        <th>Assigned To</th>
                                        <th>Status</th>
                                        <th>Updated</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {operations.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="text-center py-5 text-secondary"
                                            >
                                                No operations currently in queue
                                            </td>
                                        </tr>
                                    ) : (
                                        operations.map((operation) => (
                                            <tr key={operation.id}>
                                                <td>{operation.id}</td>

                                                <td>
                                                    {operation.type ||
                                                        operation.operation_type ||
                                                        operation.service_type ||
                                                        'Operation'}
                                                </td>

                                                <td>
                                                    {operation.organization_name ||
                                                        operation.organization?.name ||
                                                        'N/A'}
                                                </td>

                                                <td>
                                                    {operation.assigned_to_name ||
                                                        operation.assigned_user?.username ||
                                                        operation.assignee ||
                                                        'Unassigned'}
                                                </td>

                                                <td>
                                                    <Badge
                                                        bg={statusVariant(operation.status)}
                                                    >
                                                        {operation.status || 'UNKNOWN'}
                                                    </Badge>
                                                </td>

                                                <td>
                                                    {operation.updated_at
                                                        ? new Date(
                                                            operation.updated_at
                                                        ).toLocaleString()
                                                        : operation.created_at
                                                            ? new Date(
                                                                operation.created_at
                                                            ).toLocaleString()
                                                            : 'N/A'}
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