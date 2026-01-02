import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

export type ThemePreference = 'industrial' | 'light';

interface ThemeContextType {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemePreference;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme = 'industrial' }) => {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);

  // Apply theme to document whenever it changes
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback(async (newTheme: ThemePreference) => {
    // Update local state immediately for responsiveness
    setThemeState(newTheme);
    document.documentElement.dataset.theme = newTheme;

    // Persist to backend (fire and forget, errors logged but don't block UI)
    try {
      await apiClient.patch('/auth/me/theme', { theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
      // Theme still works locally even if save fails
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'industrial' ? 'light' : 'industrial';
    setTheme(newTheme);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper to update theme state from outside (e.g., when user data loads)
export const updateThemeFromUser = (setTheme: (theme: ThemePreference) => void, userTheme?: string) => {
  if (userTheme === 'light' || userTheme === 'industrial') {
    setTheme(userTheme);
  }
};
