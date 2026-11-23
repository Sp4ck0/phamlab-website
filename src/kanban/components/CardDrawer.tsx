import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Board, Card, Kind, LaneId, PersonId } from '../types';
import { BOARD_COPY, PEOPLE } from '../types';
import { boardLanes, pastedImages, uid } from '../lib';
import { serverMessage } from '../../lib/serverError';
import { copyCardLink } from '../../lib/shareLink';
import { findLinks } from '../../lib/links';
import { ImageGallery } from './ImageGallery';
import { ImagePicker } from './ImagePicker';
import { NoteBox } from './NoteBox';
import { Thread } from './Thread';

interface Props {
  card: Card | null;
  boardId?: string;
  board: Board;
  lane: LaneId | null;
  onClose: () => void;
  onChange: (id: string, patch: Partial<Card>) => void;
  onMove: (id: string, to: LaneId) => void;
  onDelete: (id: string) => void;
  onReply: (id: string, text: string, files: File[]) => Promise<void>;
  onRemoveReply: (id: string, replyId: string) => void;
  onAddNoteImages: (id: string, files: File[]) => Promise<void>;
  onRemoveNoteImage: (id: string, imageId: string) => void;
  onRead: (id: string) => void;
}

/** Typing is saved once it pauses this long (see saveSoon). */
const SAVE_DELAY_MS = 600;

type Actions = Card['actions'];

/** Actions with any not-yet-saved typed text laid over them. */
const withDrafts = (actions: Actions, drafts: Record<string, string>): Actions =>
  actions.map((a) => (drafts[a.id] === undefined ? a : { ...a, text: drafts[a.id] }));

