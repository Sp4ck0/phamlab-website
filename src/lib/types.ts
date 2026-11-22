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

// One hop of a transport booking. depart/arrive are local wall-clock at
// from/to, "YYYY-MM-DDTHH:MM", or just the day "YYYY-MM-DD" while the time isn't
// known (see convex/travel/validators.ts). A hop that isn't planned yet is still
// a hop: an unset from/to is a place not decided, and `window` is "any day in
// this range".
export interface Segment {
  from?: string;
  to?: string;
  window?: { from: string; to: string };
  // This hop's own mode when a booking mixes them (a ferry then a flight);
  // absent means the booking's mode.
  mode?: TransportMode;
  depart?: string;
  arrive?: string;
  airline?: string;
  number?: string;
  carrier?: string;
  fromTerminal?: string;
  toTerminal?: string;
  aircraft?: string;
  cabin?: string;
  seat?: string; // "Coach 5 · 12A"; never exported
  durationMin?: number;
  note?: string;
}

export type TransportMode = "flight" | "train" | "bus" | "ferry";

export interface Flight {
  who: Who;
  route: string;
  // Absent means "flight" (rows predate this field).
  mode?: TransportMode;
  detail?: string;
  status: Status;
  // "Maybe": it may not be needed at all. Shown as Maybe, never a booking task.
  tentative?: boolean;
  // Rich multi-leg presentation — when `legs` is present the flight
  // renders as a flight-box; otherwise it falls back to a simple card.
  title?: string;
  price?: string;
  legs?: FlightLeg[];
  layovers?: string[];
  // Structured hops; when present they replace legs/layovers/detail on screen.
  segments?: Segment[];
  // Booking reference, shown behind a tap. Never part of the export.
  confirmation?: string;
  ticketUrl?: string; // an https link; shown as "Ticket", never exported
  fromItem?: string; // the action item it was approved from (its votes and earlier wording)
}

// A named place: pinned on the trip map (by placeId if set, else address) and
// linked to Google Maps.
export interface Place {
  name: string;
  address?: string;
  placeId?: string;
}

export interface HotelPrice {
  amount: number;
  currency: string;
  // Unset when the source doesn't say whether it is per night or for the stay.
  per?: "night" | "stay";
}

export interface Hotel extends Place {
  who: Who;
  status: Status;
  // "Maybe": it may not be needed at all. Shown as Maybe, never a booking task.
  tentative?: boolean;
  // What has no field of its own (phone, door code, cancellation terms).
  detail?: string;
  // Per-stay facts. They may sit on any entry of a stay; resolveDays fills them across it.
  checkInTime?: string; // local "HH:MM"
  checkOutTime?: string; // local "HH:MM"
  room?: string;
  price?: HotelPrice;
  // The last moment you can cancel for free, local to the hotel: "YYYY-MM-DDTHH:MM", or a day alone (end of that day).
  freeCancelUntil?: string;
  phone?: string; // for a Call link; never exported
  budget?: HotelPrice; // a target while the stay isn't booked yet
  confirmation?: string; // behind a tap; never exported
  area?: string; // where a not-yet-chosen hotel will be; the name stays as typed (it is the identity)
  fromItem?: string; // the action item it was approved from
}

export type Tag = "" | "move" | "transit" | "event" | undefined;

// An activity is either a plain string (legacy — no tag/time shown) or a
// richer object with an optional tag pill and time prefix.
// `endTime` (local HH:MM) is never displayed; it only sets the calendar link's end.
// `allDay`: takes the whole day, like a hotel (no times; All day at the top of the day).
export type Act = string | { tag?: string; time?: string; endTime?: string; allDay?: boolean; text: string; places?: Place[]; fromItem?: string };
/** A change to an activity's timing from the editor: each field undefined = unchanged, null = cleared. */
export type ActTiming = { time?: string | null; endTime?: string | null; allDay?: boolean };

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
  // Last day when the item covers a range starting at `date`.
  endDate?: string;
  who?: Who;
  // Absent = "custom" (a to-do). "consider" is a candidate the group is weighing.
  kind?: "custom" | "consider";
  // Absent = no priority (sorts like low). High items are listed at the top of the trip.
  priority?: Priority;
  // Where it is: a Maps link on the row, and a map pin for a consideration.
  places?: Place[];
  // Local "HH:MM" on its day: places it on that day's timeline (else it sits at the end).
  time?: string;
  // What it would add to the itinerary once approved (convex/travel/validators.ts).
  proposes?: Proposal;
}

// A draft entry an item proposes, in the shape the day stores it.
export type Proposal =
  | { type: "hotel"; entry: Hotel }
  | { type: "transport"; entry: Flight }
  | { type: "activity"; entry: Exclude<Act, string> };

// One row of the Action Items list, derived by the backend (convex/travel/tasks.ts).
// `kind` is why it exists, `scope` is when it applies.
// `details` is a booked transport tile that still lacks a required field.
export type TaskKind = "booking" | "plan" | "transport" | "details" | "deadline" | "consider" | "custom";
export type Priority = "high" | "medium" | "low";
export type Outcome = "chosen" | "dropped";
export type Vote = "yes" | "no";
export type TaskScope =
  | { kind: "trip" }
  | { kind: "day"; date: string }
  | { kind: "range"; start: string; end: string };

export interface Task {
  key: string;
  kind: TaskKind;
  // Booking only: what is being booked.
  mode?: "hotel" | "flight" | "train" | "bus" | "ferry";
  scope: TaskScope;
  who?: Who;
  title: string;
  detail?: string;
  // State keys toggled together; refsDone is each one's own done-state.
  refs: string[];
  refsDone: boolean[];
  done: boolean;
  dueDate: string | null;
  dueDateIsDefault: boolean;
  // Stored items (consider/custom) can be edited and removed.
  editable: boolean;
  // Stored items only.
  priority?: Priority;
  // Stored items: where it is. Consider only: how it was settled, and who voted which way.
  places?: Place[];
  outcome?: Outcome;
  votes?: { yes: string[]; no: string[]; mine: Vote | null };
  // Stored items only: a time of day and a draft entry (see ActionItem).
  time?: string;
  proposes?: Proposal;
}

export interface HighlightStat {
  value: string;
  label: string;
}

export type MapCategory = "hotel" | "restaurant" | "attraction" | "transport" | "event" | "city" | "other";

export interface MapPointData extends Place {
  id: string;
  category: MapCategory;
  note?: string;
  // The itinerary days (ISO dates) this place belongs to, so a pinned map can show one day.
  // None: not tied to a day (an action item for the whole trip).
  dates?: string[];
  // A place not in the plan yet (an action item's place or draft), drawn as a ghost pin:
  // open, or chosen (a picked consideration or a done to-do).
  candidate?: "open" | "chosen";
}

export interface Trip {
  _id: string;
  slug: string;
  title: string;
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
  segments?: Segment[];
}
export interface TripExportHotel {
  who: Who;
  tba: boolean;
  name?: string;
  address?: string;
  detail?: string;
  checkInTime?: string;
  checkOutTime?: string;
  room?: string;
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
  acts: { text: string; time?: string; allDay?: boolean; tag?: string }[];
  tourDetails?: { summary?: string; body?: string };
}
export interface TripExport {
  title: string;
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
