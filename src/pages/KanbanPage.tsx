import { useState } from "react";
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
import type { LaneId } from "../kanban/types";
import "../kanban/kanban.css";

export function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { code } = useAccessCode();
  const { board, isLoading, authorized, setLanes, addCard, updateCard, removeCard } = useKanbanBoard(
    boardId as Id<"kanban_boards"> | undefined
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const due = useDue(board);

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

  const openCard = openId ? (board.cards[openId] ?? null) : null;
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
          onDragOver={(event) => setLanes((lanes) => move(lanes, event))}
          onDragEnd={(event) => {
            if (event.canceled) return;
            setLanes((lanes) => move(lanes, event));
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
                <Lane key={l.id} lane={l.id} board={board} onOpen={setOpenId} onQuickAdd={addCard} />
              ))}
            </main>

            <CardDrawer
              card={openCard}
              board={board}
              me={me}
              lane={openCard ? laneOf(board, openCard.id) : null}
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
