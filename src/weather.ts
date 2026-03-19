import type { Coords, WeatherData, PintVerdict } from './types.ts';

export async function fetchWeather(coords: Coords): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,rain,cloud_cover,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const c = data.current;
  return {
    temperature: c.temperature_2m,
    apparentTemperature: c.apparent_temperature,
    windSpeed: c.wind_speed_10m,
    rain: c.rain,
    cloudCover: c.cloud_cover,
    weatherCode: c.weather_code,
  };
}

// WMO codes that are dealbreakers
const SEVERE_CODES = new Set([
  65, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
]);
const LIGHT_RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63]);

export function calculatePintScore(w: WeatherData): PintVerdict {
  let score = 50; // start neutral

  // Temperature scoring
  if (w.apparentTemperature >= 14 && w.apparentTemperature <= 22) {
    score += 25;
  } else if (w.apparentTemperature >= 22 && w.apparentTemperature <= 28) {
    score += 15;
  } else if (w.apparentTemperature >= 10 && w.apparentTemperature < 14) {
    score += 5;
  } else if (w.apparentTemperature >= 28) {
    score += 5;
  } else if (w.apparentTemperature < 8) {
    score -= 40;
  } else {
    // 8-10
    score -= 10;
  }

  // Rain scoring
  if (w.rain > 2) {
    score -= 50;
  } else if (w.rain > 0.5) {
    score -= 25;
  } else if (w.rain > 0) {
    score -= 10;
  } else {
    score += 15;
  }

  // Wind scoring
  if (w.windSpeed > 40) {
    score -= 30;
  } else if (w.windSpeed > 25) {
    score -= 15;
  } else if (w.windSpeed > 15) {
    score -= 5;
  } else {
    score += 5;
  }

  // Cloud cover
  if (w.cloudCover < 30) {
    score += 10;
  } else if (w.cloudCover < 60) {
    score += 5;
  }

  // WMO severe weather codes
  if (SEVERE_CODES.has(w.weatherCode)) {
    score -= 40;
  } else if (LIGHT_RAIN_CODES.has(w.weatherCode)) {
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  const isPintWeather = score >= 50;
  let verdict: string;
  let subtitle: string;

  if (score >= 80) {
    verdict = 'YES';
    subtitle = 'Get out there. Now.';
  } else if (score >= 60) {
    verdict = 'YES';
    subtitle = "It's pint weather.";
  } else if (score >= 50) {
    verdict = 'YES';
    subtitle = '...yeah, go on then.';
  } else if (score >= 35) {
    verdict = 'NO';
    subtitle = 'Maybe wait a bit.';
  } else if (score >= 20) {
    verdict = 'NO';
    subtitle = 'Stay in. Have one at home.';
  } else {
    verdict = 'NO';
    subtitle = 'Absolutely not.';
  }

  return { score, isPintWeather, verdict, subtitle };
}
