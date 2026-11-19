import { AIRLINES, airlineLogoUrl } from "../../lib/airlines";
import { MODE_EMOJI, segmentUrl } from "../../lib/calendar";
import { dayOffset, durationMin, fmtClock, fmtDate, fmtDuration, fmtWindow, hasTime, segmentLabel, terminalText } from "../../lib/segments";
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
// with the duration between. A hop that isn't planned yet draws the same row with
// blank slots: "--:--" for a time not decided, "Not decided" for a place, and the
// day (or the flexible window) where there is one.
export function SegmentRow({ seg, mode, day, dayNumber = 0, first, last }: Props) {
  const m = seg.mode || mode || "flight";
  const name = (seg.airline && AIRLINES[seg.airline]?.name) || seg.carrier || seg.airline || "";
  // A flight shows "CI 21"; a train, ferry or bus shows its operator, then its number if it has one ("Sample Rail · G123").
  const label = seg.airline ? segmentLabel(seg) : seg.number ?? "";
  // No carrier at all (a ferry, a train): say what it is rather than leave the line empty.
  const modeName = m === "flight" ? "" : m[0].toUpperCase() + m.slice(1);
  const mins = durationMin(seg);
  const plus = hasTime(seg.arrive) ? dayOffset(seg) : 0;
  const chips = [seg.aircraft, seg.cabin, seg.seat].filter(Boolean);
  // The day under a place when it isn't the card's own day, or when there is no time to say it.
  const depDate = seg.depart && ((day && seg.depart.slice(0, 10) !== day.date) || !hasTime(seg.depart)) ? fmtDate(seg.depart) : "";
  const arrDate = seg.arrive && (plus !== 0 || !hasTime(seg.arrive)) ? fmtDate(seg.arrive) : "";
  const flexible = !seg.depart && seg.window ? `Any day ${fmtWindow(seg.window)}` : "";
  const url = day ? segmentUrl(seg, mode, day, dayNumber, { first, last }) : null;

  const place = (p: string | undefined, terminal: string | undefined) =>
    p ? (
      m === "flight" ? (
        <div className="seg-place">{p}{terminal ? ` · ${terminal}` : ""}</div>
      ) : (
        // A train, ferry or bus: the place keeps its room, and the platform, pier or stop sits under it.
        <>
          <div className="seg-place">{p}</div>
          {terminal && <div className="seg-terminal">{terminalText(m, terminal)}</div>}
        </>
      )
    ) : (
      <div className="seg-place seg-undecided">Not decided</div>
    );

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
          <div className={`seg-time${hasTime(seg.depart) ? "" : " blank"}`}>{hasTime(seg.depart) ? fmtClock(seg.depart) : "--:--"}</div>
          {place(seg.from, seg.fromTerminal)}
          {depDate && <div className="seg-date">{depDate}</div>}
          {flexible && <div className="seg-date">{flexible}</div>}
        </div>
        <div className="seg-mid" aria-label={mins ? `Duration ${fmtDuration(mins)}` : undefined}>
          <span className="seg-dur">{mins ? fmtDuration(mins) : ""}</span>
          <span className="seg-line" aria-hidden="true" />
        </div>
        <div className="seg-end seg-end-arr">
          <div className={`seg-time${hasTime(seg.arrive) ? "" : " blank"}`}>
            {hasTime(seg.arrive) ? fmtClock(seg.arrive) : "--:--"}
            {plus > 0 && <sup className="seg-plus">+{plus}</sup>}
          </div>
          {place(seg.to, seg.toTerminal)}
          {arrDate && <div className="seg-date">{arrDate}</div>}
        </div>
      </div>
      {seg.note && <div className="seg-note">{seg.note}</div>}
    </div>
  );
}
