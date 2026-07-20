import type { CornerSetup, RaceWeekend, Setup, SetupChange, SetupSnapshot, SetupSnapshotCorner, SetupSnapshotDiff } from '../types';
import { inferSessionType } from './tireHistory';

const cloneSetup = (setup: Setup): Setup => JSON.parse(JSON.stringify(setup)) as Setup;

export function lifecycleLabel(role: Setup['lifecycleRole'], weekend?: RaceWeekend): string {
  if (role === 'baseline') return 'Starting Setup';
  if (role === 'weekend') return 'Live-Trackside Setup';
  if (role === 'final') {
    const racedFeature = weekend?.sessions.some(session => inferSessionType(session) === 'Feature');
    return racedFeature ? 'Raced Setup' : 'Finished Setup';
  }
  return 'Current Setup';
}

/** Map lifecycle terms inside legacy display-only text without changing persisted bytes. */
export function displayLifecycleText(stored: string): string {
  return stored
    .replace(/No setup baseline/gi, 'No starting setup')
    .replace(/^Race Weekend (?=(?:Baseline|Weekend|Final|Starting|Live-Trackside|Finished|Raced|Current) Setup$)/, 'Race Day ')
    .replace(/Baseline Setup/g, 'Starting Setup')
    .replace(/Weekend Setup/g, 'Live-Trackside Setup')
    .replace(/Final Setup/g, 'Finished Setup');
}

/** Map legacy stored labels at render time without changing persisted bytes. */
export function displayVersionLabel(setup: Setup): string {
  return displayLifecycleText(setup.versionLabel || '');
}

export const isWeekendFinished = (weekend: RaceWeekend | null | undefined): boolean =>
  weekend?.status === 'finished';

export const isSetupLocked = (
  setup: Setup | null | undefined,
  weekends: readonly RaceWeekend[] = [],
): boolean =>
  !!setup && (setup.lifecycleRole === 'baseline'
    || setup.lifecycleRole === 'final'
    || !!setup.lockedAt
    || (setup.lifecycleRole === 'weekend'
      && !!setup.weekendId
      && weekends.some(weekend => weekend.id === setup.weekendId && isWeekendFinished(weekend))));

export type SetupEditabilityReason =
  | 'historical-role'
  | 'locked'
  | 'finished-weekend'
  | 'in-play-elsewhere'
  | null;

export interface SetupEditability {
  editable: boolean;
  deletable: boolean;
  reason: SetupEditabilityReason;
}

/** One edit/delete policy shared by the Setups UI and persistence boundary. */
export const getSetupEditability = (
  setup: Setup,
  weekends: readonly RaceWeekend[] = [],
  activeEventSetupId?: string,
): SetupEditability => {
  if (setup.lifecycleRole === 'baseline' || setup.lifecycleRole === 'final') {
    return { editable: false, deletable: false, reason: 'historical-role' };
  }
  if (setup.lockedAt) {
    return { editable: false, deletable: false, reason: 'locked' };
  }
  if (setup.lifecycleRole === 'weekend'
    && !!setup.weekendId
    && weekends.some(weekend => weekend.id === setup.weekendId && isWeekendFinished(weekend))) {
    return { editable: false, deletable: false, reason: 'finished-weekend' };
  }
  if (activeEventSetupId && setup.id === activeEventSetupId) {
    return { editable: false, deletable: false, reason: 'in-play-elsewhere' };
  }
  return { editable: true, deletable: true, reason: null };
};

const setupPointerKeys = [
  'setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId',
] as const;

export interface SetupDeletionReferenceRepair {
  setups: Setup[];
  weekends: RaceWeekend[];
  changedSetupIds: string[];
  changedWeekendIds: string[];
  timestamp: string | null;
}

/**
 * Clear only deleted-setup relationships. Historical sessions are deliberately
 * shared by reference so their setupId/snapshot bytes cannot be rewritten.
 */
