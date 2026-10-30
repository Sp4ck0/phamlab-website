import { useMemo } from "react";
import { BOARD_COPY } from "./types";
import type { Board, Card, Kind, LaneId, PersonId, Weight } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** How many Done cards the board loads and shows before "Show N more". */
export const DONE_PREVIEW = 10;

export function laneOf(board: Board, cardId: string): LaneId | null {
  for (const lane of Object.keys(board.lanes) as LaneId[]) {
    if (board.lanes[lane].includes(cardId)) return lane;
  }
  return null;
}

/** The board type's lane wording, with any per-board overrides from the server applied. */
export function boardLanes(board: Board) {
  return BOARD_COPY[board.type].lanes.map((l) => ({ ...l, ...board.laneLabels?.[l.id] }));
}

/** One entry in a card's conversation thread. */
export type Reply = Card["log"][number];

/** Which a/b seat the current viewer writes as; "a" if their code has no seat. */
export const viewerSeat = (board: Board): PersonId => board.viewerPersonId ?? "a";

export function replyAuthor(board: Board, reply: Reply) {
  return board.type === "pair" ? board.people[reply.by].name : (reply.byName ?? "Someone");
}

export function isMine(board: Board, reply: Reply) {
  return board.type === "pair" ? reply.by === viewerSeat(board) : reply.byName === board.viewerName;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "today" / "yesterday" / "Oct 3" (with the year once it isn't this one), in local time. */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() === now.getFullYear() ? "" : ` ’${String(d.getFullYear()).slice(2)}`}`;
}

/**
 * Cards with replies from someone else that the viewer hasn't opened yet
 * (tracked per person on the server), longest-waiting first.
 */
export function unreadCards(board: Board) {
  const waitingSince = (card: Card) =>
    card.log.filter((r) => !isMine(board, r)).slice(-board.unread[card.id])[0]?.at ?? "";
  return Object.keys(board.unread)
    .map((id) => board.cards[id])
    .filter((card): card is Card => !!card)
    .sort((x, y) => (waitingSince(x) < waitingSince(y) ? -1 : 1));
}

const MAX_EDGE = 2000; // long edge; keeps text in bug screenshots legible
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches the server cap

/** Downscale to MAX_EDGE and re-encode as WebP; GIFs and small-enough files pass through. */
async function prepareImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  if (file.type === "image/gif" || (scale === 1 && file.size <= MAX_UPLOAD_BYTES / 4)) {
    bitmap.close();
    return { blob: file, w, h };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Couldn't process that image");
  return { blob, w, h };
}

/** Upload images to Convex storage; returns the { id, w, h } the mutations take. */
export async function uploadImages(files: File[], getUploadUrl: () => Promise<string>) {
  return Promise.all(
    files.map(async (file) => {
      const { blob, w, h } = await prepareImage(file);
      const res = await fetch(await getUploadUrl(), {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      return { id: storageId, w, h };
    })
  );
}

/** Image files from a paste event (screenshots arrive as clipboard files). */
export const pastedImages = (e: React.ClipboardEvent) =>
  Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));

export function progress(card: Card) {
  const total = card.actions.length;
  const done = card.actions.filter((a) => a.done).length;
  return { total, done, ratio: total ? done / total : 0 };
}

export const WEIGHT_RANK: Record<Weight, number> = { minor: 0, medium: 1, major: 2 };

export const KIND_TONE: Record<Kind, string> = {
  appreciation: "var(--gold)",
  feedback: "var(--ink-soft)",
  feature: "var(--ink-soft)",
  bug: "var(--ink-soft)",
};

const today = () => new Date().toISOString().slice(0, 10);

/** Cards whose follow-up date has arrived. Drives the nudge in the header. */
export function useDue(board: Board | null) {
  return useMemo(() => {
    if (!board) return [];
    const now = today();
    return Object.values(board.cards)
      .filter((c) => c.followUp && c.followUp <= now)
      // Heaviest first, then oldest — so the nudge opens the one that matters most.
      .sort((x, y) => WEIGHT_RANK[y.weight] - WEIGHT_RANK[x.weight] || (x.followUp! < y.followUp! ? -1 : 1));
  }, [board]);
}
