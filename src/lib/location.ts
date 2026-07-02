// ============================================================================
// Team location sharing (plan-v2.md WS-T) — SCAFFOLD
//
// Foreground-only in v1 (app open). Opt-in state is DEVICE-LOCAL
// (localStorage race_notes_location_optin — never synced, like active car).
// Live rows go straight to `team_locations` (Realtime), NOT the sync loop.
// Privacy rules (non-negotiable): opt-in, TTL auto-expiry, visible banner
// while sharing, one-tap stop, hard delete on stop/sign-out, team-only RLS.
// ============================================================================

import { supabase } from './supabase';
import { TeamLocation } from '../types';

export const LOCATION_OPTIN_KEY = 'race_notes_location_optin';
const TTL_MS = 4 * 60 * 60 * 1000;       // 4h auto-expiry
const MIN_PUSH_INTERVAL_MS = 15_000;     // throttle upserts

let watchId: number | null = null;
let lastPush = 0;

/** Start sharing this device's location with the team. WS-T TODO:
 *  Capacitor Geolocation on native / navigator.geolocation on web. */
export async function startSharing(
  _userId: string,
  _teamId: string,
  _label?: string,
): Promise<boolean> {
  console.warn('WS-T: startSharing not implemented (scaffold)', { TTL_MS, MIN_PUSH_INTERVAL_MS, lastPush });
  return false;
}

/** Stop sharing: clear watcher + HARD DELETE the row. */
export async function stopSharing(userId: string): Promise<void> {
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation?.clearWatch(watchId);
    watchId = null;
  }
  try {
    await supabase.from('team_locations').delete().eq('user_id', userId);
  } catch (e) { console.warn('stopSharing delete failed', e); }
}

/** Subscribe to teammates' live locations (Supabase Realtime).
 *  Returns an unsubscribe function. WS-T TODO: filter expired rows client-side
 *  as well (RLS already hides them on initial fetch). */
export function subscribeTeamLocations(
  _teamId: string,
  _onUpdate: (locations: TeamLocation[]) => void,
): () => void {
  console.warn('WS-T: subscribeTeamLocations not implemented (scaffold)');
  return () => {};
}
