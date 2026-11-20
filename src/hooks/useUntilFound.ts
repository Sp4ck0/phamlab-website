import { useEffect, useLayoutEffect, useRef } from "react";

// A closed panel that find-in-page can still search: hidden="until-found" keeps its
// text in the page, and the browser fires `beforematch` on it just before revealing a
// match. Put the returned ref on the panel. `onReveal` runs only while it is closed;
// it should open the panel so the match stays shown.
export function useUntilFound(open: boolean, onReveal: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const onRevealRef = useRef(onReveal);
  openRef.current = open;
  onRevealRef.current = onReveal;
  // React 19 renders hidden="until-found" as a plain hidden, so set it on the element itself.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "until-found");
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => {
      if (!openRef.current) onRevealRef.current();
    };
    el.addEventListener("beforematch", reveal);
    return () => el.removeEventListener("beforematch", reveal);
  }, []);
  return ref;
}
