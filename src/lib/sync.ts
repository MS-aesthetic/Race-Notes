import { supabase } from './supabase';
import { Setup, RaceWeekend, ActiveSession, SessionRecord, Todo, TireInventoryItem, Car, ShockSession, WeatherHistoryDay, WeatherSnapshot, MaintenanceComponent, MaintenanceLog, ChecklistTemplate, WeekendChecklist, SavedTrip } from '../types';
import { mergeTimestampedRecords } from './setupLifecycle';
import { setupFromCloudRow, setupToCloudRow } from './setupSync';
import { todoFromCloudRow, todoToCloudRow } from './todoSync';
import { maintenanceComponentFromCloudRow, maintenanceComponentToCloudRow } from './maintenanceSync';
import type { TeamSharedSyncTable } from './teamDataOwnership';
export { setupFromCloudRow, setupToCloudRow } from './setupSync';
export { maintenanceComponentFromCloudRow, maintenanceComponentToCloudRow } from './maintenanceSync';

// ---------------------------------------------------------------------------
// Local-First Sync Engine
//
// Strategy:
//   1. localStorage is ALWAYS the primary write target (works offline).
//   2. When online + authenticated, data is debounce-pushed to Supabase.
//   3. On login, data is pulled from Supabase and merged with localStorage
//      (newer timestamp wins via `updated_at`).
// ---------------------------------------------------------------------------

type SyncCallback = (message: string) => void;

/** Delete one exact shared row. Callers retain failed intents for retry. */
export async function deleteTeamSharedRecordFromCloud(
  table: TeamSharedSyncTable,
  recordId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).delete().eq('id', recordId);
    if (error) {
      console.warn(`Sync: shared delete ${table}/${recordId} error:`, error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`Sync: shared delete ${table}/${recordId} failed`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Push: local → cloud
// ---------------------------------------------------------------------------

const pushDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const weekendToCloudRow = (w: RaceWeekend, ownerUserId: string): Record<string, unknown> => ({
  id: w.id,
  user_id: ownerUserId,
  name: w.name,
  track: w.track,
  date: w.date,
  sessions: w.sessions,
  notes: w.notes || '',
  weather: w.weather || null,
  location: w.location || '',
  setup_id: w.setupId || null,
  setup_name: w.setupName || '',
  weather_history: w.weatherHistory || null,
  weather_forecast: w.weatherForecast || null,
  status: w.status || 'active',
  finished_at: w.finishedAt ?? null,
  source_setup_id: w.sourceSetupId ?? null,
  baseline_setup_id: w.baselineSetupId ?? null,
  active_setup_id: w.activeSetupId ?? null,
  final_setup_id: w.finalSetupId ?? null,
  updated_at: w.updatedAt || new Date().toISOString(),
});

export const weekendFromCloudRow = (r: Record<string, unknown>): RaceWeekend => ({
  id: r.id as string,
  name: (r.name as string) || '',
  track: (r.track as string) || '',
  date: (r.date as string) || '',
  sessions: (r.sessions as SessionRecord[]) || [],
  notes: (r.notes as string) || undefined,
  weather: (r.weather as WeatherSnapshot) || undefined,
  location: (r.location as string) || undefined,
  setupId: (r.setup_id as string) || undefined,
  setupName: (r.setup_name as string) || undefined,
  weatherHistory: (r.weather_history as WeatherHistoryDay[]) || undefined,
  weatherForecast: (r.weather_forecast as WeatherHistoryDay[]) || undefined,
  status: (r.status as RaceWeekend['status']) || undefined,
  finishedAt: (r.finished_at as string) || undefined,
  sourceSetupId: (r.source_setup_id as string) || undefined,
  baselineSetupId: (r.baseline_setup_id as string) || undefined,
  activeSetupId: (r.active_setup_id as string) || undefined,
  finalSetupId: (r.final_setup_id as string) || undefined,
  updatedAt: (r.updated_at as string) || undefined,
});

/** Push saved setups to Supabase (debounced 500ms) */
export function pushSetups(setups: Setup[], userId: string, onStatus?: SyncCallback) {
  const key = 'setups';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = setups.map(raw => setupToCloudRow(raw, userId));
      const { error } = await supabase.from('setups').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushSetups error:', error.message);
      else onStatus?.('Setups synced to cloud');
    } catch (e) { console.warn('Sync: pushSetups failed', e); }
  }, 500));
}

