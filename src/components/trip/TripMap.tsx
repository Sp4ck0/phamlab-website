import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useShowAiFocus } from "../../hooks/useAiFocus";
import type { MapPointData, ResolvedDay, Task } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_EMOJI, CATEGORY_LABELS, MAP_DAY_EVENT, deriveDayRoutes, MAP_FOCUS_EVENT, MAP_GLANCE_EVENT, deriveJumpTargets, markPulseLeft, marksToFit, googleMapsUrl, jumpTargetFor, placeKey } from "../../lib/mapPoints";
import type { JumpTarget, MapMark, WeatherStop } from "../../lib/mapPoints";
import { assignLegColors, fmtShort } from "../../lib/tripLogic";
import { summarizeStay, temp, weatherIcon, weatherText } from "../../lib/weather";
import { markIconSvg } from "../../lib/markIcons";
import { useGeocodedPoints } from "../../hooks/useGeocodedPoints";
import { useSettings, type TempUnit } from "../../hooks/useSettings";
import { MAP_ID, loadGoogleMaps } from "../../lib/googleMaps";
import {
  MAP_MIN_H,
  MAP_MIN_W,
  clampMapHeight,
  clampMapWidth,
  loadPinMapHeight,
  loadPinMapWidth,
  maxMapHeight,
  maxMapWidth,
  savePinMapHeight,
  savePinMapWidth,
} from "../../lib/pinMap";

const ARROW_SPACING_PX = 28;
// From this zoom in (about one city on screen) each day's own route shows and the city-to-city line fades.
const DAY_ROUTE_ZOOM = 11;
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
  // For the popup's "See in Itinerary" / "See in Action Items" buttons.
  days: ResolvedDay[];
  route: MapPointData[];
  weatherStops: WeatherStop[];
  // Places not in the plan yet (action items' places and drafts): ghost pins, with a legend toggle.
  candidates: MapPointData[];
  // The considerations behind them, for the vote tally in a pin's popup.
  considerations: Task[];
  // Desktop: the "Pin map" toggle. Pinned, the map follows the day and tile being looked at.
  // `side` (wide windows only): pinned at the side, itinerary on the left, instead of on top.
  pin?: { on: boolean; set: (on: boolean) => void; side?: { on: boolean; set: (side: boolean) => void } };
  // Places the AI marked for a while (not in the trip), and the call whose places to fit into
  // view once they are drawn (then onMarksFitted).
  marks?: MapMark[];
  fitMarks?: string | null;
  onMarksFitted?: () => void;
  // The "Clear marks" button: removes every mark (the trip's own pins stay).
  onClearMarks?: () => void;
}

// A category's pin: its emoji on a white-rimmed disc in the category color.
// Drawn on a canvas and centered from the glyph's measured bounds: SVG text
// baselines (dominant-baseline) are not honored consistently on iOS Safari.
const emojiIcons = new Map<string, string>();
function emojiIcon(emoji: string, color: string): string {
  const key = emoji + color;
  const cached = emojiIcons.get(key);
  if (cached) return cached;
  const size = 30;
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 13, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.font = "15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(emoji);
  const y = size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(emoji, size / 2, y);
  const icon = canvas.toDataURL("image/png");
  emojiIcons.set(key, icon);
  return icon;
}

