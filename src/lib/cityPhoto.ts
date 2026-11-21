// A photo of a day's city for its header (convex/cityPhotos.ts), with the photographer's credit,
// which must be shown with it. Google's links are short-lived, so they are kept only for the
// page's lifetime, one request per city.
export type CityPhoto = { url: string; credit: { name: string; uri?: string } | null };
export type CityPhotoFetcher = (city: string, country: string) => Promise<CityPhoto | null>;

/** Wraps a fetcher so each city is asked for once while the page is open; a failure is no photo. */
export function cachedPhotos(fetch: CityPhotoFetcher): CityPhotoFetcher {
  const seen = new Map<string, Promise<CityPhoto | null>>();
  return (city, country) => {
    const key = `${city}|${country}`;
    let p = seen.get(key);
    if (!p) {
      p = fetch(city, country).catch(() => null);
      seen.set(key, p);
    }
    return p;
  };
}
