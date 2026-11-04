import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useShowAiFocus } from "../../hooks/useAiFocus";
import type { MapPointData, Task } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, MAP_FOCUS_EVENT, googleMapsUrl, placeKey } from "../../lib/mapPoints";
import type { WeatherStop } from "../../lib/mapPoints";
import { fmtShort } from "../../lib/tripLogic";
import { summarizeStay, temp, weatherIcon, weatherText } from "../../lib/weather";
import { useGeocodedPoints } from "../../hooks/useGeocodedPoints";
import { useSettings, type TempUnit } from "../../hooks/useSettings";
import { loadGoogleMaps } from "../../lib/googleMaps";

const ARROW_SPACING_PX = 28;
// Weather pills float this far above their city pin (matches .map-weather-pill's transform);
// the info window is lifted by the same amount plus the pill's height so it opens above the pill.
const PILL_INFO_OFFSET_PX = 42;
const PILL_LIFT_PX = 14; // gap between pill and pin; matches .map-weather-pill's transform
const PILL_GAP_PX = 4; // minimum clear space between pills before one is hidden
const COMPACT_ZOOM_MAX = 6; // at or below this zoom, pills show just emoji + high

interface PillEntry {
  el: HTMLElement;
  overlay: google.maps.OverlayView;
  position: google.maps.LatLngLiteral;
  priority: number;
  full: string;
  compact: string;
}

interface Props {
  points: MapPointData[];
  route: MapPointData[];
  weatherStops: WeatherStop[];
  // Places of considerations (not in the plan): drawn as rings, with a legend toggle.
  candidates: MapPointData[];
  // The considerations behind them, for the vote tally in a pin's popup.
  considerations: Task[];
}

