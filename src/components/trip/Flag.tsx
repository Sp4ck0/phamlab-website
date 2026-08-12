import { flagEmoji } from "../../lib/tripLogic";

export function Flag({ country }: { country?: string }) {
  const f = flagEmoji(country);
  if (!f) return null;
  return (
    <span className="flag" role="img" aria-label={f.label} title={f.label}>
      {f.emoji}
    </span>
  );
}
