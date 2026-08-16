import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";
import type { Board, Card, LaneId, PersonId } from "./types";

export function useKanbanBoard() {
  const { code } = useAccessCode();
  const result = useQuery(api.kanban.getBoard, code ? { code } : "skip");

  const startBoardMut = useMutation(api.kanban.startBoard);
  const addCardMut = useMutation(api.kanban.addCard);
  const updateCardMut = useMutation(api.kanban.updateCard);
  const removeCardMut = useMutation(api.kanban.removeCard);
  const setLanesMut = useMutation(api.kanban.setLanes);
  const renamePersonMut = useMutation(api.kanban.renamePerson);
  const resetBoardMut = useMutation(api.kanban.resetBoard);

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
      people: result.board.people,
      lanes: result.board.lanes,
      cards,
    };
  }, [result]);

  const isLoading = code !== undefined && result === undefined;
  const authorized = result?.authorized ?? false;

  function start(nameA: string, nameB: string) {
    if (!code) return;
    void startBoardMut({ code, nameA, nameB });
  }

  function setLanes(update: (lanes: Board["lanes"]) => Board["lanes"]) {
    if (!code || !board) return;
    void setLanesMut({ code, lanes: update(board.lanes) as Board["lanes"] });
  }

  function addCard(lane: LaneId, title: string, from: PersonId) {
    if (!code) return;
    void addCardMut({ code, lane, title, from });
  }

  function updateCard(id: string, patch: Partial<Card>) {
    if (!code) return;
    void updateCardMut({ code, cardId: id as Id<"kanban_cards">, ...patch });
  }

  function removeCard(id: string) {
    if (!code) return;
    void removeCardMut({ code, cardId: id as Id<"kanban_cards"> });
  }

  function renamePerson(who: PersonId, name: string) {
    if (!code) return;
    void renamePersonMut({ code, who, name });
  }

  function reset() {
    if (!code) return;
    void resetBoardMut({ code });
  }

  return { board, isLoading, authorized, start, setLanes, addCard, updateCard, removeCard, renamePerson, reset };
}
