import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Button,
  Spinner,
  Row,
  Col,
  Alert,
  Badge,
} from 'react-bootstrap';
import {
  RotateCw,
  Minimize2,
  Maximize2,
  Zap,
  Layers,
  GitMerge,
  Activity,
  Clock,
  Cpu,
  Sparkles,
  DollarSign,
  Network,
  Binary,
  TreePine,
  Target,
  Boxes,
  TrendingUp,
  Users,
  Flame,
  ShieldAlert,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  CheckSquare,
  Square,
  Settings2,
  Sliders,
  Search,
  Database,
  ArrowRight,
  Filter,
  BarChart3,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import {
  PATTERNS_REGISTRY,
  PRESETS_CONFIG,
  PATTERN_TIERS,
} from '../../services/generator/patterns';
import { generateSyntheticTransactions } from '../../services/generator/engine';

// Icon mapping dictionary for dynamic typology rendering
const ICON_MAP = {
  RotateCw,
  Minimize2,
  Maximize2,
  Zap,
  Layers,
  GitMerge,
  Activity,
  Clock,
  Cpu,
  Sparkles,
  DollarSign,
  Network,
  Binary,
  TreePine,
  Target,
  Boxes,
  TrendingUp,
  Users,
  Flame,
  ShieldAlert,
};

const DynamicIcon = ({ name, size = 16, color = '#8b949e', className = '' }) => {
  const IconComponent = ICON_MAP[name] || Activity;
  return <IconComponent size={size} color={color} className={className} />;
};

const SampleGenerator = () => {
  const navigate = useNavigate();

  // Mode Selection: 'simple' | 'advanced'
  const [mode, setMode] = useState('simple');

  // Simple Mode Parameters
  const [datasetPreset, setDatasetPreset] = useState('mule_ring_benchmark');
  const [fraudIntensity, setFraudIntensity] = useState(3); // 1 = Low (5%), 3 = Medium (15%), 5 = High (35%)
  const [targetSize, setTargetSize] = useState('medium'); // 'small' (300 txns), 'medium' (1200 txns), 'large' (5000 txns)

  // Advanced Mode Parameters
  const [numAccounts, setNumAccounts] = useState(60);
  const [numTransactions, setNumTransactions] = useState(1200);
  const [minAmount, setMinAmount] = useState(25);
  const [maxAmount, setMaxAmount] = useState(50000);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-07-22');
  const [maxPerAccount, setMaxPerAccount] = useState(150);
  const [datasetType, setDatasetType] = useState('mixed');
  const [txnPrefix, setTxnPrefix] = useState('TXN');

  // Selected Patterns (Set of Pattern IDs)
  const [selectedPatternIds, setSelectedPatternIds] = useState(() => {
    return new Set(PATTERNS_REGISTRY.filter((p) => p.defaultInject).map((p) => p.id));
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataset, setDataset] = useState([]);
  const [previewTab, setPreviewTab] = useState('table');
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [patternFilterTier, setPatternFilterTier] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Apply Presets in Simple Mode
  const handleApplyPreset = (presetItem) => {
    setDatasetPreset(presetItem.id);
    setSelectedPatternIds(new Set(presetItem.patternIds));
    if (presetItem.defaultParams) {
      if (presetItem.defaultParams.numAccounts) setNumAccounts(presetItem.defaultParams.numAccounts);
      if (presetItem.defaultParams.numTransactions) setNumTransactions(presetItem.defaultParams.numTransactions);
      if (presetItem.defaultParams.minAmount) setMinAmount(presetItem.defaultParams.minAmount);
      if (presetItem.defaultParams.maxAmount) setMaxAmount(presetItem.defaultParams.maxAmount);
    }
  };

  const handleTogglePattern = (id) => {
    setSelectedPatternIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPatterns = () => {
    setSelectedPatternIds(new Set(PATTERNS_REGISTRY.map((p) => p.id)));
  };

  const handleDeselectAllPatterns = () => {
    setSelectedPatternIds(new Set());
  };

  // Generate dataset
  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    let finalAccounts = numAccounts;
    let finalTransactions = numTransactions;

    if (mode === 'simple') {
      if (targetSize === 'small') {
        finalAccounts = 25;
        finalTransactions = 300;
      } else if (targetSize === 'medium') {
        finalAccounts = 60;
        finalTransactions = 1200;
      } else if (targetSize === 'large') {
        finalAccounts = 250;
        finalTransactions = 5000;
      }
    }

    try {
      // Local high-fidelity generation for all 19 typologies
      const localData = generateSyntheticTransactions({
        numAccounts: finalAccounts,
        numTransactions: finalTransactions,
        minAmount,
        maxAmount,
        startDate,
        endDate,
        maxPerAccount,
        datasetType,
        txnPrefix,
        selectedPatternIds: Array.from(selectedPatternIds),
        fraudIntensity,
      });

      setDataset(localData);
      setCurrentPage(1);
    } catch (err) {
      console.warn('Local generator fallback to backend', err);
      try {
        const res = await api.post('/sample-generator', {
          numAccounts: finalAccounts,
          numTransactions: finalTransactions,
          minAmount,
          maxAmount,
          startDate,
          endDate,
          maxPerAccount,
          datasetType,
          txnPrefix,
          includeCycles: selectedPatternIds.has('circular_transaction'),
          includeFan: selectedPatternIds.has('fan_in') || selectedPatternIds.has('fan_out'),
          includeLayering: selectedPatternIds.has('layering_shells'),
        });
        setDataset(res.data.transactions || []);
        setCurrentPage(1);
      } catch (backendErr) {
        setError(backendErr.response?.data?.detail || backendErr.message || 'Synthetic generation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // CSV download
  const handleDownloadCSV = () => {
    if (!dataset.length) return;
    const csvHeader = 'transaction_id,sender_id,receiver_id,amount,timestamp\n';
    const csvRows = dataset.map(
      (row) => `${row.transaction_id},${row.sender_id},${row.receiver_id},${row.amount},${row.timestamp}`
    );
    const blob = new Blob([csvHeader + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `traceacc_fraud_dataset_${dataset.length}txns.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Excel download
  const handleDownloadExcel = () => {
    if (!dataset.length) return;
    const worksheet = XLSX.utils.json_to_sheet(dataset);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, `traceacc_fraud_dataset_${dataset.length}txns.xlsx`);
  };

  // Copy preview to clipboard
  const handleCopyPreview = () => {
    const previewText = JSON.stringify(dataset.slice(0, 100), null, 2);
    navigator.clipboard.writeText(previewText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filter patterns for display (Advanced Mode)
  const filteredPatterns = useMemo(() => {
    return PATTERNS_REGISTRY.filter((p) => {
      const matchTier =
        patternFilterTier === 'all' ||
        p.tierKey === patternFilterTier ||
        p.tier.toLowerCase().includes(patternFilterTier.toLowerCase());
      const matchSearch =
        !searchFilter.trim() ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.description.toLowerCase().includes(searchFilter.toLowerCase());
      return matchTier && matchSearch;
    });
  }, [patternFilterTier, searchFilter]);

  // Dataset summary metrics
  const stats = useMemo(() => {
    if (!dataset.length) return null;
    const totalVolume = dataset.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    const avgVolume = totalVolume / dataset.length;
    const senders = new Set(dataset.map((r) => r.sender_id));
    const receivers = new Set(dataset.map((r) => r.receiver_id));
    const uniqueAccounts = new Set([...senders, ...receivers]).size;

    return {
      count: dataset.length,
      totalVolume,
      avgVolume,
      uniqueAccounts,
    };
  }, [dataset]);

  // Filtered dataset for table display
  const filteredDataset = useMemo(() => {
    if (!tableSearch.trim()) return dataset;
    const q = tableSearch.toLowerCase();
    return dataset.filter(
      (r) =>
        r.transaction_id?.toLowerCase().includes(q) ||
        r.sender_id?.toLowerCase().includes(q) ||
        r.receiver_id?.toLowerCase().includes(q) ||
        String(r.amount).includes(q) ||
        r.timestamp?.toLowerCase().includes(q)
    );
  }, [dataset, tableSearch]);

  // Pagination slice
  const paginatedRows = useMemo(() => {
    if (rowsPerPage === -1) return filteredDataset;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredDataset.slice(start, start + rowsPerPage);
  }, [filteredDataset, currentPage, rowsPerPage]);

  const totalPages = rowsPerPage === -1 ? 1 : Math.ceil(filteredDataset.length / rowsPerPage);

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#000000',
        minHeight: '100%',
        color: '#e6edf3',
        paddingBottom: '40px',
      }}
    >
      {/* Scoped CSS to ensure 100% Dark Theme Table without any Bootstrap White Bleed */}
      <style>{`
        .sg-dark-table-wrapper {
          background-color: #000000 !important;
          border-radius: 6px;
          overflow: hidden;
        }

        .sg-dark-table {
          width: 100%;
          border-collapse: collapse;
          background-color: #000000 !important;
          color: #c9d1d9 !important;
          margin-bottom: 0 !important;
        }

        .sg-dark-table thead th {
          background-color: #080c12 !important;
          color: #8b949e !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.6px !important;
          border-top: none !important;
          border-bottom: 1px solid #1f242c !important;
          padding: 11px 14px !important;
          white-space: nowrap;
        }

        .sg-dark-table tbody td {
          background-color: #000000 !important;
          color: #c9d1d9 !important;
          font-size: 12px !important;
          border-top: none !important;
          border-bottom: 1px solid #161b22 !important;
          padding: 9px 14px !important;
          vertical-align: middle !important;
          transition: background-color 0.1s ease;
        }

        .sg-dark-table tbody tr:hover td {
          background-color: #0b1017 !important;
          color: #f0f6fc !important;
        }

        .sg-dark-table .account-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background-color: #0d1117;
          border: 1px solid #21262d;
          border-radius: 4px;
          padding: 2px 7px;
          font-family: monospace;
          font-size: 11px;
          color: #e6edf3;
          letter-spacing: 0.3px;
        }

        .sg-dark-table .txn-badge {
          display: inline-flex;
          align-items: center;
          background-color: rgba(56, 139, 253, 0.1);
          border: 1px solid rgba(56, 139, 253, 0.25);
          border-radius: 4px;
          padding: 2px 7px;
          font-family: monospace;
          font-size: 11px;
          color: #58a6ff;
          font-weight: 600;
        }

        .sg-dark-table .amount-tag {
          font-family: monospace;
          font-weight: 600;
          font-size: 12px;
          color: #3fb950;
        }
      `}</style>

      {/* Header Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h4 className="text-white mb-0 fw-bold" style={{ letterSpacing: '-0.02em', fontSize: '18px' }}>
              Synthetic Dataset & Typology Generator
            </h4>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: 'rgba(56, 139, 253, 0.15)',
                color: '#58a6ff',
                border: '1px solid rgba(56, 139, 253, 0.3)',
              }}
            >
              19 Typologies Available
            </span>
          </div>
          <div className="text-secondary small" style={{ fontSize: '12px' }}>
            Generate synthetic transaction ledgers with embedded money laundering rings, smurfing structures, and graph anomaly typologies.
          </div>
        </div>

        {/* Mode Toggler: Simple vs Advanced */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#05070a',
            border: '1px solid #1f242c',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setMode('simple')}
            style={{
              border: mode === 'simple' ? '1px solid #30363d' : '1px solid transparent',
              background: mode === 'simple' ? '#161b22' : 'transparent',
              color: mode === 'simple' ? '#f0f6fc' : '#8b949e',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: mode === 'simple' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Zap size={13} color={mode === 'simple' ? '#58a6ff' : '#8b949e'} />
            <span>Simple Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('advanced')}
            style={{
              border: mode === 'advanced' ? '1px solid #30363d' : '1px solid transparent',
              background: mode === 'advanced' ? '#161b22' : 'transparent',
              color: mode === 'advanced' ? '#f0f6fc' : '#8b949e',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: mode === 'advanced' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Settings2 size={13} color={mode === 'advanced' ? '#a371f7' : '#8b949e'} />
            <span>Advanced Controls</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError('')}
          className="bg-danger bg-opacity-10 border-danger text-danger mb-4"
        >
          {error}
        </Alert>
      )}

      {/* ============================================================ */}
      {/* SIMPLE MODE INTERFACE */}
      {/* ============================================================ */}
      {mode === 'simple' ? (
        <div className="row g-3 mb-4">
          {/* Preset Archetypes */}
          <div className="col-12">
            <div
              className="p-3 rounded"
              style={{
                backgroundColor: '#05070a',
                border: '1px solid #1f242c',
              }}
            >
              <div className="text-secondary small fw-bold text-uppercase mb-2" style={{ fontSize: 10, letterSpacing: '0.5px' }}>
                Select Fraud Simulation Archetype
              </div>

              <div className="row g-2">
                {PRESETS_CONFIG.map((preset) => {
                  const isSelected = datasetPreset === preset.id;
                  return (
                    <div key={preset.id} className="col-12 col-md-6 col-lg-3">
                      <div
                        onClick={() => handleApplyPreset(preset)}
                        style={{
                          backgroundColor: isSelected ? '#0d1117' : '#000000',
                          border: `1.5px solid ${isSelected ? '#388bfd' : '#1f242c'}`,
                          borderRadius: 6,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                backgroundColor: isSelected ? 'rgba(56,139,253,0.15)' : '#161b22',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <DynamicIcon
                                name={preset.iconName}
                                size={15}
                                color={isSelected ? '#58a6ff' : '#8b949e'}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 10,
                                backgroundColor: isSelected ? 'rgba(56,139,253,0.2)' : '#161b22',
                                color: isSelected ? '#58a6ff' : '#8b949e',
                                border: '1px solid',
                                borderColor: isSelected ? 'rgba(56,139,253,0.4)' : '#21262d',
                              }}
                            >
                              {preset.badge}
                            </span>
                          </div>
                          <div className="text-white fw-semibold mb-1" style={{ fontSize: 13 }}>
                            {preset.title}
                          </div>
                          <div className="text-secondary small" style={{ fontSize: 11, lineHeight: 1.4 }}>
                            {preset.desc}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scale & Fraud Intensity Selector */}
          <div className="col-12 col-md-6">
            <Card style={{ backgroundColor: '#05070a', borderColor: '#1f242c', height: '100%' }}>
              <Card.Body className="p-3">
                <div className="text-secondary small fw-bold text-uppercase mb-2" style={{ fontSize: 10, letterSpacing: '0.5px' }}>
                  Dataset Scale
                </div>
                <div className="d-flex gap-2">
                  {[
                    { id: 'small', label: 'Small', details: '25 Accs · ~300 Txns' },
                    { id: 'medium', label: 'Standard', details: '60 Accs · ~1,200 Txns' },
                    { id: 'large', label: 'Enterprise', details: '250 Accs · ~5,000 Txns' },
                  ].map((size) => {
                    const isSelected = targetSize === size.id;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setTargetSize(size.id)}
                        className="flex-grow-1 p-2 text-center"
                        style={{
                          backgroundColor: isSelected ? '#161b22' : '#000000',
                          border: `1px solid ${isSelected ? '#388bfd' : '#1f242c'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div className={`fw-semibold ${isSelected ? 'text-white' : 'text-secondary'}`} style={{ fontSize: 12 }}>
                          {size.label}
                        </div>
                        <div className="text-secondary small" style={{ fontSize: 10 }}>
                          {size.details}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          </div>

          <div className="col-12 col-md-6">
            <Card style={{ backgroundColor: '#05070a', borderColor: '#1f242c', height: '100%' }}>
              <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="text-secondary small fw-bold text-uppercase" style={{ fontSize: 10, letterSpacing: '0.5px' }}>
                    Fraud Injection Density
                  </div>
                  <span className="text-white fw-bold small">
                    {fraudIntensity === 1 ? '5% (Low)' : fraudIntensity === 3 ? '15% (Standard)' : '35% (Aggressive)'}
                  </span>
                </div>
                <Form.Range
                  min={1}
                  max={5}
                  step={2}
                  value={fraudIntensity}
                  onChange={(e) => setFraudIntensity(Number(e.target.value))}
                  style={{ accentColor: '#388bfd' }}
                />
                <div className="d-flex justify-content-between text-secondary small" style={{ fontSize: 10 }}>
                  <span>Subtle Anomalies</span>
                  <span>Balanced Mix</span>
                  <span>Heavy Muling Flood</span>
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* ADVANCED MODE INTERFACE */
        /* ============================================================ */
        <div className="row g-3 mb-4">
          <div className="col-12">
            <Card style={{ backgroundColor: '#05070a', borderColor: '#1f242c' }}>
              <Card.Body className="p-3">
                <div className="text-secondary small fw-bold text-uppercase mb-3" style={{ fontSize: 10, letterSpacing: '0.5px' }}>
                  Granular Generation Parameters
                </div>

                <Row className="g-3">
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Accounts Count</Form.Label>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={3}
                        value={numAccounts}
                        onChange={(e) => setNumAccounts(Number(e.target.value))}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Transactions Count</Form.Label>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={10}
                        max={50000}
                        value={numTransactions}
                        onChange={(e) => setNumTransactions(Number(e.target.value))}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Min Amount ($)</Form.Label>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={1}
                        value={minAmount}
                        onChange={(e) => setMinAmount(Number(e.target.value))}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Max Amount ($)</Form.Label>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={minAmount}
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(Number(e.target.value))}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Start Date</Form.Label>
                      <Form.Control
                        size="sm"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>End Date</Form.Label>
                      <Form.Control
                        size="sm"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Max Txns / Account</Form.Label>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={5}
                        value={maxPerAccount}
                        onChange={(e) => setMaxPerAccount(Number(e.target.value))}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="text-secondary small mb-1" style={{ fontSize: 11 }}>Txn Prefix</Form.Label>
                      <Form.Control
                        size="sm"
                        type="text"
                        value={txnPrefix}
                        onChange={(e) => setTxnPrefix(e.target.value)}
                        style={{ backgroundColor: '#000000', borderColor: '#21262d', color: '#f0f6fc', fontSize: 12 }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>

          {/* 19 Typologies Selection Grid (Visible in Advanced Mode) */}
          <div className="col-12">
            <Card style={{ backgroundColor: '#05070a', borderColor: '#1f242c' }}>
              <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom" style={{ borderColor: '#1f242c' }}>
                  <div>
                    <span className="text-white fw-bold" style={{ fontSize: 13 }}>
                      Seeded Typologies Selection ({selectedPatternIds.size} / {PATTERNS_REGISTRY.length} Active)
                    </span>
                    <div className="text-secondary small" style={{ fontSize: 11 }}>
                      Toggle individual topological structures and graph anomalies to embed into the dataset
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleSelectAllPatterns}
                      className="p-0 text-decoration-none"
                      style={{ color: '#58a6ff', fontSize: 11 }}
                    >
                      Select All ({PATTERNS_REGISTRY.length})
                    </Button>
                    <span className="text-secondary">·</span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleDeselectAllPatterns}
                      className="p-0 text-decoration-none text-secondary"
                      style={{ fontSize: 11 }}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: `All Typologies (${PATTERNS_REGISTRY.length})` },
                      { id: 'basic', label: 'Basic Heuristics (5)' },
                      { id: 'intermediate', label: 'Intermediate (7)' },
                      { id: 'advanced_ml', label: 'Advanced ML (7)' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPatternFilterTier(f.id)}
                        style={{
                          border: patternFilterTier === f.id ? '1px solid #30363d' : '1px solid transparent',
                          background: patternFilterTier === f.id ? '#161b22' : 'transparent',
                          color: patternFilterTier === f.id ? '#f0f6fc' : '#8b949e',
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: patternFilterTier === f.id ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ position: 'relative', width: 220 }}>
                    <Search
                      size={12}
                      color="#8b949e"
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      placeholder="Search typologies..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#000000',
                        border: '1px solid #21262d',
                        borderRadius: 6,
                        padding: '4px 8px 4px 26px',
                        color: '#f0f6fc',
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Pattern Checkboxes Grid */}
                <div className="row g-2">
                  {filteredPatterns.map((pattern) => {
                    const isSelected = selectedPatternIds.has(pattern.id);
                    return (
                      <div key={pattern.id} className="col-12 col-md-6 col-lg-4">
                        <div
                          onClick={() => handleTogglePattern(pattern.id)}
                          style={{
                            backgroundColor: isSelected ? '#000000' : '#05070a',
                            border: `1px solid ${isSelected ? pattern.color : '#161b22'}`,
                            borderRadius: 6,
                            padding: '8px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            height: '100%',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div className="mt-0.5">
                            {isSelected ? (
                              <CheckSquare size={14} color={pattern.color} />
                            ) : (
                              <Square size={14} color="#8b949e" />
                            )}
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-1.5">
                              <DynamicIcon name={pattern.iconName} size={12} color={pattern.color} />
                              <span className={`fw-semibold ${isSelected ? 'text-white' : 'text-secondary'}`} style={{ fontSize: 12 }}>
                                {pattern.name}
                              </span>
                            </div>
                            <div className="text-secondary small mt-0.5" style={{ fontSize: 10, lineHeight: 1.3 }}>
                              {pattern.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      )}

      {/* Generation Trigger Action Bar */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="d-flex align-items-center gap-2 px-4 py-2 fw-semibold"
          style={{
            backgroundColor: '#238636',
            borderColor: '#2ea043',
            color: '#ffffff',
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(35, 134, 54, 0.4)',
          }}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" />
              <span>Synthesizing Transaction Graph...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Generate Synthetic Dataset</span>
            </>
          )}
        </Button>

        {dataset.length > 0 && (
          <div className="d-flex align-items-center gap-2">
            <Button
              onClick={handleDownloadCSV}
              variant="outline-secondary"
              className="d-flex align-items-center gap-1.5 px-3 py-1.5"
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9', fontSize: 12 }}
            >
              <Download size={13} />
              <span>Download CSV</span>
            </Button>

            <Button
              onClick={handleDownloadExcel}
              variant="outline-secondary"
              className="d-flex align-items-center gap-1.5 px-3 py-1.5"
              style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9', fontSize: 12 }}
            >
              <FileSpreadsheet size={13} />
              <span>Download Excel</span>
            </Button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* DATASET PREVIEW & INSPECTOR */}
      {/* ============================================================ */}
      {dataset.length > 0 && (
        <Card style={{ backgroundColor: '#05070a', borderColor: '#1f242c' }}>
          {/* Summary Metrics Banner */}
          {stats && (
            <div
              className="p-3 border-bottom d-flex flex-wrap gap-4 align-items-center"
              style={{ borderColor: '#1f242c', backgroundColor: '#020408' }}
            >
              <div className="d-flex align-items-center gap-2">
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(56, 139, 253, 0.1)', color: '#58a6ff' }}>
                  <BarChart3 size={16} />
                </div>
                <div>
                  <div className="text-secondary small fw-medium" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    Total Synthesized
                  </div>
                  <div className="text-white fw-bold" style={{ fontSize: 14 }}>
                    {stats.count.toLocaleString()} <span className="text-secondary small fw-normal">txns</span>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(63, 185, 80, 0.1)', color: '#3fb950' }}>
                  <DollarSign size={16} />
                </div>
                <div>
                  <div className="text-secondary small fw-medium" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    Total Transacted Volume
                  </div>
                  <div className="fw-bold" style={{ fontSize: 14, color: '#3fb950' }}>
                    ${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(210, 153, 34, 0.1)', color: '#d29922' }}>
                  <Activity size={16} />
                </div>
                <div>
                  <div className="text-secondary small fw-medium" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    Average Amount
                  </div>
                  <div className="text-white fw-bold" style={{ fontSize: 14 }}>
                    ${stats.avgVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(163, 113, 247, 0.1)', color: '#a371f7' }}>
                  <Users size={16} />
                </div>
                <div>
                  <div className="text-secondary small fw-medium" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    Unique Accounts
                  </div>
                  <div className="text-white fw-bold" style={{ fontSize: 14 }}>
                    {stats.uniqueAccounts} <span className="text-secondary small fw-normal">nodes</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table Toolbar (Tabs, Search, Pagination Limit, Copy) */}
          <div
            className="p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 border-bottom"
            style={{ borderColor: '#1f242c', backgroundColor: '#000000' }}
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: '#05070a',
                  border: '1px solid #21262d',
                  borderRadius: 6,
                  padding: 2,
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setPreviewTab('table')}
                  style={{
                    border: 'none',
                    background: previewTab === 'table' ? '#161b22' : 'transparent',
                    color: previewTab === 'table' ? '#f0f6fc' : '#8b949e',
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Table View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('json')}
                  style={{
                    border: 'none',
                    background: previewTab === 'json' ? '#161b22' : 'transparent',
                    color: previewTab === 'json' ? '#f0f6fc' : '#8b949e',
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Raw JSON
                </button>
              </div>

              {previewTab === 'table' && (
                <div style={{ position: 'relative', width: 200 }}>
                  <Search
                    size={12}
                    color="#8b949e"
                    style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    placeholder="Filter preview..."
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#05070a',
                      border: '1px solid #21262d',
                      borderRadius: 6,
                      padding: '3px 8px 3px 26px',
                      color: '#f0f6fc',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              {previewTab === 'table' && (
                <div className="d-flex align-items-center gap-1.5 text-secondary small" style={{ fontSize: 11 }}>
                  <span>Rows:</span>
                  {[50, 100, 250, -1].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setRowsPerPage(cnt);
                        setCurrentPage(1);
                      }}
                      style={{
                        border: 'none',
                        background: rowsPerPage === cnt ? '#161b22' : 'transparent',
                        color: rowsPerPage === cnt ? '#58a6ff' : '#8b949e',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: rowsPerPage === cnt ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {cnt === -1 ? 'All' : cnt}
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleCopyPreview}
                className="d-flex align-items-center gap-1 py-1 px-2.5"
                style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#c9d1d9', fontSize: 11 }}
              >
                {copied ? <Check size={11} color="#3fb950" /> : <Copy size={11} />}
                <span>{copied ? 'Copied!' : 'Copy 100 Rows'}</span>
              </Button>
            </div>
          </div>

          <Card.Body className="p-0">
            {previewTab === 'table' ? (
              <div className="sg-dark-table-wrapper" style={{ maxHeight: 460, overflowY: 'auto' }}>
                <table className="sg-dark-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                      <th>Transaction ID</th>
                      <th>Sender Account</th>
                      <th style={{ width: '30px', textAlign: 'center' }}></th>
                      <th>Receiver Account</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4 text-secondary small">
                          No transactions matching "{tableSearch}"
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, idx) => {
                        const globalIndex = rowsPerPage === -1 ? idx + 1 : (currentPage - 1) * rowsPerPage + idx + 1;
                        return (
                          <tr key={row.transaction_id || idx}>
                            <td style={{ textAlign: 'center', color: '#8b949e', fontFamily: 'monospace', fontSize: 11 }}>
                              {globalIndex}
                            </td>
                            <td>
                              <span className="txn-badge">
                                {row.transaction_id}
                              </span>
                            </td>
                            <td>
                              <span className="account-badge">
                                <Users size={11} color="#8b949e" />
                                {row.sender_id}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', color: '#484f58' }}>
                              <ArrowRight size={12} />
                            </td>
                            <td>
                              <span className="account-badge">
                                <Users size={11} color="#8b949e" />
                                {row.receiver_id}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="amount-tag">
                                ${Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: '#8b949e', fontFamily: 'monospace', fontSize: 11 }}>
                              {row.timestamp}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3" style={{ backgroundColor: '#000000', maxHeight: 460, overflowY: 'auto' }}>
                <pre
                  className="mb-0 font-monospace p-3 rounded"
                  style={{
                    backgroundColor: '#05070a',
                    border: '1px solid #161b22',
                    fontSize: 11,
                    color: '#3fb950',
                    lineHeight: 1.5,
                  }}
                >
                  {JSON.stringify(dataset.slice(0, 100), null, 2)}
                </pre>
              </div>
            )}

            {/* Pagination Controls when multiple pages */}
            {previewTab === 'table' && totalPages > 1 && (
              <div
                className="p-2.5 px-3 border-top d-flex justify-content-between align-items-center"
                style={{ borderColor: '#1f242c', backgroundColor: '#05070a' }}
              >
                <div className="text-secondary small" style={{ fontSize: 11 }}>
                  Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
                  {Math.min(currentPage * rowsPerPage, filteredDataset.length)} of {filteredDataset.length} rows
                </div>

                <div className="d-flex align-items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      border: '1px solid #21262d',
                      backgroundColor: '#0d1117',
                      color: currentPage === 1 ? '#484f58' : '#c9d1d9',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>
                  <span className="text-secondary small px-2" style={{ fontSize: 11 }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      border: '1px solid #21262d',
                      backgroundColor: '#0d1117',
                      color: currentPage === totalPages ? '#484f58' : '#c9d1d9',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default SampleGenerator;