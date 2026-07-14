import assert from 'node:assert/strict';
import { INITIAL_ACTIVE_SESSION } from '../src/data';
import { makeBlankSetup } from '../src/lib/setupCompat';
import {
  applyExplicitCornerField,
  applyQuickAdjust,
  filterLoadSessions,
  normalizeSpringRate,
  resolveQuickAdjustTarget,
  stepQuarterInch,
  stepSpringRate,
  type QuickAdjustResult,
} from '../src/lib/quickAdjust';
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
assert.equal(stepSpringRate('', 25), null);
assert.equal(stepSpringRate('unknown', 25), null);
assert.equal(stepQuarterInch('9 in', -0.25), '8.75');

const spring = expectSuccess(applyQuickAdjust(setup, session, { kind: 'spring-rate', corner: 'lf', delta: 25 }, [weekend], now, 'q1'));
assert.equal(spring.setup.lf.spring, '525');
assert.equal(spring.setup.changeLog?.length, 1);
assert.equal(spring.session.adjustments.length, 1);
assert.equal(spring.change.runId, 'run-1');
assert.equal(spring.adjustment.runId, 'run-1');

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
  const result = expectSuccess(applyQuickAdjust(rapidSetup, rapidSession, { kind: 'spring-rounds', corner: 'rr', delta: 0.5 }, [weekend], now, `rapid-${index}`));
  rapidSetup = result.setup;
  rapidSession = result.session;
}
assert.equal(rapidSetup.rr.springRounds, '4.0');
assert.equal(rapidSetup.changeLog?.length, 12);
assert.equal(rapidSession.adjustments.length, 12);
assert.equal(new Set(rapidSetup.changeLog?.map(change => change.id)).size, 12);
assert.equal(new Set(rapidSession.adjustments.map(change => change.id)).size, 12);

const row = setupToCloudRow(rapidSetup, 'user-1');
const pulled = setupFromCloudRow(row);
assert.equal(pulled.rr.springRounds, '4.0');
assert.equal(pulled.rr.rideHeightNeedsReview, true);
assert.equal(pulled.lf.shockNote, 'Two clicks out');
assert.equal(pulled.lf.boundGraphId, 'a-lf');
assert.equal(pulled.changeLog?.at(-1)?.runId, 'run-1');

const locked = { ...rapidSetup, lockedAt: now };
assert.equal(applyQuickAdjust(locked, rapidSession, { kind: 'gear', value: '6.20' }, [weekend], now, 'locked').ok, false);
assert.equal(applyQuickAdjust({ ...rapidSetup, lifecycleRole: 'current' }, rapidSession, { kind: 'gear', value: '6.20' }, [weekend], now, 'current').ok, false);

console.log('Chunk 7 Quick Adjust harness PASS');
