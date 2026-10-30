import type { ActionItem, Group, LegColor, ResolvedDay, Status } from "../../lib/types";
import { DOW, MON, actParts, fmtShort, gapLabel, mergeFlightsByRoute, mergeHotelsByName, modeLabel } from "../../lib/tripLogic";
import type { HotelGroup } from "../../lib/tripLogic";
import { WhoPill } from "./WhoPill";
import { StatusToggle } from "./StatusToggle";
import { FlightBox } from "./FlightBox";
import { TaskRow } from "./TaskRow";
import { TourBox } from "./TourBox";
import { WeatherBadge } from "./WeatherBadge";
import { AddToCalendar } from "./AddToCalendar";
import { actUrl, hotelUrl, transportUrl } from "../../lib/calendar";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import type { DayWeather } from "../../lib/weather";

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
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
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
  actionItemsDone,
  onToggleActionItem,
}: Props) {
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
      <div className={`card ${s === "needed" ? "miss" : ""}`} style={g.carriedAll ? { opacity: 0.72 } : undefined} key={key}>
        <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />
        <div className="ctop">
          <span className="ctype">{ctype}</span>
          <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
        </div>
        <div className={`cmain ${s === "needed" ? "todo" : ""}`}>
          {nm}
          {g.checkIn && days && <AddToCalendar url={hotelUrl(g.name, g.address, days, dayNumber)} />}
        </div>
        {g.address && (
          <div className="cmeta">
            <a href={`https://maps.google.com/?q=${encodeURIComponent(g.address)}`} target="_blank" rel="noopener noreferrer">
              {g.address}
            </a>
          </div>
        )}
        {g.detail && <div className="cmeta">{g.detail}</div>}
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
      </h2>

      <div id={`${rowId}-panel`} aria-labelledby={`${rowId}-trigger`} hidden={!expanded}>
      {!collapsed && (
        <>
          {flightGroups
            .filter((g) => g.legs && g.legs.length)
            .map((g, gi) => (
              <FlightBox key={`fb${gi}`} group={g} onToggle={onToggle} day={d} dayNumber={dayNumber} />
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
                    <div className={`card ${status === "needed" ? "miss" : ""}`} key={`fc${gi}`}>
                      <StatusToggle ids={g.ids} status={status} onToggle={onToggle} />
                      <div className="ctop">
                        <span className="ctype">{modeLabel(g.mode)}</span>
                        <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
                      </div>
                      <div className={`cmain ${status === "needed" ? "todo" : ""}`}>
                        {g.route}
                        <AddToCalendar url={transportUrl(g, d, dayNumber)} />
                      </div>
                      <div className="cmeta">{g.detail || ""}</div>
                    </div>
                  );
                })}
              {otherHotels.map((g, gi) => renderHotelCard(g, gi))}
            </div>
          )}

          {d.acts && d.acts.length > 0 ? (
            <ul className="activity-list">
              {d.acts.map((a, ai) => {
                const { tag, time, text } = actParts(a);
                return (
                  <li className="activity" key={ai}>
                    {tag && <span className="act-tag">{tag}</span>}
                    <span className="activity-text">
                      {time && <span className="activity-time">{time}</span>}
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />
                    </span>
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
