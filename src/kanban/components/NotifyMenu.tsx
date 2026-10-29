import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../../hooks/useAccessCode";

type NotifyEvent = "reply" | "card_added" | "card_moved" | "card_changed";

const EVENTS: { id: NotifyEvent; label: string; short: string }[] = [
  { id: "reply", label: "New replies", short: "Replies" },
  { id: "card_added", label: "New cards", short: "New cards" },
  { id: "card_moved", label: "Cards moved between lanes", short: "Moved" },
  { id: "card_changed", label: "Cards edited or removed", short: "Edited" },
];

// Typed by hand: Convex infers the notifications query results as `any` (see
// NotificationChannels).
function useSubscribedEvents(boardId: Id<"kanban_boards">) {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  const subs = useQuery(api.notifications.listSubscriptions, args) as
    | { boardId: Id<"kanban_boards">; events: NotifyEvent[] }[]
    | null
    | undefined;
  return { args, current: subs?.find((s) => s.boardId === boardId)?.events ?? [] };
}

function useToggleEvent(boardId: Id<"kanban_boards">) {
  const { args, current } = useSubscribedEvents(boardId);
  const save = useMutation(api.notifications.setBoardSubscription);
  const [error, setError] = useState("");

  async function toggle(id: NotifyEvent) {
    const events = current.includes(id) ? current.filter((e) => e !== id) : [...current, id];
    setError("");
    try {
      await save({ ...args, boardId, events });
    } catch {
      setError("Couldn't save that");
    }
  }
  return { current, error, toggle };
}

// The event checkboxes for one board, in the board's bell menu.
export function BoardNotifyOptions({ boardId }: { boardId: Id<"kanban_boards"> }) {
  const { current, error, toggle } = useToggleEvent(boardId);
  return (
    <>
      {EVENTS.map((e) => (
        <label key={e.id} className="notify__row">
          <input type="checkbox" checked={current.includes(e.id)} onChange={() => void toggle(e.id)} />
          {e.label}
        </label>
      ))}
      {error && <div className="notify__note" role="alert">{error}</div>}
    </>
  );
}

// The same choices as compact on/off chips, for the Settings page.
export function BoardNotifyChips({ boardId }: { boardId: Id<"kanban_boards"> }) {
  const { current, error, toggle } = useToggleEvent(boardId);
  return (
    <div className="notif-chips">
      {EVENTS.map((e) => (
        <button
          key={e.id}
          type="button"
          className="notif-chip"
          aria-pressed={current.includes(e.id)}
          title={e.label}
          onClick={() => void toggle(e.id)}
        >
          {e.short}
        </button>
      ))}
      {error && <span className="notify__note" role="alert">{error}</span>}
    </div>
  );
}

// Bell in the board header: which events on this board to be notified about.
export function NotifyMenu({ boardId }: { boardId: Id<"kanban_boards"> }) {
  const { args, current } = useSubscribedEvents(boardId);
  const channels = useQuery(api.notifications.listChannels, args) as { status: "pending" | "verified" }[] | null | undefined;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasVerified = (channels ?? []).some((c) => c.status === "verified");

  // The panel is portaled to <body> and positioned in viewport coordinates so
  // the board's `overflow: hidden` can't clip it; clamped to stay on screen.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(280, window.innerWidth - 24);
      setPos({ top: r.bottom + 6, left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="notify">
      <button
        ref={buttonRef}
        className="nudge"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        title="Notification settings for this board"
      >
        {current.length > 0 ? "🔔 Notifying" : "🔕 Notify me"}
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={panelRef} className="notify-pop" style={pos}>
            <BoardNotifyOptions boardId={boardId} />
            {channels && !hasVerified && (
              <div className="notify__note">
                Nothing will send until you confirm a channel in <Link to="/settings">Settings</Link>.
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
