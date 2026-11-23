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
import { dayGaps, gapDates, isProposed } from "../lib/tasks";
import { MAP_FOCUS_EVENT, addMarks, deriveTaskPoints, derivePoints, deriveRouteAddresses, deriveWeatherStops, focusOnMapKey, type MapMark } from "../lib/mapPoints";
import { TripTabs } from "../components/trip/TripTabs";
import { tabFromHash, tripPanelId, tripTabId, withTab, type TripTab } from "../lib/tripTabs";
import { useAiFocus } from "../hooks/useAiFocus";
import { NotFoundOrDenied } from "./NotFoundOrDenied";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { batchedPhotos } from "../lib/cityPhoto";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePinMap, usePinMapSide } from "../lib/pinMap";
import { useScrollLinkedBars } from "../lib/hideBars";

// Where "Show on the trip map" scrolls to on desktop, where the map sits above the day picker.
const TRIP_MAP_ID = "trip-map";

export function TripPage() {
  return <TripEntryBoundary><TripPageEntry /></TripEntryBoundary>;
}

function TripPageEntry() {
  const { slug } = useParams<{ slug: string }>();
  const { trip, isLoading } = useTrip(slug);
  useRememberTab(trip ? `/trip/${slug}` : null);

  const [onlyGaps, setOnlyGaps] = useState(false);

  // Agenda / Tasks / Map / Notes. The choice is mirrored into the URL (?tab=) so a reload or a shared link
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
  // Desktop has room for everything on one page: no tabs, the map above the day picker, the floating note.
  // The tabs are for phones and tablets: up to the width where the site menu turns into a side bar (globals.css 780px).
  const desktop = useMediaQuery("(min-width: 781px)");
  const desktopRef = useRef(desktop);
  desktopRef.current = desktop;
  // Desktop can pin the map above the date strip; it then follows the day and tile being looked at.
  const [pinMap, setPinMap] = usePinMap();
  const pinned = desktop && pinMap;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  // A wide window can pin it at the side instead: itinerary on the left, map down the right.
  const wide = useMediaQuery("(min-width: 1180px)");
  const [pinSide, setPinSide] = usePinMapSide();
  const side = pinned && wide && pinSide;
  // The pinned map's height (on top), for the date strip to sit under it and for jumps to land below both.
  const pageRef = useRef<HTMLDivElement>(null);
  const hasTrip = !!trip;
  // Phones: the tabs and date strip slide up and back with the reader's scrolling.
  useScrollLinkedBars(pageRef, !desktop && hasTrip);
  useEffect(() => {
    const page = pageRef.current, section = document.getElementById(TRIP_MAP_ID);
    if (!pinned || side || !page || !section) return;
    const set = () => page.style.setProperty("--pinned-map-h", `${section.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(section);
    return () => {
      ro.disconnect();
      page.style.removeProperty("--pinned-map-h");
    };
  }, [pinned, side, hasTrip]);
  // "Show on the trip map" from the agenda: on a phone open the Map tab, then hand it the place once it
  // is there; on desktop the map is already on the page (it shows the place itself), so scroll down to it.
  const pendingMapKey = useRef<string | null>(null);
  useEffect(() => {
    const onFocus = (e: Event) => {
      if (desktopRef.current) {
        // A pinned map is already in view.
        if (!pinnedRef.current) document.getElementById(TRIP_MAP_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
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
  // A shared link, the AI or the map's "See in itinerary" points at a day or tile (the agenda) or at a task or
  // action item (the Tasks tab, where its row is).
  const dayPointer = [useAiFocus("day").focus, useAiFocus("tile").focus].find(Boolean)?.nonce;
  const taskPointer = [useAiFocus("task").focus, useAiFocus("actionItem").focus].find(Boolean)?.nonce;
  useEffect(() => {
    if (dayPointer && tabRef.current !== "agenda") setTab("agenda");
  }, [dayPointer, setTab]);
  useEffect(() => {
    if (taskPointer && tabRef.current !== "tasks") setTab("tasks");
  }, [taskPointer, setTab]);
  // Places the AI marked (mark_on_map), kept only while this page is open: gone on reload or
  // when the tab closes, and not carried to another trip. Each call adds its places, opens the
  // map (the Map tab on a phone; on desktop, scrolls to it unless pinned) and has it fit them.
  const [marks, setMarks] = useState<MapMark[]>([]);
  const [fitMarks, setFitMarks] = useState<string | null>(null);
  useEffect(() => {
    setMarks([]);
    setFitMarks(null);
  }, [slug]);
  const { focus: markFocus, consume: consumeMark } = useAiFocus("mark");
  useEffect(() => {
    if (!markFocus) return;
    consumeMark(markFocus.nonce);
    setMarks((m) => addMarks(m, markFocus.target.places, markFocus.nonce, Date.now(), markFocus.target.icon));
    setFitMarks(markFocus.nonce);
    if (desktopRef.current) {
      if (!pinnedRef.current) document.getElementById(TRIP_MAP_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (tabRef.current !== "map") setTab("map");
  }, [markFocus, consumeMark, setTab]);
  // clear_map_markers: drop every mark (itinerary pins aren't marks) and tell the AI how many went.
  const { code } = useAccessCode();
  const reportCleared = useMutation(api.mcpFocus.reportCleared);
  const { focus: clearFocus, consume: consumeClear } = useAiFocus("clearMarks");
  useEffect(() => {
    if (!clearFocus) return;
    consumeClear(clearFocus.nonce);
    setMarks([]);
    setFitMarks(null);
    void reportCleared({ ...(code ? { code } : {}), nonce: clearFocus.nonce, count: marks.length });
  }, [clearFocus, consumeClear, reportCleared, code, marks.length]);
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
  const { addItem, updateItem, removeItem, promoteItem, unpromoteItem } = useActionItemEdits(slug || "");
  // Every stored item by id: an itinerary entry approved from one shows its wording and votes as History.
  // Day headers' city photos and tiles' place photos: each asked for once while the page is open,
  // in one call for whatever scrolled into view together.
  const getCityPhotos = useAction(api.cityPhotos.getCityPhotos);
  const getPlacePhotos = useAction(api.cityPhotos.getPlacePhotos);
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

  const mapPlanPoints = derivePoints(resolvedDays);
  const map = (
    <TripMap
      points={mapPlanPoints}
      days={resolvedDays}
      route={deriveRouteAddresses(resolvedDays)}
      weatherStops={weatherStops}
      candidates={deriveTaskPoints(tasks, mapPlanPoints)}
      considerations={tasks.filter((t) => !!t.places?.length)}
      pin={desktop ? { on: pinMap, set: setPinMap, side: wide ? { on: pinSide, set: setPinSide } : undefined } : undefined}
      marks={marks}
      fitMarks={fitMarks}
      onMarksFitted={() => setFitMarks(null)}
      onClearMarks={() => {
        setMarks([]);
        setFitMarks(null);
      }}
    />
  );
  // The High priority panel and the two lists (action items, proposed items): on desktop part of the one page,
  // on a phone the Tasks tab.
  const alerts = (
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
  );
  const taskLists = (
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
    days={resolvedDays}
    onPromote={promoteItem}
    onUnpromote={unpromoteItem}
  />
  );
  // On a phone, the agenda is a tab panel; on desktop it is just the page.
  const agendaPanel = desktop
    ? {}
    : { role: "tabpanel", id: tripPanelId("agenda"), "aria-labelledby": tripTabId("agenda"), hidden: tab !== "agenda" };

  return (
    <PageShell>
      <div ref={pageRef} className={`trip-page${pinned ? " map-pinned" : ""}${side ? " map-side" : ""}`} data-tab={desktop ? "agenda" : tab}>
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

        {/* Phones only: moved to the top of the page and pinned under the site menu (CSS). */}
        {/* The spacer before it is where hideBars.ts puts the room that moves it while it scrolls away. */}
        {!desktop && <div className="trip-bars-spacer" aria-hidden="true" />}
        {!desktop && (
          <div className="trip-tabs-bar" ref={tabsRef}>
            <TripTabs tab={tab} onChange={setTab} />
          </div>
        )}

        <div {...agendaPanel}>
          {desktop && alerts}

          {/* Desktop: the map between the trip summary and the day picker (TripMap has its own heading). */}
          {desktop && (
            <section className="trip-map-section" id={TRIP_MAP_ID}>
              {map}
            </section>
          )}

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
              actionItems={(trip.actionItems || []).filter((i) => !isProposed(i.kind))}
              considerations={tasks.filter((t) => isProposed(t.kind) && t.outcome !== "dropped")}
              pendingVotes={pendingVotes}
              onVote={vote}
              actionItemsDone={done}
              onToggleActionItem={toggleActionItem}
              onEditActivity={updateActivity}
              itemTasks={itemTasks}
              onPromote={promoteItem}
              onUnpromote={unpromoteItem}
              onSetOutcome={setOutcome}
              cityPhoto={cityPhoto}
              placePhoto={placePhoto}
            />
          </Fragment>

          {desktop && taskLists}

          <footer>
            Trip content is stored in Convex — ask to have a change made rather than editing code. Check-offs are saved
            for everyone with access to this trip.
          </footer>
        </div>
        {!desktop && (
          <div role="tabpanel" id={tripPanelId("tasks")} aria-labelledby={tripTabId("tasks")} hidden={tab !== "tasks"}>
            {alerts}
            {taskLists}
          </div>
        )}
        {!desktop && (seen.map || tab === "map") && (
          <div role="tabpanel" id={tripPanelId("map")} aria-labelledby={tripTabId("map")} hidden={tab !== "map"}>
            {map}
          </div>
        )}
        {!desktop && tab === "notes" && (
          <div role="tabpanel" id={tripPanelId("notes")} aria-labelledby={tripTabId("notes")}>
            <TripNote slug={slug || ""} inline />
          </div>
        )}

        {(desktop || tab !== "notes") && <TripNote slug={slug || ""} />}
      </div>
    </PageShell>
  );
}
