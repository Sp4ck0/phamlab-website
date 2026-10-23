import { useEffect, useRef, useState } from "react";

const isRealDate = (v: string) => !!v && Number(v.slice(0, 4)) >= 1000;

// A native date input that holds its edit in a local draft. The browser fires
// a change after every typed segment (month, day, each year digit), so saving
// each one would re-sort the list under the cursor mid-edit. So:
//   - typing/keyboard edits are saved only on Enter or when the field loses
//     focus (never on a timer — pausing between segments must not save);
//   - a pick from the calendar popup (a change with no keystroke behind it)
//     is saved straight away;
//   - the popup's own "Clear" button (an empty change with no keystroke
//     behind it) resets the row to its default due date. The popup is the
//     browser's, so that button can't be restyled or extended — Chrome and
//     Edge show it; elsewhere, picking the default date again also resets.
export function DueDateInput({
  value,
  onCommit,
  onReset,
}: {
  value: string;
  onCommit: (next: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(value);
  // True from the first keystroke until blur or the next pointer press.
  const keyboardEdit = useRef(false);

  // Follow the saved value (another person's edit, a reset, a revert).
  useEffect(() => setDraft(value), [value]);

  const commit = (next: string) => {
    if (isRealDate(next) && next !== value) onCommit(next);
    else setDraft(value); // cleared, half-typed or unchanged: snap back
  };

  return (
    <input
      type="date"
      className="due-input"
      aria-label="Due date"
      title="Pick a date. Use Clear in the calendar to go back to the trip start date."
      value={draft}
      onPointerDown={() => {
        keyboardEdit.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit(draft);
        } else if (e.key === "Escape") {
          setDraft(value);
        } else {
          keyboardEdit.current = true;
        }
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (keyboardEdit.current) return;
        if (next === "") onReset();
        else commit(next);
      }}
      onBlur={() => {
        keyboardEdit.current = false;
        commit(draft);
      }}
    />
  );
}
