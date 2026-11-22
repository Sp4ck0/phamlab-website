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

// Whether a signal from the backend is one to act on, and the nonce to remember. `seen` is
// undefined until the first value arrives, which is only a baseline: a signal left from before
// a reload (or before turning this on) is never replayed, so the AI's marks don't come back.
export function newSignal(seen: string | null | undefined, nonce: string | null): { seen: string | null | undefined; act: boolean } {
  if (seen === undefined) return { seen: nonce, act: false };
  if (nonce === null || nonce === seen) return { seen, act: false };
  return { seen: nonce, act: true };
}
