export function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button className="theme-toggle" type="button" onClick={onToggle}>
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
