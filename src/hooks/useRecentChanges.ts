import { useEffect, useMemo, useRef, useState } from "react";

// An AI edit is committed before its "look here" signal arrives (mcpFocus.ts), so
// by the time the page is pointed at a day or item it already shows the new
// content. This remembers what each entry looked like just before it last
// changed, so the page can show what changed.
//
// With `hold` on (this tab will be pointed at the edit), a modified entry also
// keeps showing its previous version (`held`) until the page releases it, so the
// reader sees old -> red -> green instead of new -> old -> new. A hold expires on
// its own if no "look here" signal comes.
const WINDOW_MS = 15_000;
const HOLD_MS = 2_500;
const SKIP_MS = 5_000;

export interface RecentChange<T> {
  /** The value before the change; null when the entry is new. */
  prev: T | null;
  /** The entry no longer exists (prev is its last value). */
  gone: boolean;
  at: number;
}

export function useRecentChanges<T>(items: T[], idOf: (item: T) => string, hold = false) {
  const last = useRef<{ items: T[]; byId: Map<string, { value: T; json: string }> } | null>(null);
  const changes = useRef(new Map<string, RecentChange<T>>());
  const holds = useRef(new Map<string, { prev: T; until: number }>());
  const skips = useRef(new Map<string, number>());
  const version = useRef(0);
  const [, rerender] = useState(0);

  // Detected while rendering (not after), so a hold applies on the very render
  // that first has the new content. Keyed on the list identity, so a repeated
  // render of the same list does nothing.
  if (last.current?.items !== items) {
    const now = Date.now();
    const current = new Map<string, { value: T; json: string }>();
    for (const value of items) current.set(idOf(value), { value, json: JSON.stringify(value) });
    const before = last.current?.byId;
    last.current = { items, byId: current };
    if (before) {
      const record = (id: string, prev: T | null, gone: boolean) => {
        const earlier = changes.current.get(id);
        // Two quick edits read as one: keep what it looked like before the first.
        const keep = earlier && now - earlier.at <= WINDOW_MS ? earlier.prev : prev;
        changes.current.set(id, { prev: keep, gone, at: now });
      };
      for (const [id, entry] of current) {
        const old = before.get(id);
        if (!old) record(id, null, false);
        else if (old.json !== entry.json) {
          record(id, old.value, false);
          const skipUntil = skips.current.get(id);
          skips.current.delete(id);
          if (hold && !(skipUntil && skipUntil > now)) {
            const already = holds.current.get(id);
            holds.current.set(id, { prev: already ? already.prev : old.value, until: now + HOLD_MS });
            version.current++;
          }
        }
      }
      for (const [id, old] of before) if (!current.has(id)) record(id, old.value, true);
    }
  }

  // Let go of holds nobody released (no "look here" signal came).
  const stamp = version.current;
  useEffect(() => {
    if (!holds.current.size) return;
    const next = Math.min(...[...holds.current.values()].map((h) => h.until));
    const t = setTimeout(() => {
      const now = Date.now();
      for (const [id, h] of holds.current) if (h.until <= now) holds.current.delete(id);
      version.current++;
      rerender((n) => n + 1);
    }, Math.max(0, next - Date.now()) + 5);
    return () => clearTimeout(t);
  }, [stamp]);

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
      /** What this entry looked like before an edit that has not been shown yet. */
      held: (id: string): T | undefined => {
        const h = holds.current.get(id);
        return h && h.until > Date.now() ? h.prev : undefined;
      },
      /** Show this entry's new content now. */
      release: (id: string) => {
        if (!holds.current.delete(id)) return;
        version.current++;
        rerender((n) => n + 1);
      },
      /** The next change to this entry is the reader's own: never hold it. */
      skip: (id: string) => {
        skips.current.set(id, Date.now() + SKIP_MS);
      },
      /** Changes whenever a hold starts or ends; a dependency for derived lists. */
      version: () => version.current,
    };
  }, []);
}