export function CardDrawer({
  card,
  boardId,
  board,
  lane,
  onClose,
  onChange,
  onMove,
  onDelete,
  onReply,
  onRemoveReply,
  onAddNoteImages,
  onRemoveNoteImage,
  onRead,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The share button copies the link and says how it went for a moment (the link never carries the access code).
  const [linkStatus, setLinkStatus] = useState('');
  useEffect(() => {
    if (!linkStatus) return;
    const t = window.setTimeout(() => setLinkStatus(''), 2000);
    return () => window.clearTimeout(t);
  }, [linkStatus]);
  // Local buffers for fields the user types into directly (title, note,
  // action item text). These are edited live and pushed to the server on
  // every keystroke, but the *displayed* value comes from here, not from
  // `card` — otherwise a mutation echoing back mid-typing can snap the
  // controlled input back to a stale value and swallow whatever's typed
  // since. Reset only when the open card actually changes.
  const [title, setTitle] = useState(card?.title ?? '');
  const [note, setNote] = useState(card?.note ?? '');
  const noteLinks = findLinks(note);
  const [followUp, setFollowUp] = useState(card?.followUp ?? '');
  const [actionDrafts, setActionDrafts] = useState<Record<string, string>>({});
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Each save rewrites the card and reloads the board for everyone looking at
  // it, so text isn't pushed on every keystroke: saveSoon queues it (the latest
  // per field wins) and flush sends what's queued — after a pause, on blur,
  // and when the drawer closes or moves to another card.
  const pending = useRef(new Map<string, () => void>());
  const saveTimer = useRef<number | undefined>(undefined);
  const flush = () => {
    window.clearTimeout(saveTimer.current);
    const saves = [...pending.current.values()];
    pending.current.clear();
    saves.forEach((save) => save());
  };
  const saveSoon = (field: string, save: () => void) => {
    pending.current.set(field, save);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };
  useEffect(() => flush, [card?.id]);

  // Latest card / typed action text, for a queued save to read when it fires.
  const cardRef = useRef(card);
  cardRef.current = card;
  const draftsRef = useRef(actionDrafts);
  draftsRef.current = actionDrafts;

  useEffect(() => {
    setConfirmDelete(false);
    setNoteError('');
    setTitle(card?.title ?? '');
    setNote(card?.note ?? '');
    setFollowUp(card?.followUp ?? '');
    setActionDrafts({});
    // Deliberately keyed on the card id only: re-running on every echo of the
    // open card would snap the inputs back to a stale value mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const attach = async (files: File[]) => {
    if (!card) return;
    setNoteBusy(true);
    setNoteError('');
    try {
      await onAddNoteImages(card.id, files);
    } catch (e) {
      setNoteError(serverMessage(e, e instanceof Error ? e.message : "Couldn't add that image"));
    } finally {
      setNoteBusy(false);
    }
  };

  const name = (who: PersonId) => board.people[who].name;
  const copy = BOARD_COPY[board.type];
  const isPair = board.type === 'pair';
  const raisedBy = card ? (isPair ? name(card.from) : (card.fromName ?? 'Someone')) : '';

  const addAction = (text: string) => {
    if (!card || !text.trim()) return;
    onChange(card.id, {
      actions: [...withDrafts(card.actions, actionDrafts), { id: uid(), text: text.trim(), done: false, owner: null }],
    });
  };

  const patchAction = (actionId: string, patch: Partial<Actions[number]>) => {
    if (!card) return;
    onChange(card.id, {
      actions: withDrafts(card.actions, actionDrafts).map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
    });
  };

  const setActionText = (actionId: string, text: string) => {
    if (!card) return;
    const drafts = { ...actionDrafts, [actionId]: text };
    setActionDrafts(drafts);
    // If the drawer has moved to another card by the time this fires, fall
    // back to what this card looked like when the typing happened.
    const id = card.id;
    const snapshot = card.actions;
    saveSoon('actions', () => {
      const current = cardRef.current;
      const same = current?.id === id;
      onChange(id, { actions: withDrafts(same ? current.actions : snapshot, same ? draftsRef.current : drafts) });
    });
  };

  return (
    <AnimatePresence>
      {card && (
        <>
          <motion.div
            className="scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            className="drawer"
            data-kind={card.kind}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            aria-label="Card details"
          >
            <div className="drawer__inner">
              <header className="drawer__head">
                <textarea
                  className="drawer__title"
                  rows={1}
                  value={title}
                  placeholder="Say it plainly"
                  onChange={(e) => {
                    const value = e.target.value;
                    const id = card.id;
                    setTitle(value);
                    saveSoon('title', () => onChange(id, { title: value }));
                  }}
                  onBlur={flush}
                />
                {boardId && (
                  <span className="share-wrap">
                    <button
                      className="drawer__link"
                      onClick={() => void copyCardLink(boardId, card.id).then(setLinkStatus)}
                      aria-label="Share link to this card"
                      title="Copy link to this card"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 15V3" />
                        <path d="m7 8 5-5 5 5" />
                        <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                      </svg>
                    </button>
                    <span role="status" className="share-status">
                      {linkStatus}
                    </span>
                  </span>
                )}
                <button className="drawer__close" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </header>

              <div className="seg" role="group" aria-label="Kind of feedback">
                {copy.kinds.map((k) => (
                  <button
                    key={k.id}
                    title={k.hint}
                    data-on={card.kind === k.id || undefined}
                    onClick={() => onChange(card.id, { kind: k.id as Kind })}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="who__block">
                <span className="label">{copy.weightLabel(raisedBy)}</span>
                <div className="seg seg--weight" role="group" aria-label="Weight">
                  {copy.weights.map((w) => (
                    <button
                      key={w.id}
                      data-on={card.weight === w.id || undefined}
                      onClick={() => onChange(card.id, { weight: w.id })}
                    >
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

              {!isPair && (
                <div className="who__block">
                  <span className="label">Raised by</span>
                  {raisedBy}
                </div>
              )}

              {isPair && (
                <div className="who">
                  <label className="who__block">
                    <span className="label">Raised by</span>
                    <div className="seg seg--people">
                      {PEOPLE.map((p) => (
                        <button
                          key={p}
                          data-on={card.from === p || undefined}
                          data-who={p}
                          onClick={() => onChange(card.id, { from: p })}
                        >
                          {name(p)}
                        </button>
                      ))}
                    </div>
                  </label>
  
                  <label className="who__block">
                    <span className="label">Owned by</span>
                    <div className="seg seg--people">
                      {PEOPLE.map((p) => (
                        <button
                          key={p}
                          data-on={card.assignee === p || undefined}
                          data-who={p}
                          onClick={() =>
                            onChange(card.id, { assignee: card.assignee === p ? null : p })
                          }
                        >
                          {name(p)}
                        </button>
                      ))}
                      <button
                        data-on={card.assignee === null || undefined}
                        onClick={() => onChange(card.id, { assignee: null })}
                      >
                        Both
                      </button>
                    </div>
                  </label>
                </div>
              )}

              <label className="field">
                <span className="label">The longer version</span>
                <NoteBox
                  value={note}
                  placeholder={copy.notePlaceholder}
                  onChange={(e) => {
                    const value = e.target.value;
                    const id = card.id;
                    setNote(value);
                    saveSoon('note', () => onChange(id, { note: value }));
                  }}
                  onBlur={flush}
                  onPaste={(e) => {
                    const pasted = pastedImages(e);
                    if (pasted.length) {
                      e.preventDefault();
                      void attach(pasted);
                    }
                  }}
                />
              </label>
              {noteLinks.length > 0 && (
                <p className="note-links">
                  <span className="label">Links</span>
                  {noteLinks.map((l, i) => (
                    <a key={i} href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.href}
                    </a>
                  ))}
                </p>
              )}
              <div className="field note-images">
                <ImageGallery
                  images={card.noteImageUrls ?? []}
                  label="Attachment on the longer version"
                  onRemove={(imageId) => onRemoveNoteImage(card.id, imageId)}
                />
                <div className="note-images__bar">
                  <ImagePicker onPick={(files) => void attach(files)} disabled={noteBusy} />
                  <span className="thread__hint">
                    {noteBusy ? 'Uploading…' : 'Paste a screenshot or tap 📎 to add images'}
                  </span>
                </div>
                {noteError && (
                  <span className="thread__hint thread__error" role="alert">
                    {noteError}
                  </span>
                )}
              </div>

              <section className="field">
                <span className="label">Action items</span>
                <ul className="actions">
                  {card.actions.map((a) => (
                    <li key={a.id} data-done={a.done || undefined}>
                      <button
                        className="check"
                        aria-label={a.done ? 'Mark as not done' : 'Mark as done'}
                        data-on={a.done || undefined}
                        onClick={() => patchAction(a.id, { done: !a.done })}
                      >
                        ✓
                      </button>
                      <input
                        value={actionDrafts[a.id] ?? a.text}
                        onChange={(e) => setActionText(a.id, e.target.value)}
                        onBlur={flush}
                      />
                      {isPair && (
                        <div className="owner">
                          {PEOPLE.map((p) => (
                            <button
                              key={p}
                              className="owner__pip"
                              data-who={p}
                              data-on={a.owner === p || undefined}
                              title={`${name(p)} takes this`}
                              onClick={() => patchAction(a.id, { owner: a.owner === p ? null : p })}
                            >
                              {name(p).slice(0, 1).toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        className="ghost"
                        aria-label="Remove action item"
                        onClick={() =>
                          onChange(card.id, {
                            actions: withDrafts(card.actions, actionDrafts).filter((x) => x.id !== a.id),
                          })
                        }
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <input
                  className="actions__new"
                  placeholder={copy.actionPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addAction(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </section>

              <div className="who__block">
                <span className="label">Lane</span>
                <div className="seg seg--lanes" role="group" aria-label="Lane">
                  {boardLanes(board).map((l) => (
                    <button
                      key={l.id}
                      data-on={lane === l.id || undefined}
                      onClick={() => lane !== l.id && onMove(card.id, l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="label">Check back on</span>
                <div className="field__row">
                  <input
                    type="date"
                    max="9999-12-31"
                    value={followUp}
                    onChange={(e) => {
                      const { value, validity } = e.target;
                      const id = card.id;
                      setFollowUp(value);
                      // Half-typed, the browser reports '' (badInput): that's not
                      // "cleared", so don't save it or the field resets.
                      if (!value && validity.badInput) return;
                      saveSoon('followUp', () => onChange(id, { followUp: value || null }));
                    }}
                  />
                  {/* iOS's calendar has no way to empty the field, so offer one. */}
                  {followUp && (
                    <button
                      type="button"
                      className="ghost"
                      aria-label="Clear check-back date"
                      onClick={() => {
                        const id = card.id;
                        setFollowUp('');
                        saveSoon('followUp', () => onChange(id, { followUp: null }));
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </label>

              <Thread
                card={card}
                board={board}
                raisedBy={raisedBy}
                onReply={onReply}
                onRemoveReply={onRemoveReply}
                onRead={onRead}
              />

              <footer className="drawer__foot">
                <span className="drawer__born">
                  Written {new Date(card.createdAt).toLocaleDateString()}
                </span>
                {confirmDelete ? (
                  <span className="confirm">
                    Delete for good?
                    <button className="btn btn--danger" onClick={() => onDelete(card.id)}>
                      Yes
                    </button>
                    <button className="ghost" onClick={() => setConfirmDelete(false)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button className="ghost" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )}
              </footer>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
