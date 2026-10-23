import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Badge,
  Spinner,
  Alert,
  Nav,
  Form,
} from 'react-bootstrap';
import cytoscape from 'cytoscape';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Activity,
  Radio,
  Clock,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Database,
  Layers,
  Eye,
  ShieldCheck,
  UserCheck,
  Zap,
  Network,
  Map,
  Users,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Sparkles,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import liveshieldApi from '../../services/liveshieldApi';
import HeldTransactionsQueue from './HeldTransactionsQueue';
import EvaluationView from './EvaluationView';
import TransactionInspectorModal from './TransactionInspectorModal';
import axios from 'axios';

const PIE_COLORS = ['#3fb950', '#f85149'];

// Maps backend scenario IDs (F01–F19) to human-readable names
const SCENARIO_ID_NAMES = {
  F01: 'Structuring / Smurfing',
  F02: 'Rapid Pass-Through',
  F03: 'Fan-In Aggregation',
  F04: 'Fan-Out Dispersion',
  F05: 'Money-Mule Chain',
  F06: 'Circular Transfers (Cycle)',
  F07: 'Layered Shell Chains',
  F08: 'High-Freq Burst Activity',
  F09: 'Unusual Amount Spikes',
  F10: 'Account Takeover (ATO)',
  F11: 'New High-Risk Beneficiary',
  F12: 'Night-Time Anomaly',
  F13: 'Bipartite Bridge Cluster',
  F14: 'Dormant Account Activation',
  F15: 'Periodic / Bot Transfers',
  F16: 'Round-Amount Laundering',
  F17: 'Community Core Mule Ring',
  F18: 'Temporal Cascade Storm',
  F19: 'Risk Diffusion Hotspot',
};

/** Returns a short human-readable label for a scenario ID. Falls back to the raw ID. */
const scenarioLabel = (id) => SCENARIO_ID_NAMES[id] || id || '—';


