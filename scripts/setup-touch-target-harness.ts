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
const readCommit = (commit: string, path: string) => execFileSync(
  'git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8' },
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
const replaceRegionFromParent = (source: string, parent: string, start: string, end: string, label: string) => {
  const sourceStart = source.indexOf(start);
  const sourceEnd = source.indexOf(end, sourceStart + start.length);
  const parentStart = parent.indexOf(start);
  const parentEnd = parent.indexOf(end, parentStart + start.length);
  assert.ok(sourceStart >= 0 && sourceEnd > sourceStart, `${label}: current region exists`);
  assert.ok(parentStart >= 0 && parentEnd > parentStart, `${label}: parent region exists`);
  return source.slice(0, sourceStart) + parent.slice(parentStart, parentEnd) + source.slice(sourceEnd);
};

const setupSource = read(setupPath);
const parentSetupSource = readParent(setupPath);
const uxp17ParentSetupSource = readCommit('a68731a', setupPath);
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
const phoneDetailsGrid = 'grid grid-cols-1 min-[360px]:grid-cols-2 gap-4';
const prePhoneDetailsGrid = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
const phoneToeSpan = 'min-[360px]:col-span-2';
const prePhoneToeSpan = 'sm:col-span-2';
const currentDetailsGrid = prePhoneDetailsGrid;
const parentDetailsGrid = 'grid grid-cols-2 gap-4';
const phoneCornerGrid = 'min-w-0 grid grid-cols-1 min-[360px]:grid-cols-2 gap-1.5 min-[360px]:gap-3';
const prePhoneCornerGrid = 'min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3';
const currentCornerGrid = prePhoneCornerGrid;
const parentCornerGrid = 'min-w-0 grid grid-cols-2 gap-1.5 sm:gap-3';

assert.ok(setupSource.includes(currentInp), 'shared INP owns min-h-12 text-sm contract');
assert.equal((setupSource.match(/className=\{INP\}/g) ?? []).length, 5, 'exact five shared INP uses');

