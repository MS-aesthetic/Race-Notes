import type { ActiveSession, CornerSetup, RaceWeekend, Setup, SetupAdjustment, SetupChange, ShockSession } from '../types';
import { isSetupLocked } from './setupLifecycle';
import { parseStoredNumber, type NumericCornerField, type SetupCorner } from './setupSteps';

export type QuickAdjustCommand =
  | { kind: 'spring-rate'; corner: SetupCorner; delta?: number; value?: string }
  | { kind: 'spring-rounds'; corner: SetupCorner; delta: number }
  | { kind: 'shock-note'; corner: SetupCorner; value: string }
  | { kind: 'shock-load'; corner: SetupCorner; loadSessionId: string; loadSessionLabel?: string }
  | { kind: 'jbar-frame'; delta?: number; value?: string }
  | { kind: 'jbar-pinion'; delta?: number; value?: string }
  | { kind: 'gear'; value: string }
  | { kind: 'other'; value: string }
  | { kind: 'four-bar'; corner: 'lr' | 'rr'; field: NumericCornerField; value: string };

export type QuickAdjustResult =
  | { ok: true; setup: Setup; session: ActiveSession; change: SetupChange; adjustment: SetupAdjustment }
  | { ok: false; error: string };

export type QuickAdjustTarget =
  | { ok: true; weekend: RaceWeekend; setup: Setup; session: ActiveSession }
  | { ok: false; error: string };

const display = (value: string | undefined): string => value?.trim() || '—';

const formatExactNumber = (value: number, decimals = 6): string => {
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  const fixed = rounded.toFixed(decimals);
  return fixed.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
};

/** Resolve Quick Adjust only through active Weekend ownership; selected-car setup is never a fallback. */
export function resolveQuickAdjustTarget(
  activeWeekendId: string | null,
  weekends: readonly RaceWeekend[],
  setups: readonly Setup[],
  session: ActiveSession,
): QuickAdjustTarget {
  const weekend = weekends.find(item => item.id === activeWeekendId && item.status !== 'finished');
  if (!weekend?.activeSetupId) {
    return { ok: false, error: 'Start an unfinished weekend with a valid Weekend Setup before using Quick Adjust.' };
  }
  const setup = setups.find(item => item.id === weekend.activeSetupId);
  if (!setup
    || setup.lifecycleRole !== 'weekend'
    || setup.weekendId !== weekend.id
    || isSetupLocked(setup, weekends)) {
    return { ok: false, error: 'Weekend Setup is missing or locked. Restore it before using Quick Adjust.' };
  }
  if (!session.id
    || session.weekendId !== weekend.id
    || !weekend.sessions.some(record => record.id === session.id)) {
    return { ok: false, error: 'Open a run from this active weekend before using Quick Adjust.' };
  }
  return { ok: true, weekend, setup, session };
}

export function normalizeSpringRate(value: string): string | null {
  const parsed = parseStoredNumber(value);
  if (parsed === '') return null;
  return formatExactNumber(parsed);
}

export function stepSpringRate(value: string | undefined, delta: number): string | null {
  const parsed = parseStoredNumber(value);
  if (parsed === '') return null;
  return formatExactNumber(parsed + delta);
}

export function normalizeQuarterInch(value: string): string | null {
  const parsed = parseStoredNumber(value);
  if (parsed === '') return null;
  return formatExactNumber(parsed);
}

export function stepQuarterInch(value: string | undefined, delta: number): string | null {
  const parsed = parseStoredNumber(value);
  if (parsed === '') return null;
  return formatExactNumber(parsed + delta);
}

export function isQuickAdjustRunAvailable(
  weekend: RaceWeekend | null | undefined,
  setup: Setup | null | undefined,
  session: ActiveSession,
  activeWeekendId: string | null,
): boolean {
  if (!weekend
    || weekend.id !== activeWeekendId
    || weekend.status === 'finished'
    || !setup
    || setup.lifecycleRole !== 'weekend'
    || setup.weekendId !== weekend.id
    || weekend.activeSetupId !== setup.id
    || !session.id
    || session.weekendId !== weekend.id) return false;
  return weekend.sessions.some(record => record.id === session.id);
}

export function filterLoadSessions(
  sessions: readonly ShockSession[],
  setup: Setup,
  corner: SetupCorner,
): ShockSession[] {
  if (!setup.carId) return [];
  return sessions.filter(session => session.carId === setup.carId && session.corner === corner.toUpperCase());
}

