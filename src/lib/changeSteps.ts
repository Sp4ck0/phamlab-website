import type { ResolvedDay } from "./types";
import { diffLines, pairRewrites } from "./changeDiff";
import { buildTimeline } from "./timeline";
import type { FlightGroup, HotelGroup } from "./tripLogic";

// An AI edit to a day, split into one step per change so the page can play
// them one at a time (DetailedView). Returns the day after 0, 1, … n of its
// changes: versions[0] reads as `prev`, versions[n] as `next`, and showing
// versions[k + 1] against versions[k] animates only change k.
//
// A step is the header (summary, callout and every other non-list field), one
// hotel, one transport row, or one activity; a reworded line is one step. The
// header goes first, then the rest in the order the timeline shows them
// (buildTimeline itself orders them, so the page only ever scrolls down).
export function changeVersions(prev: ResolvedDay, next: ResolvedDay): ResolvedDay[] {
  const json = (x: unknown) => JSON.stringify(x);
  const rows = <T,>(a: T[], b: T[]) => pairRewrites(diffLines(a, b, json));
  const acts = rows(prev.acts ?? [], next.acts ?? []);
  const flights = rows(prev.flights, next.flights);
  const hotels = rows(prev.hotels, next.hotels);
  const rest = (d: ResolvedDay) => json({ ...d, acts: 0, flights: 0, hotels: 0, _d: 0 });

  // Every row where it will sit, as the timeline would order it; the keys lead back to the row.
  const timeline = buildTimeline({
    date: next.date,
    hotels: hotels.map((r, i) => ({ state: "same", item: { ...r.item, srcs: [`hotels:${i}`] } as unknown as HotelGroup })),
    flights: flights.map((r, i) => ({ state: "same", item: { ...r.item, ids: [`flights:${i}`] } as unknown as FlightGroup })),
    acts: acts.map((r, i) => ({ state: "same", item: r.item, ai: i })),
    gaps: [],
    tour: false,
  });
  const keyOf = (e: (typeof timeline)[number]) =>
    e.kind === "activity" ? `acts:${e.row.ai}` : e.kind === "hotel" || e.kind === "transport" ? e.key : null;
  const changed = new Set([
    ...acts.flatMap((r, i) => (r.state === "same" ? [] : [`acts:${i}`])),
    ...flights.flatMap((r, i) => (r.state === "same" ? [] : [`flights:${i}`])),
    ...hotels.flatMap((r, i) => (r.state === "same" ? [] : [`hotels:${i}`])),
  ]);
  const steps = [
    ...(rest(prev) !== rest(next) ? ["header"] : []),
    ...timeline.map(keyOf).filter((k): k is string => !!k && changed.has(k)),
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
    if (k > 0) played.add(steps[k - 1]);
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
