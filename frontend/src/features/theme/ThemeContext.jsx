import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../auth/services/authService';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const getStoredTheme = () => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  }
  return 'dark';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  // Load theme from profile when user is authenticated (has token)
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    authAPI.getProfile().then((profile) => {
      if (profile?.theme && (profile.theme === 'dark' || profile.theme === 'light')) {
        setThemeState(profile.theme);
      }
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
