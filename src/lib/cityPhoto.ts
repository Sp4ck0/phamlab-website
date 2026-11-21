// A photo of a day's city for its header, or of a place on a tile (convex/cityPhotos.ts), with
// the photographer's credit, which must be shown with it. Google's links are short-lived, so
// they are kept only for the page's lifetime, one request per city or place.
export type CityPhoto = { url: string; credit: { name: string; uri?: string } | null };
export type CityPhotoFetcher = (city: string, country: string) => Promise<CityPhoto | null>;
export type PlacePhotoFetcher = (placeId: string) => Promise<CityPhoto | null>;

/** Wraps a fetcher so each city (or place) is asked for once while the page is open; a failure is no photo. */
export function cachedPhotos<A extends string[]>(fetch: (...args: A) => Promise<CityPhoto | null>): (...args: A) => Promise<CityPhoto | null> {
  const seen = new Map<string, Promise<CityPhoto | null>>();
  return (...args) => {
    const key = args.join("|");
    let p = seen.get(key);
    if (!p) {
      p = fetch(...args).catch(() => null);
      seen.set(key, p);
    }
    return p;
  };
}
