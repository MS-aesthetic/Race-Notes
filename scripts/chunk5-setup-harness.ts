import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Setup } from '../src/types';
import { cloneSetup, makeBlankSetup, normalizeSetup, pickImmediatePriorSetupForCar, pickLatestSetupForCar } from '../src/lib/setupCompat';
import { calculateTireStagger, SETUP_STEPS, formatPressureBlock, formatPsiValue, formatStoredNumber, fourBarAdjustmentId, fourBarAdjustmentLabel, legacyValueNote, mirrorPressureBlockToTires, parseStoredNumber, pressureBlockHasValue, resolveSessionPressureBlock, setupPressureBlock } from '../src/lib/setupSteps';

const setup = (id: string, carId: string, date: string, tireId = 'tire-a'): Setup => ({
  id, carId, chassis: id, track: 'Track', date, carType: 'Modified',
  lf: { spring: '500', shock: '5/5', tireComp: 'A', tireSize: '86 1/2', tirePress: '12', tireInventoryId: tireId },
  rf: { spring: '500', shock: '5/5', tireComp: 'A', tireSize: '87', tirePress: '13', tireInventoryId: tireId },
  lr: { spring: '200', shock: '5/5', tireComp: 'B', tireSize: '88', tirePress: '10', tireInventoryId: tireId, load: '600', topBarHBird: 'Hole 2' },
  rr: { spring: '200', shock: '5/5', tireComp: 'B', tireSize: '89', tirePress: '11', tireInventoryId: tireId, topBarAngRH: '12°' },
});

const legacy = setup('legacy', 'car-a', 'Jul 01, 2026');
const normalized = normalizeSetup(legacy);
assert.equal(normalized.lr.loadWeight, '600');
assert.equal(normalized.lr.topBarHBird, 'Hole 2');

const first = setup('first', 'car-a', 'Jul 02, 2026');
const newer = setup('newer', 'car-a', 'Jul 10, 2026');
const foreign = setup('foreign', 'car-b', 'Jul 20, 2026', 'tire-b');
assert.equal(pickLatestSetupForCar([first, foreign, newer], 'car-a')?.id, 'newer');
assert.equal(pickLatestSetupForCar([foreign], 'car-a'), null);
const equalA = setup('a', 'car-a', 'not a date');
const equalB = setup('b', 'car-a', 'not a date');
assert.equal(pickLatestSetupForCar([equalA, equalB], 'car-a')?.id, 'a');
const sameDateA = setup('same-a', 'car-a', 'Jul 11, 2026');
const sameDateB = setup('same-b', 'car-a', 'Jul 11, 2026');
assert.equal(pickLatestSetupForCar([sameDateB, sameDateA], 'car-a')?.id, 'same-b');
assert.equal(pickLatestSetupForCar([equalA, newer], 'car-a')?.id, 'a');
assert.equal(pickLatestSetupForCar([newer, equalA], 'car-a')?.id, 'newer');
const middle = setup('middle', 'car-a', 'Jul 05, 2026');
assert.equal(pickImmediatePriorSetupForCar([newer, middle, first], middle)?.id, 'first');
assert.equal(pickImmediatePriorSetupForCar([newer, middle, first], first), null);

const copied = cloneSetup(newer, { id: 'copy', chassis: 'Copy', carId: 'car-a' });
copied.lr.topBarHBird = '9';
assert.equal(newer.lr.topBarHBird, 'Hole 2');
assert.equal(copied.lf.tireInventoryId, 'tire-a');
const crossCar = cloneSetup(newer, { id: 'cross', carId: 'car-b' });
assert.equal(crossCar.lf.tireInventoryId, undefined);
assert.equal(crossCar.rr.tireInventoryId, undefined);
const blank = makeBlankSetup({ id: 'blank', carId: 'car-c', chassis: 'Blank', date: 'Jul 12, 2026', carType: 'Modified' });
assert.equal(blank.carId, 'car-c');
assert.notEqual(blank.lf.tireSize, newer.lf.tireSize);
assert.deepEqual(['lf', 'rf', 'lr', 'rr'].map(corner => blank[corner as 'lf'].loadWeight), ['500', '500', '500', '500']);
assert.deepEqual(['lf', 'rf', 'lr', 'rr'].map(corner => blank[corner as 'lf'].loadCtoC), ['17', '17', '17', '17']);
assert.deepEqual(['lf', 'rf', 'lr', 'rr'].map(corner => blank[corner as 'lf'].tirePress), ['10', '10', '10', '10']);
assert.equal(blank.lf.caster, '3');
assert.equal(blank.rf.caster, '3');
assert.equal(blank.lf.camber, '4');
assert.equal(blank.rf.camber, '-4');
assert.equal(blank.lr.caster, undefined);

