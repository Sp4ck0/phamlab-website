import type { ActionItem } from "../../lib/types";

export function ActionItems({ items, done, onToggle }: { items: ActionItem[]; done: Record<string, boolean>; onToggle: (id: string) => void }) {
  const doneCount = items.filter((i) => done[i.id]).length;

  return (
    <>
      <div className="section-head-row">
        <h2 className="section-title">Action Items</h2>
        <span className="progress-pill">
          {doneCount} of {items.length} done
        </span>
      </div>
      <p className="section-sub">Things to nail down before the trip. Check them off as they're settled.</p>
      <div className="action-items">
        {items.map((item) => {
          const isDone = !!done[item.id];
          return (
            <div className={`action-item ${isDone ? "done" : ""}`} key={item.id}>
              <input type="checkbox" id={`ai-${item.id}`} checked={isDone} onChange={() => onToggle(item.id)} />
              <label htmlFor={`ai-${item.id}`}>
                <span className="at">{item.title} —</span> <span className="ad">{item.detail}</span>
              </label>
            </div>
          );
        })}
      </div>
    </>
  );
}
