import type { FlightGroup } from "../../lib/tripLogic";
import { StatusToggle } from "./StatusToggle";
import type { FlightLeg, ResolvedDay, Status } from "../../lib/types";
import { AIRLINES, airlineLogoUrl, legAirline } from "../../lib/airlines";
import { AddToCalendar } from "./AddToCalendar";
import { legUrl } from "../../lib/calendar";
import { ShareLinkButton } from "./ShareLinkButton";

interface Props {
  group: FlightGroup;
  onToggle: (ids: string[], status: Status) => void;
  day?: ResolvedDay;
  dayNumber?: number;
  // Element id, so a shared link can scroll to this box (lib/tileId.ts).
  tileId?: string;
  // Under Only gaps: why this box is listed.
  gapReason?: string;
}

function AirlineChip({ leg }: { leg: FlightLeg }) {
  const code = legAirline(leg);
  if (!code) return null;
  const name = AIRLINES[code]?.name ?? code;
  return (
    <img
      className="fl-airline"
      src={airlineLogoUrl(code)}
      alt={name}
      title={name}
      width={20}
      height={20}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}

export function FlightBox({ group, onToggle, day, dayNumber = 0, tileId, gapReason }: Props) {
  const status: Status = group.statuses.includes("needed") ? "needed" : "booked";
  const legs = group.legs || [];

  return (
    <div className="flight-box" id={tileId}>
      <div className="flight-box-head">
        <span className="flight-box-title">{group.title || group.route}</span>
        {gapReason && <span className="gap-reason">{gapReason}</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {group.price && <span className="flight-box-price">{group.price}</span>}
          {day && <ShareLinkButton param={{ day: day.date, tile: group.ids[0] }} label={`Share link to ${group.title || group.route}`} />}
          <StatusToggle ids={group.ids} status={status} onToggle={onToggle} style={{ position: "static" }} />
        </span>
      </div>
      {legs.map((leg, i) => (
        <div key={i}>
          <div className="flight-leg">
            <div className="fl-route">
              {(!group.mode || group.mode === "flight") && <AirlineChip leg={leg} />}
              {leg.route}
            </div>
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