/** Only a deliberate Ride Height C-to-C edit clears the spring-round reminder. */
export function applyExplicitCornerField(
  corner: CornerSetup,
  field: keyof CornerSetup,
  value: string,
): CornerSetup {
  return {
    ...corner,
    [field]: value,
    ...(field === 'loadCtoC' ? { rideHeightNeedsReview: false } : {}),
  };
}

function changeDetails(setup: Setup, command: QuickAdjustCommand): {
  setup: Setup;
  label: string;
  icon: string;
  field: string;
  before: string;
  after: string;
  corner?: SetupCorner;
  note?: string;
  loadSessionId?: string;
} | { error: string } {
  if (command.kind === 'spring-rate') {
    const before = setup[command.corner].spring;
    const after = command.delta === undefined
      ? normalizeSpringRate(command.value ?? '')
      : stepSpringRate(before, command.delta);
    if (after === null) return { error: 'Enter a numeric spring rate before using the 25 lb buttons.' };
    return {
      setup: { ...setup, [command.corner]: { ...setup[command.corner], spring: after } },
      label: `${command.corner.toUpperCase()} Spring Rate`, icon: 'compress', field: 'spring',
      before: display(before), after, corner: command.corner,
    };
  }

  if (command.kind === 'spring-rounds') {
    const beforeValue = parseStoredNumber(setup[command.corner].springRounds);
    const before = beforeValue === '' ? 0 : beforeValue;
    const afterNumber = Math.round((before + command.delta) * 2) / 2;
    const after = afterNumber.toFixed(1);
    return {
      setup: {
        ...setup,
        [command.corner]: {
          ...setup[command.corner],
          springRounds: after,
          rideHeightNeedsReview: true,
        },
      },
      label: `${command.corner.toUpperCase()} Spring Rounds`, icon: 'rotate_right', field: 'springRounds',
      before: before.toFixed(1), after, corner: command.corner,
      note: 'Recheck and update Ride Height C-to-C.',
    };
  }

  if (command.kind === 'shock-note') {
    const before = setup[command.corner].shockNote;
    const after = command.value.trim();
    if (!after) return { error: 'Enter a shock note before saving.' };
    return {
      setup: { ...setup, [command.corner]: { ...setup[command.corner], shockNote: after } },
      label: `${command.corner.toUpperCase()} Shock Note`, icon: 'settings_input_component', field: 'shockNote',
      before: display(before), after, corner: command.corner, note: after,
    };
  }

  if (command.kind === 'shock-load') {
    const before = setup[command.corner].boundGraphId;
    const after = command.loadSessionId;
    return {
      setup: { ...setup, [command.corner]: { ...setup[command.corner], boundGraphId: after || undefined } },
      label: `${command.corner.toUpperCase()} Load Session`, icon: 'show_chart', field: 'boundGraphId',
      before: display(before), after: command.loadSessionLabel || display(after), corner: command.corner,
      note: command.loadSessionLabel, loadSessionId: after || undefined,
    };
  }

  if (command.kind === 'jbar-frame' || command.kind === 'jbar-pinion') {
    const field = command.kind === 'jbar-frame' ? 'jbarFrameHeight' : 'jbarPinionHeight';
    const before = setup[field];
    const after = command.delta === undefined
      ? normalizeQuarterInch(command.value ?? '')
      : stepQuarterInch(before, command.delta);
    if (after === null) return { error: `Enter a numeric ${command.kind === 'jbar-frame' ? 'J-Bar Frame' : 'J-Bar Pinion'} height before using the 1/4 inch buttons.` };
    return {
      setup: { ...setup, [field]: after },
      label: command.kind === 'jbar-frame' ? 'J-Bar Frame' : 'J-Bar Pinion', icon: 'height', field,
      before: display(before), after,
    };
  }

  if (command.kind === 'gear') {
    const after = command.value.trim();
    if (!after) return { error: 'Enter a gear before saving.' };
    return {
      setup: { ...setup, gear: after }, label: 'Gear', icon: 'settings', field: 'gear',
      before: display(setup.gear), after,
    };
  }

  if (command.kind === 'other') {
    const after = command.value.trim();
    if (!after) return { error: 'Enter a change before saving.' };
    return {
      setup, label: 'Other Change', icon: 'build', field: 'other', before: '—', after, note: after,
    };
  }

  const before = String(setup[command.corner][command.field] ?? '');
  return {
    setup: { ...setup, [command.corner]: { ...setup[command.corner], [command.field]: command.value } },
    label: `${command.corner.toUpperCase()} Four-bar`, icon: 'tune', field: String(command.field),
    before: display(before), after: display(command.value), corner: command.corner,
  };
}

