import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/theme.css';
import LoginCard from './components/auth/LoginCard';
import Dashboard from './components/dashboard/Dashboard';
import ProfilePage from './components/profile/ProfilePage';
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
      
      {/* Existing routes wrapped in layout */}
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout title="Analyze"><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppLayout title="Profile"><ProfilePage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/audit-history" element={<ProtectedRoute><AppLayout title="Audit Logs"><AuditHistory /></AppLayout></ProtectedRoute>} />
      
      <Route path="/upload" element={<Navigate to="/dashboard" replace />} />

      {/* New Pages with Layout */}
      <Route path="/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
      <Route path="/graph-viewer" element={<ProtectedRoute><GraphViewer /></ProtectedRoute>} />
      <Route path="/communities" element={<ProtectedRoute><CommunitiesPage /></ProtectedRoute>} />
      <Route path="/risk-map" element={<ProtectedRoute><RiskMapPage /></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute><TimelinePage /></ProtectedRoute>} />
      <Route path="/statistics" element={<ProtectedRoute><StatisticsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute><CasesPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
