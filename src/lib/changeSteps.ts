import type { ResolvedDay } from "./types";
import { diffLines, pairRewrites } from "./changeDiff";
import { parseTime } from "./calendar";
import { departureTime } from "./timeline";

// An AI edit to a day, split into one step per change so the page can play
// them one at a time (DetailedView). Returns the day after 0, 1, … n of its
// changes: versions[0] reads as `prev`, versions[n] as `next`, and showing
// versions[k + 1] against versions[k] animates only change k.
//
// A step is the header (summary, callout and every other non-list field), one
// hotel, one transport row, or one activity; a reworded line is one step. The
// steps run in about the order the timeline shows them: the header, hotels,
// untimed transport, then the activities with timed transport slotted in.
export function changeVersions(prev: ResolvedDay, next: ResolvedDay): ResolvedDay[] {
  const json = (x: unknown) => JSON.stringify(x);
  const rows = <T,>(a: T[], b: T[]) => pairRewrites(diffLines(a, b, json));
  const acts = rows(prev.acts ?? [], next.acts ?? []);
  const flights = rows(prev.flights, next.flights);
  const hotels = rows(prev.hotels, next.hotels);

  type Step = { list: "header" } | { list: "acts" | "flights" | "hotels"; row: number };
  const changed = (list: "acts" | "flights" | "hotels", all: { state: string }[]) =>
    all.flatMap((r, row) => (r.state === "same" ? [] : [{ list, row } as Step]));
  const rest = (d: ResolvedDay) => json({ ...d, acts: 0, flights: 0, hotels: 0, _d: 0 });

  const actSteps = changed("acts", acts).map((s) => {
    const r = acts[(s as { row: number }).row];
    const clock = parseTime(typeof r.item === "string" ? undefined : r.item.time);
    return { s, minutes: clock ? clock.h * 60 + clock.m : undefined };
  });
  const middle: Step[] = [];
  const timed: { s: Step; minutes: number }[] = [];
  for (const s of changed("flights", flights)) {
    const time = departureTime(flights[(s as { row: number }).row].item, next.date);
    const clock = parseTime(time);
    if (clock) timed.push({ s, minutes: clock.h * 60 + clock.m });
    else middle.push(s);
  }
  const ordered: Step[] = [];
  for (const a of actSteps) {
    while (timed.length && a.minutes !== undefined && timed[0].minutes <= a.minutes) ordered.push(timed.shift()!.s);
    ordered.push(a.s);
  }
  ordered.push(...timed.map((t) => t.s));
  const steps: Step[] = [
    ...(rest(prev) !== rest(next) ? [{ list: "header" } as Step] : []),
    ...changed("hotels", hotels),
    ...middle,
    ...ordered,
  ];

  // A row's content once its step has played (or not): a removed line drops
  // out, a new one comes in, a reworded one swaps old for new.
  const build = <T,>(list: "acts" | "flights" | "hotels", all: ReturnType<typeof rows<T>>, played: Set<string>) =>
    all.flatMap((r, row) => {
      if (r.state === "same") return [r.item];
      const done = played.has(`${list}:${row}`);
      if (r.state === "gone") return done ? [] : [r.item];
      return done ? [r.item] : r.prev !== undefined ? [r.prev] : [];
    });
  const versions: ResolvedDay[] = [];
  const played = new Set<string>();
  for (let k = 0; k <= steps.length; k++) {
    if (k > 0) {
      const s = steps[k - 1];
      played.add(s.list === "header" ? "header" : `${s.list}:${s.row}`);
    }
    versions.push({
      ...(played.has("header") ? next : prev),
      date: next.date,
      _d: next._d,
      acts: build("acts", acts, played),
      flights: build("flights", flights, played),
      hotels: build("hotels", hotels, played),
    });
  }
  return versions;
}
