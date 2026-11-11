import { useState, type ReactNode } from "react";
import type { Act, ActionItem, Group, LegColor, ResolvedDay, Status, Task, Vote } from "../../lib/types";
import { changeClass, diffLines, type Change, type ChangeState } from "../../lib/changeDiff";
import { focusOnMapKey, googleMapsUrl, inlinePlaces } from "../../lib/mapPoints";
import { DOW, MON, actParts, fmtShort, gapLabel, mergeFlightsByRoute, mergeHotelsByName, modeLabel } from "../../lib/tripLogic";
import type { FlightGroup, HotelGroup } from "../../lib/tripLogic";
import { WhoPill } from "./WhoPill";
import { StatusToggle } from "./StatusToggle";
import { FlightBox } from "./FlightBox";
import { TaskRow } from "./TaskRow";
import { TourBox } from "./TourBox";
import { Linkify } from "./Linkify";
import { WeatherBadge } from "./WeatherBadge";
import { AddToCalendar } from "./AddToCalendar";
import { actUrl, hotelUrl, transportUrl } from "../../lib/calendar";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import type { DayWeather } from "../../lib/weather";
import { useParams } from "react-router-dom";
import { PRIORITY_LABELS, voteTally } from "../../lib/tasks";
import type { DayGaps } from "../../lib/tasks";
import { useShowAiFocus } from "../../hooks/useAiFocus";
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
const flightKey = (g: FlightGroup) => JSON.stringify([g.mode, g.route, g.title, g.price, g.detail, g.legs, g.layovers]);
const hotelKey = (g: HotelGroup) => JSON.stringify([g.name, g.address, g.placeId, g.detail, g.checkIn, g.checkOut]);
const unchanged = <T,>(items: T[]): Change<T>[] => items.map((item) => ({ item, state: "same" }));

