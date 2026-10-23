import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Spinner, Card, Form, Button, InputGroup, OverlayTrigger, Tooltip, Modal, Table } from 'react-bootstrap';
import { Search, ZoomIn, ZoomOut, Maximize2, RotateCcw, Layers } from 'lucide-react';
import cytoscape from 'cytoscape';

const ringColors = ['#388bfd', '#d29922', '#a371f7', '#3fb950', '#f85149', '#58a6ff'];

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
            'background-color': '#21262d',
            'label': 'data(label)',
            'color': '#c9d1d9',
            'font-size': '10px',
            'font-family': 'Inter, sans-serif',
            'text-outline-color': '#000000',
            'text-outline-width': 1.5,
            'width': (ele) => {
              const score = ele.data('score');
              return score ? 20 + (score / 100) * 18 : 20;
            },
            'height': (ele) => {
              const score = ele.data('score');
              return score ? 20 + (score / 100) * 18 : 20;
            },
            'border-width': 1.5,
            'border-color': '#30363d',
          }
        },
        {
          selector: 'node[burst = true]',
          style: {
            'background-color': '#d29922',
            'border-color': '#e3b341',
          }
        },
        {
          selector: 'node[suspicious = true]',
          style: {
            'background-color': '#f85149',
            'border-width': 2,
            'border-color': '#FFFFFF',
            'border-opacity': 0.9,
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
            'width': 1.5,
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.7,
          }
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#58a6ff',
            'border-opacity': 1,
            'z-index': 10,
          }
        },
        {
          selector: '.search-match',
          style: {
            'border-width': 4,
            'border-color': '#a371f7',
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
      if (cyRef.current && !cyRef.current.destroyed()) {
        cyRef.current.removeAllListeners();
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [elements, loading, applyFilter, filterCategory]);

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
      <Card
        className={`h-100 shadow-none position-relative ${isFullscreen ? 'fullscreen-graph' : ''}`}
        style={{
          backgroundColor: '#000000',
          borderColor: '#1f242c',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Card.Body className="p-0 position-relative h-100" style={{ backgroundColor: '#000000' }}>
          <div ref={containerRef} className="w-100 h-100" style={{ minHeight: '380px', backgroundColor: '#000000' }} />

          {loading && (
            <div
              className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 600 }}
            >
              <Spinner animation="border" size="sm" style={{ color: '#58a6ff' }} />
              <span className="ms-2 text-white small">Synthesizing network topology...</span>
            </div>
          )}

          {tooltip.visible && (
            <div
              className="position-absolute p-2 rounded shadow"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
                zIndex: 1000,
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                maxWidth: '220px',
              }}
              dangerouslySetInnerHTML={{ __html: tooltip.content }}
            />
          )}

          {/* Floating Controls Overlay */}
          <div
            className="position-absolute top-0 end-0 m-3 p-2 rounded shadow"
            style={{
              backgroundColor: '#05070a',
              border: '1px solid #21262d',
              minWidth: '220px',
              zIndex: 500,
            }}
          >
            <InputGroup size="sm" className="mb-2">
              <Form.Control
                type="text"
                placeholder="Search account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{
                  backgroundColor: '#000000',
                  borderColor: '#30363d',
                  color: '#f0f6fc',
                  fontSize: 11,
                }}
              />
              <Button
                variant="outline-secondary"
                onClick={handleSearch}
                size="sm"
                style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
              >
                <Search size={12} />
              </Button>
            </InputGroup>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-secondary small fw-medium" style={{ fontSize: 10, textTransform: 'uppercase' }}>Filter</span>
              <Form.Select
                size="sm"
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  applyFilter(cyRef.current, e.target.value);
                }}
                style={{
                  backgroundColor: '#000000',
                  borderColor: '#30363d',
                  color: '#c9d1d9',
                  fontSize: 11,
                  width: '120px',
                  padding: '2px 8px',
                }}
              >
                <option value="all">All Nodes</option>
                <option value="suspicious">Suspicious</option>
                <option value="normal">Normal</option>
                <option value="ring">In Rings</option>
                <option value="burst">Burst</option>
              </Form.Select>
            </div>

            <div className="d-flex justify-content-between gap-1 mb-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={zoomOut}
                className="flex-grow-1 p-1"
                style={{ backgroundColor: '#000000', borderColor: '#30363d', color: '#c9d1d9' }}
                title="Zoom Out"
              >
                <ZoomOut size={12} />
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={fitGraph}
                className="flex-grow-1 p-1"
                style={{ backgroundColor: '#000000', borderColor: '#30363d', color: '#c9d1d9' }}
                title="Fit to Screen"
              >
                <Layers size={12} />
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={zoomIn}
                className="flex-grow-1 p-1"
                style={{ backgroundColor: '#000000', borderColor: '#30363d', color: '#c9d1d9' }}
                title="Zoom In"
              >
                <ZoomIn size={12} />
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={toggleFullscreen}
                className="flex-grow-1 p-1"
                style={{ backgroundColor: '#000000', borderColor: '#30363d', color: '#c9d1d9' }}
                title="Fullscreen"
              >
                <Maximize2 size={12} />
              </Button>
            </div>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleReset}
              className="w-100 d-flex align-items-center justify-content-center gap-1 py-1"
              style={{
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                color: '#8b949e',
                fontSize: 11,
              }}
            >
              <RotateCcw size={11} />
              <span>Reset View</span>
            </Button>
          </div>

          {/* Legend (bottom left) */}
          <div
            className="position-absolute bottom-0 start-0 m-3 p-2 rounded"
            style={{
              backgroundColor: 'rgba(5, 7, 10, 0.85)',
              border: '1px solid #1f242c',
              fontSize: 11,
              zIndex: 500,
            }}
          >
            <div className="d-flex align-items-center mb-1">
              <span className="d-inline-block me-1.5" style={{ width: 8, height: 8, backgroundColor: '#21262d', borderRadius: '50%', border: '1px solid #30363d' }}></span>
              <span className="text-secondary small" style={{ fontSize: 10 }}>Normal</span>
            </div>
            <div className="d-flex align-items-center mb-1">
              <span className="d-inline-block me-1.5" style={{ width: 8, height: 8, backgroundColor: '#d29922', borderRadius: '50%' }}></span>
              <span className="text-secondary small" style={{ fontSize: 10 }}>Burst</span>
            </div>
            <div className="d-flex align-items-center mb-1">
              <span className="d-inline-block me-1.5" style={{ width: 8, height: 8, backgroundColor: '#f85149', borderRadius: '50%' }}></span>
              <span className="text-secondary small" style={{ fontSize: 10 }}>Suspicious</span>
            </div>
            <div className="d-flex align-items-center">
              <span className="d-inline-block me-1.5" style={{ width: 8, height: 8, backgroundColor: 'transparent', borderRadius: '50%', border: '1.5px solid #388bfd' }}></span>
              <span className="text-secondary small" style={{ fontSize: 10 }}>Ring Member</span>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Node Transaction Modal */}
      <Modal show={showTransactionModal} onHide={() => setShowTransactionModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ backgroundColor: '#05070a', borderColor: '#1f242c', color: '#f0f6fc' }}>
          <Modal.Title className="d-flex align-items-center gap-2" style={{ fontSize: 14 }}>
            <span>Account Ledger: {selectedNodeData?.id}</span>
            {selectedNodeData && (
              <span
                style={{
                  padding: '1px 8px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  backgroundColor: selectedNodeData.suspicious ? 'rgba(248,81,73,0.15)' : 'rgba(139,148,158,0.15)',
                  color: selectedNodeData.suspicious ? '#f85149' : '#8b949e',
                }}
              >
                {selectedNodeData.suspicious ? 'Suspicious' : 'Normal'}
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#000000', borderColor: '#1f242c', padding: 0 }}>
          {nodeTransactions.length === 0 ? (
            <div className="p-4 text-center text-secondary small">No direct transactions loaded in memory</div>
          ) : (
            <Table hover className="mb-0 align-middle" style={{ borderColor: '#161b22', backgroundColor: '#000000', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#05070a', borderBottom: '1px solid #1f242c' }}>
                  <th className="ps-3 py-2 text-secondary small">Txn ID</th>
                  <th className="py-2 text-secondary small">Sender</th>
                  <th className="py-2 text-secondary small">Receiver</th>
                  <th className="py-2 text-secondary small text-end">Amount</th>
                  <th className="py-2 pe-3 text-secondary small text-end">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {nodeTransactions.map((tx, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #161b22', backgroundColor: '#000000' }}>
                    <td className="ps-3 text-secondary font-monospace" style={{ fontSize: 11 }}>{tx.transaction_id || `tx-${idx}`}</td>
                    <td className="text-light">{tx.sender_id}</td>
                    <td className="text-light">{tx.receiver_id}</td>
                    <td className="text-end text-success font-monospace" style={{ fontSize: 11 }}>${Number(tx.amount || 0).toLocaleString()}</td>
                    <td className="pe-3 text-end text-secondary font-monospace" style={{ fontSize: 11 }}>{tx.timestamp || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default GraphPanel;