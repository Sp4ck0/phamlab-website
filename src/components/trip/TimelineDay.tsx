import type { Group, ResolvedDay, Status } from "../../lib/types";
import { MON, DOW, flightId, mergeHotelsByName, statusOf, visible } from "../../lib/tripLogic";
import { Flag } from "./Flag";
import { WhoPill } from "./WhoPill";
import { StatusToggle } from "./StatusToggle";

interface Props {
  day: ResolvedDay;
  dayIndex: number;
  groups: Group[];
  activeGroup: string;
  ticks: Record<string, Status>;
  onlyGaps: boolean;
  onToggle: (ids: string[], status: Status) => void;
  animationDelay: number;
}

export function TimelineDay({ day: d, dayIndex: di, groups, activeGroup, ticks, onlyGaps, onToggle, animationDelay }: Props) {
  const hotels = d.hotels.filter((h) => visible(h.who, activeGroup, groups, d.date));
  const flights = d.flights.filter((f) => visible(f.who, activeGroup, groups, d.date));

  const hotelGroups = mergeHotelsByName(hotels, ticks);
  const noPlan = !(d.acts && d.acts.length) && !(d.flights && d.flights.length) && d.tag !== "transit";

  const hasGap =
    flights.some((f) => statusOf(ticks, flightId(di, d.flights.indexOf(f)), f.status) === "needed") ||
    hotels.filter((h) => !h.carried).some((h) => statusOf(ticks, h.src, h.status) === "needed") ||
    noPlan;
  const hidden = onlyGaps && !hasGap;

  return (
    <div
      className={`day ${d.tag === "event" ? "pivot" : ""} ${hidden ? "hide" : ""}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="daymark">
        <div className="dnum">{d._d.getDate()}</div>
        <div className="dmon">{MON[d._d.getMonth()]}</div>
        <div className="ddow">{DOW[d._d.getDay()]}</div>
      </div>
      <div className="dbody">
        <div className="dhead">
          <div className="city">
            <Flag country={d.country} />
            {d.city}
            {d.to && (
              <>
                <span className="arw">→</span>
                {d.toCountry && d.toCountry !== d.country && <Flag country={d.toCountry} />}
                {d.to}
              </>
            )}
          </div>
          {d.event && <span className="tag event">{d.event}</span>}
          {d.tag === "move" && <span className="tag move">Travel day</span>}
          {d.tag === "transit" && <span className="tag transit">In transit</span>}
        </div>
        {d.note && <div className="dnote">{d.note}</div>}
        <div className="cards">
          {flights.map((f) => {
            const i = d.flights.indexOf(f);
            const id = flightId(di, i);
            const s = statusOf(ticks, id, f.status);
            return (
              <div className={`card ${s === "needed" ? "miss" : ""}`} key={`f${i}`}>
                <StatusToggle ids={[id]} status={s} onToggle={onToggle} />
                <div className="ctop">
                  <span className="ctype">Flight</span>
                  <WhoPill who={f.who} groups={groups} date={d.date} />
                </div>
                <div className={`cmain ${s === "needed" ? "todo" : ""}`}>{f.route}</div>
                <div className="cmeta">{f.detail || ""}</div>
              </div>
            );
          })}
          {hotelGroups.map((g, gi) => {
            const s = g.statuses.includes("needed") ? "needed" : "booked";
            const nm = g.name || "Hotel not chosen";
            const uniqueWho = [...new Set(g.who)];
            return (
              <div
                className={`card ${s === "needed" ? "miss" : ""}`}
                style={g.carriedAll ? { opacity: 0.72 } : undefined}
                key={`h${gi}`}
              >
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
          {d.acts && d.acts.length ? (
            <div className="card">
              <div className="ctop">
                <span className="ctype">Plan for the day</span>
              </div>
              <div className="acts" style={{ margin: 0, padding: 0, border: 0 }}>
                {d.acts.map((a, ai) => (
                  <span key={ai}>{a}</span>
                ))}
              </div>
            </div>
          ) : noPlan ? (
            <div className="card miss">
              <div className="ctop">
                <span className="ctype">Plan for the day</span>
              </div>
              <div className="cmain todo">Not decided yet</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
