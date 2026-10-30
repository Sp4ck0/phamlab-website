import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { buildFullReference, buildStarterPrompt, type GuideData } from "../lib/starterPrompt";

type State = "idle" | "working" | "copied" | "failed";

// 🤖 Copies a ready-made prompt for an AI assistant that has the phamlab
// connection: the working rules plus the parts of the guide that are easy to
// get wrong. With `full`, copies the whole reference (both guides and every
// tool with its parameters) instead. The guide is fetched on click, not
// subscribed to, so putting this on the trip page costs nothing until used.
export function StarterPromptButton({
  trip,
  full = false,
  label,
}: {
  trip?: { slug: string; title: string };
  full?: boolean;
  label?: string;
}) {
  const convex = useConvex();
  const { code } = useAccessCode();
  const [state, setState] = useState<State>("idle");

  async function copy() {
    setState("working");
    try {
      const data = (await convex.query(api.guide.getGuide, { code })) as GuideData | null;
      if (!data) throw new Error("no access");
      await navigator.clipboard.writeText(full ? buildFullReference(data) : buildStarterPrompt(data, trip));
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 3000);
  }

  const text = label ?? (full ? "Copy full reference" : "Starter prompt");
  return (
    // The confirmation floats under the button instead of sitting beside it, so
    // it can't push the neighboring button (or wrap on a narrow screen).
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="btn"
        onClick={() => void copy()}
        disabled={state === "working"}
        title={full ? "Copy the whole guide and tool list" : "Copy a prompt for your AI assistant"}
      >
        <span aria-hidden>🤖</span> {text}
      </button>
      <span
        role="status"
        className="sdek"
        style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, whiteSpace: "nowrap", pointerEvents: "none" }}
      >
        {state === "copied" ? "Copied — paste it into your assistant." : state === "failed" ? "Couldn't copy — try again." : ""}
      </span>
    </span>
  );
}
