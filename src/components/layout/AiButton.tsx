import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../../hooks/useAccessCode";
import { activityGlow, loadFollowAi, saveFollowAi, subscribeFollowAi } from "../../lib/followAi";

// Header shortcut for Settings → Follow AI edits (same per-browser setting, so the two stay in
// sync), colored when on. It glows green while an AI connected to this access is working.
export function AiButton() {
  const on = useSyncExternalStore(subscribeFollowAi, loadFollowAi);
  const { code } = useAccessCode();
  const activity = useQuery(api.mcpFocus.getActivity, code ? { code } : {});
  const seen = useRef<string | undefined>(undefined);
  const [glowUntil, setGlowUntil] = useState(0);

  useEffect(() => {
    if (activity === undefined) return; // still loading
    const next = activityGlow(seen.current, activity, Date.now());
    seen.current = next.seen;
    if (next.glowUntil !== null) setGlowUntil(next.glowUntil);
  }, [activity]);

  const working = glowUntil > Date.now();
  useEffect(() => {
    if (!working) return;
    const t = setTimeout(() => setGlowUntil(0), glowUntil - Date.now());
    return () => clearTimeout(t);
  }, [working, glowUntil]);

  const label = `Follow AI edits: ${on ? "on" : "off"}${working ? " (an AI is working now)" : ""}`;
  return (
    <button
      type="button"
      className="btn btn-icon follow-ai-btn"
      aria-pressed={on}
      aria-label="Follow AI edits"
      title={label}
      data-working={working ? "true" : undefined}
      onClick={() => saveFollowAi(!on)}
    >
      <span className="follow-ai-eyes" aria-hidden="true">
        👀
      </span>
    </button>
  );
}
