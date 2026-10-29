import { useParams } from "react-router-dom";
import type { RefObject } from "react";
import type { Day, Group, HighlightStat } from "../../lib/types";
import { assignLegColors, deriveRoute, renderCountdown } from "../../lib/tripLogic";
import { ExportMenu } from "./ExportMenu";
import { RouteStepper } from "./RouteStepper";
import { Roster } from "./Roster";
import { StatTiles } from "./StatTiles";

export function TripHeader({
  kicker,
  title,
  dateRangeLabel,
  days,
  highlightStat,
  groups,
  filterRef,
  onlyGaps,
  onOnlyGapsChange,
}: {
  kicker: string;
  title: string;
  dateRangeLabel: string;
  days: Day[];
  highlightStat?: HighlightStat;
  groups: Group[];
  filterRef: RefObject<HTMLButtonElement | null>;
  onlyGaps: boolean;
  onOnlyGapsChange: (v: boolean) => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  const legColors = assignLegColors(days);
  const route = deriveRoute(days, legColors);
  const cities = new Set(days.map((d) => d.city));
  const flightLegs = days.reduce((sum, d) => sum + (d.flights?.length || 0), 0);

  const stats = [
    { value: String(days.length), label: `Days` },
    { value: String(cities.size), label: "Cities / stops" },
    highlightStat || { value: renderCountdown(days), label: "Countdown" },
    { value: String(flightLegs), label: "Travel legs" },
  ];

  return (
    <header className="hero" style={{ position: "relative" }}>
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      <p className="subdate">
        {dateRangeLabel} · {days.length} days
      </p>

      <RouteStepper stops={route} />
      <Roster groups={groups} />
      <StatTiles stats={stats} />
      <div className="view-row">
        <button ref={filterRef} type="button" className="btn" aria-pressed={onlyGaps} onClick={() => onOnlyGapsChange(!onlyGaps)}>
          {onlyGaps ? "Show all days" : "Only gaps"}
        </button>
        {slug && <ExportMenu slug={slug} />}
      </div>
    </header>
  );
}