/** Push race weekends to Supabase (debounced 500ms) */
export function pushWeekends(weekends: RaceWeekend[], userId: string, onStatus?: SyncCallback) {
  const key = 'weekends';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = weekends.map(w => weekendToCloudRow(w, userId));
      const { error } = await supabase.from('race_weekends').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushWeekends error:', error.message);
      else onStatus?.('Weekends synced to cloud');
    } catch (e) { console.warn('Sync: pushWeekends failed', e); }
  }, 500));
}

/** Push active session to Supabase (debounced 500ms) */
export function pushActiveSession(session: ActiveSession, userId: string, onStatus?: SyncCallback) {
  const key = 'active_session';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const { error } = await supabase.from('active_sessions').upsert({
        id: `active-${userId}`,
        user_id: userId,
        data: session,
        updated_at: session.updatedAt || new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) console.warn('Sync: pushActiveSession error:', error.message);
    } catch (e) { console.warn('Sync: pushActiveSession failed', e); }
  }, 500));
}

// ---------------------------------------------------------------------------
// Pull: cloud → local
// ---------------------------------------------------------------------------

/** Pull all cloud data for the given user and merge with localStorage */
export async function pullAllData(
  userId: string,
  onStatus?: SyncCallback
): Promise<{
  setups: Setup[];
  weekends: RaceWeekend[];
  activeSession: ActiveSession | null;
}> {
  const results: {
    setups: Setup[];
    weekends: RaceWeekend[];
    activeSession: ActiveSession | null;
  } = { setups: [], weekends: [], activeSession: null };

  try {
    // Pull setups
    const { data: cloudSetups } = await supabase
      .from('setups')
      .select('*')
      .order('updated_at', { ascending: false });
    if (cloudSetups) {
      results.setups = cloudSetups.map((r: Record<string, unknown>) => setupFromCloudRow(r));
    }
    onStatus?.(`Pulled ${results.setups.length} setups from cloud`);

    // Pull weekends
    const { data: cloudWeekends } = await supabase
      .from('race_weekends')
      .select('*')
      .order('updated_at', { ascending: false });
    if (cloudWeekends) {
      results.weekends = cloudWeekends.map((r: Record<string, unknown>) => weekendFromCloudRow(r));
    }
    onStatus?.(`Pulled ${results.weekends.length} weekends from cloud`);

    // Pull active session
    const { data: cloudActive } = await supabase
      .from('active_sessions')
      .select('*')
      .maybeSingle();
    if (cloudActive?.data) {
      results.activeSession = {
        ...(cloudActive.data as ActiveSession),
        updatedAt: (cloudActive.updated_at as string) || (cloudActive.data as ActiveSession).updatedAt,
      };
    }
  } catch (e) {
    console.warn('Sync: pullAllData failed', e);
    onStatus?.('Cloud sync failed — using local data only');
  }

  return results;
}

// ---------------------------------------------------------------------------
// Pull: Shared data (cloud → local)
// ---------------------------------------------------------------------------

