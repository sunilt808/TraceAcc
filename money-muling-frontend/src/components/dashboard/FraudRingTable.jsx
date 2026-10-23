import React from 'react';
import { Table, Card, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Info, AlertTriangle, Users, Layers } from 'lucide-react';

const FraudRingTable = ({ rings = [], onRingClick }) => {
  // Helper to extract numeric ID from RING_XXXX
  const extractRingNumber = (ringId) => {
    if (!ringId) return '';
    const match = ringId.match(/\d+/);
    return match ? match[0] : ringId;
  };

  // Format member accounts for display
  const formatMembers = (members) => {
    if (!members || members.length === 0) return '—';
    const display = members.join(', ');
    return display.length > 24 ? display.substring(0, 22) + '...' : display;
  };

  const renderMemberTooltip = (members) => (
    <Tooltip id="member-tooltip" style={{ fontSize: 11 }}>
      <div style={{ maxWidth: '240px', wordWrap: 'break-word', padding: '2px 4px' }}>
        {members?.join(', ') || 'None'}
      </div>
    </Tooltip>
  );

  return (
    <Card
      className="h-100 shadow-none d-flex flex-column"
      style={{
        backgroundColor: '#000000',
        borderColor: '#1f242c',
        borderRadius: 8,
      }}
    >
      <div
        className="p-3 d-flex justify-content-between align-items-center border-bottom"
        style={{ borderColor: '#1f242c', backgroundColor: '#05070a' }}
      >
        <div className="d-flex align-items-center gap-2">
          <Layers size={14} color="#58a6ff" />
          <span className="text-white fw-bold" style={{ fontSize: 12, letterSpacing: '-0.01em' }}>
            Detected Fraud Rings
          </span>
        </div>
        {rings.length > 0 && (
          <span
            style={{
              padding: '1px 7px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              backgroundColor: 'rgba(56, 139, 253, 0.15)',
              color: '#58a6ff',
              border: '1px solid rgba(56, 139, 253, 0.3)',
            }}
          >
            {rings.length} {rings.length === 1 ? 'ring' : 'rings'}
          </span>
        )}
      </div>

      <Card.Body className="p-0 overflow-auto flex-grow-1" style={{ backgroundColor: '#000000' }}>
        <Table hover className="mb-0 align-middle" style={{ borderColor: '#161b22', backgroundColor: '#000000' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1f242c', backgroundColor: '#05070a' }}>
              <th className="ps-3 py-2 text-secondary small fw-semibold" style={{ fontSize: 10, textTransform: 'uppercase' }}>ID</th>
              <th className="py-2 text-secondary small fw-semibold" style={{ fontSize: 10, textTransform: 'uppercase' }}>Pattern</th>
              <th className="py-2 text-secondary small fw-semibold text-end" style={{ fontSize: 10, textTransform: 'uppercase' }}>Members</th>
              <th className="py-2 text-secondary small fw-semibold text-end" style={{ fontSize: 10, textTransform: 'uppercase' }}>Risk</th>
              <th className="py-2 pe-3 text-secondary small fw-semibold" style={{ fontSize: 10, textTransform: 'uppercase' }}>Accounts</th>
            </tr>
          </thead>
          <tbody>
            {rings.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-secondary py-5" style={{ backgroundColor: '#000000' }}>
                  <AlertTriangle size={24} className="opacity-40 mb-1" />
                  <div className="small">No fraud rings detected</div>
                </td>
              </tr>
            ) : (
              rings.map((ring) => (
                <tr
                  key={ring.ring_id}
                  onClick={() => onRingClick && onRingClick(ring.ring_id)}
                  style={{
                    cursor: onRingClick ? 'pointer' : 'default',
                    borderBottom: '1px solid #161b22',
                    backgroundColor: '#000000',
                    fontSize: 12,
                  }}
                >
                  <td className="ps-3 py-2 text-white font-monospace" style={{ fontSize: 11 }}>
                    #{extractRingNumber(ring.ring_id)}
                  </td>
                  <td className="py-2">
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        backgroundColor: '#161b22',
                        border: '1px solid #30363d',
                        color: '#f0f6fc',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ring.pattern_type || 'CYCLE'}
                    </span>
                  </td>
                  <td className="py-2 text-light text-end fw-medium" style={{ fontSize: 11 }}>
                    {ring.member_accounts?.length || 0}
                  </td>
                  <td className="py-2 text-end">
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor:
                          (ring.risk_score || 0) >= 70
                            ? 'rgba(248, 81, 73, 0.15)'
                            : (ring.risk_score || 0) >= 40
                            ? 'rgba(227, 179, 65, 0.15)'
                            : 'rgba(63, 185, 80, 0.15)',
                        color:
                          (ring.risk_score || 0) >= 70
                            ? '#f85149'
                            : (ring.risk_score || 0) >= 40
                            ? '#e3b341'
                            : '#3fb950',
                      }}
                    >
                      {ring.risk_score?.toFixed(1) || '0.0'}
                    </span>
                  </td>
                  <td className="py-2 pe-3 text-secondary small">
                    <div className="d-flex align-items-center gap-1">
                      <span className="text-light" style={{ fontSize: 11 }}>
                        {formatMembers(ring.member_accounts)}
                      </span>
                      {ring.member_accounts?.length > 0 && (
                        <OverlayTrigger placement="top" overlay={renderMemberTooltip(ring.member_accounts)}>
                          <Info size={11} className="text-secondary opacity-75" style={{ cursor: 'pointer' }} />
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