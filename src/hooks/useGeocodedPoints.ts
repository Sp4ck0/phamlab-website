import { useEffect, useState } from "react";
import type { MapPointData } from "../lib/types";

// Loaded on first use, so a component that only reads the cache (DayCard's ride links) can be
// imported where there is no Vite env, such as the node tests.
const loadGoogleMaps = () => import("../lib/googleMaps").then((m) => m.loadGoogleMaps());

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

// Cache key and lookup input: a Place ID if there is one, else the address.
// A point with neither can't be placed.
function lookupKey(p: Pick<MapPointData, "placeId" | "address">): string | undefined {
  return p.placeId ? `pid:${p.placeId}` : p.address;
}

type Findable = Pick<MapPointData, "placeId" | "address">;

/** A place's coordinates if the map has already looked them up on this device, else undefined. */
export function cachedLatLng(p: Findable): LatLng | undefined {
  const lookup = lookupKey(p);
  return lookup ? loadCache()[lookup] : undefined;
}

/** Looks one place up now (and caches it like the trip map does); null when it can't be found. */
export async function geocodePlace(p: Findable): Promise<LatLng | null> {
  const lookup = lookupKey(p);
  if (!lookup) return null;
  const cached = loadCache()[lookup];
  if (cached) return cached;
  try {
    const google = await loadGoogleMaps();
    const res = await new google.maps.Geocoder().geocode(p.placeId ? { placeId: p.placeId } : { address: p.address });
    const loc = res.results[0]?.geometry?.location;
    if (!loc) return null;
    const latLng = { lat: loc.lat(), lng: loc.lng() };
    try {
      saveCache({ ...loadCache(), [lookup]: latLng });
    } catch {
      // a full or blocked localStorage only means the next tap looks it up again
    }
    return latLng;
  } catch {
    return null;
  }
}

export function useGeocodedPoints(points: MapPointData[]) {
  const [resolved, setResolved] = useState<GeocodedPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const key = points.map((p) => [lookupKey(p), p.name, p.note].join("~")).join("|");

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
          const lookup = lookupKey(p);
          if (!lookup) continue;
          const cached = cache[lookup];
          if (cached) {
            out.push({ ...p, ...cached });
            continue;
          }
          try {
            const res = await geocoder.geocode(p.placeId ? { placeId: p.placeId } : { address: p.address });
            const loc = res.results[0]?.geometry?.location;
            if (loc) {
              const latLng = { lat: loc.lat(), lng: loc.lng() };
              cache[lookup] = latLng;
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
