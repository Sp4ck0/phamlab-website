import { useCallback, useEffect, useState } from "react";

const KEY = "phamlab.theme";
type Theme = "light" | "dark";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme | undefined>(() => {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : undefined;
  });

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  const isDark = theme ? theme === "dark" : systemPrefersDark();

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const currentlyDark = prev ? prev === "dark" : systemPrefersDark();
      const next: Theme = currentlyDark ? "light" : "dark";
      localStorage.setItem(KEY, next);
      return next;
    });
  }, []);

  return { isDark, toggle };
}
