import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'https://sentinel-authority-production.up.railway.app';
export const API_BASE = API_URL;

export const api = axios.create({ baseURL: API_URL });

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Add auth header to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle expired tokens with refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for chat, envelo, and login endpoints
    const skipUrls = ['/api/chat', '/api/envelo/sessions', '/api/auth/login', '/api/auth/refresh'];
    if (!error.response || error.response.status !== 401 || skipUrls.some(u => originalRequest?.url?.includes(u))) {
      if (error.response?.status === 401 && originalRequest?.url?.includes('/api/auth/refresh')) {
        // Refresh token itself failed — full logout
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Already retried this request
    if (originalRequest._retry) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }).catch(err => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      isRefreshing = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const res = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refreshToken });
      const newToken = res.data.access_token;
      localStorage.setItem('token', newToken);
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
