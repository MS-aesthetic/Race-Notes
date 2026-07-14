import assert from 'node:assert/strict';
import { INITIAL_ACTIVE_SESSION } from '../src/data';
import { makeBlankSetup } from '../src/lib/setupCompat';
import {
  applyExplicitCornerField,
  applyQuickAdjust,
  filterLoadSessions,
  isQuickAdjustRunAvailable,
  normalizeQuarterInch,
  normalizeSpringRate,
  resolveQuickAdjustTarget,
  stepQuarterInch,
  stepSpringRate,
  type QuickAdjustResult,
} from '../src/lib/quickAdjust';
import { selectRaceWeekendSetupForSelection } from '../src/lib/setupLifecycle';
import { setupFromCloudRow, setupToCloudRow } from '../src/lib/setupSync';
import type { ActiveSession, RaceWeekend, ShockSession } from '../src/types';

const now = '2026-07-14T03:00:00.000Z';
const expectSuccess = (result: QuickAdjustResult): Extract<QuickAdjustResult, { ok: true }> => {
  if (result.ok === false) throw new Error(result.error);
  return result;
};
const setup = makeBlankSetup({
  id: 'setup-weekend-w1', chassis: 'Test Car', track: 'Test Track', date: 'Jul 13, 2026',
  carType: 'Dirt Late Model', carId: 'car-a', lifecycleRole: 'weekend', weekendId: 'w1',
  jbarFrameHeight: '9.00', jbarPinionHeight: '8.00', changeLog: [],
});
setup.lf.spring = '500 lb';
const session: ActiveSession = {
  ...INITIAL_ACTIVE_SESSION, id: 'run-1', weekendId: 'w1', name: 'Test 1', adjustments: [],
};
const weekend: RaceWeekend = {
  id: 'w1', name: 'Test', track: 'Test Track', date: 'Jul 13, 2026',
  sessions: [{ id: 'run-1' } as RaceWeekend['sessions'][number]],
  status: 'active', activeSetupId: setup.id,
};

const selectedCarSetup = makeBlankSetup({
  id: 'setup-current-car-b', chassis: 'Wrong Car', track: '', date: '', carType: 'A Mod',
  carId: 'car-b', lifecycleRole: 'current', gear: 'wrong-car-gear',
});
const target = resolveQuickAdjustTarget('w1', [weekend], [selectedCarSetup, setup], session);
assert.equal(target.ok, true);
if (target.ok) assert.equal(target.setup.id, setup.id);
assert.equal(resolveQuickAdjustTarget('w1', [weekend], [selectedCarSetup], session).ok, false);
assert.equal(resolveQuickAdjustTarget('w1', [{ ...weekend, sessions: [] }], [setup], session).ok, false);

assert.equal(normalizeSpringRate('500 lb'), '500');
assert.equal(stepSpringRate('500 lb', 25), '525');
assert.equal(normalizeSpringRate('510 lb'), '510');
assert.equal(normalizeSpringRate('510.5 lb'), '510.5');
assert.equal(stepSpringRate('510 lb', 25), '535');
assert.equal(stepSpringRate('510 lb', -25), '485');
assert.equal(stepSpringRate('', 25), null);
assert.equal(stepSpringRate('unknown', 25), null);
assert.equal(stepQuarterInch('9 in', -0.25), '8.75');
assert.equal(normalizeQuarterInch('9.10 in'), '9.1');
assert.equal(stepQuarterInch('9.10 in', 0.25), '9.35');
assert.equal(stepQuarterInch('9.10 in', -0.25), '8.85');
assert.equal(stepQuarterInch('9.125 in', 0.25), '9.375');

