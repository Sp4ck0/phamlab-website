// Format-neutral itinerary built from the sanitized getTripExport data, so the
// print view, Markdown and clipboard HTML all share one layout (hotel
// carry-forward, who-tags, "to be arranged" wording) and can't drift apart.
import { DOW, MON, deriveRoute, flagEmoji, fmtShort } from "./tripLogic";
import type { TripExport, TripExportHotel, Who } from "./types";

export interface ItineraryItem {
  main: string;
  time?: string;
  tag?: string;
  sub?: string;
  lines?: string[];
  who?: string;
  tba?: boolean;
}
export interface ItineraryRow {
  label: "Travel" | "Stay" | "Plan" | "Tour";
  items: ItineraryItem[];
}
export interface ItineraryDay {
  num: number;
  date: string;
  place: string;
  event?: string;
  highlight?: string;
  rows: ItineraryRow[];
}
export interface Itinerary {
  title: string;
  emphasis: string;
  kicker: string;
  dates: string;
  intro?: string;
  route: string[];
  travelers?: string;
  glance: { day: number; date: string; place: string; highlight?: string }[];
  days: ItineraryDay[];
  footer: string;
  // Set when a date range is selected, e.g. "mar3-mar7"; used in filenames.
  fileSuffix?: string;
}

// Tag for a booking that isn't for the whole group; "all" (or any id that
// isn't a traveler) reads as everyone and gets no tag.
function whoTag(who: Who, groups: TripExport["groups"]): string | undefined {
  if (groups.length <= 1) return undefined;
  const names = (Array.isArray(who) ? who : [who])
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(" & ") : undefined;
}

const dateLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
};

