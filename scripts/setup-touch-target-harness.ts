import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const parentCommit = 'ace4da1';
const setupPath = 'src/components/SetupView.tsx';
const stepperPath = 'src/components/ui/NumberStepper.tsx';
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readParent = (path: string) => execFileSync(
  'git', ['show', `${parentCommit}:${path}`], { cwd: root, encoding: 'utf8' },
);
const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');
const normalizeSpace = (value: string) => value.replace(/\s+/g, ' ').trim();
const countExact = (source: string, value: string) => source.split(value).length - 1;
const replaceExact = (source: string, current: string, parent: string, expected: number, label: string) => {
  assert.equal(countExact(source, current), expected, `${label}: exact current count`);
  return source.split(current).join(parent);
};
const replaceExactAfter = (source: string, marker: string, current: string, parent: string, label: string) => {
  const markerAt = source.indexOf(marker);
  const currentAt = source.indexOf(current, markerAt);
  assert.ok(markerAt >= 0 && currentAt > markerAt, `${label}: current contract follows marker`);
  return source.slice(0, currentAt) + parent + source.slice(currentAt + current.length);
};

const setupSource = read(setupPath);
const parentSetupSource = readParent(setupPath);
const stepperSource = read(stepperPath);
const parentStepperSource = readParent(stepperPath);

const currentInp = "const INP = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-1.5 min-h-12 outline-none rounded';";
const parentInp = "const INP = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded';";
const currentSelectClass = 'w-full min-w-0 min-h-12 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-2 outline-none rounded';
const parentSelectClass = 'w-full min-w-0 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-2 py-1 outline-none rounded';
const currentInputClass = 'w-full min-h-12 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded';
const parentInputClass = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded';
const currentNotesClass = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded min-h-[60px] resize-y';
const parentNotesClass = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded min-h-[60px] resize-y';
const currentDetailsGrid = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
const parentDetailsGrid = 'grid grid-cols-2 gap-4';
const currentCornerGrid = 'min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3';
const parentCornerGrid = 'min-w-0 grid grid-cols-2 gap-1.5 sm:gap-3';

assert.ok(setupSource.includes(currentInp), 'shared INP owns min-h-12 text-sm contract');
assert.equal((setupSource.match(/className=\{INP\}/g) ?? []).length, 5, 'exact five shared INP uses');

let revertedSetup = setupSource;
revertedSetup = replaceExact(revertedSetup, currentInp, parentInp, 1, 'shared INP');
revertedSetup = replaceExact(revertedSetup, currentSelectClass, parentSelectClass, 2, 'CornerForm selects');
revertedSetup = replaceExact(revertedSetup, currentInputClass, parentInputClass, 11, 'expanded text inputs');
revertedSetup = replaceExact(revertedSetup, currentNotesClass, parentNotesClass, 1, 'notes textarea');
revertedSetup = replaceExactAfter(revertedSetup, '{/* Car setup details */}', currentDetailsGrid, parentDetailsGrid, 'car-detail grid');
revertedSetup = replaceExact(revertedSetup, currentCornerGrid, parentCornerGrid, 1, 'four-corner grid');
assert.equal(
  normalizeEol(revertedSetup),
  normalizeEol(parentSetupSource),
  'SetupView differs from parent only by 17 authorized touch-target/grid substitutions',
);

