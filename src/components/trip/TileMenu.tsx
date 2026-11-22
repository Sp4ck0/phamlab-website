import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MENU_ICONS, type MenuIcon } from "../../lib/menuIcons";

// One action in a card's "⋯" menu: a link (opens in a new tab) or something to do. An action
// can return a short note to show for a moment afterwards ("Link copied").
export type TileMenuItem = {
  label: string;
  icon?: MenuIcon;
  href?: string;
  sameTab?: boolean;
  /** Shown but not available (a vote on a settled item). */
  disabled?: boolean;
  onSelect?: () => void | string | Promise<void | string>;
};

const INTERACTIVE = "button, a, input, label, select, textarea, summary";

// The order every menu follows, whatever order its card lists its actions in (each action's icon
// says what kind it is): what you do to the card itself first, then its own shortcuts, then where
// it is (on the trip map before Google Maps), then the calendar, then finding and sharing it, and
// the photo credit last. A thin line separates the groups; within one, the card's order is kept.
const RANK: Record<MenuIcon, number> = {
  check: 0, uncheck: 0, yes: 0, no: 0, add: 0, edit: 0, expand: 0, collapse: 0,
  phone: 10, ticket: 10, search: 10,
  map: 20, pin: 21, grab: 22, uber: 22,
  calendar: 30,
  list: 40, link: 41,
  photo: 50,
};
const rankOf = (it: TileMenuItem) => (it.icon ? RANK[it.icon] : 40);
const groupOf = (it: TileMenuItem) => Math.floor(rankOf(it) / 10);

/** The items in menu order (stable within a rank), each marking whether a new group starts with it. */
function orderMenu(items: TileMenuItem[]): { item: TileMenuItem; newGroup: boolean }[] {
  const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => rankOf(a.item) - rankOf(b.item) || a.i - b.i);
  return sorted.map(({ item }, k) => ({ item, newGroup: k > 0 && groupOf(item) !== groupOf(sorted[k - 1].item) }));
}

// A card's actions behind one "⋯" button: every action the card has, each with its icon.
// Arrow keys move between items; Escape, a click outside or an action closes it. A tap that
// only closes the menu does nothing else, so it can't open or close the card under it.
export function TileMenu({ label, items }: { label: string; items: TileMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
    const away = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (wrap.current?.contains(target)) return;
      setOpen(false);
      // The click that follows this tap would land on the card (toggling it); swallow it unless
      // it is on a control of its own.
      if (target.closest?.(INTERACTIVE)) return;
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 600);
    };
    const key = (e: globalThis.KeyboardEvent) => {
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

  if (!items.length) return null;
  const done = (text: void | string) => {
    setOpen(false);
    button.current?.focus();
    if (!text) return;
    setNote(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 2500);
  };
  const onListKey = (e: KeyboardEvent<HTMLElement>) => {
    const all = [...(wrap.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    const to = e.key === "ArrowDown" ? (at + 1) % all.length : e.key === "ArrowUp" ? (at - 1 + all.length) % all.length : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : -1;
    if (to < 0 || !all.length) return;
    e.preventDefault();
    all[to].focus();
  };
  const icon = (it: TileMenuItem) => (
    <span className="tl-menu-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: it.icon ? MENU_ICONS[it.icon] : "" }} />
  );
  return (
    <span className="tl-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="icon-btn tl-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`More actions: ${label}`}
        title="More actions"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span className="tl-menu-list" role="menu" id={listId} aria-label={label} onKeyDown={onListKey}>
          {orderMenu(items).map(({ item: it, newGroup }) => (
            <Fragment key={it.label}>
              {newGroup && <span role="separator" className="tl-menu-sep" />}
              {it.href && !it.disabled ? (
                <a role="menuitem" tabIndex={-1} href={it.href} title={it.label} {...(it.sameTab ? {} : { target: "_blank", rel: "noopener noreferrer" })} onClick={() => done()}>
                  {icon(it)}
                  <span className="tl-menu-label">{it.label}</span>
                </a>
              ) : (
                <button
                  role="menuitem"
                  type="button"
                  tabIndex={-1}
                  title={it.label}
                  aria-disabled={it.disabled || undefined}
                  onClick={async () => { if (!it.disabled) done(await it.onSelect?.()); }}
                >
                  {icon(it)}
                  <span className="tl-menu-label">{it.label}</span>
                </button>
              )}
            </Fragment>
          ))}
        </span>
      )}
      <span role="status" className="share-status">{note}</span>
    </span>
  );
}
