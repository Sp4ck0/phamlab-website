import type { HotelGroup } from "../../lib/tripLogic";
import { fmtHm } from "../../lib/segments";
import { priceText, type StayInfo } from "../../lib/stay";
import { ConfirmationChip } from "./ConfirmationChip";

// The structured facts of a stay: room, price (the total and per night when both are
// known) and the booking reference behind a tap. When the stay strip is not shown
// (the stay's length isn't known) the time that matters on this tile still appears
// here: check-in on the arrival day, check-out on the departure day. Renders
// nothing when there are none.
export function HotelFacts({ g, stay }: { g: HotelGroup; stay?: StayInfo | null }) {
  const times = stay
    ? []
    : [
        g.checkIn && g.checkInTime ? `Check-in from ${fmtHm(g.checkInTime)}` : "",
        g.checkOut && g.checkOutTime ? `Check-out by ${fmtHm(g.checkOutTime)}` : "",
      ].filter(Boolean);
  const chips = [g.room, g.price ? priceText(g.price, stay?.nights) : ""].filter(Boolean);
  if (!times.length && !chips.length && !g.confirmation) return null;
  return (
    <div className="hotel-facts">
      {times.map((t) => <span key={t} className="hf-time">{t}</span>)}
      {chips.map((c) => <span key={c} className="seg-chip">{c}</span>)}
      {g.confirmation && <ConfirmationChip code={g.confirmation} />}
    </div>
  );
}
