import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTripExport } from "../hooks/useTripExport";
import { DOW, MON, deriveRoute, flagEmoji, fmtShort } from "../lib/tripLogic";
import type { TripExport, TripExportDay, TripExportHotel, Who } from "../lib/types";
import { NotFoundOrDenied } from "./NotFoundOrDenied";

type Groups = TripExport["groups"];

// Tag for a booking that isn't for the whole group; "all" (or any id that
// isn't a traveler) reads as everyone and gets no tag.
function whoTag(who: Who, groups: Groups): string | null {
  const names = (Array.isArray(who) ? who : [who])
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(" & ") : null;
}

function WhoTag({ who, groups }: { who: Who; groups: Groups }) {
  const tag = groups.length > 1 ? whoTag(who, groups) : null;
  return tag ? <span className="pd-who">{tag}</span> : null;
}

function StayRows({ day, carried, groups }: { day: TripExportDay; carried: TripExportHotel[]; groups: Groups }) {
  const staying = day.hotels === "same";
  const hotels = staying ? carried : (day.hotels as TripExportHotel[]);
  return (
    <>
      {hotels.map((h, i) => (
        <div className="pd-row" key={i}>
          <div className="pd-label">Stay</div>
          <div className="pd-body">
            {h.tba ? (
              <span className="pd-tba">Hotel — to be arranged</span>
            ) : (
              <>
                <strong>{staying ? `Staying at ${h.name}` : h.name}</strong>
                {h.address && <span className="pd-sub"> · {h.address}</span>}
                {h.detail && <div className="pd-sub">{h.detail}</div>}
              </>
            )}
            <WhoTag who={h.who} groups={groups} />
          </div>
        </div>
      ))}
    </>
  );
}

export function TripPrintPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useTripExport(slug);
  const printed = useRef(false);

  // Open the browser's print dialog once, after the content has painted.
  useEffect(() => {
    if (!data || printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [data]);

  if (isLoading) return <div className="print-doc">Loading…</div>;
  if (!data) return <NotFoundOrDenied />;

  const route = deriveRoute(
    data.days.map((d) => ({ city: d.city, to: d.to })),
    []
  );
  const generated = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  let carried: TripExportHotel[] = [];

  return (
    <div className="print-doc">
      <div className="no-print pd-toolbar">
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <header className="pd-cover">
        <p className="pd-kicker">{data.kicker}</p>
        <h1>
          {data.title} <em>{data.titleEmphasis}</em>
        </h1>
        <p className="pd-dates">
          {data.dateRangeLabel} · {data.days.length} days
        </p>
        {data.sdek && <p className="pd-intro">{data.sdek}</p>}
        <p className="pd-route">{route.map((s) => s.label).join("  →  ")}</p>
        {data.groups.length > 1 && (
          <p className="pd-travelers">
            <strong>Travelers:</strong>{" "}
            {data.groups
              .map((g) => (g.from || g.to ? `${g.name} (${fmtShort(g.from ?? data.days[0].date)}–${fmtShort(g.to ?? data.days[data.days.length - 1].date)})` : g.name))
              .join(", ")}
          </p>
        )}

        <table className="pd-glance">
          <tbody>
            {data.days.map((d, i) => {
              const date = new Date(d.date + "T00:00:00");
              return (
                <tr key={d.date}>
                  <td>Day {i + 1}</td>
                  <td>
                    {DOW[date.getDay()]}, {MON[date.getMonth()]} {date.getDate()}
                  </td>
                  <td>{d.to ? `${d.city} → ${d.to}` : d.city}</td>
                  <td>{d.highlight}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </header>

      {data.days.map((d, i) => {
        const date = new Date(d.date + "T00:00:00");
        const flag = flagEmoji(d.country);
        const toFlag = flagEmoji(d.toCountry);
        if (d.hotels !== "same") carried = d.hotels;
        return (
          <section className="pd-day" key={d.date}>
            <h2>
              <span className="pd-daynum">Day {i + 1}</span> {DOW[date.getDay()]}, {MON[date.getMonth()]} {date.getDate()}
              <span className="pd-place">
                {flag?.emoji} {d.city}
                {d.to && (
                  <>
                    {" → "}
                    {toFlag?.emoji} {d.to}
                  </>
                )}
              </span>
            </h2>
            {d.event && <p className="pd-event">{d.event}</p>}
            {d.highlight && <p className="pd-highlight">{d.highlight}</p>}

            {d.flights.map((f, fi) => (
              <div className="pd-row" key={`f${fi}`}>
                <div className="pd-label">Travel</div>
                <div className="pd-body">
                  {f.tba ? (
                    <span className="pd-tba">Flight {f.route} — to be arranged</span>
                  ) : (
                    <>
                      <strong>{f.title || f.route}</strong>
                      {f.detail && <span className="pd-sub"> · {f.detail}</span>}
                      {f.legs?.map((l, li) => (
                        <div key={li}>
                          <div className="pd-leg">
                            {l.route} <span className="pd-sub">· {l.time}</span>
                            {l.meta && <span className="pd-sub"> · {l.meta}</span>}
                          </div>
                          {f.layovers?.[li] && <div className="pd-sub pd-layover">{f.layovers[li]}</div>}
                        </div>
                      ))}
                    </>
                  )}
                  <WhoTag who={f.who} groups={data.groups} />
                </div>
              </div>
            ))}

            <StayRows day={d} carried={carried} groups={data.groups} />

            {d.acts.length > 0 && (
              <div className="pd-row">
                <div className="pd-label">Plan</div>
                <ul className="pd-acts">
                  {d.acts.map((a, ai) => (
                    <li key={ai}>
                      {a.time && <span className="pd-time">{a.time}</span>}
                      {a.tag && <span className="pd-tag">{a.tag}</span>}
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.tourDetails?.summary && (
              <div className="pd-row">
                <div className="pd-label">Tour</div>
                <div className="pd-body">
                  <strong>{d.tourDetails.summary}</strong>
                  {d.tourDetails.body && <p className="pd-sub">{d.tourDetails.body}</p>}
                </div>
              </div>
            )}
          </section>
        );
      })}

      <footer className="pd-footer">
        {data.title} {data.titleEmphasis} · Generated {generated}
      </footer>
    </div>
  );
}
