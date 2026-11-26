import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import { useOfflineCopy } from "./useOffline";
import type { Trip } from "../lib/types";

export function useTrip(slug: string | undefined) {
  const { code } = useAccessCode();
  const result = useQuery(api.trips.getTrip, slug ? { slug, code } : "skip") as Trip | null | undefined;
  // Offline, the copy kept on this device from the last visit (lib/offline.ts).
  const { value, offline, savedAt, missing } = useOfflineCopy(slug ? `trip:${slug}` : null, result);
  return {
    trip: value,
    isLoading: slug !== undefined && value === undefined && !missing,
    // undefined = loading, null = not found/not authorized, Trip = ok
    offline,
    // Set when the trip shown is the copy on this device (offline).
    savedAt,
    // Offline, and this trip was never opened on this device.
    notSaved: missing,
  };
}
