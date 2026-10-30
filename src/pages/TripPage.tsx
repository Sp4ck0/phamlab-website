import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { TripHeader } from "../components/trip/TripHeader";
import { AlertsPanel } from "../components/trip/AlertsPanel";
import { DetailedView } from "../components/trip/DetailedView";
import { ActionItems } from "../components/trip/ActionItems";
import { TripMap } from "../components/trip/TripMap";
import { ItineraryStart, TripEntryBoundary } from "../components/trip/TripEntryBoundary";
import { useTrip } from "../hooks/useTrip";
import { useRememberTab } from "../hooks/useRememberTab";
import { useResolvedDays } from "../hooks/useResolvedDays";
import { useTasks } from "../hooks/useTasks";
import { useActionItemEdits } from "../hooks/useActionItemEdits";
import { useTripWeather } from "../hooks/useTripWeather";
import { todayISO } from "../lib/dueDates";
import { assignLegColors } from "../lib/tripLogic";
import { gapDates } from "../lib/tasks";
import { derivePoints, deriveRouteAddresses, deriveWeatherStops } from "../lib/mapPoints";
import { NotFoundOrDenied } from "./NotFoundOrDenied";

export function TripPage() {
  return <TripEntryBoundary><TripPageEntry /></TripEntryBoundary>;
}

function TripPageEntry() {
  const { slug } = useParams<{ slug: string }>();
  const { trip, isLoading } = useTrip(slug);
  useRememberTab(trip ? `/trip/${slug}` : null);

  const [onlyGaps, setOnlyGaps] = useState(false);
  const filterRef = useRef<HTMLButtonElement>(null);

  const resolvedDays = useResolvedDays(trip);
  const legColors = assignLegColors(resolvedDays);
  const today = todayISO();
  const { tasks, loaded, ticks, done, setDone, setDue, toggleTick: toggle, toggleActionItem } = useTasks(slug || "", today);
  // "Only gaps" follows the task list, so it can't disagree with Action Items.
  const isGap = useMemo(() => {
    if (!loaded) return undefined;
    const dates = gapDates(tasks);
    return (day: { date: string }) => dates.has(day.date);
  }, [loaded, tasks]);
  const { addItem, updateItem, removeItem } = useActionItemEdits(slug || "");
  const weather = useTripWeather(slug);
  const weatherStops = useMemo(() => deriveWeatherStops(resolvedDays, weather), [resolvedDays, weather]);

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
        dateRangeLabel={trip.dateRangeLabel}
        days={trip.days}
        highlightStat={trip.highlightStat}
        groups={trip.groups}
        filterRef={filterRef}
        onlyGaps={onlyGaps}
        onOnlyGapsChange={setOnlyGaps}
      />

      <AlertsPanel
        tasks={tasks}
        items={trip.actionItems || []}
        groups={trip.groups}
        tripStart={trip.days[0]?.date ?? today}
        tripEnd={trip.days[trip.days.length - 1]?.date ?? today}
        onSetDone={setDone}
        onSetDue={setDue}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <ItineraryStart key={trip._id}>
        <DetailedView
          days={resolvedDays}
          legColors={legColors}
          weather={weather}
          groups={trip.groups}
          ticks={ticks}
          onlyGaps={onlyGaps}
          isGap={isGap}
          onToggle={toggle}
          onOnlyGapsChange={setOnlyGaps}
          filterRef={filterRef}
          actionItems={trip.actionItems || []}
          actionItemsDone={done}
          onToggleActionItem={toggleActionItem}
        />
      </ItineraryStart>

      <TripMap
        points={derivePoints(resolvedDays, trip.mapPoints)}
        route={deriveRouteAddresses(resolvedDays)}
        weatherStops={weatherStops}
      />

      <ActionItems
        tasks={tasks}
        items={trip.actionItems || []}
        groups={trip.groups}
        onSetDone={setDone}
        today={today}
        defaultDue={trip.days[0]?.date ?? today}
        onSetDue={setDue}
        tripStart={trip.days[0]?.date ?? today}
        tripEnd={trip.days[trip.days.length - 1]?.date ?? today}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <footer>
        Trip content is stored in Convex — ask to have a change made rather than editing code. Check-offs are saved
        for everyone with access to this trip.
      </footer>
    </PageShell>
  );
}
