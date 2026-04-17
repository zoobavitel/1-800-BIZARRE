import React, { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

/** Single shipped theme: HFTF (same tokens as home / `data-theme="dark"`). */
const HFTF_THEME = "dark";

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = HFTF_THEME;
      localStorage.setItem("theme", HFTF_THEME);
    }
  }, []);

  const setTheme = () => {
    /* Kept for call sites; app palette is fixed HFTF. */
  };

  return (
    <ThemeContext.Provider value={{ theme: HFTF_THEME, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
