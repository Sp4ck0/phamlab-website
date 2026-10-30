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

type Scope = "trip" | "day" | "range";
const SCOPES: { id: Scope; label: string }[] = [
  { id: "trip", label: "Whole trip" },
  { id: "day", label: "One day" },
  { id: "range", label: "Date range" },
];

// "Everyone" is stored as no `who` at all, so only real group ids are chips.
const toIds = (who: ActionItem["who"]) => (who === undefined ? [] : Array.isArray(who) ? who : [who]).filter((id) => id !== "all");

// Inline add/edit row for an Action Item. Enter saves, Escape cancels.
export function ActionItemEditor({ groups, minDate, maxDate, initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [kind, setKind] = useState<"custom" | "decision">(initial?.kind ?? "custom");
  // The scope follows from the fields: no date = whole trip, a date = that day,
  // a date and an end date = a range.
  const [scope, setScope] = useState<Scope>(initial?.endDate ? "range" : initial?.date ? "day" : "trip");
  const [date, setDate] = useState(initial?.date ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [whoIds, setWhoIds] = useState<string[]>(() => toIds(initial?.who));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  const toggleWho = (id: string) => setWhoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // A day or range needs its date(s); a range can't end before it starts.
  const scopeOk = scope === "trip" || (!!date && (scope === "day" || (!!endDate && endDate >= date)));

  async function submit() {
    if (!title.trim() || !scopeOk || saving) return;
    setSaving(true);
    setError(false);
    try {
      await onSave({
        title: title.trim(),
        detail: detail.trim(),
        date: scope === "trip" ? undefined : date,
        endDate: scope === "range" ? endDate : undefined,
        kind,
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
        <div className="ai-who" role="group" aria-label="Kind">
          {(["custom", "decision"] as const).map((k) => (
            <button key={k} type="button" className="ai-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === "custom" ? "To-do" : "Decision"}
            </button>
          ))}
        </div>
        <div className="ai-who" role="group" aria-label="When">
          {SCOPES.map((s) => (
            <button key={s.id} type="button" className="ai-chip" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        {scope !== "trip" && (
          <label className="ai-day">
            {scope === "range" ? "From" : "Day"}
            <input
              type="date"
              className="due-input"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
        {scope === "range" && (
          <label className="ai-day">
            To
            <input
              type="date"
              className="due-input"
              min={date || minDate}
              max={maxDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="ai-editor-actions">
        {error && <span className="ai-error">Couldn't save — try again.</span>}
        <button type="button" className="ai-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ai-btn ai-btn-primary" disabled={!title.trim() || !scopeOk || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
