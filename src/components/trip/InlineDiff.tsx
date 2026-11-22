import { useEffect, useMemo, useState, type ReactNode } from "react";
import { diffRuns, plainText, type Run } from "../../lib/wordDiff";

// Shows what an AI edit changed, in place: the old text with just its removed
// words blinking red, then the new text with just its added words blinking
// green, then the normal rendering (children). Unchanged words stay plain.
// Mounting starts it; the parent unmounts it when the change is over. Both texts
// share one grid cell (the unseen one hidden, not removed), so the space is the
// larger of the two for the whole animation and nothing around it moves.
// `paused` holds it on the old text (the page is still scrolling to it); `ms`
// plays the whole change in that time instead (a long queue catching up).
const OLD_MS = 1100;
const NEW_MS = 2800;

export function InlineDiff({ prev, next, children, paused = false, ms = NEW_MS }: { prev: string; next: string; children: ReactNode; paused?: boolean; ms?: number }) {
  const [before, after] = useMemo(() => {
    const a = plainText(prev);
    const b = plainText(next);
    return [diffRuns(a, b, "old"), diffRuns(a, b, "new")];
  }, [prev, next]);
  const [phase, setPhase] = useState<"old" | "new" | "done">("old");
  useEffect(() => {
    if (paused) return;
    const a = setTimeout(() => setPhase("new"), (OLD_MS * ms) / NEW_MS);
    const b = setTimeout(() => setPhase("done"), ms);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [paused, ms]);
  if (phase === "done") return <>{children}</>;
  return (
    <span className="chg-inline">
      <span className="chg-layer" data-on={phase === "old"}><Runs runs={before} mark="chg-del" /></span>
      <span className="chg-layer" data-on={phase === "new"}><Runs runs={after} mark="chg-ins" /></span>
    </span>
  );
}

const Runs = ({ runs, mark }: { runs: Run[]; mark: string }) => (
  <>
    {runs.map((r, i) => (r.changed ? <span key={i} className={mark}>{r.text}</span> : r.text))}
  </>
);