export interface DateRange {
  from: string;
  to: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// A usable sub-range of the trip, or undefined for the whole trip (no range,
// malformed/out-of-trip dates, from > to, or a range covering every day).
export function normalizeRange(data: TripExport, range?: Partial<DateRange> | null): DateRange | undefined {
  const first = data.days[0]?.date;
  const last = data.days[data.days.length - 1]?.date;
  if (!range?.from || !range.to || !first || !last) return undefined;
  const { from, to } = range;
  if (!ISO.test(from) || !ISO.test(to) || from > to || from < first || to > last) return undefined;
  return from === first && to === last ? undefined : { from, to };
}

export interface RangeChip {
  label: string;
  range: DateRange;
}

const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

// One chip per run of consecutive days based in the same city, plus "Rest of
// trip" while the trip is underway. Whole-trip runs are skipped.
export function rangeChips(data: TripExport): RangeChip[] {
  const chips: RangeChip[] = [];
  data.days.forEach((d, i) => {
    const prev = data.days[i - 1];
    if (prev && prev.city === d.city) chips[chips.length - 1].range.to = d.date;
    else chips.push({ label: d.city, range: { from: d.date, to: d.date } });
  });
  const counts = new Map<string, number>();
  chips.forEach((c) => counts.set(c.label, (counts.get(c.label) ?? 0) + 1));
  const labelled = chips
    .map((c) => ({ ...c, label: counts.get(c.label)! > 1 ? `${c.label} (${fmtShort(c.range.from)})` : c.label }))
    .filter((c) => normalizeRange(data, c.range));

  const first = data.days[0]?.date;
  const last = data.days[data.days.length - 1]?.date;
  const today = todayIso();
  if (first && last && today > first && today <= last) {
    labelled.push({ label: "Rest of trip", range: { from: today, to: last } });
  }
  return labelled;
}

export function buildItinerary(data: TripExport, rangeArg?: Partial<DateRange> | null): Itinerary {
  const { groups } = data;
  const range = normalizeRange(data, rangeArg);
  const allDays = data.days;
  const inRange = (date: string) => !range || (date >= range.from && date <= range.to);
  const days = allDays.filter((d) => inRange(d.date));
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  let carried: TripExportHotel[] = [];

  // Built over the whole trip so hotel carry-forward and real day numbers
  // survive slicing; the range filter is applied afterwards.
  const itDays = allDays.map((d, i): ItineraryDay => {
    const staying = d.hotels === "same";
    if (!staying) carried = d.hotels as TripExportHotel[];
    const rows: ItineraryRow[] = [];

    const travel = d.flights.map((f): ItineraryItem => {
      const who = whoTag(f.who, groups);
      if (f.tba) return { main: `Flight ${f.route} — to be arranged`, who, tba: true };
      const lines: string[] = [];
      f.legs?.forEach((l, li) => {
        lines.push([l.route, l.time, l.meta].filter(Boolean).join(" · "));
        if (f.layovers?.[li]) lines.push(f.layovers[li]);
      });
      return { main: f.title || f.route, sub: f.detail, lines, who };
    });
    if (travel.length) rows.push({ label: "Travel", items: travel });

    const stay = carried.map((h): ItineraryItem => {
      const who = whoTag(h.who, groups);
      if (h.tba) return { main: "Hotel — to be arranged", who, tba: true };
      return {
        main: staying ? `Staying at ${h.name}` : (h.name ?? ""),
        sub: h.address,
        lines: h.detail ? [h.detail] : undefined,
        who,
      };
    });
    if (stay.length) rows.push({ label: "Stay", items: stay });

    if (d.acts.length) {
      rows.push({ label: "Plan", items: d.acts.map((a) => ({ main: a.text, time: a.time, tag: a.tag })) });
    }
    if (d.tourDetails?.summary) {
      rows.push({ label: "Tour", items: [{ main: d.tourDetails.summary, sub: d.tourDetails.body }] });
    }

    const flag = flagEmoji(d.country)?.emoji;
    const toFlag = flagEmoji(d.toCountry)?.emoji;
    const place = [flag, d.city, d.to ? "→" : "", d.to ? toFlag : "", d.to].filter(Boolean).join(" ");
    return { num: i + 1, date: dateLabel(d.date), place, event: d.event, highlight: d.highlight, rows };
  });

  // Travelers who are on the trip at some point inside the exported span.
  const travelers = groups
    .filter((g) => (!g.from || g.from <= last) && (!g.to || g.to >= first))
    .map((g) =>
      g.from || g.to ? `${g.name} (${fmtShort(g.from ?? first)}–${fmtShort(g.to ?? last)})` : g.name
    )
    .join(", ");

  return {
    title: data.title,
    emphasis: data.titleEmphasis,
    kicker: data.kicker,
    dates: range
      ? `${range.from === range.to ? fmtShort(range.from) : `${fmtShort(range.from)} – ${fmtShort(range.to)}`} · ${days.length} of ${allDays.length} days`
      : `${data.dateRangeLabel} · ${days.length} days`,
    intro: data.sdek,
    route: deriveRoute(
      days.map((d) => ({ city: d.city, to: d.to })),
      []
    ).map((s) => s.label),
    travelers: groups.length > 1 ? travelers : undefined,
    glance: allDays
      .map((d, i) => ({
        day: i + 1,
        iso: d.date,
        date: dateLabel(d.date),
        place: d.to ? `${d.city} → ${d.to}` : d.city,
        highlight: d.highlight,
      }))
      .filter((g) => inRange(g.iso))
      .map(({ day, date, place, highlight }) => ({ day, date, place, highlight })),
    days: itDays.filter((_, i) => inRange(allDays[i].date)),
    footer: `${data.title} ${data.titleEmphasis}`,
    fileSuffix: range
      ? (range.from === range.to ? fmtShort(range.from) : `${fmtShort(range.from)}-${fmtShort(range.to)}`)
          .toLowerCase()
          .replace(/ /g, "")
      : undefined,
  };
}

const escMd = (s: string) => s.replace(/([\\`*_[\]|<>])/g, "\\$1");

export function toMarkdown(it: Itinerary): string {
  const out: string[] = [];
  out.push(`# ${escMd(it.title)} *${escMd(it.emphasis)}*`, "");
  out.push(`_${escMd(it.kicker)}_ · ${escMd(it.dates)}`, "");
  if (it.intro) out.push(escMd(it.intro), "");
  out.push(`**Route:** ${it.route.map(escMd).join(" → ")}`, "");
  if (it.travelers) out.push(`**Travelers:** ${escMd(it.travelers)}`, "");

  out.push("| Day | Date | Place | Highlight |", "|---|---|---|---|");
  for (const g of it.glance) {
    out.push(`| ${g.day} | ${escMd(g.date)} | ${escMd(g.place)} | ${escMd(g.highlight ?? "")} |`);
  }
  out.push("");

  for (const d of it.days) {
    out.push(`## Day ${d.num} · ${d.date} · ${escMd(d.place)}`, "");
    if (d.event) out.push(`**${escMd(d.event)}**`, "");
    if (d.highlight) out.push(`_${escMd(d.highlight)}_`, "");
    for (const row of d.rows) {
      out.push(`**${row.label}**`, "");
      for (const item of row.items) {
        const head = [item.time && `**${escMd(item.time)}**`, item.tag && `\`${item.tag}\``, escMd(item.main)]
          .filter(Boolean)
          .join(" ");
        const sub = item.sub ? ` · ${escMd(item.sub)}` : "";
        const who = item.who ? ` _(${escMd(item.who)})_` : "";
        out.push(`- ${item.tba ? `_${head}_` : head}${sub}${who}`);
        item.lines?.forEach((l) => out.push(`  - ${escMd(l)}`));
      }
      out.push("");
    }
  }
  out.push("---", `_${escMd(it.footer)}_`, "");
  return out.join("\n");
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Plain semantic HTML for the rich clipboard flavor (Notes, Docs, Gmail).
export function toHtml(it: Itinerary): string {
  const h: string[] = [];
  h.push(`<h1>${escHtml(it.title)} <em>${escHtml(it.emphasis)}</em></h1>`);
  h.push(`<p><em>${escHtml(it.kicker)}</em> · ${escHtml(it.dates)}</p>`);
  if (it.intro) h.push(`<p>${escHtml(it.intro)}</p>`);
  h.push(`<p><strong>Route:</strong> ${it.route.map(escHtml).join(" → ")}</p>`);
  if (it.travelers) h.push(`<p><strong>Travelers:</strong> ${escHtml(it.travelers)}</p>`);

  h.push("<table><thead><tr><th>Day</th><th>Date</th><th>Place</th><th>Highlight</th></tr></thead><tbody>");
  for (const g of it.glance) {
    h.push(
      `<tr><td>${g.day}</td><td>${escHtml(g.date)}</td><td>${escHtml(g.place)}</td><td>${escHtml(g.highlight ?? "")}</td></tr>`
    );
  }
  h.push("</tbody></table>");

  for (const d of it.days) {
    h.push(`<h2>Day ${d.num} · ${escHtml(d.date)} · ${escHtml(d.place)}</h2>`);
    if (d.event) h.push(`<p><strong>${escHtml(d.event)}</strong></p>`);
    if (d.highlight) h.push(`<p><em>${escHtml(d.highlight)}</em></p>`);
    for (const row of d.rows) {
      h.push(`<p><strong>${row.label}</strong></p><ul>`);
      for (const item of row.items) {
        const time = item.time ? `<strong>${escHtml(item.time)}</strong> ` : "";
        const tag = item.tag ? `[${escHtml(item.tag)}] ` : "";
        const main = item.tba ? `<em>${escHtml(item.main)}</em>` : escHtml(item.main);
        const sub = item.sub ? ` · ${escHtml(item.sub)}` : "";
        const who = item.who ? ` <em>(${escHtml(item.who)})</em>` : "";
        const lines = item.lines?.length ? `<ul>${item.lines.map((l) => `<li>${escHtml(l)}</li>`).join("")}</ul>` : "";
        h.push(`<li>${time}${tag}${main}${sub}${who}${lines}</li>`);
      }
      h.push("</ul>");
    }
  }
  h.push(`<hr><p><em>${escHtml(it.footer)}</em></p>`);
  return h.join("\n");
}
