import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Badge,
  Spinner,
  Alert,
  Collapse,
} from 'react-bootstrap';
import {
  Play,
  Zap,
  UploadCloud,
  FolderOpen,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Shield,
  Eye,
  UserCheck,
  RotateCw,
  Layers,
  Binary,
  ShieldAlert,
  Users,
  Activity,
  Flame,
  SlidersHorizontal,
  Check,
  Sliders,
  FileSpreadsheet,
  Clock,
} from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';
import { adminAPI } from '../../services/api';
import { PATTERNS_REGISTRY, PRESETS_CONFIG } from '../../services/generator/patterns';

export default function NewSimulationView({ onSimulationCreated, initialPreset }) {
  // Main Mode: 'generator' (Presets + Custom Stream) | 'upload' (External CSV)
  const [activeMainTab, setActiveMainTab] = useState('generator');

  // Generator Submode: 'preset' (1-Click Benchmarks) | 'custom' (Full Parametric Freedom)
  const [generatorSubMode, setGeneratorSubMode] = useState('preset');

  // Unified Config State
  const [simulationName, setSimulationName] = useState(
    `LiveShield-Sim-${Math.floor(Math.random() * 9000 + 1000)}`
  );
  const [selectedPresetId, setSelectedPresetId] = useState(PRESETS_CONFIG[0]?.id || 'all_19_syndicate_benchmark');
  const [selectedPatternIds, setSelectedPatternIds] = useState(
    PATTERNS_REGISTRY.map((p) => p.id)
  );
  const [numAccounts, setNumAccounts] = useState(85);
  const [totalTransactions, setTotalTransactions] = useState(1200);
  const [targetTps, setTargetTps] = useState(250);
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [fraudPercentage, setFraudPercentage] = useState(20);

  // Target Organization & Case Creation Policy (RBAC Lifecycle)
  const [targetOrgId, setTargetOrgId] = useState('');
  const [caseCreationPolicy, setCaseCreationPolicy] = useState('NONE');
  const [organizations, setOrganizations] = useState([]);

  // Detection Policy & Risk Thresholds
  const [detectionMode, setDetectionMode] = useState('automated'); // 'automated' | 'assisted' | 'shadow'
  const [showThresholds, setShowThresholds] = useState(false);
  const [detectionConfig, setDetectionConfig] = useState({
    flag_threshold: 0.40,
    hold_threshold: 0.65,
    reject_threshold: 0.85,
    graph_window_size: 1500,
    enable_ctr_rule: true,
    enable_velocity_rule: true,
    enable_passthrough_rule: true,
    enable_dormant_rule: true,
  });

  // External File Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadHeaders, setUploadHeaders] = useState([]);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadRowCount, setUploadRowCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    adminAPI.listOrganizations()
      .then((data) => {
        const orgs = Array.isArray(data) ? data : data.items || [];
        setOrganizations(orgs);
        if (orgs.length > 0 && !targetOrgId) {
          setTargetOrgId(String(orgs[0].id));
        }
      })
      .catch((err) => console.error('Failed to load organizations for simulation:', err));
  }, []);

  // When a preset is selected, sync parameters automatically
  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setSelectedPatternIds(preset.patternIds || PATTERNS_REGISTRY.map((p) => p.id));
    if (preset.defaultParams) {
      setNumAccounts(preset.defaultParams.numAccounts || 85);
      setTotalTransactions(preset.defaultParams.numTransactions || 1200);
      setFraudPercentage(preset.defaultParams.fraudPercentage || 20);
      setTargetTps(preset.defaultParams.targetTps || 250);
    }
  };

  // Toggle individual pattern in custom mode
  const handleTogglePattern = (patternId) => {
    setSelectedPatternIds((prev) =>
      prev.includes(patternId)
        ? prev.filter((id) => id !== patternId)
        : [...prev, patternId]
    );
  };

  const handleSelectAllPatterns = () => {
    setSelectedPatternIds(PATTERNS_REGISTRY.map((p) => p.id));
  };

  const handleClearAllPatterns = () => {
    setSelectedPatternIds([]);
  };

  // Handle custom CSV parse
  const handleProcessFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setSubmitError('Please select a valid .csv transaction file.');
      return;
    }
    setUploadFile(file);
    setSubmitError(null);
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter((l) => l.trim() !== '');
        setUploadRowCount(Math.max(0, lines.length - 1));
        if (lines.length > 0) {
          const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
          setUploadHeaders(headers);
          const sampleRows = lines.slice(1, 6).map((line) => {
            const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
            return headers.reduce((obj, h, idx) => {
              obj[h] = values[idx] || '';
              return obj;
            }, {});
          });
          setUploadPreview(sampleRows);
        }
      } catch (err) {
        console.error('Failed to parse CSV preview:', err);
      }
    };
    reader.readAsText(file);
  };

  // Unified Launch Method (Runs through same simulation service)
  const handleLaunch = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      if (activeMainTab === 'upload') {
        if (!uploadFile) {
          setSubmitError('Please select or upload a transaction CSV file first.');
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('name', uploadName || 'Uploaded Dataset Simulation');
        formData.append('target_tps', targetTps);
        formData.append('detection_mode', detectionMode);
        formData.append('detection_config', JSON.stringify(detectionConfig));
        if (targetOrgId) {
          formData.append('target_organization_id', targetOrgId);
        }

        const created = await liveshieldApi.createUploadSimulation(formData);
        if (onSimulationCreated) {
          onSimulationCreated(created.id);
        }
      } else {
        // Generator Stream (Presets & Custom Parametric)
        const payload = {
          name: simulationName || `LiveShield-${generatorSubMode === 'preset' ? 'Preset' : 'Custom'}-Sim`,
          mode: generatorSubMode === 'preset' ? 'basic' : 'advanced',
          detection_mode: detectionMode,
          target_organization_id: targetOrgId ? Number(targetOrgId) : null,
          case_creation_policy: caseCreationPolicy,
          config: {
            preset_id: selectedPresetId,
            selected_scenarios: selectedPatternIds,
            num_accounts: numAccounts,
            total_transactions: totalTransactions,
            target_tps: targetTps,
            duration_seconds: durationSeconds,
            fraudulent_percentage: fraudPercentage,
            traffic_composition: 'mixed',
          },
          detection_config: detectionConfig,
        };

        const created = await liveshieldApi.createSimulation(payload);
        await liveshieldApi.startSimulation(created.id);

        if (onSimulationCreated) {
          onSimulationCreated(created.id);
        }
      }
    } catch (err) {
      console.error('Failed to start simulation:', err);
      setSubmitError(
        err.response?.data?.detail || err.message || 'Failed to start simulation.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetStyleMap = {
    all_19_syndicate_benchmark: {
      icon: ShieldAlert,
      tagBg: 'rgba(255, 255, 255, 0.08)',
      tagBorder: 'rgba(255, 255, 255, 0.18)',
      tagColor: '#f4f4f5',
    },
    smurfing_layering_hubs: {
      icon: Layers,
      tagBg: 'rgba(245, 158, 11, 0.12)',
      tagBorder: 'rgba(245, 158, 11, 0.3)',
      tagColor: '#fbbf24',
    },
    graph_ai_topology_suite: {
      icon: Binary,
      tagBg: 'rgba(168, 85, 247, 0.12)',
      tagBorder: 'rgba(168, 85, 247, 0.3)',
      tagColor: '#c084fc',
    },
    high_volume_enterprise: {
      icon: RotateCw,
      tagBg: 'rgba(16, 185, 129, 0.12)',
      tagBorder: 'rgba(16, 185, 129, 0.3)',
      tagColor: '#34d399',
    },
  };

  return (
    <div className="new-simulation-view py-3" style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <style>{`
        .ls-black-card {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 12px;
          box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }
        .ls-preset-card {
          background: #121215;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 16px 18px;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          position: relative;
        }
        .ls-preset-card:hover {
          border-color: #3f3f46;
          background: #18181b;
          transform: translateY(-1px);
        }
        .ls-preset-card.selected {
          border-color: #ffffff;
          background: #18181b;
          box-shadow: 0 0 0 1px #ffffff, 0 8px 24px -4px rgba(0, 0, 0, 0.6);
        }
        .ls-tab-btn {
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s ease;
          border: none;
          color: #a1a1aa;
          background: transparent;
        }
        .ls-tab-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }
        .ls-tab-btn.active {
          background: #ffffff;
          color: #000000;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(255, 255, 255, 0.15);
        }
        .ls-sub-tab-btn {
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.15s ease;
          border: 1px solid #27272a;
          color: #a1a1aa;
          background: #121215;
        }
        .ls-sub-tab-btn:hover {
          color: #ffffff;
          border-color: #3f3f46;
        }
        .ls-sub-tab-btn.active {
          background: #27272a;
          border-color: #52525b;
          color: #ffffff;
          font-weight: 600;
        }
        .ls-metric-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 5px;
          padding: 3px 8px;
          font-size: 11.5px;
          color: #d4d4d8;
          font-weight: 500;
        }
        .ls-slider-box {
          background: #121215;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 12px 14px;
        }
        .ls-slider-box input[type="range"] {
          accent-color: #ffffff;
          cursor: pointer;
        }
        .ls-pattern-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.12s ease;
          border: 1px solid #27272a;
          background: #121215;
          color: #a1a1aa;
          user-select: none;
        }
        .ls-pattern-chip:hover {
          border-color: #3f3f46;
          color: #ffffff;
        }
        .ls-pattern-chip.selected {
          border-color: #ffffff;
          background: #18181b;
          color: #ffffff;
          font-weight: 500;
        }
        .ls-policy-chip {
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid #27272a;
          background: #121215;
          color: #a1a1aa;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ls-policy-chip:hover {
          border-color: #3f3f46;
          color: #ffffff;
        }
        .ls-policy-chip.active-automated {
          background: #18181b;
          border-color: #ef4444;
          color: #fca5a5;
        }
        .ls-policy-chip.active-assisted {
          background: #18181b;
          border-color: #f59e0b;
          color: #fcd34d;
        }
        .ls-policy-chip.active-shadow {
          background: #18181b;
          border-color: #10b981;
          color: #6ee7b7;
        }
      `}</style>

      {/* Main Single Card Container */}
      <Card className="ls-black-card">
        {/* Top Header & Unified Navigation */}
        <div className="p-4" style={{ borderBottom: '1px solid #27272a', background: '#000000' }}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <div className="p-1.5 rounded-2 d-flex align-items-center justify-content-center" style={{ background: '#18181b', border: '1px solid #3f3f46' }}>
                  <Zap className="text-white" size={16} />
                </div>
                <h5 className="text-white fw-bold mb-0" style={{ letterSpacing: '-0.01em', fontSize: '16px' }}>
                  LiveShield Simulation & Investigation Studio
                </h5>
              </div>
              <p className="small mb-0" style={{ color: '#71717a' }}>
                Generate multi-pattern financial crime streams, evaluate DC-LCG graph inferences, and auto-link investigation cases.
              </p>
            </div>

            {/* Main Tabs */}
            <div className="d-inline-flex p-1 rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
              <button
                type="button"
                onClick={() => setActiveMainTab('generator')}
                className={`ls-tab-btn d-flex align-items-center gap-2 ${activeMainTab === 'generator' ? 'active' : ''}`}
              >
                <Sparkles size={14} />
                Synthetic Simulation
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('upload')}
                className={`ls-tab-btn d-flex align-items-center gap-2 ${activeMainTab === 'upload' ? 'active' : ''}`}
              >
                <UploadCloud size={14} />
                Upload Dataset (CSV)
              </button>
            </div>
          </div>

          {submitError && (
            <Alert variant="danger" className="mt-3 border-0 py-2 px-3 mb-0 small d-flex align-items-center gap-2 rounded-2" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertTriangle size={16} />
              <div>{submitError}</div>
            </Alert>
          )}
        </div>

        {/* Card Body */}
        <Card.Body className="p-4" style={{ background: '#09090b' }}>
          {/* Target Client Organization & Case Policy Header Bar */}
          <div className="p-3 mb-4 rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-3" style={{ background: '#121215', border: '1px solid #27272a' }}>
            <div className="d-flex align-items-center gap-3 flex-wrap flex-grow-1">
              <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
                <Form.Label className="small text-muted mb-1 fw-semibold d-flex align-items-center gap-1">
                  <Users size={13} className="text-primary" /> Target Client Organization:
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  style={{ background: '#18181b', borderColor: '#3f3f46', color: '#fff', fontSize: '12.5px' }}
                >
                  <option value="">-- Current Workspace Default --</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} (Org #{org.id})
                    </option>
                  ))}
                </Form.Select>
              </div>

              <div style={{ minWidth: '240px', flex: '1 1 240px' }}>
                <Form.Label className="small text-muted mb-1 fw-semibold d-flex align-items-center gap-1">
                  <Layers size={13} className="text-warning" /> Case Creation Policy:
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={caseCreationPolicy}
                  onChange={(e) => setCaseCreationPolicy(e.target.value)}
                  style={{ background: '#18181b', borderColor: '#3f3f46', color: '#fff', fontSize: '12.5px' }}
                >
                  <option value="NONE">NONE — Pure Live Simulation (No Case)</option>
                  <option value="ON_CRITICAL_ALERT">ON_CRITICAL_ALERT — Auto-Escalate on Critical Risk</option>
                  <option value="ON_SIMULATION_START">ON_SIMULATION_START — Auto-Create Case on Start</option>
                  <option value="MANUAL">MANUAL — Manual Conversion via Button</option>
                </Form.Select>
              </div>
            </div>

            <div className="text-muted small ps-2" style={{ fontSize: '11px', maxWidth: '320px', borderLeft: '1px solid #27272a' }}>
              Simulations run synthetic traffic for the selected client. The case creation policy determines when and how cases are logged.
            </div>
          </div>

          {activeMainTab === 'generator' && (
            <div>
              {/* Submode Switcher: 1-Click Presets vs Custom Studio */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-2" style={{ borderBottom: '1px solid #1c1c20' }}>
                <div className="d-flex align-items-center gap-2">
                  <span className="small fw-semibold" style={{ color: '#d4d4d8' }}>Configuration Mode:</span>
                  <button
                    type="button"
                    onClick={() => setGeneratorSubMode('preset')}
                    className={`ls-sub-tab-btn d-flex align-items-center gap-1.5 ${generatorSubMode === 'preset' ? 'active' : ''}`}
                  >
                    <FolderOpen size={13} />
                    1-Click Benchmark Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratorSubMode('custom')}
                    className={`ls-sub-tab-btn d-flex align-items-center gap-1.5 ${generatorSubMode === 'custom' ? 'active' : ''}`}
                  >
                    <Sliders size={13} />
                    Custom Parametric Studio
                  </button>
                </div>

                <div className="text-muted small" style={{ fontSize: '11.5px' }}>
                  {generatorSubMode === 'preset' ? 'Standardized multi-typology benchmarks' : 'Full freedom over patterns, accounts, and volume'}
                </div>
              </div>

              {/* SUBMODE 1: 1-CLICK BENCHMARK PRESETS */}
              {generatorSubMode === 'preset' && (
                <Row className="g-3 mb-3">
                  {PRESETS_CONFIG.map((preset) => {
                    const style = presetStyleMap[preset.id] || presetStyleMap.all_19_syndicate_benchmark;
                    const Icon = style.icon;
                    const isSelected = selectedPresetId === preset.id;

                    return (
                      <Col md={6} key={preset.id}>
                        <div
                          onClick={() => handleSelectPreset(preset)}
                          className={`ls-preset-card h-100 d-flex flex-column justify-content-between ${isSelected ? 'selected' : ''}`}
                        >
                          <div>
                            {/* Title & Tag Row */}
                            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                              <div className="d-flex align-items-center gap-2.5">
                                <div
                                  className="p-1.5 rounded-2 d-flex align-items-center justify-content-center"
                                  style={{
                                    background: isSelected ? '#ffffff' : '#18181b',
                                    border: `1px solid ${isSelected ? '#ffffff' : '#27272a'}`,
                                    color: isSelected ? '#000000' : '#ffffff',
                                  }}
                                >
                                  <Icon size={15} />
                                </div>
                                <div>
                                  <h6 className="fw-bold mb-0 text-white" style={{ fontSize: '13.5px', letterSpacing: '-0.01em' }}>
                                    {preset.title}
                                  </h6>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: '600',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: style.tagBg,
                                  border: `1px solid ${style.tagBorder}`,
                                  color: style.tagColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {preset.badge}
                              </span>
                            </div>

                            {/* Description */}
                            <p className="small mb-3" style={{ color: '#a1a1aa', fontSize: '12px', lineHeight: '1.5', minHeight: '38px' }}>
                              {preset.desc}
                            </p>
                          </div>

                          {/* Metric Strip */}
                          <div
                            className="d-flex flex-wrap align-items-center gap-2 pt-2.5"
                            style={{ borderTop: '1px solid #27272a' }}
                          >
                            <span className="ls-metric-pill">
                              <Users size={12} style={{ color: '#a1a1aa' }} />
                              <strong>{preset.defaultParams?.numAccounts}</strong> Accounts
                            </span>
                            <span className="ls-metric-pill">
                              <Activity size={12} style={{ color: '#a1a1aa' }} />
                              <strong>{preset.defaultParams?.numTransactions?.toLocaleString()}</strong> Txns
                            </span>
                            <span className="ls-metric-pill" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
                              <Flame size={12} style={{ color: '#ef4444' }} />
                              <strong>{preset.defaultParams?.fraudCount}</strong> ({preset.defaultParams?.fraudPercentage}% Fraud)
                            </span>
                          </div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              )}

              {/* SUBMODE 2: CUSTOM PARAMETRIC STUDIO */}
              {generatorSubMode === 'custom' && (
                <div>
                  {/* Pattern Selection Multi-Chips */}
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-semibold" style={{ color: '#d4d4d8' }}>
                        Selected Financial Crime Typologies ({selectedPatternIds.length} of {PATTERNS_REGISTRY.length} active):
                      </span>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllPatterns}
                          className="btn btn-link p-0 small text-decoration-none"
                          style={{ fontSize: '11.5px', color: '#a1a1aa' }}
                        >
                          Select All (19)
                        </button>
                        <span className="text-muted">&bull;</span>
                        <button
                          type="button"
                          onClick={handleClearAllPatterns}
                          className="btn btn-link p-0 small text-decoration-none"
                          style={{ fontSize: '11.5px', color: '#a1a1aa' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                      {PATTERNS_REGISTRY.map((pat) => {
                        const isChecked = selectedPatternIds.includes(pat.id);
                        return (
                          <div
                            key={pat.id}
                            onClick={() => handleTogglePattern(pat.id)}
                            className={`ls-pattern-chip ${isChecked ? 'selected' : ''}`}
                          >
                            <span style={{ fontSize: '11px', opacity: isChecked ? 1 : 0.6 }}>
                              {isChecked ? '✓' : '+'}
                            </span>
                            <span>{pat.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Parametric Freedom Controls */}
                  <Row className="g-3 mb-3">
                    <Col md={3}>
                      <div className="ls-slider-box">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Accounts</span>
                          <span className="badge px-2 py-1" style={{ background: '#27272a', color: '#ffffff' }}>{numAccounts}</span>
                        </div>
                        <Form.Range
                          min={20}
                          max={500}
                          step={10}
                          value={numAccounts}
                          onChange={(e) => setNumAccounts(parseInt(e.target.value))}
                        />
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="ls-slider-box">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Total Txns</span>
                          <span className="badge px-2 py-1" style={{ background: '#27272a', color: '#ffffff' }}>{totalTransactions}</span>
                        </div>
                        <Form.Range
                          min={200}
                          max={10000}
                          step={200}
                          value={totalTransactions}
                          onChange={(e) => setTotalTransactions(parseInt(e.target.value))}
                        />
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="ls-slider-box">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Target Rate</span>
                          <span className="badge px-2 py-1" style={{ background: '#27272a', color: '#ffffff' }}>{targetTps} TPS</span>
                        </div>
                        <Form.Range
                          min={150}
                          max={900}
                          step={25}
                          value={targetTps}
                          onChange={(e) => setTargetTps(parseFloat(e.target.value))}
                        />
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="ls-slider-box">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Fraud Ratio</span>
                          <span className="badge px-2 py-1" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>{fraudPercentage}%</span>
                        </div>
                        <Form.Range
                          min={1}
                          max={45}
                          step={1}
                          value={fraudPercentage}
                          onChange={(e) => setFraudPercentage(parseFloat(e.target.value))}
                        />
                      </div>
                    </Col>
                  </Row>
                </div>
              )}
            </div>
          )}

          {/* MAIN TAB 2: UPLOAD CUSTOM DATASET */}
          {activeMainTab === 'upload' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleProcessFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`p-4 text-center cursor-pointer transition-all rounded-3 mb-3`}
                style={{
                  background: isDragOver ? '#18181b' : uploadFile ? 'rgba(16, 185, 129, 0.08)' : '#121215',
                  borderStyle: 'dashed',
                  borderWidth: '1.5px',
                  borderColor: isDragOver ? '#ffffff' : uploadFile ? '#10b981' : '#27272a',
                }}
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  className="d-none"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleProcessFile(e.target.files[0]);
                    }
                  }}
                />
                <div className="d-flex flex-column align-items-center justify-content-center py-2">
                  {uploadFile ? (
                    <>
                      <CheckCircle2 size={36} className="text-success mb-2" />
                      <h6 className="text-white fw-bold mb-1">{uploadFile.name}</h6>
                      <div className="text-muted small">
                        {(uploadFile.size / 1024).toFixed(1)} KB &bull; ~{uploadRowCount.toLocaleString()} rows detected
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={36} className="text-white mb-2" />
                      <h6 className="text-white fw-bold mb-1">
                        Drag and drop your transaction CSV here, or <span className="text-white text-decoration-underline">browse files</span>
                      </h6>
                      <p className="small mb-0" style={{ color: '#71717a' }}>
                        Supports columns: <code>sender_id, receiver_id, amount, timestamp, channel, is_fraud, scenario_id</code>
                      </p>
                    </>
                  )}
                </div>
              </div>

              <Row className="g-3 mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold" style={{ color: '#a1a1aa' }}>Dataset Identifier</Form.Label>
                    <Form.Control
                      type="text"
                      size="sm"
                      style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="e.g. Core Banking Investigation #102"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold" style={{ color: '#a1a1aa' }}>Simulation Title</Form.Label>
                    <Form.Control
                      type="text"
                      size="sm"
                      style={{ background: '#121215', borderColor: '#27272a', color: '#fff' }}
                      value={simulationName}
                      onChange={(e) => setSimulationName(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {uploadPreview.length > 0 && (
                <div className="table-responsive rounded-2 mb-3" style={{ background: '#121215', border: '1px solid #27272a' }}>
                  <table className="table table-dark table-sm table-hover mb-0" style={{ fontSize: '11.5px', background: 'transparent' }}>
                    <thead>
                      <tr>
                        {uploadHeaders.slice(0, 7).map((h, i) => (
                          <th key={i} style={{ borderColor: '#27272a', background: '#18181b', color: '#a1a1aa' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.map((row, idx) => (
                        <tr key={idx}>
                          {uploadHeaders.slice(0, 7).map((h, i) => (
                            <td key={i} className="text-truncate" style={{ maxWidth: '140px', borderColor: '#27272a', color: '#d4d4d8' }}>
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 60-second runtime info — shown after a file is loaded */}
              {uploadFile && (() => {
                const required = Math.max(uploadRowCount, targetTps * 60);
                const willExpand = required > uploadRowCount && uploadRowCount > 0;
                return (
                  <div
                    className="d-flex flex-wrap align-items-center gap-3 px-3 py-2 rounded-2 mb-2"
                    style={{ background: '#121215', border: '1px solid #27272a' }}
                  >
                    <Clock size={14} style={{ color: '#a1a1aa', flexShrink: 0 }} />
                    <div className="d-flex flex-wrap gap-3" style={{ flex: 1 }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>Stream Duration</span>
                        <div className="fw-bold text-white" style={{ fontSize: '13px' }}>60 sec</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>Rate</span>
                        <div className="fw-bold text-white" style={{ fontSize: '13px' }}>{targetTps} TPS</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>Transactions to Stream</span>
                        <div className="fw-bold text-white" style={{ fontSize: '13px' }}>{(targetTps * 60).toLocaleString()}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>CSV Rows</span>
                        <div className="fw-bold" style={{ fontSize: '13px', color: uploadRowCount > 0 ? '#d4d4d8' : '#52525b' }}>
                          {uploadRowCount > 0 ? uploadRowCount.toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>
                    {willExpand && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap' }}>
                        ↻ Dataset will be cycled ×{Math.ceil((targetTps * 60) / uploadRowCount)}
                      </span>
                    )}
                    {!willExpand && uploadRowCount > 0 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                        ✓ Sufficient rows
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* STREAM THROUGHPUT & RATE CONTROL */}
          <div
            className="p-3 rounded-3 mt-3 mb-2"
            style={{
              background: '#121215',
              border: '1px solid #27272a',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2.5 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <Zap size={15} style={{ color: '#ffffff' }} />
                <span className="text-white fw-bold small" style={{ letterSpacing: '-0.01em' }}>
                  Simulation Stream Throughput
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#27272a',
                    color: '#ffffff',
                    border: '1px solid #3f3f46',
                  }}
                >
                  {targetTps} TPS
                </span>
              </div>
              <div className="text-muted small" style={{ fontSize: '11.5px' }}>
                High-throughput real-time stream rate (150 – 900 TPS)
              </div>
            </div>

            {/* Quick Rate Presets */}
            <div className="d-flex flex-wrap gap-2 mb-2.5">
              {[
                { label: '150 TPS', tps: 150 },
                { label: '300 TPS', tps: 300 },
                { label: '500 TPS', tps: 500 },
                { label: '750 TPS', tps: 750 },
                { label: '900 TPS', tps: 900 },
              ].map((speed) => {
                const isAct = targetTps === speed.tps;
                return (
                  <button
                    key={speed.tps}
                    type="button"
                    onClick={() => setTargetTps(speed.tps)}
                    style={{
                      background: isAct ? '#ffffff' : '#18181b',
                      color: isAct ? '#000000' : '#d4d4d8',
                      border: `1px solid ${isAct ? '#ffffff' : '#27272a'}`,
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: isAct ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {speed.label}
                  </button>
                );
              })}
            </div>

            {/* Granular Slider */}
            <div className="d-flex align-items-center gap-3">
              <span className="small text-muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                150 TPS
              </span>
              <Form.Range
                min={150}
                max={900}
                step={25}
                value={targetTps}
                onChange={(e) => setTargetTps(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="small text-muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                900 TPS
              </span>
            </div>
          </div>

          {/* Tunable Thresholds Collapsible Section */}
          <Collapse in={showThresholds}>
            <div className="pt-3 mt-3" style={{ borderTop: '1px solid #27272a' }}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="small fw-semibold d-flex align-items-center gap-1.5" style={{ color: '#d4d4d8' }}>
                  <SlidersHorizontal size={14} /> Risk Decision Thresholds Calibration
                </span>
                <span className="small" style={{ fontSize: '11px', color: '#71717a' }}>
                  Calibrated across screening rules, hybrid anomaly engine, and GNN inference
                </span>
              </div>
              <Row className="g-3">
                <Col md={4}>
                  <div className="ls-slider-box">
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Flag Alert Threshold</span>
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        {(detectionConfig.flag_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Form.Range
                      min={0.1}
                      max={0.6}
                      step={0.05}
                      value={detectionConfig.flag_threshold}
                      onChange={(e) => setDetectionConfig({ ...detectionConfig, flag_threshold: parseFloat(e.target.value) })}
                    />
                    <div className="small" style={{ fontSize: '11px', color: '#71717a' }}>
                      Generates low-priority alert for offline queue review.
                    </div>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="ls-slider-box">
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Hold Review Threshold</span>
                      <span className="badge" style={{ background: '#27272a', color: '#ffffff', border: '1px solid #3f3f46' }}>
                        {(detectionConfig.hold_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Form.Range
                      min={0.4}
                      max={0.85}
                      step={0.05}
                      value={detectionConfig.hold_threshold}
                      onChange={(e) => setDetectionConfig({ ...detectionConfig, hold_threshold: parseFloat(e.target.value) })}
                    />
                    <div className="small" style={{ fontSize: '11px', color: '#71717a' }}>
                      Holds transaction in real-time queue pending operator approval.
                    </div>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="ls-slider-box">
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <span className="small fw-semibold" style={{ color: '#a1a1aa' }}>Reject Auto-Block</span>
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        {(detectionConfig.reject_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Form.Range
                      min={0.7}
                      max={0.99}
                      step={0.01}
                      value={detectionConfig.reject_threshold}
                      onChange={(e) => setDetectionConfig({ ...detectionConfig, reject_threshold: parseFloat(e.target.value) })}
                    />
                    <div className="small" style={{ fontSize: '11px', color: '#71717a' }}>
                      Instantly blocks payment execution without human latency.
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Collapse>
        </Card.Body>

        {/* Card Footer — Policy Selector + Main Action */}
        <div
          className="p-3.5 d-flex flex-wrap align-items-center justify-content-between gap-3"
          style={{ background: '#000000', borderTop: '1px solid #27272a' }}
        >
          {/* Policy Selector */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="small fw-semibold me-1" style={{ color: '#71717a' }}>Policy:</span>
            <button
              type="button"
              onClick={() => setDetectionMode('automated')}
              className={`ls-policy-chip ${detectionMode === 'automated' ? 'active-automated' : ''}`}
            >
              <Zap size={13} />
              Automated
            </button>
            <button
              type="button"
              onClick={() => setDetectionMode('assisted')}
              className={`ls-policy-chip ${detectionMode === 'assisted' ? 'active-assisted' : ''}`}
            >
              <UserCheck size={13} />
              Assisted
            </button>
            <button
              type="button"
              onClick={() => setDetectionMode('shadow')}
              className={`ls-policy-chip ${detectionMode === 'shadow' ? 'active-shadow' : ''}`}
            >
              <Eye size={13} />
              Shadow
            </button>

            <button
              type="button"
              onClick={() => setShowThresholds(!showThresholds)}
              className="btn btn-link p-0 ms-2 text-decoration-none small d-flex align-items-center gap-1"
              style={{ fontSize: '12px', color: '#71717a' }}
            >
              <Settings size={13} />
              {showThresholds ? 'Hide Thresholds' : 'Tune Thresholds'}
            </button>
          </div>

          {/* Action Trigger — Sleek Solid White Button on Black Theme */}
          <div>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={isSubmitting || (activeMainTab === 'upload' && !uploadFile)}
              className="btn px-4 py-2 fw-bold d-flex align-items-center gap-2 rounded-2"
              style={{
                background: '#ffffff',
                color: '#000000',
                border: '1px solid #ffffff',
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
                fontWeight: '600',
                fontSize: '13.5px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" animation="border" /> Starting Stream...
                </>
              ) : (
                <>
                  <Play size={14} fill="#000000" /> Start Live Simulation & Case
                </>
              )}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
