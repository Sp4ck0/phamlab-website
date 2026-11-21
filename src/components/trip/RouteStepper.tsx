import { useState, type ReactNode } from "react";
import { byStay, fmtShort, type CountryStop, type RouteStop } from "../../lib/tripLogic";

// `iconOnly` shows just the icon and count; the label stays as the accessible name.
function Chip({ icon, label, count, pressed, onClick, iconOnly }: { icon: ReactNode; label: string; count: number; pressed: boolean; onClick: () => void; iconOnly?: boolean }) {
  const name = iconOnly ? undefined : label;
  const a11y = iconOnly ? { "aria-label": count ? `${label}, ${count} ${count === 1 ? "person" : "people"}` : label, title: label } : {};
  if (!count)
    return (
      <span className="route-chip" role={iconOnly ? "img" : undefined} {...a11y}>
        {icon}
        {name}
      </span>
    );
  return (
    <button type="button" className="route-chip" aria-expanded={pressed} onClick={onClick} {...a11y}>
      {icon}
      {name}
      <span className="route-count">{count}</span>
    </button>
  );
}

const dot = (color: string) => <span className="dot" style={{ background: color }} />;

// The route by country, each with how many people are there. Tap a country to
// see its cities and who is there; tap a city to narrow to it. Names in green
// joined since the country (or city) before; names in red left.
export function RouteStepper({ countries }: { countries: CountryStop[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [city, setCity] = useState<number | null>(null);
  const country = open !== null ? countries[open] : null;
  const shown: CountryStop | RouteStop | null = country && city !== null ? country.stops[city] : country;
  const toggle = (i: number) => {
    setOpen(open === i ? null : i);
    setCity(null);
  };
  return (
    <>
      <div className="route">
        {countries.map((c, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="route-arrow">→</span>}
            <Chip
              icon={c.emoji ? <span className="route-flag">{c.emoji}</span> : dot(c.stops[0].color)}
              label={c.label}
              count={c.who.length}
              pressed={open === i}
              onClick={() => toggle(i)}
              iconOnly={!!c.emoji}
            />
          </span>
        ))}
      </div>
      {country && shown && (
        <div className="route-who">
          <div className="route route-cities">
            {country.stops.map((s, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="route-arrow">→</span>}
                <Chip icon={dot(s.color)} label={s.label} count={s.who.length} pressed={city === i} onClick={() => setCity(city === i ? null : i)} />
              </span>
            ))}
          </div>
          <div className="route-who__head">
            {shown.label} · {fmtShort(shown.dates[0])}
            {shown.dates.length > 1 && ` – ${fmtShort(shown.dates[shown.dates.length - 1])}`}
            {` · ${shown.who.length} ${shown.who.length === 1 ? "person" : "people"}`}
          </div>
          <div className="roster-list">
            {[...[...shown.who].sort(byStay), ...[...shown.left].sort(byStay)].map((g) => (
              <span className="roster-person" key={g.id}>
                {dot(g.color)}
                <span className={shown.left.includes(g) ? "route-who__out" : shown.joined.includes(g) ? "route-who__in" : undefined}>
                  {g.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
