import { supabase } from './supabase';
import { Setup, RaceWeekend, ActiveSession, SessionRecord, Todo } from '../types';

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
