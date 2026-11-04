import { useLayoutEffect, useMemo, useRef } from "react";

// An AI edit is committed before its "look here" signal arrives (mcpFocus.ts), so
// by the time the page is pointed at a day or item it already shows the new
// content. This remembers what each entry looked like just before it last
// changed, so the page can show what changed.
const WINDOW_MS = 15_000;

export interface RecentChange<T> {
  /** The value before the change; null when the entry is new. */
  prev: T | null;
  /** The entry no longer exists (prev is its last value). */
  gone: boolean;
  at: number;
}

export function useRecentChanges<T>(items: T[], idOf: (item: T) => string) {
  const last = useRef<Map<string, { value: T; json: string }> | null>(null);
  const changes = useRef(new Map<string, RecentChange<T>>());

  useLayoutEffect(() => {
    const now = Date.now();
    const current = new Map<string, { value: T; json: string }>();
    for (const value of items) current.set(idOf(value), { value, json: JSON.stringify(value) });
    const before = last.current;
    last.current = current;
    if (!before) return; // The first value is the baseline, not a change.

    const record = (id: string, prev: T | null, gone: boolean) => {
      const earlier = changes.current.get(id);
      // Two quick edits read as one: keep what it looked like before the first.
      const keep = earlier && now - earlier.at <= WINDOW_MS ? earlier.prev : prev;
      changes.current.set(id, { prev: keep, gone, at: now });
    };
    for (const [id, entry] of current) {
      const old = before.get(id);
      if (!old) record(id, null, false);
      else if (old.json !== entry.json) record(id, old.value, false);
    }
    for (const [id, old] of before) if (!current.has(id)) record(id, old.value, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Stable, so effects can depend on it.
  return useMemo(() => {
    const fresh = (id: string) => {
      const change = changes.current.get(id);
      return change && Date.now() - change.at <= WINDOW_MS ? change : null;
    };
    return {
      /** The recent change to this entry, left in place. */
      peek: (id: string) => fresh(id),
      /** The recent change to this entry, used up. */
      take: (id: string) => {
        const change = fresh(id);
        changes.current.delete(id);
        return change;
      },
    };
  }, []);
}
