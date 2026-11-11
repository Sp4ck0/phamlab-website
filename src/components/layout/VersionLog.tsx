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
            <select
              className="vlog-select"
              aria-label="Filter by area"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All areas ({entries?.length})</option>
              {Object.entries(AREA)
                .filter(([key]) => counts.has(key))
                .map(([key, a]) => (
                  <option key={key} value={key}>
                    {a.emoji} {a.label} ({counts.get(key)})
                  </option>
                ))}
            </select>
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
