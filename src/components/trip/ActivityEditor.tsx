import { useEffect, useRef, useState } from "react";
import type { Place } from "../../lib/types";
import { serverMessage } from "../../lib/serverError";
import { PlacesEditor, cleanPlaces } from "./PlacesEditor";

interface Props {
  initial: string;
  initialPlaces?: Place[];
  /** The activity's time ("HH:MM"), or none. */
  initialTime?: string;
  /** `time` is undefined when it wasn't changed, null when it was cleared. */
  onSave: (text: string, places: Place[], time?: string | null) => Promise<unknown>;
  onCancel: () => void;
}

// Inline editor for one activity's time, text and places. Opens with the cursor at
// the end of the text so appending a note ("— Dec 5 sold out") is just type and save.
export function ActivityEditor({ initial, initialPlaces, initialTime, onSave, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const [time, setTime] = useState(initialTime ?? "");
  const [places, setPlaces] = useState<Place[]>(initialPlaces ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Grow with the text instead of scrolling inside a tiny box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  async function submit() {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError("");
    try {
      // Only a changed time is sent: a text-only edit never moves the activity.
      const nextTime = time === (initialTime ?? "") ? undefined : time || null;
      await onSave(text, cleanPlaces(places), nextTime);
    } catch (e) {
      // A ConvexError carries what the backend meant to say; otherwise Convex
      // wraps server errors and the useful part is the last line.
      const msg = e instanceof Error ? e.message.split("\n").pop() ?? "" : "";
      setError(serverMessage(e, msg.replace(/^(Uncaught )?Error:\s*/, "") || "Couldn't save — try again."));
      setSaving(false);
    }
  }

  return (
    <form
      className="ai-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <label className="ai-time">
        <span>Time</span>
        <input type="time" className="ai-input" value={time} onChange={(e) => setTime(e.target.value)} />
        {time && (
          <button type="button" className="ai-btn ai-time-clear" onClick={() => setTime("")} aria-label="Clear the time">
            No time
          </button>
        )}
      </label>
      <textarea
        ref={ref}
        className="ai-input"
        aria-label="Activity text"
        rows={1}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <PlacesEditor places={places} setPlaces={setPlaces} />
      <div className="ai-editor-actions">
        {error && <span className="ai-error">{error}</span>}
        <button type="button" className="ai-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ai-btn ai-btn-primary" disabled={!text.trim() || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
