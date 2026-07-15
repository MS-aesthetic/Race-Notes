import assert from 'node:assert/strict';
import { makeBlankSetup, pickWeekendSourceSetup } from '../src/lib/setupCompat';
import {
  displayLifecycleText,
  displayVersionLabel,
  finishWeekendLifecycle,
  isSetupLocked,
  isWeekendFinished,
  lifecycleLabel,
  lifecycleSetupId,
  mergeTimestampedRecords,
  selectRaceWeekendSetup,
  startWeekendLifecycle,
  withSetupDiffLog,
} from '../src/lib/setupLifecycle';
import { setupToCloudRow } from '../src/lib/setupSync';
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
assert.equal(started.baseline.versionLabel, 'Jul 13, 2026 Starting Setup');
assert.equal(started.weekendSetup.versionLabel, 'Jul 13, 2026 Live-Trackside Setup');
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
assert.equal(finished.finalSetup.versionLabel, 'Jul 13, 2026 Finished Setup');
assert.equal(isSetupLocked(finished.finalSetup), true);
assert.equal(finished.finalSetup.gear, '6.14');
assert.equal(finished.currentSetup.lifecycleRole, 'current');
assert.equal(isSetupLocked(finished.currentSetup), false);
assert.equal(finished.currentSetup.gear, '6.14');
assert.deepEqual(finished.currentSetup.changeLog, []);
assert.equal(lifecycleSetupId(finished.weekend), finished.finalSetup.id);
assert.equal(finishWeekendLifecycle(finished.weekend, finished.setups, finishedAt), null);

const featureWeekend: RaceWeekend = {
  ...baseWeekend,
  id: 'wknd-feature',
  name: 'Eldora Feature',
  sessions: [{ id: 'feature-1', type: 'Feature 1', sessionType: 'Feature' } as RaceWeekend['sessions'][number]],
};
const featureStarted = startWeekendLifecycle(featureWeekend, source, startedAt);
const featureFinished = finishWeekendLifecycle(
  featureStarted.weekend,
  [source, featureStarted.baseline, featureStarted.weekendSetup],
  finishedAt,
);
assert.ok(featureFinished);
assert.equal(featureFinished.finalSetup.versionLabel, 'Jul 13, 2026 Raced Setup');
assert.equal(lifecycleLabel('final', featureWeekend), 'Raced Setup');
assert.equal(lifecycleLabel('final', { ...baseWeekend, sessions: [{ id: 'legacy-feature', type: 'Feature' } as RaceWeekend['sessions'][number]] }), 'Raced Setup');
assert.equal(lifecycleLabel('final', { ...baseWeekend, sessions: [{ id: 'legacy-feature-name', name: 'Feat. 1', type: '' } as RaceWeekend['sessions'][number]] }), 'Raced Setup');
assert.equal(lifecycleLabel('final', { ...baseWeekend, sessions: [{ id: 'legacy-a-main', name: '', type: 'A-MAIN' } as RaceWeekend['sessions'][number]] }), 'Raced Setup');
assert.equal(lifecycleLabel('final', baseWeekend), 'Finished Setup');
assert.equal(lifecycleLabel('final'), 'Finished Setup');
assert.equal(displayLifecycleText('Copied from Jul 13, 2026 Baseline Setup'), 'Copied from Jul 13, 2026 Starting Setup');
assert.equal(displayLifecycleText('No setup baseline'), 'No starting setup');
assert.equal(displayLifecycleText('Race Weekend Starting Setup'), 'Race Day Starting Setup');

