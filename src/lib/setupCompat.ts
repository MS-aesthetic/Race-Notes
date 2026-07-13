import { INITIAL_SETUP } from '../data';
import { CornerSetup, Setup } from '../types';

type RankedSetup = { setup: Setup; index: number; time: number };

function compareSetupRecency(a: RankedSetup, b: RankedSetup): number {
  const aValid = Number.isFinite(a.time);
  const bValid = Number.isFinite(b.time);
  // Legacy/unparseable dates keep master-array recency instead of being treated
  // as ancient compared with a valid date.
  if (!aValid || !bValid) {
    if (a.index !== b.index) return a.index - b.index;
    return a.setup.id.localeCompare(b.setup.id);
  }
  if (b.time !== a.time) return b.time - a.time;
  if (a.index !== b.index) return a.index - b.index;
  return a.setup.id.localeCompare(b.setup.id);
}

/** Canonicalize scale weight while retaining legacy rear `load` data. */
export function normalizeCornerSetup(corner: CornerSetup): CornerSetup {
  return {
    ...corner,
    // Undefined means legacy record. Empty string means user intentionally cleared it.
    loadWeight: corner.loadWeight !== undefined ? corner.loadWeight : (corner.load ?? ''),
  };
}

export function normalizeSetup(setup: Setup): Setup {
  return {
    ...setup,
    lf: normalizeCornerSetup(setup.lf),
    rf: normalizeCornerSetup(setup.rf),
    lr: normalizeCornerSetup(setup.lr),
    rr: normalizeCornerSetup(setup.rr),
  };
}

export const normalizeSetups = (setups: Setup[]): Setup[] => setups.map(normalizeSetup);

/** Resolve legacy setupUsed text only when one setup across the full master array matches. */
export function setupUsedUniquelyMatchesCar(
  setupUsed: string | undefined,
  setups: Setup[],
  activeCarId: string | null | undefined,
): boolean {
  const normalized = setupUsed?.trim().toLowerCase() ?? '';
  if (!normalized || !activeCarId) return false;
  const matches = setups.filter(setup => setup.chassis.trim().toLowerCase() === normalized);
  return matches.length === 1 && matches[0].carId === activeCarId;
}

/** Latest setup for one car. Array order is deliberate fallback for legacy dates. */
export function pickLatestSetupForCar(setups: Setup[], carId: string | null | undefined): Setup | null {
  if (!carId) return null;
  const candidates = setups
    .map((setup, index) => ({ setup, index, time: Date.parse(setup.date) }))
    .filter(({ setup }) => setup.carId === carId);
  if (candidates.length === 0) return null;
  candidates.sort(compareSetupRecency);
  return candidates[0].setup;
}

/** Setup immediately older than target under the same deterministic recency rule. */
export function pickImmediatePriorSetupForCar(setups: Setup[], target: Setup): Setup | null {
  const ordered = setups
    .map((setup, index) => ({ setup, index, time: Date.parse(setup.date) }))
    .filter(({ setup }) => setup.carId === target.carId)
    .sort(compareSetupRecency);
  const index = ordered.findIndex(({ setup }) => setup.id === target.id);
  return index >= 0 ? ordered[index + 1]?.setup ?? null : null;
}

export function cloneSetup(source: Setup, overrides: Partial<Setup>): Setup {
  const cloned = JSON.parse(JSON.stringify(source)) as Setup;
  const result = normalizeSetup({ ...cloned, ...overrides });
  if (source.carId && result.carId && source.carId !== result.carId) {
    for (const corner of ['lf', 'rf', 'lr', 'rr'] as const) {
      result[corner] = { ...result[corner], tireInventoryId: undefined };
    }
  }
  return result;
}

export function makeBlankSetup(overrides: Partial<Setup>): Setup {
  return cloneSetup(INITIAL_SETUP, overrides);
}
