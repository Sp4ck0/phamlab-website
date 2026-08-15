import { useState } from "react";
import type { ActionItem, Group, LegColor, ResolvedDay, Status } from "../../lib/types";
import { DOW, MON, actParts, gapLabel, mergeFlightsByRoute, mergeHotelsByName, statusOf } from "../../lib/tripLogic";
import type { HotelGroup } from "../../lib/tripLogic";
import { WhoPill } from "./WhoPill";
import { StatusToggle } from "./StatusToggle";
import { FlightBox } from "./FlightBox";
import { TourBox } from "./TourBox";

interface Props {
  day: ResolvedDay;
  dayIndex: number;
  dayNumber: number;
  legColor: LegColor;
  groups: Group[];
  ticks: Record<string, Status>;
  onlyGaps: boolean;
  onToggle: (ids: string[], status: Status) => void;
  dayActionItems: ActionItem[];
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
}

export function DayCard({
  day: d,
  dayIndex: di,
  dayNumber,
  legColor,
  groups,
  ticks,
  onlyGaps,
  onToggle,
  dayActionItems,
  actionItemsDone,
  onToggleActionItem,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const hotels = d.hotels;
  const flightGroups = mergeFlightsByRoute(d.flights, di, ticks);
  const hotelGroups = mergeHotelsByName(hotels, ticks);
  // On a transition day, the hotel being checked out of renders before the
  // flight/transport tile, and the hotel being checked into (or one just
  // being stayed in) renders after — matches the day's actual chronology.
  const checkoutHotels = hotelGroups.filter((g) => g.checkOut && !g.checkIn);
  const otherHotels = hotelGroups.filter((g) => !(g.checkOut && !g.checkIn));
  const noPlan = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";

  const hasGap =
    flightGroups.some((g) => g.statuses.includes("needed")) ||
    hotels.filter((h) => !h.carried).some((h) => statusOf(ticks, h.src, h.status) === "needed") ||
    noPlan;
  const hidden = onlyGaps && !hasGap;

  if (hidden) return null;

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
        <div className={`cmain ${s === "needed" ? "todo" : ""}`}>{nm}</div>
        {g.address && (
          <div className="cmeta">
            <a href={`https://maps.google.com/?q=${encodeURIComponent(g.address)}`} target="_blank" rel="noopener">
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
      id={`day-${d.date}`}
      style={{ ["--leg-color" as string]: legColor.color, ["--leg-tint" as string]: legColor.tint }}
    >
      <button type="button" className="day-head day-head-btn" aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>
        <div className="day-title-group">
          <span className="day-num">Day {dayNumber}</span>
          <span className="day-date">
            {DOW[d._d.getDay()]}, {MON[d._d.getMonth()]} {d._d.getDate()}
          </span>
        </div>
        <span className="day-head-right">
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
      </button>
      {(d.highlight || d.note) && <p className="day-subtitle">{d.highlight || d.note}</p>}

      {!collapsed && (
        <>
          {checkoutHotels.length > 0 && (
            <div className="cards" style={{ marginBottom: 14 }}>
              {checkoutHotels.map((g, gi) => renderHotelCard(g, `co${gi}`))}
            </div>
          )}

          {flightGroups
            .filter((g) => g.legs && g.legs.length)
            .map((g, gi) => (
              <FlightBox key={`fb${gi}`} group={g} onToggle={onToggle} />
            ))}

          {(flightGroups.some((g) => !(g.legs && g.legs.length)) || otherHotels.length > 0) && (
            <div className="cards" style={{ marginBottom: 14 }}>
              {flightGroups
                .filter((g) => !(g.legs && g.legs.length))
                .map((g, gi) => {
                  const status: Status = g.statuses.includes("needed") ? "needed" : "booked";
                  const uniqueWho = [...new Set(g.who)];
                  return (
                    <div className={`card ${status === "needed" ? "miss" : ""}`} key={`fc${gi}`}>
                      <StatusToggle ids={g.ids} status={status} onToggle={onToggle} />
                      <div className="ctop">
                        <span className="ctype">Flight</span>
                        <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
                      </div>
                      <div className={`cmain ${status === "needed" ? "todo" : ""}`}>{g.route}</div>
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
                      <span dangerouslySetInnerHTML={{ __html: text }} />
                    </span>
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
              <span dangerouslySetInnerHTML={{ __html: d.callout }} />
            </div>
          )}

          {dayActionItems.length > 0 && (
            <div className="action-items" style={{ marginTop: 14 }}>
              {dayActionItems.map((item) => {
                const isDone = !!actionItemsDone[item.id];
                const badge = item.who ? gapLabel(item.who, groups, item.date || d.date) : null;
                const badgeStyle = badge?.color
                  ? { background: `${badge.color}1a`, color: badge.color }
                  : { background: "var(--chip-bg)", color: "var(--text-secondary)" };
                return (
                  <div className={`action-item ${isDone ? "done" : ""}`} key={item.id}>
                    <input
                      type="checkbox"
                      id={`day-ai-${item.id}`}
                      checked={isDone}
                      onChange={() => onToggleActionItem(item.id)}
                    />
                    <label htmlFor={`day-ai-${item.id}`}>
                      {badge && (
                        <span
                          className="who"
                          onClick={(e) => e.preventDefault()}
                          style={{ ...badgeStyle, display: "inline-block", padding: "3px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 7 }}
                        >
                          {badge.label}
                        </span>
                      )}
                      <span className="at">{item.title} —</span> <span className="ad">{item.detail}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
