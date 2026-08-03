import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import cytoscape from 'cytoscape';
import '../../assets/landing.css';

function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('cycle');
  const [activeArchStep, setActiveArchStep] = useState(0);
  const [showFraudOnly, setShowFraudOnly] = useState(false);
  const [graphLayout, setGraphLayout] = useState('cose');
  const cyRef = useRef(null);
  const cyInstance = useRef(null);

  // Initializing dynamic Cytoscape Graph with live visual feedback
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));

    if (cyRef.current && !cyInstance.current) {
      const cy = cytoscape({
        container: cyRef.current,
        elements: [
          // Core nodes
          { data: { id: 'core1', label: 'Main Entity', type: 'core' } },
          { data: { id: 'core2', label: 'Processor', type: 'core' } },
          
          // Mule rings
          { data: { id: 'm1', label: 'Mule A (Smurf)', type: 'mule' } },
          { data: { id: 'm2', label: 'Mule B (Layer)', type: 'mule' } },
          { data: { id: 'm3', label: 'Mule C (Hub)', type: 'mule' } },
          { data: { id: 'm4', label: 'Mule D (Cycle)', type: 'mule' } },
          { data: { id: 'm5', label: 'Mule E (Pass)', type: 'mule' } },
          
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
          
          // Edges - Fraud Ring (Cycle & Layering)
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
              'width': 32,
              'height': 32,
              'background-color': '#ffffff',
              'box-shadow': '0 0 20px #ffffff',
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

      // Continuous breathing animation
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
          } catch {
            // Safe guard against destroyed instance
          }
        }
      };
      animateNodes();

      return () => {
        if (animId) cancelAnimationFrame(animId);
        if (cyInstance.current) {
          try {
            cyInstance.current.destroy();
          } catch {
            // ignore cleanup errors when Cytoscape is already destroyed
          }
          cyInstance.current = null;
        }
      };
    }

    return () => window.cancelAnimationFrame(id);
  }, []);

  // Filter Fraud Ring Toggle
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

  // Re-layout toggle
  const handleRelayout = (layoutName) => {
    setGraphLayout(layoutName);
    if(cyInstance.current) {
      cyInstance.current.layout({ name: layoutName, fit: true, padding: 30, animate: true, animationDuration: 600 }).run();
    }
  };

  // 3D Card Tilt Effect Handler
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

  // Content for Detection Algorithm Matrix
  const algorithmData = {
    cycle: {
      title: 'Client Intake & Review Queue',
      tag: 'Admin Control Point',
      badge: 'Pending Requests',
      description: 'Collects new client requests, validates the submission, and routes the item for admin accept, reject, or assignment decisions.',
      complexity: 'O(1) queue lookup per request',
      formula: 'Request(status) → {PENDING, APPROVED, REJECTED, IN_PROGRESS, COMPLETED}',
      weight: 'Operations Hub',
      useCase: 'Centralizing request handling before TraceLab or InvoSpace receives work.'
    },
    fan: {
      title: 'TraceLab Analysis Workspace',
      tag: 'Technical AML Unit',
      badge: 'Analysis Jobs',
      description: 'Validates datasets, runs graph and anomaly analysis, and produces findings and technical reports without creating investigation cases.',
      complexity: 'O(E log E) detector execution',
      formula: 'Dataset → validation → patterns → risk score → findings → technical report',
      weight: 'Detection Only',
      useCase: 'Surfacing suspicious behavior for escalation to admin and InvoSpace.'
    },
    layering: {
      title: 'InvoSpace Investigation Workspace',
      tag: 'Case Ownership',
      badge: 'Active Cases',
      description: 'Turns escalated alerts into cases, tracks evidence, timelines, notes, assignment, and final reports until closure.',
      complexity: 'O(n) case lifecycle orchestration',
      formula: 'Alert → Case → Evidence → Timeline → Investigation Report',
      weight: 'Investigation Only',
      useCase: 'Managing every human investigation while preserving the same workflow instance.'
    },
    burst: {
      title: 'Report Review & Client Release',
      tag: 'Approval Gate',
      badge: 'Ready for Review',
      description: 'Lets Admin approve, request changes, reject, or release technical and investigation reports before client visibility.',
      complexity: 'O(1) review action per report',
      formula: 'Report(status) → {DRAFT, READY_FOR_REVIEW, CHANGES_REQUESTED, APPROVED, RELEASED}',
      weight: 'Admin Release',
      useCase: 'Ensuring clients only receive final approved content.'
    },
    score: {
      title: 'Governed Workflow Timeline',
      tag: 'Audit-Ready Chain',
      badge: 'Every Action Recorded',
      description: 'Records request submission, admin review, team assignment, analysis, alert escalation, investigation, report review, and client release.',
      complexity: 'O(n) immutable audit trail',
      formula: 'Timeline = Σ(workflow events) + actor + status transition',
      weight: 'Compliance Trail',
      useCase: 'Providing a complete operational record for every step in the platform.'
    }
  };

  const architectureSteps = [
    {
      num: '01',
      title: 'Client Request Submitted',
      desc: 'Client uploads request metadata and transaction files into the admin-controlled intake queue.'
    },
    {
      num: '02',
      title: 'Admin Review & Assignment',
      desc: 'Admin accepts or rejects the request and assigns it to TraceLab or InvoSpace based on priority.'
    },
    {
      num: '03',
      title: 'TraceLab Analysis',
      desc: 'TraceLab validates the dataset, runs AML detection, and submits technical findings or alerts.'
    },
    {
      num: '04',
      title: 'InvoSpace Investigation',
      desc: 'Alerted work is converted into a case, evidence is collected, and an investigation report is prepared.'
    },
    {
      num: '05',
      title: 'Admin Review & Client Release',
      desc: 'Admin reviews reports, requests changes if needed, and releases only approved reports to the client portal.'
    }
  ];

  const [analyzerCsv, setAnalyzerCsv] = useState(
`sender_account,receiver_account,amount,timestamp
ACC_100,ACC_200,5000.00,2026-07-22T08:00:00Z
ACC_200,ACC_300,4900.00,2026-07-22T08:05:00Z
ACC_300,ACC_100,4800.00,2026-07-22T08:10:00Z
ACC_400,ACC_200,9900.00,2026-07-22T08:12:00Z`
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzerResults, setAnalyzerResults] = useState(null);
  const [activeFaq, setActiveFaq] = useState(null);
  const [triageStep, setTriageStep] = useState(1);

  // Quick In-Browser Fraud Analysis Engine Demonstration
  const handleQuickAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const lines = analyzerCsv.trim().split('\n').filter(l => l.trim().length > 0);
      const rows = lines.slice(1); // skip header
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

      // Simple cycle detection (A->B->C->A)
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

  const faqs = [
    {
      q: 'Can clients talk directly to TraceLab or InvoSpace?',
      a: 'No. Admin is the only communication hub. Clients submit requests to Admin, and Admin routes work to TraceLab or InvoSpace.'
    },
    {
      q: 'What does TraceLab do in the platform?',
      a: 'TraceLab performs technical AML analysis, generates findings and alerts, and submits technical reports. It never creates investigation cases.'
    },
    {
      q: 'What does InvoSpace own?',
      a: 'InvoSpace owns alerts that become cases, evidence collection, timeline building, investigation notes, and final investigation reports.'
    },
    {
      q: 'How are reports released to clients?',
      a: 'Reports are reviewed in Admin first. Only approved reports can be released to the client portal.'
    }
  ];

  return (
    <div className="landing-shell">
      {/* 3D Dynamic Background Elements */}
      <div className="bg-grid"></div>
      <div className="bg-particles"></div>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>

      {/* Navigation */}
      <div className="landing-nav" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1s ease' }}>
        <div className="landing-logo">
          <div className="logo-icon">⬡</div>
          <span className="logo-text">TraceAcc</span>
          <span className="logo-version-tag">Enterprise AML</span>
        </div>
        <div className="nav-links-center">
          <a href="#features">Operations Hub</a>
          <a href="#architecture">Workflow</a>
          <a href="#analyzer">Live Analyzer</a>
          <a href="#algorithms">Detection Logic</a>
          <a href="#sandbox">Synthetic Data</a>
          <a href="#specs">Platform Stack</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn-glass">Sign In</Link>
          <Link to="/overview" className="btn-glow">Launch Platform</Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-pulse"></span>
            Enterprise AML Operations
          </div>
          <h1 className="hero-title">
            TraceAcc connects intake,<br />
            <span className="text-gradient">analysis, investigation, and release.</span>
          </h1>
          <p className="hero-subtitle">
            TraceAcc keeps AML operations in one place: Admin handles requests, TraceLab performs analysis, InvoSpace handles investigations, and clients receive only approved reports.
          </p>
          <div className="hero-cta-group">
            <Link to="/overview" className="btn-glow large">
              <span>Open TraceAcc</span>
              <i className="bi bi-arrow-right-short"></i>
            </Link>
            <Link to="/sample-generator" className="btn-glass large">
              <i className="bi bi-cpu"></i>
              <span>Demo Dataset</span>
            </Link>
          </div>

          <div className="hero-metrics-pill">
            <div className="metric-item">
              <span className="metric-val">&lt; 50ms</span>
              <span className="metric-lbl">Request Routing</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-item">
              <span className="metric-val">3 Hubs</span>
              <span className="metric-lbl">Admin, TraceLab, InvoSpace</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-item">
              <span className="metric-val">0-100</span>
              <span className="metric-lbl">Workflow Score</span>
            </div>
          </div>
        </div>

        {/* Real Cytoscape 3D-Interactive Network Visual */}
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

      {/* 3D Stat Cards Section */}
      <div className="trusted-section">
        <div className="stat-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div className="stat-card-inner">
            <div className="stat-icon"><i className="bi bi-inboxes-fill"></i></div>
            <div className="stat-num">Admin Hub</div>
            <div className="stat-label">Request Control</div>
            <div className="stat-desc">Accept, assign, review, release</div>
          </div>
        </div>

        <div className="stat-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div className="stat-card-inner">
            <div className="stat-icon"><i className="bi bi-search"></i></div>
            <div className="stat-num">TraceLab</div>
            <div className="stat-label">Technical Analysis</div>
            <div className="stat-desc">Findings, alerts, reports</div>
          </div>
        </div>

        <div className="stat-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div className="stat-card-inner">
            <div className="stat-icon"><i className="bi bi-shield-lock-fill"></i></div>
            <div className="stat-num">InvoSpace</div>
            <div className="stat-label">Case Investigation</div>
            <div className="stat-desc">Evidence, notes, closure</div>
          </div>
        </div>

        <div className="stat-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div className="stat-card-inner">
            <div className="stat-icon"><i className="bi bi-file-earmark-check"></i></div>
            <div className="stat-num">Client Portal</div>
            <div className="stat-label">Final Release</div>
            <div className="stat-desc">Approved reports only</div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="landing-section" id="features">
        <div className="section-header">
          <span className="section-subtitle">Operating Model</span>
          <h2>One platform, four roles</h2>
          <p>TraceAcc keeps communication centralized in Admin while TraceLab, InvoSpace, and the Client Portal each stay focused on their own responsibilities.</p>
        </div>

        <div className="landing-features">
          <div className="feature-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className="feature-card-inner">
              <div className="feature-icon-wrapper">
                <i className="bi bi-inbox"></i>
              </div>
              <h3>Request Intake</h3>
              <p>Tracks new client requests, priority, assignment, and completion from a single queue.</p>
              <div className="card-pill">Admin</div>
            </div>
          </div>

          <div className="feature-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className="feature-card-inner">
              <div className="feature-icon-wrapper">
                <i className="bi bi-graph-up"></i>
              </div>
              <h3>TraceLab Analysis</h3>
              <p>Performs technical AML analysis, generates findings, and escalates only when suspicious activity needs investigation.</p>
              <div className="card-pill">Detection</div>
            </div>
          </div>

          <div className="feature-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className="feature-card-inner">
              <div className="feature-icon-wrapper">
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <h3>InvoSpace Investigation</h3>
              <p>Handles alerts, cases, evidence, timelines, notes, and final investigation reports in a dedicated workspace.</p>
              <div className="card-pill">Investigation</div>
            </div>
          </div>

          <div className="feature-card-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <div className="feature-card-inner">
              <div className="feature-icon-wrapper">
                <i className="bi bi-file-earmark-check"></i>
              </div>
              <h3>Report Review & Release</h3>
              <p>Routes every report back through Admin for approval, change requests, rejection, and release.</p>
              <div className="card-pill">Release</div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Live Instant In-Browser CSV Fraud Analyzer Sandbox */}
      <div className="landing-section alt-bg" id="analyzer">
        <div className="section-header">
          <span className="section-subtitle">TraceAcc Demo</span>
          <h2>Interactive analysis preview</h2>
          <p>Paste sample CSV data below to see how TraceAcc evaluates transactions and highlights suspicious patterns.</p>
        </div>

        <div className="live-analyzer-container">
          <div className="analyzer-editor">
            <div className="editor-title-bar">
              <span><i className="bi bi-file-earmark-code"></i> Live Input CSV Stream</span>
              <button className="sample-btn" onClick={() => handleQuickAnalyze()}>
                {analyzing ? 'Analyzing Graph...' : 'Run Analysis'}
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
            <div className="output-header">Analysis Output Metric</div>
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
                <p>Click "Run Analysis" above to process the sample CSV stream.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Algorithm Breakdown Matrix Section */}
      <div className="landing-section" id="algorithms">
        <div className="section-header">
          <span className="section-subtitle">Workflow Mechanics</span>
          <h2>How work moves through TraceAcc</h2>
          <p>Select a phase below to inspect the request lifecycle, analysis handoff, investigation handoff, and release path.</p>
        </div>

        <div className="algo-matrix-container">
          <div className="algo-tabs">
            <button className={`algo-tab ${activeTab === 'cycle' ? 'active' : ''}`} onClick={() => setActiveTab('cycle')}>
              <i className="bi bi-inbox"></i> Intake
            </button>
            <button className={`algo-tab ${activeTab === 'fan' ? 'active' : ''}`} onClick={() => setActiveTab('fan')}>
              <i className="bi bi-search"></i> TraceLab
            </button>
            <button className={`algo-tab ${activeTab === 'layering' ? 'active' : ''}`} onClick={() => setActiveTab('layering')}>
              <i className="bi bi-shield-lock-fill"></i> InvoSpace
            </button>
            <button className={`algo-tab ${activeTab === 'burst' ? 'active' : ''}`} onClick={() => setActiveTab('burst')}>
              <i className="bi bi-arrow-left-right"></i> Reports
            </button>
            <button className={`algo-tab ${activeTab === 'score' ? 'active' : ''}`} onClick={() => setActiveTab('score')}>
              <i className="bi bi-speedometer2"></i> Governance
            </button>
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

      {/* System Architecture Flow Section */}
      <div className="landing-section alt-bg" id="architecture">
        <div className="section-header">
          <span className="section-subtitle">System Pipeline</span>
          <h2>End-to-End Architectural Flow</h2>
          <p>How transaction logs transform from raw CSV data into interactive 3D network visualizations and audited risk assessments.</p>
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
            <div className="arch-card-badge">Phase {architectureSteps[activeArchStep].num}</div>
            <h3>{architectureSteps[activeArchStep].title}</h3>
            <p>{architectureSteps[activeArchStep].desc}</p>

            <div className="arch-visual-box">
              {activeArchStep === 0 && (
                <div className="code-preview">
                  <div className="code-bar"><span>csv_ingest_service.py</span></div>
                  <pre><code>{`# Raw Transaction CSV Ingestion
transaction_id,sender_account,receiver_account,amount,timestamp
tx_9011,ACC_1002,ACC_5099,9900.00,2026-07-22T08:14:02Z
tx_9012,ACC_5099,ACC_3310,9850.00,2026-07-22T08:18:11Z`}</code></pre>
                </div>
              )}
              {activeArchStep === 1 && (
                <div className="graph-preview-box">
                  <div className="node-bubble core">Main Graph Node</div>
                  <div className="arrow-line">➜</div>
                  <div className="node-bubble mule">Mule Hub</div>
                  <div className="arrow-line">➜</div>
                  <div className="node-bubble normal">Target Account</div>
                </div>
              )}
              {activeArchStep === 2 && (
                <div className="heuristics-status-grid">
                  <div className="status-item ok">✓ Cycle Search Complete</div>
                  <div className="status-item ok">✓ Fan In/Out Matrix Evaluated</div>
                  <div className="status-item ok">✓ DFS Layering Chains Bounded</div>
                  <div className="status-item ok">✓ Burst Dormancy Verified</div>
                </div>
              )}
              {activeArchStep === 3 && (
                <div className="score-preview-box">
                  <div className="risk-ring-preview">
                    <span className="score-val">Risk Score: 85/100</span>
                    <span className="score-desc">HIGH RISK MULE RING DETECTED</span>
                  </div>
                </div>
              )}
              {activeArchStep === 4 && (
                <div className="ui-preview-box">
                  <div className="ui-pill">Admin Review</div>
                  <div className="ui-pill">Client Release</div>
                  <div className="ui-pill">Timeline Recorded</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Interactive Compliance Triage Simulator */}
      <div className="landing-section" id="triage">
        <div className="section-header">
          <span className="section-subtitle">Compliance Workflow</span>
          <h2>Analyst Triage Simulation</h2>
          <p>Experience how compliance officers investigate and flag money muling alerts.</p>
        </div>

        <div className="triage-simulator-card">
          <div className="triage-progress">
            <div className={`triage-step-dot ${triageStep >= 1 ? 'active' : ''}`}>1. Receive Alert</div>
            <div className={`triage-step-dot ${triageStep >= 2 ? 'active' : ''}`}>2. Inspect Topology</div>
            <div className={`triage-step-dot ${triageStep >= 3 ? 'active' : ''}`}>3. Execute Decision</div>
          </div>

          <div className="triage-body">
            {triageStep === 1 && (
              <div className="triage-view">
                <h4>⚠️ Incoming Alert: Suspicious Cycle Ring Detected</h4>
                <p>System flagged 3 accounts passing $9,900 continuously within 15 minutes.</p>
                <button className="btn-glow" onClick={() => setTriageStep(2)}>Investigate Graph Topology</button>
              </div>
            )}
            {triageStep === 2 && (
              <div className="triage-view">
                <h4>🔍 Node Analysis: ACC_1002 ↔ ACC_5099</h4>
                <p>In-degree: 1, Out-degree: 1. Pass-through ratio: 99.5%. Ring Risk Score: 88/100.</p>
                <div className="triage-action-btns">
                  <button className="btn-glow" onClick={() => setTriageStep(3)}>Flag Account & Export SAR</button>
                  <button className="btn-glass" onClick={() => setTriageStep(1)}>Back to Alert</button>
                </div>
              </div>
            )}
            {triageStep === 3 && (
              <div className="triage-view success-view">
                <h4>✅ Action Recorded & Audit Logged</h4>
                <p>Suspicious Activity Report (SAR) draft generated. Action written to audit trail with timestamp and analyst signature.</p>
                <button className="btn-glass" onClick={() => setTriageStep(1)}>Reset Simulator</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Synthetic Data Generator Teaser Section */}
      <div className="landing-section alt-bg" id="sandbox">
        <div className="capabilities-grid">
          <div className="capability-box">
            <span className="tag smurfing">Synthetic Engine</span>
            <h4>Custom Fraud Dataset Generator</h4>
            <p className="capability-intro">Test your detection compliance algorithms against realistic financial datasets generated with configurable fraud vectors.</p>
            <ul className="capability-list">
              <li>Configurable total account node counts and transaction density.</li>
              <li>Targeted fraud percentage injection (1% to 30%).</li>
              <li>Seeded money muling patterns (Cycles, Fan-In, Layering, Bursts).</li>
              <li>One-click CSV download ready for instant platform upload.</li>
            </ul>
            <div className="box-cta">
              <Link to="/sample-generator" className="btn-glow">Open Generator Tool</Link>
            </div>
          </div>

          <div className="capability-box highlight-box">
            <h4>Supported Money Muling Typologies</h4>
            <div className="typology-list">
              <div className="typology-item">
                <span className="tag cycle">Cycle</span>
                <div>
                  <strong>Circular Laundering Rings</strong>
                  <p>Funds routed through multiple accounts before returning to origin.</p>
                </div>
              </div>
              <div className="typology-item">
                <span className="tag fan">Fan</span>
                <div>
                  <strong>Aggregator & Smurfing Hubs</strong>
                  <p>Disproportionate incoming micro-transfers or outgoing fan-out splits.</p>
                </div>
              </div>
              <div className="typology-item">
                <span className="tag layering">Layering</span>
                <div>
                  <strong>Multi-Hop Shell Chains</strong>
                  <p>Consecutive rapid transfers through low-degree pass-through accounts.</p>
                </div>
              </div>
              <div className="typology-item">
                <span className="tag burst">Burst</span>
                <div>
                  <strong>Dormant Sleeping Mules</strong>
                  <p>Inactive accounts triggered simultaneously for high-volume transactions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications Accordion */}
      <div className="landing-section" id="specs">
        <div className="section-header">
          <span className="section-subtitle">Technical Architecture</span>
          <h2>Platform Specifications & Stack</h2>
          <p>Built with enterprise security, performance, and clear auditing at its core.</p>
        </div>

        <div className="specs-grid">
          <div className="spec-card">
            <div className="spec-card-icon"><i className="bi bi-server"></i></div>
            <h4>Backend Tier</h4>
            <ul>
              <li><strong>Framework:</strong> FastAPI (Python 3.10+)</li>
              <li><strong>Graph Library:</strong> NetworkX In-Memory Representation</li>
              <li><strong>ORM & DB:</strong> SQLAlchemy + PostgreSQL (SQLite fallback)</li>
              <li><strong>Auth:</strong> JWT Bearer Session Security</li>
            </ul>
          </div>

          <div className="spec-card">
            <div className="spec-card-icon"><i className="bi bi-display"></i></div>
            <h4>Presentation Tier</h4>
            <ul>
              <li><strong>Framework:</strong> React + Vite Single Page App</li>
              <li><strong>Graph Canvas:</strong> Cytoscape.js with COSE Layout</li>
              <li><strong>Styling:</strong> Custom Glassmorphic 3D CSS</li>
              <li><strong>HTTP Client:</strong> Axios with Bearer Interceptors</li>
            </ul>
          </div>

          <div className="spec-card">
            <div className="spec-card-icon"><i className="bi bi-shield-lock-fill"></i></div>
            <h4>Audit & Security</h4>
            <ul>
              <li><strong>Audit Logging:</strong> Tracks IP, User Agent, & Action Latency</li>
              <li><strong>Password Hashing:</strong> Bcrypt Salted Hash Encryption</li>
              <li><strong>Role Access:</strong> Compliance Analyst Triage Workflows</li>
              <li><strong>Auditing:</strong> Full exportable compliance trail</li>
            </ul>
          </div>
        </div>
      </div>

      {/* NEW: FAQ Section */}
      <div className="landing-section alt-bg" id="faq">
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

      {/* Footer */}
      <div className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">⬡</div>
            <span className="logo-text">TraceAcc</span>
          </div>
          <p className="footer-tagline">Graph-Based Financial Intelligence & Money Muling Detection Engine</p>
          <div className="footer-links">
            <Link to="/overview">Dashboard</Link>
            <Link to="/login">Sign In</Link>
            <Link to="/sample-generator">Data Generator</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 TraceAcc • Enterprise AML Operations</p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;

