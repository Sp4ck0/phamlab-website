import { useEffect } from 'react';
import { pointerIntersection } from '@dnd-kit/collision';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import type { Board, LaneId } from '../types';
import { boardLanes, laneOf } from '../lib';

/** Prefix on a target's droppable id, so a drop on it reads as "move to that lane". */
export const MOVE_PREFIX = 'move:';

function Target({ lane, name }: { lane: LaneId; name: string }) {
  // The finger decides the target, not the dragged tile's outline (which covers several).
  const { ref, isDropTarget } = useDroppable({
    id: MOVE_PREFIX + lane,
    type: 'move',
    accept: 'card',
    collisionDetector: pointerIntersection,
  });
  return (
    <div ref={ref} className="movetray__target" data-over={isDropTarget || undefined}>
      <span className="movetray__arrow" aria-hidden="true">→</span>
      {isDropTarget ? `Release to move to ${name}` : name}
    </div>
  );
}

/** The band above the tray where a held finger scrolls the lane down (px), and the speed range (px per frame). */
const SCROLL_BAND = 140;
const SCROLL_MIN = 1;
const SCROLL_MAX = 16;
/** How long the finger must stay in the band to reach full speed (ms), so it starts slow. */
const SCROLL_RAMP_MS = 1400;

/**
 * While a card is held, dnd-kit only scrolls toward an edge the finger is near, and the tray
 * covers the bottom edge, so dragging down never scrolled. Scroll the lane down while the
 * finger sits just above the tray, slow at first and faster the longer it stays.
 */
function useScrollDownWhileDragging(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let y: number | null = null;
    let enteredAt: number | null = null;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      y = e.clientY;
    };
    const tick = (now: number) => {
      const trayTop = document.querySelector('.movetray')?.getBoundingClientRect().top;
      const inBand = y !== null && trayTop !== undefined && y < trayTop && y > trayTop - SCROLL_BAND;
      if (inBand) {
        enteredAt ??= now;
        const t = Math.min(1, (now - enteredAt) / SCROLL_RAMP_MS);
        // The lane's card list is what scrolls on a phone, not the page.
        document.querySelector('.lane__body')?.scrollBy(0, SCROLL_MIN + (SCROLL_MAX - SCROLL_MIN) * t * t);
      } else {
        enteredAt = null;
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true });
      cancelAnimationFrame(frame);
    };
  }, [active]);
}

/** Phone layout: while a card is being dragged, big drop targets (one per other lane) rise from the bottom. */
export function MoveTray({ board, onOverChange }: { board: Board; onOverChange: (over: boolean) => void }) {
  const { source, target } = useDragOperation();
  // Tell the page when the finger is on a target, so it can shrink the dragged tile then.
  const over = !!source && String(target?.id ?? '').startsWith(MOVE_PREFIX);
  useScrollDownWhileDragging(!!source);
  useEffect(() => {
    onOverChange(over);
  }, [over, onOverChange]);
  if (!source) return null;
  const from = laneOf(board, String(source.id));
  return (
    <div className="movetray" aria-hidden="true">
      <p className="movetray__hint">Drag here to move to another lane</p>
      <div className="movetray__targets">
        {boardLanes(board)
          .filter((l) => l.id !== from)
          .map((l) => (
            <Target key={l.id} lane={l.id} name={l.name} />
          ))}
      </div>
    </div>
  );
}
