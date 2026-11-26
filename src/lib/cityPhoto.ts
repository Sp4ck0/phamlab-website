// A photo of a day's city for its header, or of a place on a tile (convex/cityPhotos.ts), with
// the photographer's credit, which must be shown with it. Each new photo is a paid Google
// download and the backend allows only so many a day, so a photo found is also kept in this
// browser (localStorage, for a week) and used again on the next visit, as long as its link
// still loads; Google's links expire, and an expired one is simply asked for again.
export type CityPhoto = { url: string; credit: { name: string; uri?: string } | null };
export type CityPhotoFetcher = (city: string, country: string) => Promise<CityPhoto | null>;
export type PlacePhotoFetcher = (placeId: string) => Promise<CityPhoto | null>;

/** The most one backend call may ask for (convex cityPhotos MAX_PHOTO_BATCH). */
export const PHOTO_BATCH = 20;

/** How long a photo kept in this browser is used before it's asked for again. */
export const KEEP_MS = 7 * 24 * 60 * 60_000;

function readKept(name: string): CityPhoto | null {
  try {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    const kept = JSON.parse(raw) as CityPhoto & { at?: number };
    if (typeof kept?.url === "string" && typeof kept.at === "number" && Date.now() - kept.at < KEEP_MS) return { url: kept.url, credit: kept.credit ?? null };
    localStorage.removeItem(name);
  } catch {
    // No storage (private window, blocked): ask as usual.
  }
  return null;
}

function keep(name: string, photo: CityPhoto | null) {
  try {
    if (photo) localStorage.setItem(name, JSON.stringify({ ...photo, at: Date.now() }));
    else localStorage.removeItem(name);
  } catch {
    // Full or blocked: the photo is still shown, just not kept.
  }
}

/** Whether the browser can still load `url`: the photos are CSS backgrounds, which never say
 *  when a link has expired. */
export function loads(url: string, timeoutMs = 4000): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok: boolean) => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/** Asks for photos in batches: everything asked for within `waitMs` (photos that scrolled into
 *  view together) goes in one call of at most PHOTO_BATCH, and each item is asked for once while
 *  the page is open. A failed call is no photo for its items. With `store`, a photo found is kept
 *  in this browser and used on later visits while its link loads; no photo is never kept, so it is
 *  asked for again next time. */
export function batchedPhotos<T>(
  keyOf: (item: T) => string,
  fetchMany: (items: T[]) => Promise<(CityPhoto | null)[]>,
  waitMs = 50,
  store?: string
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
  const ask = (item: T, name: string | undefined) => {
    const photo = new Promise<CityPhoto | null>((resolve) => queue.push({ item, resolve }));
    timer ??= setTimeout(flush, waitMs);
    return name ? photo.then((p) => (keep(name, p), p)) : photo;
  };
  return (item) => {
    const key = keyOf(item);
    let photo = seen.get(key);
    if (!photo) {
      const name = store && `photo:${store}:${key}`;
      const kept = name ? readKept(name) : null;
      photo = kept && name ? loads(kept.url).then((ok) => (ok ? kept : ask(item, name))) : ask(item, name || undefined);
      seen.set(key, photo);
    }
    return photo;
  };
}
