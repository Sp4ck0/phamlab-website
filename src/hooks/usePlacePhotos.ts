import { useEffect, useState, type RefObject } from "react";
import type { CityPhoto, PlacePhotoFetcher } from "../lib/cityPhoto";

export type TilePlace = { name: string; placeId: string };
export type TilePhoto = TilePlace & { photo: CityPhoto };

/** A photo of a tile's first place, asked for once the tile nears the screen (a tile in a closed
 *  day never does): one photo per tile, since each costs a paid Google request. */
export function usePlacePhoto(ref: RefObject<HTMLElement | null>, place: TilePlace | undefined, fetch: PlacePhotoFetcher | undefined): TilePhoto | null {
  const [got, setGot] = useState<TilePhoto | null>(null);
  const name = place?.name;
  const placeId = place?.placeId;
  useEffect(() => {
    const el = ref.current;
    if (!el || !fetch || !placeId || name === undefined) return;
    let live = true;
    const load = () => void fetch(placeId).then((photo) => live && setGot(photo ? { name, placeId, photo } : null));
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
  }, [ref, fetch, name, placeId]);
  // A place taken off the tile (an edit) drops its photo at once.
  return got && got.placeId === placeId ? got : null;
}
