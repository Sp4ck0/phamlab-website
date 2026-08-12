import type { Group, ResolvedDay, Status } from "../../lib/types";
import { MON, DOW, flightId, mergeHotelsByName, statusOf, visible, whoLabel } from "../../lib/tripLogic";
import { Flag } from "./Flag";

export function GridRow({ day: d, dayIndex: di, groups, activeGroup, ticks }: {
  day: ResolvedDay;
  dayIndex: number;
  groups: Group[];
  activeGroup: string;
  ticks: Record<string, Status>;
}) {
  const flights = d.flights.filter((f) => visible(f.who, activeGroup, groups, d.date));
  const visibleHotels = d.hotels.filter((h) => visible(h.who, activeGroup, groups, d.date) && !h.carried);
  const hotelGroups = mergeHotelsByName(visibleHotels, ticks);
  const anyStaying = d.hotels.some((h) => visible(h.who, activeGroup, groups, d.date) && h.carried);

  return (
    <tr>
      <td className="dcell">
        {MON[d._d.getMonth()]} {d._d.getDate()}
        <small>{DOW[d._d.getDay()]}</small>
      </td>
      <td className="dcell">
        <Flag country={d.country} />
        {d.city}
        {d.to && (
          <>
            {" → "}
            {d.toCountry && d.toCountry !== d.country && <Flag country={d.toCountry} />}
            {d.to}
          </>
        )}
      </td>
      <td>
        {flights.length ? (
          flights.map((f, fi) => {
            const i = d.flights.indexOf(f);
            const s = statusOf(ticks, flightId(di, i), f.status);
            const who = activeGroup === "all" ? whoLabel(f.who, groups, d.date) : null;
            return (
              <div className={`mini ${s === "needed" ? "todo" : ""}`} key={fi}>
                <span className={`mk ${s}`} />
                {who && <b style={{ color: who.color }}>{who.label} — </b>}
                {f.route} · {f.detail || ""}
              </div>
            );
          })
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        )}
      </td>
      <td>
        {hotelGroups.length ? (
          hotelGroups.map((g, gi) => {
            const s = g.statuses.includes("needed") ? "needed" : "booked";
            const uniqueWho = [...new Set(g.who)];
            const who = activeGroup === "all" ? whoLabel(uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho, groups, d.date) : null;
            return (
              <div className={`mini ${s === "needed" ? "todo" : ""}`} key={gi}>
                <span className={`mk ${s}`} />
                {who && <b style={{ color: who.color }}>{who.label} — </b>}
                {g.name || "Not chosen"}
              </div>
            );
          })
        ) : anyStaying ? (
          <span style={{ color: "var(--ink-faint)" }}>(staying)</span>
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        )}
      </td>
      <td className="mini" style={{ color: "var(--ink-soft)" }}>
        {d.acts && d.acts.length ? (
          d.acts.map((a, ai) => (
            <div className="actline" key={ai}>
              {a}
            </div>
          ))
        ) : !(d.flights && d.flights.length) && d.tag !== "transit" ? (
          <span className="todo">Not decided yet</span>
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        )}
      </td>
    </tr>
  );
}
