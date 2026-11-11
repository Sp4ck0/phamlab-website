import type { Dispatch, SetStateAction } from "react";
import type { Place } from "../../lib/types";

const MAX_PLACES = 5;

// The Places rows shared by the Action Item and Activity editors. A place's
// Google Place ID is kept only while its name and address are untouched.
export function PlacesEditor({ places, setPlaces }: { places: Place[]; setPlaces: Dispatch<SetStateAction<Place[]>> }) {
  const editPlace = (i: number, patch: Partial<Place>) =>
    setPlaces((prev) => prev.map((p, j) => (j === i ? { name: p.name, address: p.address, ...patch } : p)));

  return (
    <div className="ai-places" role="group" aria-label="Places">
      {places.map((p, i) => (
        <div className="ai-place" key={i}>
          <label className="ai-field">
            <span className="ai-label">Name</span>
            <input
              className="ai-input"
              aria-label={`Place ${i + 1} name`}
              maxLength={120}
              value={p.name}
              onChange={(e) => editPlace(i, { name: e.target.value, placeId: undefined })}
            />
          </label>
          <label className="ai-field">
            <span className="ai-label">Address</span>
            <input
              className="ai-input"
              placeholder="Address, city, country (so Google can find it)"
              aria-label={`Place ${i + 1} address`}
              maxLength={300}
              value={p.address ?? ""}
              onChange={(e) => editPlace(i, { address: e.target.value, placeId: undefined })}
            />
          </label>
          <button type="button" className="ai-btn" onClick={() => setPlaces((prev) => prev.filter((_, j) => j !== i))}>
            Remove
          </button>
          <details className="ai-placeid">
            <summary>Google Place ID{p.placeId ? " ✓" : ""}</summary>
            <input
              className="ai-input"
              placeholder="Optional, ChIJ…"
              aria-label={`Place ${i + 1} Place ID`}
              maxLength={200}
              value={p.placeId ?? ""}
              onChange={(e) => editPlace(i, { placeId: e.target.value })}
            />
          </details>
        </div>
      ))}
      {places.length < MAX_PLACES && (
        <button type="button" className="ai-chip" onClick={() => setPlaces((prev) => [...prev, { name: "" }])}>
          + Add place
        </button>
      )}
    </div>
  );
}

// What gets sent to the server: rows without a name dropped, fields trimmed.
export function cleanPlaces(places: Place[]): Place[] {
  return places
    .filter((p) => p.name.trim())
    .map((p) => ({
      name: p.name.trim(),
      ...(p.address?.trim() ? { address: p.address.trim() } : {}),
      ...(p.placeId?.trim() ? { placeId: p.placeId.trim() } : {}),
    }));
}
