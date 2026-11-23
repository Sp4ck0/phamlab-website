// Where a vertical scrubber's handle sits for item `index` of `count`, and which item a pointer at
// `y` (within a track from `top`, `height` tall) means. Both are by item, not by page pixels, so a
// collapsed day takes the same share of the track as an open one.

// Itineraries shorter than this don't need a scrubber.
export const SCRUBBER_MIN_DAYS = 8;

export function fractionOfIndex(index: number, count: number): number {
  if (count < 2) return 0;
  return Math.min(1, Math.max(0, index / (count - 1)));
}

export function indexAtPointer(y: number, top: number, height: number, count: number): number {
  if (count < 2 || height <= 0) return 0;
  const f = Math.min(1, Math.max(0, (y - top) / height));
  return Math.round(f * (count - 1));
}
