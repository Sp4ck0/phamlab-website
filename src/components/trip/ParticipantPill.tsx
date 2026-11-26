import { useEffect, useId, useRef, useState } from "react";
import type { Group, Who } from "../../lib/types";
import { participantLabel, participants } from "../../lib/tripLogic";

// Who is joining an activity, hotel or transport, in a pill beside its time: up to two names and "+N".
// Shown only when some travelers present aren't joining: "Everyone" on every row was clutter.
// Tapping it lists everyone joining; a tap outside or Escape closes the list. Nothing on a trip with no travelers.
export function ParticipantPill({ who, groups, date }: { who?: Who; groups: Group[]; date: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const p = participants(who, groups, date);
  if (!p || p.everyone) return null;
  const label = participantLabel(p);
  return (
    // A tap inside the list stays here, so it never opens or closes the card under it.
    <span className="who-join" ref={wrap} onClick={(e) => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        className="who-join-btn"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Who's joining: ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <span className="who-join-list" id={listId} role="dialog" aria-label="Who's joining">
          <span className="who-join-head">Joining</span>
          <ul>
            {p.people.map((g) => (
              <li key={g.id}>
                <span className="who-join-dot" style={{ background: g.color }} aria-hidden="true" />
                {g.name}
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
