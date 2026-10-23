import { useEffect, useRef, useState } from "react";

// How long after the last change a calendar pick (or a finished typed date)
// is saved if the field hasn't been blurred or Enter pressed.
const SETTLE_MS = 700;

// A native date input that holds its edit in a local draft. The browser fires
// a change after every typed segment (month, day, each year digit), so saving
// each one would re-sort the list under the cursor mid-edit; instead the draft
// is saved on Enter, on blur, or once it has settled.
export function DueDateInput({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // Follow the saved value (another person's edit, a reset, a revert).
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (next: string) => {
    window.clearTimeout(timer.current);
    if (next && next !== value) onCommit(next);
    else setDraft(value); // cleared or unchanged: snap back to the saved date
  };

  return (
    <input
      type="date"
      className="due-input"
      aria-label="Due date"
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        window.clearTimeout(timer.current);
        // Mid-typing a year gives 0002, 0020, 0202 first; wait for a real year.
        if (next && Number(next.slice(0, 4)) >= 1000) {
          timer.current = window.setTimeout(() => commit(next), SETTLE_MS);
        }
      }}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(draft);
      }}
    />
  );
}
