import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api');

export const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin
    : 'http://localhost:5000');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gc_crm_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('gc_crm_token');
      localStorage.removeItem('gc_crm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Endpoints
export const authApi = {
  login: (credentials: { email?: string; username?: string; password: string }) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  getExecutives: () => api.get('/auth/executives'),
};

export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  updateStatus: (id: string, data: { status: string }) => api.put(`/users/${id}/status`, data),
  resetPassword: (id: string, data: any) => api.put(`/users/${id}/reset-password`, data),
  getRoles: () => api.get('/users/roles'),
  createRole: (data: any) => api.post('/users/roles', data),
  updateRolePermissions: (id: string, data: { permissions: string[] }) => api.put(`/users/roles/${id}/permissions`, data),
  getPermissions: () => api.get('/users/permissions'),
};

export const teamsApi = {
  list: (params?: any) => api.get('/teams', { params }),
  getDashboard: (id: string) => api.get(`/teams/${id}/dashboard`),
  getLeads: (id: string) => api.get(`/teams/${id}/leads`),
  create: (data: { teamName: string; teamLeaderId: string; executiveIds?: string[] }) => api.post('/teams', data),
  addMember: (teamId: string, data: { userId: string }) => api.post(`/teams/${teamId}/members`, data),
  reassignLead: (data: { candidateId: string; toExecutiveId: string }) => api.post('/teams/reassign-lead', data),
  addCoachingNote: (data: { executiveId: string; note: string; category?: string; visibility?: string }) => api.post('/teams/coaching-notes', data),
  getCoachingNotes: (executiveId: string) => api.get(`/teams/coaching-notes/${executiveId}`),
};

export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; limit?: number }) => api.get('/notifications', { params }),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

