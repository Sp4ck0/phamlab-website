import { Fragment, useEffect, useState } from "react";
import type { Act, ActionItem, Group, LegColor, Place, ResolvedDay, Status, Task, Vote } from "../../lib/types";
import { diffLines, type Change } from "../../lib/changeDiff";
import { focusOnMapKey, googleMapsUrl, inlinePlaces } from "../../lib/mapPoints";
import { DOW, MON, actParts, fmtShort, gapLabel, mergeFlightsByRoute, mergeHotelsByName } from "../../lib/tripLogic";
import type { FlightGroup, HotelGroup } from "../../lib/tripLogic";
import { TransportBody } from "./TransportBody";
import { HotelBody } from "./HotelCard";
import { hotelHeader, transportHeader } from "../../lib/tileHeaders";
import { ALL_DAY, TileStatePill, TimelineTile, type TimelineTileProps, type TileState } from "./TimelineTile";
import { StatusToggle } from "./StatusToggle";
import { buildTimeline, timelineSpans, type ActRow, type TimelineEntry } from "../../lib/timeline";
import type { TileOpen } from "../../hooks/useTileOpen";
import { countdownText, nextUp } from "../../lib/nextUp";
import { useNow } from "../../lib/useNow";
import { gapMinutes, stayInfo } from "../../lib/stay";
import { TaskRow } from "./TaskRow";
import { TourBox } from "./TourBox";
import { WeatherBadge } from "./WeatherBadge";
import { AddToCalendar } from "./AddToCalendar";
import { TAG_EMOJI, actUrl, plain, zoneNow } from "../../lib/calendar";
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
  const actChanges = old ? diffLines(old.acts ?? [], d.acts ?? [], actKey) : unchanged(d.acts ?? []);
  // Edit buttons, share links and ids use an activity's real index; a ghost has none.
  let actIndex = 0;
  const actRows: ActRow[] = pairRewrites(actChanges).map((c) => ({ ...c, ai: c.state === "gone" ? -1 : actIndex++ }));
  const summaryChanged = !!old && (old.highlight || old.note) !== (d.highlight || d.note);
  const noPlan = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";

  // The day as one ordered list of tiles (lib/timeline.ts). Under Only gaps the activities and the tour are left out.
  const entries = buildTimeline({
    date: d.date, hotels: hotelChanges, flights: flightChanges, acts: gapsOnly ? [] : actRows, gaps: transportGaps, tour: !gapsOnly && !!d.tourDetails,
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
      return {
        key: entry.key, ghost: state === "gone", defaultOpen: unresolved,
        tile: {
          domId: entry.domKey && tileDomId(rowId, entry.domKey), time: ALL_DAY, icon: "🏨", title, meta, change: state, warn: unresolved,
          className: `tl-hotel${unresolved ? " miss" : ""}`, nextUpLine: upText(g.srcs),
          headerEnd: (
            <>
              <TileStatePill state={pill} label={pill === "needed" && !g.name ? "Not chosen" : undefined} />
              <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />
            </>
          ),
          children: <HotelBody g={g} status={s} stay={stay} gapAfter={gapAfter} groups={groups} date={d.date} days={days} dayNumber={dayNumber} />,
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
              <StatusToggle ids={g.ids} status={s} onToggle={onToggle} />
            </>
          ),
          children: <TransportBody group={g} groups={groups} day={d} dayNumber={dayNumber} />,
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
    // The header carries the sentence as plain text; the body repeats it only when it has links or places to show.
    const rich = /<[a-z]/i.test(html) || rest.length > 0;
    const title = plain(text);
    return {
      key: entry.key, ghost: gone, defaultOpen: false, forceOpen: editing,
      tile: {
        domId: entry.domKey && tileDomId(rowId, entry.domKey), time: entry.time, icon: (tag && TAG_EMOJI[tag]) || "📍", meta: tag, change: state, now: !!live,
        title: prev ? <InlineDiff prev={sanitizeHtml(actParts(prev).text)} next={sanitizeHtml(text)}>{title}</InlineDiff> : title,
        headerEnd: live?.pill,
        progress: live?.progress,
        children: gone ? null : editing ? (
          <ActivityEditor
            initial={text}
            initialPlaces={places}
            onCancel={() => setEditingAct(null)}
            onSave={async (next, nextPlaces) => {
              await onEditActivity(d.date, ai, text, next, nextPlaces);
              setEditingAct(null);
            }}
          />
        ) : (
          <>
            {rich && (
              <div className="activity-text" onClick={focusInlinePlace}>
                <span dangerouslySetInnerHTML={{ __html: html }} />
                {rest.map((p, pi) => (
                  <span key={pi} style={{ marginLeft: 8 }}>
                    <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer">
                      📍 {p.name}
                    </a>
                    <ShowOnMap place={p} />
                  </span>
                ))}
              </div>
            )}
            <div className="tl-actions">
              {onEditActivity && (
                <button type="button" className="icon-btn act-edit" aria-label={`Edit activity: ${text}`} onClick={() => setEditingAct(ai)}>
                  <PencilIcon />
                </button>
              )}
              <ShareLinkButton param={{ day: d.date, tile: `act:${ai}` }} label={`Share link to activity: ${text}`} />
              <AddToCalendar url={actUrl(a, d, dayNumber, ai)} />
            </div>
          </>
        ),
      },
    };
  };
  const described = entries.map((e) => (e.kind === "tour" ? null : describe(e)));
  // Open state is kept per trip, so an id carries the day's date.
  const idOf = (key: string) => `${d.date}#${key}`;
  const isOpenTile = (x: Described) => !!x.forceOpen || tiles.isOpen(idOf(x.key), x.defaultOpen);
  const liveTiles = described.filter((x): x is Described => !!x && !x.ghost);
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
          className="day-tiles-btn"
          aria-label={`${anyClosed ? "Expand" : "Collapse"} all tiles on Day ${dayNumber}`}
          onClick={() => tiles.setMany(liveTiles.map((x) => idOf(x.key)), anyClosed)}
        >
          {/* On a phone only the icon shows, so the day's own badges keep their room. */}
          <svg className="day-tiles-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d={anyClosed ? "M3.5 3.5L7 7l3.5-3.5M3.5 7.5L7 11l3.5-3.5" : "M3.5 10.5L7 7l3.5 3.5M3.5 6.5L7 3l3.5 3.5"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="day-tiles-label">{anyClosed ? "Expand all" : "Collapse all"}</span>
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

          {gapsOnly ? (
            gaps?.plan && <p className="day-subtitle"><span className="gap-reason">Nothing planned</span></p>
          ) : actRows.length === 0 && noPlan ? (
            <p className="day-subtitle" style={{ color: "var(--danger)", fontStyle: "italic" }}>
              Not decided yet
            </p>
          ) : null}

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

          {shownConsiderations.length > 0 && (
            <div className="day-considering">
              <span className="consider-pill">{shownConsiderations.some((t) => !t.outcome) ? "Under consideration" : "Decided"}</span>
              <ul>
                {shownConsiderations.map((t) => {
                  const id = t.key.slice("item:".length);
                  const { mine, yes, no } = voteTally(t, pendingVotes[id]);
                  const pick = (v: Vote) => onVote(id, mine === v ? null : v);
                  return (
                    <li key={t.key} data-outcome={t.outcome}>
                      {/* Jumps to this item's card in the Under consideration list, opening Settled if needed. */}
                      <button
                        type="button"
                        className="day-considering-title"
                        title="Go to this in the Under consideration list"
                        onClick={() => slug && showFocus({ slug, target: { kind: "actionItem", id }, nonce: `${Date.now()}` })}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.title) }}
                      />
                      {t.outcome === "chosen" && <span className="consider-pill day-chosen">Chosen</span>}
                      <span className="vote-bar" role="group" aria-label={`Vote on ${t.title}`}>
                        {/* A chosen item is settled: its tally stays but voting is over. */}
                        <button type="button" className="vote-btn" data-vote="yes" aria-pressed={mine === "yes"} disabled={!!t.outcome} onClick={() => pick("yes")}>
                          👍 <b>{yes}</b>
                        </button>
                        <button type="button" className="vote-btn" data-vote="no" aria-pressed={mine === "no"} disabled={!!t.outcome} onClick={() => pick("no")}>
                          👎 <b>{no}</b>
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {shownActionItems.length > 0 && (
            <div className="action-items" style={{ marginTop: 14 }}>
              {shownActionItems.map((item) => (
                <TaskRow
                  key={item.id}
                  domId={`${rowId}-ai-${item.id}`}
                  done={!!actionItemsDone[item.id]}
                  onToggle={() => onToggleActionItem(item.id)}
                  badge={item.who ? gapLabel(item.who, groups, item.date || d.date) : null}
                  pill={item.priority ? PRIORITY_LABELS[item.priority] : undefined}
                  lead={item.title}
                  body={item.detail}
                  // The day is already obvious; a range is worth spelling out.
                  scope={item.endDate ? `${fmtShort(item.date ?? d.date)} – ${fmtShort(item.endDate)}` : undefined}
                />
              ))}
            </div>
          )}
        </>
      </div>
    </section>
  );
}
