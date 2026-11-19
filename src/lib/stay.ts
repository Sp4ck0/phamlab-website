// Pure helpers for a hotel stay: how long it is, which night a tile is, what it
// costs per night, and where to get directions. Everything here is derived from
// data the trip already has; nothing is typed in.
import { stayEndDate, stayStartIndex } from "./calendar";
import type { HotelPrice, Place, ResolvedDay } from "./types";

export interface StayInfo {
  checkIn: string; // "YYYY-MM-DD", the day the stay starts
  checkOut: string; // the day it ends
  nights: number;
  night: number; // 1-based: which night this day's tile is (the last night on the check-out day)
  isCheckInDay: boolean;
  isCheckOutDay: boolean;
}

/** The stay a hotel tile belongs to, from the day it is on; null when the check-out day isn't known or it is a same-day stay. */
export function stayInfo(days: ResolvedDay[], dayIndex: number, name: string): StayInfo | null {
  if (!name || !days[dayIndex]) return null;
  const startIdx = stayStartIndex(days, dayIndex, name);
  const checkOut = stayEndDate(days, dayIndex, name);
  if (!checkOut) return null;
  const checkIn = days[startIdx].date;
  const dayMs = 864e5;
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / dayMs);
  if (nights < 1) return null;
  const today = days[dayIndex].date;
  const night = Math.min(nights, Math.max(1, Math.round((Date.parse(today) - Date.parse(checkIn)) / dayMs) + 1));
  return { checkIn, checkOut, nights, night, isCheckInDay: today === checkIn, isCheckOutDay: today === checkOut };
}

/** "$1,098.92" for a price; unknown currency codes still show. Whole amounts when asked (a derived per-night figure). */
export function fmtMoney(amount: number, currency: string, round = false): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: round ? 0 : 2 }).format(amount);
  } catch {
    return `${round ? Math.round(amount) : amount} ${currency}`;
  }
}

/**
 * The price chip for a stay: the total and the per-night figure when we can
 * say both, only what the source says when it doesn't (`per` unset means we
 * don't know what the amount covers, so it is shown as it is).
 */
export function priceText(p: HotelPrice, nights: number | undefined): string {
  if (p.per === "stay") {
    return nights ? `${fmtMoney(p.amount, p.currency)} total · ${fmtMoney(p.amount / nights, p.currency, true)} / night` : `${fmtMoney(p.amount, p.currency)} total`;
  }
  if (p.per === "night") {
    return nights ? `${fmtMoney(p.amount, p.currency)} / night · ${fmtMoney(p.amount * nights, p.currency)} total` : `${fmtMoney(p.amount, p.currency)} / night`;
  }
  return fmtMoney(p.amount, p.currency);
}

/** Minutes between a check-out time and a later check-in time on the same day ("HH:MM" each), else null. */
export function gapMinutes(checkOutTime: string | undefined, checkInTime: string | undefined): number | null {
  if (!checkOutTime || !checkInTime) return null;
  const mins = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  const gap = mins(checkInTime) - mins(checkOutTime);
  return gap >= 0 ? gap : null;
}

/** A Google Maps directions link to the place (the exact listing when it has a place id). */
export function directionsUrl(p: Place): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", [p.name, p.address].filter(Boolean).join(", "));
  if (p.placeId) url.searchParams.set("destination_place_id", p.placeId);
  return url.toString();
}
