// Helpers for the backend's task list (convex/travel/tasks.ts).
import type { Status, Task, TaskScope } from "./types";
import { fmtDow, modeLabel } from "./tripLogic";

const dow = (iso: string) => fmtDow(new Date(iso + "T00:00:00"));

export const scopeStart = (s: TaskScope): string | undefined => (s.kind === "day" ? s.date : s.kind === "range" ? s.start : undefined);
export const scopeEnd = (s: TaskScope): string | undefined => (s.kind === "day" ? s.date : s.kind === "range" ? s.end : undefined);

// "Fri Nov 20", "Fri Nov 20 – Sun Nov 22", or "Whole trip".
export function scopeLabel(s: TaskScope): string {
  if (s.kind === "trip") return "Whole trip";
  if (s.kind === "day") return dow(s.date);
  return `${dow(s.start)} – ${dow(s.end)}`;
}

// Does the task apply on this day? A whole-trip task applies on every day.
export function coversDay(s: TaskScope, date: string): boolean {
  if (s.kind === "trip") return true;
  if (s.kind === "day") return s.date === date;
  return s.start <= date && date <= s.end;
}

// The pill beside a task: what is being booked, or the kind of task.
export function kindLabel(t: Task): string | undefined {
  if (t.kind === "booking") return t.mode === "hotel" ? "Hotel" : modeLabel(t.mode);
  if (t.kind === "plan") return "Plan";
  if (t.kind === "decision") return "Decision";
  return undefined;
}

const BOOKING = "booking:";

// A state key as the tiles know it (the bare `<date>|f|…` / `<date>|h|…` id).
export const bookingId = (key: string) => key.slice(BOOKING.length);
export const bookingKey = (id: string) => BOOKING + id;

// Tile ticks, derived from the booking tasks: each ref's own done-state,
// "booked" when done. A booking the itinerary already marks booked and nobody
// flipped is not a task, so it has no tick and its own status shows.
export function ticksFromTasks(tasks: Task[]): Record<string, Status> {
  const out: Record<string, Status> = {};
  for (const t of tasks) {
    if (t.kind !== "booking") continue;
    t.refs.forEach((ref, i) => {
      out[bookingId(ref)] = t.refsDone[i] ? "booked" : "needed";
    });
  }
  return out;
}

// Stored item ids that are done, for the per-day checklists.
export function doneItems(tasks: Task[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const t of tasks) if (t.editable && t.done) out[t.key.slice("item:".length)] = true;
  return out;
}
