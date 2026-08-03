import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { adminAPI } from '../../services/api';
import { Spinner, Card } from 'react-bootstrap';
import { PeopleFill, ShieldLockFill, CheckCircleFill, ExclamationTriangleFill } from 'react-bootstrap-icons';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminAPI.getDashboard();
        setStats(data);
      } catch (err) {
        console.error('Failed to load admin stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <AppLayout title="Admin Dashboard">
        <div className="p-5 text-center"><Spinner animation="border" variant="primary" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="System Dashboard" subtitle="TraceAcc Enterprise Governance">
      
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-primary bg-opacity-25 p-3 rounded me-3 text-primary">
                <PeopleFill size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Total Users</div>
                <h3 className="mb-0 text-light">{stats?.total_users || 0}</h3>
              </div>
            </Card.Body>
          </Card>
        </div>
        
        <div className="col-md-3 mb-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-success bg-opacity-25 p-3 rounded me-3 text-success">
                <CheckCircleFill size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Service Requests</div>
                <h3 className="mb-0 text-light">{stats?.pending_requests || 0} <span className="fs-6 text-muted fw-normal">pending</span></h3>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3 mb-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-warning bg-opacity-25 p-3 rounded me-3 text-warning">
                <ShieldLockFill size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Active Cases</div>
                <h3 className="mb-0 text-light">{stats?.open_cases || 0}</h3>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-3 mb-3">
          <Card className="bg-dark border-secondary h-100 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-danger bg-opacity-25 p-3 rounded me-3 text-danger">
                <ExclamationTriangleFill size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">New Alerts</div>
                <h3 className="mb-0 text-light">{stats?.new_alerts || 0}</h3>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

    </AppLayout>
  );
}
