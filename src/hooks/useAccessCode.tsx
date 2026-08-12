import { createContext, useContext, useState, type ReactNode } from "react";
import { clearAccessCode, loadAccessCode, saveAccessCode } from "../lib/accessCode";

interface AccessCodeCtx {
  code: string | undefined;
  set: (code: string) => void;
  clear: () => void;
}

const Ctx = createContext<AccessCodeCtx | null>(null);

export function AccessCodeProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | undefined>(() => loadAccessCode());

  const set = (next: string) => {
    saveAccessCode(next);
    setCode(next.trim());
  };
  const clear = () => {
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
