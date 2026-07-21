import type { CornerSetup, Setup, TireDetails, TireInventoryItem } from '../types';
import { parseTireSize } from './tireSize';

export type NumericCornerField = Extract<keyof CornerSetup,
  'loadWeight' | 'loadCtoC' | 'caster' | 'camber' | 'springHeight' |
  'tirePress' | 'backspacing' | 'topBarLength' | 'bottomBarLength' |
  'topBarHFrame' | 'topBarHBird' | 'botBarHFrame' | 'botBarHBird' |
  'topBarAngRH' | 'topBarAngFD' | 'bottomBarAngRH' | 'bottomBarAngFD' |
  'bottomBarAngle' | 'droop' | 'preload'>;

export interface SetupStep {
  step: number;
  decimals: number;
  unit: string;
  min?: number;
}

export const SETUP_CORNERS = ['lf', 'rf', 'lr', 'rr'] as const;
export type SetupCorner = typeof SETUP_CORNERS[number];
export type PressureBlock = Record<SetupCorner, string>;
export type TireBlock = Record<SetupCorner, TireDetails>;

export const SETUP_STEPS: Record<NumericCornerField, SetupStep> = {
  loadWeight: { step: 5, decimals: 0, unit: 'lb' },
  loadCtoC: { step: 0.125, decimals: 3, unit: 'in' },
  caster: { step: 0.5, decimals: 1, unit: '°' },
  camber: { step: 0.5, decimals: 1, unit: '°' },
  springHeight: { step: 0.125, decimals: 3, unit: 'in' },
  tirePress: { step: 0.5, decimals: 1, unit: 'psi', min: 0 },
  backspacing: { step: 0.25, decimals: 2, unit: 'in', min: 0 },
  topBarLength: { step: 0.25, decimals: 2, unit: 'in', min: 0 },
  bottomBarLength: { step: 0.25, decimals: 2, unit: 'in', min: 0 },
  topBarHFrame: { step: 1, decimals: 0, unit: 'hole', min: 0 },
  topBarHBird: { step: 1, decimals: 0, unit: 'hole', min: 0 },
  botBarHFrame: { step: 1, decimals: 0, unit: 'hole', min: 0 },
  botBarHBird: { step: 1, decimals: 0, unit: 'hole', min: 0 },
  topBarAngRH: { step: 0.5, decimals: 1, unit: '°' },
  topBarAngFD: { step: 0.5, decimals: 1, unit: '°' },
  bottomBarAngRH: { step: 0.5, decimals: 1, unit: '°' },
  bottomBarAngFD: { step: 0.5, decimals: 1, unit: '°' },
  bottomBarAngle: { step: 0.5, decimals: 1, unit: '°' },
  droop: { step: 0.125, decimals: 3, unit: 'in', min: 0 },
  preload: { step: 10, decimals: 0, unit: 'lb', min: 0 },
};

/** Read one legacy numeric token. Rendering never writes this result back. */
export function parseStoredNumber(value: string | undefined): number | '' {
  const match = String(value ?? '').match(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/);
  if (!match) return '';
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : '';
}

export function formatStoredNumber(value: number | '', step: SetupStep): string {
  if (value === '') return '';
  const clamped = step.min === undefined ? value : Math.max(step.min, value);
  const snapped = Math.round(clamped / step.step) * step.step;
  const factor = 10 ** step.decimals;
  return (Math.round(snapped * factor) / factor).toFixed(step.decimals);
}

export function legacyValueNote(value: string | undefined): string | null {
  return value && parseStoredNumber(value) === '' ? value : null;
}

/** Add one canonical psi suffix while accepting legacy values that already include it. */
export function formatPsiValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (!/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/.test(trimmed)) return '';
  return /(?:\s*psi)+$/i.test(trimmed)
    ? trimmed.replace(/(?:\s*psi)+$/i, ' psi')
    : `${trimmed} psi`;
}

/** Import one setup pressure without erasing an existing manual/logged value. */
export function mergeImportedSetupPressure(
  setupPressure: string | undefined,
  currentTirePressure: string | undefined,
  currentBlockPressure: string | undefined,
): { imported: string; tirePressure: string; blockPressure: string } {
  const imported = formatPsiValue(setupPressure);
  return {
    imported,
    tirePressure: imported || currentTirePressure || '',
    blockPressure: imported || currentBlockPressure || '',
  };
}

