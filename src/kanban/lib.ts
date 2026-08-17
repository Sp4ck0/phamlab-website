import { useMemo } from "react";
import type { Board, Card, Kind, LaneId, Weight } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function laneOf(board: Board, cardId: string): LaneId | null {
  for (const lane of Object.keys(board.lanes) as LaneId[]) {
    if (board.lanes[lane].includes(cardId)) return lane;
  }
  return null;
}

export function progress(card: Card) {
  const total = card.actions.length;
  const done = card.actions.filter((a) => a.done).length;
  return { total, done, ratio: total ? done / total : 0 };
}

export const WEIGHT_RANK: Record<Weight, number> = { minor: 0, medium: 1, major: 2 };

export const KIND_TONE: Record<Kind, string> = {
  appreciation: "var(--gold)",
  feedback: "var(--ink-soft)",
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
