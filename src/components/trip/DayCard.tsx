import { Fragment, useEffect, useState } from "react";
import type { Act, ActionItem, Group, LegColor, Place, ResolvedDay, Status, Task, Vote } from "../../lib/types";
import { diffLines, type Change } from "../../lib/changeDiff";
import { focusOnMapKey, googleMapsUrl, inlinePlaces } from "../../lib/mapPoints";
import { DOW, MON, actParts, fmtShort, gapLabel, mergeFlightsByRoute, mergeHotelsByName } from "../../lib/tripLogic";
import type { FlightGroup, HotelGroup } from "../../lib/tripLogic";
import { TransportBody } from "./TransportBody";
import { HotelBody } from "./HotelCard";
import { hotelHeader, isPlaceholderHotel, transportHeader } from "../../lib/tileHeaders";
import { ALL_DAY, TileStatePill, TimelineTile, type TimelineTileProps, type TileState } from "./TimelineTile";
import { StatusToggle } from "./StatusToggle";
import { buildTimeline, timelineSpans, type ActRow, type DayItem, type TimelineEntry } from "../../lib/timeline";
import { serverMessage } from "../../lib/serverError";
import type { TileOpen } from "../../hooks/useTileOpen";
import { countdownText, nextUp } from "../../lib/nextUp";
import { useNow } from "../../lib/useNow";
import { gapMinutes, stayInfo } from "../../lib/stay";
import { TourBox } from "./TourBox";
import { WeatherBadge } from "./WeatherBadge";
import { AddToCalendar } from "./AddToCalendar";
import { MODE_EMOJI, TAG_EMOJI, actUrl, plain, zoneNow } from "../../lib/calendar";
import { NOW_EMOJI, dayZone, nowPosition, untilText, viewerHint, type NowPosition } from "../../lib/nowMarker";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import type { DayWeather } from "../../lib/weather";
import { useParams } from "react-router-dom";
import { PRIORITY_LABELS, voteTally } from "../../lib/tasks";
import type { DayGaps } from "../../lib/tasks";
import { useShowAiFocus } from "../../hooks/useAiFocus";
import { useUntilFound } from "../../hooks/useUntilFound";
import { ShareLinkButton } from "./ShareLinkButton";
import { ActivityEditor } from "./ActivityEditor";
import { tileDomId } from "../../lib/tileId";
import { PencilIcon, ShowOnMap } from "./taskParts";
import { InlineDiff } from "./InlineDiff";

// Show-on-map buttons inside an activity's sentence are plain HTML (see inlinePlaces),
// so one delegated click handler on the activity text finds them.
function focusInlinePlace(e: React.MouseEvent) {
  const key = (e.target as HTMLElement).closest<HTMLElement>("button.map-focus[data-map-key]")?.dataset.mapKey;
  if (key) focusOnMapKey(key);
}

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
}

