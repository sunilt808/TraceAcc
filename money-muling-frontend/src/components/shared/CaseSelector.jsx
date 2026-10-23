import React, { useState, useEffect, useCallback } from 'react';
import { casesAPI } from '../../services/api';
import { Briefcase, RefreshCw, ChevronDown, AlertTriangle } from 'lucide-react';

const PRIORITY_COLORS = {
  CRITICAL: '#f85149',
  HIGH: '#f85149',
  MEDIUM: '#e3b341',
  LOW: '#3fb950',
};

/**
 * CaseSelector — shared toolbar component that lets users pick a case
 * and loads intelligence data from GET /cases/{id}/intelligence.
 *
 * Props:
 *   onIntelligenceLoaded(intel)  — called with full intelligence payload when loaded
 *   onCaseSelected(caseObj)      — called with the selected case summary object
 *   onLoading(bool)              — called with loading state
 *   onError(string)              — called with error message
 *   compact                      — if true, renders a minimal single-line selector
 */
export default function CaseSelector({ onIntelligenceLoaded, onCaseSelected, onLoading, onError, compact = false }) {
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [casesLoading, setCasesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [intel, setIntel] = useState(null);

  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const data = await casesAPI.list({});
      const items = data.items || data || [];
      setCases(items);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load cases';
      setError(msg);
      onError?.(msg);
    } finally {
      setCasesLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const loadIntelligence = useCallback(async (caseId) => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    onLoading?.(true);
    try {
      const data = await casesAPI.getIntelligence(caseId);
      setIntel(data);
      onIntelligenceLoaded?.(data);
      const caseObj = cases.find((c) => c.id === Number(caseId));
      onCaseSelected?.(caseObj || data.case);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load case intelligence';
      setError(msg);
      onError?.(msg);
      setIntel(null);
      onIntelligenceLoaded?.(null);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  }, [cases, onIntelligenceLoaded, onCaseSelected, onLoading, onError]);

  const handleSelect = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    if (id) {
      loadIntelligence(id);
    } else {
      setIntel(null);
      onIntelligenceLoaded?.(null);
      onCaseSelected?.(null);
    }
  };

  const selectedCase = cases.find((c) => c.id === Number(selectedId));

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? 8 : 12,
        alignItems: 'center',
        padding: compact ? '8px 12px' : '12px 16px',
        marginBottom: 16,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Briefcase size={16} color="#58a6ff" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f6fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Case Source
        </span>
      </div>

      <select
        value={selectedId}
        onChange={handleSelect}
        disabled={casesLoading}
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '6px 12px',
          color: '#f0f6fc',
          fontSize: 12,
          minWidth: 280,
          cursor: 'pointer',
        }}
      >
        <option value="">
          {casesLoading ? 'Loading cases…' : '— Select a case to load intelligence —'}
        </option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.id} — {c.title || 'Untitled'} [{c.status}] {c.priority ? `(${c.priority})` : ''}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => selectedId && loadIntelligence(selectedId)}
        disabled={!selectedId || loading}
        style={{
          background: '#21262d',
          border: '1px solid #30363d',
          borderRadius: 4,
          padding: '5px 10px',
          color: '#8b949e',
          fontSize: 11,
          cursor: selectedId ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        title="Refresh intelligence data"
      >
        <RefreshCw size={12} className={loading ? 'spin' : ''} />
        {loading ? 'Loading…' : 'Refresh'}
      </button>

      {/* Selected case summary pills */}
      {selectedCase && !loading && (
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {selectedCase.priority && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10,
                background: `${PRIORITY_COLORS[selectedCase.priority] || '#8b949e'}22`,
                color: PRIORITY_COLORS[selectedCase.priority] || '#8b949e',
                border: `1px solid ${PRIORITY_COLORS[selectedCase.priority] || '#8b949e'}55`,
              }}
            >
              {selectedCase.priority}
            </span>
          )}
          {intel && (
            <>
              <span style={{ fontSize: 11, color: '#8b949e' }}>
                {intel.accounts?.length || 0} accounts
              </span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>·</span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>
                {intel.transactions?.length || 0} txns
              </span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>·</span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>
                {intel.alerts?.length || 0} alerts
              </span>
            </>
          )}
        </div>
      )}

      {loading && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#58a6ff', fontSize: 12 }}>
          <div className="spinner" style={{ width: 14, height: 14 }} />
          Loading case intelligence…
        </div>
      )}

      {error && !loading && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#f85149', fontSize: 11 }}>
          <AlertTriangle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}
