import React, { useMemo } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';

export default function ReportsPage() {
  const { analysisResult: data } = useAnalysis();

  const handleDownload = (type) => {
    if (!data) return alert('No analysis data to download.');
    
    let content = '';
    let filename = `aml_report_${Date.now()}`;
    let mime = 'text/plain';

    if (type === 'json') {
      content = JSON.stringify(data, null, 2);
      filename += '.json';
      mime = 'application/json';
    } else if (type === 'csv') {
      const rows = [['Account', 'Risk Tier', 'Final Score', 'Graph', 'Behaviour', 'Temporal', 'ML', 'Community']];
      (data.hybrid_scores || []).forEach(h => {
        rows.push([
          h.account_id, h.risk_tier, h.final_score,
          h.breakdown?.graph_score || 0, h.breakdown?.behaviour_score || 0,
          h.breakdown?.temporal_score || 0, h.breakdown?.ml_score || 0,
          h.breakdown?.community_score || 0
        ]);
      });
      content = rows.map(r => r.join(',')).join('\n');
      filename += '.csv';
      mime = 'text/csv';
    } else {
      alert(`Export format ${type} is not yet fully implemented in the frontend mock.`);
      return;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Reports" subtitle="Export analysis results">
      <div style={{ maxWidth: 800 }}>
        <div className="panel">
          <div className="panel-header">
            <span>📄</span><h3 className="panel-title">Generate Report</h3>
          </div>
          <div className="panel-body">
            <p style={{ color: '#8b949e', marginBottom: 24, fontSize: 14 }}>
              Export the current analysis session results for external review, audit compliance, or archiving.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div 
                style={{ 
                  border: '1px solid #30363d', borderRadius: 8, padding: 20, 
                  cursor: 'pointer', transition: 'border 0.2s', background: '#161b22' 
                }}
                onClick={() => handleDownload('csv')}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#388bfd'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>CSV Export</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>Tabular data of all risk scores and breakdowns. Suitable for Excel.</div>
              </div>

              <div 
                style={{ 
                  border: '1px solid #30363d', borderRadius: 8, padding: 20, 
                  cursor: 'pointer', transition: 'border 0.2s', background: '#161b22' 
                }}
                onClick={() => handleDownload('json')}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3fb950'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{'{ }'}</div>
                <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>Full JSON Dump</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>Complete raw output of the analysis including all detector payloads.</div>
              </div>

              <div 
                style={{ 
                  border: '1px solid #30363d', borderRadius: 8, padding: 20, 
                  cursor: 'not-allowed', background: '#0d1117', opacity: 0.6 
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>📑</div>
                <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>PDF Report (Coming Soon)</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>Formatted executive summary with charts and findings.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