export const repairSetupDeletionReferences = (
  setups: readonly Setup[],
  weekends: readonly RaceWeekend[],
  removedSetupIds: ReadonlySet<string>,
): SetupDeletionReferenceRepair => {
  const changedSetups = setups.filter(setup => !!setup.sourceSetupId && removedSetupIds.has(setup.sourceSetupId));
  const changedWeekends = weekends.filter(weekend =>
    setupPointerKeys.some(key => !!weekend[key] && removedSetupIds.has(weekend[key]!)),
  );
  if (changedSetups.length === 0 && changedWeekends.length === 0) {
    return {
      setups: [...setups],
      weekends: [...weekends],
      changedSetupIds: [],
      changedWeekendIds: [],
      timestamp: null,
    };
  }

  const newestAffected = Math.max(
    ...[...changedSetups, ...changedWeekends]
      .map(item => Date.parse(item.updatedAt || ''))
      .filter(Number.isFinite),
    Number.NEGATIVE_INFINITY,
  );
  const timestamp = new Date(Math.max(Date.now(), newestAffected + 1)).toISOString();
  const changedSetupIds = new Set(changedSetups.map(setup => setup.id));
  const changedWeekendIds = new Set(changedWeekends.map(weekend => weekend.id));

  return {
    setups: setups.map(setup => changedSetupIds.has(setup.id)
      ? { ...setup, sourceSetupId: undefined, updatedAt: timestamp }
      : setup),
    weekends: weekends.map(weekend => {
      if (!changedWeekendIds.has(weekend.id)) return weekend;
      const repaired: RaceWeekend = { ...weekend, updatedAt: timestamp };
      for (const key of setupPointerKeys) {
        if (repaired[key] && removedSetupIds.has(repaired[key]!)) delete repaired[key];
      }
      return repaired;
    }),
    changedSetupIds: [...changedSetupIds],
    changedWeekendIds: [...changedWeekendIds],
    timestamp,
  };
};

/** An active event may only receive its owned Weekend Setup, never the car selector's setup. */
export const selectRaceWeekendSetup = (
  activeWeekend: RaceWeekend | null | undefined,
  eventSetup: Setup | null,
  activeCarSetup: Setup | null,
): Setup | null => activeWeekend ? eventSetup : activeCarSetup;

/** Raw weekend selection blocks generic selected-car fallback, even when stale/finished. */
export const selectRaceWeekendSetupForSelection = (
  activeWeekendId: string | null,
  selectedWeekend: RaceWeekend | null | undefined,
  eventSetup: Setup | null,
  activeCarSetup: Setup | null,
): Setup | null => {
  if (!activeWeekendId) return activeCarSetup;
  if (!selectedWeekend || isWeekendFinished(selectedWeekend)) return null;
  return eventSetup;
};

export const lifecycleSetupId = (weekend: RaceWeekend | null | undefined): string | undefined =>
  weekend?.finalSetupId || weekend?.activeSetupId || weekend?.baselineSetupId || weekend?.setupId;

const displayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const setupSnapshotTopLevelTuneFields = [
  'gear', 'toe', 'jbar', 'jbarFrameHeight', 'jbarPinionHeight', 'frontStagger', 'rearStagger',
  'pullBarFrameHole', 'pullBarRearHole', 'pullBarAngle', 'notes',
] as const;

const setupSnapshotCornerTuneFields = [
  'spring', 'shock', 'loadWeight', 'loadWeightUnit', 'loadCtoC', 'loadCtoCUnit',
  'caster', 'casterUnit', 'camber', 'camberUnit', 'tireComp', 'tireSize', 'toe',
  'stagger', 'staggerUnit', 'wheelSpacer', 'wheelSpacerUnit', 'tirePress', 'tirePressUnit',
  'backspacing', 'springHeight', 'springHeightUnit', 'load', 'loadUnit', 'topBarLength',
  'bottomBarLength', 'topBarHFrame', 'topBarHBird', 'topBarAngRH', 'topBarAngRHUnit',
  'topBarAngFD', 'topBarAngFDUnit', 'botBarHFrame', 'botBarHBird', 'bottomBarAngRH',
  'bottomBarAngRHUnit', 'bottomBarAngFD', 'bottomBarAngFDUnit', 'bottomBarAngle',
  'bottomBarAngleUnit', 'droop', 'droopUnit', 'preload', 'preloadUnit', 'springRounds',
  'shockNote',
] as const satisfies readonly (keyof SetupSnapshotCorner)[];