// A dashed hollow ring for an open candidate, a solid one once chosen: the
// opposite of the filled dots, so it reads as "maybe" at a glance.
function ringIcon(chosen: boolean): string {
  const color = chosen ? "#1baf7a" : "#2a78d6";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">` +
    `<circle cx="13" cy="13" r="9.5" fill="${color}" fill-opacity="${chosen ? 0.3 : 0.12}" stroke="${color}" stroke-width="2.5"` +
    `${chosen ? "" : ' stroke-dasharray="4 3"'}/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Web Mercator in 0..1 world units, so a camera flight can interpolate between places.
function toWorld(p: google.maps.LatLngLiteral) {
  const sin = Math.sin((Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180);
  return { x: (p.lng + 180) / 360, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
}
function fromWorld(x: number, y: number): google.maps.LatLngLiteral {
  const lat = ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
  return { lat, lng: ((((x * 360 - 180 + 180) % 360) + 360) % 360) - 180 };
}

// Smoothly flies the camera to a place, instead of the pan-then-snap-zoom the
// Maps API does on its own (panTo only animates short hops, setZoom never does).
// A nearby place gets a gentle glide and zoom; a far one zooms out part-way and
// back in, so you see where it is relative to where you were (van Wijk & Nuij's
// "smooth and efficient zooming and panning", as in Mapbox's flyTo). Dragging or
// scrolling the map takes over; `onDone(false)` then. The returned function
// stops the flight silently (a newer one is starting).
function flyTo(
  map: google.maps.Map,
  to: google.maps.LatLngLiteral,
  toZoom: number,
  onDone: (completed: boolean) => void,
): () => void {
  const div = map.getDiv();
  const z0 = map.getZoom() ?? toZoom;
  const a = toWorld(map.getCenter()?.toJSON() ?? to);
  const b = toWorld(to);
  let dx = b.x - a.x;
  dx -= Math.round(dx); // the short way round the globe
  const dy = b.y - a.y;
  const u1 = Math.hypot(dx, dy) * 256 * 2 ** z0; // distance in pixels at the start zoom
  const w0 = Math.max(div.clientWidth, div.clientHeight, 1);
  const w1 = w0 / 2 ** (toZoom - z0);
  const rho = 1.42;
  const rho2 = rho * rho;

  // frac: how far along the line to the target; zoomAt: the zoom, both for flight progress s (0..S).
  let S = Math.abs(toZoom - z0) / 1.2;
  let frac = (s: number) => (S > 0 ? s / S : 1);
  let zoomAt = (s: number) => z0 + (toZoom - z0) * frac(s);
  if (u1 >= 1) {
    const bb = (i: 0 | 1) => (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
    const r = (i: 0 | 1) => Math.log(Math.sqrt(bb(i) ** 2 + 1) - bb(i));
    const r0 = r(0);
    const total = (r(1) - r0) / rho;
    if (Number.isFinite(total) && total > 0) {
      S = total;
      frac = (s) => (w0 * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0))) / rho2 / u1;
      zoomAt = (s) => z0 + Math.log2(Math.cosh(r0 + rho * s) / Math.cosh(r0));
    }
  }
  if (u1 < 1 && Math.abs(toZoom - z0) < 0.01) {
    onDone(true);
    return () => {};
  }

  // Raster maps only show in-between zooms when asked to; back to whole zooms afterwards.
  map.setOptions({ isFractionalZoomEnabled: true });
  const duration = Math.min(1800, Math.max(700, S * 400));
  const start = performance.now();
  let raf = 0;
  let stopped = false;
  const listeners: google.maps.MapsEventListener[] = [];
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    listeners.forEach((l) => l.remove());
    div.removeEventListener("wheel", interrupt);
    map.setOptions({ isFractionalZoomEnabled: false });
  };
  const interrupt = () => {
    if (stopped) return;
    stop();
    onDone(false);
  };
  listeners.push(map.addListener("dragstart", interrupt));
  div.addEventListener("wheel", interrupt, { passive: true });

  const tick = (now: number) => {
    if (stopped) return;
    const t = Math.min(1, (now - start) / duration);
    if (t >= 1) {
      map.moveCamera({ center: to, zoom: toZoom });
      stop();
      onDone(true);
      return;
    }
    const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // ease in-out
    const s = k * S;
    const f = frac(s);
    map.moveCamera({ center: fromWorld(a.x + dx * f, a.y + dy * f), zoom: Math.max(2, zoomAt(s)) });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (!stopped) stop();
  };
}

export function TripMap({ points, route, weatherStops, candidates, considerations }: Props) {
  const { points: geocoded, status, error } = useGeocodedPoints(points);
  const { points: geocodedRoute } = useGeocodedPoints(route);
  const { points: geocodedWeather } = useGeocodedPoints(weatherStops);
  const { points: geocodedCandidates } = useGeocodedPoints(candidates);
  const [showCandidates, setShowCandidates] = useState(true);
  const candidateMarkers = useRef<google.maps.Marker[]>([]);
  // Read at click time, so a vote that lands later shows in the popup without rebuilding the pins.
  const considerationById = useRef(new Map<string, Task>());
  considerationById.current = new Map(considerations.map((t) => [t.key.slice("item:".length), t]));
  const mapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Pins by place key, so a "show on map" button elsewhere on the page can find its pin.
  const planPins = useRef(new Map<string, google.maps.Marker>());
  const candidatePins = useRef(new Map<string, google.maps.Marker>());
  const candidateKeys = useRef(new Set<string>());
  candidateKeys.current = new Set(geocodedCandidates.map(placeKey).filter((k): k is string => !!k));
  // A focus request for a ring whose layer is switched off: served once the rings are drawn.
  const pendingFocus = useRef<string | null>(null);
  const focusHandler = useRef<(key: string) => void>(() => {});
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  const flight = useRef<(() => void) | null>(null); // stops the camera flight in progress
  const mapInstance = useRef<google.maps.Map | null>(null);
  // One info window shared by every pin and pill, so opening one closes the last.
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const markers = useRef<google.maps.Marker[]>([]);
  const weatherOverlays = useRef<google.maps.OverlayView[]>([]);
  const polyline = useRef<google.maps.Polyline | null>(null);
  const frame = useRef<number | null>(null);
  // Read at click time so a city pin shows weather that arrived after the pin was built.
  const stopsByAddress = useRef(new Map<string, WeatherStop>());
  stopsByAddress.current = new Map(weatherStops.map((s) => [s.address ?? "", s]));
  const { tempUnit } = useSettings();
  const { slug } = useParams();
  const showFocus = useShowAiFocus();
  // The popup's "See in itinerary" / "See in Action Items" buttons are plain HTML inside
  // the Maps info window, so one capture-phase listener on the map wrapper answers them
  // and hands off to the same focus signal the AI and shared links use.
  const jumpRef = useRef<(day?: string, item?: string) => void>(() => {});
  jumpRef.current = (day, item) => {
    if (!slug) return;
    const target = day ? ({ kind: "day", date: day } as const) : item ? ({ kind: "actionItem", id: item } as const) : null;
    if (target) showFocus({ slug, target, nonce: `map-${Date.now()}` });
  };
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-jump-day],[data-jump-item]");
      if (!btn) return;
      infoWindow.current?.close();
      jumpRef.current(btn.dataset.jumpDay, btn.dataset.jumpItem);
    };
    wrap.addEventListener("click", onClick, true);
    return () => wrap.removeEventListener("click", onClick, true);
  }, [status, geocoded.length > 0]);
  // Same click-time read for the unit, so toggling it doesn't rebuild every pin.
  const tempUnitRef = useRef(tempUnit);
  tempUnitRef.current = tempUnit;

  // "Show on map" buttons anywhere on the page announce a place key; the latest handler answers.
  useEffect(() => {
    const onFocus = (e: Event) => focusHandler.current((e as CustomEvent<string>).detail);
    window.addEventListener(MAP_FOCUS_EVENT, onFocus);
    return () => {
      window.removeEventListener(MAP_FOCUS_EVENT, onFocus);
      window.clearTimeout(flashTimer.current);
      flight.current?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") infoWindow.current?.close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "ready" || geocoded.length === 0) {
      // The map's <div> is unmounted while loading; drop the map built on it so
      // the next render builds a fresh one on the new <div> instead of reusing
      // an instance attached to a detached element (a blank map).
      mapInstance.current = null;
      setMapReady(false);
      return;
    }
    if (!mapRef.current) return;
    let cancelled = false;

    (async () => {
      const google = await loadGoogleMaps();
      if (cancelled || !mapRef.current) return;

      if (!mapInstance.current) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          zoom: 13,
        });
        const info = new google.maps.InfoWindow();
        infoWindow.current = info;
        mapInstance.current.addListener("click", () => info.close());
        setMapReady(true);
      }
      const map = mapInstance.current;

      markers.current.forEach((m) => m.setMap(null));
      markers.current = [];
      planPins.current.clear();

      const bounds = new google.maps.LatLngBounds();
      geocoded.forEach((p) => {
        const position = { lat: p.lat, lng: p.lng };
        const marker = new google.maps.Marker({
          map,
          position,
          title: p.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: CATEGORY_COLORS[p.category],
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          const stop = p.category === "city" ? stopsByAddress.current.get(p.address ?? "") : undefined;
          // City dots are just a place on the route; every other pin is a real place worth opening in Google Maps.
          const link = p.category === "city" ? undefined : googleMapsUrl(p);
          openInfo(map, infoHtml(p.name, CATEGORY_LABELS[p.category] + (p.note ? " · " + p.note : ""), tempUnitRef.current, stop, link, { day: /^act-(\d{4}-\d{2}-\d{2})-/.exec(p.id)?.[1] }), marker);
        });
        markers.current.push(marker);
        const key = placeKey(p);
        if (key) planPins.current.set(key, marker);
        bounds.extend(position);
      });

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      polyline.current?.setMap(null);
      polyline.current = null;
      if (geocodedRoute.length >= 2) {
        const path = geocodedRoute.map((p) => ({ lat: p.lat, lng: p.lng }));
        polyline.current = new google.maps.Polyline({
          map,
          path,
          geodesic: true,
          strokeColor: CATEGORY_COLORS.city,
          strokeOpacity: 0.35,
          strokeWeight: 3,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
                scale: 2.5,
                strokeColor: CATEGORY_COLORS.city,
                strokeOpacity: 1,
                strokeWeight: 2,
              },
              offset: "0px",
              repeat: ARROW_SPACING_PX + "px",
            },
          ],
        });
        // Drift the chevrons forward along the line; with reduced motion they
        // stay put but still point in the direction of travel.
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const line = polyline.current;
          const start = performance.now();
          const tick = (now: number) => {
            const icons = line.get("icons");
            icons[0].offset = ((now - start) / 40) % ARROW_SPACING_PX + "px";
            line.set("icons", icons);
            frame.current = requestAnimationFrame(tick);
          };
          frame.current = requestAnimationFrame(tick);
        }
        path.forEach((pt) => bounds.extend(pt));
      }

      if (geocoded.length === 1 && geocodedRoute.length < 2) {
        map.setCenter({ lat: geocoded[0].lat, lng: geocoded[0].lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 48);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geocoded, geocodedRoute, status]);

  // Per-city weather pills. A separate effect from the pins so weather
  // arriving or refreshing later doesn't re-fit the map under the viewer.
  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map) return;

    weatherOverlays.current.forEach((o) => o.setMap(null));
    weatherOverlays.current = [];

    const entries: PillEntry[] = [];

    // Zoomed out, full labels pile on top of each other. Use a compact label
    // below COMPACT_ZOOM_MAX, then hide any pill that would collide with one
    // already placed, longest stays first. Hidden cities still show their
    // weather when you click the city pin.
    function declutter() {
      const projection = entries[0]?.overlay.getProjection();
      if (!projection) return;
      const compact = (map?.getZoom() ?? 0) <= COMPACT_ZOOM_MAX;
      entries.forEach((e) => {
        e.el.textContent = compact ? e.compact : e.full;
      });
      const placed: { l: number; r: number; t: number; b: number }[] = [];
      [...entries]
        .sort((a, b) => b.priority - a.priority)
        .forEach((e) => {
          const p = projection.fromLatLngToDivPixel(new google.maps.LatLng(e.position));
          if (!p) return;
          const w = e.el.offsetWidth;
          const h = e.el.offsetHeight;
          const box = {
            l: p.x - w / 2 - PILL_GAP_PX,
            r: p.x + w / 2 + PILL_GAP_PX,
            t: p.y - PILL_LIFT_PX - h - PILL_GAP_PX,
            b: p.y - PILL_LIFT_PX + PILL_GAP_PX,
          };
          const collides = placed.some((q) => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t);
          e.el.classList.toggle("is-hidden", collides);
          if (!collides) placed.push(box);
        });
    }
    let queued = false;
    let disposed = false;
    const scheduleDeclutter = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!disposed) declutter();
      });
    };

    const stopById = new Map(weatherStops.map((s) => [s.id, s]));
    geocodedWeather.forEach((p) => {
      const stop = stopById.get(p.id);
      if (!stop) return;
      const s = summarizeStay(stop.days.map((d) => d.weather));
      const position = { lat: p.lat, lng: p.lng };
      const range = `${temp(s.tMax, tempUnit)}°/${temp(s.tMin, tempUnit)}°`;
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `map-weather-pill${s.typical ? " is-typical" : ""}`;
      pill.setAttribute("aria-label", `${stop.name} weather, ${s.count} ${s.count === 1 ? "day" : "days"}${s.typical ? ", includes historical averages" : ""}`);
      pill.addEventListener("click", () => openInfo(map, infoHtml(stop.name, "", tempUnit, stop), position, PILL_INFO_OFFSET_PX));
      const overlay = createPillOverlay(position, pill, scheduleDeclutter);
      const entry: PillEntry = {
        el: pill,
        overlay,
        position,
        priority: s.count,
        full: `${s.emoji} ${range}${s.count > 1 ? ` · ${s.count}d` : ""}`,
        compact: `${s.emoji} ${temp(s.tMax, tempUnit)}°`,
      };
      pill.textContent = entry.full;
      entries.push(entry);
      overlay.setMap(map);
      weatherOverlays.current.push(overlay);
    });

    return () => {
      disposed = true;
    };
  }, [mapReady, geocodedWeather, weatherStops, tempUnit]);

  // Consideration pins: their own layer, so a vote, a toggle or a new idea never
  // rebuilds the planned pins or moves the view.
  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map || !showCandidates) return;
    const made = geocodedCandidates.map((p) => {
      const chosen = p.candidate === "chosen";
      const marker = new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        title: `${p.name} (${chosen ? "chosen" : "under consideration"})`,
        icon: { url: ringIcon(chosen), anchor: new google.maps.Point(13, 13), scaledSize: new google.maps.Size(26, 26) },
        zIndex: 1,
      });
      marker.addListener("click", () => {
        const task = considerationById.current.get(p.id.split("|")[1] ?? "");
        const live =
          task?.kind === "consider"
            ? task.outcome === "chosen" ? "Chosen" : "Under consideration"
            : `${task?.kind === "decision" ? "Decision" : "To-do"}${task?.done ? " (done)" : ""}`;
        const votes = task?.votes ? ` · 👍 ${task.votes.yes.length} · 👎 ${task.votes.no.length}` : "";
        openInfo(map, infoHtml(p.name, `${live}${task ? `: ${task.title}` : ""}${votes}`, tempUnitRef.current, undefined, googleMapsUrl(p), { item: p.id.split("|")[1] }), marker);
      });
      const key = placeKey(p);
      if (key) candidatePins.current.set(key, marker);
      return marker;
    });
    candidateMarkers.current = made;
    const pins = candidatePins.current;
    if (pendingFocus.current) {
      const key = pendingFocus.current;
      pendingFocus.current = null;
      focusHandler.current(key);
    }
    return () => {
      made.forEach((m) => m.setMap(null));
      candidateMarkers.current = [];
      pins.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, geocodedCandidates, showCandidates]);

  // Scroll to the map, zoom in on the pin and open its popup, as if it had been tapped.
  focusHandler.current = (key) => {
    const wrap = wrapRef.current;
    const map = mapInstance.current;
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pin = planPins.current.get(key) ?? candidatePins.current.get(key);
    // A ring on a hidden layer: turn the layer on, and finish when its pins are drawn.
    if (!pin && candidateKeys.current.has(key) && !showCandidates) {
      pendingFocus.current = key;
      setShowCandidates(true);
    }

    const reveal = () => {
      if (!map || !pin) return;
      const position = pin.getPosition();
      if (!position) return;
      const open = () => {
        google.maps.event.trigger(pin, "click");
        setFlash(true);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(false), 1200);
        if (!reduced) {
          pin.setAnimation(google.maps.Animation.BOUNCE);
          window.setTimeout(() => pin.setAnimation(null), 1400);
        }
      };
      const target = { lat: position.lat(), lng: position.lng() };
      const targetZoom = Math.max(map.getZoom() ?? 0, 16);
      flight.current?.();
      if (reduced) {
        map.moveCamera({ center: target, zoom: targetZoom });
        open();
        return;
      }
      // The popup opens when the flight lands; if you grab the map mid-flight, it stays closed.
      flight.current = flyTo(map, target, targetZoom, (completed) => {
        flight.current = null;
        if (completed) open();
      });
    };

    const rect = wrap.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
      reveal(); // already fully on screen: no scroll needed
      return;
    }
    wrap.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    // Zoom once the scroll settles so the movement on the map is actually seen.
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scrollend", go);
      reveal();
    };
    window.addEventListener("scrollend", go);
    window.setTimeout(go, reduced ? 0 : 800);
  };

  // Shared by pins and pills: close whatever is open, then show this one.
  function openInfo(
    map: google.maps.Map,
    { header, body }: { header: HTMLElement; body: string },
    at: google.maps.Marker | google.maps.LatLngLiteral,
    liftPx = 0,
  ) {
    const info = infoWindow.current;
    if (!info) return;
    info.close();
    // The title goes in the header row (shared with the close button) instead
    // of the body, which otherwise leaves an empty strip above it.
    info.setHeaderContent(header);
    info.setContent(body);
    info.setOptions({ pixelOffset: new google.maps.Size(0, -liftPx) });
    if (at instanceof google.maps.Marker) info.open({ map, anchor: at });
    else {
      info.setPosition(at);
      info.open({ map });
    }
  }

  if (points.length === 0) return null;

  return (
    <>
      <h2 className="section-title">Map</h2>
      <p className="section-sub">
        Where you're staying, planned stops that have an address, and each city on the route, joined in travel order
        with the weather for each stay. Tap a pin or weather label for details.
        {geocodedCandidates.length > 0 && " Dashed rings are places for ideas, to-dos and decisions that aren't settled yet."}
      </p>

      {status === "error" && (
        <div className="note">
          Couldn't load the map{error ? `: ${error}` : ""}. Make sure{" "}
          <code>VITE_GOOGLE_MAPS_API_KEY</code> is set.
        </div>
      )}
      {status === "loading" && <div className="note">Loading map…</div>}

      {status === "ready" && geocoded.length > 0 && (
        <div ref={wrapRef} className={`trip-map-wrap${flash ? " is-focused" : ""}`}>
          <div ref={mapRef} className="trip-map" />
          <div className="map-legend">
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const inUse = geocoded.some((p) => p.category === cat);
              if (!inUse) return null;
              return (
                <span className="map-legend-item" key={cat}>
                  <span className="dot" style={{ background: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] }} />
                  {label}
                </span>
              );
            })}
            {geocodedCandidates.length > 0 && (
              <button
                type="button"
                className="map-legend-item map-legend-toggle"
                aria-pressed={showCandidates}
                title={showCandidates ? "Hide places for ideas and to-dos" : "Show places for ideas and to-dos"}
                onClick={() => setShowCandidates((v) => !v)}
              >
                <span className="ring" />
                Ideas &amp; to-dos
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Title, optional subtitle, and (for a city with weather) one line per day.
function infoHtml(title: string, subtitle: string, unit: TempUnit, stop?: WeatherStop, mapsUrl?: string, jump?: { day?: string; item?: string }) {
  const rows = (stop?.days ?? [])
    .map(
      (d) =>
        `<div style="font:400 12px system-ui;color:#52514e">${escapeHtml(fmtShort(d.date))} ${weatherIcon(d.weather.code).emoji} ${escapeHtml(weatherText(d.weather, unit))}</div>`,
    )
    .join("");
  // setHeaderContent takes a DOM node (a string is shown as literal text),
  // unlike setContent, which accepts an HTML string.
  const header = document.createElement("div");
  header.style.cssText = "font:600 13px system-ui;color:#0b0b0b";
  header.textContent = title;
  return {
    header,
    body:
      (subtitle ? `<div style="font:400 12px system-ui;color:#52514e">${escapeHtml(subtitle)}</div>` : "") +
      (rows ? `<div style="margin-top:${subtitle ? 4 : 0}px">${rows}</div>` : "") +
      (mapsUrl
        ? `<div style="margin-top:6px;font:500 12px system-ui"><a style="color:#1a55c8;text-decoration:underline" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></div>`
        : "") +
      (jump?.day || jump?.item
        ? `<div style="margin-top:6px"><button type="button" ${jump.day ? `data-jump-day="${escapeHtml(jump.day)}"` : `data-jump-item="${escapeHtml(jump.item!)}"`} style="all:unset;cursor:pointer;font:500 12px system-ui;color:#1a55c8;text-decoration:underline">${jump.day ? "See in itinerary" : "See in Action Items"}</button></div>`
        : ""),
  };
}

// A real DOM element on the map (not a marker label), so it can receive clicks
// and keyboard focus. Positioned above its lat/lng by CSS.
function createPillOverlay(
  position: google.maps.LatLngLiteral,
  el: HTMLElement,
  onDraw: () => void,
): google.maps.OverlayView {
  class PillOverlay extends google.maps.OverlayView {
    onAdd() {
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
      this.getPanes()?.overlayMouseTarget.appendChild(el);
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(position));
      if (!p) return;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      onDraw();
    }
    onRemove() {
      el.remove();
    }
  }
  return new PillOverlay();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
