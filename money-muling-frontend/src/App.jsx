import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/theme.css';

import LoginCard from './components/auth/LoginCard';
import Dashboard from './components/dashboard/Dashboard';
import ProfilePage from './components/profile/ProfilePage';
import RoleRoute from './components/auth/RoleRoute';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import AppLayout from './components/layout/AppLayout';
import LandingPage from './components/pages/LandingPage';
import WorkspaceSelector from './components/pages/WorkspaceSelector';
import SampleGenerator from './components/dashboard/SampleGenerator';
import LiveShieldPage from './components/liveshield/LiveShieldPage';
import NotFoundPage from './components/pages/NotFoundPage';

// Client
import ClientPortal from './components/pages/ClientPortal';
import ClientRequestForm from './components/pages/ClientRequestForm';
import ClientReportsPage from './components/pages/ClientReportsPage';

// Admin
import AdminDashboard from './components/pages/AdminDashboard';
import AdminUsersPage from './components/pages/AdminUsersPage';
import AdminOrgsPage from './components/pages/AdminOrgsPage';
import AdminRequestsPage from './components/pages/AdminRequestsPage';
import AdminReportsPage from './components/pages/AdminReportsPage';
import AdminOperationsPage from './components/pages/AdminOperationsPage';

// Audit
import AuditHistory from './components/audit/AuditHistory';

// TraceLab / InvoSpace
import OverviewPage from './components/pages/OverviewPage';
import GraphViewer from './components/pages/GraphViewer';
import CommunitiesPage from './components/pages/CommunitiesPage';
import RiskMapPage from './components/pages/RiskMapPage';
import TimelinePage from './components/pages/TimelinePage';
import StatisticsPage from './components/pages/StatisticsPage';
import ReportsPage from './components/pages/ReportsPage';
import CasesPage from './components/pages/CasesPage';
import CaseDetail from './components/pages/CaseDetail';
import CaseReportPDFPage from './components/pages/CaseReportPDFPage';
import AlertsPage from './components/pages/AlertsPage';
import AnalystPatternsPage from './components/pages/AnalystPatternsPage';
import InvestigatorIntelPage from './components/pages/InvestigatorIntelPage';

import SettingsPage from './components/settings/SettingsPage';

// Analyst-only inline guard (parent tracelab route also admits ADMIN)
function AnalystOnly({ children }) {
  const { role } = useAuth();
  if (role !== 'TRACE_LAB_ANALYST') {
    return <Navigate to="/tracelab/overview" replace />;
  }
  return children;
}


// ============================================================
// ROLE ROUTE MAP
// ============================================================

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
    TRACE_LAB_ANALYST: '/liveshield',
    INVESTIGATOR: '/liveshield',
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
    TRACE_LAB_ANALYST: '/invospace/cases',
    INVESTIGATOR: '/invospace/cases',
    ADMIN: '/invospace/cases',
  },

  alerts: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/alerts',
    INVESTIGATOR: '/invospace/alerts',
  },

  liveshield: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/liveshield',
    INVESTIGATOR: '/invospace/liveshield',
  },

  sampleGenerator: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/tracelab/sample-generator',
    INVESTIGATOR: '/invospace/sample-generator',
  },

  caseDetail: {
    CLIENT: '/client-dashboard',
    TRACE_LAB_ANALYST: '/invospace/cases',
    INVESTIGATOR: '/invospace/cases',
    ADMIN: '/invospace/cases',
  },
};


// ============================================================
// ADMIN WORKSPACE PATHS
// ============================================================

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
    cases: '/tracelab/cases',
    alerts: '/tracelab/alerts',
    caseDetail: '/tracelab/cases',
    liveshield: '/tracelab/liveshield',
    sampleGenerator: '/tracelab/sample-generator',
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
    liveshield: '/invospace/liveshield',
    sampleGenerator: '/invospace/sample-generator',
  },

  admin: {
    overview: '/admin',
    dashboard: '/admin',
    upload: '/admin/operations',
    graph: '/invospace/graph-viewer',
    riskMap: '/invospace/risk-map',
    communities: '/invospace/communities',
    timeline: '/invospace/timeline',
    statistics: '/invospace/statistics',
    reports: '/admin/reports',
    cases: '/invospace/cases',
    alerts: '/invospace/alerts',
    caseDetail: '/invospace/cases',
    liveshield: '/admin/liveshield',
    sampleGenerator: '/admin/sample-generator',
  },
};


// ============================================================
// WORKSPACE REDIRECT
// ============================================================

