import type { Coords, LocationResult } from './types.ts';

// Nominatim requires max 1 request/second
let lastNominatimCall = 0;
async function nominatimThrottle(): Promise<void> {
  const now = Date.now();
  const wait = 1000 - (now - lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

export function getLocationFromBrowser(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

export async function geocodeAddress(query: string): Promise<LocationResult> {
  const results = await searchLocations(query, 1);
  if (!results.length) throw new Error('Location not found');
  return results[0];
}

export async function searchLocations(query: string, limit = 5): Promise<LocationResult[]> {
  await nominatimThrottle();
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'isitpintweather.com/1.0' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item: Record<string, unknown>) => {
    const addr = item.address as Record<string, string> | undefined;
    const parts: string[] = [];
    const placeName = (addr?.city || addr?.town || addr?.village || addr?.hamlet || (item.name as string) || '').trim();
    if (placeName) parts.push(placeName);
    const region = (addr?.state || addr?.county || addr?.country || '').trim();
    if (region && region !== placeName) parts.push(region);
    return {
      coords: { lat: parseFloat(item.lat as string), lon: parseFloat(item.lon as string) },
      name: parts.join(', ') || (item.display_name as string).split(',').slice(0, 2).join(','),
    };
  });
}

export async function reverseGeocode(coords: Coords): Promise<string> {
  await nominatimThrottle();
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'isitpintweather.com/1.0' },
  });
  if (!res.ok) return 'your location';
  const data = await res.json();
  const addr = data.address;
  return addr?.city || addr?.town || addr?.village || addr?.suburb || 'your location';
}
