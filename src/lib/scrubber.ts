// Helpers for the side day handle on long itineraries (see DayScrubber).

// Itineraries shorter than this don't need a scrubber.
export const SCRUBBER_MIN_DAYS = 8;

// The day shown at a page offset: the last one whose top is at or above it (`tops` ascending).
export function indexAtOffset(offset: number, tops: number[]): number {
  let found = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= offset + 1) found = i;
  return found;
}

// Rate control: how fast (px/s) the page scrolls while the finger is `offset` px from where it pressed.
// Nothing inside the `dead` zone, then it ramps up gently and reaches `max` at `dead + range` px.
export function rampSpeed(offset: number, max: number, dead = 10, range = 140): number {
  const past = Math.abs(offset) - dead;
  if (past <= 0) return 0;
  const share = Math.min(1, past / range);
  return Math.sign(offset) * max * share * share;
}