export async function pullSharedData(userId: string): Promise<{
  sharedSetups: Setup[];
  sharedWeekends: RaceWeekend[];
}> {
  const results: {
    sharedSetups: Setup[];
    sharedWeekends: RaceWeekend[];
  } = { sharedSetups: [], sharedWeekends: [] };

  try {
    // 1. Get shared setups IDs
    const { data: sharedSetupRefs } = await supabase
      .from('shared_setups')
      .select('setup_id')
      .eq('shared_with', userId);

    if (sharedSetupRefs && sharedSetupRefs.length > 0) {
      const setupIds = sharedSetupRefs.map(r => r.setup_id);
      const { data: cloudSetups } = await supabase
        .from('setups')
        .select('*')
        .in('id', setupIds);

      if (cloudSetups) {
        results.sharedSetups = cloudSetups.map((r: Record<string, unknown>) => setupFromCloudRow(r));
      }
    }

    // 2. Get shared weekend IDs
    const { data: sharedWeekendRefs } = await supabase
      .from('shared_weekends')
      .select('weekend_id')
      .eq('shared_with', userId);

    if (sharedWeekendRefs && sharedWeekendRefs.length > 0) {
      const weekendIds = sharedWeekendRefs.map(r => r.weekend_id);
      const { data: cloudWeekends } = await supabase
        .from('race_weekends')
        .select('*')
        .in('id', weekendIds);

      if (cloudWeekends) {
        results.sharedWeekends = cloudWeekends.map((r: Record<string, unknown>) => weekendFromCloudRow(r));
      }
    }
  } catch (e) {
    console.warn('Sync: pullSharedData failed', e);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Merge helper: merge cloud data into localStorage (newer wins)
// ---------------------------------------------------------------------------

export function mergeIntoLocalStorage(
  type: 'setups' | 'weekends' | 'activeSession',
  cloudData: Setup[] | RaceWeekend[] | ActiveSession | null,
  existingLocalKey: string,
): boolean {
  if (!cloudData) return false;

  if (type === 'activeSession' && cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData)) {
    const localRaw = localStorage.getItem(existingLocalKey);
    if (!localRaw) {
      localStorage.setItem(existingLocalKey, JSON.stringify(cloudData));
      return true;
    }
    const local = JSON.parse(localRaw) as ActiveSession;
    const merged = (cloudData.updatedAt || '') >= (local.updatedAt || '') ? cloudData : local;
    localStorage.setItem(existingLocalKey, JSON.stringify(merged));
    return true;
  }

  if (Array.isArray(cloudData) && cloudData.length > 0) {
    const localRaw = localStorage.getItem(existingLocalKey);
    const localArr: Array<Setup | RaceWeekend> = localRaw ? JSON.parse(localRaw) : [];
    const merged = type === 'setups'
      ? mergeTimestampedRecords(localArr as Setup[], cloudData as Setup[])
      : mergeTimestampedRecords(localArr as RaceWeekend[], cloudData as RaceWeekend[]);
    localStorage.setItem(existingLocalKey, JSON.stringify(merged));
    return true;
  }

  return false;
}

/** Hard-delete a single race weekend row from Supabase */
export async function deleteWeekendFromCloud(weekendId: string): Promise<void> {
  await deleteTeamSharedRecordFromCloud('race_weekends', weekendId);
}

export function pushTires(tires: TireInventoryItem[], userId: string, onStatus?: SyncCallback) {
  const key = 'tires';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = tires.map(t => ({
        id: t.id,
        user_id: userId,
        tire_number: t.tireNumber,
        size: t.size,
        compound: t.compound,
        wheel_backspacing: t.wheelBackspacing,
        durometer: t.durometer,
        air_pressure: t.airPressure || '',
        car_id: t.carId ?? null,
        created_at: t.createdAt || new Date().toISOString(),
        date_added: t.dateAdded || null,
        initial_age_days: t.initialAgeDays ?? 0,
        usage_dates: t.usageDates || [],
        heat_cycles: t.heatCycles ?? 0,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('tire_inventory').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushTires error:', error.message);
      else onStatus?.('Tires synced to cloud');
    } catch (e) { console.warn('Sync: pushTires failed', e); }
  }, 500));
}

export async function pullTires(userId: string, onStatus?: SyncCallback): Promise<TireInventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('tire_inventory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.warn('Sync: pullTires error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} tires from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      tireNumber: (r.tire_number as string) || '',
      size: (r.size as string) || '',
      compound: (r.compound as string) || '',
      wheelBackspacing: ((r.wheel_backspacing as string) || '2') as '2' | '3' | '4',
      durometer: (r.durometer as string) || '',
      airPressure: (r.air_pressure as string) || undefined,
      createdAt: (r.created_at as string) || undefined,
      carId: (r.car_id as string) ?? undefined,
      dateAdded: (r.date_added as string) || undefined,
      initialAgeDays: (r.initial_age_days as number) ?? 0,
      usageDates: (r.usage_dates as string[]) || [],
      heatCycles: (r.heat_cycles as number) ?? 0,
    }));
  } catch (e) {
    console.warn('Sync: pullTires failed', e);
    return [];
  }
}

export async function deleteTireFromCloud(tireId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('tire_inventory').delete().eq('id', tireId);
    if (error) { console.warn('Sync: deleteTireFromCloud error:', error.message); return false; }
    return true;
  } catch (e) { console.warn('Sync: deleteTireFromCloud failed', e); return false; }
}

// ---------------------------------------------------------------------------
// Cars sync
// ---------------------------------------------------------------------------

