import { useState } from 'react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import type { Board, Kind, LaneId, QuickAddDraft, Weight } from '../types';
import { KINDS, LANES, WEIGHTS } from '../types';
import { CardTile } from './CardTile';

interface Props {
  lane: LaneId;
  board: Board;
  onOpen: (id: string) => void;
  onQuickAdd: (lane: LaneId, draft: QuickAddDraft) => void;
}

export function Lane({ lane, board, onOpen, onQuickAdd }: Props) {
  const meta = LANES.find((l) => l.id === lane)!;
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<Kind>('feedback');
  const [weight, setWeight] = useState<Weight>('medium');

  const { ref, isDropTarget } = useDroppable({
    id: lane,
    type: 'column',
    accept: 'card',
    collisionPriority: CollisionPriority.Low,
  });

  const visible = board.lanes[lane];

  const reset = () => {
    setTitle('');
    setNote('');
    setKind('feedback');
    setWeight('medium');
    setAdding(false);
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onQuickAdd(lane, { title: trimmed, note: note.trim(), kind, weight });
    reset();
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
              value={title}
              placeholder="What do you want to say?"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') reset();
              }}
            />
            <textarea
              rows={2}
              value={note}
              placeholder="Say more, if you want to (optional)"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') reset();
              }}
            />

            <div className="quickadd__row">
              <div className="seg seg--tight" role="group" aria-label="Kind of feedback">
                {KINDS.map((k) => (
                  <button key={k.id} title={k.hint} data-on={kind === k.id || undefined} onClick={() => setKind(k.id)}>
                    {k.label}
                  </button>
                ))}
              </div>
              <div className="seg seg--weight seg--tight" role="group" aria-label="Weight">
                {WEIGHTS.map((w) => (
                  <button key={w.id} data-on={weight === w.id || undefined} onClick={() => setWeight(w.id)}>
                    <span className="weight" aria-hidden="true">
                      {[1, 2, 3].map((n) => (
                        <i key={n} data-on={n <= w.bars || undefined} />
                      ))}
                    </span>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="quickadd__actions">
              <button className="ghost" onClick={reset}>
                Cancel
              </button>
              <button className="btn" onClick={submit} disabled={!title.trim()}>
                Add
              </button>
            </div>
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
