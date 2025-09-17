import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { User, AuthContextType } from '../types/user';
import apiService from '../services/apiService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('auth_token');
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    const token = Cookies.get('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiService.get<{ success: boolean; data: User }>('/auth/me');
      if (response.success) {
        setUser(response.data);
      } else {
        // Invalid token, clear it
        Cookies.remove('auth_token');
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      Cookies.remove('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (provider: 'google' | 'facebook') => {
    window.location.href = `http://localhost:3000/auth/${provider}`;
  };

  const logout = async () => {
    try {
      await apiService.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    }

    Cookies.remove('auth_token');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};