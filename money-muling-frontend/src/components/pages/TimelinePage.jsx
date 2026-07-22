import React, { useMemo } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';

export default function TimelinePage() {
  const { analysisResult: data } = useAnalysis();

  if (!data) {
    return (
      <AppLayout title="Timeline" subtitle="Temporal transaction patterns">
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
          <div style={{ fontSize: 48 }}>⏱️</div>
          <div style={{ marginTop: 12 }}>Run an analysis to view timeline data.</div>
        </div>
      </AppLayout>
    );
  }

  const temporal = data.temporal || {};
  const nightActors   = temporal.night_actors || [];
  const weekendActors = temporal.weekend_actors || [];
  const rapidMovers   = temporal.rapid_movers || [];
  const periodic      = temporal.periodic_actors || [];

  return (
    <AppLayout title="Timeline" subtitle="Suspicious temporal behaviour patterns">
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
    </AppLayout>
  );
}
