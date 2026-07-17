import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PARENT = '89845e8';
const UXP18_COMMIT = '38e9828';
const APP_PATH = 'src/App.tsx';
const HARNESS_PATH = 'scripts/saved-flash-harness.ts';
const UXP17_ASSERTION_PATH = 'scripts/muted-text-color-harness.ts';
const STEPPER_PATH = 'src/components/ui/NumberStepper.tsx';
const root = process.cwd();
const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');
const app = normalizeEol(readFileSync(join(root, APP_PATH), 'utf8'));
const parent = normalizeEol(execFileSync('git', ['show', `${PARENT}:${APP_PATH}`], { cwd: root, encoding: 'utf8' }));
const stepper = normalizeEol(readFileSync(join(root, STEPPER_PATH), 'utf8'));

const between = (source: string, start: string, end: string, label: string): string => {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${label} slice exists`);
  return source.slice(startAt, endAt);
};

const handler = (name: string, nextAnchor: string): string => between(
  app,
  `  const ${name} =`,
  nextAnchor,
  name,
);

const ordered = (source: string, tokens: string[], label: string): void => {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${label}: ${token} remains in order`);
    cursor = next;
  }
};

const persistenceBeforeLastFlash = (source: string, label: string): void => {
  const persistence = Math.max(source.lastIndexOf('localStorage.setItem'), source.lastIndexOf('localStorage.removeItem'));
  const flash = source.lastIndexOf('flashSaved();');
  assert.ok(persistence >= 0 && flash > persistence, `${label} flashes after its final direct localStorage write`);
};

const b1SourceContractsPass = (source: string): boolean => {
  const startPress = between(source, '  const startPress =', '\n\n  const handlePointerMove =', 'B1 startPress');
  const finishPress = between(source, '  const finishPress =', '\n\n  // Clear timers on unmount', 'B1 finishPress');
  return [
    'const REPEAT_DELAY_MS = 350;',
    'const REPEAT_INTERVAL_MS = 100;',
    'const STEPPER_POINTER_SLOP_PX = 8;',
    'touch-pan-y',
    'onPointerUp={finishPress}',
    'onPointerCancel={cancelPress}',
    'if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX) {',
    'press.moved = true;',
    'const releasedOutsideSlop = Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX;',
    'if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);',
    'press.didRepeat = true;',
    'applyRepeatStep(press);',
    '}, REPEAT_DELAY_MS);',
    '}, REPEAT_INTERVAL_MS);',
  ].every(token => source.includes(token))
    && !startPress.includes('applyStep(')
    && finishPress.includes('releasedOutsideSlop');
};

assert.ok(b1SourceContractsPass(stepper), 'B1 source keeps pointerup/slop/pan-y/cadence contracts');
for (const [name, mutated] of [
  ['pointerdown-write', stepper.replace('    const press: StepperPress = {', '    applyStep(dir, step);\n    const press: StepperPress = {')],
  ['slop-cancel-removed', stepper.replace('      press.moved = true;', '      // moved state removed')],
  ['pointercancel-write', stepper.replaceAll('onPointerCancel={cancelPress}', 'onPointerCancel={stopPress}')],
  ['pan-y-removed', stepper.replace('touch-pan-y', 'touch-none')],
  ['repeat-delay-changed', stepper.replace('const REPEAT_DELAY_MS = 350;', 'const REPEAT_DELAY_MS = 349;')],
  ['repeat-interval-changed', stepper.replace('const REPEAT_INTERVAL_MS = 100;', 'const REPEAT_INTERVAL_MS = 99;')],
  ['release-slop-removed', stepper.replace('if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);', 'if (!press.moved && !press.didRepeat) applyStep(press.dir, step);')],
  ['release-double-step', stepper.replace('if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);', 'applyStep(press.dir, step);')],
] as const) {
  assert.equal(b1SourceContractsPass(mutated), false, `B1 mutation rejected: ${name}`);
}

