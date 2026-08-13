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

export interface Flight {
  who: Who;
  route: string;
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
}

export type Tag = "" | "move" | "transit" | "event" | undefined;

// An activity is either a plain string (legacy — no tag/time shown) or a
// richer object with an optional tag pill and time prefix.
export type Act = string | { tag?: string; time?: string; text: string };

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
}

// A day after `hotels:'same'` carry-forward has been resolved and every
// flight/hotel has been assigned a stable tick id.
export interface ResolvedHotel extends Hotel {
  src: string;
  carried?: boolean;
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
