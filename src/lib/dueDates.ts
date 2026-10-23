// Due-date helpers for Action Items. Dates are plain YYYY-MM-DD strings
// compared in the viewer's local calendar (not UTC), so "today" flips at
// local midnight.

export type DueState = "overdue" | "soon" | "ok";

// An item turns "soon" (yellow) this many days before it's due.
export const SOON_DAYS = 7;

export function todayISO(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

// Whole calendar days from `from` to `to` (negative if `to` is earlier).
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// Completed rows are never highlighted.
export function dueState(due: string, today: string, done: boolean): DueState {
  if (done) return "ok";
  const days = daysBetween(today, due);
  if (days < 0) return "overdue";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Due Nov 5 · in 3 days", "Due today", "Due Nov 5 · 2 days overdue".
export function dueLabel(due: string, today: string, done: boolean): string {
  const d = new Date(due + "T00:00:00");
  const base = `Due ${MON[d.getMonth()]} ${d.getDate()}`;
  if (done) return base;
  const days = daysBetween(today, due);
  if (days === 0) return "Due today";
  if (days > 0) return `${base} · in ${days} day${days === 1 ? "" : "s"}`;
  const late = -days;
  return `${base} · ${late} day${late === 1 ? "" : "s"} overdue`;
}