type PressModel = { startX: number; startY: number; moved: boolean; didRepeat: boolean };
const createB1PressModel = () => {
  let writes = 0;
  let now = 0;
  let press: PressModel | null = null;
  let repeatAt: number | null = null;
  const cancel = () => { press = null; repeatAt = null; };
  const down = (x = 0, y = 0) => { cancel(); press = { startX: x, startY: y, moved: false, didRepeat: false }; repeatAt = now + 350; };
  const move = (x: number, y: number) => {
    if (!press) return;
    if (Math.hypot(x - press.startX, y - press.startY) > 8) { press.moved = true; cancel(); }
  };
  const cancelPointer = () => cancel();
  const advance = (ms: number) => {
    const target = now + ms;
    while (repeatAt !== null && repeatAt <= target) {
      now = repeatAt;
      if (!press || press.moved) { repeatAt = null; break; }
      press.didRepeat = true;
      writes += 1;
      repeatAt += 100;
    }
    now = target;
  };
  const up = (x = 0, y = 0) => {
    const releasedOutsideSlop = press !== null && Math.hypot(x - press.startX, y - press.startY) > 8;
    if (press && !press.moved && !releasedOutsideSlop && !press.didRepeat) writes += 1;
    cancel();
  };
  return { down, move, cancelPointer, advance, up, writes: () => writes };
};

const shortPress = createB1PressModel();
shortPress.down();
assert.equal(shortPress.writes(), 0, 'B1 pointerdown causes zero writes and zero Saved/toast side effects');
shortPress.advance(349);
assert.equal(shortPress.writes(), 0, 'B1 holds stay silent before 350ms');
shortPress.up();
assert.equal(shortPress.writes(), 1, 'B1 in-slop pointerup commits exactly one step');

const releaseSlopCancel = createB1PressModel();
releaseSlopCancel.down();
releaseSlopCancel.up(0, 9);
assert.equal(releaseSlopCancel.writes(), 0, 'B1 out-of-slop pointerup is zero-write even when no pointermove arrives');

const slopCancel = createB1PressModel();
slopCancel.down();
slopCancel.move(0, 9);
slopCancel.advance(1000);
slopCancel.up();
assert.equal(slopCancel.writes(), 0, 'B1 scroll movement beyond 8px cancels with zero writes and zero Saved/toast side effects');

const pointerCancel = createB1PressModel();
pointerCancel.down();
pointerCancel.cancelPointer();
pointerCancel.advance(1000);
pointerCancel.up();
assert.equal(pointerCancel.writes(), 0, 'B1 pointercancel cancels with zero writes and zero Saved/toast side effects');

const holdRepeat = createB1PressModel();
holdRepeat.down();
holdRepeat.advance(349);
assert.equal(holdRepeat.writes(), 0, 'B1 repeat has not fired before 350ms');
holdRepeat.advance(1);
assert.equal(holdRepeat.writes(), 1, 'B1 first repeat fires at 350ms');
holdRepeat.advance(100);
assert.equal(holdRepeat.writes(), 2, 'B1 repeat cadence remains 100ms');
holdRepeat.up();
assert.equal(holdRepeat.writes(), 2, 'B1 release after repeat adds no extra step');
console.log('B1 stepper behavior harness: PASS');

