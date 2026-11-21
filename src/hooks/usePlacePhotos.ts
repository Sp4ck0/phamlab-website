import { useEffect, useState, type RefObject } from "react";
import type { CityPhoto, PlacePhotoFetcher } from "../lib/cityPhoto";

/** At most this many of a tile's places show a photo; the rest are a "+N". */
export const MAX_TILE_PHOTOS = 3;

export type TilePlace = { name: string; placeId: string };
export type TilePhoto = TilePlace & { photo: CityPhoto };

/** Photos of a tile's first few places, asked for once the tile nears the screen (a tile in a
 *  closed day never does), since a trip has many more tiles than a page view needs. */
export function usePlacePhotos(ref: RefObject<HTMLElement | null>, places: TilePlace[] | undefined, fetch: PlacePhotoFetcher | undefined): TilePhoto[] {
  const [photos, setPhotos] = useState<TilePhoto[]>([]);
  const wanted = (places ?? []).slice(0, MAX_TILE_PHOTOS);
  const key = JSON.stringify(wanted);
  useEffect(() => {
    const el = ref.current;
    const list: TilePlace[] = JSON.parse(key);
    if (!el || !fetch || !list.length) return;
    let live = true;
    const load = () =>
      void Promise.all(list.map((p) => fetch(p.placeId).then((photo) => (photo ? { ...p, photo } : null)))).then(
        (got) => live && setPhotos(got.filter((x): x is TilePhoto => x !== null))
      );
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => { live = false; };
    }
    const seen = new IntersectionObserver((hits) => {
      if (!hits.some((h) => h.isIntersecting)) return;
      seen.disconnect();
      load();
    }, { rootMargin: "300px 0px" });
    seen.observe(el);
    return () => { live = false; seen.disconnect(); };
  }, [ref, fetch, key]);
  // A place taken off the tile (an edit) drops its photo at once.
  return photos.filter((p) => wanted.some((w) => w.placeId === p.placeId));
}
