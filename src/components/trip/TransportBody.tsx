import { modeLabel, type FlightGroup } from "../../lib/tripLogic";
import type { FlightLeg, Group, ResolvedDay, Status } from "../../lib/types";
import { WhoPill } from "./WhoPill";
import { AIRLINES, airlineLogoUrl, legAirline } from "../../lib/airlines";
import { AddToCalendar } from "./AddToCalendar";
import { legUrl } from "../../lib/calendar";
import { ShareLinkButton } from "./ShareLinkButton";
import { ConfirmationChip } from "./ConfirmationChip";
import { SegmentRow } from "./SegmentRow";
import { TbdLine } from "./TbdLine";
import { fmtDuration, layoverMin, routeSearchUrl } from "../../lib/segments";
import { missingTransportFields } from "../../lib/tbd";
import { segmentsOf } from "../../lib/tileHeaders";

export interface TransportBodyProps {
  group: FlightGroup;
  // For the who pill on a row without a title (a titled row already names its travelers).
  groups?: Group[];
  day?: ResolvedDay;
  dayNumber?: number;
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

// What a transport tile shows when open: its hops as boarding-pass rows, what is still
// open, the free-form note, and one action row (share, and the ticket or route search).
// The header already has the title, the booking state and the booked toggle.
export function TransportBody({ group, groups, day, dayNumber = 0 }: TransportBodyProps) {
  const status: Status = group.statuses.includes("needed") ? "needed" : "booked";
  const { legs, derived, segments } = segmentsOf(group);
  const ground = !!group.mode && group.mode !== "flight";
  const first = segments[0];
  const ticket = group.ticketUrl?.startsWith("https://") ? group.ticketUrl : undefined;
  const search = ground && status === "needed" && !group.tentative && first?.from && first.to ? routeSearchUrl(first.from, first.to) : undefined;
  const who = [...new Set(group.who)];
  const whoPill = groups && !group.title && day ? <WhoPill who={who.length === 1 ? who[0] : who} groups={groups} date={day.date} /> : null;

  return (
    <div className="transport-body">
      {(whoPill || group.price || group.confirmation) && (
        <div className="transport-top">
          <span className="ctype">{modeLabel(group.mode)}</span>
          {whoPill}
          {group.price && <span className="flight-box-price">{group.price}</span>}
          {group.confirmation && <ConfirmationChip code={group.confirmation} />}
        </div>
      )}
      {segments.map((seg, i) => {
        const wait = i > 0 ? layoverMin(segments[i - 1], seg) : null;
        return (
          <div key={i}>
            {wait !== null && <div className="fl-layover">{fmtDuration(wait)} layover · {seg.from}</div>}
            <SegmentRow seg={seg} mode={group.mode} day={day} dayNumber={dayNumber} first={i === 0} last={i === segments.length - 1} />
          </div>
        );
      })}
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
      {status === "needed" && !legs.length && <TbdLine fields={missingTransportFields({ mode: group.mode, segments })} />}
      {/* The free-form note goes last: the hops and what is open come first. */}
      {(segments.length > 0 || derived) && group.detail && <div className="fl-meta">{group.detail}</div>}
      {(day || ticket || search) && (
        <div className="tl-actions">
          {day && <ShareLinkButton param={{ day: day.date, tile: group.ids[0] }} label={`Share link to ${group.title || group.route}`} />}
          {ticket && <a className="tl-link" href={ticket} target="_blank" rel="noopener noreferrer">Ticket</a>}
          {search && <a className="tl-link" href={search} target="_blank" rel="noopener noreferrer">Search this route</a>}
        </div>
      )}
    </div>
  );
}