// "Add to itinerary" on an item tile, with its own busy state and the server's reason when it can't.
function ApproveButton({ onApprove, label }: { onApprove: () => Promise<unknown>; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="tl-approve"
        disabled={busy}
        aria-label={label}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onApprove();
          } catch (e) {
            setError(serverMessage(e, "Couldn't add it — try again."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Adding…" : "Add to itinerary"}
      </button>
      {error && <span className="ai-error" role="alert">{error}</span>}
    </>
  );
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
  // "Now" on the rail, between two tiles (or above/below them). During a timed tile it is drawn inside that tile instead.
  const nowLine = (pos: Exclude<NowPosition, { kind: "during" }>, key: string) => (
    <li className="tl-now" key={key} aria-label="Current time">
      <span className="tl-time">{pos.hhmm}</span>
      <span className="tl-rail" aria-hidden="true"><span className="tl-now-dot" /></span>
      <span className="tl-now-label">
        Now {pos.hhmm}
        {pos.kind === "after" ? " · that's the plan for today"
          : pos.kind === "untimed" ? (actRows.length ? " · today's plans have no times" : " · no activities listed")
          : ` · ${pos.kind === "before" ? "first up" : "next"} ${pos.next.hhmm} (in ${untilText(pos.next.inMin)})`}
        {mine && <span className="now-line-mine"> · {mine} your time</span>}
      </span>
    </li>
  );
  const collapsed = !expanded;
  // A collapsed panel is hidden="until-found": still in the page, so Ctrl+F finds its text,
  // and a match opens the day.
  const panelRef = useUntilFound(expanded, onExpandedChange);
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
      // A chosen hotel's name is its Google Maps link, right in the header; the rest of the header opens the tile.
      const place = { name: g.name, address: g.address, placeId: g.placeId };
      const linked = !isPlaceholderHotel(g);
      return {
        key: entry.key, ghost: state === "gone", defaultOpen: unresolved,
        tile: {
          domId: entry.domKey && tileDomId(rowId, entry.domKey), time: ALL_DAY, icon: "🏨", meta, change: state, warn: unresolved,
          title: linked ? (
            <>
              <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">📍 {title}</a>
              <ShowOnMap place={place} />
            </>
          ) : title,
          label: linked ? title : undefined,
          className: `tl-hotel${unresolved ? " miss" : ""}`, nextUpLine: upText(g.srcs),
          headerEnd: <TileStatePill state={pill} label={pill === "needed" && !g.name ? "Not chosen" : undefined} />,
          control: <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />,
          children: (
            <>
              <HotelBody g={g} status={s} stay={stay} gapAfter={gapAfter} groups={groups} date={d.date} days={days} dayNumber={dayNumber} />
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
      return {
        key: entry.key, ghost: state === "gone", defaultOpen: unresolved,
        tile: {
          domId: entry.domKey && tileDomId(rowId, entry.domKey), time: entry.time, icon, title, meta, change: state, warn: unresolved,
          className: `tl-transport${s === "needed" && !g.tentative ? " miss" : ""}${g.tentative ? " maybe" : ""}`, nextUpLine: upText(g.ids),
          now: !!live, progress: live?.progress,
          headerEnd: (
            <>
              {live?.pill}
              <TileStatePill state={pill} />
            </>
          ),
          control: <StatusToggle ids={g.ids} status={s} onToggle={onToggle} />,
          children: (
            <>
              <TransportBody group={g} groups={groups} day={d} dayNumber={dayNumber} />
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
          meta: "Add activities to this day, or dismiss it in Action Items.",
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
    // A place named in the sentence is linked in place; the rest follow as chips.
    // Sanitize first: inlinePlaces adds its own show-on-map buttons, which the sanitizer would strip.
    const { html, rest } = inlinePlaces(sanitizeHtml(text), places);
    // The sentence, with its places linked, is the header: there is nothing more to open, so the tile is
    // just that row with its actions. It opens only for an editor, or the History of an approved suggestion.
    const hist = history(typeof a === "string" ? undefined : a.fromItem);
    const title = plain(text);
    // An activity that is just a place's name ("Some Cafe"): the pinned Maps link alone says it, not the name twice.
    const bare = rest.find((p) => p.name.trim().toLowerCase() === title.trim().toLowerCase());
    return {
      key: entry.key, ghost: gone, defaultOpen: false, forceOpen: editing,
      tile: {
        domId: entry.domKey && tileDomId(rowId, entry.domKey), time: entry.time, // The tag (Food, Sightsee…) is the icon; its name is the icon's tooltip, not a second line.
        icon: (tag && TAG_EMOJI[tag]) || "📍", iconLabel: tag, change: state, now: !!live,
        label: title,
        expandable: editing || !!hist,
        title: (
          <span className="activity-text" onClick={focusInlinePlace}>
            {bare && !prev ? null : prev ? (
              <InlineDiff prev={sanitizeHtml(actParts(prev).text)} next={sanitizeHtml(text)}>
                <span dangerouslySetInnerHTML={{ __html: html }} />
              </InlineDiff>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: html }} />
            )}
            {rest.map((p, pi) => (
              <span key={pi} style={p === bare && !prev ? undefined : { marginLeft: 8 }}>
                <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer">
                  📍 {p.name}
                </a>
                <ShowOnMap place={p} />
              </span>
            ))}
          </span>
        ),
        headerEnd: (
          <>
            {live?.pill}
            {!gone && (
              <span className="tl-actions-inline">
                {onEditActivity && (
                  <button type="button" className="icon-btn act-edit" aria-label={`Edit activity: ${text}`} onClick={() => setEditingAct(ai)}>
                    <PencilIcon />
                  </button>
                )}
                <ShareLinkButton param={{ day: d.date, tile: `act:${ai}` }} label={`Share link to activity: ${text}`} />
                <AddToCalendar url={actUrl(a, d, dayNumber, ai)} />
              </span>
            )}
          </>
        ),
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
    let headerEnd;
    if (consider) {
      const { mine, yes, no } = voteTally(task!, pendingVotes[id]);
      const pick = (v: Vote) => onVote(id, mine === v ? null : v);
      headerEnd = (
        <span className="vote-bar" role="group" aria-label={`Vote on ${title}`}>
          {/* A settled item keeps its tally but voting is over. */}
          <button type="button" className="vote-btn" data-vote="yes" aria-pressed={mine === "yes"} disabled={!!task!.outcome} onClick={() => pick("yes")}>
            👍 <b>{yes}</b>
          </button>
          <button type="button" className="vote-btn" data-vote="no" aria-pressed={mine === "no"} disabled={!!task!.outcome} onClick={() => pick("no")}>
            👎 <b>{no}</b>
          </button>
        </span>
      );
    }
    const control = consider ? undefined : (
      <input type="checkbox" className="tl-check" checked={done} onChange={() => onToggleActionItem(id)} aria-label={`Done: ${title}`} />
    );
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
        meta: [status, what, range, who ? gapLabel(who, groups, start ?? d.date)?.label : undefined, priority ? `${PRIORITY_LABELS[priority]} priority` : undefined].filter(Boolean).join(" · "),
        className: `tl-item${consider ? " tl-consider" : ""}${done ? " is-done" : ""}`,
        headerEnd,
        control,
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
            <div className="tl-actions">
              {open && onPromote && (proposes || consider) && <ApproveButton label={`Add ${title} to the itinerary`} onApprove={() => onPromote(id, d.date)} />}
              {/* Jumps to this item in the Action Items or Under consideration list. */}
              <button type="button" className="tl-link tl-link-btn" onClick={() => slug && showFocus({ slug, target: { kind: "actionItem", id }, nonce: `${Date.now()}` })}>
                Open in list
              </button>
              <ShareLinkButton param={{ task: `item:${id}` }} label={`Share link to ${title}`} />
            </div>
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

  return (
    <section
      className={`day-card${gapsOnly ? " gaps-only" : ""}${isToday ? " day-card--today" : ""}`}
      id={rowId}
      style={{ ["--leg-color" as string]: legColor.color, ["--leg-tint" as string]: legColor.tint }}
    >
      <h2 className="day-heading">
      <button id={`${rowId}-trigger`} type="button" className="day-head day-head-btn" aria-expanded={expanded} aria-controls={`${rowId}-panel`} onClick={onExpandedChange}>
        <span className="day-title-group">
          <span className="day-num">Day {dayNumber}</span>
          <span className="day-date">
            {DOW[d._d.getDay()]}, {MON[d._d.getMonth()]} {d._d.getDate()}
          </span>
        </span>
        <span className="day-head-right">
          {isToday && <span className="today-badge">Today{clock ? ` · ${clock}` : ""}</span>}
          <WeatherBadge weather={weather} />
          <span className="leg-badge">
            <span className="dot" />
            {legColor.label}
          </span>
          <svg
            className="day-chevron"
            data-collapsed={collapsed ? "true" : undefined}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path d="M3.5 5.25L7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
      {expanded && liveTiles.length > 1 && (
        <button
          type="button"
          className="day-tiles-btn icon-btn"
          title={anyClosed ? "Expand all" : "Collapse all"}
          aria-label={`${anyClosed ? "Expand" : "Collapse"} all tiles on Day ${dayNumber}`}
          onClick={() => tiles.setMany(liveTiles.map((x) => idOf(x.key)), anyClosed)}
        >
          <svg className="day-tiles-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d={anyClosed ? "M3.5 3.5L7 7l3.5-3.5M3.5 7.5L7 11l3.5-3.5" : "M3.5 10.5L7 7l3.5 3.5M3.5 6.5L7 3l3.5 3.5"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <ShareLinkButton param={{ day: d.date }} label={`Share link to Day ${dayNumber}`} />
      </h2>

      <div ref={panelRef} id={`${rowId}-panel`} aria-labelledby={`${rowId}-trigger`}>
        <>
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
    </section>
  );
}
