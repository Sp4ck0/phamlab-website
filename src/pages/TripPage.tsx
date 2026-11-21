import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { tabFromHash, tripPanelId, tripTabId, withTab, type TripTab } from "../lib/tripTabs";
import { useAiFocus } from "../hooks/useAiFocus";
import { NotFoundOrDenied } from "./NotFoundOrDenied";
import { useAction } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { batchedPhotos } from "../lib/cityPhoto";

export function TripPage() {
  return <TripEntryBoundary><TripPageEntry /></TripEntryBoundary>;
}

function TripPageEntry() {
  const { slug } = useParams<{ slug: string }>();
  const { trip, isLoading } = useTrip(slug);
  useRememberTab(trip ? `/trip/${slug}` : null);

  const [onlyGaps, setOnlyGaps] = useState(false);

  // Agenda / Map / Notes. The choice is mirrored into the URL (?tab=) so a reload or a shared link
  // keeps the view, but quietly: through the router it would count as a new page, which scrolls to
  // the top and rebuilds the whole trip page.
  const [params] = useSearchParams();
  const [tab, setTabState] = useState<TripTab>(() => tabFromHash(`?${params.toString()}`));
  const tabRef = useRef(tab);
  tabRef.current = tab;
  // Each tab keeps its own scroll position; one not opened yet starts with the tab bar in view.
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrolls = useRef<Partial<Record<TripTab, number>>>({});
  const setTab = useCallback((next: TripTab) => {
    if (next === tabRef.current) return;
    scrolls.current[tabRef.current] = window.scrollY;
    setTabState(next);
    window.history.replaceState(window.history.state, "", withTab(window.location.href, next));
  }, []);
  const firstTab = useRef(true);
  useLayoutEffect(() => {
    if (firstTab.current) { firstTab.current = false; return; }
    const saved = scrolls.current[tab];
    const bar = tabsRef.current;
    const panel = document.getElementById(tripPanelId(tab));
    const pinned = bar && getComputedStyle(bar).position === "sticky";
    const above = pinned ? bar.getBoundingClientRect().bottom + 8 : 64;
    const top = saved ?? (panel ? Math.min(window.scrollY, panel.getBoundingClientRect().top + window.scrollY - above) : window.scrollY);
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, [tab]);
  // The agenda and map stay mounted once shown, so coming back is instant; the map loads on first visit.
  // (The note stays unmounted when hidden: the floating note is shown then, and two editors of one note would diverge.)
  const [seen, setSeen] = useState<Partial<Record<TripTab, true>>>({ agenda: true });
  useEffect(() => { if (!seen[tab]) setSeen((s) => ({ ...s, [tab]: true })); }, [tab, seen]);
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
  // Day headers' city photos and tiles' place photos: each asked for once while the page is open,
  // in one call for whatever scrolled into view together.
  const getCityPhotos = useAction(api.cityPhotos.getCityPhotos);
  const getPlacePhotos = useAction(api.cityPhotos.getPlacePhotos);
  const { code } = useAccessCode();
  const cityPhoto = useMemo(() => {
    const one = batchedPhotos((c: { city: string; country: string }) => `${c.city}|${c.country}`, (cities) => getCityPhotos({ slug: slug || "", code, cities }));
    return (city: string, country: string) => one({ city, country });
  }, [getCityPhotos, slug, code]);
  const placePhoto = useMemo(() => batchedPhotos((placeId: string) => placeId, (placeIds) => getPlacePhotos({ slug: slug || "", code, placeIds })), [getPlacePhotos, slug, code]);
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
      <div className="trip-page" data-tab={tab}>
        {/* Phones show the trip summary on the Agenda tab only (CSS): the map and the note start under the tabs. */}
        <div className="trip-summary">
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
        </div>

        {/* Phones: moved to the top of the page and pinned under the site menu (CSS). */}
        <div className="trip-tabs-bar" ref={tabsRef}>
          <TripTabs tab={tab} onChange={setTab} />
        </div>

        <div role="tabpanel" id={tripPanelId("agenda")} aria-labelledby={tripTabId("agenda")} hidden={tab !== "agenda"}>
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
              placePhoto={placePhoto}
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
        {(seen.map || tab === "map") && (
          <div role="tabpanel" id={tripPanelId("map")} aria-labelledby={tripTabId("map")} hidden={tab !== "map"}>
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
      </div>
    </PageShell>
  );
}
