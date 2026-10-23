import React, { useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';
import CaseSelector from '../shared/CaseSelector';

function RiskMapPage() {
  const [search, setSearch] = useState('');
  const { analysisResult: data } = useAnalysis();
  const [caseIntel, setCaseIntel] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);

  const tierColor = { CRITICAL: '#f85149', HIGH: '#e3b341', MEDIUM: '#d29922', LOW: '#3fb950' };
  const tierBg = {
    CRITICAL: 'rgba(248,81,73,0.08)',
    HIGH: 'rgba(227,179,65,0.08)',
    MEDIUM: 'rgba(210,153,34,0.08)',
    LOW: 'rgba(63,185,80,0.08)',
  };

  let dataSource = [];
  const isCaseMode = !!caseIntel;

  if (isCaseMode && caseIntel.accounts) {
    dataSource = caseIntel.accounts.map((a) => ({
      account_id: a.account_id,
      risk_tier: a.risk_tier || (a.risk_score >= 0.8 ? 'CRITICAL' : a.risk_score >= 0.6 ? 'HIGH' : a.risk_score >= 0.4 ? 'MEDIUM' : 'LOW'),
      final_score: Math.round((a.risk_score || 0) * 100),
      role: a.role,
      is_flagged: a.is_flagged,
      is_frozen: a.is_frozen,
      inflow: a.inflow_total,
      outflow: a.outflow_total,
      net_flow: a.net_flow,
      degree: a.degree,
      total_tx: a.total_tx_count,
      counterparties: a.counterparties_count,
    })).sort((a, b) => b.final_score - a.final_score);
  } else if (data?.hybrid_scores) {
    dataSource = data.hybrid_scores;
  }

  const filteredData = dataSource.filter((h) =>
    h.account_id.toLowerCase().includes(search.toLowerCase())
  );

  const hasData = isCaseMode || data;

  return (
    <AppLayout title="Risk Map">
      <CaseSelector
        onIntelligenceLoaded={setCaseIntel}
        onCaseSelected={setSelectedCase}
      />

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
          <div style={{ fontSize: 48 }}>🗺️</div>
          <div style={{ marginTop: 12 }}>Select a case above or run an analysis to see the risk map.</div>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((tier) => {
              const count = filteredData.filter((h) => h.risk_tier === tier).length;
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
                    <th>{isCaseMode ? 'Risk Score' : 'Final Score'}</th>
                    {isCaseMode ? (
                      <>
                        <th>Role</th>
                        <th>Flagged</th>
                        <th>In-flow</th>
                        <th>Out-flow</th>
                        <th>Degree</th>
                      </>
                    ) : (
                      <>
                        <th>Graph</th>
                        <th>Behaviour</th>
                        <th>Temporal</th>
                        <th>Community</th>
                        <th>ML</th>
                        <th>Flags</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 200).map((h, i) => (
                    <tr key={h.account_id} style={{ background: tierBg[h.risk_tier] || 'transparent' }}>
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
                      {isCaseMode ? (
                        <>
                          <td style={{ fontSize: 12, color: h.role === 'mule' ? '#f85149' : '#f0f6fc' }}>{h.role || '-'}</td>
                          <td>
                            {h.is_flagged ? <span style={{ color: '#f85149', fontSize: 12 }}>Yes</span> : <span style={{ color: '#8b949e', fontSize: 12 }}>No</span>}
                          </td>
                          <td style={{ fontSize: 12, color: '#3fb950' }}>{h.inflow ? `$${h.inflow.toLocaleString()}` : '-'}</td>
                          <td style={{ fontSize: 12, color: '#f85149' }}>{h.outflow ? `$${h.outflow.toLocaleString()}` : '-'}</td>
                          <td style={{ fontSize: 12 }}>{h.degree}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.graph_score?.toFixed(1)}</td>
                          <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.behaviour_score?.toFixed(1)}</td>
                          <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.temporal_score?.toFixed(1)}</td>
                          <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.community_score?.toFixed(1)}</td>
                          <td style={{ color: '#8b949e', fontSize: 12 }}>{h.breakdown?.ml_score?.toFixed(1)}</td>
                          <td style={{ fontSize: 11 }}>
                            {[...(h.temporal_flags || []), ...(h.ml_flags || [])].map((f) => (
                              <span key={f} style={{
                                display: 'inline-block', margin: '1px 2px',
                                padding: '1px 5px', borderRadius: 4,
                                background: '#21262d', color: '#8b949e', fontSize: 10,
                              }}>
                                {f}
                              </span>
                            ))}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isCaseMode && caseIntel?.typologies && caseIntel.typologies.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ color: '#f0f6fc', marginBottom: 16 }}>Detected Typologies</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {caseIntel.typologies.map(typ => {
                  const hasFlags = typ.flagged_count > 0;
                  return (
                    <div key={typ.id} style={{
                      background: '#161b22',
                      border: `1px solid ${hasFlags ? '#f85149' : '#3fb950'}`,
                      borderRadius: 8,
                      padding: 16
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 8 }}>{typ.name}</div>
                      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
                        Transactions: <span style={{ color: '#f0f6fc' }}>{typ.count}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
                        Total Amount: <span style={{ color: '#f0f6fc' }}>${typ.total_amount?.toLocaleString() || 0}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#8b949e' }}>
                        Flagged: <span style={{ color: hasFlags ? '#f85149' : '#3fb950', fontWeight: 600 }}>{typ.flagged_count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

export default RiskMapPage;
