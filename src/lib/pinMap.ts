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

// Wide desktop windows can pin the map at the side instead of on top: the itinerary on the left,
// the map filling the window's height on the right. Side is the default; "top" is stored when
// someone switches back. Narrower windows always pin on top (TripPage decides what's wide).
const LAYOUT_KEY = "phamlab.pinMapLayout";

export function loadPinMapSide(): boolean {
  try {
    return localStorage.getItem(LAYOUT_KEY) !== "top";
  } catch {
    return true;
  }
}

export function savePinMapSide(side: boolean) {
  try {
    if (side) localStorage.removeItem(LAYOUT_KEY);
    else localStorage.setItem(LAYOUT_KEY, "top");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePinMapSide(): [boolean, (side: boolean) => void] {
  return [useSyncExternalStore(subscribe, loadPinMapSide, () => true), savePinMapSide];
}

// The side map's width, set by dragging the divider down its left edge. None stored means the
// stylesheet's default. It stays at least a narrow column, and never so wide that the side menu
// and a readable itinerary column can't fit beside it (.wrap:has(> .map-side) says the same).
const WIDTH_KEY = "phamlab.pinMapWidth";
export const MAP_MIN_W = 320;
const ROOM_LEFT_PX = 800;

export function clampMapWidth(w: number, viewport: number): number {
  return Math.round(Math.max(MAP_MIN_W, Math.min(w, viewport - ROOM_LEFT_PX)));
}

export function maxMapWidth(viewport: number): number {
  return clampMapWidth(Infinity, viewport);
}

export function loadPinMapWidth(): number | null {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w > 0 ? w : null;
  } catch {
    return null;
  }
}

export function savePinMapWidth(w: number | null) {
  try {
    if (w) localStorage.setItem(WIDTH_KEY, String(w));
    else localStorage.removeItem(WIDTH_KEY);
  } catch {
    // ignore
  }
}
