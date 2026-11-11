import { useMutation } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { Place } from "../lib/types";

// Edit one itinerary activity's text (activities.ts). Anyone with access to the
// trip can do this, same as Action Items. `expected` is the text the editor
// opened with; the server refuses the write if the activity has changed since.
// The trip query is reactive, so the day updates without local bookkeeping.
export function useActivityEdits(slug: string) {
  const { code } = useAccessCode();
  const updateMut = useMutation(api.activities.updateActivityText);

  return {
    updateActivity: (date: string, index: number, expected: string, text: string, places: Place[]) =>
      updateMut({ slug, code, date, index, expected, text, places }),
  };
}
