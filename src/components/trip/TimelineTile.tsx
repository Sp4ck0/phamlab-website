import { useId, type MouseEvent, type ReactNode } from "react";
import { changeClass, type ChangeState } from "../../lib/changeDiff";
import { useUntilFound } from "../../hooks/useUntilFound";
import { MAPS_PIN_ICON } from "../../lib/mapPoints";
import { TileMenu, type TileMenuItem } from "./TileMenu";

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
  /** The time pill: "09:30", ALL_DAY, or nothing when the tile has no time. */
  time?: string;
  /** The tile's type icon, before its title. */
  icon: ReactNode;
  /** What the icon stands for ("Food"), as its tooltip. */
  iconLabel?: string;
  title: ReactNode;
  /** False for a tile with nothing more to show: just its row, no chevron, no body. */
  expandable?: boolean;
  /** One line of essentials under the title. */
  meta?: ReactNode;
  /** Pills and votes: right-aligned before the control. Siblings of the toggle, never inside it. */
  headerEnd?: ReactNode;
  /** The tile's one main control (the booked check, a to-do's checkbox), in a fixed slot so it lines up on every tile. */
  control?: ReactNode;
  /** Opens the tile's place in Google Maps: the pin button on the right of the row. */
  pin?: { href: string; label: string };
  /** The tile's other actions, behind the "⋯" button. */
  menu?: TileMenuItem[];
  /** Plain name for the menu's label ("More actions: …"); defaults to the title when it is text. */
  label?: string;
  /** Something here is unresolved; a dot on its icon shows while the tile is closed (always, on a tile that doesn't open). */
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

// One row of a day's agenda: a time pill, an icon and the title, then the same few
// controls on the right of every row (the main control, the Maps pin, the "⋯" menu and the
// chevron), each in a fixed slot so they line up down the day. The body always stays in the
// page, so find-in-page reaches a closed tile and opens it (hidden="until-found"). Only the
// header toggles; its buttons and links, and the body's, never do.
export function TimelineTile({
  domId, time, icon, iconLabel, title, expandable = true, meta, headerEnd, control, pin, menu, label, warn, open, onToggle, onReveal,
  change = "same", className, nextUpLine, now, progress, children,
}: TimelineTileProps) {
  const bodyId = useId();
  const bodyRef = useUntilFound(open, onReveal ?? onToggle);
  const gone = change === "gone";
  // A click on the header's plain parts (the time, the icon, the space around the pills)
  // toggles too; a click on any control or link inside it does not.
  const headClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, label, select, textarea")) return;
    onToggle();
  };
  const showWarn = !!warn && (!expandable || !open);
  const heading = (
    <>
      {/* Phones drop the time and icon columns: they sit in a small line above the title instead. */}
      <span className="tl-when" aria-hidden="true">
        <span className="tl-when-icon">{icon}</span>
        {time && <span className="tl-when-time">{time}</span>}
      </span>
      <span className="tl-title">{title}</span>
      {(meta || nextUpLine) && (
        <span className="tl-meta">
          {nextUpLine && <span className="next-up-line">{nextUpLine}</span>}
          {meta}
        </span>
      )}
    </>
  );
  const chevron = (
    <svg className="tl-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.5 5.25L7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const name = label ?? (typeof title === "string" ? title : "this");
  return (
    <li
      className={`tl-entry${now ? " tl-entry--now" : ""}${nextUpLine ? " next-up" : ""}${showWarn ? " tl-entry--warn" : ""}`}
      id={domId}
      {...(gone ? { inert: true, "aria-hidden": true } : {})}
    >
      <div className={`tl-tile${open && expandable ? " is-open" : ""}${expandable ? "" : " tl-flat"}${className ? ` ${className}` : ""}${changeClass(change)}`}>
        {/* The toggle button is the keyboard control; this click handler only widens the click target. */}
        <div className="tl-head" onClick={expandable ? headClick : undefined}>
          <span className="tl-time" data-all-day={time === ALL_DAY ? "true" : undefined}>{time}</span>
          <span className="tl-dot" title={iconLabel}>
            <span aria-hidden="true">{icon}</span>
            {showWarn && <span className="tl-warn" role="img" aria-label="Needs attention" title="Needs attention" />}
          </span>
          {expandable ? (
            <button type="button" className="tl-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
              {heading}
            </button>
          ) : (
            <div className="tl-heading">{heading}</div>
          )}
          {headerEnd && <span className="tl-end">{headerEnd}</span>}
          {/* Fixed slots on every row, filled or not, so the controls line up down the day. */}
          <span className="tl-control">{control}</span>
          <span className="tl-pin">
            {pin && (
              <a className="icon-btn tl-pin-btn" href={pin.href} target="_blank" rel="noopener noreferrer" aria-label={pin.label} title={pin.label} dangerouslySetInnerHTML={{ __html: MAPS_PIN_ICON }} />
            )}
          </span>
          <span className="tl-more">{!gone && menu && <TileMenu label={name} items={menu} />}</span>
          {expandable ? chevron : <span className="tl-chev-slot" aria-hidden="true" />}
          {progress}
        </div>
        {expandable && (
          <div className="tl-body" id={bodyId} ref={bodyRef}>
            {children}
          </div>
        )}
      </div>
    </li>
  );
}
