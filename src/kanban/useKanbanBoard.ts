import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";
import { uploadImages } from "./lib";
import type { Board, Card, LaneId, QuickAddDraft } from "./types";

// uploadImages returns plain-string ids; the mutations want branded storage ids.
type ReplyImages = { id: Id<"_storage">; w: number; h: number }[];

export function useKanbanBoard(boardId: Id<"kanban_boards"> | undefined) {
  const { code } = useAccessCode();
  const result = useQuery(api.kanban.getBoard, code && boardId ? { code, boardId } : "skip");

  const addCardMut = useMutation(api.kanban.addCard);
  const updateCardMut = useMutation(api.kanban.updateCard);
  const removeCardMut = useMutation(api.kanban.removeCard);
  const setLanesMut = useMutation(api.kanban.setLanes);
  const addReplyMut = useMutation(api.kanban.addReply);
  const removeReplyMut = useMutation(api.kanban.removeReply);
  const markReadMut = useMutation(api.kanban.markCardRead);
  const uploadUrlMut = useMutation(api.kanban.generateImageUploadUrl);
  const addNoteImagesMut = useMutation(api.kanban.addNoteImages);
  const removeNoteImageMut = useMutation(api.kanban.removeNoteImage);

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
      type: result.board.type ?? "pair",
      people: result.board.people,
      viewerPersonId: result.viewerPersonId,
      viewerName: result.viewerName,
      lanes: result.board.lanes,
      laneLabels: result.board.laneLabels,
      unread: result.unread,
      fresh: result.fresh,
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

  // Images go to Convex storage first (resized in the browser), then ride
  // along with the mutation as { id, w, h }. Returned so the caller can show
  // an "uploading" state and surface a failure.
  const uploadFiles = (files: File[]) => {
    if (!code || !boardId) return Promise.resolve([]);
    return uploadImages(files, () => uploadUrlMut({ code, boardId }));
  };

  async function addReply(id: string, text: string, files: File[] = []) {
    if (!code || !boardId) return;
    const images = files.length ? ((await uploadFiles(files)) as ReplyImages) : undefined;
    await addReplyMut({ code, boardId, cardId: id as Id<"kanban_cards">, text, images });
  }

  async function addNoteImages(id: string, files: File[]) {
    if (!code || !boardId || !files.length) return;
    const images = (await uploadFiles(files)) as ReplyImages;
    await addNoteImagesMut({ code, boardId, cardId: id as Id<"kanban_cards">, images });
  }

  function removeNoteImage(id: string, imageId: string) {
    if (!code || !boardId) return;
    void removeNoteImageMut({
      code,
      boardId,
      cardId: id as Id<"kanban_cards">,
      imageId: imageId as Id<"_storage">,
    });
  }

  function removeReply(id: string, replyId: string) {
    if (!code || !boardId) return;
    void removeReplyMut({ code, boardId, cardId: id as Id<"kanban_cards">, replyId });
  }

  function markRead(id: string) {
    if (!code || !boardId) return;
    void markReadMut({ code, boardId, cardId: id as Id<"kanban_cards"> });
  }

  return {
    board,
    isLoading,
    authorized,
    setLanes,
    addCard,
    updateCard,
    removeCard,
    addReply,
    removeReply,
    addNoteImages,
    removeNoteImage,
    markRead,
  };
}
