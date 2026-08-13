import type { ActionItem, Group, LegColor, ResolvedDay, Status } from "../../lib/types";
import { DayNav } from "./DayNav";
import { DayCard } from "./DayCard";

interface Props {
  days: ResolvedDay[];
  legColors: LegColor[];
  groups: Group[];
  ticks: Record<string, Status>;
  onlyGaps: boolean;
  onToggle: (ids: string[], status: Status) => void;
  onJump: (dayId: string) => void;
  actionItems: ActionItem[];
  actionItemsDone: Record<string, boolean>;
  onToggleActionItem: (id: string) => void;
}

export function DetailedView({
  days,
  legColors,
  groups,
  ticks,
  onlyGaps,
  onToggle,
  onJump,
  actionItems,
  actionItemsDone,
  onToggleActionItem,
}: Props) {
  return (
    <>
      <DayNav days={days} onJump={onJump} />
      <div className="timeline">
        {days.map((d, i) => (
          <DayCard
            key={d.date}
            day={d}
            dayIndex={i}
            dayNumber={i + 1}
            legColor={legColors[i]}
            groups={groups}
            ticks={ticks}
            onlyGaps={onlyGaps}
            onToggle={onToggle}
            dayActionItems={actionItems.filter((item) => item.date === d.date)}
            actionItemsDone={actionItemsDone}
            onToggleActionItem={onToggleActionItem}
          />
        ))}
      </div>
    </>
  );
}
