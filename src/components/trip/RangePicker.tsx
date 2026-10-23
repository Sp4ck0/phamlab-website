import { rangeChips, type DateRange } from "../../lib/itinerary";
import { DOW, MON } from "../../lib/tripLogic";
import type { TripExport } from "../../lib/types";

const dayLabel = (d: TripExport["days"][number], i: number) => {
  const date = new Date(d.date + "T00:00:00");
  return `Day ${i + 1} · ${DOW[date.getDay()]}, ${MON[date.getMonth()]} ${date.getDate()} · ${d.city}`;
};

// value === null means the whole trip.
export function RangePicker({
  data,
  value,
  onChange,
}: {
  data: TripExport;
  value: DateRange | null;
  onChange: (v: DateRange | null) => void;
}) {
  const days = data.days;
  if (days.length < 2) return null;
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const chips = rangeChips(data);

  const count = value ? days.filter((d) => d.date >= value.from && d.date <= value.to).length : days.length;
  const startNum = value ? days.findIndex((d) => d.date === value.from) + 1 : 1;

  return (
    <div className="range-picker">
      <div className="range-seg" role="group" aria-label="Range">
        <button type="button" aria-pressed={!value} onClick={() => onChange(null)}>
          Whole trip
        </button>
        <button type="button" aria-pressed={!!value} onClick={() => onChange(value ?? { from: first, to: last })}>
          Choose days
        </button>
      </div>

      {value && (
        <>
          {chips.length > 0 && (
            <div className="range-chips">
              {chips.map((c) => (
                <button
                  type="button"
                  key={c.label}
                  className="chip"
                  aria-pressed={c.range.from === value.from && c.range.to === value.to}
                  onClick={() => onChange(c.range)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <label>
            From
            <select
              value={value.from}
              onChange={(e) => onChange({ from: e.target.value, to: e.target.value > value.to ? e.target.value : value.to })}
            >
              {days.map((d, i) => (
                <option key={d.date} value={d.date}>
                  {dayLabel(d, i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={value.to} onChange={(e) => onChange({ from: value.from, to: e.target.value })}>
              {days.map((d, i) =>
                d.date >= value.from ? (
                  <option key={d.date} value={d.date}>
                    {dayLabel(d, i)}
                  </option>
                ) : null
              )}
            </select>
          </label>
          <p className="range-summary">
            Days {startNum}–{startNum + count - 1} · {count} of {days.length} days
          </p>
        </>
      )}
    </div>
  );
}
