import type { Group, ResolvedDay, Status } from "../../lib/types";
import { GridRow } from "./GridRow";

export function GridTable({ days, groups, activeGroup, ticks }: {
  days: ResolvedDay[];
  groups: Group[];
  activeGroup: string;
  ticks: Record<string, Status>;
}) {
  return (
    <div className="matrix">
      <table>
        <colgroup>
          <col className="c-date" />
          <col className="c-city" />
          <col className="c-flt" />
          <col className="c-hotel-wide" />
          <col className="c-plan" />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>City</th>
            <th>Flights</th>
            <th>Hotel</th>
            <th>Plan</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, di) => (
            <GridRow key={d.date} day={d} dayIndex={di} groups={groups} activeGroup={activeGroup} ticks={ticks} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
