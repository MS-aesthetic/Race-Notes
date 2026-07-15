import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { RaceWeekend, Setup, TireInventoryItem } from '../src/types';
import { buildTireUsageCsv, getRecentPressureHistory, getTireTotalLaps, getTireUsageHistory, syncTireLifecycle } from '../src/lib/tireHistory';
import { parseTireSize } from '../src/lib/tireSize';
import { filterCompatibleSessions, suggestNextSession } from '../src/lib/sessionSequence';
import { setupUsedUniquelyMatchesCar } from '../src/lib/setupCompat';
import { calculateTireStagger, mergeImportedSetupPressure, resolveLinkedTireSizes } from '../src/lib/setupSteps';

const setupA = { id: 'setup-a', carId: 'car-a', chassis: 'A', track: '', date: '', carType: '', lf: {}, rf: {}, lr: {}, rr: {} } as Setup;
const setupB = { id: 'setup-b', carId: 'car-b', chassis: 'B', track: '', date: '', carType: '', lf: {}, rf: {}, lr: {}, rr: {} } as Setup;
const tires = [
  { id: 'tire-a', carId: 'car-a', tireNumber: '1', size: '86 1/2', compound: 'A', wheelBackspacing: '2', durometer: '' },
  { id: 'tire-b', carId: 'car-b', tireNumber: '2', size: '87', compound: 'B', wheelBackspacing: '2', durometer: '' },
  { id: 'tire-c', carId: 'car-a', tireNumber: '3', size: '87 1/2', compound: 'C', wheelBackspacing: '2', durometer: '' },
] as TireInventoryItem[];

const makeSession = (name: string, pressure: string, tireId: string) => ({
  id: name, type: 'Test', name, track: 'Track', condition: '', bestLap: '',
  pressures: { lf: pressure, rf: pressure, lr: pressure, rr: pressure },
  tires: {
    lf: { compound: '', size: '', airPressure: pressure, tireId }, rf: { compound: '', size: '', airPressure: pressure, tireId },
    lr: { compound: '', size: '', airPressure: pressure, tireId }, rr: { compound: '', size: '', airPressure: pressure, tireId },
  },
});

const weekends: RaceWeekend[] = [
  { id: 'wk-a', name: 'A', track: 'Track', date: 'Jul 12, 2026', setupId: 'setup-a', sessions: [makeSession('new', '12 psi', 'tire-a'), makeSession('old', '11 psi', 'tire-a')] },
  { id: 'wk-b', name: 'B', track: 'Track', date: 'Jul 13, 2026', setupId: 'setup-b', sessions: [makeSession('foreign', '99 psi', 'tire-b')] },
];

const history = getRecentPressureHistory(weekends, [setupA, setupB], tires, 'car-a');
assert.match(buildTireUsageCsv(tires, weekends).split('\n')[0], /Race Day/);
assert.equal(history.lf.length, 2);
assert.equal(history.lf[0].pressure, '12 psi');
assert.equal(history.lf[0].sessionName, 'new');
assert.equal(history.lf.some(row => row.pressure === '99 psi'), false);
const sameDayOutOfOrder: RaceWeekend[] = [{
  id: 'wk-order', name: 'Order', track: 'Track', date: 'Jul 12, 2026', setupId: 'setup-a',
  sessions: [
    { ...makeSession('session-rec-1783890000000', '10 psi', 'tire-a'), name: 'Older ID' },
    { ...makeSession('session-rec-1783990000000', '13 psi', 'tire-a'), name: 'Newer ID' },
  ],
}];
assert.equal(getRecentPressureHistory(sameDayOutOfOrder, [setupA], tires, 'car-a', 1).lf[0]?.pressure, '13 psi');
const historicalEntryCreatedLater: RaceWeekend[] = [
  { id: 'wk-current', name: 'Current', track: 'Track', date: 'Jul 13, 2026', setupId: 'setup-a', sessions: [makeSession('session-rec-1783900000000', '12 psi', 'tire-a')] },
  { id: 'wk-history', name: 'History', track: 'Track', date: 'Jul 13, 2025', setupId: 'setup-a', sessions: [makeSession('session-rec-1883900000000', '99 psi', 'tire-a')] },
];
assert.equal(getRecentPressureHistory(historicalEntryCreatedLater, [setupA], tires, 'car-a', 1).lf[0]?.pressure, '12 psi');
const tireSwapHistory: RaceWeekend[] = [
  { id: 'wk-old-tire', name: 'Old Tire', track: 'Track', date: 'Jul 12, 2026', setupId: 'setup-a', sessions: [makeSession('old-tire', '11 psi', 'tire-a')] },
  { id: 'wk-new-tire', name: 'New Tire', track: 'Track', date: 'Jul 13, 2026', setupId: 'setup-a', sessions: [makeSession('new-tire', '15 psi', 'tire-c')] },
];
assert.equal(getRecentPressureHistory(tireSwapHistory, [setupA], tires, 'car-a', 1, { lf: 'tire-a' }).lf[0]?.pressure, '11 psi');
assert.equal(parseTireSize('86 1/2') - parseTireSize('86.5'), 0);
const linkedSizeSetup = {
  ...setupA,
  lf: { ...setupA.lf, tireSize: '80', tireInventoryId: 'tire-a' },
  rf: { ...setupA.rf, tireSize: '81' },
  lr: { ...setupA.lr, tireSize: '82' },
  rr: { ...setupA.rr, tireSize: '83' },
};
const linkedSizes = resolveLinkedTireSizes(linkedSizeSetup, tires.filter(tire => tire.carId === 'car-a'));
assert.equal(linkedSizes.lf, '86 1/2');
assert.equal(linkedSizes.rf, '81');
assert.equal(calculateTireStagger(linkedSizes.rf, linkedSizes.lf), -5.5);

