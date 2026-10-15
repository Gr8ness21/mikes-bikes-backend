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

let nominatimQueue = Promise.resolve();

function enqueueNominatim(work) {
  const run = nominatimQueue.then(work, work);
  nominatimQueue = run
    .then(() => new Promise((resolve) => setTimeout(resolve, 1100)))
    .catch(() => undefined);
  return run;
}

const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS',
  Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA',
  Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT',
  Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX',
  Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
  Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
};

const NOMINATIM_HEADERS = {
  'User-Agent': 'MikesBikesTransport/1.0 (contact: admin@mikesbikes.local)',
  Accept: 'application/json',
};

const PREFERRED_TYPES = new Set([
  'city',
  'town',
  'suburb',
  'neighbourhood',
  'village',
  'hamlet',
  'residential',
  'building',
  'house',
  'road',
]);

function parseNominatimHit(hit) {
  const a = hit.address || {};
  const street = [a.house_number, a.road || a.pedestrian || a.residential]
    .filter(Boolean)
    .join(' ');
  const city = a.city || a.town || a.village || a.suburb || a.hamlet || a.county || '';
  const stateName = a.state || '';
  const state = STATE_ABBR[stateName] || (stateName.length === 2 ? stateName.toUpperCase() : '');
  const zip = (a.postcode || '').split('-')[0];
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon ?? hit.lng),
    displayName: hit.display_name,
    street,
    city,
    state,
    zip,
  };
}

const STATE_NAME = Object.fromEntries(
  Object.entries(STATE_ABBR).map(([name, abbr]) => [abbr, name])
);

