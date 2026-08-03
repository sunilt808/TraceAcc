import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/theme.css';
import LoginCard from './components/auth/LoginCard';
import Dashboard from './components/dashboard/Dashboard';
import ProfilePage from './components/profile/ProfilePage';
import RoleRoute from './components/auth/RoleRoute';
import ClientPortal from './components/pages/ClientPortal';
import ClientRequestForm from './components/pages/ClientRequestForm';
import ClientReportsPage from './components/pages/ClientReportsPage';
import AdminDashboard from './components/pages/AdminDashboard';
import AdminUsersPage from './components/pages/AdminUsersPage';
import AuditHistory from './components/audit/AuditHistory';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import SampleGenerator from './components/dashboard/SampleGenerator';

import AppLayout from './components/layout/AppLayout';
import LandingPage from './components/pages/LandingPage';

// New Pages
import OverviewPage from './components/pages/OverviewPage';
import GraphViewer from './components/pages/GraphViewer';
import CommunitiesPage from './components/pages/CommunitiesPage';
import RiskMapPage from './components/pages/RiskMapPage';
import TimelinePage from './components/pages/TimelinePage';
import StatisticsPage from './components/pages/StatisticsPage';
import ReportsPage from './components/pages/ReportsPage';
import CasesPage from './components/pages/CasesPage';
import CaseDetail from './components/pages/CaseDetail';
import AlertsPage from './components/pages/AlertsPage';

import SettingsPage from './components/settings/SettingsPage';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center bg-darker text-light">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginCard />} />
      <Route path="/sample-generator" element={<ProtectedRoute><AppLayout title="Sample Generator"><SampleGenerator /></AppLayout></ProtectedRoute>} />
      
      <Route element={<ProtectedRoute />}>
            
            {/* Client Portal Routes */}
            <Route element={<RoleRoute allowedRoles={['CLIENT_USER', 'ADMIN', 'SUPER_ADMIN']} redirectPath="/overview" />}>
              <Route path="/client-dashboard" element={<ClientPortal />} />
              <Route path="/client-requests/new" element={<ClientRequestForm />} />
              <Route path="/client-reports" element={<ClientReportsPage />} />
            </Route>

            {/* Analyst & Investigation Routes */}
            <Route element={<RoleRoute allowedRoles={['TRACE_LAB_ANALYST', 'ADMIN', 'SUPER_ADMIN']} redirectPath="/client-dashboard" />}>
              <Route path="/dashboard" element={<AppLayout title="Analyze"><Dashboard /></AppLayout>} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/risk-map" element={<RiskMapPage />} />
              <Route path="/graph-viewer" element={<GraphViewer />} />
            </Route>

            {/* Investigation and Management Routes */}
            <Route element={<RoleRoute allowedRoles={['TRACE_LAB_ANALYST', 'INVESTIGATOR', 'ADMIN', 'SUPER_ADMIN', 'AUDITOR']} redirectPath="/client-dashboard" />}>
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/alerts" element={<AlertsPage />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<RoleRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']} redirectPath="/overview" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>

            {/* Common Authenticated Routes */}
            <Route path="/profile" element={<AppLayout title="Profile"><ProfilePage /></AppLayout>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/audit-history" element={<AppLayout title="Audit Logs"><AuditHistory /></AppLayout>} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/communities" element={<CommunitiesPage />} />
            
          </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
