import { useEffect, useRef } from "react";
import type { MapPointData } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/mapPoints";
import { useGeocodedPoints } from "../../hooks/useGeocodedPoints";
import { loadGoogleMaps } from "../../lib/googleMaps";

export function TripMap({ points }: { points: MapPointData[] }) {
  const { points: geocoded, status, error } = useGeocodedPoints(points);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

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

      if (geocoded.length === 1) {
        map.setCenter({ lat: geocoded[0].lat, lng: geocoded[0].lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 48);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geocoded, status]);

  if (points.length === 0) return null;

  return (
    <>
      <h2 className="section-title">Map</h2>
      <p className="section-sub">Hotels and other spots from this itinerary.</p>

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
