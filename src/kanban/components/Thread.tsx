import { useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Card } from '../types';
import { dayLabel, isMine, pastedImages, replyAuthor, viewerSeat } from '../lib';
import { ImageGallery } from './ImageGallery';
import { ImagePicker } from './ImagePicker';

interface Props {
  card: Card;
  board: Board;
  /** Whoever raised the card — the thread hangs off their feedback. */
  raisedBy: string;
  /** Resolves once any images have uploaded and the reply is saved. */
  onReply: (cardId: string, text: string, files: File[]) => Promise<void>;
  onRemoveReply: (cardId: string, replyId: string) => void;
  /** Marks this card's replies as read for the viewer. */
  onRead: (cardId: string) => void;
}

const MAX_REPLY_IMAGES = 4; // matches the server cap

const timeOf =(iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** The card's conversation: the feedback it hangs off, then replies as a chat. */
export function Thread({ card, board, raisedBy, onReply, onRemoveReply, onRead }: Props) {
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLLIElement>(null);
  const count = card.log.length;
  const isPair = board.type === 'pair';

  useEffect(() => {
    setDraft('');
    setFiles([]);
    setError('');
  }, [card.id]);

  // Local previews for images waiting to be sent.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  const addFiles = (picked: File[]) => setFiles((prev) => [...prev, ...picked].slice(0, MAX_REPLY_IMAGES));

  // Grow the composer with what's typed instead of scrolling inside one line.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Anything on screen has been read — on open, and again whenever their
  // reply lands while the card is open.
  const unread = board.unread[card.id] ?? 0;
  const isNew = board.fresh.includes(card.id);
  useEffect(() => {
    if (unread > 0 || isNew) onRead(card.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onRead is a fresh closure each render
  }, [card.id, unread, isNew]);

  // When a reply lands while the card is open (theirs or the one just
  // sent), bring it into view — but not on open, which would jump past the
  // feedback itself.
  const shown = useRef({ id: card.id, count });
  useEffect(() => {
    if (shown.current.id === card.id && count > shown.current.count) {
      end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    shown.current = { id: card.id, count };
  }, [card.id, count]);

  const canSend = (!!draft.trim() || files.length > 0) && !sending;
  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      await onReply(card.id, draft, files);
      setDraft('');
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that");
    } finally {
      setSending(false);
    }
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
                    <div className="msg__content">
                      {r.text && (
                        <p className="msg__bubble" title={new Date(r.at).toLocaleString()}>
                          {r.text}
                        </p>
                      )}
                      {r.imageUrls && r.imageUrls.length > 0 && (
                        <div className="msg__images">
                          <ImageGallery
                            images={r.imageUrls}
                            label={`${mine ? 'Your' : `${author}'s`} attachment`}
                          />
                        </div>
                      )}
                    </div>
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

      {files.length > 0 && (
        <ul className="thread__pending" aria-label="Images to send">
          {previews.map((src, i) => (
            <li key={src} className="img-thumb" data-uploading={sending || undefined}>
              <img src={src} alt={files[i].name} />
              {!sending && (
                <button
                  type="button"
                  className="img-thumb__remove"
                  aria-label={`Remove ${files[i].name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="thread__composer">
        <ImagePicker onPick={addFiles} disabled={sending || files.length >= MAX_REPLY_IMAGES} />
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={isPair ? `Reply to ${other}…` : 'Write a reply…'}
          aria-label="Write a reply"
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const pasted = pastedImages(e);
            if (pasted.length) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
          onKeyDown={(e) => {
            // Touch keyboards have no Shift+Enter, so Enter stays a newline there.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia('(hover: none)').matches) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn thread__send" disabled={!canSend} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && (
        <span className="thread__hint thread__error" role="alert">
          {error}
        </span>
      )}
      <span className="thread__hint">
        {window.matchMedia('(hover: none)').matches
          ? 'Tap Send to post · paste or 📎 to add images'
          : 'Enter to send · Shift+Enter for a new line · paste or 📎 to add images'}
      </span>
    </section>
  );
}
