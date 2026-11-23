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

// Where a pointer at `y` sits along the track, 0 at the top to 1 at the bottom.
export function fractionAtPointer(y: number, top: number, height: number): number {
  if (height <= 0) return 0;
  return Math.min(1, Math.max(0, (y - top) / height));
}

// The scrubber works like a native scrollbar: the handle's place along the track is the share of
// the page scrolled (from `start`, the first day, to `end`, the furthest the page scrolls), so a
// tall opened-up day takes a long stretch of track instead of a leap in a tiny one.
export function offsetAtFraction(fraction: number, start: number, end: number): number {
  return start + Math.min(1, Math.max(0, fraction)) * Math.max(0, end - start);
}

export function fractionAtOffset(offset: number, start: number, end: number): number {
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (offset - start) / (end - start)));
}

// The day shown at a page offset: the last one whose top is at or above it (`tops` ascending).
export function indexAtOffset(offset: number, tops: number[]): number {
  let found = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= offset + 1) found = i;
  return found;
}

// One step of a critically damped spring toward `target`: it speeds up away from rest and slows
// into the target without overshooting. `smoothTime` is roughly how long (s) it takes to arrive;
// `dt` is the step (s). Returns the new value and velocity.
export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number): [number, number] {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}
