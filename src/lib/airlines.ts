import type { FlightLeg } from "./types";

// Known airlines by 2-letter IATA code. Only the name (alt/tooltip text) and an
// optional `logo` override live here: a code missing from this list still gets
// a logo from the URL template below. Add a `logo` only if the default looks bad.
export const AIRLINES: Record<string, { name: string; logo?: string }> = {
  UA: { name: "United" },
  AA: { name: "American" },
  DL: { name: "Delta" },
  AS: { name: "Alaska" },
  B6: { name: "JetBlue" },
  WN: { name: "Southwest" },
  AC: { name: "Air Canada" },
  JL: { name: "Japan Airlines" },
  NH: { name: "ANA" },
  VN: { name: "Vietnam Airlines" },
  VJ: { name: "VietJet" },
  QH: { name: "Bamboo Airways" },
  CX: { name: "Cathay Pacific" },
  SQ: { name: "Singapore Airlines" },
  BR: { name: "EVA Air" },
  CI: { name: "China Airlines" },
  KE: { name: "Korean Air" },
  OZ: { name: "Asiana" },
  TG: { name: "Thai Airways" },
  EK: { name: "Emirates" },
  QR: { name: "Qatar Airways" },
  BA: { name: "British Airways" },
  AF: { name: "Air France" },
  LH: { name: "Lufthansa" },
  KL: { name: "KLM" },
};

// Google Flights' logo CDN: keyed by IATA code, no API key. Unofficial, so the
// image is hidden if it fails to load (see FlightBox) rather than shown broken.
export function airlineLogoUrl(code: string): string {
  return AIRLINES[code]?.logo ?? `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`;
}

// A leg's airline: its `airline` code, else the carrier prefix of a flight
// number in `meta` ("UA 837 · 787-9") so legs written before the field existed
// still get a logo. Requires a letter, so "12 345" is not read as a code.
export function legAirline(leg: Pick<FlightLeg, "airline" | "meta">): string | undefined {
  const given = leg.airline?.trim().toUpperCase();
  if (given) return given;
  return leg.meta?.match(/^([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?\d{1,4}\b/)?.[1];
}
