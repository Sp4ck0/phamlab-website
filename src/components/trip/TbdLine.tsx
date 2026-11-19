// "To be decided" for a tile that isn't booked, worked out from what's empty
// (lib/tbd.ts); nothing is typed into the data. Renders nothing when nothing is open.
export function TbdLine({ fields, area }: { fields: string[]; area?: string }) {
  if (!fields.length) return null;
  return (
    <div className="tbd">
      <span className="tbd-label">To be decided{area ? ` · ${area}` : ""}</span>
      {fields.map((f) => <span key={f} className="seg-chip tbd-chip">{f}</span>)}
    </div>
  );
}
