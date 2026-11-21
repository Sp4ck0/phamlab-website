import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Act, ActionItem, Group, LegColor, Place, ResolvedDay, Status, Task, Vote } from "../../lib/types";
import { diffLines, type Change } from "../../lib/changeDiff";
import { MAPS_PIN_ICON, focusOnMap, googleMapsUrl, placeKey } from "../../lib/mapPoints";
import { COUNTRY, DOW, MON, actParts, fmtShort, gapLabel, mergeFlightsByRoute, mergeHotelsByName } from "../../lib/tripLogic";
import type { FlightGroup, HotelGroup } from "../../lib/tripLogic";
import { TransportBody } from "./TransportBody";
import { HotelBody } from "./HotelCard";
import { hotelHeader, isPlaceholderHotel, segmentsOf, transportHeader } from "../../lib/tileHeaders";
import { copyShareLink } from "../../lib/shareLink";
import { TileMenu, type TileMenuItem } from "./TileMenu";
import { routeSearchUrl } from "../../lib/segments";
import { ALL_DAY, TileStatePill, TimelineTile, type TimelineTileProps, type TileState } from "./TimelineTile";
import { buildTimeline, timelineSpans, type ActRow, type DayItem, type TimelineEntry } from "../../lib/timeline";
import { serverMessage } from "../../lib/serverError";
import type { TileOpen } from "../../hooks/useTileOpen";
import { countdownText, nextUp } from "../../lib/nextUp";
import { useNow } from "../../lib/useNow";
import { gapMinutes, hotelSearchUrl, phoneHref, stayInfo } from "../../lib/stay";
import { TourBox } from "./TourBox";
import { WeatherBlock } from "./WeatherBadge";
import type { CityPhoto, CityPhotoFetcher } from "../../lib/cityPhoto";
import { MODE_EMOJI, TAG_EMOJI, actUrl, hotelUrl, legUrl, plain, segmentUrl, zoneNow } from "../../lib/calendar";
import { NOW_EMOJI, dayZone, nowPosition, untilText, viewerHint, type NowPosition } from "../../lib/nowMarker";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import type { DayWeather } from "../../lib/weather";
import { useParams } from "react-router-dom";
import { PRIORITY_LABELS, voteTally } from "../../lib/tasks";
import type { DayGaps } from "../../lib/tasks";
import { useShowAiFocus } from "../../hooks/useAiFocus";
import { useUntilFound } from "../../hooks/useUntilFound";
import { ActivityEditor } from "./ActivityEditor";
import { tileDomId } from "../../lib/tileId";
import { InlineDiff } from "./InlineDiff";

// What a line is, for telling an edited line from an untouched one (not its
// ids or ticks, which change without the content changing).
const actKey = (a: Act) => JSON.stringify(a);
const flightKey = (g: FlightGroup) => JSON.stringify([g.mode, g.route, g.title, g.price, g.detail, g.legs, g.layovers, g.segments]);
const hotelKey = (g: HotelGroup) => JSON.stringify([g.name, g.address, g.placeId, g.detail, g.checkIn, g.checkOut]);
const unchanged = <T,>(items: T[]): Change<T>[] => items.map((item) => ({ item, state: "same" }));

// An edited line comes out of diffLines as old rows ("gone") then new rows. Pair
// them in order so the new row can show the old wording's words in place
// (InlineDiff) instead of a separate struck-through ghost above it.
function pairRewrites<T>(changes: Change<T>[]): (Change<T> & { prev?: T })[] {
  const out: (Change<T> & { prev?: T })[] = [];
  for (let i = 0; i < changes.length; ) {
    if (changes[i].state !== "gone") { out.push(changes[i++]); continue; }
    let g = i;
    while (g < changes.length && changes[g].state === "gone") g++;
    let n = g;
    while (n < changes.length && changes[n].state === "new") n++;
    const k = Math.min(g - i, n - g);
    out.push(...changes.slice(i, g - k));
    for (let j = 0; j < n - g; j++) out.push(j < k ? { ...changes[g + j], prev: changes[g - k + j].item } : changes[g + j]);
    i = n;
  }
  return out;
}