const clonePlainData = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const captureSnapshotCorner = (corner: CornerSetup): SetupSnapshotCorner => {
  const tunableCorner = Object.fromEntries(
    setupSnapshotCornerTuneFields
      .filter(field => corner[field] !== undefined)
      .map(field => [field, corner[field]]),
  ) as SetupSnapshotCorner;
  return clonePlainData(tunableCorner);
};

/** Capture plain, detached setup state for one newly-created session. */
export function captureSetupSnapshot(setup: Setup): SetupSnapshot {
  const snapshot: SetupSnapshot = {
    chassis: setup.chassis,
    track: setup.track,
    date: setup.date,
    carType: setup.carType,
    versionLabel: setup.versionLabel,
    lf: captureSnapshotCorner(setup.lf),
    rf: captureSnapshotCorner(setup.rf),
    lr: captureSnapshotCorner(setup.lr),
    rr: captureSnapshotCorner(setup.rr),
    gear: setup.gear,
    toe: setup.toe,
    jbar: setup.jbar,
    jbarFrameHeight: setup.jbarFrameHeight,
    jbarPinionHeight: setup.jbarPinionHeight,
    frontStagger: setup.frontStagger,
    rearStagger: setup.rearStagger,
    pullBarFrameHole: setup.pullBarFrameHole,
    pullBarRearHole: setup.pullBarRearHole,
    pullBarAngle: setup.pullBarAngle,
    notes: setup.notes,
  };
  return clonePlainData(snapshot);
}

const diffFieldLabel = (field: string): string =>
  field.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase());

