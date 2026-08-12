import type { Day, HighlightStat } from "../../lib/types";
import { assignLegColors, deriveRoute, renderCountdown } from "../../lib/tripLogic";
import { RouteStepper } from "./RouteStepper";
import { StatTiles } from "./StatTiles";
import { ThemeToggle } from "../layout/ThemeToggle";
import { ViewToggle, type TripView } from "./ViewToggle";

export function TripHeader({
  kicker,
  title,
  titleEmphasis,
  dateRangeLabel,
  days,
  highlightStat,
  isDark,
  onToggleTheme,
  view,
  onViewChange,
}: {
  kicker: string;
  title: string;
  titleEmphasis: string;
  dateRangeLabel: string;
  days: Day[];
  highlightStat?: HighlightStat;
  isDark: boolean;
  onToggleTheme: () => void;
  view: TripView;
  onViewChange: (v: TripView) => void;
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
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      <p className="eyebrow">{kicker}</p>
      <h1>
        {title} {titleEmphasis}
      </h1>
      <p className="subdate">
        {dateRangeLabel} · {days.length} days
      </p>

      <RouteStepper stops={route} />
      <StatTiles stats={stats} />
      <ViewToggle view={view} onChange={onViewChange} />
    </header>
  );
}
