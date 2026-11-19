import type { ReactNode } from "react";

// "To be decided" for a tile that isn't booked, worked out from what's empty
// (lib/tbd.ts); nothing is typed into the data. Renders nothing when nothing is open.
// `children` (a search link) sits at the end of the same row.
export function TbdLine({ fields, area, children }: { fields: string[]; area?: string; children?: ReactNode }) {
  if (!fields.length) return null;
  return (
    <div className="tbd">
      <span className="tbd-label">To be decided{area ? ` · ${area}` : ""}</span>
      {fields.map((f) => <span key={f} className="seg-chip tbd-chip">{f}</span>)}
      {children && <span className="tbd-action">{children}</span>}
    </div>
  );
}
