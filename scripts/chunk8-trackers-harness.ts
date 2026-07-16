import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  archiveCompletedChecklistItems,
  archiveCompletedMainChecklist,
  clearChecklistItems,
  clearMainChecklist,
  completeChecklistItem,
  editChecklistItem,
  importTemplateItems,
  reconcileMaintenanceChecklist,
  resetChecklistItems,
  resetMainChecklist,
  restoreChecklistItem,
  todoItemKind,
} from '../src/lib/checklistMaintenance';
import { activeChecklistItems, checklistHistoryItems, completedChecklistItems, currentChecklistItems } from '../src/lib/mainChecklist';
import { lastAccountingCategory, localDateValue, recentAccountingRepeats } from '../src/lib/accountingDefaults';
import { applyServiceLog, calendarDaysSince, DEFAULT_COMPONENTS, getComponentStatus, normalizeStartingUsage } from '../src/lib/maintenance';
import { maintenanceComponentFromCloudRow, maintenanceComponentToCloudRow } from '../src/lib/maintenanceSync';
import { todoFromCloudRow, todoToCloudRow } from '../src/lib/todoSync';
import { buildQuickServiceRecords } from '../src/lib/serviceLog';
import { MAINTENANCE_CATEGORIES, type AccountingEntry, type MaintenanceComponent, type MaintenanceLog, type RaceWeekend, type Setup, type Todo, type TodoItem } from '../src/types';

const core: TodoItem = { id: 'core', text: 'Torque wheels', done: true, completionNote: '80 ft-lb', completedAt: '2026-07-13' };
const adhoc: TodoItem = { id: 'adhoc', text: 'Grab fuel', done: true, kind: 'adhoc', sourceType: 'manual' };
assert.equal(todoItemKind(core), 'core');
assert.equal(todoItemKind(adhoc), 'adhoc');
const templates = [{ id: 't1', name: 'Car Prep', category: 'Car Prep', updatedAt: 'now', items: [
  { id: 'a', text: 'Updated wording' }, { id: 'b', text: 'New core job' },
] }];

const projectionItems: TodoItem[] = [
  { id: 'open-a', text: 'Open A', done: false },
  { id: 'done', text: 'Done', done: true },
  { id: 'hidden', text: 'Hidden', done: false, removedUntilReset: true },
  { id: 'history', text: 'History', done: true, archivedAt: '2026-07-01' },
  { id: 'open-b', text: 'Open B', done: false },
];
const projectionList: Todo = { id: 'main', user_id: '', title: 'Main Checklist', items: projectionItems, updated_at: 'old' };
assert.deepEqual(activeChecklistItems(projectionList).map(item => item.id), ['open-a', 'open-b']);
assert.deepEqual(currentChecklistItems(projectionList).map(item => item.id), ['open-a', 'done', 'open-b']);
assert.deepEqual(completedChecklistItems(projectionList).map(item => item.id), ['done']);
assert.deepEqual(checklistHistoryItems(projectionList).map(item => item.id), ['history']);
assert.equal(activeChecklistItems(projectionList)[0], projectionItems[0]);

const main: Todo = { id: 'main', user_id: '', title: 'Main Checklist', items: [core, adhoc], updated_at: 'old' };
const clearSource: TodoItem[] = [
  { id: 'core-open', text: 'Core open', done: false, desc: 'Keep note' },
  { id: 'adhoc-open', text: 'Ad-hoc open', done: false, kind: 'adhoc', sourceType: 'manual' },
  { ...core, assignedTo: 'u1', assignedToName: 'Alex' },
  { id: 'history-old', text: 'Old history', done: true, archivedAt: 'before' },
];
const cleared = clearChecklistItems(clearSource, 'main', 'clear-time');
assert.equal(activeChecklistItems({ ...main, items: cleared }).length, 0);
assert.equal(cleared.some(item => item.id === 'adhoc-open'), false);
const clearedCore = cleared.find(item => item.id === 'core-open')!;
assert.equal(clearedCore.removedUntilReset, true);
assert.equal(clearedCore.sourceId, 'core:main:core-open');
const archivedCore = cleared.find(item => item.id === 'core')!;
assert.equal(archivedCore.archivedAt, 'clear-time');
assert.equal(archivedCore.completionNote, '80 ft-lb');
assert.equal(archivedCore.assignedToName, 'Alex');
assert.equal(cleared.find(item => item.id === 'history-old'), clearSource[3]);

