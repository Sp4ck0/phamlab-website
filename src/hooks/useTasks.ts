import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import { bookingKey, doneItems, ticksFromTasks } from "../lib/tasks";
import type { Status, Task } from "../lib/types";

// A trip's tasks — bookings to make, days to plan, decisions, to-dos — with
// done-state and due dates shared by everyone with access to the trip and
// persisted in Convex (tasks.ts). The backend derives the list; `today` is the
// viewer's local date, so a blank day that's already over isn't a gap. Until the
// query resolves the list is empty, so the UI shows the itinerary's own
// booked/needed status rather than a wrong flash of state.
export function useTasks(slug: string, today: string) {
  const { code } = useAccessCode();
  const args = slug ? { slug, code, today } : null;
  const result = useQuery(api.tasks.listTasks, args ?? "skip");

  const setStateMut = useMutation(api.tasks.setTaskState).withOptimisticUpdate((store, a) => {
    const q = { slug: a.slug, code: a.code, today };
    const current = store.getQuery(api.tasks.listTasks, q);
    if (!current) return;
    const keys = new Set(a.keys);
    store.setQuery(
      api.tasks.listTasks,
      q,
      current.map((t: Task) => {
        const refsDone = t.refs.map((r: string, i: number) => (a.done !== undefined && keys.has(r) ? a.done : t.refsDone[i]));
        const next = { ...t, refsDone, done: refsDone.every(Boolean) };
        // Clearing an override (null) is left to the server: the default is its to compute.
        return typeof a.dueDate === "string" && t.key === a.keys[0]
          ? { ...next, dueDate: a.dueDate, dueDateIsDefault: false }
          : next;
      })
    );
  });

  const tasks = useMemo(() => (result ?? []) as Task[], [result]);
  const ticks = useMemo(() => ticksFromTasks(tasks), [tasks]);
  const done = useMemo(() => doneItems(tasks), [tasks]);

  const setDone = useCallback(
    (keys: string[], value: boolean) => {
      void setStateMut({ slug, code, keys, done: value });
    },
    [setStateMut, slug, code]
  );

  // Pass `undefined` to clear the override and fall back to the default.
  const setDue = useCallback(
    (key: string, dueDate: string | undefined) => {
      void setStateMut({ slug, code, keys: [key], dueDate: dueDate ?? null });
    },
    [setStateMut, slug, code]
  );

  // A booking tile's status button: toggle every id in `ids` together (a merged
  // card can stand for more than one underlying booking — see mergeHotelsByName).
  const toggleTick = useCallback(
    (ids: string[], currentStatus: Status) => setDone(ids.map(bookingKey), currentStatus === "needed"),
    [setDone]
  );

  const toggleActionItem = useCallback(
    (id: string) => setDone([`item:${id}`], !done[id]),
    [setDone, done]
  );

  // False until the first answer arrives (the tasks are just empty meanwhile).
  const loaded = result !== undefined;

  return { tasks, loaded, ticks, done, setDone, setDue, toggleTick, toggleActionItem };
}
