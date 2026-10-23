import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { patternsAPI, dclcgAPI, analysisAPI } from '../../services/api';

const TIER_META = {
  basic: {
    label: 'Basic Patterns',
    icon: '🟢',
    color: '#3fb950',
    desc: 'Foundational laundering shapes — always-on heuristics.',
  },
  intermediate: {
    label: 'Intermediate / Hard Patterns',
    icon: '🟠',
    color: '#d29922',
    desc: 'Structural & temporal signatures that need deeper analysis.',
  },
  advanced_ml: {
    label: 'Advanced ML Patterns',
    icon: '🟣',
    color: '#a371f7',
    desc: 'Model-driven detections incl. the DC-LCG dual-view GNN.',
  },
};

const TIER_ORDER = ['basic', 'intermediate', 'advanced_ml'];

function AnalystPatternsPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useDclcg, setUseDclcg] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [expanded, setExpanded] = useState({});
  const [models, setModels] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    analysisAPI.listJobs()
      .then((data) => setJobs(data.jobs || data.items || []))
      .catch(() => {});
    dclcgAPI.listModels()
      .then((data) => setModels(data.items || []))
      .catch(() => {});
  }, []);

  const runSuite = async ({ file, jobId } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await patternsAPI.analyze({
        file,
        jobId: jobId || undefined,
        useDclcg,
      });
      setResult(data);
      setExpanded({});
    } catch (err) {
      setError(
        err?.response?.data?.detail
        || err.message
        || 'Pattern analysis failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    runSuite({ file: f });
    e.target.value = '';
  };

  const toggle = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <AppLayout
      title="Pattern Detection Suite"
     
    >
      {/* ── Controls ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <label style={{
          background: '#1f6feb', color: '#fff', padding: '8px 16px',
          borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
          fontWeight: 600, fontSize: 13, display: 'flex',
          alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1,
        }}>
          📤 Upload CSV / Excel
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFile}
            disabled={loading}
          />
        </label>

        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          style={{
            background: '#0d1117', border: '1px solid #30363d',
            borderRadius: 6, padding: '8px 12px', color: '#f0f6fc',
            fontSize: 13, maxWidth: 260,
          }}
        >
          <option value="">…or re-run a stored job</option>
          {(jobs || []).map((j) => (
            <option key={j.id} value={j.id}>
              #{j.id} — {j.filename}
            </option>
          ))}
        </select>

        <button
          onClick={() => selectedJob && runSuite({ jobId: selectedJob })}
          disabled={loading || !selectedJob}
          style={{
            background: selectedJob ? '#238636' : '#21262d',
            color: selectedJob ? '#fff' : '#8b949e',
            border: 'none', borderRadius: 6, padding: '8px 16px',
            fontWeight: 600, fontSize: 13, cursor:
              selectedJob && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          ▶ Run on Job
        </button>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, color: '#c9d1d9', cursor: 'pointer',
        }} title="Include the DC-LCG dual-view GNN pattern when a trained model exists">
          <input
            type="checkbox"
            checked={useDclcg}
            onChange={(e) => setUseDclcg(e.target.checked)}
          />
          Use DC-LCG model
        </label>

        {loading && (
          <span style={{ fontSize: 13, color: '#8b949e' }}>
            Running 15 detectors…
          </span>
        )}
      </div>

      {/* ── Model registry hint ──────────────────────────────── */}
      <div style={{
        marginBottom: 16, padding: '10px 14px', background: '#0d1117',
        border: '1px solid #21262d', borderRadius: 8, fontSize: 12.5,
        color: '#8b949e', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        🧠 DC-LCG registry:{' '}
        {models.length === 0 ? (
          <strong style={{ color: '#d29922' }}>no trained models</strong>
        ) : (
          <>
            <strong style={{ color: '#a371f7' }}>{models.length}</strong>
            &nbsp;model(s); latest:&nbsp;
            <code style={{ color: '#c9d1d9' }}>
              {models.find((m) => m.is_latest)?.name || models[0]?.name}
            </code>
          </>
        )}
        &nbsp;— train via&nbsp;
        <code style={{ color: '#388bfd' }}>POST /dclcg/train</code>
        &nbsp;with a labeled CSV.
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', background: '#f8514918',
          border: '1px solid #f8514955', borderRadius: 8,
          color: '#f85149', fontSize: 13, marginBottom: 16,
        }}>
          ⚠ {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!result && !loading && !error && (
        <div style={{
          background: '#0d1117', border: '1px solid #21262d',
          borderRadius: 10, padding: '48px 24px', textAlign: 'center',
          color: '#8b949e',
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🧩</div>
          <div style={{ fontSize: 15, color: '#c9d1d9', fontWeight: 600, marginBottom: 6 }}>
            Run the 15-pattern suite on any dataset
          </div>
          <div style={{ fontSize: 13 }}>
            Upload a CSV/Excel file or re-run against one of your stored jobs.
          </div>
        </div>
      )}

      {/* ── Summary header ───────────────────────────────────── */}
      {result && (
        <>
          <div style={{
            display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap',
          }}>
            {[
              ['Dataset', result.source],
              ['Accounts', result.total_accounts],
              ['Transactions', result.total_transactions],
              ['Flagged (total)', result.total_flagged_accounts],
              ['DC-LCG', result.dclcg_available ? 'ON' : 'OFF'],
            ].map(([k, v]) => (
              <div key={k} style={{
                flex: '1 1 130px', background: '#0d1117',
                border: '1px solid #21262d', borderRadius: 8, padding: '10px 14px',
              }}>
                <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase' }}>
                  {k}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: '#f0f6fc',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {String(v)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Tier groups ──────────────────────────────────── */}
          {TIER_ORDER.map((tier) => {
            const meta = TIER_META[tier];
            const blocks = result.patterns.filter((p) => p.tier === tier);
            return (
              <div key={tier} style={{ marginBottom: 22 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                }}>
                  <span style={{ fontSize: 17 }}>{meta.icon}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: meta.color,
                  }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#8b949e' }}>
                    {blocks.length} detectors · {meta.desc}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {blocks.map((p) => {
                    const open = !!expanded[p.key];
                    const hot = p.flagged_count > 0;
                    return (
                      <div key={p.key} style={{
                        background: '#0d1117',
                        border: `1px solid ${hot ? `${meta.color}55` : '#21262d'}`,
                        borderRadius: 8, overflow: 'hidden',
                      }}>
                        <div
                          onClick={() => toggle(p.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', cursor: 'pointer',
                          }}
                        >
                          <span style={{
                            minWidth: 30, height: 20, borderRadius: 10,
                            display: 'inline-flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 11,
                            fontWeight: 700, color: hot ? '#fff' : '#8b949e',
                            background: hot ? p.flagged_count >= 5
                              ? '#f85149' : meta.color : '#161b22',
                            padding: '0 8px',
                          }}>
                            {p.flagged_count}
                          </span>
                          <span style={{
                            fontSize: 13.5, fontWeight: 600, color: '#f0f6fc',
                          }}>
                            {p.name}
                          </span>
                          <span style={{
                            fontSize: 11.5, color: '#8b949e', flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {p.description}
                          </span>
                          <span style={{ fontSize: 11, color: '#8b949e' }}>
                            {p.runtime_ms} ms
                          </span>
                          <span style={{ color: '#8b949e', fontSize: 12 }}>
                            {open ? '▾' : '▸'}
                          </span>
                        </div>

                        {open && (
                          <div style={{
                            borderTop: '1px solid #21262d',
                            padding: '10px 14px', maxHeight: 320,
                            overflowY: 'auto',
                          }}>
                            {p.flagged_count === 0 ? (
                              <div style={{ fontSize: 12.5, color: '#8b949e' }}>
                                No accounts matched this pattern.
                              </div>
                            ) : p.key === 'circular_transaction'
                              || p.key === 'layering_shells' ? (
                              (p.details.rings || p.details.chains || []).map((r) => (
                                <div key={r.ring_id || r.chain_id} style={{
                                  fontFamily: 'monospace', fontSize: 12,
                                  color: '#c9d1d9', padding: '4px 8px',
                                  background: '#161b22', borderRadius: 4,
                                  marginBottom: 4,
                                }}>
                                  <span style={{ color: meta.color }}>
                                    {r.ring_id || r.chain_id}:{' '}
                                  </span>
                                  {r.path.join(' → ')}
                                </div>
                              ))
                            ) : p.key === 'fan_in' || p.key === 'fan_out' ? (
                              (p.details.rings || []).map((r, i) => (
                                <div key={`${r.hub}-${i}`} style={{
                                  fontFamily: 'monospace', fontSize: 12,
                                  color: '#c9d1d9', padding: '4px 8px',
                                  background: '#161b22', borderRadius: 4,
                                  marginBottom: 4,
                                }}>
                                  hub <span style={{ color: meta.color }}>{r.hub}</span>{' '}
                                  ↔ {r.members.length - 1} counterpart(s)
                                </div>
                              ))
                            ) : (
                              <table style={{
                                width: '100%', borderCollapse: 'collapse',
                                fontSize: 12,
                              }}>
                                <thead>
                                  <tr style={{ color: '#8b949e', textAlign: 'left' }}>
                                    {Object.keys(p.accounts[0] || {})
                                      .filter((k) => k !== 'details')
                                      .map((k) => (
                                        <th key={k} style={{
                                          padding: '4px 8px',
                                          borderBottom: '1px solid #21262d',
                                        }}>
                                          {k.replace(/_/g, ' ')}
                                        </th>
                                      ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.accounts.slice(0, 50).map((a, i) => (
                                    <tr key={a.account_id || i}>
                                      {Object.keys(p.accounts[0] || {})
                                        .filter((k) => k !== 'details')
                                        .map((k) => (
                                          <td key={k} style={{
                                            padding: '4px 8px',
                                            borderBottom: '1px solid #161b22',
                                            fontFamily: k === 'account_id'
                                              ? 'monospace' : undefined,
                                            color: k === 'account_id'
                                              ? '#388bfd' : '#c9d1d9',
                                          }}>
                                            {typeof a[k] === 'object'
                                              ? JSON.stringify(a[k])
                                              : String(a[k])}
                                          </td>
                                        ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {result.warnings?.length > 0 && (
            <div style={{
              padding: '10px 14px', background: '#d2992215',
              border: '1px solid #d2992255', borderRadius: 8,
              fontSize: 12, color: '#d29922',
            }}>
              Detector warnings:{' '}
              {result.warnings.join(' · ')}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

export default AnalystPatternsPage;