const extractClosedElement = (source: string, tag: string, anchor: string) => {
  const anchorAt = source.indexOf(anchor);
  assert.ok(anchorAt >= 0, `${tag} anchor exists: ${anchor}`);
  const start = source.lastIndexOf(`<${tag}`, anchorAt);
  const close = `</${tag}>`;
  const closeAt = source.indexOf(close, anchorAt);
  assert.ok(start >= 0 && closeAt >= 0, `${tag} closes after anchor: ${anchor}`);
  return source.slice(start, closeAt + close.length);
};
const extractSelfClosingElement = (source: string, tag: string, anchor: string) => {
  const anchorAt = source.indexOf(anchor);
  assert.ok(anchorAt >= 0, `${tag} anchor exists: ${anchor}`);
  const start = source.lastIndexOf(`<${tag}`, anchorAt);
  const closeAt = source.indexOf('/>', anchorAt);
  assert.ok(start >= 0 && closeAt >= 0, `${tag} closes after anchor: ${anchor}`);
  return source.slice(start, closeAt + 2);
};
const withoutClass = (element: string) => normalizeSpace(element.replace(/\s+className="[^"]*"/g, ''));

const selectContracts = [
  {
    field: 'tireInventoryId',
    anchor: "value={data.tireInventoryId || ''}",
    value: "value={data.tireInventoryId || ''}",
    handler: "onFieldChange('tireInventoryId', tireId)",
    option: '<option value="">-- Select from Inventory --</option>',
    filter: "sortBySize(tireInventory.filter(t => !usedTireIds.includes(t.id) || t.id === (data.tireInventoryId || '')))",
  },
  {
    field: 'boundGraphId',
    anchor: "value={data.boundGraphId || ''}",
    value: "value={data.boundGraphId || ''}",
    handler: "onChange={(e) => onFieldChange('boundGraphId', e.target.value)}",
    option: '<option value="">-- None --</option>',
    filter: 'data.boundGraphId && !loadSessions.some(session => session.id === data.boundGraphId)',
  },
] as const;

for (const contract of selectContracts) {
  const current = extractClosedElement(setupSource, 'select', contract.anchor);
  const parent = extractClosedElement(parentSetupSource, 'select', contract.anchor);
  assert.equal(withoutClass(current), withoutClass(parent), `${contract.field}: value/handler/options/filter match parent`);
  assert.ok(current.includes(`className="${currentSelectClass}"`), `${contract.field}: exact 48px/readable class`);
  for (const expected of [contract.value, contract.handler, contract.option, contract.filter]) {
    assert.ok(current.includes(expected), `${contract.field}: preserves ${expected}`);
  }
}

const textFields = [
  ['chassis', 'setupItem.chassis'],
  ['track', 'setupItem.track'],
  ['date', 'setupItem.date'],
  ['carType', 'setupItem.carType'],
  ['toe', "setupItem.toe || ''"],
  ['gear', "setupItem.gear || ''"],
  ['jbar', "setupItem.jbar || ''"],
  ['jbarFrameHeight', "setupItem.jbarFrameHeight || ''"],
  ['jbarPinionHeight', "setupItem.jbarPinionHeight || ''"],
  ['pullBarFrameHole', "setupItem.pullBarFrameHole || ''"],
  ['pullBarRearHole', "setupItem.pullBarRearHole || ''"],
] as const;

for (const [field, value] of textFields) {
  const handler = `handleMetadataChange(setupItem.id, '${field}', e.target.value)`;
  const current = extractSelfClosingElement(setupSource, 'input', handler);
  const parent = extractSelfClosingElement(parentSetupSource, 'input', handler);
  assert.equal(withoutClass(current), withoutClass(parent), `${field}: type/value/onChange match parent`);
  assert.ok(current.includes('type="text"'), `${field}: text input type`);
  assert.ok(current.includes(`value={${value}}`), `${field}: exact value mapping`);
  assert.ok(current.includes(`onChange={(e) => ${handler}}`), `${field}: exact onChange mapping`);
  assert.ok(current.includes(`className="${currentInputClass}"`), `${field}: exact 48px/readable class`);
}

const notesHandler = "handleMetadataChange(setupItem.id, 'notes', e.target.value)";
const notes = extractSelfClosingElement(setupSource, 'textarea', notesHandler);
const parentNotes = extractSelfClosingElement(parentSetupSource, 'textarea', notesHandler);
assert.equal(withoutClass(notes), withoutClass(parentNotes), 'notes: value/onChange match parent');
assert.ok(notes.includes("value={setupItem.notes || ''}"), 'notes: exact value mapping');
assert.ok(notes.includes(`onChange={(e) => ${notesHandler}}`), 'notes: exact onChange mapping');
assert.ok(notes.includes(`className="${currentNotesClass}"`), 'notes: exact 60px/readable class');

const sliceBetween = (source: string, startMarker: string, endMarker: string) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `section exists: ${startMarker}`);
  return source.slice(start, end);
};
const computed = sliceBetween(setupSource, '{/* Computed stagger display */}', '{/* 4 Corner forms */}');
const parentComputed = sliceBetween(parentSetupSource, '{/* Computed stagger display */}', '{/* 4 Corner forms */}');
assert.equal(normalizeEol(computed), normalizeEol(parentComputed), 'stagger/weight formulas and read-only markup stay byte-identical');
assert.equal(countExact(computed, 'grid grid-cols-2 gap-3'), 1, 'stagger read-only grid stays two columns');
assert.equal(countExact(computed, 'grid grid-cols-2 gap-2'), 1, 'weight read-only grid stays two columns');
for (const formula of [
  'setupItem.frontStagger || computeStagger(setupItem.rf.tireSize, setupItem.lf.tireSize)',
  'setupItem.rearStagger || computeStagger(setupItem.rr.tireSize, setupItem.lr.tireSize)',
  'computeWeightPct((lfW!) + (rfW!), total)',
  'computeWeightPct((lfW!) + (lrW!), total)',
  'computeWeightPct((lrW!) + (rfW!), total)',
  "((lrW - rrW).toFixed(1) + ' lb')",
]) assert.ok(computed.includes(formula), `computed formula preserved: ${formula}`);

