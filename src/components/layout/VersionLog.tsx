import { useEffect, useState } from "react";
import { useVersionLog } from "../../hooks/useVersionLog";

const AREA: Record<string, { emoji: string; label: string }> = {
  board: { emoji: "📝", label: "Board" },
  trips: { emoji: "🧳", label: "Trips" },
  dating: { emoji: "💬", label: "Dating Simulator" },
  manage: { emoji: "🛠️", label: "Manage Access" },
  general: { emoji: "✨", label: "General" },
  other: { emoji: "•", label: "Other" },
};

export function VersionLog({ onClose }: { onClose: () => void }) {
  const { entries, isLoading } = useVersionLog();
  const [filter, setFilter] = useState<string>("all");

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
          <div className="vlog-filters" role="group" aria-label="Filter by area">
            <button className="vlog-filter" data-active={filter === "all" ? "true" : undefined} onClick={() => setFilter("all")}>
              All ({entries?.length})
            </button>
            {Object.entries(AREA)
              .filter(([key]) => counts.has(key))
              .map(([key, a]) => (
                <button
                  key={key}
                  className="vlog-filter"
                  data-active={filter === key ? "true" : undefined}
                  onClick={() => setFilter(key)}
                >
                  {a.emoji} {a.label} ({counts.get(key)})
                </button>
              ))}
          </div>
        )}
        <div className="vlog-list">
          {isLoading && <p className="vlog-empty">Loading…</p>}
          {entries && entries.length === 0 && <p className="vlog-empty">Nothing here yet.</p>}
          {shown?.map((e) => {
            const area = AREA[e.area] ?? AREA.other;
            return (
              <article key={e._id} className="vlog-entry">
                <div className="vlog-meta">
                  <span className="vlog-chip">
                    {area.emoji} {area.label}
                  </span>
                  <span>{e.version}</span>
                </div>
                <h3>{e.title}</h3>
                {e.notes && <p>{e.notes}</p>}
                {e.links.length > 0 && (
                  <div className="vlog-links">
                    {e.links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                        {l.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
