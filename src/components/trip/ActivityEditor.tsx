import { useEffect, useRef, useState } from "react";
import type { Act, ActTiming, Place } from "../../lib/types";
import { serverMessage } from "../../lib/serverError";
import { PlacesEditor, cleanPlaces } from "./PlacesEditor";

interface Props {
  /** The title. */
  initial: string;
  /** The supporting line under the title, or none. */
  initialDescription?: string;
  initialPlaces?: Place[];
  /** The activity's time and end time ("HH:MM"), or none. */
  initialTime?: string;
  initialEndTime?: string;
  /** It takes the whole day, like a hotel. */
  initialAllDay?: boolean;
  /** `timing` holds only what changed (null = a time cleared). */
  onSave: (text: string, places: Place[], timing: ActTiming) => Promise<unknown>;
  onCancel: () => void;
  /** Removes the activity. The editor asks "Delete this activity?" first. Omitted = no Delete button. */
  onDelete?: (expected: Act) => Promise<unknown>;
  /** The whole activity as shown when the editor opened; a delete is checked against it. */
  openedAct?: Act;
  /** It was approved from an item: `onDelete` then takes it back out of the itinerary (the item reopens) instead of deleting it. */
  fromProposal?: boolean;
}

// Inline editor for one activity's timing (all day, or a time and an end time), text and
// places. Opens with the cursor at the end of the text so appending a note ("— Dec 5 sold
// out") is just type and save. The end time isn't shown on the card; it sets when the
// Add to Google Calendar event ends.
export function ActivityEditor({ initial, initialDescription, initialPlaces, initialTime, initialEndTime, initialAllDay = false, onSave, onCancel, onDelete, openedAct, fromProposal = false }: Props) {
  const [text, setText] = useState(initial);
  // What the person opened, kept even if the day updates underneath: a delete is checked against this, not the current row.
  const [opened] = useState<Act>(openedAct ?? initial);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [allDay, setAllDay] = useState(initialAllDay);
  const [time, setTime] = useState(initialTime ?? "");
  const [endTime, setEndTime] = useState(initialEndTime ?? "");
  const [places, setPlaces] = useState<Place[]>(initialPlaces ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
    // The same checks the server makes, said before a round trip.
    if (!allDay && endTime && !time) return setError("Set a start time before an end time.");
    if (!allDay && endTime && time && endTime <= time) return setError("End time must be after the start time.");
    setSaving(true);
    setError("");
    try {
      // Only what changed is sent: a text-only edit never moves the activity.
      const timing: ActTiming = {};
      if (allDay !== initialAllDay) timing.allDay = allDay;
      if (!allDay) {
        if (time !== (initialTime ?? "")) timing.time = time || null;
        if (endTime !== (initialEndTime ?? "")) timing.endTime = endTime || null;
      }
      // Same for the description: only a change is sent, and an emptied box clears it.
      if (description.trim() !== (initialDescription ?? "").trim()) timing.description = description.trim() || null;
      await onSave(text, cleanPlaces(places), timing);
    } catch (e) {
      // A ConvexError carries what the backend meant to say; otherwise Convex
      // wraps server errors and the useful part is the last line.
      const msg = e instanceof Error ? e.message.split("\n").pop() ?? "" : "";
      setError(serverMessage(e, msg.replace(/^(Uncaught )?Error:\s*/, "") || "Couldn't save — try again."));
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!onDelete || saving) return;
    setSaving(true);
    setError("");
    try {
      await onDelete(opened);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n").pop() ?? "" : "";
      setError(serverMessage(e, msg.replace(/^(Uncaught )?Error:\s*/, "") || "Couldn't delete — try again."));
      setSaving(false);
      setConfirmingDelete(false);
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
        if (e.key === "Escape") {
          if (confirmingDelete) setConfirmingDelete(false);
          else onCancel();
        }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !confirmingDelete) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <div className="ai-time">
        <label className="ai-allday">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          All day
        </label>
        {!allDay && (
          <>
            <label>
              <span>Start</span>
              <input type="time" className="ai-input" aria-label="Start time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label>
              <span>End</span>
              <input type="time" className="ai-input" aria-label="End time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
            {(time || endTime) && (
              <button type="button" className="ai-btn ai-time-clear" onClick={() => { setTime(""); setEndTime(""); }} aria-label="Clear the times">
                No time
              </button>
            )}
          </>
        )}
      </div>
      <textarea
        ref={ref}
        className="ai-input"
        aria-label="Activity text"
        placeholder="Title"
        rows={1}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <textarea
        className="ai-input"
        aria-label="Activity description"
        placeholder="Description (optional)"
        rows={2}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <PlacesEditor places={places} setPlaces={setPlaces} />
      <div className="ai-editor-actions">
        {error && <span className="ai-error">{error}</span>}
        {confirmingDelete ? (
          <>
            <span role="alert">{fromProposal ? "Take this out of the itinerary? Its item goes back to Action Items." : "Delete this activity?"}</span>
            <button type="button" className="ai-btn" onClick={() => setConfirmingDelete(false)} disabled={saving} autoFocus>
              Keep it
            </button>
            <button type="button" className="ai-btn ai-btn-danger" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? (fromProposal ? "Taking out…" : "Deleting…") : fromProposal ? "Yes, take it out" : "Yes, delete"}
            </button>
          </>
        ) : (
          <>
            {onDelete && (
              <button type="button" className="ai-btn ai-btn-danger ai-delete" onClick={() => setConfirmingDelete(true)} disabled={saving}>
                {fromProposal ? "Take out of itinerary" : "Delete"}
              </button>
            )}
            <button type="button" className="ai-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="ai-btn ai-btn-primary" disabled={!text.trim() || saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
