import { useEffect, useRef, useState } from "react";
import type { ActionItem, Group } from "../../lib/types";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";

interface Props {
  groups: Group[];
  minDate: string;
  maxDate: string;
  initial?: ActionItem;
  onSave: (fields: ActionItemFields) => Promise<unknown>;
  onCancel: () => void;
}

// "Everyone" is stored as no `who` at all, so only real group ids are chips.
const toIds = (who: ActionItem["who"]) => (who === undefined ? [] : Array.isArray(who) ? who : [who]).filter((id) => id !== "all");

// Inline add/edit row for an Action Item. Enter saves, Escape cancels.
export function ActionItemEditor({ groups, minDate, maxDate, initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [whoIds, setWhoIds] = useState<string[]>(() => toIds(initial?.who));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  const toggleWho = (id: string) => setWhoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(false);
    try {
      await onSave({
        title: title.trim(),
        detail: detail.trim(),
        date: date || undefined,
        who: whoIds.length === 0 ? undefined : whoIds.length === 1 ? whoIds[0] : whoIds,
      });
    } catch {
      setError(true);
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
      }}
    >
      <div className="ai-editor-text">
        <input
          ref={titleRef}
          className="ai-input"
          placeholder="What needs doing?"
          aria-label="Title"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="ai-input"
          placeholder="Details (optional)"
          aria-label="Details"
          maxLength={500}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
      </div>
      <div className="ai-editor-meta">
        <div className="ai-who" role="group" aria-label="Who">
          <button type="button" className="ai-chip" aria-pressed={whoIds.length === 0} onClick={() => setWhoIds([])}>
            Everyone
          </button>
          {groups.map((g) => {
            const on = whoIds.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                className="ai-chip"
                aria-pressed={on}
                onClick={() => toggleWho(g.id)}
                style={on ? { background: `${g.color}1a`, color: g.color, borderColor: g.color } : undefined}
              >
                {g.name}
              </button>
            );
          })}
        </div>
        <label className="ai-day">
          Day
          <input
            type="date"
            className="due-input"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div className="ai-editor-actions">
        {error && <span className="ai-error">Couldn't save — try again.</span>}
        <button type="button" className="ai-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ai-btn ai-btn-primary" disabled={!title.trim() || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
