const i285 = require('../data/i285.json');

function pointInPolygon(lng, lat, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function insideI285(lat, lng) {
  return pointInPolygon(lng, lat, i285.polygon);
}

async function geocodeAddress(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'MikesBikesTransport/1.0 (contact: admin@mikesbikes.local)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error('Geocoding failed');
  }
  const data = await res.json();
  if (!data.length) {
    throw new Error(`No location found for: ${query}`);
  }
  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    displayName: data[0].display_name,
  };
}

function haversineMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const ROAD_FACTOR = 13 / 10;

async function drivingMiles(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('OSRM error');
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (!meters) throw new Error('No route');
    return meters / 1609.344;
  } catch {
    return haversineMiles(from, to) * ROAD_FACTOR;
  }
}

async function resolveTrip(pickupAddress, dropoffAddress) {
  const pickup = await geocodeAddress(pickupAddress);
  await new Promise((r) => setTimeout(r, 1100));
  const dropoff = await geocodeAddress(dropoffAddress);
  const miles = await drivingMiles(pickup, dropoff);
  const i285Hit =
    insideI285(pickup.lat, pickup.lng) && insideI285(dropoff.lat, dropoff.lng);
  return {
    pickup,
    dropoff,
    miles: Math.max(1, Math.round(miles * 10) / 10),
    insideI285: i285Hit,
  };
}

module.exports = { geocodeAddress, drivingMiles, insideI285, resolveTrip };
