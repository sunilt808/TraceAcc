import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

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

  const runAnalysis = async (file) => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('access_token');
      // Use direct fetch to match previous upload logic, or use axios instance
      const res = await fetch('http://127.0.0.1:8000/analyze/advanced', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!res.ok) {
        const errData = await res.json();
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
      clearAnalysis
    }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}
