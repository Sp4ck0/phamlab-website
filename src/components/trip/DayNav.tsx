import type { ResolvedDay } from "../../lib/types";
import { DOW, MON } from "../../lib/tripLogic";

export function DayNav({ days, onJump }: { days: ResolvedDay[]; onJump: (dayId: string) => void }) {
  return (
    <div className="daynav-shell">
      <nav className="daynav">
        {days.map((d) => (
          <a
            key={d.date}
            href={`#day-${d.date}`}
            onClick={(e) => {
              e.preventDefault();
              onJump(`day-${d.date}`);
            }}
          >
            <span className="d">{DOW[d._d.getDay()]}</span> {MON[d._d.getMonth()]} {d._d.getDate()}
          </a>
        ))}
      </nav>
    </div>
  );
}
