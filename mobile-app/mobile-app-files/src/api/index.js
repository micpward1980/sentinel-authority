import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'https://sentinel-authority-production.up.railway.app';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  getMe: () => api.get('/api/auth/me'),
};

export const applicationsAPI = {
  getAll: () => api.get('/api/applications'),
  getMine: () => api.get('/api/applications/mine'),
  getById: (id) => api.get('/api/applications/' + id),
  create: (data) => api.post('/api/applications', data),
  updateStatus: (id, status) => api.patch('/api/applications/' + id + '/status', { status }),
};

export const certificatesAPI = {
  getAll: () => api.get('/api/certificates'),
  getMine: () => api.get('/api/certificates/mine'),
  getById: (id) => api.get('/api/certificates/' + id),
  verify: (certId) => api.get('/api/certificates/verify/' + certId),
};

export const agentAPI = {
  generateKey: () => api.post('/api/agent/generate-key'),
  getKeys: () => api.get('/api/agent/keys'),
  getSessions: () => api.get('/api/agent/sessions'),
  getSessionById: (id) => api.get('/api/agent/sessions/' + id),
  getTelemetry: (sessionId) => api.get('/api/agent/telemetry/' + sessionId),
};

export const licenseesAPI = {
  getAll: () => api.get('/api/licensees'),
  getById: (id) => api.get('/api/licensees/' + id),
};
