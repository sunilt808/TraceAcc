import React, { useState, useMemo } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import api, { getToken } from '../../services/api';
import Navbar from './Navbar';
import GraphPanel from './GraphPanel';
import FraudRingTable from './FraudRingTable';
import UploadCard from './UploadCard';
import MetricsBar from './MetricsBar';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { logout } = useAuth();
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

      // ✅ Use the same base URL as the auth API (deployed backend)
      const response = await api.post('/analyze', formData, {
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

  const handleLogout = () => {
    logout();
    // Redirect to login page
    window.location.href = '/login';
  };

  // ----------------------------
  // Graph Elements
  // ----------------------------
  const graphElements = useMemo(() => {
    if (!csvData || !analysisResult) return [];

    const accounts = new Set();
    csvData.forEach(row => {
      accounts.add(row.sender_id);
      accounts.add(row.receiver_id);
    });

    const nodes = Array.from(accounts).map(accId => {
      const suspicious = analysisResult.suspicious_accounts?.find(sa => sa.account_id === accId);
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
        }
      };
    });

    const edges = csvData.map((row, idx) => ({
      data: {
        id: `edge-${idx}`,
        source: row.sender_id,
        target: row.receiver_id,
        amount: row.amount,
        timestamp: row.timestamp,
      }
    }));

    return [...nodes, ...edges];
  }, [csvData, analysisResult]);

  return (
    <Container fluid className="vh-100 d-flex flex-column p-0 bg-darker">
      {/* Navbar */}
      <Row className="g-0">
        <Col>
          <Navbar onLogout={handleLogout} />
        </Col>
      </Row>

      {/* Sample Generator Button */}
      <Row className="g-0 p-2">
        <Col>
          <Link to="/sample-generator" className="btn btn-info mb-2">
            Open Sample Generator
          </Link>
        </Col>
      </Row>

      {/* Graph + Table */}
      <Row className="g-0 flex-grow-1 overflow-hidden">
        <Col lg={8} className="h-100 p-2">
          <GraphPanel
            elements={graphElements}
            loading={loading}
            highlightedRing={highlightedRing}
            transactions={csvData}
          />
        </Col>
        <Col lg={4} className="h-100 p-2 overflow-auto">
          <FraudRingTable
            rings={analysisResult?.fraud_rings || []}
            onRingClick={handleRingClick}
          />
        </Col>
      </Row>

      {/* Upload + Metrics + Errors */}
      <Row className="g-0 bg-dark p-3">
        <Col>
          <UploadCard
            file={file}
            onFileChange={handleFileChange}
            onFileParsed={handleFileParsed}
            onAnalyze={handleAnalyze}
            loading={loading}
            analysisResult={analysisResult}
          />
          <MetricsBar summary={analysisResult?.summary} loading={loading} />
          {error && (
            <div className="text-danger small mt-2">
              <strong>Error:</strong> {error}
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;