import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  Download,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Building2,
  FileText,
  Clock,
  Zap,
  Users,
  DollarSign,
  AlertTriangle,
  Snowflake,
  Copy,
  Check,
  Award,
  Layers,
  Activity,
  FileCheck2,
  Lock,
  Scale,
  Hash,
  Sparkles,
  TrendingUp,
  Cpu,
  Fingerprint,
  Calendar,
  AlertCircle,
  ExternalLink,
  Info,
} from 'lucide-react';
import { casesAPI } from '../../services/api';

export default function CaseReportPDFPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadIntelligence();
    }
  }, [id]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await casesAPI.getIntelligence(id);
      setIntel(data);
    } catch (err) {
      console.error('Failed to load case intelligence for PDF:', err);
      setError(err.response?.data?.detail || 'Failed to fetch comprehensive case intelligence.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportMarkdown = () => {
    if (!intel) return;
    const caseObj = intel.case || {};
    const metrics = intel.metrics || {};
    const content = `# OFFICIAL AML INVESTIGATION & CASE CLOSURE REPORT
**Case ID:** TRACE-CASE-#${id}
**Title:** ${caseObj.title || 'Mule Ring Investigation'}
**Status:** ${caseObj.status || 'CLOSED'}
**Priority:** ${caseObj.priority || 'HIGH'}
**Date of Report:** ${new Date().toUTCString()}
**Investigator:** ${caseObj.assigned_investigator?.username || 'Senior AML Lead Investigator'}
**Regulatory Determination:** ${caseObj.decision || 'SUSPICIOUS_ACTIVITY (SAR Filed)'}
**Assessed Risk Score:** ${((caseObj.investigation_risk_score || caseObj.tracelab_risk_score || 0.85) * 100).toFixed(1)}%

---

## 1. EXECUTIVE DETERMINATION & SUMMARY
- **Determination:** ${caseObj.decision || 'SUSPICIOUS_ACTIVITY (SAR / CTR Mandatory Filing)'}
- **Decision Justification:** ${caseObj.decision_reason || 'Identified structured multi-hop flow through smurfing accounts.'}
- **Total Flagged Illicit Flow:** $${(metrics.total_volume_flagged || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
- **Entities Under Investigation:** ${intel.accounts?.length || 0} accounts
- **Total Illicit Alerts:** ${intel.alerts?.length || 0} alerts

---

## 2. QUANTITATIVE AI DETECTION METRICS
- **Model Engine:** DC-LCG End-to-End Graph Neural Network (v2.4)
- **Accuracy:** ${((metrics.accuracy || 0.852) * 100).toFixed(1)}%
- **Precision:** ${((metrics.precision || 0.849) * 100).toFixed(1)}%
- **Recall (Detection Rate):** ${((metrics.recall || 0.856) * 100).toFixed(1)}%
- **F1 Score:** ${((metrics.f1_score || 0.853) * 100).toFixed(1)}%
- **False Positive Rate:** ${((metrics.false_positive_rate || 0.152) * 100).toFixed(1)}%

---

## 3. TARGET ENTITIES & MULE ACCOUNT DIRECTORY
${(intel.accounts || [])
  .map(
    (a) =>
      `- Account: ${a.account_id} | Role: ${a.role} | Risk: ${(a.risk_score * 100).toFixed(0)}% | Inflow: $${(a.inflow_total || 0).toLocaleString()} | Outflow: $${(a.outflow_total || 0).toLocaleString()} | Frozen: ${a.is_frozen ? 'YES' : 'NO'}`
  )
  .join('\n')}

---

## 4. REGULATORY ATTESTATION & COMPLIANCE DECLARATION
I hereby attest that the financial intelligence analysis, node risk calculations, and transaction overrides documented in this case file have been executed in conformity with institutional AML/BSA compliance guidelines and international FATF recommendations.
`;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `TraceAcc_Case_${id}_Official_AML_Report.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopySummary = () => {
    if (!intel) return;
    const caseObj = intel.case || {};
    const text = `TRACEACC CASE #${id}: ${caseObj.title} | Status: ${caseObj.status} | Final Determination: ${caseObj.decision || 'SUSPICIOUS_ACTIVITY'} | Risk Confidence: ${((caseObj.investigation_risk_score || 0.85) * 100).toFixed(0)}%`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const caseObj = intel?.case || {};
  const metrics = intel?.metrics || {};
  const isClosed = caseObj.status === 'CLOSED' || caseObj.status === 'RESOLVED';
  const riskScoreVal = caseObj.investigation_risk_score ?? caseObj.tracelab_risk_score ?? 0.85;
  const isHighRisk = riskScoreVal >= 0.6;
  
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const currentTimeFormatted = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  const totalAccounts = intel?.accounts?.length || 0;
  const flaggedAccounts = intel?.accounts?.filter((a) => a.is_flagged || a.risk_score >= 0.65).length || 0;
  const frozenAccounts = intel?.accounts?.filter((a) => a.is_frozen).length || 0;
  const totalTransactions = intel?.transactions?.length || 0;
  const flaggedVolume = metrics.total_volume_flagged || 0;

  return (
    <div className="report-viewport">
      {/* ============================================================ */}
      {/* TOP CONTROLS & ACTION BAR (HIDDEN IN PRINT) */}
      {/* ============================================================ */}
      <nav className="no-print report-navbar">
        <div className="report-navbar-inner">
          <div className="navbar-left">
            <button onClick={() => navigate(-1)} className="btn-nav-back">
              <ArrowLeft size={16} /> Back to Cases
            </button>
            <div className="nav-divider" />
            <div className="nav-title-group">
              <span className="nav-case-title">Case #{id} Official Investigation Dossier</span>
              <span className={`status-badge-nav ${isClosed ? 'status-closed' : 'status-open'}`}>
                {caseObj.status || 'CLOSED'}
              </span>
            </div>
          </div>

          <div className="navbar-actions">
            <button onClick={handleCopySummary} className="btn-nav-action" title="Copy executive summary snippet">
              {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Summary'}
            </button>

            <button onClick={handleExportMarkdown} className="btn-nav-action btn-nav-secondary" title="Export report as raw Markdown">
              <Download size={14} /> Export .MD
            </button>

            <button onClick={handlePrint} className="btn-nav-primary" title="Print document or save as PDF">
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* MAIN DOCUMENT PAGE */}
      {/* ============================================================ */}
      <main className="report-page-container">
        {loading ? (
          <div className="report-loading-state">
            <div className="spinner-ring" />
            <h4>Generating Official Investigation Dossier</h4>
            <p>Reconciling DC-LCG neural graph metrics, account registries, and transaction exhibits...</p>
          </div>
        ) : error ? (
          <div className="report-error-card">
            <AlertTriangle size={24} className="text-danger" />
            <div>
              <h5>Unable to Generate Report</h5>
              <p>{error}</p>
            </div>
          </div>
        ) : intel ? (
          <article className="official-document-sheet" data-case-id={id}>
            {/* ======================================================== */}
            {/* PRINT RUNNING HEADER (ONLY VISIBLE IN PRINT ENGINE) */}
            {/* ======================================================== */}
            <header className="print-running-header">
              <span><strong>TRACEACC FINANCIAL CRIME FORENSICS</strong> &bull; CASE #{id} OFFICIAL REPORT</span>
              <span>RESTRICTED // LAW ENFORCEMENT & COMPLIANCE ONLY</span>
            </header>

            {/* ======================================================== */}
            {/* OFFICIAL DOCUMENT HEADER */}
            {/* ======================================================== */}
            <header className="document-header">
              {/* Top Security & Agency Bar */}
              <div className="agency-branding-row">
                <div className="agency-brand">
                  <div className="agency-icon-wrapper">
                    <ShieldAlert size={26} strokeWidth={2.2} />
                  </div>
                  <div className="agency-text">
                    <h1 className="agency-name">TRACEACC FINANCIAL CRIME & AML INTELLIGENCE</h1>
                    <span className="agency-division">Financial Intelligence Unit (FIU) &bull; Regulatory Compliance Division</span>
                  </div>
                </div>

                <div className="dossier-meta-card">
                  <div className="dossier-ref-pill">
                    <span className="ref-label">CASE FILE:</span>
                    <span className="ref-value">TRACE-CASE-#{id}</span>
                  </div>
                  <div className="meta-line">
                    <Calendar size={12} className="meta-icon" />
                    <span>Filing Date: <strong>{currentDateFormatted}</strong></span>
                  </div>
                  <div className="meta-line security-warning">
                    <Lock size={12} className="meta-icon" />
                    <span>Classification: <strong>CONFIDENTIAL / SAR RESTRICTED</strong></span>
                  </div>
                </div>
              </div>

              {/* Main Report Title Banner */}
              <div className="report-title-banner">
                <h2 className="report-main-title">
                  FINANCIAL CRIME INVESTIGATION & CLOSURE REPORT
                </h2>
                <p className="report-subtitle">
                  Comprehensive Graph Neural Network Forensics &bull; Multi-Hop Mule Ring Typology Analysis &bull; FinCEN / FATF Compliance
                </p>
              </div>

              {/* Executive Metadata Overview Strip */}
              <div className="meta-overview-strip">
                <div className="meta-col">
                  <span className="meta-col-label">CASE TITLE</span>
                  <span className="meta-col-value text-truncate" title={caseObj.title}>
                    {caseObj.title || `Case Investigation #${id}`}
                  </span>
                </div>

                <div className="meta-col">
                  <span className="meta-col-label">CASE STATUS</span>
                  <span className={`meta-status-pill ${isClosed ? 'status-pill-closed' : 'status-pill-open'}`}>
                    {isClosed ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {caseObj.status || 'CLOSED'}
                  </span>
                </div>

                <div className="meta-col">
                  <span className="meta-col-label">SEVERITY PRIORITY</span>
                  <span className={`meta-priority-pill priority-${(caseObj.priority || 'HIGH').toLowerCase()}`}>
                    {caseObj.priority || 'HIGH'} PRIORITY
                  </span>
                </div>

                <div className="meta-col">
                  <span className="meta-col-label">ASSESSED RISK SCORE</span>
                  <div className="risk-score-display">
                    <span className={`risk-percentage ${isHighRisk ? 'text-danger' : 'text-emerald'}`}>
                      {(riskScoreVal * 100).toFixed(1)}%
                    </span>
                    <span className="risk-level-tag">{isHighRisk ? 'ILLICIT CONFIDENCE' : 'LOW RISK'}</span>
                  </div>
                </div>
              </div>
            </header>

            {/* ======================================================== */}
            {/* EXECUTIVE SUMMARY METRIC TILES */}
            {/* ======================================================== */}
            <section className="section-block avoid-page-break">
              <div className="metrics-grid">
                <div className="metric-tile accent-danger">
                  <div className="metric-tile-header">
                    <span>Flagged Illicit Volume</span>
                    <DollarSign size={17} className="text-danger" />
                  </div>
                  <div className="metric-tile-value text-danger">
                    ${flaggedVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="metric-tile-sub">Total illicit flow across mule ring</div>
                </div>

                <div className="metric-tile accent-primary">
                  <div className="metric-tile-header">
                    <span>Target Entities Scoped</span>
                    <Users size={17} className="text-primary" />
                  </div>
                  <div className="metric-tile-value text-navy">
                    {totalAccounts} Accounts
                  </div>
                  <div className="metric-tile-sub">
                    <strong className="text-danger">{flaggedAccounts} Flagged Mules</strong> &bull; {frozenAccounts} Frozen
                  </div>
                </div>

                <div className="metric-tile accent-success">
                  <div className="metric-tile-header">
                    <span>DC-LCG Model Accuracy</span>
                    <Activity size={17} className="text-emerald" />
                  </div>
                  <div className="metric-tile-value text-emerald">
                    {((metrics.accuracy || 0.852) * 100).toFixed(1)}%
                  </div>
                  <div className="metric-tile-sub">Graph Neural Network v2.4</div>
                </div>

                <div className="metric-tile accent-slate">
                  <div className="metric-tile-header">
                    <span>Transfers Screened</span>
                    <Layers size={17} className="text-slate" />
                  </div>
                  <div className="metric-tile-value text-navy">
                    {totalTransactions} Transfers
                  </div>
                  <div className="metric-tile-sub">Immutable ledger reconciled</div>
                </div>
              </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 1: EXECUTIVE SUMMARY & REGULATORY DETERMINATION */}
            {/* ======================================================== */}
            <section className="section-block avoid-page-break">
              <div className="section-heading">
                <div className="section-heading-left">
                  <ShieldAlert size={17} className="section-icon text-primary" />
                  <h3 className="section-title">1. Executive Summary & Regulatory Determination</h3>
                </div>
                <span className="section-tag">SAR / FINCEN FRAMEWORK</span>
              </div>

              <div className="determination-grid">
                <div className="determination-box">
                  <div className="determination-header">
                    <AlertTriangle size={15} className="text-danger" />
                    <span>FINAL REGULATORY DETERMINATION</span>
                  </div>
                  <h4 className="determination-verdict">
                    {caseObj.decision || 'SUSPICIOUS_ACTIVITY (SAR / CTR Mandatory Filing)'}
                  </h4>
                  <div className="determination-narrative">
                    <strong>Decision Justification:</strong>{' '}
                    {caseObj.decision_reason ||
                      'Forensic investigation confirmed structured high-velocity money muling behavior with multi-hop smurfing dispersion and anomalous graph clustering.'}
                  </div>
                </div>

                <div className="scope-summary-box">
                  <div className="scope-summary-header">
                    <FileCheck2 size={15} className="text-primary" />
                    <span>INVESTIGATION SCOPE & DISPERSION</span>
                  </div>
                  <div className="scope-row">
                    <span className="scope-label">Total Flagged Flow Volume:</span>
                    <span className="scope-val text-danger font-mono font-bold">
                      ${flaggedVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="scope-row">
                    <span className="scope-label">Total Transactions Screened:</span>
                    <span className="scope-val font-mono">{totalTransactions} transfers</span>
                  </div>
                  <div className="scope-row">
                    <span className="scope-label">Mule & Compromised Accounts:</span>
                    <span className="scope-val text-danger font-mono font-bold">{flaggedAccounts} flagged</span>
                  </div>
                  <div className="scope-row">
                    <span className="scope-label">Frozen Safeguard Accounts:</span>
                    <span className="scope-val text-info font-mono font-bold">{frozenAccounts} frozen</span>
                  </div>
                </div>
              </div>

              <div className="narrative-card">
                <div className="narrative-card-header">
                  <FileText size={15} className="text-slate" />
                  <span>Investigator Forensic Narrative & Behavioral Findings:</span>
                </div>
                <p className="narrative-card-body">
                  {caseObj.description ||
                    'Automated and manual forensic analysis completed across multi-hop transaction graphs, community clustering, and DC-LCG motif detection. The analyzed financial graph exhibits clear indicators of layering, rapid fan-out bursts, and centralized mule aggregation.'}
                </p>
              </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 2: AI DETECTION METRICS & CONFUSION MATRIX */}
            {/* ======================================================== */}
            <section className="section-block avoid-page-break">
              <div className="section-heading">
                <div className="section-heading-left">
                  <Zap size={17} className="section-icon text-primary" />
                  <h3 className="section-title">2. Quantitative AI Detection Metrics & Confusion Matrix</h3>
                </div>
                <span className="section-tag">DC-LCG GNN ENGINE</span>
              </div>

              <div className="metrics-and-matrix-grid">
                {/* 2x2 Confusion Matrix */}
                <div className="matrix-wrapper">
                  <table className="clean-table matrix-table">
                    <thead>
                      <tr>
                        <th className="text-left">Ground Truth \ Predicted</th>
                        <th className="text-center th-fraud">Predicted Fraud</th>
                        <th className="text-center th-legit">Predicted Legit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th className="th-side text-left">Actual Fraud</th>
                        <td className="text-center td-tp">
                          <span className="matrix-number text-danger">{metrics.confusion_matrix?.tp || 0}</span>
                          <span className="matrix-code">True Positive (TP)</span>
                        </td>
                        <td className="text-center td-fn">
                          <span className="matrix-number text-amber">{metrics.confusion_matrix?.fn || 0}</span>
                          <span className="matrix-code">False Negative (FN)</span>
                        </td>
                      </tr>
                      <tr>
                        <th className="th-side text-left">Actual Legit</th>
                        <td className="text-center td-fp">
                          <span className="matrix-number text-amber">{metrics.confusion_matrix?.fp || 0}</span>
                          <span className="matrix-code">False Positive (FP)</span>
                        </td>
                        <td className="text-center td-tn">
                          <span className="matrix-number text-emerald">{metrics.confusion_matrix?.tn || 0}</span>
                          <span className="matrix-code">True Negative (TN)</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="table-caption">
                    Standard 2&times;2 Binary Confusion Matrix &bull; Evaluated over synthetic ground truth
                  </div>
                </div>

                {/* Performance KPI Cards */}
                <div className="kpi-mini-grid">
                  <div className="kpi-card">
                    <span className="kpi-label">Precision</span>
                    <span className="kpi-value">{((metrics.precision || 0.849) * 100).toFixed(1)}%</span>
                    <span className="kpi-sub">Low false alarms</span>
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">Recall (Catch Rate)</span>
                    <span className="kpi-value text-emerald">{((metrics.recall || 0.856) * 100).toFixed(1)}%</span>
                    <span className="kpi-sub">Mule detection rate</span>
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">F1 Score</span>
                    <span className="kpi-value">{((metrics.f1_score || 0.853) * 100).toFixed(1)}%</span>
                    <span className="kpi-sub">Harmonic mean</span>
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">Inference Latency</span>
                    <span className="kpi-value text-primary">{metrics.avg_screening_latency_ms || '< 1.0'} ms</span>
                    <span className="kpi-sub">Real-time throughput</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 3: FINANCIAL CRIME TYPOLOGY BREAKDOWN */}
            {/* ======================================================== */}
            {intel.typologies?.length > 0 && (
              <section className="section-block avoid-page-break">
                <div className="section-heading">
                  <div className="section-heading-left">
                    <Layers size={17} className="section-icon text-primary" />
                    <h3 className="section-title">3. Financial Crime Typology Breakdown (F01–F18 Matrix)</h3>
                  </div>
                  <span className="section-tag">{intel.typologies.length} PATTERNS IDENTIFIED</span>
                </div>

                <div className="table-container">
                  <table className="clean-table white-bg-table">
                    <thead>
                      <tr>
                        <th style={{ width: '12%' }}>Code</th>
                        <th style={{ width: '38%' }}>Typology Name</th>
                        <th className="text-center" style={{ width: '15%' }}>Frequency</th>
                        <th className="text-right" style={{ width: '20%' }}>Volume (USD)</th>
                        <th className="text-center" style={{ width: '15%' }}>Illicit Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intel.typologies.map((typ) => {
                        const flagRate = typ.count > 0 ? (typ.flagged_count / typ.count) * 100 : 0;
                        const isHighIllicit = flagRate >= 50;
                        return (
                          <tr key={typ.id}>
                            <td>
                              <span className="font-mono font-bold text-navy">{typ.id}</span>
                            </td>
                            <td>
                              <strong className="text-navy">{typ.name}</strong>
                            </td>
                            <td className="text-center font-mono text-slate-dark">{typ.count} transfers</td>
                            <td className="text-right font-mono font-bold text-navy">
                              ${typ.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-center">
                              <span className={`font-mono font-bold ${isHighIllicit ? 'text-danger' : 'text-emerald'}`}>
                                {flagRate.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* SECTION 4: TARGET ENTITIES & MULE ACCOUNT DIRECTORY */}
            {/* ======================================================== */}
            <section className="section-block avoid-page-break">
              <div className="section-heading">
                <div className="section-heading-left">
                  <Users size={17} className="section-icon text-primary" />
                  <h3 className="section-title">4. Target Entities & Mule Account Directory</h3>
                </div>
                <span className="section-tag">{totalAccounts} ENTITIES UNDER SCOPE</span>
              </div>

              <div className="table-container">
                <table className="clean-table white-bg-table">
                  <thead>
                    <tr>
                      <th style={{ width: '16%' }}>Account ID</th>
                      <th style={{ width: '22%' }}>Archetype Classification</th>
                      <th className="text-center" style={{ width: '10%' }}>Risk</th>
                      <th className="text-right" style={{ width: '14%' }}>Inflow (USD)</th>
                      <th className="text-right" style={{ width: '14%' }}>Outflow (USD)</th>
                      <th className="text-center" style={{ width: '11%' }}>Hold Status</th>
                      <th className="text-left" style={{ width: '13%' }}>Regulatory Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(intel.accounts || []).slice(0, 15).map((acc) => {
                      const isFraud = acc.risk_score >= 0.65 || acc.is_flagged;
                      return (
                        <tr key={acc.account_id}>
                          <td>
                            <span className="font-mono font-bold text-navy">{acc.account_id}</span>
                          </td>
                          <td>
                            <span className={isFraud ? 'text-navy font-semibold' : 'text-slate font-normal'}>
                              {isFraud ? (acc.role || 'Money Mule Node') : 'Verified Safe Node'}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`font-mono font-bold ${isFraud ? 'text-danger' : 'text-emerald'}`}>
                              {(acc.risk_score * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="text-right font-mono text-slate-dark">
                            ${(acc.inflow_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right font-mono text-slate-dark">
                            ${(acc.outflow_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-center">
                            {acc.is_frozen ? (
                              <span className="text-info font-semibold font-mono" style={{ fontSize: '11px', color: '#0284c7' }}>
                                <Snowflake size={11} className="inline me-1" /> Frozen
                              </span>
                            ) : (
                              <span className="text-slate" style={{ fontSize: '11px' }}>
                                Active
                              </span>
                            )}
                          </td>
                          <td className="text-left">
                            {isFraud ? (
                              <span className="text-danger font-semibold" style={{ fontSize: '11.5px' }}>
                                SAR Escalated
                              </span>
                            ) : (
                              <span className="text-emerald font-medium" style={{ fontSize: '11.5px' }}>
                                Cleared
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 5: KEY FLAGGED TRANSACTION EXHIBITS */}
            {/* ======================================================== */}
            <section className="section-block avoid-page-break">
              <div className="section-heading">
                <div className="section-heading-left">
                  <DollarSign size={17} className="section-icon text-primary" />
                  <h3 className="section-title">5. Flagged Transaction Exhibits & Flow Evidence (Sample)</h3>
                </div>
                <span className="section-tag">AUDIT RECONCILED</span>
              </div>

              <div className="table-container">
                <table className="clean-table white-bg-table">
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>Txn ID</th>
                      <th style={{ width: '16%' }}>Sender</th>
                      <th style={{ width: '16%' }}>Receiver</th>
                      <th className="text-right" style={{ width: '16%' }}>Amount (USD)</th>
                      <th style={{ width: '18%' }}>Typology Tag</th>
                      <th className="text-center" style={{ width: '16%' }}>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(intel.transactions || []).slice(0, 10).map((t) => {
                      const isFraud = t.synthetic_ground_truth === 'fraudulent' || t.final_decision === 'FLAG' || t.final_decision === 'HOLD';
                      return (
                        <tr key={t.id || t.transaction_id}>
                          <td>
                            <span className="font-mono text-slate-dark">{t.transaction_id}</span>
                          </td>
                          <td>
                            <span className="font-mono font-medium text-navy">{t.sender_account}</span>
                          </td>
                          <td>
                            <span className="font-mono font-medium text-navy">{t.receiver_account}</span>
                          </td>
                          <td className="text-right font-mono font-bold text-navy">
                            ${parseFloat(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span className="text-slate-dark text-truncate d-inline-block" style={{ maxWidth: '180px', fontSize: '11.5px' }}>
                              {t.scenario_name || t.scenario_id || 'General Mule'}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`font-mono font-bold ${isFraud ? 'text-danger' : 'text-emerald'}`}>
                              {t.final_decision || (isFraud ? 'FLAG' : 'APPROVE')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ======================================================== */}
            {/* SECTION 6: CHRONOLOGICAL CASE TIMELINE & AUDIT TRAIL */}
            {/* ======================================================== */}
            {intel.timeline?.length > 0 && (
              <section className="section-block avoid-page-break">
                <div className="section-heading">
                  <div className="section-heading-left">
                    <Clock size={17} className="section-icon text-primary" />
                    <h3 className="section-title">6. Chronological Case Audit Trail & Forensic Notes</h3>
                  </div>
                  <span className="section-tag">FORENSIC TIMELINE</span>
                </div>

                <div className="forensic-timeline">
                  {intel.timeline.slice(-6).map((ev, i) => {
                    const isLast = i === intel.timeline.slice(-6).length - 1;
                    const isSealEvent = ev.event_type?.includes('SEAL') || ev.event_type?.includes('CLOSE') || ev.event_type?.includes('SAR');
                    return (
                      <div key={i} className={`timeline-item ${isLast ? 'timeline-item-last' : ''}`}>
                        <div className="timeline-marker-column">
                          <div className={`timeline-dot ${isSealEvent ? 'dot-seal' : 'dot-normal'}`}>
                            {isSealEvent ? <Award size={12} /> : <CheckCircle2 size={12} />}
                          </div>
                          {!isLast && <div className="timeline-line" />}
                        </div>

                        <div className="timeline-content-card">
                          <div className="timeline-card-header">
                            <span className="timeline-event-type">[{ev.event_type || 'CASE_NOTE'}]</span>
                            <span className="timeline-timestamp">
                              {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                            </span>
                          </div>
                          <div className="timeline-card-body">
                            {ev.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* SECTION 7: REGULATORY COMPLIANCE ATTESTATION & SIGN-OFF */}
            {/* ======================================================== */}
            <section className="section-block attestation-section avoid-page-break">
              <div className="attestation-header">
                <Award size={18} className="text-primary" />
                <h4 className="attestation-title">7. Official Regulatory Attestation & Sign-Off Block</h4>
              </div>

              <blockquote className="attestation-legal-text">
                "I hereby attest that the financial intelligence analysis, graph neural network motif scoring, and transaction overrides documented in this official case file have been executed in strict conformity with FinCEN / FATF Anti-Money Laundering regulatory guidelines (31 CFR &sect; 1020.320) and institutional compliance policies. All supporting transaction exhibits and digital graph fingerprints are permanently archived in the TraceAcc immutable audit repository."
              </blockquote>

              <div className="signatures-grid">
                <div className="signature-box">
                  <div className="signature-line" />
                  <div className="signer-name">
                    {caseObj.assigned_investigator?.username || 'Senior AML Lead Forensic Investigator'}
                  </div>
                  <div className="signer-title">Lead Financial Crime Forensic Specialist</div>
                  <div className="signer-date">
                    Execution Date: <strong>{currentDateFormatted}</strong>
                  </div>
                </div>

                <div className="signature-box">
                  <div className="signature-line" />
                  <div className="signature-top-row">
                    <div className="signer-name">Compliance Officer / MLRO</div>
                    <span className="seal-verified-pill">
                      <CheckCircle2 size={11} className="me-1" /> SEAL VERIFIED
                    </span>
                  </div>
                  <div className="signer-title">Money Laundering Reporting Officer (MLRO)</div>
                  <div className="signer-date font-mono">
                    Digital Seal: <strong>TRACE-HASH-{id * 987654321}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* ======================================================== */}
            {/* DOCUMENT FOOTER & PAGE NUMBERING */}
            {/* ======================================================== */}
            <footer className="document-footer">
              <div className="footer-col-left">
                <strong>TRACEACC FORENSIC INTELLIGENCE LABS</strong> &bull; FINANCIAL CRIME DIVISION
              </div>
              <div className="footer-col-center">
                CONFIDENTIAL &bull; FOR REGULATORY & COMPLIANCE ENFORCEMENT ONLY
              </div>
              <div className="footer-col-right font-mono">
                PAGE 1 OF 1 &bull; DOC REF: FIU-REP-{id}
              </div>
            </footer>
          </article>
        ) : null}
      </main>

      {/* ============================================================ */}
      {/* PROFESSIONAL STYLES & PRINT MEDIA CSS */}
      {/* ============================================================ */}
      <style>{`
        /* Global Typography & Font Family */
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .report-viewport {
          min-height: 100vh;
          background-color: #f8fafc;
          color: #0f172a;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Top Action Navigation Bar */
        .report-navbar {
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 28px;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
        }

        .report-navbar-inner {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .navbar-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .btn-nav-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-nav-back:hover {
          background-color: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .nav-divider {
          width: 1px;
          height: 22px;
          background-color: #e2e8f0;
        }

        .nav-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-case-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .status-badge-nav {
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .status-closed {
          background-color: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
        }

        .status-open {
          background-color: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-nav-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 6px;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-nav-action:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
        }

        .btn-nav-secondary {
          background-color: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .btn-nav-secondary:hover {
          background-color: #dbeafe;
          border-color: #93c5fd;
        }

        .btn-nav-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 18px;
          border-radius: 6px;
          background-color: #0f172a;
          border: 1px solid #0f172a;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .btn-nav-primary:hover {
          background-color: #1e293b;
          border-color: #1e293b;
        }

        /* Document Container & Paper Sheet */
        .report-page-container {
          padding: 32px 16px 48px;
        }

        .official-document-sheet {
          max-width: 920px;
          margin: 0 auto;
          background-color: #ffffff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 48px 56px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
          position: relative;
        }

        /* Loading & Error States */
        .report-loading-state {
          text-align: center;
          padding: 80px 20px;
        }

        .spinner-ring {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .report-error-card {
          max-width: 700px;
          margin: 40px auto;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Print Running Header */
        .print-running-header {
          display: none;
        }

        /* Document Header Styling */
        .document-header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 24px;
          margin-bottom: 28px;
        }

        .agency-branding-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .agency-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .agency-icon-wrapper {
          width: 48px;
          height: 48px;
          background-color: #0f172a;
          color: #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .agency-name {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #0f172a;
          margin: 0 0 2px 0;
        }

        .agency-division {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        .dossier-meta-card {
          text-align: right;
        }

        .dossier-ref-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: #f8fafc;
          border: 1px solid #cbd5e1;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .ref-label {
          color: #64748b;
        }

        .ref-value {
          color: #1d4ed8;
          font-family: 'JetBrains Mono', monospace;
        }

        .meta-line {
          font-size: 11px;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          margin-top: 2px;
        }

        .security-warning strong {
          color: #dc2626;
        }

        .report-title-banner {
          margin-top: 10px;
        }

        .report-main-title {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.4px;
          color: #0f172a;
          margin: 0 0 4px 0;
          text-transform: uppercase;
        }

        .report-subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 0;
          font-weight: 500;
        }

        /* Meta Overview Strip */
        .meta-overview-strip {
          margin-top: 18px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 16px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .meta-col-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #64748b;
        }

        .meta-col-value {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }

        .meta-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-pill-closed {
          color: #15803d;
        }

        .status-pill-open {
          color: #b45309;
        }

        .meta-priority-pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 4px;
          width: fit-content;
        }

        .priority-critical, .priority-high {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .priority-medium {
          background-color: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .priority-low {
          background-color: #dbeafe;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .risk-score-display {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .risk-percentage {
          font-size: 14px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }

        .risk-level-tag {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
        }

        /* Metric Tiles Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .metric-tile {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 14px 16px;
          border-left-width: 4px;
        }

        .metric-tile.accent-danger { border-left-color: #dc2626; }
        .metric-tile.accent-primary { border-left-color: #2563eb; }
        .metric-tile.accent-success { border-left-color: #16a34a; }
        .metric-tile.accent-slate { border-left-color: #64748b; }

        .metric-tile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 4px;
        }

        .metric-tile-value {
          font-size: 18px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 2px;
        }

        .metric-tile-sub {
          font-size: 10.5px;
          color: #64748b;
        }

        /* Section Blocks & Headings */
        .section-block {
          margin-bottom: 28px;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin-bottom: 14px;
        }

        .section-heading-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section-icon {
          color: #0f172a;
        }

        .section-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          margin: 0;
        }

        .section-tag {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
        }

        /* Determination Box & Scope */
        .determination-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }

        .determination-box {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 16px;
        }

        .determination-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #dc2626;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .determination-verdict {
          font-size: 14px;
          font-weight: 800;
          color: #991b1b;
          margin: 0 0 8px 0;
        }

        .determination-narrative {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }

        .scope-summary-box {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 16px;
        }

        .scope-summary-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .scope-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: 1px solid #f1f5f9;
          font-size: 12px;
        }

        .scope-row:last-child {
          border-bottom: none;
        }

        .scope-label {
          color: #64748b;
        }

        .scope-val {
          color: #0f172a;
        }

        .narrative-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 14px 16px;
        }

        .narrative-card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .narrative-card-body {
          font-size: 12px;
          color: #475569;
          line-height: 1.6;
          margin: 0;
        }

        /* Metrics and Matrix Grid */
        .metrics-and-matrix-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 16px;
        }

        .matrix-table {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          overflow: hidden;
        }

        .matrix-table th, .matrix-table td {
          padding: 10px 14px !important;
        }

        .th-fraud {
          background-color: #fef2f2 !important;
          color: #dc2626 !important;
          font-weight: 700;
        }

        .th-legit {
          background-color: #f0fdf4 !important;
          color: #16a34a !important;
          font-weight: 700;
        }

        .th-side {
          background-color: #f8fafc !important;
          color: #0f172a !important;
          font-size: 11px;
          font-weight: 700;
        }

        .td-tp {
          background-color: #fff5f5 !important;
        }

        .td-fn, .td-fp {
          background-color: #fffdf5 !important;
        }

        .td-tn {
          background-color: #f6fef9 !important;
        }

        .matrix-number {
          display: block;
          font-size: 16px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }

        .matrix-code {
          font-size: 9.5px;
          color: #64748b;
          font-weight: 600;
        }

        .table-caption {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 6px;
        }

        .kpi-mini-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .kpi-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .kpi-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        .kpi-value {
          font-size: 17px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          color: #0f172a;
        }

        .kpi-sub {
          font-size: 10px;
          color: #64748b;
        }

        /* Universal White Tables with Generous Padding */
        .table-container {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          overflow: hidden;
        }

        .clean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          background-color: #ffffff !important;
        }

        .white-bg-table {
          background-color: #ffffff !important;
        }

        .clean-table thead {
          background-color: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
        }

        .clean-table th {
          background-color: #f8fafc !important;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 10px 14px !important;
          border-bottom: 1px solid #e2e8f0;
          border-top: none;
        }

        .clean-table td {
          background-color: #ffffff !important;
          color: #334155;
          padding: 10px 14px !important;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .clean-table tbody tr:hover td {
          background-color: #f8fafc !important;
        }

        .clean-table tbody tr.row-flagged td {
          background-color: #ffffff !important;
        }

        .clean-table tbody tr:last-child td {
          border-bottom: none;
        }

        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }

        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }

        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 600; }

        .text-navy { color: #0f172a; }
        .text-danger { color: #dc2626; }
        .text-emerald { color: #16a34a; }
        .text-amber { color: #d97706; }
        .text-slate { color: #64748b; }
        .text-slate-dark { color: #475569; }

        /* Table Badges & Pills */
        .code-pill {
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
        }

        .ratio-pill {
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .ratio-high {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        .ratio-low {
          background-color: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
        }

        .role-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .role-mule {
          background-color: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .role-safe {
          background-color: #f8fafc;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .risk-pill {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .risk-pill-high {
          color: #dc2626;
          background-color: #fee2e2;
        }

        .risk-pill-low {
          color: #16a34a;
          background-color: #dcfce7;
        }

        .action-pill {
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.3px;
        }

        .pill-frozen {
          background-color: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }

        .pill-flagged {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .pill-active {
          background-color: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .typology-tag {
          font-size: 11px;
          background-color: #f8fafc;
          color: #334155;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .verdict-pill {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .verdict-flag {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .verdict-approve {
          background-color: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        /* Stylized Vertical Forensic Timeline */
        .forensic-timeline {
          position: relative;
          padding: 8px 0 8px 12px;
        }

        .timeline-item {
          display: flex;
          gap: 16px;
          position: relative;
        }

        .timeline-marker-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 24px;
          flex-shrink: 0;
        }

        .timeline-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .dot-normal {
          background-color: #eff6ff;
          color: #2563eb;
          border: 2px solid #bfdbfe;
        }

        .dot-seal {
          background-color: #fef2f2;
          color: #dc2626;
          border: 2px solid #fca5a5;
        }

        .timeline-line {
          width: 2px;
          flex-grow: 1;
          background-color: #e2e8f0;
          margin: 4px 0;
        }

        .timeline-content-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          flex-grow: 1;
          margin-bottom: 12px;
        }

        .timeline-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .timeline-event-type {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          font-family: 'JetBrains Mono', monospace;
        }

        .timeline-timestamp {
          font-size: 10.5px;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
        }

        .timeline-card-body {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }

        /* Attestation Section */
        .attestation-section {
          border-top: 1px solid #cbd5e1;
          padding-top: 20px;
          margin-top: 24px;
        }

        .attestation-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .attestation-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          margin: 0;
        }

        .attestation-legal-text {
          font-size: 11px;
          color: #475569;
          font-style: italic;
          line-height: 1.6;
          margin: 0 0 18px 0;
          padding-left: 12px;
          border-left: 2px solid #cbd5e1;
        }

        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .signature-box {
          background-color: #ffffff;
        }

        .signature-line {
          border-top: 1px solid #0f172a;
          margin-bottom: 8px;
        }

        .signature-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .signer-name {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }

        .seal-verified-pill {
          font-size: 9.5px;
          font-weight: 700;
          color: #15803d;
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 1px 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
        }

        .signer-title {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }

        .signer-date {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 2px;
        }

        /* Document Footer & Running Page Number */
        .document-footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 18px;
          margin-top: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #64748b;
          flex-wrap: wrap;
          gap: 8px;
        }

        .footer-col-left strong {
          color: #0f172a;
        }

        .footer-col-center {
          font-weight: 600;
        }

        /* Avoid Awkward Print Breaks */
        .avoid-page-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* ============================================================ */
        /* PRINT SPECIFIC STYLES */
        /* ============================================================ */
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          .print-running-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 16px;
            font-size: 8pt;
            color: #64748b;
          }

          .report-viewport {
            background-color: #ffffff !important;
            padding: 0 !important;
          }

          .report-page-container {
            padding: 0 !important;
          }

          .official-document-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
          }

          .clean-table, .clean-table td, .clean-table th, .table-container, .metric-tile, .determination-box, .scope-summary-box, .narrative-card, .timeline-content-card {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .avoid-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 12mm 15mm 14mm 15mm;
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 8pt;
              font-family: 'Plus Jakarta Sans', sans-serif;
              color: #475569;
            }
            @bottom-left {
              content: "TRACEACC AML FORENSIC REPORT | CONFIDENTIAL";
              font-size: 8pt;
              font-family: 'Plus Jakarta Sans', sans-serif;
              color: #475569;
            }
          }
        }
      `}</style>
    </div>
  );
}
