import axios from 'axios';

// Resolve API base from env (Vite) with a localhost dev fallback.
export const API_URL =
  import.meta.env?.VITE_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_URL,
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
// WORKBENCH API — role-aware overview aggregation
// ============================================================

export const workbenchAPI = {
  analyst: async () => {
    const res = await api.get('/workbench/analyst');
    return res.data;
  },

  investigator: async () => {
    const res = await api.get('/workbench/investigator');
    return res.data;
  },
};

// ============================================================
// CASES API
// ============================================================

export const casesAPI = {
  list: async ({ status = '', priority = '', mineOnly = false } = {}) => {
    const params = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (mineOnly) params.mine_only = true;

    const res = await api.get('/cases', { params });
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
    const res = await api.patch(`/cases/${id}`, { status });
    return res.data;
  },

  assign: async (id, assigneeId) => {
    const res = await api.patch(`/cases/${id}/assign`, {
      assignee_id: assigneeId,
    });
    return res.data;
  },

  getTimeline: async (id) => {
    const res = await api.get(`/cases/${id}/timeline`);
    return res.data;
  },

  addNote: async (id, content) => {
    const res = await api.post(`/cases/${id}/notes`, { content });
    return res.data;
  },

  // ---- Investigation artifacts -----------------------------

  getHypotheses: async (id) => {
    const res = await api.get(`/cases/${id}/hypotheses`);
    return res.data;
  },

  createHypothesis: async (id, data) => {
    const res = await api.post(`/cases/${id}/hypotheses`, data);
    return res.data;
  },

  updateHypothesis: async (caseId, hypothesisId, data) => {
    const res = await api.patch(
      `/cases/${caseId}/hypotheses/${hypothesisId}`,
      data
    );
    return res.data;
  },

  getTasks: async (id) => {
    const res = await api.get(`/cases/${id}/tasks`);
    return res.data;
  },

  createTask: async (id, data) => {
    const res = await api.post(`/cases/${id}/tasks`, data);
    return res.data;
  },

  updateTask: async (caseId, taskId, data) => {
    const res = await api.patch(`/cases/${caseId}/tasks/${taskId}`, data);
    return res.data;
  },

  getFindings: async (id) => {
    const res = await api.get(`/cases/${id}/findings`);
    return res.data;
  },

  createFinding: async (id, data) => {
    const res = await api.post(`/cases/${id}/findings`, data);
    return res.data;
  },

  updateFinding: async (caseId, findingId, data) => {
    const res = await api.patch(`/cases/${caseId}/findings/${findingId}`, data);
    return res.data;
  },

  // ---- Decision + readiness --------------------------------

  recordDecision: async (id, { decision, reason, investigationRiskScore }) => {
    const res = await api.post(`/cases/${id}/decision`, {
      decision,
      reason: reason || null,
      investigation_risk_score:
        investigationRiskScore === '' || investigationRiskScore == null
          ? null
          : Number(investigationRiskScore),
    });
    return res.data;
  },

  getCompleteness: async (id) => {
    const res = await api.get(`/cases/${id}/completeness`);
    return res.data;
  },

  getReportDraft: async (id) => {
    const res = await api.get(`/cases/${id}/report-draft`);
    return res.data;
  },

  getIntelligence: async (id) => {
    const res = await api.get(`/cases/${id}/intelligence`);
    return res.data;
  },

  getAccountDetail: async (caseId, accountId) => {
    const res = await api.get(`/cases/${caseId}/accounts/${accountId}`);
    return res.data;
  },

  decideAlert: async (caseId, alertId, action, notes) => {
    const res = await api.post(`/cases/${caseId}/alerts/${alertId}/decision`, {
      action,
      notes: notes || '',
    });
    return res.data;
  },

  overrideTransaction: async (caseId, transactionId, action, reason) => {
    const res = await api.post(`/cases/${caseId}/transactions/${transactionId}/override`, {
      action,
      reason: reason || '',
    });
    return res.data;
  },

  overrideAccount: async (caseId, accountId, action, reason) => {
    const res = await api.post(`/cases/${caseId}/accounts/${accountId}/override`, {
      action,
      reason: reason || '',
    });
    return res.data;
  },

  freezeAccount: async (caseId, accountId, isFrozen, reason) => {
    const res = await api.post(`/cases/${caseId}/accounts/${accountId}/freeze`, {
      is_frozen: isFrozen,
      reason: reason || '',
    });
    return res.data;
  },

  addEntityNote: async (caseId, targetType, targetId, note) => {
    const res = await api.post(`/cases/${caseId}/notes/entity`, {
      target_type: targetType,
      target_id: targetId,
      note,
    });
    return res.data;
  },

  transitionStatus: async (id, targetStatus, notes = '', selfApprovalException = false, selfApprovalReason = '') => {
    const res = await api.post(`/cases/${id}/transition`, {
      target_status: targetStatus,
      notes,
      self_approval_exception: selfApprovalException,
      self_approval_reason: selfApprovalReason,
    });
    return res.data;
  },

  releaseReport: async (id, recipientOrgId = null, releaseNotes = '', reportType = 'OFFICIAL_SAR', watermarkText = null) => {
    const res = await api.post(`/cases/${id}/release-report`, {
      recipient_organization_id: recipientOrgId,
      release_notes: releaseNotes,
      report_type: reportType,
      watermark_text: watermarkText,
    });
    return res.data;
  },

  listReleases: async (id) => {
    const res = await api.get(`/cases/${id}/releases`);
    return res.data;
  },

  revokeRelease: async (caseId, releaseId) => {
    const res = await api.post(`/cases/${caseId}/revoke-release/${releaseId}`);
    return res.data;
  },
};

