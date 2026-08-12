export interface Stat {
  value: string;
  label: string;
}

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats">
      {stats.map((s, i) => (
        <div className="stat-tile" key={i}>
          <div className="stat-value">{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
