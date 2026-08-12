import type { ReactNode } from "react";
import { SideNav } from "./SideNav";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SideNav />
      <div className="wrap">{children}</div>
    </>
  );
}
