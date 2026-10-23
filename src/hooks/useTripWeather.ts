import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { DayWeather } from "../lib/weather";

// Per-day weather keyed by date (YYYY-MM-DD), filled server-side by a cron
// (weather.ts). Days with no row simply render no badge.
export function useTripWeather(slug: string | undefined) {
  const { code } = useAccessCode();
  const rows = useQuery(api.weather.getTripWeather, slug ? { slug, code } : "skip");
  return useMemo(() => {
    const byDate: Record<string, DayWeather> = {};
    for (const r of (rows ?? []) as DayWeather[]) byDate[r.date] = r;
    return byDate;
  }, [rows]);
}
