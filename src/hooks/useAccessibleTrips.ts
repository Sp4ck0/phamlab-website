import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { TripSummary } from "../lib/types";

export function useAccessibleTrips() {
  const { code } = useAccessCode();
  const trips = useQuery(api.trips.listAccessibleTrips, { code }) as TripSummary[] | undefined;
  return { trips, isLoading: trips === undefined };
}