export function pushCars(cars: Car[], userId: string, teamId: string | null, onStatus?: SyncCallback) {
  const key = 'cars';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = cars.map(c => ({
        id: c.id,
        user_id: userId,
        team_id: teamId ?? null,
        car_type: c.carType,
        chassis: c.chassis,
        division: c.division,
        name: c.name || '',
        created_at: c.createdAt,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('cars').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushCars error:', error.message);
      else onStatus?.('Cars synced to cloud');
    } catch (e) { console.warn('Sync: pushCars failed', e); }
  }, 500));
}

export async function pullCars(userId: string, onStatus?: SyncCallback): Promise<Car[]> {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { console.warn('Sync: pullCars error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} cars from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      userId: (r.user_id as string) || '',
      teamId: (r.team_id as string) ?? null,
      carType: (r.car_type as string) || '',
      chassis: (r.chassis as string) || '',
      division: (r.division as string) || '',
      name: (r.name as string) || undefined,
      createdAt: (r.created_at as string) || new Date().toISOString(),
      updatedAt: (r.updated_at as string) || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('Sync: pullCars failed', e);
    return [];
  }
}

export async function deleteCarFromCloud(carId: string): Promise<void> {
  await deleteTeamSharedRecordFromCloud('cars', carId);
}

// ---------------------------------------------------------------------------
// Shock sessions sync (Decision 1: smasher cloud sync)
// ---------------------------------------------------------------------------

export function pushShockSessions(sessions: ShockSession[], userId: string, onStatus?: SyncCallback) {
  const key = 'shock_sessions';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = sessions.map(s => ({
        id: s.id,
        user_id: userId,
        car_id: s.carId ?? null,
        label: s.label,
        corner: s.corner,
        spring_rate: s.springRate,
        shock: s.shock,
        ride_height_ctoc: s.rideHeightCtoC || '',
        date: s.date,
        points: s.points,
        photos: s.photos || [],
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('shock_sessions').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushShockSessions error:', error.message);
      else onStatus?.('Load sessions synced to cloud');
    } catch (e) { console.warn('Sync: pushShockSessions failed', e); }
  }, 500));
}

export async function pullShockSessions(userId: string, onStatus?: SyncCallback): Promise<ShockSession[]> {
  try {
    const { data, error } = await supabase
      .from('shock_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('Sync: pullShockSessions error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} load sessions from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      label: (r.label as string) || '',
      corner: (r.corner as ShockSession['corner']) || 'LF',
      springRate: (r.spring_rate as string) || '',
      shock: (r.shock as string) || '',
      rideHeightCtoC: (r.ride_height_ctoc as string) || '',
      date: (r.date as string) || '',
      points: (r.points as ShockSession['points']) || [],
      photos: (r.photos as string[]) || [],
      carId: (r.car_id as string) ?? undefined,
    }));
  } catch (e) {
    console.warn('Sync: pullShockSessions failed', e);
    return [];
  }
}

export async function deleteShockSessionFromCloud(sessionId: string): Promise<void> {
  await deleteTeamSharedRecordFromCloud('shock_sessions', sessionId);
}

export function pushTodos(todos: Todo[], userId: string, onStatus?: SyncCallback) {
  const key = 'todos';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const updatedAt = new Date().toISOString();
      const rows = todos.map(todo => todoToCloudRow(todo, userId, updatedAt));
      await supabase.from('todos').upsert(rows, { onConflict: 'id' });
      onStatus?.('To-Dos synced');
    } catch {}
  }, 500));
}

export async function pullTodos(onStatus?: SyncCallback): Promise<Todo[]> {
  const { data } = await supabase.from('todos').select('*').order('updated_at', { ascending: false });
  if (data) {
    onStatus?.(`Pulled ${data.length} To-Do lists`);
    return (data as any[]).map((row: Record<string, unknown>) => todoFromCloudRow(row));
  }
  return [];
}

// ---------------------------------------------------------------------------
// Maintenance components sync (WS-N; scope 'car' | 'rig')
// ---------------------------------------------------------------------------

export function pushMaintenanceComponents(components: MaintenanceComponent[], userId: string, onStatus?: SyncCallback) {
  const key = 'maintenance_components';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = components.map(c => maintenanceComponentToCloudRow(c, userId));
      const { error } = await supabase.from('maintenance_components').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushMaintenanceComponents error:', error.message);
      else onStatus?.('Maintenance components synced to cloud');
    } catch (e) { console.warn('Sync: pushMaintenanceComponents failed', e); }
  }, 500));
}

