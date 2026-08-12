import { useMemo } from "react";
import { computeGaps } from "../lib/tripLogic";
import type { Group, ResolvedDay, Status } from "../lib/types";

export function useTripGaps(resolvedDays: ResolvedDay[], groups: Group[], activeGroup: string, ticks: Record<string, Status>) {
  return useMemo(
    () => computeGaps(resolvedDays, groups, activeGroup, ticks),
    [resolvedDays, groups, activeGroup, ticks]
  );
}
