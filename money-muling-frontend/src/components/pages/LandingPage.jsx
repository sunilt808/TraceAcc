// src/components/landing/LandingPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import traceAccBadge from '../../assets/traceaccbadge.png';
import '../../assets/landing.css';

// ──────────────────── ANIMATIONS ────────────────────
const fadeUp = { 
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' }, 
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } 
};

const fadeIn = { 
  hidden: { opacity: 0 }, 
  visible: { opacity: 1, transition: { duration: 0.6 } } 
};

const stagger = { 
  hidden: { opacity: 0 }, 
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } } 
};

const slideIn = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

// ──────────────────── COUNTER ────────────────────
function Counter({ to, duration = 2, decimals = 0, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start, raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return <span ref={ref}>{prefix}{value.toFixed(decimals)}{suffix}</span>;
}

// ──────────────────── 3D NETWORK CANVAS ────────────────────
function NetworkCanvas({ height = 480 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    rotY: 0,
    rotX: -0.1,
    targetRotY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    velocityY: 0.002,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, width, height, dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── Build Network ──
    const NODE_COUNT = 52;
    const nodes = [];
    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    // Create clusters
    const clusters = [
      { center: { x: 0, y: 0, z: 0 }, count: 15, radius: 80 },
      { center: { x: 120, y: 60, z: 40 }, count: 12, radius: 60 },
      { center: { x: -100, y: -40, z: 80 }, count: 10, radius: 55 },
      { center: { x: 60, y: -80, z: -60 }, count: 8, radius: 50 },
      { center: { x: -80, y: 70, z: -50 }, count: 7, radius: 45 },
    ];

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i++) {
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        const r = cluster.radius * (0.3 + rand() * 0.7);
        nodes.push({
          x: cluster.center.x + r * Math.sin(phi) * Math.cos(theta),
          y: cluster.center.y + r * Math.cos(phi) * 0.7,
          z: cluster.center.z + r * Math.sin(phi) * Math.sin(theta),
          suspicious: rand() > 0.85,
          pulse: rand() * Math.PI * 2,
          size: 2.5 + rand() * 2.5,
          cluster: clusters.indexOf(cluster),
        });
      }
    }

    // Edges with cluster preference
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const sameCluster = nodes[i].cluster === nodes[j].cluster;
        const threshold = sameCluster ? 110 : 150;
        if (dist < threshold && edges.length < 90) {
          edges.push({ a: i, b: j, strength: sameCluster ? 1 : 0.5 });
        }
      }
    }

    // Packets
    const packets = Array.from({ length: 20 }, (_, k) => ({
      edge: Math.floor(rand() * edges.length),
      t: rand(),
      speed: 0.0015 + rand() * 0.005,
      dir: rand() > 0.5 ? 1 : -1,
      hue: k % 4 === 0 ? '248,81,73' : k % 4 === 1 ? '56,189,248' : k % 4 === 2 ? '139,92,246' : '52,211,153',
      size: 2 + rand() * 2,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const st = stateRef.current;
    const onDown = (e) => {
      st.dragging = true;
      st.lastX = e.clientX ?? e.touches?.[0]?.clientX;
      st.lastY = e.clientY ?? e.touches?.[0]?.clientY;
    };
    const onMove = (e) => {
      if (!st.dragging) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      st.targetRotY += (cx - st.lastX) * 0.005;
      st.rotX = Math.max(-0.8, Math.min(0.8, st.rotX + (cy - st.lastY) * 0.003));
      st.velocityY = 0;
      st.lastX = cx;
      st.lastY = cy;
    };
    const onUp = () => { st.dragging = false; st.velocityY = 0.002; };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('touchend', onUp);

    const project = (x, y, z, rotY, rotX) => {
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      let x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      let y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
      const persp = 680 / (680 + z2 + 200);
      return { sx: width/2 + x1*persp, sy: height/2 + y1*persp, scale: persp, depth: z2 };
    };

    const draw = () => {
      st.rotY += st.velocityY;
      st.rotY += (st.targetRotY - st.rotY) * 0.06;

      ctx.clearRect(0, 0, width, height);
      
      // Ambient glow
      const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width*0.6);
      grad.addColorStop(0, 'rgba(34,211,238,0.03)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const time = performance.now() / 1000;
      const projected = nodes.map(n => project(n.x, n.y, n.z, st.rotY, st.rotX));

      // ── Edges ──
      for (const e of edges) {
        const pa = projected[e.a], pb = projected[e.b];
        const depthFade = Math.max(0.05, Math.min(1, ((pa.scale + pb.scale)/2 - 0.4) * 1.8));
        const alpha = 0.15 * depthFade * e.strength;
        const grad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
        grad.addColorStop(0, `rgba(56,189,248,${alpha})`);
        grad.addColorStop(0.5, `rgba(139,92,246,${alpha * 0.7})`);
        grad.addColorStop(1, `rgba(56,189,248,${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8 * depthFade * e.strength + 0.3;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }

      // ── Packets ──
      for (const p of packets) {
        p.t += p.speed * p.dir;
        if (p.t > 1 || p.t < 0) { p.edge = Math.floor(Math.random() * edges.length); p.t = p.dir > 0 ? 0 : 1; }
        const e = edges[p.edge];
        if (!e) continue;
        const pa = projected[e.a], pb = projected[e.b];
        const px = pa.sx + (pb.sx - pa.sx) * p.t;
        const py = pa.sy + (pb.sy - pa.sy) * p.t;
        const fade = Math.max(0.1, Math.min(1, ((pa.scale + pb.scale)/2 - 0.4) * 1.8));
        
        ctx.shadowColor = `rgba(${p.hue},0.8)`;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(px, py, p.size * fade, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue},${0.7 * fade})`;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Trail
        ctx.beginPath();
        ctx.arc(px - (pb.sx - pa.sx) * 0.03, py - (pb.sy - pa.sy) * 0.03, p.size * fade * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue},${0.2 * fade})`;
        ctx.fill();
      }

      // ── Nodes ──
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const p = projected[i];
        const baseR = n.size * p.scale;
        const pulse = 1 + Math.sin(time * 1.5 + n.pulse) * 0.12;
        const alpha = Math.max(0.2, Math.min(1, (p.scale - 0.3) * 1.5));

        // Glow
        ctx.shadowColor = n.suspicious ? `rgba(248,81,73,${0.4 * alpha})` : `rgba(56,189,248,${0.3 * alpha})`;
        ctx.shadowBlur = 30 * p.scale;

        // Suspicious ring
        if (n.suspicious) {
          ctx.shadowBlur = 0;
          for (let ring = 0; ring < 3; ring++) {
            const rSize = baseR * (2.5 + ring * 0.8) * pulse;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, rSize, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(248,81,73,${0.08 * alpha * (1 - ring * 0.25)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.shadowColor = `rgba(248,81,73,${0.5 * alpha})`;
          ctx.shadowBlur = 25 * p.scale;
        }

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, baseR * pulse, 0, Math.PI * 2);
        ctx.fillStyle = n.suspicious 
          ? `rgba(248,81,73,${alpha})` 
          : `rgba(125,211,252,${alpha * 0.7})`;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner highlight
        ctx.beginPath();
        ctx.arc(p.sx - baseR * 0.2, p.sy - baseR * 0.2, baseR * 0.3 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = n.suspicious 
          ? `rgba(255,255,255,${0.15 * alpha})` 
          : `rgba(255,255,255,${0.2 * alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, display: 'block', cursor: 'grab', touchAction: 'none' }}
    />
  );
}

// ──────────────────── TILT CARD ────────────────────
function TiltCard({ children, max = 8, className = '' }) {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(8px)`;
    el.style.setProperty('--glare-x', `${(px + 0.5) * 100}%`);
    el.style.setProperty('--glare-y', `${(py + 0.5) * 100}%`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0)';
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      style={{ transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <div className="tilt-glare" />
    </div>
  );
}

// ──────────────────── SCROLL PROGRESS ────────────────────
function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress((scrollTop / docHeight) * 100);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <div className="scroll-progress" style={{ width: `${progress}%` }} />;
}

// ──────────────────── MAIN ────────────────────
function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
      const sections = ['home', 'features', 'workflow', 'detection', 'investigation', 'architecture'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) setActiveSection(section);
        }
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'detection', label: 'Detection' },
    { id: 'investigation', label: 'Investigation' },
    { id: 'architecture', label: 'Architecture' },
  ];

  // ── Data ──
  const roles = [
    { icon: '📋', title: 'Client Portal', desc: 'Submit requests with CSV/Excel. Track status. Download sealed reports.', pill: 'CLIENT', color: '#10B981' },
    { icon: '⚙️', title: 'Admin Hub', desc: 'Review, assign, apply SHA-256 seal, release reports to clients.', pill: 'ADMIN', color: '#3B82F6' },
    { icon: '🔬', title: 'TraceLab', desc: 'Validate data, graph analysis, ML scoring, alert generation.', pill: 'ANALYST', color: '#8B5CF6' },
    { icon: '🛡️', title: 'InvoSpace', desc: 'Entity 360, multi-hop tracing, evidence, case reporting.', pill: 'INVOSPACE', color: '#F59E0B' },
  ];

  const detectionModules = [
    { title: 'DFS Cycle Detection', desc: 'Finds circular mule rings (A→B→C→A).', tag: 'Graph', color: '#EF4444' },
    { title: 'Fan-In / Fan-Out', desc: 'Identifies smurfing and layering patterns.', tag: 'Graph', color: '#F59E0B' },
    { title: 'Layering Chain', desc: 'Multi-hop DFS tracing through intermediaries.', tag: 'Graph', color: '#8B5CF6' },
    { title: 'Burst Detection', desc: 'Sudden activation after dormancy.', tag: 'Temporal', color: '#3B82F6' },
    { title: 'Structuring', desc: 'Transactions kept under reporting thresholds.', tag: 'Behaviour', color: '#10B981' },
    { title: 'Rapid Pass-Through', desc: 'Receive and forward in short windows.', tag: 'Temporal', color: '#EC4899' },
    { title: 'Isolation Forest', desc: 'Unsupervised anomaly detection.', tag: 'ML', color: '#6366F1' },
    { title: 'GNN Classification', desc: 'Graph Neural Networks for node classification.', tag: 'ML', color: '#14B8A6' },
    { title: 'Hybrid Risk Scoring', desc: 'Weighted aggregation into 0-100 score.', tag: 'Scoring', color: '#F97316' },
  ];

  const workflowSteps = [
    { num: '01', title: 'Client Submits Request', desc: 'Upload CSV/Excel dataset into admin queue.', color: '#10B981' },
    { num: '02', title: 'Admin Reviews & Assigns', desc: 'Accept/reject, assign to TraceLab or InvoSpace.', color: '#3B82F6' },
    { num: '03', title: 'TraceLab Analysis', desc: 'Validation, graph analysis, ML, risk scoring.', color: '#8B5CF6' },
    { num: '04', title: 'Decision Point', desc: 'Low risk → Report. Suspicious → Alert → InvoSpace.', color: '#EF4444' },
    { num: '05', title: 'InvoSpace Investigation', desc: 'Entity 360, tracing, evidence, report.', color: '#F59E0B' },
    { num: '06', title: 'Admin Review, Seal & Release', desc: 'Review, digital seal, release to client.', color: '#10B981' },
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

  return (
    <div className="landing-shell">
      <ScrollProgress />

      {/* ─── Background ─── */}
      <div className="bg-grid"></div>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>
      <div className="bg-orb orb-4"></div>

      {/* ─── Particles ─── */}
      <div className="particles-container">
        {[...Array(40)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${10 + Math.random() * 20}s`,
            animationDelay: `${-Math.random() * 18}s`,
            width: `${1 + Math.random() * 3}px`,
            height: `${1 + Math.random() * 3}px`,
            background: i % 4 === 0 ? 'rgba(167, 139, 250, 0.3)' : 
                        i % 4 === 1 ? 'rgba(56, 189, 248, 0.3)' :
                        i % 4 === 2 ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.2)',
          }}></div>
        ))}
      </div>

      {/* ─── Navigation ─── */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-logo">
          <div className="logo-icon">
            <img src={traceAccBadge} alt="Logo" />
          </div>
          <span className="logo-text">TraceAcc</span>
          <span className="logo-version-tag">PRO</span>
        </div>
        <div className="nav-links-center">
          {navLinks.map((link) => (
            <a 
              key={link.id} 
              href={`#${link.id}`}
              className={activeSection === link.id ? 'active' : ''}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn-ghost">Sign In</Link>
          <Link to="/login" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <main className="landing-hero" id="home">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="hero-badge">
          <span className="badge-pulse"></span>
          <span>Enterprise AML Platform</span>
          <span className="badge-separator">·</span>
          <span className="badge-version">v3.0</span>
        </motion.div>

        <motion.h1 initial="hidden" animate="visible" variants={fadeUp} className="hero-title">
          Detect. Investigate.<br />
          <span className="text-gradient">Govern. Release.</span>
        </motion.h1>

        <motion.p initial="hidden" animate="visible" variants={fadeUp} className="hero-subtitle">
          TraceAcc Pro unifies the entire AML lifecycle — from client dataset submission through 
          graph-based pattern detection, deep investigation, admin review, digital seal, 
          and final client release in a single governed platform.
        </motion.p>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="hero-cta-group">
          <Link to="/login" className="btn-primary large">
            <span>Enter Platform</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
          <a href="#architecture" className="btn-secondary large">View Architecture</a>
        </motion.div>

        {/* ── 3D Network ── */}
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="hero-graph-wrapper"
        >
          <div className="hero-graph-container">
            <NetworkCanvas height={460} />
            <div className="graph-overlay-gradient"></div>
            <div className="graph-stats">
              <div className="graph-stat">
                <span className="graph-stat-value">52</span>
                <span className="graph-stat-label">Nodes</span>
              </div>
              <div className="graph-stat-divider"></div>
              <div className="graph-stat">
                <span className="graph-stat-value">90</span>
                <span className="graph-stat-label">Connections</span>
              </div>
              <div className="graph-stat-divider"></div>
              <div className="graph-stat">
                <span className="graph-stat-value">4</span>
                <span className="graph-stat-label">Clusters</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="stats-strip">
          {[
            { val: 4, label: 'Roles' },
            { val: 15, label: 'Detection Modules', suffix: '+' },
            { val: 3, label: 'ML Models' },
            { val: 99.9, label: 'Accuracy', suffix: '%' },
            { val: 256, label: 'SHA-256 Seals' },
          ].map((s, i) => (
            <motion.div key={i} className="stat-item" whileHover={{ y: -4 }}>
              <div className="stat-value"><Counter to={s.val} suffix={s.suffix || ''} /></div>
              <div className="stat-label">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="landing-section features-section" id="features">
        <div className="section-header">
          <motion.span initial="hidden" whileInView="visible" variants={fadeIn} className="section-subtitle">Roles</motion.span>
          <motion.h2 initial="hidden" whileInView="visible" variants={fadeUp}>Four Roles. One Pipeline.</motion.h2>
          <motion.p initial="hidden" whileInView="visible" variants={fadeUp}>Each role has a dedicated workspace with strictly separated responsibilities.</motion.p>
        </div>
        <motion.div initial="hidden" whileInView="visible" variants={stagger} className="feature-grid">
          {roles.map((f, i) => (
            <TiltCard key={i} max={10}>
              <motion.div variants={fadeUp} className="feature-card">
                <div className="feature-icon" style={{ background: `${f.color}12`, color: f.color }}>
                  <span>{f.icon}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="feature-pill" style={{ color: f.color, borderColor: `${f.color}25` }}>{f.pill}</span>
              </motion.div>
            </TiltCard>
          ))}
        </motion.div>
      </section>

      {/* ═══════════ WORKFLOW ═══════════ */}
      <section className="landing-section workflow-section" id="workflow">
        <div className="section-header">
          <motion.span initial="hidden" whileInView="visible" variants={fadeIn} className="section-subtitle">Workflow</motion.span>
          <motion.h2 initial="hidden" whileInView="visible" variants={fadeUp}>End-to-End AML Operations</motion.h2>
          <motion.p initial="hidden" whileInView="visible" variants={fadeUp}>Every step is audited and governed from submission to release.</motion.p>
        </div>
        <div className="workflow-timeline">
          {workflowSteps.map((step, i) => (
            <motion.div
              key={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.08 }}
              className="workflow-step"
            >
              <div className="workflow-line" style={{ background: step.color }}>
                <div className="workflow-dot" style={{ background: step.color, boxShadow: `0 0 20px ${step.color}60` }} />
              </div>
              <div className="workflow-content">
                <div className="workflow-step-num" style={{ color: step.color }}>STEP {step.num}</div>
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ DETECTION ═══════════ */}
      <section className="landing-section detection-section" id="detection">
        <div className="section-header">
          <motion.span initial="hidden" whileInView="visible" variants={fadeIn} className="section-subtitle">Detection</motion.span>
          <motion.h2 initial="hidden" whileInView="visible" variants={fadeUp}>Multi-Heuristic Pattern Detection</motion.h2>
          <motion.p initial="hidden" whileInView="visible" variants={fadeUp}>7+ graph heuristics and 3+ ML models for sophisticated AML detection.</motion.p>
        </div>
        <motion.div initial="hidden" whileInView="visible" variants={stagger} className="detection-grid">
          {detectionModules.map((d, i) => (
            <TiltCard key={i} max={6}>
              <motion.div variants={fadeUp} className="detection-card">
                <div className="detection-tag" style={{ background: `${d.color}12`, color: d.color }}>{d.tag}</div>
                <h4>{d.title}</h4>
                <p>{d.desc}</p>
                <div className="detection-hover-glow" style={{ background: `radial-gradient(circle at 50% 0%, ${d.color}15, transparent 70%)` }} />
              </motion.div>
            </TiltCard>
          ))}
        </motion.div>
      </section>

      {/* ═══════════ INVESTIGATION ═══════════ */}
      <section className="landing-section investigation-section" id="investigation">
        <div className="section-header">
          <motion.span initial="hidden" whileInView="visible" variants={fadeIn} className="section-subtitle">Investigation</motion.span>
          <motion.h2 initial="hidden" whileInView="visible" variants={fadeUp}>Deep Case Management</motion.h2>
          <motion.p initial="hidden" whileInView="visible" variants={fadeUp}>Advanced tools for deep AML investigations with full evidence tracking.</motion.p>
        </div>
        <motion.div initial="hidden" whileInView="visible" variants={stagger} className="investigation-grid">
          {investigationItems.map((item, i) => (
            <motion.div key={i} variants={fadeUp} className="investigation-item">
              <div className="inv-icon">{item.icon}</div>
              <div className="inv-title">{item.title}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════ ARCHITECTURE ═══════════ */}
      <section className="landing-section architecture-section" id="architecture">
        <div className="section-header">
          <motion.span initial="hidden" whileInView="visible" variants={fadeIn} className="section-subtitle">Architecture</motion.span>
          <motion.h2 initial="hidden" whileInView="visible" variants={fadeUp}>Complete Workflow Architecture</motion.h2>
          <motion.p initial="hidden" whileInView="visible" variants={fadeUp}>Governed flow from client intake through analysis, investigation, review, and release.</motion.p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="arch-container"
        >
          {/* ── Client ── */}
          <div className="arch-row">
            <div className="arch-label client">👤 Client</div>
            <div className="arch-card client-card">
              <div className="arch-title">📋 Submit Request</div>
              <div className="arch-tags">
                <span className="arch-tag">CSV/Excel</span>
                <span className="arch-tag">Validation</span>
                <span className="arch-tag">Quality Check</span>
                <span className="arch-tag">History</span>
              </div>
            </div>
          </div>

          <div className="arch-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </div>

          {/* ── Admin ── */}
          <div className="arch-row">
            <div className="arch-label admin">⚙️ Admin</div>
            <div className="arch-card admin-card">
              <div className="arch-title">📥 Review & Assign</div>
              <div className="arch-tags">
                <span className="arch-tag">Review</span>
                <span className="arch-tag">Validate</span>
                <span className="arch-tag">Priority</span>
              </div>
              <div className="arch-decision">
                <span className="arch-decision-yes">✓ Accept</span>
                <span className="arch-decision-no">✗ Reject</span>
              </div>
            </div>
          </div>

          <div className="arch-split">
            <div className="arch-split-line"></div>
            <div className="arch-split-text">ASSIGN</div>
            <div className="arch-split-line"></div>
          </div>

          {/* ── TraceLab & InvoSpace ── */}
          <div className="arch-two-col">
            <div className="arch-col">
              <div className="arch-label tracelab">🔬 TraceLab</div>
              <div className="arch-card tracelab-card">
                <div className="arch-title">📊 Analysis</div>
                <div className="arch-tags">
                  <span className="arch-tag">Validation</span>
                  <span className="arch-tag">Transaction</span>
                  <span className="arch-tag">Pattern</span>
                  <span className="arch-tag">Graph</span>
                  <span className="arch-tag">ML</span>
                </div>
                <div className="arch-decision">
                  <span className="arch-decision-yes">✓ Report</span>
                  <span className="arch-decision-warn">⚠ Alert</span>
                </div>
              </div>
            </div>

            <div className="arch-col">
              <div className="arch-label invospace">🛡️ InvoSpace</div>
              <div className="arch-card invospace-card">
                <div className="arch-title">🔍 Investigation</div>
                <div className="arch-tags">
                  <span className="arch-tag">Entity 360</span>
                  <span className="arch-tag">Multi-Hop</span>
                  <span className="arch-tag">Evidence</span>
                  <span className="arch-tag">Hypothesis</span>
                  <span className="arch-tag">Report</span>
                </div>
              </div>
            </div>
          </div>

          <div className="arch-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </div>

          {/* ── Admin Final ── */}
          <div className="arch-row">
            <div className="arch-label admin">⚙️ Admin</div>
            <div className="arch-card admin-card">
              <div className="arch-title">🔐 Seal & Release</div>
              <div className="arch-tags">
                <span className="arch-tag">Review</span>
                <span className="arch-tag">Approve</span>
                <span className="arch-tag">SHA-256</span>
              </div>
              <div className="arch-seal">
                <span className="arch-seal-icon">🔒</span>
                <span className="arch-seal-text">Tamper-Evident Seal</span>
              </div>
            </div>
          </div>

          <div className="arch-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </div>

          {/* ── Final ── */}
          <div className="arch-row final">
            <div className="arch-label final">📤 Client</div>
            <div className="arch-card final-card">
              <div className="arch-title">📄 Final Report</div>
              <div className="arch-tags">
                <span className="arch-tag">Approved</span>
                <span className="arch-tag">Tamper-Evident</span>
                <span className="arch-tag">Downloadable</span>
              </div>
              <div className="arch-final-badge">✓ RELEASED</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <section className="footer-cta">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <div className="footer-cta-content">
            <span className="footer-cta-badge">Get Started</span>
            <h2>Ready to secure your <span className="text-gradient">AML operations</span>?</h2>
            <p>Join leading financial institutions using TraceAcc Pro.</p>
            <div className="footer-cta-actions">
              <Link to="/login" className="btn-primary large">
                <span>Start Free Trial</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <Link to="/contact" className="btn-secondary large">Contact Sales</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Security</a>
              <a href="#">Support</a>
            </div>
            <div className="footer-note">© 2026 TraceAcc Pro — Enterprise AML Platform</div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default LandingPage;