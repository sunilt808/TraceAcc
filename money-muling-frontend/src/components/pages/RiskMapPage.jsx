import React, { useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';

function RiskMapPage() {
  const [search, setSearch] = useState('');
  const { analysisResult: data } = useAnalysis();

  const hybrid = (data?.hybrid_scores || []).filter((h) =>
    h.account_id.toLowerCase().includes(search.toLowerCase())
  );

  const tierColor = { CRITICAL: '#f85149', HIGH: '#e3b341', MEDIUM: '#d29922', LOW: '#3fb950' };
  const tierBg    = {
    CRITICAL: 'rgba(248,81,73,0.08)',
    HIGH:     'rgba(227,179,65,0.08)',
    MEDIUM:   'rgba(210,153,34,0.08)',
    LOW:      'rgba(63,185,80,0.08)',
  };

  if (!data) {
    return (
      <AppLayout title="Risk Map" subtitle="Account risk heatmap">
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
          <div style={{ fontSize: 48 }}>🗺️</div>
          <div style={{ marginTop: 12 }}>Run an analysis first to see the risk map.</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Risk Map" subtitle="Per-account risk heatmap with score breakdown">
      {/* Summary row */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((tier) => {
          const count = hybrid.filter((h) => h.risk_tier === tier).length;
          return (
            <div key={tier} className="stat-card" style={{ borderColor: tierColor[tier] }}>
              <div className="stat-card-label">{tier}</div>
              <div className="stat-card-value" style={{ color: tierColor[tier] }}>{count}</div>
              <div className="stat-card-sub">accounts</div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>🗺️</span>
          <h3 className="panel-title">Account Risk Scores</h3>
          <div style={{ marginLeft: 'auto' }}>
            <input
              type="text"
              placeholder="Search account…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: '#161b22', border: '1px solid #30363d',
                borderRadius: 6, padding: '6px 10px', color: '#f0f6fc', fontSize: 12,
              }}
            />
          </div>
        </div>
        <div style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Account</th>
                <th>Tier</th>
                <th>Final Score</th>
                <th>Graph</th>
                <th>Behaviour</th>
                <th>Temporal</th>
                <th>Community</th>
                <th>ML</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {hybrid.slice(0, 200).map((h, i) => (
                <tr key={h.account_id} style={{ background: tierBg[h.risk_tier] }}>
                  <td style={{ color: '#8b949e', fontSize: 11 }}>{i + 1}</td>
                  <td style={{
                    fontFamily: 'monospace', fontSize: 12,
                    color: '#388bfd', fontWeight: 600,
                  }}>
                    {h.account_id}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                        background: `${tierColor[h.risk_tier]}22`,
                        color: tierColor[h.risk_tier],
                        border: `1px solid ${tierColor[h.risk_tier]}`,
                      }}
                    >
                      {h.risk_tier}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 60, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${h.final_score}%`, height: '100%',
                          background: tierColor[h.risk_tier], borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ color: tierColor[h.risk_tier], fontWeight: 700, fontSize: 13 }}>
                        {h.final_score}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.graph_score?.toFixed(1)}</td>
                  <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.behaviour_score?.toFixed(1)}</td>
                  <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.temporal_score?.toFixed(1)}</td>
                  <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.community_score?.toFixed(1)}</td>
                  <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.ml_score?.toFixed(1)}</td>
                  <td style={{ fontSize: 11 }}>
                    {[...h.temporal_flags, ...h.ml_flags].map((f) => (
                      <span key={f} style={{
                        display: 'inline-block', margin: '1px 2px',
                        padding: '1px 5px', borderRadius: 4,
                        background: '#21262d', color: '#8b949e', fontSize: 10,
                      }}>
                        {f}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

export default RiskMapPage;
