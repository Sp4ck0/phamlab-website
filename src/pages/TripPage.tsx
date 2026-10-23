import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { TripHeader } from "../components/trip/TripHeader";
import { AlertsPanel } from "../components/trip/AlertsPanel";
import { OverviewList } from "../components/trip/OverviewList";
import { DetailedView } from "../components/trip/DetailedView";
import { ActionItems } from "../components/trip/ActionItems";
import { TripMap } from "../components/trip/TripMap";
import type { TripView } from "../components/trip/ViewToggle";
import { useTrip } from "../hooks/useTrip";
import { useResolvedDays } from "../hooks/useResolvedDays";
import { useChecks } from "../hooks/useChecks";
import { useTripGaps } from "../hooks/useTripGaps";
import { useDueDates } from "../hooks/useDueDates";
import { useTripWeather } from "../hooks/useTripWeather";
import { todayISO } from "../lib/dueDates";
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

  const resolvedDays = useResolvedDays(trip);
  const legColors = assignLegColors(resolvedDays);
  const { ticks, toggleTick: toggle, done, toggleActionItem } = useChecks(slug || "");
  const today = todayISO();
  const gaps = useTripGaps(resolvedDays, ticks, today);
  const { overrides: dueOverrides, setDue } = useDueDates(slug || "");
  const weather = useTripWeather(slug);

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
        groups={trip.groups}
        view={view}
        onViewChange={setView}
        onlyGaps={onlyGaps}
        onOnlyGapsChange={setOnlyGaps}
      />

      <AlertsPanel conflicts={trip.conflicts} />

      {view === "overview" ? (
        <OverviewList days={resolvedDays} legColors={legColors} weather={weather} onJump={jumpToDay} />
      ) : (
        <DetailedView
          days={resolvedDays}
          legColors={legColors}
          weather={weather}
          groups={trip.groups}
          ticks={ticks}
          onlyGaps={onlyGaps}
          onToggle={toggle}
          onJump={jumpToDay}
          actionItems={trip.actionItems || []}
          actionItemsDone={done}
          onToggleActionItem={toggleActionItem}
        />
      )}

      <TripMap points={derivePoints(resolvedDays, trip.mapPoints)} />

      <ActionItems
        gaps={gaps}
        groups={trip.groups}
        onToggleGap={toggle}
        items={trip.actionItems || []}
        done={done}
        onToggleItem={toggleActionItem}
        today={today}
        defaultDue={trip.days[0]?.date ?? today}
        dueOverrides={dueOverrides}
        onSetDue={setDue}
      />

      <footer>
        Trip content is stored in Convex — ask to have a change made rather than editing code. Check-offs are saved
        for everyone with access to this trip.
      </footer>
    </PageShell>
  );
}
