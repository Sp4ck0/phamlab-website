import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ActionItem, Group, Place, Priority } from "../../lib/types";
import type { ActionItemFields } from "../../hooks/useActionItemEdits";
import { fmtShort } from "../../lib/tripLogic";
import { PRIORITY_LABELS } from "../../lib/tasks";
import { AutoTextarea } from "./AutoTextarea";

const MAX_PLACES = 5;

interface Props {
  // The kind a new item starts as (an existing item keeps its own).
  defaultKind?: "custom" | "consider";
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
const KIND_LABELS = { custom: "TO-DO", consider: "Consider" } as const;
const PRIORITIES: Priority[] = ["high", "medium", "low"];

// "Everyone" is stored as no `who` at all, so only real group ids are chips.
const toIds = (who: ActionItem["who"]) => (who === undefined ? [] : Array.isArray(who) ? who : [who]).filter((id) => id !== "all");

// Title and details are one logical line each (they wrap on screen, but never
// hold a line break), so Enter saves and a pasted newline becomes a space.
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ");

// Convex wraps server errors; the useful part is the last line.
function errorText(e: unknown) {
  const last = e instanceof Error ? (e.message.split("\n").pop() ?? "") : "";
  return last.replace(/^(Uncaught )?Error:\s*/, "") || "Couldn't save — try again.";
}

// Inline add/edit row for an Action Item. Title and details are always shown;
// who / kind / places / when sit behind a one-line summary. Enter saves,
// Escape cancels.
export function ActionItemEditor({ defaultKind, groups, minDate, maxDate, initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [kind, setKind] = useState<"custom" | "consider">(initial?.kind ?? defaultKind ?? "custom");
  const [priority, setPriority] = useState<Priority | undefined>(initial?.priority);
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const optionsId = useId();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);

  // Editing an item that has details: land at the end of them, so adding a note
  // is just typing. Otherwise start in the title.
  useEffect(() => {
    const el = initial?.detail ? detailRef.current : titleRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [initial?.detail]);

  const toggleWho = (id: string) => setWhoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // A day or range needs its date(s); a range can't end before it starts.
  const scopeOk = scope === "trip" || (!!date && (scope === "day" || (!!endDate && endDate >= date)));

  async function submit() {
    if (!title.trim() || !scopeOk || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        detail: detail.trim(),
        date: scope === "trip" ? undefined : date,
        endDate: scope === "range" ? endDate : undefined,
        kind,
        priority,
        places: places
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name.trim(),
            ...(p.address?.trim() ? { address: p.address.trim() } : {}),
            ...(p.placeId?.trim() ? { placeId: p.placeId.trim() } : {}),
          })),
        who: whoIds.length === 0 ? undefined : whoIds.length === 1 ? whoIds[0] : whoIds,
      });
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  function enterSaves(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  }

  // What the collapsed options hold, e.g. "Everyone · To-do · Dec 5 · Line Esthe".
  const placeNames = places.map((p) => p.name.trim()).filter(Boolean);
  const when =
    scope === "trip"
      ? "Whole trip"
      : scope === "day"
        ? date
          ? fmtShort(date)
          : "Pick a day"
        : date && endDate
          ? `${fmtShort(date)} – ${fmtShort(endDate)}`
          : "Pick dates";
  const summary = [
    whoIds.length === 0 ? "Everyone" : whoIds.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(", "),
    KIND_LABELS[kind],
    ...(priority ? [`${PRIORITY_LABELS[priority]} priority`] : []),
    when,
    ...(placeNames.length === 0 ? [] : [placeNames.length === 1 ? placeNames[0] : `${placeNames.length} places`]),
  ].join(" · ");

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
        <label className="ai-field">
          <span className="ai-label">Title</span>
          <AutoTextarea
            ref={titleRef}
            className="ai-input"
            placeholder={kind === "consider" ? "What are we weighing?" : "What needs doing?"}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(oneLine(e.target.value))}
            onKeyDown={enterSaves}
          />
        </label>
        <label className="ai-field">
          <span className="ai-label">Details</span>
          <AutoTextarea
            ref={detailRef}
            className="ai-input"
            placeholder="Optional"
            maxLength={500}
            value={detail}
            onChange={(e) => setDetail(oneLine(e.target.value))}
            onKeyDown={enterSaves}
          />
        </label>
      </div>
      <button
        type="button"
        className="ai-options"
        aria-expanded={optionsOpen}
        aria-controls={optionsId}
        data-invalid={!scopeOk || undefined}
        onClick={() => setOptionsOpen((o) => !o)}
      >
        <span className="ai-options-sum">{summary}</span>
        <span className="ai-options-cta">{optionsOpen ? "Hide options" : "Edit options"}</span>
      </button>
      {optionsOpen && (
        <div className="ai-options-body" id={optionsId}>
          <div className="ai-row">
            <span className="ai-label">Who</span>
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
          </div>
          <div className="ai-row">
            <span className="ai-label">Kind</span>
            <div className="ai-who" role="group" aria-label="Kind">
              {(["custom", "consider"] as const).map((k) => (
                <button key={k} type="button" className="ai-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="ai-row">
            <span className="ai-label">Priority</span>
            <div className="ai-who" role="group" aria-label="Priority">
              <button type="button" className="ai-chip" aria-pressed={priority === undefined} onClick={() => setPriority(undefined)}>
                None
              </button>
              {PRIORITIES.map((p) => (
                <button key={p} type="button" className="ai-chip" aria-pressed={priority === p} onClick={() => setPriority(p)}>
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          {/* Any kind can name a place (a Google Maps link on the row); a consideration also gets a map pin. */}
          <div className="ai-row">
            <span className="ai-label">Places</span>
            <div className="ai-places" role="group" aria-label="Places">
              {places.map((p, i) => (
                <div className="ai-place" key={i}>
                  <label className="ai-field">
                    <span className="ai-label">Name</span>
                    <input
                      className="ai-input"
                      aria-label={`Place ${i + 1} name`}
                      maxLength={120}
                      value={p.name}
                      onChange={(e) => editPlace(i, { name: e.target.value, placeId: undefined })}
                    />
                  </label>
                  <label className="ai-field">
                    <span className="ai-label">Address</span>
                    <input
                      className="ai-input"
                      placeholder="Address, city, country (so Google can find it)"
                      aria-label={`Place ${i + 1} address`}
                      maxLength={300}
                      value={p.address ?? ""}
                      onChange={(e) => editPlace(i, { address: e.target.value, placeId: undefined })}
                    />
                  </label>
                  <button type="button" className="ai-btn" onClick={() => setPlaces((prev) => prev.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                  <details className="ai-placeid">
                    <summary>Google Place ID{p.placeId ? " ✓" : ""}</summary>
                    <input
                      className="ai-input"
                      placeholder="Optional, ChIJ…"
                      aria-label={`Place ${i + 1} Place ID`}
                      maxLength={200}
                      value={p.placeId ?? ""}
                      onChange={(e) => editPlace(i, { placeId: e.target.value })}
                    />
                  </details>
                </div>
              ))}
              {places.length < MAX_PLACES && (
                <button type="button" className="ai-chip" onClick={() => setPlaces((prev) => [...prev, { name: "" }])}>
                  + Add place
                </button>
              )}
            </div>
          </div>
          <div className="ai-row">
            <span className="ai-label">When</span>
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
        </div>
      )}
      <div className="ai-editor-actions">
        {error && <span className="ai-error">{error}</span>}
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