const legacyLabelSetup = { ...source, versionLabel: '2026-07-12 Baseline Setup' };
const legacyLabelJson = JSON.stringify(legacyLabelSetup);
const legacyCloudRow = setupToCloudRow(legacyLabelSetup, 'user-1');
assert.equal(displayVersionLabel(legacyLabelSetup), '2026-07-12 Starting Setup');
assert.equal(displayVersionLabel({ ...legacyLabelSetup, versionLabel: '2026-07-12 Weekend Setup' }), '2026-07-12 Live-Trackside Setup');
assert.equal(displayVersionLabel({ ...legacyLabelSetup, versionLabel: '2026-07-12 Final Setup', lifecycleRole: 'final' }), '2026-07-12 Finished Setup');
assert.equal(displayVersionLabel({ ...legacyLabelSetup, versionLabel: undefined }), '');
assert.equal(JSON.stringify(legacyLabelSetup), legacyLabelJson);
assert.deepEqual(setupToCloudRow(legacyLabelSetup, 'user-1'), legacyCloudRow);

const carB = makeBlankSetup({
  ...source,
  id: 'setup-car-b',
  carId: 'car-2',
  chassis: 'Car B',
  gear: '6.00',
  updatedAt: '2026-07-13T19:00:00.000Z',
});
assert.equal(
  pickWeekendSourceSetup([started.weekendSetup, carB], 'car-2', '', started.weekendSetup.id)?.id,
  carB.id,
  'new Car B weekend must not inherit active Car A weekend setup',
);
assert.equal(pickWeekendSourceSetup([started.weekendSetup], 'car-2', '', started.weekendSetup.id), null);
assert.equal(
  selectRaceWeekendSetup(started.weekend, null, carB),
  null,
  'active event with a missing owned Setup must not receive the selected car setup',
);
assert.equal(selectRaceWeekendSetup(null, null, carB)?.id, carB.id);

const legacyWeekend: RaceWeekend = {
  id: 'wknd-legacy',
  name: 'Legacy Test',
  track: 'Brownstown',
  date: 'Jul 10, 2026',
  sessions: [],
  setupId: source.id,
};
const legacyFinished = finishWeekendLifecycle(legacyWeekend, [source], finishedAt);
assert.ok(legacyFinished);
assert.equal(legacyFinished.weekend.status, 'finished');
assert.equal(legacyFinished.weekend.sessions.length, 0);
assert.equal(legacyFinished.weekend.activeSetupId, `setup-weekend-${legacyWeekend.id}`);
assert.equal(legacyFinished.setups.find(item => item.id === source.id)?.lockedAt, undefined);
assert.equal(isSetupLocked(legacyFinished.finalSetup), true);
assert.equal(isSetupLocked(legacyFinished.currentSetup), false);

const partialRetry = finishWeekendLifecycle(
  started.weekend,
  [...finished.setups, finished.finalSetup, finished.currentSetup],
  '2026-07-14T00:30:00.000Z',
);
assert.ok(partialRetry, 'partial local finish must be retryable');
assert.equal(partialRetry.weekend.status, 'finished');
const partialIds = partialRetry.setups.map(item => item.id);
assert.equal(new Set(partialIds).size, partialIds.length, 'finish retry must dedupe deterministic IDs');
assert.equal(partialIds.filter(id => id === `setup-final-${started.weekend.id}`).length, 1);
assert.equal(partialIds.filter(id => id === `setup-current-${started.weekend.id}`).length, 1);
assert.equal(
  partialRetry.setups.find(item => item.id === started.weekendSetup.id)?.lockedAt,
  finished.setups.find(item => item.id === started.weekendSetup.id)?.lockedAt,
  'retry must preserve Weekend Setup lock time',
);
assert.equal(partialRetry.finalSetup.lockedAt, finished.finalSetup.lockedAt);
assert.equal(partialRetry.finalSetup.updatedAt, finished.finalSetup.updatedAt);
assert.equal(partialRetry.currentSetup.updatedAt, finished.currentSetup.updatedAt);
assert.deepEqual(partialRetry.finalSetup.changeLog, finished.finalSetup.changeLog);