export const communicationsApi = {
  getTemplates: (params?: { category?: string }) => api.get('/communications/templates', { params }),
  createTemplate: (data: any) => api.post('/communications/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/communications/templates/${id}`, data),
  getHistory: (candidateId: string) => api.get(`/communications/history/${candidateId}`),
  sendWhatsApp: (data: {
    candidateId: string;
    templateId?: string;
    customMessage?: string;
    jobOrderId?: string;
    clientId?: string;
    communicationType?: string;
  }) => api.post('/communications/send-whatsapp', data),
  sendForm: (data: { candidateId: string; jobOrderId?: string; formUrl?: string }) => api.post('/communications/send-form', data),
  requestCv: (data: { candidateId: string; jobOrderId?: string }) => api.post('/communications/request-cv', data),
  getAnalytics: () => api.get('/communications/analytics'),
};

export const documentsApi = {
  upload: (formData: FormData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  listByCandidate: (candidateId: string) => api.get(`/documents/candidate/${candidateId}`),
  getDownloadUrl: (id: string) => `${API_BASE_URL}/documents/${id}/download`,
  getPreviewUrl: (id: string) => `${API_BASE_URL}/documents/${id}/preview`,
  verify: (id: string, data: { verificationStatus: string; verificationRemarks?: string }) => api.post(`/documents/${id}/verify`, data),
  getAnalytics: () => api.get('/documents/analytics'),
};

export const registrationsApi = {
  generateLink: (data: { candidateId: string; jobOrderId?: string; validityDays?: number }) =>
    api.post('/registrations/generate-link', data),
  list: (params?: any) => api.get('/registrations', { params }),
  get: (id: string) => api.get(`/registrations/${id}`),
  approve: (id: string, data: { reviewNotes?: string }) => api.post(`/registrations/${id}/approve`, data),
  requestCorrection: (id: string, data: { reviewNotes: string }) => api.post(`/registrations/${id}/request-correction`, data),
  disable: (id: string) => api.post(`/registrations/${id}/disable`),
  getAnalytics: () => api.get('/registrations/analytics'),

  // Public candidate portal endpoints (NO auth header required)
  publicGet: (token: string) => api.get(`/registrations/public/${token}`),
  publicSaveDraft: (token: string, data: { stepCompleted: number; draftData: any }) =>
    api.post(`/registrations/public/${token}/save-draft`, data),
  publicUploadCv: (token: string, formData: FormData) =>
    api.post(`/registrations/public/${token}/upload-cv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  publicSubmit: (token: string, data: { submittedData: any }) =>
    api.post(`/registrations/public/${token}/submit`, data),
};

export const clientsApi = {
  list: (params?: any) => api.get('/clients', { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
};

export const jobOrdersApi = {
  list: (params?: any) => api.get('/job-orders', { params }),
  get: (id: string) => api.get(`/job-orders/${id}`),
  create: (data: any) => api.post('/job-orders', data),
  update: (id: string, data: any) => api.put(`/job-orders/${id}`, data),
  addCandidates: (id: string, data: { candidateIds: string[]; assignedExecutiveId?: string }) => api.post(`/job-orders/${id}/add-candidates`, data),
  updateStage: (applicationId: string, data: { applicationStage: string; stageNotes?: string }) => api.put(`/job-orders/applications/${applicationId}/stage`, data),
  submitToClient: (data: { applicationId: string; notes?: string; cvFileName?: string }) => api.post('/job-orders/submissions', data),
  scheduleInterview: (data: any) => api.post('/job-orders/interviews', data),
  recordPlacement: (data: any) => api.post('/job-orders/placements', data),
};

export const candidatesApi = {
  list: (params?: any) => api.get('/candidates', { params }),
  get: (id: string) => api.get(`/candidates/${id}`),
  create: (data: any) => api.post('/candidates', data),
  update: (id: string, data: any) => api.put(`/candidates/${id}`, data),
  delete: (id: string) => api.delete(`/candidates/${id}`),
  restore: (id: string) => api.post(`/candidates/${id}/restore`),
};

export const callingApi = {
  getWorkspaceQueue: (params?: any) => api.get('/calling/workspace', { params }),
  logCall: (data: any) => api.post('/calling/log', data),
};

export const callbacksApi = {
  list: (params?: any) => api.get('/callbacks', { params }),
  updateStatus: (id: string, data: any) => api.put(`/callbacks/${id}/status`, data),
};

export const shortlistApi = {
  list: (params?: any) => api.get('/shortlist', { params }),
  shortlist: (data: any) => api.post('/shortlist', data),
  update: (id: string, data: any) => api.put(`/shortlist/${id}`, data),
  sendGoogleForm: (id: string, data?: { customFormUrl?: string }) => api.post(`/shortlist/${id}/send-google-form`, data || {}),
  markFormCompleted: (id: string) => api.post(`/shortlist/${id}/mark-form-completed`),
  requestCv: (id: string) => api.post(`/shortlist/${id}/request-cv`),
  recordCvReceived: (id: string) => api.post(`/shortlist/${id}/record-cv-received`),
  markReadyToSend: (id: string) => api.post(`/shortlist/${id}/mark-ready-to-send`),
  sendToHr: (id: string, data: { hrContactName?: string; hrContactPhone?: string; hrContactEmail?: string; submissionMethod?: string; notes?: string; cvFileName?: string }) =>
    api.post(`/shortlist/${id}/send-to-hr`, data),
};

export const assignmentsApi = {
  assignSingle: (data: { candidateId: string; executiveId: string; jobOrderId?: string }) => api.post('/assignments/single', data),
  assignBulk: (data: { candidateIds: string[]; executiveId: string; jobOrderId?: string }) => api.post('/assignments/bulk', data),
  autoDistribute: (data: any) => api.post('/assignments/auto-distribute', data),
  history: (params?: any) => api.get('/assignments/history', { params }),
};

export const dailyTrackerApi = {
  getSummary: (params?: any) => api.get('/daily-tracker', { params }),
  getPerformance: () => api.get('/daily-tracker/performance'),
};

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard'),
};

export const importApi = {
  preview: (formData: FormData) => api.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  execute: (data: any) => api.post('/import/execute', data),
  getBatches: () => api.get('/import/batches'),
};

export const activityLogsApi = {
  list: (params?: any) => api.get('/activity-logs', { params }),
};

export const reportsApi = {
  getExportUrl: (type: string, format: string = 'xlsx', extraParams?: Record<string, string>) => {
    const query = new URLSearchParams({ type, format, ...(extraParams || {}) }).toString();
    return `${API_BASE_URL}/reports/export?${query}`;
  },
};
