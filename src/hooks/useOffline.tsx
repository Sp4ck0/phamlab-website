import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useConvex } from "convex/react";
import { getSaved, pickView, putSaved, removeSaved, type Saved, type View } from "../lib/offline";

// How long the server may be unreachable before the site says it is offline.
// Short drops (a reconnect, a tunnel) pass without a banner.
const GRACE_MS = 4000;

const Ctx = createContext(false);

// Offline = the browser says there is no network, or Convex's connection has
// been down for GRACE_MS (no signal, or the backend itself is down). Back
// online as soon as it reconnects.
export function OfflineProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (!navigator.onLine) {
        clearTimeout(timer);
        timer = undefined;
        setOffline(true);
      } else if (convex.connectionState().isWebSocketConnected) {
        clearTimeout(timer);
        timer = undefined;
        setOffline(false);
      } else {
        // Each failed retry reports again; keep the first countdown going.
        timer ??= setTimeout(() => setOffline(true), GRACE_MS);
      }
    };
    update();
    const stop = convex.subscribeToConnectionState(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearTimeout(timer);
      stop();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [convex]);
  return <Ctx.Provider value={offline}>{children}</Ctx.Provider>;
}

export function useOffline() {
  return useContext(Ctx);
}

/**
 * A live query's answer, kept on this device under `key` (null = nothing to
 * keep), and given back from there while offline when there is no live answer.
 * A null answer (gone, or access removed) drops the copy.
 */
export function useOfflineCopy<T>(key: string | null, live: T | null | undefined): View<T> & { offline: boolean } {
  const offline = useOffline();
  useEffect(() => {
    if (!key || live === undefined) return;
    if (live === null) void removeSaved(key);
    else void putSaved(key, live);
  }, [key, live]);
  const [copy, setCopy] = useState<{ key: string; saved: Saved<T> | null } | null>(null);
  const needCopy = !!key && offline && live === undefined;
  useEffect(() => {
    if (!needCopy || !key) return;
    let gone = false;
    void getSaved<T>(key).then((saved) => {
      if (!gone) setCopy({ key, saved });
    });
    return () => {
      gone = true;
    };
  }, [needCopy, key]);
  const saved = copy && copy.key === key ? copy.saved : undefined;
  return { offline, ...pickView(live, saved, offline) };
}
