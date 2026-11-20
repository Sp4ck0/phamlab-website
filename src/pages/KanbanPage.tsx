import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import type { Id } from "@convex/dataModel";
import { PageShell } from "../components/layout/PageShell";
import { useAccessCode } from "../hooks/useAccessCode";
import { serverMessage } from "../lib/serverError";
import { useKanbanBoard, useKanbanCard } from "../kanban/useKanbanBoard";
import { useRememberTab } from "../hooks/useRememberTab";
import { useAiCardFocus } from "../hooks/useAiFocus";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Lane } from "../kanban/components/Lane";
import { LaneTabs, TAB_PREFIX } from "../kanban/components/LaneTabs";
import { CardDrawer } from "../kanban/components/CardDrawer";
import { NewCardPane } from "../kanban/components/NewCardPane";
import { NotifyMenu } from "../kanban/components/NotifyMenu";
import { BOARD_COPY } from "../kanban/types";
import { boardLanes, laneOf, useDue, viewerSeat } from "../kanban/lib";
import type { Board, LaneId, NewCardDraft } from "../kanban/types";
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

// Ref callback: tells the board how much page sits above and below it
// (mobile top bar, wrap padding) so its CSS height can fill the rest of the
// viewport. Re-measured on resize.
function fitToViewport(el: HTMLDivElement | null) {
  if (!el) return;
  const fit = () => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const bottomPad = parseFloat(getComputedStyle(el.parentElement!).paddingBottom) || 0;
    el.style.setProperty("--kb-offset", `${top + bottomPad}px`);
  };
  fit();
  window.addEventListener("resize", fit);
  return () => window.removeEventListener("resize", fit);
}

