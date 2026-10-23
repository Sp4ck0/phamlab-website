export interface DayWeather {
  date: string;
  kind: "forecast" | "typical" | "actual";
  code: number;
  tMax: number;
  tMin: number;
  precipProb?: number;
  fetchedAt: number;
}

// WMO weather code -> emoji + label (https://open-meteo.com/en/docs).
export function weatherIcon(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Clear" };
  if (code === 1) return { emoji: "🌤️", label: "Mostly clear" };
  if (code === 2) return { emoji: "⛅", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Overcast" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: "🌧️", label: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { emoji: "❄️", label: "Snow" };
  if (code >= 95) return { emoji: "⛈️", label: "Thunderstorm" };
  return { emoji: "⛅", label: "Mixed" };
}

// Stored in °C; flip to "F" to display Fahrenheit.
const UNIT = "C" as "C" | "F";
export const temp = (c: number) => Math.round(UNIT === "F" ? (c * 9) / 5 + 32 : c);

export function weatherText(w: DayWeather): string {
  const range = `${temp(w.tMax)}°/${temp(w.tMin)}°`;
  if (w.kind === "forecast" && w.precipProb != null) return `${range} · ${w.precipProb}% rain`;
  if (w.kind === "typical") return `${range} · typical`;
  return range;
}

export function weatherTitle(w: DayWeather): string {
  const { label } = weatherIcon(w.code);
  if (w.kind === "typical")
    return `${label} · Historical average for this date, not a forecast. A real forecast appears ~16 days before.`;
  if (w.kind === "actual") return `${label} · Recorded weather`;
  const mins = Math.max(0, Math.round((Date.now() - w.fetchedAt) / 60000));
  const ago = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
  return `${label} · Forecast · updated ${ago}`;
}
