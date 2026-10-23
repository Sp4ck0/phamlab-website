import { useEffect, useRef } from "react";
import type { MapPointData } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/mapPoints";
import { useGeocodedPoints } from "../../hooks/useGeocodedPoints";
import { loadGoogleMaps } from "../../lib/googleMaps";

const ARROW_SPACING_PX = 28;

export function TripMap({ points, route }: { points: MapPointData[]; route: MapPointData[] }) {
  const { points: geocoded, status, error } = useGeocodedPoints(points);
  const { points: geocodedRoute } = useGeocodedPoints(route);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const polyline = useRef<google.maps.Polyline | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  useEffect(() => {
    if (status !== "ready" || geocoded.length === 0 || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      const google = await loadGoogleMaps();
      if (cancelled || !mapRef.current) return;

      if (!mapInstance.current) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          zoom: 13,
        });
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
        const info = new google.maps.InfoWindow({
          content: `<div style="font:600 13px system-ui;color:#0b0b0b">${escapeHtml(p.label)}</div><div style="font:400 12px system-ui;color:#52514e">${escapeHtml(CATEGORY_LABELS[p.category])}${p.note ? " · " + escapeHtml(p.note) : ""}</div>`,
        });
        marker.addListener("click", () => info.open({ map, anchor: marker }));
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

  if (points.length === 0) return null;

  return (
    <>
      <h2 className="section-title">Map</h2>
      <p className="section-sub">Hotels and other spots from this itinerary, joined in travel order.</p>

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
