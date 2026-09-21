import { createContext, useContext, useEffect, useState } from 'react';
import api from './client';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return setLoading(false);
    api.get('/auth/me').then(r => setUser(r.data.data)).catch(() => localStorage.clear()).finally(() => setLoading(false));
  }, []);

  const persist = (data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
  };
  const login = async (email, password) => persist((await api.post('/auth/login', { email, password })).data.data);
  const register = async (payload) => persist((await api.post('/auth/register', payload)).data.data);
  const logout = async () => {
    const rt = localStorage.getItem('refreshToken');
    try { if (rt) await api.post('/auth/logout', { refreshToken: rt }); } catch { /* ignore */ }
    localStorage.clear(); setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}