/** Return deterministic tuning-only rows without mutating either snapshot. */
export function diffSetupSnapshots(
  before: SetupSnapshot | null | undefined,
  after: SetupSnapshot | null | undefined,
): SetupSnapshotDiff[] {
  if (!before || !after) return [];

  const rows: SetupSnapshotDiff[] = [];
  for (const field of setupSnapshotTopLevelTuneFields) {
    if (JSON.stringify(before[field]) === JSON.stringify(after[field])) continue;
    rows.push({
      label: diffFieldLabel(field),
      field,
      before: displayValue(before[field]),
      after: displayValue(after[field]),
    });
  }

  for (const corner of ['lf', 'rf', 'lr', 'rr'] as const) {
    for (const field of setupSnapshotCornerTuneFields) {
      const beforeValue = before[corner][field];
      const afterValue = after[corner][field];
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) continue;
      rows.push({
        label: `${corner.toUpperCase()} ${diffFieldLabel(field)}`,
        corner,
        field,
        before: displayValue(beforeValue),
        after: displayValue(afterValue),
      });
    }
  }

  return rows;
}

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
      if (field === 'pressureSourceNote' || field === 'rideHeightNeedsReview') return;
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
  const versionDate = weekend.date || 'Race Day';

  const baseline: Setup = {
    ...cloneSetup(source),
    id: baselineId,
    track: weekend.track,
    date: weekend.date,
    versionLabel: `${versionDate} ${lifecycleLabel('baseline')}`,
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
    versionLabel: `${versionDate} ${lifecycleLabel('weekend')}`,
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
  fallbackSetup?: Setup | null,
): FinishedWeekendLifecycle | null {
  if (isWeekendFinished(weekend)) return null;
  const versionDate = weekend.date || 'Race Day';
  const weekendSetupId = `setup-weekend-${weekend.id}`;
  const finalSetupId = `setup-final-${weekend.id}`;
  const currentSetupId = `setup-current-${weekend.id}`;
  const linkedActive = weekend.activeSetupId
    ? setups.find(item => item.id === weekend.activeSetupId) ?? null
    : null;
  const recoveredActive = !weekend.activeSetupId
    ? setups.find(item => item.id === weekendSetupId) ?? null
    : null;
  const linkedLegacySource = weekend.setupId
    ? setups.find(item => item.id === weekend.setupId) ?? null
    : null;
  const legacySource = !weekend.activeSetupId && !recoveredActive
    ? (weekend.setupId ? linkedLegacySource : fallbackSetup ?? null)
    : null;

  let active = linkedActive ?? recoveredActive;
  if (active) {
    const matchingWeekendSnapshot = active.lifecycleRole === 'weekend'
      && active.weekendId === weekend.id;
    if (!matchingWeekendSnapshot) return null;
  } else if (legacySource) {
    active = {
      ...cloneSetup(legacySource),
      id: weekendSetupId,
      track: weekend.track,
      date: weekend.date,
      versionLabel: `${versionDate} ${lifecycleLabel('weekend')}`,
      lifecycleRole: 'weekend',
      sourceSetupId: legacySource.id,
      weekendId: weekend.id,
      lockedAt: undefined,
      changeLog: [],
      screenshots: [...(legacySource.screenshots || [])],
      updatedAt: now,
    };
  } else {
    return null;
  }

  const recoveringPartialFinish = !!active.lockedAt;
  const existingFinal = recoveringPartialFinish
    ? setups.find(item => item.id === finalSetupId
      && item.lifecycleRole === 'final'
      && item.weekendId === weekend.id
      && item.sourceSetupId === active.id
      && !!item.lockedAt) ?? null
    : null;
  const existingCurrent = recoveringPartialFinish
    ? setups.find(item => item.id === currentSetupId
      && item.lifecycleRole === 'current'
      && item.sourceSetupId === finalSetupId
      && !item.lockedAt) ?? null
    : null;
  const lockedWeekendSetup: Setup = {
    ...cloneSetup(active),
    id: active.id,
    lifecycleRole: 'weekend',
    weekendId: weekend.id,
    lockedAt: active.lockedAt || now,
    updatedAt: recoveringPartialFinish ? (active.updatedAt || active.lockedAt || now) : now,
  };
  const finalSetup: Setup = existingFinal ? {
    ...cloneSetup(existingFinal),
    id: finalSetupId,
    versionLabel: `${versionDate} ${lifecycleLabel('final', weekend)}`,
    lifecycleRole: 'final',
    sourceSetupId: active.id,
    weekendId: weekend.id,
  } : {
    ...cloneSetup(active),
    id: finalSetupId,
    versionLabel: `${versionDate} ${lifecycleLabel('final', weekend)}`,
    lifecycleRole: 'final',
    sourceSetupId: active.id,
    weekendId: weekend.id,
    lockedAt: now,
    updatedAt: now,
  };
  const currentSetup: Setup = existingCurrent ? {
    ...cloneSetup(existingCurrent),
    id: currentSetupId,
    versionLabel: `${lifecycleLabel('current')} — ${versionDate}`,
    lifecycleRole: 'current',
    sourceSetupId: finalSetup.id,
    weekendId: undefined,
    lockedAt: undefined,
  } : {
    ...cloneSetup(finalSetup),
    id: currentSetupId,
    versionLabel: `${lifecycleLabel('current')} — ${versionDate}`,
    lifecycleRole: 'current',
    sourceSetupId: finalSetup.id,
    weekendId: undefined,
    lockedAt: undefined,
    changeLog: [],
    screenshots: [...(finalSetup.screenshots || [])],
    updatedAt: now,
  };
  const replaceIds = new Set([
    active.id,
    weekendSetupId,
    finalSetupId,
    currentSetupId,
  ]);
  const persistedLegacySource = legacySource && !setups.some(item => item.id === legacySource.id)
    ? [legacySource]
    : [];
  const nextSetups = [
    currentSetup,
    finalSetup,
    lockedWeekendSetup,
    ...persistedLegacySource,
    ...setups.filter(item => !replaceIds.has(item.id)),
  ];
  const baselineId = weekend.baselineSetupId
    || weekend.setupId
    || legacySource?.id
    || active.sourceSetupId;
  const baselineSource = baselineId
    ? nextSetups.find(item => item.id === baselineId) ?? legacySource
    : legacySource;

  return {
    finalSetup,
    currentSetup,
    setups: nextSetups,
    weekend: {
      ...weekend,
      status: 'finished',
      finishedAt: now,
      sourceSetupId: weekend.sourceSetupId || legacySource?.id || active.sourceSetupId,
      baselineSetupId: baselineId,
      activeSetupId: active.id,
      setupId: baselineId,
      setupName: weekend.setupName || baselineSource?.versionLabel || baselineSource?.chassis,
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
