import type { CornerSetup, RaceWeekend, Setup, SetupChange } from '../types';

const cloneSetup = (setup: Setup): Setup => JSON.parse(JSON.stringify(setup)) as Setup;

export const isWeekendFinished = (weekend: RaceWeekend | null | undefined): boolean =>
  weekend?.status === 'finished';

export const isSetupLocked = (setup: Setup | null | undefined): boolean =>
  !!setup && (setup.lifecycleRole === 'baseline'
    || setup.lifecycleRole === 'final'
    || !!setup.lockedAt);

export const lifecycleSetupId = (weekend: RaceWeekend | null | undefined): string | undefined =>
  weekend?.finalSetupId || weekend?.activeSetupId || weekend?.baselineSetupId || weekend?.setupId;

const displayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
};

/** Add one history entry per changed setup field. Lifecycle metadata is excluded. */
export function withSetupDiffLog(prior: Setup, next: Setup, now: string): Setup {
  const changes: SetupChange[] = [];
  const existingChangeCount = prior.changeLog?.length || 0;
  const topFields: Array<keyof Setup> = [
    'chassis', 'track', 'date', 'carType', 'gear', 'toe', 'jbar',
    'jbarFrameHeight', 'jbarPinionHeight', 'frontStagger', 'rearStagger',
    'pullBarFrameHole', 'pullBarRearHole', 'pullBarAngle', 'notes',
  ];
  topFields.forEach(field => {
    if (JSON.stringify(prior[field]) === JSON.stringify(next[field])) return;
    changes.push({
      id: `setup-change-${now}-${field}-${existingChangeCount + changes.length}`,
      timestamp: now,
      label: String(field).replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()),
      field: String(field),
      before: displayValue(prior[field]),
      after: displayValue(next[field]),
    });
  });
  (['lf', 'rf', 'lr', 'rr'] as const).forEach(corner => {
    const fields = new Set([
      ...Object.keys(prior[corner]),
      ...Object.keys(next[corner]),
    ] as Array<keyof CornerSetup>);
    fields.forEach(field => {
      if (field === 'pressureSourceNote') return;
      if (JSON.stringify(prior[corner][field]) === JSON.stringify(next[corner][field])) return;
      const fieldLabel = String(field).replace(/([A-Z])/g, ' $1');
      changes.push({
        id: `setup-change-${now}-${corner}-${String(field)}-${existingChangeCount + changes.length}`,
        timestamp: now,
        label: `${corner.toUpperCase()} ${fieldLabel}`,
        corner,
        field: String(field),
        before: displayValue(prior[corner][field]),
        after: displayValue(next[corner][field]),
      });
    });
  });
  if (changes.length === 0) return next;
  return { ...next, changeLog: [...(prior.changeLog || []), ...changes] };
}

export interface StartedWeekendLifecycle {
  weekend: RaceWeekend;
  baseline: Setup;
  weekendSetup: Setup;
}

export function startWeekendLifecycle(
  weekend: RaceWeekend,
  source: Setup,
  now: string,
): StartedWeekendLifecycle {
  const baselineId = `setup-baseline-${weekend.id}`;
  const weekendSetupId = `setup-weekend-${weekend.id}`;
  const versionDate = weekend.date || 'Race Weekend';

  const baseline: Setup = {
    ...cloneSetup(source),
    id: baselineId,
    track: weekend.track,
    date: weekend.date,
    versionLabel: `${versionDate} Baseline Setup`,
    lifecycleRole: 'baseline',
    sourceSetupId: source.id,
    weekendId: weekend.id,
    lockedAt: now,
    changeLog: [],
    screenshots: [...(source.screenshots || [])],
    updatedAt: now,
  };
  const weekendSetup: Setup = {
    ...cloneSetup(source),
    id: weekendSetupId,
    track: weekend.track,
    date: weekend.date,
    versionLabel: `${versionDate} Weekend Setup`,
    lifecycleRole: 'weekend',
    sourceSetupId: baseline.id,
    weekendId: weekend.id,
    lockedAt: undefined,
    changeLog: [],
    screenshots: [...(source.screenshots || [])],
    updatedAt: now,
  };

  return {
    baseline,
    weekendSetup,
    weekend: {
      ...weekend,
      status: 'active',
      sourceSetupId: source.id,
      baselineSetupId: baseline.id,
      activeSetupId: weekendSetup.id,
      setupId: baseline.id,
      setupName: baseline.versionLabel,
      updatedAt: now,
    },
  };
}

export interface FinishedWeekendLifecycle {
  weekend: RaceWeekend;
  setups: Setup[];
  finalSetup: Setup;
  currentSetup: Setup;
}

export function finishWeekendLifecycle(
  weekend: RaceWeekend,
  setups: Setup[],
  now: string,
): FinishedWeekendLifecycle | null {
  if (isWeekendFinished(weekend)) return null;
  const active = setups.find(item => item.id === weekend.activeSetupId);
  if (!active || isSetupLocked(active)) return null;

  const versionDate = weekend.date || 'Race Weekend';
  const lockedWeekendSetup: Setup = {
    ...cloneSetup(active),
    lifecycleRole: 'weekend',
    lockedAt: now,
    updatedAt: now,
  };
  const finalSetup: Setup = {
    ...cloneSetup(active),
    id: `setup-final-${weekend.id}`,
    versionLabel: `${versionDate} Final Setup`,
    lifecycleRole: 'final',
    sourceSetupId: active.id,
    weekendId: weekend.id,
    lockedAt: now,
    updatedAt: now,
  };
  const currentSetup: Setup = {
    ...cloneSetup(finalSetup),
    id: `setup-current-${weekend.id}`,
    versionLabel: `Current Setup — ${versionDate}`,
    lifecycleRole: 'current',
    sourceSetupId: finalSetup.id,
    weekendId: undefined,
    lockedAt: undefined,
    changeLog: [],
    screenshots: [...(finalSetup.screenshots || [])],
    updatedAt: now,
  };
  const nextSetups = [
    currentSetup,
    finalSetup,
    ...setups.map(item => item.id === active.id ? lockedWeekendSetup : item),
  ];

  return {
    finalSetup,
    currentSetup,
    setups: nextSetups,
    weekend: {
      ...weekend,
      status: 'finished',
      finishedAt: now,
      finalSetupId: finalSetup.id,
      updatedAt: now,
    },
  };
}

export function mergeTimestampedRecords<T extends { id: string; updatedAt?: string }>(
  local: T[],
  cloud: T[],
): T[] {
  const merged = new Map(local.map(item => [item.id, item]));
  for (const remote of cloud) {
    const localItem = merged.get(remote.id);
    if (!localItem || (remote.updatedAt || '') >= (localItem.updatedAt || '')) {
      merged.set(remote.id, remote);
    }
  }
  return [...merged.values()];
}
