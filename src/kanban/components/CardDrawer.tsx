import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Board, Card, Kind, LaneId, PersonId } from '../types';
import { BOARD_COPY, PEOPLE } from '../types';
import { boardLanes, uid } from '../lib';
import { Thread } from './Thread';

interface Props {
  card: Card | null;
  board: Board;
  lane: LaneId | null;
  onClose: () => void;
  onChange: (id: string, patch: Partial<Card>) => void;
  onMove: (id: string, to: LaneId) => void;
  onDelete: (id: string) => void;
  onReply: (id: string, text: string) => void;
  onRemoveReply: (id: string, replyId: string) => void;
}

export function CardDrawer({
  card,
  board,
  lane,
  onClose,
  onChange,
  onMove,
  onDelete,
  onReply,
  onRemoveReply,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Local buffers for fields the user types into directly (title, note,
  // action item text). These are edited live and pushed to the server on
  // every keystroke, but the *displayed* value comes from here, not from
  // `card` — otherwise a mutation echoing back mid-typing can snap the
  // controlled input back to a stale value and swallow whatever's typed
  // since. Reset only when the open card actually changes.
  const [title, setTitle] = useState(card?.title ?? '');
  const [note, setNote] = useState(card?.note ?? '');
  const [actionDrafts, setActionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setConfirmDelete(false);
    setTitle(card?.title ?? '');
    setNote(card?.note ?? '');
    setActionDrafts({});
  }, [card?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = (who: PersonId) => board.people[who].name;
  const copy = BOARD_COPY[board.type];
  const isPair = board.type === 'pair';
  const raisedBy = card ? (isPair ? name(card.from) : (card.fromName ?? 'Someone')) : '';

  const addAction = (text: string) => {
    if (!card || !text.trim()) return;
    onChange(card.id, {
      actions: [...card.actions, { id: uid(), text: text.trim(), done: false, owner: null }],
    });
  };

  const patchAction = (actionId: string, patch: Partial<Card['actions'][number]>) => {
    if (!card) return;
    onChange(card.id, {
      actions: card.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
    });
  };

  const setActionText = (actionId: string, text: string) => {
    setActionDrafts((prev) => ({ ...prev, [actionId]: text }));
    patchAction(actionId, { text });
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
                <button className="drawer__close" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </header>

              <textarea
                className="drawer__title"
                rows={2}
                value={title}
                placeholder="Say it plainly"
                onChange={(e) => {
                  setTitle(e.target.value);
                  onChange(card.id, { title: e.target.value });
                }}
              />

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
                <textarea
                  rows={4}
                  value={note}
                  placeholder={copy.notePlaceholder}
                  onChange={(e) => {
                    setNote(e.target.value);
                    onChange(card.id, { note: e.target.value });
                  }}
                />
              </label>

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
                            actions: card.actions.filter((x) => x.id !== a.id),
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

              <div className="row">
                <label className="field">
                  <span className="label">Check back on</span>
                  <input
                    type="date"
                    value={card.followUp ?? ''}
                    onChange={(e) => onChange(card.id, { followUp: e.target.value || null })}
                  />
                </label>

                <label className="field">
                  <span className="label">Lane</span>
                  <select
                    value={lane ?? ''}
                    onChange={(e) => onMove(card.id, e.target.value as LaneId)}
                  >
                    {boardLanes(board).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Thread
                card={card}
                board={board}
                raisedBy={raisedBy}
                onReply={onReply}
                onRemoveReply={onRemoveReply}
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
