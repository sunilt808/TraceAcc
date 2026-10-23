import React, { useState, useMemo } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';
import CaseSelector from '../shared/CaseSelector';
import { Clock, ArrowRight, AlertTriangle, CheckCircle2, Filter, ArrowUpRight, ArrowDownLeft, Info, Activity } from 'lucide-react';

const PRIORITY_COLORS = {
  CRITICAL: '#f85149',
  HIGH: '#f85149',
  MEDIUM: '#e3b341',
  LOW: '#3fb950',
};

const DECISION_COLORS = {
  FRAUD: '#f85149',
  LEGIT: '#3fb950',
  SUSPICIOUS: '#e3b341',
};

const EVENT_TYPE_STYLES = {
  STATUS_CHANGE: { color: '#58a6ff', bg: '#58a6ff22', icon: Activity },
  NOTE_ADDED: { color: '#8b949e', bg: '#8b949e22', icon: Info },
  ALERT_ACTION: { color: '#e3b341', bg: '#e3b34122', icon: AlertTriangle },
};

function TimelinePage() {
  const { analysisResult: data } = useAnalysis();
  
  const [caseIntel, setCaseIntel] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [txFilter, setTxFilter] = useState('ALL');
  const [txSearch, setTxSearch] = useState('');

  const transactions = caseIntel?.transactions || [];
  const timelineEvents = caseIntel?.timeline || [];

  const filteredTransactions = useMemo(() => {
    let txs = [...transactions];

    // Filter by final_decision or synthetic_ground_truth
    if (txFilter === 'FRAUD') {
      txs = txs.filter(t => t.final_decision === 'FRAUD' || t.synthetic_ground_truth === 'FRAUD');
    } else if (txFilter === 'LEGIT') {
      txs = txs.filter(t => t.final_decision === 'LEGIT' || t.synthetic_ground_truth === 'LEGIT');
    } else if (txFilter === 'SUSPICIOUS') {
      txs = txs.filter(t => t.final_decision === 'SUSPICIOUS' || t.risk_tier === 'HIGH');
    }

    // Search by account ID
    if (txSearch.trim()) {
      const s = txSearch.toLowerCase().trim();
      txs = txs.filter(t => 
        (t.sender_account && t.sender_account.toLowerCase().includes(s)) ||
        (t.receiver_account && t.receiver_account.toLowerCase().includes(s)) ||
        (t.transaction_id && t.transaction_id.toLowerCase().includes(s))
      );
    }

    // Sort by timestamp asc
    txs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return txs;
  }, [transactions, txFilter, txSearch]);

  const sortedTimeline = useMemo(() => {
    const evts = [...timelineEvents];
    evts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // desc
    return evts;
  }, [timelineEvents]);

  // Stats
  const totalTxs = transactions.length;
  const fraudCount = transactions.filter(t => t.final_decision === 'FRAUD' || t.synthetic_ground_truth === 'FRAUD').length;
  const legitCount = transactions.filter(t => t.final_decision === 'LEGIT' || t.synthetic_ground_truth === 'LEGIT').length;
  const totalVolume = transactions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

  const renderTemporalAnalysis = () => {
    const temporal = data?.temporal || {};
    const nightActors   = temporal.night_actors || [];
    const weekendActors = temporal.weekend_actors || [];
    const rapidMovers   = temporal.rapid_movers || [];
    const periodic      = temporal.periodic_actors || [];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Night Activity */}
        <div className="panel">
          <div className="panel-header" style={{ borderBottomColor: '#21262d' }}>
            <span>🌙</span><h3 className="panel-title">Night Activity ({nightActors.length})</h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Account</th><th>Night Tx</th><th>Total</th><th>Ratio</th></tr></thead>
              <tbody>
                {nightActors.map((a) => (
                  <tr key={a.account_id}>
                    <td style={{ fontFamily: 'monospace', color: '#388bfd' }}>{a.account_id}</td>
                    <td>{a.night_tx_count}</td>
                    <td>{a.total_tx}</td>
                    <td style={{ color: '#f85149', fontWeight: 600 }}>{(a.night_ratio * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rapid Movement */}
        <div className="panel">
          <div className="panel-header" style={{ borderBottomColor: '#21262d' }}>
            <span>⚡</span><h3 className="panel-title">Rapid Movement ({rapidMovers.length})</h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Account</th><th>Tx Count</th><th>Window (h)</th><th>Start Time</th></tr></thead>
              <tbody>
                {rapidMovers.map((a) => (
                  <tr key={a.account_id}>
                    <td style={{ fontFamily: 'monospace', color: '#388bfd' }}>{a.account_id}</td>
                    <td style={{ color: '#e3b341', fontWeight: 600 }}>{a.rapid_tx_count}</td>
                    <td>{a.window_hours}</td>
                    <td style={{ fontSize: 11, color: '#8b949e' }}>{new Date(a.first_tx).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekend Activity */}
        <div className="panel">
          <div className="panel-header" style={{ borderBottomColor: '#21262d' }}>
            <span>📅</span><h3 className="panel-title">Weekend Activity ({weekendActors.length})</h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Account</th><th>Weekend Tx</th><th>Total</th><th>Ratio</th></tr></thead>
              <tbody>
                {weekendActors.map((a) => (
                  <tr key={a.account_id}>
                    <td style={{ fontFamily: 'monospace', color: '#388bfd' }}>{a.account_id}</td>
                    <td>{a.weekend_tx_count}</td>
                    <td>{a.total_tx}</td>
                    <td style={{ color: '#d29922', fontWeight: 600 }}>{(a.weekend_ratio * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Periodic */}
        <div className="panel">
          <div className="panel-header" style={{ borderBottomColor: '#21262d' }}>
            <span>⏰</span><h3 className="panel-title">Periodic Behaviour ({periodic.length})</h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Account</th><th>Tx Count</th><th>Avg Interval</th><th>Dev (min)</th></tr></thead>
              <tbody>
                {periodic.map((a) => (
                  <tr key={a.account_id}>
                    <td style={{ fontFamily: 'monospace', color: '#388bfd' }}>{a.account_id}</td>
                    <td>{a.tx_count}</td>
                    <td>{a.avg_interval_minutes}m</td>
                    <td style={{ color: '#3fb950', fontWeight: 600 }}>±{a.avg_deviation_minutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCaseTimeline = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Top Summary */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div className="panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ color: '#8b949e', fontSize: 12 }}>Total Transactions</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{totalTxs}</div>
          </div>
          <div className="panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ color: '#8b949e', fontSize: 12 }}>Fraud / Suspicious</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f85149' }}>{fraudCount}</div>
          </div>
          <div className="panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ color: '#8b949e', fontSize: 12 }}>Legit</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#3fb950' }}>{legitCount}</div>
          </div>
          <div className="panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ color: '#8b949e', fontSize: 12 }}>Total Volume</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>${totalVolume.toLocaleString()}</div>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#58a6ff" /> Transaction Timeline
            </h3>
            
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Search account/tx id..." 
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  style={{
                    background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
                    padding: '4px 8px', color: '#c9d1d9', fontSize: 12, width: 200
                  }}
                />
              </div>

              <div style={{ display: 'flex', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, overflow: 'hidden' }}>
                {['ALL', 'FRAUD', 'LEGIT', 'SUSPICIOUS'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setTxFilter(filter)}
                    style={{
                      background: txFilter === filter ? '#21262d' : 'transparent',
                      color: txFilter === filter ? '#f0f6fc' : '#8b949e',
                      border: 'none',
                      padding: '4px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                      borderRight: filter !== 'SUSPICIOUS' ? '1px solid #30363d' : 'none'
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel-body" style={{ padding: 16 }}>
            <div style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid #30363d', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredTransactions.length === 0 ? (
                <div style={{ color: '#8b949e', fontStyle: 'italic', padding: 8 }}>No transactions match criteria.</div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isFraud = tx.synthetic_ground_truth === 'FRAUD' || tx.risk_tier === 'CRITICAL' || tx.risk_tier === 'HIGH';
                  const decColor = DECISION_COLORS[tx.final_decision] || '#8b949e';

                  return (
                    <div key={tx.id || tx.transaction_id} style={{ 
                      position: 'relative',
                      background: '#161b22', 
                      border: '1px solid #30363d',
                      borderLeft: `3px solid ${isFraud ? '#f85149' : '#30363d'}`,
                      borderRadius: 6,
                      padding: 12,
                      display: 'flex',
                      gap: 16
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: -31,
                        top: 16,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: isFraud ? '#f85149' : '#30363d',
                        border: '2px solid #0d1117'
                      }} />
                      
                      <div style={{ minWidth: 140 }}>
                        <div style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 'bold' }}>
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </div>
                        <div style={{ color: '#8b949e', fontSize: 11 }}>
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </div>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#58a6ff' }}>{tx.sender_account}</span>
                          <ArrowRight size={14} color="#8b949e" />
                          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#58a6ff' }}>{tx.receiver_account}</span>
                          
                          <span style={{ marginLeft: 'auto', fontWeight: 'bold', fontSize: 14, color: '#f0f6fc' }}>
                            ${parseFloat(tx.amount).toLocaleString()} {tx.currency}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {tx.channel && (
                            <span style={{ background: '#21262d', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: '#c9d1d9' }}>
                              {tx.channel}
                            </span>
                          )}
                          {tx.risk_tier && (
                            <span style={{ border: `1px solid ${PRIORITY_COLORS[tx.risk_tier]}44`, color: PRIORITY_COLORS[tx.risk_tier], padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                              Risk: {tx.risk_tier}
                            </span>
                          )}
                          {tx.final_decision && (
                            <span style={{ background: `${decColor}22`, color: decColor, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>
                              {tx.final_decision}
                            </span>
                          )}
                          {tx.scenario_name && (
                            <span style={{ background: '#388bfd22', color: '#58a6ff', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                              Scenario: {tx.scenario_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Case Activity Timeline Section */}
        {sortedTimeline.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="#58a6ff" /> Case Activity
              </h3>
            </div>
            <div className="panel-body" style={{ padding: 16 }}>
              <div style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid #30363d', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sortedTimeline.map((ev) => {
                  const style = EVENT_TYPE_STYLES[ev.event_type] || { color: '#c9d1d9', bg: '#21262d', icon: Info };
                  const Icon = style.icon;

                  return (
                    <div key={ev.id} style={{ position: 'relative', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: 12 }}>
                       <div style={{
                          position: 'absolute',
                          left: -31,
                          top: 16,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: style.color,
                          border: '2px solid #0d1117'
                        }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ background: style.bg, padding: 6, borderRadius: 6 }}>
                            <Icon size={16} color={style.color} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 'bold', color: style.color, textTransform: 'uppercase' }}>{ev.event_type}</span>
                              <span style={{ fontSize: 11, color: '#8b949e' }}>{new Date(ev.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.4 }}>
                              {ev.content}
                            </div>
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
      <div style={{ fontSize: 48 }}>⏱️</div>
      <div style={{ marginTop: 12 }}>Select a case above to view the transaction timeline, or run an analysis for temporal patterns.</div>
    </div>
  );

  return (
    <AppLayout title="Timeline">
      <CaseSelector 
        onIntelligenceLoaded={setCaseIntel}
        onCaseSelected={setSelectedCase}
      />
      
      {caseIntel ? (
        renderCaseTimeline()
      ) : data ? (
        renderTemporalAnalysis()
      ) : (
        renderEmptyState()
      )}
    </AppLayout>
  );
}

export default TimelinePage;
