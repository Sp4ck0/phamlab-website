import type { Group, ResolvedDay, Status } from "../../lib/types";
import { belongsTo, flightId, fmtShort, statusOf } from "../../lib/tripLogic";

export function RosterCard({ group: g, days, ticks }: { group: Group; days: ResolvedDay[]; ticks: Record<string, Status> }) {
  let need = 0;
  let done = 0;
  days.forEach((d, di) => {
    d.hotels.forEach((h) => {
      if (h.carried) return;
      if (!belongsTo(h.who, g.id, [g], d.date)) return;
      statusOf(ticks, h.src, h.status) === "needed" ? need++ : done++;
    });
    d.flights.forEach((f, i) => {
      if (!belongsTo(f.who, g.id, [g], d.date)) return;
      statusOf(ticks, flightId(di, i), f.status) === "needed" ? need++ : done++;
    });
  });

  const range = g.from || g.to ? (
    <>
      <br />
      {g.from ? fmtShort(g.from) : "start"} – {g.to ? fmtShort(g.to) : "end"}
    </>
  ) : null;
  const roomBit = g.rooms != null ? ` · ${g.rooms} room${g.rooms === 1 ? "" : "s"}` : "";

  return (
    <div className="person" style={{ borderTopColor: g.color }}>
      <h4>{g.name}</h4>
      <p>
        {g.members} {g.members > 1 ? "people" : "person"}
        {roomBit}
        {g.note ? ` · ${g.note}` : ""}
        {range}
      </p>
      <div className="tally">
        <span className={need ? "r" : "g"}>{need} to book</span> &nbsp;·&nbsp; <span className="g">{done} done</span>
      </div>
    </div>
  );
}
