import type { AppUser } from './supabase';

// Client sync omits tires and trips: their pull contracts remain personal today.
export const TEAM_SHARED_SYNC_TABLES = Object.freeze([
  'setups',
  'race_weekends',
  'todos',
  'cars',
  'shock_sessions',
  'maintenance_components',
  'maintenance_logs',
  'checklist_templates',
  'weekend_checklists',
] as const);

// Account deletion transfers every persistent racing record that has user_id.
export const TEAM_DATA_TRANSFER_TABLES = Object.freeze([
  'setups',
  'race_weekends',
  'todos',
  'tire_inventory',
  'cars',
  'shock_sessions',
  'maintenance_components',
  'maintenance_logs',
  'checklist_templates',
  'weekend_checklists',
  'saved_trips',
] as const);

export function resolveSyncOwnerId(
  signedInUserId: string | null | undefined,
  teamId: string | null | undefined,
  members: readonly AppUser[] | null,
  teamResolved: boolean,
): string | null {
  if (!signedInUserId) return null;
  if (!teamResolved) return null;
  if (!teamId) return signedInUserId;
  if (!members) return null;
  return members.find((member) => member.role === 'owner')?.id ?? null;
}
