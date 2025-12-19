import axios from 'axios';

const base = (import.meta.env.VITE_API_URL as string | undefined) || `${window.location.protocol}//${window.location.host}/api/v1`;

export const api = axios.create({
  baseURL: base,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
};

export const sessionAPI = {
  create: (data: { name: string }) => api.post('/sessions', data),
  getAll: () => api.get('/sessions'),
  getStatus: (sessionId: string) => api.get(`/sessions/${sessionId}/status`),
  getQR: (sessionId: string) => api.get(`/sessions/${sessionId}/qr`),
  delete: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
  updateAutoReply: (sessionId: string, enabled: boolean, message: string) =>
    api.put(`/sessions/${sessionId}/auto-reply`, { enabled, message })
};

export const messageAPI = {
  send: (apiKey: string, data: { to: string; text: string }) =>
    api.post('/messages/send', data, {
      headers: { 'x-api-key': apiKey }
    }),
  getHistory: (apiKey: string, params?: { limit?: number; offset?: number }) =>
    api.get('/messages/history', {
      headers: { 'x-api-key': apiKey },
      params
    })
};

export const webhookAPI = {
  create: (data: { sessionId: string; url: string; events: string[] }) =>
    api.post('/webhooks', data),
  getAll: (sessionId?: string) =>
    api.get('/webhooks', { params: { sessionId } }),
  update: (webhookId: string, data: any) =>
    api.put(`/webhooks/${webhookId}`, data),
  delete: (webhookId: string) => api.delete(`/webhooks/${webhookId}`)
};

export const analyticsAPI = {
  getUsage: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/analytics/usage', { params }),
  getSessions: () => api.get('/analytics/sessions'),
  getActivity: (limit?: number) =>
    api.get('/analytics/activity', { params: { limit } })
};

export default api;
