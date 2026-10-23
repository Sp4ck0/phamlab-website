import { useEffect, useRef, useState } from "react";
import { copyItinerary, downloadMarkdown } from "../lib/download";
import type { Itinerary } from "../lib/itinerary";

export type ExportFlash = "copy" | "download" | "error" | null;

// Copy / download actions plus a ~1.5s confirmation flag for button labels.
export function useExportActions(slug: string, itinerary: Itinerary | null, onFlashEnd?: () => void) {
  const [flash, setFlash] = useState<ExportFlash>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function show(kind: Exclude<ExportFlash, null>) {
    setFlash(kind);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFlash(null);
      onFlashEnd?.();
    }, 1500);
  }

  async function copy() {
    if (!itinerary) return;
    try {
      await copyItinerary(itinerary);
      show("copy");
    } catch {
      show("error");
    }
  }

  function download() {
    if (!itinerary) return;
    downloadMarkdown(slug, itinerary);
    show("download");
  }

  return { flash, copy, download };
}
