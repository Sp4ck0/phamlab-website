import { useEffect, useMemo, useState, type ReactNode } from "react";
import { plainText } from "../../lib/wordDiff";

// Shows what an AI edit changed, in place: all of the old text blinking red,
// then all of the new text blinking green, then the normal rendering (children).
// Mounting starts it; the parent unmounts it when the change is over. Both texts
// share one grid cell (the unseen one hidden, not removed), so the space is the
// larger of the two for the whole animation and nothing around it moves.
const OLD_MS = 1100;
const NEW_MS = 2800;

export function InlineDiff({ prev, next, children }: { prev: string; next: string; children: ReactNode }) {
  const [before, after] = useMemo(() => [plainText(prev), plainText(next)], [prev, next]);
  const [phase, setPhase] = useState<"old" | "new" | "done">("old");
  useEffect(() => {
    const a = setTimeout(() => setPhase("new"), OLD_MS);
    const b = setTimeout(() => setPhase("done"), NEW_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "done") return <>{children}</>;
  return (
    <span className="chg-inline">
      <span className="chg-layer" data-on={phase === "old"}><span className="chg-del">{before}</span></span>
      <span className="chg-layer" data-on={phase === "new"}><span className="chg-ins">{after}</span></span>
    </span>
  );
}
