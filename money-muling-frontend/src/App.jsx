import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import AdminOrgsPage from './components/pages/AdminOrgsPage';
import AuditHistory from './components/audit/AuditHistory';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import SampleGenerator from './components/dashboard/SampleGenerator';

import AppLayout from './components/layout/AppLayout';
import LandingPage from './components/pages/LandingPage';
import WorkspaceSelector from './components/pages/WorkspaceSelector';

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

const routeMap = {
  overview: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/overview',
    INVESTIGATOR: '/invospace/overview',
  },
  dashboard: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/dashboard',
    INVESTIGATOR: '/invospace/dashboard',
  },
  upload: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/upload',
    INVESTIGATOR: '/invospace/upload',
  },
  graph: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/graph-viewer',
    INVESTIGATOR: '/invospace/graph-viewer',
  },
  riskMap: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/risk-map',
    INVESTIGATOR: '/invospace/risk-map',
  },
  communities: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/communities',
    INVESTIGATOR: '/invospace/communities',
  },
  timeline: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/timeline',
    INVESTIGATOR: '/invospace/timeline',
  },
  statistics: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/statistics',
    INVESTIGATOR: '/invospace/statistics',
  },
  reports: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/reports',
    INVESTIGATOR: '/invospace/reports',
  },
  cases: {
    CLIENT: '/client-dashboard',
    INVESTIGATOR: '/invospace/cases',
  },
  alerts: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/alerts',
    INVESTIGATOR: '/invospace/alerts',
  },
  caseDetail: {
    CLIENT: '/client-dashboard',
    INVESTIGATOR: '/invospace/cases',
  },
};

const adminWorkspacePaths = {
  tracelab: {
    overview: '/tracelab/overview',
    dashboard: '/tracelab/dashboard',
    upload: '/tracelab/upload',
    graph: '/tracelab/graph-viewer',
    riskMap: '/tracelab/risk-map',
    communities: '/tracelab/communities',
    timeline: '/tracelab/timeline',
    statistics: '/tracelab/statistics',
    reports: '/tracelab/reports',
    alerts: '/tracelab/alerts',
  },
  invospace: {
    overview: '/invospace/overview',
    dashboard: '/invospace/dashboard',
    upload: '/invospace/upload',
    graph: '/invospace/graph-viewer',
    riskMap: '/invospace/risk-map',
    communities: '/invospace/communities',
    timeline: '/invospace/timeline',
    statistics: '/invospace/statistics',
    reports: '/invospace/reports',
    cases: '/invospace/cases',
    alerts: '/invospace/alerts',
    caseDetail: '/invospace/cases',
  },
};

const WorkspaceRedirect = ({ page }) => {
  const { role, workspace } = useAuth();
  const params = useParams();

  if (role === 'ADMIN') {
    if (!workspace || workspace === 'admin') {
      return <Navigate to="/workspace-selector" replace />;
    }
    const adminPath = adminWorkspacePaths[workspace]?.[page];
    if (!adminPath) {
      return <Navigate to="/workspace-selector" replace />;
    }
    return <Navigate to={page === 'caseDetail' && params.id ? `${adminPath}/${params.id}` : adminPath} replace />;
  }

  const roleMap = routeMap[page] ?? routeMap.overview;
  const path = roleMap?.[role] || '/login';
  return <Navigate to={page === 'caseDetail' && params.id ? `${path}/${params.id}` : path} replace />;
};

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
            <Route element={<RoleRoute allowedRoles={['CLIENT']} redirectPath="/overview" />}>
              <Route path="/client-dashboard" element={<ClientPortal />} />
              <Route path="/client-requests/new" element={<ClientRequestForm />} />
              <Route path="/client-reports" element={<ClientReportsPage />} />
            </Route>

            {/* TraceLab Workspace Routes */}
            <Route element={<RoleRoute allowedRoles={['TRACE_LAB_ANALYST', 'ADMIN']} redirectPath="/client-dashboard" />}>
              <Route path="/tracelab" element={<Navigate to="/tracelab/overview" replace />} />
              <Route path="/tracelab/overview" element={<OverviewPage />} />
              <Route path="/tracelab/dashboard" element={<AppLayout title="Analyze"><Dashboard /></AppLayout>} />
              <Route path="/tracelab/upload" element={<AppLayout title="Upload CSV"><Dashboard /></AppLayout>} />
              <Route path="/tracelab/risk-map" element={<RiskMapPage />} />
              <Route path="/tracelab/graph-viewer" element={<GraphViewer />} />
              <Route path="/tracelab/communities" element={<CommunitiesPage />} />
              <Route path="/tracelab/timeline" element={<TimelinePage />} />
              <Route path="/tracelab/statistics" element={<StatisticsPage />} />
              <Route path="/tracelab/reports" element={<ReportsPage />} />
              <Route path="/tracelab/alerts" element={<AlertsPage />} />
            </Route>

            {/* InvoSpace Workspace Routes */}
            <Route element={<RoleRoute allowedRoles={['INVESTIGATOR', 'ADMIN']} redirectPath="/client-dashboard" />}>
              <Route path="/invospace" element={<Navigate to="/invospace/overview" replace />} />
              <Route path="/invospace/overview" element={<OverviewPage />} />
              <Route path="/invospace/dashboard" element={<AppLayout title="Analyze"><Dashboard /></AppLayout>} />
              <Route path="/invospace/upload" element={<AppLayout title="Upload CSV"><Dashboard /></AppLayout>} />
              <Route path="/invospace/risk-map" element={<RiskMapPage />} />
              <Route path="/invospace/graph-viewer" element={<GraphViewer />} />
              <Route path="/invospace/communities" element={<CommunitiesPage />} />
              <Route path="/invospace/timeline" element={<TimelinePage />} />
              <Route path="/invospace/statistics" element={<StatisticsPage />} />
              <Route path="/invospace/reports" element={<ReportsPage />} />
              <Route path="/invospace/cases" element={<CasesPage />} />
              <Route path="/invospace/cases/:id" element={<CaseDetail />} />
              <Route path="/invospace/alerts" element={<AlertsPage />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<RoleRoute allowedRoles={['ADMIN']} redirectPath="/overview" />}>
              <Route path="/workspace-selector" element={<WorkspaceSelector />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/organizations" element={<AdminOrgsPage />} />
            </Route>

            {/* Common Authenticated Routes */}
            <Route path="/profile" element={<AppLayout title="Profile"><ProfilePage /></AppLayout>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/audit-history" element={<AppLayout title="Audit Logs"><AuditHistory /></AppLayout>} />
            <Route path="/overview" element={<WorkspaceRedirect page="overview" />} />
            <Route path="/dashboard" element={<WorkspaceRedirect page="dashboard" />} />
            <Route path="/upload" element={<WorkspaceRedirect page="upload" />} />
            <Route path="/graph-viewer" element={<WorkspaceRedirect page="graph" />} />
            <Route path="/risk-map" element={<WorkspaceRedirect page="riskMap" />} />
            <Route path="/communities" element={<WorkspaceRedirect page="communities" />} />
            <Route path="/timeline" element={<WorkspaceRedirect page="timeline" />} />
            <Route path="/statistics" element={<WorkspaceRedirect page="statistics" />} />
            <Route path="/reports" element={<WorkspaceRedirect page="reports" />} />
            <Route path="/cases" element={<WorkspaceRedirect page="cases" />} />
            <Route path="/cases/:id" element={<WorkspaceRedirect page="caseDetail" />} />
            <Route path="/alerts" element={<WorkspaceRedirect page="alerts" />} />
            
          </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
