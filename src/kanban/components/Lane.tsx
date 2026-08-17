import { useState } from 'react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import type { Board, LaneId } from '../types';
import { LANES } from '../types';
import { CardTile } from './CardTile';

interface Props {
  lane: LaneId;
  board: Board;
  onOpen: (id: string) => void;
  onQuickAdd: (lane: LaneId, title: string) => void;
}

export function Lane({ lane, board, onOpen, onQuickAdd }: Props) {
  const meta = LANES.find((l) => l.id === lane)!;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const { ref, isDropTarget } = useDroppable({
    id: lane,
    type: 'column',
    accept: 'card',
    collisionPriority: CollisionPriority.Low,
  });

  const visible = board.lanes[lane];

  const submit = () => {
    const title = draft.trim();
    if (title) onQuickAdd(lane, title);
    setDraft('');
    setAdding(false);
  };

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
        {visible.map((id, index) => (
          <CardTile key={id} card={board.cards[id]} index={index} lane={lane} board={board} onOpen={onOpen} />
        ))}

        {visible.length === 0 && !adding && <p className="lane__empty">Nothing here yet.</p>}

        {adding ? (
          <div className="quickadd">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              placeholder="What do you want to say?"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape') {
                  setDraft('');
                  setAdding(false);
                }
              }}
            />
            <span className="quickadd__hint">Enter to add · Esc to cancel</span>
          </div>
        ) : (
          <button className="lane__add" onClick={() => setAdding(true)}>
            + write one
          </button>
        )}
      </div>
    </section>
  );
}
