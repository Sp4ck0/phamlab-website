interface Props {
  onlyGaps: boolean;
  onOnlyGapsChange: (v: boolean) => void;
  showOnlyGaps: boolean;
}

export function Controls({ onlyGaps, onOnlyGapsChange, showOnlyGaps }: Props) {
  if (!showOnlyGaps) return null;

  return (
    <div className="controls">
      <span className="spacer" />
      <button className="btn" aria-pressed={onlyGaps} onClick={() => onOnlyGapsChange(!onlyGaps)}>
        {onlyGaps ? "Show all days" : "Only gaps"}
      </button>
    </div>
  );
}
