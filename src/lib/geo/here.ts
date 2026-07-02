// ============================================================================
// HERE truck-routing client (plan-v2.md WS-V) — SCAFFOLD
//
// Key: VITE_HERE_API_KEY (.env.local; restrict by domain/app in HERE console).
// Quota: 30k req/mo free tier — CACHE results into SavedTrip; never refetch on
// render. Verify truck-stop / rest-area category IDs against current HERE docs
// during WS-V implementation.
// ============================================================================

import { SavedTrip, TripStop, TruckProfile } from '../../types';

const HERE_KEY = (import.meta as any).env?.VITE_HERE_API_KEY as string | undefined;

export const hereConfigured = () => !!HERE_KEY;

export interface GeocodeResult { lat: number; lng: number; label: string; }

/** Forward geocode (HERE Geocoding & Search v7). */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  if (!HERE_KEY) return [];
  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&in=countryCode:USA&apiKey=${HERE_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HERE geocode ${res.status}`);
  const json = await res.json();
  return (json.items ?? []).map((i: any) => ({
    lat: i.position.lat, lng: i.position.lng, label: i.title,
  }));
}

/**
 * Truck route (HERE Routing v8, transportMode=truck).
 * Applies TruckProfile restrictions (weight/height/length/width/axles) so the
 * route avoids low bridges, weight-limited and truck-restricted roads; HERE's
 * truck profile inherently avoids unsuitable curvy/steep segments and returns
 * `notices` for anything unavoidable.
 * WS-V: decode `polyline` via ./flexpolyline.ts, map summary/actions/notices
 * into the SavedTrip shape.
 */
export async function truckRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  profile: TruckProfile,
): Promise<Partial<SavedTrip>> {
  if (!HERE_KEY) throw new Error('HERE API key not configured');
  const p = new URLSearchParams({
    transportMode: 'truck',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    return: 'polyline,summary,actions,tolls',
    apiKey: HERE_KEY,
  });
  if (profile.grossWeightLb) p.set('truck[grossWeight]', String(Math.round(profile.grossWeightLb * 0.4536))); // kg
  if (profile.heightIn) p.set('truck[height]', String(Math.round(profile.heightIn * 2.54))); // cm
  if (profile.lengthIn) p.set('truck[length]', String(Math.round(profile.lengthIn * 2.54)));
  if (profile.widthIn) p.set('truck[width]', String(Math.round(profile.widthIn * 2.54)));
  if (profile.axleCount) p.set('truck[axleCount]', String(profile.axleCount));
  if (profile.trailerCount) p.set('truck[trailerCount]', String(profile.trailerCount));

  const res = await fetch(`https://router.hereapi.com/v8/routes?${p}`);
  if (!res.ok) throw new Error(`HERE route ${res.status}`);
  const json = await res.json();
  // WS-V TODO: decode flexible polyline, extract summary/actions/notices.
  void json;
  throw new Error('WS-V: truckRoute response mapping not implemented (scaffold)');
}

/** Truck stops + rest areas along the route corridor (HERE Discover/Browse).
 *  WS-V TODO: corridor search + distance-along-route sort. */
export async function findStopsAlongRoute(
  _polyline: [number, number][],
  _kinds: Array<TripStop['kind']> = ['truck_stop', 'rest_area'],
): Promise<TripStop[]> {
  throw new Error('WS-V: findStopsAlongRoute not implemented (scaffold)');
}

/** Google Maps navigation handoff URL (destination + up to 9 waypoints). */
export function navigationHandoffUrl(trip: SavedTrip): string {
  const d = trip.destination;
  const waypoints = trip.stops
    .filter(s => s.selected)
    .slice(0, 9)
    .map(s => `${s.lat},${s.lng}`)
    .join('|');
  const base = `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=driving`;
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
}
