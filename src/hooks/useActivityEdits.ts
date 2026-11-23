import { useMutation } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { Act, ActTiming, Place } from "../lib/types";

// Edit one itinerary activity's text, places and time (activities.ts). Anyone with access to the
// trip can do this, same as Action Items. `expected` is the text the editor
// opened with; the server refuses the write if the activity has changed since.
// The trip query is reactive, so the day updates without local bookkeeping.
export function useActivityEdits(slug: string) {
  const { code } = useAccessCode();
  const updateMut = useMutation(api.activities.updateActivityText);
  const removeMut = useMutation(api.activities.removeActivity);

  return {
    // `timing`: each of time / endTime / allDay is sent only when it changed (null clears a time);
    // the server re-sorts the day.
    updateActivity: (date: string, index: number, expected: string, text: string, places: Place[], timing: ActTiming = {}) =>
      updateMut({
        slug, code, date, index, expected, text, places,
        ...(timing.time !== undefined ? { time: timing.time } : {}),
        ...(timing.endTime !== undefined ? { endTime: timing.endTime } : {}),
        ...(timing.allDay !== undefined ? { allDay: timing.allDay } : {}),
        ...(timing.description !== undefined ? { description: timing.description } : {}),
      }),
    // `expected` is the whole activity the person saw; the server refuses if the activity at `index` changed.
    removeActivity: (date: string, index: number, expected: Act) => removeMut({ slug, code, date, index, expected }),
  };
}
