import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, getToken, saveToken, clearToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        const userData = await authAPI.me();
        setUser(userData);
      } catch {
        clearToken();
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const data = await authAPI.login(username, password);
    saveToken(data.access_token);
    const userData = await authAPI.me();
    setUser(userData);
    return userData;
  };

  const register = async (username, password) => {
    return await authAPI.register(username, password);
  };

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = {
    user,
    role: user?.role,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
