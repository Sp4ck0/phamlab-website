import type { RouteStop } from "../../lib/tripLogic";

export function RouteStepper({ stops }: { stops: RouteStop[] }) {
  return (
    <div className="route">
      {stops.map((s, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="route-arrow">→</span>}
          <span className="route-chip">
            <span className="dot" style={{ background: s.color }} />
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}
