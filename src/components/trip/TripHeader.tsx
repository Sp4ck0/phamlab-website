import { useParams } from "react-router-dom";
import type { RefObject } from "react";
import type { Day, Group, HighlightStat } from "../../lib/types";
import { assignLegColors, dateRangeFromDays, deriveCountries, deriveRoute, renderCountdown } from "../../lib/tripLogic";
import { ExportMenu } from "./ExportMenu";
import { RouteStepper } from "./RouteStepper";
import type { DaysControl } from "./DetailedView";

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
  daysControl,
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
  daysControl: DaysControl | null;
}) {
  const { slug } = useParams<{ slug: string }>();
  const legColors = assignLegColors(days);
  const route = deriveRoute(days, legColors, groups);
  const cities = new Set(days.map((d) => d.city));
  const flightLegs = days.reduce((sum, d) => sum + (d.flights?.length || 0), 0);

  const highlight = highlightStat ? `★ ${highlightStat.label} · ${highlightStat.value}` : renderCountdown(days);

  return (
    <header className="hero" style={{ position: "relative" }}>
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      <p className="subdate">
        {dateRangeFromDays(days, dateRangeLabel)} · {days.length} days · {cities.size} cities · {flightLegs} legs
      </p>
      {highlight && <p className="hero-chip">{highlight}</p>}

      <RouteStepper countries={deriveCountries(route, groups)} />
      <div className="view-row">
        <button ref={filterRef} type="button" className="btn" aria-pressed={onlyGaps} onClick={() => onOnlyGapsChange(!onlyGaps)}>
          {onlyGaps ? "Show all days" : "Only gaps"}
        </button>
        {daysControl && (
          <button type="button" className="btn" onClick={daysControl.toggle}>
            {daysControl.allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
        {slug && <ExportMenu slug={slug} />}
      </div>
    </header>
  );
}
