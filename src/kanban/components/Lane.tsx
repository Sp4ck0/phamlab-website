import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import type { Board, LaneId } from '../types';
import { boardLanes } from '../lib';
import { CardTile } from './CardTile';

interface Props {
  lane: LaneId;
  board: Board;
  onOpen: (id: string) => void;
  onStartAdd: (lane: LaneId) => void;
  /** True when the in-progress draft is targeting this column. */
  hasDraft: boolean;
}

export function Lane({ lane, board, onOpen, onStartAdd, hasDraft }: Props) {
  const meta = boardLanes(board).find((l) => l.id === lane)!;
  const { ref, isDropTarget } = useDroppable({
    id: lane,
    type: 'column',
    accept: 'card',
    collisionPriority: CollisionPriority.Low,
  });

  const visible = board.lanes[lane];

  return (
    <section className="lane" data-over={isDropTarget || undefined}>
      <header className="lane__head">
        <div className="lane__titles">
          <h2 className="lane__name">{meta.name}</h2>
          <p className="lane__blurb">{meta.blurb}</p>
        </div>
        <span className="lane__count">{visible.length || ''}</span>
      </header>

      <div className="lane__body" ref={ref}>
        {visible.map((id, index) => {
          // A dangling id (references a card that's gone) shouldn't take the
          // whole board down — just skip that tile.
          const card = board.cards[id];
          if (!card) return null;
          return <CardTile key={id} card={card} index={index} lane={lane} board={board} onOpen={onOpen} />;
        })}

        {visible.length === 0 && <p className="lane__empty">Nothing here yet.</p>}

        <button className="lane__add" data-draft={hasDraft || undefined} onClick={() => onStartAdd(lane)}>
          {hasDraft ? 'Go to draft ›' : '+ write one'}
        </button>
      </div>
    </section>
  );
}