assert.equal(selectRaceWeekendSetupForSelection(null, null, null, selectedCarSetup)?.id, selectedCarSetup.id);
assert.equal(selectRaceWeekendSetupForSelection('missing', null, null, selectedCarSetup), null);
assert.equal(selectRaceWeekendSetupForSelection('w1', { ...weekend, status: 'finished' }, null, selectedCarSetup), null);
assert.equal(selectRaceWeekendSetupForSelection('w1', weekend, setup, selectedCarSetup)?.id, setup.id);
assert.equal(isQuickAdjustRunAvailable(weekend, setup, session, 'w1'), true);
assert.equal(isQuickAdjustRunAvailable({ ...weekend, sessions: [] }, setup, session, 'w1'), false);
assert.equal(isQuickAdjustRunAvailable({ ...weekend, status: 'finished' }, setup, session, 'w1'), false);
assert.equal(isQuickAdjustRunAvailable(weekend, selectedCarSetup, session, 'w1'), false);

const spring = expectSuccess(applyQuickAdjust(setup, session, { kind: 'spring-rate', corner: 'lf', delta: 25 }, [weekend], now, 'q1'));
assert.equal(spring.setup.lf.spring, '525');
assert.equal(spring.setup.changeLog?.length, 1);
assert.equal(spring.session.adjustments.length, 1);
assert.equal(spring.change.runId, 'run-1');
assert.equal(spring.adjustment.runId, 'run-1');

const offGridFrameSetup = { ...spring.setup, jbarFrameHeight: '9.10 in', jbarPinionHeight: '8.15 in' };
const frameUp = expectSuccess(applyQuickAdjust(offGridFrameSetup, spring.session, { kind: 'jbar-frame', delta: 0.25 }, [weekend], now, 'frame-up'));
assert.equal(frameUp.setup.jbarFrameHeight, '9.35');
const frameDown = expectSuccess(applyQuickAdjust(frameUp.setup, frameUp.session, { kind: 'jbar-frame', delta: -0.25 }, [weekend], now, 'frame-down'));
assert.equal(frameDown.setup.jbarFrameHeight, '9.1');
const pinionUp = expectSuccess(applyQuickAdjust(frameDown.setup, frameDown.session, { kind: 'jbar-pinion', delta: 0.25 }, [weekend], now, 'pinion-up'));
assert.equal(pinionUp.setup.jbarPinionHeight, '8.4');
const pinionDown = expectSuccess(applyQuickAdjust(pinionUp.setup, pinionUp.session, { kind: 'jbar-pinion', delta: -0.25 }, [weekend], now, 'pinion-down'));
assert.equal(pinionDown.setup.jbarPinionHeight, '8.15');

const rounds = expectSuccess(applyQuickAdjust(spring.setup, spring.session, { kind: 'spring-rounds', corner: 'lf', delta: 0.5 }, [weekend], now, 'q2'));
assert.equal(rounds.setup.lf.springRounds, '0.5');
assert.equal(rounds.setup.lf.rideHeightNeedsReview, true);
assert.equal(applyExplicitCornerField(rounds.setup.lf, 'shock', 'new shock').rideHeightNeedsReview, true);
const measured = applyExplicitCornerField(rounds.setup.lf, 'loadCtoC', '16.875');
assert.equal(measured.rideHeightNeedsReview, false);

const loads: ShockSession[] = [
  { id: 'a-lf', label: 'A LF', corner: 'LF', springRate: '500', shock: 'LF-1', date: now, points: [], carId: 'car-a' },
  { id: 'a-rf', label: 'A RF', corner: 'RF', springRate: '500', shock: 'RF-1', date: now, points: [], carId: 'car-a' },
  { id: 'b-lf', label: 'B LF', corner: 'LF', springRate: '500', shock: 'LF-2', date: now, points: [], carId: 'car-b' },
];
assert.deepEqual(filterLoadSessions(loads, setup, 'lf').map(item => item.id), ['a-lf']);

const note = expectSuccess(applyQuickAdjust(rounds.setup, rounds.session, { kind: 'shock-note', corner: 'lf', value: 'Two clicks out' }, [weekend], now, 'q3'));
const binding = expectSuccess(applyQuickAdjust(note.setup, note.session, { kind: 'shock-load', corner: 'lf', loadSessionId: 'a-lf', loadSessionLabel: 'A LF' }, [weekend], now, 'q4'));
assert.equal(binding.setup.lf.shockNote, 'Two clicks out');
assert.equal(binding.setup.lf.boundGraphId, 'a-lf');
assert.equal(binding.change.loadSessionId, 'a-lf');
assert.equal(binding.setup.changeLog?.length, 4);
assert.equal(binding.session.adjustments.length, 4);

