import { useMemo } from "react";
import { computeGaps } from "../lib/tripLogic";
import type { ResolvedDay, Status } from "../lib/types";

export function useTripGaps(resolvedDays: ResolvedDay[], ticks: Record<string, Status>) {
  return useMemo(() => computeGaps(resolvedDays, ticks), [resolvedDays, ticks]);
}
