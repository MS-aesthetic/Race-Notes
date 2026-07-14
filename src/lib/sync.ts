import { supabase } from './supabase';
import { Setup, RaceWeekend, ActiveSession, SessionRecord, Todo, TireInventoryItem, Car, ShockSession, WeatherHistoryDay, WeatherSnapshot, MaintenanceComponent, MaintenanceLog, ChecklistTemplate, WeekendChecklist, SavedTrip } from '../types';
import { normalizeSetup } from './setupCompat';

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

// ---------------------------------------------------------------------------
// Push: local → cloud
// ---------------------------------------------------------------------------

const pushDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Push saved setups to Supabase (debounced 500ms) */
export function pushSetups(setups: Setup[], userId: string, onStatus?: SyncCallback) {
  const key = 'setups';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = setups.map(raw => {
        const s = normalizeSetup(raw);
        return ({
        id: s.id,
        user_id: userId,
        chassis: s.chassis,
        track: s.track,
        date: s.date,
        car_type: s.carType,
        gear: s.gear || '',
        front_stagger: s.frontStagger || '',
        rear_stagger: s.rearStagger || '',
        pull_bar_frame_hole: s.pullBarFrameHole || '',
        pull_bar_rear_hole: s.pullBarRearHole || '',
        pull_bar_angle: s.pullBarAngle || '',
        notes: s.notes || '',
        screenshots: s.screenshots || [],
        car_id: s.carId ?? null,
        lf: s.lf,
        rf: s.rf,
        lr: s.lr,
        rr: s.rr,
        updated_at: new Date().toISOString(),
        });
      });
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
      const rows = weekends.map(w => ({
        id: w.id,
        user_id: userId,
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
        updated_at: new Date().toISOString(),
      }));
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
        updated_at: new Date().toISOString(),
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
      results.setups = cloudSetups.map((r: Record<string, unknown>) => normalizeSetup({
        id: r.id as string,
        chassis: (r.chassis as string) || '',
        track: (r.track as string) || '',
        date: (r.date as string) || '',
        carType: (r.car_type as string) || '',
        gear: (r.gear as string) || '',
        frontStagger: (r.front_stagger as string) || '',
        rearStagger: (r.rear_stagger as string) || '',
        pullBarFrameHole: (r.pull_bar_frame_hole as string) || '',
        pullBarRearHole: (r.pull_bar_rear_hole as string) || '',
        pullBarAngle: (r.pull_bar_angle as string) || '',
        notes: (r.notes as string) || '',
        screenshots: (r.screenshots as string[]) || [],
        carId: (r.car_id as string) ?? undefined,
        lf: (r.lf as Setup['lf']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
        rf: (r.rf as Setup['rf']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
        lr: (r.lr as Setup['lr']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
        rr: (r.rr as Setup['rr']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
      }));
    }
    onStatus?.(`Pulled ${results.setups.length} setups from cloud`);

    // Pull weekends
    const { data: cloudWeekends } = await supabase
      .from('race_weekends')
      .select('*')
      .order('updated_at', { ascending: false });
    if (cloudWeekends) {
      results.weekends = cloudWeekends.map((r: Record<string, unknown>) => ({
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
      }));
    }
    onStatus?.(`Pulled ${results.weekends.length} weekends from cloud`);

    // Pull active session
    const { data: cloudActive } = await supabase
      .from('active_sessions')
      .select('*')
      .maybeSingle();
    if (cloudActive?.data) {
      results.activeSession = cloudActive.data as ActiveSession;
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
        results.sharedSetups = cloudSetups.map((r: Record<string, unknown>) => normalizeSetup({
          id: r.id as string,
          chassis: (r.chassis as string) || '',
          track: (r.track as string) || '',
          date: (r.date as string) || '',
          carType: (r.car_type as string) || '',
          gear: (r.gear as string) || '',
          frontStagger: (r.front_stagger as string) || '',
          rearStagger: (r.rear_stagger as string) || '',
          pullBarFrameHole: (r.pull_bar_frame_hole as string) || '',
          pullBarRearHole: (r.pull_bar_rear_hole as string) || '',
          pullBarAngle: (r.pull_bar_angle as string) || '',
          notes: (r.notes as string) || '',
          screenshots: (r.screenshots as string[]) || [],
          carId: (r.car_id as string) ?? undefined,
          lf: (r.lf as Setup['lf']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
          rf: (r.rf as Setup['rf']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
          lr: (r.lr as Setup['lr']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
          rr: (r.rr as Setup['rr']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
        }));
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
        results.sharedWeekends = cloudWeekends.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name as string) || '',
          track: (r.track as string) || '',
          date: (r.date as string) || '',
          sessions: (r.sessions as SessionRecord[]) || [],
        }));
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
    // Cloud wins for active session
    localStorage.setItem(existingLocalKey, JSON.stringify(cloudData));
    return true;
  }

  if (Array.isArray(cloudData) && cloudData.length > 0) {
    const localRaw = localStorage.getItem(existingLocalKey);
    const localArr: Array<{ id: string }> = localRaw ? JSON.parse(localRaw) : [];
    const cloudMap = new Map<string, Setup | RaceWeekend>(cloudData.map((item: Setup | RaceWeekend) => [item.id, item] as [string, Setup | RaceWeekend]));
    const localMap = new Map<string, Setup | RaceWeekend>(localArr.map(item => [item.id, item as Setup | RaceWeekend] as [string, Setup | RaceWeekend]));

    // Cloud items overwrite local (cloud is source of truth when logged in)
    for (const [id, item] of cloudMap) {
      localMap.set(id as string, item);
    }

    const merged = Array.from(localMap.values());
    localStorage.setItem(existingLocalKey, JSON.stringify(merged));
    return true;
  }

  return false;
}

/** Hard-delete a single race weekend row from Supabase */
export async function deleteWeekendFromCloud(weekendId: string): Promise<void> {
  try {
    const { error } = await supabase.from('race_weekends').delete().eq('id', weekendId);
    if (error) console.warn('Sync: deleteWeekendFromCloud error:', error.message);
  } catch (e) { console.warn('Sync: deleteWeekendFromCloud failed', e); }
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

export async function deleteTireFromCloud(tireId: string): Promise<void> {
  try {
    const { error } = await supabase.from('tire_inventory').delete().eq('id', tireId);
    if (error) console.warn('Sync: deleteTireFromCloud error:', error.message);
  } catch (e) { console.warn('Sync: deleteTireFromCloud failed', e); }
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
  try {
    const { error } = await supabase.from('cars').delete().eq('id', carId);
    if (error) console.warn('Sync: deleteCarFromCloud error:', error.message);
  } catch (e) { console.warn('Sync: deleteCarFromCloud failed', e); }
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
  try {
    const { error } = await supabase.from('shock_sessions').delete().eq('id', sessionId);
    if (error) console.warn('Sync: deleteShockSessionFromCloud error:', error.message);
  } catch (e) { console.warn('Sync: deleteShockSessionFromCloud failed', e); }
}

export function pushTodos(todos: Todo[], userId: string, onStatus?: SyncCallback) {
  const key = 'todos';
  if (pushDebounceTimers.has(key)) clearTimeout(pushDebounceTimers.get(key)!);
  pushDebounceTimers.set(key, setTimeout(async () => {
    try {
      const rows = todos.map(t => ({
        id: t.id,
        user_id: userId,
        title: t.title,
        items: t.items,
        is_template: t.is_template ?? false,
        weekend_id: t.weekendId || null,
        weekend_name: t.weekendName || null,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('todos').upsert(rows, { onConflict: 'id' });
      onStatus?.('To-Dos synced');
    } catch {}
  }, 500));
}

export async function pullTodos(onStatus?: SyncCallback): Promise<Todo[]> {
  const { data } = await supabase.from('todos').select('*').order('updated_at', { ascending: false });
  if (data) {
    onStatus?.(`Pulled ${data.length} To-Do lists`);
    return (data as any[]).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      user_id: (r.user_id as string) || '',
      title: (r.title as string) || '',
      items: (r.items as Todo['items']) || [],
      is_template: (r.is_template as boolean) || false,
      weekendId: (r.weekend_id as string) || undefined,
      weekendName: (r.weekend_name as string) || undefined,
      updated_at: (r.updated_at as string) || new Date().toISOString(),
    }));
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
      const rows = components.map(c => ({
        id: c.id,
        user_id: userId,
        scope: c.scope,
        car_id: c.carId ?? null,
        name: c.name,
        category: c.category,
        interval_type: c.intervalType,
        interval_value: c.intervalValue,
        last_serviced_at: c.lastServicedAt,
        manual_units: c.manualUnits ?? null,
        notes: c.notes || '',
        created_at: c.createdAt,
        updated_at: new Date().toISOString(),
      }));
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
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      scope: (r.scope as MaintenanceComponent['scope']) || 'car',
      carId: (r.car_id as string) ?? undefined,
      name: (r.name as string) || '',
      category: (r.category as string) || 'Other',
      intervalType: (r.interval_type as MaintenanceComponent['intervalType']) || 'races',
      intervalValue: (r.interval_value as number) ?? 1,
      lastServicedAt: (r.last_serviced_at as string) || new Date().toISOString(),
      manualUnits: (r.manual_units as number) ?? undefined,
      notes: (r.notes as string) || undefined,
      createdAt: (r.created_at as string) || new Date().toISOString(),
      updatedAt: (r.updated_at as string) || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('Sync: pullMaintenanceComponents failed', e);
    return [];
  }
}

export async function deleteMaintenanceComponentFromCloud(componentId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('maintenance_components').delete().eq('id', componentId);
    if (error) { console.warn('Sync: deleteMaintenanceComponentFromCloud error:', error.message); return false; }
    return true;
  } catch (e) { console.warn('Sync: deleteMaintenanceComponentFromCloud failed', e); return false; }
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
  try {
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', logId);
    if (error) { console.warn('Sync: deleteMaintenanceLogFromCloud error:', error.message); return false; }
    return true;
  } catch (e) { console.warn('Sync: deleteMaintenanceLogFromCloud failed', e); return false; }
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
  try {
    const { error } = await supabase.from('checklist_templates').delete().eq('id', templateId);
    if (error) { console.warn('Sync: deleteChecklistTemplateFromCloud error:', error.message); return false; }
    return true;
  } catch (e) { console.warn('Sync: deleteChecklistTemplateFromCloud failed', e); return false; }
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
  try {
    const { error } = await supabase.from('weekend_checklists').delete().eq('id', checklistId);
    if (error) console.warn('Sync: deleteWeekendChecklistFromCloud error:', error.message);
  } catch (e) { console.warn('Sync: deleteWeekendChecklistFromCloud failed', e); }
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
