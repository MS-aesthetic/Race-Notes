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

export type TeamSharedSyncTable = (typeof TEAM_SHARED_SYNC_TABLES)[number];

export const PENDING_TEAM_DELETES_KEY = 'race_notes_pending_team_deletes_v1';
export const PENDING_PERSONAL_TIRE_DELETES_KEY = 'race_notes_pending_personal_tire_deletes_v1';

export interface PendingTeamDelete {
  accountId: string;
  table: TeamSharedSyncTable;
  recordId: string;
  queuedAt: string;
  soloOnly: boolean;
}

export interface PendingPersonalTireDelete {
  accountId: string;
  tireId: string;
  queuedAt: string;
}

export interface TeamDeleteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

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

export function buildOwnerCatchupKey(
  signedInUserId: string,
  authGeneration: number,
  teamId: string | null | undefined,
  ownerUserId: string,
): string {
  return `${signedInUserId}:${authGeneration}:${teamId ?? 'solo'}:${ownerUserId}`;
}

function isTeamSharedSyncTable(value: unknown): value is TeamSharedSyncTable {
  return typeof value === 'string'
    && (TEAM_SHARED_SYNC_TABLES as readonly string[]).includes(value);
}

export function readPendingTeamDeletes(storage: TeamDeleteStorage): PendingTeamDelete[] {
  try {
    const raw = storage.getItem(PENDING_TEAM_DELETES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PendingTeamDelete => (
      !!entry
      && typeof entry === 'object'
      && typeof entry.accountId === 'string'
      && entry.accountId.length > 0
      && isTeamSharedSyncTable(entry.table)
      && typeof entry.recordId === 'string'
      && entry.recordId.length > 0
      && typeof entry.queuedAt === 'string'
      && typeof entry.soloOnly === 'boolean'
    ));
  } catch {
    return [];
  }
}

function writePendingTeamDeletes(storage: TeamDeleteStorage, queue: PendingTeamDelete[]): void {
  storage.setItem(PENDING_TEAM_DELETES_KEY, JSON.stringify(queue));
}

export function enqueuePendingTeamDelete(
  storage: TeamDeleteStorage,
  entry: PendingTeamDelete,
): PendingTeamDelete[] {
  const queue = readPendingTeamDeletes(storage);
  const existingIndex = queue.findIndex(item => (
    item.accountId === entry.accountId
    && item.table === entry.table
    && item.recordId === entry.recordId
  ));
  if (existingIndex >= 0) {
    queue[existingIndex] = {
      ...queue[existingIndex],
      // A normal shared delete is stronger than a clear-device solo-only delete.
      soloOnly: queue[existingIndex].soloOnly && entry.soloOnly,
    };
  } else {
    queue.push(entry);
  }
  writePendingTeamDeletes(storage, queue);
  return queue;
}

export function pendingTeamDeletesForAccount(
  storage: TeamDeleteStorage,
  accountId: string,
  teamResolved: boolean,
  hasTeam: boolean,
): PendingTeamDelete[] {
  if (!teamResolved) return [];
  return readPendingTeamDeletes(storage).filter(entry => (
    entry.accountId === accountId && (!hasTeam || !entry.soloOnly)
  ));
}

export function removePendingTeamDelete(
  storage: TeamDeleteStorage,
  completed: Pick<PendingTeamDelete, 'accountId' | 'table' | 'recordId'>,
): PendingTeamDelete[] {
  const queue = readPendingTeamDeletes(storage).filter(entry => !(
    entry.accountId === completed.accountId
    && entry.table === completed.table
    && entry.recordId === completed.recordId
  ));
  writePendingTeamDeletes(storage, queue);
  return queue;
}

export function discardSoloOnlyTeamDeletes(
  storage: TeamDeleteStorage,
  accountId: string,
): PendingTeamDelete[] {
  const queue = readPendingTeamDeletes(storage).filter(entry => !(
    entry.accountId === accountId && entry.soloOnly
  ));
  writePendingTeamDeletes(storage, queue);
  return queue;
}

export function readPendingPersonalTireDeletes(
  storage: TeamDeleteStorage,
): PendingPersonalTireDelete[] {
  try {
    const raw = storage.getItem(PENDING_PERSONAL_TIRE_DELETES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PendingPersonalTireDelete => (
      !!entry
      && typeof entry === 'object'
      && typeof entry.accountId === 'string'
      && entry.accountId.length > 0
      && typeof entry.tireId === 'string'
      && entry.tireId.length > 0
      && typeof entry.queuedAt === 'string'
    ));
  } catch {
    return [];
  }
}

function writePendingPersonalTireDeletes(
  storage: TeamDeleteStorage,
  queue: PendingPersonalTireDelete[],
): void {
  storage.setItem(PENDING_PERSONAL_TIRE_DELETES_KEY, JSON.stringify(queue));
}

export function enqueuePendingPersonalTireDelete(
  storage: TeamDeleteStorage,
  entry: PendingPersonalTireDelete,
): PendingPersonalTireDelete[] {
  const queue = readPendingPersonalTireDeletes(storage);
  if (!queue.some(item => item.accountId === entry.accountId && item.tireId === entry.tireId)) {
    queue.push(entry);
    writePendingPersonalTireDeletes(storage, queue);
  }
  return queue;
}

export function removePendingPersonalTireDelete(
  storage: TeamDeleteStorage,
  completed: Pick<PendingPersonalTireDelete, 'accountId' | 'tireId'>,
): PendingPersonalTireDelete[] {
  const queue = readPendingPersonalTireDeletes(storage).filter(entry => !(
    entry.accountId === completed.accountId && entry.tireId === completed.tireId
  ));
  writePendingPersonalTireDeletes(storage, queue);
  return queue;
}
