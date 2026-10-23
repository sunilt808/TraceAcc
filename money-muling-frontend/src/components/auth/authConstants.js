import { Settings, Microscope, Shield, Building2 } from 'lucide-react';

export const ROLES = [
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'System Administration',
    icon: Settings,
    color: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.25)',
  },
  {
    value: 'TRACE_LAB_ANALYST',
    label: 'Analyst',
    description: 'TraceLab Analysis',
    icon: Microscope,
    color: '#8B5CF6',
    glow: 'rgba(139, 92, 246, 0.25)',
  },
  {
    value: 'INVESTIGATOR',
    label: 'InvoSpace',
    description: 'Case Investigation',
    icon: Shield,
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  {
    value: 'CLIENT',
    label: 'Client',
    description: 'Client Portal',
    icon: Building2,
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
];

export const getRedirectPath = (userRole) => {
  switch (userRole) {
    case 'CLIENT':
    case 'CLIENT_USER':
      return '/client-dashboard';
    case 'ADMIN':
      return '/workspace-selector';
    case 'TRACE_LAB_ANALYST':
      return '/tracelab/overview';
    case 'INVESTIGATOR':
      return '/invospace/overview';
    default:
      return '/login';
  }
};
