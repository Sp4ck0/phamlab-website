import { useEffect, useRef, useState } from "react";

// Plays a list of steps one at a time (an AI edit's changes, see DetailedView).
// `play(i, fast, done)` runs step i and calls `done` when it is over; it may
// return a cancel function. A new `key` starts a new list from its first step,
// cancelling whatever was playing (what was left of the old list is simply
// shown as it ends up). After the last step `onEnd` runs.
//
// While more than FAST_AFTER steps are still to play (this one included), a
// step is `fast`: the caller plays it quickly so a long list catches up.
export const FAST_AFTER = 3;

export function useChangeQueue(
  key: string | null,
  count: number,
  play: (i: number, fast: boolean, done: () => void) => (() => void) | void,
  onEnd: () => void
): number {
  const [at, setAt] = useState<{ key: string | null; i: number }>({ key, i: 0 });
  const i = at.key === key ? at.i : 0;
  const playRef = useRef(play);
  const endRef = useRef(onEnd);
  useEffect(() => {
    playRef.current = play;
    endRef.current = onEnd;
  });

  useEffect(() => {
    if (key === null) return;
    if (i >= count) {
      endRef.current();
      return;
    }
    let over = false;
    const done = () => {
      if (over) return;
      over = true;
      setAt({ key, i: i + 1 });
    };
    const cancel = playRef.current(i, count - i > FAST_AFTER, done);
    return () => {
      over = true;
      cancel?.();
    };
  }, [key, i, count]);

  return key === null ? -1 : i;
}
