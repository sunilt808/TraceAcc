import React, { useMemo, useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';

export default function CommunitiesPage() {
  const [view, setView] = useState('louvain');
  const { analysisResult: data } = useAnalysis();

  if (!data) {
    return (
      <AppLayout title="Communities" subtitle="Detected account clusters">
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
          <div style={{ fontSize: 48 }}>👥</div>
          <div style={{ marginTop: 12 }}>Run an analysis to detect communities.</div>
        </div>
      </AppLayout>
    );
  }

  const community = data.communities || {};
  const components = data.components || {};

  const louvainMap    = community.louvain    || {};
  const labelPropMap  = community.label_propagation || {};
  const girvanList    = community.girvan_newman || [];

  // Group by community ID for the chosen algorithm
  const groupByComm = (map) => {
    const groups = {};
    Object.entries(map).forEach(([node, commId]) => {
      groups[commId] = groups[commId] || [];
      groups[commId].push(node);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  };

  const louvainGroups   = groupByComm(louvainMap);
  const labelPropGroups = groupByComm(labelPropMap);

  const COMM_COLORS = [
    '#1f6feb','#3fb950','#e3b341','#f85149','#a371f7',
    '#39d353','#fd7e14','#0dcaf0','#d63384','#20c997',
  ];

  const renderGroups = (groups) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
      {groups.map(([commId, members], idx) => (
        <div key={commId} className="panel" style={{
          border: `1px solid ${COMM_COLORS[idx % COMM_COLORS.length]}44`,
        }}>
          <div className="panel-header" style={{ padding: '10px 14px' }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: COMM_COLORS[idx % COMM_COLORS.length], marginRight: 8,
            }} />
            <span className="panel-title">Community #{commId}</span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, color: '#8b949e',
              background: '#21262d', padding: '2px 8px', borderRadius: 10,
            }}>
              {members.length} members
            </span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {members.slice(0, 20).map((m) => (
              <span key={m} style={{
                fontSize: 10, fontFamily: 'monospace',
                background: '#161b22', padding: '2px 6px', borderRadius: 4, color: '#c9d1d9',
              }}>
                {m}
              </span>
            ))}
            {members.length > 20 && (
              <span style={{ fontSize: 10, color: '#8b949e' }}>+{members.length - 20} more</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const scc = components.scc || [];
  const wcc = components.wcc || [];

  return (
    <AppLayout title="Communities" subtitle="Detected account clusters">
      {/* Summary */}
      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-card-label">Louvain Communities</div>
          <div className="stat-card-value">{louvainGroups.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Label Propagation</div>
          <div className="stat-card-value">{labelPropGroups.length}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-label">Strongly Connected</div>
          <div className="stat-card-value">{scc.length}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-card-label">Weakly Connected</div>
          <div className="stat-card-value">{wcc.length}</div>
        </div>
      </div>

      {/* Algorithm switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['louvain', 'label_propagation', 'scc', 'wcc'].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={view === v ? 'btn-primary' : 'btn-secondary'}
          >
            {v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Community groups */}
      {view === 'louvain'           && renderGroups(louvainGroups)}
      {view === 'label_propagation' && renderGroups(labelPropGroups)}

      {view === 'scc' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {scc.map((comp, idx) => (
            <div key={comp.component_id} className="panel" style={{ border: '1px solid #f85149aa' }}>
              <div className="panel-header" style={{ padding: '10px 14px' }}>
                <span className="panel-title">{comp.component_id}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#f85149' }}>
                  {comp.size} members
                </span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {comp.members.map((m) => (
                  <span key={m} style={{
                    fontSize: 10, fontFamily: 'monospace', background: '#161b22',
                    padding: '2px 6px', borderRadius: 4, color: '#f85149',
                  }}>{m}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'wcc' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {wcc.map((comp, idx) => (
            <div key={comp.component_id} className="panel" style={{ border: '1px solid #e3b341aa' }}>
              <div className="panel-header" style={{ padding: '10px 14px' }}>
                <span className="panel-title">{comp.component_id}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#e3b341' }}>
                  {comp.size} members
                </span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {comp.members.map((m) => (
                  <span key={m} style={{
                    fontSize: 10, fontFamily: 'monospace', background: '#161b22',
                    padding: '2px 6px', borderRadius: 4, color: '#e3b341',
                  }}>{m}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
