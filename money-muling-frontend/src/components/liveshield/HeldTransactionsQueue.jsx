import React, { useState } from 'react';
import { Card, Table, Badge, Button, Modal, Form, Spinner } from 'react-bootstrap';
import { UserCheck, CheckCircle, XCircle, Clock, ShieldAlert, Eye, Search, AlertCircle } from 'lucide-react';
import liveshieldApi from '../../services/liveshieldApi';

export default function HeldTransactionsQueue({
  simulationId,
  heldTransactions = [],
  onRefresh,
  onInspectTransaction,
}) {
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [actionType, setActionType] = useState(null); // 'MANUAL_APPROVE' | 'MANUAL_REJECT'
  const [operatorNotes, setOperatorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleOpenActionModal = (txn, action) => {
    setSelectedTxn(txn);
    setActionType(action);
    setOperatorNotes('');
    setErrorMsg(null);
  };

  const handleCloseModal = () => {
    setSelectedTxn(null);
    setActionType(null);
    setOperatorNotes('');
    setErrorMsg(null);
  };

  const handleSubmitOverride = async () => {
    if (!selectedTxn || !actionType) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const txnId = selectedTxn.transaction_id;
      await liveshieldApi.overrideHeldDecision(
        simulationId,
        txnId,
        actionType,
        operatorNotes || `Manual ${actionType === 'MANUAL_APPROVE' ? 'approval' : 'rejection'} by operator`
      );

      handleCloseModal();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to override held transaction:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit override decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const txnsList = Array.isArray(heldTransactions) ? heldTransactions : [];

  const filtered = txnsList.filter((t) => {
    if (!t) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.transaction_id?.toLowerCase().includes(term) ||
      t.sender_account?.toLowerCase().includes(term) ||
      t.receiver_account?.toLowerCase().includes(term) ||
      t.scenario_id?.toLowerCase().includes(term)
    );
  });

  return (
    <Card className="bg-dark border-secondary border-opacity-25 text-light shadow-sm mb-4">
      <Card.Header className="bg-secondary bg-opacity-10 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between py-3">
        <div className="d-flex align-items-center gap-2">
          <UserCheck size={18} className="text-warning" />
          <span className="fw-semibold">Assisted Mode: Held Transactions Queue</span>
          <Badge bg="warning" className="text-dark ms-2">
            {txnsList.length} PENDING REVIEW
          </Badge>
        </div>
        <div className="d-flex align-items-center gap-2" style={{ maxWidth: '300px' }}>
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-dark border-secondary border-opacity-50 text-secondary">
              <Search size={14} />
            </span>
            <Form.Control
              type="text"
              placeholder="Search held txns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark text-light border-secondary border-opacity-50 form-control-sm"
            />
          </div>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {filtered.length === 0 ? (
          <div className="text-center py-5 text-secondary">
            <CheckCircle size={40} className="text-success mb-2 opacity-50" />
            <div className="fw-semibold">No transactions currently held for review</div>
            <div className="small">All transactions in Assisted Mode have been processed or approved.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover variant="dark" className="align-middle mb-0 text-nowrap" style={{ fontSize: '0.85rem' }}>
              <thead className="bg-secondary bg-opacity-20 text-secondary">
                <tr>
                  <th>Transaction ID</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Amount</th>
                  <th>Risk Tier & Score</th>
                  <th>Screening Signals</th>
                  <th>Time Held</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => {
                  const riskScore = parseFloat(txn.combined_risk_score || 0.0);
                  const signals = txn.fast_screening_signals || [];

                  return (
                    <tr key={txn.transaction_id} className="border-bottom border-secondary border-opacity-10">
                      <td>
                        <span className="font-monospace fw-semibold text-primary">{txn.transaction_id}</span>
                        {txn.scenario_id && (
                          <Badge bg="secondary" className="ms-1" style={{ fontSize: '0.65rem' }}>
                            {txn.scenario_id}
                          </Badge>
                        )}
                      </td>
                      <td className="font-monospace text-muted">{txn.sender_account}</td>
                      <td className="font-monospace text-muted">{txn.receiver_account}</td>
                      <td className="fw-bold font-monospace">
                        ${parseFloat(txn.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <Badge
                          bg={
                            txn.risk_tier === 'CRITICAL'
                              ? 'danger'
                              : txn.risk_tier === 'HIGH'
                              ? 'warning'
                              : 'info'
                          }
                          className={txn.risk_tier === 'HIGH' ? 'text-dark' : ''}
                        >
                          {txn.risk_tier} ({(riskScore * 100).toFixed(1)}%)
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '240px' }}>
                          {signals.length === 0 ? (
                            <span className="text-muted small">Heuristic Baseline</span>
                          ) : (
                            signals.slice(0, 2).map((sig, idx) => (
                              <Badge key={idx} bg="secondary" className="bg-opacity-50 text-light fw-normal" style={{ fontSize: '0.68rem' }}>
                                {sig.rule_name || sig.rule_id}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="text-secondary small">
                        <Clock size={12} className="me-1" />
                        {txn.t_decided ? new Date(txn.t_decided).toLocaleTimeString() : 'Just now'}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <Button
                            size="sm"
                            variant="outline-info"
                            onClick={() => onInspectTransaction && onInspectTransaction(txn)}
                            title="Inspect Details"
                            className="py-0 px-2"
                          >
                            <Eye size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleOpenActionModal(txn, 'MANUAL_APPROVE')}
                            className="py-0 px-2 d-flex align-items-center gap-1"
                          >
                            <CheckCircle size={12} /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleOpenActionModal(txn, 'MANUAL_REJECT')}
                            className="py-0 px-2 d-flex align-items-center gap-1"
                          >
                            <XCircle size={12} /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>

      {/* Manual Override Confirmation Modal */}
      <Modal show={!!selectedTxn} onHide={handleCloseModal} centered className="dark-modal">
        <Modal.Header closeButton className="bg-dark text-light border-secondary border-opacity-25">
          <Modal.Title className="d-flex align-items-center gap-2 fs-6">
            {actionType === 'MANUAL_APPROVE' ? (
              <>
                <CheckCircle size={18} className="text-success" />
                <span>Confirm Manual Payment Approval</span>
              </>
            ) : (
              <>
                <XCircle size={18} className="text-danger" />
                <span>Confirm Manual Payment Rejection</span>
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light border-secondary border-opacity-25">
          {errorMsg && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {selectedTxn && (
            <div className="mb-3 p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-25">
              <div className="d-flex justify-content-between mb-1">
                <span className="text-secondary small">Transaction ID:</span>
                <span className="font-monospace fw-bold text-primary">{selectedTxn.transaction_id}</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-secondary small">Amount:</span>
                <span className="font-monospace fw-bold">
                  ${parseFloat(selectedTxn.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-secondary small">Calibrated Risk:</span>
                <span className="fw-bold text-warning">
                  {(parseFloat(selectedTxn.combined_risk_score || 0) * 100).toFixed(1)}% ({selectedTxn.risk_tier})
                </span>
              </div>
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="small text-secondary">Operator Review Notes (Audit Trail)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Provide rationale for override decision..."
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              className="bg-dark text-light border-secondary border-opacity-50"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="bg-dark border-secondary border-opacity-25">
          <Button variant="secondary" size="sm" onClick={handleCloseModal} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={actionType === 'MANUAL_APPROVE' ? 'success' : 'danger'}
            size="sm"
            onClick={handleSubmitOverride}
            disabled={isSubmitting}
            className="d-flex align-items-center gap-2"
          >
            {isSubmitting ? <Spinner size="sm" animation="border" /> : null}
            <span>Confirm {actionType === 'MANUAL_APPROVE' ? 'Approval' : 'Rejection'}</span>
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
