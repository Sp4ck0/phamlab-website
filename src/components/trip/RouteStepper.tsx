import { useState } from "react";
import { byStay, fmtShort, type RouteStop } from "../../lib/tripLogic";

// The route, each stop with how many people are there; tap a stop to see who.
// Names in green joined since the stop before; names in red left.
export function RouteStepper({ stops }: { stops: RouteStop[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const stop = open !== null ? stops[open] : null;
  return (
    <>
      <div className="route">
        {stops.map((s, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="route-arrow">→</span>}
            {s.who.length ? (
              <button
                type="button"
                className="route-chip"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="dot" style={{ background: s.color }} />
                {s.label}
                <span className="route-count">{s.who.length}</span>
              </button>
            ) : (
              <span className="route-chip">
                <span className="dot" style={{ background: s.color }} />
                {s.label}
              </span>
            )}
          </span>
        ))}
      </div>
      {stop && (
        <div className="route-who">
          <div className="route-who__head">
            {stop.label} · {fmtShort(stop.dates[0])}
            {stop.dates.length > 1 && ` – ${fmtShort(stop.dates[stop.dates.length - 1])}`}
            {` · ${stop.who.length} ${stop.who.length === 1 ? "person" : "people"}`}
          </div>
          <div className="roster-list">
            {[...[...stop.who].sort(byStay), ...[...stop.left].sort(byStay)].map((g) => (
              <span className="roster-person" key={g.id}>
                <span className="dot" style={{ background: g.color }} />
                <span className={stop.left.includes(g) ? "route-who__out" : stop.joined.includes(g) ? "route-who__in" : undefined}>
                  {g.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
