import axios from 'axios';

export const API_URL = 'https://sentinel-authority-production.up.railway.app';
export const API_BASE = API_URL;

export const api = axios.create({ baseURL: API_URL });

// Add auth header to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

