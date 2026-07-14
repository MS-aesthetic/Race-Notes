import assert from 'node:assert/strict';
import { makeBlankSetup } from '../src/lib/setupCompat';
import {
  finishWeekendLifecycle,
  isSetupLocked,
  isWeekendFinished,
  lifecycleSetupId,
  mergeTimestampedRecords,
  startWeekendLifecycle,
  withSetupDiffLog,
} from '../src/lib/setupLifecycle';
import type { RaceWeekend } from '../src/types';

const startedAt = '2026-07-13T20:00:00.000Z';
const finishedAt = '2026-07-13T23:00:00.000Z';
const source = makeBlankSetup({
  id: 'setup-current-source',
  chassis: 'Rocket XR1',
  track: 'Shop',
  date: 'Jul 12, 2026',
  carType: 'Dirt Late Model',
  carId: 'car-1',
  lifecycleRole: 'current',
  versionLabel: 'Current Setup',
  jbarFrameHeight: '9.00',
  jbarPinionHeight: '8.00',
  updatedAt: '2026-07-12T20:00:00.000Z',
});
const baseWeekend: RaceWeekend = {
  id: 'wknd-1',
  name: 'Eldora Test',
  track: 'Eldora',
  date: 'Jul 13, 2026',
  sessions: [],
};

const started = startWeekendLifecycle(baseWeekend, source, startedAt);
assert.notEqual(started.baseline.id, started.weekendSetup.id);
assert.equal(started.weekend.setupId, started.baseline.id);
assert.equal(started.weekend.activeSetupId, started.weekendSetup.id);
assert.equal(started.baseline.versionLabel, 'Jul 13, 2026 Baseline Setup');
assert.equal(started.weekendSetup.versionLabel, 'Jul 13, 2026 Weekend Setup');
assert.equal(isSetupLocked(started.baseline), true);
assert.equal(isSetupLocked(started.weekendSetup), false);
assert.equal(isWeekendFinished(started.weekend), false);
assert.equal(started.baseline.lf.loadWeight, '500');
assert.equal(started.weekendSetup.rf.camber, '-4');

const adjusted = withSetupDiffLog(started.weekendSetup, {
  ...started.weekendSetup,
  gear: '6.14',
  rr: { ...started.weekendSetup.rr, spring: '225' },
}, '2026-07-13T21:00:00.000Z');
assert.equal(adjusted.changeLog?.length, 2);
assert.equal(adjusted.changeLog?.some(change => change.field === 'gear'), true);
assert.equal(adjusted.changeLog?.some(change => change.corner === 'rr' && change.field === 'spring'), true);

const finished = finishWeekendLifecycle(
  started.weekend,
  [source, started.baseline, adjusted],
  finishedAt,
);
assert.ok(finished);
assert.equal(finished.weekend.status, 'finished');
assert.equal(finished.weekend.finishedAt, finishedAt);
assert.equal(finished.weekend.sessions.length, 0, 'zero-run test day must finish');
assert.equal(finished.finalSetup.lifecycleRole, 'final');
assert.equal(isSetupLocked(finished.finalSetup), true);
assert.equal(finished.finalSetup.gear, '6.14');
assert.equal(finished.currentSetup.lifecycleRole, 'current');
assert.equal(isSetupLocked(finished.currentSetup), false);
assert.equal(finished.currentSetup.gear, '6.14');
assert.deepEqual(finished.currentSetup.changeLog, []);
assert.equal(lifecycleSetupId(finished.weekend), finished.finalSetup.id);
assert.equal(finishWeekendLifecycle(finished.weekend, finished.setups, finishedAt), null);

const localNewer = { ...finished.weekend, updatedAt: '2026-07-14T00:00:00.000Z' };
const cloudOlder = { ...started.weekend, updatedAt: '2026-07-13T22:00:00.000Z' };
assert.equal(mergeTimestampedRecords([localNewer], [cloudOlder])[0].status, 'finished');
const cloudNewer = { ...cloudOlder, name: 'Cloud rename', updatedAt: '2026-07-14T01:00:00.000Z' };
assert.equal(mergeTimestampedRecords([localNewer], [cloudNewer])[0].name, 'Cloud rename');

console.log('chunk6b-lifecycle-harness: PASS');
