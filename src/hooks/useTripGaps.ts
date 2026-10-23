import { useMemo } from "react";
import { computeGaps } from "../lib/tripLogic";
import type { ResolvedDay, Status } from "../lib/types";

export function useTripGaps(resolvedDays: ResolvedDay[], ticks: Record<string, Status>, today: string) {
  return useMemo(() => computeGaps(resolvedDays, ticks, today), [resolvedDays, ticks, today]);
}
