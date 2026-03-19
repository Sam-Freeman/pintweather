import type { Coords, Pub } from './types.ts';

function haversineDistance(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Single query: fetch all pubs within radius, let the tags tell us what's what
function buildPubQuery(coords: Coords, radiusMeters: number): string {
  const { lat, lon } = coords;
  return `[out:json][timeout:25];(
    node["amenity"="pub"](around:${radiusMeters},${lat},${lon});
    way["amenity"="pub"](around:${radiusMeters},${lat},${lon});
  );out center;`;
}

export interface PubResult {
  pubs: Pub[];
  isFallback: boolean;
}

export async function fetchNearbyPubs(coords: Coords): Promise<PubResult> {
  const allPubs = await queryOverpass(coords, buildPubQuery(coords, 5000));

  // Separate beer gardens from regular pubs
  const gardenPubs = allPubs.filter((p) => p.hasBeerGarden || p.hasOutdoorSeating);
  const regularPubs = allPubs.filter((p) => !p.hasBeerGarden && !p.hasOutdoorSeating);

  if (gardenPubs.length >= 3) {
    return { pubs: gardenPubs.slice(0, 5), isFallback: false };
  }

  // Not enough beer gardens — fill with regular pubs
  if (allPubs.length > 0) {
    // Show gardens first, then regular pubs
    const combined = [...gardenPubs, ...regularPubs].slice(0, 5);
    return { pubs: combined, isFallback: gardenPubs.length === 0 };
  }

  return { pubs: [], isFallback: false };
}

async function queryOverpass(coords: Coords, query: string, retries = 2): Promise<Pub[]> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if ((res.status === 429 || res.status === 504) && retries > 0) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '', 10);
    const delay = (Number.isFinite(retryAfter) ? retryAfter : 5) * 1000;
    await new Promise((r) => setTimeout(r, delay));
    return queryOverpass(coords, query, retries - 1);
  }
  if (!res.ok) throw new Error('Pub search failed');
  const data = await res.json();

  const seen = new Set<string>();
  const pubs: Pub[] = [];

  for (const el of data.elements) {
    const name = el.tags?.name;
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;

    const distance = haversineDistance(coords, { lat, lon });
    pubs.push({
      name,
      lat,
      lon,
      distance,
      hasBeerGarden: el.tags?.beer_garden === 'yes',
      hasOutdoorSeating: el.tags?.outdoor_seating === 'yes',
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
  }

  pubs.sort((a, b) => a.distance - b.distance);
  return pubs;
}