const sixRuns: RaceWeekend[] = [{ id: 'wk-many', name: 'Many', track: '', date: 'Jul 14, 2026', setupId: 'setup-a', sessions: Array.from({ length: 6 }, (_, index) => makeSession(`run-${index}`, `${index} psi`, 'tire-a')) }];
assert.equal(getRecentPressureHistory(sixRuns, [setupA], tires, 'car-a').rr.length, 5);
const lifecycled = syncTireLifecycle(tires, weekends);
assert.equal(lifecycled.find(tire => tire.id === 'tire-a')?.heatCycles, 1);
assert.equal(getTireTotalLaps(getTireUsageHistory('tire-a', weekends)), 40);
assert.deepEqual(getRecentPressureHistory([], [], tires, 'car-a').lf, []);
assert.deepEqual(getRecentPressureHistory(weekends, [setupA], tires, null).rr, []);
const namedAssociation: RaceWeekend[] = [{
  id: 'wk-named', name: 'Named', track: 'Track', date: 'Jul 15, 2026', sessions: [{ ...makeSession('named-history', '14 psi', 'foreign'), setupUsed: 'A' }],
}];
assert.equal(getRecentPressureHistory(namedAssociation, [setupA], tires, 'car-a').lf[0]?.pressure, '14 psi');
const duplicateNameSetup = { ...setupB, id: 'setup-b-duplicate', chassis: 'A' };
assert.equal(setupUsedUniquelyMatchesCar('A', [setupA], 'car-a'), true);
assert.equal(setupUsedUniquelyMatchesCar('A', [setupA, duplicateNameSetup], 'car-a'), false);
assert.deepEqual(getRecentPressureHistory(namedAssociation, [setupA, duplicateNameSetup], tires, 'car-a').lf, []);

