// "Deleted “title” — Undo", shown for a few seconds after removing an item.
export function UndoBar({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <div className="undo-bar" role="status">
      <span>Deleted “{title}”</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
