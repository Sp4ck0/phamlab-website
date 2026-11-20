import type { Board, LaneId } from '../types';
import { boardLanes } from '../lib';

function Tab({ id, name, count, on, onPick }: { id: LaneId; name: string; count: number; on: boolean; onPick: (l: LaneId) => void }) {
  return (
    <button role="tab" className="lanetab" aria-selected={on} onClick={() => onPick(id)}>
      {name}
      <span className="lanetab__count">{count}</span>
    </button>
  );
}

/** Phone layout: one tab per lane; tap to switch lanes. (Dragging a card uses MoveTray.) */
export function LaneTabs({ board, active, onPick }: { board: Board; active: LaneId; onPick: (l: LaneId) => void }) {
  return (
    <div className="lanetabs" role="tablist" aria-label="Lanes">
      {boardLanes(board).map((l) => (
        <Tab key={l.id} id={l.id} name={l.name} count={board.lanes[l.id].length} on={l.id === active} onPick={onPick} />
      ))}
    </div>
  );
}
