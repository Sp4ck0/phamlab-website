import type { CSSProperties } from "react";
import type { Status } from "../../lib/types";

export function StatusToggle({
  ids,
  status,
  onToggle,
  style,
}: {
  ids: string[];
  status: Status;
  onToggle: (ids: string[], status: Status) => void;
  style?: CSSProperties;
}) {
  return (
    <button
      className="status"
      data-s={status}
      title="Toggle booked"
      aria-label={status === "booked" ? "Booked. Mark as not booked" : "Not booked yet. Mark as booked"}
      onClick={() => onToggle(ids, status)}
      style={style}
    />
  );
}
