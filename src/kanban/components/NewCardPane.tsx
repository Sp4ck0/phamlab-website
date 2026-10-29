import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Board, NewCardDraft } from '../types';
import { BOARD_COPY } from '../types';
import { boardLanes, pastedImages } from '../lib';
import { ImagePicker } from './ImagePicker';

const MAX_IMAGES = 8;

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
  /** True while images upload and the card is created. */
  busy: boolean;
  error: string;
}

export function NewCardPane({ board, draft, open, onChange, onMinimize, onExpand, onDiscard, onSubmit, busy, error }: Props) {
  const copy = BOARD_COPY[board.type];

  const images = draft?.images;
  const previews = useMemo(() => (images ?? []).map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const attach = (files: File[]) => {
    if (draft) onChange({ images: [...draft.images, ...files].slice(0, MAX_IMAGES) });
  };

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
                    onPaste={(e) => {
                      const pasted = pastedImages(e);
                      if (pasted.length) {
                        e.preventDefault();
                        attach(pasted);
                      }
                    }}
                  />
                </label>

                <div className="field note-images">
                  {previews.length > 0 && (
                    <div className="newcard-thumbs">
                      {previews.map((url, i) => (
                        <div key={url} className="newcard-thumb">
                          <img src={url} alt="" />
                          <button
                            type="button"
                            aria-label={`Remove image ${i + 1}`}
                            onClick={() => onChange({ images: draft.images.filter((_, j) => j !== i) })}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="note-images__bar">
                    <ImagePicker onPick={attach} disabled={busy || draft.images.length >= MAX_IMAGES} />
                    <span className="thread__hint">
                      {draft.images.length >= MAX_IMAGES
                        ? `Up to ${MAX_IMAGES} images`
                        : 'Paste a screenshot or tap 📎 to add images'}
                    </span>
                  </div>
                  {error && (
                    <span className="thread__hint thread__error" role="alert">
                      {error}
                    </span>
                  )}
                </div>

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
                  <button className="btn" onClick={onSubmit} disabled={!draft.title.trim() || busy}>
                    {busy ? 'Adding…' : 'Add card'}
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
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              ›
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {draft && !open && (
        <button className="newcard-tab" onClick={onExpand} aria-label="Reopen draft">
          ‹
        </button>
      )}
    </>
  );
}
