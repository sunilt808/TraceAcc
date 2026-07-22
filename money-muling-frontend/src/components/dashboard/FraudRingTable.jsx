import React from 'react';
import { Table, Card, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { InfoCircle } from 'react-bootstrap-icons';

const FraudRingTable = ({ rings = [], onRingClick }) => {
  // Helper to extract numeric ID from RING_XXXX
  const extractRingNumber = (ringId) => {
    if (!ringId) return '';
    const match = ringId.match(/\d+/);
    return match ? match[0] : ringId;
  };

  // Format member accounts for display (truncate if too long)
  const formatMembers = (members) => {
    if (!members || members.length === 0) return '—';
    const display = members.join(', ');
    return display.length > 30 ? display.substring(0, 27) + '...' : display;
  };

  // Get badge variant based on risk score with more nuance
  const getRiskVariant = (score) => {
    if (score >= 80) return 'danger';
    if (score >= 60) return 'warning';
    if (score >= 40) return 'info';
    return 'secondary';
  };

  // Get badge color for pattern type
  const getPatternBadge = (pattern) => {
    switch(pattern) {
      case 'cycle': return 'primary';
      case 'fan': return 'success';
      case 'layered': return 'warning';
      default: return 'secondary';
    }
  };

  // Tooltip content for full member list
  const renderMemberTooltip = (members) => (
    <Tooltip id="member-tooltip">
      <div style={{ maxWidth: '250px', wordWrap: 'break-word' }}>
        {members?.join(', ') || 'None'}
      </div>
    </Tooltip>
  );

  return (
    <Card className="h-100 bg-dark border-secondary">
      <Card.Header className="bg-darker text-light border-secondary py-2 d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-semibold">FRAUD RINGS DETECTED</h6>
        {rings.length > 0 && (
          <Badge bg="info" pill>
            {rings.length} {rings.length === 1 ? 'ring' : 'rings'}
          </Badge>
        )}
      </Card.Header>
      <Card.Body className="p-0 overflow-auto" style={{ maxHeight: 'calc(100% - 45px)' }}>
        <Table hover variant="dark" className="mb-0" size="sm">
          <thead className="sticky-top bg-darker" style={{ top: 0 }}>
            <tr>
              <th className="text-muted fw-normal">ID</th>
              <th className="text-muted fw-normal">Pattern</th>
              <th className="text-muted fw-normal text-end">Members</th>
              <th className="text-muted fw-normal text-end">Risk Score</th>
              <th className="text-muted fw-normal">Accounts</th>
            </tr>
          </thead>
          <tbody>
            {rings.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted py-4">
                  No fraud rings detected yet
                </td>
              </tr>
            ) : (
              rings.map((ring) => (
                <tr
                  key={ring.ring_id}
                  onClick={() => onRingClick && onRingClick(ring.ring_id)}
                  style={{ cursor: onRingClick ? 'pointer' : 'default' }}
                  className="ring-row"
                >
                  <td className="text-light">{extractRingNumber(ring.ring_id)}</td>
                  <td>
                    <Badge 
                      bg={getPatternBadge(ring.pattern_type)} 
                      className="text-uppercase" 
                      style={{ fontSize: '0.7rem' }}
                    >
                      {ring.pattern_type}
                    </Badge>
                  </td>
                  <td className="text-light text-end fw-medium">{ring.member_accounts?.length || 0}</td>
                  <td className="text-end">
                    <Badge bg={getRiskVariant(ring.risk_score)}>
                      {ring.risk_score?.toFixed(1)}
                    </Badge>
                  </td>
                  <td className="text-light small">
                    <div className="d-flex align-items-center">
                      <span className="me-1">{formatMembers(ring.member_accounts)}</span>
                      {ring.member_accounts?.length > 0 && (
                        <OverlayTrigger
                          placement="top"
                          overlay={renderMemberTooltip(ring.member_accounts)}
                        >
                          <InfoCircle size={12} className="text-muted" style={{ cursor: 'help' }} />
                        </OverlayTrigger>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default FraudRingTable;