assert.equal(parseStoredNumber('Hole 3'), 3);
assert.equal(parseStoredNumber('12°'), 12);
assert.equal(parseStoredNumber(''), '');
assert.equal(parseStoredNumber('garbage'), '');
assert.equal(legacyValueNote('garbage'), 'garbage');
assert.equal(formatStoredNumber(12.125, SETUP_STEPS.loadCtoC), '12.125');
assert.equal(formatStoredNumber(12.13, SETUP_STEPS.loadCtoC), '12.125');
assert.equal(formatStoredNumber(-1, SETUP_STEPS.tirePress), '0.0');
assert.equal(formatPsiValue(''), '');
assert.equal(formatPsiValue('12'), '12 psi');
assert.equal(formatPsiValue('12 psi'), '12 psi');
assert.equal(formatPsiValue('12 PSI'), '12 psi');
assert.equal(formatPsiValue('12 psi psi'), '12 psi');
assert.equal(formatPsiValue('garbage'), '');
const partialPressures = setupPressureBlock({
  ...newer,
  lf: { ...newer.lf, tirePress: '12 psi' },
  rf: { ...newer.rf, tirePress: '' },
  lr: { ...newer.lr, tirePress: '10' },
  rr: { ...newer.rr, tirePress: '' },
});
assert.deepEqual(partialPressures, { lf: '12 psi', rf: '', lr: '10 psi', rr: '' });
assert.equal(pressureBlockHasValue(partialPressures), true);
assert.equal(pressureBlockHasValue(formatPressureBlock(undefined)), false);
const mirroredTires = mirrorPressureBlockToTires({
  lf: { compound: 'A', size: '86', airPressure: 'old' },
  rf: { compound: 'A', size: '87', airPressure: 'old' },
  lr: { compound: 'B', size: '88', airPressure: 'old' },
  rr: { compound: 'B', size: '89', airPressure: 'old' },
}, partialPressures);
assert.deepEqual(
  ['lf', 'rf', 'lr', 'rr'].map(corner => mirroredTires[corner as keyof typeof mirroredTires].airPressure),
  ['12 psi', '', '10 psi', ''],
);
const legacyTires = {
  lf: { compound: 'A', size: '86', airPressure: '9' },
  rf: { compound: 'A', size: '87', airPressure: '10 psi' },
  lr: { compound: 'B', size: '88', airPressure: '' },
  rr: { compound: 'B', size: '89', airPressure: '11 PSI' },
};
assert.deepEqual(resolveSessionPressureBlock(undefined, legacyTires), {
  lf: '9 psi', rf: '10 psi', lr: '', rr: '11 psi',
});
const canonicalRecorded = { lf: '12', rf: '', lr: '10 psi', rr: '' };
assert.deepEqual(resolveSessionPressureBlock(canonicalRecorded, legacyTires), {
  lf: '12 psi', rf: '', lr: '10 psi', rr: '',
});
assert.deepEqual(
  mirrorPressureBlockToTires(legacyTires, resolveSessionPressureBlock(canonicalRecorded, legacyTires)),
  {
    lf: { ...legacyTires.lf, airPressure: '12 psi' },
    rf: { ...legacyTires.rf, airPressure: '' },
    lr: { ...legacyTires.lr, airPressure: '10 psi' },
    rr: { ...legacyTires.rr, airPressure: '' },
  },
);
assert.equal(calculateTireStagger('86 1/2', '86'), 0.5);
assert.equal(calculateTireStagger('', '86'), null);
assert.equal(fourBarAdjustmentId('rr', 'topBarHBird'), 'fourbar-rr-topBarHBird');
assert.equal(fourBarAdjustmentLabel('lr', 'topBarAngFD'), 'LR top angle at full droop');
assert.equal(fourBarAdjustmentLabel('rr', 'bottomBarAngRH'), 'RR bottom angle at ride height');

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.match(appSource, /handleUpdateSession\(current =>/);
assert.match(appSource, /const updatedSession = typeof update === 'function'/);
assert.match(appSource, /preserveInfoToast/);
assert.match(appSource, /const pressures = setupPressureBlock\(nextActive\)/);
assert.match(appSource, /pressureSourceNote: hasPressureSource \? sourceNote : undefined/);
assert.match(appSource, /else if \(!preserveInfoToast\) setInfoToast\(null\)/);
assert.match(appSource, /mirrorPressureBlockToTires\(data\.prefillTires \?\? defaultTires, initialPressures\)/);
const canonicalBlock = appSource.slice(appSource.indexOf('const handleUpdateSession'), appSource.indexOf('// Session weather helpers'));
assert.match(canonicalBlock, /activeSessionRef\.current/);
assert.match(canonicalBlock, /weekendsRef\.current/);
assert.match(canonicalBlock, /sessionCloudQueueRef\.current/);
assert.match(canonicalBlock, /setActiveSession\(updatedSession\)/);
assert.match(canonicalBlock, /setWeekends\(updatedWeekends\)/);
assert.doesNotMatch(canonicalBlock, /setActiveSession\s*\(\s*\(/);
assert.doesNotMatch(canonicalBlock, /setWeekends\s*\(\s*\(/);
const restoreBlock = appSource.slice(appSource.indexOf('const handleSelectRecentSession'), appSource.indexOf('// ---- Auth gate'));
assert.match(restoreBlock, /resolveSessionPressureBlock\(rec\.pressures, rec\.tires\)/);
assert.match(restoreBlock, /mirrorPressureBlockToTires\([\s\S]*restoredPressures\)/);
const refWrite = restoreBlock.indexOf('activeSessionRef.current = restoredSession');
const stateWrite = restoreBlock.indexOf('setActiveSession(restoredSession)');
const storageWrite = restoreBlock.indexOf("localStorage.setItem('race_notes_active_session'");
assert.ok(refWrite >= 0 && refWrite < stateWrite && stateWrite < storageWrite);
assert.doesNotMatch(restoreBlock, /handleUpdateSession|applyActiveSessionToWeekends|setWeekends/);
const setupSource = readFileSync(new URL('../src/components/SetupView.tsx', import.meta.url), 'utf8');
assert.match(setupSource, /activeCarId \? byActiveCar<Setup>/);
assert.match(setupSource, /preserveInfoToast/);
assert.match(setupSource, /pressureSourceNote: value\.trim\(\) \? 'Adjusted in Setups' : undefined/);
assert.match(setupSource, /className="w-full min-w-0 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-2 py-1 outline-none rounded"/);
assert.match(setupSource, /grid grid-cols-2 sm:grid-cols-4 gap-2/);
assert.match(setupSource, /min-w-0 break-words font-label-sm/);
assert.match(setupSource, /min-w-0 p-1\.5 sm:p-4 grid grid-cols-1/);
assert.match(setupSource, /w-full min-w-0 flex flex-wrap items-center justify-end gap-2/);
assert.match(setupSource, /w-full min-w-0 flex flex-wrap items-center justify-end gap-1 border-t/);
assert.match(setupSource, /min-w-0 grid grid-cols-2 gap-1\.5 sm:gap-3/);
assert.ok(setupSource.indexOf("(['lf', 'rf', 'lr', 'rr'] as const)") >= 0);
const smasherSource = readFileSync(new URL('../src/components/SmasherLoadsView.tsx', import.meta.url), 'utf8');
assert.match(smasherSource, /if \(!activeCarId\) return;/);
assert.match(smasherSource, /activeCarId && !compareMode && displayedSessions\.length === 0/);
assert.match(smasherSource, /showNewForm && activeCarId/);
assert.doesNotMatch(smasherSource, /carId: activeCarId \?\? undefined/);
const fourBarSource = readFileSync(new URL('../src/components/FourBarQuickAdjust.tsx', import.meta.url), 'utf8');
assert.match(fourBarSource, /function BarSection/);
assert.ok(fourBarSource.indexOf("field: 'topBarHFrame'") < fourBarSource.indexOf("field: 'topBarLength'"));
assert.ok(fourBarSource.indexOf("field: 'topBarLength'") < fourBarSource.indexOf("field: 'topBarHBird'"));
assert.match(fourBarSource, /bottomBarAngRH/);
assert.match(fourBarSource, /bottomBarAngFD/);
assert.match(fourBarSource, /Legacy bottom angle/);
assert.match(fourBarSource, /\[&_\[role=group\]\]:flex-wrap/);

console.log('CHUNK5_SETUP_HARNESS PASS');
