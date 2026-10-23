import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { TripExport } from "../lib/types";

export function useTripExport(slug: string | undefined, enabled = true) {
  const { code } = useAccessCode();
  const result = useQuery(api.trips.getTripExport, slug && enabled ? { slug, code } : "skip");
  return {
    data: result as TripExport | null | undefined,
    isLoading: slug !== undefined && enabled && result === undefined,
    // undefined = loading, null = not found/not authorized, TripExport = ok
  };
}