let rapidSetup = binding.setup;
let rapidSession = binding.session;
for (let index = 0; index < 8; index += 1) {
  const rapidNow = new Date(Date.parse(now) + index * 1000).toISOString();
  const result = expectSuccess(applyQuickAdjust(rapidSetup, rapidSession, { kind: 'spring-rounds', corner: 'rr', delta: 0.5 }, [weekend], rapidNow, `rapid-${index}`));
  rapidSetup = result.setup;
  rapidSession = result.session;
}
assert.equal(rapidSetup.rr.springRounds, '4.0');
assert.equal(rapidSetup.changeLog?.length, 5);
assert.equal(rapidSession.adjustments.length, 5);
assert.equal(new Set(rapidSetup.changeLog?.map(change => change.id)).size, 5);
assert.equal(new Set(rapidSession.adjustments.map(change => change.id)).size, 5);
const rapidChange = rapidSetup.changeLog?.find(change => change.id === 'rapid-0-setup');
const rapidAdjustment = rapidSession.adjustments.find(change => change.id === 'rapid-0-run');
assert.ok(rapidChange);
assert.ok(rapidAdjustment);
assert.equal(rapidChange?.before, '0.0');
assert.equal(rapidChange?.after, '4.0');
assert.equal(rapidChange?.timestamp, '2026-07-14T03:00:07.000Z');
assert.equal(rapidAdjustment?.before, '0.0');
assert.equal(rapidAdjustment?.after, '4.0');
assert.equal(rapidAdjustment?.value, '0.0 to 4.0');
assert.equal(rapidSetup.changeLog?.at(-1)?.id, 'rapid-0-setup');
assert.equal(rapidSession.adjustments.at(0)?.id, 'rapid-0-run');
assert.equal(rapidSetup.updatedAt, '2026-07-14T03:00:07.000Z');
assert.equal(rapidSession.updatedAt, '2026-07-14T03:00:07.000Z');
const persistedRapidSession = JSON.parse(JSON.stringify(rapidSession)) as ActiveSession;
assert.equal(persistedRapidSession.adjustments.length, 5);
assert.equal(persistedRapidSession.adjustments[0].id, 'rapid-0-run');
assert.equal(persistedRapidSession.adjustments[0].value, '0.0 to 4.0');

const distinctFieldBase = makeBlankSetup({
  id: 'distinct-fields', chassis: 'Test Car', track: '', date: '', carType: 'Dirt Late Model',
  carId: 'car-a', lifecycleRole: 'weekend', weekendId: 'w1', changeLog: [],
});
const distinctFieldSession = { ...session, adjustments: [] };
const distinctGear = expectSuccess(applyQuickAdjust(distinctFieldBase, distinctFieldSession, { kind: 'gear', value: '6.20' }, [weekend], now, 'distinct-gear'));
const distinctRounds = expectSuccess(applyQuickAdjust(distinctGear.setup, distinctGear.session, { kind: 'spring-rounds', corner: 'lf', delta: 0.5 }, [weekend], now, 'distinct-rounds'));
assert.equal(distinctRounds.setup.changeLog?.length, 2);
assert.equal(distinctRounds.session.adjustments.length, 2);

const runOne = expectSuccess(applyQuickAdjust(distinctFieldBase, distinctFieldSession, { kind: 'gear', value: '6.20' }, [weekend], now, 'run-one'));
const runTwoSession = { ...runOne.session, id: 'run-2', adjustments: [] };
const runTwoWeekend = { ...weekend, sessions: [...weekend.sessions, { id: 'run-2' } as RaceWeekend['sessions'][number]] };
const runTwo = expectSuccess(applyQuickAdjust(runOne.setup, runTwoSession, { kind: 'gear', value: '6.30' }, [runTwoWeekend], now, 'run-two'));
assert.equal(runTwo.setup.changeLog?.length, 2);
assert.deepEqual(runTwo.setup.changeLog?.map(change => change.runId), ['run-1', 'run-2']);