const currentFormulaHelpers = sliceBetween(setupSource, 'const computeWeightPct', 'const INP');
const parentFormulaHelpers = sliceBetween(parentSetupSource, 'const computeWeightPct', 'const INP');
assert.equal(normalizeEol(currentFormulaHelpers), normalizeEol(parentFormulaHelpers), 'stagger/weight helper formulas stay byte-identical');

const narrowStepperWrapper = 'min-w-0 [&_[role=group]]:flex-wrap [&_[role=group]]:overflow-visible [&_[role=group]>button]:basis-full [&_[role=group]>button]:w-full [&_[role=group]>div]:basis-full [&_[role=group]>div]:border-x-0 [&_[role=group]>div]:border-y';
assert.equal(countExact(setupSource, narrowStepperWrapper), 1, 'SetupView keeps exact forced narrow NumberStepper wrapping');
assert.ok(sliceBetween(setupSource, '{/* Car setup details */}', '{/* Computed stagger display */}').includes(currentDetailsGrid), 'editable car-detail grid stacks at base width');
assert.equal(countExact(setupSource, currentCornerGrid), 1, 'editable four-corner grid stacks at base width');

assert.equal(normalizeEol(stepperSource), normalizeEol(parentStepperSource), 'NumberStepper stays byte-identical to parent');
const normalizedStepper = normalizeSpace(stepperSource);
assert.ok(normalizedStepper.includes("const btnClass = 'tap-target shrink-0 select-none touch-none text-on-surface active:bg-surface-container-highest';"), 'decrement/increment buttons use tap-target contract');
assert.equal((stepperSource.match(/\$\{btnClass\}/g) ?? []).length, 2, 'both decrement/increment buttons use shared tap-target class');
assert.ok(normalizedStepper.includes('role="group" aria-label={groupLabel} className="flex items-stretch overflow-hidden rounded-xl border border-outline-variant bg-surface-container"'), 'group role and items-stretch preserve 48px row');
assert.ok(normalizedStepper.includes('className="min-h-12 w-full bg-transparent text-center font-mono text-lg text-on-surface outline-none"'), 'editor owns explicit min-h-12');
assert.ok(normalizedStepper.includes('className="tap-target w-full font-mono text-lg text-on-surface"'), 'display value button owns tap-target');

console.log('Setup touch-target harness: PASS');
