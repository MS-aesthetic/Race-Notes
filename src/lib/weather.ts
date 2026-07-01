import { WeatherHistoryDay } from '../types';

// ─── Open-Meteo History API (keyless, rate-limited) ────────────────────────────
// Fetches daily weather for a date range at given coordinates.
// Archive API docs: https://open-meteo.com/en/docs/historical-weather-api

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
  wind_speed_10m_max?: number[];
  weather_code?: number[];
}

/** WMO weather code → human string */
function wmoToSummary(code: number): string {
  if (code <= 1) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Overcast';
}

/** Fetch 7-day weather history BEFORE a given race date. */
export async function fetchWeatherHistory(
  lat: number,
  lon: number,
  raceDate: string, // ISO yyyy-mm-dd
): Promise<WeatherHistoryDay[]> {
  const endDate = raceDate;
  const startDate = new Date(new Date(raceDate).getTime() - 7 * 86400000)
    .toISOString().slice(0, 10);

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: startDate,
      end_date: endDate,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'inch',
      wind_speed_unit: 'mph',
      timezone: 'auto',
    });

    const res = await fetch(`${ARCHIVE_URL}?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    const daily: OpenMeteoDaily = json.daily;
    if (!daily?.time) return [];

    return daily.time.map((date, i) => ({
      date,
      tempMaxF: daily.temperature_2m_max?.[i],
      tempMinF: daily.temperature_2m_min?.[i],
      precipIn: daily.precipitation_sum?.[i],
      windMph: daily.wind_speed_10m_max?.[i],
      code: daily.weather_code?.[i],
      summary: daily.weather_code?.[i] != null ? wmoToSummary(daily.weather_code[i]) : undefined,
    }));
  } catch {
    return [];
  }
}

/** Fetch a short forecast (3 days) from the race date onward. */
export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  raceDate: string,
): Promise<WeatherHistoryDay[]> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'inch',
      wind_speed_unit: 'mph',
      timezone: 'auto',
      forecast_days: '4',
      start_date: raceDate,
    });

    const res = await fetch(`${FORECAST_URL}?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    const daily: OpenMeteoDaily = json.daily;
    if (!daily?.time) return [];

    return daily.time.slice(0, 4).map((date, i) => ({
      date,
      tempMaxF: daily.temperature_2m_max?.[i],
      tempMinF: daily.temperature_2m_min?.[i],
      precipIn: daily.precipitation_sum?.[i],
      windMph: daily.wind_speed_10m_max?.[i],
      code: daily.weather_code?.[i],
      summary: daily.weather_code?.[i] != null ? wmoToSummary(daily.weather_code[i]) : undefined,
    }));
  } catch {
    return [];
  }
}
