export function GroupChip({ id, name, color, active, onClick }: {
  id: string;
  name: string;
  color: string;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button className="chip" aria-pressed={active} onClick={() => onClick(id)}>
      <span className="dot" style={{ background: color }} />
      {name}
    </button>
  );
}
