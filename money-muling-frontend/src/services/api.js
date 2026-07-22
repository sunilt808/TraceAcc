import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: async (username, password) => {
    const res = await api.post('/auth/register', { username, password });
    return res.data;
  },

  login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },

  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
};

// Audit API
export const auditAPI = {
  getLoginHistory: async (limit = 20, skip = 0) => {
    const res = await api.get(`/audit/login-history?limit=${limit}&skip=${skip}`);
    return res.data;
  },

  getFailedAttempts: async (limit = 20, skip = 0) => {
    const res = await api.get(`/audit/failed-attempts?limit=${limit}&skip=${skip}`);
    return res.data;
  },

  getAnalyzeHistory: async (limit = 20, skip = 0) => {
    const res = await api.get(`/audit/analyze-history?limit=${limit}&skip=${skip}`);
    return res.data;
  },

  getActivity: async (limit = 50, skip = 0) => {
    const res = await api.get(`/audit/activity?limit=${limit}&skip=${skip}`);
    return res.data;
  },

  getStats: async () => {
    const res = await api.get('/audit/stats');
    return res.data;
  },
};

// Token helpers
export const saveToken = (token) => localStorage.setItem('access_token', token);
export const getToken = () => localStorage.getItem('access_token');
export const clearToken = () => localStorage.removeItem('access_token');

export default api;
