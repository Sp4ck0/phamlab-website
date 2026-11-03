import { useState } from "react";
import type { ActionItem, Group, LegColor, ResolvedDay, Status, Task, Vote } from "../../lib/types";
import { focusOnMapKey, googleMapsUrl, inlinePlaces } from "../../lib/mapPoints";
import { DOW, MON, actParts, fmtShort, gapLabel, mergeFlightsByRoute, mergeHotelsByName, modeLabel } from "../../lib/tripLogic";
import type { HotelGroup } from "../../lib/tripLogic";
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
import { voteTally } from "../../lib/tasks";
import { useShowAiFocus } from "../../hooks/useAiFocus";
import { ShareLinkButton } from "./ShareLinkButton";
import { ActivityEditor } from "./ActivityEditor";
import { tileDomId } from "../../lib/tileId";
import { PencilIcon, ShowOnMap } from "./taskParts";

// Show-on-map buttons inside an activity's sentence are plain HTML (see inlinePlaces),
// so one delegated click handler on the activity text finds them.
function focusInlinePlace(e: React.MouseEvent) {
  const key = (e.target as HTMLElement).closest<HTMLElement>("button.map-focus[data-map-key]")?.dataset.mapKey;
  if (key) focusOnMapKey(key);
}

interface Props {
  day: ResolvedDay;
  // Whole resolved trip, to find a hotel's check-out date for its calendar link.
  days?: ResolvedDay[];
  dayNumber: number;
  legColor: LegColor;
  weather?: DayWeather;
  groups: Group[];
  ticks: Record<string, Status>;
  rowId: string;
  expanded: boolean;
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
  days,
  dayNumber,
  legColor,
  weather,
  groups,
  ticks,
  rowId,
  expanded,
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
  const checkoutHotels = hasFlights ? hotelGroups.filter((g) => g.checkOut && !g.checkIn) : [];
  const otherHotels = hasFlights ? hotelGroups.filter((g) => !(g.checkOut && !g.checkIn)) : hotelGroups;
  const noPlan = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";

  const renderHotelCard = (g: HotelGroup, key: string | number) => {
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
    return (
      <div className={`card ${s === "needed" ? "miss" : ""}`} style={g.carriedAll ? { opacity: 0.72 } : undefined} key={key} id={tileDomId(rowId, g.srcs[0])}>
        <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />
        <div className="ctop">
          <span className="ctype">{ctype}</span>
          <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
          <ShareLinkButton param={{ day: d.date, tile: g.srcs[0] }} label={`Share link to ${nm}`} />
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
          {days && <AddToCalendar url={hotelUrl(g.name, g.address, days, dayNumber)} />}
        </div>
        {/* With a Place ID the link opens the exact listing, so the address text adds nothing. */}
        {g.address && !g.placeId && <div className="cmeta">{g.address}</div>}
        {g.detail && <div className="cmeta"><Linkify text={g.detail} /></div>}
      </div>
    );
  };

  return (
    <section
      className="day-card"
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
        {(d.highlight || d.note) && <span className="day-summary">{d.highlight || d.note}</span>}
      </button>
      <ShareLinkButton param={{ day: d.date }} label={`Share link to Day ${dayNumber}`} />
      </h2>

      <div id={`${rowId}-panel`} aria-labelledby={`${rowId}-trigger`} hidden={!expanded}>
      {!collapsed && (
        <>
          {flightGroups
            .filter((g) => g.legs && g.legs.length)
            .map((g, gi) => (
              <FlightBox key={`fb${gi}`} group={g} onToggle={onToggle} day={d} dayNumber={dayNumber} tileId={tileDomId(rowId, g.ids[0])} />
            ))}

          {(checkoutHotels.length > 0 || flightGroups.some((g) => !(g.legs && g.legs.length)) || otherHotels.length > 0) && (
            <div className="cards" style={{ marginBottom: 14 }}>
              {checkoutHotels.map((g, gi) => renderHotelCard(g, `co${gi}`))}
              {flightGroups
                .filter((g) => !(g.legs && g.legs.length))
                .map((g, gi) => {
                  const status: Status = g.statuses.includes("needed") ? "needed" : "booked";
                  const uniqueWho = [...new Set(g.who)];
                  return (
                    <div className={`card ${status === "needed" ? "miss" : ""}`} key={`fc${gi}`} id={tileDomId(rowId, g.ids[0])}>
                      <StatusToggle ids={g.ids} status={status} onToggle={onToggle} />
                      <div className="ctop">
                        <span className="ctype">{modeLabel(g.mode)}</span>
                        <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
                        <ShareLinkButton param={{ day: d.date, tile: g.ids[0] }} label={`Share link to ${g.route}`} />
                      </div>
                      <div className={`cmain ${status === "needed" ? "todo" : ""}`}>
                        {g.route}
                        <AddToCalendar url={transportUrl(g, d, dayNumber)} />
                      </div>
                      <div className="cmeta"><Linkify text={g.detail || ""} /></div>
                    </div>
                  );
                })}
              {otherHotels.map((g, gi) => renderHotelCard(g, gi))}
            </div>
          )}

          {d.acts && d.acts.length > 0 ? (
            <ul className="activity-list">
              {d.acts.map((a, ai) => {
                const { tag, time, text, places } = actParts(a);
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
                  <li className="activity" key={ai} id={tileDomId(rowId, `act:${ai}`)}>
                    {tag && <span className="act-tag">{tag}</span>}
                    <span className="activity-text" onClick={focusInlinePlace}>
                      {time && <span className="activity-time">{time}</span>}
                      <span dangerouslySetInnerHTML={{ __html: html }} />
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

          {d.tourDetails && <TourBox tourDetails={d.tourDetails} />}
          {d.callout && (
            <div className="note">
              <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.callout) }} />
            </div>
          )}

          {dayConsiderations.length > 0 && (
            <div className="day-considering">
              <span className="consider-pill">{dayConsiderations.some((t) => !t.outcome) ? "Under consideration" : "Decided"}</span>
              <ul>
                {dayConsiderations.map((t) => {
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

          {dayActionItems.length > 0 && (
            <div className="action-items" style={{ marginTop: 14 }}>
              {dayActionItems.map((item) => (
                <TaskRow
                  key={item.id}
                  domId={`${rowId}-ai-${item.id}`}
                  done={!!actionItemsDone[item.id]}
                  onToggle={() => onToggleActionItem(item.id)}
                  badge={item.who ? gapLabel(item.who, groups, item.date || d.date) : null}
                  pill={item.kind === "decision" ? "Decision" : undefined}
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
