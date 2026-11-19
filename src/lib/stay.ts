// Pure helpers for a hotel stay: how long it is, which night a tile is, what it
// costs per night, and where to get directions. Everything here is derived from
// data the trip already has; nothing is typed in.
import { stayEndDate, stayStartIndex } from "./calendar";
import { fmtDate, fmtHm } from "./segments";
import type { HotelPrice, ResolvedDay } from "./types";

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


export interface CancelStatus {
  state: "ok" | "soon" | "ended";
  text: string;
}

/**
 * The free-cancellation chip: plenty of time (green), inside three days (amber,
 * counted in days or, under a day, hours), or passed (gray). The deadline is local
 * to the hotel; it is compared as a wall-clock time in the reader's own zone, which
 * is close enough for "days left". A day alone means the end of that day.
 */
export function cancelStatus(until: string, now: number): CancelStatus {
  const hasTime = until.includes("T");
  const ms = Date.parse(`${hasTime ? until : `${until}T23:59`}:00`);
  const label = `${fmtDate(until)}${hasTime ? ` · ${fmtHm(until.split("T")[1])}` : ""}`;
  if (ms <= now) return { state: "ended", text: "Cancellation window ended" };
  const hours = (ms - now) / 36e5;
  if (hours < 24) return { state: "soon", text: `Free cancel ends in ${Math.max(1, Math.round(hours))} h · ${label}` };
  const days = Math.ceil(hours / 24);
  if (hours <= 72) return { state: "soon", text: `Free cancel ends in ${days} days · ${label}` };
  return { state: "ok", text: `Free cancel until ${label} (${days} days)` };
}

/** A tel: link from a phone as typed ("+34 935 52 96 96" gives "tel:+34935529696"). */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * The budget chips for a stay that isn't booked: the target as given, then the other
 * basis when the length is known ("Budget ≈ $400 / night", "≈ $1,600 for 4 nights").
 * `per` unset means we don't know what it covers, so it is shown as it is.
 */
export function budgetChips(b: HotelPrice, nights: number | undefined): string[] {
  const money = (n: number, round = false) => fmtMoney(n, b.currency, round);
  if (b.per === "night") {
    return [`Budget ≈ ${money(b.amount)} / night`, ...(nights ? [`≈ ${money(b.amount * nights)} for ${nights} ${nights === 1 ? "night" : "nights"}`] : [])];
  }
  if (b.per === "stay") {
    return [`Budget ≈ ${money(b.amount)} for the stay`, ...(nights ? [`≈ ${money(b.amount / nights, true)} / night`] : [])];
  }
  return [`Budget ≈ ${money(b.amount)}`];
}

/** A Google hotel search for the area and dates of a stay that has no hotel yet. */
export function hotelSearchUrl(area: string, checkIn?: string, checkOut?: string): string {
  const url = new URL("https://www.google.com/travel/search");
  url.searchParams.set("q", `Hotels in ${area}${checkIn && checkOut ? ` ${checkIn} to ${checkOut}` : ""}`);
  return url.toString();
}
