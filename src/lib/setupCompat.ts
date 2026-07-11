import { CornerSetup, Setup } from '../types';

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
