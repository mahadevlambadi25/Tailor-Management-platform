import axios from 'axios';

const resolveApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || !envUrl.trim()) {
    return '/api/v1';
  }
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
};

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((req) => {
  const token = localStorage.getItem('tailor_token');
  const storedSlug = localStorage.getItem('tailor_tenant_slug') || 'royal-bespoke';

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  // Preserve explicitly provided x-tenant-slug header, otherwise use localStorage
  if (!req.headers['x-tenant-slug']) {
    req.headers['x-tenant-slug'] = storedSlug;
  }

  return req;
});

let isRedirecting = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isAuthUrl = err.config?.url?.includes('/auth/');
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/portal/login';

      if (!isAuthUrl && !isAuthPage && !isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem('tailor_token');
        localStorage.removeItem('tailor_user');
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
