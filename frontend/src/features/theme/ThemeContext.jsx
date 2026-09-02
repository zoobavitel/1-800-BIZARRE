import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth";
import { authAPI } from "../auth/services/authService";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

const VALID_THEMES = new Set(["dark", "light", "cool_night"]);

/** @param {unknown} raw */
export function normalizeAppTheme(raw) {
  const t =
    typeof raw === "string" ? raw.trim().toLowerCase().replace(/-/g, "_") : "";
  if (VALID_THEMES.has(t)) return t;
  return "dark";
}

function readStoredTheme() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "dark";
  }
  try {
    const t = localStorage.getItem("theme");
    return normalizeAppTheme(t);
  } catch {
    return "dark";
  }
}

function applyDomTheme(theme) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore quota / privacy mode */
    }
  }
}

export const ThemeProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [theme, setThemeState] = useState(readStoredTheme);

  const commitTheme = useCallback((raw) => {
    const next = normalizeAppTheme(raw);
    setThemeState(next);
    applyDomTheme(next);
  }, []);

  useLayoutEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (authLoading || !user?.id) return undefined;
    let cancelled = false;
    authAPI
      .getProfile()
      .then((p) => {
        if (cancelled || !p || typeof p.theme !== "string") return;
        commitTheme(p.theme);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, commitTheme]);

  const setTheme = useCallback(
    (raw) => {
      commitTheme(raw);
    },
    [commitTheme],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
