import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('quiz-user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const login = async (email, password) => {
    const mockUser = { id: 'demo', email, name: 'Demo User', subscription: 'music' };
    setUser(mockUser);
    localStorage.setItem('quiz-user', JSON.stringify(mockUser));
    return { success: true };
  };

  const register = async (email, password, name) => {
    const mockUser = { id: 'demo', email, name, subscription: 'music' };
    setUser(mockUser);
    localStorage.setItem('quiz-user', JSON.stringify(mockUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('quiz-user');
  };

  const checkGumroadPurchase = async () => true;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, checkGumroadPurchase, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}