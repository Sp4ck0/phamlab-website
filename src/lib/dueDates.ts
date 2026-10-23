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

// Relative wording only ("Due in 3 days", "Due today", "2 days overdue"): the
// date itself is already shown by the date input beside it. Empty once done.
export function dueLabel(due: string, today: string, done: boolean): string {
  if (done) return "";
  const days = daysBetween(today, due);
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  const late = -days;
  return `${late} day${late === 1 ? "" : "s"} overdue`;
}
