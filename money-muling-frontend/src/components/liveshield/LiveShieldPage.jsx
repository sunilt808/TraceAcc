import React, { useState } from 'react';
import { Container, Nav } from 'react-bootstrap';
import {
  Activity,
  Radio,
  PlusCircle,
  History,
  Sliders,
} from 'lucide-react';
import AppLayout from '../layout/AppLayout';
import LiveShieldOverview from './LiveShieldOverview';
import NewSimulationView from './NewSimulationView';
import LiveMonitorView from './LiveMonitorView';
import SimulationHistoryView from './SimulationHistoryView';
import SimulationDetailView from './SimulationDetailView';
import PresetManagerView from './PresetManagerView';

import { useNavigate } from 'react-router-dom';

export default function LiveShieldPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'new' | 'monitor' | 'history' | 'presets' | 'detail'
  const [activeSimulationId, setActiveSimulationId] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const handleNavigate = (tab, extra = {}) => {
    if (tab === 'cases') {
      if (typeof extra === 'number' || typeof extra === 'string') {
        navigate(`/invospace/cases/${extra}`);
      } else {
        navigate('/invospace/cases');
      }
      return;
    }
    if (extra.preset) {
      setSelectedPreset(extra.preset);
    } else {
      setSelectedPreset(null);
    }
    setActiveTab(tab);
  };

  const handleSimulationCreated = (simulationId) => {
    setActiveSimulationId(simulationId);
    setActiveTab('monitor');
  };

  const handleSelectSimulation = (simulationId) => {
    setActiveSimulationId(simulationId);
  };

  return (
    <AppLayout title="LiveShield Simulator">
      <div className="liveshield-container py-2">
        {/* Navigation Tabs Bar */}
        <div className="border-bottom border-secondary border-opacity-25 mb-4">
          <Nav variant="pills" className="custom-dark-nav gap-2 pb-2">
            <Nav.Item>
              <Nav.Link
                active={activeTab === 'overview'}
                onClick={() => handleNavigate('overview')}
                className="d-flex align-items-center gap-2 cursor-pointer"
              >
                <Activity size={16} />
                Overview
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'new'}
                onClick={() => handleNavigate('new')}
                className="d-flex align-items-center gap-2 cursor-pointer"
              >
                <PlusCircle size={16} />
                New Simulation
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'monitor'}
                onClick={() => handleNavigate('monitor')}
                className="d-flex align-items-center gap-2 cursor-pointer"
              >
                <Radio size={16} className={activeSimulationId ? 'text-primary' : ''} />
                Live Monitor
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'history' || activeTab === 'detail'}
                onClick={() => handleNavigate('history')}
                className="d-flex align-items-center gap-2 cursor-pointer"
              >
                <History size={16} />
                History & Logs
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'presets'}
                onClick={() => handleNavigate('presets')}
                className="d-flex align-items-center gap-2 cursor-pointer"
              >
                <Sliders size={16} />
                Templates & Presets
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'overview' && (
          <LiveShieldOverview
            onNavigate={handleNavigate}
            onSelectSimulation={handleSelectSimulation}
          />
        )}

        {activeTab === 'new' && (
          <NewSimulationView
            onSimulationCreated={handleSimulationCreated}
            initialPreset={selectedPreset}
          />
        )}

        {activeTab === 'monitor' && (
          <LiveMonitorView
            simulationId={activeSimulationId}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'history' && (
          <SimulationHistoryView
            onSelectSimulation={handleSelectSimulation}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'detail' && (
          <SimulationDetailView
            simulationId={activeSimulationId}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'presets' && (
          <PresetManagerView
            onNavigate={handleNavigate}
          />
        )}
      </div>
    </AppLayout>
  );
}