// A line that changed gets a wrapper to animate (new: glow; gone: a struck-through
// ghost of what it was, inert); an untouched one renders bare.
function mark(state: ChangeState, key: string, node: ReactNode) {
  if (state === "same") return node;
  const ghost = state === "gone" ? { inert: true, "aria-hidden": true } : {};
  return (
    <div key={key} className={changeClass(state).trim()} {...ghost}>
      {node}
    </div>
  );
}

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
  onToggle: (ids: string[], status: Status) => void;
  dayActionItems: ActionItem[];
  // Considerations that cover this day (day / range scope; open or chosen), shown
  // as a dashed strip so they read as candidates, not plans.
  dayConsiderations: Task[];
  pendingVotes: Record<string, Vote | null>;
  onVote: (itemId: string, vote: Vote | null) => void;
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
  // Saves new text for the activity at `index`; `expected` is the text it had
  // when the editor opened. The pencil only shows when this is passed.
  onEditActivity?: (date: string, index: number, expected: string, text: string) => Promise<unknown>;
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
  const collapsed = !expanded;
  const hotels = d.hotels;
  const flightGroups = mergeFlightsByRoute(d.flights, d.date, ticks);
  const hotelGroups = mergeHotelsByName(hotels, ticks);
  // On a transition day, the hotel being checked out of renders before the
  // flight tile, and the hotel being checked into (or one just being stayed
  // in) renders after — matches the day's actual chronology. Only split
  // into separate rows when there's an actual flight to insert between them
  // (e.g. a drive/transfer day with no Flight entry keeps both hotels on
  // one row).
  const hasFlights = flightGroups.length > 0;
  // After an AI edit each list is merged with how it was before: what changed is
  // marked new, and what was removed (or reworded) stays as a ghost for a moment.
  const flightChanges = old ? diffLines(mergeFlightsByRoute(old.flights, old.date, ticks), flightGroups, flightKey) : unchanged(flightGroups);
  const hotelChanges = old ? diffLines(mergeHotelsByName(old.hotels, ticks), hotelGroups, hotelKey) : unchanged(hotelGroups);
  const isCheckout = (g: HotelGroup) => hasFlights && g.checkOut && !g.checkIn;
  // Under Only gaps, booked hotels and transport still show as context for planning; only open ones are labelled.
  const checkoutHotels = hotelChanges.filter((c) => isCheckout(c.item));
  const otherHotels = hotelChanges.filter((c) => !isCheckout(c.item));
  const legFlights = flightChanges.filter((c) => c.item.legs && c.item.legs.length);
  const plainFlights = flightChanges.filter((c) => !(c.item.legs && c.item.legs.length));
  const transportGaps = gapsOnly ? gaps?.transport ?? [] : [];
  // Under Only gaps, a to-do or consideration that is done or settled is not a gap.
  const shownConsiderations = gapsOnly ? dayConsiderations.filter((t) => !t.done) : dayConsiderations;
  const shownActionItems = gapsOnly ? dayActionItems.filter((item) => !actionItemsDone[item.id]) : dayActionItems;
  const actChanges = old ? diffLines(old.acts ?? [], d.acts ?? [], actKey) : unchanged(d.acts ?? []);
  // Edit buttons, share links and ids use an activity's real index; a ghost has none.
  let actIndex = 0;
  const actRows = pairRewrites(actChanges).map((c) => ({ ...c, ai: c.state === "gone" ? -1 : actIndex++ }));
  const summaryChanged = !!old && (old.highlight || old.note) !== (d.highlight || d.note);
  const noPlan = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";

  // A ghost (a removed hotel) has no id, so it can't clash with its replacement's.
  const renderHotelCard = ({ item: g, state }: Change<HotelGroup>, key: string | number) => {
    const s: Status = g.statuses.includes("needed") ? "needed" : "booked";
    const nm = g.name || "Hotel not chosen";
    const uniqueWho = [...new Set(g.who)];
    const ctype =
      g.checkIn && g.checkOut
        ? "Hotel"
        : g.checkIn
          ? "Hotel · check-in"
          : g.checkOut
            ? "Hotel · check-out"
            : "Hotel · staying";
    return mark(state, `h${key}`, (
      <div className={`card ${s === "needed" ? "miss" : ""}`} style={g.carriedAll ? { opacity: 0.72 } : undefined} key={key} id={state === "gone" ? undefined : tileDomId(rowId, g.srcs[0])}>
        <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />
        <div className="ctop">
          <span className="ctype">{ctype}</span>
          {gapsOnly && s === "needed" && <span className="gap-reason">{g.name ? "Not booked" : "Not chosen"}</span>}
          <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
          <ShareLinkButton param={{ day: d.date, tile: g.srcs[0] }} label={`Share link to ${nm}`} />
          {days && <AddToCalendar url={hotelUrl(g.name, g.address, days, dayNumber)} />}
        </div>
        <div className={`cmain ${s === "needed" ? "todo" : ""}`}>
          {g.name ? (
            <>
              <a href={googleMapsUrl({ name: g.name, address: g.address, placeId: g.placeId })} target="_blank" rel="noopener noreferrer">
                📍 {nm}
              </a>
              <ShowOnMap place={{ name: g.name, address: g.address, placeId: g.placeId }} />
            </>
          ) : (
            nm
          )}
        </div>
        {/* With a Place ID the link opens the exact listing, so the address text adds nothing. */}
        {g.address && !g.placeId && <div className="cmeta">{g.address}</div>}
        {g.detail && <div className="cmeta"><Linkify text={g.detail} /></div>}
      </div>
    ));
  };

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
          {isToday && <span className="today-badge">Today</span>}
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
      <ShareLinkButton param={{ day: d.date }} label={`Share link to Day ${dayNumber}`} />
      </h2>

      <div id={`${rowId}-panel`} aria-labelledby={`${rowId}-trigger`} hidden={!expanded}>
      {!collapsed && (
        <>
          {legFlights.map(({ item: g, state }, gi) =>
            mark(state, `fbm${gi}`, (
              <FlightBox key={`fb${gi}`} group={g} onToggle={onToggle} day={d} dayNumber={dayNumber} tileId={state === "gone" ? undefined : tileDomId(rowId, g.ids[0])} gapReason={gapsOnly && g.statuses.includes("needed") ? "Not booked" : undefined} />
            ))
          )}

          {(checkoutHotels.length > 0 || plainFlights.length > 0 || otherHotels.length > 0 || transportGaps.length > 0) && (
            <div className="cards" style={{ marginBottom: 14 }}>
              {checkoutHotels.map((c, gi) => renderHotelCard(c, `co${gi}`))}
              {plainFlights
                .map(({ item: g, state }, gi) => {
                  const status: Status = g.statuses.includes("needed") ? "needed" : "booked";
                  const uniqueWho = [...new Set(g.who)];
                  return mark(state, `fcm${gi}`, (
                    <div className={`card ${status === "needed" ? "miss" : ""}`} key={`fc${gi}`} id={state === "gone" ? undefined : tileDomId(rowId, g.ids[0])}>
                      <StatusToggle ids={g.ids} status={status} onToggle={onToggle} />
                      <div className="ctop">
                        <span className="ctype">{modeLabel(g.mode)}</span>
                        {gapsOnly && status === "needed" && <span className="gap-reason">Not booked</span>}
                        <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
                        <ShareLinkButton param={{ day: d.date, tile: g.ids[0] }} label={`Share link to ${g.route}`} />
                        <AddToCalendar url={transportUrl(g, d, dayNumber)} />
                      </div>
                      <div className={`cmain ${status === "needed" ? "todo" : ""}`}>
                        {g.route}
                      </div>
                      <div className="cmeta"><Linkify text={g.detail || ""} /></div>
                    </div>
                  ));
                })}
              {otherHotels.map((c, gi) => renderHotelCard(c, gi))}
              {transportGaps.map((t) => (
                <div className="card miss" key={t.key}>
                  <div className="ctop">
                    <span className="ctype">Transport</span>
                    <span className="gap-reason">None entered</span>
                  </div>
                  <div className="cmain todo">{t.title}</div>
                  <div className="cmeta">Add it to the itinerary, or dismiss it in Action Items.</div>
                </div>
              ))}
            </div>
          )}

          {gapsOnly ? (
            gaps?.plan && <p className="day-subtitle"><span className="gap-reason">Nothing planned</span></p>
          ) : actRows.length > 0 ? (
            <ul className="activity-list">
              {actRows.map(({ item: a, state, ai, prev }, ri) => {
                const { tag, time, text, places } = actParts(a);
                if (state === "gone") {
                  // What it said before the edit: struck through, then folded away.
                  return (
                    <li className="activity chg-gone" key={`gone${ri}`} inert aria-hidden="true">
                      {tag && <span className="act-tag">{tag}</span>}
                      <span className="activity-text">
                        {time && <span className="activity-time">{time}</span>}
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />
                      </span>
                    </li>
                  );
                }
                // A place named in the sentence is linked in place; the rest follow as chips.
                // Sanitize first: inlinePlaces adds its own show-on-map buttons, which the sanitizer would strip.
                const { html, rest } = inlinePlaces(sanitizeHtml(text), places);
                if (editingAct === ai && onEditActivity) {
                  return (
                    <li className="activity" key={ai}>
                      <ActivityEditor
                        initial={text}
                        onCancel={() => setEditingAct(null)}
                        onSave={async (next) => {
                          await onEditActivity(d.date, ai, text, next);
                          setEditingAct(null);
                        }}
                      />
                    </li>
                  );
                }
                return (
                  <li className={`activity${prev ? " chg-row" : changeClass(state)}`} key={ai} id={tileDomId(rowId, `act:${ai}`)}>
                    {tag && <span className="act-tag">{tag}</span>}
                    <span className="activity-text" onClick={focusInlinePlace}>
                      {time && <span className="activity-time">{time}</span>}
                      {prev ? (
                        <InlineDiff prev={sanitizeHtml(actParts(prev).text)} next={sanitizeHtml(text)}>
                          <span dangerouslySetInnerHTML={{ __html: html }} />
                        </InlineDiff>
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: html }} />
                      )}
                      {rest.map((p, pi) => (
                        <span key={pi} style={{ marginLeft: 8 }}>
                          <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer">
                            📍 {p.name}
                          </a>
                          <ShowOnMap place={p} />
                        </span>
                      ))}
                    </span>
                    {onEditActivity && (
                      <button type="button" className="icon-btn act-edit" aria-label={`Edit activity: ${text}`} onClick={() => setEditingAct(ai)}>
                        <PencilIcon />
                      </button>
                    )}
                    <ShareLinkButton param={{ day: d.date, tile: `act:${ai}` }} label={`Share link to activity: ${text}`} />
                    <AddToCalendar url={actUrl(a, d, dayNumber, ai)} />
                  </li>
                );
              })}
            </ul>
          ) : noPlan ? (
            <p className="day-subtitle" style={{ color: "var(--danger)", fontStyle: "italic" }}>
              Not decided yet
            </p>
          ) : null}

          {!gapsOnly && d.tourDetails && <TourBox tourDetails={d.tourDetails} />}
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
      )}
      </div>
    </section>
  );
}
