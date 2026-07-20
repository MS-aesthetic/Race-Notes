import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile } from '@tailwindcss/node';
import type { ActiveSession, RaceWeekend, SessionRecord, Setup, SetupSnapshot, SetupSnapshotCorner } from '../src/types';
import { cloneSetup, makeBlankSetup, normalizeSetup, pickImmediatePriorSetupForCar, pickLatestSetupForCar } from '../src/lib/setupCompat';
import { calculateTireStagger, SETUP_STEPS, formatPressureBlock, formatPsiValue, formatStoredNumber, fourBarAdjustmentId, fourBarAdjustmentLabel, legacyValueNote, mirrorPressureBlockToTires, parseStoredNumber, pressureBlockHasValue, resolveSessionPressureBlock, setupPressureBlock } from '../src/lib/setupSteps';
import { captureSetupSnapshot, diffSetupSnapshots, displayLifecycleText, getSetupEditability, isSetupLocked, isWeekendFinished, lifecycleSetupId, mergeTimestampedRecords, repairSetupDeletionReferences, withSetupDiffLog } from '../src/lib/setupLifecycle';
import { applyQuickAdjust } from '../src/lib/quickAdjust';

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

const readNormalizedSource = (url: URL): string =>
  readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
const appSource = readNormalizedSource(new URL('../src/App.tsx', import.meta.url));
const typesSource = readNormalizedSource(new URL('../src/types.ts', import.meta.url));
const syncSource = readNormalizedSource(new URL('../src/lib/sync.ts', import.meta.url));
const raceWeekendSource = readNormalizedSource(new URL('../src/components/RaceWeekendView.tsx', import.meta.url));
const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
assert.match(appSource, /className="app-main-scroll flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar"/);
assert.match(cssSource, /\.app-main-scroll\s*\{\s*padding-bottom: calc\(4rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
assert.match(cssSource, /\.sticky-action-bar[\s\S]*min-height: calc\(4\.5rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
assert.match(cssSource, /\.sticky-action-bar[\s\S]*background-color: var\(--color-surface-container-high\);/);
assert.match(cssSource, /\.sticky-action-bar[\s\S]*border-top: 1px solid var\(--color-outline-variant\);/);
assert.match(cssSource, /\.sticky-action-bar[\s\S]*padding-bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
assert.match(raceWeekendSource, /const \[isRunDirty, setIsRunDirty\] = useState\(false\);/);
assert.match(raceWeekendSource, /const activeRunIdentity = session\.id \?\? `\$\{session\.weekendId \?\? ''\}:\$\{session\.name\}:\$\{session\.track\}`;/);
assert.match(raceWeekendSource, /setIsRunDirty\(false\);[\s\S]*\[activeRunIdentity\]/);
assert.match(raceWeekendSource, /const updateRun = \(updatedSession: ActiveSession\) => \{\s*setIsRunDirty\(true\);\s*persistSession\(updatedSession\);/);
assert.match(raceWeekendSource, /const handleSaveRun = \(\) => \{\s*persistSession\(\{ \.\.\.session \}\);\s*setIsRunDirty\(false\);\s*setEditorCollapsed\(true\);/);
assert.match(raceWeekendSource, /\{isRunDirty && \(\s*<div className="sticky-action-bar rounded-b-lg">/);
assert.match(appSource, /handleUpdateSession\(current =>/);
assert.match(appSource, /const candidate = typeof update === 'function' \? update\(activeSessionRef\.current\) : update/);
assert.match(appSource, /const updatedSession: ActiveSession = \{ \.\.\.candidate, updatedAt:/);
assert.match(appSource, /preserveInfoToast/);
assert.match(appSource, /const pressures = setupPressureBlock\(nextActive\)/);
assert.match(appSource, /pressureSourceNote: hasPressureSource \? sourceNote : undefined/);
assert.match(appSource, /if \(hasPressureSource && !preserveInfoToast\) showInfo\(\{ reason: 'pressure-source', context: \{ label:/);
assert.match(appSource, /else if \(!preserveInfoToast\) clearInfo\(\)/);
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
const setupSource = readNormalizedSource(new URL('../src/components/SetupView.tsx', import.meta.url));
assert.match(setupSource, /activeCarId \? byActiveCar<Setup>/);
assert.match(setupSource, /preserveInfoToast/);
assert.match(setupSource, /pressureSourceNote: value\.trim\(\) \? 'Adjusted in Setups' : undefined/);
assert.match(setupSource, /className="w-full min-w-0 min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-2 outline-none rounded"/);
assert.match(setupSource, /grid grid-cols-2 sm:grid-cols-4 gap-2/);
assert.match(setupSource, /min-w-0 break-words font-label-sm/);
assert.match(setupSource, /min-w-0 p-2 sm:p-3 grid grid-cols-1 min-\[360px\]:grid-cols-2 gap-2/);
assert.match(setupSource, /w-full min-w-0 flex flex-wrap items-center justify-end gap-2/);
assert.match(setupSource, /w-full min-w-0 flex flex-wrap items-center justify-end gap-1 border-t/);
assert.match(setupSource, /min-w-0 grid grid-cols-1 min-\[360px\]:grid-cols-2 gap-1\.5 min-\[360px\]:gap-2/);
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
assert.doesNotMatch(fourBarSource, /\[&_\[role=group\]\]:flex-wrap|\[&_\[role=group\]>button\]:basis-full/, 'compact steppers are not forced vertical');
assert.match(fourBarSource, /const barLength = bar\.measurements\[1\];/, 'bar length renders above the hole controls');
assert.match(fourBarSource, /const holeMeasurements = \[bar\.measurements\[0\], bar\.measurements\[2\]\];/, 'frame and birdcage controls remain paired');
assert.equal((fourBarSource.match(/grid grid-cols-\[repeat\(auto-fit,minmax\(8\.75rem,1fr\)\)\] gap-2/g) ?? []).length, 2, 'four-bar controls use width-safe adaptive columns');
assert.match(fourBarSource, /compact \? 'rounded p-0\.5'/, 'compact field chrome preserves the full 136px stepper budget');
assert.doesNotMatch(fourBarSource, /sm:grid-cols-[23]/, 'four-bar no longer waits for the 640px breakpoint');
assert.match(fourBarSource, /compact \? 'space-y-3'/, 'compact FourBar presentation is distinct from full mode');
assert.match(setupSource, /<FourBarQuickAdjust\s+setup=\{setupItem\}\s+compact/, 'Setup activates compact FourBar presentation');
assert.match(fourBarSource, /min-h-11 min-w-11 shrink-0/, 'compact FourBar keeps 44px help target');

const lifecycleSource = readNormalizedSource(new URL('../src/lib/setupLifecycle.ts', import.meta.url));
assert.match(lifecycleSource, /export type SetupEditabilityReason =/, 'C1 exports typed editability reasons');
assert.match(lifecycleSource, /'historical-role'[\s\S]*'locked'[\s\S]*'finished-weekend'[\s\S]*'in-play-elsewhere'/, 'C1 keeps every required typed reason');
assert.match(lifecycleSource, /export const getSetupEditability = \(/, 'C1 exports one canonical predicate');
assert.match(lifecycleSource, /if \(activeEventSetupId && setup\.id === activeEventSetupId\) \{\s*return \{ editable: false, deletable: false, reason: 'in-play-elsewhere' \};/, 'Repair 3 blocks deletion of the exact active Race Day setup');
assert.match(setupSource, /getSetupEditability\(target, weekends, activeEventSetupId\)\.deletable/, 'C1 Setup delete paths use canonical deletability');
assert.match(setupSource, /const editability = getSetupEditability\(setupItem, weekends, activeEventSetupId\);/, 'C1 Setup card uses canonical predicate');
assert.match(setupSource, /disabled=\{!editability\.deletable\}/, 'C1 Setup delete control follows canonical deletability');
assert.doesNotMatch(setupSource, /isSetupLocked/, 'C1 SetupView keeps no alternate lock predicate');
assert.match(appSource, /getSetupEditability\(prior, weekendsRef\.current, eventSetupId\)\.editable/, 'C1 App save boundary uses canonical editability');
assert.match(appSource, /!getSetupEditability\(prior, weekendsRef\.current, eventSetupId\)\.deletable/, 'C1 App removal boundary uses canonical deletability');
assert.match(appSource, /activeEventSetupId=\{activeWeekend\?\.activeSetupId\}/, 'C1 shares active-event context with SetupView');

const c1Weekend = (id: string, status: RaceWeekend['status'], activeSetupId?: string): RaceWeekend => ({
  id, name: id, track: 'Track', date: 'Jul 18, 2026', sessions: [], status, activeSetupId,
});
const c1Weekends = [
  c1Weekend('active-weekend', 'active', 'in-play'),
  c1Weekend('finished-weekend', 'finished'),
];
const c1Baseline = { ...legacy, id: 'baseline', lifecycleRole: 'baseline' as const };
const c1Final = { ...legacy, id: 'final', lifecycleRole: 'final' as const };
const c1Locked = { ...legacy, id: 'locked', lockedAt: '2026-07-18T00:00:00.000Z' };
const c1Finished = { ...legacy, id: 'finished', lifecycleRole: 'weekend' as const, weekendId: 'finished-weekend' };
const c1InPlay = { ...legacy, id: 'in-play', lifecycleRole: 'weekend' as const, weekendId: 'active-weekend' };
const c1Unrelated = { ...legacy, id: 'unrelated', lifecycleRole: 'current' as const };
const c1Expected = (editable: boolean, deletable: boolean, reason: string | null) => ({ editable, deletable, reason });
assert.deepEqual(getSetupEditability(c1Baseline, c1Weekends, 'in-play'), c1Expected(false, false, 'historical-role'), 'C1 baseline remains immutable');
assert.deepEqual(getSetupEditability(c1Final, c1Weekends, 'in-play'), c1Expected(false, false, 'historical-role'), 'C1 final remains immutable');
assert.deepEqual(getSetupEditability(c1Locked, c1Weekends, 'in-play'), c1Expected(false, false, 'locked'), 'C1 explicit lock remains immutable');
assert.deepEqual(getSetupEditability(c1Finished, c1Weekends, 'in-play'), c1Expected(false, false, 'finished-weekend'), 'C1 finished Weekend Setup remains immutable');
assert.deepEqual(getSetupEditability(c1InPlay, c1Weekends, 'in-play'), c1Expected(false, false, 'in-play-elsewhere'), 'Repair 3 active event setup is edit-frozen and non-deletable');
assert.deepEqual(getSetupEditability(c1Unrelated, c1Weekends, 'in-play'), c1Expected(true, true, null), 'C1 unrelated live-Race-Day setup remains editable and deletable');
assert.equal(isSetupLocked(c1InPlay, c1Weekends), false, 'C1 in-play rule does not redefine historical locking');
assert.equal(getSetupEditability({ ...c1Unrelated, chassis: 'Renamed live setup' }, c1Weekends, 'in-play').editable, true, 'C1 owner live-Race-Day chassis rename remains enabled');

const c1SourcePasses = (lifecycle: string, setupView: string, app: string): boolean => (
  lifecycle.includes("setup.lifecycleRole === 'baseline' || setup.lifecycleRole === 'final'")
  && lifecycle.includes("if (activeEventSetupId && setup.id === activeEventSetupId)")
  && lifecycle.includes("deletable: false, reason: 'in-play-elsewhere'")
  && setupView.includes('getSetupEditability(setupItem, weekends, activeEventSetupId)')
  && setupView.includes('disabled={!editability.deletable}')
  && app.includes('const canEdit = !prior || getSetupEditability(prior, weekendsRef.current, eventSetupId).editable;')
  && app.includes('!getSetupEditability(prior, weekendsRef.current, eventSetupId).deletable')
  && app.includes('const hasBlockedEdit = updatedSetups.some(candidate => {')
  && app.includes('if (hasBlockedEdit) return;')
);
const c1ModelEditability = (lifecycle: string, candidate: Setup, activeEventSetupId?: string) => {
  if (!lifecycle.includes("setup.lifecycleRole === 'baseline' || setup.lifecycleRole === 'final'")
    && (candidate.lifecycleRole === 'baseline' || candidate.lifecycleRole === 'final')) {
    return c1Expected(true, true, null);
  }
  if (lifecycle.includes('if (activeEventSetupId) {') && activeEventSetupId) {
    return c1Expected(false, true, 'in-play-elsewhere');
  }
  if (!lifecycle.includes("deletable: false, reason: 'in-play-elsewhere'") && candidate.id === activeEventSetupId) {
    return c1Expected(false, true, 'in-play-elsewhere');
  }
  return getSetupEditability(candidate, c1Weekends, activeEventSetupId);
};
const c1AppAllowsEdit = (app: string, candidate: Setup, activeEventSetupId?: string) => (
  app.includes('const canEdit = !prior || getSetupEditability(prior, weekendsRef.current, eventSetupId).editable;')
    ? c1ModelEditability(lifecycleSource, candidate, activeEventSetupId).editable
    : true
);
const compileC1Mutation = (source: string, loader: 'ts' | 'tsx', label: string) =>
  assert.doesNotThrow(() => transformSync(source, { loader, jsx: 'automatic', format: 'esm' }), `C1 ${label} mutation compiles`);
assert.equal(c1SourcePasses(lifecycleSource, setupSource, appSource), true, 'C1 baseline source/model gate passes');

const historicalBypassMutation = lifecycleSource.replace("if (setup.lifecycleRole === 'baseline' || setup.lifecycleRole === 'final') {", 'if (false) {');
assert.notEqual(historicalBypassMutation, lifecycleSource, 'C1 historical mutation changes production predicate');
compileC1Mutation(historicalBypassMutation, 'ts', 'historical bypass');
assert.equal(c1SourcePasses(historicalBypassMutation, setupSource, appSource), false, 'C1 historical mutation fails source gate');
assert.equal(c1ModelEditability(historicalBypassMutation, c1Baseline, 'in-play').editable, true, 'C1 historical mutation makes baseline editable');
assert.equal(c1ModelEditability(lifecycleSource, c1Baseline, 'in-play').editable, false, 'C1 baseline model blocks zero-byte mutation');

const broadEventMutation = lifecycleSource.replace('if (activeEventSetupId && setup.id === activeEventSetupId) {', 'if (activeEventSetupId) {');
assert.notEqual(broadEventMutation, lifecycleSource, 'C1 broad-event mutation changes production predicate');
compileC1Mutation(broadEventMutation, 'ts', 'broad event freeze');
assert.equal(c1SourcePasses(broadEventMutation, setupSource, appSource), false, 'C1 broad-event mutation fails source gate');
assert.equal(c1ModelEditability(broadEventMutation, c1Unrelated, 'in-play').editable, false, 'C1 broad-event mutation freezes unrelated setup');
assert.equal(c1ModelEditability(lifecycleSource, c1Unrelated, 'in-play').editable, true, 'C1 baseline keeps unrelated setup editable');

const activeDeleteUnblockedMutation = lifecycleSource.replace("return { editable: false, deletable: false, reason: 'in-play-elsewhere' };", "return { editable: false, deletable: true, reason: 'in-play-elsewhere' };");
assert.notEqual(activeDeleteUnblockedMutation, lifecycleSource, 'Repair 3 active-delete guard mutation changes production predicate');
compileC1Mutation(activeDeleteUnblockedMutation, 'ts', 'active delete unblocked');
assert.equal(c1SourcePasses(activeDeleteUnblockedMutation, setupSource, appSource), false, 'Repair 3 active-delete guard mutation fails source gate');
assert.equal(c1ModelEditability(activeDeleteUnblockedMutation, c1InPlay, 'in-play').deletable, true, 'Repair 3 mutation exposes active Race Day deletion');
assert.equal(c1ModelEditability(lifecycleSource, c1InPlay, 'in-play').deletable, false, 'Repair 3 baseline blocks active Race Day deletion');

const divergentAppMutation = appSource.replace(
  'const canEdit = !prior || getSetupEditability(prior, weekendsRef.current, eventSetupId).editable;',
  'const canEdit = true;',
);
assert.notEqual(divergentAppMutation, appSource, 'C1 App divergence mutation changes production boundary');
compileC1Mutation(divergentAppMutation, 'tsx', 'App divergence');
assert.equal(c1SourcePasses(lifecycleSource, setupSource, divergentAppMutation), false, 'C1 App divergence mutation fails source gate');
assert.equal(c1AppAllowsEdit(divergentAppMutation, c1Baseline, 'in-play'), true, 'C1 App divergence mutation persists historical edit');
assert.equal(c1AppAllowsEdit(appSource, c1Baseline, 'in-play'), false, 'C1 baseline App preserves historical zero-byte rejection');

type C1WriteModel = {
  savedSetups: Setup[];
  activeSetupId: string;
  pressures: string;
  localWrites: number;
  cloudWrites: number;
  savedFlashes: number;
};
const c1ModelSave = (app: string, prior: Setup, attempted: Setup): C1WriteModel => {
  const before: C1WriteModel = {
    savedSetups: [prior], activeSetupId: prior.id, pressures: prior.lf.tirePress,
    localWrites: 0, cloudWrites: 0, savedFlashes: 0,
  };
  const blocked = !getSetupEditability(prior, c1Weekends, 'in-play').editable
    && JSON.stringify(prior) !== JSON.stringify(attempted);
  if (blocked && app.includes('if (hasBlockedEdit) return;')) return before;
  return {
    savedSetups: [attempted], activeSetupId: 'fallback', pressures: attempted.lf.tirePress,
    localWrites: 2, cloudWrites: 1, savedFlashes: 1,
  };
};
const c1HistoricalFixtures = [c1Baseline, c1Final, c1Locked, c1Finished];
for (const historical of c1HistoricalFixtures) {
  const attempted = { ...historical, chassis: `${historical.chassis} changed`, lf: { ...historical.lf, tirePress: '19' } };
  const result = c1ModelSave(appSource, historical, attempted);
  assert.deepEqual(result.savedSetups, [historical], `C1 ${historical.id} edit keeps saved setup bytes`);
  assert.equal(result.activeSetupId, historical.id, `C1 ${historical.id} edit keeps active selection`);
  assert.equal(result.pressures, historical.lf.tirePress, `C1 ${historical.id} edit keeps session pressures`);
  assert.equal(result.localWrites, 0, `C1 ${historical.id} edit produces zero local writes`);
  assert.equal(result.cloudWrites, 0, `C1 ${historical.id} edit produces zero cloud writes`);
  assert.equal(result.savedFlashes, 0, `C1 ${historical.id} edit produces no Saved flash`);
}
const blockedEditMutation = appSource.replace('if (hasBlockedEdit) return;', 'if (false) return;');
assert.notEqual(blockedEditMutation, appSource, 'C1 blocked-edit mutation changes the production boundary');
compileC1Mutation(blockedEditMutation, 'tsx', 'blocked historical edit bypass');
assert.equal(c1SourcePasses(lifecycleSource, setupSource, blockedEditMutation), false, 'C1 blocked-edit mutation fails source gate');
for (const historical of c1HistoricalFixtures) {
  const attempted = { ...historical, chassis: `${historical.chassis} changed`, lf: { ...historical.lf, tirePress: '19' } };
  const result = c1ModelSave(blockedEditMutation, historical, attempted);
  assert.equal(result.savedFlashes, 1, `C1 mutation exposes false Saved for ${historical.id}`);
  assert.equal(result.cloudWrites, 1, `C1 mutation exposes cloud write for ${historical.id}`);
}

// Repair 3 executes the real generic persistence boundary, not a parallel model.
let repair3SetupAssertions = 0;
const repair3SetupOk = (value: unknown, message: string) => { repair3SetupAssertions += 1; assert.ok(value, message); };
const repair3SetupEqual = (actual: unknown, expected: unknown, message: string) => { repair3SetupAssertions += 1; assert.deepEqual(actual, expected, message); };
const compileRepair3Save = (sourceText: string) => {
  const start = sourceText.indexOf('  const handleSaveSetups = (updatedSetups: Setup[], activeId?: string, preserveInfoToast = false) => {');
  const end = sourceText.indexOf('\n\n  const handleUpdateSession', start);
  assert.ok(start >= 0 && end > start, 'Repair 3 generic production handler slice exists');
  const names = [
    'savedSetupsRef', 'weekendsRef', 'activeWeekendId', 'isWeekendFinished', 'getSetupEditability', 'repairSetupDeletionReferences',
    'activeCarId', 'setup', 'pickLatestSetupForCar', 'isSetupLocked', 'INITIAL_SETUP', 'queueSharedCloudDelete',
    'setSavedSetups', 'setWeekends', 'setSetup', 'localStorage', 'handleUpdateSession', 'setupPressureBlock',
    'pressureBlockHasValue', 'displayVersionLabel', 'mirrorPressureBlockToTires', 'showInfo', 'clearInfo', 'markSavedDirty',
    'syncOwnerId', 'pushSetups', 'pushWeekends', 'setSyncStatus',
  ];
  const wrapped = `export const makeRepair3Save = (deps) => { const { ${names.join(', ')} } = deps;\n${sourceText.slice(start, end)}\nreturn handleSaveSetups; };`;
  const compiled = transformSync(wrapped, { loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'es2022' }).code;
  const box = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compiled)(box, box.exports);
  return box.exports.makeRepair3Save as (deps: Record<string, unknown>) => (setups: Setup[], activeId?: string) => void;
};
const runRepair3Generic = (sourceText = appSource, deleteActive = false) => {
  const active = { ...legacy, id: 'active-event', lifecycleRole: 'weekend' as const, weekendId: 'repair-weekend', updatedAt: '2099-07-19T00:00:00.000Z' };
  const removed = { ...legacy, id: 'generic-removed', lifecycleRole: 'current' as const, updatedAt: '2099-07-19T00:00:01.000Z' };
  const survivor = { ...legacy, id: 'generic-survivor', lifecycleRole: 'current' as const, sourceSetupId: removed.id, updatedAt: '2099-07-19T00:00:02.000Z' };
  const sessions = [{ id: 'historic-session', setupId: removed.id, setupSnapshot: { id: removed.id, lf: { tirePress: '12' } } }] as unknown as SessionRecord[];
  const weekend: RaceWeekend = {
    id: 'repair-weekend', name: 'Repair', track: 'Track', date: 'Jul 19, 2026', status: 'active', activeSetupId: active.id,
    setupId: removed.id, sourceSetupId: removed.id, baselineSetupId: removed.id, finalSetupId: removed.id, sessions, updatedAt: '2099-07-19T00:00:03.000Z',
  };
  const prior = deleteActive ? [active] : [active, removed, survivor];
  const refs = { savedSetupsRef: { current: prior }, weekendsRef: { current: [weekend] } };
  const storage = new Map<string, string>();
  const queues: string[] = [];
  const pushes: Array<[string, string[]]> = [];
  const state: Record<string, unknown> = {};
  const handler = compileRepair3Save(sourceText)({
    ...refs, activeWeekendId: weekend.id, isWeekendFinished, getSetupEditability, repairSetupDeletionReferences,
    activeCarId: 'car-a', setup: deleteActive ? active : survivor, pickLatestSetupForCar: (rows: Setup[]) => rows[0] ?? null,
    isSetupLocked, INITIAL_SETUP: { id: 'initial-safe' }, queueSharedCloudDelete: (_table: string, id: string) => { queues.push(id); },
    setSavedSetups: (value: Setup[]) => { state.setups = value; }, setWeekends: (value: RaceWeekend[]) => { state.weekends = value; },
    setSetup: (value: Setup) => { state.setup = value; }, localStorage: { setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } },
    handleUpdateSession: () => undefined, setupPressureBlock: () => ({ lf: '', rf: '', lr: '', rr: '' }), pressureBlockHasValue: () => false,
    displayVersionLabel: () => '', mirrorPressureBlockToTires: (value: unknown) => value, showInfo: () => undefined, clearInfo: () => undefined,
    markSavedDirty: () => { state.dirty = true; }, syncOwnerId: 'owner-a', pushSetups: (rows: Setup[]) => { pushes.push(['setups', rows.map(row => row.id)]); },
    pushWeekends: (rows: RaceWeekend[]) => { pushes.push(['weekends', rows.map(row => row.id)]); }, setSyncStatus: () => undefined,
  });
  handler(deleteActive ? [] : [active, survivor], deleteActive ? active.id : survivor.id);
  return { refs, storage, queues, pushes, state, sessions: JSON.stringify(sessions) };
};
const genericRepair = runRepair3Generic();
repair3SetupEqual(genericRepair.queues, ['generic-removed'], 'Repair 3 generic deletion queues the exact removed ID once');
repair3SetupEqual((genericRepair.state.setups as Setup[]).find(item => item.id === 'generic-survivor')?.sourceSetupId, undefined, 'Repair 3 generic deletion clears surviving lineage only');
repair3SetupEqual(['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'].map(key => (genericRepair.state.weekends as RaceWeekend[])[0][key as keyof RaceWeekend]), [undefined, undefined, undefined, 'active-event', undefined], 'Repair 3 generic deletion clears only matching Race Day pointers');
repair3SetupEqual(JSON.stringify((genericRepair.state.weekends as RaceWeekend[])[0].sessions), genericRepair.sessions, 'Repair 3 generic deletion keeps sessions byte-stable');
repair3SetupEqual(genericRepair.pushes, [['setups', ['active-event', 'generic-survivor']], ['weekends', ['repair-weekend']]], 'Repair 3 generic deletion pushes the canonical repaired arrays');
repair3SetupOk((genericRepair.state.setups as Setup[]).find(item => item.id === 'generic-survivor')!.updatedAt! > '2099-07-19T00:00:02.000Z', 'Repair 3 generic survivor timestamp advances');
repair3SetupOk((genericRepair.state.weekends as RaceWeekend[])[0].updatedAt! > '2099-07-19T00:00:03.000Z', 'Repair 3 generic Race Day timestamp advances');
repair3SetupEqual(JSON.parse(genericRepair.storage.get('race_notes_saved_setups')!).map((item: Setup) => item.id), ['active-event', 'generic-survivor'], 'Repair 3 generic writes repaired setup state to localStorage');
repair3SetupEqual(JSON.parse(genericRepair.storage.get('race_notes_weekends')!)[0].sessions, JSON.parse(genericRepair.sessions), 'Repair 3 generic writes repaired Race Day state without session mutation');
repair3SetupEqual(JSON.parse(genericRepair.storage.get('race_notes_setup')!).sourceSetupId, undefined, 'Repair 3 generic repairs only the exact active cache twin');
const blockedActiveDelete = runRepair3Generic(appSource, true);
repair3SetupEqual(blockedActiveDelete.queues, [], 'Repair 3 active Race Day deletion queues nothing');
repair3SetupEqual(blockedActiveDelete.state, {}, 'Repair 3 active Race Day deletion performs zero state, local, push, dirty, or Saved-path writes');

const genericMutations: Array<[string, string, string]> = [
  ['generic-lineage-repair-bypassed', 'const changedSetups = submittedSetups.filter(item => !!item.sourceSetupId && removedSetupIds.has(item.sourceSetupId));', 'const changedSetups = [] as Setup[];'],
  ['generic-setup-pointer-omitted', "const relationshipPointerKeys = ['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'] as const;", "const relationshipPointerKeys = ['sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'] as const;"],
  ['generic-final-pointer-omitted', "const relationshipPointerKeys = ['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'] as const;", "const relationshipPointerKeys = ['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId'] as const;"],
  ['generic-changed-only-removed', '? { ...item, sourceSetupId: undefined, updatedAt: repairTimestamp! }\n        : item', '? { ...item, sourceSetupId: undefined, updatedAt: repairTimestamp! }\n        : { ...item, updatedAt: repairTimestamp! }'],
  ['generic-strict-newer-removed', '.map(timestamp => timestamp + 1),', '.map(timestamp => timestamp),'],
  ['generic-session-history-rewritten', 'const repaired: RaceWeekend = { ...weekend, updatedAt: repairTimestamp! };', 'const repaired: RaceWeekend = { ...weekend, sessions: [], updatedAt: repairTimestamp! };'],
  ['generic-setup-storage-wrong', "localStorage.setItem('race_notes_saved_setups', JSON.stringify(repairedSetups));", "localStorage.setItem('wrong_saved_setups', JSON.stringify(repairedSetups));"],
  ['generic-weekend-storage-wrong', "if (setupReferenceRepair.changedWeekendIds.length > 0) {\n      weekendsRef.current = repairedWeekends;\n      setWeekends(repairedWeekends);\n      localStorage.setItem('race_notes_weekends', JSON.stringify(repairedWeekends));", "if (setupReferenceRepair.changedWeekendIds.length > 0) {\n      weekendsRef.current = repairedWeekends;\n      setWeekends(repairedWeekends);\n      localStorage.setItem('wrong_weekends', JSON.stringify(repairedWeekends));"],
  ['generic-exact-queue-id-wrong', "removedSetupIds.forEach(id => queueSharedCloudDelete('setups', id));", "removedSetupIds.forEach(() => queueSharedCloudDelete('setups', 'wrong-id'));"],
  ['generic-weekend-push-missing', 'if (syncOwnerId) pushWeekends(repairedWeekends, syncOwnerId, setSyncStatus);', 'if (syncOwnerId) void repairedWeekends;'],
];
const killedGenericMutations: string[] = [];
for (const [name, before, after] of genericMutations) {
  repair3SetupEqual((appSource.match(new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `Repair 3 ${name} target is unique`);
  const mutated = runRepair3Generic(appSource.replace(before, after));
  const failed = JSON.stringify(mutated.queues) !== JSON.stringify(['generic-removed'])
    || (mutated.state.setups as Setup[] | undefined)?.find(item => item.id === 'generic-survivor')?.sourceSetupId !== undefined
    || (mutated.state.weekends as RaceWeekend[] | undefined)?.[0].setupId !== undefined
    || (mutated.state.weekends as RaceWeekend[] | undefined)?.[0].finalSetupId !== undefined
    || (mutated.state.weekends as RaceWeekend[] | undefined)?.[0].activeSetupId !== 'active-event'
    || (mutated.state.setups as Setup[] | undefined)?.find(item => item.id === 'active-event')?.updatedAt !== '2099-07-19T00:00:00.000Z'
    || ((mutated.state.setups as Setup[] | undefined)?.find(item => item.id === 'generic-survivor')?.updatedAt ?? '') <= '2099-07-19T00:00:02.000Z'
    || ((mutated.state.weekends as RaceWeekend[] | undefined)?.[0].updatedAt ?? '') <= '2099-07-19T00:00:03.000Z'
    || JSON.stringify((mutated.state.weekends as RaceWeekend[] | undefined)?.[0].sessions) !== mutated.sessions
    || !mutated.storage.has('race_notes_saved_setups')
    || !mutated.storage.has('race_notes_weekends')
    || !mutated.pushes.some(([kind]) => kind === 'weekends');
  repair3SetupOk(failed, `Repair 3 production generic mutation ${name} is rejected`);
  killedGenericMutations.push(name);
}
repair3SetupEqual(new Set(killedGenericMutations).size, killedGenericMutations.length, 'Repair 3 generic mutation labels are unique');
console.log(`Repair 3 generic assertions: ${repair3SetupAssertions}`);
console.log(`Repair 3 generic killed mutations (${killedGenericMutations.length}): ${killedGenericMutations.join(', ')}`);

const snapshotSourceSetup: Setup = {
  ...legacy,
  id: 'setup-live-snapshot',
  chassis: 'Live Snapshot Chassis',
  track: 'Port Royal',
  date: 'Jul 18, 2026',
  carType: 'Dirt Late Model',
  versionLabel: 'Jul 18 Live-Trackside Setup',
  gear: '6.00',
  toe: '1/8 out',
  jbar: '7.5',
  jbarFrameHeight: '9.00',
  jbarPinionHeight: '8.00',
  frontStagger: '1.25',
  rearStagger: '1.50',
  pullBarFrameHole: '3',
  pullBarRearHole: '2',
  pullBarAngle: '18',
  notes: 'Start tight',
  screenshots: ['attachment-1'],
  lifecycleRole: 'weekend',
  sourceSetupId: 'setup-baseline',
  weekendId: 'wknd-live',
  lockedAt: '2026-07-18T18:00:00.000Z',
  changeLog: [{ id: 'legacy-change', timestamp: '2026-07-18T17:00:00.000Z', label: 'Legacy', field: 'gear', before: '5.83', after: '6.00' }],
  updatedAt: '2026-07-18T18:00:00.000Z',
  lf: {
    ...legacy.lf,
    spring: '500',
    pressureSourceNote: 'Adjusted in Setups',
    tireInventoryId: 'tire-live',
    rideHeightNeedsReview: true,
    boundGraphId: 'graph-lf',
  },
  rf: { ...legacy.rf, camber: '-3.5' },
  lr: { ...legacy.lr, topBarHBird: 'Hole 4', shockNote: 'Free at entry' },
  rr: { ...legacy.rr, botBarHBird: 'Hole 2' },
};
const expectedSnapshotCornerFields = [
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
const expectedSnapshotCorner = (corner: Setup['lf']): SetupSnapshotCorner =>
  Object.fromEntries(
    expectedSnapshotCornerFields
      .filter(field => corner[field] !== undefined)
      .map(field => [field, corner[field]]),
  ) as SetupSnapshotCorner;
const expectedSnapshot: SetupSnapshot = {
  chassis: snapshotSourceSetup.chassis,
  track: snapshotSourceSetup.track,
  date: snapshotSourceSetup.date,
  carType: snapshotSourceSetup.carType,
  versionLabel: snapshotSourceSetup.versionLabel,
  lf: expectedSnapshotCorner(snapshotSourceSetup.lf),
  rf: expectedSnapshotCorner(snapshotSourceSetup.rf),
  lr: expectedSnapshotCorner(snapshotSourceSetup.lr),
  rr: expectedSnapshotCorner(snapshotSourceSetup.rr),
  gear: snapshotSourceSetup.gear,
  toe: snapshotSourceSetup.toe,
  jbar: snapshotSourceSetup.jbar,
  jbarFrameHeight: snapshotSourceSetup.jbarFrameHeight,
  jbarPinionHeight: snapshotSourceSetup.jbarPinionHeight,
  frontStagger: snapshotSourceSetup.frontStagger,
  rearStagger: snapshotSourceSetup.rearStagger,
  pullBarFrameHole: snapshotSourceSetup.pullBarFrameHole,
  pullBarRearHole: snapshotSourceSetup.pullBarRearHole,
  pullBarAngle: snapshotSourceSetup.pullBarAngle,
  notes: snapshotSourceSetup.notes,
};
const capturedSnapshot = captureSetupSnapshot(snapshotSourceSetup);
assert.deepEqual(capturedSnapshot, expectedSnapshot, 'C2 snapshot captures display identity and all tune state');
assert.equal('id' in capturedSnapshot, false, 'C2 snapshot omits live setup identity');
assert.equal('screenshots' in capturedSnapshot, false, 'C2 snapshot omits attachments');
assert.equal('lifecycleRole' in capturedSnapshot, false, 'C2 snapshot omits lifecycle metadata');
assert.equal('changeLog' in capturedSnapshot, false, 'C2 snapshot omits legacy change log');
assert.equal('updatedAt' in capturedSnapshot, false, 'C2 snapshot omits timestamps');
for (const corner of ['lf', 'rf', 'lr', 'rr'] as const) {
  assert.notStrictEqual(capturedSnapshot[corner], snapshotSourceSetup[corner], 'C2 snapshot has no shared corner reference');
}
assert.equal('pressureSourceNote' in capturedSnapshot.lf, false, 'C2 snapshot omits corner UI noise');
assert.equal('tireInventoryId' in capturedSnapshot.lf, false, 'C2 snapshot omits tire provenance');
assert.equal('rideHeightNeedsReview' in capturedSnapshot.lf, false, 'C2 snapshot omits review flag');
assert.equal('boundGraphId' in capturedSnapshot.lf, false, 'C2 snapshot omits graph provenance');
const capturedSnapshotBytes = JSON.stringify(capturedSnapshot);
snapshotSourceSetup.lf.spring = '525';
snapshotSourceSetup.lr.topBarHBird = 'Hole 9';
assert.equal(capturedSnapshot.lf.spring, '500', 'C2 later source edit cannot mutate captured LF');
assert.equal(capturedSnapshot.lr.topBarHBird, 'Hole 4', 'C2 later source edit cannot mutate captured LR');
assert.equal(JSON.stringify(capturedSnapshot), capturedSnapshotBytes, 'C2 captured bytes remain frozen after source edits');

type NestedCorner = Setup['lf'] & { calibration: { clicks: number } };
const nestedSetup: Setup = {
  ...snapshotSourceSetup,
  lf: {
    ...snapshotSourceSetup.lf,
    spring: { rate: 500 } as unknown as string,
    calibration: { clicks: 3 },
  } as NestedCorner,
};
const nestedSnapshot = captureSetupSnapshot(nestedSetup);
const nestedSnapshotCorner = nestedSnapshot.lf as SetupSnapshotCorner & { spring: { rate: number }; calibration?: { clicks: number } };
assert.equal('calibration' in nestedSnapshotCorner, false, 'C2 snapshot omits unknown corner data outside tune allowlist');
assert.notStrictEqual(nestedSnapshotCorner.spring, (nestedSetup.lf as NestedCorner).spring, 'C2 snapshot deep-copies nested allowed tune data');
((nestedSetup.lf as NestedCorner).spring as unknown as { rate: number }).rate = 525;
assert.equal(nestedSnapshotCorner.spring.rate, 500, 'C2 nested source edit cannot mutate captured snapshot');

const diffBaseSetup: Setup = {
  ...legacy,
  id: 'setup-diff',
  chassis: 'Diff Chassis',
  gear: '6.00',
  lf: { ...legacy.lf, spring: '500' },
  rr: { ...legacy.rr, botBarHBird: 'Hole 1' },
};
const diffBefore = captureSetupSnapshot(diffBaseSetup);
const diffAfter = captureSetupSnapshot({
  ...diffBaseSetup,
  gear: '6.20',
  lf: { ...diffBaseSetup.lf, spring: '525' },
  rr: { ...diffBaseSetup.rr, botBarHBird: 'Hole 3' },
});
const diffBeforeBytes = JSON.stringify(diffBefore);
const diffAfterBytes = JSON.stringify(diffAfter);
assert.deepEqual(diffSetupSnapshots(diffBefore, diffAfter), [
  { label: 'Gear', field: 'gear', before: '6.00', after: '6.20' },
  { label: 'LF Spring', corner: 'lf', field: 'spring', before: '500', after: '525' },
  { label: 'RR Bot Bar H Bird', corner: 'rr', field: 'botBarHBird', before: 'Hole 1', after: 'Hole 3' },
], 'C2 diff rows are exact and deterministic');
assert.equal(JSON.stringify(diffBefore), diffBeforeBytes, 'C2 diff does not mutate before snapshot');
assert.equal(JSON.stringify(diffAfter), diffAfterBytes, 'C2 diff does not mutate after snapshot');
assert.deepEqual(diffSetupSnapshots(diffBefore, diffBefore), [], 'C2 equal snapshots produce zero rows');
const diffNoise = JSON.parse(JSON.stringify(diffBefore)) as SetupSnapshot;
diffNoise.chassis = 'Renamed display identity';
diffNoise.track = 'Other Track';
diffNoise.date = 'Jul 19, 2026';
diffNoise.carType = 'A Mod';
diffNoise.versionLabel = 'Other version';
(diffNoise.lf as SetupSnapshotCorner & Record<string, unknown>).pressureSourceNote = 'UI only';
(diffNoise.lf as SetupSnapshotCorner & Record<string, unknown>).tireInventoryId = 'other-tire';
(diffNoise.lf as SetupSnapshotCorner & Record<string, unknown>).rideHeightNeedsReview = false;
(diffNoise.lf as SetupSnapshotCorner & Record<string, unknown>).boundGraphId = 'other-graph';
assert.deepEqual(diffSetupSnapshots(diffBefore, diffNoise), [], 'C2 identity and transient noise produce zero rows');

const legacySession: SessionRecord = {
  id: 'legacy-session', type: 'P1', name: 'Practice 1', track: 'Track', condition: '', bestLap: '',
};
assert.equal(legacySession.setupSnapshot, undefined, 'C2 legacy session records remain valid without snapshots');
assert.equal(legacySession.setupId, undefined, 'C2 legacy session records remain valid without provenance');
const legacySessionBytes = JSON.stringify(legacySession);
assert.equal(JSON.stringify(JSON.parse(legacySessionBytes)), legacySessionBytes, 'C2 legacy session JSON remains byte-stable');
const boundSession: SessionRecord = {
  ...legacySession,
  setupId: diffBaseSetup.id,
  setupSnapshot: diffBefore,
  setupUsed: diffBefore.chassis || 'No starting setup',
};
assert.equal(boundSession.setupId, diffBaseSetup.id, 'C2 session setupId binds source setup');
assert.strictEqual(boundSession.setupSnapshot, diffBefore, 'C2 record uses one captured snapshot image');
assert.equal(boundSession.setupUsed, diffBefore.chassis, 'C2 setupUsed derives from captured snapshot');
assert.match(syncSource, /sessions: w\.sessions/, 'C2 sync mapper writes sessions as opaque JSON');
assert.match(syncSource, /sessions: \(r\.sessions as SessionRecord\[\]\) \|\| \[\]/, 'C2 sync mapper restores sessions as opaque JSON');
const syncRoundTrip = JSON.parse(JSON.stringify({ sessions: [boundSession] })) as { sessions: SessionRecord[] };
assert.deepEqual(syncRoundTrip.sessions[0], boundSession, 'C2 snapshot and provenance round-trip in existing sessions payload');

const c2TopAllowlist = (source: string) => {
  const start = source.indexOf('const setupSnapshotTopLevelTuneFields');
  return source.slice(start, source.indexOf('] as const;', start));
};
const c2CornerAllowlist = (source: string) => {
  const start = source.indexOf('const setupSnapshotCornerTuneFields');
  return source.slice(start, source.indexOf('] as const', start));
};
const c2SourcePasses = (types: string, lifecycle: string, app: string): boolean => (
  types.includes('export interface SetupSnapshot {')
  && types.includes('export interface SetupSnapshotDiff {')
  && types.includes('setupId?: string;')
  && types.includes('setupSnapshot?: SetupSnapshot;')
  && lifecycle.includes('export function captureSetupSnapshot')
  && lifecycle.includes('const tunableCorner = Object.fromEntries(')
  && lifecycle.includes('setupSnapshotCornerTuneFields\n      .filter(field => corner[field] !== undefined)')
  && lifecycle.includes('lf: captureSnapshotCorner(setup.lf),')
  && lifecycle.includes('lr: captureSnapshotCorner(setup.lr),')
  && lifecycle.includes('return clonePlainData(snapshot);')
  && lifecycle.includes('export function diffSetupSnapshots')
  && c2TopAllowlist(lifecycle).includes("'gear'")
  && !c2TopAllowlist(lifecycle).includes("'chassis'")
  && c2CornerAllowlist(lifecycle).includes("'spring'")
  && lifecycle.includes('for (const field of setupSnapshotCornerTuneFields)')
  && app.includes('const sessionSetupSnapshot = captureSetupSnapshot(sessionSetup);')
  && app.includes("const sessionSetupUsed = sessionSetupSnapshot.chassis || 'No starting setup';")
  && app.slice(app.indexOf('const handleCreateNewSession'), app.indexOf('const handleDeleteSession')).includes('setupId: sessionSetup.id,')
  && app.slice(app.indexOf('const handleCreateNewSession'), app.indexOf('const handleDeleteSession')).includes('setupSnapshot: sessionSetupSnapshot,')
  && app.slice(app.indexOf('const handleCreateNewSession'), app.indexOf('const handleDeleteSession')).includes('setupUsed: sessionSetupUsed,')
  && !app.includes('withSetupDiffLog')
  && app.includes('return [{ ...candidate, updatedAt: !prior || comparable(prior) !== comparable(candidate) ? now : candidate.updatedAt }];')
);
const c2ModelCapture = (source: string, sourceSetup: Setup): SetupSnapshot => {
  const snapshot = captureSetupSnapshot(sourceSetup);
  return {
    ...snapshot,
    ...(source.includes('lf: captureSnapshotCorner(setup.lf),') ? {} : { lf: sourceSetup.lf as SetupSnapshotCorner }),
    ...(source.includes('lr: captureSnapshotCorner(setup.lr),') ? {} : { lr: sourceSetup.lr as SetupSnapshotCorner }),
  };
};
const c2ModelDiff = (source: string, before: SetupSnapshot, after: SetupSnapshot) => {
  const rows = diffSetupSnapshots(before, after);
  const top = c2TopAllowlist(source);
  const corners = c2CornerAllowlist(source);
  const modeled = rows.filter(row => (
    (top.includes("'gear'") || row.field !== 'gear')
    && (corners.includes("'spring'") || !(row.corner === 'lf' && row.field === 'spring'))
  ));
  if (top.includes("'chassis'") && before.chassis !== after.chassis) {
    modeled.unshift({ label: 'Chassis', field: 'chassis', before: before.chassis, after: after.chassis });
  }
  return modeled;
};
const c2ModelSessionBinding = (source: string, sourceSetup: Setup): Pick<SessionRecord, 'setupId' | 'setupSnapshot' | 'setupUsed'> => {
  const snapshot = captureSetupSnapshot(sourceSetup);
  return {
    setupId: source.includes('setupId: sessionSetup.id,') ? sourceSetup.id : undefined,
    setupSnapshot: source.includes('setupSnapshot: sessionSetupSnapshot,') ? snapshot : undefined,
    setupUsed: source.includes('const sessionSetupUsed = sessionSetupSnapshot.chassis') ? snapshot.chassis || 'No starting setup' : sourceSetup.chassis,
  };
};
const c2EditBurstChangeCount = (source: string, prior: Setup, edits: number): number =>
  (prior.changeLog?.length || 0) + (source.includes('withSetupDiffLog') && prior.lifecycleRole === 'weekend' ? edits : 0);
assert.equal(c2SourcePasses(typesSource, lifecycleSource, appSource), true, 'C2 baseline source/model gate passes');
assert.equal(c2EditBurstChangeCount(appSource, snapshotSourceSetup, 3), snapshotSourceSetup.changeLog?.length, 'C2 live edit burst appends zero legacy SetupChange rows');
assert.equal(JSON.stringify(snapshotSourceSetup.changeLog), JSON.stringify([{ id: 'legacy-change', timestamp: '2026-07-18T17:00:00.000Z', label: 'Legacy', field: 'gear', before: '5.83', after: '6.00' }]), 'C2 preserves legacy changeLog bytes');
assert.deepEqual(c2ModelSessionBinding(appSource, diffBaseSetup), {
  setupId: diffBaseSetup.id,
  setupSnapshot: diffBefore,
  setupUsed: diffBefore.chassis,
}, 'C2 source binds setupId, snapshot, and display name from one capture');

const shallowCaptureMutation = lifecycleSource.replace('lf: captureSnapshotCorner(setup.lf),', 'lf: setup.lf as SetupSnapshotCorner,');
assert.notEqual(shallowCaptureMutation, lifecycleSource, 'C2 shallow capture mutation changes lifecycle source');
compileC1Mutation(shallowCaptureMutation, 'ts', 'C2 shallow capture');
assert.equal(c2SourcePasses(typesSource, shallowCaptureMutation, appSource), false, 'C2 shallow capture mutation fails source gate');
const shallowModeledSnapshot = c2ModelCapture(shallowCaptureMutation, nestedSetup) as SetupSnapshot & { lf: NestedCorner };
assert.strictEqual(shallowModeledSnapshot.lf.calibration, (nestedSetup.lf as NestedCorner).calibration, 'C2 shallow mutation shares nested corner data');

const laterEditMutation = lifecycleSource.replace('lr: captureSnapshotCorner(setup.lr),', 'lr: setup.lr as SetupSnapshotCorner,');
assert.notEqual(laterEditMutation, lifecycleSource, 'C2 later-edit mutation changes lifecycle source');
compileC1Mutation(laterEditMutation, 'ts', 'C2 later edit');
assert.equal(c2SourcePasses(typesSource, laterEditMutation, appSource), false, 'C2 later-edit mutation fails source gate');
const laterEditModeledSnapshot = c2ModelCapture(laterEditMutation, diffBaseSetup);
diffBaseSetup.lr.topBarHBird = 'Later edit';
assert.equal(laterEditModeledSnapshot.lr.topBarHBird, 'Later edit', 'C2 later-edit mutation mutates captured snapshot');

const omittedSnapshotMutation = appSource.replace('setupSnapshot: sessionSetupSnapshot,', '');
assert.notEqual(omittedSnapshotMutation, appSource, 'C2 omitted snapshot mutation changes App source');
compileC1Mutation(omittedSnapshotMutation, 'tsx', 'C2 omitted snapshot binding');
assert.equal(c2SourcePasses(typesSource, lifecycleSource, omittedSnapshotMutation), false, 'C2 omitted snapshot mutation fails source gate');
assert.equal(c2ModelSessionBinding(omittedSnapshotMutation, diffBaseSetup).setupSnapshot, undefined, 'C2 omitted snapshot mutation loses frozen state');

const omittedSetupIdMutation = appSource.replace('setupId: sessionSetup.id,', '');
assert.notEqual(omittedSetupIdMutation, appSource, 'C2 omitted setupId mutation changes App source');
compileC1Mutation(omittedSetupIdMutation, 'tsx', 'C2 omitted setupId binding');
assert.equal(c2SourcePasses(typesSource, lifecycleSource, omittedSetupIdMutation), false, 'C2 omitted setupId mutation fails source gate');
assert.equal(c2ModelSessionBinding(omittedSetupIdMutation, diffBaseSetup).setupId, undefined, 'C2 omitted setupId mutation loses provenance');

const topDiffMutation = lifecycleSource.replace("'gear', ", '');
assert.notEqual(topDiffMutation, lifecycleSource, 'C2 top-level diff mutation changes lifecycle source');
compileC1Mutation(topDiffMutation, 'ts', 'C2 top-level diff omission');
assert.equal(c2SourcePasses(typesSource, topDiffMutation, appSource), false, 'C2 top-level diff mutation fails source gate');
assert.equal(c2ModelDiff(topDiffMutation, diffBefore, diffAfter).some(row => row.field === 'gear'), false, 'C2 top-level mutation misses gear diff');

const cornerDiffMutation = lifecycleSource.replace("'spring', ", '');
assert.notEqual(cornerDiffMutation, lifecycleSource, 'C2 corner diff mutation changes lifecycle source');
compileC1Mutation(cornerDiffMutation, 'ts', 'C2 corner diff omission');
assert.equal(c2SourcePasses(typesSource, cornerDiffMutation, appSource), false, 'C2 corner diff mutation fails source gate');
assert.equal(c2ModelDiff(cornerDiffMutation, diffBefore, diffAfter).some(row => row.corner === 'lf' && row.field === 'spring'), false, 'C2 corner mutation misses LF spring diff');

const noiseDiffMutation = lifecycleSource.replace("'gear', 'toe'", "'chassis', 'gear', 'toe'");
assert.notEqual(noiseDiffMutation, lifecycleSource, 'C2 noise diff mutation changes lifecycle source');
compileC1Mutation(noiseDiffMutation, 'ts', 'C2 identity noise');
assert.equal(c2SourcePasses(typesSource, noiseDiffMutation, appSource), false, 'C2 identity noise mutation fails source gate');
assert.equal(c2ModelDiff(noiseDiffMutation, diffBefore, diffNoise).some(row => row.field === 'chassis'), true, 'C2 noise mutation emits identity diff');

const loggingMutation = appSource
  .replace('captureSetupSnapshot, displayVersionLabel', 'captureSetupSnapshot, displayVersionLabel, withSetupDiffLog')
  .replace(
    'return [{ ...candidate, updatedAt: !prior || comparable(prior) !== comparable(candidate) ? now : candidate.updatedAt }];',
    "const logged = prior?.lifecycleRole === 'weekend' ? withSetupDiffLog(prior, candidate, now) : candidate;\n      return [{ ...logged, updatedAt: !prior || comparable(prior) !== comparable(logged) ? now : candidate.updatedAt }];",
  );
assert.notEqual(loggingMutation, appSource, 'C2 logging mutation changes App source');
compileC1Mutation(loggingMutation, 'tsx', 'C2 hot-path logging');
assert.equal(c2SourcePasses(typesSource, lifecycleSource, loggingMutation), false, 'C2 hot-path logging mutation fails source gate');
assert.equal(c2EditBurstChangeCount(loggingMutation, snapshotSourceSetup, 3), (snapshotSourceSetup.changeLog?.length || 0) + 3, 'C2 logging mutation appends one legacy row per edit');

// ── C3 session diff UI / Quick Adjust coexistence ────────────────────────────

let c3AssertionCount = 0;
const killedC3Mutations: string[] = [];
const c3Equal = (actual: unknown, expected: unknown, message: string) => {
  c3AssertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const c3Ok = (value: unknown, message: string) => {
  c3AssertionCount += 1;
  assert.ok(value, message);
};
const c3Kill = (name: string, failed: boolean) => {
  c3Ok(failed, `C3 mutation ${name} must fail`);
  killedC3Mutations.push(name);
};

type RuntimeExport = (...args: any[]) => any;
const productionFunctionSource = (source: string, name: string, endMarker: string): string => {
  const start = source.indexOf(`export function ${name}`);
  assert.ok(start >= 0, `C3 production function ${name} exists`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `C3 production function ${name} has stable end marker`);
  return source.slice(start, end);
};
const compileProductionExport = (
  source: string,
  name: string,
  endMarker: string,
  dependencies: Record<string, unknown>,
): RuntimeExport => {
  const compiled = transformSync(productionFunctionSource(source, name, endMarker), {
    loader: 'tsx',
    format: 'cjs',
    target: 'es2022',
    jsx: 'transform',
  }).code;
  const moduleBox = { exports: {} as Record<string, RuntimeExport> };
  const dependencyNames = Object.keys(dependencies);
  const evaluate = new Function('module', 'exports', ...dependencyNames, compiled);
  evaluate(moduleBox, moduleBox.exports, ...dependencyNames.map(key => dependencies[key]));
  return moduleBox.exports[name];
};
const compilePendingResolver = (source: string) => compileProductionExport(
  source,
  'resolvePendingSetupDiff',
  '\nexport function PendingSetupDiffSummary',
  { captureSetupSnapshot, diffSetupSnapshots, isWeekendFinished },
);
const compileBoundResolver = (source: string) => compileProductionExport(
  source,
  'resolveBoundSetupDiff',
  '\nexport function BoundSetupDiffSummary',
  { captureSetupSnapshot, diffSetupSnapshots, lifecycleSetupId },
);
const renderProductionSummary = (
  source: string,
  name: string,
  endMarker: string,
  props: Record<string, unknown>,
): string => {
  const Summary = compileProductionExport(source, name, endMarker, { React });
  return renderToStaticMarkup(React.createElement(Summary as React.ComponentType<any>, props));
};
const compileInlineExport = (source: string, name: string, dependencies: Record<string, unknown>): RuntimeExport => {
  const compiled = transformSync(source, { loader: 'tsx', format: 'cjs', target: 'es2022', jsx: 'transform' }).code;
  const moduleBox = { exports: {} as Record<string, RuntimeExport> };
  const dependencyNames = Object.keys(dependencies);
  const evaluate = new Function('module', 'exports', ...dependencyNames, compiled);
  evaluate(moduleBox, moduleBox.exports, ...dependencyNames.map(key => dependencies[key]));
  return moduleBox.exports[name];
};
const renderSessionDetails = (source: string, record: SessionRecord, boundDiff: unknown): string => {
  const BoundSetupDiffSummary = compileProductionExport(
    source,
    'BoundSetupDiffSummary',
    '\nexport function LogSetupChangesButton',
    { React },
  );
  const SessionSetupDetails = compileProductionExport(
    source,
    'SessionSetupDetails',
    '\n// ── Main RaceWeekendView',
    { React, displayLifecycleText, BoundSetupDiffSummary },
  );
  return renderToStaticMarkup(React.createElement(SessionSetupDetails as React.ComponentType<any>, { record, boundDiff }));
};
const compileNavigationCallback = (source: string): RuntimeExport => {
  const match = source.match(/onLogSetupChanges=\{\(\) => \{\n([\s\S]*?)\n\s*\}\}/);
  assert.ok(match, 'C3 App navigation callback body exists');
  return compileInlineExport(
    `export function runNavigation(setSetupSubTab: (tab: string) => void, setActiveTab: (tab: string) => void) {\n${match[1]}\n}`,
    'runNavigation',
    {},
  );
};
const compileNewRecordFactory = (source: string): RuntimeExport => {
  const startMarker = 'const newRecord: SessionRecord = ';
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, 'C3 App newRecord production object exists');
  const objectStart = start + startMarker.length;
  const objectEnd = source.indexOf('\n    };', objectStart);
  assert.ok(objectEnd > objectStart, 'C3 App newRecord production object has end');
  const objectSource = source.slice(objectStart, objectEnd + '\n    }'.length);
  return compileInlineExport(
    `export function buildSessionRecord(sessionSetup: any, sessionSetupSnapshot: any, sessionName: string, data: any, targetWeekend: any, initialTires: any, initialPressures: any, pressureSourceNote: any, resolvedTime: string) { const sessionSetupUsed = sessionSetupSnapshot.chassis || 'No starting setup'; return ${objectSource}; }`,
    'buildSessionRecord',
    {},
  );
};
const compileQuickUpdatedSetups = (source: string): RuntimeExport => {
  const block = source.slice(source.indexOf('const handleCommitQuickAdjust'), source.indexOf('// Session weather helpers'));
  const loggedStart = block.indexOf('const loggedQuickSetup =');
  const start = loggedStart >= 0 ? loggedStart : block.indexOf('const updatedSetups =');
  const end = block.indexOf('\n    const updatedWeekends', start);
  assert.ok(start >= 0 && end > start, 'C3 Quick Adjust updatedSetups production slice exists');
  const assignment = block.slice(start, end);
  return compileInlineExport(
    `export function buildUpdatedSetups(savedSetupsRef: any, result: any, target: any, now: string, withSetupDiffLog: any) { ${assignment}\nreturn updatedSetups; }`,
    'buildUpdatedSetups',
    {},
  );
};

const c3SourcePasses = (setupUi: string, raceUi: string, app: string): boolean => {
  const quickCommit = app.slice(app.indexOf('const handleCommitQuickAdjust'), app.indexOf('// Session weather helpers'));
  const sessionCreate = app.slice(app.indexOf('const handleCreateNewSession'), app.indexOf('const handleDeleteSession'));
  return setupUi.includes('export function resolvePendingSetupDiff')
    && setupUi.includes('const newestSession = weekend.sessions[0];')
    && setupUi.includes('diffSetupSnapshots(newestSession.setupSnapshot, currentSnapshot)')
    && setupUi.includes('weekend.baselineSetupId')
    && setupUi.includes('<PendingSetupDiffSummary pending={pending} />')
    && setupUi.includes('Pending — will bind to next session')
    && setupUi.includes('min-w-0 break-words min-[360px]:text-right text-on-surface-variant')
    && setupUi.includes('<LegacySetupLog changes={setupItem.changeLog} />')
    && setupUi.includes('filter(change => !change.runId)')
    && setupUi.includes('legacyChanges.map(change => (')
    && !setupUi.includes('[...legacyChanges].reverse()')
    && !setupUi.includes('Live-Trackside Changes')
    && raceUi.includes('export function resolveBoundSetupDiff')
    && raceUi.includes('weekend.sessions[sessionIndex + 1]')
    && raceUi.includes('diffSetupSnapshots(olderSession.setupSnapshot, record.setupSnapshot)')
    && raceUi.includes('weekend.baselineSetupId')
    && raceUi.includes('<SessionSetupDetails record={sx} boundDiff={boundDiff} />')
    && raceUi.includes('Bound setup changes')
    && raceUi.includes('min-w-0 break-words min-[360px]:text-right')
    && raceUi.includes('<LogSetupChangesButton onLogSetupChanges={onLogSetupChanges} />')
    && raceUi.includes('Log setup changes')
    && raceUi.includes("<p><strong>Notes:</strong> {record.competitionNotes || 'None'}</p>")
    && raceUi.includes('record.adjustments.map(adjustment => <li key={adjustment.id}>{adjustment.label} {adjustment.value}</li>)')
    && !raceUi.includes('const getSessionDiffPair =')
    && !raceUi.includes('<SetupDiffView')
    && app.includes("setSetupSubTab('setups');\n                    setActiveTab('setups');")
    && !/withSetupDiffLog|diffSetupSnapshots|captureSetupSnapshot/.test(quickCommit)
    && !/boundSetupDiff\s*:|pendingSetupDiff\s*:|setupDiff\s*:/.test(sessionCreate);
};
c3Equal(c3SourcePasses(setupSource, raceWeekendSource, appSource), true, 'C3 production source contract passes');

const startingSetup: Setup = {
  ...diffBaseSetup,
  id: 'setup-starting-c3',
  carId: 'car-a',
  lifecycleRole: 'baseline',
  gear: '5.83',
  lf: { ...diffBaseSetup.lf, spring: '475' },
  changeLog: [
    { id: 'legacy-visible', timestamp: '2026-07-18T12:00:00.000Z', label: 'Old notebook row', before: '5.67', after: '5.83' },
    { id: 'legacy-second', timestamp: '2026-07-18T12:30:00.000Z', label: 'Second notebook row', before: '475', after: '500' },
  ],
};
const hotLapsSetup: Setup = {
  ...diffBaseSetup,
  id: 'setup-live-c3',
  carId: 'car-a',
  lifecycleRole: 'weekend',
  sourceSetupId: startingSetup.id,
  weekendId: 'wknd-c3',
  gear: '6.00',
  lf: { ...diffBaseSetup.lf, spring: '500' },
  changeLog: startingSetup.changeLog,
};
const hotLapsSnapshot = captureSetupSnapshot(hotLapsSetup);
const hotLapsRecord: SessionRecord = {
  id: 'session-hot-laps', type: 'HL', sessionType: 'Hot Laps', name: 'Hot Laps', track: 'Track', condition: 'Tacky', bestLap: '15.200',
  setupId: hotLapsSetup.id, setupSnapshot: hotLapsSnapshot, setupUsed: hotLapsSnapshot.chassis, adjustments: [], competitionNotes: 'Free on entry',
};
const ownerWeekendBefore: RaceWeekend = {
  id: 'wknd-c3', name: 'Owner fixture', track: 'Track', date: 'Jul 18, 2026', status: 'active',
  baselineSetupId: startingSetup.id, activeSetupId: hotLapsSetup.id, setupId: hotLapsSetup.id,
  sessions: [hotLapsRecord],
};
const activeHotLaps: ActiveSession = {
  id: hotLapsRecord.id,
  weekendId: ownerWeekendBefore.id,
  name: hotLapsRecord.name,
  track: hotLapsRecord.track,
  setupUsed: hotLapsRecord.setupUsed || '',
  condition: hotLapsRecord.condition,
  weather: '',
  time: '',
  bestLap: hotLapsRecord.bestLap,
  avgLap: '',
  finishPos: '',
  gap: '',
  maxRpm: '',
  leaderLap: '',
  leaderGap: '',
  diagnostics: { cornerEntry: 'NEUTRAL', centerApex: 'NEUTRAL', cornerExit: 'NEUTRAL' },
  adjustments: [],
  pressures: { lf: '', rf: '', lr: '', rr: '' },
  tires: {
    lf: { compound: '', size: '', airPressure: '' }, rf: { compound: '', size: '', airPressure: '' },
    lr: { compound: '', size: '', airPressure: '' }, rr: { compound: '', size: '', airPressure: '' },
  },
  competitionNotes: '',
};
const quickAdjustResult = applyQuickAdjust(
  hotLapsSetup,
  activeHotLaps,
  { kind: 'gear', value: '6.20' },
  [ownerWeekendBefore],
  '2026-07-18T13:00:00.000Z',
  'owner-quick-adjust',
);
c3Ok(quickAdjustResult.ok, 'C3 owner fixture Quick Adjust succeeds through real production code');
if (quickAdjustResult.ok === false) throw new Error(quickAdjustResult.error);
const qualifyingSetup: Setup = {
  ...quickAdjustResult.setup,
  lf: { ...quickAdjustResult.setup.lf, spring: '525' },
};
const pendingResolver = compilePendingResolver(setupSource);
const pendingBeforeQualifying = pendingResolver(
  [ownerWeekendBefore],
  [startingSetup, qualifyingSetup],
  qualifyingSetup,
  qualifyingSetup.id,
);
c3Equal(pendingBeforeQualifying.status, 'available', 'C3 pending uses active Race Day setup lineage');
if (pendingBeforeQualifying.status !== 'available') throw new Error(pendingBeforeQualifying.reason);
c3Equal(pendingBeforeQualifying.rows, [
  { label: 'Gear', field: 'gear', before: '6.00', after: '6.20' },
  { label: 'LF Spring', corner: 'lf', field: 'spring', before: '500', after: '525' },
], 'C3 pending rows are deterministic edit + Quick Adjust net effect');

const qualifyingSnapshot = captureSetupSnapshot(qualifyingSetup);
const qualifyingRecord: SessionRecord = {
  ...hotLapsRecord,
  id: 'session-qualifying', type: 'Q1', sessionType: 'Qualifying', name: 'Qualifying', bestLap: '',
  setupSnapshot: qualifyingSnapshot, adjustments: [], competitionNotes: 'Notes stay attached to run',
};
const hotLapsWithAdjustment: SessionRecord = { ...hotLapsRecord, adjustments: quickAdjustResult.session.adjustments };
const ownerWeekendAfter: RaceWeekend = { ...ownerWeekendBefore, sessions: [qualifyingRecord, hotLapsWithAdjustment] };
const boundResolver = compileBoundResolver(raceWeekendSource);
const qualifyingBound = boundResolver(ownerWeekendAfter, [startingSetup, qualifyingSetup], qualifyingRecord);
c3Equal(qualifyingBound.status, 'available', 'C3 qualifying bound diff resolves');
if (qualifyingBound.status !== 'available') throw new Error(qualifyingBound.reason);
c3Equal(qualifyingBound.rows, pendingBeforeQualifying.rows, 'C3 pending-before equals Qualifying bound-after exactly');
c3Equal(qualifyingBound.sourceLabel, 'Hot Laps', 'C3 Qualifying binds immediately older Hot Laps snapshot');
c3Equal(hotLapsWithAdjustment.adjustments?.length, 1, 'C3 Quick Adjust remains one net row in original run');
c3Equal(qualifyingRecord.adjustments?.length, 0, 'C3 bound diff does not append Quick Adjust rows to Qualifying');
c3Equal(qualifyingSetup.changeLog?.filter(change => change.runId).length, 1, 'C3 Quick Adjust setup history remains one coalesced run row');

const firstSessionBound = boundResolver(ownerWeekendBefore, [startingSetup, hotLapsSetup], hotLapsRecord);
c3Equal(firstSessionBound.status, 'available', 'C3 first session resolves Starting Setup');
if (firstSessionBound.status !== 'available') throw new Error(firstSessionBound.reason);
c3Equal(firstSessionBound.sourceLabel, 'Starting Setup', 'C3 first session names exact baseline source');
c3Equal(firstSessionBound.rows, [
  { label: 'Gear', field: 'gear', before: '5.83', after: '6.00' },
  { label: 'LF Spring', corner: 'lf', field: 'spring', before: '475', after: '500' },
], 'C3 first session compares baselineSetupId snapshot before session snapshot');

const pendingMarkup = renderProductionSummary(
  setupSource,
  'PendingSetupDiffSummary',
  '\nexport function LegacySetupLog',
  { pending: pendingBeforeQualifying },
);
c3Ok(pendingMarkup.includes('Pending — will bind to next session'), 'C3 real pending renderer carries exact heading');
c3Ok(pendingMarkup.includes('6.00') && pendingMarkup.includes('6.20') && pendingMarkup.includes('LF Spring'), 'C3 real pending renderer shows deterministic rows');
const boundMarkup = renderProductionSummary(
  raceWeekendSource,
  'BoundSetupDiffSummary',
  '\nexport function LogSetupChangesButton',
  { boundDiff: qualifyingBound },
);
c3Ok(boundMarkup.includes('Bound setup changes') && boundMarkup.includes('Hot Laps'), 'C3 real bound renderer carries source and compact heading');
const legacyMarkup = renderProductionSummary(
  setupSource,
  'LegacySetupLog',
  '\n// ─── Corner Form Sub-component',
  { changes: qualifyingSetup.changeLog },
);
c3Ok(legacyMarkup.includes('Legacy log') && legacyMarkup.includes('Old notebook row'), 'C3 real Legacy log renders stored non-run rows');
c3Ok(!legacyMarkup.includes('Gear 6.00 to 6.20') && !legacyMarkup.includes('owner-quick-adjust'), 'C3 real Legacy log omits Quick Adjust runId rows');
c3Ok(legacyMarkup.startsWith('<details') && !legacyMarkup.startsWith('<details open'), 'C3 Legacy log stays collapsed by default');
c3Ok(legacyMarkup.indexOf('Old notebook row') < legacyMarkup.indexOf('Second notebook row'), 'C3 Legacy log preserves stored entry order');

const legacySnapshotMissing = boundResolver(
  { ...ownerWeekendBefore, sessions: [{ ...hotLapsRecord, setupSnapshot: undefined }] },
  [startingSetup, hotLapsSetup],
  { ...hotLapsRecord, setupSnapshot: undefined },
);
c3Equal(legacySnapshotMissing.status, 'unavailable', 'C3 legacy missing snapshot is honestly unavailable');
const legacyBaselineMissing = boundResolver(
  { ...ownerWeekendBefore, baselineSetupId: undefined },
  [hotLapsSetup],
  hotLapsRecord,
);
c3Equal(legacyBaselineMissing.status, 'unavailable', 'C3 missing Starting Setup is honestly unavailable');
const pendingLegacyMissing = pendingResolver(
  [{ ...ownerWeekendBefore, sessions: [{ ...hotLapsRecord, setupSnapshot: undefined }] }],
  [startingSetup, qualifyingSetup],
  qualifyingSetup,
  qualifyingSetup.id,
);
c3Equal(pendingLegacyMissing.status, 'unavailable', 'C3 pending never reconstructs missing snapshot from mutable setup');
const unrelatedRecord = { ...qualifyingRecord, setupId: 'setup-unrelated' };
c3Equal(boundResolver({ ...ownerWeekendAfter, sessions: [unrelatedRecord, hotLapsWithAdjustment] }, [startingSetup, qualifyingSetup], unrelatedRecord).status, 'unavailable', 'C3 unrelated session provenance is rejected');
const noChangeRecord = { ...qualifyingRecord, setupSnapshot: hotLapsSnapshot };
const noChangeWeekend = { ...ownerWeekendBefore, sessions: [noChangeRecord, hotLapsRecord] };
const noChangeBound = boundResolver(noChangeWeekend, [startingSetup, hotLapsSetup], noChangeRecord);
c3Equal(noChangeBound.status === 'available' ? noChangeBound.rows : null, [], 'C3 equal snapshots yield honest zero rows');

const testSnapshot = captureSetupSnapshot({ ...hotLapsSetup, gear: '5.90' });
const testRecord: SessionRecord = { ...hotLapsRecord, id: 'session-test', name: 'Test', setupSnapshot: testSnapshot };
const threeSessionWeekend = { ...ownerWeekendAfter, sessions: [qualifyingRecord, hotLapsRecord, testRecord] };
const oldestMutationSource = raceWeekendSource.replace(
  'weekend.sessions[sessionIndex + 1]',
  'weekend.sessions[weekend.sessions.length - 1]',
);
c3Ok(oldestMutationSource !== raceWeekendSource, 'C3 oldest-session mutation changes production helper');
const oldestMutationResult = compileBoundResolver(oldestMutationSource)(threeSessionWeekend, [startingSetup, qualifyingSetup], qualifyingRecord);
c3Kill('newest-first-i-plus-one', JSON.stringify(oldestMutationResult.rows) !== JSON.stringify(qualifyingBound.rows));

const reversedOperandsSource = raceWeekendSource.replace(
  'diffSetupSnapshots(olderSession.setupSnapshot, record.setupSnapshot)',
  'diffSetupSnapshots(record.setupSnapshot, olderSession.setupSnapshot)',
);
c3Ok(reversedOperandsSource !== raceWeekendSource, 'C3 reversed-operands mutation changes production helper');
const reversedResult = compileBoundResolver(reversedOperandsSource)(ownerWeekendAfter, [startingSetup, qualifyingSetup], qualifyingRecord);
c3Kill('before-after-operands', reversedResult.rows?.[0]?.before !== qualifyingBound.rows[0].before);

const baselineActiveMutationSource = raceWeekendSource.replaceAll('weekend.baselineSetupId', 'weekend.activeSetupId');
c3Ok(baselineActiveMutationSource !== raceWeekendSource, 'C3 active-setup baseline mutation changes production helper');
const baselineActiveResult = compileBoundResolver(baselineActiveMutationSource)(ownerWeekendBefore, [startingSetup, qualifyingSetup], hotLapsRecord);
c3Kill('first-session-active-current-setup', JSON.stringify(baselineActiveResult.rows) !== JSON.stringify(firstSessionBound.rows));

const baselineLifecycleMutationSource = raceWeekendSource.replace(
  `const baselineSetup = weekend.baselineSetupId
    ? savedSetups.find(item => item.id === weekend.baselineSetupId)
    : undefined;`,
  `const mutatedBaselineId = lifecycleSetupId(weekend);
  const baselineSetup = mutatedBaselineId
    ? savedSetups.find(item => item.id === mutatedBaselineId)
    : undefined;`,
);
c3Ok(baselineLifecycleMutationSource !== raceWeekendSource, 'C3 lifecycleSetupId mutation changes production helper');
const baselineLifecycleResult = compileBoundResolver(baselineLifecycleMutationSource)(ownerWeekendBefore, [startingSetup, qualifyingSetup], hotLapsRecord);
c3Kill('first-session-lifecycle-setup-id', JSON.stringify(baselineLifecycleResult.rows) !== JSON.stringify(firstSessionBound.rows));

const lineageBypassSource = raceWeekendSource.replace(
  'if (eventSetupId && record.setupId !== eventSetupId) {',
  'if (false) {',
);
c3Ok(lineageBypassSource !== raceWeekendSource, 'C3 lineage-bypass mutation changes production helper');
const lineageBypassResult = compileBoundResolver(lineageBypassSource)(
  { ...ownerWeekendBefore, sessions: [{ ...hotLapsRecord, setupId: 'setup-unrelated' }] },
  [startingSetup, hotLapsSetup],
  { ...hotLapsRecord, setupId: 'setup-unrelated' },
);
c3Kill('unrelated-setup-provenance', lineageBypassResult.status !== 'unavailable');

const pendingHeadingMutation = setupSource.replace('Pending — will bind to next session', '');
const pendingHeadingMarkup = renderProductionSummary(pendingHeadingMutation, 'PendingSetupDiffSummary', '\nexport function LegacySetupLog', { pending: pendingBeforeQualifying });
c3Kill('pending-view-removed', !pendingHeadingMarkup.includes('Pending — will bind to next session'));
const boundHeadingMutation = raceWeekendSource.replace('Bound setup changes', '');
const boundHeadingMarkup = renderProductionSummary(boundHeadingMutation, 'BoundSetupDiffSummary', '\nexport function LogSetupChangesButton', { boundDiff: qualifyingBound });
c3Kill('bound-summary-removed', !boundHeadingMarkup.includes('Bound setup changes'));
const legacyHeadingMutation = setupSource.replace('Legacy log', '');
const legacyHeadingMarkup = renderProductionSummary(legacyHeadingMutation, 'LegacySetupLog', '\n// ─── Corner Form Sub-component', { changes: startingSetup.changeLog });
c3Kill('legacy-disclosure-removed', !legacyHeadingMarkup.includes('Legacy log'));

const navigationCalls: string[] = [];
compileNavigationCallback(appSource)(
  (tab: string) => navigationCalls.push(`setup:${tab}`),
  (tab: string) => navigationCalls.push(`tab:${tab}`),
);
c3Equal(navigationCalls, ['setup:setups', 'tab:setups'], 'C3 compiled App navigation selects Setups subtab before tab');
const navigationMutation = appSource.replace("setSetupSubTab('setups');", '');
const mutatedNavigationCalls: string[] = [];
compileNavigationCallback(navigationMutation)(
  (tab: string) => mutatedNavigationCalls.push(`setup:${tab}`),
  (tab: string) => mutatedNavigationCalls.push(`tab:${tab}`),
);
c3Kill('log-setup-changes-app-wiring', JSON.stringify(mutatedNavigationCalls) !== JSON.stringify(navigationCalls));

const LogSetupChangesButton = compileProductionExport(
  raceWeekendSource,
  'LogSetupChangesButton',
  '\nexport function SessionSetupDetails',
  { React },
);
let navigationButtonClicks = 0;
const navigationButtonElement = LogSetupChangesButton({ onLogSetupChanges: () => { navigationButtonClicks += 1; } });
navigationButtonElement.props.onClick();
c3Equal(navigationButtonClicks, 1, 'C3 compiled Log setup changes button executes navigation callback');
const navigationButtonMutationSource = raceWeekendSource.replace('onClick={onLogSetupChanges}', 'onClick={() => undefined}');
const MutatedLogSetupChangesButton = compileProductionExport(
  navigationButtonMutationSource,
  'LogSetupChangesButton',
  '\nexport function SessionSetupDetails',
  { React },
);
const mutatedNavigationButtonElement = MutatedLogSetupChangesButton({ onLogSetupChanges: () => { navigationButtonClicks += 1; } });
mutatedNavigationButtonElement.props.onClick();
c3Kill('log-setup-changes-button', navigationButtonClicks === 1);

const sessionDetailsMarkup = renderSessionDetails(raceWeekendSource, hotLapsWithAdjustment, qualifyingBound);
c3Ok(sessionDetailsMarkup.includes('Free on entry') && sessionDetailsMarkup.includes('Gear') && sessionDetailsMarkup.includes('6.00 to 6.20'), 'C3 compiled run details render notes and existing Quick Adjust row');
const notesMutation = raceWeekendSource.replace("<p><strong>Notes:</strong> {record.competitionNotes || 'None'}</p>", '');
const notesMutationMarkup = renderSessionDetails(notesMutation, hotLapsWithAdjustment, qualifyingBound);
c3Kill('free-text-notes-removed', !notesMutationMarkup.includes('Free on entry'));
const quickRowsMutation = raceWeekendSource.replace(
  'record.adjustments.map(adjustment => <li key={adjustment.id}>{adjustment.label} {adjustment.value}</li>)',
  '[].map(adjustment => <li key={adjustment.id}>{adjustment.label} {adjustment.value}</li>)',
);
const quickRowsMutationMarkup = renderSessionDetails(quickRowsMutation, hotLapsWithAdjustment, qualifyingBound);
c3Kill('quick-adjust-rows-removed', !quickRowsMutationMarkup.includes('6.00 to 6.20'));

const buildSessionRecord = compileNewRecordFactory(appSource);
const builtSessionRecord = buildSessionRecord(
  qualifyingSetup,
  qualifyingSnapshot,
  'Qualifying',
  { type: 'Qualifying', trackCondition: '', conditionNotes: '', weather: '' },
  ownerWeekendAfter,
  activeHotLaps.tires,
  activeHotLaps.pressures,
  undefined,
  'Night',
);
c3Ok(!('boundSetupDiff' in builtSessionRecord), 'C3 compiled production session record persists no computed diff');
const persistedDiffMutation = appSource.replace(
  'setupSnapshot: sessionSetupSnapshot,',
  'setupSnapshot: sessionSetupSnapshot,\n      boundSetupDiff: [],',
);
const mutatedBuiltSessionRecord = compileNewRecordFactory(persistedDiffMutation)(
  qualifyingSetup,
  qualifyingSnapshot,
  'Qualifying',
  { type: 'Qualifying', trackCondition: '', conditionNotes: '', weather: '' },
  ownerWeekendAfter,
  activeHotLaps.tires,
  activeHotLaps.pressures,
  undefined,
  'Night',
);
c3Kill('session-diff-persisted', 'boundSetupDiff' in mutatedBuiltSessionRecord);

const baselineUpdatedSetups = compileQuickUpdatedSetups(appSource)(
  { current: [hotLapsSetup] },
  quickAdjustResult,
  { setup: hotLapsSetup },
  '2026-07-18T13:00:00.000Z',
  withSetupDiffLog,
);
c3Equal(baselineUpdatedSetups[0].changeLog?.filter((change: any) => change.runId).length, 1, 'C3 compiled Quick Adjust writer preserves one run-scoped row');
const quickLoggingMutation = appSource
  .replace('captureSetupSnapshot, displayVersionLabel', 'captureSetupSnapshot, displayVersionLabel, withSetupDiffLog')
  .replace(
    'const updatedSetups = savedSetupsRef.current.map(item => item.id === result.setup.id ? result.setup : item);',
    "const loggedQuickSetup = withSetupDiffLog(target.setup, result.setup, now);\n    const updatedSetups = savedSetupsRef.current.map(item => item.id === result.setup.id ? loggedQuickSetup : item);",
  );
const mutatedUpdatedSetups = compileQuickUpdatedSetups(quickLoggingMutation)(
  { current: [hotLapsSetup] },
  quickAdjustResult,
  { setup: hotLapsSetup },
  '2026-07-18T13:00:00.000Z',
  withSetupDiffLog,
);
c3Kill('quick-adjust-logging-rewire', mutatedUpdatedSetups[0].changeLog?.filter((change: any) => change.runId).length !== 1);

console.log(`C3 assertions: ${c3AssertionCount}`);
console.log(`C3 killed mutations: ${killedC3Mutations.join(', ')}`);

// ── C5 setup naming and rename affordance ───────────────────────────────────

let c5AssertionCount = 0;
const killedC5Mutations: string[] = [];
const c5Equal = (actual: unknown, expected: unknown, message: string) => {
  c5AssertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const c5Ok = (value: unknown, message: string) => {
  c5AssertionCount += 1;
  assert.ok(value, message);
};
const c5Kill = (name: string, failed: boolean) => {
  c5Ok(failed, `C5 mutation ${name} must fail`);
  killedC5Mutations.push(name);
};

const localHandlerSource = (source: string, name: string, nextName: string): string => {
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf(`\n\n  const ${nextName} =`, start);
  assert.ok(start >= 0 && end > start, `C5 real ${name} handler exists`);
  return source.slice(start, end).replace(`  const ${name} =`, `export const ${name} =`);
};
const compileLocalHandler = (
  source: string,
  name: string,
  nextName: string,
  dependencies: Record<string, unknown>,
): RuntimeExport => compileInlineExport(localHandlerSource(source, name, nextName), name, dependencies);

type CreationRun = {
  prevented: number;
  errors: boolean[];
  expanded: string[];
  clearedNames: string[];
  selections: string[];
  saves: Array<{ setups: Setup[]; activeId?: string; preserveInfoToast?: boolean }>;
  info: string[];
};
const runCreation = (
  source: string,
  initialSetups: Setup[],
  carId: string,
  typedName: string,
  mode: 'copy' | 'blank' | 'default',
): CreationRun => {
  const result: CreationRun = {
    prevented: 0,
    errors: [],
    expanded: [],
    clearedNames: [],
    selections: [],
    saves: [],
    info: [],
  };
  const handler = compileLocalHandler(source, 'handleAddNewSetup', 'handleRenameSetup', {
    pickLatestSetupForCar,
    setups: initialSetups,
    activeCarId: carId,
    newSetupName: typedName,
    setNewSetupNameError: (value: boolean) => { result.errors.push(value); },
    displayVersionLabel: (value: Setup) => value.versionLabel || value.chassis,
    activeCar: { id: carId, carType: 'Modified' },
    lifecycleLabel: () => 'Current Setup',
    cloneSetup,
    makeBlankSetup,
    onInfo: (message: string) => { result.info.push(message); },
    setExpandedId: (id: string) => { result.expanded.push(id); },
    setNewSetupName: (value: string) => { result.clearedNames.push(value); },
    setActiveId: (id: string) => { result.selections.push(id); },
    updateAndSaveSetups: (setups: Setup[], activeId?: string, preserveInfoToast?: boolean) => {
      result.saves.push({ setups, activeId, preserveInfoToast });
    },
    displayedSetups: initialSetups,
  });
  const event = { preventDefault: () => { result.prevented += 1; } };
  if (mode === 'default') handler(event);
  else handler(event, mode);
  return result;
};

const ownerSource = {
  ...setup('owner-source', 'car-owner', 'Jul 18, 2026'),
  chassis: 'Rocket XR1',
  track: 'Eldora',
  gear: '6.20',
  screenshots: ['owner-photo'],
  lifecycleRole: 'current' as const,
  versionLabel: 'Current Setup',
  changeLog: [{ id: 'legacy-owner', timestamp: '2026-07-18T10:00:00.000Z', label: 'Gear', field: 'gear', before: '6.00', after: '6.20' }],
};

for (const [label, typedName] of [['empty', ''], ['whitespace', '   \t  ']] as const) {
  const rejected = runCreation(setupSource, [ownerSource], 'car-owner', typedName, 'blank');
  c5Equal(rejected.prevented, 1, `C5 ${label} blank attempt prevents default`);
  c5Equal(rejected.errors, [true], `C5 ${label} blank attempt exposes exact error state`);
  c5Equal(rejected.saves.length, 0, `C5 ${label} blank attempt creates zero records and writes`);
  c5Equal(rejected.expanded.length, 0, `C5 ${label} blank attempt changes no expansion`);
  c5Equal(rejected.selections.length, 0, `C5 ${label} blank attempt changes no active selection`);
  c5Equal(rejected.info.length, 0, `C5 ${label} blank attempt shows no copy info`);
}

const noSourceDefault = runCreation(setupSource, [], 'car-owner', '', 'default');
c5Equal(noSourceDefault.errors, [true], 'C5 no-source default action follows blank-name guard');
c5Equal(noSourceDefault.saves.length, 0, 'C5 no-source default action has zero persistence effects');

const validBlank = runCreation(setupSource, [ownerSource], 'car-owner', '  Owner Blank Tune  ', 'blank');
c5Equal(validBlank.saves.length, 1, 'C5 named blank creates exactly one save transaction');
c5Equal(validBlank.saves[0].setups.length, 2, 'C5 named blank prepends exactly one record');
c5Equal(validBlank.saves[0].setups[0].chassis, 'Owner Blank Tune', 'C5 blank name is trimmed before persistence');
c5Equal(validBlank.saves[0].setups[0].lifecycleRole, 'current', 'C5 named blank is a Current Setup');
c5Equal(validBlank.saves[0].activeId, validBlank.saves[0].setups[0].id, 'C5 named blank becomes active selection');
c5Ok(!validBlank.saves[0].setups[0].chassis.includes('Setup #'), 'C5 valid blank never uses numbered fallback');

const copiedOwner = runCreation(setupSource, [ownerSource], 'car-owner', '', 'copy');
const copiedOwnerSetup = copiedOwner.saves[0].setups[0];
c5Equal(copiedOwner.saves.length, 1, 'C5 empty-name source copy stays frictionless');
c5Ok(copiedOwnerSetup.chassis.includes('Eldora') && copiedOwnerSetup.chassis.includes('from Eldora Jul 18, 2026'), 'C5 empty-name copy derives meaningful source-based name');
c5Equal(copiedOwnerSetup.sourceSetupId, ownerSource.id, 'C5 copy retains exact source provenance');
c5Equal(copiedOwnerSetup.gear, ownerSource.gear, 'C5 copy clones source tune');
c5Equal(copiedOwnerSetup.lr.topBarHBird, ownerSource.lr.topBarHBird, 'C5 copy clones source corner tune');
c5Equal(copiedOwnerSetup.screenshots, [], 'C5 copy clears source media');
c5Equal(copiedOwnerSetup.changeLog, [], 'C5 copy clears historical change rows');
c5Equal(copiedOwner.saves[0].preserveInfoToast, true, 'C5 copy preserves existing copy-info persistence behavior');
c5Equal(copiedOwner.info.length, 1, 'C5 copy retains one pressure provenance info notice');

const typedCopy = runCreation(setupSource, [ownerSource], 'car-owner', '  Feature Tune  ', 'copy');
c5Equal(typedCopy.saves[0].setups[0].chassis, 'Feature Tune', 'C5 typed trimmed copy name wins over derived name');

const whitespaceTrackSource = {
  ...ownerSource,
  track: '   ',
  chassis: 'Meaningful Chassis',
};
const whitespaceTrackCopy = runCreation(setupSource, [whitespaceTrackSource], 'car-owner', '', 'copy');
c5Ok(whitespaceTrackCopy.saves[0].setups[0].chassis.includes('Meaningful Chassis'), 'C5 whitespace-only source track falls through to meaningful chassis');
c5Ok(!whitespaceTrackCopy.saves[0].setups[0].chassis.includes('   '), 'C5 derived source name excludes raw whitespace track');

const creationFormSource = (source: string): string | null => {
  const start = source.indexOf('            <form onSubmit={handleAddNewSetup}');
  if (start < 0) return null;
  const close = source.indexOf('            </form>', start);
  if (close < 0) return null;
  return source.slice(start, close + '            </form>'.length);
};
const renderCreationForm = (source: string, activeSetup: Setup | null, newSetupName: string, newSetupNameError: boolean): string => {
  const form = creationFormSource(source);
  if (!form) return '';
  const Form = compileInlineExport(
    `export function CreationForm(props: any) { const { handleAddNewSetup, activeSetup, newSetupName, newSetupNameError, setNewSetupName } = props; return (${form}); }`,
    'CreationForm',
    { React },
  );
  return renderToStaticMarkup(React.createElement(Form as React.ComponentType<any>, {
    handleAddNewSetup: () => undefined,
    activeSetup,
    newSetupName,
    newSetupNameError,
    setNewSetupName: () => undefined,
  }));
};
const blankFormMarkup = renderCreationForm(setupSource, null, '', true);
c5Ok(blankFormMarkup.includes('required=""') && blankFormMarkup.includes('disabled=""'), 'C5 no-source blank control is required and visibly disabled while empty');
c5Ok(blankFormMarkup.includes('aria-invalid="true"') && blankFormMarkup.includes('aria-describedby="new-setup-name-error"'), 'C5 blank error has accessible input relationship');
c5Ok(blankFormMarkup.includes('id="new-setup-name-error"') && blankFormMarkup.includes('role="alert"') && blankFormMarkup.includes('Name this setup'), 'C5 blank error renders exact accessible hint');
const copyFormMarkup = renderCreationForm(setupSource, ownerSource, '', false);
c5Ok(!copyFormMarkup.includes('required=""'), 'C5 copy input does not impose blank-name browser validation');
const copyButtonMarkup = copyFormMarkup.slice(copyFormMarkup.indexOf('<button type="submit"'), copyFormMarkup.indexOf('</button>') + 9);
c5Ok(!copyButtonMarkup.includes('disabled=""') && copyButtonMarkup.includes('Copy latest'), 'C5 blankless copy submit remains enabled');
const blankButtonMarkup = copyFormMarkup.slice(copyFormMarkup.lastIndexOf('<button'), copyFormMarkup.lastIndexOf('</button>') + 9);
c5Ok(blankButtonMarkup.includes('disabled=""') && blankButtonMarkup.includes('Start blank'), 'C5 explicit blank action is visibly disabled while trimmed-empty');
const namedFormMarkup = renderCreationForm(setupSource, ownerSource, 'Named', false);
const namedBlankMarkup = namedFormMarkup.slice(namedFormMarkup.lastIndexOf('<button'), namedFormMarkup.lastIndexOf('</button>') + 9);
c5Ok(!namedBlankMarkup.includes('disabled=""'), 'C5 explicit blank action enables after a real name');

const numberedFallbackMutation = setupSource.replace(
  'const name = trimmedName || `${sourceName} ${today} — from ${sourceLabel || sourceName}`;',
  'const name = mode === \'blank\' ? `Setup #${displayedSetups.length + 1}` : trimmedName || `${sourceName} ${today} — from ${sourceLabel || sourceName}`;',
);
c5Kill('numbered-fallback-restored', runCreation(numberedFallbackMutation, [ownerSource], 'car-owner', 'Named Blank', 'blank').saves[0].setups[0].chassis.startsWith('Setup #'));

const removedGuardMutation = setupSource.replace('if (!source && !trimmedName) {', 'if (false) {');
c5Kill('blank-guard-removed', runCreation(removedGuardMutation, [ownerSource], 'car-owner', '', 'blank').saves.length === 1);
const whitespaceGuardMutation = setupSource.replace('if (!source && !trimmedName) {', 'if (!source && !newSetupName) {');
c5Kill('blank-guard-whitespace-weakened', runCreation(whitespaceGuardMutation, [ownerSource], 'car-owner', '   ', 'blank').saves.length === 1);
const copyBlockedMutation = setupSource.replace('if (!source && !trimmedName) {', 'if (!trimmedName) {');
c5Kill('blankless-copy-blocked', runCreation(copyBlockedMutation, [ownerSource], 'car-owner', '', 'copy').saves.length === 0);
const trimRemovedMutation = setupSource.replace('const trimmedName = newSetupName.trim();', 'const trimmedName = newSetupName;');
c5Kill('name-trim-removed', runCreation(trimRemovedMutation, [ownerSource], 'car-owner', '  Spaced Name  ', 'blank').saves[0].setups[0].chassis !== 'Spaced Name');
const rawSourceTruthinessMutation = setupSource.replace(
  "? source.track.trim() || source.chassis.trim() || displayVersionLabel(source).trim() || 'Current setup'",
  "? source.track || source.chassis || displayVersionLabel(source) || 'Current setup'",
);
c5Kill(
  'copy-source-whitespace-untrimmed',
  !runCreation(rawSourceTruthinessMutation, [whitespaceTrackSource], 'car-owner', '', 'copy').saves[0].setups[0].chassis.includes('Meaningful Chassis'),
);
const hintRemovedMutation = setupSource.replace('Name this setup</p>', '</p>');
c5Kill('inline-hint-removed', !renderCreationForm(hintRemovedMutation, null, '', true).includes('Name this setup'));
const blankDisabledRemovedMutation = setupSource.replace("disabled={!activeSetup && !newSetupName.trim()}", 'disabled={false}');
c5Kill('blank-control-disabled-removed', !renderCreationForm(blankDisabledRemovedMutation, null, '', false).includes('disabled=""'));
const explicitBlankDisabledRemovedMutation = setupSource.replace("disabled={!newSetupName.trim()} onClick={(event) => handleAddNewSetup(event, 'blank')}", "disabled={false} onClick={(event) => handleAddNewSetup(event, 'blank')}");
const explicitBlankMutationMarkup = renderCreationForm(explicitBlankDisabledRemovedMutation, ownerSource, '', false);
c5Kill('explicit-blank-disabled-removed', !explicitBlankMutationMarkup.slice(explicitBlankMutationMarkup.lastIndexOf('<button')).includes('disabled=""'));
const copyRequiredMutation = setupSource.replace('required={!activeSetup}', 'required');
c5Kill('copy-required-added', renderCreationForm(copyRequiredMutation, ownerSource, '', false).includes('required=""'));
const errorRelationshipMutation = setupSource.replace("aria-describedby={newSetupNameError ? 'new-setup-name-error' : undefined}", 'aria-describedby={undefined}');
c5Kill('blank-error-relationship-removed', !renderCreationForm(errorRelationshipMutation, null, '', true).includes('aria-describedby="new-setup-name-error"'));

const pencilExpressionSource = (source: string): string | null => {
  const anchor = source.indexOf('<button type="button" title="Rename setup"');
  if (anchor < 0) return null;
  const start = source.lastIndexOf('{', anchor);
  const close = source.indexOf('</button>}', start);
  return close < 0 ? null : source.slice(start, close + '</button>}'.length);
};
const renderPencil = (source: string, isReadOnly: boolean): string => {
  const expression = pencilExpressionSource(source);
  if (!expression) return '';
  const Button = compileInlineExport(
    `export function RenameButton(props: any) { const { isReadOnly, handleRenameSetup, setupItem } = props; return (<React.Fragment>${expression}</React.Fragment>); }`,
    'RenameButton',
    { React },
  );
  return renderToStaticMarkup(React.createElement(Button as React.ComponentType<any>, {
    isReadOnly,
    handleRenameSetup: () => undefined,
    setupItem: ownerSource,
  }));
};
const editablePencilMarkup = renderPencil(setupSource, false);
c5Equal((setupSource.match(/aria-label="Rename setup"/g) ?? []).length, 1, 'C5 product has one rename affordance definition');
c5Ok(editablePencilMarkup.includes('title="Rename setup"') && editablePencilMarkup.includes('aria-label="Rename setup"'), 'C5 editable pencil is accessible');
c5Ok(editablePencilMarkup.includes('min-h-11') && editablePencilMarkup.includes('min-w-11'), 'C5 editable pencil has at least 44x44px target at 360px');
const c5CssCompiler = await compile(cssSource, { base: process.cwd(), onDependency: () => undefined });
const c5PencilCss = c5CssCompiler.build(['flex', 'min-h-11', 'min-w-11', 'shrink-0', 'items-center', 'justify-center', 'rounded']);
c5Ok(/--spacing:\s*0\.25rem/.test(c5PencilCss), 'C5 compiled production CSS retains 4px spacing unit');
c5Ok(/\.min-h-11\s*\{\s*min-height:\s*calc\(var\(--spacing\) \* 11\)/.test(c5PencilCss), 'C5 compiled production CSS resolves pencil height to 11 spacing units = 44px');
c5Ok(/\.min-w-11\s*\{\s*min-width:\s*calc\(var\(--spacing\) \* 11\)/.test(c5PencilCss), 'C5 compiled production CSS resolves pencil width to 11 spacing units = 44px');
c5Equal(renderPencil(setupSource, true), '', 'C5 read-only card renders no rename pencil');

const runRename = (source: string, target: Setup, activeSetupId: string | undefined) => {
  let stopped = 0;
  let expanded: string | null = null;
  let pendingFocus: string | null = null;
  let persisted = 0;
  const rename = compileLocalHandler(source, 'handleRenameSetup', 'handleDeleteSetup', {
    getSetupEditability,
    weekends: c1Weekends,
    activeEventSetupId: activeSetupId,
    setExpandedId: (id: string) => { expanded = id; },
    setRenameFocusSetupId: (id: string) => { pendingFocus = id; },
    handleMetadataChange: () => { persisted += 1; },
  });
  rename({ stopPropagation: () => { stopped += 1; } }, target);
  return { stopped, expanded, pendingFocus, persisted };
};
const renameEffectSource = (source: string): string => {
  const marker = '  React.useEffect(() => {\n    if (!renameFocusSetupId || expandedId !== renameFocusSetupId) return;';
  const start = source.indexOf(marker);
  const bodyStart = source.indexOf('\n', start) + 1;
  const end = source.indexOf('\n  }, [expandedId, renameFocusSetupId]);', bodyStart);
  assert.ok(start >= 0 && end > bodyStart, 'C5 real rename focus effect exists');
  return source.slice(bodyStart, end);
};
const runRenameFocus = (source: string, renameFocusSetupId: string | null, expandedId: string | null) => {
  const focused: string[] = [];
  const cleared: Array<string | null> = [];
  const refs = {
    current: {
      [ownerSource.id]: { focus: () => { focused.push(ownerSource.id); } },
      'wrong-setup': { focus: () => { focused.push('wrong-setup'); } },
    },
  };
  const effect = compileInlineExport(
    `export function runEffect(renameFocusSetupId: string | null, expandedId: string | null, chassisInputRefs: any, setRenameFocusSetupId: any) {\n${renameEffectSource(source)}\n}`,
    'runEffect',
    {},
  );
  effect(renameFocusSetupId, expandedId, refs, (value: string | null) => { cleared.push(value); });
  return { focused, cleared };
};

const renameResult = runRename(setupSource, ownerSource, 'in-play');
c5Equal(renameResult, { stopped: 1, expanded: ownerSource.id, pendingFocus: ownerSource.id, persisted: 0 }, 'C5 pencil stops propagation, expands exact editable card, queues exact focus, and persists nothing');
const renameFocusResult = runRenameFocus(setupSource, renameResult.pendingFocus, renameResult.expanded);
c5Equal(renameFocusResult.focused, [ownerSource.id], 'C5 post-mount effect focuses exact setup Chassis input');
c5Equal(renameFocusResult.cleared, [null], 'C5 focus request is consumed once');
c5Equal(runRename(setupSource, c1Baseline, 'in-play').pendingFocus, null, 'C5 historical baseline cannot invoke rename handler');
c5Equal(runRename(setupSource, c1Final, 'in-play').pendingFocus, null, 'C5 historical final cannot invoke rename handler');
c5Equal(runRename(setupSource, c1Locked, 'in-play').pendingFocus, null, 'C5 explicitly locked setup cannot invoke rename handler');
c5Equal(runRename(setupSource, c1Finished, 'in-play').pendingFocus, null, 'C5 finished-weekend setup cannot invoke rename handler');
c5Equal(runRename(setupSource, c1InPlay, 'in-play').pendingFocus, null, 'C5 active event-owned setup cannot invoke rename handler');
c5Equal(runRename(setupSource, c1Unrelated, 'in-play').pendingFocus, c1Unrelated.id, 'C5 unrelated Current Setup remains renameable with live Race Day');

const metadataSave = (source: string) => {
  const saved: Array<{ setups: Setup[]; activeId: string }> = [];
  const change = compileLocalHandler(source, 'handleMetadataChange', 'handleAddNewSetup', {
    setups: [ownerSource],
    updateAndSaveSetups: (setups: Setup[], activeId: string) => { saved.push({ setups, activeId }); },
    activeId: ownerSource.id,
  });
  change(ownerSource.id, 'chassis', 'Renamed Owner Setup');
  return saved;
};
const metadataSaves = metadataSave(setupSource);
c5Equal(metadataSaves.length, 1, 'C5 actual Chassis typing uses existing save path once');
c5Equal(metadataSaves[0].setups[0].chassis, 'Renamed Owner Setup', 'C5 actual Chassis typing persists new name immediately');
c5Equal(metadataSaves[0].activeId, ownerSource.id, 'C5 rename typing preserves active selection');
const appSetupSaveBlock = appSource.slice(appSource.indexOf('const handleSaveSetups'), appSource.indexOf('const handleUpdateSession'));
c5Ok(appSetupSaveBlock.indexOf("localStorage.setItem('race_notes_saved_setups'") < appSetupSaveBlock.indexOf('markSavedDirty();'), 'C5 existing App path keeps immediate local rename persistence before C4 dirty mark');
c5Ok(!localHandlerSource(setupSource, 'handleRenameSetup', 'handleDeleteSetup').includes('updateAndSaveSetups'), 'C5 pencil handler itself has zero write path');

const pencilRemovedMutation = setupSource.replace('{!isReadOnly && <button type="button" title="Rename setup"', '{false && <button type="button" title="Rename setup"');
c5Kill('rename-pencil-removed', renderPencil(pencilRemovedMutation, false) === '');
const pencilUndersizedMutation = setupSource.replace('flex min-h-11 min-w-11 shrink-0 items-center', 'flex min-h-10 min-w-10 shrink-0 items-center');
const undersizedMarkup = renderPencil(pencilUndersizedMutation, false);
c5Kill('rename-pencil-undersized', !undersizedMarkup.includes('min-h-11') && !undersizedMarkup.includes('min-w-11'));
const stopRemovedMutation = setupSource.replace('    event.stopPropagation();\n    if (!getSetupEditability', '    if (!getSetupEditability');
c5Kill('rename-stop-propagation-removed', runRename(stopRemovedMutation, ownerSource, 'in-play').stopped === 0);
const expandRemovedMutation = setupSource.replace('    setExpandedId(target.id);\n    setRenameFocusSetupId(target.id);', '    setRenameFocusSetupId(target.id);');
c5Kill('rename-expand-removed', runRename(expandRemovedMutation, ownerSource, 'in-play').expanded === null);
const focusRemovedMutation = setupSource.replace('    chassisInputRefs.current[renameFocusSetupId]?.focus();', '    void chassisInputRefs.current[renameFocusSetupId];');
c5Kill('rename-focus-removed', runRenameFocus(focusRemovedMutation, ownerSource.id, ownerSource.id).focused.length === 0);
const wrongFocusMutation = setupSource.replace('chassisInputRefs.current[renameFocusSetupId]?.focus();', "chassisInputRefs.current['wrong-setup']?.focus();");
c5Kill('rename-wrong-input-focused', runRenameFocus(wrongFocusMutation, ownerSource.id, ownerSource.id).focused[0] === 'wrong-setup');
const readOnlyPencilMutation = setupSource.replace('{!isReadOnly && <button type="button" title="Rename setup"', '{true && <button type="button" title="Rename setup"');
c5Kill('rename-exposed-read-only', renderPencil(readOnlyPencilMutation, true).includes('Rename setup'));
const renameGuardMutation = setupSource.replace('if (!getSetupEditability(target, weekends, activeEventSetupId).editable) return;', 'if (false) return;');
c5Kill('rename-handler-read-only-guard-removed', runRename(renameGuardMutation, c1Baseline, 'in-play').pendingFocus === c1Baseline.id);
const focusPersistenceMutation = setupSource.replace(
  '    setRenameFocusSetupId(target.id);\n  };',
  "    setRenameFocusSetupId(target.id);\n    handleMetadataChange(target.id, 'chassis', target.chassis);\n  };",
);
c5Kill('rename-focus-adds-persistence', runRename(focusPersistenceMutation, ownerSource, 'in-play').persisted === 1);

const c5MutationSources = [
  numberedFallbackMutation,
  removedGuardMutation,
  whitespaceGuardMutation,
  copyBlockedMutation,
  trimRemovedMutation,
  rawSourceTruthinessMutation,
  hintRemovedMutation,
  blankDisabledRemovedMutation,
  explicitBlankDisabledRemovedMutation,
  copyRequiredMutation,
  errorRelationshipMutation,
  pencilRemovedMutation,
  pencilUndersizedMutation,
  stopRemovedMutation,
  expandRemovedMutation,
  focusRemovedMutation,
  wrongFocusMutation,
  readOnlyPencilMutation,
  renameGuardMutation,
  focusPersistenceMutation,
];
c5Ok(c5MutationSources.every(source => source !== setupSource), 'C5 every mutation changes real SetupView source');
c5Equal(new Set(c5MutationSources).size, c5MutationSources.length, 'C5 killed production mutations are unique');
c5Equal(new Set(killedC5Mutations).size, killedC5Mutations.length, 'C5 killed mutation labels are unique');
c5Ok(!setupSource.includes('Setup #${'), 'C5 final product contains no numbered anonymous setup fallback');

console.log(`C5 assertions: ${c5AssertionCount}`);
console.log(`C5 killed mutations: ${killedC5Mutations.join(', ')}`);

// D3: canonical disabled-delete reasons and the separate Garage route.
let d3SetupAssertions = 0;
const killedD3SetupMutations: string[] = [];
const d3SetupOk = (value: unknown, message: string) => { d3SetupAssertions += 1; assert.ok(value, message); };
const d3SetupEqual = (actual: unknown, expected: unknown, message: string) => { d3SetupAssertions += 1; assert.deepEqual(actual, expected, message); };
const compileSetupDeleteReason = (source: string): RuntimeExport => {
  const start = source.indexOf('const setupDeleteReason =');
  const end = source.indexOf('\n\n// ─── Helpers', start);
  assert.ok(start >= 0 && end > start, 'D3 production setup-delete reason exists');
  return compileInlineExport(source.slice(start, end).replace('const setupDeleteReason =', 'export const setupDeleteReason ='), 'setupDeleteReason', {});
};
const reason = compileSetupDeleteReason(setupSource);
d3SetupEqual(reason('historical-role'), 'Historical setup snapshots cannot be deleted individually.', 'D3 historical-role reason is exact');
d3SetupEqual(reason('locked'), 'Locked setups cannot be deleted individually.', 'D3 locked reason is exact');
d3SetupEqual(reason('finished-weekend'), 'Setups from finished Race Days cannot be deleted individually.', 'D3 finished-weekend reason is exact');
d3SetupEqual(reason('in-play-elsewhere'), 'The active Race Day setup is managed from Race Day.', 'D3 in-play reason remains distinct and does not alter canonical deletability');
d3SetupEqual(getSetupEditability(c1InPlay, c1Weekends, 'in-play').deletable, false, 'Repair 3 blocks active Race Day setup deletion before cascade');
for (const contract of [
  "title={editability.deletable ? 'Delete setup permanently' : setupDeleteReason(editability.reason)}",
  'aria-describedby={!editability.deletable ? `setup-delete-reason-${setupItem.id}` : undefined}',
  'disabled={!editability.deletable}',
  'id={`setup-delete-reason-${setupItem.id}`}',
  '{setupDeleteReason(editability.reason)}',
  'onClick={() => onGoToGarage?.()}',
  'Manage car in Garage',
  'min-h-11 rounded border',
]) d3SetupOk(setupSource.includes(contract), `D3 Setup production contract: ${contract}`);
let garageRoutes = 0;
const garageAction = compileInlineExport('export const routeToGarage = () => onGoToGarage?.();', 'routeToGarage', { onGoToGarage: () => { garageRoutes += 1; } });
garageAction();
d3SetupEqual(garageRoutes, 1, 'D3 separate production-equivalent Garage action routes exactly once');

const d3SetupSourcePasses = (source: string): boolean => {
  const compiledReason = compileSetupDeleteReason(source);
  return compiledReason('historical-role') === 'Historical setup snapshots cannot be deleted individually.'
    && compiledReason('locked') === 'Locked setups cannot be deleted individually.'
    && compiledReason('finished-weekend') === 'Setups from finished Race Days cannot be deleted individually.'
    && source.includes("title={editability.deletable ? 'Delete setup permanently' : setupDeleteReason(editability.reason)}")
    && source.includes('aria-describedby={!editability.deletable ? `setup-delete-reason-${setupItem.id}` : undefined}')
    && source.includes('disabled={!editability.deletable}')
    && source.includes('id={`setup-delete-reason-${setupItem.id}`}')
    && source.includes('onClick={() => onGoToGarage?.()}')
    && source.includes('Manage car in Garage');
};
const d3SetupMutations: Array<[string, string, string]> = [
  ['historical-reason-wrong', 'Historical setup snapshots cannot be deleted individually.', 'Historical setup can be deleted.'],
  ['locked-reason-wrong', 'Locked setups cannot be deleted individually.', 'Locked setup.'],
  ['accessible-title-removed', "title={editability.deletable ? 'Delete setup permanently' : setupDeleteReason(editability.reason)}", 'title="Delete setup permanently"'],
  ['reason-description-removed', 'aria-describedby={!editability.deletable ? `setup-delete-reason-${setupItem.id}` : undefined}', 'aria-describedby={undefined}'],
  ['garage-route-removed', 'onClick={() => onGoToGarage?.()}', 'onClick={() => undefined}'],
  ['canonical-disable-bypassed', 'disabled={!editability.deletable}', 'disabled={false}'],
];
for (const [name, before, after] of d3SetupMutations) {
  d3SetupEqual(setupSource.split(before).length - 1, 1, `D3 setup mutation ${name} has unique production target`);
  const mutated = setupSource.replace(before, after);
  let rejected = false;
  try { rejected = !d3SetupSourcePasses(mutated); } catch { rejected = true; }
  d3SetupOk(rejected, `D3 setup mutation ${name} is rejected`);
  killedD3SetupMutations.push(name);
}
d3SetupEqual(new Set(killedD3SetupMutations).size, killedD3SetupMutations.length, 'D3 setup mutation labels are unique');
console.log(`D3 setup assertions: ${d3SetupAssertions}`);
console.log(`D3 setup killed mutations (${killedD3SetupMutations.length}): ${killedD3SetupMutations.join(', ')}`);

console.log('CHUNK5_SETUP_HARNESS PASS');
