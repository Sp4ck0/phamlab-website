import type { Group, ResolvedDay, Status } from "../../lib/types";
import { TimelineDay } from "./TimelineDay";

interface Props {
  days: ResolvedDay[];
  groups: Group[];
  activeGroup: string;
  ticks: Record<string, Status>;
  onlyGaps: boolean;
  onToggle: (ids: string[], status: Status) => void;
}

export function TripTimeline({ days, groups, activeGroup, ticks, onlyGaps, onToggle }: Props) {
  return (
    <div className="timeline">
      {days.map((d, di) => (
        <TimelineDay
          key={d.date}
          day={d}
          dayIndex={di}
          groups={groups}
          activeGroup={activeGroup}
          ticks={ticks}
          onlyGaps={onlyGaps}
          onToggle={onToggle}
          animationDelay={Math.min(di * 35, 420)}
        />
      ))}
    </div>
  );
}
