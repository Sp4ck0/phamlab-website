import { useCallback, useState } from "react";
import { loadTicks, saveTicks } from "../lib/ticks";
import type { Status } from "../lib/types";

export function useTicks(slug: string) {
  const [ticks, setTicks] = useState<Record<string, Status>>(() => loadTicks(slug));

  // Toggle every id in `ids` together (a merged card's status button can
  // represent more than one underlying booking — see mergeHotelsByName).
  const toggle = useCallback(
    (ids: string[], currentStatus: Status) => {
      const next = currentStatus === "needed" ? "booked" : "needed";
      setTicks((prev) => {
        const merged = { ...prev };
        ids.forEach((id) => {
          merged[id] = next;
        });
        saveTicks(slug, merged);
        return merged;
      });
    },
    [slug]
  );

  return { ticks, toggle };
}
