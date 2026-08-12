import { useCallback, useState } from "react";
import { loadDone, saveDone } from "../lib/actionItems";

export function useActionItems(slug: string) {
  const [done, setDone] = useState<Record<string, boolean>>(() => loadDone(slug));

  const toggle = useCallback(
    (id: string) => {
      setDone((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        saveDone(slug, next);
        return next;
      });
    },
    [slug]
  );

  return { done, toggle };
}
