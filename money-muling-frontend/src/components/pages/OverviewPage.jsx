import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import api from '../../services/api';

const StatCard = ({ label, value, sub, accent }) => (
  <div className={`stat-card ${accent || ''}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value ?? '—'}</div>
    {sub && <div className="stat-card-sub">{sub}</div>}
  </div>
);

export default function OverviewPage() {
  const [jobs, setJobs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [jobsRes, statsRes] = await Promise.allSettled([
          api.get('/analyze/jobs?limit=5'),
          api.get('/audit/stats'),
        ]);
        if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data);
        if (statsRes.status === 'fulfilled') setAuditStats(statsRes.value.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const lastJob = jobs[0];

  return (
    <AppLayout title="Overview" subtitle="Platform summary">
      <div className="stat-grid">
        <StatCard
          label="Total Analyses Run"
          value={jobs.length >= 5 ? '5+' : jobs.length}
          sub="this session"
          accent="accent"
        />
        <StatCard
          label="Last Accounts Analyzed"
          value={lastJob?.total_accounts ?? '—'}
          sub={lastJob ? `in ${lastJob.processing_time_seconds}s` : 'No analysis yet'}
        />
        <StatCard
          label="Suspicious Flagged"
          value={lastJob?.suspicious_accounts ?? '—'}
          sub="last analysis"
          accent="danger"
        />
        <StatCard
          label="Fraud Rings Found"
          value={lastJob?.fraud_rings ?? '—'}
          sub="last analysis"
          accent="warning"
        />
        <StatCard
          label="Total Login Events"
          value={auditStats?.login_count ?? '—'}
          sub="audit log"
          accent="success"
        />
        <StatCard
          label="Failed Login Attempts"
          value={auditStats?.failed_login_count ?? '—'}
          sub="security monitor"
          accent={auditStats?.failed_login_count > 0 ? 'danger' : ''}
        />
      </div>

      {/* Recent jobs table */}
      <div className="panel">
        <div className="panel-header">
          <span style={{ fontSize: 16 }}>📋</span>
          <h3 className="panel-title">Recent Analysis Jobs</h3>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8b949e' }}>
              No analyses yet. Upload a CSV to get started.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>Accounts</th>
                  <th>Flagged</th>
                  <th>Rings</th>
                  <th>Time (s)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td style={{ color: '#f0f6fc', fontWeight: 500 }}>{j.filename}</td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: j.status === 'completed' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                          color: j.status === 'completed' ? '#3fb950' : '#f85149',
                        }}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td>{j.total_accounts}</td>
                    <td style={{ color: '#f85149', fontWeight: 600 }}>{j.suspicious_accounts}</td>
                    <td style={{ color: '#e3b341', fontWeight: 600 }}>{j.fraud_rings}</td>
                    <td>{j.processing_time_seconds?.toFixed(2)}</td>
                    <td style={{ color: '#8b949e', fontSize: 12 }}>
                      {j.created_at ? new Date(j.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="panel">
        <div className="panel-header">
          <span style={{ fontSize: 16 }}>🚀</span>
          <h3 className="panel-title">Quick Actions</h3>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/dashboard',   icon: '🔍', label: 'Run Analysis' },
            { href: '/graph-viewer',icon: '🕸️', label: 'View Graph' },
            { href: '/risk-map',    icon: '🗺️', label: 'Risk Map' },
            { href: '/statistics',  icon: '📈', label: 'Statistics' },
            { href: '/reports',     icon: '📄', label: 'Generate Report' },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 8,
                background: '#161b22', border: '1px solid #30363d',
                color: '#c9d1d9', textDecoration: 'none',
                fontSize: 13, fontWeight: 500,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1f6feb';
                e.currentTarget.style.color = '#f0f6fc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#30363d';
                e.currentTarget.style.color = '#c9d1d9';
              }}
            >
              {a.icon} {a.label}
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
