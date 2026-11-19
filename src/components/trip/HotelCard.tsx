import { useState } from "react";
import { googleMapsUrl } from "../../lib/mapPoints";
import { hotelUrl } from "../../lib/calendar";
import { fmtDate, fmtDuration, fmtHm } from "../../lib/segments";
import { directionsUrl, type StayInfo } from "../../lib/stay";
import { missingHotelFields } from "../../lib/tbd";
import type { HotelGroup } from "../../lib/tripLogic";
import type { Group, ResolvedDay, Status } from "../../lib/types";
import { AddToCalendar } from "./AddToCalendar";
import { HotelFacts } from "./HotelFacts";
import { Linkify } from "./Linkify";
import { ShareLinkButton } from "./ShareLinkButton";
import { StatusToggle } from "./StatusToggle";
import { StayStrip } from "./StayStrip";
import { ShowOnMap } from "./taskParts";
import { TbdLine } from "./TbdLine";
import { WhoPill } from "./WhoPill";

export interface HotelCardProps {
  g: HotelGroup;
  status: Status;
  stay: StayInfo | null;
  // Moving hotels on one day: the hotel being left and how long until this check-in.
  gapAfter?: { name: string; minutes: number; checkOutTime?: string };
  groups: Group[];
  date: string; // the day this tile is on
  days?: ResolvedDay[];
  dayNumber: number;
  tileId?: string;
  gapsOnly?: boolean;
  onToggle: (ids: string[], status: Status) => void;
  // Set when the card was opened from its slim row: puts a way back.
  onCollapse?: () => void;
}

// The full hotel tile. The name keeps its pin and map link; the stay strip shows
// both check-in and check-out on every night of the stay; Directions sits beside
// "show on map".
export function HotelCard({ g, status: s, stay, gapAfter, groups, date, days, dayNumber, tileId, gapsOnly, onToggle, onCollapse }: HotelCardProps) {
  const nm = g.name || "Hotel not chosen";
  const uniqueWho = [...new Set(g.who)];
  const ctype =
    g.checkIn && g.checkOut ? "Hotel" : g.checkIn ? "Hotel · check-in" : g.checkOut ? "Hotel · check-out" : "Hotel · staying";
  const place = { name: g.name, address: g.address, placeId: g.placeId };
  return (
    <div className={`card ${s === "needed" && !g.tentative ? "miss" : ""}`} id={tileId}>
      <StatusToggle ids={g.srcs} status={s} onToggle={onToggle} />
      <div className="ctop">
        <span className="ctype">{ctype}</span>
        {g.tentative && <span className="maybe-pill">Maybe</span>}
        {gapsOnly && s === "needed" && !g.tentative && <span className="gap-reason">{g.name ? "Not booked" : "Not chosen"}</span>}
        <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={date} />
        <ShareLinkButton param={{ day: date, tile: g.srcs[0] }} label={`Share link to ${nm}`} />
        {days && <AddToCalendar url={hotelUrl(g.name, g.address, days, dayNumber)} />}
        {onCollapse && <button type="button" className="stay-collapse" onClick={onCollapse} aria-label={`Collapse ${nm}`} title="Collapse">▴</button>}
      </div>
      <div className={`cmain ${s === "needed" && !g.tentative ? "todo" : ""}`}>
        {g.name ? (
          <>
            <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
              📍 {nm}
            </a>
            <ShowOnMap place={place} />
            <a className="stay-dir" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">Directions</a>
          </>
        ) : (
          nm
        )}
      </div>
      {/* With a Place ID the link opens the exact listing, so the address text adds nothing. */}
      {g.address && !g.placeId && <div className="cmeta">{g.address}</div>}
      {stay && <StayStrip stay={stay} checkInTime={g.checkInTime} checkOutTime={g.checkOutTime} />}
      {gapAfter && (
        <div className="stay-gap">
          {fmtDuration(gapAfter.minutes)} between check-out at 📍 {gapAfter.name}{gapAfter.checkOutTime ? ` (${fmtHm(gapAfter.checkOutTime)})` : ""} and check-in here
        </div>
      )}
      <HotelFacts g={g} stay={stay} />
      {g.detail && <div className="cmeta"><Linkify text={g.detail} /></div>}
      {s === "needed" && <TbdLine fields={missingHotelFields(g)} area={g.area} />}
    </div>
  );
}

// A middle night of a stay, one slim line instead of a full card repeated every
// night: where you sleep, which night it is, and when you leave. Tap for the full tile.
export function HotelSlim(props: HotelCardProps) {
  const [open, setOpen] = useState(false);
  const { g, stay, tileId } = props;
  if (open) return <HotelCard {...props} onCollapse={() => setOpen(false)} />;
  return (
    <button type="button" className="stay-slim" id={tileId} onClick={() => setOpen(true)} aria-expanded="false">
      <span aria-hidden="true">🏨</span>
      <span className="stay-slim-name">📍 {g.name}</span>
      {stay && (
        <span className="stay-slim-mu">
          · night {stay.night} of {stay.nights} · out {fmtDate(stay.checkOut)}{g.checkOutTime ? ` · ${fmtHm(g.checkOutTime)}` : ""}
        </span>
      )}
      <span className="stay-slim-chev" aria-hidden="true">▸</span>
    </button>
  );
}