const suggestion = suggestNextSession([makeSession('Heat', '10 psi', 'tire-a')]);
assert.equal(suggestion.prefill.pressureSourceNote, 'Pressures carried from Heat');
const blankPressureSession = makeSession('Blank', '', 'tire-a');
assert.equal(suggestNextSession([blankPressureSession]).prefill.pressureSourceNote, undefined);
const legacyTirePressureSession = { ...makeSession('Legacy tire pressure', '', 'tire-a'), pressures: undefined };
legacyTirePressureSession.tires.lf.airPressure = '9 psi';
assert.equal(suggestNextSession([legacyTirePressureSession]).prefill.pressures?.lf, '9 psi');
assert.equal(suggestNextSession([legacyTirePressureSession]).prefill.pressureSourceNote, 'Pressures carried from Legacy tire pressure');
assert.deepEqual(suggestNextSession([]).prefill.pressures, undefined);
assert.deepEqual(filterCompatibleSessions([makeSession('local', '10 psi', 'tire-a'), makeSession('foreign', '10 psi', 'tire-b')], new Set(['tire-a']), false).map(session => session.id), ['local']);
assert.equal(filterCompatibleSessions([makeSession('weekend-bound', '10 psi', 'tire-b')], new Set(), true).length, 1);
assert.equal(filterCompatibleSessions([makeSession('named-setup', '10 psi', 'tire-b')], new Set(), false, session => session.name === 'named-setup').length, 1);
const master = [...tires];
const changed = master.map(tire => tire.id === 'tire-a' ? { ...tire, compound: 'NEW' } : tire);
assert.deepEqual(changed.find(tire => tire.id === 'tire-b'), tires[1]);
const added = [{ ...tires[0], id: 'tire-new' }, ...tires];
assert.deepEqual(added.find(tire => tire.id === 'tire-b'), tires[1]);
assert.deepEqual(tires.filter(tire => tire.id !== 'tire-a'), [tires[1], tires[2]]);

assert.deepEqual(
  mergeImportedSetupPressure('', '12.5 psi', '12.5 psi'),
  { imported: '', tirePressure: '12.5 psi', blockPressure: '12.5 psi' },
);
assert.deepEqual(
  mergeImportedSetupPressure(undefined, '11 psi', '10.5 psi'),
  { imported: '', tirePressure: '11 psi', blockPressure: '10.5 psi' },
);
assert.deepEqual(
  mergeImportedSetupPressure('14', '11 psi', '10.5 psi'),
  { imported: '14 psi', tirePressure: '14 psi', blockPressure: '14 psi' },
);

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.match(appSource, /formatPressureBlock/);
assert.match(appSource, /pressureBlockHasValue\(defaultPressures\)/);
assert.doesNotMatch(appSource, /\$\{sessionSetup\?\.[\s\S]{0,100}tirePress \|\| ''\} psi/);
const weekendSource = readFileSync(new URL('../src/components/RaceWeekendView.tsx', import.meta.url), 'utf8');
assert.match(weekendSource, /let importedPressure = false/);
assert.match(weekendSource, /pressureSourceNote: importedPressure/);
assert.match(weekendSource, /mergeImportedSetupPressure\(/);
assert.match(weekendSource, /airPressure: pressure\.tirePressure/);
assert.match(weekendSource, /updatedPressures\[corner\] = pressure\.blockPressure/);
assert.match(weekendSource, /: session\.pressureSourceNote/);
assert.match(weekendSource, /hasPressure \? 'Adjusted in this run' : undefined/);
assert.match(appSource, /resolveSessionPressureBlock\(rec\.pressures, rec\.tires\)/);
const tiresSource = readFileSync(new URL('../src/components/TiresSubView.tsx', import.meta.url), 'utf8');
assert.match(tiresSource, /activeCarId \? byActiveCar/);
assert.match(tiresSource, /tires\.map\(tire => tire\.id === existing\.id/);
assert.match(tiresSource, /tires\.filter\(tire => tire\.id !== id\)/);
assert.match(tiresSource, /onBlur=.*normalizeSize/);
assert.match(tiresSource, /BS \{tire\.wheelBackspacing\}/);
assert.match(tiresSource, /Usage History —/);
assert.match(tiresSource, /resolveLinkedTireSizes\(activeSetup, displayedTires\)/);
assert.match(tiresSource, /Last pressure/);
assert.match(tiresSource, /Cycles/);
assert.match(tiresSource, /Est\. laps/);
assert.doesNotMatch(tiresSource, /last five/i);
assert.match(tiresSource, /flex min-w-0 flex-wrap items-start/);
assert.match(tiresSource, /grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2/);
assert.match(tiresSource, /max-h-\[calc\(100dvh-2rem\)\]/);
assert.equal((weekendSource.match(/\{session\.pressureSourceNote &&/g) || []).length, 1);
const smasherSource = readFileSync(new URL('../src/components/SmasherLoadsView.tsx', import.meta.url), 'utf8');
assert.match(smasherSource, /activeCarId \? byActiveCar<ShockSession>\(sessions, activeCarId\) : \[\]/);

console.log('CHUNK5_TIRES_HARNESS PASS');
