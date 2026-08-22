// src/components/landing/LandingPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import cytoscape from 'cytoscape';
import '../../assets/landing.css';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('cycle');
  const [activeArchStep, setActiveArchStep] = useState(0);
  const [showFraudOnly, setShowFraudOnly] = useState(false);
  const [graphLayout, setGraphLayout] = useState('cose');
  const [activeFaq, setActiveFaq] = useState(null);
  const [triageStep, setTriageStep] = useState(1);
  const [analyzerCsv, setAnalyzerCsv] = useState(
`sender_account,receiver_account,amount,timestamp
ACC_100,ACC_200,5000.00,2026-07-22T08:00:00Z
ACC_200,ACC_300,4900.00,2026-07-22T08:05:00Z
ACC_300,ACC_100,4800.00,2026-07-22T08:10:00Z
ACC_400,ACC_200,9900.00,2026-07-22T08:12:00Z`
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzerResults, setAnalyzerResults] = useState(null);

  const cyRef = useRef(null);
  const cyInstance = useRef(null);

  // ─── Cytoscape Graph ───
  useEffect(() => {
    setMounted(true);

    if (cyRef.current && !cyInstance.current) {
      const cy = cytoscape({
        container: cyRef.current,
        elements: [
          // Core nodes
          { data: { id: 'core1', label: 'Main Entity', type: 'core' } },
          { data: { id: 'core2', label: 'Processor', type: 'core' } },
          
          // Mule rings
          { data: { id: 'm1', label: 'Mule A', type: 'mule' } },
          { data: { id: 'm2', label: 'Mule B', type: 'mule' } },
          { data: { id: 'm3', label: 'Mule C', type: 'mule' } },
          { data: { id: 'm4', label: 'Mule D', type: 'mule' } },
          { data: { id: 'm5', label: 'Mule E', type: 'mule' } },
          
          // Normal nodes
          { data: { id: 'n1', label: 'Acc #1029', type: 'normal' } },
          { data: { id: 'n2', label: 'Acc #4492', type: 'normal' } },
          { data: { id: 'n3', label: 'Acc #8831', type: 'normal' } },
          { data: { id: 'n4', label: 'Merchant X', type: 'normal' } },
          { data: { id: 'n5', label: 'Payroll Co', type: 'normal' } },
          
          // Edges - Normal
          { data: { source: 'n1', target: 'core1', amount: '$4,200' } },
          { data: { source: 'n2', target: 'core1', amount: '$1,800' } },
          { data: { source: 'core1', target: 'core2', amount: '$12,500' } },
          { data: { source: 'core2', target: 'n3', amount: '$950' } },
          
          // Edges - Fraud Ring
          { data: { source: 'm1', target: 'm2', isFraud: true, amount: '$9,900' } },
          { data: { source: 'm2', target: 'm3', isFraud: true, amount: '$9,850' } },
          { data: { source: 'm3', target: 'm4', isFraud: true, amount: '$9,800' } },
          { data: { source: 'm4', target: 'm1', isFraud: true, amount: '$9,750' } },
          { data: { source: 'core2', target: 'm1', isFraud: true, amount: '$10,000' } },
          { data: { source: 'm4', target: 'n4', amount: '$150' } },
          { data: { source: 'm5', target: 'n5', amount: '$3,400' } },
          { data: { source: 'n5', target: 'm2', isFraud: true, amount: '$8,200' } }
        ],
        style: [
          {
            selector: 'node',
            style: {
              'width': 32, 'height': 32,
              'background-color': '#ffffff',
              'label': 'data(label)',
              'color': '#ffffff',
              'font-size': '11px',
              'font-weight': '600',
              'text-valign': 'center',
              'text-halign': 'center',
              'text-outline-color': '#030712',
              'text-outline-width': '3px',
              'font-family': 'Outfit, sans-serif'
            }
          },
          {
            selector: 'node[type="core"]',
            style: {
              'background-color': '#2F73FF',
              'width': 48, 'height': 48,
              'shadow-color': '#2F73FF', 'shadow-blur': 25, 'shadow-opacity': 1
            }
          },
          {
            selector: 'node[type="mule"]',
            style: {
              'background-color': '#ef4444',
              'width': 40, 'height': 40,
              'shadow-color': '#ef4444', 'shadow-blur': 25, 'shadow-opacity': 1
            }
          },
          {
            selector: 'node[type="normal"]',
            style: {
              'background-color': '#10b981',
              'width': 28, 'height': 28,
              'shadow-color': '#10b981', 'shadow-blur': 15, 'shadow-opacity': 1
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': 'rgba(47, 115, 255, 0.4)',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': 'rgba(47, 115, 255, 0.4)'
            }
          },
          {
            selector: 'edge[isFraud]',
            style: {
              'width': 3,
              'line-color': 'rgba(239, 68, 68, 0.8)',
              'target-arrow-color': 'rgba(239, 68, 68, 0.8)',
              'line-style': 'dashed'
            }
          }
        ],
        layout: {
          name: 'cose',
          idealEdgeLength: 100,
          nodeOverlap: 20,
          refresh: 20,
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
          minTemp: 1.0
        },
        userZoomingEnabled: false,
        userPanningEnabled: false,
        boxSelectionEnabled: false
      });
      
      cyInstance.current = cy;

      let angle = 0;
      let animId;
      const animateNodes = () => {
        angle += 0.02;
        if(cyInstance.current && !cyInstance.current.destroyed()) {
          try {
            cyInstance.current.nodes().forEach((n, i) => {
               if(n && n.inside()) {
                 const pos = n.position();
                 if (pos) {
                   n.position({
                      x: pos.x + Math.sin(angle + i) * 0.4,
                      y: pos.y + Math.cos(angle + i) * 0.4
                   });
                 }
               }
            });
            animId = requestAnimationFrame(animateNodes);
          } catch(e) {}
        }
      };
      animateNodes();

      return () => {
        if (animId) cancelAnimationFrame(animId);
        if (cyInstance.current) {
          try { cyInstance.current.destroy(); } catch(e) {}
          cyInstance.current = null;
        }
      };
    }
  }, []);

  // ─── Handlers ───
  const handleToggleFraud = () => {
    if(!cyInstance.current) return;
    const nextState = !showFraudOnly;
    setShowFraudOnly(nextState);
    if(nextState) {
      cyInstance.current.nodes('[type != "mule"]').style('opacity', 0.15);
      cyInstance.current.edges('[!isFraud]').style('opacity', 0.1);
    } else {
      cyInstance.current.nodes().style('opacity', 1);
      cyInstance.current.edges().style('opacity', 1);
    }
  };

  const handleRelayout = (layoutName) => {
    setGraphLayout(layoutName);
    if(cyInstance.current) {
      cyInstance.current.layout({ name: layoutName, fit: true, padding: 30, animate: true, animationDuration: 600 }).run();
    }
  };

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
  };

  const handleMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
  };

  const handleQuickAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const lines = analyzerCsv.trim().split('\n').filter(l => l.trim().length > 0);
      const rows = lines.slice(1);
      const nodeDegrees = {};
      const edges = [];
      let totalVolume = 0;

      rows.forEach(r => {
        const parts = r.split(',');
        if (parts.length >= 4) {
          const u = parts[0].trim();
          const v = parts[1].trim();
          const amt = parseFloat(parts[2]) || 0;
          totalVolume += amt;
          nodeDegrees[u] = (nodeDegrees[u] || 0) + 1;
          nodeDegrees[v] = (nodeDegrees[v] || 0) + 1;
          edges.push({ u, v, amt });
        }
      });

      let cycleFound = false;
      edges.forEach(e1 => {
        edges.forEach(e2 => {
          if (e1.v === e2.u) {
            edges.forEach(e3 => {
              if (e2.v === e3.u && e3.v === e1.u) {
                cycleFound = true;
              }
            });
          }
        });
      });

      setAnalyzerResults({
        totalNodes: Object.keys(nodeDegrees).length,
        totalTx: edges.length,
        totalVolume: `$${totalVolume.toLocaleString()}`,
        suspicionScore: cycleFound ? 88 : 35,
        flaggedPattern: cycleFound ? 'Circular Mule Ring (Cycle Length 3)' : 'Normal Transaction Flow',
        cycleDetected: cycleFound
      });
      setAnalyzing(false);
    }, 600);
  };

  // ─── Data ───
  const algorithmData = {
    cycle: {
      title: 'Lexicographical Cycle Detection Algorithm',
      tag: 'Circular Fund Movement',
      badge: 'Cycles (Length 3 to 5)',
      description: 'Identifies circular transfers where illicit money flows through intermediate mule accounts before returning to the seed account (A → B → C → A). Uses lexicographical pruning to eliminate redundant searches and optimize path detection.',
      complexity: 'O(V + E) per seed node',
      formula: 'Path(v₀, v₁, ..., vₖ) where v₀ = vₖ and degree(vᵢ) > 0',
      weight: '40 Risk Points',
      useCase: 'Detecting laundering syndicates trying to inflate account volume or pass funds back to originators.'
    },
    fan: {
      title: 'Fan-In & Fan-Out Hub Detector',
      tag: 'High Velocity Smurfing & Disbursement',
      badge: 'Hub Topology Search',
      description: 'Detects accounts exhibiting disproportionate high-frequency incoming (Fan-In: Many-to-One) or outgoing (Fan-Out: One-to-Many) transfers within narrow temporal sliding windows, filtering out verified merchant patterns.',
      complexity: 'O(E log E) temporal sliding window',
      formula: 'InDegree(v) ≥ T_in AND OutDegree(v) < T_out within Δt',
      weight: '25 Risk Points',
      useCase: 'Catching smurfing hubs collecting micro-deposits from multiple mules or central aggregators disbursing funds.'
    },
    layering: {
      title: 'Multi-Hop Pass-Through Chain Detector',
      tag: 'Layering & Shell Chains',
      badge: 'DFS Pass-Through Analysis',
      description: 'Executes recursive Depth-First Traversal (DFS) across low-degree intermediate accounts. Traces sequential pass-through transactions designed to obscure the ultimate beneficial ownership of funds.',
      complexity: 'O(V * max_depth) bounded DFS',
      formula: 'Path(v_start → ... → v_end) with degree(v_mid) ≤ MaxDegree',
      weight: '20 Risk Points',
      useCase: 'Exposing rapid chain transactions moving money across 5-10 intermediate shell accounts within minutes.'
    },
    burst: {
      title: 'Sliding-Window Temporal Burst Engine',
      tag: 'Dormant Account Exploitation',
      badge: 'Chronological Sliding Window',
      description: 'Flags long-dormant accounts that suddenly display explosive, high-frequency transaction spikes. Compares historical inactivity periods (e.g., 180 days) against sudden activity bursts within hours.',
      complexity: 'O(N log N) sorted timestamp search',
      formula: 'Count(t_i ∈ [T, T+Δt]) ≥ Burst_Threshold AND Inactivity(T-180d) > 90%',
      weight: '25 Risk Points',
      useCase: 'Catching compromised sleeping mule accounts activated simultaneously for laundering operations.'
    },
    score: {
      title: 'Unified Account & Ring Suspicion Engine',
      tag: 'Multi-Heuristic Risk Matrix',
      badge: 'Consolidated Score 0 - 100',
      description: 'Combines heuristic flags with multi-ring involvement multipliers. Accounts are ranked by risk score (0-100), while financial rings receive an aggregate ring risk score computed from member nodes.',
      complexity: 'O(N) score aggregation',
      formula: 'Score = Min(100, ∑ Weight_i + Bonus(Ring_Count))',
      weight: 'Unified 0 - 100 Index',
      useCase: 'Prioritizing high-risk alerts for compliance analysts, drastically reducing manual triage workload.'
    }
  };

  const architectureSteps = [
    {
      num: '01',
      title: 'Client Submits Request',
      desc: 'Client uploads CSV/Excel dataset with transaction details and metadata into the admin-controlled intake queue.'
    },
    {
      num: '02',
      title: 'Admin Reviews & Assigns',
      desc: 'Admin accepts or rejects the request, then assigns it to TraceLab (for analysis) or InvoSpace (for investigation) based on priority.'
    },
    {
      num: '03',
      title: 'TraceLab Performs Analysis',
      desc: 'Analyst validates dataset, runs graph analysis (DFS cycle detection, fan-in/out, layering), behaviour analysis, temporal analysis, ML models, and risk scoring.'
    },
    {
      num: '04',
      title: 'Decision Point',
      desc: 'If low/no risk → Technical Report. If suspicious activity detected → Alert is auto-generated and escalated to Admin, who routes it to InvoSpace for deep investigation.'
    },
    {
      num: '05',
      title: 'InvoSpace Deep Investigation',
      desc: 'Investigator creates a case from the alert. Conducts Entity 360 analysis, multi-hop tracing, evidence collection, hypothesis testing, timeline building, and generates investigation report.'
    },
    {
      num: '06',
      title: 'Admin Review, Seal & Release',
      desc: 'Admin collects all reports, reviews them, applies digital signature/seal (TraceAcc badge watermark), and releases only approved reports to the client portal.'
    }
  ];

  const roles = [
    { icon: '📋', title: 'Client Portal', desc: 'Submit service requests with CSV/Excel datasets. Track request status. Download only Admin-approved and digitally sealed final reports.', pill: 'CLIENT', color: '#10B981' },
    { icon: '⚙️', title: 'Admin Operations Hub', desc: 'Accept/reject client requests. Assign work to TraceLab or InvoSpace. Review reports. Apply a tamper-evident SHA-256 digital seal. Release to client.', pill: 'ADMIN', color: '#3B82F6' },
    { icon: '🔬', title: 'TraceLab Analysis', desc: 'Validate datasets. Run graph analysis, pattern detection, ML scoring. Generate findings & technical reports. Escalate suspicious alerts.', pill: 'ANALYST', color: '#8B5CF6' },
    { icon: '🛡️', title: 'InvoSpace Investigation', desc: 'Convert alerts to cases. Deep investigation: Entity 360, multi-hop tracing, evidence, hypotheses, findings, timeline. Generate investigation reports.', pill: 'INVOSPACE', color: '#F59E0B' },
  ];

  const detectionModules = [
    { title: 'DFS Cycle Detection', desc: 'Finds circular mule rings (A→B→C→A) with lexicographic pruning.', tag: 'Graph Heuristic', color: '#EF4444' },
    { title: 'Fan-In / Fan-Out', desc: 'Identifies smurfing (many sources) and layering (many targets).', tag: 'Graph Heuristic', color: '#F59E0B' },
    { title: 'Layering Chain', desc: 'Multi-hop DFS tracing reveals funds passing through intermediaries.', tag: 'Graph Heuristic', color: '#8B5CF6' },
    { title: 'Burst / Dormancy', desc: 'Detects sudden activation after long dormancy — mule activation.', tag: 'Temporal Heuristic', color: '#3B82F6' },
    { title: 'Structuring', desc: 'Identifies transactions kept under reporting thresholds.', tag: 'Behaviour Heuristic', color: '#10B981' },
    { title: 'Rapid Pass-Through', desc: 'Flags accounts that receive and forward funds in short windows.', tag: 'Temporal Heuristic', color: '#EC4899' },
    { title: 'Isolation Forest', desc: 'Unsupervised anomaly detection without labelled training data.', tag: 'ML Model', color: '#6366F1' },
    { title: 'GNN Classification', desc: 'Graph Neural Networks classify suspicious nodes in transaction graph.', tag: 'Advanced ML', color: '#14B8A6' },
    { title: 'Hybrid Risk Scoring', desc: 'Weighted aggregation of all signals into 0-100 risk score.', tag: 'Scoring Engine', color: '#F97316' },
  ];

  const investigationItems = [
    { icon: '🔍', title: 'Entity 360 View' },
    { icon: '🕸️', title: 'Investigation Graph' },
    { icon: '🔗', title: 'Multi-Hop Tracing' },
    { icon: '📎', title: 'Evidence Management' },
    { icon: '💡', title: 'Hypothesis Testing' },
    { icon: '📋', title: 'Task Management' },
    { icon: '🔬', title: 'ML/GNN Analysis' },
    { icon: '⏱️', title: 'Investigation Timeline' },
    { icon: '📊', title: 'Risk Reassessment' },
    { icon: '📝', title: 'Investigation Report' },
    { icon: '🔄', title: 'Similar Investigations' },
    { icon: '🎯', title: 'SAR Decision Support' },
  ];

  const faqs = [
    {
      q: 'What CSV columns are required for money muling detection?',
      a: 'The system expects standard transaction records with headers: sender_account, receiver_account, amount, and timestamp (ISO-8601 format).'
    },
    {
      q: 'How does TraceAcc differ from traditional rules-based AML systems?',
      a: 'Rules engines inspect individual transactions in isolation. TraceAcc builds a directed graph network, tracing multi-hop layering paths, circular loops, and community structures across thousands of accounts.'
    },
    {
      q: 'What are the four roles in the TraceAcc workflow?',
      a: 'Client (submits requests), Admin (reviews, assigns, seals), TraceLab (analyzes, detects patterns), and InvoSpace (investigates, generates reports).'
    },
    {
      q: 'How does the digital seal work?',
      a: 'Admin applies a SHA-256 tamper-evident digital signature to all approved reports before release to the client portal, ensuring complete audit compliance.'
    }
  ];

  return (
    <div className="landing-shell">
      {/* 3D Dynamic Background Elements */}
      <div className="bg-grid"></div>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>

      {/* Navigation */}
      <div className="landing-nav" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1s ease' }}>
        <div className="landing-logo">
          <div className="logo-icon">⬡</div>
          <span className="logo-text">TraceAcc</span>
          <span className="logo-version-tag">v3.0 Graph AI</span>
        </div>
        <div className="nav-links-center">
          <a href="#features">Roles</a>
          <a href="#analyzer">Live Analyzer</a>
          <a href="#architecture">Architecture</a>
          <a href="#algorithms">Detection</a>
          <a href="#investigation">Investigation</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn-glass">Sign In</Link>
          <Link to="/login" className="btn-glow">Launch Platform</Link>
        </div>
      </div>

      {/* ═══════════ HERO ═══════════ */}
      <div className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-pulse"></span>
            Enterprise Graph-Theory AML Platform
          </div>
          <h1 className="hero-title">
            Detect. Investigate.<br />
            <span className="text-gradient">Govern. Release.</span>
          </h1>
          <p className="hero-subtitle">
            TraceAcc Pro unifies the entire AML lifecycle — from client dataset submission through graph-based pattern detection, deep investigation, admin review, digital seal, and final client release in a single governed platform.
          </p>
          <div className="hero-cta-group">
            <Link to="/login" className="btn-glow large">
              <span>Enter Platform</span>
              <i className="bi bi-arrow-right-short"></i>
            </Link>
            <a href="#architecture" className="btn-glass large">
              <i className="bi bi-diagram-3"></i>
              <span>View Architecture</span>
            </a>
          </div>

          <div className="hero-metrics-pill">
            <div className="metric-item">
              <span className="metric-val">4</span>
              <span className="metric-lbl">Distinct Roles</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-item">
              <span className="metric-val">15+</span>
              <span className="metric-lbl">Detection Modules</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-item">
              <span className="metric-val">SHA-256</span>
              <span className="metric-lbl">Tamper-Evident Seals</span>
            </div>
          </div>
        </div>

        {/* Live Cytoscape 3D Network Visual */}
        <div className="hero-visual-network">
          <div className="cy-container" ref={cyRef}></div>
          <div className="cy-overlay-controls">
            <button className={`cy-btn ${showFraudOnly ? 'active' : ''}`} onClick={handleToggleFraud}>
              {showFraudOnly ? 'Reset View' : 'Highlight Fraud Ring'}
            </button>
            <button className={`cy-btn ${graphLayout === 'cose' ? 'active' : ''}`} onClick={() => handleRelayout('cose')}>
              Force Layout
            </button>
            <button className={`cy-btn ${graphLayout === 'circle' ? 'active' : ''}`} onClick={() => handleRelayout('circle')}>
              Circle View
            </button>
          </div>
          <div className="cy-legend-badge">
            <span className="dot core"></span> Core
            <span className="dot mule"></span> Mule Ring
            <span className="dot normal"></span> Normal
          </div>
        </div>
      </div>

      {/* ═══════════ STATS CARDS ═══════════ */}
      <div className="trusted-section">
        {[
          { icon: '📋', num: '4', label: 'Roles', desc: 'Client, Admin, TraceLab, InvoSpace' },
          { icon: '🔬', num: '15+', label: 'Detection Modules', desc: 'Graph & ML Heuristics' },
          { icon: '🔒', num: 'SHA-256', label: 'Digital Seals', desc: 'Tamper-Evident' },
          { icon: '⚡', num: '< 50ms', label: 'Graph Processing', desc: 'Real-Time Analysis' },
        ].map((stat, i) => (
          <div key={i} className="stat-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className="stat-card-inner">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-num">{stat.num}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-desc">{stat.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════ ROLES / FEATURES ═══════════ */}
      <div className="landing-section" id="features">
        <div className="section-header">
          <span className="section-subtitle">Operating Model</span>
          <h2>Four Roles. One Governed Pipeline.</h2>
          <p>Each role has a dedicated workspace with strictly separated responsibilities. No role can bypass the workflow.</p>
        </div>

        <div className="landing-features">
          {roles.map((role, i) => (
            <div key={i} className="feature-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="feature-card-inner">
                <div className="feature-icon-wrapper" style={{ background: `${role.color}15`, borderColor: `${role.color}30`, color: role.color }}>
                  {role.icon}
                </div>
                <h3>{role.title}</h3>
                <p>{role.desc}</p>
                <div className="card-pill" style={{ color: role.color, background: `${role.color}12`, borderColor: `${role.color}25` }}>
                  {role.pill}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ LIVE ANALYZER ═══════════ */}
      <div className="landing-section alt-bg" id="analyzer">
        <div className="section-header">
          <span className="section-subtitle">Instant Sandbox</span>
          <h2>Live CSV Fraud Analyzer</h2>
          <p>Paste sample CSV data below to execute instant in-browser graph analysis and calculate risk scores.</p>
        </div>

        <div className="live-analyzer-container">
          <div className="analyzer-editor">
            <div className="editor-title-bar">
              <span><i className="bi bi-file-earmark-code"></i> Live Input CSV Stream</span>
              <button className="sample-btn" onClick={handleQuickAnalyze}>
                {analyzing ? 'Analyzing Graph...' : 'Run Quick Analysis'}
              </button>
            </div>
            <textarea 
              className="analyzer-textarea code-font"
              value={analyzerCsv}
              onChange={(e) => setAnalyzerCsv(e.target.value)}
              rows={8}
            />
          </div>

          <div className="analyzer-output">
            <div className="output-header">Analysis Output</div>
            {analyzerResults ? (
              <div className="results-grid">
                <div className="result-card">
                  <span className="res-lbl">Suspicion Index</span>
                  <span className={`res-val ${analyzerResults.cycleDetected ? 'danger' : 'success'}`}>
                    {analyzerResults.suspicionScore}/100
                  </span>
                </div>
                <div className="result-card">
                  <span className="res-lbl">Total Volume</span>
                  <span className="res-val">{analyzerResults.totalVolume}</span>
                </div>
                <div className="result-card">
                  <span className="res-lbl">Detected Pattern</span>
                  <span className="res-val highlight">{analyzerResults.flaggedPattern}</span>
                </div>
                <div className="result-card">
                  <span className="res-lbl">Graph Size</span>
                  <span className="res-val">{analyzerResults.totalNodes} Nodes / {analyzerResults.totalTx} Edges</span>
                </div>
              </div>
            ) : (
              <div className="empty-analyzer-state">
                <i className="bi bi-cpu-fill"></i>
                <p>Click "Run Quick Analysis" above to process the sample CSV stream.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ DETECTION ALGORITHMS ═══════════ */}
      <div className="landing-section" id="algorithms">
        <div className="section-header">
          <span className="section-subtitle">Detection Engine</span>
          <h2>Multi-Heuristic AML Pattern Detection</h2>
          <p>TraceAcc employs 7+ graph-based heuristics and 3+ ML models to detect sophisticated money laundering patterns.</p>
        </div>

        <div className="algo-matrix-container">
          <div className="algo-tabs">
            {Object.keys(algorithmData).map((key) => (
              <button 
                key={key}
                className={`algo-tab ${activeTab === key ? 'active' : ''}`} 
                onClick={() => setActiveTab(key)}
              >
                <i className={`bi bi-${key === 'cycle' ? 'arrow-repeat' : key === 'fan' ? 'share-fill' : key === 'layering' ? 'bezier2' : key === 'burst' ? 'clock-history' : 'speedometer2'}`}></i>
                {key === 'cycle' ? 'Cycle' : key === 'fan' ? 'Fan' : key === 'layering' ? 'Layering' : key === 'burst' ? 'Burst' : 'Score'}
              </button>
            ))}
          </div>

          <div className="algo-content-card">
            <div className="algo-header-row">
              <div>
                <span className="algo-badge">{algorithmData[activeTab].badge}</span>
                <h3>{algorithmData[activeTab].title}</h3>
              </div>
              <div className="algo-weight-tag">{algorithmData[activeTab].weight}</div>
            </div>

            <p className="algo-description">{algorithmData[activeTab].description}</p>

            <div className="algo-grid-specs">
              <div className="spec-box">
                <span className="spec-lbl">Complexity</span>
                <span className="spec-val code-font">{algorithmData[activeTab].complexity}</span>
              </div>
              <div className="spec-box">
                <span className="spec-lbl">Mathematical Definition</span>
                <span className="spec-val code-font">{algorithmData[activeTab].formula}</span>
              </div>
              <div className="spec-box full-width">
                <span className="spec-lbl">Primary AML Target</span>
                <span className="spec-val">{algorithmData[activeTab].useCase}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ DETECTION MODULES GRID ═══════════ */}
      <div className="landing-section alt-bg">
        <div className="section-header">
          <span className="section-subtitle">Detection Modules</span>
          <h2>Complete Detection Capabilities</h2>
        </div>

        <div className="capabilities-grid">
          <div className="capability-box">
            <h4>🔬 Graph Heuristics</h4>
            <ul className="capability-list">
              {detectionModules.filter(d => d.tag.includes('Heuristic')).map((d, i) => (
                <li key={i}><strong>{d.title}</strong> — {d.desc}</li>
              ))}
            </ul>
          </div>

          <div className="capability-box">
            <h4>🧠 ML & Scoring</h4>
            <ul className="capability-list">
              {detectionModules.filter(d => d.tag.includes('ML') || d.tag.includes('Scoring')).map((d, i) => (
                <li key={i}><strong>{d.title}</strong> — {d.desc}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ═══════════ INVESTIGATION ═══════════ */}
      <div className="landing-section" id="investigation">
        <div className="section-header">
          <span className="section-subtitle">InvoSpace Deep Investigation</span>
          <h2>Comprehensive Case Management</h2>
          <p>InvoSpace provides investigators with advanced tools for deep AML investigations with full evidence tracking.</p>
        </div>

        <div className="specs-grid">
          {investigationItems.map((item, i) => (
            <div key={i} className="spec-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{item.icon}</span>
              <h4 style={{ fontSize: '15px', margin: 0 }}>{item.title}</h4>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ ARCHITECTURE ═══════════ */}
      <div className="landing-section alt-bg" id="architecture">
        <div className="section-header">
          <span className="section-subtitle">System Pipeline</span>
          <h2>End-to-End Architectural Flow</h2>
          <p>From client submission through analysis, investigation, review, seal, and release.</p>
        </div>

        <div className="arch-flow-container">
          <div className="arch-steps-nav">
            {architectureSteps.map((step, idx) => (
              <div 
                key={idx} 
                className={`arch-step-btn ${activeArchStep === idx ? 'active' : ''}`}
                onClick={() => setActiveArchStep(idx)}
              >
                <span className="step-num">{step.num}</span>
                <span className="step-title">{step.title}</span>
              </div>
            ))}
          </div>

          <div className="arch-card-display">
            <div className="arch-card-badge">Step {architectureSteps[activeArchStep].num}</div>
            <h3>{architectureSteps[activeArchStep].title}</h3>
            <p>{architectureSteps[activeArchStep].desc}</p>

            <div className="arch-visual-box">
              {activeArchStep === 0 && (
                <div className="code-preview">
                  <div className="code-bar"><span>📋 Client Submits Request</span></div>
                  <pre><code>{`CSV/Excel Upload → Validation → Quality Check → History Tracking`}</code></pre>
                </div>
              )}
              {activeArchStep === 1 && (
                <div className="graph-preview-box">
                  <span className="status-item">✓ Review Request</span>
                  <span className="status-item">✓ Validate</span>
                  <span className="status-item">✓ Priority Assignment</span>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <span className="arch-decision-yes">✓ Accept</span>
                    <span className="arch-decision-no">✗ Reject</span>
                  </div>
                </div>
              )}
              {activeArchStep === 2 && (
                <div className="heuristics-status-grid">
                  <span className="status-item">✓ Dataset Validation</span>
                  <span className="status-item">✓ Transaction Analysis</span>
                  <span className="status-item">✓ Pattern Detection</span>
                  <span className="status-item">✓ Graph Analysis</span>
                  <span className="status-item">✓ ML + Risk Scoring</span>
                </div>
              )}
              {activeArchStep === 3 && (
                <div className="score-preview-box">
                  <div className="risk-ring-preview">
                    <span className="score-val" style={{ color: '#34d399' }}>✓ Technical Report</span>
                    <span className="score-desc" style={{ color: '#fbbf24' }}>⚠ Alert Generated</span>
                  </div>
                </div>
              )}
              {activeArchStep === 4 && (
                <div className="ui-preview-box">
                  <span className="status-item">✓ Entity 360</span>
                  <span className="status-item">✓ Multi-Hop Tracing</span>
                  <span className="status-item">✓ Evidence Management</span>
                  <span className="status-item">✓ Hypothesis Testing</span>
                  <span className="status-item">✓ Case Report</span>
                </div>
              )}
              {activeArchStep === 5 && (
                <div className="ui-preview-box">
                  <span className="status-item">✓ Collect Reports</span>
                  <span className="status-item">✓ Review & Approve</span>
                  <span className="status-item">✓ Digital Signature</span>
                  <span className="status-item">🔒 SHA-256 Seal</span>
                  <div className="arch-seal-preview" style={{ marginTop: '8px', padding: '8px 16px', background: 'rgba(34,211,238,0.1)', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)' }}>
                    <span style={{ color: '#22d3ee' }}>🔒 Tamper-Evident Seal Applied</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ FAQ ═══════════ */}
      <div className="landing-section" id="faq">
        <div className="section-header">
          <span className="section-subtitle">Frequently Asked Questions</span>
          <h2>Everything You Need to Know</h2>
          <p>Clear answers on data formatting, detection latency, and enterprise deployment.</p>
        </div>

        <div className="faq-container">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className={`faq-item ${activeFaq === idx ? 'open' : ''}`}
              onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
            >
              <div className="faq-question">
                <span>{faq.q}</span>
                <i className={`bi ${activeFaq === idx ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              </div>
              {activeFaq === idx && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ FOOTER ═══════════ */}
      <div className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">⬡</div>
            <span className="logo-text">TraceAcc</span>
            <span className="logo-version-tag">PRO</span>
          </div>
          <p className="footer-tagline">Enterprise AML Operations Platform — Detect. Investigate. Govern. Release.</p>
          <div className="footer-links">
            <Link to="/login">Sign In</Link>
            <Link to="/login">Get Started</Link>
            <a href="#features">Features</a>
            <a href="#architecture">Architecture</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 TraceAcc Pro — Enterprise AML Operations Platform</p>
        </div>
      </div>
    </div>
  );
}