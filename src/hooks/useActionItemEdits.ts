import { useMutation } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";
import type { ActionItem } from "../lib/types";

export type ActionItemFields = Pick<ActionItem, "title" | "detail" | "date" | "who">;

// Add / edit / remove a trip's custom Action Items (actionItems.ts). Anyone
// with access to the trip can do this, same as check-offs and due dates. The
// trip query is reactive, so the list updates without any local bookkeeping.
export function useActionItemEdits(slug: string) {
  const { code } = useAccessCode();
  const addMut = useMutation(api.actionItems.addActionItem);
  const updateMut = useMutation(api.actionItems.updateActionItem);
  const removeMut = useMutation(api.actionItems.removeActionItem);

  return {
    // Pass `id` only to restore a deleted item under its original id.
    addItem: (fields: ActionItemFields & { id?: string }) => addMut({ slug, code, ...fields }),
    updateItem: (id: string, fields: ActionItemFields) => updateMut({ slug, code, id, ...fields }),
    removeItem: (id: string) => removeMut({ slug, code, id }),
  };
}
