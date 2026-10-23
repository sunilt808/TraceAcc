import React, { useState, useMemo } from 'react';
import { Row, Col, Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Sparkles, FileSpreadsheet, RotateCw, AlertCircle, Wrench } from 'lucide-react';
import api, { getToken } from '../../services/api';
import GraphPanel from './GraphPanel';
import FraudRingTable from './FraudRingTable';
import UploadCard from './UploadCard';
import MetricsBar from './MetricsBar';

const Dashboard = () => {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlightedRing, setHighlightedRing] = useState(null);

  // ----------------------------
  // Handlers
  // ----------------------------
  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    setError(null);
  };

  const handleFileParsed = (data) => {
    setCsvData(data);
  };

  const handleRingClick = (ringId) => {
    setHighlightedRing(ringId);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await api.post('/analyze/advanced', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = response.data;
      setAnalysisResult(result);
    } catch (err) {
      const serverMsg = err.response?.data?.detail;
      setError(serverMsg || err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  // Graph Elements
  // ----------------------------
  const graphElements = useMemo(() => {
    if (!csvData || !analysisResult) return [];

    const accounts = new Set();
    csvData.forEach((row) => {
      accounts.add(row.sender_id);
      accounts.add(row.receiver_id);
    });

    const nodes = Array.from(accounts).map((accId) => {
      const suspicious = analysisResult.suspicious_accounts?.find((sa) => sa.account_id === accId);
      const hasRings = suspicious?.ring_ids?.length > 0;
      const burstFlag = suspicious?.burst || false;

      return {
        data: {
          id: accId,
          label: accId,
          suspicious: hasRings,
          burst: burstFlag,
          score: suspicious?.suspicion_score,
          patterns: suspicious?.detected_patterns,
          ring: suspicious?.ring_ids?.[0],
        },
      };
    });

    const edges = csvData.map((row, idx) => ({
      data: {
        id: `edge-${idx}`,
        source: row.sender_id,
        target: row.receiver_id,
        amount: row.amount,
        timestamp: row.timestamp,
      },
    }));

    return [...nodes, ...edges];
  }, [csvData, analysisResult]);

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#000000',
        minHeight: '100%',
        color: '#e6edf3',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Top Banner Toolbar */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
        <div>
          <h4 className="text-white mb-1 fw-bold" style={{ letterSpacing: '-0.02em', fontSize: '18px' }}>
            Money Muling Detection Engine
          </h4>
          <div className="text-secondary small" style={{ fontSize: '12px' }}>
            Upload transaction logs to detect circular laundering loops, fan-in/out structures, and mule rings
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Link
            to="/sample-generator"
            className="btn btn-sm d-flex align-items-center gap-1.5"
            style={{
              backgroundColor: '#161b22',
              borderColor: '#30363d',
              color: '#58a6ff',
              fontSize: '12px',
            }}
          >
            <Wrench size={13} />
            <span>Sample Generator</span>
          </Link>
        </div>
      </div>

      {/* Upload Zone */}
      <UploadCard
        file={file}
        onFileChange={handleFileChange}
        onFileParsed={handleFileParsed}
        onAnalyze={handleAnalyze}
        loading={loading}
        analysisResult={analysisResult}
      />

      {/* Error Alert */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError(null)}
          className="bg-danger bg-opacity-10 border-danger text-danger mb-0 d-flex align-items-center justify-content-between"
        >
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span style={{ fontSize: 12 }}>{error}</span>
          </div>
          <Button variant="outline-danger" size="sm" onClick={handleAnalyze} className="py-0 px-2" style={{ fontSize: 11 }}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Metrics Bar */}
      <MetricsBar summary={analysisResult?.summary} loading={loading} />

      {/* Graph Panel + Fraud Rings Split Layout */}
      <div className="row g-2 flex-grow-1" style={{ minHeight: '520px' }}>
        <div className="col-12 col-lg-8 h-100" style={{ minHeight: '440px' }}>
          <GraphPanel
            elements={graphElements}
            loading={loading}
            highlightedRing={highlightedRing}
            transactions={csvData}
          />
        </div>
        <div className="col-12 col-lg-4 h-100" style={{ minHeight: '440px' }}>
          <FraudRingTable
            rings={analysisResult?.fraud_rings || []}
            onRingClick={handleRingClick}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

