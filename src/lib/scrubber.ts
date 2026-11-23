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

// The same, but not rounded: 2.5 means halfway between item 2 and item 3, so a drag can move the
// page smoothly between days instead of snapping from one to the next.
export function positionAtPointer(y: number, top: number, height: number, count: number): number {
  if (count < 2 || height <= 0) return 0;
  return Math.min(1, Math.max(0, (y - top) / height)) * (count - 1);
}

// The page offset for a position between items, given each item's page offset.
export function offsetAtPosition(position: number, offsets: number[]): number {
  if (offsets.length === 0) return 0;
  const i = Math.min(offsets.length - 1, Math.max(0, Math.floor(position)));
  const next = offsets[i + 1];
  return next === undefined ? offsets[i] : offsets[i] + (position - i) * (next - offsets[i]);
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
