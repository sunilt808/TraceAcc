import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Spinner, Card, Form, Button, InputGroup, OverlayTrigger, Tooltip, Modal, Table, Badge } from 'react-bootstrap';
import cytoscape from 'cytoscape';

const ringColors = ['#3182CE', '#DD6B20', '#805AD5', '#38A169', '#D53F8C', '#718096'];

const getRingColor = (ringId) => {
  if (!ringId) return null;
  const hash = ringId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ringColors[hash % ringColors.length];
};

const GraphPanel = ({ elements = [], loading, highlightedRing, transactions = [] }) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'suspicious', 'normal', 'ring', 'burst'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Apply category filter
  const applyFilter = useCallback((cy, category) => {
    if (!cy) return;
    const allNodes = cy.nodes();
    allNodes.show();
    if (category === 'suspicious') {
      cy.nodes('[suspicious != true]').hide();
    } else if (category === 'normal') {
      cy.nodes('[suspicious = true]').hide();
    } else if (category === 'ring') {
      cy.nodes(':not([ring])').hide();
    } else if (category === 'burst') {
      cy.nodes('[burst = true]').show();
      cy.nodes('[burst != true]').hide();
    }
  }, []);

  // Initialize cytoscape
  useEffect(() => {
    if (!containerRef.current || loading || elements.length === 0) return;

    if (cyRef.current) cyRef.current.destroy();

    const enhancedElements = elements.map(el => {
      if (el.data.ring) {
        return {
          ...el,
          data: { ...el.data, ringColor: getRingColor(el.data.ring) }
        };
      }
      return el;
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: enhancedElements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#4A5568',
            'label': 'data(label)',
            'color': '#F7FAFC',
            'font-size': '10px',
            'text-outline-color': '#0A0E1A',
            'text-outline-width': 1,
            'width': (ele) => {
              const score = ele.data('score');
              return score ? 20 + (score / 100) * 20 : 20;
            },
            'height': (ele) => {
              const score = ele.data('score');
              return score ? 20 + (score / 100) * 20 : 20;
            },
          }
        },
        {
          selector: 'node[burst = true]',   // burst style (orange) – applies only if not suspicious (because suspicious style overrides later)
          style: {
            'background-color': '#F39C12',
          }
        },
        {
          selector: 'node[suspicious = true]', // overrides burst if also suspicious
          style: {
            'background-color': '#E53E3E',
            'border-width': 2,
            'border-color': '#FFFFFF',
            'border-opacity': 0.8,
          }
        },
        {
          selector: 'node[ring]',
          style: {
            'border-width': 3,
            'border-color': 'data(ringColor)',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#718096',
            'target-arrow-color': '#718096',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          }
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#FFD700',
            'border-opacity': 1,
            'z-index': 10,
          }
        },
        {
          selector: '.search-match',
          style: {
            'border-width': 4,
            'border-color': '#2F73FF',
            'border-opacity': 1,
            'z-index': 11,
          }
        }
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
    });

    // Hover tooltip
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const data = node.data();
      const pos = node.renderedPosition();
      const content = `
        <strong>Account:</strong> ${data.id}<br/>
        ${data.suspicious ? `<strong>Score:</strong> ${data.score}<br/><strong>Patterns:</strong> ${data.patterns?.join(', ')}` : 'Normal account'}
        ${data.burst && !data.suspicious ? '<br/><strong>Burst activity detected!</strong>' : ''}
      `;
      setTooltip({ visible: true, content, x: pos.x, y: pos.y - 20 });
    });

    cy.on('mouseout', 'node', () => setTooltip({ visible: false, content: '', x: 0, y: 0 }));

    // Click node to show transactions
    cy.on('click', 'node', (evt) => {
      const node = evt.target;
      const nodeData = node.data();
      setSelectedNodeData(nodeData);
      setShowTransactionModal(true);
    });

    cyRef.current = cy;

    const handleResize = () => { cy.resize(); cy.fit(); };
    window.addEventListener('resize', handleResize);

    // Initial filter
    applyFilter(cy, filterCategory);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [elements, loading, applyFilter]);

  // Apply filter when category changes
  useEffect(() => {
    if (!cyRef.current) return;
    applyFilter(cyRef.current, filterCategory);
  }, [filterCategory, applyFilter]);

  // Apply ring highlighting
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.elements().removeClass('highlighted');
    if (highlightedRing) {
      cy.nodes(`[ring = "${highlightedRing}"]`).addClass('highlighted');
    }
  }, [highlightedRing]);

  // Search handler
  const handleSearch = () => {
    if (!cyRef.current || !searchQuery.trim()) return;
    const cy = cyRef.current;
    cy.elements().removeClass('search-match');
    const matches = cy.nodes(`[label *= "${searchQuery}"], [id *= "${searchQuery}"]`);
    if (matches.length > 0) {
      matches.addClass('search-match');
      cy.fit(matches, 50);
    } else {
      alert('No matching account found');
    }
  };

  // Reset search and filter
  const handleReset = () => {
    setSearchQuery('');
    setFilterCategory('all');
    if (cyRef.current) {
      cyRef.current.elements().removeClass('search-match');
      applyFilter(cyRef.current, 'all');
    }
  };

  // Zoom controls
  const zoomIn = () => {
    if (!cyRef.current) return;
    cyRef.current.zoom(cyRef.current.zoom() * 1.2);
  };

  const zoomOut = () => {
    if (!cyRef.current) return;
    cyRef.current.zoom(cyRef.current.zoom() / 1.2);
  };

  const fitGraph = () => {
    if (!cyRef.current) return;
    cyRef.current.fit();
  };

  // Full-screen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Filter transactions for the selected node
  const nodeTransactions = selectedNodeData?.id
    ? transactions.filter(tx => tx.sender_id === selectedNodeData.id || tx.receiver_id === selectedNodeData.id)
    : [];

  return (
    <>
      <Card className={`h-100 bg-dark border-secondary position-relative ${isFullscreen ? 'fullscreen-graph' : ''}`}>
        <Card.Body className="p-0 position-relative h-100">
          <div ref={containerRef} className="w-100 h-100" style={{ minHeight: '400px' }} />

          {loading && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75">
              <Spinner animation="border" variant="primary" />
              <span className="ms-2 text-light">Building graph...</span>
            </div>
          )}

          {tooltip.visible && (
            <div
              className="position-absolute bg-dark text-light p-2 rounded border border-secondary shadow"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
                zIndex: 1000,
                fontSize: '0.875rem',
                maxWidth: '200px',
              }}
              dangerouslySetInnerHTML={{ __html: tooltip.content }}
            />
          )}

          {/* Control Panel */}
          <div className="position-absolute top-0 end-0 m-3 p-2 bg-darker rounded border border-secondary shadow" style={{ minWidth: '240px', zIndex: 500 }}>
            <InputGroup size="sm" className="mb-2">
              <Form.Control
                type="text"
                placeholder="Search account ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-dark text-light border-secondary"
              />
              <Button variant="primary" onClick={handleSearch} size="sm">Go</Button>
            </InputGroup>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="text-light small mb-0">Filter:</Form.Label>
              <Form.Select
                size="sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-dark text-light border-secondary"
                style={{ width: '130px' }}
              >
                <option value="all">All</option>
                <option value="suspicious">Suspicious</option>
                <option value="normal">Normal</option>
                <option value="ring">Ringed</option>
                <option value="burst">Burst</option>
              </Form.Select>
            </div>

            <div className="d-flex justify-content-between mb-2">
              <Button variant="outline-secondary" size="sm" onClick={zoomOut}>−</Button>
              <Button variant="outline-secondary" size="sm" onClick={fitGraph}>⤢</Button>
              <Button variant="outline-secondary" size="sm" onClick={zoomIn}>+</Button>
              <OverlayTrigger
                placement="bottom"
                overlay={<Tooltip id="fullscreen-tooltip">Full screen</Tooltip>}
              >
                <Button variant="outline-secondary" size="sm" onClick={toggleFullscreen}>
                  ⛶
                </Button>
              </OverlayTrigger>
            </div>

            <Button variant="outline-warning" size="sm" onClick={handleReset} className="w-100">
              Reset
            </Button>
          </div>

          {/* Legend (bottom left) */}
          <div className="position-absolute bottom-0 start-0 m-3 p-2 bg-dark bg-opacity-75 rounded border border-secondary">
            <div className="d-flex align-items-center mb-1">
              <span className="d-inline-block me-2" style={{ width: '12px', height: '12px', backgroundColor: '#4A5568', borderRadius: '50%' }}></span>
              <span className="text-light small">Normal</span>
            </div>
            <div className="d-flex align-items-center mb-1">
              <span className="d-inline-block me-2" style={{ width: '12px', height: '12px', backgroundColor: '#F39C12', borderRadius: '50%' }}></span>
              <span className="text-light small">Burst</span>
            </div>
            <div className="d-flex align-items-center mb-1">
              <span className="d-inline-block me-2" style={{ width: '12px', height: '12px', backgroundColor: '#E53E3E', borderRadius: '50%', border: '1px solid white' }}></span>
              <span className="text-light small">Suspicious</span>
            </div>
            <div className="d-flex align-items-center">
              <span className="d-inline-block me-2" style={{ width: '12px', height: '12px', backgroundColor: 'transparent', borderRadius: '50%', border: '2px solid #3182CE' }}></span>
              <span className="text-light small">Ring border</span>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Transaction Details Modal */}
      <Modal show={showTransactionModal} onHide={() => setShowTransactionModal(false)} size="lg" centered className="text-light">
        <Modal.Header closeButton className="bg-darker border-secondary">
          <Modal.Title className="d-flex align-items-center">
            <span>Transactions for Account: {selectedNodeData?.id}</span>
            {selectedNodeData && (
              <Badge 
                bg={
                  selectedNodeData.suspicious ? 'danger' : 
                  selectedNodeData.burst ? 'warning' : 
                  'secondary'
                }
                className="ms-2"
              >
                {selectedNodeData.suspicious ? 'Suspicious' : 
                 selectedNodeData.burst ? 'Burst' : 
                 'Normal'}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark border-secondary">
          {nodeTransactions.length === 0 ? (
            <p className="text-muted">No transactions found for this account.</p>
          ) : (
            <Table striped bordered hover variant="dark" size="sm">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Amount</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {nodeTransactions.map((tx, idx) => (
                  <tr key={idx}>
                    <td>{tx.transaction_id}</td>
                    <td>{tx.sender_id}</td>
                    <td>{tx.receiver_id}</td>
                    <td>{tx.amount}</td>
                    <td>{tx.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-darker border-secondary">
          <Button variant="secondary" onClick={() => setShowTransactionModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default GraphPanel;