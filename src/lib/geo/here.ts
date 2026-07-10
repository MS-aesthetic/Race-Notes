/**
 * HERE platform client — truck-aware routing, geocoding, and POI discovery.
 * Pure library (no UI, no storage). All functions throw only `HereError`.
 *
 * Key: VITE_HERE_API_KEY (.env.local; restrict by domain/app in HERE console).
 * Client-side by design. Free tier ~30k tx/mo, so callers should cache the
 * returned SavedTrip and avoid re-requesting (see `planTrip` + `skipPois`).
 */
import { DEFAULT_TRUCK_PROFILE, SavedTrip, TripStop, TruckProfile } from '../../types';
import { decode as decodeFlexPolyline } from './flexpolyline';

export type HereErrorCode =
  | 'missing_key'
  | 'offline'
  | 'quota_exceeded'
  | 'bad_request'
  | 'no_results'
  | 'api_error';

export class HereError extends Error {
  code: HereErrorCode;
  constructor(code: HereErrorCode, message: string) {
    super(message);
    this.name = 'HereError';
    this.code = code;
  }
}

export interface LatLng {
  lat: number;
  lng: number;
}
export interface GeoPoint extends LatLng {
  label: string;
}
export interface TollInfo {
  name?: string;
  amount?: number;
  currency?: string;
}
export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: [number, number][];
  notices: string[];
  tolls?: TollInfo[];
}

// ---------------------------------------------------------------------------
// Key + fetch plumbing
// ---------------------------------------------------------------------------

function getApiKey(): string | undefined {
  // Works under Vite (import.meta.env) and Node/tsx (process.env) for testing.
  const viteKey = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_HERE_API_KEY;
  const nodeKey = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process?.env
    ?.VITE_HERE_API_KEY;
  const key = (viteKey || nodeKey || '').trim();
  return key || undefined;
}

