import { createContext, useContext, useState, type ReactNode } from "react";
import { clearAccessCode, loadAccessCode, saveAccessCode } from "../lib/accessCode";
import { clearSaved } from "../lib/offline";

interface AccessCodeCtx {
  code: string | undefined;
  set: (code: string) => void;
  clear: () => void;
}

const Ctx = createContext<AccessCodeCtx | null>(null);

export function AccessCodeProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | undefined>(() => loadAccessCode());

  // The trips kept on this device for offline (lib/offline.ts) belong to the code that opened them,
  // so another code, or logging out (which clears it), drops them.
  const set = (next: string) => {
    if (next.trim() !== code) void clearSaved();
    saveAccessCode(next);
    setCode(next.trim());
  };
  const clear = () => {
    void clearSaved();
    clearAccessCode();
    setCode(undefined);
  };

  return <Ctx.Provider value={{ code, set, clear }}>{children}</Ctx.Provider>;
}

export function useAccessCode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccessCode must be used within AccessCodeProvider");
  return ctx;
}
