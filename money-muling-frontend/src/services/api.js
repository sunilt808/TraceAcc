import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// AXIOS INTERCEPTOR
// ============================================================

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

// ============================================================
// AUTH API
// ============================================================

export const authAPI = {
  clientRegister: async (data) => {
    const res = await api.post('/auth/client-register', data);
    return res.data;
  },

  register: async (username, password) => {
    const res = await api.post('/auth/register', {
      username,
      password,
    });

    return res.data;
  },

  login: async (username, password) => {
    const params = new URLSearchParams();

    params.append('username', username);
    params.append('password', password);

    const res = await api.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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

// ============================================================
// AUDIT API
// ============================================================

export const auditAPI = {
  getLoginHistory: async (limit = 20, skip = 0) => {
    const res = await api.get('/audit/login-history', {
      params: { limit, skip },
    });

    return res.data;
  },

  getFailedAttempts: async (limit = 20, skip = 0) => {
    const res = await api.get('/audit/failed-attempts', {
      params: { limit, skip },
    });

    return res.data;
  },

  getAnalyzeHistory: async (limit = 20, skip = 0) => {
    const res = await api.get('/audit/analyze-history', {
      params: { limit, skip },
    });

    return res.data;
  },

  getActivity: async (limit = 50, skip = 0) => {
    const res = await api.get('/audit/activity', {
      params: { limit, skip },
    });

    return res.data;
  },

  getStats: async () => {
    const res = await api.get('/audit/stats');
    return res.data;
  },
};

// ============================================================
// CASES API
// ============================================================

export const casesAPI = {
  list: async (status = '') => {
    const params = status ? { status } : {};

    const res = await api.get('/cases', {
      params,
    });

    return res.data;
  },

  get: async (id) => {
    const res = await api.get(`/cases/${id}`);
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/cases', data);
    return res.data;
  },

  updateStatus: async (id, status) => {
    const res = await api.patch(`/cases/${id}`, {
      status,
    });

    return res.data;
  },

  getTimeline: async (id) => {
    const res = await api.get(`/cases/${id}/timeline`);
    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/cases/${id}`);
    return res.data;
  },
};

// ============================================================
// ALERTS API
// ============================================================

export const alertsAPI = {
  list: async (status = '', limit = 50, offset = 0) => {
    const params = {
      limit,
      offset,
    };

    if (status) {
      params.status = status;
    }

    const res = await api.get('/alerts', {
      params,
    });

    return res.data;
  },

  updateStatus: async (id, status) => {
    const res = await api.patch(`/alerts/${id}/status`, null, {
      params: {
        status,
      },
    });

    return res.data;
  },

  escalate: async (id) => {
    const res = await api.post(`/alerts/${id}/escalate`);
    return res.data;
  },
};

// ============================================================
// EVIDENCE API
// ============================================================

export const evidenceAPI = {
  list: async (caseId) => {
    const res = await api.get(`/cases/${caseId}/evidence`);
    return res.data;
  },

  upload: async (caseId, file) => {
    const formData = new FormData();

    formData.append('file', file);

    const res = await api.post(
      `/cases/${caseId}/evidence`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return res.data;
  },

  downloadUrl: (caseId, evidenceId) => {
    return `${API_BASE}/cases/${caseId}/evidence/${evidenceId}/download`;
  },
};

// ============================================================
// TOKEN HELPERS
// ============================================================

export const saveToken = (token) => {
  localStorage.setItem('access_token', token);
};

export const getToken = () => {
  return localStorage.getItem('access_token');
};

export const clearToken = () => {
  localStorage.removeItem('access_token');
};

// ============================================================
// SERVICE REQUESTS API
// ============================================================

export const serviceRequestsAPI = {
  list: async (status = '') => {
    const params = status ? { status } : {};

    const res = await api.get('/service-requests', {
      params,
    });

    return res.data;
  },

  get: async (id) => {
    const res = await api.get(`/service-requests/${id}`);
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/service-requests', data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await api.patch(
      `/service-requests/${id}`,
      data
    );

    return res.data;
  },

  uploadDataset: async (id, file) => {
    const formData = new FormData();

    formData.append('file', file);

    const res = await api.post(
      `/service-requests/${id}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return res.data;
  },
};

// ============================================================
// ADMIN API
// ============================================================

export const adminAPI = {

  // ----------------------------------------------------------
  // ADMIN DASHBOARD
  // GET /admin/dashboard
  // ----------------------------------------------------------

  getDashboard: async () => {
    const res = await api.get('/admin/dashboard');
    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN REQUEST QUEUE
  // GET /admin/request-queue
  // PATCH /admin/service-requests/{id}/review
  // ----------------------------------------------------------

  getRequestQueue: async (status = '') => {
    const params = status ? { status } : {};

    const res = await api.get('/admin/request-queue', {
      params,
    });

    return res.data;
  },

  reviewRequest: async (id, data) => {
    const res = await api.patch(
      `/admin/service-requests/${id}/review`,
      data
    );

    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN REPORT QUEUE
  // GET /admin/report-queue
  // PATCH /admin/reports/{id}/review
  // ----------------------------------------------------------

  getReportQueue: async (status = '') => {
    const params = status ? { status } : {};

    const res = await api.get('/admin/report-queue', {
      params,
    });

    return res.data;
  },

  reviewReport: async (id, data) => {
    const res = await api.patch(
      `/admin/reports/${id}/review`,
      data
    );

    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN OPERATIONS QUEUE
  // GET /admin/operations-queue
  // ----------------------------------------------------------

  getOperationsQueue: async (limit = 20) => {
    const res = await api.get('/admin/operations-queue', {
      params: {
        limit,
      },
    });

    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN USERS
  // GET /admin/users
  // POST /admin/users
  // PATCH /admin/users/{id}
  // DELETE /admin/users/{id}
  // ----------------------------------------------------------

  listUsers: async (limit = 100) => {
    const res = await api.get('/admin/users', {
      params: {
        limit,
      },
    });

    return res.data;
  },

  getUsers: async (limit = 100) => {
    const res = await api.get('/admin/users', {
      params: {
        limit,
      },
    });

    return res.data;
  },

  createUser: async (data) => {
    const res = await api.post('/admin/users', data);
    return res.data;
  },

  updateUser: async (id, data) => {
    const res = await api.patch(
      `/admin/users/${id}`,
      data
    );

    return res.data;
  },

  deleteUser: async (id) => {
    const res = await api.delete(`/admin/users/${id}`);
    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN ORGANIZATIONS
  // GET /admin/organizations
  // POST /admin/organizations
  // PATCH /admin/organizations/{id}
  // ----------------------------------------------------------

  listOrganizations: async () => {
    const res = await api.get('/admin/organizations');
    return res.data;
  },

  getOrganizations: async () => {
    const res = await api.get('/admin/organizations');
    return res.data;
  },

  createOrganization: async (data) => {
    const res = await api.post(
      '/admin/organizations',
      data
    );

    return res.data;
  },

  updateOrganization: async (id, data) => {
    const res = await api.patch(
      `/admin/organizations/${id}`,
      data
    );

    return res.data;
  },
};

// ============================================================
// REPORTS API
// ============================================================

export const reportsAPI = {
  list: async () => {
    const res = await api.get('/reports');
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/reports', data);
    return res.data;
  },

  uploadFile: async (id, file) => {
    const formData = new FormData();

    formData.append('file', file);

    const res = await api.post(
      `/reports/${id}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return res.data;
  },

  release: async (id) => {
    const res = await api.patch(
      `/reports/${id}/release`
    );

    return res.data;
  },

  downloadUrl: (id) => {
    return `${API_BASE}/reports/${id}/download?token=${getToken()}`;
  },
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;