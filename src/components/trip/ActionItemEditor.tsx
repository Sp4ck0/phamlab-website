import { useEffect, useRef, useState } from "react";
import type { ActionItem, Group, Place } from "../../lib/types";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";

const MAX_PLACES = 5;

interface Props {
  // The kind a new item starts as (an existing item keeps its own).
  defaultKind?: "custom" | "decision" | "consider";
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
export function ActionItemEditor({ defaultKind, groups, minDate, maxDate, initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [kind, setKind] = useState<"custom" | "decision" | "consider">(initial?.kind ?? defaultKind ?? "custom");
  // A place's Google Place ID is kept only while its name and address are untouched.
  const [places, setPlaces] = useState<Place[]>(initial?.places ?? []);
  const editPlace = (i: number, patch: Partial<Place>) =>
    setPlaces((prev) => prev.map((p, j) => (j === i ? { name: p.name, address: p.address, ...patch } : p)));
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
        places:
          kind === "consider"
            ? places
                .filter((p) => p.name.trim())
                .map((p) => ({
                  name: p.name.trim(),
                  ...(p.address?.trim() ? { address: p.address.trim() } : {}),
                  ...(p.placeId ? { placeId: p.placeId } : {}),
                }))
            : undefined,
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
          placeholder={kind === "consider" ? "What are we weighing?" : "What needs doing?"}
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
          {(["custom", "decision", "consider"] as const).map((k) => (
            <button key={k} type="button" className="ai-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === "custom" ? "To-do" : k === "decision" ? "Decision" : "Consider"}
            </button>
          ))}
        </div>
        {kind === "consider" && (
          <div className="ai-places" role="group" aria-label="Places">
            {places.map((p, i) => (
              <div className="ai-place" key={i}>
                <input
                  className="ai-input"
                  placeholder="Place name"
                  aria-label={`Place ${i + 1} name`}
                  maxLength={120}
                  value={p.name}
                  onChange={(e) => editPlace(i, { name: e.target.value, placeId: undefined })}
                />
                <input
                  className="ai-input"
                  placeholder="Address, city, country (needed for the map pin)"
                  aria-label={`Place ${i + 1} address`}
                  maxLength={300}
                  value={p.address ?? ""}
                  onChange={(e) => editPlace(i, { address: e.target.value, placeId: undefined })}
                />
                <button type="button" className="ai-btn" onClick={() => setPlaces((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            {places.length < MAX_PLACES && (
              <button type="button" className="ai-chip" onClick={() => setPlaces((prev) => [...prev, { name: "" }])}>
                + Add place
              </button>
            )}
          </div>
        )}
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
