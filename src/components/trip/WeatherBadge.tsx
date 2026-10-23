import { weatherIcon, weatherText, weatherTitle } from "../../lib/weather";
import type { DayWeather } from "../../lib/weather";

export function WeatherBadge({ weather }: { weather?: DayWeather }) {
  if (!weather) return null;
  return (
    <span className={`weather-badge weather-${weather.kind}`} title={weatherTitle(weather)}>
      <span aria-hidden="true">{weatherIcon(weather.code).emoji}</span> {weatherText(weather)}
    </span>
  );
}
