import { useEffect, useMemo, useRef, useState } from "react";
import { useTripExport } from "../../hooks/useTripExport";
import { useExportActions } from "../../hooks/useExportActions";
import { buildItinerary, normalizeRange, type DateRange } from "../../lib/itinerary";
import { RangePicker } from "./RangePicker";

export function ExportMenu({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // Only fetch the export once the menu is opened.
  const { data, isLoading } = useTripExport(slug, open);
  const itinerary = useMemo(() => (data ? buildItinerary(data, range) : null), [data, range]);
  const printRange = data ? normalizeRange(data, range) : undefined;
  const printQuery = printRange ? `?from=${printRange.from}&to=${printRange.to}` : "";
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
          {data && <RangePicker data={data} value={range} onChange={setRange} />}
          <a
            role="menuitem"
            href={`${import.meta.env.BASE_URL}#/trip/${slug}/export${printQuery}`}
            target="_blank"
            rel="noopener noreferrer"
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
