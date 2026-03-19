export interface Coords {
  lat: number;
  lon: number;
}

export interface LocationResult {
  coords: Coords;
  name: string;
}

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  windSpeed: number;
  rain: number;
  cloudCover: number;
  weatherCode: number;
}

export interface PintVerdict {
  score: number;
  isPintWeather: boolean;
  verdict: string;
  subtitle: string;
}

export interface Pub {
  name: string;
  lat: number;
  lon: number;
  distance: number;
  hasBeerGarden: boolean;
  hasOutdoorSeating: boolean;
  directionsUrl: string;
}