const openBytes: TodoItem = { id: 'keep-open', text: 'Keep open', done: false, desc: 'unchanged' };
const hiddenDone: TodoItem = { id: 'hidden-done', text: 'Hidden done', done: true, removedUntilReset: true };
const clearCompletedItems = archiveCompletedChecklistItems([openBytes, core, hiddenDone], 'main', 'archive-time');
assert.equal(clearCompletedItems[0], openBytes);
assert.equal(clearCompletedItems[1].archivedAt, 'archive-time');
assert.equal(clearCompletedItems[2], hiddenDone);
const clearCompletedTodos = archiveCompletedMainChecklist([{ ...main, items: [openBytes, core] }], 'archive-time');
assert.equal(activeChecklistItems(clearCompletedTodos[0])[0], openBytes);
assert.equal(checklistHistoryItems(clearCompletedTodos[0]).length, 1);
assert.equal(activeChecklistItems(clearMainChecklist([{ ...main, items: clearSource }], 'clear-time')[0]).length, 0);

const resetSource: TodoItem[] = [
  core,
  adhoc,
  { id: 'adhoc-open', text: 'Carry me', done: false, kind: 'adhoc', sourceType: 'manual' },
  { id: 'template-a', text: 'Old wording', done: true, completionNote: 'done', sourceType: 'template', sourceId: 'template:t1:a' },
  { id: 'template-removed', text: 'Removed definition', done: false, sourceType: 'template', sourceId: 'template:t1:removed' },
  { id: 'old-history', text: 'Old history', done: true, archivedAt: 'old' },
];
const resetNoCarry = resetChecklistItems(resetSource, false, templates, { listId: 'main', now: 'reset-time' });
assert.equal(resetNoCarry.some(item => item.id === 'adhoc-open'), false);
assert.equal(resetNoCarry.filter(item => item.archivedAt === 'reset-time').length, 3);
assert.equal(activeChecklistItems({ ...main, items: resetNoCarry }).filter(item => item.sourceId === 'core:main:core').length, 1);
assert.equal(activeChecklistItems({ ...main, items: resetNoCarry }).filter(item => item.sourceId === 'template:t1:a').length, 1);
assert.equal(activeChecklistItems({ ...main, items: resetNoCarry }).filter(item => item.sourceId === 'template:t1:b').length, 1);
assert.equal(activeChecklistItems({ ...main, items: resetNoCarry }).some(item => item.sourceId === 'template:t1:removed'), false);
assert.equal(resetNoCarry.find(item => item.sourceId === 'template:t1:removed')?.removedUntilReset, true);
assert.equal(new Set(resetNoCarry.map(item => item.id)).size, resetNoCarry.length);
const repeatReset = resetChecklistItems(resetNoCarry, false, templates, { listId: 'main', now: 'later' });
assert.deepEqual(repeatReset, resetNoCarry);
const resetCarry = resetChecklistItems(resetSource, true, templates, { listId: 'main', now: 'reset-time' });
assert.equal(activeChecklistItems({ ...main, items: resetCarry }).some(item => item.id === 'adhoc-open'), true);

const duplicateRecurrence: TodoItem[] = [
  { id: 'duplicate-hidden', text: 'Stale hidden job', done: false, sourceId: 'core:main:duplicate', removedUntilReset: true, assignedTo: 'old' },
  { id: 'duplicate-current', text: 'Current edited job', done: false, sourceId: 'core:main:duplicate', assignedTo: 'current' },
];
const duplicateReset = resetChecklistItems(duplicateRecurrence, true, [], { listId: 'main', now: 'duplicate-reset' });
const duplicateActive = activeChecklistItems({ ...main, items: duplicateReset });
assert.equal(duplicateActive.length, 1);
assert.equal(duplicateActive[0].id, 'duplicate-current');
assert.equal(duplicateActive[0].text, 'Current edited job');
assert.equal(duplicateActive[0].assignedTo, 'current');
assert.equal(duplicateReset.find(item => item.id === 'duplicate-hidden')?.removedUntilReset, true);

