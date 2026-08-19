import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [aiUsed, setAiUsed] = useState(0);
  const [aiQuota, setAiQuota] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try {
      const data = await api('/api/auth/me');
      setUser(data.user);
      setAiUsed(data.aiUsed);
      setAiQuota(data.aiQuota);
    } catch {
      setToken(null);
      setUser(null);
    }
    setReady(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    refresh();
  };
  const signup = async (email, password, name) => {
    const data = await api('/api/auth/signup', { method: 'POST', body: { email, password, name } });
    setToken(data.token);
    setUser(data.user);
    refresh();
  };
  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, ready, aiUsed, aiQuota, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
