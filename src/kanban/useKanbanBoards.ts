import { useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";

export interface BoardSummary {
  _id: Id<"kanban_boards">;
  name: string;
}

export function useKanbanBoards() {
  const { code } = useAccessCode();
  const result = useQuery(api.kanban.listBoards, code ? { code } : "skip");
  const boards: BoardSummary[] = result?.authorized ? result.boards : [];

  return {
    boards,
    isLoading: !!code && result === undefined,
    authorized: result?.authorized ?? false,
  };
}
