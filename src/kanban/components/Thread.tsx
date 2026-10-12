import { useEffect, useRef, useState } from 'react';
import type { Board, Card } from '../types';
import { dayLabel, isMine, markSeen, replyAuthor, viewerSeat } from '../lib';

interface Props {
  card: Card;
  board: Board;
  /** Whoever raised the card — the thread hangs off their feedback. */
  raisedBy: string;
  onReply: (cardId: string, text: string) => void;
  onRemoveReply: (cardId: string, replyId: string) => void;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** The card's conversation: the feedback it hangs off, then replies as a chat. */
export function Thread({ card, board, raisedBy, onReply, onRemoveReply }: Props) {
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLLIElement>(null);
  const count = card.log.length;
  const isPair = board.type === 'pair';

  useEffect(() => setDraft(''), [card.id]);

  // Grow the composer with what's typed instead of scrolling inside one line.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Anything on screen has been read. When a reply lands while the card is
  // open (theirs or the one just sent), bring it into view — but not on
  // open, which would jump past the feedback itself.
  const shown = useRef({ id: card.id, count });
  useEffect(() => {
    markSeen(card);
    if (shown.current.id === card.id && count > shown.current.count) {
      end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    shown.current = { id: card.id, count };
  }, [card, count]);

  const send = () => {
    if (!draft.trim()) return;
    onReply(card.id, draft);
    setDraft('');
  };

  const other = board.people[viewerSeat(board) === 'a' ? 'b' : 'a'].name;

  return (
    <section className="field thread">
      <span className="label">
        Conversation{count > 0 && ` · ${count} ${count === 1 ? 'reply' : 'replies'}`}
      </span>
      <p className="thread__origin">
        {raisedBy} raised this · {dayLabel(card.createdAt)}
      </p>

      <ol className="thread__list">
        {card.log.map((r, i) => {
          const prev = card.log[i - 1];
          const day = dayLabel(r.at);
          const newDay = !prev || dayLabel(prev.at) !== day;
          const author = replyAuthor(board, r);
          // Back-to-back replies from one person read as one turn.
          const first = newDay || replyAuthor(board, prev) !== author;
          const mine = isMine(board, r);
          return (
            <li key={r.id} className="thread__item">
              {newDay && <span className="thread__day">{day}</span>}
              <div
                className="msg"
                data-mine={mine || undefined}
                data-first={first || undefined}
                data-who={isPair ? r.by : undefined}
              >
                {!mine && (
                  <span className="msg__avatar" aria-hidden="true">
                    {first && author.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="msg__body">
                  {first && (
                    <span className="msg__meta">
                      <b>{mine ? 'You' : author}</b> · {timeOf(r.at)}
                    </span>
                  )}
                  <div className="msg__row">
                    <p className="msg__bubble" title={new Date(r.at).toLocaleString()}>
                      {r.text}
                    </p>
                    {mine && (
                      <button
                        className="ghost msg__del"
                        aria-label="Delete reply"
                        onClick={() => onRemoveReply(card.id, r.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {count === 0 && (
          <li className="thread__empty">No replies yet. Write back to start the conversation.</li>
        )}
        <li ref={end} aria-hidden="true" />
      </ol>

      <div className="thread__composer">
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={isPair ? `Reply to ${other}…` : 'Write a reply…'}
          aria-label="Write a reply"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn thread__send" disabled={!draft.trim()} onClick={send}>
          Send
        </button>
      </div>
      <span className="thread__hint">Enter to send · Shift+Enter for a new line</span>
    </section>
  );
}
