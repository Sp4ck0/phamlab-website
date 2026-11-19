import { fmtDate, fmtHm } from "../../lib/segments";
import type { StayInfo } from "../../lib/stay";

// Where this night sits in the stay: check-in (left) and check-out (right) dates, with
// their times when known, on every tile of it, a dot per night (the ringed one is
// tonight), and the number of nights. Long stays
// draw a bar instead of a dot per night.
export function StayStrip({ stay, checkInTime, checkOutTime }: { stay: StayInfo; checkInTime?: string; checkOutTime?: string }) {
  // 0 = the check-in day ... nights = the check-out day
  const pos = stay.night - 1 + (stay.isCheckOutDay ? 1 : 0);
  const label = `Night ${stay.night} of ${stay.nights}`;
  return (
    <div className="stay-strip" role="group" aria-label={`${label}, ${stay.nights} ${stay.nights === 1 ? "night" : "nights"}`}>
      <div className="stay-bar" aria-hidden="true">
        {stay.nights <= 14 ? (
          Array.from({ length: stay.nights + 1 }, (_, j) => (
            <span key={j} className="stay-seg">
              {j > 0 && <span className="stay-ln" />}
              <span className={`stay-dot${j <= pos ? " on" : ""}${j === pos ? " now" : ""}`} />
            </span>
          ))
        ) : (
          <span className="stay-long"><span className="stay-long-fill" style={{ width: `${(pos / stay.nights) * 100}%` }} /></span>
        )}
      </div>
      <div className="stay-lbl">
        <b>{fmtDate(stay.checkIn)}{checkInTime ? ` · ${fmtHm(checkInTime)}` : ""}</b>
        <span>{stay.nights} {stay.nights === 1 ? "night" : "nights"}</span>
        <b>{fmtDate(stay.checkOut)}{checkOutTime ? ` · ${fmtHm(checkOutTime)}` : ""}</b>
      </div>
    </div>
  );
}
