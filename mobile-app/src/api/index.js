import * as SecureStore from 'expo-secure-store';

export const API_URL = 'https://sentinel-authority-production.up.railway.app';

async function authFetch(endpoint, options = {}) {
  const token = await SecureStore.getItemAsync('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const error = new Error(data.detail || 'Request failed');
    error.response = { status: response.status, data };
    throw error;
  }

  return { data };
}

// Auth API
export const authAPI = {
  login: (email, password) => authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (data) => authFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMe: () => authFetch('/api/auth/me'),
};

// Applications API
export const applicationsAPI = {
  getAll: () => authFetch('/api/applications/'),
  getMine: () => authFetch('/api/applications/'),
  getById: (id) => authFetch(`/api/applications/${id}`),
  create: (data) => authFetch('/api/applications/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateStatus: (id, status) => authFetch(`/api/applications/${id}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
};

// Certificates API
export const certificatesAPI = {
  getAll: () => authFetch('/api/certificates/'),
  getMine: () => authFetch('/api/certificates/'),
  getById: (certNum) => authFetch(`/api/certificates/${certNum}`),
  verify: (certNum) => authFetch(`/api/certificates/${certNum}`),
};

// CAT-72 API
export const cat72API = {
  getTests: () => authFetch('/api/cat72/tests'),
  getTestById: (id) => authFetch(`/api/cat72/tests/${id}`),
  getTelemetry: (id) => authFetch(`/api/cat72/tests/${id}/telemetry`),
  getMetrics: (id) => authFetch(`/api/cat72/tests/${id}/metrics`),
  startTest: (id) => authFetch(`/api/cat72/tests/${id}/start`, { method: 'POST' }),
  stopTest: (id) => authFetch(`/api/cat72/tests/${id}/stop`, { method: 'POST' }),
};

// Agent/API Keys API
export const agentAPI = {
  generateKey: () => authFetch('/api/apikeys/generate', { method: 'POST' }),
  getKeys: () => authFetch('/api/apikeys/'),
  getSessions: () => authFetch('/api/cat72/tests'),
};

// Dashboard API
export const dashboardAPI = {
  getActiveTests: () => authFetch('/api/dashboard/active-tests'),
  getRecentApplications: () => authFetch('/api/dashboard/recent-applications'),
  getRecentCertificates: () => authFetch('/api/dashboard/recent-certificates'),
};

// User Management API (Admin only)
export const usersAPI = {
  getAll: () => authFetch('/api/users/'),
  getById: (id) => authFetch(`/api/users/${id}`),
  create: (data) => authFetch('/api/users/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => authFetch(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id) => authFetch(`/api/users/${id}`, {
    method: 'DELETE',
  }),
  resetPassword: (id) => authFetch(`/api/users/${id}/reset-password`, {
    method: 'POST',
  }),
  invite: (data) => authFetch('/api/users/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Licensees - derived from certificates
export const licenseesAPI = {
  getAll: () => authFetch('/api/certificates/'),
};
