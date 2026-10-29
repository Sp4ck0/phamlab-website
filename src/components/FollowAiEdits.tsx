import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { useShowAiFocus } from "../hooks/useAiFocus";
import { claimActiveTab, isActiveTab, releaseActiveTab } from "../lib/activeTab";
import { scrollBehavior } from "../lib/flash";
import { loadFollowAi, subscribeFollowAi } from "../lib/followAi";

// When the AI edits a trip through the MCP, the backend records where to look
// (mcpFocus.ts). If this device opted in (Settings → Follow AI edits) and this
// is the tab used most recently, open the trip and hand the day or action item
// to the page that renders it (DetailedView, ActionItems). Renders nothing.
export function FollowAiEdits() {
  const enabled = useSyncExternalStore(subscribeFollowAi, loadFollowAi);
  const { code } = useAccessCode();
  const focus = useQuery(api.mcpFocus.getFocus, enabled ? (code ? { code } : {}) : "skip");
  const show = useShowAiFocus();
  const navigate = useNavigate();
  // Read inside the effect without making a route change re-run it.
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  // undefined = no baseline yet. The first value after turning this on is only
  // a baseline, so an old signal is never replayed on load or on enabling.
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    claimActiveTab();
    const claim = () => document.visibilityState === "visible" && claimActiveTab();
    window.addEventListener("focus", claimActiveTab);
    document.addEventListener("visibilitychange", claim);
    window.addEventListener("pagehide", releaseActiveTab);
    return () => {
      window.removeEventListener("focus", claimActiveTab);
      document.removeEventListener("visibilitychange", claim);
      window.removeEventListener("pagehide", releaseActiveTab);
      releaseActiveTab();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      seen.current = undefined;
      return;
    }
    if (focus === undefined) return; // still loading
    const nonce = focus?.nonce ?? null;
    if (seen.current === undefined) {
      seen.current = nonce;
      return;
    }
    if (!focus || nonce === seen.current) return;
    seen.current = nonce;
    if (!isActiveTab()) return;

    const tripPath = `/trip/${focus.slug}`;
    const onTrip = pathRef.current === tripPath;
    if (!onTrip) navigate(tripPath);
    if (focus.target.kind === "trip") {
      // A fresh trip page already starts at its top; on the page, go back up.
      if (onTrip) window.scrollTo({ top: 0, behavior: scrollBehavior() });
      return;
    }
    show(focus);
  }, [enabled, focus, navigate, show]);

  return null;
}
