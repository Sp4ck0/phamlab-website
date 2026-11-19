import type { HotelPrice } from "../../lib/types";
import type { HotelGroup } from "../../lib/tripLogic";
import { fmtHm } from "../../lib/segments";
import { ConfirmationChip } from "./ConfirmationChip";

function fmtPrice(p: HotelPrice): string {
  let amount: string;
  try {
    amount = new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency }).format(p.amount);
  } catch {
    amount = `${p.amount} ${p.currency}`; // an unknown currency code still shows
  }
  return p.per === "night" ? `${amount} / night` : p.per === "stay" ? `${amount} total` : amount;
}

// The structured facts of a stay: the time that matters on this tile (check-in
// on the arrival day, check-out on the departure day), room, price, and the
// booking reference behind a tap. Renders nothing when there are none.
export function HotelFacts({ g }: { g: HotelGroup }) {
  const times = [
    g.checkIn && g.checkInTime ? `Check-in from ${fmtHm(g.checkInTime)}` : "",
    g.checkOut && g.checkOutTime ? `Check-out by ${fmtHm(g.checkOutTime)}` : "",
  ].filter(Boolean);
  const chips = [g.room, g.price ? fmtPrice(g.price) : ""].filter(Boolean);
  if (!times.length && !chips.length && !g.confirmation) return null;
  return (
    <div className="hotel-facts">
      {times.map((t) => <span key={t} className="hf-time">{t}</span>)}
      {chips.map((c) => <span key={c} className="seg-chip">{c}</span>)}
      {g.confirmation && <ConfirmationChip code={g.confirmation} />}
    </div>
  );
}
