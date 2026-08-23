/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../services/api';

const AnalysisContext = createContext();

export function AnalysisProvider({ children }) {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Load from session storage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('globalAnalysisResult');
      if (cached) {
        setAnalysisResult(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Failed to load cached analysis', e);
    }
  }, []);

  // serviceRequestId: optional — links this run to a workbench request so
  // the result is persisted server-side and reloadable by the whole team.
  const runAnalysis = async (file, { serviceRequestId } = {}) => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (serviceRequestId != null) {
        formData.append('service_request_id', String(serviceRequestId));
      }

      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/analyze/advanced`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Analysis failed');
      }

      const data = await res.json();
      setAnalysisResult(data);
      sessionStorage.setItem('globalAnalysisResult', JSON.stringify(data));
      return data;
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reload a previously persisted analysis result from the backend
  // (jobs run with a linked request keep their full result server-side).
  const loadStoredResult = async (jobId) => {
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/analyze/jobs/${jobId}/result`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Could not load stored result');
      }

      const data = await res.json();
      setAnalysisResult(data);
      sessionStorage.setItem('globalAnalysisResult', JSON.stringify(data));
      return data;
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    }
  };

  const clearAnalysis = () => {
    setAnalysisResult(null);
    sessionStorage.removeItem('globalAnalysisResult');
  };

  return (
    <AnalysisContext.Provider value={{
      analysisResult,
      isAnalyzing,
      error,
      runAnalysis,
      loadStoredResult,
      clearAnalysis
    }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}
