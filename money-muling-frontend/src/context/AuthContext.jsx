/* eslint-disable react-refresh/only-export-components */
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

const normalizeRole = (rawRole) => {
  if (!rawRole) return rawRole;
  if (rawRole === 'CLIENT_USER') return 'CLIENT';
  if (rawRole === 'SUPER_ADMIN') return 'ADMIN';
  return rawRole;
};

const getWorkspaceForRole = (role) => {
  if (role === 'CLIENT') return 'client';
  if (role === 'TRACE_LAB_ANALYST') return 'tracelab';
  if (role === 'INVESTIGATOR') return 'invospace';
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspaceState] = useState(() => localStorage.getItem('workspace'));

  const setWorkspace = (workspaceName) => {
    setWorkspaceState(workspaceName);
    localStorage.setItem('workspace', workspaceName);
  };

  const clearWorkspace = () => {
    setWorkspaceState(null);
    localStorage.removeItem('workspace');
  };

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        const userData = await authAPI.me();
        const normalizedUser = { ...userData, role: normalizeRole(userData.role) };
        setUser(normalizedUser);
        if (normalizedUser.role !== 'ADMIN') {
          const roleWorkspace = getWorkspaceForRole(normalizedUser.role);
          if (roleWorkspace) {
            setWorkspaceState(roleWorkspace);
          }
        }
      } catch {
        clearToken();
        clearWorkspace();
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
    };
    initAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const data = await authAPI.login(username, password);
    saveToken(data.access_token);
    const userData = await authAPI.me();
    const normalizedUser = { ...userData, role: normalizeRole(userData.role) };
    setUser(normalizedUser);

    if (normalizedUser.role !== 'ADMIN') {
      const roleWorkspace = getWorkspaceForRole(normalizedUser.role);
      if (roleWorkspace) {
        setWorkspace(roleWorkspace);
      }
    }

    return normalizedUser;
  };

  const clientRegister = async (formData) => {
    return await authAPI.clientRegister(formData);
  };

  const register = async (username, password) => {
    return await authAPI.register(username, password);
  };

  const logout = useCallback(() => {
    clearToken();
    clearWorkspace();
    setUser(null);
  }, []);

  const value = {
    user,
    role: user?.role,
    workspace,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    clientRegister,
    logout,
    setWorkspace,
    clearWorkspace,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

