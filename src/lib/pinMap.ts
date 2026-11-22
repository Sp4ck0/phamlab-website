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

// The pinned map's height, set by dragging the divider under it (desktop, per browser). None
// stored means the stylesheet's default. It stays at least a short strip, and never so tall that
// the date strip and some of the itinerary can't fit under it (.trip-map.is-sized says the same).
const HEIGHT_KEY = "phamlab.pinMapHeight";
export const MAP_MIN_H = 160;
const ROOM_BELOW_PX = 260;

export function clampMapHeight(h: number, viewport: number): number {
  return Math.round(Math.max(MAP_MIN_H, Math.min(h, viewport - ROOM_BELOW_PX)));
}

export function maxMapHeight(viewport: number): number {
  return clampMapHeight(Infinity, viewport);
}

export function loadPinMapHeight(): number | null {
  try {
    const h = Number(localStorage.getItem(HEIGHT_KEY));
    return h > 0 ? h : null;
  } catch {
    return null;
  }
}

export function savePinMapHeight(h: number | null) {
  try {
    if (h) localStorage.setItem(HEIGHT_KEY, String(h));
    else localStorage.removeItem(HEIGHT_KEY);
  } catch {
    // ignore
  }
}
