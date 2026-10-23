import React, { useState } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAnalysis } from '../../context/AnalysisContext';
import CaseSelector from '../shared/CaseSelector';
import { Users, Network, Shield, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function CommunitiesPage() {
  const [view, setView] = useState('louvain');
  const { analysisResult: data } = useAnalysis();
  
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseIntel, setCaseIntel] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleIntelLoaded = (intel) => {
    setCaseIntel(intel);
    if (intel) {
      setView('alert_clusters');
    } else {
      setView('louvain');
    }
  };

  let alertClusters = [];
  let roleGroups = {};
  let riskTiers = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], UNKNOWN: [] };
  let connectedComponents = [];
  let summaryStats = { alertClusters: 0, uniqueRoles: 0, flaggedAccounts: 0, totalAccounts: 0 };

  if (caseIntel) {
    const { accounts = [], alerts = [], graph = { edges: [], nodes: [] } } = caseIntel;
    
    summaryStats.totalAccounts = accounts.length;
    summaryStats.flaggedAccounts = accounts.filter(a => a.is_flagged).length;
    summaryStats.alertClusters = alerts.length;
    
    alertClusters = alerts.map(a => ({
      id: a.id,
      alert_type: a.alert_type,
      risk_score: a.risk_score,
      members: a.related_accounts || []
    }));
    
    accounts.forEach(acc => {
      const role = acc.role || 'UNKNOWN';
      if (!roleGroups[role]) roleGroups[role] = [];
      roleGroups[role].push(acc);
    });
    summaryStats.uniqueRoles = Object.keys(roleGroups).length;

    accounts.forEach(acc => {
      const tier = acc.risk_tier || 'UNKNOWN';
      if (!riskTiers[tier]) riskTiers[tier] = [];
      riskTiers[tier].push(acc);
    });

    const adj = {};
    graph.nodes.forEach(n => adj[n.data.id] = []);
    graph.edges.forEach(e => {
      const s = e.data.source;
      const t = e.data.target;
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push(t);
      adj[t].push(s);
    });

    const visited = new Set();
    const nodes = Object.keys(adj);
    nodes.forEach(node => {
      if (!visited.has(node)) {
        const comp = [];
        const queue = [node];
        visited.add(node);
        while(queue.length > 0) {
          const curr = queue.shift();
          comp.push(curr);
          (adj[curr] || []).forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
        if (comp.length > 0) {
          connectedComponents.push(comp);
        }
      }
    });
    connectedComponents.sort((a,b) => b.length - a.length);
  }

  const community = data?.communities || {};
  const components = data?.components || {};

  const louvainMap    = community.louvain    || {};
  const labelPropMap  = community.label_propagation || {};

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

  const getRiskColor = (tier) => {
    switch (tier) {
      case 'CRITICAL': return '#f85149';
      case 'HIGH': return '#fd7e14';
      case 'MEDIUM': return '#e3b341';
      case 'LOW': return '#3fb950';
      default: return '#8b949e';
    }
  };

  return (
    <AppLayout title="Communities">
      <div style={{ marginBottom: 20 }}>
        <CaseSelector 
          onIntelligenceLoaded={handleIntelLoaded}
          onCaseSelected={(c) => setSelectedCase(c)}
          onLoading={(l) => setLoading(l)}
        />
      </div>

      {!selectedCase && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>
          <div style={{ fontSize: 48 }}>👥</div>
          <div style={{ marginTop: 12 }}>Select a case to analyze mule communities, or run an analysis for community detection.</div>
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
          Loading case intelligence...
        </div>
      )}

      {selectedCase && caseIntel && !loading && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card accent">
              <div className="stat-card-label"><AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/> Alert Clusters</div>
              <div className="stat-card-value">{summaryStats.alertClusters}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label"><Users size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/> Unique Roles</div>
              <div className="stat-card-value">{summaryStats.uniqueRoles}</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-card-label"><ShieldAlert size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/> Flagged Accounts</div>
              <div className="stat-card-value">{summaryStats.flaggedAccounts}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label"><Network size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/> Total Accounts</div>
              <div className="stat-card-value">{summaryStats.totalAccounts}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
            {['alert_clusters', 'role_groups', 'risk_tiers', 'connected_components'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={view === v ? 'btn-primary' : 'btn-secondary'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {v.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </div>

          {view === 'alert_clusters' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
              {alertClusters.map((cluster) => (
                <div key={cluster.id} className="panel" style={{ border: '1px solid #30363d' }}>
                  <div className="panel-header" style={{ padding: '10px 14px', borderBottom: '1px solid #30363d' }}>
                    <span className="panel-title">{cluster.alert_type}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11,
                      background: cluster.risk_score > 80 ? '#f8514933' : '#e3b34133',
                      color: cluster.risk_score > 80 ? '#f85149' : '#e3b341',
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      Score {cluster.risk_score}
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>{cluster.members.length} members</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {cluster.members.map((m) => (
                        <span key={m} style={{
                          fontSize: 10, fontFamily: 'monospace',
                          background: '#161b22', border: '1px solid #30363d',
                          padding: '2px 6px', borderRadius: 4, color: '#c9d1d9',
                        }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'role_groups' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
              {Object.entries(roleGroups).sort((a,b) => b[1].length - a[1].length).map(([role, members]) => (
                <div key={role} className="panel" style={{ border: '1px solid #30363d' }}>
                  <div className="panel-header" style={{ padding: '10px 14px' }}>
                    <Users size={14} style={{ marginRight: 6, color: '#a371f7' }} />
                    <span className="panel-title">{role}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, color: '#8b949e',
                      background: '#21262d', padding: '2px 8px', borderRadius: 10,
                    }}>
                      {members.length} members
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {members.map((m) => (
                      <span key={m.account_id} style={{
                        fontSize: 10, fontFamily: 'monospace',
                        background: '#161b22', padding: '2px 6px', borderRadius: 4, color: '#c9d1d9',
                        border: '1px solid #30363d'
                      }}>
                        {m.account_id}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'risk_tiers' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
              {Object.entries(riskTiers).filter(([_, members]) => members.length > 0).map(([tier, members]) => (
                <div key={tier} className="panel" style={{ border: `1px solid ${getRiskColor(tier)}44` }}>
                  <div className="panel-header" style={{ padding: '10px 14px' }}>
                    <Shield size={14} style={{ marginRight: 6, color: getRiskColor(tier) }} />
                    <span className="panel-title" style={{ color: getRiskColor(tier) }}>{tier}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, color: '#8b949e',
                      background: '#21262d', padding: '2px 8px', borderRadius: 10,
                    }}>
                      {members.length} members
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {members.map((m) => (
                      <span key={m.account_id} style={{
                        fontSize: 10, fontFamily: 'monospace',
                        background: '#161b22', padding: '2px 6px', borderRadius: 4, color: '#c9d1d9',
                        border: `1px solid ${getRiskColor(tier)}33`
                      }}>
                        {m.account_id}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'connected_components' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
              {connectedComponents.map((comp, idx) => (
                <div key={idx} className="panel" style={{ border: '1px solid #30363d' }}>
                  <div className="panel-header" style={{ padding: '10px 14px' }}>
                    <Network size={14} style={{ marginRight: 6, color: '#58a6ff' }} />
                    <span className="panel-title">Component #{idx + 1}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, color: '#8b949e',
                      background: '#21262d', padding: '2px 8px', borderRadius: 10,
                    }}>
                      {comp.length} members
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {comp.map((m) => (
                      <span key={m} style={{
                        fontSize: 10, fontFamily: 'monospace',
                        background: '#161b22', padding: '2px 6px', borderRadius: 4, color: '#c9d1d9',
                        border: '1px solid #30363d'
                      }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!selectedCase && data && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
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

          {view === 'louvain'           && renderGroups(louvainGroups)}
          {view === 'label_propagation' && renderGroups(labelPropGroups)}

          {view === 'scc' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
              {scc.map((comp) => (
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
              {wcc.map((comp) => (
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
        </>
      )}
    </AppLayout>
  );
}
