import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";
import type { Board, Card, LaneId, QuickAddDraft } from "./types";

export function useKanbanBoard(boardId: Id<"kanban_boards"> | undefined) {
  const { code } = useAccessCode();
  const result = useQuery(api.kanban.getBoard, code && boardId ? { code, boardId } : "skip");

  const addCardMut = useMutation(api.kanban.addCard);
  const updateCardMut = useMutation(api.kanban.updateCard);
  const removeCardMut = useMutation(api.kanban.removeCard);
  const setLanesMut = useMutation(api.kanban.setLanes);

  const board: Board | null = useMemo(() => {
    if (!result?.authorized || !result.board) return null;
    const cards: Record<string, Card> = {};
    // Convex documents carry `_id`, but the ported UI (from a plain
    // localStorage board) expects each card's own `id` field.
    for (const [id, doc] of Object.entries(result.board.cards as Record<string, Record<string, unknown>>)) {
      cards[id] = { ...doc, id: doc._id } as unknown as Card;
    }
    return {
      version: 1,
      name: result.board.name,
      people: result.board.people,
      viewerPersonId: result.viewerPersonId,
      lanes: result.board.lanes,
      cards,
    };
  }, [result]);

  const isLoading = !!(code && boardId) && result === undefined;
  const authorized = result?.authorized ?? false;

  function setLanes(update: (lanes: Board["lanes"]) => Board["lanes"]) {
    if (!code || !boardId || !board) return;
    void setLanesMut({ code, boardId, lanes: update(board.lanes) as Board["lanes"] });
  }

  function addCard(lane: LaneId, draft: QuickAddDraft) {
    if (!code || !boardId) return;
    void addCardMut({ code, boardId, lane, ...draft });
  }

  function updateCard(id: string, patch: Partial<Card>) {
    if (!code || !boardId) return;
    void updateCardMut({ code, boardId, cardId: id as Id<"kanban_cards">, ...patch });
  }

  function removeCard(id: string) {
    if (!code || !boardId) return;
    void removeCardMut({ code, boardId, cardId: id as Id<"kanban_cards"> });
  }

  return { board, isLoading, authorized, setLanes, addCard, updateCard, removeCard };
}
