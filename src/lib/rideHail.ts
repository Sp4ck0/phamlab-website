// Grab and Uber links for a place (and DiDi, which has none), and which of them exist where the traveller is.

export type RideApp = "grab" | "uber" | "didi";

// Where each app takes bookings, as ISO country codes. Add a code here when the app launches
// somewhere; leave a country out when unsure, since a button for an app that isn't there is worse
// than no button. This is the only place the countries are listed.
export const RIDE_APPS: Record<RideApp, { label: string; countries: ReadonlySet<string> }> = {
  grab: { label: "Grab", countries: new Set(["SG", "MY", "TH", "VN", "ID", "PH", "KH", "MM"]) },
  // DiDi has no public link that takes a destination, so it is a copy-the-name-and-open item (see DayCard).
  didi: { label: "DiDi", countries: new Set(["CN"]) },
  uber: {
    label: "Uber",
    countries: new Set([
      "US", "CA", "MX", "GB", "IE", "FR", "BE", "NL", "DE", "AT", "CH", "CZ", "SK", "PL", "PT", "ES", "IT", "GR", "HR",
      "NO", "SE", "JP", "TW", "HK", "KR", "AU", "NZ", "TR", "JO", "EG", "AE",
    ]),
  },
};

/** The apps that work in any of these countries (a travel day passes both its countries), Grab first. */
export function rideAppsFor(countries: (string | undefined)[]): RideApp[] {
  const codes = countries.filter((c): c is string => !!c).map((c) => c.toUpperCase());
  return (Object.keys(RIDE_APPS) as RideApp[]).filter((app) => codes.some((c) => RIDE_APPS[app].countries.has(c)));
}

export interface RideTarget {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

/** Opens the Grab app on its booking screen with this drop-off; pickup is left empty, so it is where you are. */
export function grabUrl({ lat, lng, name }: RideTarget): string {
  const q = new URLSearchParams({
    screenType: "BOOKING",
    dropOffLatitude: String(lat),
    dropOffLongitude: String(lng),
    dropOffKeywords: name,
  });
  return `grab://open?${q.toString().replace(/\+/g, "%20")}`;
}

/** Uber's universal link: opens the app on a phone, Uber's booking page on a computer. Pickup is where you are. */
export function uberUrl({ lat, lng, name, address }: RideTarget): string {
  const q = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[latitude]": String(lat),
    "dropoff[longitude]": String(lng),
    "dropoff[nickname]": name,
  });
  if (address) q.set("dropoff[formatted_address]", address);
  return `https://m.uber.com/ul/?${q.toString().replace(/\+/g, "%20")}`;
}

export const rideUrl = (app: Exclude<RideApp, "didi">, t: RideTarget): string => (app === "grab" ? grabUrl(t) : uberUrl(t));
