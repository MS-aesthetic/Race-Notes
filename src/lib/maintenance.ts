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
  Setup,
} from '../types';
import { inferSessionType } from './tireHistory';
import { parseWeekendDate } from './scope';

/** Default catalog offered on first open of the Service tab (user-editable). */
export const DEFAULT_COMPONENTS: Array<
  Pick<MaintenanceComponent, 'name' | 'category' | 'scope' | 'intervalType' | 'intervalValue'>
> = [
  { name: 'Engine oil',      category: 'Oil',          scope: 'car', intervalType: 'races', intervalValue: 3 },
  { name: 'Motor freshen',   category: 'Motor',        scope: 'car', intervalType: 'races', intervalValue: 10 },
  { name: 'Transmission fluid', category: 'Transmission', scope: 'car', intervalType: 'days', intervalValue: 60 },
  { name: 'Wheel bearings',  category: 'Bearings',     scope: 'car', intervalType: 'races', intervalValue: 10 },
  { name: 'Shock rebuild',   category: 'Shocks',       scope: 'car', intervalType: 'races', intervalValue: 10 },
  { name: 'Trailer bearings', category: 'Trailer',     scope: 'rig', intervalType: 'days',  intervalValue: 180 },
];

const calendarDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const parseServiceDate = (raw: string): Date => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  return new Date(raw);
};

/** Count each Feature weekend once, strictly after the service calendar day. */
function racesSince(
  weekends: RaceWeekend[],
  sinceIso: string,
  carId: string | null,
  savedSetups: Setup[],
): number {
  const since = parseServiceDate(sinceIso);
  if (Number.isNaN(since.getTime())) return 0;
  const sinceDay = calendarDay(since);
  return weekends.filter(w => {
    const weekendDate = parseWeekendDate(w.date);
    if (!weekendDate || calendarDay(weekendDate) <= sinceDay) return false;
    if (carId) {
      const boundSetup = w.setupId ? savedSetups.find(s => s.id === w.setupId) : undefined;
      if (!boundSetup?.carId || boundSetup.carId !== carId) return false;
    }
    return w.sessions.some(session => inferSessionType(session) === 'Feature');
  }).length;
}

export const normalizeStartingUsage = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? value
    : 0;

/**
 * Derive current usage vs interval for a component.
 * - scope 'car': counts races only from weekends whose bound
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
  const startingUsage = normalizeStartingUsage(component.startingUsage);
  let used = 0;

  if (typeof manualUnits === 'number') {
    used = manualUnits;
  } else if (intervalType === 'days') {
    used = startingUsage + Math.floor((Date.now() - new Date(lastServicedAt).getTime()) / 86_400_000);
  } else {
    used = startingUsage + racesSince(
      weekends,
      lastServicedAt,
      scope === 'car' ? (carId ?? null) : null,
      savedSetups,
    );
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
    startingUsage: 0,
    updatedAt: new Date().toISOString(),
  };
}
