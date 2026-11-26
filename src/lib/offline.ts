import { ConvexError } from "convex/values";

// Offline mode: the last copy of each trip someone opened (and its tasks, its
// note, and the trip list) is kept on this device, so the itinerary can still
// be read when the server can't be reached. The copies hold the trip's full
// text, booking details included, so they are dropped when the access code
// changes or the person logs out (useAccessCode). Stored in IndexedDB: a trip
// can outgrow localStorage. Storage can fail (private mode, blocked site
// data); a copy is then simply not kept, and the page works as before.

export type Saved<T> = { value: T; savedAt: number };

export interface Kv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

const DB = "phamlab-offline";
const STORE = "copies";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function indexedDbKv(): Kv {
  let db: Promise<IDBDatabase> | null = null;
  const open = () => {
    db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return db;
  };
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);
  return {
    get: async (key) => request((await store("readonly")).get(key)),
    set: async (key, value) => void (await request((await store("readwrite")).put(value, key))),
    remove: async (key) => void (await request((await store("readwrite")).delete(key))),
    clear: async () => void (await request((await store("readwrite")).clear())),
  };
}

let kv: Kv | null = null;
const getKv = () => (kv ??= indexedDbKv());

/** Tests swap in an in-memory store. */
export function setOfflineKv(next: Kv) {
  kv = next;
}

export async function putSaved(key: string, value: unknown, now = Date.now()) {
  try {
    await getKv().set(key, { value, savedAt: now } satisfies Saved<unknown>);
  } catch {
    // Not kept; nothing else changes.
  }
}

export async function removeSaved(key: string) {
  try {
    await getKv().remove(key);
  } catch {
    // ignore
  }
}

/** The saved copy, or null when there is none (or storage can't be read). */
export async function getSaved<T>(key: string): Promise<Saved<T> | null> {
  try {
    const s = (await getKv().get(key)) as Saved<T> | undefined;
    return s && typeof s.savedAt === "number" && s.value !== undefined ? s : null;
  } catch {
    return null;
  }
}

export async function clearSaved() {
  try {
    await getKv().clear();
  } catch {
    // ignore
  }
}

export type View<T> = {
  /** undefined while loading, or offline with no copy (`missing`). */
  value: T | null | undefined;
  /** Shown from the copy on this device, saved at `savedAt`. */
  savedAt: number | null;
  /** Offline and this device has no copy. */
  missing: boolean;
};

/**
 * What to show: the live answer whenever there is one (even offline, Convex
 * keeps the last answer it had); otherwise, offline, the copy on this device.
 * `saved` is undefined while the copy is still being looked up.
 */
export function pickView<T>(live: T | null | undefined, saved: Saved<T> | null | undefined, offline: boolean): View<T> {
  if (live !== undefined) return { value: live, savedAt: null, missing: false };
  if (!offline || saved === undefined) return { value: undefined, savedAt: null, missing: false };
  if (saved === null) return { value: undefined, savedAt: null, missing: true };
  return { value: saved.value, savedAt: saved.savedAt, missing: false };
}

export const OFFLINE_MESSAGE = "You're offline, so changes can't be saved. Try again once you're back online.";

/**
 * While offline, every handler is swapped for one that saves nothing: a
 * Convex mutation sent now would be queued and replayed later on top of
 * whatever changed meanwhile. The rejection is a ConvexError so the editors'
 * error text (serverMessage) shows why; callers that don't wait on it don't
 * get an unhandled rejection.
 */
export function blockedWhileOffline<T extends Record<string, (...args: never) => unknown>>(handlers: T, offline: boolean): T {
  if (!offline) return handlers;
  const blocked = () => {
    const p = Promise.reject(new ConvexError(OFFLINE_MESSAGE));
    p.catch(() => {});
    return p;
  };
  return Object.fromEntries(Object.keys(handlers).map((k) => [k, blocked])) as unknown as T;
}

export function savedLabel(savedAt: number): string {
  return new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