export function applyQuickAdjust(
  setup: Setup,
  session: ActiveSession,
  command: QuickAdjustCommand,
  weekends: readonly RaceWeekend[],
  now: string,
  commandId: string,
): QuickAdjustResult {
  if (setup.lifecycleRole !== 'weekend' || isSetupLocked(setup, weekends)) {
    return { ok: false, error: 'Weekend Setup is locked or unavailable.' };
  }
  if (!session.id || !session.weekendId || setup.weekendId !== session.weekendId) {
    return { ok: false, error: 'Open a run from this active weekend before using Quick Adjust.' };
  }
  const details = changeDetails(setup, command);
  if ('error' in details) return { ok: false, error: details.error };
  if (details.setup === setup && command.kind !== 'other') {
    return { ok: false, error: 'No change to save.' };
  }
  const runId = session.id;
  const changeLog = setup.changeLog || [];
  const adjustments = session.adjustments || [];
  let matchingChangeIndex = -1;
  if (command.kind !== 'other') {
    for (let index = changeLog.length - 1; index >= 0; index -= 1) {
      const entry = changeLog[index];
      if (entry.runId === runId && entry.corner === details.corner && entry.field === details.field) {
        matchingChangeIndex = index;
        break;
      }
    }
  }

  if (matchingChangeIndex >= 0) {
    const existingChange = changeLog[matchingChangeIndex];
    const originalBefore = existingChange.before ?? details.before;
    const change: SetupChange = {
      ...existingChange,
      timestamp: now,
      before: originalBefore,
      after: details.after,
      note: details.note,
      loadSessionId: details.loadSessionId,
    };
    const baseId = existingChange.id.endsWith('-setup')
      ? existingChange.id.slice(0, -'-setup'.length)
      : existingChange.id;
    const adjustmentId = `${baseId}-run`;
    const matchingAdjustmentIndex = adjustments.findIndex(entry => entry.id === adjustmentId);
    const existingAdjustment = matchingAdjustmentIndex >= 0 ? adjustments[matchingAdjustmentIndex] : undefined;
    const adjustment: SetupAdjustment = {
      ...(existingAdjustment || {
        id: adjustmentId,
        icon: details.icon,
        label: existingChange.label,
        value: '',
        corner: existingChange.corner,
        field: existingChange.field,
        sessionId: runId,
        runId,
      }),
      timestamp: now,
      before: originalBefore,
      after: details.after,
      value: `${originalBefore} to ${details.after}`,
      loadSessionId: details.loadSessionId,
    };
    return {
      ok: true,
      setup: {
        ...details.setup,
        changeLog: changeLog.map((entry, index) => index === matchingChangeIndex ? change : entry),
        updatedAt: now,
      },
      session: {
        ...session,
        adjustments: matchingAdjustmentIndex >= 0
          ? adjustments.map((entry, index) => index === matchingAdjustmentIndex ? adjustment : entry)
          : adjustments,
        updatedAt: now,
      },
      change,
      adjustment,
    };
  }

  const change: SetupChange = {
    id: `${commandId}-setup`, timestamp: now, label: details.label,
    corner: details.corner, field: details.field, before: details.before, after: details.after,
    note: details.note, sessionId: runId, runId, loadSessionId: details.loadSessionId,
  };
  const adjustment: SetupAdjustment = {
    id: `${commandId}-run`, icon: details.icon, label: details.label,
    value: `${details.before} to ${details.after}`, timestamp: now,
    corner: details.corner, field: details.field, before: details.before, after: details.after,
    sessionId: runId, runId, loadSessionId: details.loadSessionId,
  };
  return {
    ok: true,
    setup: { ...details.setup, changeLog: [...changeLog, change], updatedAt: now },
    session: { ...session, adjustments: [adjustment, ...adjustments], updatedAt: now },
    change,
    adjustment,
  };
}
