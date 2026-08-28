import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchUser: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('gc_crm_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('gc_crm_token');
      if (savedToken) {
        try {
          const res = await authApi.me();
          setUser(res.data.user);
        } catch (err) {
          console.error('Session expired:', err);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      // Default passwords for demo convenience if omitted
      let pass = password;
      if (!pass) {
        if (email.includes('admin')) pass = 'Admin@123';
        else if (email.includes('manager')) pass = 'Manager@123';
        else pass = 'Exec@123';
      }

      const res = await authApi.login({ email, password: pass });
      const { token: receivedToken, user: receivedUser } = res.data;

      localStorage.setItem('gc_crm_token', receivedToken);
      localStorage.setItem('gc_crm_user', JSON.stringify(receivedUser));
      setToken(receivedToken);
      setUser(receivedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const switchUser = async (email: string) => {
    await login(email);
  };

  const logout = () => {
    localStorage.removeItem('gc_crm_token');
    localStorage.removeItem('gc_crm_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        switchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
