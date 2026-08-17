import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import type { Id } from "@convex/dataModel";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { useTheme } from "../hooks/useTheme";
import { useKanbanBoard } from "../kanban/useKanbanBoard";
import { Lane } from "../kanban/components/Lane";
import { CardDrawer } from "../kanban/components/CardDrawer";
import { laneOf, useDue } from "../kanban/lib";
import { LANES, PEOPLE } from "../kanban/types";
import type { LaneId, PersonId } from "../kanban/types";
import "../kanban/kanban.css";

export function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { code } = useAccessCode();
  const { isDark } = useTheme();
  const kanbanTheme = isDark ? "evening" : "day";
  const { board, isLoading, authorized, setLanes, addCard, updateCard, removeCard, renamePerson, reset } =
    useKanbanBoard(boardId as Id<"kanban_boards"> | undefined);

  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PersonId | null>(null);
  const [me, setMe] = useState<PersonId>(() => (localStorage.getItem("kanban.me") as PersonId) ?? "a");
  const [editingNames, setEditingNames] = useState(false);
  const due = useDue(board);

  useEffect(() => {
    localStorage.setItem("kanban.me", me);
  }, [me]);

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
    <PageShell>
      <div className="kanban-app" data-theme={kanbanTheme}>
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
            <div className="grain" aria-hidden="true" />

            <header className="top">
              <div className="top__brand">
                <h1>{board.name}</h1>
                {editingNames ? (
                  <div className="top__names">
                    {PEOPLE.map((p) => (
                      <input
                        key={p}
                        value={board.people[p].name}
                        data-who={p}
                        onChange={(e) => renamePerson(p, e.target.value)}
                        onBlur={() => setEditingNames(false)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingNames(false)}
                      />
                    ))}
                  </div>
                ) : (
                  <button className="top__pair" onClick={() => setEditingNames(true)} title="Rename">
                    <i className="dot" data-who="a" />
                    {board.people.a.name}
                    <span className="amp">&amp;</span>
                    <i className="dot" data-who="b" />
                    {board.people.b.name}
                  </button>
                )}
              </div>

              <div className="top__tools">
                {due.length > 0 && (
                  <button className="nudge" onClick={() => setOpenId(due[0].id)} title="Oldest one first">
                    {due.length} to check back on
                  </button>
                )}

                <div className="tool">
                  <span className="tool__label">Writing as</span>
                  <div className="seg seg--people seg--tight" role="group" aria-label="Writing as">
                    {PEOPLE.map((p) => (
                      <button key={p} data-who={p} data-on={me === p || undefined} onClick={() => setMe(p)}>
                        {board.people[p].name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tool">
                  <span className="tool__label">Showing</span>
                  <div className="seg seg--people seg--tight" role="group" aria-label="Filter by person">
                    {PEOPLE.map((p) => (
                      <button
                        key={p}
                        data-who={p}
                        data-on={filter === p || undefined}
                        onClick={() => setFilter(filter === p ? null : p)}
                      >
                        {board.people[p].name}
                      </button>
                    ))}
                    <button data-on={filter === null || undefined} onClick={() => setFilter(null)}>
                      Both
                    </button>
                  </div>
                </div>

                <button
                  className="ghost"
                  onClick={() => {
                    if (confirm("Clear the whole board? This cannot be undone.")) reset();
                  }}
                >
                  Reset
                </button>
              </div>
            </header>

            <main className="board">
              {LANES.map((l) => (
                <Lane
                  key={l.id}
                  lane={l.id}
                  board={board}
                  filter={filter}
                  onOpen={setOpenId}
                  onQuickAdd={(lane, title) => addCard(lane, title, me)}
                />
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
