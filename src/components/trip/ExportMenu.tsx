import { useEffect, useMemo, useRef, useState } from "react";
import { useTripExport } from "../../hooks/useTripExport";
import { useExportActions } from "../../hooks/useExportActions";
import { buildItinerary } from "../../lib/itinerary";

export function ExportMenu({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Only fetch the export once the menu is opened.
  const { data, isLoading } = useTripExport(slug, open);
  const itinerary = useMemo(() => (data ? buildItinerary(data) : null), [data]);
  const { flash, copy, download } = useExportActions(slug, itinerary, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const disabled = !itinerary;
  const wait = isLoading ? "Preparing…" : "Unavailable";

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Export ▾
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          <a
            role="menuitem"
            href={`${import.meta.env.BASE_URL}#/trip/${slug}/print`}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
          >
            Print / Save as PDF
          </a>
          <button role="menuitem" disabled={disabled} onClick={download}>
            {disabled ? wait : flash === "download" ? "Downloaded ✓" : "Download Markdown"}
          </button>
          <button role="menuitem" disabled={disabled} onClick={copy}>
            {disabled ? wait : flash === "copy" ? "Copied ✓" : flash === "error" ? "Copy failed" : "Copy itinerary"}
          </button>
        </div>
      )}
    </div>
  );
}
