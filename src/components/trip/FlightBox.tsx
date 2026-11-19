import type { FlightGroup } from "../../lib/tripLogic";
import { StatusToggle } from "./StatusToggle";
import type { FlightLeg, Group, ResolvedDay, Status } from "../../lib/types";
import { WhoPill } from "./WhoPill";
import { AIRLINES, airlineLogoUrl, legAirline } from "../../lib/airlines";
import { AddToCalendar } from "./AddToCalendar";
import { MODE_EMOJI, legUrl } from "../../lib/calendar";
import { ShareLinkButton } from "./ShareLinkButton";
import { ConfirmationChip } from "./ConfirmationChip";
import { SegmentRow } from "./SegmentRow";
import { TbdLine } from "./TbdLine";
import { derivedSegments, fmtDuration, layoverMin, routeSearchUrl } from "../../lib/segments";
import { missingTransportFields } from "../../lib/tbd";

interface Props {
  group: FlightGroup;
  // For the who pill on a row without a title (a titled row already names its travelers).
  groups?: Group[];
  onToggle: (ids: string[], status: Status) => void;
  day?: ResolvedDay;
  dayNumber?: number;
  // Element id, so a shared link can scroll to this box (lib/tileId.ts).
  tileId?: string;
  // Under Only gaps: why this box is listed.
  gapReason?: string;
  // "Departs in 2 h 10 min" when this is the next thing up during the trip.
  nextUp?: string;
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

export function FlightBox({ group, groups, onToggle, day, dayNumber = 0, tileId, gapReason, nextUp }: Props) {
  const status: Status = group.statuses.includes("needed") ? "needed" : "booked";
  const legs = group.segments?.length ? [] : group.legs || [];
  // Every transport row draws this one tile. A row with no segments yet gets blank
  // hops built from its route (places known, times empty), so nothing falls back to
  // a plain text card; legacy `legs` keep their own rows.
  const derived = !group.segments?.length && !legs.length;
  const segments = group.segments?.length ? group.segments : derived ? derivedSegments(group.route) : [];

  // A train, ferry or bus gets a header like the hotel's: the mode and whether it is booked,
  // then who it is for. (The flight tile keeps its own.) Booked, the operator in the row is the title.
  const ground = !!group.mode && group.mode !== "flight";
  const first = segments[0];
  const ticket = group.ticketUrl?.startsWith("https://") ? group.ticketUrl : undefined;
  const search = ground && status === "needed" && !group.tentative && first?.from && first.to ? routeSearchUrl(first.from, first.to) : undefined;
  const who = [...new Set(group.who)];
  const whoPill = groups && !group.title && day ? <WhoPill who={who.length === 1 ? who[0] : who} groups={groups} date={day.date} /> : null;

  return (
    <div className={`flight-box${status === "needed" ? " flight-box-open" : ""}${group.tentative ? " flight-box-maybe" : ""}${nextUp ? " next-up" : ""}`} id={tileId}>
      {nextUp && <div className="next-up-line">{nextUp}</div>}
      <div className="flight-box-head">
        {ground ? (
          <>
            <span className="ctype">{MODE_EMOJI[group.mode!]} {group.mode![0].toUpperCase() + group.mode!.slice(1)}</span>
            {!group.tentative && <span className={`tx-state ${status === "needed" ? "open" : "ok"}`}>{status === "needed" ? "Not booked" : "✓ Booked"}</span>}
          </>
        ) : (
          <span className="flight-box-title">{group.title || group.route}</span>
        )}
        {group.tentative && <span className="maybe-pill">Maybe</span>}
        {gapReason && <span className="gap-reason">{gapReason}</span>}
        {whoPill}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {group.price && <span className="flight-box-price">{group.price}</span>}
          {group.confirmation && <ConfirmationChip code={group.confirmation} />}
          {day && <ShareLinkButton param={{ day: day.date, tile: group.ids[0] }} label={`Share link to ${group.title || group.route}`} />}
          <StatusToggle ids={group.ids} status={status} onToggle={onToggle} style={{ position: "static" }} />
        </span>
      </div>
      {/* Booked, the operator in the row is the title; without one the route says what this is. */}
      {ground && (status === "needed" || group.title || !segments.some((s) => s.carrier || s.airline)) && <div className="tx-title">{group.title || group.route}</div>}
      {segments.map((seg, i) => {
        const wait = i > 0 ? layoverMin(segments[i - 1], seg) : null;
        return (
          <div key={i}>
            {wait !== null && <div className="fl-layover">{fmtDuration(wait)} layover · {seg.from}</div>}
            <SegmentRow seg={seg} mode={group.mode} day={day} dayNumber={dayNumber} first={i === 0} last={i === segments.length - 1} />
          </div>
        );
      })}
      {(segments.length > 0 || derived) && group.detail && <div className="fl-meta">{group.detail}</div>}
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
      {(ticket || search) && (
        <div className="tile-links">
          {ticket && <a href={ticket} target="_blank" rel="noopener noreferrer">Ticket</a>}
          {search && <a href={search} target="_blank" rel="noopener noreferrer">Search this route</a>}
        </div>
      )}
    </div>
  );
}
