export type Who = string | string[];

export interface Group {
  id: string;
  name: string;
  members: number;
  color: string;
  rooms?: number;
  from?: string;
  to?: string;
  note?: string;
}

export interface Conflict {
  who: Who;
  text: string;
}

export type Status = "booked" | "needed";

export interface FlightLeg {
  route: string;
  time: string;
  meta?: string;
}

export type TransportMode = "flight" | "train" | "bus" | "ferry";

export interface Flight {
  who: Who;
  route: string;
  // Absent means "flight" (rows predate this field).
  mode?: TransportMode;
  detail?: string;
  status: Status;
  // Rich multi-leg presentation — when `legs` is present the flight
  // renders as a flight-box; otherwise it falls back to a simple card.
  title?: string;
  price?: string;
  legs?: FlightLeg[];
  layovers?: string[];
}

export interface Hotel {
  who: Who;
  name: string;
  address?: string;
  status: Status;
  detail?: string;
}

export type Tag = "" | "move" | "transit" | "event" | undefined;

// An activity is either a plain string (legacy — no tag/time shown) or a
// richer object with an optional tag pill and time prefix.
// `endTime` (local HH:MM) is never displayed; it only sets the calendar link's end.
export type Act = string | { tag?: string; time?: string; endTime?: string; text: string };

export interface TourDetails {
  summary: string;
  body: string;
}

export interface Day {
  date: string;
  city: string;
  country: string;
  to?: string;
  toCountry?: string;
  tag?: Tag;
  event?: string;
  note?: string;
  flights: Flight[];
  hotels: "same" | Hotel[];
  acts: Act[];
  highlight?: string;
  callout?: string;
  tourDetails?: TourDetails;
}

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  date?: string;
  who?: Who;
}

export interface HighlightStat {
  value: string;
  label: string;
}

export type MapCategory = "hotel" | "restaurant" | "attraction" | "transport" | "city" | "other";

export interface MapPointData {
  id: string;
  label: string;
  address: string;
  category: MapCategory;
  note?: string;
}

export interface Trip {
  _id: string;
  slug: string;
  title: string;
  titleEmphasis: string;
  kicker: string;
  dateRangeLabel: string;
  citiesLabel: string;
  navIcon: string;
  sdek?: string;
  groups: Group[];
  conflicts: Conflict[];
  days: Day[];
  actionItems?: ActionItem[];
  highlightStat?: HighlightStat;
  mapPoints?: MapPointData[];
}

export interface TripSummary {
  _id: string;
  slug: string;
  title: string;
  navIcon: string;
  start?: string;
  end?: string;
  countries: string[];
}

// Sanitized, shareable projection returned by trips.getTripExport — no
// ids, prices, statuses, conflicts, or action items. `tba` marks a booking
// that isn't confirmed yet (only who/route or who is sent in that case).
export interface TripExportFlight {
  who: Who;
  route: string;
  tba: boolean;
  title?: string;
  detail?: string;
  layovers?: string[];
  legs?: { route: string; time: string; meta?: string }[];
}
export interface TripExportHotel {
  who: Who;
  tba: boolean;
  name?: string;
  address?: string;
  detail?: string;
}
export interface TripExportDay {
  date: string;
  city: string;
  country: string;
  to?: string;
  toCountry?: string;
  event?: string;
  highlight?: string;
  flights: TripExportFlight[];
  hotels: "same" | TripExportHotel[];
  acts: { text: string; time?: string; tag?: string }[];
  tourDetails?: { summary?: string; body?: string };
}
export interface TripExport {
  title: string;
  titleEmphasis: string;
  kicker: string;
  dateRangeLabel: string;
  citiesLabel: string;
  sdek?: string;
  groups: { id: string; name: string; color: string; from?: string; to?: string }[];
  days: TripExportDay[];
}

// A day after `hotels:'same'` carry-forward has been resolved and every
// flight/hotel has been assigned a stable tick id.
export interface ResolvedHotel extends Hotel {
  src: string;
  carried?: boolean;
  // Whether this day is the first/last day this hotel name appears on
  // (adjacent-day check, independent of `carried`) — drives the
  // "Hotel · check-in" / "Hotel · staying" / "Hotel · check-out" tag.
  checkIn?: boolean;
  checkOut?: boolean;
}
export interface ResolvedDay extends Omit<Day, "hotels"> {
  hotels: ResolvedHotel[];
  _d: Date;
}

// A leg-color assignment computed for a day (see assignLegColors).
export interface LegColor {
  color: string;
  tint: string;
  label: string;
}
