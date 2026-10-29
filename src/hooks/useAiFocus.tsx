import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

export type FocusTarget = { kind: "trip" } | { kind: "day"; date: string } | { kind: "actionItem"; id: string };

// Mirrors the backend's mcp_focus row (mcpFocus.ts getFocus).
export interface AiFocus {
  slug: string;
  target: FocusTarget;
  nonce: string;
}

// The signal and the trip data arrive on separate subscriptions, so the signal
// can land before the day or item it points at; it waits this long for it.
const FOCUS_TTL_MS = 5000;

interface Ctx {
  focus: AiFocus | null;
  show: (focus: AiFocus) => void;
  consume: (nonce: string) => void;
}

const FocusCtx = createContext<Ctx | null>(null);

export function AiFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<AiFocus | null>(null);
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => setFocus(null), FOCUS_TTL_MS);
    return () => clearTimeout(t);
  }, [focus]);
  const consume = useCallback((nonce: string) => setFocus((cur) => (cur?.nonce === nonce ? null : cur)), []);
  const value = useMemo(() => ({ focus, show: setFocus, consume }), [focus, consume]);
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
}

function useCtx() {
  const ctx = useContext(FocusCtx);
  if (!ctx) throw new Error("useAiFocus must be used within AiFocusProvider");
  return ctx;
}

export const useShowAiFocus = () => useCtx().show;

/** The pending focus, if it targets the trip on screen and is of this kind. */
export function useAiFocus<K extends FocusTarget["kind"]>(kind: K) {
  const { focus, consume } = useCtx();
  const { slug } = useParams();
  const match = focus && focus.slug === slug && focus.target.kind === kind ? focus : null;
  return { focus: match as (AiFocus & { target: Extract<FocusTarget, { kind: K }> }) | null, consume };
}
