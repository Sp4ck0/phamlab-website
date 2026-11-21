import { useId, type MouseEvent, type ReactNode } from "react";
import { changeClass, type ChangeState } from "../../lib/changeDiff";
import { useUntilFound } from "../../hooks/useUntilFound";
import { TileMenu, type TileMenuItem } from "./TileMenu";

export const ALL_DAY = "All day";

export type TileState = "booked" | "needed" | "maybe" | "details";

/** The booking state in words, for a tile header: not booked, a maybe, or booked but missing details. Booked shows as a check. */
export function TileStatePill({ state, label }: { state: TileState; label?: string }) {
  if (state === "booked") return <span className="status" data-s="booked" role="img" aria-label="Booked" title="Booked" />;
  if (state === "maybe") return <span className="maybe-pill">Maybe</span>;
  return <span className="tx-state open">{label ?? (state === "needed" ? "Not booked" : "Missing details")}</span>;
}

export interface TimelineTileProps {
  /** Element id, so a shared link or AI focus can scroll to and flash this tile (a removed ghost has none). */
  domId?: string;
  /** The time, in a pill set into the card's top border: "09:30", ALL_DAY, or nothing when the tile has no time. */
  time?: string;
  /** The tile's type icon, before its title. */
  icon: ReactNode;
  /** What the icon stands for ("Food"), as its tooltip. */
  iconLabel?: string;
  title: ReactNode;
  /** False for a static card: just its header, no chevron, no body, no toggling. */
  expandable?: boolean;
  /** One line of essentials under the title. */
  meta?: ReactNode;
  /** State, not actions: pills, the booked check, a vote tally. Right-aligned before the menu. */
  headerEnd?: ReactNode;
  /** Every action the card has, behind its "⋯" button (the only button on the card). */
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

// Controls inside a card that keep their own click: tapping them never toggles the card.
const OWN_CLICK = "button, a, input, label, select, textarea, summary, [role=menu]";

// One card of a day's agenda. The time sits in a pill set into the top border, the "⋯" menu
// (every action the card has) at the top right, and an expandable card has a chevron in a notch
// in its bottom border: down when closed, up when open. Tapping anywhere on an expandable card
// toggles it, except on a control of its own; the title is the keyboard toggle (aria-expanded).
// The body always stays in the page, so find-in-page reaches a closed card and opens it
// (hidden="until-found").
export function TimelineTile({
  domId, time, icon, iconLabel, title, expandable = true, meta, headerEnd, menu, label, warn, open, onToggle, onReveal,
  change = "same", className, nextUpLine, now, progress, children,
}: TimelineTileProps) {
  const bodyId = useId();
  const bodyRef = useUntilFound(open, onReveal ?? onToggle);
  const gone = change === "gone";
  const cardClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest(OWN_CLICK)) return;
    // Selecting text to copy it isn't a tap.
    if (window.getSelection?.()?.toString()) return;
    onToggle();
  };
  const showWarn = !!warn && (!expandable || !open);
  const heading = (
    <>
      <span className="tl-title">{title}</span>
      {(meta || nextUpLine) && (
        <span className="tl-meta">
          {nextUpLine && <span className="next-up-line">{nextUpLine}</span>}
          {meta}
        </span>
      )}
    </>
  );
  const name = label ?? (typeof title === "string" ? title : "this");
  return (
    <li
      className={`tl-entry${now ? " tl-entry--now" : ""}${nextUpLine ? " next-up" : ""}${showWarn ? " tl-entry--warn" : ""}${time ? " tl-entry--timed" : ""}`}
      id={domId}
      {...(gone ? { inert: true, "aria-hidden": true } : {})}
    >
      <div
        className={`tl-tile${open && expandable ? " is-open" : ""}${expandable ? "" : " tl-flat"}${className ? ` ${className}` : ""}${changeClass(change)}`}
        onClick={expandable ? cardClick : undefined}
      >
        {time && <span className="tl-time" data-all-day={time === ALL_DAY ? "true" : undefined}>{time}</span>}
        <div className="tl-head">
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
          <span className="tl-more">{!gone && menu && <TileMenu label={name} items={menu} />}</span>
          {progress}
        </div>
        {expandable && (
          <div className="tl-body" id={bodyId} ref={bodyRef}>
            {children}
          </div>
        )}
        {/* Decorative: the whole card is the control. */}
        {expandable && (
          <span className="tl-notch" aria-hidden="true">
            <svg className="tl-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 5.25L7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
    </li>
  );
}
