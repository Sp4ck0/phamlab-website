import type { FlightGroup } from "../../lib/tripLogic";
import { StatusToggle } from "./StatusToggle";
import type { ResolvedDay, Status } from "../../lib/types";
import { AddToCalendar } from "./AddToCalendar";
import { legUrl } from "../../lib/calendar";

interface Props {
  group: FlightGroup;
  onToggle: (ids: string[], status: Status) => void;
  day?: ResolvedDay;
  dayNumber?: number;
}

export function FlightBox({ group, onToggle, day, dayNumber = 0 }: Props) {
  const status: Status = group.statuses.includes("needed") ? "needed" : "booked";
  const legs = group.legs || [];

  return (
    <div className="flight-box">
      <div className="flight-box-head">
        <span className="flight-box-title">{group.title || group.route}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {group.price && <span className="flight-box-price">{group.price}</span>}
          <StatusToggle ids={group.ids} status={status} onToggle={onToggle} style={{ position: "static" }} />
        </span>
      </div>
      {legs.map((leg, i) => (
        <div key={i}>
          <div className="flight-leg">
            <div className="fl-route">{leg.route}</div>
            <div className="fl-time">
              {leg.time}
              {day && <AddToCalendar url={legUrl(leg, i, legs.length, group.mode, day, dayNumber, group.detail)} />}
            </div>
            {leg.meta && <div className="fl-meta">{leg.meta}</div>}
          </div>
          {group.layovers?.[i] && <div className="fl-layover">{group.layovers[i]}</div>}
        </div>
      ))}
    </div>
  );
}
