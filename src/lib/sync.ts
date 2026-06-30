import { supabase } from './supabase';
import { Setup, RaceWeekend, ActiveSession, SessionRecord, Todo, TireInventoryItem, Car, ShockSession } from '../types';

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
      const rows = setups.map(s => ({
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
      }));
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
      results.setups = cloudSetups.map((r: Record<string, unknown>) => ({
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
        results.sharedSetups = cloudSetups.map((r: Record<string, unknown>) => ({
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
        date: s.date,
        points: s.points,
        photos: s.photos || [],
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('shock_sessions').upsert(rows, { onConflict: 'id' });
      if (error) console.warn('Sync: pushShockSessions error:', error.message);
      else onStatus?.('Shock sessions synced to cloud');
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
    onStatus?.(`Pulled ${data.length} shock sessions from cloud`);
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      label: (r.label as string) || '',
      corner: (r.corner as ShockSession['corner']) || 'LF',
      springRate: (r.spring_rate as string) || '',
      shock: (r.shock as string) || '',
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
      const rows = todos.map(t => ({ ...t, user_id: userId, updated_at: new Date().toISOString() }));
      await supabase.from('todos').upsert(rows, { onConflict: 'id' });
      onStatus?.('To-Dos synced');
    } catch {}
  }, 500));
}

export async function pullTodos(onStatus?: SyncCallback): Promise<Todo[]> {
  const { data } = await supabase.from('todos').select('*').order('updated_at', { ascending: false });
  if (data) onStatus?.(`Pulled ${data.length} To-Do lists`);
  return (data as any) || [];
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