const firstImport = importTemplateItems([], templates[0]);
const repeatedImport = importTemplateItems(firstImport, templates[0]);
assert.equal(repeatedImport, firstImport);
const tombstoneImport = importTemplateItems([{ ...firstImport[0], removedUntilReset: true }], { ...templates[0], items: [templates[0].items[0]] });
assert.equal(tombstoneImport.length, 1);
assert.equal(tombstoneImport[0].removedUntilReset, true);
const archivedImport = importTemplateItems([{ ...firstImport[0], done: true, archivedAt: 'history' }], { ...templates[0], items: [templates[0].items[0]] });
assert.equal(archivedImport.length, 2);
assert.notEqual(archivedImport[0].id, archivedImport[1].id);
const completedCurrentImport = importTemplateItems([{ ...firstImport[0], done: true, completedAt: 'done' }], { ...templates[0], items: [templates[0].items[0]] });
assert.equal(completedCurrentImport.length, 2);
assert.notEqual(completedCurrentImport[0].id, completedCurrentImport[1].id);

const deletedDefinition = resetChecklistItems(firstImport, true, [{ ...templates[0], items: [] }], { listId: 'main', now: 'deleted' });
assert.equal(activeChecklistItems({ ...main, items: deletedDefinition }).length, 0);
const restoredDefinition = resetChecklistItems(deletedDefinition, true, templates, { listId: 'main', now: 'restored' });
assert.equal(activeChecklistItems({ ...main, items: restoredDefinition }).length, 2);

const lifecycleRoundTrip = JSON.parse(JSON.stringify({ ...main, items: cleared })) as Todo;
assert.equal(checklistHistoryItems(lifecycleRoundTrip).find(item => item.id === 'core')?.archivedAt, 'clear-time');
assert.equal(lifecycleRoundTrip.items.find(item => item.id === 'core-open')?.sourceId, 'core:main:core-open');

const completionPrior: TodoItem = {
  id: 'complete-once', text: 'Set tire pressure', done: false, desc: '12 psi', assignedTo: 'u1', sourceId: 'core:main:complete-once',
};
const firstCompletion = completeChecklistItem([openBytes, completionPrior], completionPrior.id, 'completed-now');
assert.equal(firstCompletion.undo?.item, completionPrior);
assert.equal(firstCompletion.items[1].done, true);
assert.equal(firstCompletion.items[1].completedAt, 'completed-now');
const repeatedCompletion = completeChecklistItem(firstCompletion.items, completionPrior.id, 'completed-again');
assert.equal(repeatedCompletion.items, firstCompletion.items);
assert.equal(repeatedCompletion.undo, undefined);
const restoredCompletion = restoreChecklistItem(firstCompletion.items, firstCompletion.undo!);
assert.equal(restoredCompletion[1], completionPrior);
assert.equal(JSON.stringify(restoredCompletion[1]), JSON.stringify(completionPrior));

for (const sourceType of ['manual', 'template', 'maintenance'] as const) {
  const original: TodoItem = { id: sourceType, text: 'Old', done: false, sourceType };
  const edited = editChecklistItem(original, { text: ' New task ', notes: ' Shop note ', assignedTo: 'u1', assignedToName: 'Alex' });
  assert.equal(edited.text, 'New task');
  assert.equal(edited.desc, 'Shop note');
  assert.equal(edited.assignedTo, 'u1');
  assert.equal(edited.sourceType, sourceType);
}

