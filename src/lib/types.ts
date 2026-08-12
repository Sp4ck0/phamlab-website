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

export interface Flight {
  who: Who;
  route: string;
  detail?: string;
  status: Status;
}

export interface Hotel {
  who: Who;
  name: string;
  address?: string;
  status: Status;
}

export type Tag = "" | "move" | "transit" | "event" | undefined;

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
  acts: string[];
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
