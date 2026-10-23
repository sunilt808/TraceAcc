import axios from 'axios';

const API_URL =
  import.meta.env?.VITE_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: `${API_URL}/liveshield`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const liveshieldApi = {
  // Simulations CRUD
  createSimulation: async (data) => {
    const res = await api.post('/simulations', data);
    return res.data;
  },

  createUploadSimulation: async (formData) => {
    const res = await api.post('/simulations/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  uploadDataset: async (file, { name, description, detection_mode, service_request_id } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (description) formData.append('description', description);
    if (detection_mode) formData.append('detection_mode', detection_mode);
    if (service_request_id) formData.append('service_request_id', service_request_id);
    return liveshieldApi.createUploadSimulation(formData);
  },

  getSimulationAnalysis: async (simulationId) => {
    const res = await api.get(`/simulations/${simulationId}/analysis`);
    return res.data;
  },

  listSimulations: async (params = {}) => {
    const res = await api.get('/simulations', { params });
    return res.data;
  },

  getSimulation: async (simulationId) => {
    const res = await api.get(`/simulations/${simulationId}`);
    return res.data;
  },

  deleteSimulation: async (simulationId) => {
    const res = await api.delete(`/simulations/${simulationId}`);
    return res.data;
  },

  validateSimulation: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/validate`);
    return res.data;
  },

  convertToCase: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/convert-to-case`);
    return res.data;
  },

  // Execution Controls
  startSimulation: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/start`);
    return res.data;
  },

  pauseSimulation: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/pause`);
    return res.data;
  },

  resumeSimulation: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/resume`);
    return res.data;
  },

  stopSimulation: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/stop`);
    return res.data;
  },

  restartSimulation: async (simulationId) => {
    const res = await api.post(`/simulations/${simulationId}/restart`);
    return res.data;
  },

  updateSimulationSpeed: async (simulationId, targetTps) => {
    const res = await api.post(`/simulations/${simulationId}/speed`, { target_tps: targetTps });
    return res.data;
  },

  // Stats, Held Queue, Decisions & Ledger
  getStats: async (simulationId) => {
    const res = await api.get(`/simulations/${simulationId}/stats`);
    return res.data;
  },

  getHeld: async (simulationId) => {
    const res = await api.get(`/simulations/${simulationId}/held`);
    return res.data;
  },

  overrideHeldDecision: async (simulationId, txnId, action, notes) => {
    const res = await api.post(`/simulations/${simulationId}/decisions/${txnId}/override`, {
      action,
      notes,
    });
    return res.data;
  },

  getEvaluation: async (simulationId) => {
    const res = await api.get(`/simulations/${simulationId}/evaluation`);
    return res.data;
  },

  getModelStatus: async () => {
    const res = await api.get('/model-status');
    return res.data;
  },

  getTransactions: async (simulationId, params = {}) => {
    const res = await api.get(`/simulations/${simulationId}/transactions`, { params });
    return res.data;
  },

  getDecisions: async (simulationId, params = {}) => {
    const res = await api.get(`/simulations/${simulationId}/decisions`, { params });
    return res.data;
  },

  // Metadata & Presets
  getScenarios: async () => {
    const res = await api.get('/scenarios');
    return res.data;
  },

  getPresets: async () => {
    const res = await api.get('/presets');
    return res.data;
  },

  createPreset: async (presetData) => {
    const res = await api.post('/presets', presetData);
    return res.data;
  },

  getPreset: async (presetId) => {
    const res = await api.get(`/presets/${presetId}`);
    return res.data;
  },

  deletePreset: async (presetId) => {
    const res = await api.delete(`/presets/${presetId}`);
    return res.data;
  },

  // Phase 2.5: Continuous Risk Re-evaluation (CRRE)
  getRiskTimeline: async (simulationId, transactionId) => {
    const res = await api.get(`/simulations/${simulationId}/risk-timeline/${transactionId}`);
    return res.data;
  },

  getRetrospectiveAlerts: async (simulationId, limit = 50) => {
    const res = await api.get(`/simulations/${simulationId}/retrospective-alerts`, { params: { limit } });
    return res.data;
  },

  getClearedTransactions: async (simulationId, limit = 50) => {
    const res = await api.get(`/simulations/${simulationId}/cleared-transactions`, { params: { limit } });
    return res.data;
  },

  triggerManualReassessment: async (simulationId, data) => {
    const res = await api.post(`/simulations/${simulationId}/manual-reassessment`, data);
    return res.data;
  },

  getReevaluationStats: async (simulationId) => {
    const res = await api.get(`/simulations/${simulationId}/reevaluation-stats`);
    return res.data;
  },

  // WebSocket connection helper
  connectWebSocket: (simulationId, onMessage, onError, onClose) => {
    const wsUrl = API_URL.replace(/^http/, 'ws') + `/liveshield/simulations/${simulationId}/ws`;
    let ws;
    let pingInterval;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'pong' && onMessage) {
            onMessage(data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (err) => {
        if (onError) onError(err);
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        if (onClose) onClose();
      };
    } catch (e) {
      if (onError) onError(e);
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (ws) {
        ws.close();
      }
    };
  },
};

export default liveshieldApi;