const otherOne = expectSuccess(applyQuickAdjust(distinctFieldBase, distinctFieldSession, { kind: 'other', value: 'Moved battery' }, [weekend], now, 'other-one'));
const otherTwo = expectSuccess(applyQuickAdjust(otherOne.setup, otherOne.session, { kind: 'other', value: 'Changed fuel load' }, [weekend], now, 'other-two'));
assert.equal(otherTwo.setup.changeLog?.length, 2);
assert.equal(otherTwo.session.adjustments.length, 2);

const reversalUp = expectSuccess(applyQuickAdjust(distinctFieldBase, distinctFieldSession, { kind: 'spring-rounds', corner: 'rr', delta: 0.5 }, [weekend], now, 'reversal-up'));
const reversalDown = expectSuccess(applyQuickAdjust(reversalUp.setup, reversalUp.session, { kind: 'spring-rounds', corner: 'rr', delta: -0.5 }, [weekend], now, 'reversal-down'));
assert.equal(reversalDown.setup.changeLog?.length, 1);
assert.equal(reversalDown.session.adjustments.length, 1);
assert.equal(reversalDown.setup.changeLog?.[0].before, '0.0');
assert.equal(reversalDown.setup.changeLog?.[0].after, '0.0');
assert.equal(reversalDown.session.adjustments[0].value, '0.0 to 0.0');

const firstLoad = expectSuccess(applyQuickAdjust(distinctFieldBase, distinctFieldSession, { kind: 'shock-load', corner: 'lf', loadSessionId: 'load-one', loadSessionLabel: 'Load One' }, [weekend], now, 'load-one'));
const secondLoad = expectSuccess(applyQuickAdjust(firstLoad.setup, firstLoad.session, { kind: 'shock-load', corner: 'lf', loadSessionId: 'load-two', loadSessionLabel: 'Load Two' }, [weekend], '2026-07-14T03:01:00.000Z', 'load-two'));
assert.equal(secondLoad.setup.changeLog?.length, 1);
assert.equal(secondLoad.session.adjustments.length, 1);
assert.equal(secondLoad.change.id, 'load-one-setup');
assert.equal(secondLoad.change.before, '—');
assert.equal(secondLoad.change.after, 'Load Two');
assert.equal(secondLoad.change.note, 'Load Two');
assert.equal(secondLoad.change.loadSessionId, 'load-two');
assert.equal(secondLoad.adjustment.id, 'load-one-run');
assert.equal(secondLoad.adjustment.loadSessionId, 'load-two');
assert.equal(secondLoad.setup.lf.boundGraphId, 'load-two');

const row = setupToCloudRow(rapidSetup, 'user-1');
const pulled = setupFromCloudRow(row);
assert.equal(pulled.rr.springRounds, '4.0');
assert.equal(pulled.rr.rideHeightNeedsReview, true);
assert.equal(pulled.lf.shockNote, 'Two clicks out');
assert.equal(pulled.lf.boundGraphId, 'a-lf');
assert.equal(pulled.changeLog?.at(-1)?.runId, 'run-1');
assert.equal(pulled.changeLog?.length, 5);
assert.equal(pulled.changeLog?.at(-1)?.id, 'rapid-0-setup');
assert.equal(pulled.changeLog?.at(-1)?.before, '0.0');
assert.equal(pulled.changeLog?.at(-1)?.after, '4.0');

const locked = { ...rapidSetup, lockedAt: now };
assert.equal(applyQuickAdjust(locked, rapidSession, { kind: 'gear', value: '6.20' }, [weekend], now, 'locked').ok, false);
assert.equal(applyQuickAdjust({ ...rapidSetup, lifecycleRole: 'current' }, rapidSession, { kind: 'gear', value: '6.20' }, [weekend], now, 'current').ok, false);

console.log('Chunk 7 Quick Adjust harness PASS');