export async function pullMaintenanceComponents(onStatus?: SyncCallback): Promise<MaintenanceComponent[]> {
  try {
    const { data, error } = await supabase
      .from('maintenance_components')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { console.warn('Sync: pullMaintenanceComponents error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} maintenance components from cloud`);
    return data.map((r: Record<string, unknown>) => maintenanceComponentFromCloudRow(r));
  } catch (e) {
    console.warn('Sync: pullMaintenanceComponents failed', e);
    return [];
  }
}

export async function deleteMaintenanceComponentFromCloud(componentId: string): Promise<boolean> {
  return deleteTeamSharedRecordFromCloud('maintenance_components', componentId);
}

// ---------------------------------------------------------------------------
// Maintenance logs sync (service history)
// ---------------------------------------------------------------------------

export function pushMaintenanceLogs(logs: MaintenanceLog[], userId: string, onStatus?: SyncCallback) {
  const key = 'maintenance_logs';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = logs.map(l => ({
        id: l.id,
        user_id: userId,
        component_id: l.componentId,
        date: l.date,
        type: l.type,
        notes: l.notes || '',
        cost: l.cost ?? null,
        accounting_entry_id: l.accountingEntryId ?? null,
        used_at_service: l.usedAtService ?? null,
        done_by: l.doneBy ?? null,
        done_by_name: l.doneByName || '',
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('maintenance_logs').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushMaintenanceLogs error:', error.message);
      else onStatus?.('Maintenance logs synced to cloud');
    } catch (e) { console.warn('Sync: pushMaintenanceLogs failed', e); }
  }, 500));
}

export async function pullMaintenanceLogs(onStatus?: SyncCallback): Promise<MaintenanceLog[]> {
  try {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('Sync: pullMaintenanceLogs error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} maintenance logs from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      componentId: (r.component_id as string) || '',
      date: (r.date as string) || '',
      type: (r.type as MaintenanceLog['type']) || 'service',
      notes: (r.notes as string) || undefined,
      cost: (r.cost as number) ?? undefined,
      accountingEntryId: (r.accounting_entry_id as string) ?? undefined,
      usedAtService: (r.used_at_service as number) ?? undefined,
      doneBy: (r.done_by as string) ?? undefined,
      doneByName: (r.done_by_name as string) || undefined,
    }));
  } catch (e) {
    console.warn('Sync: pullMaintenanceLogs failed', e);
    return [];
  }
}

export async function deleteMaintenanceLogFromCloud(logId: string): Promise<boolean> {
  return deleteTeamSharedRecordFromCloud('maintenance_logs', logId);
}

// ---------------------------------------------------------------------------
// Checklist templates sync
// ---------------------------------------------------------------------------

export function pushChecklistTemplates(templates: ChecklistTemplate[], userId: string, onStatus?: SyncCallback) {
  const key = 'checklist_templates';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = templates.map(t => ({
        id: t.id,
        user_id: userId,
        name: t.name,
        category: t.category,
        items: t.items,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('checklist_templates').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushChecklistTemplates error:', error.message);
      else onStatus?.('Checklist templates synced to cloud');
    } catch (e) { console.warn('Sync: pushChecklistTemplates failed', e); }
  }, 500));
}

export async function pullChecklistTemplates(onStatus?: SyncCallback): Promise<ChecklistTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('checklist_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) { console.warn('Sync: pullChecklistTemplates error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} checklist templates from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: (r.name as string) || '',
      category: (r.category as string) || 'Custom',
      items: (r.items as ChecklistTemplate['items']) || [],
      updatedAt: (r.updated_at as string) || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('Sync: pullChecklistTemplates failed', e);
    return [];
  }
}

export async function deleteChecklistTemplateFromCloud(templateId: string): Promise<boolean> {
  return deleteTeamSharedRecordFromCloud('checklist_templates', templateId);
}

// ---------------------------------------------------------------------------
// Weekend checklists sync (per-weekend instances)
// ---------------------------------------------------------------------------

export function pushWeekendChecklists(checklists: WeekendChecklist[], userId: string, onStatus?: SyncCallback) {
  const key = 'weekend_checklists';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = checklists.map(c => ({
        id: c.id,
        user_id: userId,
        weekend_id: c.weekendId ?? null,
        weekend_name: c.weekendName || '',
        template_id: c.templateId ?? null,
        name: c.name,
        category: c.category,
        items: c.items,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('weekend_checklists').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushWeekendChecklists error:', error.message);
      else onStatus?.('Weekend checklists synced to cloud');
    } catch (e) { console.warn('Sync: pushWeekendChecklists failed', e); }
  }, 500));
}