function stripUnit(street) {
  return String(street || '')
    .replace(/[#].*$/, '')
    .replace(/\b(apt|apartment|unit|suite|ste|bldg|building)\.?\s*[a-z0-9-]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function expandStreet(street) {
  let value = stripUnit(street);
  const replacements = [
    [/\bAve\.?\b/gi, 'Avenue'],
    [/\bBlvd\.?\b/gi, 'Boulevard'],
    [/\bDr\.?\b/gi, 'Drive'],
    [/\bRd\.?\b/gi, 'Road'],
    [/\bLn\.?\b/gi, 'Lane'],
    [/\bCt\.?\b/gi, 'Court'],
    [/\bCir\.?\b/gi, 'Circle'],
    [/\bTer\.?\b/gi, 'Terrace'],
    [/\bPkwy\.?\b/gi, 'Parkway'],
    [/\bHwy\.?\b/gi, 'Highway'],
    [/\bPl\.?\b/gi, 'Place'],
    [/\bTrl\.?\b/gi, 'Trail'],
    [/\bExpy\.?\b/gi, 'Expressway'],
    [/\bSt\.?(?=\s+(?:NE|NW|SE|SW|N|S|E|W)\b|,|$)/gi, 'Street'],
  ];
  for (const [pattern, label] of replacements) {
    value = value.replace(pattern, label);
  }
  return value.trim();
}

async function nominatimRequest(params) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '8');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('dedupe', '1');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) {
    throw new Error('Geocoding failed');
  }
  return res.json();
}

function pickBest(hits, wantStreet = false) {
  const ranked = [...hits].sort((a, b) => Number(b.place_rank) - Number(a.place_rank));
  if (wantStreet) {
    const streetHit = ranked.find((place) =>
      ['house', 'building', 'residential', 'road'].includes(place.addresstype)
    );
    if (streetHit) return streetHit;
  }
  return ranked.find((place) => PREFERRED_TYPES.has(place.addresstype)) || ranked[0];
}

function uniqueHits(groups) {
  const seen = new Set();
  const out = [];
  for (const hit of groups) {
    const key = String(hit.place_id || `${hit.lat},${hit.lon}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function fingerprint(params) {
  return JSON.stringify(params);
}

async function searchWithFallbacks(attempts) {
  const tried = [];
  for (const params of attempts) {
    const key = fingerprint(params);
    if (!Object.values(params).some(Boolean) || tried.includes(key)) continue;
    tried.push(key);
    const hits = await nominatimRequest(params);
    if (hits.length) {
      return { params, hits: uniqueHits(hits) };
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  return { params: attempts[0] || {}, hits: [] };
}

async function findPlaces({ street = '', city = '', state = '', zip = '', query = '' } = {}) {
  return enqueueNominatim(async () => {
    const cleanStreet = expandStreet(street);
    const stateName = STATE_NAME[String(state).toUpperCase()] || state;
    const full = query || [cleanStreet || street, city, state, zip].map((p) => String(p).trim()).filter(Boolean).join(', ');
    const attempts = query
      ? [
          { q: query },
          { q: expandStreet(query) },
          { q: query.split(',').slice(-2).join(',').trim() },
        ]
      : [
          { street: cleanStreet, city, state, postalcode: zip, country: 'USA' },
          { street: cleanStreet, city, state, country: 'USA' },
          { street: stripUnit(street), city, state: stateName, postalcode: zip, country: 'USA' },
          { q: full },
          { q: [cleanStreet, city, stateName, zip].filter(Boolean).join(', ') },
          { q: [cleanStreet, city, state].filter(Boolean).join(', ') },
          { q: [city, state, zip].filter(Boolean).join(', ') },
        ];

    const { params: used, hits } = await searchWithFallbacks(attempts);

    if (!hits.length) {
      return {
        place: null,
        suggestions: [],
        message: `No location found for: ${full}`,
      };
    }

    const parsed = hits.map(parseNominatimHit);
    const best = parseNominatimHit(pickBest(hits, Boolean(cleanStreet)));
    const suggestions = parsed.filter((item) => item.displayName !== best.displayName).slice(0, 5);
    const usedStructured = Boolean(used.street || used.city);
    const approx = !usedStructured && used.q && used.q !== full;

    return {
      place: best,
      suggestions,
      message: approx ? `Closest match for "${full}"` : null,
    };
  });
}

async function geocodeAddress(query) {
  const result = await findPlaces({ query });
  if (!result.place) {
    const hint = result.suggestions[0]?.displayName;
    const err = new Error(
      hint ? `${result.message} Did you mean ${hint}?` : result.message || `No location found for: ${query}`
    );
    err.suggestions = result.suggestions;
    throw err;
  }
  return result.place;
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

async function drivingRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('OSRM error');
    const data = await res.json();
    const route = data?.routes?.[0];
    const meters = route?.distance;
    if (!meters) throw new Error('No route');
    const path = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    return {
      miles: meters / 1609.344,
      path,
    };
  } catch {
    return {
      miles: haversineMiles(from, to) * ROAD_FACTOR,
      path: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
    };
  }
}

async function reverseGeocode(lat, lng) {
  return enqueueNominatim(async () => {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MikesBikesTransport/1.0 (contact: admin@mikesbikes.local)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error('Could not read that GPS location');
    }
    const data = await res.json();
    const a = data.address || {};
    const street = [a.house_number, a.road || a.pedestrian || a.residential].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || a.suburb || a.hamlet || a.county || '';
    const stateName = a.state || '';
    const state = STATE_ABBR[stateName] || (stateName.length === 2 ? stateName.toUpperCase() : '');
    const zip = (a.postcode || '').split('-')[0];
    return {
      lat: Number(lat),
      lng: Number(lng),
      displayName: data.display_name,
      street,
      city,
      state,
      zip,
    };
  });
}

async function drivingMiles(from, to) {
  const route = await drivingRoute(from, to);
  return route.miles;
}

async function resolveTrip(pickupAddress, dropoffAddress) {
  const pickup = await geocodeAddress(pickupAddress);
  const dropoff = await geocodeAddress(dropoffAddress);
  const route = await drivingRoute(pickup, dropoff);
  const i285Hit =
    insideI285(pickup.lat, pickup.lng) && insideI285(dropoff.lat, dropoff.lng);
  return {
    pickup,
    dropoff,
    path: route.path,
    miles: Math.max(1, Math.round(route.miles * 10) / 10),
    insideI285: i285Hit,
  };
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  findPlaces,
  drivingMiles,
  drivingRoute,
  insideI285,
  resolveTrip,
};