export default function LiveMonitorView({ simulationId, onNavigate }) {
  const [simulation, setSimulation] = useState(null);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [heldTransactions, setHeldTransactions] = useState([]);
  const [tpsHistory, setTpsHistory] = useState([]);
  const [scenarioBreakdown, setScenarioBreakdown] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('stream'); // 'stream' | 'graph' | 'riskmap' | 'timeline' | 'rings' | 'held' | 'reevaluation' | 'eval'
  const [inspectingTxn, setInspectingTxn] = useState(null);

  // Analysis & Deep Feature state
  const [analysisData, setAnalysisData] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [graphFilter, setGraphFilter] = useState('all'); // 'all' | 'suspicious' | 'rings'
  const [graphSearch, setGraphSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [riskSearch, setRiskSearch] = useState('');
  const [selectedRing, setSelectedRing] = useState(null);

  const cyContainerRef = useRef(null);
  const cyInstanceRef = useRef(null);
  const tpsHistoryRef = useRef([]);

  const fetchHeld = async () => {
    if (!simulationId) return;
    try {
      const data = await liveshieldApi.getHeld(simulationId);
      setHeldTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      setHeldTransactions([]);
    }
  };

  // Fetch initial state & setup WS
  useEffect(() => {
    if (!simulationId) return;

    let cleanupWs = null;
    let pollInterval = null;

    const stopPollingAndWs = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (cleanupWs) {
        cleanupWs();
        cleanupWs = null;
      }
      setIsConnected(false);
    };

    const loadInitial = async () => {
      try {
        const [sim, initialStats, initialTxns] = await Promise.all([
          liveshieldApi.getSimulation(simulationId),
          liveshieldApi.getStats(simulationId),
          liveshieldApi.getTransactions(simulationId, { limit: 30 }),
        ]);
        setSimulation(sim);
        setStats(initialStats);
        setTransactions(Array.isArray(initialTxns) ? initialTxns : []);

        const initialPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          tps: initialStats.actual_tps || 0,
          target: initialStats.configured_tps || 50,
        };
        tpsHistoryRef.current = [initialPoint];
        setTpsHistory([initialPoint]);

        if (initialStats.scenario_counts) {
          const breakdown = Object.entries(initialStats.scenario_counts).map(([k, v]) => ({
            name: scenarioLabel(k),
            id: k,
            count: v,
          }));
          setScenarioBreakdown(breakdown);
        }

        fetchHeld();

        // If already completed or stopped, do not keep polling
        if (['COMPLETED', 'STOPPED', 'FAILED'].includes(sim.status || initialStats.status)) {
          stopPollingAndWs();
          return;
        }
      } catch (err) {
        console.error('Failed to load initial monitor data:', err);
        setError('Failed to fetch initial simulation telemetry.');
      }
    };

    loadInitial();

    // Setup live WebSocket
    cleanupWs = liveshieldApi.connectWebSocket(
      simulationId,
      (message) => {
        setIsConnected(true);
        if (message.type === 'stats') {
          const s = message.data;
          setStats(s);

          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const newPoint = {
            time: nowStr,
            tps: parseFloat((s.actual_tps || 0).toFixed(1)),
            target: parseFloat((s.configured_tps || 50).toFixed(1)),
          };

          tpsHistoryRef.current = [...tpsHistoryRef.current.slice(-29), newPoint];
          setTpsHistory([...tpsHistoryRef.current]);

          if (s.scenario_counts) {
            const breakdown = Object.entries(s.scenario_counts).map(([k, v]) => ({
              name: scenarioLabel(k),
              id: k,
              count: v,
            }));
            setScenarioBreakdown(breakdown);
          }

          setSimulation((prev) => (prev ? { ...prev, status: s.status } : prev));

          if (['COMPLETED', 'STOPPED', 'FAILED'].includes(s.status)) {
            fetchHeld();
            stopPollingAndWs();
          }
        } else if (message.type === 'transaction') {
          const txn = message.data;
          setTransactions((prev) => [txn, ...(Array.isArray(prev) ? prev.slice(0, 49) : [])]);
        } else if (message.type === 'decision') {
          const dec = message.data;
          setDecisions((prev) => [dec, ...(Array.isArray(prev) ? prev.slice(0, 49) : [])]);
          if (dec && dec.final_decision === 'HOLD') {
            setHeldTransactions((prev) => [dec, ...(Array.isArray(prev) ? prev : [])]);
          }
        }
      },
      (err) => {
        setIsConnected(false);
      },
      () => {
        setIsConnected(false);
      }
    );

    let isFinished = false;
    pollInterval = setInterval(async () => {
      try {
        const s = await liveshieldApi.getStats(simulationId);
        setStats(s);
        fetchHeld();

        if (s.status === 'RUNNING') {
          const txns = await liveshieldApi.getTransactions(simulationId, { limit: 30 });
          setTransactions(txns || []);
        } else if (['COMPLETED', 'STOPPED', 'FAILED'].includes(s.status)) {
          if (!isFinished) {
            isFinished = true;
            const txns = await liveshieldApi.getTransactions(simulationId, { limit: 50 });
            setTransactions(txns || []);
            setSimulation((prev) => (prev ? { ...prev, status: s.status } : prev));
          }
          stopPollingAndWs();
        }
      } catch (e) {
        // quiet catch
      }
    }, 3000);

    return () => {
      stopPollingAndWs();
    };
  }, [simulationId]);

  const fetchAnalysis = async () => {
    if (!simulationId) return;
    try {
      setLoadingAnalysis(true);
      const data = await liveshieldApi.getSimulationAnalysis(simulationId);
      setAnalysisData(data);
    } catch (e) {
      console.error('Failed to fetch analysis bundle:', e);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    if (['graph', 'riskmap', 'timeline', 'rings'].includes(activeSubTab) && !analysisData) {
      fetchAnalysis();
    }
  }, [activeSubTab, simulationId, analysisData]);

  // Cytoscape Graph Construction
  useEffect(() => {
    if (activeSubTab !== 'graph' || !cyContainerRef.current || !analysisData) return;

    if (cyInstanceRef.current) {
      cyInstanceRef.current.destroy();
      cyInstanceRef.current = null;
    }

    const nodeIds = new Set();
    const elements = [];

    const hybridMap = {};
    (analysisData.hybrid_scores || []).forEach((h) => {
      hybridMap[h.account_id] = h;
    });

    const ringMap = {};
    (analysisData.fraud_rings || []).forEach((r) => {
      (r.member_accounts || []).forEach((acc) => {
        ringMap[acc] = ringMap[acc] || [];
        ringMap[acc].push(r.pattern_type || 'RING');
      });
    });

    const suspiciousMap = {};
    (analysisData.suspicious_accounts || []).forEach((s) => {
      suspiciousMap[s.account_id] = s;
    });

    const allNodes = analysisData.graph?.nodes || Object.keys(hybridMap);
    allNodes.forEach((id) => {
      if (nodeIds.has(id)) return;
      nodeIds.add(id);

      const hybrid = hybridMap[id];
      const tier = hybrid?.risk_tier || 'LOW';
      const score = hybrid?.final_score || suspiciousMap[id]?.suspicion_score || 10;
      const isSuspicious = tier === 'HIGH' || tier === 'CRITICAL' || !!suspiciousMap[id];
      const rings = ringMap[id] || [];

      elements.push({
        data: {
          id,
          label: id,
          score,
          tier,
          suspicious: isSuspicious,
          ring: rings.length > 0 ? rings[0] : null,
          rings,
          patterns: hybrid?.patterns || suspiciousMap[id]?.detected_patterns || [],
        },
      });
    });

    const rawEdges = analysisData.graph?.edges || [];
    rawEdges.forEach((ed, idx) => {
      if (nodeIds.has(ed.source) && nodeIds.has(ed.target)) {
        elements.push({
          data: {
            id: `edge-${idx}`,
            source: ed.source,
            target: ed.target,
            amount: ed.amount,
            timestamp: ed.timestamp,
          },
        });
      }
    });

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#21262d',
            'label': 'data(label)',
            'color': '#c9d1d9',
            'font-size': '10px',
            'font-family': 'Inter, sans-serif',
            'text-outline-color': '#000000',
            'text-outline-width': 1.5,
            'width': (ele) => Math.min(42, 22 + (ele.data('score') || 0) / 4),
            'height': (ele) => Math.min(42, 22 + (ele.data('score') || 0) / 4),
            'border-width': 1.5,
            'border-color': '#30363d',
          },
        },
        {
          selector: 'node[tier = "CRITICAL"]',
          style: {
            'background-color': '#f85149',
            'border-color': '#ff7b72',
            'border-width': 2.5,
          },
        },
        {
          selector: 'node[tier = "HIGH"]',
          style: {
            'background-color': '#e3b341',
            'border-color': '#d29922',
            'border-width': 2,
          },
        },
        {
          selector: 'node[tier = "MEDIUM"]',
          style: {
            'background-color': '#d29922',
            'border-color': '#bb8009',
            'border-width': 1.5,
          },
        },
        {
          selector: 'node[tier = "LOW"]',
          style: {
            'background-color': '#238636',
            'border-color': '#3fb950',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#58a6ff',
            'border-width': 4,
            'color': '#ffffff',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeOverlap: 20,
        idealEdgeLength: 60,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyInstanceRef.current = cy;

    return () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
        cyInstanceRef.current = null;
      }
    };
  }, [activeSubTab, analysisData]);

  // Controls
  const handleStart = async () => {
    try {
      setActionLoading(true);
      await liveshieldApi.startSimulation(simulationId);
      const s = await liveshieldApi.getStats(simulationId);
      setStats(s);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      setActionLoading(true);
      await liveshieldApi.pauseSimulation(simulationId);
      const s = await liveshieldApi.getStats(simulationId);
      setStats(s);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to pause simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await liveshieldApi.resumeSimulation(simulationId);
      const s = await liveshieldApi.getStats(simulationId);
      setStats(s);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resume simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      await liveshieldApi.stopSimulation(simulationId);
      const s = await liveshieldApi.getStats(simulationId);
      setStats(s);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to stop simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      setActionLoading(true);
      await liveshieldApi.restartSimulation(simulationId);
      const s = await liveshieldApi.getStats(simulationId);
      setStats(s);
      setTransactions([]);
      setDecisions([]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restart simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSpeedChange = async (newTps) => {
    try {
      setActionLoading(true);
      await liveshieldApi.updateSimulationSpeed(simulationId, newTps);
      setStats((prev) => (prev ? { ...prev, configured_tps: newTps } : prev));
    } catch (err) {
      console.error('Failed to update speed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToCase = async () => {
    try {
      setActionLoading(true);
      const res = await liveshieldApi.convertToCase(simulationId);
      if (res.case_id) {
        setSimulation((prev) => ({ ...prev, case_id: res.case_id }));
        alert(res.message || `Simulation linked to Investigation Case #${res.case_id}`);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to convert simulation to case');
    } finally {
      setActionLoading(false);
    }
  };

  if (!simulationId) {
    return (
      <div className="text-center py-5 text-muted">
        <Activity size={36} className="mb-2 text-secondary" />
        <h5>No Simulation Selected</h5>
        <p>Select an active simulation from Overview or History to open the Live Monitor.</p>
        <Button variant="primary" onClick={() => onNavigate('overview')}>
          Back to Overview
        </Button>
      </div>
    );
  }

  const currentStatus = stats?.status || simulation?.status || 'INITIALIZED';
  const detectionMode = stats?.detection_mode || simulation?.detection_mode || 'shadow';
  const legitCount = stats?.total_legitimate || 0;
  const fraudCount = stats?.total_fraudulent || 0;
  const pieData = [
    { name: 'Legitimate', value: legitCount },
    { name: 'Fraudulent', value: fraudCount },
  ];

  return (
    <div className="liveshield-monitor">
      {/* Top Banner & Controls */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="text-white fw-bold mb-0">
              {simulation?.name || `Simulation #${simulationId}`}
            </h2>
            <Badge
              bg={
                currentStatus === 'RUNNING'
                  ? 'success'
                  : currentStatus === 'PAUSED'
                  ? 'warning'
                  : currentStatus === 'COMPLETED'
                  ? 'info'
                  : 'secondary'
              }
              className="text-uppercase"
            >
              {currentStatus}
            </Badge>
            <Badge
              bg={detectionMode === 'automated' ? 'danger' : detectionMode === 'assisted' ? 'warning' : 'info'}
              className={detectionMode === 'assisted' ? 'text-dark fw-bold text-uppercase' : 'text-uppercase'}
            >
              {detectionMode} MODE
            </Badge>
            {simulation?.case_id && (
              <Badge
                as="a"
                href={`/invospace/cases/${simulation.case_id}`}
                bg="primary"
                className="text-decoration-none d-flex align-items-center gap-1 px-2 py-1"
                style={{ cursor: 'pointer' }}
                title="Manage this simulation in InvoSpace Cases"
              >
                <Layers size={12} /> Case #{simulation.case_id}
              </Badge>
            )}
            {isConnected ? (
              <span className="badge bg-dark text-success border border-success border-opacity-25 d-flex align-items-center gap-1">
                <span className="live-dot" /> WebSocket Connected
              </span>
            ) : (
              <span className="badge bg-dark text-muted border border-secondary border-opacity-25">
                Connecting Stream...
              </span>
            )}
          </div>
          <p className="text-muted small mb-0 mt-1">
            Stream Rate: {stats?.configured_tps || 250} TPS &bull; Mode: {simulation?.mode || 'Basic'} &bull; ID: #{simulationId}
            {simulation?.case_id && (
              <> &bull; Linked Case: <a href={`/invospace/cases/${simulation.case_id}`} className="text-primary text-decoration-none fw-semibold">Case #{simulation.case_id}</a></>
            )}
          </p>
        </div>

        {/* Dynamic Speed Selector & Execution Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Real-time Delay & Speed Controller */}
          <div
            className="d-inline-flex align-items-center p-1 rounded-2"
            style={{ background: '#121215', border: '1px solid #27272a' }}
          >
            <span className="small text-muted px-2 d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
              <Zap size={12} /> Rate:
            </span>
            {[
              { label: '150 TPS', tps: 150 },
              { label: '300 TPS', tps: 300 },
              { label: '500 TPS', tps: 500 },
              { label: '750 TPS', tps: 750 },
              { label: '900 TPS', tps: 900 },
            ].map((sp) => {
              const currentTps = Math.round(stats?.configured_tps || 250);
              const isActive = currentTps === sp.tps;
              return (
                <button
                  key={sp.tps}
                  type="button"
                  onClick={() => handleSpeedChange(sp.tps)}
                  disabled={actionLoading || currentStatus === 'COMPLETED' || currentStatus === 'STOPPED'}
                  style={{
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#000000' : '#a1a1aa',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: (currentStatus === 'COMPLETED' || currentStatus === 'STOPPED') ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Adjust streaming throughput to ${sp.label}`}
                >
                  {sp.label}
                </button>
              );
            })}
          </div>

          {/* Execution Action Buttons */}
          {currentStatus === 'INITIALIZED' && (
            <Button
              variant="success"
              size="sm"
              onClick={handleStart}
              disabled={actionLoading}
              className="d-flex align-items-center gap-1 fw-bold"
            >
              <Play size={14} /> Start
            </Button>
          )}

          {currentStatus === 'RUNNING' && (
            <Button
              variant="warning"
              size="sm"
              onClick={handlePause}
              disabled={actionLoading}
              className="d-flex align-items-center gap-1 fw-bold"
            >
              <Pause size={14} /> Pause
            </Button>
          )}

          {currentStatus === 'PAUSED' && (
            <Button
              variant="success"
              size="sm"
              onClick={handleResume}
              disabled={actionLoading}
              className="d-flex align-items-center gap-1 fw-bold"
            >
              <Play size={14} /> Resume
            </Button>
          )}

          {(currentStatus === 'RUNNING' || currentStatus === 'PAUSED') && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              disabled={actionLoading}
              className="d-flex align-items-center gap-1 fw-bold"
            >
              <Square size={14} /> Stop
            </Button>
          )}

          {(currentStatus === 'STOPPED' || currentStatus === 'COMPLETED') && (
            <Button
              variant="outline-info"
              size="sm"
              onClick={handleRestart}
              disabled={actionLoading}
              className="d-flex align-items-center gap-1"
            >
              <RotateCcw size={14} /> Re-run Simulation
            </Button>
          )}

          {!simulation?.case_id && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleConvertToCase}
              disabled={actionLoading}
              className="d-flex align-items-center gap-1 fw-bold"
              title="Convert this synthetic simulation into a formal InvoSpace investigation case"
            >
              <Briefcase size={14} /> Convert to Case
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="border-0 bg-danger bg-opacity-10 text-danger mb-4">
          <AlertCircle size={16} className="me-2" />
          {error}
        </Alert>
      )}

      {/* Real-time KPI Cards */}
      <Row className="g-3 mb-4">
        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Live Throughput</span>
              <div className="d-flex align-items-baseline gap-2 mt-2">
                <h3 className="text-primary font-monospace fw-bold mb-0">
                  {(stats?.actual_tps || 0).toFixed(1)}
                </h3>
                <span className="text-muted small">/ {stats?.configured_tps || 50} TPS</span>
              </div>
              <div className="mt-2 small text-muted">
                Screening latency: {stats?.evaluation?.latency_screening_p50 || '< 1.0'} ms (p50)
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Total Emitted & Caught</span>
              <div className="d-flex align-items-baseline gap-2 mt-2">
                <h3 className="text-white font-monospace fw-bold mb-0">
                  {(stats?.total_generated || 0).toLocaleString()}
                </h3>
                <span className="text-muted small">units</span>
              </div>
              <div className="mt-2 small text-muted">
                Recall: {((stats?.evaluation?.recall || 0) * 100).toFixed(1)}% &bull; TP: {stats?.evaluation?.true_positives || 0}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Cumulative Volume</span>
              <div className="d-flex align-items-baseline gap-2 mt-2">
                <h3 className="text-success font-monospace fw-bold mb-0">
                  ${(stats?.total_volume || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>
              <div className="mt-2 small text-muted">
                Exact Numeric(18,2) precision
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} sm={6}>
          <Card className="bg-dark border-secondary border-opacity-25 h-100">
            <Card.Body className="p-3">
              <span className="text-muted small text-uppercase fw-semibold">Execution Timeline</span>
              <div className="d-flex align-items-baseline gap-2 mt-2">
                <h3 className="text-info font-monospace fw-bold mb-0">
                  {(stats?.elapsed_seconds || 0).toFixed(0)}s
                </h3>
                <span className="text-muted small">
                  {['COMPLETED', 'STOPPED', 'FAILED'].includes(simulation?.status || stats?.status)
                    ? '/ Final Duration'
                    : stats?.remaining_seconds !== null && stats?.remaining_seconds !== undefined
                    ? `/ ~${stats.remaining_seconds.toFixed(0)}s left`
                    : ''}
                </span>
              </div>
              <div className="mt-2 small text-muted">
                {['COMPLETED', 'STOPPED', 'FAILED'].includes(simulation?.status || stats?.status)
                  ? `Held in queue: ${heldTransactions.length} processed`
                  : `Held in queue: ${heldTransactions.length} pending`}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sub-Navigation Tabs */}
      <div className="border-bottom border-secondary border-opacity-25 mb-4">
        <Nav variant="tabs" className="custom-dark-tabs gap-2">
          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'stream'}
              onClick={() => setActiveSubTab('stream')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <Database size={16} />
              Live Stream & Feed
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'graph'}
              onClick={() => setActiveSubTab('graph')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <Network size={16} />
              Interactive Graph
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'riskmap'}
              onClick={() => setActiveSubTab('riskmap')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <Map size={16} />
              Risk Map & Scores
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'timeline'}
              onClick={() => setActiveSubTab('timeline')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <Clock size={16} />
              Timeline & Bursts
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'rings'}
              onClick={() => setActiveSubTab('rings')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <Users size={16} />
              Fraud Rings
              {analysisData?.fraud_rings?.length > 0 && (
                <Badge bg="danger" className="ms-1">
                  {analysisData.fraud_rings.length}
                </Badge>
              )}
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'held'}
              onClick={() => setActiveSubTab('held')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <UserCheck size={16} />
              Held Review Queue
              {heldTransactions.length > 0 && (
                <Badge bg="warning" className="text-dark ms-1">
                  {heldTransactions.length}
                </Badge>
              )}
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              active={activeSubTab === 'eval'}
              onClick={() => setActiveSubTab('eval')}
              className="d-flex align-items-center gap-2 cursor-pointer"
            >
              <ShieldCheck size={16} />
              Ground Truth & Evaluation
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </div>

      {/* Tab 1: Live Stream & Visual Charts */}
      {activeSubTab === 'stream' && (
        <>
          <Row className="g-4 mb-4">
            {/* Real-time Rolling TPS Chart */}
            <Col lg={8}>
              <Card className="bg-dark border-secondary border-opacity-25 h-100">
                <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
                  <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                    <Activity size={16} className="text-primary" />
                    Live Emission Rate (Rolling TPS Stream)
                  </h6>
                  <Badge bg="dark" className="border border-secondary border-opacity-25 text-white font-monospace">
                    Target: {stats?.configured_tps || 50} TPS
                  </Badge>
                </Card.Header>
                <Card.Body className="p-3" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tpsHistory}>
                      <defs>
                        <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#388bfd" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#388bfd" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="time" stroke="#8b949e" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tps"
                        stroke="#388bfd"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#tpsGrad)"
                        name="Actual TPS"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>

            {/* Traffic Composition Ratio */}
            <Col lg={4}>
              <Card className="bg-dark border-secondary border-opacity-25 h-100">
                <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                  <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                    <ShieldAlert size={16} className="text-danger" />
                    Ground-Truth Class Ratio
                  </h6>
                </Card.Header>
                <Card.Body className="p-3 d-flex flex-column align-items-center justify-content-center" style={{ height: '280px' }}>
                  {stats?.total_generated > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-muted small">Awaiting initial emissions...</div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Fraud Typologies Active Bar Chart */}
            {scenarioBreakdown.length > 0 && (
              <Col lg={12}>
                <Card className="bg-dark border-secondary border-opacity-25">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                    <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                      <Layers size={16} className="text-warning" />
                      Active Fraud Typology Frequency Breakdown
                    </h6>
                  </Card.Header>
                  <Card.Body className="p-3" style={{ height: '260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scenarioBreakdown} margin={{ bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis
                          dataKey="name"
                          stroke="#8b949e"
                          tick={{ fontSize: 10, fill: '#8b949e' }}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="#f85149" radius={[4, 4, 0, 0]} name="Transactions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>

          {/* Live Transaction & Decision Ledger */}
          <Card className="bg-dark border-secondary border-opacity-25 mb-4">
            <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <Database size={16} className="text-info" />
                <h6 className="text-white fw-bold mb-0">Live Streaming Ledger & Real-Time Decisions</h6>
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: '#18181b',
                    color: '#a1a1aa',
                    border: '1px solid #27272a',
                    fontFamily: 'monospace',
                  }}
                >
                  Rate: {stats?.configured_tps || 250} TPS
                </span>
              </div>
              <Badge bg="secondary" className="font-monospace">
                {transactions.length} latest events
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive" style={{ maxHeight: '420px' }}>
                <table className="table table-dark table-hover mb-0 align-middle">
                  <thead className="sticky-top bg-dark">
                    <tr className="text-muted small text-uppercase border-secondary border-opacity-25">
                      <th>Txn ID</th>
                      <th>Timestamp</th>
                      <th>Ground Truth</th>
                      <th>Typology</th>
                      <th>Sender</th>
                      <th>Receiver</th>
                      <th>Amount (USD)</th>
                      <th>Decision</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-4 text-muted">
                          No transactions emitted yet. Start or resume simulation to begin live stream.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t, idx) => {
                        const isFraud = t.synthetic_ground_truth === 'fraudulent';
                        const isLatest = idx === 0 && currentStatus === 'RUNNING';
                        return (
                          <tr
                            key={t.id || t.transaction_id}
                            className={`border-secondary border-opacity-10 ${isLatest ? 'bg-secondary bg-opacity-10' : ''}`}
                            style={{ transition: 'background-color 0.3s ease' }}
                          >
                            <td className="font-monospace text-muted small">
                              {t.transaction_id}
                              {isLatest && (
                                <span
                                  className="ms-1.5 badge"
                                  style={{
                                    fontSize: '9px',
                                    background: 'rgba(56, 139, 253, 0.2)',
                                    color: '#58a6ff',
                                    border: '1px solid rgba(56, 139, 253, 0.4)',
                                  }}
                                >
                                  LIVE
                                </span>
                              )}
                            </td>
                            <td className="text-muted small">
                              {new Date(t.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td>
                              <Badge bg={isFraud ? 'danger' : 'success'}>
                                {t.synthetic_ground_truth}
                              </Badge>
                            </td>
                            <td>
                              {isFraud ? (
                                <Badge bg="dark" className="border border-danger border-opacity-50 text-danger font-monospace" title={t.scenario_id}>
                                  {scenarioLabel(t.scenario_id)}
                                </Badge>
                              ) : (
                                <span className="text-muted small font-monospace">LEGIT</span>
                              )}
                            </td>
                            <td className="font-monospace text-white small">{t.sender_account}</td>
                            <td className="font-monospace text-white small">{t.receiver_account}</td>
                            <td className="font-monospace text-white fw-bold">
                              ${parseFloat(t.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td>
                              <Badge bg={isFraud ? 'warning' : 'success'} className={isFraud ? 'text-dark fw-bold' : ''}>
                                {isFraud ? (detectionMode === 'shadow' ? 'FLAG (SHADOW)' : 'FLAG') : 'APPROVE'}
                              </Badge>
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-info"
                                onClick={() => setInspectingTxn(t)}
                                className="py-0 px-2 d-flex align-items-center gap-1"
                              >
                                <Eye size={12} /> Inspect
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}

      {/* Tab: Interactive Graph Viewer */}
      {activeSubTab === 'graph' && (
        <Card className="bg-dark border-secondary border-opacity-25 mb-4">
          <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div className="d-flex align-items-center gap-3">
                <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                  <Network size={18} className="text-primary" />
                  Interactive Network Topology
                </h5>
                {analysisData && (
                  <div className="d-flex gap-2">
                    <Badge bg="dark" className="border border-secondary border-opacity-25 text-white">
                      {analysisData.graph?.nodes?.length || analysisData.hybrid_scores?.length || 0} Nodes
                    </Badge>
                    <Badge bg="dark" className="border border-secondary border-opacity-25 text-white">
                      {analysisData.graph?.edges?.length || 0} Edges
                    </Badge>
                  </div>
                )}
              </div>

              {/* Controls Toolbar */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div style={{ width: '180px' }}>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Search node..."
                    value={graphSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGraphSearch(val);
                      if (cyInstanceRef.current) {
                        if (!val) {
                          cyInstanceRef.current.nodes().removeClass('highlighted');
                        } else {
                          cyInstanceRef.current.nodes().forEach((n) => {
                            if (n.id().toLowerCase().includes(val.toLowerCase())) {
                              n.select();
                            } else {
                              n.unselect();
                            }
                          });
                        }
                      }
                    }}
                    className="bg-black border-secondary border-opacity-25 text-white"
                  />
                </div>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cyInstanceRef.current?.zoom(cyInstanceRef.current.zoom() * 1.25)}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cyInstanceRef.current?.zoom(cyInstanceRef.current.zoom() * 0.8)}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cyInstanceRef.current?.fit()}
                  title="Fit to Screen"
                >
                  <Maximize2 size={14} />
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cyInstanceRef.current?.layout({ name: 'cose', animate: true }).run()}
                  title="Re-layout Graph"
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </div>
          </Card.Header>

          <Card.Body className="p-3">
            {loadingAnalysis ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
                <Spinner animation="border" variant="primary" className="mb-3" />
                <span>Extracting network graph & running graph analytics...</span>
              </div>
            ) : (
              <Row className="g-3">
                <Col lg={selectedNode ? 8 : 12}>
                  {/* Graph Canvas Container */}
                  <div
                    ref={cyContainerRef}
                    style={{
                      height: '520px',
                      backgroundColor: '#000000',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      position: 'relative',
                    }}
                  />

                  {/* Legend Bar */}
                  <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between p-2 mt-2 bg-dark bg-opacity-40 rounded border border-secondary border-opacity-25 small">
                    <div className="d-flex gap-3 align-items-center">
                      <span className="text-muted fw-semibold">Risk Tiers:</span>
                      <span className="d-flex align-items-center gap-1 text-danger">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f85149' }} /> Critical (70-100)
                      </span>
                      <span className="d-flex align-items-center gap-1 text-warning">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#e3b341' }} /> High (50-69)
                      </span>
                      <span className="d-flex align-items-center gap-1 text-info">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#d29922' }} /> Medium (30-49)
                      </span>
                      <span className="d-flex align-items-center gap-1 text-success">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#238636' }} /> Low (0-29)
                      </span>
                    </div>
                    <span className="text-muted">Click any node to inspect account dossier & risk factors</span>
                  </div>
                </Col>

                {/* Node Inspector Drawer */}
                {selectedNode && (
                  <Col lg={4}>
                    <Card className="bg-black border-secondary border-opacity-25 h-100">
                      <Card.Header className="bg-dark bg-opacity-50 py-2 d-flex justify-content-between align-items-center">
                        <span className="text-white fw-bold small">Account Dossier</span>
                        <Button variant="link" size="sm" onClick={() => setSelectedNode(null)} className="text-muted p-0 text-decoration-none">
                          &times;
                        </Button>
                      </Card.Header>
                      <Card.Body className="p-3 small">
                        <div className="mb-3">
                          <div className="text-muted text-uppercase" style={{ fontSize: '10px' }}>Account ID</div>
                          <div className="font-monospace text-primary fw-bold fs-6">{selectedNode.id}</div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-dark bg-opacity-50 rounded">
                          <div>
                            <div className="text-muted" style={{ fontSize: '10px' }}>Risk Tier</div>
                            <Badge
                              bg={
                                selectedNode.tier === 'CRITICAL'
                                  ? 'danger'
                                  : selectedNode.tier === 'HIGH'
                                  ? 'warning'
                                  : selectedNode.tier === 'MEDIUM'
                                  ? 'info'
                                  : 'success'
                              }
                            >
                              {selectedNode.tier}
                            </Badge>
                          </div>
                          <div className="text-end">
                            <div className="text-muted" style={{ fontSize: '10px' }}>Final Score</div>
                            <div className="font-monospace fw-bold text-white fs-5">{Number(selectedNode.score).toFixed(1)}</div>
                          </div>
                        </div>

                        {selectedNode.rings?.length > 0 && (
                          <div className="mb-3">
                            <div className="text-muted text-uppercase mb-1" style={{ fontSize: '10px' }}>Mule Ring Memberships</div>
                            <div className="d-flex flex-wrap gap-1">
                              {selectedNode.rings.map((r, i) => (
                                <Badge key={i} bg="danger" className="text-dark fw-bold">
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedNode.patterns?.length > 0 && (
                          <div className="mb-3">
                            <div className="text-muted text-uppercase mb-1" style={{ fontSize: '10px' }}>Detected Patterns</div>
                            <ul className="text-white ps-3 mb-0">
                              {selectedNode.patterns.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                )}
              </Row>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Tab: Risk Map & Scores */}
      {activeSubTab === 'riskmap' && (
        <div className="risk-map-tab">
          {loadingAnalysis ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <span>Compiling account risk distributions...</span>
            </div>
          ) : (
            <>
              {/* Tier Counts */}
              <Row className="g-3 mb-4">
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((tier) => {
                  const count = (analysisData?.hybrid_scores || []).filter((h) => h.risk_tier === tier).length;
                  const border =
                    tier === 'CRITICAL'
                      ? 'border-danger'
                      : tier === 'HIGH'
                      ? 'border-warning'
                      : tier === 'MEDIUM'
                      ? 'border-info'
                      : 'border-success';
                  const textCol =
                    tier === 'CRITICAL'
                      ? 'text-danger'
                      : tier === 'HIGH'
                      ? 'text-warning'
                      : tier === 'MEDIUM'
                      ? 'text-info'
                      : 'text-success';

                  return (
                    <Col md={3} sm={6} key={tier}>
                      <Card className={`bg-dark border-secondary border-opacity-25 h-100 border-start ${border} border-start-4`}>
                        <Card.Body className="p-3">
                          <span className="text-muted small text-uppercase fw-semibold">{tier} Risk</span>
                          <h3 className={`${textCol} font-monospace fw-bold mt-2 mb-0`}>{count}</h3>
                          <span className="text-muted small">accounts flagged</span>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })}
              </Row>

              {/* Hybrid Scores Table */}
              <Card className="bg-dark border-secondary border-opacity-25 mb-4">
                <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
                  <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                    <Map size={16} className="text-primary" />
                    Account Multi-Dimension Risk Breakdown
                  </h6>
                  <div style={{ width: '220px' }}>
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="Filter by account..."
                      value={riskSearch}
                      onChange={(e) => setRiskSearch(e.target.value)}
                      className="bg-black border-secondary border-opacity-25 text-white"
                    />
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  <div className="table-responsive">
                    <table className="table table-dark table-hover mb-0" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr className="text-muted border-secondary border-opacity-25">
                          <th>#</th>
                          <th>Account</th>
                          <th>Tier</th>
                          <th>Final Risk Score</th>
                          <th>Graph Score</th>
                          <th>Behavior Score</th>
                          <th>Temporal Score</th>
                          <th>Community ID</th>
                          <th>ML Anomaly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analysisData?.hybrid_scores || [])
                          .filter((h) => !riskSearch || h.account_id.toLowerCase().includes(riskSearch.toLowerCase()))
                          .slice(0, 100)
                          .map((h, idx) => (
                            <tr key={idx} className="border-secondary border-opacity-25">
                              <td className="text-muted">{idx + 1}</td>
                              <td className="font-monospace text-primary fw-bold">{h.account_id}</td>
                              <td>
                                <Badge
                                  bg={
                                    h.risk_tier === 'CRITICAL'
                                      ? 'danger'
                                      : h.risk_tier === 'HIGH'
                                      ? 'warning'
                                      : h.risk_tier === 'MEDIUM'
                                      ? 'info'
                                      : 'success'
                                  }
                                >
                                  {h.risk_tier}
                                </Badge>
                              </td>
                              <td className="font-monospace text-white fw-bold">{Number(h.final_score).toFixed(1)}</td>
                              <td className="font-monospace text-light">{Number(h.graph_score || 0).toFixed(1)}</td>
                              <td className="font-monospace text-light">{Number(h.behaviour_score || 0).toFixed(1)}</td>
                              <td className="font-monospace text-light">{Number(h.temporal_score || 0).toFixed(1)}</td>
                              <td className="font-monospace text-muted">{h.community_id ?? '—'}</td>
                              <td className="font-monospace text-light">{Number(h.ml_score || 0).toFixed(1)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab: Timeline & Bursts */}
      {activeSubTab === 'timeline' && (
        <div className="timeline-tab">
          {loadingAnalysis ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <span>Analyzing temporal patterns & transaction burst timelines...</span>
            </div>
          ) : (
            <Row className="g-4 mb-4">
              {/* Night Activity */}
              <Col lg={6}>
                <Card className="bg-dark border-secondary border-opacity-25 h-100">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                    <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                      <Clock size={16} className="text-warning" />
                      Night Activity (00:00 - 05:00 UTC)
                    </h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-dark table-sm table-hover mb-0" style={{ fontSize: '11px' }}>
                        <thead>
                          <tr className="text-muted border-secondary border-opacity-25">
                            <th>Account</th>
                            <th>Night Tx</th>
                            <th>Total Tx</th>
                            <th>Night Ratio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analysisData?.temporal?.night_actors || []).slice(0, 10).map((a, i) => (
                            <tr key={i} className="border-secondary border-opacity-25">
                              <td className="font-monospace text-primary">{a.account_id}</td>
                              <td className="font-monospace">{a.night_tx_count}</td>
                              <td className="font-monospace">{a.total_tx}</td>
                              <td className="text-danger fw-bold font-monospace">{(a.night_ratio * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                          {!(analysisData?.temporal?.night_actors?.length) && (
                            <tr>
                              <td colSpan={4} className="text-center text-muted py-3">No abnormal night activity detected.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Rapid Movements */}
              <Col lg={6}>
                <Card className="bg-dark border-secondary border-opacity-25 h-100">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                    <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                      <Zap size={16} className="text-danger" />
                      Rapid Fund Velocity & Pass-throughs
                    </h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-dark table-sm table-hover mb-0" style={{ fontSize: '11px' }}>
                        <thead>
                          <tr className="text-muted border-secondary border-opacity-25">
                            <th>Account</th>
                            <th>Burst Count</th>
                            <th>Window (h)</th>
                            <th>First Seen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analysisData?.temporal?.rapid_movers || []).slice(0, 10).map((a, i) => (
                            <tr key={i} className="border-secondary border-opacity-25">
                              <td className="font-monospace text-primary">{a.account_id}</td>
                              <td className="font-monospace text-warning fw-bold">{a.rapid_tx_count}</td>
                              <td className="font-monospace">{a.window_hours}h</td>
                              <td className="text-muted font-monospace">{new Date(a.first_tx).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                          {!(analysisData?.temporal?.rapid_movers?.length) && (
                            <tr>
                              <td colSpan={4} className="text-center text-muted py-3">No rapid passthrough spikes detected.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Weekend Activity */}
              <Col lg={6}>
                <Card className="bg-dark border-secondary border-opacity-25 h-100">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                    <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                      <Activity size={16} className="text-info" />
                      Weekend Outlier Velocity
                    </h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-dark table-sm table-hover mb-0" style={{ fontSize: '11px' }}>
                        <thead>
                          <tr className="text-muted border-secondary border-opacity-25">
                            <th>Account</th>
                            <th>Weekend Tx</th>
                            <th>Total Tx</th>
                            <th>Weekend Ratio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analysisData?.temporal?.weekend_actors || []).slice(0, 10).map((a, i) => (
                            <tr key={i} className="border-secondary border-opacity-25">
                              <td className="font-monospace text-primary">{a.account_id}</td>
                              <td className="font-monospace">{a.weekend_tx_count}</td>
                              <td className="font-monospace">{a.total_tx}</td>
                              <td className="text-info fw-bold font-monospace">{(a.weekend_ratio * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                          {!(analysisData?.temporal?.weekend_actors?.length) && (
                            <tr>
                              <td colSpan={4} className="text-center text-muted py-3">No anomalous weekend trading detected.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Periodic Cycles */}
              <Col lg={6}>
                <Card className="bg-dark border-secondary border-opacity-25 h-100">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-3">
                    <h6 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                      <RotateCcw size={16} className="text-success" />
                      Periodic Recurring Patterns
                    </h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-dark table-sm table-hover mb-0" style={{ fontSize: '11px' }}>
                        <thead>
                          <tr className="text-muted border-secondary border-opacity-25">
                            <th>Account</th>
                            <th>Periodic Tx Count</th>
                            <th>Periodicity Ratio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analysisData?.temporal?.periodic_actors || []).slice(0, 10).map((a, i) => (
                            <tr key={i} className="border-secondary border-opacity-25">
                              <td className="font-monospace text-primary">{a.account_id}</td>
                              <td className="font-monospace">{a.periodic_tx_count}</td>
                              <td className="text-success fw-bold font-monospace">{(a.periodic_ratio * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                          {!(analysisData?.temporal?.periodic_actors?.length) && (
                            <tr>
                              <td colSpan={3} className="text-center text-muted py-3">No automated periodic bot signatures found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </div>
      )}

      {/* Tab: Fraud Rings & Clusters */}
      {activeSubTab === 'rings' && (
        <div className="fraud-rings-tab">
          {loadingAnalysis ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <span>Detecting complex cycle, fan, and layering mule rings...</span>
            </div>
          ) : (
            <Row className="g-3 mb-4">
              {(analysisData?.fraud_rings || []).map((ring, idx) => (
                <Col md={6} key={ring.ring_id || idx}>
                  <Card className="bg-dark border-secondary border-opacity-25 h-100">
                    <Card.Header className="bg-dark bg-opacity-50 py-3 d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <Users size={16} className="text-danger" />
                        <span className="text-white fw-bold font-monospace">{ring.ring_id || `RING-${idx+1}`}</span>
                        <Badge bg="danger" className="text-uppercase" style={{ fontSize: '10px' }}>
                          {ring.pattern_type || 'MULE RING'}
                        </Badge>
                      </div>
                      <Badge bg="dark" className="border border-danger border-opacity-50 text-danger">
                        {ring.member_accounts?.length || 0} Members
                      </Badge>
                    </Card.Header>
                    <Card.Body className="p-3">
                      <div className="text-muted small mb-2">Member Accounts in Typology:</div>
                      <div className="d-flex flex-wrap gap-1 mb-3">
                        {(ring.member_accounts || []).map((acc, i) => (
                          <Badge
                            key={i}
                            bg="dark"
                            className="border border-secondary border-opacity-25 text-primary font-monospace py-1 px-2"
                          >
                            {acc}
                          </Badge>
                        ))}
                      </div>
                      {ring.total_volume && (
                        <div className="d-flex justify-content-between text-muted small pt-2 border-top border-secondary border-opacity-25">
                          <span>Cumulative Volume</span>
                          <span className="text-success fw-bold font-monospace">${Number(ring.total_volume).toLocaleString()}</span>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
              {!(analysisData?.fraud_rings?.length) && (
                <Col xs={12}>
                  <Card className="bg-dark border-secondary border-opacity-25 p-5 text-center text-muted">
                    <Users size={32} className="mx-auto mb-2 text-muted" />
                    <h6>No structural fraud rings detected in this simulation dataset.</h6>
                  </Card>
                </Col>
              )}
            </Row>
          )}
        </div>
      )}

      {/* Tab 2: Held Transactions Queue */}
      {activeSubTab === 'held' && (
        <HeldTransactionsQueue
          simulationId={simulationId}
          heldTransactions={heldTransactions}
          onRefresh={fetchHeld}
          onInspectTransaction={(t) => setInspectingTxn(t)}
        />
      )}

      {/* Tab 3: Evaluation Metrics */}
      {activeSubTab === 'eval' && (
        <EvaluationView
          simulationId={simulationId}
          liveEvaluation={stats?.evaluation}
        />
      )}

      {/* Deep Inspector Modal */}
      <TransactionInspectorModal
        show={!!inspectingTxn}
        onHide={() => setInspectingTxn(null)}
        transaction={inspectingTxn}
      />
    </div>
  );
}