// A place not in the plan yet: its category's pin, faded, in a dashed rim of the category
// color, with a badge: "?" while open, "✓" once chosen or done (but not yet added).
const GHOST_SIZE = 34;
const ghostIcons = new Map<string, string>();
function ghostIcon(emoji: string, color: string, chosen: boolean): string {
  const key = `${emoji}${color}${chosen}`;
  const cached = ghostIcons.get(key);
  if (cached) return cached;
  const size = GHOST_SIZE;
  const scale = 3;
  const c = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(c, c, 12, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.font = "15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(emoji);
  ctx.fillText(emoji, c, c + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(c, c, 13.5, 0, Math.PI * 2);
  ctx.setLineDash([3.5, 2.5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
  const b = size - 7;
  ctx.beginPath();
  ctx.arc(b, b, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = chosen ? "#1baf7a" : "#fff";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = chosen ? "#fff" : color;
  ctx.stroke();
  ctx.fillStyle = chosen ? "#fff" : color;
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(chosen ? "✓" : "?", b, b + 0.5);
  const icon = canvas.toDataURL("image/png");
  ghostIcons.set(key, icon);
  return icon;
}

// A pin's look as an element for an advanced marker: an image, or (no image) a
// white-rimmed dot in `color`.
function pinElement(size: number, url?: string, color?: string): HTMLElement {
  const el = url ? Object.assign(document.createElement("img"), { src: url, alt: "" }) : document.createElement("div");
  el.className = url ? "map-pin" : "map-pin map-pin-dot";
  el.style.width = el.style.height = `${size}px`;
  if (color) el.style.background = color;
  return el;
}

type Pin = google.maps.marker.AdvancedMarkerElement;
// Centered on its point, like the old icons (an advanced marker's default is bottom-center).
function makePin(map: google.maps.Map, position: google.maps.LatLngLiteral, title: string, content: HTMLElement, onClick: () => void, zIndex?: number): Pin {
  const pin = new google.maps.marker.AdvancedMarkerElement({ map, position, title, content, zIndex, anchorTop: "-50%", gmpClickable: true });
  pin.addEventListener("gmp-click", onClick);
  pinClicks.set(pin, onClick);
  return pin;
}
// What a tap on each pin does, so "show on map" can do the same.
const pinClicks = new WeakMap<Pin, () => void>();

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

// A route line's arrowheads: open chevrons every ARROW_SPACING_PX.
function arrows(color: string, opacity: number): google.maps.IconSequence[] {
  return [{ icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5, strokeColor: color, strokeOpacity: opacity, strokeWeight: 2 }, offset: "0px", repeat: ARROW_SPACING_PX + "px" }];
}
// A line's look, keeping where its arrows have drifted to.
function styleLine(line: google.maps.Polyline, lineOpacity: number, arrowOpacity: number) {
  const icons = line.get("icons") as google.maps.IconSequence[] | undefined;
  const icon = icons?.[0]?.icon;
  line.setOptions({ strokeOpacity: lineOpacity, icons: icons && icon ? [{ ...icons[0], icon: { ...icon, strokeOpacity: arrowOpacity } }] : icons });
}
// A leg color is a CSS variable (it follows the theme); the map needs the color itself.
function cssColor(color: string | undefined, el: Element): string {
  const v = color ? /^var\((--[\w-]+)\)$/.exec(color) : null;
  return (v ? getComputedStyle(el).getPropertyValue(v[1]).trim() : color) || CATEGORY_COLORS.city;
}

// The center and whole zoom that fit `points` in the map with `pad` pixels to spare, no closer than
// `maxZoom` (one point, or several on one street, would otherwise zoom all the way in).
function viewFor(map: google.maps.Map, points: google.maps.LatLngLiteral[], pad = 48, maxZoom = 15) {
  const w = points.map(toWorld);
  const xs = w.map((p) => p.x), ys = w.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const div = map.getDiv();
  const fit = (room: number, span: number) => (span > 0 ? Math.max(room - 2 * pad, 64) / (span * 256) : Infinity);
  const zoom = Math.log2(Math.min(fit(div.clientWidth, x1 - x0), fit(div.clientHeight, y1 - y0)));
  return { center: fromWorld((x0 + x1) / 2, (y0 + y1) / 2), zoom: Math.max(2, Math.min(maxZoom, Math.floor(zoom))) };
}

export function TripMap({ points, days, route, weatherStops, candidates, considerations, pin, marks = [], fitMarks, onMarksFitted, onClearMarks }: Props) {
  const { points: geocoded, status, error } = useGeocodedPoints(points);
  const { points: geocodedMarks } = useGeocodedPoints(marks);
  const { points: geocodedRoute } = useGeocodedPoints(route);
  const { points: geocodedWeather } = useGeocodedPoints(weatherStops);
  const { points: geocodedCandidates } = useGeocodedPoints(candidates);
  const [showCandidates, setShowCandidates] = useState(true);
  const candidateMarkers = useRef<Pin[]>([]);
  // Read at click time, so a vote that lands later shows in the popup without rebuilding the pins.
  const considerationById = useRef(new Map<string, Task>());
  considerationById.current = new Map(considerations.map((t) => [t.key.slice("item:".length), t]));
  const mapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Pinned: the height dragged to with the divider under the map (null: the stylesheet's).
  const [mapHeight, setMapHeight] = useState(loadPinMapHeight);
  // Pinned at the side: the width dragged to (null: the stylesheet's).
  const [mapWidth, setMapWidth] = useState(loadPinMapWidth);
  // Pins by place key, so a "show on map" button elsewhere on the page can find its pin.
  const planPins = useRef(new Map<string, Pin>());
  const candidatePins = useRef(new Map<string, Pin>());
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
  const infoWindow = useRef<InfoCard | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const markers = useRef<Pin[]>([]);
  // Pinned (desktop): the day being looked at (from the itinerary, kept even while unpinned so
  // pinning shows it at once), each plan pin's days, and the whole-trip view to go back to.
  const pinned = !!pin?.on;
  const side = pinned && !!pin?.side?.on;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const lookingAt = useRef<string | undefined>(undefined);
  const pinDates = useRef(new Map<Pin, string[] | undefined>());
  const tripBounds = useRef<google.maps.LatLngBounds | null>(null);
  const showDay = useRef<() => void>(() => {});
  const dimOtherDays = useRef<() => void>(() => {});
  const styleCityLine = useRef<() => void>(() => {});
  const styleDayLines = useRef<() => void>(() => {});
  const glance = useRef<(key: string) => void>(() => {});
  const weatherOverlays = useRef<google.maps.OverlayView[]>([]);
  const polyline = useRef<google.maps.Polyline | null>(null);
  // Zoomed in to about one city: each day's own route (in its leg color) instead of the city line.
  const [zoomedIn, setZoomedIn] = useState(false);
  const zoomedInRef = useRef(zoomedIn);
  zoomedInRef.current = zoomedIn;
  const [pinsDrawn, setPinsDrawn] = useState(0); // bumped once the plan pins exist, which day routes join up
  const dayLines = useRef(new Map<string, google.maps.Polyline>());
  const dayRoutes = useMemo(() => {
    const legs = assignLegColors(days);
    const color = new Map(days.map((d, i) => [d.date, legs[i]?.color]));
    return deriveDayRoutes(days).map((r) => ({ ...r, color: color.get(r.date) }));
  }, [days]);
  const frame = useRef<number | null>(null);
  // Read at click time so a city pin shows weather that arrived after the pin was built.
  const stopsByAddress = useRef(new Map<string, WeatherStop>());
  stopsByAddress.current = new Map(weatherStops.map((s) => [s.address ?? "", s]));
  const { tempUnit } = useSettings();
  const { slug } = useParams();
  const showFocus = useShowAiFocus();
  // The popup's "See in Itinerary" / "See in Action Items" buttons are plain HTML inside
  // the Maps info window, so one capture-phase listener on the map wrapper answers them
  // and hands off to the same focus signal the AI and shared links use.
  // Read at click time, so a task added later still gets its button without rebuilding pins.
  const jumpTargets = useRef(new Map<string, JumpTarget>());
  jumpTargets.current = deriveJumpTargets(days, considerations);
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
    const onDay = (e: Event) => {
      lookingAt.current = (e as CustomEvent<string | undefined>).detail;
      showDay.current();
    };
    const onGlance = (e: Event) => glance.current((e as CustomEvent<string>).detail);
    window.addEventListener(MAP_FOCUS_EVENT, onFocus);
    window.addEventListener(MAP_DAY_EVENT, onDay);
    window.addEventListener(MAP_GLANCE_EVENT, onGlance);
    return () => {
      window.removeEventListener(MAP_FOCUS_EVENT, onFocus);
      window.removeEventListener(MAP_DAY_EVENT, onDay);
      window.removeEventListener(MAP_GLANCE_EVENT, onGlance);
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
          mapId: MAP_ID,
          // Raster whatever the Map ID says: a vector map needs WebAssembly and data:
          // fetches that the site's Content Security Policy doesn't allow, and then draws
          // only the pins on a blank grey map.
          renderingType: google.maps.RenderingType.RASTER,
        });
        const info = createInfoCard();
        mapInstance.current.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(info.el);
        infoWindow.current = info;
        mapInstance.current.addListener("click", () => info.close());
        setMapReady(true);
      }
      const map = mapInstance.current;

      markers.current.forEach((m) => {
        m.map = null;
        pinDates.current.delete(m);
      });
      markers.current = [];
      planPins.current.clear();

      const bounds = new google.maps.LatLngBounds();
      geocoded.forEach((p) => {
        const position = { lat: p.lat, lng: p.lng };
        const emoji = CATEGORY_EMOJI[p.category];
        const look = emoji ? pinElement(30, emojiIcon(emoji, CATEGORY_COLORS[p.category])) : pinElement(18, undefined, CATEGORY_COLORS[p.category]);
        const marker = makePin(map, position, p.name, look, () => {
          const stop = p.category === "city" ? stopsByAddress.current.get(p.address ?? "") : undefined;
          // City dots are just a place on the route; every other pin is a real place worth opening in Google Maps.
          const link = p.category === "city" ? undefined : googleMapsUrl(p);
          openInfo(map, infoHtml(p.name, CATEGORY_LABELS[p.category] + (p.note ? " · " + p.note : ""), tempUnitRef.current, stop, link, jumpTargetFor(jumpTargets.current, p)), marker);
        });
        markers.current.push(marker);
        pinDates.current.set(marker, p.dates);
        const key = placeKey(p);
        if (key) planPins.current.set(key, marker);
        bounds.extend(position);
      });
      if (pendingFocus.current && planPins.current.has(pendingFocus.current)) {
        const key = pendingFocus.current;
        pendingFocus.current = null;
        // After this effect has finished setting up the map (bounds, route) so the focus isn't undone.
        window.setTimeout(() => focusHandler.current(key), 0);
      }

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
        styleCityLine.current();
      }

      tripBounds.current = bounds;
      setPinsDrawn((n) => n + 1);
      if (geocoded.length === 1 && geocodedRoute.length < 2) {
        map.setCenter({ lat: geocoded[0].lat, lng: geocoded[0].lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 48);
      }
      // Pinned: back to the day being looked at, now that its pins are drawn.
      if (pinnedRef.current) showDay.current();
    })();

    return () => {
      cancelled = true;
    };
  }, [geocoded, geocodedRoute, status]);

  // Which route shows: the city line zoomed out, day routes zoomed in. During a flight the zoom
  // changes every frame, but the state only changes when it crosses the line.
  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map) return;
    const update = () => setZoomedIn((map.getZoom() ?? 0) >= DAY_ROUTE_ZOOM);
    update();
    const listener = map.addListener("zoom_changed", update);
    return () => listener.remove();
  }, [mapReady]);
  useEffect(() => styleCityLine.current(), [zoomedIn]);

  // Day routes: one line per day through its stops (the hotel, the activities in the timeline's
  // order, that night's hotel), drawn only while zoomed in. Stops are found among the plan pins,
  // so a place that didn't geocode is simply left out. Their own layer: never refits the map.
  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map || !zoomedIn) return;
    const el = map.getDiv();
    const drawn = dayLines.current;
    dayRoutes.forEach((r) => {
      const path = r.keys.flatMap((k) => {
        const pin = planPins.current.get(k);
        return pin?.position ? [positionOf(pin)] : [];
      });
      if (path.length < 2) return;
      const color = cssColor(r.color, el);
      drawn.set(r.date, new google.maps.Polyline({ map, path, strokeColor: color, strokeOpacity: 0.4, strokeWeight: 3, icons: arrows(color, 0.7) }));
    });
    styleDayLines.current();
    const lines = [...drawn.values()];
    // The arrows drift forward like the city line's; with reduced motion they stay put.
    let raf = 0;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const start = performance.now();
      const tick = (now: number) => {
        const offset = (((now - start) / 40) % ARROW_SPACING_PX) + "px";
        lines.forEach((line) => {
          const icons = line.get("icons");
          icons[0].offset = offset;
          line.set("icons", icons);
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      lines.forEach((line) => line.setMap(null));
      drawn.clear();
    };
    // positionOf/styleDayLines are read fresh; the pins are tracked by pinsDrawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, zoomedIn, dayRoutes, pinsDrawn]);

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

  // Ghost pins (not in the plan yet): their own layer, so a vote, a toggle or a new idea never
  // rebuilds the planned pins or moves the view.
  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map || !showCandidates) return;
    const made = geocodedCandidates.map((p) => {
      const chosen = p.candidate === "chosen";
      const title = `${p.name} (${chosen ? "chosen, not in the plan yet" : "not settled yet"})`;
      const look = pinElement(GHOST_SIZE, ghostIcon(CATEGORY_EMOJI[p.category] ?? "📍", CATEGORY_COLORS[p.category], chosen));
      const marker = makePin(map, { lat: p.lat, lng: p.lng }, title, look, () => {
        const task = considerationById.current.get(p.id.split("|")[1] ?? "");
        const live =
          task?.kind === "consider"
            ? task.outcome === "chosen" ? "Chosen" : "Under consideration"
            : `To-do${task?.done ? " (done)" : ""}`;
        const votes = task?.votes ? ` · 👍 ${task.votes.yes.length} · 👎 ${task.votes.no.length}` : "";
        openInfo(map, infoHtml(p.name, `${live}${task ? `: ${task.title}` : ""}${votes}`, tempUnitRef.current, undefined, googleMapsUrl(p), jumpTargetFor(jumpTargets.current, p)), marker);
      }, 1);
      const key = placeKey(p);
      if (key) candidatePins.current.set(key, marker);
      if (p.dates) pinDates.current.set(marker, p.dates);
      return marker;
    });
    candidateMarkers.current = made;
    dimOtherDays.current();
    const pins = candidatePins.current;
    const dates = pinDates.current;
    if (pendingFocus.current) {
      const key = pendingFocus.current;
      pendingFocus.current = null;
      focusHandler.current(key);
    }
    return () => {
      made.forEach((m) => {
        m.map = null;
        dates.delete(m);
      });
      candidateMarkers.current = [];
      pins.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, geocodedCandidates, showCandidates]);

  // The AI's marks: a dot above every other pin that pulses for its first minute (MARK_PULSE_MS),
  // or a round pin with the emoji the AI gave it; a new call's marks are fitted into view once drawn.
  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map) return;
    const byId = new Map(marks.map((m) => [m.id, m]));
    const timers: number[] = [];
    const made = geocodedMarks.map((p) => {
      const look = document.createElement("div");
      look.className = "map-mark";
      // A named icon is drawn white in the dot; any other icon is an emoji (the backend sends
      // nothing else), shown on a white disc.
      const icon = byId.get(p.id)?.icon;
      const color = byId.get(p.id)?.color;
      if (color) look.style.setProperty("--mark-color", color);
      const svg = markIconSvg(icon);
      if (svg) {
        look.classList.add("has-icon");
        look.innerHTML = svg;
      } else if (icon) {
        look.classList.add("has-emoji");
        look.textContent = icon;
      }
      const left = markPulseLeft(byId.get(p.id), Date.now());
      if (left > 0) {
        look.classList.add("is-pulsing");
        timers.push(window.setTimeout(() => look.classList.remove("is-pulsing"), left));
      }
      const marker: Pin = makePin(map, { lat: p.lat, lng: p.lng }, `${p.name} (marked, not in the trip)`, look, () => {
        openInfo(map, infoHtml(p.name, `Marked by the AI · not in the trip${p.address ? ` · ${p.address}` : ""}`, tempUnitRef.current, undefined, googleMapsUrl(p)), marker);
      }, 3);
      return marker;
    });
    const batch = marksToFit(geocodedMarks, marks, fitMarks);
    if (batch.length > 0) {
      const { center, zoom } = viewFor(map, batch.map((p) => ({ lat: p.lat, lng: p.lng })));
      moveTo(map, center, zoom);
      onMarksFitted?.();
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      made.forEach((m) => (m.map = null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- marks only add `at`/`batch` to geocodedMarks; redraw when those land
  }, [mapReady, geocodedMarks, fitMarks]);

  // Scroll to the map, zoom in on the pin and open its popup, as if it had been tapped.
  focusHandler.current = (key) => {
    const wrap = wrapRef.current;
    const map = mapInstance.current;
    if (!wrap) return;
    // Asked before the map has drawn its pins (it was just opened in its tab): finish once they are.
    if (!map || planPins.current.size === 0) {
      pendingFocus.current = key;
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pin = planPins.current.get(key) ?? candidatePins.current.get(key);
    // A ring on a hidden layer: turn the layer on, and finish when its pins are drawn.
    if (!pin && candidateKeys.current.has(key) && !showCandidates) {
      pendingFocus.current = key;
      setShowCandidates(true);
    }

    const reveal = () => {
      if (!map || !pin) return;
      if (!pin.position) return;
      const open = () => {
        pinClicks.get(pin)?.();
        setFlash(true);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(false), 1200);
        const look = pin.content as HTMLElement | null;
        if (!reduced && look) {
          look.classList.add("is-bouncing");
          window.setTimeout(() => look.classList.remove("is-bouncing"), 1400);
        }
      };
      const target = new google.maps.LatLng(pin.position as google.maps.LatLngLiteral).toJSON();
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

  // Camera moves while pinned: a flight, or a jump with reduced motion. A newer one replaces it.
  const moveTo = (map: google.maps.Map, center: google.maps.LatLngLiteral, zoom: number) => {
    flight.current?.();
    flight.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.moveCamera({ center, zoom });
      return;
    }
    flight.current = flyTo(map, center, zoom, () => (flight.current = null));
  };
  const positionOf = (p: Pin) => new google.maps.LatLng(p.position as google.maps.LatLngLiteral).toJSON();

  // The city line: as before zoomed out; zoomed in, a faint trace with no arrows under the day routes.
  styleCityLine.current = () => {
    if (polyline.current) styleLine(polyline.current, zoomedInRef.current ? 0.12 : 0.35, zoomedInRef.current ? 0 : 1);
  };
  // Day routes: pinned to a day, that day's stands out and the rest step back.
  styleDayLines.current = () => {
    const date = pinnedRef.current ? lookingAt.current : undefined;
    dayLines.current.forEach((line, d) => {
      const strength = !date ? 0.6 : d === date ? 1 : 0.2;
      styleLine(line, 0.6 * strength, strength);
      line.setOptions({ zIndex: d === date ? 2 : 1 });
    });
  };

  // Pinned: fit the day being looked at and fade the other days' pins. A day with no pins of its
  // own leaves the map as it is; points not tied to a day never fade.
  showDay.current = () => {
    styleDayLines.current();
    const map = mapInstance.current;
    const date = pinnedRef.current ? lookingAt.current : undefined;
    if (!map || !date || markers.current.length === 0) return;
    const inDay = markers.current.filter((m) => pinDates.current.get(m)?.includes(date));
    if (inDay.length === 0) return;
    dimOtherDays.current();
    const { center, zoom } = viewFor(map, inDay.map(positionOf));
    moveTo(map, center, zoom);
  };
  // Fades every pin (planned and ghost) that belongs to other days than the one looked at
  // while pinned; unpinned, or with no day, nothing is faded.
  dimOtherDays.current = () => {
    const date = pinnedRef.current ? lookingAt.current : undefined;
    [...markers.current, ...candidateMarkers.current].forEach((m) => {
      const dates = pinDates.current.get(m);
      (m.content as HTMLElement | null)?.classList.toggle("is-dimmed", !!date && !!dates && !dates.includes(date));
    });
  };

  // Pinned: a tile under the pointer flies the map to its place and makes the pin pulse.
  glance.current = (key) => {
    const map = mapInstance.current;
    const target = planPins.current.get(key) ?? candidatePins.current.get(key);
    if (!pinnedRef.current || !map || !target?.position) return;
    moveTo(map, positionOf(target), Math.max(map.getZoom() ?? 0, 15));
    const look = target.content as HTMLElement | null;
    if (!look) return;
    look.classList.add("is-glanced");
    window.setTimeout(() => look.classList.remove("is-glanced"), 1200);
  };

  // Pinning shows the day being looked at; unpinning goes back to the whole trip, nothing faded.
  const wasPinned = useRef(pinned);
  useEffect(() => {
    if (wasPinned.current === pinned) return;
    wasPinned.current = pinned;
    if (pinned) {
      showDay.current();
      return;
    }
    const map = mapInstance.current;
    dimOtherDays.current();
    styleDayLines.current();
    flight.current?.();
    flight.current = null;
    if (map && tripBounds.current && markers.current.length > 1) map.fitBounds(tripBounds.current, 48);
  }, [pinned]);

  // Shared by pins and pills: show this one's card in the map's bottom-left corner.
  function openInfo(
    _map: google.maps.Map,
    { header, body }: { header: HTMLElement; body: string },
    _at?: Pin | google.maps.LatLngLiteral,
    _liftPx = 0,
  ) {
    infoWindow.current?.show(header, body);
  }

  // At the side, the width is a variable on the page root, since the page's own column makes room
  // for it too (.wrap:has(> .map-side)). Unset, the stylesheet's default applies.
  useEffect(() => {
    const root = document.documentElement;
    if (!side || !mapWidth) return;
    root.style.setProperty("--side-map-w", `${mapWidth}px`);
    return () => {
      root.style.removeProperty("--side-map-w");
    };
  }, [side, mapWidth]);

  // The divider under the pinned map: drag it, or use the arrow keys, to make the map taller or
  // shorter; double-click goes back to the default. While dragging, only the map's own style changes.
  // At the side, it runs down the map's left edge and sets the width the same way.
  function sizeMap(h: number | null) {
    setMapHeight(h);
    savePinMapHeight(h);
  }
  function widenMap(w: number | null) {
    setMapWidth(w);
    savePinMapWidth(w);
  }
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    const el = mapRef.current;
    if (!el || e.button !== 0) return;
    if (side) return startWiden(e);
    e.preventDefault();
    const handle = e.currentTarget;
    const startY = e.clientY;
    const startH = el.offsetHeight;
    let h = startH;
    const move = (ev: PointerEvent) => {
      h = clampMapHeight(startH + ev.clientY - startY, window.innerHeight);
      el.style.height = `${h}px`;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      handle.classList.remove("is-dragging");
      if (h !== startH) sizeMap(h);
    };
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("is-dragging");
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  // The section is the map's column: dragging left widens it.
  function startWiden(e: React.PointerEvent<HTMLDivElement>) {
    const col = e.currentTarget.closest("section");
    if (!col) return;
    e.preventDefault();
    const root = document.documentElement;
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startW = col.offsetWidth;
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = clampMapWidth(startW - (ev.clientX - startX), window.innerWidth);
      root.style.setProperty("--side-map-w", `${w}px`);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      handle.classList.remove("is-dragging");
      if (w !== startW) widenMap(w);
      else if (!mapWidth) root.style.removeProperty("--side-map-w");
    };
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("is-dragging");
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  function resizeByKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (side) {
      const step = e.key === "ArrowLeft" ? 24 : e.key === "ArrowRight" ? -24 : 0;
      const col = e.currentTarget.closest("section");
      if (!step || !col) return;
      e.preventDefault();
      widenMap(clampMapWidth(col.offsetWidth + step, window.innerWidth));
      return;
    }
    const step = e.key === "ArrowUp" ? -24 : e.key === "ArrowDown" ? 24 : 0;
    const el = mapRef.current;
    if (!step || !el) return;
    e.preventDefault();
    sizeMap(clampMapHeight(el.offsetHeight + step, window.innerHeight));
  }

  if (points.length === 0) return null;

  return (
    <>
      <div className="map-head">
        <h2 className="section-title">Map</h2>
        <div className="map-head-actions">
          {onClearMarks && geocodedMarks.length > 0 && (
            <button
              type="button"
              className="map-pin-toggle"
              title="Remove the places the AI marked; the trip's own pins stay"
              onClick={onClearMarks}
            >
              ✕ Clear marks ({geocodedMarks.length})
            </button>
          )}
          {pinned && pin?.side && (
            <button
              type="button"
              className="map-pin-toggle"
              title={side ? "Put the map above the itinerary" : "Put the map beside the itinerary, filling the window's height"}
              onClick={() => pin.side?.set(!side)}
            >
              {side ? "⬒ Map on top" : "◨ Map at the side"}
            </button>
          )}
          {pin && (
            <button
              type="button"
              className="map-pin-toggle"
              aria-pressed={pin.on}
              title={pin.on ? "Let the map scroll with the page" : "Keep the map on screen while you scroll; it follows the day you're looking at"}
              onClick={() => pin.set(!pin.on)}
            >
              📌 {pin.on ? "Unpin map" : "Pin map"}
            </button>
          )}
        </div>
      </div>
      <p className="section-sub">
        Where you're staying, planned stops that have an address, and each city on the route, joined in travel order
        with the weather for each stay. Tap a pin or weather label for details.
        {geocodedCandidates.length > 0 && " Dashed rings are places for ideas and to-dos that aren't settled yet."}
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
          <div
            ref={mapRef}
            className={`trip-map${pinned && !side && mapHeight ? " is-sized" : ""}`}
            style={pinned && !side && mapHeight ? { height: mapHeight } : undefined}
          />
          {pinned && (
            <div
              className="map-divider"
              role="separator"
              aria-orientation={side ? "vertical" : "horizontal"}
              aria-label="Map size"
              aria-valuemin={side ? MAP_MIN_W : MAP_MIN_H}
              aria-valuemax={side ? maxMapWidth(window.innerWidth) : maxMapHeight(window.innerHeight)}
              aria-valuenow={(side ? mapWidth : mapHeight) ?? undefined}
              tabIndex={0}
              title={side ? "Drag to make the map wider or narrower; double-click to reset" : "Drag to make the map bigger or smaller; double-click to reset"}
              onPointerDown={startResize}
              onKeyDown={resizeByKey}
              onDoubleClick={() => (side ? widenMap(null) : sizeMap(null))}
            />
          )}
          <div className="map-legend">
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const inUse = geocoded.some((p) => p.category === cat);
              if (!inUse) return null;
              return (
                <span className="map-legend-item" key={cat}>
                  <span className="dot" style={{ background: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] }} />
                  {CATEGORY_EMOJI[cat as keyof typeof CATEGORY_EMOJI] ?? ""} {label}
                </span>
              );
            })}
            {geocodedMarks.length > 0 && (
              <span className="map-legend-item">
                <span className="map-mark-swatch" />
                Marked by the AI
              </span>
            )}
            {geocodedCandidates.length > 0 && (
              <button
                type="button"
                className="map-legend-item map-legend-toggle"
                aria-pressed={showCandidates}
                title={showCandidates ? "Hide places that aren't in the plan yet (ideas and to-dos)" : "Show places that aren't in the plan yet (ideas and to-dos)"}
                onClick={() => setShowCandidates((v) => !v)}
              >
                <img className="ghost" src={ghostIcon("📍", CATEGORY_COLORS.other, false)} alt="" />
                Not settled yet
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
      jumpButton("data-jump-day", jump?.day, "See in Itinerary") +
      jumpButton("data-jump-item", jump?.item, "See in Action Items"),
  };
}

