import { useEffect, useState } from "react";
import type { ActionItemFields } from "./useActionItemEdits";
import type { ActionItem, Task } from "../lib/types";

// What's needed to put a just-deleted item back exactly as it was.
interface Deleted {
  item: ActionItem;
  done: boolean;
  due?: string;
}

const UNDO_MS = 6000;

// Deleting a stored item (to-do or decision) with a few seconds to undo it. The
// item comes back under its original id, so its done-state and due date can be
// restored too. Used by both the Action Items list and the decisions panel.
export function useUndoableDelete({
  onAddItem,
  onRemoveItem,
  onSetDone,
  onSetDue,
}: {
  onAddItem: (fields: ActionItemFields & { id?: string }) => Promise<unknown>;
  onRemoveItem: (id: string) => Promise<unknown>;
  onSetDone: (keys: string[], done: boolean) => void;
  onSetDue: (key: string, dueDate: string | undefined) => void;
}) {
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [deleted]);

  function remove(task: Task, item: ActionItem) {
    setDeleted({ item, done: task.done, due: task.dueDateIsDefault ? undefined : (task.dueDate ?? undefined) });
    void onRemoveItem(item.id);
  }

  async function undo() {
    if (!deleted) return;
    const { item, done, due } = deleted;
    setDeleted(null);
    await onAddItem(item);
    if (done) onSetDone([`item:${item.id}`], true);
    if (due) onSetDue(`item:${item.id}`, due);
  }

  return { deletedTitle: deleted?.item.title ?? null, remove, undo };
}
