const KEY = "phamlab.followAi";
const EVENT = "phamlab:followAi";

// Per browser, off by default: a shared access code means every device on it
// is the same "user" to the backend, so whether a page jumps when the AI edits
// something is each device's own choice. Storage can throw (private mode,
// blocked site data) — that just leaves it off.
export function loadFollowAi(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveFollowAi(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

// For useSyncExternalStore: `storage` covers other tabs, EVENT this one.
export function subscribeFollowAi(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