let revertedSetup = setupSource;
// Later phone-layout refinement: peel its breakpoint-only changes before proving UXP-17/14.
revertedSetup = replaceExact(revertedSetup, phoneDetailsGrid, prePhoneDetailsGrid, 2, 'phone metadata/detail grids');
revertedSetup = replaceExact(revertedSetup, phoneToeSpan, prePhoneToeSpan, 1, 'phone Toe span');
revertedSetup = replaceExact(revertedSetup, phoneCornerGrid, prePhoneCornerGrid, 1, 'phone corner grid');
// UXP-17 is a later class-only muted-text sweep; reverse its exact SetupView subset first.
revertedSetup = replaceExact(
  revertedSetup,
  'border-outline-variant/30 text-on-surface-muted opacity-30 cursor-not-allowed',
  'border-outline-variant/30 text-on-surface-muted cursor-not-allowed',
  1,
  'later global compare opacity',
);
revertedSetup = replaceExact(
  revertedSetup,
  "'text-on-surface-muted opacity-30 cursor-not-allowed'",
  "'text-on-surface-muted cursor-not-allowed'",
  1,
  'later card compare opacity',
);
revertedSetup = replaceExact(
  revertedSetup,
  'text-on-surface-variant hover:text-red-400 transition-colors rounded disabled:text-on-surface-muted disabled:opacity-40',
  'text-on-surface-variant hover:text-red-400 transition-colors rounded',
  1,
  'later disabled delete token',
);
const uxp17ParentTokens = [...uxp17ParentSetupSource.matchAll(/text-on-surface-variant\/(20|30|40|50|60|70|80)\b/g)].map(match => match[0]);
assert.equal(uxp17ParentTokens.length, 16, 'later muted sweep parent inventory');
assert.equal((revertedSetup.match(/text-on-surface-muted\b/g) ?? []).length, 16, 'later muted sweep current inventory after exception normalization');
let uxp17TokenIndex = 0;
revertedSetup = revertedSetup.replace(/text-on-surface-muted\b/g, () => uxp17ParentTokens[uxp17TokenIndex++]);
assert.equal(uxp17TokenIndex, uxp17ParentTokens.length, 'later muted sweep restores every original alpha token');
assert.equal(normalizeEol(revertedSetup), normalizeEol(uxp17ParentSetupSource), 'UXP-17 SetupView changes are exact class-only muted sweep');
const setupSourceWithoutUxp17 = revertedSetup;
revertedSetup = replaceExact(revertedSetup, currentInp, parentInp, 1, 'shared INP');
revertedSetup = replaceExact(revertedSetup, currentSelectClass, parentSelectClass, 2, 'CornerForm selects');
revertedSetup = replaceExact(revertedSetup, currentInputClass, parentInputClass, 11, 'expanded text inputs');
revertedSetup = replaceExact(revertedSetup, currentNotesClass, parentNotesClass, 1, 'notes textarea');
revertedSetup = replaceExactAfter(revertedSetup, '{/* Car setup details */}', currentDetailsGrid, parentDetailsGrid, 'car-detail grid');
revertedSetup = replaceExact(revertedSetup, currentCornerGrid, parentCornerGrid, 1, 'four-corner grid');
// UXP-16 legitimately adds confirmation/info behavior outside this harness's UXP-14 touch-target scope.
revertedSetup = replaceExact(revertedSetup, "import ConfirmSheet from './ui/ConfirmSheet';\n", '', 1, 'later ConfirmSheet import');
revertedSetup = replaceExact(revertedSetup, '  const [pendingDeleteSetupId, setPendingDeleteSetupId] = useState<string | null>(null);\n', '', 1, 'later pending-delete state');
revertedSetup = replaceRegionFromParent(revertedSetup, parentSetupSource, '  const handleDeleteSetup =', '  const handleCloneSetup =', 'later setup-delete flow');
revertedSetup = replaceRegionFromParent(revertedSetup, parentSetupSource, '  const handleUploadAttachment =', '  const handleDeleteSetupAttachment =', 'later attachment alerts');
revertedSetup = replaceExact(revertedSetup, `      <ConfirmSheet
        open={!!pendingDeleteSetupId}
        title="Delete setup?"
        body="Are you sure you want to delete this setup?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        onConfirm={confirmDeleteSetup}
        onCancel={() => setPendingDeleteSetupId(null)}
      />
`, '', 1, 'later confirmation render');
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
const normalizedComputed = sliceBetween(setupSourceWithoutUxp17, '{/* Computed stagger display */}', '{/* 4 Corner forms */}');
const parentComputed = sliceBetween(uxp17ParentSetupSource, '{/* Computed stagger display */}', '{/* 4 Corner forms */}');
assert.equal(normalizeEol(normalizedComputed), normalizeEol(parentComputed), 'stagger/weight formulas and read-only markup stay byte-identical outside UXP-17 class tokens');
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
const metadataSection = sliceBetween(setupSource, '{/* Metadata grid */}', '{/* Notes */}');
const carDetailsSection = sliceBetween(setupSource, '{/* Car setup details */}', '{/* Computed stagger display */}');
assert.equal(countExact(setupSource, phoneDetailsGrid), 2, 'metadata and car details activate two columns at 360px');
assert.ok(metadataSection.includes(phoneToeSpan), 'Toe spans both phone columns');
assert.ok(carDetailsSection.includes(phoneDetailsGrid), 'editable car-detail grid activates at typical phone width');
assert.equal(countExact(setupSource, phoneCornerGrid), 1, 'four corner cards activate two columns at 360px');
assert.doesNotMatch(metadataSection + carDetailsSection, /sm:grid-cols-2/, 'editable details no longer wait for 640px');

assert.equal(normalizeEol(stepperSource), normalizeEol(parentStepperSource), 'NumberStepper stays byte-identical to parent');
const normalizedStepper = normalizeSpace(stepperSource);
assert.ok(normalizedStepper.includes("const btnClass = 'tap-target shrink-0 select-none touch-none text-on-surface active:bg-surface-container-highest';"), 'decrement/increment buttons use tap-target contract');
assert.equal((stepperSource.match(/\$\{btnClass\}/g) ?? []).length, 2, 'both decrement/increment buttons use shared tap-target class');
assert.ok(normalizedStepper.includes('role="group" aria-label={groupLabel} className="flex items-stretch overflow-hidden rounded-xl border border-outline-variant bg-surface-container"'), 'group role and items-stretch preserve 48px row');
assert.ok(normalizedStepper.includes('className="min-h-12 w-full bg-transparent text-center font-mono text-lg text-on-surface outline-none"'), 'editor owns explicit min-h-12');
assert.ok(normalizedStepper.includes('className="tap-target w-full font-mono text-lg text-on-surface"'), 'display value button owns tap-target');

console.log('Setup touch-target harness: PASS');
