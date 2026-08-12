import { useMemo } from "react";
import { resolveDays } from "../lib/tripLogic";
import type { Trip } from "../lib/types";

export function useResolvedDays(trip: Trip | null | undefined) {
  return useMemo(() => (trip ? resolveDays(trip) : []), [trip]);
}
