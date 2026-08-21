import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import traceAccBadge from '../../assets/traceaccbadge.png';
import workflowArch from '../../assets/workflowarch.png';
import '../../assets/landing.css';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-shell">
      <div className="bg-grid"></div>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>

      {/* Floating Particles */}
      <div className="particles-container">
        {[...Array(25)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${12 + Math.random() * 18}s`,
            animationDelay: `${-Math.random() * 15}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            background: i % 3 === 0 ? 'rgba(167, 139, 250, 0.5)' : 'rgba(96, 165, 250, 0.5)',
          }}></div>
        ))}
      </div>

      {/* Navigation */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-logo">
          <img src={traceAccBadge} alt="Logo" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <span className="logo-text">TraceAcc</span>
          <span className="logo-version-tag">PRO</span>
        </div>
        <div className="nav-links-center">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#detection">Detection</a>
          <a href="#investigation">Investigation</a>
          <a href="#architecture">Architecture</a>
          <a href="#about">About</a>
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn-glass">Sign In</Link>
          <Link to="/login" className="btn-glow">Get Started</Link>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <main className="landing-hero">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7 }} className="hero-badge">
          <span className="badge-pulse"></span>
          Enterprise Anti-Money Laundering Platform
        </motion.div>

        <motion.h1 initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.1 }} className="hero-title">
          Detect. Investigate.<br />
          <span className="text-gradient">Govern. Release.</span>
        </motion.h1>

        <motion.p initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.2 }} className="hero-subtitle">
          TraceAcc Pro unifies the entire AML lifecycle — from client dataset submission through graph-based pattern detection, deep investigation, admin review, digital seal, and final client release — in a single, strictly-governed platform.
        </motion.p>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.3 }} className="hero-cta-group">
          <Link to="/login" className="btn-glow large">Enter Platform →</Link>
          <a href="#architecture" className="btn-glass large">View Architecture</a>
        </motion.div>

        {/* 3D Floating Architecture Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="hero-3d-visual"
        >
          <div className="hero-3d-card">
            <img src={workflowArch} alt="Platform Architecture" style={{ width: '100%', display: 'block', opacity: 0.9 }} />
          </div>
        </motion.div>

        {/* Stats strip */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7, delay: 0.6 }} className="stats-strip">
          {[
            { val: '4', label: 'Distinct Roles' },
            { val: '15+', label: 'Detection Modules' },
            { val: '3', label: 'ML Models' },
            { val: 'SHA-256', label: 'Tamper-Evident Seals' },
          ].map((s, i) => (
            <motion.div key={i} className="stat-item" whileHover={{ scale: 1.1 }}>
              <div className="stat-value">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* ═══════════ FOUR ROLES ═══════════ */}
      <section className="landing-section" id="features">
        <div className="section-header">
          <span className="section-subtitle">Operating Model</span>
          <h2>Four Roles. One Governed Pipeline.</h2>
          <p>Each role has a dedicated workspace with strictly separated responsibilities. No role can bypass the workflow.</p>
        </div>
        <div className="feature-grid">
          {[
            { icon: '📋', title: 'Client Portal', desc: 'Submit service requests with CSV/Excel datasets. Track request status. Download only Admin-approved and digitally sealed final reports.', pill: 'CLIENT', color: '#10B981' },
            { icon: '⚙️', title: 'Admin Operations Hub', desc: 'Accept/reject client requests. Assign work to TraceLab or InvoSpace. Review reports. Apply a tamper-evident SHA-256 digital seal. Release to client.', pill: 'ADMIN', color: '#3B82F6' },
            { icon: '🔬', title: 'TraceLab Analysis', desc: 'Validate datasets. Run graph analysis, pattern detection, ML scoring. Generate findings & technical reports. Escalate suspicious alerts.', pill: 'ANALYST', color: '#8B5CF6' },
            { icon: '🛡️', title: 'InvoSpace Investigation', desc: 'Convert alerts to cases. Deep investigation: Entity 360, multi-hop tracing, evidence, hypotheses, findings, timeline. Generate investigation reports.', pill: 'INVOSPACE', color: '#F59E0B' },
          ].map((f, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }} whileHover={{ y: -8 }} className="feature-card">
              <div className="feature-icon" style={{ background: `${f.color}15`, color: f.color }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="feature-pill" style={{ color: f.color, borderColor: `${f.color}30` }}>{f.pill}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ WORKFLOW PIPELINE ═══════════ */}
      <section className="landing-section" id="workflow" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', maxWidth: '100%', padding: '120px 48px' }}>
        <div className="section-header">
          <span className="section-subtitle">Workflow Pipeline</span>
          <h2>End-to-End AML Operations Flow</h2>
          <p>From client dataset submission to final report release — every step is audited and governed.</p>
        </div>
        <div className="workflow-timeline">
          {[
            { num: '01', title: 'Client Submits Request', desc: 'Client uploads CSV/Excel dataset with transaction details and metadata into the admin-controlled intake queue.', color: '#10B981' },
            { num: '02', title: 'Admin Reviews & Assigns', desc: 'Admin accepts or rejects the request, then assigns it to TraceLab (for analysis) or InvoSpace (for investigation) based on priority.', color: '#3B82F6' },
            { num: '03', title: 'TraceLab Performs Analysis', desc: 'Analyst validates dataset, runs graph analysis (DFS cycle detection, fan-in/out, layering), behaviour analysis, temporal analysis, ML models, and risk scoring.', color: '#8B5CF6' },
            { num: '04', title: 'Analyst Decision Point', desc: 'If low/no risk → Technical Report. If suspicious activity detected → Alert is auto-generated and escalated to Admin, who routes it to InvoSpace for deep investigation.', color: '#EF4444' },
            { num: '05', title: 'InvoSpace Deep Investigation', desc: 'Investigator creates a case from the alert. Conducts Entity 360 analysis, multi-hop tracing, evidence collection, hypothesis testing, timeline building, and generates investigation report.', color: '#F59E0B' },
            { num: '06', title: 'Admin Review, Seal & Release', desc: 'Admin collects all reports, reviews them, applies digital signature/seal (TraceAcc badge watermark), and releases only approved reports to the client portal.', color: '#10B981' },
          ].map((step, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }}
              className="workflow-step" style={{ borderLeft: `2px solid ${step.color}30` }}>
              <div className="workflow-dot" style={{ background: step.color, boxShadow: `0 0 14px ${step.color}80` }} />
              <div>
                <div className="workflow-step-num" style={{ color: step.color }}>STEP {step.num}</div>
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ DETECTION ENGINE ═══════════ */}
      <section className="landing-section" id="detection">
        <div className="section-header">
          <span className="section-subtitle">TraceLab Detection Engine</span>
          <h2>Multi-Heuristic AML Pattern Detection</h2>
          <p>TraceAcc employs 7+ graph-based heuristics and 3+ ML models to detect sophisticated money laundering patterns.</p>
        </div>
        <div className="detection-grid">
          {[
            { title: 'DFS Cycle Detection', desc: 'Depth-First Search restricted to 3-4 hops finds circular mule rings (A→B→C→A). Lexicographic pruning prevents duplicate counting.', tag: 'Graph Heuristic', color: '#EF4444' },
            { title: 'Fan-In / Fan-Out Analysis', desc: 'Identifies accounts receiving from many sources (fan-in / smurfing) or distributing to many targets (fan-out / layering).', tag: 'Graph Heuristic', color: '#F59E0B' },
            { title: 'Layering Chain Detection', desc: 'DFS-based multi-hop tracing reveals layering chains where funds pass through intermediaries to obscure the origin.', tag: 'Graph Heuristic', color: '#8B5CF6' },
            { title: 'Burst / Dormancy Detection', desc: 'Detects accounts that suddenly activate after long periods of dormancy — a classic mule activation pattern.', tag: 'Temporal Heuristic', color: '#3B82F6' },
            { title: 'Structuring / Smurfing', desc: 'Identifies transactions deliberately kept under reporting thresholds (e.g., multiple $9,900 transfers instead of one $50,000).', tag: 'Behaviour Heuristic', color: '#10B981' },
            { title: 'Rapid Pass-Through', desc: 'Flags accounts that receive and forward funds within very short time windows — hallmark of money mule behaviour.', tag: 'Temporal Heuristic', color: '#EC4899' },
            { title: 'Isolation Forest (ML)', desc: 'Unsupervised anomaly detection model that isolates outlier transaction behaviour without requiring labelled training data.', tag: 'Machine Learning', color: '#6366F1' },
            { title: 'GNN Node Classification', desc: 'Graph Neural Networks learn structural patterns directly from the transaction graph, classifying nodes as suspicious or normal.', tag: 'Advanced ML', color: '#14B8A6' },
            { title: 'Hybrid Risk Scoring', desc: 'Weighted aggregation of all heuristic and ML signals into a final 0-100 composite risk score per entity.', tag: 'Scoring Engine', color: '#F97316' },
          ].map((d, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }} className="detection-card">
              <div className="detection-tag" style={{ background: `${d.color}15`, color: d.color }}>{d.tag}</div>
              <h4>{d.title}</h4>
              <p>{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ INVOSPACE INVESTIGATION ═══════════ */}
      <section className="landing-section" id="investigation" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', maxWidth: '100%', padding: '120px 48px' }}>
        <div className="section-header">
          <span className="section-subtitle">InvoSpace Deep Investigation</span>
          <h2>Comprehensive Case Management</h2>
          <p>InvoSpace provides investigators with advanced tools for deep AML investigations with full evidence tracking.</p>
        </div>
        <div className="investigation-grid">
          {[
            { icon: '🔍', title: 'Entity 360 View', desc: 'Complete profile of persons, accounts, organizations with all associated transactions and relationships.' },
            { icon: '🕸️', title: 'Investigation Graph', desc: 'Interactive network visualization of entities and their connections, revealing hidden relationships.' },
            { icon: '🔗', title: 'Multi-Hop Tracing', desc: 'Follow money trails across multiple intermediary accounts to trace the full laundering path.' },
            { icon: '📎', title: 'Evidence Management', desc: 'Upload, organize, and track evidence documents and attachments linked to each case.' },
            { icon: '💡', title: 'Hypothesis Testing', desc: 'Formulate and test investigative hypotheses with supporting evidence and findings.' },
            { icon: '📋', title: 'Task Management', desc: 'Create, assign, and track investigation tasks within each case for team coordination.' },
            { icon: '🔬', title: 'Advanced ML/GNN Analysis', desc: 'Leverage graph neural networks and ML models for deeper pattern recognition during investigation.' },
            { icon: '⏱️', title: 'Investigation Timeline', desc: 'Chronological record of all events, actions, findings, and decisions throughout the investigation.' },
            { icon: '📊', title: 'Risk Reassessment', desc: 'Re-evaluate risk scores with new evidence and findings from the deep investigation.' },
            { icon: '📝', title: 'Investigation Report', desc: 'Generate comprehensive investigation reports with findings, evidence summary, and recommendations.' },
            { icon: '🔄', title: 'Similar Investigations', desc: 'Link and reference related past investigations for pattern recognition across cases.' },
            { icon: '🎯', title: 'SAR Decision Support', desc: 'Support Suspicious Activity Report filing decisions with automated evidence compilation.' },
          ].map((item, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.04 }} className="investigation-item" whileHover={{ scale: 1.02 }}>
              <div className="inv-icon">{item.icon}</div>
              <div>
                <div className="inv-title">{item.title}</div>
                <div className="inv-desc">{item.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ ARCHITECTURE DIAGRAM ═══════════ */}
      <section className="landing-section" id="architecture">
        <div className="section-header">
          <span className="section-subtitle">System Architecture</span>
          <h2>TraceAcc Pro Workflow Architecture</h2>
          <p>The complete system architecture showing the governed flow from client intake through analysis, investigation, review, seal, and release.</p>
        </div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          style={{ maxWidth: 900, margin: '0 auto', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 40px rgba(37,99,235,0.08)' }}>
          <img src={workflowArch} alt="TraceAcc Pro Architecture" style={{ width: '100%', display: 'block' }} />
        </motion.div>
      </section>

      {/* ═══════════ TECH STACK ═══════════ */}
      <section className="landing-section" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', maxWidth: '100%', padding: '120px 48px' }}>
        <div className="section-header">
          <span className="section-subtitle">Technology Stack</span>
          <h2>Built for Enterprise AML Operations</h2>
        </div>
        <div className="tech-grid">
          {[
            { label: 'Backend', items: 'Python · FastAPI · SQLAlchemy · Alembic' },
            { label: 'Frontend', items: 'React · Vite · Bootstrap · Framer Motion' },
            { label: 'Graph Analysis', items: 'NetworkX · Cytoscape.js · DFS/BFS' },
            { label: 'ML / AI', items: 'Isolation Forest · LOF · DBSCAN · Hybrid Fusion' },
            { label: 'Security', items: 'JWT · RBAC · OTP · CAPTCHA · Audit Logs' },
            { label: 'Database', items: 'SQLite/PostgreSQL · Alembic Migrations' },
          ].map((t, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.08 }} className="tech-card">
              <div className="tech-label">{t.label}</div>
              <div className="tech-items">{t.items}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ ABOUT THE PROJECT ═══════════ */}
      <section className="landing-section" id="about">
        <div className="section-header">
          <span className="section-subtitle">About the Project</span>
          <h2>TraceAcc Pro — Research & Implementation</h2>
        </div>
        <div className="about-content">
          <p>
            <strong>TraceAcc Pro</strong> is an enterprise-grade Anti-Money Laundering (AML) detection, analysis, investigation, and reporting platform. It was developed as a comprehensive full-stack implementation of modern AML operations principles.
          </p>
          <p>
            The platform implements a <strong className="highlight">four-role model</strong> (Client, Admin, TraceLab Analyst, InvoSpace Investigator) with strict role-based access control (RBAC) where the Admin serves as the central communication and operations hub.
          </p>
          <p>
            The detection engine leverages <strong className="highlight">graph-based heuristics</strong> including DFS cycle detection for circular mule rings, fan-in/fan-out analysis for smurfing patterns, layering chain detection via multi-hop DFS traversal, and burst/dormancy detection for mule activation patterns. These are complemented by <strong className="highlight">machine learning models</strong> including Isolation Forest for unsupervised anomaly detection and Graph Neural Networks (GNN) for node classification.
          </p>
          <p>
            The investigation module (InvoSpace) provides <strong className="highlight">deep investigation capabilities</strong> including Entity 360 views, investigation graphs, multi-hop tracing, evidence management, hypothesis testing, and comprehensive investigation reporting.
          </p>
          <p>
            All reports undergo a governed review process where the Admin applies a <strong className="highlight">digital signature and seal</strong> before release to the client portal, ensuring complete audit compliance.
          </p>

          <div className="about-grid">
            <div className="about-box" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <h4 style={{ color: '#60A5FA' }}>Business Rules</h4>
              <ul>
                <li>Client never contacts TraceLab or InvoSpace directly</li>
                <li>Admin is the sole communication hub</li>
                <li>TraceLab creates Alerts, not Cases</li>
                <li>Only InvoSpace creates Investigation Cases</li>
                <li>All reports return to Admin for review</li>
                <li>Clients only receive sealed, approved reports</li>
              </ul>
            </div>
            <div className="about-box" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <h4 style={{ color: '#A78BFA' }}>Key Features</h4>
              <ul>
                <li>Multi-heuristic weighted risk scoring (0-100)</li>
                <li>Real-time transaction graph visualization</li>
                <li>Governed workflow with immutable audit trail</li>
                <li>Digital seal & signature on released reports</li>
                <li>Role-based workspace separation</li>
                <li>OTP-based two-factor authentication for clients</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER CTA ═══════════ */}
      <section className="footer-cta">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <h2>
            Ready to secure your <span className="text-gradient">AML operations</span>?
          </h2>
          <p>Sign in to access your workspace or create a client account to get started.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link to="/login" className="btn-glow large">Sign In →</Link>
          </div>
          <div className="footer-note">
            © 2026 TraceAcc Pro — Enterprise AML Operations Platform
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default LandingPage;
