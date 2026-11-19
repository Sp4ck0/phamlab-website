import { AIRLINES, airlineLogoUrl } from "../../lib/airlines";
import { MODE_EMOJI, segmentUrl } from "../../lib/calendar";
import { dayOffset, durationMin, fmtClock, fmtDate, fmtDuration, segmentLabel } from "../../lib/segments";
import type { ResolvedDay, Segment, TransportMode } from "../../lib/types";
import { AddToCalendar } from "./AddToCalendar";

interface Props {
  seg: Segment;
  mode?: TransportMode;
  day?: ResolvedDay;
  dayNumber?: number;
  first?: boolean;
  last?: boolean;
}

// One hop as a boarding-pass row: who flies it on top, then departure ▸ arrival
// with the duration between.
export function SegmentRow({ seg, mode, day, dayNumber = 0, first, last }: Props) {
  const m = seg.mode || mode || "flight";
  const name = (seg.airline && AIRLINES[seg.airline]?.name) || seg.carrier || seg.airline || "";
  const label = segmentLabel(seg);
  // No carrier at all (a ferry, a train): say what it is rather than leave the line empty.
  const modeName = m === "flight" ? "" : m[0].toUpperCase() + m.slice(1);
  const mins = durationMin(seg);
  const plus = dayOffset(seg);
  const chips = [seg.aircraft, seg.cabin].filter(Boolean);
  const depDate = seg.depart && day && seg.depart.slice(0, 10) !== day.date ? fmtDate(seg.depart) : "";
  const arrDate = seg.arrive && plus !== 0 ? fmtDate(seg.arrive) : "";
  const url = day ? segmentUrl(seg, mode, day, dayNumber, { first, last }) : null;

  return (
    <div className="seg">
      <div className="seg-top">
        <span className="seg-carrier">
          {seg.airline ? (
            <img
              className="fl-airline"
              src={airlineLogoUrl(seg.airline)}
              alt=""
              width={20}
              height={20}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="seg-mode" aria-hidden="true">{MODE_EMOJI[m]}</span>
          )}
          <span>{[name, label && label !== name ? label : ""].filter(Boolean).join(" · ") || modeName}</span>
        </span>
        <span className="seg-chips">
          {chips.map((c) => <span key={c} className="seg-chip">{c}</span>)}
          <AddToCalendar url={url} />
        </span>
      </div>
      <div className="seg-main">
        <div className="seg-end">
          {seg.depart && <div className="seg-time">{fmtClock(seg.depart)}</div>}
          <div className="seg-place">{seg.from}{seg.fromTerminal ? ` · ${seg.fromTerminal}` : ""}</div>
          {depDate && <div className="seg-date">{depDate}</div>}
        </div>
        <div className="seg-mid" aria-label={mins ? `Duration ${fmtDuration(mins)}` : undefined}>
          <span className="seg-dur">{mins ? fmtDuration(mins) : ""}</span>
          <span className="seg-line" aria-hidden="true" />
        </div>
        <div className="seg-end seg-end-arr">
          {seg.arrive && (
            <div className="seg-time">
              {fmtClock(seg.arrive)}
              {plus > 0 && <sup className="seg-plus">+{plus}</sup>}
            </div>
          )}
          <div className="seg-place">{seg.to}{seg.toTerminal ? ` · ${seg.toTerminal}` : ""}</div>
          {arrDate && <div className="seg-date">{arrDate}</div>}
        </div>
      </div>
      {seg.note && <div className="seg-note">{seg.note}</div>}
    </div>
  );
}
