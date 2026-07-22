import React, { useState } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  Form,
  Button,
  Spinner,
  Row,
  Col,
  Alert,
  Table,
  Badge
} from 'react-bootstrap';
import * as XLSX from 'xlsx';
import './SampleGenerator.css';
import '../../assets/landing.css';

const SampleGenerator = () => {
  const navigate = useNavigate();

  // User inputs
  const [numAccounts, setNumAccounts] = useState(50);
  const [numTransactions, setNumTransactions] = useState(1000);
  const [minAmount, setMinAmount] = useState(10);
  const [maxAmount, setMaxAmount] = useState(50000);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-07-22');
  const [maxPerAccount, setMaxPerAccount] = useState(100);
  const [datasetType, setDatasetType] = useState('unique');
  const [txnPrefix, setTxnPrefix] = useState('TXN');

  // Pattern selection
  const [includeCycles, setIncludeCycles] = useState(true);
  const [includeFan, setIncludeFan] = useState(true);
  const [includeLayering, setIncludeLayering] = useState(true);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataset, setDataset] = useState([]);
  const [previewTab, setPreviewTab] = useState('table'); // 'table' | 'json'

  // Presets
  const applyPreset = (type) => {
    if (type === 'small_cycle') {
      setNumAccounts(15);
      setNumTransactions(100);
      setMinAmount(1000);
      setMaxAmount(10000);
      setIncludeCycles(true);
      setIncludeFan(false);
      setIncludeLayering(false);
    } else if (type === 'fan_hub') {
      setNumAccounts(40);
      setNumTransactions(500);
      setMinAmount(500);
      setMaxAmount(25000);
      setIncludeCycles(false);
      setIncludeFan(true);
      setIncludeLayering(false);
    } else if (type === 'enterprise_mix') {
      setNumAccounts(150);
      setNumTransactions(5000);
      setMinAmount(50);
      setMaxAmount(100000);
      setIncludeCycles(true);
      setIncludeFan(true);
      setIncludeLayering(true);
    }
  };

  // Validation
  const validateInputs = () => {
    if (numAccounts < 1) return 'Number of accounts must be at least 1';
    if (numTransactions < 1) return 'Number of transactions must be at least 1';
    if (numTransactions > 100000) return 'Maximum 100,000 transactions allowed';
    if (minAmount < 0) return 'Minimum amount cannot be negative';
    if (maxAmount < minAmount) return 'Maximum amount must be greater than or equal to minimum';
    if (maxPerAccount < 1) return 'Max transactions per account must be at least 1';
    if (new Date(startDate) > new Date(endDate)) return 'Start date must be before end date';
    return null;
  };

  // Generate dataset by sending input to backend
  const handleGenerate = async () => {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/sample-generator', {
        numAccounts,
        numTransactions,
        minAmount,
        maxAmount,
        startDate,
        endDate,
        maxPerAccount,
        datasetType,
        txnPrefix,
        includeCycles,
        includeFan,
        includeLayering,
      });

      setDataset(res.data.transactions || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message);
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
    link.setAttribute('download', `sample_dataset_${dataset.length}.csv`);
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dataset');
    XLSX.writeFile(workbook, `sample_dataset_${dataset.length}.xlsx`);
  };

  // Copy preview to clipboard
  const handleCopyPreview = () => {
    const previewText = JSON.stringify(dataset.slice(0, 50), null, 2);
    navigator.clipboard.writeText(previewText).then(
      () => alert('Preview copied to clipboard!'),
      () => alert('Failed to copy')
    );
  };

  return (
    <div className="landing-shell py-4 px-3 min-vh-100">
      <Container className="max-w-1200">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <Button variant="outline-light" className="btn-glass" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </Button>
          <div className="d-flex align-items-center gap-2">
            <span className="logo-icon fs-3">⬡</span>
            <span className="logo-text text-light fs-4 fw-bold">TraceAcc Generator</span>
          </div>
        </div>

        <Card className="login-card-inner border-0 p-4 mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3 border-bottom border-white border-opacity-10 pb-3">
            <div>
              <h3 className="text-light fw-bold mb-1">📊 Synthetic Fraud Dataset Engine</h3>
              <p className="text-secondary small mb-0">Generate realistic financial transaction streams with seeded muling typologies.</p>
            </div>
            <Badge bg="primary" className="px-3 py-2 fs-6">v3.0 Graph AI</Badge>
          </div>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')} className="bg-danger bg-opacity-20 text-danger border-danger border-opacity-30">
              {error}
            </Alert>
          )}

          {/* Preset Buttons */}
          <div className="mb-4 p-3 bg-dark bg-opacity-50 rounded-3 border border-white border-opacity-10">
            <span className="text-secondary small fw-bold uppercase me-3">QUICK PRESETS:</span>
            <div className="d-inline-flex flex-wrap gap-2 mt-1">
              <button className="cy-btn" onClick={() => applyPreset('small_cycle')}>🌀 Small Cycle Ring (15 Accs)</button>
              <button className="cy-btn" onClick={() => applyPreset('fan_hub')}>📡 Fan-In/Out Hub (40 Accs)</button>
              <button className="cy-btn" onClick={() => applyPreset('enterprise_mix')}>⚡ Enterprise Mix (150 Accs)</button>
            </div>
          </div>

          {/* Inputs */}
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">NUMBER OF ACCOUNTS</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={numAccounts}
                  onChange={(e) => setNumAccounts(Number(e.target.value))}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">NUMBER OF TRANSACTIONS (MAX 100K)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={100000}
                  value={numTransactions}
                  onChange={(e) => setNumTransactions(Number(e.target.value))}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">MIN AMOUNT ($)</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={minAmount}
                  onChange={(e) => setMinAmount(Number(e.target.value))}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">MAX AMOUNT ($)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(Number(e.target.value))}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">START DATE</Form.Label>
                <Form.Control
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">END DATE</Form.Label>
                <Form.Control
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">MAX TXNS PER ACCOUNT</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={maxPerAccount}
                  onChange={(e) => setMaxPerAccount(Number(e.target.value))}
                  disabled={loading}
                  className="custom-glass-input"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">TXN ID PREFIX</Form.Label>
                <Form.Control
                  type="text"
                  value={txnPrefix}
                  onChange={(e) => setTxnPrefix(e.target.value)}
                  disabled={loading}
                  className="custom-glass-input"
                  placeholder="e.g., TXN"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Label className="small text-secondary fw-semibold">ACCOUNT GENERATION TYPE</Form.Label>
              <div className="login-mode-tabs mt-1">
                <button
                  type="button"
                  className={`mode-tab-btn ${datasetType === 'unique' ? 'active' : ''}`}
                  onClick={() => setDatasetType('unique')}
                  disabled={loading}
                >
                  Unique
                </button>
                <button
                  type="button"
                  className={`mode-tab-btn ${datasetType === 'repeated' ? 'active' : ''}`}
                  onClick={() => setDatasetType('repeated')}
                  disabled={loading}
                >
                  Repeated
                </button>
                <button
                  type="button"
                  className={`mode-tab-btn ${datasetType === 'mixed' ? 'active' : ''}`}
                  onClick={() => setDatasetType('mixed')}
                  disabled={loading}
                >
                  Mixed
                </button>
              </div>
            </Col>
          </Row>

          {/* Pattern Selection */}
          <div className="mb-4 p-3 bg-dark bg-opacity-40 rounded-3 border border-white border-opacity-10">
            <Form.Label className="small text-secondary fw-bold mb-2">INJECT FRAUD TYPOLOGY VECTORS</Form.Label>
            <div className="d-flex gap-4 flex-wrap">
              <Form.Check
                type="checkbox"
                id="cycle-check"
                label="Cycles (A → B → C → A)"
                checked={includeCycles}
                onChange={(e) => setIncludeCycles(e.target.checked)}
                disabled={loading}
                className="text-light fw-semibold"
              />
              <Form.Check
                type="checkbox"
                id="fan-check"
                label="Fan-In / Fan-Out Hubs"
                checked={includeFan}
                onChange={(e) => setIncludeFan(e.target.checked)}
                disabled={loading}
                className="text-light fw-semibold"
              />
              <Form.Check
                type="checkbox"
                id="layering-check"
                label="Multi-Hop Layering Shells"
                checked={includeLayering}
                onChange={(e) => setIncludeLayering(e.target.checked)}
                disabled={loading}
                className="text-light fw-semibold"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex align-items-center flex-wrap gap-3">
            <button type="button" onClick={handleGenerate} disabled={loading} className="btn-glow py-3 px-4 fs-6">
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  <span className="ms-2">Synthesizing Dataset...</span>
                </>
              ) : (
                'Generate Fraud Dataset'
              )}
            </button>

            {dataset.length > 0 && (
              <>
                <button type="button" className="btn-glass py-3 px-4" onClick={handleDownloadCSV} disabled={loading}>
                  📥 Download CSV
                </button>
                <button type="button" className="btn-glass py-3 px-4" onClick={handleDownloadExcel} disabled={loading}>
                  📊 Download Excel
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Dataset Preview */}
        {dataset.length > 0 && (
          <Card className="login-card-inner border-0 p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 className="text-light fw-bold mb-1">Generated Output Stream</h4>
                <p className="text-secondary small mb-0">Total Generated Records: {dataset.length} transactions</p>
              </div>
              <div className="d-flex gap-2">
                <button className={`cy-btn ${previewTab === 'table' ? 'active' : ''}`} onClick={() => setPreviewTab('table')}>
                  Table View
                </button>
                <button className={`cy-btn ${previewTab === 'json' ? 'active' : ''}`} onClick={() => setPreviewTab('json')}>
                  JSON Raw
                </button>
                <button className="cy-btn" onClick={handleCopyPreview}>
                  📋 Copy 50 Rows
                </button>
              </div>
            </div>

            {previewTab === 'table' ? (
              <div className="table-responsive rounded-3 border border-white border-opacity-10" style={{ maxHeight: '420px' }}>
                <Table hover variant="dark" className="mb-0 text-nowrap small">
                  <thead>
                    <tr className="bg-darker text-secondary">
                      <th>#</th>
                      <th>Transaction ID</th>
                      <th>Sender Account</th>
                      <th>Receiver Account</th>
                      <th>Amount ($)</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.slice(0, 100).map((row, idx) => (
                      <tr key={idx}>
                        <td className="text-secondary">{idx + 1}</td>
                        <td className="code-font text-info">{row.transaction_id}</td>
                        <td className="code-font text-light">{row.sender_id}</td>
                        <td className="code-font text-light">{row.receiver_id}</td>
                        <td className="fw-semibold text-success">${Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-secondary">{row.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="p-3 bg-darker rounded-3 border border-white border-opacity-10" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <pre className="text-success small mb-0 code-font">{JSON.stringify(dataset.slice(0, 50), null, 2)}</pre>
              </div>
            )}
          </Card>
        )}
      </Container>
    </div>
  );
};

export default SampleGenerator;