import { useSettings } from "./useSettings";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const { theme, setTheme } = useSettings();
  const isDark = theme ? theme === "dark" : systemPrefersDark();
  const toggle = () => setTheme(isDark ? "light" : "dark");
  return { isDark, toggle };
}
