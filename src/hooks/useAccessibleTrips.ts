import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import { useOfflineCopy } from "./useOffline";
import type { TripSummary } from "../lib/types";

export function useAccessibleTrips() {
  const { code } = useAccessCode();
  const live = useQuery(api.trips.listAccessibleTrips, { code }) as TripSummary[] | undefined;
  // Offline, the list kept on this device (lib/offline.ts); none saved reads as no trips.
  const { value, missing } = useOfflineCopy("trips", live);
  const trips = missing ? [] : (value ?? undefined);
  return { trips, isLoading: trips === undefined };
}
