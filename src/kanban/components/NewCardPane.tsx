import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Board, NewCardDraft } from '../types';
import { BOARD_COPY } from '../types';
import { boardLanes } from '../lib';

interface Props {
  board: Board;
  /** The in-progress card, or null when nothing is being written. */
  draft: NewCardDraft | null;
  /** True while the pane is expanded; false collapses it to the edge tab. */
  open: boolean;
  onChange: (patch: Partial<NewCardDraft>) => void;
  onMinimize: () => void;
  onExpand: () => void;
  onDiscard: () => void;
  onSubmit: () => void;
}

export function NewCardPane({ board, draft, open, onChange, onMinimize, onExpand, onDiscard, onSubmit }: Props) {
  const copy = BOARD_COPY[board.type];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMinimize();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onMinimize]);

  return (
    <>
      <AnimatePresence>
        {draft && open && (
          <>
            <motion.div
              className="scrim"
              onClick={onMinimize}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.aside
              className="drawer"
              data-kind={draft.kind}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              aria-label="New card"
            >
              <div className="drawer__inner">
                <header className="drawer__head">
                  <div className="seg" role="group" aria-label="Kind of feedback">
                    {copy.kinds.map((k) => (
                      <button
                        key={k.id}
                        title={k.hint}
                        data-on={draft.kind === k.id || undefined}
                        onClick={() => onChange({ kind: k.id })}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                </header>

                <label className="field">
                  <span className="label">Column</span>
                  <select value={draft.lane} onChange={(e) => onChange({ lane: e.target.value as NewCardDraft['lane'] })}>
                    {boardLanes(board).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">Title</span>
                  <textarea
                    autoFocus
                    rows={2}
                    value={draft.title}
                    placeholder="Title"
                    onChange={(e) => onChange({ title: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span className="label">The longer version</span>
                  <textarea
                    rows={5}
                    value={draft.note}
                    placeholder="Say more, if you want to (optional)"
                    onChange={(e) => onChange({ note: e.target.value })}
                  />
                </label>

                <div className="field">
                  <span className="label">Weight</span>
                  <div className="seg seg--weight" role="group" aria-label="Weight">
                    {copy.weights.map((w) => (
                      <button key={w.id} data-on={draft.weight === w.id || undefined} onClick={() => onChange({ weight: w.id })}>
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

                <footer className="drawer__foot">
                  <button className="ghost" onClick={onDiscard}>
                    Cancel
                  </button>
                  <button className="btn" onClick={onSubmit} disabled={!draft.title.trim()}>
                    Add card
                  </button>
                </footer>
              </div>
            </motion.aside>
            <motion.button
              className="newcard-handle"
              onClick={onMinimize}
              aria-label="Collapse pane"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              ›
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {draft && !open && (
        <button className="newcard-tab" onClick={onExpand} aria-label="Reopen draft">
          ✎ Draft{draft.title.trim() ? `: ${draft.title.trim().slice(0, 24)}` : ''}
        </button>
      )}
    </>
  );
}
