import { useRef } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import type { Board, Card, LaneId, PersonId } from '../types';
import { PEOPLE, WEIGHTS } from '../types';
import { progress } from '../lib';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function prettyDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${y === new Date().getFullYear() ? '' : ` ’${String(y).slice(2)}`}`;
}

interface Props {
  card: Card;
  index: number;
  lane: LaneId;
  board: Board;
  onOpen: (id: string) => void;
}

export function CardTile({ card, index, lane, board, onOpen }: Props) {
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    group: lane,
    type: 'card',
    accept: 'card',
  });

  // The whole card is the drag handle, so a click that travelled is a drag, not a tap.
  const down = useRef<{ x: number; y: number } | null>(null);

  const { total, done } = progress(card);
  const weight = WEIGHTS.find((w) => w.id === card.weight) ?? WEIGHTS[1];
  const today = new Date().toISOString().slice(0, 10);
  const due = card.followUp ? card.followUp <= today : false;
  const from = board.people[card.from].name;
  // Who's actually on the hook right now — owners of action items still open,
  // not who originally raised the card (that's the spine color instead).
  const nextStepOwners = PEOPLE.filter((p) =>
    card.actions.some((a) => !a.done && a.owner === p)
  );

  return (
    <article
      ref={ref}
      className="card"
      data-kind={card.kind}
      data-weight={card.weight}
      data-from={card.from}
      data-dragging={isDragging || undefined}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const start = down.current;
        down.current = null;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
        onOpen(card.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(card.id);
      }}
      tabIndex={0}
      role="button"
      aria-label={`${card.title}, raised by ${from}`}
    >
      <span className="card__spine" aria-hidden="true" />

      <header className="card__head">
        <span className="card__kind">{card.kind}</span>
        <span className="weight" title={weight.label} aria-label={weight.label}>
          {[1, 2, 3].map((n) => (
            <i key={n} data-on={n <= weight.bars || undefined} />
          ))}
        </span>
        <span className="card__spacer" />
        <span className="card__created">{prettyDate(card.createdAt.slice(0, 10))}</span>
        {card.followUp && (
          <span className="card__due" data-due={due || undefined}>
            {due ? '● ' : ''}
            {prettyDate(card.followUp)}
          </span>
        )}
      </header>

      <h3 className="card__title">{card.title}</h3>

      {card.note && <p className="card__note">{card.note}</p>}

      <footer className="card__foot">
        <span className="card__from">
          {nextStepOwners.length > 0 ? (
            nextStepOwners.map((p: PersonId) => (
              <span key={p} className="card__owner">
                <i className="dot" data-who={p} aria-hidden="true" />
                {board.people[p].name}
              </span>
            ))
          ) : (
            <span className="card__owner card__owner--empty">No next steps yet</span>
          )}
          {card.assignee && (
            <span className="card__owner">
              <span className="card__owner-tag">Owned by</span>
              <i className="dot" data-who={card.assignee} aria-hidden="true" />
              {board.people[card.assignee].name}
            </span>
          )}
        </span>

        {total > 0 && (
          <span className="card__actions" title={`${done} of ${total} action items done`}>
            {Array.from({ length: total }).map((_, i) => (
              <i key={i} className="tick" data-done={i < done || undefined} />
            ))}
            <span className="card__count">
              {done}/{total}
            </span>
          </span>
        )}
      </footer>
    </article>
  );
}