// Exact feature files plus one necessary assertion-only prior-harness compatibility edit.
const tracked = execFileSync('git', ['diff', '--name-only', PARENT, UXP18_COMMIT, '--', 'src', 'scripts'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
assert.deepEqual(
  tracked.sort(),
  [APP_PATH, HARNESS_PATH, UXP17_ASSERTION_PATH].sort(),
  'UXP-18 changes App/focused harness plus only the required UXP-17 assertion compatibility file',
);

// Reconstruct parent App exactly by reversing only authorized UXP-18 edits.
let reverted = app.replace(/^\s+(?:if \(notifySaved\) )?flashSaved\(\);\n/gm, '');
reverted = reverted
  .replace(
    `    const notifySaved = typeof (expectedAccountId as unknown) === 'boolean'\n      ? expectedAccountId as unknown as boolean\n      : true;\n    if (typeof (expectedAccountId as unknown) === 'boolean') expectedAccountId = undefined;\n`,
    '',
  )
  .replace(
    'const handleSaveShockSessions = (updated: ShockSession[], notifySaved = true) => {',
    'const handleSaveShockSessions = (updated: ShockSession[]) => {',
  )
  .replace(
    'const handleSaveTodos = (updated: Todo[], notifySaved = true) => {',
    'const handleSaveTodos = (updated: Todo[]) => {',
  )
  .replace('handleSaveTodos(reconciled, false);', 'handleSaveTodos(reconciled);')
  .replace('handleSaveShockSessions(stampedShock, false);', 'handleSaveShockSessions(stampedShock);')
  .replace(
    `    // @ts-expect-error Runtime boolean overload keeps UXP-3's account-guard signature stable.\n    handleSaveCars([defaultCar], false);`,
    '    handleSaveCars([defaultCar]);',
  )
  .replace(
    `  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n`,
    `  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const flashReadyRef = useRef(false);      // false until initial hydration settles\n  const suppressPullRef = useRef(false);    // true during cloud pulls\n`,
  )
  .replace(
    `  useEffect(() => {\n    return () => {\n      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);\n    };\n  }, []);\n`,
    `  // Enable flashes only after the initial localStorage hydration has settled,\n  // so loading the app doesn't count as a "save".\n  useEffect(() => {\n    const t = setTimeout(() => { flashReadyRef.current = true; }, 800);\n    return () => clearTimeout(t);\n  }, []);\n`,
  )
  .replace(
    `  // Auto-dismiss any sync status so a message can never get "stuck" on screen.\n`,
    `  // Fire on any change to the core datasets — covers every save path (online\n  // or offline) without wiring each individual handler.\n  useEffect(() => {\n    if (!flashReadyRef.current || suppressPullRef.current) return;\n    flashSaved();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping, maintenance, maintenanceLogs, checklistTemplates, weekendChecklists]);\n\n  // Auto-dismiss any sync status so a message can never get "stuck" on screen.\n`,
  )
  .replace(
    `    const doPull = async () => {\n      setSyncStatus('Syncing...');`,
    `    const doPull = async () => {\n      suppressPullRef.current = true; // don't show "Saved" for cloud-pull state updates\n      setSyncStatus('Syncing...');`,
  )
  .replace(
    `      setSyncStatus('Synced');\n      setTimeout(() => setSyncStatus(''), 3000);\n`,
    `      setSyncStatus('Synced');\n      setTimeout(() => setSyncStatus(''), 3000);\n      // Re-enable "Saved" flashes after pull-driven state settles.\n      setTimeout(() => { if (isCurrentPull()) suppressPullRef.current = false; }, 800);\n`,
  )
  .replace(
    `      setPullDone(true); // checklist reconciliation may now use merged/local data\n`,
    `      setPullDone(true); // checklist reconciliation may now use merged/local data\n      setTimeout(() => { if (isCurrentPull()) suppressPullRef.current = false; }, 800);\n`,
  );
assert.equal(reverted, parent, 'whole App equals parent after reversing only authorized UXP-18 changes');

// Dataset watcher and timing suppression are gone; explicit timer behavior stays.
assert.doesNotMatch(app, /flashReadyRef|suppressPullRef/);
assert.doesNotMatch(app, /\[setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping, maintenance, maintenanceLogs, checklistTemplates, weekendChecklists\]/);
assert.equal((app.match(/\bflashSaved\(\);/g) ?? []).length, 22, 'exact explicit user-boundary flash inventory');
assert.match(app, /const \[savedFlash, setSavedFlash\] = useState\(false\);/);
assert.match(app, /const savedFlashTimer = useRef<ReturnType<typeof setTimeout> \| null>\(null\);/);
assert.match(app, /const flashSaved = \(\) => \{\s*setSavedFlash\(true\);\s*if \(savedFlashTimer\.current\) clearTimeout\(savedFlashTimer\.current\);\s*savedFlashTimer\.current = setTimeout\(\(\) => setSavedFlash\(false\), 1900\);\s*\};/s);
assert.match(app, /useEffect\(\(\) => \{\s*return \(\) => \{\s*if \(savedFlashTimer\.current\) clearTimeout\(savedFlashTimer\.current\);\s*\};\s*\}, \[\]\);/s);

// Executable coalescing model, tied to exact source lock above.
let visible = false;
let timer: number | null = null;
let nextTimer = 0;
const liveTimers = new Set<number>();
const flashModel = () => {
  visible = true;
  if (timer !== null) liveTimers.delete(timer);
  timer = ++nextTimer;
  liveTimers.add(timer);
};
flashModel();
flashModel();
flashModel();
assert.equal(visible, true);
assert.deepEqual([...liveTimers], [3], 'same-tick compound writes leave one timer');
liveTimers.delete(3);
visible = false;
assert.equal(visible, false, 'latest timer dismisses one coalesced flash');

// Existing visuals, copy, offline variant, and sync-state priority are byte-identical.
const toastStart = '{/* Single brief Saved / sync toast';
const toastEnd = '{/* Core Main Active Canvas Area */}';
assert.equal(
  between(app, toastStart, toastEnd, 'current toast'),
  between(parent, toastStart, toastEnd, 'parent toast'),
  'Saved/sync toast markup remains byte-identical',
);
for (const text of ['Saved', 'Offline — saved on device', 'Syncing…', 'Synced']) assert.ok(app.includes(text));

// Mixed-origin helpers default to notification; exact background calls opt out.
assert.match(app, /const handleSaveCars = \(updated: Car\[\], expectedAccountId\?: string \| null\)/);
assert.match(app, /const notifySaved = typeof \(expectedAccountId as unknown\) === 'boolean'\s*\? expectedAccountId as unknown as boolean\s*: true;/s);
assert.match(app, /if \(typeof \(expectedAccountId as unknown\) === 'boolean'\) expectedAccountId = undefined;/);
assert.match(app, /const handleSaveShockSessions = \(updated: ShockSession\[\], notifySaved = true\)/);
assert.match(app, /const handleSaveTodos = \(updated: Todo\[\], notifySaved = true\)/);
for (const call of [
  'handleSaveTodos(reconciled, false);',
  'handleSaveShockSessions(stampedShock, false);',
  'handleSaveCars([defaultCar], false);',
]) assert.equal(app.split(call).length - 1, 1, `${call} is exact and unique`);

// Shared save helpers flash after state + localStorage and before optional cloud push.
const helperContracts: Array<[string, string, string[]]> = [
  ['handleSaveTires', '  const handleDeleteTireFromCloud', ['setTireInventory(updated);', "localStorage.setItem('race_notes_tires'", 'flashSaved();', 'pushTires(']],
  ['handleSaveCars', '  const handleSaveGarageCars', ['setCars(updated);', "localStorage.setItem('race_notes_cars'", 'if (notifySaved) flashSaved();', 'pushCars(']],
  ['handleSaveShockSessions', '  const handleSaveMaintenance', ['setShockSessions(updated);', "localStorage.setItem('race_notes_shock_graphs'", 'if (notifySaved) flashSaved();', 'pushShockSessions(']],
  ['handleSaveMaintenance', '  const handleSaveTodos', ['setMaintenance(updated);', "localStorage.setItem('race_notes_maintenance'", 'flashSaved();', 'pushMaintenanceComponents(']],
  ['handleSaveTodos', '  const handleSelectGarageCar', ['setTodos(updated);', "localStorage.setItem('race_notes_todos'", 'if (notifySaved) flashSaved();', 'pushTodos(']],
  ['handleSaveMaintenanceLogs', '  const handleSaveChecklistTemplates', ['setMaintenanceLogs(updated);', "localStorage.setItem('race_notes_maintenance_logs'", 'flashSaved();', 'pushMaintenanceLogs(']],
  ['handleSaveChecklistTemplates', '  const handleSaveWeekendChecklists', ['setChecklistTemplates(updated);', "localStorage.setItem('race_notes_checklist_templates'", 'flashSaved();', 'pushChecklistTemplates(']],
  ['handleSaveWeekendChecklists', '  const handleDeleteCar', ['setWeekendChecklists(updated);', "localStorage.setItem('race_notes_weekend_checklists'", 'flashSaved();', 'pushWeekendChecklists(']],
];
for (const [name, end, tokens] of helperContracts) ordered(handler(name, end), tokens, name);

// Direct user entry points flash only after their local persistence boundary.
const directHandlers: Array<[string, string]> = [
  ['handleClearAllData', '  const handleDeleteAccount'],
  ['handleSaveSetups', '  const handleUpdateSession'],
  ['handleUpdateSession', '  const handleCommitQuickAdjust'],
  ['handleCommitQuickAdjust', '  // Session weather helpers'],
  ['handleCreateNewWeekend', '  const handleCreateNewSession'],
  ['handleCreateNewSession', '  // Immediate delete'],
  ['deleteWeekendNow', '  // [7] Dashboard hero quick-start'],
  ['handleQuickService', '  // Undo removes BOTH records'],
  ['handleUndoQuickService', '  const handleDeleteSession'],
  ['handleDeleteSession', '  const handleUpdateWeekend'],
  ['handleUpdateWeekend', '  const handleFinishWeekend'],
  ['handleFinishWeekend', '  const handleSelectRecentSession'],
];
for (const [name, end] of directHandlers) persistenceBeforeLastFlash(handler(name, end), name);

const accountingCallback = between(app, 'onSaveAccounting={(updated) => {', '                  }}', 'accounting callback');
ordered(accountingCallback, ['setAccounting(updated);', "localStorage.setItem('race_notes_accounting'", 'flashSaved();'], 'accounting callback');
assert.match(handler('handleDeleteCar', '  // ── Clear All Data'), /handleSaveCars\(updated, accountId\);/);
assert.match(handler('handleDeleteMaintenanceComponent', '  const handleDeleteChecklistTemplate'), /handleSaveMaintenance[\s\S]*handleSaveMaintenanceLogs/);
assert.match(handler('handleDeleteChecklistTemplate', '  // ── Create weekend'), /handleSaveChecklistTemplates\(updated\);/);

// Every idle/background/load-only family remains directly flash-free.
const backgroundSlices: Array<[string, string]> = [
  ['todo hydration', between(app, "const [todos, setTodos]", '  const prevTodosForNotifyRef', 'todo hydration')],
  ['starter reconciliation', between(app, '// Wait for auth restoration', '// Maintenance usage is derived', 'starter reconciliation')],
  ['maintenance reconciliation', between(app, '// Maintenance usage is derived', '// ── "Saved" flash toast', 'maintenance reconciliation')],
  ['weekend recovery and auto-select', between(app, '// Active weekend is device-local', '  useEffect(() => {\n    // Attempt load', 'weekend recovery')],
  ['mount hydration', between(app, '  useEffect(() => {\n    // Attempt load', '  // ---- Auth: restore session', 'mount hydration')],
  ['cloud pull', between(app, '  // ---- Cloud sync: pull on login', '  // Resume gets a fresh pull-effect', 'cloud pull')],
  ['legacy backfill', between(app, '// ── One-time backfill', '// ── [4] Auto-create', 'legacy backfill')],
  ['empty-account auto-car', between(app, '// ── [4] Auto-create', '  const handleSaveSetups', 'auto-car')],
  ['car auto-selection', between(app, '// Auto-select first car', '  const handleSaveCars', 'car auto-selection')],
  ['car selection', handler('handleSelectCar', '  const handleSaveShockSessions')],
  ['weekend activation', handler('handleActivateWeekend', '  const handleDeleteMaintenanceComponent')],
  ['recent-session selection', handler('handleSelectRecentSession', '  // ---- Auth gate')],
];
for (const [label, source] of backgroundSlices) assert.doesNotMatch(source, /flashSaved\(\);/, `${label} stays directly silent`);

// Protected ownership, retry, pull, assignment, Undo, and dialog-era sentinels.
assert.match(app, /const currentSyncOwnerId = syncOwnerIdRef\.current;\s*if \(currentSyncOwnerId\) pushCars\(updated, currentSyncOwnerId, teamRef\.current\?\.id \?\? null, setSyncStatus\);/s);
assert.match(app, /queueSharedCloudDelete\('cars', car\.id, false, currentAccountId\)/);
assert.match(app, /const generation = \+\+pullGenerationRef\.current;/);
assert.match(app, /const isCurrentPull = \(\) => pullGenerationRef\.current === generation;/);
assert.match(app, /prevTodosForNotifyRef\.current = updated;/);
assert.match(app, /prevTodosForNotifyRef\.current = materialized;/);
assert.match(app, /<UndoToast pending=\{carUndo\.pending\} onUndo=\{carUndo\.undo\} onDismiss=\{carUndo\.dismiss\}/);
assert.match(app, /<InfoToast\s*open=\{!!infoToast\}/s);
assert.doesNotMatch(app, /window\.confirm\(|\balert\(/);

console.log('Saved flash harness: PASS');
