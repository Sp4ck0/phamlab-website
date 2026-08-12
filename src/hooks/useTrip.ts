import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { Trip } from "../lib/types";

export function useTrip(slug: string | undefined) {
  const { code } = useAccessCode();
  const result = useQuery(api.trips.getTrip, slug ? { slug, code } : "skip");
  return {
    trip: result as Trip | null | undefined,
    isLoading: slug !== undefined && result === undefined,
    // undefined = loading, null = not found/not authorized, Trip = ok
  };
}
