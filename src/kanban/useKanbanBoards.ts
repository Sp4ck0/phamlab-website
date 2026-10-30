import { useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";

export interface BoardSummary {
  _id: Id<"kanban_boards">;
  name: string;
}

export interface BoardSummaryWithUnread extends BoardSummary {
  /** Cards on this board that are new, or have replies the viewer hasn't read. */
  unread: number;
}

// Just the list of boards the code can open. Subscribes to the cheap query
// only; use useKanbanBoardUnread where the unread badges are shown.
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

// The same list with unread counts merged in. Boards render immediately with
// 0 and the badges fill in once the (heavier) unread query answers.
export function useKanbanBoardUnread() {
  const { code } = useAccessCode();
  const { boards, isLoading, authorized } = useKanbanBoards();
  const result = useQuery(api.kanban.listBoardUnread, code ? { code } : "skip");
  const counts = new Map<string, number>();
  if (result?.authorized) for (const b of result.boards) counts.set(b._id, b.unread);

  return {
    boards: boards.map((b): BoardSummaryWithUnread => ({ ...b, unread: counts.get(b._id) ?? 0 })),
    isLoading,
    authorized,
  };
}
