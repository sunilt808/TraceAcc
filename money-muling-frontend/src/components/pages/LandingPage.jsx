// src/components/landing/LandingPage.jsx
import React, { useState, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import cytoscape from 'cytoscape';
import { motion, AnimatePresence } from 'framer-motion';

import '../../assets/landing.css';

// Additive reveal animation helpers (existing CSS/canvas animations untouched)
const revealUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const Reveal = ({ children, delay = 0, ...rest }) => (
  <motion.div {...revealUp} transition={{ ...revealUp.transition, delay }} {...rest}>
    {children}
  </motion.div>
);

const swapAnim = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.35, ease: 'easeOut' },
};



const LandingPage = () => {
  // --- REFS ---
  const networkCanvasRef = useRef(null);
  const engineCanvasRef = useRef(null);
  const analyzerCanvasRef = useRef(null);
  const graphContainerRef = useRef(null);
  const particlesRef = useRef(null);
  const progressRef = useRef(null);
  const navbarRef = useRef(null);

  // --- STATE ---
  const [scrolled, setScrolled] = useState(false);
  const [activeArchStep, setActiveArchStep] = useState(0);
  const [activeDetectionTab, setActiveDetectionTab] = useState('cycle');
  const [activeFaq, setActiveFaq] = useState(null);
  const [activeCaseStep, setActiveCaseStep] = useState(0);
  const [activeLabStep, setActiveLabStep] = useState('ingest');
  const [activeDclcgModule, setActiveDclcgModule] = useState(0);
  const [truthOpen, setTruthOpen] = useState(false);
  const [csvContent, setCsvContent] = useState(
    `sender_account,receiver_account,amount,timestamp
ACC_100,ACC_200,5000.00,2026-07-22T08:00:00Z
ACC_200,ACC_300,4900.00,2026-07-22T08:05:00Z
ACC_300,ACC_100,4800.00,2026-07-22T08:10:00Z
ACC_400,ACC_200,9900.00,2026-07-22T08:12:00Z`
  );

  // --- STATIC DATA ---
  const detectionData = {
    cycle: {
      badge: 'Cycles (Length 3-5)',
      title: 'Lexicographical Cycle Detection',
      weight: 'Graph topology signal',
      desc: 'Identifies circular transfers where illicit money flows through intermediate mule accounts before returning to the seed account (A → B → C → A). Uses lexicographical pruning to eliminate redundant searches and optimize path detection.',
      complexity: 'O(V + E) per seed node',
      formula: 'Path(v₀, v₁, ..., vₖ) where v₀ = vₖ',
      useCase: 'Detecting laundering syndicates trying to inflate account volume or pass funds back to originators.'
    },
    fan: {
      badge: 'Fan / Hub Structure',
      title: 'Hub-and-Spoke Disguise Detection',
      weight: 'Hub topology signal',
      desc: 'Identifies hub accounts that receive funds from multiple sources and distribute to many destinations, often used to obscure the true origin of funds.',
      complexity: 'O(V + E) per hub',
      formula: 'Hub(v) = indegree(v) × outdegree(v)',
      useCase: 'Detecting money mule networks and layering structures.'
    },
    layering: {
      badge: 'Multi-Hop Layering',
      title: 'Layering Path Analysis',
      weight: 'Path topology signal',
      desc: 'Tracks funds across multiple hops to identify complex layering schemes where money moves through many accounts to obscure its trail.',
      complexity: 'O(V + E) per path',
      formula: 'Path(v₀ → v₁ → ... → vₖ)',
      useCase: 'Detecting complex money laundering chains with multiple intermediate accounts.'
    },
    burst: {
      badge: 'Temporal Burst',
      title: 'Transaction Burst Detection',
      weight: 'Temporal velocity signal',
      desc: 'Identifies unusual spikes in transaction volume or velocity that may indicate automated laundering or structuring activity.',
      complexity: 'O(V + E) per time window',
      formula: 'Burst = Σ(transactions) / Δt',
      useCase: 'Detecting structuring, smurfing, or automated transaction patterns.'
    },
    score: {
      badge: 'ML Anomaly Score',
      title: 'Unsupervised Anomaly + DC-LCG GNN',
      weight: 'ML ensemble + supervised GNN',
      desc: 'Combines Isolation Forest, LOF, and DBSCAN for unsupervised anomalies, with the trained DC-LCG dual-view graph neural network adding a supervised illicit-probability dimension to the weighted score.',
      complexity: 'O(V × log V)',
      formula: 'Score = w₁×IF + w₂×LOF + w₃×DBSCAN',
      useCase: 'Detecting sophisticated anomalies that evade rule-based detection.'
    }
  };

  const archData = [
    {
      num: '01',
      title: 'Client Submits Request',
      desc: 'Client uploads CSV/Excel dataset with transaction details and metadata into the admin-controlled intake queue.',
      status: ['📋 CSV/Excel Upload', '✓ Validation', '✓ Quality Check', '📊 History Tracking']
    },
    {
      num: '02',
      title: 'Admin Reviews & Assigns',
      desc: 'Admin reviews the request, validates data quality, and assigns the work to TraceLab for analysis or InvoSpace for investigation.',
      status: ['✓ Data Quality Check', '✓ Risk Triage', '📋 Assign to TraceLab', '📊 Queue Management']
    },
    {
      num: '03',
      title: 'TraceLab Performs Analysis',
      desc: 'TraceLab analysts run graph analysis, pattern detection, ML scoring, and generate technical findings.',
      status: ['🔬 Graph Construction', '📊 Pattern Detection', '🧠 ML Scoring', '📋 Findings Report']
    },
    {
      num: '04',
      title: 'Decision Point',
      desc: 'Based on analysis results, the case either proceeds to InvoSpace for deep investigation or is closed with a technical report.',
      status: ['✓ Risk Assessment', '⚖️ Decision: Escalate or Close', '📋 Recommendations']
    },
    {
      num: '05',
      title: 'InvoSpace Investigation',
      desc: 'InvoSpace investigators conduct deep investigation with entity 360, evidence tracking, hypotheses, and timeline analysis.',
      status: ['🔍 Entity 360 View', '📎 Evidence Management', '💡 Hypothesis Testing', '📝 Investigation Report']
    },
    {
      num: '06',
      title: 'Admin Seal & Release',
      desc: 'Admin reviews the final report, applies SHA-256 digital seal, and releases the approved report to the client portal.',
      status: ['✓ Final Review', '🔒 SHA-256 Seal', '📤 Release to Client', '📊 Audit Trail']
    }
  ];

  const caseData = [
    {
      title: 'Ingest the network.',
      text: 'A transaction dataset enters TraceAcc. Accounts become nodes and transfers become directed edges, creating the structure required for network-level analysis.',
      detailTitle: 'Directed financial graph',
      detailText: 'The graph preserves sender → receiver relationships so patterns can be reasoned about across accounts rather than one transaction at a time.',
      metrics: ['4', '21', '0–100'],
      labels: ['graph roles', 'detection / analytics', 'suspicion score'],
      risk: '72',
      riskLabel: 'ELEVATED',
      live: 'Transaction edges assembled · network structure ready'
    },
    {
      title: 'Detect the signal.',
      text: 'Multiple detection modules scan the graph for cycles, fan structures, layering patterns, temporal bursts, and ML anomalies.',
      detailTitle: 'Multi-signal detection',
      detailText: '21 detection modules work together to surface suspicious patterns that a single rule would miss.',
      metrics: ['4', '21', '0–100'],
      labels: ['graph roles', 'detection / analytics', 'suspicion score'],
      risk: '87',
      riskLabel: 'HIGH',
      live: 'Cycle + burst + anomaly signals converged'
    },
    {
      title: 'Trace the flow.',
      text: 'Multi-hop tracing reveals the full path of funds across connected accounts, exposing circular and layered movement.',
      detailTitle: 'Network intelligence',
      detailText: 'Multi-hop relationships reveal the structure surrounding a suspicious account and expose circular or layered movement.',
      metrics: ['4', '21', '0–100'],
      labels: ['graph roles', 'detection / analytics', 'suspicion score'],
      risk: '87',
      riskLabel: 'HIGH',
      live: '3-hop path resolved · circular flow detected'
    },
    {
      title: 'Investigate the case.',
      text: 'Turn an alert into an evidence-backed investigation with entity context, evidence, hypotheses, and findings.',
      detailTitle: 'InvoSpace investigation',
      detailText: 'Analysts move from entity context to evidence, hypotheses, findings and an investigation timeline.',
      metrics: ['1', '12', '06'],
      labels: ['case', 'evidence', 'events'],
      risk: '87',
      riskLabel: 'HIGH',
      live: 'Alert promoted to investigation · evidence linked'
    },
    {
      title: 'Report & release.',
      text: 'Findings become a controlled final report with SHA-256 seal, reviewed by admin and released to the client.',
      detailTitle: 'Governed outcome',
      detailText: 'The workflow ends with review, decision and governed release rather than an unexplained model score.',
      metrics: ['01', 'SHA', '100%'],
      labels: ['report', 'sealed', 'audited'],
      risk: '72',
      riskLabel: 'ELEVATED',
      live: 'Report prepared · governance checkpoint reached'
    }
  ];

  const labData = {
    ingest: {
      eyebrow: 'DATA INGESTION',
      title: 'Transactions become investigation-ready signals.',
      copy: 'Raw transaction records are validated and transformed into connected entities, relationships and time-aware signals.',
      metrics: [['1,248', 'transactions'], ['86', 'accounts'], ['03', 'hops']],
      msg: 'Schema validated · transaction graph assembled',
      risk: '87'
    },
    detect: {
      eyebrow: 'DETECTION ENGINE',
      title: 'Multiple signals converge on one suspicious topology.',
      copy: 'Graph patterns and anomaly signals work together instead of relying on a single rule or isolated transaction.',
      metrics: [['21', 'detectors'], ['07', 'signals'], ['87', 'risk score']],
      msg: 'Cycle + burst + anomaly signals converged',
      risk: '87'
    },
    trace: {
      eyebrow: 'NETWORK INTELLIGENCE',
      title: 'Follow the money across connected accounts.',
      copy: 'Multi-hop relationships reveal the structure surrounding a suspicious account and expose circular or layered movement.',
      metrics: [['04', 'connected'], ['03', 'hops'], ['01', 'cycle']],
      msg: '3-hop path resolved · circular flow detected',
      risk: '87'
    },
    investigate: {
      eyebrow: 'INVOSPACE',
      title: 'Turn an alert into an evidence-backed case.',
      copy: 'Analysts move from entity context to evidence, hypotheses, findings and an investigation timeline.',
      metrics: [['01', 'case'], ['12', 'evidence'], ['06', 'events']],
      msg: 'Alert promoted to investigation · evidence linked',
      risk: '87'
    },
    report: {
      eyebrow: 'GOVERNED OUTCOME',
      title: 'Findings become a controlled final report.',
      copy: 'The workflow ends with review, decision and governed release rather than an unexplained model score.',
      metrics: [['01', 'report'], ['SHA', 'sealed'], ['100%', 'audited']],
      msg: 'Report prepared · governance checkpoint reached',
      risk: '72'
    }
  };

  const dclcgData = [
    {
      title: '01 · DMG',
      subtitle: 'Local neighbourhood view',
      copy: 'DMG groups and aggregates local graph evidence so the model can reason about neighbourhood structure and disguised nodes.'
    },
    {
      title: '02 · DMP',
      subtitle: 'Long-range path context',
      copy: 'DMP samples, prunes and fuses relevant multi-hop paths, keeping long-range context while controlling noise and compute.'
    },
    {
      title: '03 · MAF',
      subtitle: 'Cross-view fusion',
      copy: 'MAF uses mutual attention to integrate complementary signals from the local and contextual views into richer node representations.'
    }
  ];

  // --- HELPERS ---
  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    const el = document.querySelector(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFaq = (idx) => setActiveFaq(activeFaq === idx ? null : idx);

  // --- EFFECTS ---
  useLayoutEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / height) * 100;
      if (progressRef.current) progressRef.current.style.width = progress + '%';
      setScrolled(scrollTop > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    for (let i = 0; i < 35; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 6 + 's';
      p.style.animationDuration = 4 + Math.random() * 6 + 's';
      container.appendChild(p);
    }
    return () => { container.innerHTML = ''; };
  }, []);

  // Hero Network Graph
  useLayoutEffect(() => {
    const canvas = networkCanvasRef.current;
    const container = graphContainerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let highlightFraud = true;
    let circleLayout = false;

    const nodes = [
      { x: .18, y: .30, fraud: false },
      { x: .35, y: .18, fraud: false },
      { x: .52, y: .28, fraud: true },
      { x: .70, y: .18, fraud: false },
      { x: .82, y: .36, fraud: false },
      { x: .25, y: .55, fraud: false },
      { x: .45, y: .48, fraud: true },
      { x: .62, y: .55, fraud: false },
      { x: .78, y: .62, fraud: true },
      { x: .35, y: .78, fraud: false },
      { x: .55, y: .78, fraud: false },
      { x: .72, y: .82, fraud: false }
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [1, 6], [2, 6], [2, 7],
      [3, 7], [4, 8], [5, 6], [6, 7],
      [6, 9], [7, 10], [8, 10],
      [9, 10], [10, 11]
    ];

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const points = nodes.map((node, i) => {
        if (circleLayout) {
          const angle = (Math.PI * 2 * i) / nodes.length;
          return {
            x: width / 2 + Math.cos(angle) * Math.min(width, height) * .35,
            y: height / 2 + Math.sin(angle) * Math.min(width, height) * .35
          };
        }
        return { x: node.x * width, y: node.y * height };
      });
      edges.forEach(([a, b]) => {
        const p1 = points[a], p2 = points[b];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = 1;
        ctx.strokeStyle = (highlightFraud && (nodes[a].fraud || nodes[b].fraud)) ? 'rgba(239,68,68,.7)' : 'rgba(100,116,139,.35)';
        ctx.stroke();
      });
      points.forEach((point, i) => {
        const node = nodes[i];
        ctx.beginPath();
        ctx.arc(point.x, point.y, node.fraud && highlightFraud ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = node.fraud && highlightFraud ? '#ef4444' : '#38bdf8';
        ctx.fill();
        if (node.fraud && highlightFraud) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(239,68,68,.25)';
          ctx.stroke();
        }
      });
    };

    resize();
    draw();
    const handleResize = () => { resize(); draw(); };
    window.addEventListener('resize', handleResize);

    const fraudBtn = document.getElementById('toggleFraud');
    const forceBtn = document.getElementById('layoutForce');
    const circleBtn = document.getElementById('layoutCircle');
    if (fraudBtn) fraudBtn.onclick = () => { highlightFraud = !highlightFraud; draw(); };
    if (forceBtn) forceBtn.onclick = () => { circleLayout = false; draw(); };
    if (circleBtn) circleBtn.onclick = () => { circleLayout = true; draw(); };

    return () => {
      window.removeEventListener('resize', handleResize);
      if (fraudBtn) fraudBtn.onclick = null;
      if (forceBtn) forceBtn.onclick = null;
      if (circleBtn) circleBtn.onclick = null;
    };
  }, []);

  // Engine Canvas
  useLayoutEffect(() => {
    const canvas = engineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, dpr = 1, raf;
    const nodes = [], links = [], packets = [];
    const count = 34;
    const seed = (min, max) => Math.random() * (max - min) + min;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes.length = 0;
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: seed(25, w - 25),
          y: seed(55, h - 70),
          vx: seed(-.18, .18),
          vy: seed(-.18, .18),
          risk: Math.random() < .18,
          r: seed(2.5, 4.5)
        });
      }
      links.length = 0;
      for (let i = 0; i < nodes.length; i++) {
        let best = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i !== j) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const d = dx * dx + dy * dy;
            best.push([d, j]);
          }
        }
        best.sort((a, b) => a[0] - b[0]);
        best.slice(0, 2).forEach(x => {
          const key = i < x[1] ? i + '-' + x[1] : x[1] + '-' + i;
          if (!links.some(l => l.key === key)) {
            links.push({ a: i, b: x[1], key, risk: nodes[i].risk || nodes[x[1]].risk });
          }
        });
      }
      packets.length = 0;
      for (let i = 0; i < 10; i++) {
        packets.push({ l: links[i % links.length], t: Math.random(), speed: seed(.0015, .004) });
      }
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(3,9,18,.22)';
      ctx.fillRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 20 || n.x > w - 20) n.vx *= -1;
        if (n.y < 50 || n.y > h - 70) n.vy *= -1;
      }
      links.forEach(l => {
        const a = nodes[l.a], b = nodes[l.b];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = l.risk ? 'rgba(255,85,119,.24)' : 'rgba(79,209,255,.10)';
        ctx.lineWidth = l.risk ? 1.25 : .7;
        ctx.stroke();
      });
      packets.forEach(p => {
        p.t += p.speed;
        if (p.t > 1) p.t = 0;
        const a = nodes[p.l.a], b = nodes[p.l.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        ctx.beginPath();
        ctx.arc(x, y, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = p.l.risk ? '#ff6d8a' : '#6edcff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.risk ? '#ff5577' : '#4fd1ff';
        ctx.shadowBlur = n.risk ? 18 : 8;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (n.risk) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 6 + Math.sin(performance.now() / 400) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,85,119,.12)';
          ctx.stroke();
        }
      });
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    setTimeout(() => {
      if (!reduced) raf = requestAnimationFrame(frame);
    }, 50);

    return () => {
      window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Analyzer Canvas
  useLayoutEffect(() => {
    const canvas = analyzerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let pulse = 0;
    let graph = { rows: [], metrics: null, nodes: [], edges: [] };
    let lastW = 0, lastH = 0;

    const parseCSV = (text) => {
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error('Add at least one transaction row.');
      const head = lines[0].split(',').map(x => x.trim().toLowerCase());
      const required = ['sender_account', 'receiver_account', 'amount', 'timestamp'];
      if (!required.every(k => head.includes(k))) {
        throw new Error('Required columns: sender_account, receiver_account, amount, timestamp');
      }
      const ix = Object.fromEntries(required.map(k => [k, head.indexOf(k)]));
      return lines.slice(1).map((line, i) => {
        const c = line.split(',');
        const amount = Number(c[ix.amount]);
        return {
          s: (c[ix.sender_account] || '').trim(),
          r: (c[ix.receiver_account] || '').trim(),
          a: Number.isFinite(amount) ? amount : 0,
          t: (c[ix.timestamp] || '').trim(),
          i
        };
      }).filter(x => x.s && x.r);
    };

    const computeMetrics = (rows) => {
      const nodes = [...new Set(rows.flatMap(x => [x.s, x.r]))];
      const adj = new Map(nodes.map(n => [n, []]));
      rows.forEach(x => adj.get(x.s)?.push(x.r));

      let cycles = 0;
      const cycleNodes = new Set();
      const dfs = (start, u, path) => {
        if (path.length > 6) return;
        for (const v of (adj.get(u) || [])) {
          if (v === start && path.length >= 3) {
            cycles++;
            path.forEach(n => cycleNodes.add(n));
          } else if (!path.includes(v)) {
            dfs(start, v, [...path, v]);
          }
        }
      };
      nodes.forEach(n => dfs(n, n, [n]));
      cycles = Math.floor(cycles / 3);

      const out = new Map(nodes.map(n => [n, 0]));
      const inc = new Map(nodes.map(n => [n, 0]));
      rows.forEach(x => {
        out.set(x.s, (out.get(x.s) || 0) + 1);
        inc.set(x.r, (inc.get(x.r) || 0) + 1);
      });

      const maxAmount = rows.reduce((m, r) => Math.max(m, r.a), 0);
      const high = rows.filter(x => x.a >= Math.max(9000, maxAmount * .8)).length;
      const hubs = nodes.filter(n => (out.get(n) || 0) >= 3 || (inc.get(n) || 0) >= 3).length;

      let score = Math.min(100, Math.round(
        cycles * 22 + high * 10 + hubs * 7 + (cycleNodes.size ? 18 : 0)
      ));
      if (rows.length >= 4) {
        score = Math.max(score, Math.min(100, 35 + cycles * 20 + high * 8));
      }
      return { nodes, cycles, cycleNodes, out, inc, high, hubs, score };
    };

    const resizeCanvas = (preserve = true) => {
      const rect = canvas.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * d));
      canvas.height = Math.max(1, Math.floor(rect.height * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const w = rect.width, h = rect.height;
      if (!graph.metrics) return;

      const ids = graph.metrics.nodes;
      if (!preserve || !graph.nodes.length || lastW !== w || lastH !== h) {
        const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(ids.length))));
        const rows = Math.ceil(ids.length / cols);
        graph.nodes = ids.map((id, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          return {
            id,
            x: w * (.12 + .76 * (col / Math.max(1, cols - 1))),
            y: h * (.16 + .68 * (row / Math.max(1, rows - 1))),
            vx: (Math.random() - .5) * .08,
            vy: (Math.random() - .5) * .08,
            phase: Math.random() * Math.PI * 2
          };
        });
        graph.edges = graph.rows.map(x => ({ s: x.s, r: x.r }));
        lastW = w;
        lastH = h;
      }
    };

    const drawCanvas = () => {
      if (!ctx || !graph.metrics) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.strokeStyle = 'rgba(83,214,255,.035)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) { ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke(); }
      for (let y = 0; y < h; y += 32) { ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke(); }
      ctx.restore();

      const pos = new Map(graph.nodes.map(n => [n.id, n]));

      for (const e of graph.edges) {
        const a = pos.get(e.s), b = pos.get(e.r);
        if (!a || !b) continue;
        const risk = graph.metrics.cycleNodes.has(e.s) && graph.metrics.cycleNodes.has(e.r);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = risk ? 'rgba(255,85,119,.62)' : 'rgba(79,209,255,.16)';
        ctx.lineWidth = risk ? 1.6 : 1;
        ctx.stroke();

        const phase = ((pulse * .002 + e.s.length * .07 + e.r.length * .11) % 1);
        const px = a.x + (b.x - a.x) * phase;
        const py = a.y + (b.y - a.y) * phase;
        ctx.beginPath();
        ctx.arc(px, py, risk ? 2.5 : 1.7, 0, Math.PI * 2);
        ctx.fillStyle = risk ? '#ff5577' : '#6be7ff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      graph.nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 18 || n.x > w - 18) n.vx *= -1;
        if (n.y < 18 || n.y > h - 18) n.vy *= -1;

        const risk =
          graph.metrics.cycleNodes.has(n.id) ||
          (graph.metrics.out.get(n.id) || 0) >= 3 ||
          (graph.metrics.inc.get(n.id) || 0) >= 3;

        const radius = risk ? 5.5 : 3.2;
        if (risk) {
          const glow = 10 + Math.sin(pulse * .004 + n.phase) * 3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, glow, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,85,119,.16)';
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = risk ? '#ff5577' : '#55d8ff';
        ctx.shadowBlur = risk ? 14 : 6;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      pulse++;
      raf = requestAnimationFrame(drawCanvas);
    };

    const renderAnalyzer = (rows, m) => {
      if (raf) cancelAnimationFrame(raf);
      graph = { rows, metrics: m, nodes: [], edges: [] };
      resizeCanvas(false);
      drawCanvas();

      const el = (id) => document.getElementById(id);
      if (el('metricTxPro')) el('metricTxPro').textContent = rows.length;
      if (el('metricNodesPro')) el('metricNodesPro').textContent = m.nodes.length;
      if (el('metricCyclesPro')) el('metricCyclesPro').textContent = m.cycles;
      if (el('metricEdgesPro')) el('metricEdgesPro').textContent = rows.length;
      if (el('riskScorePro')) el('riskScorePro').textContent = m.score;
      if (el('riskLevelPro')) {
        el('riskLevelPro').textContent =
          m.score >= 70 ? 'High risk' :
          m.score >= 40 ? 'Elevated risk' : 'Low risk';
      }
      if (el('riskMeterPro')) el('riskMeterPro').style.width = m.score + '%';
      if (el('graphStatusPro')) el('graphStatusPro').textContent = m.cycles ? 'CYCLE DETECTED' : 'ANALYZED';
      if (el('analysisTimePro')) el('analysisTimePro').textContent = 'just now';
      if (el('rowCountPro')) el('rowCountPro').textContent = rows.length + ' rows';

      const findings = [];
      if (m.cycles) findings.push(['Circular flow', 'Multi-hop cycle detected across ' + m.cycleNodes.size + ' accounts.']);
      if (m.high) findings.push(['High-value concentration', m.high + ' transaction' + (m.high > 1 ? 's' : '') + ' sits near the observed amount ceiling.']);
      if (m.hubs) findings.push(['Hub behaviour', m.hubs + ' account' + (m.hubs > 1 ? 's' : '') + ' show elevated in/out connectivity.']);
      if (!findings.length) findings.push(['No strong topology signal', 'No cycle, hub, or high-value signal crossed the demo thresholds.']);

      if (el('findingListPro')) {
        el('findingListPro').innerHTML = findings.map(x =>
          `<div class="finding-item-pro"><i></i><div><b>${x[0]}</b><span>${x[1]}</span></div></div>`
        ).join('');
      }
    };

    const executeAnalyzer = (text) => {
      try {
        const rows = parseCSV(text);
        renderAnalyzer(rows, computeMetrics(rows));
      } catch (e) {
        const el = document.getElementById('findingListPro');
        if (el) el.innerHTML = `<div class="finding-empty">${e.message}</div>`;
        const status = document.getElementById('graphStatusPro');
        if (status) status.textContent = 'INPUT ERROR';
      }
    };

    try {
      const defaultRows = parseCSV(csvContent);
      renderAnalyzer(defaultRows, computeMetrics(defaultRows));
    } catch (e) { /* ignore */ }

    const handleResize = () => { resizeCanvas(true); };
    window.addEventListener('resize', handleResize);
    window.__analyzerExecute = executeAnalyzer;

    return () => {
      window.removeEventListener('resize', handleResize);
      if (raf) cancelAnimationFrame(raf);
      delete window.__analyzerExecute;
    };
  }, [csvContent]);

  // --- HANDLERS ---
  const handleAnalyzerRun = () => {
    if (window.__analyzerExecute) window.__analyzerExecute(csvContent);
  };
  const handleAnalyzerDemo = () => {
    const demo = `sender_account,receiver_account,amount,timestamp
ACC_100,ACC_200,5000.00,2026-07-22T08:00:00Z
ACC_200,ACC_300,4900.00,2026-07-22T08:05:00Z
ACC_300,ACC_100,4800.00,2026-07-22T08:10:00Z
ACC_400,ACC_200,9900.00,2026-07-22T08:12:00Z`;
    setCsvContent(demo);
    if (window.__analyzerExecute) window.__analyzerExecute(demo);
  };
  const handleCsvChange = (e) => {
    const val = e.target.value;
    setCsvContent(val);
    if (window.__analyzerExecute) window.__analyzerExecute(val);
  };
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setCsvContent(text);
      if (window.__analyzerExecute) window.__analyzerExecute(text);
    };
    reader.readAsText(file);
  };

  // --- RENDER ---
  const currentDetection = detectionData[activeDetectionTab] || detectionData.cycle;
  const currentArch = archData[activeArchStep] || archData[0];
  const currentCase = caseData[activeCaseStep] || caseData[0];
  const currentLab = labData[activeLabStep] || labData.ingest;
  const currentDclcg = dclcgData[activeDclcgModule] || dclcgData[0];

  return (
    <div className="landing-shell">
      {/* Background orbs & grid */}
      <div className="bg-grid"></div>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>
      <div className="bg-orb orb-4"></div>

      {/* Particles */}
      <div className="particles" ref={particlesRef}></div>

      {/* Scroll Progress */}
      <div className="scroll-progress" id="scrollProgress" ref={progressRef}></div>

      {/* NAVIGATION */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`} ref={navbarRef}>
        <a href="#" className="landing-logo" onClick={(e) => e.preventDefault()}>
          <div className="logo-icon">T</div>
          <span className="logo-text">Trace<span>Acc</span></span>
          <span className="logo-version-tag">Pro</span>
        </a>
        <div className="nav-links-center">
          <a href="#product" onClick={(e) => handleSmoothScroll(e, '#product')} className="active">Product</a>
          <a href="#engine" onClick={(e) => handleSmoothScroll(e, '#engine')}>Engine</a>
          <a href="#governance" onClick={(e) => handleSmoothScroll(e, '#governance')}>Governance</a>
          <a href="#stack" onClick={(e) => handleSmoothScroll(e, '#stack')}>Stack</a>
          <a href="#future" onClick={(e) => handleSmoothScroll(e, '#future')}>Future</a>
          <a href="#case-replay" onClick={(e) => handleSmoothScroll(e, '#case-replay')}>Replay</a>
        </div>
        <div className="landing-actions">
          <a href="#reviewer-lab" className="btn-ghost" onClick={(e) => handleSmoothScroll(e, '#reviewer-lab')}>Explore workflow</a>
          <a href="#reviewer-lab" className="btn-primary" onClick={(e) => handleSmoothScroll(e, '#reviewer-lab')}>Explore platform</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section" id="home">
        <div className="hero-grid">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-pulse"></span>
              Enterprise AML Intelligence Platform
            </div>
            <h1 className="hero-title">
              Detect. Investigate.<br />
              <span className="text-gradient">Govern. Release.</span>
            </h1>
            <p className="hero-subtitle">
              TraceAcc Pro unifies the entire AML lifecycle — from client dataset submission through
              graph-based pattern detection, deep investigation, admin review, digital seal,
              and final client release in a single governed platform.
            </p>
            <div className="hero-actions">
              <a href="#reviewer-lab" className="btn-primary large" onClick={(e) => handleSmoothScroll(e, '#reviewer-lab')}>
                Explore the system
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a href="#architecture" className="btn-secondary large" onClick={(e) => handleSmoothScroll(e, '#architecture')}>
                View Architecture
              </a>
              <Link to="/login" className="btn-glow large">
                Get Started →
              </Link>
            </div>
            <div className="hero-metrics">
              <div className="metric"><span className="metric-value">4</span><span className="metric-label">Roles</span></div>
              <div className="metric-divider"></div>
              <div className="metric"><span className="metric-value">21+</span><span className="metric-label">Detection / analytics</span></div>
              <div className="metric-divider"></div>
              <div className="metric"><span className="metric-value">15</span><span className="metric-label">Pattern suite</span></div>
              <div className="metric-divider"></div>
              <div className="metric"><span className="metric-value">SHA-256</span><span className="metric-label">Seals</span></div>
              <div className="metric-divider"></div>
              <div className="metric"><span className="metric-value">0–100</span><span className="metric-label">Risk score</span></div>
            </div>
          </div>

          <div className="hero-graph">
            <div className="graph-container" ref={graphContainerRef}>
              <div className="graph-overlay-glow"></div>
              <canvas ref={networkCanvasRef}></canvas>
            </div>
            <div className="graph-controls">
              <button className="graph-btn active" id="toggleFraud">Highlight Fraud</button>
              <button className="graph-btn" id="layoutForce">Force</button>
              <button className="graph-btn" id="layoutCircle">Circle</button>
            </div>
            <div className="graph-legend">
              <span><span className="dot core"></span> Core</span>
              <span><span className="dot mule"></span> Mule</span>
              <span><span className="dot normal"></span> Normal</span>
              <span><span className="dot suspect"></span> Suspect</span>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats-section">
        {[
          { icon: '🏛️', num: '4', label: 'Roles', desc: 'Client · Admin · TraceLab · InvoSpace' },
          { icon: '🔬', num: '21+', label: 'Detectors', desc: 'Graph · ML · Temporal · Behavioural' },
          { icon: '🔒', num: 'SHA-256', label: 'Digital Seals', desc: 'Tamper-Evident Audit Trail' },
          { icon: '⚡', num: '<50ms', label: 'Graph Processing', desc: 'Real-Time Analysis Engine' },
          { icon: '🧠', num: '4', label: 'ML Models', desc: 'Isolation Forest · LOF · DBSCAN · DC-LCG GNN' },
          { icon: '🧩', num: '15', label: 'Pattern Suite', desc: '5 Basic · 5 Intermediate · 5 Advanced ML' },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.07}>
            <div className="stat-card">
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-number">{s.num}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-desc">{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* FEATURES / ROLES */}
      <section className="section" id="features">
        <div className="section-header">
          <span className="section-subtitle">Operating Model</span>
          <h2>Four Roles. One Governed Pipeline.</h2>
          <p>Each role has a dedicated workspace with strictly separated responsibilities. No role can bypass the workflow.</p>
        </div>
        <div className="roles-grid">
          {[
            { icon: '📋', bg: 'rgba(16,185,129,0.12)', color: '#10b981', title: 'Client Portal', text: 'Submit service requests with CSV/Excel datasets. Track request status. Download only Admin-approved and digitally sealed final reports.', pill: 'CLIENT' },
            { icon: '⚙️', bg: 'rgba(37,99,235,0.12)', color: '#3b82f6', title: 'Admin Operations Hub', text: 'Accept/reject client requests. Assign work to TraceLab or InvoSpace. Review reports. Apply tamper-evident SHA-256 digital seal. Release to client.', pill: 'ADMIN' },
            { icon: '🔬', bg: 'rgba(124,58,237,0.12)', color: '#8b5cf6', title: 'TraceLab Analysis', text: 'Validate datasets. Run graph analysis, the 15-pattern suite, ML + DC-LCG scoring. Generate findings & technical reports — auto-stored from every analysis. Escalate suspicious alerts.', pill: 'ANALYST' },
            { icon: '🛡️', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', title: 'InvoSpace Investigation', text: 'Convert alerts to cases. Deep investigation: Entity 360, multi-hop tracing, evidence, hypotheses, findings, timeline, plus the Intel Hub with cross-job dossiers and money-path tracing.', pill: 'INVESTIGATOR' },
          ].map((r, i) => (
            <Reveal key={r.title} delay={i * 0.08}>
              <div className="role-card">
                <div className="role-icon" style={{ background: r.bg, color: r.color }}>{r.icon}</div>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
                <span className="role-pill" style={{ color: r.color, borderColor: r.bg.replace(/0\.12\)/, '0.2)') }}>{r.pill}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section className="section alt-bg" id="architecture">
        <div className="section-header">
          <span className="section-subtitle">Workflow Architecture</span>
          <h2>End-to-End AML Operations Flow</h2>
          <p>From client dataset submission to final report release — every step is audited and governed.</p>
        </div>
        <div className="architecture-grid">
          <div className="architecture-steps">
            {archData.map((step, idx) => (
              <div
                key={idx}
                className={`arch-step ${activeArchStep === idx ? 'active' : ''}`}
                onClick={() => setActiveArchStep(idx)}
              >
                <span className="arch-step-num">{step.num}</span>
                <span className="arch-step-title">{step.title}</span>
              </div>
            ))}
          </div>
          <div className="arch-detail">
            <AnimatePresence mode="wait">
              <motion.div key={activeArchStep} {...swapAnim}>
                <div className="arch-detail-num">Step {currentArch.num}</div>
                <h3>{currentArch.title}</h3>
                <p>{currentArch.desc}</p>
                <div className="arch-preview">
                  <div className="arch-status">
                    {currentArch.status.map((s, i) => <span key={i}>{s}</span>)}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* DETECTION */}
      <section className="section" id="detection">
        <div className="section-header">
          <span className="section-subtitle">Detection Engine</span>
          <h2>Multi-Heuristic AML Pattern Detection</h2>
          <p>TraceAcc combines 21 detection and analytics modules with three unsupervised ML approaches to surface sophisticated money-laundering patterns.</p>
        </div>
        <div className="detection-tabs">
          {Object.keys(detectionData).map((key) => (
            <button
              key={key}
              className={`detection-tab ${activeDetectionTab === key ? 'active' : ''}`}
              onClick={() => setActiveDetectionTab(key)}
            >
              {key === 'cycle' && '🔄 Cycle'}
              {key === 'fan' && '📊 Fan'}
              {key === 'layering' && '🔗 Layering'}
              {key === 'burst' && '⏰ Burst'}
              {key === 'score' && '📈 Score'}
            </button>
          ))}
        </div>
        <div className="detection-detail">
          <AnimatePresence mode="wait">
            <motion.div key={activeDetectionTab} {...swapAnim}>
              <div className="detection-header">
                <div>
                  <span className="detection-badge">{currentDetection.badge}</span>
                  <h3>{currentDetection.title}</h3>
                </div>
                <span className="detection-weight">{currentDetection.weight}</span>
              </div>
              <p className="detection-desc">{currentDetection.desc}</p>
              <div className="detection-specs">
                <div><span>Complexity</span><span className="code">{currentDetection.complexity}</span></div>
                <div><span>Formula</span><span className="code">{currentDetection.formula}</span></div>
                <div className="full"><span>Use Case</span><span>{currentDetection.useCase}</span></div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* INVESTIGATION */}
      <section className="section alt-bg" id="investigation">
        <div className="section-header">
          <span className="section-subtitle">InvoSpace Deep Investigation</span>
          <h2>Comprehensive Case Management</h2>
          <p>InvoSpace provides investigators with advanced tools for deep AML investigations with full evidence tracking.</p>
        </div>
        <div className="investigation-grid">
          <div className="investigation-item"><span className="inv-icon">🔍</span><span className="inv-title">Entity 360 View</span></div>
          <div className="investigation-item"><span className="inv-icon">🕸️</span><span className="inv-title">Investigation Graph</span></div>
          <div className="investigation-item"><span className="inv-icon">🔗</span><span className="inv-title">Multi-Hop Tracing</span></div>
          <div className="investigation-item"><span className="inv-icon">📎</span><span className="inv-title">Evidence Management</span></div>
          <div className="investigation-item"><span className="inv-icon">💡</span><span className="inv-title">Hypothesis Testing</span></div>
          <div className="investigation-item"><span className="inv-icon">📋</span><span className="inv-title">Task Management</span></div>
          <div className="investigation-item"><span className="inv-icon">🔬</span><span className="inv-title">ML/GNN Analysis</span></div>
          <div className="investigation-item"><span className="inv-icon">⏱️</span><span className="inv-title">Investigation Timeline</span></div>
          <div className="investigation-item"><span className="inv-icon">📊</span><span className="inv-title">Risk Reassessment</span></div>
          <div className="investigation-item"><span className="inv-icon">📝</span><span className="inv-title">Investigation Report</span></div>
          <div className="investigation-item"><span className="inv-icon">🔄</span><span className="inv-title">Similar Investigations</span></div>
          <div className="investigation-item"><span className="inv-icon">🎯</span><span className="inv-title">SAR Decision Support</span></div>
        </div>
      </section>

      {/* ANALYZER SANDBOX */}
      <section className="section analyzer-pro" id="analyzer">
        <div className="section-header">
          <span className="section-kicker"><i></i> Interactive TraceLab</span>
          <h2>From raw transactions to an explainable risk signal.</h2>
          <p>Load a small CSV, inspect the transaction network, and see topology signals update in your browser. This is a demonstration layer — it does not replace the production analysis engine.</p>
        </div>
        <div className="analyzer-pro-shell">
          <div className="analyzer-toolbar">
            <div className="analyzer-title"><span className="live-dot"></span><div><strong>TraceLab Sandbox</strong><small>client-side demonstration</small></div></div>
            <div className="analyzer-actions">
              <label className="file-chip">
                <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
                Import CSV
              </label>
              <button type="button" className="ghost-mini" onClick={handleAnalyzerDemo}>Load demo</button>
              <button type="button" className="primary-mini" onClick={handleAnalyzerRun}>Run analysis <span>↗</span></button>
            </div>
          </div>
          <div className="analyzer-workbench">
            <div className="analyzer-input-panel">
              <div className="panel-head"><span>01 · TRANSACTION INPUT</span><span id="rowCountPro">4 rows</span></div>
              <textarea
                id="csvInputPro"
                spellCheck="false"
                value={csvContent}
                onChange={handleCsvChange}
              ></textarea>
              <div className="schema-row"><span>sender_account</span><span>receiver_account</span><span>amount</span><span>timestamp</span></div>
            </div>
            <div className="analyzer-graph-panel">
              <div className="panel-head"><span>02 · NETWORK SIGNAL</span><span id="graphStatusPro">READY</span></div>
              <div className="graph-stage-pro">
                <canvas ref={analyzerCanvasRef}></canvas>
                <div className="graph-center-label"><b id="riskScorePro">—</b><span>risk signal</span></div>
              </div>
              <div className="signal-legend"><span><i className="node-safe"></i>observed</span><span><i className="node-risk"></i>flagged</span><span><i className="edge-risk"></i>risk path</span></div>
            </div>
            <div className="analyzer-results-panel">
              <div className="panel-head"><span>03 · FINDINGS</span><span id="analysisTimePro">—</span></div>
              <div className="risk-summary-pro"><div><small>RISK LEVEL</small><strong id="riskLevelPro">Awaiting analysis</strong></div><div className="risk-meter-pro"><span id="riskMeterPro"></span></div></div>
              <div className="metric-grid-pro">
                <div><small>Transactions</small><b id="metricTxPro">0</b></div>
                <div><small>Accounts</small><b id="metricNodesPro">0</b></div>
                <div><small>Cycles</small><b id="metricCyclesPro">0</b></div>
                <div><small>Edges</small><b id="metricEdgesPro">0</b></div>
              </div>
              <div className="finding-list-pro" id="findingListPro"><div className="finding-empty">Run the sandbox to surface topology signals.</div></div>
            </div>
          </div>
          <div className="analyzer-footnote"><span>ⓘ</span><span><b>Expected columns:</b> sender_account, receiver_account, amount, timestamp · ISO-8601 timestamps recommended.</span></div>
        </div>
      </section>

      {/* ULTIMATE WRAP */}
      <div className="ultimate-wrap">
        {/* PRODUCT MAP */}
        <section className="product-map reveal" id="product">
          <div className="map-shell">
            <div className="section-header">
              <span className="section-kicker"><i></i> Product Intelligence</span>
              <h2>One platform. Four workspaces. One governed chain of evidence.</h2>
              <p>TraceAcc connects intake, analysis, alert triage, investigation and controlled reporting into a single operational loop.</p>
            </div>
            <div className="map-grid">
              <div className="map-column stagger">
                <div className="map-card"><span className="mini">01 / Intake</span><h3>Client Portal</h3><p>Submit a service request with transaction data and track the controlled journey to an approved final report.</p></div>
                <div className="map-card"><span className="mini">02 / Governance</span><h3>Admin Workspace</h3><p>Review, validate, prioritize and route work to the right analytical or investigative workspace.</p></div>
                <div className="map-card"><span className="mini">03 / Accountability</span><h3>Audit Layer</h3><p>Role boundaries and workflow events make each operational transition visible and traceable.</p></div>
              </div>
              <div className="map-core">
                <div className="core-orbit"></div><div className="core-orbit two"></div>
                <div className="core-node">TRANSACTION DATA</div><div className="core-node">RISK SIGNALS</div><div className="core-node">ALERT / CASE</div><div className="core-node">FINAL REPORT</div>
                <div className="core-center"><div><strong>TRACEACC</strong><span>AML INTELLIGENCE CORE</span></div></div>
              </div>
              <div className="map-column stagger">
                <div className="map-card"><span className="mini">04 / Intelligence</span><h3>TraceLab</h3><p>Validate datasets, build transaction graphs, detect money-muling topologies and fuse behavioural + ML signals.</p></div>
                <div className="map-card"><span className="mini">05 / Investigation</span><h3>InvoSpace</h3><p>Turn escalated alerts into deep investigations with entities, evidence, hypotheses, timelines and findings.</p></div>
                <div className="map-card"><span className="mini">06 / Release</span><h3>Controlled Reporting</h3><p>Technical and investigation reports move through review before the client receives the approved output.</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* METRIC STRIP */}
        <div className="metric-strip reveal">
          <div className="metric-grid">
            <div className="metric-item"><strong>4</strong><span>Core graph topologies</span><div className="metric-bar"><i></i></div></div>
            <div className="metric-item"><strong>4</strong><span>ML models incl. DC-LCG GNN</span><div className="metric-bar"><i></i></div></div>
            <div className="metric-item"><strong>15</strong><span>Automated pattern suite</span><div className="metric-bar"><i></i></div></div>
            <div className="metric-item"><strong>21+</strong><span>Detection / analytics modules</span><div className="metric-bar"><i></i></div></div>
          </div>
        </div>

        {/* ENGINE SECTION */}
        <section className="engine-section reveal" id="engine">
          <div className="engine-shell">
            <div className="section-header">
              <span className="section-kicker"><i></i> Detection Engine</span>
              <h2>From transactions to a multi-signal risk picture.</h2>
              <p>TraceAcc does not stop at a single rule. It combines graph topology, behaviour, temporal signals, community structure and unsupervised anomaly detection into a weighted suspicion score.</p>
            </div>
            <div className="engine-layout">
              <div className="engine-copy">
                <span className="section-subtitle">Signal stack</span>
                <h3>Multiple views of the same financial network.</h3>
                <p>The current engine is built around a directed transaction graph and layers specialized detectors over it.</p>
                <div className="signal-list stagger">
                  <div className="signal"><b>Cycle</b><em>A → B → C → A</em></div>
                  <div className="signal"><b>Fan</b><em>hub / disguise</em></div>
                  <div className="signal"><b>Layering</b><em>multi-hop flow</em></div>
                  <div className="signal"><b>Burst</b><em>activation spike</em></div>
                  <div className="signal"><b>Centrality</b><em>network influence</em></div>
                  <div className="signal"><b>Community</b><em>Louvain structure</em></div>
                  <div className="signal"><b>K-core / Motifs</b><em>structural density</em></div>
                  <div className="signal"><b>Temporal / Velocity</b><em>time behaviour</em></div>
                  <div className="signal"><b>Isolation Forest</b><em>unsupervised ML</em></div>
                  <div className="signal"><b>LOF / DBSCAN</b><em>density anomalies</em></div>
                </div>
              </div>
              <div className="engine-visual">
                <div className="engine-top"><span className="live-chip"><b>● LIVE</b> SIGNAL SIMULATION</span><span className="live-chip">NETWORKX → GRAPH → SCORE</span></div>
                <canvas ref={engineCanvasRef}></canvas>
                <div className="engine-readout">
                  <div className="readout"><span>Accounts</span><strong id="rAccounts">1,284</strong></div>
                  <div className="readout"><span>Edges</span><strong id="rEdges">8,642</strong></div>
                  <div className="readout"><span>Risk signal</span><strong id="rRisk">HIGH</strong></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DATA STORY */}
        <section className="data-section reveal" id="data-story">
          <div className="data-shell">
            <div className="section-header">
              <span className="section-kicker"><i></i> Data → Decision</span>
              <h2>Show the reviewer what actually happens to the data.</h2>
              <p>A landing page should explain the product's operating logic, not just display feature cards.</p>
            </div>
            <div className="data-layout">
              <div className="data-card">
                <h3>The governed chain</h3><p>Every major stage has a clear owner and a clear output.</p>
                <div className="data-flow stagger">
                  <div className="flow-node"><div className="n">01</div><div><b>Dataset intake</b><span>CSV / Excel + request details</span></div></div>
                  <div className="flow-node"><div className="n">02</div><div><b>Graph construction</b><span>accounts become nodes, transfers become edges</span></div></div>
                  <div className="flow-node"><div className="n">03</div><div><b>Pattern + ML analysis</b><span>topology, behaviour and anomaly signals</span></div></div>
                  <div className="flow-node"><div className="n">04</div><div><b>Risk + alert triage</b><span>weighted suspicion score and escalation</span></div></div>
                  <div className="flow-node"><div className="n">05</div><div><b>Investigation</b><span>entities, evidence, hypotheses and timeline</span></div></div>
                  <div className="flow-node"><div className="n">06</div><div><b>Review + release</b><span>approved report returns to the client</span></div></div>
                </div>
              </div>
              <div className="data-visual">
                <div className="data-ring r1"></div><div className="data-ring r2"></div><div className="data-ring r3"></div>
                <div className="data-center"><div><strong>RISK</strong><span>CONTEXTUAL SIGNAL</span></div></div>
                <div className="data-float a">ACCOUNT A → B</div><div className="data-float b">BURST + VELOCITY</div><div className="data-float c">4-HOP PATH</div><div className="data-float d">ML ANOMALY</div>
              </div>
            </div>
          </div>
        </section>

        {/* GOVERNANCE */}
        <section className="governance-section reveal" id="governance">
          <div className="gov-shell">
            <div className="section-header">
              <span className="section-kicker"><i></i> Trust & Governance</span>
              <h2>Detection is only useful when the result can be governed.</h2>
              <p>The platform combines analysis with role separation, auditability and controlled report release.</p>
            </div>
            <div className="gov-grid stagger">
              <div className="gov-card"><div className="gov-icon">◈</div><h3>JWT + RBAC</h3><p>Authenticated workspaces separate Client, Admin, TraceLab Analyst and InvoSpace Investigator responsibilities.</p><div className="gov-code">AUTH → ROLE → WORKSPACE</div></div>
              <div className="gov-card"><div className="gov-icon">◎</div><h3>Audit Trail</h3><p>Operational events record actions, statuses and timing so the workflow has a traceable history.</p><div className="gov-code">EVENT → ACTOR → TIMESTAMP</div></div>
              <div className="gov-card"><div className="gov-icon">⬡</div><h3>Governed Workflow</h3><p>Requests move through review, assignment, analysis/investigation, report review and release states.</p><div className="gov-code">SUBMIT → REVIEW → ASSIGN → RELEASE</div></div>
              <div className="gov-card"><div className="gov-icon">⌁</div><h3>Evidence Context</h3><p>Investigation work can combine entities, evidence, hypotheses, findings and a timeline into one case narrative.</p><div className="gov-code">ENTITY → EVIDENCE → FINDING</div></div>
              <div className="gov-card"><div className="gov-icon">◉</div><h3>Risk Reassessment</h3><p>Investigators can revisit risk in context rather than treating the original alert score as the final decision.</p><div className="gov-code">ALERT → CASE → DECISION</div></div>
              <div className="gov-card"><div className="gov-icon">▣</div><h3>Controlled Reporting</h3><p>Technical and investigation reports pass through administrative review before release to the client.</p><div className="gov-code">DRAFT → REVIEW → APPROVE</div></div>
            </div>
          </div>
        </section>

        {/* STACK */}
        <section className="stack-section reveal" id="stack">
          <div className="stack-shell">
            <div className="section-header">
              <span className="section-kicker"><i></i> Technical Architecture</span>
              <h2>Built as a real full-stack engineering system.</h2>
              <p>The current implementation spans a React/Vite presentation layer, FastAPI application layer, SQLAlchemy/PostgreSQL data layer and a graph/ML detection engine.</p>
            </div>
            <div className="stack-grid">
              <div className="stack-card">
                <h3>Current stack</h3><p>Technology choices mapped to what each layer is responsible for.</p>
                <div className="stack-layer"><label>Frontend</label><div className="tech-pills"><span className="tech primary">React</span><span className="tech primary">Vite</span><span className="tech">Cytoscape.js</span></div></div>
                <div className="stack-layer"><label>API</label><div className="tech-pills"><span className="tech primary">FastAPI</span><span className="tech">Uvicorn</span><span className="tech">REST</span></div></div>
                <div className="stack-layer"><label>Data</label><div className="tech-pills"><span className="tech primary">SQLAlchemy</span><span className="tech">SQLite / PostgreSQL-ready</span><span className="tech">Alembic</span></div></div>
                <div className="stack-layer"><label>Graph</label><div className="tech-pills"><span className="tech primary">NetworkX</span><span className="tech">DFS</span><span className="tech">Graph analytics</span></div></div>
                <div className="stack-layer"><label>ML</label><div className="tech-pills"><span className="tech primary">scikit-learn</span><span className="tech primary">PyTorch · DC-LCG GNN</span><span className="tech">Isolation Forest</span><span className="tech">LOF</span><span className="tech">DBSCAN</span></div></div>
              </div>
              <div className="stack-card">
                <h3>Engineering profile</h3><p>Useful technical facts for a reviewer or interviewer.</p>
                <div className="spec-panel">
                  <div className="spec-row"><span>Graph model</span><b>Directed financial graph</b></div>
                  <div className="spec-row"><span>Core topology</span><b>Cycle / Fan / Layering / Burst</b></div>
                  <div className="spec-row"><span>Pattern suite</span><b>15 automated detectors</b></div>
                  <div className="spec-row"><span>GNN layer</span><b>DC-LCG dual-view (PyTorch)</b></div>
                  <div className="spec-row"><span>Score range</span><b>0 → 100</b></div>
                  <div className="spec-row"><span>Frontend graph</span><b>Cytoscape.js</b></div>
                  <div className="spec-row"><span>Backend</span><b>FastAPI + SQLAlchemy</b></div>
                  <div className="spec-row"><span>Auth</span><b>JWT + password hashing</b></div>
                  <div className="spec-row"><span>Advanced API</span><b>/analyze/advanced · /patterns · /dclcg · /intel</b></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CASE REPLAY */}
        <section className="section" id="case-replay">
          <div className="section-header reveal">
            <span className="section-subtitle">Interactive Case Replay</span>
            <h2>Watch one signal become an investigation.</h2>
            <p>A compact visual walkthrough of the TraceAcc operating model — from transaction movement to graph evidence, risk synthesis and investigation context.</p>
          </div>
          <div className="case-replay reveal">
            <div className="case-replay-grid">
              <div className="case-copy">
                <span className="case-kicker"><i></i> reviewer mode · simulated case</span>
                <h3>{currentCase.title}</h3>
                <p>{currentCase.text}</p>
                <div className="case-controls">
                  {caseData.map((_, idx) => (
                    <button
                      key={idx}
                      className={`case-step ${activeCaseStep === idx ? 'active' : ''}`}
                      onClick={() => setActiveCaseStep(idx)}
                    >
                      {idx === 0 ? '01 · INGEST' :
                       idx === 1 ? '02 · DETECT' :
                       idx === 2 ? '03 · TRACE' :
                       idx === 3 ? '04 · INVESTIGATE' :
                       '05 · REPORT'}
                    </button>
                  ))}
                </div>
                <div className="case-detail">
                  <AnimatePresence mode="wait">
                    <motion.div key={activeCaseStep} {...swapAnim}>
                      <strong>{currentCase.detailTitle}</strong>
                      <span>{currentCase.detailText}</span>
                      <div className="case-signal-list">
                        {currentCase.metrics.map((m, i) => (
                          <div className="case-signal" key={i}>
                            <b>{m}</b>
                            <small>{currentCase.labels[i]}</small>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="case-visual">
                <svg className="case-svg" viewBox="0 0 700 580" preserveAspectRatio="none">
                  <path className="case-edge cool" d="M110 175 C215 95 330 135 350 245"/>
                  <path className="case-edge cool" d="M350 245 C435 125 520 140 585 185"/>
                  <path className="case-edge" d="M110 175 C170 280 245 355 350 430"/>
                  <path className="case-edge hot" d="M350 245 C430 330 485 390 585 405"/>
                  <path className="case-edge hot" d="M585 405 C480 475 265 470 110 175"/>
                </svg>
                <div className="case-node c1"><b>ACC-101</b><small>origin</small></div>
                <div className="case-node c2"><b>ACC-204</b><small>pass-through</small></div>
                <div className="case-node c3"><b>ACC-318</b><small>receiver</small></div>
                <div className="case-node c4"><b>ACC-447</b><small>hub</small></div>
                <div className="case-node c5"><b>ACC-552</b><small>linked</small></div>
                <div className="case-risk"><span>RISK</span><strong>{currentCase.risk}</strong><small>{currentCase.riskLabel}</small></div>
                <div className="case-live">{currentCase.live}</div>
              </div>
            </div>
          </div>
        </section>

        {/* DC-LCG RESEARCH LAB (is-visible added) */}
        <section className="section alt-bg reveal is-visible" id="dclcg">
          <div className="section-header">
            <span className="section-subtitle">Advanced Layer · Implemented</span>
            <h2>DC-LCG: local camouflage meets long-range context.</h2>
            <p>TraceAcc's dual-view graph neural network is live: analysts train it on labeled datasets, every analysis scores accounts with it as a dedicated dimension, and flagged nodes expose their pruned evidence paths.</p>
          </div>
          <div className="dclcg-wrap">
            <div className="dclcg-copy">
              <span className="section-kicker"><i></i> Dual-context graph learning</span>
              <h3>Designed for the patterns simple neighbourhood models miss.</h3>
              <p>DC-LCG's core idea is complementary views: a <b>local view</b> models neighbourhood characteristics where illicit nodes can camouflage themselves, while a <b>context view</b> models extended transaction paths that expose longer laundering chains.</p>
              <div className="dclcg-badges">
                <span className="dclcg-badge">DMG · Dynamic grouping</span>
                <span className="dclcg-badge">DMP · Path pruning & fusion</span>
                <span className="dclcg-badge">MAF · Mutual attention</span>
              </div>
              <div className="dclcg-modules">
                {dclcgData.map((mod, idx) => (
                  <div
                    key={idx}
                    className={`dclcg-module ${activeDclcgModule === idx ? 'active' : ''}`}
                    onClick={() => setActiveDclcgModule(idx)}
                  >
                    <strong>{mod.title}</strong>
                    <span>{mod.subtitle}</span>
                  </div>
                ))}
              </div>
              <div className="dclcg-compare">
                <div><b>Heuristic engine</b><span>Graph heuristics + behavioural features + unsupervised anomaly models + weighted suspicion scoring.</span></div>
                <div><b>DC-LCG in production</b><span>Trained via the model registry on labeled CSVs, registered as versioned artifacts, and fused into every advanced analysis as a supervised illicit-probability dimension with per-account disguise and path explainability.</span></div>
              </div>
            </div>
            <div className="dclcg-visual">
              <div className="dclcg-canvas">
                <svg className="dclcg-svg" viewBox="0 0 600 390" preserveAspectRatio="none">
                  <path className="dclcg-line" d="M100 115 C185 125 235 170 300 245"/>
                  <path className="dclcg-line" d="M100 150 C185 185 230 220 300 245"/>
                  <path className="dclcg-line pathline" d="M500 115 C420 125 365 170 300 245"/>
                  <path className="dclcg-line pathline" d="M500 155 C420 190 365 220 300 245"/>
                  <path className="dclcg-line fusion" d="M300 245 C300 285 300 315 300 345"/>
                </svg>
                <div className="dclcg-node local"><b>Local View</b><small>Neighbourhood structure<br/>camouflage signals</small></div>
                <div className="dclcg-node path"><b>Context View</b><small>Multi-hop paths<br/>extended fund flows</small></div>
                <div className="dclcg-chip">MUTUAL ATTENTION FUSION</div>
                <div className="dclcg-node mutual"><b>Learned representation</b><small>combined local + contextual evidence</small></div>
                <AnimatePresence mode="wait">
                  <motion.div
                    className="dclcg-explain"
                    key={activeDclcgModule}
                    {...swapAnim}
                  >
                    <strong>{currentDclcg.copy}</strong>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* FUTURE */}
        <section className="future-section reveal" id="future">
          <div className="future-shell">
            <div className="future-intro">
              <div><span className="section-kicker"><i></i> Next Generation</span><h2 style={{ marginTop: '15px' }}>The advanced TraceAcc roadmap.</h2></div>
              <p>These are intentionally presented as the next evolution — not as claims that the current prototype already runs these components.</p>
            </div>
            <div className="roadmap">
              <div className="road-line"></div>
              <div className="road-grid stagger">
                <div className="road-card"><div className="road-dot"></div><h4>Neo4j</h4><p>Persistent graph storage and Cypher-based network querying for larger financial graphs.</p><span className="road-tag">GRAPH STORAGE</span></div>
                <div className="road-card"><div className="road-dot"></div><h4>GNN Scaling</h4><p>Extend the shipped DC-LCG dual-view GNN with GraphSAGE/GCN variants and GPU training for larger graphs.</p><span className="road-tag">GNN</span></div>
                <div className="road-card"><div className="road-dot"></div><h4>Kafka</h4><p>Move from static uploads toward continuous transaction streams and live graph updates.</p><span className="road-tag">STREAMING</span></div>
                <div className="road-card"><div className="road-dot"></div><h4>SHAP / LIME</h4><p>Expose the evidence behind a model signal so analysts can understand why an account was flagged.</p><span className="road-tag">XAI</span></div>
                <div className="road-card"><div className="road-dot"></div><h4>Celery + Redis</h4><p>Offload CPU-heavy analysis into background workers and expose job progress to the UI.</p><span className="road-tag">ASYNC COMPUTE</span></div>
                <div className="road-card"><div className="road-dot"></div><h4>Temporal Graph</h4><p>Replay network formation over time with a timeline slider for dynamic investigation.</p><span className="road-tag">TIME SERIES</span></div>
                <div className="road-card"><div className="road-dot"></div><h4>Docker + Cloud</h4><p>Package the full stack for repeatable deployment and scalable environments.</p><span className="road-tag">DEVOPS</span></div>
              </div>
            </div>
            <div className="future-callout"><b>Shipped & next:</b> the DC-LCG dual-view GNN is implemented and runs inside production analysis (model registry, training API, scoring dimension). The remaining items below are the next evolution — persistent graph storage, streaming, XAI and scaled deployment.</div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta reveal" id="overview">
          <div className="cta-shell">
            <span className="section-kicker"><i></i> TraceAcc Pro</span>
            <h2 style={{ marginTop: '18px' }}>Detect the signal.<br /><span>Understand the network.</span></h2>
            <p>TraceAcc turns transaction data into graph intelligence, risk signals and investigation context — with a governed path from request to report.</p>
            <div className="cta-chips"><span className="cta-chip">GRAPH INTELLIGENCE</span><span className="cta-chip">UNSUPERVISED ML</span><span className="cta-chip">CASE INVESTIGATION</span><span className="cta-chip">AUDITABLE WORKFLOW</span><span className="cta-chip">ADVANCED ROADMAP</span></div>
          </div>
        </section>
      </div>

      {/* REVIEWER LAB */}
      <section className="section reviewer-lab" id="reviewer-lab">
        <div className="section-header reveal">
          <span className="section-subtitle">Live Product Walkthrough</span>
          <h2>See the investigation happen.</h2>
          <p>Trace one suspicious flow from transaction signal to explainable investigation outcome.</p>
        </div>
        <div className="lab-shell reveal">
          <div className="lab-topbar">
            <div className="lab-title"><span className="live-dot"></span> TRACEACC / INVESTIGATION SIMULATOR</div>
            <div className="lab-status">SIMULATED DATA · INTERACTIVE DEMO</div>
          </div>
          <div className="lab-body">
            <div className="lab-rail">
              {['ingest', 'detect', 'trace', 'investigate', 'report'].map((step) => (
                <button
                  key={step}
                  className={`lab-step ${activeLabStep === step ? 'active' : ''}`}
                  onClick={() => setActiveLabStep(step)}
                >
                  <b>{step === 'ingest' ? '01' : step === 'detect' ? '02' : step === 'trace' ? '03' : step === 'investigate' ? '04' : '05'}</b>
                  <span>{step.charAt(0).toUpperCase() + step.slice(1)}</span>
                </button>
              ))}
            </div>
            <div className="lab-main">
              <div className="lab-stage">
                <div className="lab-grid"></div>
                <div className="signal-card signal-a"><span>TX-1842</span><strong>₹ 9,900</strong><small>ACC-104 → ACC-208</small></div>
                <div className="signal-card signal-b"><span>TX-1843</span><strong>₹ 9,850</strong><small>ACC-208 → ACC-411</small></div>
                <div className="signal-card signal-c"><span>TX-1844</span><strong>₹ 9,700</strong><small>ACC-411 → ACC-104</small></div>
                <svg className="lab-links" viewBox="0 0 900 420" preserveAspectRatio="none">
                  <path d="M180 130 C330 80 360 300 500 205 S690 130 760 260" />
                  <path d="M180 130 C310 230 360 90 500 205" />
                  <circle cx="180" cy="130" r="7" /><circle cx="500" cy="205" r="9" /><circle cx="760" cy="260" r="7" />
                </svg>
                <div className="risk-orb"><span>RISK</span><strong id="labRisk">{currentLab.risk}</strong><small>HIGH</small></div>
                <div className="lab-event" id="labEvent">{currentLab.msg}</div>
              </div>
              <div className="lab-detail">
                <AnimatePresence mode="wait">
                  <motion.div key={activeLabStep} {...swapAnim}>
                    <span className="eyebrow" id="labEyebrow">{currentLab.eyebrow}</span>
                    <h3 id="labTitle">{currentLab.title}</h3>
                    <p id="labCopy">{currentLab.copy}</p>
                  </motion.div>
                </AnimatePresence>
                <div className="lab-metrics" id="labMetrics">
                  {currentLab.metrics.map((m, i) => (
                    <div key={i}><strong>{m[0]}</strong><span>{m[1]}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWER COMMAND */}
      <section className="section command-section" id="reviewer-command">
        <div className="section-header reveal">
          <span className="section-subtitle">Reviewer Mode</span>
          <h2>Explore TraceAcc like a product, not a brochure.</h2>
          <p>Jump directly to the parts that matter during a technical review.</p>
        </div>
        <div className="command-grid reveal">
          <button onClick={(e) => handleSmoothScroll(e, '#engine')}><span>⌘</span><div><b>Intelligence Engine</b><small>Graph + ML + pattern detection</small></div><i>↗</i></button>
          <button onClick={(e) => handleSmoothScroll(e, '#investigation')}><span>◉</span><div><b>Investigation Workspace</b><small>Entity 360 + evidence + timeline</small></div><i>↗</i></button>
          <button onClick={(e) => handleSmoothScroll(e, '#architecture')}><span>⇄</span><div><b>Governed Workflow</b><small>Client → Admin → TraceLab → InvoSpace</small></div><i>↗</i></button>
          <button onClick={(e) => handleSmoothScroll(e, '#future')}><span>✦</span><div><b>Advanced Evolution</b><small>Neo4j + GNN + Kafka + XAI</small></div><i>↗</i></button>
        </div>
      </section>

      {/* FAQ */}
      <section className="section alt-bg" id="faq">
        <div className="section-header">
          <span className="section-subtitle">FAQ</span>
          <h2>Everything You Need to Know</h2>
        </div>
        <div className="faq-grid">
          {[
            { q: 'What CSV columns are required for money muling detection?', a: 'Headers: sender_account, receiver_account, amount, timestamp (ISO-8601 format). Excel (.xlsx) uploads are also supported, and labeled datasets can additionally carry a label column for supervised DC-LCG training.' },
            { q: 'How does TraceAcc differ from traditional rules-based AML systems?', a: 'Rules engines inspect individual transactions in isolation. TraceAcc builds a directed graph network, tracing multi-hop layering paths, circular loops, and community structures across thousands of accounts.' },
            { q: 'What is the DC-LCG model and how is it used?', a: 'DC-LCG is TraceAcc\'s dual-view graph neural network: a local soft-label grouping view plus a pruned random-walk contextual transformer, fused by mutual attention. Analysts train it on labeled CSVs through the model registry; trained artifacts then score every account during analysis as a dedicated dimension, complete with disguise scores and pruned evidence paths.' },
            { q: 'What does the 15-pattern suite cover?', a: 'TraceLab analysts get one Patterns page with 15 automated detectors: 5 basic (cycles, fan-in, fan-out, bursts, structuring), 5 intermediate-to-hard (layered shells, velocity anomalies, night activity, periodic bot-like transfers, dormant-account activation) and 5 advanced ML (DC-LCG GNN, Isolation Forest, LOF, DBSCAN noise, risk-propagation hotspots).' },
            { q: 'What are the four roles in the TraceAcc workflow?', a: 'Client (submits requests), Admin (reviews, assigns, seals), TraceLab analyst (analyzes, detects patterns) and InvoSpace investigator (investigates via cases, evidence and the Intel Hub).' },
            { q: 'How does the digital seal work?', a: 'Admin applies a SHA-256 tamper-evident digital signature to all approved reports before release to the client portal, ensuring complete audit compliance.' },
            { q: 'Is TraceAcc compliant with AML regulations?', a: 'Yes. The platform provides immutable audit trails, role-based access control, digital seals, and comprehensive reporting — supporting AML governance through audit trails, role-based access control, digital seals, and structured reporting; regulatory compliance still depends on deployment, controls, and organizational policy.' }
          ].map((item, idx) => (
            <div key={idx} className={`faq-item ${activeFaq === idx ? 'open' : ''}`} onClick={() => toggleFaq(idx)}>
              <div className="faq-question"><span>{item.q}</span><span>{activeFaq === idx ? '−' : '+'}</span></div>
              <div className="faq-answer"><p>{item.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">T</div>
            <span className="logo-text">Trace<span>Acc</span></span>
            <span className="logo-version-tag">Pro</span>
          </div>
          <p className="footer-tagline">Enterprise AML Intelligence Platform — Detect. Investigate. Govern. Release.</p>
          <div className="footer-links">
            <Link to="/login">Sign In</Link>
            <a href="#">Get Started</a>
            <a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')}>Features</a>
            <a href="#architecture" onClick={(e) => handleSmoothScroll(e, '#architecture')}>Architecture</a>
            <a href="#detection" onClick={(e) => handleSmoothScroll(e, '#detection')}>Detection</a>
            <a href="#faq" onClick={(e) => handleSmoothScroll(e, '#faq')}>FAQ</a>
          </div>
        </div>
        <div className="footer-bottom">© 2026 TraceAcc Pro — Enterprise AML Operations Platform · DC-LCG dual-view GNN and the 15-pattern suite are implemented; remaining advanced modules are marked as roadmap.</div>
      </footer>

      {/* TRUTH BAR */}
      <div className="truth-bar">
        <span className="truth-dot"></span>
        <button onClick={() => setTruthOpen(!truthOpen)}>PROJECT TRUTH · REVIEWER</button>
      </div>

      <div className={`truth-panel ${truthOpen ? 'open' : ''}`}>
        <div className="truth-modal">
          <div className="truth-modal-head">
            <div><span className="section-subtitle">Reviewer transparency</span><h3>What is current vs advanced?</h3></div>
            <button className="truth-close" onClick={() => setTruthOpen(false)}>Close</button>
          </div>
          <div className="truth-grid">
            <div className="truth-item"><b>Current system</b><span>CSV/Excel ingestion, directed graph construction, graph heuristics, unsupervised anomaly models, the DC-LCG dual-view GNN as a supervised scoring dimension, a 15-pattern automated suite and interactive graph presentation.</span></div>
            <div className="truth-item"><b>Detection depth</b><span>Four core graph heuristics plus 21+ detector/analytics modules, organized into a 15-pattern suite (5 basic · 5 intermediate · 5 advanced ML) with an investigator Intel Hub for cross-job dossiers.</span></div>
            <div className="truth-item"><b>Governance</b><span>Role separation, audit logging, auto-stored technical reports, report review/sealing and controlled release are part of the product story.</span></div>
            <div className="truth-item"><b>Advanced research</b><span>Neo4j, Kafka, XAI, Celery/Redis, temporal graph replay and cloud deployment remain the roadmap. DC-LCG has graduated from roadmap to implementation.</span></div>
          </div>
          <p className="truth-note">This panel exists to prevent visual demos from being mistaken for production telemetry. Animated numbers and case replay are illustrative UI simulations; project capability claims are kept separate from them.</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;