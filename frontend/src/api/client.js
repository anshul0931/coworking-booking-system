import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('accessToken');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// auto-refresh access token on 401 (single retry)
let refreshing = null;
api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config;
    const code = err.response?.data?.error?.code;
    const refreshToken = localStorage.getItem('refreshToken');
    if (err.response?.status === 401 && refreshToken && !original._retry &&
        ['TOKEN_EXPIRED', 'UNAUTHORIZED', 'INVALID_TOKEN'].includes(code)) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh', { refreshToken });
        const { data } = await refreshing;
        refreshing = null;
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e.response?.data?.error?.message || e.message || 'Request failed';
export default api;
