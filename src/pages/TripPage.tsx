import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { TripHeader } from "../components/trip/TripHeader";
import { AlertsPanel } from "../components/trip/AlertsPanel";
import { Controls } from "../components/trip/Controls";
import { TripTimeline } from "../components/trip/TripTimeline";
import { GridTable } from "../components/trip/GridTable";
import { Roster } from "../components/trip/Roster";
import { useTrip } from "../hooks/useTrip";
import { useResolvedDays } from "../hooks/useResolvedDays";
import { useTicks } from "../hooks/useTicks";
import { useTripGaps } from "../hooks/useTripGaps";
import { NotFoundOrDenied } from "./NotFoundOrDenied";

export function TripPage() {
  const { slug } = useParams<{ slug: string }>();
  const { trip, isLoading } = useTrip(slug);
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") === "grid" ? "grid" : "timeline";

  const [activeGroup, setActiveGroup] = useState("all");
  const [onlyGaps, setOnlyGaps] = useState(false);

  const resolvedDays = useResolvedDays(trip);
  const { ticks, toggle } = useTicks(slug || "");
  const gaps = useTripGaps(resolvedDays, trip?.groups || [], activeGroup, ticks);

  // Preserve the original CSS's body[data-view] hooks (horizontal-scroll
  // toggle in grid view, sticky-header offsets) without touching styles.css.
  useEffect(() => {
    document.body.dataset.view = view;
    return () => {
      delete document.body.dataset.view;
    };
  }, [view]);

  // Reset the group filter when navigating between trips.
  useEffect(() => {
    setActiveGroup("all");
  }, [slug]);

  if (isLoading) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--ink-faint)" }}>Loading…</div>
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
        citiesLabel={trip.citiesLabel}
        groups={trip.groups}
        days={trip.days}
      />

      <AlertsPanel gaps={gaps} conflicts={trip.conflicts} groups={trip.groups} activeGroup={activeGroup} />

      <Controls
        groups={trip.groups}
        activeGroup={activeGroup}
        onActiveGroupChange={setActiveGroup}
        onlyGaps={onlyGaps}
        onOnlyGapsChange={setOnlyGaps}
      />

      {view === "grid" ? (
        <GridTable days={resolvedDays} groups={trip.groups} activeGroup={activeGroup} ticks={ticks} />
      ) : (
        <TripTimeline
          days={resolvedDays}
          groups={trip.groups}
          activeGroup={activeGroup}
          ticks={ticks}
          onlyGaps={onlyGaps}
          onToggle={toggle}
        />
      )}

      <Roster groups={trip.groups} resolvedDays={resolvedDays} ticks={ticks} sdek={trip.sdek} />

      <footer>
        <b>Editing this trip:</b> trip content is stored in Convex — ask to have a change made rather than editing
        code.
        <br />
        Quick ticks in the browser are stored in localStorage, per device.
      </footer>
    </PageShell>
  );
}
