import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from 'react-bootstrap';
import { Shield, FlaskConical, Search, ArrowRight } from 'lucide-react';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../../context/AuthContext';

const WORKSPACES = [
  {
    id: 'admin',
    label: 'Admin Workspace',
    badge: 'Governance',
    badgeVariant: 'secondary',
    icon: Shield,
    iconColor: '#58a6ff',
    description: 'Central hub for user credential management, organization directory, inbound service triage, and cryptographic report releases.',
    path: '/admin',
  },
  {
    id: 'tracelab',
    label: 'TraceLab Workspace',
    badge: 'Analytics Engine',
    badgeVariant: 'info',
    icon: FlaskConical,
    iconColor: '#3fb950',
    description: 'Run advanced DC-LCG neural graph analysis, multi-hop money muling detection, community clustering, and transaction simulations.',
    path: '/tracelab/overview',
  },
  {
    id: 'invospace',
    label: 'InvoSpace Workspace',
    badge: 'Investigation Hub',
    badgeVariant: 'warning',
    icon: Search,
    iconColor: '#d29922',
    description: 'Investigate flagged accounts, manage high-priority fraud cases, cross-reference intel feeds, and compile verified audit dossiers.',
    path: '/invospace/overview',
  },
];

export default function WorkspaceSelector() {
  const { setWorkspace, workspace: currentWorkspace } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (ws) => {
    setWorkspace(ws.id);
    navigate(ws.path, { replace: true });
  };

  return (
    <AppLayout
      title="Workspace Selector"
     
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px 0' }}>
        <div className="mb-4">
          <h4 className="text-white mb-2">Select Active Environment</h4>
          <p className="text-secondary mb-0">
            As an Administrator, you have full access across all platform divisions. Choose a workspace below to enter its specialized toolset. You can switch between workspaces at any time.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          {WORKSPACES.map((ws) => {
            const IconComponent = ws.icon;
            const isCurrent = currentWorkspace === ws.id;

            return (
              <div
                key={ws.id}
                style={{
                  backgroundColor: '#0d1117',
                  border: isCurrent ? '1px solid #58a6ff' : '1px solid #30363d',
                  borderRadius: 12,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
              >
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid #30363d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: ws.iconColor,
                      }}
                    >
                      <IconComponent size={22} />
                    </div>
                    <Badge bg={ws.badgeVariant} text={ws.badgeVariant === 'warning' ? 'dark' : 'light'}>
                      {ws.badge}
                    </Badge>
                  </div>

                  <h5 className="text-white mb-2 fw-semibold">{ws.label}</h5>
                  <p className="text-secondary small mb-4" style={{ lineHeight: 1.6 }}>
                    {ws.description}
                  </p>
                </div>

                <Button
                  variant={isCurrent ? 'primary' : 'outline-light'}
                  size="sm"
                  onClick={() => handleSelect(ws)}
                  className="d-flex align-items-center justify-content-center gap-2 py-2"
                >
                  <span>Enter {ws.label.replace(' Workspace', '')}</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
