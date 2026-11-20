import { useId, type MouseEvent, type ReactNode } from "react";
import { changeClass, type ChangeState } from "../../lib/changeDiff";
import { useUntilFound } from "../../hooks/useUntilFound";

export const ALL_DAY = "All day";

export type TileState = "booked" | "needed" | "maybe" | "details";

/** The booking state in words, for a tile header: not booked, a maybe, or booked but missing details. Booked needs no words: the check beside it says so. */
export function TileStatePill({ state, label }: { state: TileState; label?: string }) {
  if (state === "booked") return null;
  if (state === "maybe") return <span className="maybe-pill">Maybe</span>;
  return <span className="tx-state open">{label ?? (state === "needed" ? "Not booked" : "Missing details")}</span>;
}

export interface TimelineTileProps {
  /** Element id, so a shared link or AI focus can scroll to and flash this tile (a removed ghost has none). */
  domId?: string;
  /** The time label: "09:30", ALL_DAY, or nothing when the tile has no time. */
  time?: string;
  /** The tile's type marker on the rail. */
  icon: ReactNode;
  title: ReactNode;
  /** One line of essentials under the title. */
  meta?: ReactNode;
  /** Status pill, booking toggle, vote buttons: siblings of the toggle button, never inside it. */
  headerEnd?: ReactNode;
  /** Something here is unresolved; a dot shows while the tile is closed. */
  warn?: boolean;
  open: boolean;
  onToggle: () => void;
  /** A find-in-page match opened the tile; defaults to onToggle. Use it to open without saving the reader's choice. */
  onReveal?: () => void;
  /** How the tile changed in an AI edit (new glows, gone is a struck-through ghost). */
  change?: ChangeState;
  /** Extra classes on the tile, e.g. "miss" for something not booked. */
  className?: string;
  /** "Departs in 2 h": the next thing up, kept visible while the tile is closed. */
  nextUpLine?: ReactNode;
  /** This tile is under way right now. */
  now?: boolean;
  /** A thin progress bar for the tile under way; drawn along the bottom of the header. */
  progress?: ReactNode;
  children: ReactNode;
}

// One tile on a day's timeline: a time label, a marker on the rail and an accordion.
// The body always stays in the page, so find-in-page reaches a closed tile and
// opens it (hidden="until-found"). Only the header toggles; the body's own
// buttons and links never do.
export function TimelineTile({
  domId, time, icon, title, meta, headerEnd, warn, open, onToggle, onReveal, change = "same", className, nextUpLine, now, progress, children,
}: TimelineTileProps) {
  const bodyId = useId();
  const bodyRef = useUntilFound(open, onReveal ?? onToggle);
  const gone = change === "gone";
  // A click on the header's plain parts (the chevron, the space around the pills) toggles too;
  // a click on any control inside it does not. The title button handles its own click.
  const headClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, label, select, textarea")) return;
    onToggle();
  };
  return (
    <li
      className={`tl-entry${now ? " tl-entry--now" : ""}${nextUpLine ? " next-up" : ""}`}
      id={domId}
      {...(gone ? { inert: true, "aria-hidden": true } : {})}
    >
      <span className="tl-time" data-all-day={time === ALL_DAY ? "true" : undefined}>{time}</span>
      <span className="tl-rail" aria-hidden="true">
        <span className="tl-dot">{icon}</span>
      </span>
      <div className={`tl-tile${open ? " is-open" : ""}${className ? ` ${className}` : ""}${changeClass(change)}`}>
        {/* The title button is the keyboard control; this click handler only widens the click target. */}
        <div className="tl-head" onClick={headClick}>
          <button type="button" className="tl-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
            <span className="tl-title">{title}</span>
            {(meta || nextUpLine) && (
              <span className="tl-meta">
                {nextUpLine && <span className="next-up-line">{nextUpLine}</span>}
                {meta}
              </span>
            )}
          </button>
          {headerEnd && <span className="tl-end">{headerEnd}</span>}
          {warn && !open && <span className="tl-warn" role="img" aria-label="Needs attention" title="Needs attention" />}
          <svg className="tl-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3.5 5.25L7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {progress}
        </div>
        <div className="tl-body" id={bodyId} ref={bodyRef}>
          {children}
        </div>
      </div>
    </li>
  );
}
