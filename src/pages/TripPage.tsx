import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { TripHeader } from "../components/trip/TripHeader";
import { AlertsPanel } from "../components/trip/AlertsPanel";
import { DetailedView } from "../components/trip/DetailedView";
import { ActionItems } from "../components/trip/ActionItems";
import { TripMap } from "../components/trip/TripMap";
import { TripNote } from "../components/trip/TripNote";
import { TripEntryBoundary } from "../components/trip/TripEntryBoundary";
import { useTrip } from "../hooks/useTrip";
import { useRememberTab } from "../hooks/useRememberTab";
import { useResolvedDays } from "../hooks/useResolvedDays";
import { useTasks } from "../hooks/useTasks";
import { useShareLinkFocus } from "../hooks/useShareLinkFocus";
import { useActionItemEdits } from "../hooks/useActionItemEdits";
import { useActivityEdits } from "../hooks/useActivityEdits";
import { useTripWeather } from "../hooks/useTripWeather";
import { todayISO } from "../lib/dueDates";
import { assignLegColors } from "../lib/tripLogic";
import { dayGaps, gapDates } from "../lib/tasks";
import { MAP_FOCUS_EVENT, deriveTaskPoints, derivePoints, deriveRouteAddresses, deriveWeatherStops, focusOnMapKey } from "../lib/mapPoints";
import { TripTabs } from "../components/trip/TripTabs";
import { TRIP_TABS, tripPanelId, tripTabId, type TripTab } from "../lib/tripTabs";
import { useAiFocus } from "../hooks/useAiFocus";
import { NotFoundOrDenied } from "./NotFoundOrDenied";
import { useAction } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { cachedPhotos } from "../lib/cityPhoto";

export function TripPage() {
  return <TripEntryBoundary><TripPageEntry /></TripEntryBoundary>;
}

function TripPageEntry() {
  const { slug } = useParams<{ slug: string }>();
  const { trip, isLoading } = useTrip(slug);
  useRememberTab(trip ? `/trip/${slug}` : null);

  const [onlyGaps, setOnlyGaps] = useState(false);

  // Agenda / Map / Notes, kept in the URL (?tab=) so a reload or a shared link keeps the view.
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab") as TripTab | null;
  const tab: TripTab = asked && TRIP_TABS.includes(asked) ? asked : "agenda";
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const setTab = useCallback(
    (next: TripTab) =>
      setParams((p) => {
        const q = new URLSearchParams(p);
        if (next === "agenda") q.delete("tab");
        else q.set("tab", next);
        return q;
      }, { replace: true }),
    [setParams]
  );
  // "Show on the trip map" from the agenda: open the Map tab, then hand it the place once it is there.
  const pendingMapKey = useRef<string | null>(null);
  useEffect(() => {
    const onFocus = (e: Event) => {
      if (tabRef.current === "map") return;
      pendingMapKey.current = (e as CustomEvent<string>).detail;
      setTab("map");
    };
    window.addEventListener(MAP_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(MAP_FOCUS_EVENT, onFocus);
  }, [setTab]);
  useEffect(() => {
    if (tab !== "map" || !pendingMapKey.current) return;
    const key = pendingMapKey.current;
    pendingMapKey.current = null;
    focusOnMapKey(key);
  }, [tab]);
  // A shared link, the AI or the map's "See in itinerary" points at a day, tile or task: show the agenda.
  const pointers = [useAiFocus("day").focus, useAiFocus("tile").focus, useAiFocus("task").focus, useAiFocus("actionItem").focus];
  const pointed = pointers.find(Boolean)?.nonce;
  useEffect(() => {
    if (pointed && tabRef.current !== "agenda") setTab("agenda");
  }, [pointed, setTab]);
  const filterRef = useRef<HTMLButtonElement>(null);

  const resolvedDays = useResolvedDays(trip);
  const legColors = assignLegColors(resolvedDays);
  const today = todayISO();
  const { tasks, loaded, ticks, done, setDone, setDue, toggleTick: toggle, toggleActionItem, vote, pendingVotes, setOutcome } = useTasks(slug || "", today);
  useShareLinkFocus(slug, !!trip && loaded);
  // "Only gaps" follows the task list, so it can't disagree with Action Items.
  const isGap = useMemo(() => {
    if (!loaded) return undefined;
    const dates = gapDates(tasks);
    return (day: { date: string }) => dates.has(day.date);
  }, [loaded, tasks]);
  const gapsByDate = useMemo(() => dayGaps(tasks), [tasks]);
  const { addItem, updateItem, removeItem, promoteItem } = useActionItemEdits(slug || "");
  // Every stored item by id: an itinerary entry approved from one shows its wording and votes as History.
  // Day headers' city photos: one request per city while the page is open.
  const getCityPhoto = useAction(api.cityPhotos.getCityPhoto);
  const { code } = useAccessCode();
  const cityPhoto = useMemo(() => cachedPhotos((city, country) => getCityPhoto({ slug: slug || "", code, city, country })), [getCityPhoto, slug, code]);
  const itemTasks = useMemo(() => Object.fromEntries(tasks.filter((t) => t.key.startsWith("item:")).map((t) => [t.key.slice("item:".length), t])), [tasks]);
  const { updateActivity } = useActivityEdits(slug || "");
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

  const mapPlanPoints = derivePoints(resolvedDays, trip.mapPoints);

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

      <TripTabs tab={tab} onChange={setTab} />

      {tab === "agenda" && (
        <div role="tabpanel" id={tripPanelId("agenda")} aria-labelledby={tripTabId("agenda")}>
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

          <Fragment key={trip._id}>
            <DetailedView
              days={resolvedDays}
              legColors={legColors}
              weather={weather}
              groups={trip.groups}
              ticks={ticks}
              onlyGaps={onlyGaps}
              isGap={isGap}
              dayGaps={gapsByDate}
              onToggle={toggle}
              onOnlyGapsChange={setOnlyGaps}
              filterRef={filterRef}
              actionItems={(trip.actionItems || []).filter((i) => i.kind !== "consider")}
              considerations={tasks.filter((t) => t.kind === "consider" && t.outcome !== "dropped")}
              pendingVotes={pendingVotes}
              onVote={vote}
              actionItemsDone={done}
              onToggleActionItem={toggleActionItem}
              onEditActivity={updateActivity}
              itemTasks={itemTasks}
              onPromote={promoteItem}
              cityPhoto={cityPhoto}
            />
          </Fragment>

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
            pendingVotes={pendingVotes}
            onVote={vote}
            onSetOutcome={setOutcome}
          />

          <footer>
            Trip content is stored in Convex — ask to have a change made rather than editing code. Check-offs are saved
            for everyone with access to this trip.
          </footer>
        </div>
      )}
      {tab === "map" && (
        <div role="tabpanel" id={tripPanelId("map")} aria-labelledby={tripTabId("map")}>
          <TripMap
            points={mapPlanPoints}
            days={resolvedDays}
            route={deriveRouteAddresses(resolvedDays)}
            weatherStops={weatherStops}
            candidates={deriveTaskPoints(tasks, mapPlanPoints)}
            considerations={tasks.filter((t) => !!t.places?.length)}
          />
        </div>
      )}
      {tab === "notes" && (
        <div role="tabpanel" id={tripPanelId("notes")} aria-labelledby={tripTabId("notes")}>
          <TripNote slug={slug || ""} inline />
        </div>
      )}

      {tab !== "notes" && <TripNote slug={slug || ""} />}
    </PageShell>
  );
}
