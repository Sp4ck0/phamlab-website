import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { TripHeader } from "../components/trip/TripHeader";
import { AlertsPanel } from "../components/trip/AlertsPanel";
import { Controls } from "../components/trip/Controls";
import { OverviewList } from "../components/trip/OverviewList";
import { DetailedView } from "../components/trip/DetailedView";
import { Roster } from "../components/trip/Roster";
import { ActionItems } from "../components/trip/ActionItems";
import { TripMap } from "../components/trip/TripMap";
import type { TripView } from "../components/trip/ViewToggle";
import { useTrip } from "../hooks/useTrip";
import { useResolvedDays } from "../hooks/useResolvedDays";
import { useTicks } from "../hooks/useTicks";
import { useTripGaps } from "../hooks/useTripGaps";
import { useTheme } from "../hooks/useTheme";
import { useActionItems } from "../hooks/useActionItems";
import { assignLegColors } from "../lib/tripLogic";
import { derivePoints } from "../lib/mapPoints";
import { NotFoundOrDenied } from "./NotFoundOrDenied";

export function TripPage() {
  const { slug } = useParams<{ slug: string }>();
  const { trip, isLoading } = useTrip(slug);
  const [searchParams, setSearchParams] = useSearchParams();
  const view: TripView = searchParams.get("view") === "detailed" ? "detailed" : "overview";

  const [onlyGaps, setOnlyGaps] = useState(false);
  const [pendingScrollTo, setPendingScrollTo] = useState<string | null>(null);

  const { isDark, toggle: toggleTheme } = useTheme();
  const resolvedDays = useResolvedDays(trip);
  const legColors = assignLegColors(resolvedDays);
  const { ticks, toggle } = useTicks(slug || "");
  const gaps = useTripGaps(resolvedDays, ticks);
  const { done, toggle: toggleActionItem } = useActionItems(slug || "");

  function setView(v: TripView) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("view", v);
        return p;
      },
      { replace: true }
    );
  }

  function jumpToDay(dayId: string) {
    setView("detailed");
    setPendingScrollTo(dayId);
  }

  // Scroll to the requested day only after the Detailed view has actually
  // rendered (switching view is a re-render, not a synchronous DOM change).
  useEffect(() => {
    if (view === "detailed" && pendingScrollTo) {
      const el = document.getElementById(pendingScrollTo);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollTo(null);
    }
  }, [view, pendingScrollTo]);

  if (isLoading) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  if (!trip) {
    return (
      <PageShell>
        <NotFoundOrDenied />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TripHeader
        kicker={trip.kicker}
        title={trip.title}
        titleEmphasis={trip.titleEmphasis}
        dateRangeLabel={trip.dateRangeLabel}
        days={trip.days}
        highlightStat={trip.highlightStat}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        view={view}
        onViewChange={setView}
      />

      <Roster groups={trip.groups} />

      <AlertsPanel conflicts={trip.conflicts} />

      <Controls onlyGaps={onlyGaps} onOnlyGapsChange={setOnlyGaps} showOnlyGaps={view === "detailed"} />

      {view === "overview" ? (
        <OverviewList days={resolvedDays} legColors={legColors} onJump={jumpToDay} />
      ) : (
        <DetailedView
          days={resolvedDays}
          legColors={legColors}
          groups={trip.groups}
          ticks={ticks}
          onlyGaps={onlyGaps}
          onToggle={toggle}
          onJump={jumpToDay}
        />
      )}

      <TripMap points={derivePoints(resolvedDays, trip.mapPoints)} />

      <ActionItems
        gaps={gaps}
        groups={trip.groups}
        ticks={ticks}
        onToggleGap={toggle}
        items={trip.actionItems || []}
        done={done}
        onToggleItem={toggleActionItem}
      />

      <footer>
        Trip content is stored in Convex — ask to have a change made rather than editing code. Quick ticks are
        stored in localStorage, per device.
      </footer>
    </PageShell>
  );
}