// The details card for a clicked pin: a map control pinned bottom-left, so it
// never covers the pins themselves.
type InfoCard = { el: HTMLElement; show: (header: HTMLElement, body: string) => void; close: () => void };
function createInfoCard(): InfoCard {
  const el = document.createElement("div");
  el.style.cssText =
    "display:none;margin:0 0 10px 10px;max-width:min(260px,calc(100% - 80px));padding:10px 12px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3);position:relative";
  const head = document.createElement("div");
  head.style.cssText = "padding-right:22px";
  const content = document.createElement("div");
  const x = document.createElement("button");
  x.type = "button";
  x.textContent = "×";
  x.setAttribute("aria-label", "Close");
  x.style.cssText = "all:unset;cursor:pointer;position:absolute;top:6px;right:10px;font:400 18px/1 system-ui;color:#52514e";
  x.addEventListener("click", () => close());
  el.append(head, content, x);
  google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
  function close() {
    el.style.display = "none";
  }
  return {
    el,
    close,
    show(header, body) {
      head.replaceChildren(header);
      content.innerHTML = body;
      el.style.display = "block";
    },
  };
}

function jumpButton(attr: string, value: string | undefined, label: string) {
  return value
    ? `<div style="margin-top:6px"><button type="button" ${attr}="${escapeHtml(value)}" style="all:unset;cursor:pointer;font:500 12px system-ui;color:#1a55c8;text-decoration:underline">${label}</button></div>`
    : "";
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