async function hereGet<T>(url: string): Promise<T> {
  const key = getApiKey();
  if (!key) throw new HereError('missing_key', 'VITE_HERE_API_KEY is not set.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new HereError('offline', 'Device is offline.');
  }

  const sep = url.includes('?') ? '&' : '?';
  let res: Response;
  try {
    res = await fetch(`${url}${sep}apiKey=${encodeURIComponent(key)}`);
  } catch (e) {
    throw new HereError('offline', `Network request failed: ${(e as Error).message}`);
  }

  if (res.status === 429) throw new HereError('quota_exceeded', 'HERE API quota exceeded (HTTP 429).');
  if (res.status === 400) {
    const detail = await safeErrorTitle(res);
    throw new HereError('bad_request', `HERE rejected the request: ${detail}`);
  }
  if (!res.ok) {
    const detail = await safeErrorTitle(res);
    throw new HereError('api_error', `HERE API error (HTTP ${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

async function safeErrorTitle(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { title?: string; cause?: string };
    return body.title || body.cause || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

interface HereGeocodeResponse {
  items?: Array<{ position?: LatLng; address?: { label?: string }; title?: string }>;
}

export async function geocode(query: string): Promise<GeoPoint> {
  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&limit=1`;
  const data = await hereGet<HereGeocodeResponse>(url);
  const hit = data.items?.[0];
  if (!hit || !hit.position) throw new HereError('no_results', `No geocoding match for "${query}".`);
  return {
    lat: hit.position.lat,
    lng: hit.position.lng,
    label: hit.address?.label || hit.title || query,
  };
}

// ---------------------------------------------------------------------------
// Truck routing (Routing v8)
// ---------------------------------------------------------------------------

/** Convert an imperial TruckProfile into HERE metric truck[...] query params. */
function truckParams(profile: TruckProfile): string {
  const p: string[] = [];
  const lbToKg = (lb: number) => Math.ceil(lb * 0.453592);
  const inToCm = (inches: number) => Math.ceil(inches * 2.54);
  if (profile.grossWeightLb) p.push(`truck[grossWeight]=${lbToKg(profile.grossWeightLb)}`);
  if (profile.heightIn) p.push(`truck[height]=${inToCm(profile.heightIn)}`);
  if (profile.lengthIn) p.push(`truck[length]=${inToCm(profile.lengthIn)}`);
  if (profile.widthIn) p.push(`truck[width]=${inToCm(profile.widthIn)}`);
  if (profile.axleCount) p.push(`truck[axleCount]=${profile.axleCount}`);
  return p.join('&');
}

interface HereRouteResponse {
  routes?: Array<{
    sections?: Array<{
      summary?: { length?: number; duration?: number };
      polyline?: string;
      notices?: Array<{ title?: string }>;
      tolls?: Array<{ fares?: Array<{ name?: string; price?: { value?: number; currency?: string } }> }>;
    }>;
  }>;
}

export async function truckRoute(
  origin: LatLng,
  dest: LatLng,
  profile: TruckProfile = DEFAULT_TRUCK_PROFILE,
): Promise<RouteResult> {
  const url =
    `https://router.hereapi.com/v8/routes?transportMode=truck` +
    `&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}` +
    `&return=polyline,summary,actions,tolls&avoid[features]=ferry&${truckParams(profile)}`;

  const data = await hereGet<HereRouteResponse>(url);
  const sections = data.routes?.[0]?.sections;
  if (!sections || sections.length === 0) {
    throw new HereError('no_results', 'HERE returned no truck route for these points.');
  }

  let distanceMeters = 0;
  let durationSeconds = 0;
  const polyline: [number, number][] = [];
  const notices: string[] = [];
  const tolls: TollInfo[] = [];

  for (const section of sections) {
    distanceMeters += section.summary?.length ?? 0;
    durationSeconds += section.summary?.duration ?? 0;
    if (section.polyline) polyline.push(...decodeFlexPolyline(section.polyline));
    for (const n of section.notices ?? []) if (n.title) notices.push(n.title);
    for (const t of section.tolls ?? [])
      for (const f of t.fares ?? [])
        tolls.push({ name: f.name, amount: f.price?.value, currency: f.price?.currency });
  }

  return {
    distanceMeters,
    durationSeconds,
    polyline,
    notices,
    tolls: tolls.length ? tolls : undefined,
  };
}

// ---------------------------------------------------------------------------
// POI discovery along the route corridor
// ---------------------------------------------------------------------------

interface HereDiscoverResponse {
  items?: Array<{ id?: string; title?: string; position?: LatLng }>;
}

/**
 * Sample the route roughly every `stepMeters` and run a HERE Discover text
 * search at each sample point. We use Discover (`q=`) rather than raw category
 * IDs: text search is resilient to HERE Places taxonomy changes and easy to
 * verify. (Category-ID browse can be swapped in later if finer control is
 * needed.) Sampling is capped to protect the 30k-tx/mo quota.
 */
async function discoverAlongRoute(
  polyline: [number, number][],
  query: string,
  kind: TripStop['kind'],
  stepMeters = 50000,
  maxSamples = 12,
): Promise<TripStop[]> {
  if (polyline.length === 0) return [];

  // Build sample points + their cumulative distance-along-route.
  const samples: Array<{ point: LatLng; distAlong: number }> = [];
  let cumulative = 0;
  let sinceLast = Infinity; // force-include the first point
  for (let i = 0; i < polyline.length; i++) {
    const point = { lat: polyline[i][0], lng: polyline[i][1] };
    if (i > 0) {
      const seg = haversineMeters({ lat: polyline[i - 1][0], lng: polyline[i - 1][1] }, point);
      cumulative += seg;
      sinceLast += seg;
    }
    if (sinceLast >= stepMeters && samples.length < maxSamples) {
      samples.push({ point, distAlong: cumulative });
      sinceLast = 0;
    }
  }

  const byId = new Map<string, TripStop>();
  for (const s of samples) {
    const url =
      `https://discover.search.hereapi.com/v1/discover?at=${s.point.lat},${s.point.lng}` +
      `&q=${encodeURIComponent(query)}&limit=10`;
    let data: HereDiscoverResponse;
    try {
      data = await hereGet<HereDiscoverResponse>(url);
    } catch (e) {
      if (e instanceof HereError && e.code === 'quota_exceeded') throw e;
      continue; // a single failed sample shouldn't sink the whole search
    }
    for (const item of data.items ?? []) {
      if (!item.id || !item.position || byId.has(item.id)) continue;
      byId.set(item.id, {
        id: item.id,
        kind,
        name: item.title || query,
        lat: item.position.lat,
        lng: item.position.lng,
        distAlongRouteM: Math.round(s.distAlong),
      });
    }
  }

  return [...byId.values()].sort((a, b) => (a.distAlongRouteM ?? 0) - (b.distAlongRouteM ?? 0));
}

export function findTruckStops(polyline: [number, number][]): Promise<TripStop[]> {
  return discoverAlongRoute(polyline, 'truck stop', 'truck_stop');
}

export function findRestAreas(polyline: [number, number][]): Promise<TripStop[]> {
  return discoverAlongRoute(polyline, 'rest area', 'rest_area');
}

// ---------------------------------------------------------------------------
// Composed trip planner (returns a cache-shaped SavedTrip; does NOT persist)
// ---------------------------------------------------------------------------

export interface PlanTripOptions {
  skipPois?: boolean;
  weekendId?: string;
  weekendName?: string;
}

export async function planTrip(
  originQuery: string,
  destQuery: string,
  profile: TruckProfile = DEFAULT_TRUCK_PROFILE,
  opts: PlanTripOptions = {},
): Promise<SavedTrip> {
  const [origin, destination] = await Promise.all([geocode(originQuery), geocode(destQuery)]);
  const route = await truckRoute(origin, destination, profile);

  let stops: TripStop[] = [];
  if (!opts.skipPois) {
    const [truckStops, restAreas] = await Promise.all([
      findTruckStops(route.polyline),
      findRestAreas(route.polyline),
    ]);
    stops = [...truckStops, ...restAreas].sort(
      (a, b) => (a.distAlongRouteM ?? 0) - (b.distAlongRouteM ?? 0),
    );
  }

  const now = new Date().toISOString();
  return {
    id: `trip-${Date.now()}`,
    weekendId: opts.weekendId,
    weekendName: opts.weekendName,
    origin,
    destination,
    polyline: route.polyline,
    distanceM: route.distanceMeters,
    durationS: route.durationSeconds,
    notices: route.notices,
    stops,
    createdAt: now,
    updatedAt: now,
  };
}
