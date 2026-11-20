import { useDroppable } from '@dnd-kit/react';
import type { Board, LaneId } from '../types';
import { boardLanes } from '../lib';

/** Prefix on a tab's droppable id, so a drop on a tab reads as "move to that lane". */
export const TAB_PREFIX = 'tab:';

function Tab({ id, name, count, on, onPick }: { id: LaneId; name: string; count: number; on: boolean; onPick: (l: LaneId) => void }) {
  const { ref, isDropTarget } = useDroppable({ id: TAB_PREFIX + id, type: 'tab', accept: 'card' });
  return (
    <button
      ref={ref}
      role="tab"
      className="lanetab"
      aria-selected={on}
      data-over={isDropTarget || undefined}
      onClick={() => onPick(id)}
    >
      {name}
      <span className="lanetab__count">{count}</span>
    </button>
  );
}

/** Phone layout: one tab per lane; drop a dragged card on a tab to move it there. */
export function LaneTabs({ board, active, onPick }: { board: Board; active: LaneId; onPick: (l: LaneId) => void }) {
  return (
    <div className="lanetabs" role="tablist" aria-label="Lanes">
      {boardLanes(board).map((l) => (
        <Tab key={l.id} id={l.id} name={l.name} count={board.lanes[l.id].length} on={l.id === active} onPick={onPick} />
      ))}
    </div>
  );
}
