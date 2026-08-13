import { useEffect, useState } from "react";
import type { MapPointData } from "../lib/types";
import { loadGoogleMaps } from "../lib/googleMaps";

const CACHE_KEY = "phamlab.geocode.v1";

interface LatLng {
  lat: number;
  lng: number;
}

function loadCache(): Record<string, LatLng> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveCache(cache: Record<string, LatLng>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export interface GeocodedPoint extends MapPointData {
  lat: number;
  lng: number;
}

export function useGeocodedPoints(points: MapPointData[]) {
  const [resolved, setResolved] = useState<GeocodedPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const key = points.map((p) => p.address).join("|");

  useEffect(() => {
    let cancelled = false;
    if (points.length === 0) {
      setResolved([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const google = await loadGoogleMaps();
        const cache = loadCache();
        const geocoder = new google.maps.Geocoder();
        const out: GeocodedPoint[] = [];

        for (const p of points) {
          if (cancelled) return;
          const cached = cache[p.address];
          if (cached) {
            out.push({ ...p, ...cached });
            continue;
          }
          try {
            const res = await geocoder.geocode({ address: p.address });
            const loc = res.results[0]?.geometry?.location;
            if (loc) {
              const latLng = { lat: loc.lat(), lng: loc.lng() };
              cache[p.address] = latLng;
              out.push({ ...p, ...latLng });
            }
          } catch {
            // skip points that fail to geocode rather than failing the whole map
          }
        }
        saveCache(cache);
        if (!cancelled) {
          setResolved(out);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load Google Maps");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { points: resolved, status, error };
}
