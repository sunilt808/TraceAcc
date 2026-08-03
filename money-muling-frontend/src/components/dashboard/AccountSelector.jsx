import React, { useState } from 'react';
import { Form, Card, Table } from 'react-bootstrap';

const AccountSelector = ({ analysisResult }) => {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accountData, setAccountData] = useState(null);

  // Build list of account options from suspicious accounts
  const accountOptions = analysisResult?.suspicious_accounts?.map(acc => acc.account_id) || [];

  const handleSelectChange = (e) => {
    const accId = e.target.value;
    setSelectedAccount(accId);

    // Find the account object in analysisResult
    const account = analysisResult?.suspicious_accounts?.find(a => a.account_id === accId);
    setAccountData(account || null);
  };

  return (
    <Card className="p-3 bg-dark text-light mb-3">
      <h5 className="mb-3">Select Account to View Dataset</h5>

      <Form.Select
        value={selectedAccount}
        onChange={handleSelectChange}
        className="mb-3"
      >
        <option value="">-- Select Account --</option>
        {accountOptions.map(acc => (
          <option key={acc} value={acc}>{acc}</option>
        ))}
      </Form.Select>

      {accountData && (
        <div>
          <h6 className="mb-2">Sample Dataset for <strong>{accountData.account_id}</strong></h6>
          <Table striped bordered hover variant="dark" size="sm">
            <thead>
              <tr>
                <th>Account ID</th>
                <th>Suspicion Score</th>
                <th>Detected Patterns</th>
                <th>Associated Rings</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{accountData.account_id}</td>
                <td>{accountData.suspicion_score}</td>
                <td>{accountData.detected_patterns.join(', ')}</td>
                <td>{accountData.ring_ids.join(', ')}</td>
              </tr>
            </tbody>
          </Table>
        </div>
      )}

      {!accountData && selectedAccount && (
        <p className="text-muted">No data available for this account.</p>
      )}
    </Card>
  );
};

export default AccountSelector;
