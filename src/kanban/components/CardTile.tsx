import { useRef } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import type { Board, Card, LaneId, PersonId } from '../types';
import { BOARD_COPY, PEOPLE } from '../types';
import { dayLabel, isMine, progress, replyAuthor } from '../lib';

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
  const weights = BOARD_COPY[board.type].weights;
  const weight = weights.find((w) => w.id === card.weight) ?? weights[1];
  const isPair = board.type === 'pair';
  const today = new Date().toISOString().slice(0, 10);
  const due = card.followUp ? card.followUp <= today : false;
  const from = isPair ? board.people[card.from].name : (card.fromName ?? 'Someone');
  // Who's actually on the hook right now — owners of action items still open,
  // not who originally raised the card (that's the spine color instead).
  const nextStepOwners = PEOPLE.filter((p) =>
    card.actions.some((a) => !a.done && a.owner === p)
  );
  const lastReply = card.log[card.log.length - 1];
  const unread = board.unread[card.id] ?? 0;
  const isNew = board.fresh.includes(card.id);

  return (
    <article
      ref={ref}
      className="card"
      data-kind={card.kind}
      data-weight={card.weight}
      data-from={isPair ? card.from : undefined}
      data-dragging={isDragging || undefined}
      data-unread={unread > 0 || isNew || undefined}
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
      {unread > 0 ? (
        <span className="card__badge" title={`${unread} new ${unread === 1 ? 'reply' : 'replies'}`}>
          {unread}
        </span>
      ) : (
        isNew && (
          <span className="card__badge" title="New card">
            New
          </span>
        )
      )}

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
      {!!card.noteImageUrls?.length && (
        <p className="card__note" aria-label={`${card.noteImageUrls.length} attached images`}>
          📷 {card.noteImageUrls.length}
        </p>
      )}

      {lastReply && (
        <p className="card__replies">
          {unread > 0 ? `${unread} new` : `${card.log.length} ${card.log.length === 1 ? 'reply' : 'replies'}`}
          {' · '}
          {isMine(board, lastReply) ? 'You' : replyAuthor(board, lastReply)} replied {dayLabel(lastReply.at)}
        </p>
      )}

      <footer className="card__foot">
        <span className="card__from">
          {!isPair ? (
            <span className="card__owner">{from}</span>
          ) : nextStepOwners.length > 0 ? (
            nextStepOwners.map((p: PersonId) => (
              <span key={p} className="card__owner">
                <i className="dot" data-who={p} aria-hidden="true" />
                {board.people[p].name}
              </span>
            ))
          ) : (
            <span className="card__owner card__owner--empty">No next steps yet</span>
          )}
          {isPair && card.assignee && (
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
