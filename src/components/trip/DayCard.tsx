import { useState } from "react";
import type { Group, LegColor, ResolvedDay, Status } from "../../lib/types";
import { DOW, MON, actParts, mergeFlightsByRoute, mergeHotelsByName, statusOf } from "../../lib/tripLogic";
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
}

export function DayCard({ day: d, dayIndex: di, dayNumber, legColor, groups, ticks, onlyGaps, onToggle }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const hotels = d.hotels;
  const flightGroups = mergeFlightsByRoute(d.flights, di, ticks);
  const hotelGroups = mergeHotelsByName(hotels, ticks);
  const noPlan = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";

  const hasGap =
    flightGroups.some((g) => g.statuses.includes("needed")) ||
    hotels.filter((h) => !h.carried).some((h) => statusOf(ticks, h.src, h.status) === "needed") ||
    noPlan;
  const hidden = onlyGaps && !hasGap;

  if (hidden) return null;

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
          {flightGroups.map((g, gi) =>
            g.legs && g.legs.length ? (
              <FlightBox key={`fb${gi}`} group={g} onToggle={onToggle} />
            ) : (
              <div className="cards" key={`fc${gi}`} style={{ marginBottom: 14 }}>
                {(() => {
                  const status: Status = g.statuses.includes("needed") ? "needed" : "booked";
                  const uniqueWho = [...new Set(g.who)];
                  return (
                    <div className={`card ${status === "needed" ? "miss" : ""}`}>
                      <StatusToggle ids={g.ids} status={status} onToggle={onToggle} />
                      <div className="ctop">
                        <span className="ctype">Flight</span>
                        <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={d.date} />
                      </div>
                      <div className={`cmain ${status === "needed" ? "todo" : ""}`}>{g.route}</div>
                      <div className="cmeta">{g.detail || ""}</div>
                    </div>
                  );
                })()}
              </div>
            )
          )}

          {hotelGroups.length > 0 && (
            <div className="cards" style={{ marginBottom: 14 }}>
              {hotelGroups.map((g, gi) => {
                const s: Status = g.statuses.includes("needed") ? "needed" : "booked";
                const nm = g.name || "Hotel not chosen";
                const uniqueWho = [...new Set(g.who)];
                return (
                  <div className={`card ${s === "needed" ? "miss" : ""}`} style={g.carriedAll ? { opacity: 0.72 } : undefined} key={gi}>
                    <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />
                    <div className="ctop">
                      <span className="ctype">{g.carriedAll ? "Hotel · staying" : "Hotel"}</span>
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
                  </div>
                );
              })}
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
        </>
      )}
    </section>
  );
}
