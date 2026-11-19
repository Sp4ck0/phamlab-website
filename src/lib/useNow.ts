import { useSyncExternalStore } from "react";

// One shared once-a-minute clock for every countdown on the page. The timer only
// runs while something is listening, so a page with no countdown (and a test that
// has unmounted) keeps no timer alive.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The current time in ms, refreshed every minute. */
export const useNow = () => useSyncExternalStore(subscribe, () => now, () => now);