/** Format one complete pressure block. Blank corners stay true blanks. */
export function formatPressureBlock(values: Partial<PressureBlock> | undefined): PressureBlock {
  return {
    lf: formatPsiValue(values?.lf),
    rf: formatPsiValue(values?.rf),
    lr: formatPsiValue(values?.lr),
    rr: formatPsiValue(values?.rr),
  };
}

export function setupPressureBlock(setup: Setup | null | undefined): PressureBlock {
  return formatPressureBlock(setup ? {
    lf: setup.lf.tirePress,
    rf: setup.rf.tirePress,
    lr: setup.lr.tirePress,
    rr: setup.rr.tirePress,
  } : undefined);
}

export function pressureBlockHasValue(pressures: PressureBlock): boolean {
  return SETUP_CORNERS.some(corner => pressures[corner].trim() !== '');
}

/** Prefer a real SessionRecord pressure block; otherwise recover legacy tire pressures. */
export function resolveSessionPressureBlock(
  recordedPressures: Partial<PressureBlock> | undefined,
  recordedTires: Partial<TireBlock> | undefined,
): PressureBlock {
  const formattedRecorded = formatPressureBlock(recordedPressures);
  if (pressureBlockHasValue(formattedRecorded)) return formattedRecorded;
  return formatPressureBlock({
    lf: recordedTires?.lf?.airPressure,
    rf: recordedTires?.rf?.airPressure,
    lr: recordedTires?.lr?.airPressure,
    rr: recordedTires?.rr?.airPressure,
  });
}

/** Keep SessionRecord.pressures and TireDetails.airPressure byte-identical. */
export function mirrorPressureBlockToTires(tires: TireBlock, pressures: PressureBlock): TireBlock {
  return {
    lf: { ...tires.lf, airPressure: pressures.lf },
    rf: { ...tires.rf, airPressure: pressures.rf },
    lr: { ...tires.lr, airPressure: pressures.lr },
    rr: { ...tires.rr, airPressure: pressures.rr },
  };
}

/** Resolve linked inventory size first, then setup-entered size, for all summary math. */
export function resolveLinkedTireSizes(setup: Setup, tires: TireInventoryItem[]): Record<SetupCorner, string> {
  const byId = new Map(tires.map(tire => [tire.id, tire]));
  return {
    lf: byId.get(setup.lf.tireInventoryId || '')?.size || setup.lf.tireSize || '',
    rf: byId.get(setup.rf.tireInventoryId || '')?.size || setup.rf.tireSize || '',
    lr: byId.get(setup.lr.tireInventoryId || '')?.size || setup.lr.tireSize || '',
    rr: byId.get(setup.rr.tireInventoryId || '')?.size || setup.rr.tireSize || '',
  };
}

export function fourBarAdjustmentId(corner: 'lr' | 'rr', field: NumericCornerField): string {
  return `fourbar-${corner}-${field}`;
}

export function fourBarAdjustmentLabel(corner: 'lr' | 'rr', field: NumericCornerField): string {
  const names: Partial<Record<NumericCornerField, string>> = {
    topBarLength: 'top bar length', topBarHFrame: 'top frame hole',
    topBarHBird: 'top birdcage hole', topBarAngRH: 'top angle at ride height',
    topBarAngFD: 'top angle at full droop', bottomBarLength: 'bottom bar length',
    botBarHFrame: 'bottom frame hole', botBarHBird: 'bottom birdcage hole',
    bottomBarAngRH: 'bottom angle at ride height', bottomBarAngFD: 'bottom angle at full droop',
    bottomBarAngle: 'legacy bottom bar angle',
  };
  return `${corner.toUpperCase()} ${names[field] ?? field}`;
}

/** Canonical fractional-safe stagger calculation shared by setup UI and harnesses. */
export function calculateTireStagger(right: string, left: string): number | null {
  const rightValue = parseTireSize(right);
  const leftValue = parseTireSize(left);
  return Number.isNaN(rightValue) || Number.isNaN(leftValue) ? null : rightValue - leftValue;
}