const component = (manualUnits: number, lastServicedAt = '2026-07-01'): MaintenanceComponent => ({
  id: 'engine-oil', scope: 'rig', name: 'Engine oil', category: 'Oil', intervalType: 'races',
  intervalValue: 1000, manualUnits, lastServicedAt, createdAt: '2026-01-01', updatedAt: '2026-07-13',
});
assert.equal(reconcileMaintenanceChecklist([main], [component(899)], [], [])[0].items.filter(item => item.sourceType === 'maintenance').length, 0);
let due = reconcileMaintenanceChecklist([main], [component(900)], [], [], 'due');
const automatic = due[0].items.find(item => item.sourceType === 'maintenance');
assert.ok(automatic);
assert.equal(automatic?.sourceId, 'maintenance:engine-oil');
assert.equal(automatic?.desc, '900/1000 races');
assert.deepEqual(reconcileMaintenanceChecklist(due, [component(900)], [], [], 'again'), due);

due = reconcileMaintenanceChecklist(due, [component(100)], [], [], 'below');
assert.equal(due[0].items.some(item => item.sourceType === 'maintenance' && !item.done), false);
let completed = reconcileMaintenanceChecklist([main], [component(900)], [], [], 'due');
completed[0].items = completed[0].items.map(item => item.sourceType === 'maintenance' ? { ...item, done: true, completedAt: 'done' } : item);
const dueWeekendReset = resetMainChecklist(completed, true, 'weekend', [], { components: [component(900)], weekends: [], setups: [] });
assert.equal(checklistHistoryItems(dueWeekendReset[0]).filter(item => item.sourceType === 'maintenance').length, 1);
assert.equal(activeChecklistItems(dueWeekendReset[0]).filter(item => item.sourceType === 'maintenance').length, 1);
const dueForHidden = reconcileMaintenanceChecklist([main], [component(900)], [], [], 'due-hidden-source');
const hiddenDue = dueForHidden.map(todo => ({ ...todo, items: todo.items.map(item => item.sourceType === 'maintenance' ? { ...item, removedUntilReset: true } : item) }));
assert.deepEqual(reconcileMaintenanceChecklist(hiddenDue, [component(900)], [], [], 'hidden'), hiddenDue);
const reopenedDue = resetMainChecklist(hiddenDue, true, 'reopen', [], { components: [component(900)], weekends: [], setups: [] });
assert.equal(activeChecklistItems(reopenedDue[0]).filter(item => item.sourceType === 'maintenance').length, 1);
const noLongerDue = resetMainChecklist(completed, true, 'not-due', [], { components: [component(100)], weekends: [], setups: [] });
assert.equal(activeChecklistItems(noLongerDue[0]).some(item => item.sourceType === 'maintenance'), false);
const afterReset = reconcileMaintenanceChecklist(completed, [component(100, '2026-07-14')], [], [], 'below');
assert.equal(afterReset[0].items.some(item => item.sourceType === 'maintenance' && item.done), true);
const archivedMaintenance = archiveCompletedMainChecklist(completed, 'archive-maintenance');
const dueAfterArchive = reconcileMaintenanceChecklist(archivedMaintenance, [component(900)], [], [], 'due-after-archive');
assert.equal(activeChecklistItems(dueAfterArchive[0]).filter(item => item.sourceType === 'maintenance').length, 1);
assert.equal(new Set(dueAfterArchive[0].items.map(item => item.id)).size, dueAfterArchive[0].items.length);
const laterCycle = reconcileMaintenanceChecklist(archivedMaintenance, [component(900, '2026-07-15')], [], [], 'later-cycle');
assert.equal(activeChecklistItems(laterCycle[0]).filter(item => item.sourceType === 'maintenance').length, 1);

const derivedComponent = (overrides: Partial<MaintenanceComponent> = {}): MaintenanceComponent => ({
  id: 'derived', scope: 'car', carId: 'car-a', name: 'Motor freshen', category: 'Motor', intervalType: 'races',
  intervalValue: 20, startingUsage: 10, lastServicedAt: '2026-07-01', createdAt: '2026-01-01', updatedAt: '2026-07-13',
  ...overrides,
});
const setupA = { id: 'setup-a', carId: 'car-a' } as Setup;
const setupB = { id: 'setup-b', carId: 'car-b' } as Setup;
const featureSession = (name: string, sessionType?: 'Feature') => ({
  id: `session-${name}`, name, type: name, sessionType,
}) as RaceWeekend['sessions'][number];
const weekend = (id: string, date: string, setupId: string, sessions: RaceWeekend['sessions']): RaceWeekend => ({
  id, name: id, track: 'Track', date, setupId, sessions,
}) as RaceWeekend;