export function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { code } = useAccessCode();
  // Done loads its newest cards only until expanded (see useKanbanBoard).
  const [allDone, setAllDone] = useState(false);
  const {
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
    actionError,
    clearActionError,
  } = useKanbanBoard(boardId as Id<"kanban_boards"> | undefined, { allDone });
  useRememberTab(authorized && board ? `/kanban/${boardId}` : null);
  // Phones show one lane at a time, picked from a row of tabs (same breakpoint
  // as styles/narrow.css).
  const narrow = useMediaQuery("(max-width: 720px)");
  const [pickedLane, setPickedLane] = useState<LaneId | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  // The board only holds tile summaries; the open card is loaded whole.
  const openCard = useKanbanCard(boardId as Id<"kanban_boards"> | undefined, openId);
  // The card being written in the new-card pane. Minimizing only hides the
  // pane (`paneOpen`); the draft survives until it's added or discarded.
  const [draft, setDraft] = useState<NewCardDraft | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // The card drawer and the new-card pane share the right edge, so opening a
  // card tucks the pane away.
  useEffect(() => {
    if (openId) setPaneOpen(false);
  }, [openId]);
  // The AI pointed at a card (FollowAiEdits brought us here): open it. The
  // drawer loads the card by id, so it works wherever the card sits on the board.
  const { focus: aiFocus, consume: consumeAiFocus } = useAiCardFocus();
  useEffect(() => {
    if (!aiFocus) return;
    setOpenId(aiFocus.target.id);
    consumeAiFocus(aiFocus.nonce);
  }, [aiFocus, consumeAiFocus]);
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
  const unread = board.unreadOrder;
  const laneList = boardLanes(board);
  const activeLane = laneList.some((l) => l.id === pickedLane) ? (pickedLane as LaneId) : laneList[0].id;

  const startAdd = (lane: LaneId) => {
    setDraft((d) =>
      d
        ? { ...d, lane }
        : { lane, title: "", note: "", kind: BOARD_COPY[board.type].defaultKind, weight: "medium", images: [] }
    );
    setOpenId(null);
    setPaneOpen(true);
  };

  const submitDraft = async () => {
    if (!draft || !draft.title.trim() || submitting) return;
    const { lane, images, ...rest } = draft;
    setSubmitting(true);
    setSubmitError("");
    try {
      await addCard(lane, { ...rest, title: draft.title.trim(), note: draft.note.trim() }, images);
      setDraft(null);
      setPaneOpen(false);
    } catch (e) {
      setSubmitError(serverMessage(e, e instanceof Error ? e.message : "Couldn't add that card"));
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="kanban-app" ref={fitToViewport}>
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
          onDragOver={(event) => {
            // Over a lane tab there is nothing to reorder; the drop decides.
            if (String(event.operation.target?.id ?? "").startsWith(TAB_PREFIX)) return;
            setDragLanes(move(lanes, event));
          }}
          onDragEnd={(event) => {
            if (event.canceled) {
              setDragLanes(null);
              return;
            }
            // Dropped on a lane tab: send the card to the top of that lane.
            const target = String(event.operation.target?.id ?? "");
            if (target.startsWith(TAB_PREFIX)) {
              const to = target.slice(TAB_PREFIX.length) as LaneId;
              const id = String(event.operation.source?.id ?? "");
              setDragLanes(null);
              if (id && board.cards[id]) {
                moveToLane(id, to);
                setPickedLane(to);
              }
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
                {board.type === "pair" && (
                  <span className="top__pair">
                    <i className="dot" data-who="a" />
                    {board.people.a.name}
                    <span className="amp">&amp;</span>
                    <i className="dot" data-who="b" />
                    {board.people.b.name}
                  </span>
                )}
              </div>

              <div className="top__tools">
                <NotifyMenu boardId={boardId as Id<"kanban_boards">} />
                {unread.length > 0 && (
                  <button
                    className="nudge nudge--replies"
                    onClick={() => setOpenId(unread[0])}
                    title="Longest-waiting one first"
                  >
                    {board.type === "pair"
                      ? `${board.people[viewerSeat(board) === "a" ? "b" : "a"].name} replied`
                      : "New replies"}{" "}
                    on {unread.length} {unread.length === 1 ? "card" : "cards"}
                  </button>
                )}
                {due.length > 0 && (
                  <button className="nudge" onClick={() => setOpenId(due[0].id)} title="Oldest one first">
                    {due.length} to check back on
                  </button>
                )}
              </div>
            </header>

            {actionError && (
              <p className="board__error" role="alert">
                {actionError}{" "}
                <button type="button" onClick={clearActionError}>
                  Dismiss
                </button>
              </p>
            )}

            {narrow && <LaneTabs board={displayBoard} active={activeLane} onPick={setPickedLane} />}

            <main className="board">
              {laneList
                .filter((l) => !narrow || l.id === activeLane)
                .map((l) => (
                  <Lane
                    key={l.id}
                    lane={l.id}
                    board={displayBoard}
                    onOpen={setOpenId}
                    onStartAdd={startAdd}
                    hasDraft={draft?.lane === l.id}
                    expanded={allDone}
                    onExpandedChange={setAllDone}
                    compact={narrow}
                    onMove={moveToLane}
                  />
                ))}
            </main>

            {narrow && !openId && !paneOpen && (
              <button
                type="button"
                className="fab"
                aria-label={draft ? "Go to draft" : "Write a new card"}
                onClick={() => startAdd(draft?.lane ?? activeLane)}
              >
                {draft ? "✎" : "+"}
              </button>
            )}

            <NewCardPane
              board={displayBoard}
              draft={draft}
              open={paneOpen}
              onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              onMinimize={() => setPaneOpen(false)}
              onExpand={() => setPaneOpen(true)}
              onDiscard={() => {
                setDraft(null);
                setPaneOpen(false);
              }}
              onSubmit={() => void submitDraft()}
              busy={submitting}
              error={submitError}
            />

            <CardDrawer
              card={openCard}
              board={displayBoard}
              lane={openCard ? laneOf(displayBoard, openCard.id) : null}
              onClose={() => setOpenId(null)}
              onChange={updateCard}
              onMove={moveToLane}
              onDelete={(id) => {
                removeCard(id);
                setOpenId(null);
              }}
              onReply={addReply}
              onRemoveReply={removeReply}
              onAddNoteImages={addNoteImages}
              onRemoveNoteImage={removeNoteImage}
              onRead={markRead}
            />
          </div>
        </DragDropProvider>
      </div>
    </PageShell>
  );
}
