// [11] Smart session sequencing — pure helpers, no React.
// A race night usually runs Test/Hot Laps → Qualifying → Heat → Feature.
// (The data model has no separate B-Main type; Heat advances to Feature.)
// `suggestNextSession` looks at what has already been logged and proposes
// the next session type, its auto-numbered name, and prefill data carried
// from the most recent session (track condition, pressures, tires).
import type { SessionRecord, SessionType, TireDetails, TrackConditionPreset } from '../types';
import { formatPressureBlock, pressureBlockHasValue } from './setupSteps';
import { inferSessionType } from './tireHistory';

/** Session type → short display code (existing app naming convention). */
export const SESSION_CODES: Record<string, string> = {
  'Test': 'Test',
  'Hot Laps': 'HL',
  'Qualifying': 'Qual',
  'Heat Race': 'Heat',
  'Feature': 'Feat.',
};

/**
 * Auto-numbered session name, matching the historical convention:
 * first of a type is just the code ("Heat"), later ones get a counter
 * ("Heat 2", "HL 3"). Deterministic for a given session list.
 */
export function buildSessionNameFrom(sessions: SessionRecord[], type: SessionType): string {
  const code = SESSION_CODES[type] ?? type;
  const existing = sessions.filter(s => s.name === code || s.name.startsWith(`${code} `));
  if (existing.length === 0) return code;
  return `${code} ${existing.length + 1}`;
}

export interface SessionPrefill {
  trackCondition?: TrackConditionPreset;
  pressures?: { lf: string; rf: string; lr: string; rr: string };
  tires?: { lf: TireDetails; rf: TireDetails; lr: TireDetails; rr: TireDetails };
  pressureSourceNote?: string;
}

export interface SessionSuggestion {
  type: SessionType;
  name: string;
  prefill: SessionPrefill;
}

/** Keep session prefill tied to current car's weekend setup or tire evidence. */
export function filterCompatibleSessions(
  sessions: SessionRecord[],
  activeTireIds: ReadonlySet<string>,
  weekendSetupMatches: boolean,
  hasUniqueSameCarSetupUsed: (session: SessionRecord) => boolean = () => false,
): SessionRecord[] {
  return sessions.filter(session => weekendSetupMatches || hasUniqueSameCarSetupUsed(session) || (['lf', 'rf', 'lr', 'rr'] as const)
    .some(corner => activeTireIds.has(session.tires?.[corner]?.tireId || '')));
}

/** Race-night stage rank. Test and Hot Laps share the opening stage. */
const STAGE_RANK: Record<SessionType, number> = {
  'Test': 0,
  'Hot Laps': 0,
  'Qualifying': 1,
  'Heat Race': 2,
  'Feature': 3,
};

/** What follows each stage. After a Feature, another Feature run is assumed. */
const NEXT_BY_RANK: SessionType[] = ['Qualifying', 'Heat Race', 'Feature', 'Feature'];

/**
 * Suggest the next session for a weekend.
 * `sessions` is the weekend's session list, newest first (the app prepends
 * new records). With no sessions yet, the night opens with Hot Laps.
 */
export function suggestNextSession(sessions: SessionRecord[]): SessionSuggestion {
  if (!sessions || sessions.length === 0) {
    return { type: 'Hot Laps', name: buildSessionNameFrom([], 'Hot Laps'), prefill: {} };
  }

  const maxRank = sessions.reduce(
    (acc, s) => Math.max(acc, STAGE_RANK[inferSessionType(s)] ?? 0),
    0,
  );
  const type = NEXT_BY_RANK[Math.min(maxRank, NEXT_BY_RANK.length - 1)];

  // Carry conditions/pressures/tires forward from the most recent session.
  const latest = sessions[0];
  const prefill: SessionPrefill = {};
  if (latest.trackConditionPreset) prefill.trackCondition = latest.trackConditionPreset;
  const recordedPressures = formatPressureBlock(latest.pressures);
  const legacyTirePressures = formatPressureBlock(latest.tires ? {
    lf: latest.tires.lf.airPressure,
    rf: latest.tires.rf.airPressure,
    lr: latest.tires.lr.airPressure,
    rr: latest.tires.rr.airPressure,
  } : undefined);
  const carriedPressures = pressureBlockHasValue(recordedPressures) ? recordedPressures : legacyTirePressures;
  if (pressureBlockHasValue(carriedPressures)) {
    prefill.pressures = carriedPressures;
    prefill.pressureSourceNote = `Pressures carried from ${latest.name}`;
  }
  if (latest.tires) {
    prefill.tires = {
      lf: { ...latest.tires.lf },
      rf: { ...latest.tires.rf },
      lr: { ...latest.tires.lr },
      rr: { ...latest.tires.rr },
    };
  }

  return { type, name: buildSessionNameFrom(sessions, type), prefill };
}
