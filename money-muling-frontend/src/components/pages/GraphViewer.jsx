import React, { useState, useRef, useEffect } from 'react';
import cytoscape from 'cytoscape';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';

// Risk-tier → colour mapping
const RISK_COLORS = {
  CRITICAL: '#f85149',
  HIGH:     '#e3b341',
  MEDIUM:   '#d29922',
  LOW:      '#3fb950',
  DEFAULT:  '#388bfd',
};

function buildCyElements(analysisResult) {
  if (!analysisResult) return [];

  const elements = [];
  const nodeIds = new Set();

  // Build a score lookup from hybrid_scores
  const scoreMap = {};
  (analysisResult.hybrid_scores || []).forEach((h) => {
    scoreMap[h.account_id] = h;
  });

  // Build a fraud-ring membership lookup
  const ringMap = {};
  (analysisResult.fraud_rings || []).forEach((ring) => {
    ring.member_accounts.forEach((acc) => {
      ringMap[acc] = ringMap[acc] || [];
      ringMap[acc].push(ring.ring_id);
    });
  });

  // Nodes from suspicious_accounts + all accounts seen in transactions
  (analysisResult.account_profiles || analysisResult.suspicious_accounts || []).forEach((a) => {
    const id = a.account_id;
    if (nodeIds.has(id)) return;
    nodeIds.add(id);

    const hybrid = scoreMap[id];
    const tier = hybrid?.risk_tier || 'LOW';
    const score = hybrid?.final_score ?? a.suspicion_score ?? 0;

    elements.push({
      data: {
        id,
        label: id,
        score,
        tier,
        color: RISK_COLORS[tier] || RISK_COLORS.DEFAULT,
        rings: ringMap[id] || [],
        community: hybrid?.community_id ?? null,
      },
      classes: [`risk-${tier}`],
    });
  });

  // Edges — we don't have raw transactions in the analysis result
  // so we infer from fraud ring memberships
  const edgesAdded = new Set();
  (analysisResult.fraud_rings || []).forEach((ring) => {
    const members = ring.member_accounts;
    for (let i = 0; i < members.length - 1; i++) {
      const src = members[i], tgt = members[i + 1];
      if (!nodeIds.has(src) || !nodeIds.has(tgt)) return;
      const key = `${src}__${tgt}`;
      if (edgesAdded.has(key)) return;
      edgesAdded.add(key);
      elements.push({
        data: { id: key, source: src, target: tgt, pattern: ring.pattern_type },
      });
    }
  });

  return elements;
}

