// A photo of a day's city for its header, or of a place on a tile (convex/cityPhotos.ts), with
// the photographer's credit, which must be shown with it. Google's links are short-lived, so
// they are kept only for the page's lifetime, one request per city or place.
export type CityPhoto = { url: string; credit: { name: string; uri?: string } | null };
export type CityPhotoFetcher = (city: string, country: string) => Promise<CityPhoto | null>;
export type PlacePhotoFetcher = (placeId: string) => Promise<CityPhoto | null>;

/** The most one backend call may ask for (convex cityPhotos MAX_PHOTO_BATCH). */
export const PHOTO_BATCH = 20;

/** Asks for photos in batches: everything asked for within `waitMs` (photos that scrolled into
 *  view together) goes in one call of at most PHOTO_BATCH, and each item is asked for once while
 *  the page is open. A failed call is no photo for its items. */
export function batchedPhotos<T>(
  keyOf: (item: T) => string,
  fetchMany: (items: T[]) => Promise<(CityPhoto | null)[]>,
  waitMs = 50
): (item: T) => Promise<CityPhoto | null> {
  const seen = new Map<string, Promise<CityPhoto | null>>();
  let queue: { item: T; resolve: (photo: CityPhoto | null) => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    const waiting = queue;
    queue = [];
    for (let i = 0; i < waiting.length; i += PHOTO_BATCH) {
      const part = waiting.slice(i, i + PHOTO_BATCH);
      Promise.resolve()
        .then(() => fetchMany(part.map((w) => w.item)))
        .then(
          (photos) => part.forEach((w, j) => w.resolve(photos[j] ?? null)),
          () => part.forEach((w) => w.resolve(null))
        );
    }
  };
  return (item) => {
    const key = keyOf(item);
    let photo = seen.get(key);
    if (!photo) {
      photo = new Promise((resolve) => queue.push({ item, resolve }));
      seen.set(key, photo);
      timer ??= setTimeout(flush, waitMs);
    }
    return photo;
  };
}
