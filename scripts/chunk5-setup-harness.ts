import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import type { RaceWeekend, SessionRecord, Setup, SetupSnapshot, SetupSnapshotCorner } from '../src/types';
import { cloneSetup, makeBlankSetup, normalizeSetup, pickImmediatePriorSetupForCar, pickLatestSetupForCar } from '../src/lib/setupCompat';
import { calculateTireStagger, SETUP_STEPS, formatPressureBlock, formatPsiValue, formatStoredNumber, fourBarAdjustmentId, fourBarAdjustmentLabel, legacyValueNote, mirrorPressureBlockToTires, parseStoredNumber, pressureBlockHasValue, resolveSessionPressureBlock, setupPressureBlock } from '../src/lib/setupSteps';
import { captureSetupSnapshot, diffSetupSnapshots, getSetupEditability, isSetupLocked } from '../src/lib/setupLifecycle';

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
const typesSource = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
const syncSource = readFileSync(new URL('../src/lib/sync.ts', import.meta.url), 'utf8');
const raceWeekendSource = readFileSync(new URL('../src/components/RaceWeekendView.tsx', import.meta.url), 'utf8');
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
const setupSource = readFileSync(new URL('../src/components/SetupView.tsx', import.meta.url), 'utf8');
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

const lifecycleSource = readFileSync(new URL('../src/lib/setupLifecycle.ts', import.meta.url), 'utf8');
assert.match(lifecycleSource, /export type SetupEditabilityReason =/, 'C1 exports typed editability reasons');
assert.match(lifecycleSource, /'historical-role'[\s\S]*'locked'[\s\S]*'finished-weekend'[\s\S]*'in-play-elsewhere'/, 'C1 keeps every required typed reason');
assert.match(lifecycleSource, /export const getSetupEditability = \(/, 'C1 exports one canonical predicate');
assert.match(lifecycleSource, /if \(activeEventSetupId && setup\.id === activeEventSetupId\) \{\s*return \{ editable: false, deletable: true, reason: 'in-play-elsewhere' \};/, 'C1 freezes only active event setup while retaining deletion');
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
assert.deepEqual(getSetupEditability(c1InPlay, c1Weekends, 'in-play'), c1Expected(false, true, 'in-play-elsewhere'), 'C1 active event setup is edit-frozen but deletable');
assert.deepEqual(getSetupEditability(c1Unrelated, c1Weekends, 'in-play'), c1Expected(true, true, null), 'C1 unrelated live-Race-Day setup remains editable and deletable');
assert.equal(isSetupLocked(c1InPlay, c1Weekends), false, 'C1 in-play rule does not redefine historical locking');
assert.equal(getSetupEditability({ ...c1Unrelated, chassis: 'Renamed live setup' }, c1Weekends, 'in-play').editable, true, 'C1 owner live-Race-Day chassis rename remains enabled');

const c1SourcePasses = (lifecycle: string, setupView: string, app: string): boolean => (
  lifecycle.includes("setup.lifecycleRole === 'baseline' || setup.lifecycleRole === 'final'")
  && lifecycle.includes("if (activeEventSetupId && setup.id === activeEventSetupId)")
  && lifecycle.includes("deletable: true, reason: 'in-play-elsewhere'")
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
  if (!lifecycle.includes("deletable: true, reason: 'in-play-elsewhere'") && candidate.id === activeEventSetupId) {
    return c1Expected(false, false, 'in-play-elsewhere');
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

const deleteBlockMutation = lifecycleSource.replace("return { editable: false, deletable: true, reason: 'in-play-elsewhere' };", "return { editable: false, deletable: false, reason: 'in-play-elsewhere' };");
assert.notEqual(deleteBlockMutation, lifecycleSource, 'C1 delete-block mutation changes production predicate');
compileC1Mutation(deleteBlockMutation, 'ts', 'in-play delete block');
assert.equal(c1SourcePasses(deleteBlockMutation, setupSource, appSource), false, 'C1 delete-block mutation fails source gate');
assert.equal(c1ModelEditability(deleteBlockMutation, c1InPlay, 'in-play').deletable, false, 'C1 delete-block mutation prevents required deletion');
assert.equal(c1ModelEditability(lifecycleSource, c1InPlay, 'in-play').deletable, true, 'C1 baseline permits in-play deletion');

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

console.log('CHUNK5_SETUP_HARNESS PASS');
