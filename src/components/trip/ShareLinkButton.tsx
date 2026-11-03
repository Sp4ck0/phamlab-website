import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { LinkIcon } from "./taskParts";

// Copies a link that opens this trip scrolled to one day (`day`) or task
// (`task`) and blinks it (see useShareLinkFocus). The link never carries the
// access code: whoever opens it needs their own access.
export function ShareLinkButton({ param, label }: { param: { day: string } | { task: string }; label: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const url = `${location.origin}${location.pathname}#/trip/${slug}?${new URLSearchParams(param)}`;
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className="share-wrap">
      <button type="button" className="icon-btn share-btn" aria-label={label} title="Copy link to this" onClick={() => void copy()}>
        <LinkIcon />
      </button>
      <span role="status" className="share-status">
        {state === "copied" ? "Link copied" : state === "failed" ? "Couldn't copy" : ""}
      </span>
    </span>
  );
}
