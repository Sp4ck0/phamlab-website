import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import type { Id } from "@convex/dataModel";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { useKanbanBoard } from "../kanban/useKanbanBoard";
import { Lane } from "../kanban/components/Lane";
import { CardDrawer } from "../kanban/components/CardDrawer";
import { laneOf, useDue } from "../kanban/lib";
import { LANES } from "../kanban/types";
import type { Board, LaneId } from "../kanban/types";
import "../kanban/kanban.css";

// Every card id present in `lanes`, across all lanes combined — used to
// make sure a drag never silently drops or duplicates a card.
function allCardIds(lanes: Board["lanes"]) {
  return Object.values(lanes).flat().slice().sort();
}

function sameCardIds(a: Board["lanes"], b: Board["lanes"]) {
  const idsA = allCardIds(a);
  const idsB = allCardIds(b);
  return idsA.length === idsB.length && idsA.every((id, i) => id === idsB[i]);
}

export function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { code } = useAccessCode();
  const { board, isLoading, authorized, setLanes, addCard, updateCard, removeCard } = useKanbanBoard(
    boardId as Id<"kanban_boards"> | undefined
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const due = useDue(board);
  // While dragging, reordering happens against this local copy only — the
  // server mutation fires once on drop, not on every dragover frame. Once
  // the server's board.lanes catches up to what we predicted, drop the
  // local override so future drags start from a fresh server snapshot.
  const [dragLanes, setDragLanes] = useState<Board["lanes"] | null>(null);
  useEffect(() => {
    if (dragLanes && board && JSON.stringify(dragLanes) === JSON.stringify(board.lanes)) {
      setDragLanes(null);
    }
  }, [board, dragLanes]);

  if (!code) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead">A board for two</h2>
          <p className="sdek">
            Enter your access code to open your kanban board.{" "}
            <Link to="/unlock" style={{ color: "var(--accent-1)" }}>
              Enter a code or log in
            </Link>
            .
          </p>
        </div>
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>
      </PageShell>
    );
  }

  if (!authorized || !board) {
    return (
      <PageShell>
        <div style={{ padding: "80px 0" }}>
          <h2 className="shead">Not found</h2>
          <p className="sdek">
            That access code doesn't unlock this board.{" "}
            <Link to="/kanban" style={{ color: "var(--accent-1)" }}>
              Back to boards
            </Link>
            .
          </p>
        </div>
      </PageShell>
    );
  }

  const lanes = dragLanes ?? board.lanes;
  const displayBoard = dragLanes ? { ...board, lanes } : board;
  const openCard = openId ? (displayBoard.cards[openId] ?? null) : null;
  const me = board.viewerPersonId ?? "a";

  const moveToLane = (id: string, to: LaneId) => {
    setLanes((lanes) => {
      const next = Object.fromEntries(
        Object.entries(lanes).map(([l, ids]) => [l, ids.filter((x) => x !== id)])
      ) as typeof lanes;
      next[to] = [id, ...next[to]];
      return next;
    });
  };

  return (
    <PageShell fullWidth>
      <div className="kanban-app">
        <DragDropProvider
          sensors={[
            PointerSensor.configure({
              activationConstraints(event) {
                return event.pointerType === "touch"
                  ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: { x: 10, y: 10 } })]
                  : [new PointerActivationConstraints.Distance({ value: 4 })];
              },
            }),
            KeyboardSensor,
          ]}
          onDragOver={(event) => setDragLanes(move(lanes, event))}
          onDragEnd={(event) => {
            if (event.canceled) {
              setDragLanes(null);
              return;
            }
            const next = move(lanes, event);
            // A drag that ends up outside any droppable (or hits some other
            // edge case in dnd-kit's collision detection) can hand back a
            // lanes object that's silently missing or duplicating a card.
            // Never let that reach the server — just drop the drag.
            if (sameCardIds(board.lanes, next)) {
              setDragLanes(next);
              setLanes(() => next);
            } else {
              setDragLanes(null);
            }
          }}
        >
          <div className="shell">
            <header className="top">
              <div className="top__brand">
                <h1>{board.name}</h1>
                <span className="top__pair">
                  <i className="dot" data-who="a" />
                  {board.people.a.name}
                  <span className="amp">&amp;</span>
                  <i className="dot" data-who="b" />
                  {board.people.b.name}
                </span>
              </div>

              <div className="top__tools">
                {due.length > 0 && (
                  <button className="nudge" onClick={() => setOpenId(due[0].id)} title="Oldest one first">
                    {due.length} to check back on
                  </button>
                )}
              </div>
            </header>

            <main className="board">
              {LANES.map((l) => (
                <Lane key={l.id} lane={l.id} board={displayBoard} onOpen={setOpenId} onQuickAdd={addCard} />
              ))}
            </main>

            <CardDrawer
              card={openCard}
              board={displayBoard}
              me={me}
              lane={openCard ? laneOf(displayBoard, openCard.id) : null}
              onClose={() => setOpenId(null)}
              onChange={updateCard}
              onMove={moveToLane}
              onDelete={(id) => {
                removeCard(id);
                setOpenId(null);
              }}
            />
          </div>
        </DragDropProvider>
      </div>
    </PageShell>
  );
}
