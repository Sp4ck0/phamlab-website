import { useEffect, useRef, useState } from "react";
import { useTripNote } from "../../hooks/useTripNote";

// A floating button that opens a free-text pad for things that are neither an
// action item nor an itinerary row. Edits stay a draft in this browser until
// Save; the note itself is shared with everyone on the trip (and readable by
// connected AI assistants).
export function TripNote({ slug }: { slug: string }) {
  const note = useTripNote(slug);
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) area.current?.focus();
  }, [open]);

  if (!note.loaded) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void note.save();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="trip-note-fab"
        onClick={() => setOpen(true)}
        aria-label={note.dirty ? "Open trip notes (unsaved draft)" : "Open trip notes"}
        title="Trip notes"
      >
        <span aria-hidden="true">📝</span>
        {note.dirty ? <span className="trip-note-dot" aria-hidden="true" /> : null}
      </button>
    );
  }

  return (
    <section className="trip-note" aria-label="Trip notes" onKeyDown={onKeyDown}>
      <header>
        <strong>Trip notes</strong>
        <button type="button" className="trip-note-close" onClick={() => setOpen(false)} aria-label="Close notes">
          ✕
        </button>
      </header>
      <p className="trip-note-blurb">
        Your edits are kept as a draft in this browser only. Nothing is shared until you press <b>Save</b>. Saved notes
        are visible to everyone with access to this trip and to connected AI assistants.
      </p>
      {note.conflict ? (
        <div className="trip-note-conflict" role="alert">
          Someone else saved a newer version while you were editing.
          <details>
            <summary>See their version</summary>
            <pre>{note.saved || "(empty)"}</pre>
          </details>
          <div className="trip-note-actions">
            <button type="button" className="btn" onClick={note.keepMine}>
              Keep mine
            </button>
            <button type="button" className="btn" onClick={note.discard}>
              Use theirs
            </button>
          </div>
        </div>
      ) : null}
      <textarea
        ref={area}
        value={note.text}
        onChange={(e) => note.edit(e.target.value)}
        placeholder="Anything to remember that isn't an action item or an itinerary row, e.g. “Keep to 60 days in Schengen.”"
        maxLength={20000}
        spellCheck
      />
      {note.error ? <p className="trip-note-error">{note.error}</p> : null}
      <footer>
        <span className="trip-note-status">{note.dirty ? "Unsaved draft" : "Saved"}</span>
        {note.dirty && !note.conflict ? (
          <button type="button" className="btn" onClick={note.discard}>
            Discard
          </button>
        ) : null}
        <button type="button" className="btn trip-note-save" disabled={!note.dirty || note.conflict || note.saving} onClick={() => void note.save()}>
          {note.saving ? "Saving…" : "Save"}
        </button>
      </footer>
    </section>
  );
}
