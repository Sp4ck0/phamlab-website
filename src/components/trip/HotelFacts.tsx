import type { HotelGroup } from "../../lib/tripLogic";
import { fmtHm } from "../../lib/segments";
import { budgetText, cancelStatus, priceText, type StayInfo } from "../../lib/stay";
import type { Status } from "../../lib/types";
import { ConfirmationChip } from "./ConfirmationChip";

// The structured facts of a stay: room, price (the total and per night when both are
// known), the free-cancellation deadline (green with plenty of time, amber inside
// three days, gray once passed), a budget while the stay isn't booked, and the
// booking reference behind a tap. When the stay strip is not shown (the stay's length
// isn't known) the time that matters on this tile still appears here: check-in on the
// arrival day, check-out on the departure day. Renders nothing when there are none.
export function HotelFacts({ g, stay, status = "booked", now = Date.now() }: { g: HotelGroup; stay?: StayInfo | null; status?: Status; now?: number }) {
  const times = stay
    ? []
    : [
        g.checkIn && g.checkInTime ? `Check-in from ${fmtHm(g.checkInTime)}` : "",
        g.checkOut && g.checkOutTime ? `Check-out by ${fmtHm(g.checkOutTime)}` : "",
      ].filter(Boolean);
  // A passed deadline on a stay that is already over is just noise.
  const cancel = g.freeCancelUntil ? cancelStatus(g.freeCancelUntil, now) : null;
  const showCancel = cancel && !(cancel.state === "ended" && (!stay || Date.parse(stay.checkOut) < now));
  const chips = [g.room, g.price ? priceText(g.price, stay?.nights) : "", status === "needed" && g.budget ? budgetText(g.budget, stay?.nights) : ""].filter(Boolean);
  if (!times.length && !chips.length && !g.confirmation && !showCancel) return null;
  return (
    <div className="hotel-facts">
      {times.map((t) => <span key={t} className="hf-time">{t}</span>)}
      {chips.map((c) => <span key={c} className="seg-chip">{c}</span>)}
      {showCancel && cancel && <span className={`seg-chip cx-${cancel.state}`}>{cancel.state === "soon" ? "⚠ " : ""}{cancel.text}</span>}
      {g.confirmation && <ConfirmationChip code={g.confirmation} />}
    </div>
  );
}
