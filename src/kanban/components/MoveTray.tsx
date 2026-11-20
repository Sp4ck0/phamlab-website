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

/** Phone layout: while a card is being dragged, big drop targets (one per other lane) rise from the bottom. */
export function MoveTray({ board }: { board: Board }) {
  const { source } = useDragOperation();
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
