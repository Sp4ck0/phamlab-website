const KEY = "phamlab.navCollapsed";
const EVENT = "phamlab:navCollapsed";

// Per browser: whether the desktop left menu is tucked away. Phones have their own
// slide-out menu and ignore this. Storage can throw (private mode, blocked site data)
// — that just leaves the menu open.
export function loadNavCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveNavCollapsed(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

// For useSyncExternalStore: `storage` covers other tabs, EVENT this one.
export function subscribeNavCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
