import type { ReactNode } from "react";
import { SideNav } from "./SideNav";

export function PageShell({ children, fullWidth }: { children: ReactNode; fullWidth?: boolean }) {
  return (
    <>
      <SideNav />
      <div className={fullWidth ? "wrap wrap--full" : "wrap"}>{children}</div>
    </>
  );
}