// ============================================================
// ALERTS API
// ============================================================

export const alertsAPI = {
  list: async (status = '', limit = 50, offset = 0) => {
    const params = { limit, offset };
    if (status) params.status = status;

    const res = await api.get('/alerts', { params });
    return res.data;
  },

  get: async (id) => {
    const res = await api.get(`/alerts/${id}`);
    return res.data;
  },

  updateStatus: async (id, status, note = null) => {
    const params = { status };
    if (note) params.note = note;

    const res = await api.patch(`/alerts/${id}/status`, null, { params });
    return res.data;
  },

  escalate: async (id, { reason = null, priority = null } = {}) => {
    const body = {};
    if (reason) body.reason = reason;
    if (priority) body.priority = priority;

    const res = await api.post(`/alerts/${id}/escalate`, body);
    return res.data;
  },

  bulkAction: async (alertIds, action, note = null) => {
    const res = await api.post('/alerts/bulk-action', {
      alert_ids: alertIds,
      action,
      note,
    });
    return res.data;
  },

  // Admin routes an ESCALATED alert to an investigator.
  routeToInvestigator: async (id, assigneeId) => {
    const res = await api.patch(`/alerts/${id}/assign`, {
      assignee_id: assigneeId,
    });
    return res.data;
  },

  // Investigator converts a routed ESCALATED alert into a case.
  convertToCase: async (id, { title = null, description = null, priority = null } = {}) => {
    const body = {};
    if (title) body.title = title;
    if (description) body.description = description;
    if (priority) body.priority = priority;

    const res = await api.post(`/alerts/${id}/convert-to-case`, body);
    return res.data;
  },

  // Fetch linked accounts, transactions, and typology intelligence for an alert
  getEntities: async (id) => {
    const res = await api.get(`/alerts/${id}/entities`);
    return res.data;
  },

  // Record investigator classification (Legit vs Fraud / Escalate)
  decideAlert: async (id, action, reason = '') => {
    const res = await api.post(`/alerts/${id}/decision`, {
      action,
      reason,
    });
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

    const res = await api.post(`/cases/${caseId}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res.data;
  },

  // Authenticated blob download (browser cannot attach Bearer via href).
  download: async (caseId, evidenceId, fileName = 'evidence') => {
    const res = await api.get(`/cases/${caseId}/evidence/${evidenceId}/download`, {
      responseType: 'blob',
    });

    triggerBlobDownload(res, fileName);
  },
};

// Shared helper: turn an axios blob response into a file download.
function triggerBlobDownload(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;

  const url = URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
  list: async ({ status = '', assignedToMe = false } = {}) => {
    const params = {};
    if (status) params.status = status;
    if (assignedToMe) params.assigned_to_me = true;

    const res = await api.get('/service-requests', { params });
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
    const res = await api.patch(`/service-requests/${id}`, data);
    return res.data;
  },

  uploadDataset: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post(`/service-requests/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res.data;
  },

  // Authenticated blob download of the attached dataset CSV.
  downloadDataset: async (id) => {
    const res = await api.get(`/service-requests/${id}/dataset/download`, {
      responseType: 'blob',
    });

    triggerBlobDownload(res, `request_${id}_dataset.csv`);
  },
};

// ============================================================
// ASSIGNMENTS API (employee workbench)
// ============================================================

export const assignmentsAPI = {
  list: async (mineOnly = true) => {
    const res = await api.get('/assignments', {
      params: mineOnly ? {} : { mine_only: false },
    });
    return res.data;
  },

  updateStatus: async (assignmentId, status) => {
    const res = await api.patch(`/assignments/${assignmentId}/status`, {
      status,
    });
    return res.data;
  },
};

// ============================================================
// ANALYSIS API
// ============================================================

export const analysisAPI = {
  listJobs: async () => {
    const res = await api.get('/analyze/jobs');
    return res.data;
  },

  getJobResult: async (jobId) => {
    const res = await api.get(`/analyze/jobs/${jobId}/result`);
    return res.data;
  },
};

// ============================================================
// ADMIN API
// ============================================================

export const adminAPI = {

  // ----------------------------------------------------------
  // ADMIN DASHBOARD
  // ----------------------------------------------------------

  getDashboard: async () => {
    const res = await api.get('/admin/dashboard');
    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN REQUEST QUEUE
  // ----------------------------------------------------------

  getRequestQueue: async (status = '') => {
    const params = status ? { status } : {};

    const res = await api.get('/admin/request-queue', { params });
    return res.data;
  },

  reviewRequest: async (id, data) => {
    const res = await api.patch(`/admin/service-requests/${id}/review`, data);
    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN REPORT QUEUE
  // ----------------------------------------------------------

  getReportQueue: async (status = '') => {
    const params = status ? { status } : {};

    const res = await api.get('/admin/report-queue', { params });
    return res.data;
  },

  reviewReport: async (id, data) => {
    const res = await api.patch(`/admin/reports/${id}/review`, data);
    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN OPERATIONS QUEUE
  // ----------------------------------------------------------

  getOperationsQueue: async (limit = 20) => {
    const res = await api.get('/admin/operations-queue', {
      params: { limit },
    });

    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN USERS
  // ----------------------------------------------------------

  listUsers: async (limit = 100) => {
    const res = await api.get('/admin/users', { params: { limit } });
    return res.data;
  },

  getUsers: async (limit = 100) => {
    const res = await api.get('/admin/users', { params: { limit } });
    return res.data;
  },

  createUser: async (data) => {
    const res = await api.post('/admin/users', data);
    return res.data;
  },

  updateUser: async (id, data) => {
    const res = await api.patch(`/admin/users/${id}`, data);
    return res.data;
  },

  deleteUser: async (id) => {
    const res = await api.delete(`/admin/users/${id}`);
    return res.data;
  },

  // ----------------------------------------------------------
  // ADMIN ORGANIZATIONS
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
    const res = await api.post('/admin/organizations', data);
    return res.data;
  },

  updateOrganization: async (id, data) => {
    const res = await api.patch(`/admin/organizations/${id}`, data);
    return res.data;
  },
};

// ============================================================
// REPORTS API
// ============================================================

export const reportsAPI = {
  list: async (reportType = '') => {
    const params = reportType ? { report_type: reportType } : {};

    const res = await api.get('/reports', { params });
    return res.data;
  },

  get: async (id) => {
    const res = await api.get(`/reports/${id}`);
    return res.data;
  },

  create: async (data) => {
    const res = await api.post('/reports', data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await api.patch(`/reports/${id}`, data);
    return res.data;
  },

  uploadFile: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post(`/reports/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res.data;
  },

  submitForReview: async (id) => {
    const res = await api.post(`/reports/${id}/submit-for-review`);
    return res.data;
  },

  approve: async (id) => {
    const res = await api.post(`/reports/${id}/approve`);
    return res.data;
  },

  sign: async (id) => {
    const res = await api.post(`/reports/${id}/sign`);
    return res.data;
  },

  verifySignature: async (id) => {
    const res = await api.get(`/reports/${id}/signature`);
    return res.data;
  },

  release: async (id) => {
    const res = await api.post(`/reports/${id}/release`);
    return res.data;
  },

  // Authenticated blob download.
  download: async (report) => {
    const res = await api.get(`/reports/${report.id}/download`, {
      responseType: 'blob',
    });

    triggerBlobDownload(res, `${(report.title || 'report').replace(/\s+/g, '_')}.pdf`);
  },
};

// ============================================================
// NOTIFICATIONS API
// ============================================================

export const notificationsAPI = {
  list: async (unreadOnly = false, limit = 50) => {
    const res = await api.get('/notifications', {
      params: { unread_only: unreadOnly, limit },
    });
    return res.data;
  },

  markRead: async (id) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
  },
};

// ============================================================
// DC-LCG MODEL REGISTRY API
// ============================================================

export const dclcgAPI = {
  listModels: async () => {
    const res = await api.get('/dclcg/models');
    return res.data;
  },

  getModel: async (name) => {
    const res = await api.get(`/dclcg/models/${encodeURIComponent(name)}`);
    return res.data;
  },

  train: async (file, modelName, epochs = 20) => {
    const form = new FormData();
    form.append('request_file', file);
    form.append('model_name', modelName);
    form.append('epochs', String(epochs));
    const res = await api.post('/dclcg/train', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return res.data;
  },
};

// ============================================================
// PATTERN SUITE API (15 detectors, TraceLab analyst only)
// ============================================================

export const patternsAPI = {
  analyze: async ({ file, jobId, useDclcg = true } = {}) => {
    const form = new FormData();
    if (file) form.append('file', file);
    if (jobId) form.append('job_id', String(jobId));
    form.append('use_dclcg', String(useDclcg));
    const res = await api.post('/patterns/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return res.data;
  },
};

// ============================================================
// INVESTIGATOR INTEL API
// ============================================================

export const intelAPI = {
  overview: async (accountId) => {
    const res = await api.get(
      `/intel/accounts/${encodeURIComponent(accountId)}/overview`,
    );
    return res.data;
  },

  similar: async (accountId, top = 8) => {
    const res = await api.get(
      `/intel/accounts/${encodeURIComponent(accountId)}/similar`,
      { params: { top } },
    );
    return res.data;
  },

  paths: async (accountId, jobId, depth = 3, top = 5) => {
    const res = await api.get(
      `/intel/accounts/${encodeURIComponent(accountId)}/paths`,
      { params: { job_id: jobId, depth, top } },
    );
    return res.data;
  },
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;


