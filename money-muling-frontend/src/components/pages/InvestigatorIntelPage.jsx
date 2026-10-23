import React, { useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { intelAPI, analysisAPI } from '../../services/api';

function InvestigatorIntelPage() {
  // ── inputs ───────────────────────────────────────────────────────
  const [accountId, setAccountId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [pathJobId, setPathJobId] = useState('');
  const [depth, setDepth] = useState(3);

  // ── data ─────────────────────────────────────────────────────────
  const [overview, setOverview] = useState(null);
  const [similar, setSimilar] = useState(null);
  const [paths, setPaths] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const loadJobs = async () => {
    if (jobsLoaded) return;
    try {
      const data = await analysisAPI.listJobs();
      const list = data.jobs || data.items || [];
      setJobs(list);
      if (list.length > 0) setPathJobId(String(list[0].id));
      setJobsLoaded(true);
    } catch {
      /* job dropdown is optional for overview/similar */
    }
  };

  const call = async (tag, fn) => {
    setBusy(tag);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : err.message || 'Intel request failed.',
      );
    } finally {
      setBusy('');
    }
  };

  const loadOverview = () => {
    if (!accountId.trim()) return;
    loadOverviewAsync();
  };

  const loadOverviewAsync = async () => {
    await call('ov', async () => {
      const data = await intelAPI.overview(accountId.trim());
      setOverview(data);
    });
  };

  const loadSimilar = async () => {
    if (!accountId.trim()) return;
    await call('sim', async () => {
      const data = await intelAPI.similar(accountId.trim(), 8);
      setSimilar(data);
    });
  };

  const loadPaths = async () => {
    if (!accountId.trim() || !pathJobId) return;
    await call('pth', async () => {
      const data = await intelAPI.paths(
        accountId.trim(), Number(pathJobId), Number(depth), 5,
      );
      setPaths(data);
    });
  };

  const inputStyle = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    padding: '8px 12px', color: '#f0f6fc', fontSize: 13,
  };
  const btnStyle = (enabled) => ({
    background: enabled ? '#1f6feb' : '#21262d',
    color: enabled ? '#fff' : '#8b949e',
    border: 'none', borderRadius: 6, padding: '8px 16px',
    fontWeight: 600, fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
  });

  return (
    <AppLayout
      title="Investigation Intelligence Hub"
      >
      {/* ── Query bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 18,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <input
          style={{ ...inputStyle, minWidth: 240 }}
          placeholder="Account ID e.g. ACC10023"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadOverview()}
          onFocus={loadJobs}
        />
        <button style={btnStyle(!!accountId && busy === '')} onClick={loadOverview}>
          {busy === 'ov' ? 'Loading…' : '🔎 Dossier'}
        </button>
        <button
          style={btnStyle(!!accountId && busy === '')}
          onClick={loadSimilar}
        >
          {busy === 'sim' ? 'Scoring…' : '👥 Similar Accounts'}
        </button>
        <select
          style={inputStyle}
          value={pathJobId}
          onChange={(e) => setPathJobId(e.target.value)}
          onFocus={loadJobs}
        >
          <option value="">dataset job…</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>#{j.id} — {j.filename}</option>
          ))}
        </select>
        <select
          style={{ ...inputStyle, width: 90 }}
          value={depth}
          onChange={(e) => setDepth(e.target.value)}
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>{d} hops</option>
          ))}
        </select>
        <button
          style={btnStyle(!!accountId && !!pathJobId && busy === '')}
          onClick={loadPaths}
        >
          {busy === 'pth' ? 'Tracing…' : '💰 Money Paths'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', background: '#f8514918',
          border: '1px solid #f8514955', borderRadius: 8,
          color: '#f85149', fontSize: 13, marginBottom: 16,
        }}>
          ⚠ {error}
        </div>
      )}

      {!overview && !similar && !paths && !error && (
        <div style={{
          background: '#0d1117', border: '1px solid #21262d',
          borderRadius: 10, padding: '48px 24px', textAlign: 'center',
          color: '#8b949e',
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🕵️</div>
          <div style={{
            fontSize: 15, color: '#c9d1d9', fontWeight: 600, marginBottom: 6,
          }}>
            Search any account seen in stored analyses
          </div>
          <div style={{ fontSize: 13 }}>
            Cross-job dossier history · cosine-similar counterparts ·
            risk-ranked money paths from the original dataset.
          </div>
        </div>
      )}

      {/* ── Overview dossier ──────────────────────────────────── */}
      {overview && (
        <Section title={`Dossier — ${overview.account_id}`} icon="🗂️">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Jobs seen in', overview.jobs_scanned],
              ['Risk (latest)', overview.risk_latest ?? '—'],
              ['Risk (max)', overview.risk_max ?? '—'],
              ['Linked alerts', overview.linked_alert_count],
            ].map(([k, v]) => (
              <div key={k} style={{
                flex: '1 1 120px', background: '#161b22', borderRadius: 8,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: '#8b949e' }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>
                  {String(v)}
                </div>
              </div>
            ))}
          </div>

          {overview.pattern_frequency?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SubTitle>Pattern frequency (across jobs)</SubTitle>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {overview.pattern_frequency.map(([name, count]) => (
                  <span key={name} style={{
                    fontSize: 11.5, color: '#c9d1d9', background: '#21262d',
                    padding: '3px 10px', borderRadius: 10,
                  }}>
                    {name.replace(/_/g, ' ')} ×{count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <SubTitle>Appearances</SubTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: '#8b949e', textAlign: 'left' }}>
                <th style={cellHead}>Job</th>
                <th style={cellHead}>File</th>
                <th style={cellHead}>Final score</th>
                <th style={cellHead}>Tier</th>
                <th style={cellHead}>DC-LCG p</th>
                <th style={cellHead}>Patterns</th>
              </tr>
            </thead>
            <tbody>
              {overview.appearances.map((a) => (
                <tr key={`${a.job_id}`}>
                  <td style={cell}>#{a.job_id}</td>
                  <td style={cell}>{a.filename}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{a.final_score}</td>
                  <td style={cell}>
                    <span className={`risk-badge risk-${a.risk_tier}`}>
                      {a.risk_tier}
                    </span>
                  </td>
                  <td style={cell}>
                    {a.dclcg_prob != null
                      ? `${(a.dclcg_prob * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ ...cell, color: '#8b949e' }}>
                    {(a.patterns || []).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {overview.linked_alerts.length > 0 && (
            <>
              <SubTitle>Linked alerts</SubTitle>
              {overview.linked_alerts.map((al) => (
                <div key={al.id} style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '6px 10px', background: '#161b22',
                  borderRadius: 6, marginBottom: 4, fontSize: 12.5,
                }}>
                  <strong style={{ color: '#f0f6fc' }}>#{al.id}</strong>
                  <span style={{ color: '#c9d1d9' }}>{al.alert_type}</span>
                  <span style={{
                    color: al.severity === 'CRITICAL' || al.severity === 'HIGH'
                      ? '#f85149' : '#d29922', fontWeight: 600,
                  }}>
                    {al.severity}
                  </span>
                  <span style={{ color: '#8b949e', marginLeft: 'auto' }}>
                    {al.status}
                  </span>
                </div>
              ))}
            </>
          )}
        </Section>
      )}

      {/* ── Similar accounts ──────────────────────────────────── */}
      {similar && (
        <Section
          title={`Accounts similar to ${similar.account_id}`}
          icon="👥"
        >
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10 }}>
            Cosine similarity over mean {similar.vector_dims}-dimension
            risk-breakdown vectors across stored jobs.
          </div>
          {similar.candidates.map((c) => (
            <div key={c.account_id} style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5,
              }}>
                <code
                  style={{ color: '#388bfd', cursor: 'pointer', minWidth: 110 }}
                  onClick={() => setAccountId(c.account_id)}
                  title="Load this account"
                >
                  {c.account_id}
                </code>
                <div style={{
                  flex: 1, height: 7, background: '#161b22', borderRadius: 4,
                }}>
                  <div style={{
                    width: `${Math.round(c.similarity * 100)}%`,
                    height: '100%', borderRadius: 4, background: '#1f6feb',
                  }} />
                </div>
                <span style={{ color: '#c9d1d9', minWidth: 52 }}>
                  {(c.similarity * 100).toFixed(1)}%
                </span>
                <span style={{ color: '#8b949e', minWidth: 130 }}>
                  {c.jobs_seen} jobs · avg {c.avg_final_score ?? '—'}
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* ── Money paths ───────────────────────────────────────── */}
      {paths && (
        <Section title={`Money paths from ${paths.account_id}`} icon="💰">
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10 }}>
            Job #{paths.job_id} dataset · depth {paths.depth} · ranked by
            mean hybrid/DC-LCG node weight along each path.
          </div>
          {paths.paths.length === 0 && (
            <div style={{ fontSize: 13, color: '#8b949e' }}>
              No outgoing paths found within the hop limit.
            </div>
          )}
          {paths.paths.map((p, i) => (
            <div key={i} style={{
              padding: '10px 14px', background: '#161b22',
              borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{
                fontFamily: 'monospace', fontSize: 13, color: '#f0f6fc',
                marginBottom: 6,
              }}>
                {p.path.join(' → ')}
              </div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                {p.hops} hops · total ${p.total_amount?.toLocaleString()} ·{' '}
                risk score{' '}
                <strong style={{
                  color: p.score >= 0.6 ? '#f85149'
                    : p.score >= 0.35 ? '#d29922' : '#3fb950',
                }}>
                  {p.score.toFixed(3)}
                </strong>
              </div>
            </div>
          ))}
        </Section>
      )}
    </AppLayout>
  );
}

const cellHead = {
  padding: '6px 8px', borderBottom: '1px solid #21262d',
};
const cell = {
  padding: '6px 8px', borderBottom: '1px solid #161b22', color: '#c9d1d9',
};

function Section({ title, icon, children }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d',
      borderRadius: 10, padding: 18, marginBottom: 18,
    }}>
      <div style={{
        fontWeight: 700, fontSize: 14, color: '#f0f6fc', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function SubTitle({ children }) {
  return (
    <div style={{
      fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5,
      color: '#8b949e', margin: '12px 0 6px',
    }}>
      {children}
    </div>
  );
}

export default InvestigatorIntelPage;
