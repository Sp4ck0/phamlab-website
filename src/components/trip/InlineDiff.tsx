import { useEffect, useMemo, useState, type ReactNode } from "react";
import { diffWords, plainText } from "../../lib/wordDiff";

// Shows what an AI edit changed, in place: the old text with the removed words
// in red, then the new text with the added words in green, then the normal
// rendering (children). Mounting starts it; the parent unmounts it when the
// change is over. Reduced motion skips the swap and shows both at once.
const OLD_MS = 1100;
const NEW_MS = 2800;

export function InlineDiff({ prev, next, children }: { prev: string; next: string; children: ReactNode }) {
  const parts = useMemo(() => diffWords(plainText(prev), plainText(next)), [prev, next]);
  const [phase, setPhase] = useState<"old" | "new" | "done">("old");
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const a = setTimeout(() => setPhase("new"), OLD_MS);
    const b = setTimeout(() => setPhase("done"), NEW_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "done") return <>{children}</>;
  const show = still ? parts : parts.filter((p) => p.state === "same" || p.state === (phase === "old" ? "gone" : "new"));
  return (
    <span className="chg-inline">
      {show.map((p, i) =>
        p.state === "same" ? p.item
          : <span key={i} className={p.state === "gone" ? "chg-del" : "chg-ins"}>{p.item}</span>
      )}
    </span>
  );
}
