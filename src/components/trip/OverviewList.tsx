import type { LegColor, ResolvedDay } from "../../lib/types";
import { DOW, MON } from "../../lib/tripLogic";

interface Props {
  days: ResolvedDay[];
  legColors: LegColor[];
  onJump: (dayId: string) => void;
}

export function OverviewList({ days, legColors, onJump }: Props) {
  return (
    <div className="overview-list">
      {days.map((d, i) => {
        const leg = legColors[i];
        const dayId = `day-${d.date}`;
        return (
          <div
            className="overview-row"
            key={d.date}
            style={{ ["--leg-color" as string]: leg.color, ["--leg-tint" as string]: leg.tint }}
            onClick={() => onJump(dayId)}
          >
            <div className="ov-date">
              <div className="ov-day-label">
                Day {i} · {DOW[d._d.getDay()]}
              </div>
              <div className="ov-date-main">
                {MON[d._d.getMonth()]} {d._d.getDate()}
              </div>
            </div>
            <div className="ov-city">
              <span className="dot" />
              {leg.label}
            </div>
            <div className="ov-highlight">{d.highlight || d.note || ""}</div>
            <div className="ov-arrow">›</div>
          </div>
        );
      })}
    </div>
  );
}
