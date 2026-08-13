import type { Day, Group, HighlightStat } from "../../lib/types";
import { assignLegColors, deriveRoute, renderCountdown } from "../../lib/tripLogic";
import { RouteStepper } from "./RouteStepper";
import { Roster } from "./Roster";
import { StatTiles } from "./StatTiles";
import { ViewToggle, type TripView } from "./ViewToggle";

export function TripHeader({
  kicker,
  title,
  titleEmphasis,
  dateRangeLabel,
  days,
  highlightStat,
  groups,
  view,
  onViewChange,
  onlyGaps,
  onOnlyGapsChange,
}: {
  kicker: string;
  title: string;
  titleEmphasis: string;
  dateRangeLabel: string;
  days: Day[];
  highlightStat?: HighlightStat;
  groups: Group[];
  view: TripView;
  onViewChange: (v: TripView) => void;
  onlyGaps: boolean;
  onOnlyGapsChange: (v: boolean) => void;
}) {
  const legColors = assignLegColors(days);
  const route = deriveRoute(days, legColors);
  const cities = new Set(days.map((d) => d.city));
  const flightLegs = days.reduce((sum, d) => sum + (d.flights?.length || 0), 0);

  const stats = [
    { value: String(days.length), label: `Days` },
    { value: String(cities.size), label: "Cities / stops" },
    highlightStat || { value: renderCountdown(days), label: "Countdown" },
    { value: String(flightLegs), label: "Flight legs" },
  ];

  return (
    <header className="hero" style={{ position: "relative" }}>
      <p className="eyebrow">{kicker}</p>
      <h1>
        {title} {titleEmphasis}
      </h1>
      <p className="subdate">
        {dateRangeLabel} · {days.length} days
      </p>

      <RouteStepper stops={route} />
      <Roster groups={groups} />
      <StatTiles stats={stats} />
      <div className="view-row">
        <ViewToggle view={view} onChange={onViewChange} />
        {view === "detailed" && (
          <button className="btn" aria-pressed={onlyGaps} onClick={() => onOnlyGapsChange(!onlyGaps)}>
            {onlyGaps ? "Show all days" : "Only gaps"}
          </button>
        )}
      </div>
    </header>
  );
}
