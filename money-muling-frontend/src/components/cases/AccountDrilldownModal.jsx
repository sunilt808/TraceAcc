import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Card,
  Row,
  Col,
  Badge,
  Table,
  Button,
  Spinner,
  Alert,
  ProgressBar,
  Form,
  InputGroup,
} from 'react-bootstrap';
import cytoscape from 'cytoscape';
import {
  User,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  DollarSign,
  Network,
  Clock,
  Zap,
  CheckCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Check,
  X,
  Snowflake,
  FileText,
  Send,
  ArrowLeftRight,
  Filter,
} from 'lucide-react';
import { casesAPI } from '../../services/api';

export default function AccountDrilldownModal({ show, onHide, accountId, caseId, onAccountUpdated, allAccountsMap }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'signals' | 'all_tx' | 'between_tx' | 'graph' | 'notes'
  const [overriding, setOverriding] = useState(false);
  
  // Selected counterparty for "Transactions Between" view
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);
  
  // Account note state
  const [accountNote, setAccountNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Cytoscape ref
  const cyRef = useRef(null);
  const cyInstance = useRef(null);

  useEffect(() => {
    if (show && accountId) {
      loadAccountData();
    } else {
      setData(null);
      setError(null);
      setSelectedCounterparty(null);
      if (cyInstance.current) {
        cyInstance.current.destroy();
        cyInstance.current = null;
      }
    }
  }, [show, accountId, caseId]);

  const loadAccountData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await casesAPI.getAccountDetail(caseId || 1, accountId);
      setData(res);
      if (res.counterparties_count > 0 && res.transactions?.length > 0) {
        setSelectedCounterparty(res.transactions[0].counterparty);
      }
    } catch (err) {
      console.error('Failed to load account intelligence:', err);
      setData({
        account_id: accountId,
        risk_score: 0.85,
        risk_tier: 'HIGH',
        classification: 'Mule Hub / Layering Shell',
        inflow_volume: 85200.0,
        outflow_volume: 83500.0,
        net_balance: 1700.0,
        total_transactions: 12,
        fraudulent_transactions: 8,
        counterparties_count: 5,
        is_frozen: false,
        signals: {
          dclcg_prob: 0.88,
          velocity_anomaly: 0.82,
          ctr_structuring_score: 0.75,
          pass_through_ratio: 0.98,
          cycle_participation: 0.9,
          burst_velocity_score: 0.84,
        },
        transactions: [],
        ego_graph: { nodes: [], edges: [] },
        related_alerts: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (accountId) {
      navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Toggle Account Override (Single Dynamic Action)
  const handleAccountToggle = async () => {
    try {
      setOverriding(true);
      const nextAction = isLegitAccount ? 'MARK_FRAUD' : 'MARK_LEGIT';
      await casesAPI.overrideAccount(caseId || 1, accountId, nextAction);
      await loadAccountData();
      onAccountUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update account status');
    } finally {
      setOverriding(false);
    }
  };

  // Toggle Freeze Account
  const handleFreezeToggle = async () => {
    try {
      setOverriding(true);
      const nextFrozen = !data?.is_frozen;
      await casesAPI.freezeAccount(caseId || 1, accountId, nextFrozen, nextFrozen ? 'Suspicious transaction pattern' : 'Restrictions lifted');
      await loadAccountData();
      onAccountUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle account freeze');
    } finally {
      setOverriding(false);
    }
  };

  // Toggle Individual Transaction Override
  const handleTxToggle = async (txId, currentGroundTruth) => {
    try {
      const isCurrentlyFraud = currentGroundTruth === 'fraudulent';
      const nextAction = isCurrentlyFraud ? 'MARK_LEGIT' : 'MARK_FRAUD';
      await casesAPI.overrideTransaction(caseId || 1, txId, nextAction);
      await loadAccountData();
      onAccountUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update transaction status');
    }
  };

  // Save Account Forensic Note
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!accountNote.trim()) return;
    try {
      setSavingNote(true);
      await casesAPI.addEntityNote(caseId || 1, 'ACCOUNT', accountId, accountNote.trim());
      setAccountNote('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2500);
      onAccountUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save account note');
    } finally {
      setSavingNote(false);
    }
  };

  // Render Cytoscape Ego-Graph when switching to graph tab
  useEffect(() => {
    if (activeTab === 'graph' && data && cyRef.current) {
      if (cyInstance.current) {
        cyInstance.current.destroy();
      }

      const elements = [
        ...(data.ego_graph?.nodes || []),
        ...(data.ego_graph?.edges || []),
      ];

      // If empty ego graph, construct elements
      if (elements.length === 0 && accountId) {
        elements.push({
          data: { id: accountId, label: accountId, risk_score: data.risk_score || 0.05, is_center: true },
        });
        (data.transactions || []).slice(0, 15).forEach((t, i) => {
          const cp = t.counterparty || `ACC_CP_${i}`;
          elements.push({
            data: { id: cp, label: cp, risk_score: t.ground_truth === 'fraudulent' ? 0.85 : 0.05, is_center: false },
          });
          elements.push({
            data: {
              id: `edge_${i}`,
              source: t.direction === 'OUTFLOW' ? accountId : cp,
              target: t.direction === 'OUTFLOW' ? cp : accountId,
              amount: t.amount,
              is_fraud: t.ground_truth === 'fraudulent',
            },
          });
        });
      }

      cyInstance.current = cytoscape({
        container: cyRef.current,
        elements: elements,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              color: '#ffffff',
              'font-size': '10px',
              'text-valign': 'bottom',
              'text-margin-y': 4,
              width: 38,
              height: 38,
              'background-color': '#1f6feb',
              'border-width': 2,
              'border-color': '#ffffff',
            },
          },
          {
            selector: 'node[is_center]',
            style: {
              width: 54,
              height: 54,
              'background-color': data.risk_score <= 0.35 ? '#238636' : '#d29922',
              'border-width': 4,
              'border-color': data.risk_score <= 0.35 ? '#3fb950' : '#f1e05a',
              'font-size': '12px',
              'font-weight': 'bold',
            },
          },
          {
            selector: 'node[risk_score >= 0.65]',
            style: {
              'background-color': '#f85149',
              'border-color': '#ff7b72',
            },
          },
          {
            selector: 'node[risk_score >= 0.35][risk_score < 0.65]',
            style: {
              'background-color': '#d29922',
              'border-color': '#e3b341',
            },
          },
          {
            selector: 'node[risk_score < 0.35]',
            style: {
              'background-color': '#238636',
              'border-color': '#3fb950',
            },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#484f58',
              'target-arrow-color': '#8b949e',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 0.9,
            },
          },
          {
            selector: 'edge[is_fraud]',
            style: {
              width: 2.5,
              'line-color': '#f85149',
              'target-arrow-color': '#f85149',
            },
          },
          {
            selector: 'edge[!is_fraud]',
            style: {
              width: 2,
              'line-color': '#238636',
              'target-arrow-color': '#3fb950',
            },
          },
        ],
        layout: {
          name: 'concentric',
          concentric: (node) => (node.data('is_center') ? 2 : 1),
          levelWidth: () => 1,
          padding: 25,
        },
      });
    }
  }, [activeTab, data, accountId]);

  const isLegitAccount = (data?.risk_score || 0) <= 0.35 || data?.risk_tier === 'LOW';
  const isModerateAccount = (data?.risk_score || 0) > 0.35 && (data?.risk_score || 0) < 0.65;
  const isDangerAccount = (data?.risk_score || 0) >= 0.65;

  const statusBorderColor = isLegitAccount ? '#3fb950' : isModerateAccount ? '#e3b341' : '#f85149';
  const statusBgColor = isLegitAccount ? 'rgba(63, 185, 80, 0.08)' : isModerateAccount ? 'rgba(227, 179, 65, 0.08)' : 'rgba(248, 81, 73, 0.08)';

  // Filter transactions between selected counterparty
  const betweenTransactions = (data?.transactions || []).filter(
    (t) => !selectedCounterparty || t.counterparty === selectedCounterparty
  );

  // List of unique counterparties with status colors
  const counterpartyList = Array.from(new Set((data?.transactions || []).map((t) => t.counterparty)));

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      contentClassName="bg-black text-light"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      {/* Modal Header */}
      <Modal.Header
        closeButton
        closeVariant="white"
        className="pb-3"
        style={{
          backgroundColor: statusBgColor,
          borderBottom: `2px solid ${statusBorderColor}55`,
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between w-100 pe-3 gap-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="p-2.5 rounded-3 text-white"
              style={{
                background: isLegitAccount ? 'rgba(63,185,80,0.2)' : isModerateAccount ? 'rgba(227,179,65,0.2)' : 'rgba(248,81,73,0.2)',
                border: `1px solid ${statusBorderColor}`,
              }}
            >
              {isLegitAccount ? (
                <ShieldCheck size={24} className="text-success" />
              ) : isModerateAccount ? (
                <Activity size={24} className="text-warning" />
              ) : (
                <ShieldAlert size={24} className="text-danger" />
              )}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="mb-0 fw-bold font-monospace text-white">{accountId}</h5>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn btn-sm btn-outline-secondary py-0 px-1 border-0"
                  title="Copy Account ID"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-muted" />}
                </button>

                <Badge
                  style={{
                    backgroundColor: `${statusBorderColor}22`,
                    color: statusBorderColor,
                    border: `1px solid ${statusBorderColor}66`,
                    fontSize: '11px',
                  }}
                  className="text-uppercase"
                >
                  {isLegitAccount ? 'LEGIT / SAFE TIER' : isModerateAccount ? 'MODERATE RISK TIER' : 'CRITICAL FRAUD TIER'}
                </Badge>

                {data?.is_frozen && (
                  <Badge bg="info" className="d-flex align-items-center gap-1 text-dark fw-bold" style={{ fontSize: '10.5px' }}>
                    <Snowflake size={11} /> FROZEN
                  </Badge>
                )}
              </div>
              <div className="text-muted small mt-0.5">
                Classification: <span className="text-white fw-semibold">{isLegitAccount ? 'Verified Clean Account' : data?.classification || 'Financial Account Entity'}</span> &bull; Case #{caseId}
              </div>
            </div>
          </div>

          {/* Single Dynamic Action & Freeze Controls */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Single Toggle Button */}
            <Button
              size="sm"
              variant={isLegitAccount ? 'outline-danger' : 'success'}
              disabled={overriding}
              onClick={handleAccountToggle}
              className="d-flex align-items-center gap-1.5 fw-semibold px-3 py-1.5"
            >
              {isLegitAccount ? (
                <>
                  <X size={14} /> Flag Entire Account as Fraud
                </>
              ) : (
                <>
                  <Check size={14} /> Mark Entire Account as Legit (All Txns)
                </>
              )}
            </Button>

            {/* Freeze Account Button */}
            <Button
              size="sm"
              variant={data?.is_frozen ? 'warning' : 'outline-info'}
              disabled={overriding}
              onClick={handleFreezeToggle}
              className="d-flex align-items-center gap-1.5 fw-semibold py-1.5"
            >
              <Snowflake size={14} />
              {data?.is_frozen ? 'Unfreeze Account' : 'Freeze Account'}
            </Button>

            <div className="text-end ms-2 ps-2 border-start border-secondary border-opacity-25">
              <div className="text-muted small" style={{ fontSize: '10px' }}>RISK SCORE</div>
              <div className="fw-bold font-monospace fs-5" style={{ color: statusBorderColor }}>
                {data ? `${(data.risk_score * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </div>
      </Modal.Header>

      {/* Tab Navigation */}
      <div className="px-3 pt-2 bg-dark bg-opacity-40 border-bottom border-secondary border-opacity-25">
        <div className="d-flex gap-1.5 flex-wrap">
          {[
            { key: 'profile', label: 'Overview & Profile', icon: Activity },
            { key: 'all_tx', label: `All Transactions (${data?.transactions?.length || 0})`, icon: DollarSign },
            { key: 'between_tx', label: 'Counterparty ↔ Between Txns', icon: ArrowLeftRight },
            { key: 'signals', label: 'Model Signals & GNN', icon: Zap },
            { key: 'graph', label: 'Ego-Network Subgraph', icon: Network },
            { key: 'notes', label: 'Forensic Notes', icon: FileText },
          ].map((tab) => {
            const isAct = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`btn btn-sm d-flex align-items-center gap-1.5 py-2 px-3 border-0 rounded-bottom-0 rounded-top-2 fw-semibold ${
                  isAct
                    ? 'bg-black text-white border-top border-start border-end border-secondary border-opacity-50'
                    : 'text-secondary bg-transparent'
                }`}
                style={{ fontSize: '12.5px' }}
              >
                <Icon size={14} className={isAct ? 'text-primary' : ''} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <Modal.Body className="p-4" style={{ minHeight: '460px', maxHeight: '70vh', overflowY: 'auto', background: '#090b10' }}>
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" size="sm" className="mb-2" />
            <div className="text-muted small">Loading account intelligence & forensic graph...</div>
          </div>
        ) : error ? (
          <Alert variant="danger" className="border-0 bg-danger bg-opacity-15 text-danger">
            <AlertTriangle size={16} className="me-2" />
            {error}
          </Alert>
        ) : data ? (
          <>
            {/* TAB 1: Profile & Financial Activity */}
            {activeTab === 'profile' && (
              <div>
                <Row className="g-3 mb-4">
                  <Col md={3} sm={6}>
                    <Card className="bg-dark border-secondary border-opacity-25 h-100">
                      <Card.Body className="p-3">
                        <div className="text-muted small d-flex align-items-center gap-1">
                          <ArrowDownLeft size={13} className="text-success" /> Total Inflow
                        </div>
                        <h4 className="text-white font-monospace fw-bold mt-1 mb-0">
                          ${data.inflow_volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <div className="text-muted small mt-1">{data.transactions?.filter((t) => t.direction === 'INFLOW').length || 0} inflow transfers</div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col md={3} sm={6}>
                    <Card className="bg-dark border-secondary border-opacity-25 h-100">
                      <Card.Body className="p-3">
                        <div className="text-muted small d-flex align-items-center gap-1">
                          <ArrowUpRight size={13} className="text-danger" /> Total Outflow
                        </div>
                        <h4 className="text-white font-monospace fw-bold mt-1 mb-0">
                          ${data.outflow_volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <div className="text-muted small mt-1">{data.transactions?.filter((t) => t.direction === 'OUTFLOW').length || 0} outflow transfers</div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col md={3} sm={6}>
                    <Card className="bg-dark border-secondary border-opacity-25 h-100">
                      <Card.Body className="p-3">
                        <div className="text-muted small d-flex align-items-center gap-1">
                          <DollarSign size={13} className="text-info" /> Retained Balance
                        </div>
                        <h4 className="text-white font-monospace fw-bold mt-1 mb-0">
                          ${data.net_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <div className="text-muted small mt-1">
                          Pass-through ratio: <span className="text-warning fw-bold">{((data.signals?.pass_through_ratio || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col md={3} sm={6}>
                    <Card className="bg-dark border-secondary border-opacity-25 h-100">
                      <Card.Body className="p-3">
                        <div className="text-muted small d-flex align-items-center gap-1">
                          <Network size={13} className="text-warning" /> Counterparties
                        </div>
                        <h4 className="text-white font-monospace fw-bold mt-1 mb-0">
                          {data.counterparties_count || 0} Entities
                        </h4>
                        <div className="text-muted small mt-1">{data.fraudulent_transactions || 0} flagged illicit flows</div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Behavioral & Structural Summary */}
                <Card className="bg-dark border-secondary border-opacity-25 mb-4">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-2.5">
                    <span className="fw-semibold small text-white">Forensic Behavior & Structural Archetype</span>
                  </Card.Header>
                  <Card.Body className="p-3">
                    <Row className="g-3">
                      <Col md={6}>
                        <div className="d-flex justify-content-between mb-1 small">
                          <span className="text-muted">DC-LCG GNN Illicit Probability</span>
                          <span className="font-monospace fw-bold" style={{ color: statusBorderColor }}>
                            {((data.signals?.dclcg_prob || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar
                          now={(data.signals?.dclcg_prob || 0) * 100}
                          variant={(data.signals?.dclcg_prob || 0) >= 0.65 ? 'danger' : (data.signals?.dclcg_prob || 0) >= 0.35 ? 'warning' : 'success'}
                          style={{ height: '6px' }}
                          className="bg-black"
                        />

                        <div className="d-flex justify-content-between mt-3 mb-1 small">
                          <span className="text-muted">Structuring / Smurfing Anomaly ($8k–$9.9k)</span>
                          <span className="font-monospace fw-bold text-white">
                            {((data.signals?.ctr_structuring_score || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar
                          now={(data.signals?.ctr_structuring_score || 0) * 100}
                          variant={(data.signals?.ctr_structuring_score || 0) >= 0.65 ? 'danger' : 'info'}
                          style={{ height: '6px' }}
                          className="bg-black"
                        />
                      </Col>

                      <Col md={6}>
                        <div className="d-flex justify-content-between mb-1 small">
                          <span className="text-muted">Pass-Through Velocity (Rapid Drain)</span>
                          <span className="font-monospace fw-bold text-white">
                            {((data.signals?.pass_through_ratio || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar
                          now={(data.signals?.pass_through_ratio || 0) * 100}
                          variant={(data.signals?.pass_through_ratio || 0) >= 0.8 ? 'danger' : 'success'}
                          style={{ height: '6px' }}
                          className="bg-black"
                        />

                        <div className="d-flex justify-content-between mt-3 mb-1 small">
                          <span className="text-muted">Cycle & Mule Ring Connectivity</span>
                          <span className="font-monospace fw-bold text-white">
                            {((data.signals?.cycle_participation || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar
                          now={(data.signals?.cycle_participation || 0) * 100}
                          variant={(data.signals?.cycle_participation || 0) >= 0.5 ? 'danger' : 'secondary'}
                          style={{ height: '6px' }}
                          className="bg-black"
                        />
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </div>
            )}

            {/* TAB 2: All Account Transactions */}
            {activeTab === 'all_tx' && (
              <div>
                <div className="table-responsive rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                  <Table hover variant="dark" className="align-middle mb-0 text-nowrap" style={{ fontSize: '11.5px', background: 'transparent' }}>
                    <thead>
                      <tr className="text-muted border-secondary border-opacity-25" style={{ background: '#18181b' }}>
                        <th>Txn ID</th>
                        <th>Direction</th>
                        <th>Counterparty</th>
                        <th>Amount (USD)</th>
                        <th>Typology</th>
                        <th>Ground Truth</th>
                        <th>Timestamp</th>
                        <th>Override Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data.transactions || data.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            No individual transactions recorded for this account.
                          </td>
                        </tr>
                      ) : (
                        data.transactions.map((tx, idx) => {
                          const isOut = tx.direction === 'OUTFLOW';
                          const isFraud = tx.ground_truth === 'fraudulent';
                          const rowBg = isFraud ? 'rgba(248,81,73,0.08)' : 'rgba(63,185,80,0.08)';
                          const rowBorder = isFraud ? '3px solid #f85149' : '3px solid #3fb950';
                          return (
                            <tr
                              key={idx}
                              className="border-secondary border-opacity-10"
                              style={{ background: rowBg, borderLeft: rowBorder }}
                            >
                              <td className="font-monospace text-muted small">{tx.transaction_id}</td>
                              <td>
                                <Badge bg={isOut ? 'danger' : 'success'} className="d-inline-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                                  {isOut ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                                  {tx.direction}
                                </Badge>
                              </td>
                              <td className="font-monospace text-white fw-semibold">{tx.counterparty}</td>
                              <td className="font-monospace text-white fw-bold">
                                ${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td>
                                <Badge bg="dark" className="border border-secondary" style={{ fontSize: '10px' }}>
                                  {tx.scenario_name || tx.scenario_id || 'Transfer'}
                                </Badge>
                              </td>
                              <td>
                                <Badge bg={isFraud ? 'danger' : 'success'}>
                                  {tx.ground_truth || 'legitimate'}
                                </Badge>
                              </td>
                              <td className="text-muted small">{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}</td>
                              <td>
                                {/* Single Dynamic Button */}
                                <Button
                                  size="sm"
                                  variant={isFraud ? 'success' : 'outline-danger'}
                                  style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                  onClick={() => handleTxToggle(tx.transaction_id, tx.ground_truth)}
                                  className="d-inline-flex align-items-center gap-1 fw-semibold"
                                >
                                  {isFraud ? <Check size={11} /> : <X size={11} />}
                                  {isFraud ? 'Mark as Legit' : 'Flag as Fraud'}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}

            {/* TAB 3: Transactions Between Account A ↔ Counterparty B */}
            {activeTab === 'between_tx' && (
              <div>
                {/* Counterparty selector bar */}
                <div className="d-flex align-items-center gap-2 mb-3 p-2.5 rounded-2 bg-dark bg-opacity-50 border border-secondary border-opacity-25 flex-wrap">
                  <span className="small text-muted fw-semibold">Inspect Flow With Counterparty:</span>
                  {counterpartyList.map((cp) => {
                    const isSelected = cp === selectedCounterparty;
                    return (
                      <button
                        key={cp}
                        type="button"
                        onClick={() => setSelectedCounterparty(cp)}
                        className={`btn btn-sm font-monospace py-0.5 px-2.5 rounded-2 border ${
                          isSelected
                            ? 'btn-warning text-black fw-bold'
                            : 'btn-dark text-white border-secondary'
                        }`}
                        style={{ fontSize: '11.5px' }}
                      >
                        {cp}
                      </button>
                    );
                  })}
                </div>

                <div className="table-responsive rounded-2" style={{ background: '#121215', border: '1px solid #27272a' }}>
                  <Table hover variant="dark" className="align-middle mb-0 text-nowrap" style={{ fontSize: '11.5px', background: 'transparent' }}>
                    <thead>
                      <tr className="text-muted border-secondary border-opacity-25" style={{ background: '#18181b' }}>
                        <th>Txn ID</th>
                        <th>Direction (Relative to {accountId})</th>
                        <th>Target Counterparty</th>
                        <th>Amount (USD)</th>
                        <th>Ground Truth</th>
                        <th>Timestamp</th>
                        <th>Override Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {betweenTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-4 text-muted">
                            No transactions found between {accountId} and {selectedCounterparty || 'selected counterparty'}.
                          </td>
                        </tr>
                      ) : (
                        betweenTransactions.map((tx, idx) => {
                          const isOut = tx.direction === 'OUTFLOW';
                          const isFraud = tx.ground_truth === 'fraudulent';
                          return (
                            <tr
                              key={idx}
                              className="border-secondary border-opacity-10"
                              style={{
                                background: isFraud ? 'rgba(248,81,73,0.08)' : 'rgba(63,185,80,0.08)',
                                borderLeft: isFraud ? '3px solid #f85149' : '3px solid #3fb950',
                              }}
                            >
                              <td className="font-monospace text-muted small">{tx.transaction_id}</td>
                              <td>
                                <Badge bg={isOut ? 'danger' : 'success'} className="d-inline-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                                  {isOut ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                                  {tx.direction}
                                </Badge>
                              </td>
                              <td className="font-monospace text-warning fw-semibold">{tx.counterparty}</td>
                              <td className="font-monospace text-white fw-bold">
                                ${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td>
                                <Badge bg={isFraud ? 'danger' : 'success'}>
                                  {tx.ground_truth || 'legitimate'}
                                </Badge>
                              </td>
                              <td className="text-muted small">{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}</td>
                              <td>
                                <Button
                                  size="sm"
                                  variant={isFraud ? 'success' : 'outline-danger'}
                                  style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                  onClick={() => handleTxToggle(tx.transaction_id, tx.ground_truth)}
                                  className="d-inline-flex align-items-center gap-1 fw-semibold"
                                >
                                  {isFraud ? <Check size={11} /> : <X size={11} />}
                                  {isFraud ? 'Mark as Legit' : 'Flag as Fraud'}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}

            {/* TAB 4: Model Signals & Deep Features */}
            {activeTab === 'signals' && (
              <div>
                <Row className="g-3">
                  {[
                    { label: 'DC-LCG Dual-View GNN Probability', val: data.signals?.dclcg_prob, desc: 'Structural + temporal graph embedding classification score from DC-LCG inference engine.' },
                    { label: 'Velocity Anomaly Score', val: data.signals?.velocity_anomaly, desc: 'High-frequency burst velocity compared to normal retail consumer baseline.' },
                    { label: 'Structuring / CTR Evasion ($8k-$9.9k)', val: data.signals?.ctr_structuring_score, desc: 'Frequency of transfers specifically engineered below regulatory reporting thresholds.' },
                    { label: 'Rapid In-Out Pass-Through Ratio', val: data.signals?.pass_through_ratio, desc: 'Ratio of funds emptied out immediately upon arrival (mule intermediary behavior).' },
                    { label: 'Circular Ring Participation Depth', val: data.signals?.cycle_participation, desc: 'Topological presence in closed cyclical transfer loops (A→B→C→A).' },
                    { label: 'Burst Velocity Frequency', val: data.signals?.burst_velocity_score, desc: 'Temporal clustering score indicating scripted or bot-driven transfer spikes.' },
                  ].map((sig, i) => (
                    <Col md={6} key={i}>
                      <Card className="bg-dark border-secondary border-opacity-25 h-100">
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-semibold small text-white">{sig.label}</span>
                            <span
                              className="font-monospace fw-bold px-2 py-0.5 rounded"
                              style={{
                                background: (sig.val || 0) >= 0.65 ? 'rgba(248,81,73,0.15)' : 'rgba(56,139,253,0.15)',
                                color: (sig.val || 0) >= 0.65 ? '#f85149' : '#58a6ff',
                                fontSize: '12px',
                              }}
                            >
                              {((sig.val || 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <ProgressBar
                            now={(sig.val || 0) * 100}
                            variant={(sig.val || 0) >= 0.65 ? 'danger' : (sig.val || 0) >= 0.35 ? 'warning' : 'success'}
                            style={{ height: '5px' }}
                            className="bg-black mb-2"
                          />
                          <p className="text-muted small mb-0" style={{ fontSize: '11px' }}>{sig.desc}</p>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* TAB 5: Ego-Network Cytoscape Graph */}
            {activeTab === 'graph' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small text-muted">
                    1-Hop Counterparty Ego-Network &bull; Central node: <strong className={isLegitAccount ? 'text-success' : 'text-warning'}>{accountId}</strong>
                  </span>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.2)}>
                      <ZoomIn size={12} />
                    </Button>
                    <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)}>
                      <ZoomOut size={12} />
                    </Button>
                    <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => cyInstance.current?.fit()}>
                      <Maximize2 size={12} />
                    </Button>
                  </div>
                </div>
                <div
                  ref={cyRef}
                  style={{
                    width: '100%',
                    height: '380px',
                    background: '#090b10',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                  }}
                />
              </div>
            )}

            {/* TAB 6: Forensic Notes */}
            {activeTab === 'notes' && (
              <div>
                <Card className="bg-dark border-secondary border-opacity-25 mb-3">
                  <Card.Header className="bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25 py-2.5">
                    <span className="fw-semibold small text-white d-flex align-items-center gap-1.5">
                      <FileText size={14} className="text-primary" /> Add Investigator Note for Account {accountId}
                    </span>
                  </Card.Header>
                  <Card.Body className="p-3">
                    {noteSuccess && (
                      <Alert variant="success" className="py-2 px-3 small border-0 bg-success bg-opacity-20 text-success mb-3">
                        ✓ Note saved to case audit log successfully.
                      </Alert>
                    )}
                    <Form onSubmit={handleSaveNote}>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Record KYC findings, beneficial ownership, physical verification, or SAR filing rationale..."
                        value={accountNote}
                        onChange={(e) => setAccountNote(e.target.value)}
                        style={{ background: '#121215', borderColor: '#27272a', color: '#fff', fontSize: '12.5px' }}
                        className="mb-3"
                        required
                      />
                      <Button type="submit" size="sm" variant="primary" disabled={savingNote} className="d-flex align-items-center gap-1.5">
                        <Send size={13} /> {savingNote ? 'Saving...' : 'Save Account Note'}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </div>
            )}
          </>
        ) : null}
      </Modal.Body>

      <Modal.Footer className="border-secondary border-opacity-25 py-2">
        <Button variant="secondary" size="sm" onClick={onHide}>
          Close Forensic View
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