interface Props {
  day: ResolvedDay;
  // How this day looked before an AI edit, to show what changed (see useRecentChanges).
  changedFrom?: ResolvedDay;
  // Whole resolved trip, to find a hotel's check-out date for its calendar link.
  days?: ResolvedDay[];
  dayNumber: number;
  legColor: LegColor;
  weather?: DayWeather;
  groups: Group[];
  ticks: Record<string, Status>;
  rowId: string;
  isToday?: boolean;
  expanded: boolean;
  // Only gaps: show just what is still open, each with the reason it is listed.
  gapsOnly?: boolean;
  gaps?: DayGaps;
  onExpandedChange: () => void;
  // Which timeline tiles are open (the reader's choices, a link's reveal), kept above the days.
  tiles: TileOpen;
  onToggle: (ids: string[], status: Status) => void;
  dayActionItems: ActionItem[];
  // Considerations that cover this day (day / range scope; open or chosen), shown
  // as a dashed strip so they read as candidates, not plans.
  dayConsiderations: Task[];
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
  // Saves new text and places for the activity at `index`; `expected` is the text it had
  // when the editor opened. The pencil only shows when this is passed.
  onEditActivity?: (date: string, index: number, expected: string, text: string, places: Place[]) => Promise<unknown>;
  // Every stored item by id (its wording, votes and outcome), for the History of an entry approved from one.
  itemTasks?: Record<string, Task>;
  // "Add to itinerary": approves an item into the days (convex actionItems.promoteActionItem).
  onPromote?: (id: string, date: string) => Promise<unknown>;
  // A photo of the day's city for its header; without it the header shows the leg's colour.
  cityPhoto?: CityPhotoFetcher;
}

