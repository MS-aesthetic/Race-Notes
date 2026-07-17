import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { printTireUsageReport } from '../src/lib/tireHistory';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const section = (source: string, start: string, end: string) => {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `section exists: ${start}`);
  return source.slice(startAt, endAt);
};
const assertOrder = (source: string, first: string, second: string, label: string) => {
  const firstAt = source.indexOf(first);
  const secondAt = source.indexOf(second);
  assert.ok(firstAt >= 0 && secondAt > firstAt, `${label}: ${first} precedes ${second}`);
};
const sheetAt = (source: string, openContract: string) => {
  const openAt = source.indexOf(openContract);
  const startAt = source.lastIndexOf('<ConfirmSheet', openAt);
  const endAt = source.indexOf('/>', openAt);
  assert.ok(openAt >= 0 && startAt >= 0 && endAt > openAt, `sheet render exists: ${openContract}`);
  return source.slice(startAt, endAt + 2);
};
const assertSheet = (source: string, openContract: string, contracts: string[], destructive: boolean) => {
  const render = sheetAt(source, openContract);
  for (const contract of contracts) assert.ok(render.includes(contract), `sheet ${openContract}: ${contract}`);
  if (destructive) assert.match(render, /\bdestructive(?:\s|=|\/>)/, `sheet ${openContract}: destructive`);
  else assert.doesNotMatch(render, /\bdestructive(?:\s|=)/, `sheet ${openContract}: non-destructive`);
};
const sourceFiles = (directory: string): string[] => readdirSync(join(root, directory), { withFileTypes: true })
  .flatMap(entry => {
    const relative = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(relative) : /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const primitive = read('src/components/ui/ConfirmSheet.tsx');
const app = read('src/App.tsx');
const race = read('src/components/RaceWeekendView.tsx');
const loads = read('src/components/SmasherLoadsView.tsx');
const setup = read('src/components/SetupView.tsx');
const todos = read('src/components/ToDoView.tsx');
const team = read('src/components/TeamView.tsx');
const tires = read('src/components/TiresSubView.tsx');
const trackers = read('src/components/TrackersView.tsx');
const exportView = read('src/components/ExportView.tsx');
const tireHistory = read('src/lib/tireHistory.ts');

// Shared primitive: caller owns state and mutation; BottomSheet owns cancellation surfaces.
for (const contract of [
  'open: boolean;', 'title: string;', 'body: ReactNode;', 'confirmLabel: string;',
  'cancelLabel: string;', 'destructive?: boolean;',
  'onConfirm: () => void | Promise<void>;', 'onCancel: () => void;',
]) assert.ok(primitive.includes(contract), `primitive API: ${contract}`);
assert.match(primitive, /<BottomSheet open=\{open\} onClose=\{onCancel\} title=\{title\}>/);
assert.equal((primitive.match(/min-h-12/g) ?? []).length, 2, 'both primitive buttons are at least 48px');
assert.ok(primitive.includes("destructive ? 'bg-error text-on-error' : 'bg-primary text-on-primary'"));
assert.ok(primitive.includes('border-outline-variant bg-surface text-on-surface'));
assert.ok(primitive.includes('void onConfirm();'), 'promise-returning confirm safely discarded');
assert.equal((primitive.match(/onClick=\{\(\) => \{ void onConfirm\(\); \}\}/g) ?? []).length, 1, 'confirm click invokes only caller confirm');
assert.doesNotMatch(primitive, /onClick=\{\(\) => \{[^}]*onConfirm\(\)[^}]*onCancel\(/, 'confirm click never auto-cancels');
assert.doesNotMatch(primitive, /useState|useEffect|localStorage|sessionStorage|\bpush[A-Z]|\bdelete[A-Z]/, 'primitive owns no pending state or mutation');

// Global source must have no native confirmation/alert calls.
const allSource = sourceFiles('src').map(path => ({ path, text: read(path) }));
const nativeDialog = /\b(?:window\.)?(?:confirm|alert)\s*\(/g;
const nativeHits = allSource.flatMap(({ path, text }) => [...text.matchAll(nativeDialog)].map(match => `${path}:${match[0]}`));
assert.deepEqual(nativeHits, [], 'zero native dialog call sites');
assert.equal(allSource.reduce((count, { text }) => count + (text.match(/<ConfirmSheet\b/g) ?? []).length, 0), 9, 'nine sheet instances cover thirteen confirm actions');
assertSheet(race, 'open={!!pendingFinish}', ['title={`Finish ${pendingFinish?.name', 'body={`${pendingFinish?.finalLabel', 'confirmLabel="Finish"', 'cancelLabel="Keep"', 'onConfirm={confirmFinishWeekend}', 'onCancel={() => setPendingFinish(null)}'], false);
assertSheet(loads, 'open={!!pendingDeleteSessionId}', ['title="Delete load session?"', 'body="Delete this load session and all its data points?"', 'confirmLabel="Delete"', 'cancelLabel="Keep"', 'onConfirm={confirmDeleteSession}', 'onCancel={() => setPendingDeleteSessionId(null)}'], true);
assertSheet(setup, 'open={!!pendingDeleteSetupId}', ['title="Delete setup?"', 'body="Are you sure you want to delete this setup?"', 'confirmLabel="Delete"', 'cancelLabel="Keep"', 'onConfirm={confirmDeleteSetup}', 'onCancel={() => setPendingDeleteSetupId(null)}'], true);
assertSheet(todos, 'open={!!pendingChecklistAction}', ['title={pendingChecklistCopy.title}', 'body={pendingChecklistCopy.body}', 'confirmLabel={pendingChecklistCopy.confirmLabel}', 'cancelLabel="Keep"', 'destructive={pendingChecklistCopy.destructive}', 'onConfirm={confirmChecklistAction}', 'onCancel={() => setPendingChecklistAction(null)}'], true);
assertSheet(team, 'open={!!pendingTeamAction}', ['title={pendingTeamCopy.title}', 'body={pendingTeamCopy.body}', 'confirmLabel={pendingTeamCopy.confirmLabel}', 'cancelLabel="Keep"', 'destructive={pendingTeamCopy.destructive}', 'onConfirm={confirmTeamAction}', 'onCancel={() => setPendingTeamAction(null)}'], true);
assertSheet(tires, 'open={!!pendingDeleteId}', ['title="Delete tire?"', 'body="Delete this tire from inventory?"', 'confirmLabel="Delete"', 'cancelLabel="Keep"', 'onConfirm={confirmDelete}', 'onCancel={() => setPendingDeleteId(null)}'], true);
assertSheet(trackers, 'open={!!pendingDeleteEntryId}', ['title="Delete accounting entry?"', 'body="Delete this entry?"', 'confirmLabel="Delete"', 'cancelLabel="Keep"', 'onConfirm={confirmDeleteEntry}', 'onCancel={() => setPendingDeleteEntryId(null)}'], true);
assertSheet(trackers, 'open={!!pendingDeleteComponentId}', ['title="Delete maintenance item?"', 'body="Delete this item and all its maintenance logs?"', 'confirmLabel="Delete"', 'cancelLabel="Keep"', 'onConfirm={confirmDeleteComponent}', 'onCancel={() => setPendingDeleteComponentId(null)}'], true);
assertSheet(trackers, 'open={!!pendingDeleteTemplateId}', ['title="Delete checklist template?"', 'body="Delete this template?"', 'confirmLabel="Delete"', 'cancelLabel="Keep"', 'onConfirm={confirmDeleteTemplate}', 'onCancel={() => setPendingDeleteTemplateId(null)}'], true);

// 1: Finish Race Day descriptor, current-target revalidation, exact vocabulary.
assert.match(race, /pendingFinish[\s\S]*weekendId: string; name: string; finalLabel: string/);
assert.match(race, /setPendingFinish\(\{[\s\S]*weekendId: currentWeekend\.id,[\s\S]*name: currentWeekend\.name,[\s\S]*finalLabel: lifecycleLabel\('final', currentWeekend\)/);
const finish = section(race, 'const confirmFinishWeekend = () => {', 'const getSessionDiffPair');
assert.match(finish, /setPendingFinish\(null\);[\s\S]*visibleWeekends\.find\(weekend => weekend\.id === pending\.weekendId\)/);
assert.match(finish, /target\.id !== activeWeekendId \|\| isWeekendFinished\(target\)/);
assert.match(finish, /onFinishWeekend\(target\.id\);/);
assert.ok(race.includes("title={`Finish ${pendingFinish?.name ?? 'Race Day'}?`}"));
assert.ok(race.includes("body={`${pendingFinish?.finalLabel ?? 'Final setup'} will be saved and this Race Day will move to history.`}"));

// 2: load-session delete remains car/display scoped and preserves persist-before-fallback ordering.
const loadDelete = section(loads, 'const confirmDeleteSession = () => {', '// ── Update session metadata inline');
assert.match(loadDelete, /setPendingDeleteSessionId\(null\);[\s\S]*displayedSessions\.some\(session => session\.id === id\)/);
assertOrder(loadDelete, 'persist(next);', "setActiveSessionId(next[0]?.id ?? null);", 'load session delete ordering');

// 3: setup guards run before opening and again against current data before the original save path.
const setupRequest = section(setup, 'const handleDeleteSetup =', 'const confirmDeleteSetup');
const setupConfirm = section(setup, 'const confirmDeleteSetup =', 'const handleCloneSetup');
for (const block of [setupRequest, setupConfirm]) {
  assert.match(block, /setups\.find/);
  assert.match(block, /isSetupLocked\(target, weekends\)/);
  assert.match(block, /setups\.length <= 1/);
}
assert.match(setupConfirm, /setPendingDeleteSetupId\(null\);/);
assert.match(setupConfirm, /if \(!activeCarId \|\| target\.carId !== activeCarId\) return;/, 'setup delete revalidates current-car membership');
assertOrder(setupConfirm, "if (expandedId === setupId) setExpandedId(nextActiveId || null);", 'updateAndSaveSetups(filtered, nextActiveId);', 'setup fallback/save ordering');

// 4: three checklist actions use descriptors, current ref data, and topmost next-task sheet closing.
for (const kind of ['reset', 'clear-current', 'clear-completed']) assert.ok(todos.includes(`{ kind: '${kind}' }`), `checklist action descriptor: ${kind}`);
const todoConfirm = section(todos, 'const confirmChecklistAction = () => {', 'const pendingChecklistCopy');
assertOrder(todoConfirm, 'setPendingChecklistAction(null);', 'setCompletionUndo(null);', 'checklist sheet closes before mutation');
assert.match(todoConfirm, /resetMainChecklist\([\s\S]*todosRef\.current,[\s\S]*keepAddedItems,[\s\S]*new Date\(\)\.toISOString\(\),[\s\S]*templates,[\s\S]*components: maintenance, weekends, setups: savedSetups/);
assert.match(todoConfirm, /clearMainChecklist\(todosRef\.current\)/);
assert.match(todoConfirm, /archiveCompletedMainChecklist\(todosRef\.current\)/);
assert.equal((todoConfirm.match(/window\.setTimeout\(\(\) => setManageOpen\(false\), 0\)/g) ?? []).length, 2, 'reset and clear-current close Manage next task');
assert.ok(todos.lastIndexOf('<ConfirmSheet') > todos.lastIndexOf('<BottomSheet'), 'checklist confirmation renders above all existing sheets');
const todoCopy = section(todos, 'const pendingChecklistCopy =', 'const focusAddTask');
for (const contract of [
  "title: 'Reset for a new Race Day?'", "confirmLabel: 'Reset'", "destructive: false",
  "title: 'Clear current checklist?'", "confirmLabel: 'Clear'", "destructive: true",
  "title: 'Move completed work to History?'", "confirmLabel: 'Move'",
]) assert.ok(todoCopy.includes(contract), `checklist copy/verb: ${contract}`);
const templateImport = section(todos, 'const importSelectedTemplate = () => {', 'const completeItem');
assert.doesNotMatch(templateImport, /pendingChecklist|ConfirmSheet|confirmLabel/, 'template import has no invented confirmation');

// 5: team descriptors capture initiating identities; confirm clears first and ignores stale async results.
for (const contract of [
  "kind: 'leave'; userId: string; teamId: string; teamName: string",
  "kind: 'delete'; userId: string; teamId: string; teamName: string",
  "kind: 'remove'; userId: string; teamId: string; memberId: string; memberName: string",
]) assert.ok(team.includes(contract), `team descriptor: ${contract}`);
assert.match(team, /useEffect\(\(\) => \{\s*setPendingTeamAction\(null\);\s*\}, \[user\.id, team\?\.id\]\);/);
const teamConfirm = section(team, 'const confirmTeamAction = async () => {', 'const pendingTeamCopy');
assertOrder(teamConfirm, 'setPendingTeamAction(null);', 'setLoading(true);', 'team sheet closes before loading');
assert.match(teamConfirm, /userIdRef\.current !== pending\.userId \|\| teamIdRef\.current !== pending\.teamId/);
assert.match(teamConfirm, /membersRef\.current\.some\(member => member\.id === pending\.memberId\)/);
assert.match(teamConfirm, /const stillCurrent = \(\) => userIdRef\.current === pending\.userId && teamIdRef\.current === pending\.teamId/);
for (const call of ['leaveTeam(pending.teamId, pending.userId)', 'deleteTeam(pending.teamId)', 'removeTeamMember(pending.teamId, pending.memberId)']) {
  assert.ok(teamConfirm.includes(call), `team async call retained: ${call}`);
}
assert.match(teamConfirm, /catch \{[\s\S]*if \(!stillCurrent\(\)\) return;[\s\S]*finally \{[\s\S]*if \(stillCurrent\(\)\) setLoading\(false\)/);
const teamCopy = section(team, 'const pendingTeamCopy =', 'const handleUploadBanner');
for (const contract of [
  "confirmLabel: 'Leave'", "confirmLabel: 'Delete'", "confirmLabel: 'Remove'",
  'This removes the team for ALL members and cannot be undone.',
]) assert.ok(teamCopy.includes(contract), `team copy/verb: ${contract}`);
const loadTeam = section(team, 'const loadTeam = async', 'useEffect(() => {');
assert.match(loadTeam, /const generation = \+\+loadGenerationRef\.current;/);
assert.match(loadTeam, /const stillCurrentLoad = \(\) => userIdRef\.current === expectedUserId && loadGenerationRef\.current === generation;/);
assert.match(loadTeam, /if \(!stillCurrentLoad\(\) \|\| teamIdRef\.current !== userTeam\.id\) return;/, 'team-member load guards stale team results');
assert.match(loadTeam, /catch \(err: any\) \{\s*if \(!stillCurrentLoad\(\)\) return;[\s\S]*finally \{\s*if \(stillCurrentLoad\(\)\) setLoading\(false\);/, 'stale rejection cannot write errors or clear newer loading');

class TeamLoadSimulation {
  userId = 'user-1';
  teamId: string | null = null;
  members: string[] = [];
  error = '';
  loading = false;
  private generation = 0;

  async load(getTeam: () => Promise<string>, getMembers: (teamId: string) => Promise<string[]>) {
    const expectedUserId = this.userId;
    const generation = ++this.generation;
    const stillCurrent = () => this.userId === expectedUserId && this.generation === generation;
    this.loading = true;
    this.error = '';
    try {
      const teamId = await getTeam();
      if (!stillCurrent()) return;
      this.teamId = teamId;
      const members = await getMembers(teamId);
      if (!stillCurrent() || this.teamId !== teamId) return;
      this.members = members;
    } catch (error) {
      if (!stillCurrent()) return;
      this.error = error instanceof Error ? error.message : 'failed';
    } finally {
      if (stillCurrent()) this.loading = false;
    }
  }
}

const teamLoad = new TeamLoadSimulation();
const oldMembers = deferred<string[]>();
const newMembers = deferred<string[]>();
const oldRequested = deferred<void>();
const newRequested = deferred<void>();
const oldLoad = teamLoad.load(
  async () => 'team-old',
  async () => { oldRequested.resolve(); return oldMembers.promise; },
);
await oldRequested.promise;
const newLoad = teamLoad.load(
  async () => 'team-new',
  async () => { newRequested.resolve(); return newMembers.promise; },
);
await newRequested.promise;
oldMembers.reject(new Error('stale old-team failure'));
await oldLoad;
assert.equal(teamLoad.loading, true, 'stale rejection does not clear newer load spinner');
assert.equal(teamLoad.error, '', 'stale rejection does not overwrite newer team error state');
newMembers.resolve(['new-member']);
await newLoad;
assert.equal(teamLoad.loading, false, 'current load owns spinner completion');
assert.deepEqual(teamLoad.members, ['new-member'], 'latest same-account team result wins');

// 6: tire delete revalidates active-car membership and remains local-first before cloud delete.
const tireDelete = section(tires, 'const confirmDelete = () => {', 'const handlePrintReport');
assert.match(tireDelete, /setPendingDeleteId\(null\);[\s\S]*tire\.id === id && tire\.carId === activeCarId/);
assertOrder(tireDelete, 'saveTires(tires.filter', 'onDeleteTireFromCloud?.(id);', 'tire local/cloud ordering');

// 7: the three tracker descriptors revalidate and preserve each existing delete callback order.
const accountingDelete = section(trackers, 'const confirmDeleteEntry = () => {', 'const fmt');
assert.match(accountingDelete, /setPendingDeleteEntryId\(null\);[\s\S]*entries\.some\(entry => entry\.id === id\)[\s\S]*onSave\(entries\.filter/);
const serviceDelete = section(trackers, 'const confirmDeleteComponent = () => {', 'const handleAddSubmit');
assert.match(serviceDelete, /setPendingDeleteComponentId\(null\);[\s\S]*components\.find\(component => component\.id === id\)[\s\S]*target\.scope === 'car' && \(!activeCarId \|\| target\.carId !== activeCarId\)[\s\S]*onDeleteComponent\(id\)/);
const templateDelete = section(trackers, 'const confirmDeleteTemplate = () => {', 'const addItem');
assert.match(templateDelete, /setPendingDeleteTemplateId\(null\);[\s\S]*templates\.some\(template => template\.id === id\)/);
assertOrder(templateDelete, 'onDeleteTemplate(id);', 'if (expandedId === id) setExpandedId(null);', 'template delete/collapse ordering');

// Seven former alerts: one App guard, three Setup paths, two Export paths, one tire report path.
const carDelete = section(app, 'const handleDeleteCar =', '// ── Clear All Data');
assertOrder(carDelete, "showInfo({ reason: 'car-has-data' });", 'carUndo.requestDelete', 'reason-keyed car guard before undo request');
for (const message of [
  "onInfo?.('minimumSetups')",
  "onInfo?.('Please sign in to attach files.')",
  "onInfo?.('Upload failed.')",
]) assert.ok(setup.includes(message), `Setup info replacement: ${message}`);
assert.match(exportView, /if \(!openPrintReport\(report\)\) setInfoToast\('Allow popups to print the report\.'\)/);
assert.match(exportView, /if \(!w\) \{\s*setInfoToast\('Select a Race Day first\.'\);\s*return;/);
assert.match(exportView, /<InfoToast open=\{!!infoToast\}[\s\S]*onClose=\{\(\) => setInfoToast\(null\)\}/);
assert.match(tires, /if \(!printTireUsageReport\(displayedTires, weekends\)\) \{\s*setInfoToast\('Allow popups in your browser to view the report\.'\)/);
assert.match(tires, /<InfoToast open=\{!!infoToast\}[\s\S]*onClose=\{\(\) => setInfoToast\(null\)\}/);
assert.match(tireHistory, /printTireUsageReport\([^)]*\): boolean/);
assert.match(tireHistory, /if \(!printWindow\) return false;[\s\S]*document\.write[\s\S]*document\.close\(\);\s*return true;/);
assert.doesNotMatch(tireHistory, /components\/ui|InfoToast|ConfirmSheet/, 'library owns no UI');

// Executable popup-blocked/success contract.
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const installWindow = (value: unknown) => Object.defineProperty(globalThis, 'window', {
  configurable: true,
  writable: true,
  value,
});
try {
  installWindow({ open: () => null });
  assert.equal(printTireUsageReport([], []), false, 'blocked popup returns false');

  let written = '';
  let closed = 0;
  installWindow({
    open: () => ({
      document: {
        write: (value: string) => { written = value; },
        close: () => { closed += 1; },
      },
    }),
  });
  assert.equal(printTireUsageReport([], []), true, 'available popup returns true');
  assert.match(written, /Tire Usage Report/);
  assert.equal(closed, 1, 'successful report closes document once');
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}

console.log('confirm-sheet harness: PASS');
