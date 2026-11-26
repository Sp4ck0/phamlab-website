import { googleMapsUrl } from "../../lib/mapPoints";
import { hotelUrl } from "../../lib/calendar";
import { fmtDuration, fmtHm } from "../../lib/segments";
import { isPlaceholderHotel } from "../../lib/tileHeaders";
import { hotelSearchUrl, phoneHref, type StayInfo } from "../../lib/stay";
import { missingHotelFields } from "../../lib/tbd";
import type { HotelGroup } from "../../lib/tripLogic";
import type { Group, ResolvedDay, Status } from "../../lib/types";
import { AddToCalendar } from "./AddToCalendar";
import { HotelFacts } from "./HotelFacts";
import { Linkify } from "./Linkify";
import { ShareLinkButton } from "./ShareLinkButton";
import { StayStrip } from "./StayStrip";
import { MapsPin, ShowOnMap } from "./taskParts";
import { TbdLine } from "./TbdLine";
import { WhoPill } from "./WhoPill";

export interface HotelBodyProps {
  g: HotelGroup;
  status: Status;
  stay: StayInfo | null;
  // Moving hotels on one day: the hotel being left and how long until this check-in.
  gapAfter?: { name: string; minutes: number; checkOutTime?: string };
  groups: Group[];
  date: string; // the day this tile is on
  days?: ResolvedDay[];
  dayNumber: number;
  // A proposed (draft) hotel inside an action item: the item's own actions stand in for these.
  actions?: boolean;
  // The name with its Maps link. A hotel tile has it in its header; a draft card has no header.
  showName?: boolean;
  // Who is staying. A day's hotel tile has it as a pill in its header instead.
  showWho?: boolean;
}

// What a hotel tile shows when open. The timeline header already has the name, the
// stay's part, the booking state and the booked toggle; this is the rest. The name
// keeps its pin and map link, the stay strip shows both check-in and check-out on every
// night of the stay, and the actions (share, call, calendar) sit in one row at the end.
export function HotelBody({ g, status: s, stay, gapAfter, groups, date, days, dayNumber, actions = true, showName = false, showWho = true }: HotelBodyProps) {
  const nm = g.name || "Hotel not chosen";
  const placeholder = isPlaceholderHotel(g);
  const uniqueWho = [...new Set(g.who)];
  const ctype =
    g.checkIn && g.checkOut ? "Hotel" : g.checkIn ? "Hotel · check-in" : g.checkOut ? "Hotel · check-out" : "Hotel · staying";
  const place = { name: g.name, address: g.address, placeId: g.placeId };
  return (
    <div className="hotel-body">
      <div className="ctop">
        <span className="ctype">{ctype}</span>
        {showWho && <WhoPill who={uniqueWho.length === 1 ? uniqueWho[0] : uniqueWho} groups={groups} date={date} />}
      </div>
      <div className="hotel-main">
          {(placeholder || showName) && <div className={`cmain ${s === "needed" && !g.tentative ? "todo" : ""}`}>
            {!placeholder ? (
              // On a timeline card its Maps link and map button are in the card's menu.
              actions ? (
                <>
                  <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">
                    <MapsPin />{nm}
                  </a>
                  <ShowOnMap place={place} />
                </>
              ) : nm
            ) : (
              "Hotel to be decided"
            )}
          </div>}
          {placeholder && g.area && <div className="cmeta">{g.area}</div>}
          {/* With a Place ID the link opens the exact listing, so the address text adds nothing. */}
          {g.address && !g.placeId && <div className="cmeta">{g.address}</div>}
          {stay && <StayStrip stay={stay} checkInTime={g.checkInTime} checkOutTime={g.checkOutTime} />}
          {gapAfter && (
            <div className="stay-gap">
              {fmtDuration(gapAfter.minutes)} between check-out at {gapAfter.name}{gapAfter.checkOutTime ? ` (${fmtHm(gapAfter.checkOutTime)})` : ""} and check-in here
            </div>
          )}
          <HotelFacts g={g} stay={stay} status={s} />
          {s === "needed" && (
            <TbdLine fields={missingHotelFields(g)} area={placeholder ? undefined : g.area}>
              {actions && !g.tentative && placeholder && g.area && (
                <a href={hotelSearchUrl(g.area, stay?.checkIn, stay?.checkOut)} target="_blank" rel="noopener noreferrer">Search hotels here</a>
              )}
            </TbdLine>
          )}
          {/* The free-form note goes last: facts and what is open come first. */}
          {g.detail && <div className="cmeta"><Linkify text={g.detail} /></div>}
      </div>
      {actions && <div className="tl-actions">
        <ShareLinkButton param={{ day: date, tile: g.srcs[0] }} label={`Share link to ${nm}`} />
        {g.phone && (
          <a className="gcal-btn call-btn" href={phoneHref(g.phone)} aria-label={`Call ${nm}`} title={`Call ${g.phone}`}>
            📞
          </a>
        )}
        {days && <AddToCalendar url={hotelUrl(g.name, g.address, days, dayNumber)} />}
      </div>}
    </div>
  );
}