const sameDay = weekend('same-day', 'Jul 1, 2026', setupA.id, [featureSession('Feature')]);
const nextDayTwoFeatures = weekend('next-day', 'Jul 2, 2026', setupA.id, [
  featureSession('Feature 1', 'Feature'), featureSession('Feature 2', 'Feature'),
]);
assert.equal(getComponentStatus(derivedComponent(), [], [setupA]).used, 10);
assert.equal(getComponentStatus(derivedComponent(), [sameDay, nextDayTwoFeatures], [setupA]).used, 11);
const isoSameDay = weekend('iso-same-day', '2026-07-01', setupA.id, [featureSession('Feature')]);
const isoNextDay = weekend('iso-next-day', '2026-07-02', setupA.id, [featureSession('Feature')]);
assert.equal(getComponentStatus(derivedComponent(), [isoSameDay], [setupA]).used, 10);
assert.equal(getComponentStatus(derivedComponent(), [isoNextDay], [setupA]).used, 11);

assert.equal(calendarDaysSince('2026-07-01', new Date(2026, 6, 1, 23, 59)), 0);
assert.equal(calendarDaysSince('2026-07-01', new Date(2026, 6, 2, 0, 1)), 1);
assert.equal(calendarDaysSince('2026-03-07', new Date(2026, 2, 8, 23, 0)), 1);
assert.equal(calendarDaysSince('2026-10-31', new Date(2026, 10, 1, 1, 0)), 1);

for (const legacyFeatureName of ['Feature 1', 'Feat. 1', 'A-MAIN']) {
  const inferred = weekend(`inferred-${legacyFeatureName}`, 'Jul 2, 2026', setupA.id, [featureSession(legacyFeatureName)]);
  assert.equal(getComponentStatus(derivedComponent(), [inferred], [setupA]).used, 11);
}

const carBWeekend = weekend('car-b-weekend', 'Jul 3, 2026', setupB.id, [featureSession('A-MAIN')]);
assert.equal(getComponentStatus(derivedComponent({ startingUsage: 0 }), [nextDayTwoFeatures, carBWeekend], [setupA, setupB]).used, 1);
assert.equal(getComponentStatus(derivedComponent({ scope: 'rig', carId: undefined, startingUsage: 0 }), [nextDayTwoFeatures, carBWeekend], [setupA, setupB]).used, 2);
assert.equal(getComponentStatus(derivedComponent({ manualUnits: 4 }), [nextDayTwoFeatures], [setupA]).used, 4);

assert.equal(normalizeStartingUsage(3), 3);
assert.equal(normalizeStartingUsage(-1), 0);
assert.equal(normalizeStartingUsage(1.5), 0);
assert.equal(normalizeStartingUsage(Number.NaN), 0);

const startingDue = derivedComponent({ id: 'starting-due', intervalValue: 10, startingUsage: 9 });
const dueFromStartingUsage = reconcileMaintenanceChecklist([main], [startingDue], [], [setupA], 'starting-due');
assert.equal(dueFromStartingUsage[0].items.some(item => item.sourceId === 'maintenance:starting-due'), true);

const serviceLog: MaintenanceLog = {
  id: 'service', componentId: derivedComponent().id, date: '2026-07-14', type: 'service',
};
const serviceReset = applyServiceLog(derivedComponent(), serviceLog);
assert.equal(serviceReset.startingUsage, 0);
assert.equal(serviceReset.lastServicedAt, '2026-07-14');
const manualReset = applyServiceLog(derivedComponent({ manualUnits: 12 }), serviceLog);
assert.equal(manualReset.manualUnits, 0);
assert.equal(manualReset.startingUsage, 0);

