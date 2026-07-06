// ============================================================================
// Maintenance / ERP engine (plan-v2.md WS-O) — SCAFFOLD
//
// Mirrors the tireHistory.ts philosophy: usage is DERIVED from weekend/session
// data (single source of truth), never hand-maintained counters.
// ============================================================================

import {
  MaintenanceComponent,
  MaintenanceLog,
  MaintenanceStatus,
  MAINTENANCE_DUE_THRESHOLD,
  RaceWeekend,
  SESSION_TYPE_LAPS,
  SessionType,
  Setup,
} from '../types';

/** Default catalog offered on first open of the Service tab (user-editable). */
export const DEFAULT_COMPONENTS: Array<
  Pick<MaintenanceComponent, 'name' | 'category' | 'scope' | 'intervalType' | 'intervalValue'>
> = [
  { name: 'Engine oil',      category: 'Oil',          scope: 'car', intervalType: 'races', intervalValue: 3 },
  { name: 'Motor freshen',   category: 'Motor',        scope: 'car', intervalType: 'laps',  intervalValue: 250 },
  { name: 'Trans fluid',     category: 'Transmission', scope: 'car', intervalType: 'days',  intervalValue: 60 },
  { name: 'Wheel bearings',  category: 'Bearings',     scope: 'car', intervalType: 'races', intervalValue: 10 },
  { name: 'Shock rebuild',   category: 'Shocks',       scope: 'car', intervalType: 'laps',  intervalValue: 300 },
  { name: 'Trailer bearings', category: 'Trailer',     scope: 'rig', intervalType: 'days',  intervalValue: 180 },
];

/**
 * Sessions since a given ISO timestamp.
 * - carId === null → count every weekend (rig scope: hauler goes to every race).
 * - carId set → only weekends whose bound Setup (weekend.setupId → savedSetups)
 *   has a matching carId. Weekends with no bound setup, or a bound setup with
 *   no carId, are excluded (ambiguous — don't guess which car ran them).
 */
function sessionsSince(
  weekends: RaceWeekend[],
  sinceIso: string,
  carId: string | null,
  savedSetups: Setup[],
): { type: string; date: string }[] {
  const since = new Date(sinceIso).getTime();
  const out: { type: string; date: string }[] = [];
  for (const w of weekends) {
    if (carId) {
      const boundSetup = w.setupId ? savedSetups.find(s => s.id === w.setupId) : undefined;
      if (!boundSetup?.carId || boundSetup.carId !== carId) continue;
    }
    for (const s of w.sessions) {
      const d = new Date(s.time || w.date).getTime();
      if (!Number.isNaN(d) && d >= since) out.push({ type: s.name || s.type, date: w.date });
    }
  }
  return out;
}

function lapsForSessionName(name: string): number {
  // Match "Test 2" → "Test", "Heat Race 3" → "Heat Race", etc.
  const base = (Object.keys(SESSION_TYPE_LAPS) as SessionType[]).find(
    t => name === t || name.startsWith(`${t} `),
  );
  return base ? SESSION_TYPE_LAPS[base] : 0;
}

/**
 * Derive current usage vs interval for a component.
 * - scope 'car': counts laps/sessions/races only from weekends whose bound
 *   Setup carries this component's carId (via weekend.setupId → Setup.carId
 *   in savedSetups). Weekends with no resolvable car are excluded.
 * - scope 'rig': counts across every weekend regardless of car — the hauler
 *   goes to every race (decision #1, plan-v2.md).
 * - manualUnits (when set) overrides derivation for non-derivable items.
 */
export function getComponentStatus(
  component: MaintenanceComponent,
  weekends: RaceWeekend[],
  savedSetups: Setup[],
): MaintenanceStatus {
  const { intervalType, intervalValue, lastServicedAt, manualUnits, scope, carId } = component;
  let used = 0;

  if (typeof manualUnits === 'number') {
    used = manualUnits;
  } else if (intervalType === 'days') {
    used = Math.floor((Date.now() - new Date(lastServicedAt).getTime()) / 86_400_000);
  } else {
    const sessions = sessionsSince(weekends, lastServicedAt, scope === 'car' ? (carId ?? null) : null, savedSetups);
    if (intervalType === 'laps') used = sessions.reduce((n, s) => n + lapsForSessionName(s.type), 0);
    else if (intervalType === 'races') used = sessions.filter(s => s.type.startsWith('Feature')).length;
    else used = sessions.length; // 'sessions'
  }

  const pct = intervalValue > 0 ? used / intervalValue : 0;
  const state: MaintenanceStatus['state'] =
    pct >= 1 ? 'overdue' : pct >= MAINTENANCE_DUE_THRESHOLD ? 'due' : 'ok';
  return { used, limit: intervalValue, pct, state };
}

/** Apply a service log: returns the updated component (counter reset). */
export function applyServiceLog(
  component: MaintenanceComponent,
  log: MaintenanceLog,
): MaintenanceComponent {
  return {
    ...component,
    lastServicedAt: log.date || new Date().toISOString(),
    manualUnits: typeof component.manualUnits === 'number' ? 0 : undefined,
    updatedAt: new Date().toISOString(),
  };
}
