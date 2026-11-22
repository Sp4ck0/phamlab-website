// Trip map clustering: zoomed out, pins that would sit on top of each other merge into one bubble
// with their count; zooming in splits a bubble into smaller ones and then into the pins themselves.

// Pins closer than this on screen share a bubble: pins are 30px across, so only ones that really
// cover each other; pins side by side still show.
export const CLUSTER_RADIUS_PX = 24;
// From this zoom in (about one city on screen) every pin shows on its own.
export const CLUSTER_MAX_ZOOM = 13;

interface LatLng {
  lat: number;
  lng: number;
}

// Web Mercator pixels at `zoom` (256px tiles).
function toPixels(p: LatLng, zoom: number) {
  const sin = Math.sin((Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180);
  const size = 256 * 2 ** zoom;
  return { x: ((p.lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size, size };
}

// Groups of indices into `points`, in input order: each group is the first pin not yet taken and
// every later free pin within `radius` pixels of it at `zoom`. A group of one is a pin shown alone.
export function clusterPoints(points: LatLng[], zoom: number, radius = CLUSTER_RADIUS_PX): number[][] {
  if (zoom >= CLUSTER_MAX_ZOOM) return points.map((_, i) => [i]);
  const px = points.map((p) => toPixels(p, Math.floor(zoom)));
  const taken = new Set<number>();
  const groups: number[][] = [];
  px.forEach((a, i) => {
    if (taken.has(i)) return;
    taken.add(i);
    const group = [i];
    for (let j = i + 1; j < px.length; j++) {
      if (taken.has(j)) continue;
      let dx = Math.abs(px[j].x - a.x);
      dx = Math.min(dx, a.size - dx); // the short way round the globe
      if (Math.hypot(dx, px[j].y - a.y) <= radius) {
        taken.add(j);
        group.push(j);
      }
    }
    groups.push(group);
  });
  return groups;
}

// Where a bubble sits: the middle of its pins.
export function clusterCenter(points: LatLng[]): LatLng {
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}