const quickOriginal = derivedComponent({ startingUsage: 7 });
const quickOriginalBytes = JSON.stringify(quickOriginal);
const quickService = buildQuickServiceRecords(quickOriginal, { componentId: quickOriginal.id, notes: '', dateISO: '2026-07-14' }, [], [setupA], null);
assert.equal(quickService.updatedComponent.startingUsage, 0);
assert.equal(JSON.stringify(quickOriginal), quickOriginalBytes);

const cloudRow = maintenanceComponentToCloudRow(derivedComponent(), 'user-1', '2026-07-14T00:00:00Z');
assert.equal(cloudRow.starting_usage, 10);
const cloudRoundTrip = maintenanceComponentFromCloudRow(cloudRow);
assert.equal(cloudRoundTrip.startingUsage, 10);
assert.equal(cloudRoundTrip.intervalType, 'races');
assert.equal(maintenanceComponentFromCloudRow({ ...cloudRow, interval_type: 'days', starting_usage: 0 }).intervalType, 'days');
assert.equal(maintenanceComponentFromCloudRow({ ...cloudRow, interval_type: 'laps', starting_usage: 2.5 }).intervalType, 'races');
assert.equal(maintenanceComponentFromCloudRow({ ...cloudRow, interval_type: 'laps', starting_usage: 2.5 }).startingUsage, 0);
assert.equal(maintenanceComponentFromCloudRow({ ...cloudRow, starting_usage: -1 }).startingUsage, 0);
assert.equal(maintenanceComponentFromCloudRow({ ...cloudRow, starting_usage: Number.POSITIVE_INFINITY }).startingUsage, 0);
assert.deepEqual(DEFAULT_COMPONENTS.map(item => [item.name, item.intervalType, item.intervalValue]), [
  ['Engine oil', 'races', 3],
  ['Motor freshen', 'races', 10],
  ['Transmission fluid', 'days', 60],
  ['Wheel bearings', 'races', 10],
  ['Shock rebuild', 'races', 10],
  ['Trailer bearings', 'days', 180],
]);

const todoCloudSource: Todo = {
  id: 'cloud-main', user_id: 'old-user', title: 'Main Checklist', updated_at: 'old', items: [{
    id: 'history-cloud', text: 'Archived job', done: true, archivedAt: '2026-07-14T12:00:00Z',
    removedUntilReset: true, completionNote: 'Done', completedAt: '2026-07-14T11:00:00Z',
    assignedTo: 'u1', assignedToName: 'Alex', sourceType: 'template', sourceId: 'template:t1:a', sourceCycle: 'cycle-1',
  }],
};
const todoCloudRow = todoToCloudRow(todoCloudSource, 'owner-user', '2026-07-14T13:00:00Z');
const todoCloudResult = todoFromCloudRow(todoCloudRow);
assert.deepEqual(todoCloudResult.items, todoCloudSource.items);
assert.equal(todoCloudResult.user_id, 'owner-user');
assert.equal(todoCloudResult.updated_at, '2026-07-14T13:00:00Z');

const entries: AccountingEntry[] = [
  { id: '3', name: 'Pit fuel', description: '20 gal methanol', category: 'Fuel', amount: 100, type: 'expense', date: '2026-07-13T12:00:00Z' },
  { id: '2', name: 'Pit fuel duplicate', description: '20 gal methanol', category: 'Fuel', amount: 90, type: 'expense', date: '2026-07-12T12:00:00Z' },
  { id: '1', name: 'Entry fee', description: 'Weekly show', category: 'Race Entry', amount: 50, type: 'expense', date: '2026-07-11T12:00:00Z' },
];
assert.equal(lastAccountingCategory(entries), 'Fuel');
assert.equal(lastAccountingCategory([{ ...entries[0], category: undefined }]), 'Other');
assert.equal(lastAccountingCategory([{ ...entries[0], category: 'Travel', date: '2020-01-01' }, entries[2]]), 'Travel');
assert.deepEqual(recentAccountingRepeats(entries), [
  { description: '20 gal methanol', category: 'Fuel' },
  { description: 'Weekly show', category: 'Race Entry' },
]);
assert.equal(localDateValue(new Date(2026, 6, 13, 23, 30)), '2026-07-13');

