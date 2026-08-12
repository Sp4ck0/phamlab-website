import type { Status } from "../../lib/types";

export function StatusToggle({ ids, status, onToggle }: { ids: string[]; status: Status; onToggle: (ids: string[], status: Status) => void }) {
  return (
    <button
      className="status"
      data-s={status}
      title="Toggle booked"
      onClick={() => onToggle(ids, status)}
    />
  );
}
