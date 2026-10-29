import { useEffect, useRef, useState } from "react";
import type { MapPointData } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/mapPoints";
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
}

export function TripMap({ points, route, weatherStops }: Props) {
  const { points: geocoded, status, error } = useGeocodedPoints(points);
  const { points: geocodedRoute } = useGeocodedPoints(route);
  const { points: geocodedWeather } = useGeocodedPoints(weatherStops);
  const mapRef = useRef<HTMLDivElement>(null);
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
  stopsByAddress.current = new Map(weatherStops.map((s) => [s.address, s]));
  const { tempUnit } = useSettings();
  // Same click-time read for the unit, so toggling it doesn't rebuild every pin.
  const tempUnitRef = useRef(tempUnit);
  tempUnitRef.current = tempUnit;

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

      const bounds = new google.maps.LatLngBounds();
      geocoded.forEach((p) => {
        const position = { lat: p.lat, lng: p.lng };
        const marker = new google.maps.Marker({
          map,
          position,
          title: p.label,
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
          const stop = p.category === "city" ? stopsByAddress.current.get(p.address) : undefined;
          openInfo(map, infoHtml(p.label, CATEGORY_LABELS[p.category] + (p.note ? " · " + p.note : ""), tempUnitRef.current, stop), marker);
        });
        markers.current.push(marker);
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
      pill.setAttribute("aria-label", `${stop.label} weather, ${s.count} ${s.count === 1 ? "day" : "days"}${s.typical ? ", includes historical averages" : ""}`);
      pill.addEventListener("click", () => openInfo(map, infoHtml(stop.label, "", tempUnit, stop), position, PILL_INFO_OFFSET_PX));
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
        Hotels and other spots from this itinerary, joined in travel order, with the weather for each stay. Tap a pin or
        weather label for details.
      </p>

      {status === "error" && (
        <div className="note">
          Couldn't load the map{error ? `: ${error}` : ""}. Make sure{" "}
          <code>VITE_GOOGLE_MAPS_API_KEY</code> is set.
        </div>
      )}
      {status === "loading" && <div className="note">Loading map…</div>}

      {status === "ready" && geocoded.length > 0 && (
        <div className="trip-map-wrap">
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
          </div>
        </div>
      )}
    </>
  );
}

// Title, optional subtitle, and (for a city with weather) one line per day.
function infoHtml(title: string, subtitle: string, unit: TempUnit, stop?: WeatherStop) {
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
      (rows ? `<div style="margin-top:${subtitle ? 4 : 0}px">${rows}</div>` : ""),
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
