import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { Status } from "../lib/types";

// Check-off state shared by everyone with access to the trip, persisted in
// Convex (checks.ts). Two kinds of key live in one table:
//   - booking ticks: the content-derived flight/hotel id -> "booked"|"needed"
//   - custom action items: `ai:<item id>` -> "done"|"open"
// Until the query resolves both maps are empty, so the UI shows the data's
// own booked/needed status rather than a wrong flash of state.
export function useChecks(slug: string) {
  const { code } = useAccessCode();
  const checks = useQuery(api.checks.listChecks, slug ? { slug, code } : "skip");

  const setCheck = useMutation(api.checks.setCheck).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.checks.listChecks, { slug: args.slug, code: args.code });
    if (current) {
      const rest = current.filter((c: { key: string }) => c.key !== args.key);
      store.setQuery(api.checks.listChecks, { slug: args.slug, code: args.code }, [...rest, { key: args.key, value: args.value }]);
    }
  });

  const ticks = useMemo(() => {
    const out: Record<string, Status> = {};
    for (const { key, value } of checks ?? []) {
      if (value === "booked" || value === "needed") out[key] = value;
    }
    return out;
  }, [checks]);

  const done = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const { key, value } of checks ?? []) {
      if (key.startsWith("ai:") && value === "done") out[key.slice(3)] = true;
    }
    return out;
  }, [checks]);

  // Toggle every id in `ids` together (a merged card's status button can
  // represent more than one underlying booking — see mergeHotelsByName).
  const toggleTick = useCallback(
    (ids: string[], currentStatus: Status) => {
      const next = currentStatus === "needed" ? "booked" : "needed";
      ids.forEach((key) => void setCheck({ slug, code, key, value: next }));
    },
    [setCheck, slug, code]
  );

  const toggleActionItem = useCallback(
    (id: string) => {
      void setCheck({ slug, code, key: `ai:${id}`, value: done[id] ? "open" : "done" });
    },
    [setCheck, slug, code, done]
  );

  return { ticks, toggleTick, done, toggleActionItem };
}