export async function pullWeekendChecklists(onStatus?: SyncCallback): Promise<WeekendChecklist[]> {
  try {
    const { data, error } = await supabase
      .from('weekend_checklists')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) { console.warn('Sync: pullWeekendChecklists error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} weekend checklists from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      weekendId: (r.weekend_id as string) ?? undefined,
      weekendName: (r.weekend_name as string) || undefined,
      templateId: (r.template_id as string) ?? undefined,
      name: (r.name as string) || '',
      category: (r.category as string) || 'Custom',
      items: (r.items as WeekendChecklist['items']) || [],
      updatedAt: (r.updated_at as string) || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('Sync: pullWeekendChecklists failed', e);
    return [];
  }
}

export async function deleteWeekendChecklistFromCloud(checklistId: string): Promise<void> {
  await deleteTeamSharedRecordFromCloud('weekend_checklists', checklistId);
}

// ---------------------------------------------------------------------------
// Saved trips sync (HERE truck routes, cached locally to preserve API quota)
// ---------------------------------------------------------------------------

export function pushTrips(trips: SavedTrip[], userId: string, onStatus?: SyncCallback) {
  const key = 'saved_trips';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = trips.map(t => ({
        id: t.id,
        user_id: userId,
        weekend_id: t.weekendId ?? null,
        weekend_name: t.weekendName || '',
        origin: t.origin,
        destination: t.destination,
        polyline: t.polyline ?? null,
        distance_m: t.distanceM ?? null,
        duration_s: t.durationS ?? null,
        notices: t.notices || [],
        stops: t.stops,
        created_at: t.createdAt,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('saved_trips').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushTrips error:', error.message);
      else onStatus?.('Trips synced to cloud');
    } catch (e) { console.warn('Sync: pushTrips failed', e); }
  }, 500));
}

export async function pullTrips(onStatus?: SyncCallback): Promise<SavedTrip[]> {
  try {
    const { data, error } = await supabase
      .from('saved_trips')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('Sync: pullTrips error:', error.message); return []; }
    if (!data) return [];
    onStatus?.(`Pulled ${data.length} trips from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      weekendId: (r.weekend_id as string) ?? undefined,
      weekendName: (r.weekend_name as string) || undefined,
      origin: (r.origin as SavedTrip['origin']) || { lat: 0, lng: 0, label: '' },
      destination: (r.destination as SavedTrip['destination']) || { lat: 0, lng: 0, label: '' },
      polyline: (r.polyline as SavedTrip['polyline']) ?? undefined,
      distanceM: (r.distance_m as number) ?? undefined,
      durationS: (r.duration_s as number) ?? undefined,
      notices: (r.notices as string[]) || undefined,
      stops: (r.stops as SavedTrip['stops']) || [],
      createdAt: (r.created_at as string) || new Date().toISOString(),
      updatedAt: (r.updated_at as string) || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('Sync: pullTrips failed', e);
    return [];
  }
}

export async function deleteTripFromCloud(tripId: string): Promise<void> {
  try {
    const { error } = await supabase.from('saved_trips').delete().eq('id', tripId);
    if (error) console.warn('Sync: deleteTripFromCloud error:', error.message);
  } catch (e) { console.warn('Sync: deleteTripFromCloud failed', e); }
}

// ---------------------------------------------------------------------------
// Supabase Storage — file upload/delete helpers
// ---------------------------------------------------------------------------

/**
 * Upload a File to the race-attachments bucket.
 * Requires the user to be authenticated.
 * Returns the public URL on success, throws on failure.
 *
 * Path: {userId}/{entityType}/{entityId}/{timestamp}_{random}.{ext}
 */
export async function uploadAttachment(
  file: File,
  userId: string,
  entityType: 'sessions' | 'setups',
  entityId: string,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${userId}/${entityType}/${entityId}/${safeName}`;

  const { error } = await supabase.storage
    .from('race-attachments')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from('race-attachments').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from the race-attachments bucket given its full public URL.
 * Silently no-ops if the URL is not a Supabase Storage URL.
 */
export async function deleteAttachment(publicUrl: string): Promise<void> {
  try {
    const marker = '/object/public/race-attachments/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
    await supabase.storage.from('race-attachments').remove([path]);
  } catch (e) {
    console.warn('deleteAttachment failed', e);
  }
}