export function DayCard({
  day: d,
  changedFrom: old,
  days,
  dayNumber,
  legColor,
  weather,
  groups,
  ticks,
  rowId,
  isToday = false,
  expanded,
  gapsOnly = false,
  gaps,
  onExpandedChange,
  tiles,
  onToggle,
  dayActionItems,
  dayConsiderations,
  pendingVotes,
  onVote,
  actionItemsDone,
  onToggleActionItem,
  onEditActivity,
  itemTasks,
  onPromote,
  cityPhoto,
}: Props) {
  const [editingAct, setEditingAct] = useState<number | null>(null);
  const { slug } = useParams<{ slug: string }>();
  const showFocus = useShowAiFocus();
  // While the trip is under way, the next departure or check-in says how long is left.
  const now = useNow();
  const up = days ? nextUp(days, now) : null;
  const upText = (ids: string[]) => (up && ids.includes(up.id) ? countdownText(up, now) : undefined);
  const zone = dayZone(d);
  const mine = isToday ? viewerHint(now, zone) : null;
  const clock = isToday && zone ? zoneNow(now, zone).hhmm : null;
  // "Now" as a red line between two rows (or above/below them). During a timed row it is drawn inside that row instead.
  const nowLine = (pos: Exclude<NowPosition, { kind: "during" }>, key: string) => (
    <li className="tl-now" key={key} aria-label="Current time">
      <span className="tl-now-label">
        Now {pos.hhmm}
        {pos.kind === "after" ? " · that's the plan for today"
          : pos.kind === "untimed" ? (actRows.length ? " · today's plans have no times" : " · no activities listed")
          : ` · ${pos.kind === "before" ? "first up" : "next"} ${pos.next.hhmm} (in ${untilText(pos.next.inMin)})`}
        {mine && <span className="now-line-mine"> · {mine} your time</span>}
      </span>
    </li>
  );
  // The city's photo, asked for once the day's header scrolls into view (each city once per page).
  const headRef = useRef<HTMLHeadingElement>(null);
  const [photo, setPhoto] = useState<CityPhoto | null>(null);
  useEffect(() => {
    const el = headRef.current;
    if (!el || !cityPhoto || typeof IntersectionObserver === "undefined") return;
    let live = true;
    const seen = new IntersectionObserver((hits) => {
      if (!hits.some((h) => h.isIntersecting)) return;
      seen.disconnect();
      void cityPhoto(d.city, d.country).then((p) => live && setPhoto(p));
    }, { rootMargin: "300px 0px" });
    seen.observe(el);
    return () => { live = false; seen.disconnect(); };
  }, [cityPhoto, d.city, d.country]);
  // A collapsed panel is hidden="until-found": still in the page, so Ctrl+F finds its text,
  // and a match opens the day.
  const panelRef = useUntilFound(expanded, onExpandedChange);
  // Safari skips laying out a closed day's contents, and when the day opens it keeps the closed
  // tiles inside at their full height (a blank gap under each) until something touches them.
  // Re-applying their closed state as the day opens makes it measure them again.
  useLayoutEffect(() => {
    if (!expanded) return;
    panelRef.current?.querySelectorAll<HTMLElement>(".tl-body[hidden]").forEach((body) => {
      const value = body.getAttribute("hidden") ?? "until-found";
      body.removeAttribute("hidden");
      void body.offsetHeight;
      body.setAttribute("hidden", value);
    });
  }, [expanded, panelRef]);
  // The body stays mounted while collapsed; don't reopen it mid-edit.
  useEffect(() => {
    if (!expanded) setEditingAct(null);
  }, [expanded]);
  const flightGroups = mergeFlightsByRoute(d.flights, d.date, ticks);
  const hotelGroups = mergeHotelsByName(d.hotels, ticks);
  // After an AI edit each list is merged with how it was before: what changed is
  // marked new, and what was removed (or reworded) stays as a ghost for a moment.
  const flightChanges = old ? diffLines(mergeFlightsByRoute(old.flights, old.date, ticks), flightGroups, flightKey) : unchanged(flightGroups);
  const hotelChanges = old ? diffLines(mergeHotelsByName(old.hotels, ticks), hotelGroups, hotelKey) : unchanged(hotelGroups);
  // Under Only gaps, booked hotels and transport still show as context for planning; only open ones are labelled.
  const transportGaps = gapsOnly ? gaps?.transport ?? [] : [];
  // A booked transport tile that still lacks a required field has an open `details` task
  // (until it is dismissed). A merged tile matches any of its rows.
  const missingDetails = (g: FlightGroup) => (gaps?.details ?? []).some((t) => g.ids.some((id) => t.key === `details:${id}`));
  // Under Only gaps, a to-do or consideration that is done or settled is not a gap.
  const shownConsiderations = gapsOnly ? dayConsiderations.filter((t) => !t.done) : dayConsiderations;
  const shownActionItems = gapsOnly ? dayActionItems.filter((item) => !actionItemsDone[item.id]) : dayActionItems;
  // To-dos and considerations that cover this day are tiles too; a time only counts on the item's own first day.
  const dayItems: DayItem[] = [
    ...shownConsiderations.map((t) => ({ id: t.key.slice("item:".length), task: t, time: (t.scope.kind === "day" ? t.scope.date : t.scope.kind === "range" ? t.scope.start : undefined) === d.date ? t.time : undefined })),
    ...shownActionItems.map((i) => ({ id: i.id, todo: i, time: i.date === d.date ? i.time : undefined })),
  ];
  // Items already written into the itinerary (an entry links back to them).
  const linkedIds = new Set(
    (days ?? [d]).flatMap((day) => [
      ...day.flights.map((f) => f.fromItem),
      ...day.hotels.map((h) => h.fromItem),
      ...day.acts.map((a) => (typeof a === "string" ? undefined : a.fromItem)),
    ]).filter((x): x is string => !!x)
  );
  // An entry approved from an item: what was weighed and how the votes went, folded away at the end of the tile.
  const history = (fromItem?: string) => {
    const t = fromItem ? itemTasks?.[fromItem] : undefined;
    if (!fromItem || !t) return null;
    const { yes, no } = voteTally(t, pendingVotes[fromItem]);
    return (
      <details className="tl-history">
        <summary>History</summary>
        <div className="tl-history-body">
          <div className="cmeta"><b>{t.kind === "consider" ? "Considered as" : "From the to-do"}:</b> {plain(sanitizeHtml(t.title))}</div>
          {t.detail && <div className="cmeta" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.detail) }} />}
          {t.kind === "consider" && (
            <div className="cmeta">
              👍 {yes}{t.votes?.yes.length ? ` (${t.votes.yes.join(", ")})` : ""} · 👎 {no}{t.votes?.no.length ? ` (${t.votes.no.join(", ")})` : ""}
              {t.outcome === "chosen" ? " · Chosen" : ""}
            </div>
          )}
        </div>
      </details>
    );
  };
  const actChanges = old ? diffLines(old.acts ?? [], d.acts ?? [], actKey) : unchanged(d.acts ?? []);
  // Edit buttons, share links and ids use an activity's real index; a ghost has none.
  let actIndex = 0;
  const actRows: ActRow[] = pairRewrites(actChanges).map((c) => ({ ...c, ai: c.state === "gone" ? -1 : actIndex++ }));
  const summaryChanged = !!old && (old.highlight || old.note) !== (d.highlight || d.note);

  // The day as one ordered list of tiles (lib/timeline.ts). Under Only gaps the activities and the tour are left out.
  const entries = buildTimeline({
    date: d.date, hotels: hotelChanges, flights: flightChanges, acts: gapsOnly ? [] : actRows, gaps: transportGaps, tour: !gapsOnly && !!d.tourDetails, items: dayItems,
    // Nothing planned: the day's open plan task, in every view (the same rule as Action Items and
    // Only gaps), so dismissing it there hides the tile here too.
    plan: !!gaps?.plan,
  });
  // Where the current time falls among the timed tiles (activities and timed transport).
  const nowPos = isToday ? nowPosition(d, now, timelineSpans(entries, d)) : null;
  // The tile under way right now: a "Now" pill and a progress line along its header.
  const nowBits = (key: string) =>
    nowPos?.kind === "during" && nowPos.key === key
      ? {
          pill: <span className="now-pill">Now</span>,
          progress: (
            <span className="now-progress" aria-hidden="true" style={{ ["--p" as string]: `${Math.round(nowPos.progress * 100)}%` }}><span className="now-progress-emoji">{NOW_EMOJI}</span></span>
          ),
        }
      : null;
  // The first activity a "now" line with no timed activity to sit beside goes above.
  const firstActKey = entries.find((e) => e.kind === "activity" && e.row.ai >= 0)?.key;

  // How one tile reads: its header, whether it starts open (unresolved ones do: not booked, missing
  // details, nothing entered), and what it shows when open. A removed ghost has no element id.
  type Described = { key: string; ghost: boolean; defaultOpen: boolean; forceOpen?: boolean; tile: Omit<TimelineTileProps, "open" | "onToggle" | "onReveal"> };
  // The pieces of a card's "⋯" menu, which holds every action the card has.
  const copyItem = (param: Record<string, string>): TileMenuItem => ({ label: "Copy link", icon: "link", onSelect: () => copyShareLink(slug, param) });
  const calendarItem = (url: string | null, label = "Add to Google Calendar"): TileMenuItem[] => (url ? [{ label, icon: "calendar", href: url }] : []);
  const onMapItems = (places: Place[]): TileMenuItem[] =>
    places.flatMap((p) => (placeKey(p) ? [{ label: places.length > 1 ? `Show ${p.name} on the trip map` : "Show on the trip map", icon: "map" as const, onSelect: () => focusOnMap(p) }] : []));
  // Opens a place in Google Maps (what the row's pin button did).
  const mapsItem = (p: Place | undefined, label = "Open in Google Maps"): TileMenuItem[] => (p?.name ? [{ label, icon: "pin", href: googleMapsUrl(p) }] : []);
  // The booked toggle (the check that used to sit on the row).
  const bookedItem = (ids: string[], s: Status): TileMenuItem => ({
    label: s === "booked" ? "Mark as not booked" : "Mark as booked",
    icon: s === "booked" ? "uncheck" : "check",
    onSelect: () => onToggle(ids, s),
  });
  // Each hop's "Add to Google Calendar" (the buttons that used to sit on the hop rows).
  const transportCalendarItems = (g: FlightGroup): TileMenuItem[] => {
    const { legs, segments } = segmentsOf(g);
    const name = (from?: string, to?: string) => (segments.length + legs.length > 1 && from && to ? `Add ${from} → ${to} to Google Calendar` : "Add to Google Calendar");
    return [
      ...segments.flatMap((seg, i) => calendarItem(segmentUrl(seg, g.mode, d, dayNumber, { first: i === 0, last: i === segments.length - 1 }), name(seg.from, seg.to))),
      ...legs.flatMap((leg, i) => calendarItem(legUrl(leg, i, legs.length, g.mode, d, dayNumber, g.detail), legs.length > 1 ? `Add ${leg.route} to Google Calendar` : "Add to Google Calendar")),
    ];
  };
  const describe = (entry: Exclude<TimelineEntry, { kind: "tour" }>): Described => {
    if (entry.kind === "hotel") {
      const { item: g, state } = entry.change;
      const s: Status = g.statuses.includes("needed") ? "needed" : "booked";
      const stay = days ? stayInfo(days, dayNumber, g.name) : null;
      // Moving hotels today: how long between leaving the other one and getting into this one.
      const leaving = g.checkIn ? hotelGroups.find((o) => o !== g && o.checkOut && !o.checkIn && o.name !== g.name) : undefined;
      const wait = leaving ? gapMinutes(leaving.checkOutTime, g.checkInTime) : null;
      const gapAfter = leaving && wait !== null ? { name: leaving.name, minutes: wait, checkOutTime: leaving.checkOutTime } : undefined;
      const unresolved = s === "needed" && !g.tentative;
      const pill: TileState = g.tentative ? "maybe" : s;
      const { title, meta } = hotelHeader(g, stay);
      // A chosen hotel opens in Google Maps from the pin on its row; a placeholder has no place yet.
      const place = { name: g.name, address: g.address, placeId: g.placeId };
      const chosen = !isPlaceholderHotel(g);
      return {
        key: entry.key, ghost: state === "gone", defaultOpen: unresolved,
        tile: {
          domId: entry.domKey && tileDomId(rowId, entry.domKey), time: ALL_DAY, icon: "🏨", meta, change: state, warn: unresolved,
          title,
          menu: [
            bookedItem(g.srcs, s),
            ...(chosen ? mapsItem(place) : []),
            copyItem({ day: d.date, tile: g.srcs[0] }),
            ...(g.phone ? [{ label: `Call ${g.phone}`, icon: "phone" as const, href: phoneHref(g.phone), sameTab: true }] : []),
            ...calendarItem(days ? hotelUrl(g.name, g.address, days, dayNumber) : null),
            ...(chosen ? onMapItems([place]) : []),
            ...(s === "needed" && !g.tentative && !chosen && g.area
              ? [{ label: "Search hotels here", icon: "search" as const, href: hotelSearchUrl(g.area, stay?.checkIn, stay?.checkOut) }]
              : []),
          ],
          className: `tl-hotel${unresolved ? " miss" : ""}`, nextUpLine: upText(g.srcs),
          headerEnd: <TileStatePill state={pill} label={pill === "needed" && !g.name ? "Not chosen" : undefined} />,
          children: (
            <>
              <HotelBody g={g} status={s} stay={stay} gapAfter={gapAfter} groups={groups} date={d.date} days={days} dayNumber={dayNumber} actions={false} />
              {history(g.fromItem)}
            </>
          ),
        },
      };
    }
    if (entry.kind === "transport") {
      const { item: g, state } = entry.change;
      const s: Status = g.statuses.includes("needed") ? "needed" : "booked";
      const detailsMissing = !g.tentative && missingDetails(g);
      const unresolved = !g.tentative && (s === "needed" || detailsMissing);
      const pill: TileState = g.tentative ? "maybe" : s === "needed" ? "needed" : detailsMissing ? "details" : "booked";
      const { icon, title, meta } = transportHeader(g);
      const live = nowBits(entry.key);
      const first = segmentsOf(g).segments[0];
      const ticket = g.ticketUrl?.startsWith("https://") ? g.ticketUrl : undefined;
      const ground = !!g.mode && g.mode !== "flight";
      const search = ground && s === "needed" && !g.tentative && first?.from && first.to ? routeSearchUrl(first.from, first.to) : undefined;
      return {
        key: entry.key, ghost: state === "gone", defaultOpen: unresolved,
        tile: {
          domId: entry.domKey && tileDomId(rowId, entry.domKey), time: entry.time, icon, title, meta, change: state, warn: unresolved,
          className: `tl-transport${s === "needed" && !g.tentative ? " miss" : ""}${g.tentative ? " maybe" : ""}`, nextUpLine: upText(g.ids),
          now: !!live, progress: live?.progress,
          menu: [
            bookedItem(g.ids, s),
            copyItem({ day: d.date, tile: g.ids[0] }),
            ...(ticket ? [{ label: "Ticket", icon: "ticket" as const, href: ticket }] : []),
            ...(search ? [{ label: "Search this route", icon: "search" as const, href: search }] : []),
            ...transportCalendarItems(g),
          ],
          headerEnd: (
            <>
              {live?.pill}
              <TileStatePill state={pill} />
            </>
          ),
          children: (
            <>
              <TransportBody group={g} groups={groups} day={d} dayNumber={dayNumber} actions={false} />
              {history(g.fromItem)}
            </>
          ),
        },
      };
    }
    if (entry.kind === "item") return describeItem(entry);
    if (entry.kind === "plan") {
      // A row like any other on the rail, so an empty day reads as a gap in the plan, not a stray note.
      return {
        key: entry.key, ghost: false, defaultOpen: false,
        tile: {
          icon: "🗓️", title: "Nothing planned yet", expandable: false, warn: true, className: "tl-gap tl-plan miss",
          headerEnd: <TileStatePill state="needed" label="Not planned" />,
          children: null,
        },
      };
    }
    if (entry.kind === "gap") {
      return {
        key: entry.key, ghost: false, defaultOpen: true,
        tile: {
          icon: "↔️", title: entry.task.title, warn: true, className: "tl-gap miss", headerEnd: <TileStatePill state="needed" label="None entered" />,
          children: <div className="cmeta">Add it to the itinerary, or dismiss it in Action Items.</div>,
        },
      };
    }
    const { item: a, state, ai, prev } = entry.row;
    const { tag, text, places } = actParts(a);
    const gone = state === "gone";
    const editing = !gone && editingAct === ai && !!onEditActivity;
    const live = nowBits(entry.key);
    // The sentence is the row's title; its places open from the menu.
    // There is nothing more to open, so the row has no chevron: it opens only for the editor, or
    // for the History of an approved suggestion.
    const hist = history(typeof a === "string" ? undefined : a.fromItem);
    const title = plain(text);
    const named = (places ?? []).filter((p) => p.name);
    return {
      key: entry.key, ghost: gone, defaultOpen: false, forceOpen: editing,
      tile: {
        domId: entry.domKey && tileDomId(rowId, entry.domKey), time: entry.time,
        // The tag (Food, Sightsee…) is the icon; its name is the icon's tooltip, not a second line.
        icon: (tag && TAG_EMOJI[tag]) || "📍", iconLabel: tag, change: state, now: !!live,
        label: title,
        expandable: editing || !!hist,
        title: prev ? <InlineDiff prev={sanitizeHtml(actParts(prev).text)} next={sanitizeHtml(text)}>{title}</InlineDiff> : title,
        menu: [
          ...(onEditActivity ? [{ label: "Edit", icon: "edit" as const, onSelect: () => setEditingAct(ai) }] : []),
          ...mapsItem(named[0], named.length > 1 ? `Open ${named[0]?.name} in Google Maps` : undefined),
          copyItem({ day: d.date, tile: `act:${ai}` }),
          ...calendarItem(actUrl(a, d, dayNumber, ai)),
          ...named.slice(1).flatMap((p) => mapsItem(p, `Open ${p.name} in Google Maps`)),
          ...onMapItems(named),
        ],
        headerEnd: live?.pill,
        progress: live?.progress,
        children: editing ? (
          <ActivityEditor
            initial={text}
            initialPlaces={places}
            onCancel={() => setEditingAct(null)}
            onSave={async (next, nextPlaces) => {
              await onEditActivity(d.date, ai, text, next, nextPlaces);
              setEditingAct(null);
            }}
          />
        ) : hist,
      },
    };
  };
  // A to-do or consideration on the timeline. A consideration votes in its header, a to-do
  // ticks off there. One that proposes a hotel, transport or activity shows that entry as a
  // "Proposed" card, drawn like the real tile, and "Add to itinerary" writes it into the days.
  function describeItem(entry: Extract<TimelineEntry, { kind: "item" }>): Described {
    const { id, task, todo } = entry.item;
    const consider = !!task;
    // The header has the title as plain text (it sits in a button); a title with links shows them again in the body.
    const richTitle = sanitizeHtml(task?.title ?? todo?.title ?? "");
    const titleHasLinks = /<a\b/i.test(richTitle);
    const title = plain(richTitle);
    const detail = task?.detail ?? todo?.detail;
    const proposes = task?.proposes ?? todo?.proposes;
    const done = consider ? !!task!.done : !!actionItemsDone[id];
    const linked = linkedIds.has(id);
    const open = !done && !linked;
    const start = task ? (task.scope.kind === "day" ? task.scope.date : task.scope.kind === "range" ? task.scope.start : undefined) : todo?.date;
    const end = task ? (task.scope.kind === "range" ? task.scope.end : start) : todo?.endDate ?? todo?.date;
    const icon = !proposes ? (consider ? "🗳️" : "☑️")
      : proposes.type === "hotel" ? "🏨"
      : proposes.type === "transport" ? MODE_EMOJI[proposes.entry.mode || "flight"]
      : (proposes.entry.tag && TAG_EMOJI[proposes.entry.tag]) || "📍";
    const status = consider ? (task!.outcome === "chosen" ? "Chosen" : task!.outcome === "dropped" ? "Dropped" : "Considering") : done ? "Done" : "To-do";
    const what = !proposes ? undefined
      : proposes.type === "hotel" ? `Proposed stay · ${proposes.entry.name}`
      : proposes.type === "transport" ? `Proposed ${proposes.entry.mode || "flight"} · ${proposes.entry.route}`
      : "Proposed activity";
    const range = start && end && end !== start ? `${fmtShort(start)} – ${fmtShort(end)}` : undefined;
    const who = task?.who ?? todo?.who;
    const priority = task?.priority ?? todo?.priority;
    // A consideration's header shows the tally; voting is in its menu. A settled item keeps its
    // tally but voting is over.
    let headerEnd;
    const voteItems: TileMenuItem[] = [];
    if (consider) {
      const { mine, yes, no } = voteTally(task!, pendingVotes[id]);
      const pick = (v: Vote) => onVote(id, mine === v ? null : v);
      headerEnd = (
        <span className="vote-tally" role="img" aria-label={`${yes} yes, ${no} no${mine ? `, you voted ${mine}` : ""}`}>
          <span data-mine={mine === "yes" || undefined}>👍 <b>{yes}</b></span>
          <span data-mine={mine === "no" || undefined}>👎 <b>{no}</b></span>
        </span>
      );
      voteItems.push(
        { label: mine === "yes" ? "Take back my yes vote" : "Vote yes", icon: "yes", disabled: !!task!.outcome, onSelect: () => pick("yes") },
        { label: mine === "no" ? "Take back my no vote" : "Vote no", icon: "no", disabled: !!task!.outcome, onSelect: () => pick("no") },
      );
    }
    const doneItem: TileMenuItem[] = consider ? [] : [{ label: done ? "Mark as not done" : "Mark as done", icon: done ? "uncheck" : "check", onSelect: () => onToggleActionItem(id) }];
    const approveItem: TileMenuItem[] =
      open && onPromote && (proposes || consider)
        ? [{
            label: "Add to itinerary",
            icon: "add",
            onSelect: async () => {
              try {
                await onPromote(id, d.date);
                return "Added to the itinerary";
              } catch (e) {
                return serverMessage(e, "Couldn't add it — try again.");
              }
            },
          }]
        : [];
    // A proposed hotel's or transport's own links (its Maps page, each hop's calendar).
    const draftItems: TileMenuItem[] = !proposes
      ? []
      : proposes.type === "hotel"
        ? (() => {
            const place = { name: proposes.entry.name, address: proposes.entry.address, placeId: proposes.entry.placeId };
            return isPlaceholderHotel(proposes.entry) ? [] : [...mapsItem(place, `Open ${place.name} in Google Maps`), ...onMapItems([place])];
          })()
        : proposes.type === "transport"
          ? transportCalendarItems({ ...proposes.entry, who: [proposes.entry.who].flat(), ids: [`item:${id}`], statuses: [proposes.entry.status] })
          : [];
    const draftBody = (() => {
      if (!proposes) return null;
      if (proposes.type === "hotel") {
        const h = proposes.entry;
        const g = { ...h, who: [h.who].flat(), srcs: [`item:${id}`], statuses: [h.status], carriedAll: false, checkIn: d.date === start, checkOut: d.date === end };
        return <HotelBody g={g} status={h.status} stay={null} groups={groups} date={d.date} dayNumber={dayNumber} actions={false} showName />;
      }
      if (proposes.type === "transport") {
        const f = proposes.entry;
        const g = { ...f, who: [f.who].flat(), ids: [`item:${id}`], statuses: [f.status] };
        return <TransportBody group={g} groups={groups} day={d} dayNumber={dayNumber} actions={false} />;
      }
      const a = proposes.entry;
      return (
        <div className="activity-text">
          {a.time && <b>{a.time} </b>}
          <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.text) }} />
        </div>
      );
    })();
    return {
      key: entry.key, ghost: false, defaultOpen: open,
      tile: {
        domId: tileDomId(rowId, entry.domKey), time: entry.time, icon, title, warn: open,
        menu: [
          ...doneItem,
          ...voteItems,
          ...approveItem,
          ...mapsItem((task?.places ?? todo?.places ?? [])[0]),
          // Jumps to this item in the Action Items or Under consideration list.
          { label: "Open in list", icon: "list", onSelect: () => { if (slug) showFocus({ slug, target: { kind: "actionItem", id }, nonce: `${Date.now()}` }); } },
          copyItem({ task: `item:${id}` }),
          ...draftItems,
        ],
        meta: [status, what, range, who ? gapLabel(who, groups, start ?? d.date)?.label : undefined, priority ? `${PRIORITY_LABELS[priority]} priority` : undefined].filter(Boolean).join(" · "),
        className: `tl-item${consider ? " tl-consider" : ""}${done ? " is-done" : ""}`,
        headerEnd,
        children: (
          <>
            {(titleHasLinks || detail) && (
              <div className="action-text">
                {titleHasLinks && <div dangerouslySetInnerHTML={{ __html: richTitle }} />}
                {detail && <div className="cmeta" dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail) }} />}
              </div>
            )}
            {draftBody && (
              <div className="tl-proposal">
                <span className="tl-proposal-label">Proposed</span>
                {draftBody}
              </div>
            )}
            {linked && <p className="cmeta tl-linked">In the itinerary.</p>}
          </>
        ),
      },
    };
  }
  const described = entries.map((e) => (e.kind === "tour" ? null : describe(e)));
  // Open state is kept per trip, so an id carries the day's date.
  const idOf = (key: string) => `${d.date}#${key}`;
  const isOpenTile = (x: Described) => !!x.forceOpen || tiles.isOpen(idOf(x.key), x.defaultOpen);
  const liveTiles = described.filter((x): x is Described => !!x && !x.ghost && x.tile.expandable !== false);
  const anyClosed = liveTiles.some((x) => !isOpenTile(x));
  // What the day's schedule holds: every row but removed ghosts and the "nothing planned" placeholder.
  const scheduleCount = described.filter((x) => !!x && !x.ghost && x.key !== "plan").length + (entries.some((e) => e.kind === "tour") ? 1 : 0);

  return (
    <section
      className={`day-card${gapsOnly ? " gaps-only" : ""}${isToday ? " day-card--today" : ""}`}
      id={rowId}
      style={{ ["--leg-color" as string]: legColor.color, ["--leg-tint" as string]: legColor.tint }}
    >
      <h2 className="day-heading" ref={headRef}>
      {/* The city's photo, fading into the card; the leg's colour until it loads (or when there is none). */}
      <span className={`day-photo${photo ? " has-photo" : ""}`} style={photo ? { backgroundImage: `url("${photo.url.replace(/"/g, "%22")}")` } : undefined} />
      <button id={`${rowId}-trigger`} type="button" className="day-head day-head-btn" aria-expanded={expanded} aria-controls={`${rowId}-panel`} onClick={onExpandedChange}>
        <span className="day-title-group">
          <span className="day-num">
            Day {dayNumber}{days && days.length > 1 ? ` of ${days.length - 1}` : ""}
            {COUNTRY[d.country] ? ` · ${COUNTRY[d.country]}` : ""}
          </span>
          <span className="day-date">
            {DOW[d._d.getDay()]}, {MON[d._d.getMonth()]} {d._d.getDate()}
          </span>
          <span className="day-place">
            <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: MAPS_PIN_ICON }} />
            {d.city}{d.to ? ` → ${d.to}` : ""}
          </span>
        </span>
        <span className="day-head-right">
          {isToday && <span className="today-badge">Today{clock ? ` · ${clock}` : ""}</span>}
          <WeatherBlock weather={weather} />
        </span>
        {(d.highlight || d.note) && (
          summaryChanged && old && (old.highlight || old.note) ? (
            <span className="day-summary">
              <InlineDiff prev={old.highlight || old.note || ""} next={d.highlight || d.note || ""}>{d.highlight || d.note}</InlineDiff>
            </span>
          ) : (
            <span className={`day-summary${summaryChanged ? " chg-new" : ""}`}>{d.highlight || d.note}</span>
          )
        )}
      </button>
      <span className="day-tools">
      {/* The day's one ⋯ menu: open or close all its cards, its link, and the photographer's credit (Google asks for it). */}
      <TileMenu
        label={`More for Day ${dayNumber}`}
        items={[
          ...(expanded && liveTiles.length > 1
            ? [{ label: anyClosed ? "Expand all" : "Collapse all", icon: anyClosed ? ("expand" as const) : ("collapse" as const), onSelect: () => tiles.setMany(liveTiles.map((x) => idOf(x.key)), anyClosed) }]
            : []),
          copyItem({ day: d.date }),
          ...(photo?.credit
            ? [photo.credit.uri ? { label: `Photo by ${photo.credit.name}`, icon: "photo" as const, href: photo.credit.uri } : { label: `Photo by ${photo.credit.name}`, icon: "photo" as const, onSelect: () => {} }]
            : []),
        ]}
      />
      </span>
      </h2>

      <div ref={panelRef} id={`${rowId}-panel`} aria-labelledby={`${rowId}-trigger`}>
        <>
          {entries.length > 0 && (
            <div className="tl-heading-row">
              <h3>Schedule</h3>
              <span className="tl-count">{scheduleCount} {scheduleCount === 1 ? "item" : "items"}</span>
            </div>
          )}
          {(entries.length > 0 || (!gapsOnly && actRows.length === 0 && nowPos?.kind === "untimed")) && (
            <ol className="tl">
              {entries.map((e, i) => {
                if (e.kind === "tour") {
                  return (
                    <li key="tour" className="tl-entry tl-entry--plain">
                      <div className="tl-plain"><TourBox tourDetails={d.tourDetails!} /></div>
                    </li>
                  );
                }
                const x = described[i]!;
                const id = idOf(x.key);
                // A line at the current time sits between tiles; during a timed tile it is drawn inside that tile instead.
                const lineBefore = nowPos &&
                  ((nowPos.kind === "before" || nowPos.kind === "between") ? nowPos.beforeKey === e.key : nowPos.kind === "untimed" && e.key === firstActKey);
                const lineAfter = nowPos?.kind === "after" && nowPos.afterKey === e.key;
                return (
                  <Fragment key={e.key}>
                    {lineBefore && nowPos && nowPos.kind !== "during" && nowLine(nowPos, "now")}
                    <TimelineTile {...x.tile} open={isOpenTile(x)} onToggle={() => tiles.toggle(id, x.defaultOpen)} onReveal={() => tiles.reveal(id)} />
                    {lineAfter && nowLine(nowPos, "now")}
                  </Fragment>
                );
              })}
              {!gapsOnly && actRows.length === 0 && nowPos?.kind === "untimed" && nowLine(nowPos, "now")}
            </ol>
          )}



          {!gapsOnly && d.callout && (
            <div className={`note${old && !old.callout && old.callout !== d.callout ? " chg-new" : ""}`}>
              {old?.callout && old.callout !== d.callout ? (
                <InlineDiff prev={sanitizeHtml(old.callout)} next={sanitizeHtml(d.callout)}>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.callout) }} />
                </InlineDiff>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.callout) }} />
              )}
            </div>
          )}

        </>
      </div>
      {/* The day's chevron, in its bottom border: down closed, up open. A tap on it opens or closes the
          day like its header (the header is the keyboard and screen-reader control). */}
      <span className="day-notch" data-open={expanded || undefined} aria-hidden="true" onClick={onExpandedChange}>
        <svg className="day-chev" width="16" height="16" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 5.25L7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </section>
  );
}
