import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../../context/AuthContext';

const WORKSPACES = [
  { id: 'admin', label: 'Admin Workspace', description: 'Manage users, audit logs, and platform configuration.', path: '/admin' },
  { id: 'tracelab', label: 'TraceLab Workspace', description: 'Run advanced analysis, graph investigation, and alert triage.', path: '/tracelab/overview' },
  { id: 'invospace', label: 'InvoSpace Workspace', description: 'Perform investigation, case management, and transaction review.', path: '/invospace/overview' },
];

export default function WorkspaceSelector() {
  const { setWorkspace } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (workspace) => {
    setWorkspace(workspace.id);
    navigate(workspace.path, { replace: true });
  };

  return (
    <AppLayout title="Workspace Selector" subtitle="Choose where to start your session">
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 24, color: '#c9d1d9' }}>
          As an administrator, choose the workspace context you want to explore. You can switch again anytime from the selector.
        </div>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {WORKSPACES.map((workspace) => (
            <div
              key={workspace.id}
              style={{
                background: '#0d1117', border: '1px solid #30363d', borderRadius: 16,
                padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: '#f0f6fc' }}>{workspace.label}</h2>
                <p style={{ marginTop: 10, color: '#8b949e', lineHeight: 1.6 }}>{workspace.description}</p>
              </div>
              <Button variant="outline-light" onClick={() => handleSelect(workspace)}>
                Enter {workspace.label.replace(' Workspace', '')}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
