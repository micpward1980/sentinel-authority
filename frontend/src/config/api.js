import axios from 'axios';

function normalizeApiUrl(value) {
  const fallback = 'https://sentinel-authority-production.up.railway.app';
  const raw = value || fallback;
  try {
    const url = new URL(raw);
    return url.origin.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);
export const API_BASE = API_URL;

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

let isRefreshing = false;
let failedQueue = [];

export function getStoredToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function persistSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;

    const skipRefreshUrls = [
      '/api/chat',
      '/api/envelo/sessions',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/forgot-password',
      '/api/auth/reset-password'
    ];

    const shouldSkipRefresh = skipRefreshUrls.some((u) =>
      originalRequest?.url?.includes(u)
    );

    if (!status || status !== 401 || shouldSkipRefresh) {
      if (status === 401 && originalRequest?.url?.includes('/api/auth/refresh')) {
        clearSession();
        redirectToLogin();
      }
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearSession();
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearSession();
      redirectToLogin();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await axios.post(
        `${API_URL}/api/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
      );

      const newAccessToken = refreshResponse?.data?.access_token;
      const newRefreshToken = refreshResponse?.data?.refresh_token;

      if (!newAccessToken) throw new Error('Refresh response missing access token');

      persistSession({ accessToken: newAccessToken, refreshToken: newRefreshToken || refreshToken });
      processQueue(null, newAccessToken);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearSession();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
