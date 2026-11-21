import { useEffect, useId, useRef, useState } from "react";

// One action in a tile's "⋯" menu: a link (opens in a new tab) or something to do. An action
// can return a short note to show for a moment afterwards ("Link copied").
export type TileMenuItem = { label: string; href?: string; sameTab?: boolean; onSelect?: () => void | string | Promise<void | string> };

// The tile's secondary actions (edit, copy link, calendar, call, show on map…) behind one "⋯"
// button, so every row keeps the same few controls on the right. Closes on Escape, on a click
// outside it, and after an action.
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
    wrap.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
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

  if (!items.length) return null;
  const done = (text: void | string) => {
    setOpen(false);
    if (!text) return;
    setNote(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 2000);
  };
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
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span className="tl-menu-list" role="menu" id={listId} aria-label={label}>
          {items.map((it) =>
            it.href ? (
              <a key={it.label} role="menuitem" href={it.href} {...(it.sameTab ? {} : { target: "_blank", rel: "noopener noreferrer" })} onClick={() => done()}>
                {it.label}
              </a>
            ) : (
              <button key={it.label} role="menuitem" type="button" onClick={async () => done(await it.onSelect?.())}>
                {it.label}
              </button>
            )
          )}
        </span>
      )}
      <span role="status" className="share-status">{note}</span>
    </span>
  );
}
