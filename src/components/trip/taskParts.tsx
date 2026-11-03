import { useParams } from "react-router-dom";
import type { Place, TaskScope } from "../../lib/types";
import { dow } from "../../lib/tasks";
import { MAP_FOCUS_ICON, focusOnMap, googleMapsUrl, placeKey } from "../../lib/mapPoints";
import { useShowAiFocus } from "../../hooks/useAiFocus";

// Icon button after a place's 📍 link: scrolls to the trip map and opens that
// pin. Renders nothing for a place the map can't pin (no Place ID or address).
export function ShowOnMap({ place }: { place: Place }) {
  if (!placeKey(place)) return null;
  const label = `Show ${place.name} on the trip map`;
  return (
    <button type="button" className="map-focus" title={label} aria-label={label} onClick={() => focusOnMap(place)} dangerouslySetInnerHTML={{ __html: MAP_FOCUS_ICON }} />
  );
}

// 📍 links to each place in Google Maps (exact listing when it has a Place ID).
export function PlaceLinks({ places }: { places: Place[] }) {
  return (
    <>
      {places.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer">
            📍 {p.name}
          </a>
          <ShowOnMap place={p} />
        </span>
      ))}
    </>
  );
}

export const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </svg>
);

export const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
  </svg>
);

// "Fri Nov 20" or "Fri Nov 20 – Sun Nov 22", each date a link to its day in the
// itinerary. Reuses the AI-focus path, which opens, scrolls to and flashes a day.
export function ScopeLinks({ scope }: { scope: TaskScope }) {
  const { slug } = useParams<{ slug: string }>();
  const show = useShowAiFocus();
  if (scope.kind === "trip") return <>Whole trip</>;
  const link = (date: string) => (
    <button
      type="button"
      className="day-link"
      onClick={() => slug && show({ slug, target: { kind: "day", date }, nonce: `${Date.now()}` })}
    >
      {dow(date)}
    </button>
  );
  return scope.kind === "day" ? link(scope.date) : <>{link(scope.start)} – {link(scope.end)}</>;
}
