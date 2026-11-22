import { useSyncExternalStore } from "react";

const KEY = "phamlab.pinMap";
const EVENT = "phamlab:pinMap";

// Desktop only, per browser, off by default: whether the trip map stays pinned above the date
// strip while you scroll. Storage can throw (private mode, blocked site data); that leaves it off.
export function loadPinMap(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function savePinMap(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

// `storage` covers other tabs, EVENT this one.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function usePinMap(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, loadPinMap, () => false), savePinMap];
}
