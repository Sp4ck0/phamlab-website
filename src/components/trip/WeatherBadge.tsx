import { temp, weatherIcon, weatherText, weatherTitle } from "../../lib/weather";
import type { DayWeather } from "../../lib/weather";
import { useSettings } from "../../hooks/useSettings";

export function WeatherBadge({ weather }: { weather?: DayWeather }) {
  const { tempUnit } = useSettings();
  if (!weather) return null;
  return (
    <span className={`weather-badge weather-${weather.kind}`} title={weatherTitle(weather)}>
      <span aria-hidden="true">{weatherIcon(weather.code).emoji}</span> {weatherText(weather, tempUnit)}
    </span>
  );
}

// The day header's weather: a big icon, the high and low, and what it means ("Partly cloudy ·
// 29% rain"). A historical average is marked as typical and shown muted.
export function WeatherBlock({ weather }: { weather?: DayWeather }) {
  const { tempUnit } = useSettings();
  if (!weather) return null;
  const { emoji, label } = weatherIcon(weather.code);
  const rain = weather.kind === "forecast" && weather.precipProb != null ? ` · ${weather.precipProb}% rain` : "";
  return (
    <span className={`weather-block weather-${weather.kind}`} title={weatherTitle(weather)}>
      <span className="weather-block-icon" aria-hidden="true">{emoji}</span>
      <span className="weather-block-temps">{temp(weather.tMax, tempUnit)}° / {temp(weather.tMin, tempUnit)}°</span>
      <span className="weather-block-label">{weather.kind === "typical" ? "Typical" : label}{rain}</span>
    </span>
  );
}