const root = process.cwd();
const trackersSource = readFileSync(join(root, 'src/components/TrackersView.tsx'), 'utf8');
const todoSource = readFileSync(join(root, 'src/components/ToDoView.tsx'), 'utf8');
const dashboardSource = readFileSync(join(root, 'src/components/DashboardView.tsx'), 'utf8');
const maintenanceSource = readFileSync(join(root, 'src/lib/maintenance.ts'), 'utf8');
const serviceLogSource = readFileSync(join(root, 'src/lib/serviceLog.ts'), 'utf8');
const typesSource = readFileSync(join(root, 'src/types.ts'), 'utf8');
const syncSource = readFileSync(join(root, 'src/lib/sync.ts'), 'utf8');
assert.match(trackersSource, /label: 'Maintenance Logs'/);
assert.doesNotMatch(trackersSource, /label: 'Service'/);
assert.doesNotMatch(trackersSource, /label: 'Templates'/);
assert.equal(MAINTENANCE_CATEGORIES.filter(category => category === 'Other').length, 1);
assert.doesNotMatch(trackersSource, /<option value="Other">Other<\/option>/);
assert.equal((todoSource.match(/>\s*Manage\s*</g) ?? []).length, 1);
assert.match(todoSource, /title="Manage checklist"/);
assert.match(todoSource, /activeChecklistItems\(currentMain\)/);
assert.match(todoSource, /Completed since last reset/);
assert.match(todoSource, /Checklist clear/);
assert.match(todoSource, /6000/);
assert.match(todoSource, /if \(event\.currentTarget !== event\.target\) return;/);
assert.match(todoSource, /min-h-14/);
assert.match(todoSource, /min-h-11 min-w-11/);
assert.match(todoSource, /Mark open/);
assert.match(todoSource, /Add completion note/);
assert.doesNotMatch(todoSource, /CompletionModal|pendingComplete|Mark Task Complete|overflow-y-auto/);
assert.match(dashboardSource, /activeChecklistItems\(mainChecklist\)/);
assert.match(dashboardSource, /Checklist clear/);
assert.doesNotMatch(dashboardSource, /openItems\.slice|\+\{openItems\.length - 3\} more/);
assert.match(dashboardSource, /Maintenance Due/);
assert.doesNotMatch(trackersSource, /Below 90%|At least 90% of the limit|Each item shows how much has been used/);
assert.match(trackersSource, /Used \{status\.used\} · Limit \{status\.limit\} · Remaining \{remaining\}/);
assert.match(trackersSource, /<option value="races">Races<\/option>/);
assert.match(trackersSource, /<option value="days">Days<\/option>/);
assert.match(trackersSource, /No Race Day \(general\)/);
assert.match(trackersSource, /All Race Days/);
assert.match(todoSource, /Reset for new Race Day/);
assert.match(trackersSource, /Races already run/);
assert.match(trackersSource, /Days already in service/);
assert.match(trackersSource, /setLogDate\(localDateValue\(\)\)/);
assert.match(dashboardSource, /useState\(\(\) => localDateValue\(\)\)/);
assert.match(dashboardSource, /setSvcDate\(localDateValue\(\)\)/);
assert.doesNotMatch(dashboardSource, /setSvcDate\(new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\)/);
assert.doesNotMatch(trackersSource, /<option value="laps">|<option value="sessions">|Feature races/);
assert.doesNotMatch(maintenanceSource, /intervalType: 'laps'|intervalType: 'sessions'/);
assert.doesNotMatch(serviceLogSource, /night|nights/);
assert.match(typesSource, /MaintenanceIntervalType = 'races' \| 'days'/);
assert.match(typesSource, /archivedAt\?: string/);
assert.match(syncSource, /todoToCloudRow\(todo, userId, updatedAt\)/);
assert.match(syncSource, /todoFromCloudRow\(row\)/);

console.log('Chunk 8 Trackers harness PASS');