function GraphViewer() {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const { analysisResult, runAnalysis, isAnalyzing: loading } = useAnalysis();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState('cose');

  // Load last analysis from session storage if available
  // Context handles session storage automatically now

  // Build / rebuild Cytoscape graph
  useEffect(() => {
    if (!cyRef.current) return;

    const elements = buildCyElements(analysisResult);

    if (cyInstance.current) {
      cyInstance.current.destroy();
    }

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#f0f6fc',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'width': (ele) => Math.max(20, (ele.data('score') || 10) / 4),
            'height': (ele) => Math.max(20, (ele.data('score') || 10) / 4),
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.5,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#fff',
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6,
          },
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#388bfd', 'target-arrow-color': '#388bfd', 'opacity': 1 },
        },
        {
          selector: '.highlighted',
          style: { 'opacity': 1, 'line-color': '#e3b341', 'target-arrow-color': '#e3b341' },
        },
        {
          selector: '.faded',
          style: { 'opacity': 0.15 },
        },
      ],
      layout: { name: layout, animate: true, animationDuration: 600 },
    });

    cyInstance.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelected(node.data());
      // Highlight neighbors
      cyInstance.current.elements().addClass('faded');
      node.neighborhood().addClass('highlighted');
      node.removeClass('faded');
    });

    cyInstance.current.on('tap', (evt) => {
      if (evt.target === cyInstance.current) {
        setSelected(null);
        cyInstance.current.elements().removeClass('faded highlighted');
      }
    });

    return () => { 
      if (cyInstance.current && !cyInstance.current.destroyed()) {
        cyInstance.current.removeAllListeners();
        cyInstance.current.destroy();
        cyInstance.current = null;
      }
    };
  }, [analysisResult, layout]);

  // Search highlight
  const handleSearch = (q) => {
    setSearch(q);
    if (!cyInstance.current) return;
    cyInstance.current.elements().removeClass('highlighted faded');
    if (!q) return;
    const matched = cyInstance.current.nodes().filter((n) =>
      n.id().toLowerCase().includes(q.toLowerCase())
    );
    if (matched.length) {
      cyInstance.current.elements().addClass('faded');
      matched.addClass('highlighted');
      matched.removeClass('faded');
    }
  };

  const handleFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await runAnalysis(f);
    } catch (err) {
      alert('Analysis failed: ' + err.message);
    }
  };

  const elements = buildCyElements(analysisResult);
  const nodeCount = elements.filter((e) => !e.data.source).length;
  const edgeCount = elements.filter((e) => e.data.source).length;

  return (
    <AppLayout title="Graph Viewer" subtitle="Interactive transaction network">
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <label
          style={{
            background: '#1f6feb', color: '#fff', padding: '8px 16px',
            borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          📤 {loading ? 'Analyzing…' : 'Upload & Analyze'}
          <input
            type="file" accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>

        <input
          type="text"
          placeholder="🔍 Search account…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
            padding: '8px 12px', color: '#f0f6fc', fontSize: 13, minWidth: 200,
          }}
        />

        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value)}
          style={{
            background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
            padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
          }}
        >
          <option value="cose">CoSE (Force)</option>
          <option value="circle">Circle</option>
          <option value="grid">Grid</option>
          <option value="concentric">Concentric</option>
          <option value="breadthfirst">Breadth-first</option>
        </select>

        <div style={{ color: '#8b949e', fontSize: 12, marginLeft: 'auto' }}>
          {nodeCount} nodes · {edgeCount} edges
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Graph canvas */}
        <div style={{
          flex: 1, height: 580, background: '#0d1117',
          border: '1px solid #21262d', borderRadius: 10,
          overflow: 'hidden', position: 'relative',
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(1,4,9,0.7)', zIndex: 10,
            }}>
              <div>
                <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                <div style={{ color: '#8b949e', fontSize: 13 }}>Running analysis…</div>
              </div>
            </div>
          )}

          {elements.length === 0 && !loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#8b949e',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🕸️</div>
              <div style={{ fontSize: 14 }}>Upload a CSV to visualize the graph</div>
            </div>
          )}

          <div ref={cyRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Node inspector */}
        {selected && (
          <div style={{
            width: 240, background: '#0d1117', border: '1px solid #21262d',
            borderRadius: 10, padding: 16, alignSelf: 'flex-start',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f0f6fc', marginBottom: 12 }}>
              Account Detail
            </div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Account ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#388bfd', marginBottom: 12, wordBreak: 'break-all' }}>
              {selected.id}
            </div>

            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Risk Tier</div>
            <span className={`risk-badge risk-${selected.tier}`} style={{ display: 'inline-block', marginBottom: 12 }}>
              {selected.tier}
            </span>

            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Final Score</div>
            <div style={{
              fontSize: 24, fontWeight: 800,
              color: RISK_COLORS[selected.tier] || '#f0f6fc',
              marginBottom: 12,
            }}>
              {selected.score?.toFixed(1) || '0.0'}
            </div>

            {selected.rings?.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>Ring Memberships</div>
                {selected.rings.map((r) => (
                  <div key={r} style={{
                    fontSize: 11, background: '#161b22', padding: '3px 8px',
                    borderRadius: 4, marginBottom: 4, fontFamily: 'monospace', color: '#c9d1d9',
                  }}>
                    {r}
                  </div>
                ))}
              </>
            )}

            {selected.community !== null && (
              <>
                <div style={{ fontSize: 12, color: '#8b949e', marginTop: 8, marginBottom: 4 }}>Community</div>
                <div style={{ fontSize: 13, color: '#c9d1d9' }}>#{selected.community}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(RISK_COLORS).filter(([k]) => k !== 'DEFAULT').map(([tier, color]) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: color, border: `2px solid ${color}`,
            }} />
            <span style={{ fontSize: 12, color: '#8b949e' }}>{tier}</span>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}

export default GraphViewer;
