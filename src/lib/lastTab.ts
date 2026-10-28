const KEY = "phamlab.lastTab";

// Storage can throw (private mode, blocked site data) — a missing preference
// just means base entry falls back to the top tab.
export function loadLastTab(): string | undefined {
  try {
    return localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function saveLastTab(path: string) {
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // ignore
  }
}

export function clearLastTab() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
