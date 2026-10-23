import React from 'react';
import AppLayout from '../layout/AppLayout';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from 'recharts';

const COLORS = ['#1f6feb', '#3fb950', '#e3b341', '#f85149', '#a371f7', '#39d353'];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card ${accent || ''}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value ?? '—'}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

import { useAnalysis } from '../../context/AnalysisContext';

function StatisticsPage() {
  const { analysisResult: data } = useAnalysis();

  if (!data) {
    return (
      <AppLayout title="Statistics">
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
          <div style={{ fontSize: 48 }}>📈</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>
            No data yet — run an analysis from the Graph Viewer or Dashboard.
          </div>
        </div>
      </AppLayout>
    );
  }

  const summary   = data.summary || {};
  const hybrid    = data.hybrid_scores || [];
  const temporal  = data.temporal || {};
  const motifs    = data.motifs || {};
  const amount    = data.amount_patterns || {};

  // ── Risk Tier Distribution ─────────────────────────────────
  const tierCounts = hybrid.reduce((acc, h) => {
    acc[h.risk_tier] = (acc[h.risk_tier] || 0) + 1;
    return acc;
  }, {});
  const tierData = Object.entries(tierCounts).map(([name, value]) => ({ name, value }));
  const TIER_COLORS = { CRITICAL: '#f85149', HIGH: '#e3b341', MEDIUM: '#d29922', LOW: '#3fb950' };

  // ── Top 10 Accounts by Score ───────────────────────────────
  const top10 = hybrid.slice(0, 10).map((h) => ({
    id: h.account_id.length > 10 ? h.account_id.slice(0, 10) + '…' : h.account_id,
    score: h.final_score,
    graph: h.breakdown?.graph_score,
    ml: h.breakdown?.ml_score,
    temporal_s: h.breakdown?.temporal_score,
    behaviour: h.breakdown?.behaviour_score,
  }));

  // ── Motif counts ───────────────────────────────────────────
  const motifData = [
    { name: 'Triangles', count: motifs.summary?.triangles || 0 },
    { name: 'Stars',     count: motifs.summary?.stars     || 0 },
    { name: 'Chains',    count: motifs.summary?.chains    || 0 },
    { name: 'Diamonds',  count: motifs.summary?.diamonds  || 0 },
  ];

  // ── Temporal flags ─────────────────────────────────────────
  const temporalData = [
    { name: 'Night',    count: temporal.summary?.night_actor_count    || 0 },
    { name: 'Weekend',  count: temporal.summary?.weekend_actor_count  || 0 },
    { name: 'Rapid',    count: temporal.summary?.rapid_mover_count    || 0 },
    { name: 'Periodic', count: temporal.summary?.periodic_actor_count || 0 },
  ];

  return (
    <AppLayout title="Statistics" >
      {/* Summary stats */}
      <div className="stat-grid">
        <StatCard label="Total Accounts"       value={summary.total_accounts_analyzed}          accent="accent" />
        <StatCard label="Total Transactions"   value={summary.total_transactions} />
        <StatCard label="Suspicious Accounts"  value={summary.suspicious_accounts_flagged}       accent="danger" />
        <StatCard label="Fraud Rings"          value={summary.fraud_rings_detected}              accent="warning" />
        <StatCard label="Processing Time"      value={`${summary.processing_time_seconds}s`}     accent="success" />
        <StatCard label="ML Flagged"           value={summary.detector_counts?.ml_flagged ?? '—'} />
      </div>

      {/* Row 1: Tier Pie + Top-10 Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-header">
            <span>🎯</span>
            <h3 className="panel-title">Risk Tier Distribution</h3>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {tierData.map((entry) => (
                    <Cell key={entry.name} fill={TIER_COLORS[entry.name] || '#388bfd'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>🏆</span>
            <h3 className="panel-title">Top 10 Accounts — Score Breakdown</h3>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top10} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="id" tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }}
                />
                <Bar dataKey="graph"      fill="#1f6feb" stackId="a" name="Graph"     />
                <Bar dataKey="behaviour"  fill="#3fb950" stackId="a" name="Behaviour" />
                <Bar dataKey="temporal_s" fill="#e3b341" stackId="a" name="Temporal"  />
                <Bar dataKey="ml"         fill="#f85149" stackId="a" name="ML"        radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Motifs + Temporal + Amount patterns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-header"><span>🔷</span><h3 className="panel-title">Graph Motifs</h3></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={motifData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#c9d1d9' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }} />
                <Bar dataKey="count" fill="#a371f7" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span>⏱️</span><h3 className="panel-title">Temporal Flags</h3></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={temporalData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#c9d1d9' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }} />
                <Bar dataKey="count" fill="#e3b341" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span>💰</span><h3 className="panel-title">Amount Patterns</h3></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={[
                  { name: 'Structuring', count: amount.summary?.structuring_accounts    || 0 },
                  { name: 'Round Amt',   count: amount.summary?.round_amount_accounts   || 0 },
                  { name: 'Smurfing',    count: amount.summary?.smurfing_accounts       || 0 },
                  { name: 'Repeated',    count: amount.summary?.repeated_amount_accounts|| 0 },
                ]}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#c9d1d9' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }} />
                <Bar dataKey="count" fill="#f85149" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detector summary table */}
      {summary.detector_counts && (
        <div className="panel">
          <div className="panel-header"><span>🔬</span><h3 className="panel-title">Detector Results</h3></div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Detector</th><th>Count</th></tr>
              </thead>
              <tbody>
                {Object.entries(summary.detector_counts).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: '#c9d1d9', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</td>
                    <td style={{ fontWeight: 700, color: v > 0 ? '#f85149' : '#3fb950' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default StatisticsPage;
