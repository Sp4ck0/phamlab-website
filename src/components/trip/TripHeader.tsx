import type { Day, Group } from "../../lib/types";
import { renderCountdown, statline } from "../../lib/tripLogic";

export function TripHeader({ kicker, title, titleEmphasis, dateRangeLabel, citiesLabel, groups, days }: {
  kicker: string;
  title: string;
  titleEmphasis: string;
  dateRangeLabel: string;
  citiesLabel: string;
  groups: Group[];
  days: Day[];
}) {
  return (
    <header>
      <div className="kicker">{kicker}</div>
      <h1>
        {title}
        <br />
        <em>{titleEmphasis}</em>
      </h1>
      <div className="sub">
        <span>
          <b>{dateRangeLabel}</b>
        </span>
        <span>{citiesLabel}</span>
        <span>{statline(groups, days)}</span>
        <span className="countdown">{renderCountdown(days)}</span>
      </div>
    </header>
  );
}