const WorkspaceRedirect = ({ page }) => {
  const { role, workspace } = useAuth();
  const params = useParams();

  // ADMIN routes
  if (role === 'ADMIN') {
    const ws = workspace && adminWorkspacePaths[workspace] ? workspace : 'invospace';
    const adminPath =
      adminWorkspacePaths[ws]?.[page] ||
      adminWorkspacePaths.invospace?.[page] ||
      adminWorkspacePaths.tracelab?.[page] ||
      '/admin';

    return (
      <Navigate
        to={
          page === 'caseDetail' && params.id
            ? `${adminPath}/${params.id}`
            : adminPath
        }
        replace
      />
    );
  }

  const roleMap = routeMap[page] ?? routeMap.overview;
  const path = roleMap?.[role] || '/login';

  return (
    <Navigate
      to={
        page === 'caseDetail' && params.id
          ? `${path}/${params.id}`
          : path
      }
      replace
    />
  );
};


// ============================================================
// APP
// ============================================================

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

      {/* ======================================================
          PUBLIC
      ====================================================== */}

      <Route path="/" element={<LandingPage />} />

      <Route path="/login" element={<LoginCard />} />


      {/* ======================================================
          PROTECTED ROUTES
      ====================================================== */}

      <Route element={<ProtectedRoute />}>

        {/* ====================================================
            SAMPLE GENERATOR
        ==================================================== */}

        <Route
          path="/sample-generator"
          element={
            <AppLayout title="Sample Generator">
              <SampleGenerator />
            </AppLayout>
          }
        />


        {/* ====================================================
            CLIENT PORTAL
        ==================================================== */}

        <Route
          element={
            <RoleRoute
              allowedRoles={['CLIENT', 'ADMIN', 'TRACE_LAB_ANALYST', 'INVESTIGATOR']}
              redirectPath="/overview"
            />
          }
        >
          <Route
            path="/client-dashboard"
            element={<ClientPortal />}
          />

          <Route
            path="/client-requests"
            element={<ClientPortal />}
          />

          <Route
            path="/client-requests/new"
            element={<ClientRequestForm />}
          />

          <Route
            path="/client-reports"
            element={<ClientReportsPage />}
          />

          <Route
            path="/reports/client"
            element={<Navigate to="/client-reports" replace />}
          />
        </Route>


        {/* ====================================================
            TRACELAB WORKSPACE
        ==================================================== */}

        <Route
          element={
            <RoleRoute
              allowedRoles={['TRACE_LAB_ANALYST', 'ADMIN']}
              redirectPath="/client-dashboard"
            />
          }
        >
          <Route
            path="/tracelab"
            element={
              <Navigate
                to="/tracelab/overview"
                replace
              />
            }
          />

          <Route
            path="/tracelab/overview"
            element={<OverviewPage />}
          />

          <Route
            path="/tracelab/dashboard"
            element={
              <AppLayout title="Analyze">
                <Dashboard />
              </AppLayout>
            }
          />

          <Route
            path="/tracelab/upload"
            element={<Navigate to="/liveshield" replace />}
          />

          <Route
            path="/tracelab/risk-map"
            element={<RiskMapPage />}
          />

          <Route
            path="/tracelab/graph-viewer"
            element={<GraphViewer />}
          />

          <Route
            path="/tracelab/communities"
            element={<CommunitiesPage />}
          />

          <Route
            path="/tracelab/timeline"
            element={<TimelinePage />}
          />

          <Route
            path="/tracelab/statistics"
            element={<StatisticsPage />}
          />

          <Route
            path="/tracelab/reports"
            element={<ReportsPage />}
          />

          <Route
            path="/tracelab/alerts"
            element={<AlertsPage />}
          />

          <Route
            path="/tracelab/cases"
            element={<CasesPage />}
          />

          <Route
            path="/tracelab/cases/:id"
            element={<CaseDetail />}
          />

          <Route
            path="/tracelab/cases/:id/pdf"
            element={<CaseReportPDFPage />}
          />

          <Route
            path="/tracelab/patterns"
            element={
              <AnalystOnly>
                <AnalystPatternsPage />
              </AnalystOnly>
            }
          />

          <Route
            path="/tracelab/sample-generator"
            element={
              <AppLayout title="Sample Generator">
                <SampleGenerator />
              </AppLayout>
            }
          />

          <Route
            path="/tracelab/liveshield"
            element={<LiveShieldPage />}
          />
        </Route>


        {/* ====================================================
            INVOSPACE WORKSPACE
        ==================================================== */}

        <Route
          element={
            <RoleRoute
              allowedRoles={['INVESTIGATOR', 'ADMIN']}
              redirectPath="/client-dashboard"
            />
          }
        >
          <Route
            path="/invospace"
            element={
              <Navigate
                to="/invospace/overview"
                replace
              />
            }
          />

          <Route
            path="/invospace/overview"
            element={<OverviewPage />}
          />

          <Route
            path="/invospace/dashboard"
            element={
              <AppLayout title="Analyze">
                <Dashboard />
              </AppLayout>
            }
          />

          <Route
            path="/invospace/upload"
            element={<Navigate to="/liveshield" replace />}
          />

          <Route
            path="/invospace/risk-map"
            element={<RiskMapPage />}
          />

          <Route
            path="/invospace/graph-viewer"
            element={<GraphViewer />}
          />

          <Route
            path="/invospace/communities"
            element={<CommunitiesPage />}
          />

          <Route
            path="/invospace/timeline"
            element={<TimelinePage />}
          />

          <Route
            path="/invospace/statistics"
            element={<StatisticsPage />}
          />

          <Route
            path="/invospace/reports"
            element={<ReportsPage />}
          />

          <Route
            path="/invospace/cases"
            element={<CasesPage />}
          />

          <Route
            path="/invospace/cases/:id"
            element={<CaseDetail />}
          />

          <Route
            path="/invospace/cases/:id/pdf"
            element={<CaseReportPDFPage />}
          />

          <Route
            path="/invospace/alerts"
            element={<AlertsPage />}
          />

          <Route
            path="/invospace/intel"
            element={<InvestigatorIntelPage />}
          />

          <Route
            path="/invospace/sample-generator"
            element={
              <AppLayout title="Sample Generator">
                <SampleGenerator />
              </AppLayout>
            }
          />

          <Route
            path="/invospace/liveshield"
            element={<LiveShieldPage />}
          />
        </Route>


        {/* ====================================================
            ADMIN WORKSPACE
        ==================================================== */}

        <Route
          element={
            <RoleRoute
              allowedRoles={['ADMIN']}
              redirectPath="/overview"
            />
          }
        >

          {/* Workspace selector */}
          <Route
            path="/workspace-selector"
            element={<WorkspaceSelector />}
          />

          {/* Admin dashboard */}
          <Route
            path="/admin"
            element={<AdminDashboard />}
          />

          {/* User management */}
          <Route
            path="/admin/users"
            element={<AdminUsersPage />}
          />

          {/* Organization management */}
          <Route
            path="/admin/organizations"
            element={<AdminOrgsPage />}
          />

          {/* Service request queue */}
          <Route
            path="/admin/requests"
            element={<AdminRequestsPage />}
          />

          {/* Report review queue */}
          <Route
            path="/admin/reports"
            element={<AdminReportsPage />}
          />

          {/* Operations queue */}
          <Route
            path="/admin/operations"
            element={<AdminOperationsPage />}
          />

          <Route
            path="/admin/cases"
            element={<CasesPage />}
          />

          <Route
            path="/admin/cases/:id"
            element={<CaseDetail />}
          />

          <Route
            path="/admin/sample-generator"
            element={
              <AppLayout title="Sample Generator">
                <SampleGenerator />
              </AppLayout>
            }
          />

          <Route
            path="/admin/liveshield"
            element={<LiveShieldPage />}
          />

        </Route>


        {/* ====================================================
            COMMON AUTHENTICATED ROUTES
        ==================================================== */}

        <Route
          path="/profile"
          element={
            <AppLayout title="Profile">
              <ProfilePage />
            </AppLayout>
          }
        />

        <Route
          path="/settings"
          element={<SettingsPage />}
        />

        <Route
          path="/audit-history"
          element={
            <AppLayout title="Audit Logs">
              <AuditHistory />
            </AppLayout>
          }
        />

        {/* ====================================================
            ROLE-AWARE SHORTCUT ROUTES
        ==================================================== */}

        <Route
          path="/overview"
          element={<WorkspaceRedirect page="overview" />}
        />

        <Route
          path="/dashboard"
          element={<WorkspaceRedirect page="dashboard" />}
        />

        <Route
          path="/upload"
          element={<WorkspaceRedirect page="upload" />}
        />

        <Route
          path="/sample-generator"
          element={<WorkspaceRedirect page="sampleGenerator" />}
        />

        <Route
          path="/liveshield"
          element={<WorkspaceRedirect page="liveshield" />}
        />

        <Route
          path="/graph-viewer"
          element={<WorkspaceRedirect page="graph" />}
        />

        <Route
          path="/risk-map"
          element={<WorkspaceRedirect page="riskMap" />}
        />

        <Route
          path="/communities"
          element={<WorkspaceRedirect page="communities" />}
        />

        <Route
          path="/timeline"
          element={<WorkspaceRedirect page="timeline" />}
        />

        <Route
          path="/statistics"
          element={<WorkspaceRedirect page="statistics" />}
        />

        <Route
          path="/reports"
          element={<WorkspaceRedirect page="reports" />}
        />

        <Route
          path="/cases"
          element={<WorkspaceRedirect page="cases" />}
        />

        <Route
          path="/cases/:id"
          element={<WorkspaceRedirect page="caseDetail" />}
        />

        <Route
          path="/cases/:id/pdf"
          element={<CaseReportPDFPage />}
        />

        <Route
          path="/alerts"
          element={<WorkspaceRedirect page="alerts" />}
        />

      </Route>


      {/* ======================================================
          FALLBACK / 404
      ====================================================== */}

      <Route
        path="*"
        element={<NotFoundPage />}
      />

    </Routes>
  );
}

export default App;