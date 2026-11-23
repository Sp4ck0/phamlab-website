import { Fragment, useEffect, useRef, useState } from "react";
import { useMarkVersionLogSeen, useVersionLog, useVersionLogUnseen } from "../../hooks/useVersionLog";

const AREA: Record<string, { emoji: string; label: string }> = {
  board: { emoji: "📝", label: "Board" },
  trips: { emoji: "🧳", label: "Trips" },
  dating: { emoji: "💬", label: "Dating Simulator" },
  accent: { emoji: "🎙️", label: "Accent Check" },
  manage: { emoji: "🛠️", label: "Manage Access" },
  general: { emoji: "✨", label: "General" },
  other: { emoji: "•", label: "Other" },
};

// "2026-08-20" -> month heading + short day. Parsed by hand: new Date() on a
// bare date is UTC and can land on the previous day in local time.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function parseDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { month: `${MONTHS[m - 1] ?? ""} ${y}`, day: `${(MONTHS[m - 1] ?? "").slice(0, 3)} ${d}` };
}

type AreaOption = { key: string; icon: string; label: string; count: number };

// A styled stand-in for <select>: the system menu can't be themed. Arrow keys,
// Enter/Space and Escape work as they do on a native select.
function AreaFilter({ value, onChange, options }: { value: string; onChange: (key: string) => void; options: AreaOption[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function show() {
    setActive(Math.max(0, options.findIndex((o) => o.key === value)));
    setOpen(true);
  }
  function pick(key: string) {
    onChange(key);
    setOpen(false);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation(); // don't also close the panel
      e.nativeEvent.stopImmediatePropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) pick(options[active].key);
      else show();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="vlog-dd" ref={root}>
      <button
        type="button"
        className="vlog-select"
        aria-label="Filter by area"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span>
          {current.label} ({current.count})
        </span>
        <svg className="vlog-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 5.25 7 9l4-3.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="vlog-menu" role="listbox" aria-label="Areas">
          {options.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={o.key === value}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.key)}
            >
              <span className="vlog-menu-icon" aria-hidden="true">
                {o.icon}
              </span>
              <span className="vlog-menu-label">{o.label}</span>
              <span className="vlog-menu-count">{o.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VersionLog({ onClose }: { onClose: () => void }) {
  const { entries, isLoading } = useVersionLog();
  const [filter, setFilter] = useState<string>("all");
  const unseen = useVersionLogUnseen();
  const markSeen = useMarkVersionLogSeen();

  // Entries newer than this were unseen when the panel opened. Frozen so the
  // "New" chips stay put after opening clears the badge.
  const [seenAtOnOpen, setSeenAtOnOpen] = useState<number | null>(null);
  useEffect(() => {
    if (seenAtOnOpen === null && unseen) setSeenAtOnOpen(unseen.seenAt);
  }, [unseen, seenAtOnOpen]);

  // Opening the panel counts as seeing everything it shows.
  const marked = useRef(0);
  useEffect(() => {
    if (seenAtOnOpen === null || !entries?.length) return;
    const newest = Math.max(...entries.map((e) => e._creationTime));
    if (newest > marked.current) {
      marked.current = newest;
      markSeen(newest);
    }
  }, [seenAtOnOpen, entries, markSeen]);

  // Only offer areas this viewer actually has entries for.
  const counts = new Map<string, number>();
  entries?.forEach((e) => counts.set(e.area, (counts.get(e.area) ?? 0) + 1));
  const shown = filter === "all" ? entries : entries?.filter((e) => e.area === filter);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="vlog-backdrop" onClick={onClose}>
      <div
        className="vlog"
        role="dialog"
        aria-modal="true"
        aria-label="What's new"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vlog-head">
          <h2>What's new</h2>
          <button className="btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {counts.size > 1 && (
          <div className="vlog-filters">
            <AreaFilter
              value={filter}
              onChange={setFilter}
              options={[
                { key: "all", icon: "", label: "All areas", count: entries?.length ?? 0 },
                ...Object.entries(AREA)
                  .filter(([key]) => counts.has(key))
                  .map(([key, a]) => ({ key, icon: a.emoji, label: a.label, count: counts.get(key) ?? 0 })),
              ]}
            />
          </div>
        )}
        <div className="vlog-list">
          {isLoading && <p className="vlog-empty">Loading…</p>}
          {entries && entries.length === 0 && <p className="vlog-empty">Nothing here yet.</p>}
          {shown?.map((e, i) => {
            const area = AREA[e.area] ?? AREA.other;
            const { month, day } = parseDate(e.date);
            const newMonth = i === 0 || parseDate(shown[i - 1].date).month !== month;
            return (
              <Fragment key={e._id}>
                {newMonth && <h4 className="vlog-month">{month}</h4>}
              <article className="vlog-entry">
                <div className="vlog-meta">
                  <span className="vlog-chip">
                    {area.emoji} {area.label}
                  </span>
                  <span>{day}</span>
                  {seenAtOnOpen !== null && e._creationTime > seenAtOnOpen && <span className="vlog-new">New</span>}
                </div>
                <h3>{e.title}</h3>
                {e.notes && <p>{e.notes}</p>}
                {e.links.length > 0 && (
                  <details className="vlog-details">
                    <summary>Details</summary>
                    <div className="vlog-links">
                      {e.links.map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                          {l.label} ↗
                        </a>
                      ))}
                    </div>
                  </details>
                )}
              </article>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
