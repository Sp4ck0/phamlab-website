import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";

export type Theme = "light" | "dark";
export type TempUnit = "F" | "C";

const THEME_KEY = "phamlab.theme";
const UNIT_KEY = "phamlab.tempUnit";

interface SettingsCtx {
  // undefined = follow the system setting.
  theme: Theme | undefined;
  tempUnit: TempUnit;
  setTheme: (theme: Theme | "system") => void;
  setTempUnit: (unit: TempUnit) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

function readTheme(): Theme | undefined {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : undefined;
}

function readUnit(): TempUnit {
  return localStorage.getItem(UNIT_KEY) === "C" ? "C" : "F";
}

// The backend is the source of truth once the visitor has a grant (code or
// login). localStorage mirrors it so the first paint is right and so
// grant-less pages (/unlock, /login) still honor the last choice.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { code } = useAccessCode();
  const server = useQuery(api.settings.getSettings, code ? { code } : {});
  const save = useMutation(api.settings.updateSettings);

  const [theme, setThemeState] = useState<Theme | undefined>(readTheme);
  const [tempUnit, setTempUnitState] = useState<TempUnit>(readUnit);

  useEffect(() => {
    if (!server) return;
    setThemeState(server.theme ?? undefined);
    setTempUnitState(server.tempUnit);
  }, [server]);

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem(THEME_KEY, theme);
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(THEME_KEY);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(UNIT_KEY, tempUnit);
  }, [tempUnit]);

  const setTheme = useCallback(
    (next: Theme | "system") => {
      setThemeState(next === "system" ? undefined : next);
      if (server) void save({ code, theme: next });
    },
    [server, save, code]
  );

  const setTempUnit = useCallback(
    (next: TempUnit) => {
      setTempUnitState(next);
      if (server) void save({ code, tempUnit: next });
    },
    [server, save, code]
  );

  return <Ctx.Provider value={{ theme, tempUnit, setTheme, setTempUnit }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
