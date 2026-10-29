import { useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useExportActions } from "../hooks/useExportActions";
import { useTripExport } from "../hooks/useTripExport";
import { buildItinerary, type ItineraryItem } from "../lib/itinerary";
import { NotFoundOrDenied } from "./NotFoundOrDenied";

function Item({ item }: { item: ItineraryItem }) {
  return (
    <>
      {item.time && <span className="pd-time">{item.time}</span>}
      {item.tag && <span className="pd-tag">{item.tag}</span>}
      {item.tba ? <span className="pd-tba">{item.main}</span> : <strong>{item.main}</strong>}
      {item.sub && <span className="pd-sub"> · {item.sub}</span>}
      {item.who && <span className="pd-who">{item.who}</span>}
      {item.lines?.map((l, i) => (
        <div className="pd-sub pd-leg" key={i}>
          {l}
        </div>
      ))}
    </>
  );
}

function PrintDoc() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, isLoading } = useTripExport(slug);
  const [params] = useSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  // Invalid or out-of-trip dates fall back to the whole trip.
  const it = useMemo(() => (data ? buildItinerary(data, { from: from ?? undefined, to: to ?? undefined }) : null), [data, from, to]);
  const { flash, copy, download } = useExportActions(slug, it);
  const printed = useRef(false);

  // Open the browser's print dialog once, after the content has painted.
  useEffect(() => {
    if (!data || printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [data]);

  if (isLoading) return <div className="print-doc">Loading…</div>;
  if (!it) return <NotFoundOrDenied />;

  const generated = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="print-doc">
      <div className="no-print pd-toolbar">
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button className="btn" onClick={download}>
          {flash === "download" ? "Downloaded ✓" : "Download Markdown"}
        </button>
        <button className="btn" onClick={copy}>
          {flash === "copy" ? "Copied ✓" : flash === "error" ? "Copy failed" : "Copy itinerary"}
        </button>
        {it.fileSuffix && <span className="pd-sub pd-range">Exporting {it.dates}</span>}
      </div>

      <header className="pd-cover">
        <p className="pd-kicker">{it.kicker}</p>
        <h1>{it.title}</h1>
        <p className="pd-dates">{it.dates}</p>
        {it.intro && <p className="pd-intro">{it.intro}</p>}
        <p className="pd-route">{it.route.join("  →  ")}</p>
        {it.travelers && (
          <p className="pd-travelers">
            <strong>Travelers:</strong> {it.travelers}
          </p>
        )}

        <table className="pd-glance">
          <tbody>
            {it.glance.map((g) => (
              <tr key={g.day}>
                <td>Day {g.day}</td>
                <td>{g.date}</td>
                <td>{g.place}</td>
                <td>{g.highlight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </header>

      {it.days.map((d) => (
        <section className="pd-day" key={d.num}>
          <h2>
            <span className="pd-daynum">Day {d.num}</span> {d.date}
            <span className="pd-place">{d.place}</span>
          </h2>
          {d.event && <p className="pd-event">{d.event}</p>}
          {d.highlight && <p className="pd-highlight">{d.highlight}</p>}

          {d.rows.map((row) => (
            <div className="pd-row" key={row.label}>
              <div className="pd-label">{row.label}</div>
              {row.label === "Plan" ? (
                <ul className="pd-acts">
                  {row.items.map((item, i) => (
                    <li key={i}>
                      <Item item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="pd-body">
                  {row.items.map((item, i) => (
                    <div key={i}>
                      <Item item={item} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      <footer className="pd-footer">
        {it.footer} · Generated {generated}
      </footer>
    </div>
  );
}

export function TripPrintPage() {
  return (
    <ErrorBoundary message="Couldn't load this itinerary.">
      <PrintDoc />
    </ErrorBoundary>
  );
}
