import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useShowAiFocus } from "./useAiFocus";

// A shared link (ShareLinkButton) is the trip URL plus ?day=<date> or
// ?task=<key>. Once the trip and its tasks have loaded, hand that target to the
// same scroll-open-blink path the AI's pointer uses. Waiting for the data keeps
// the pending focus from expiring on a slow load. The param stays in the URL:
// clearing it would navigate, and a reload or a re-forwarded link still works.
export function useShareLinkFocus(slug: string | undefined, ready: boolean) {
  const [params] = useSearchParams();
  const show = useShowAiFocus();
  const handled = useRef<string | null>(null);
  const day = params.get("day");
  const task = params.get("task");

  useEffect(() => {
    if (!slug || !ready || (!day && !task)) return;
    const signature = `${slug}|${day}|${task}`;
    if (handled.current === signature) return;
    handled.current = signature;
    show({
      slug,
      target: task ? { kind: "task", key: task } : { kind: "day", date: day! },
      nonce: `share-${Date.now()}`,
    });
  }, [slug, ready, day, task, show]);
}
