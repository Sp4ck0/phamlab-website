import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";

// Per-row due-date overrides, shared by everyone with access to the trip and
// persisted in Convex (dueDates.ts). A row with no override uses the default
// the caller supplies (the trip's start date), so before the query resolves
// every row simply shows its default.
export function useDueDates(slug: string) {
  const { code } = useAccessCode();
  const rows = useQuery(api.dueDates.listDueDates, slug ? { slug, code } : "skip");

  const setDueMut = useMutation(api.dueDates.setDueDate).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.dueDates.listDueDates, { slug: args.slug, code: args.code });
    if (current) {
      const rest = current.filter((r: { key: string }) => r.key !== args.key);
      const next = args.dueDate === undefined ? rest : [...rest, { key: args.key, dueDate: args.dueDate }];
      store.setQuery(api.dueDates.listDueDates, { slug: args.slug, code: args.code }, next);
    }
  });

  const overrides = useMemo(() => {
    const out: Record<string, string> = {};
    for (const { key, dueDate } of rows ?? []) out[key] = dueDate;
    return out;
  }, [rows]);

  // Pass `undefined` to clear the override and fall back to the default.
  const setDue = useCallback(
    (key: string, dueDate: string | undefined) => {
      void setDueMut({ slug, code, key, dueDate });
    },
    [setDueMut, slug, code]
  );

  return { overrides, setDue };
}