const unlockedGearSeven = {
  ...started.weekendSetup,
  gear: '7.00',
  updatedAt: '2026-07-14T01:00:00.000Z',
};
const staleFinal = {
  ...finished.finalSetup,
  gear: '6.00',
  updatedAt: '2026-07-13T23:30:00.000Z',
};
const staleCurrent = {
  ...finished.currentSetup,
  gear: '6.00',
  updatedAt: '2026-07-13T23:30:00.000Z',
};
const staleRecovery = finishWeekendLifecycle(
  started.weekend,
  [source, started.baseline, unlockedGearSeven, staleFinal, staleCurrent],
  '2026-07-14T02:00:00.000Z',
);
assert.ok(staleRecovery);
assert.equal(staleRecovery.finalSetup.gear, '7.00', 'unlocked Weekend bytes must replace stale Final');
assert.equal(staleRecovery.currentSetup.gear, '7.00', 'unlocked Weekend bytes must replace stale Current');
assert.equal(new Set(staleRecovery.setups.map(item => item.id)).size, staleRecovery.setups.length);

const relationshipUnlocked = {
  ...finished.setups.find(item => item.id === started.weekendSetup.id)!,
  lockedAt: undefined,
};
assert.equal(
  isSetupLocked(relationshipUnlocked, [finished.weekend]),
  true,
  'Weekend Setup linked to a finished weekend stays immutable when lockedAt is missing',
);
assert.equal(isSetupLocked(relationshipUnlocked, [started.weekend]), false);

const danglingLegacyWeekend: RaceWeekend = {
  ...legacyWeekend,
  id: 'wknd-dangling-legacy',
  setupId: 'deleted-car-a-setup',
};
assert.equal(
  finishWeekendLifecycle(danglingLegacyWeekend, [carB], finishedAt, carB),
  null,
  'dangling explicit legacy setup must not borrow active setup from another car',
);

const noSetupLegacy: RaceWeekend = {
  id: 'wknd-no-setup',
  name: 'No Setup Test',
  track: 'Local Track',
  date: 'Jul 9, 2026',
  sessions: [],
};
const blankFallback = makeBlankSetup({
  id: `setup-baseline-${noSetupLegacy.id}`,
  carId: 'car-2',
  lifecycleRole: 'baseline',
  versionLabel: 'Jul 9, 2026 Starting Setup',
  weekendId: noSetupLegacy.id,
  lockedAt: finishedAt,
});
const noSetupFinished = finishWeekendLifecycle(noSetupLegacy, [], finishedAt, blankFallback);
assert.ok(noSetupFinished);
assert.equal(noSetupFinished.weekend.setupId, blankFallback.id);
assert.equal(noSetupFinished.setups.some(item => item.id === blankFallback.id), true);
assert.equal(noSetupFinished.finalSetup.gear, '', 'no-link legacy Finish must use exact blank values');
assert.notEqual(noSetupFinished.finalSetup.gear, carB.gear, 'no-link legacy Finish must not borrow selected-car bytes');
const noSetupPartialRetry = finishWeekendLifecycle(
  noSetupLegacy,
  noSetupFinished.setups,
  '2026-07-14T00:45:00.000Z',
);
assert.ok(noSetupPartialRetry);
assert.equal(noSetupPartialRetry.weekend.setupId, blankFallback.id);
assert.equal(noSetupPartialRetry.weekend.baselineSetupId, blankFallback.id);

const localNewer = { ...finished.weekend, updatedAt: '2026-07-14T00:00:00.000Z' };
const cloudOlder = { ...started.weekend, updatedAt: '2026-07-13T22:00:00.000Z' };
assert.equal(mergeTimestampedRecords([localNewer], [cloudOlder])[0].status, 'finished');
const cloudNewer = { ...cloudOlder, name: 'Cloud rename', updatedAt: '2026-07-14T01:00:00.000Z' };
assert.equal(mergeTimestampedRecords([localNewer], [cloudNewer])[0].name, 'Cloud rename');

console.log('chunk6b-lifecycle-harness: PASS');
