/**
 * AuthContext - Centralized authentication state management
 *
 * Provides user data, role, and auth functions to all components.
 * Eliminates redundant /api/auth/me calls across the app.
 *
 * Usage:
 *   const { user, isManager, logout } = useAuth();
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import type { AccountUser } from '../types/user';
import { useTheme } from './ThemeContext';

// User role type
export type UserRole = 'production_staff' | 'designer' | 'manager' | 'owner';

interface AuthContextType {
  // User state
  user: AccountUser | null;
  isLoading: boolean;

  // Convenience accessors
  userId: number | null;
  userRole: UserRole | null;
  isManager: boolean;  // manager or owner
  isOwner: boolean;

  // Actions
  login: (userData: AccountUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  // Logout handler
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    navigate('/login');
  }, [navigate]);

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (!token && !refreshToken) {
      setIsLoading(false);
      setUser(null);
      return;
    }

    try {
      const data = await authApi.getCurrentUser();
      const userData = data.user as AccountUser;
      setUser(userData);
      // Apply user's theme preference
      if (userData.theme_preference) {
        setTheme(userData.theme_preference);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout, setTheme]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login handler
  const login = useCallback((userData: AccountUser) => {
    setUser(userData);
    if (userData.theme_preference) {
      setTheme(userData.theme_preference);
    }
    navigate('/dashboard');
  }, [navigate, setTheme]);

  // Refresh user data (for when user updates their profile)
  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.getCurrentUser();
      const userData = data.user as AccountUser;
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  // Computed values
  const userId = user?.user_id ?? null;
  const userRole = (user?.role as UserRole) ?? null;
  const isManager = userRole === 'manager' || userRole === 'owner';
  const isOwner = userRole === 'owner';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        userId,
        userRole,
        isManager,
        isOwner,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Hook that returns auth context or null if not in provider
 * Useful for optional auth checks
 */
export const useAuthOptional = (): AuthContextType | null => {
  return useContext(AuthContext) ?? null;
};
