import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  editChecklistItem,
  reconcileMaintenanceChecklist,
  resetChecklistItems,
  resetMainChecklist,
  todoItemKind,
} from '../src/lib/checklistMaintenance';
import { activeChecklistItems } from '../src/lib/mainChecklist';
import { lastAccountingCategory, localDateValue, recentAccountingRepeats } from '../src/lib/accountingDefaults';
import { applyServiceLog, calendarDaysSince, DEFAULT_COMPONENTS, getComponentStatus, normalizeStartingUsage } from '../src/lib/maintenance';
import { maintenanceComponentFromCloudRow, maintenanceComponentToCloudRow } from '../src/lib/maintenanceSync';
import { buildQuickServiceRecords } from '../src/lib/serviceLog';
import { MAINTENANCE_CATEGORIES, type AccountingEntry, type MaintenanceComponent, type MaintenanceLog, type RaceWeekend, type Setup, type Todo, type TodoItem } from '../src/types';

const core: TodoItem = { id: 'core', text: 'Torque wheels', done: true, completionNote: '80 ft-lb', completedAt: '2026-07-13', removedUntilReset: true };
const adhoc: TodoItem = { id: 'adhoc', text: 'Grab fuel', done: true, kind: 'adhoc', sourceType: 'manual' };
assert.equal(todoItemKind(core), 'core');
assert.equal(todoItemKind(adhoc), 'adhoc');
assert.deepEqual(resetChecklistItems([core, adhoc], false).map(item => item.id), ['core']);
assert.equal(resetChecklistItems([core, adhoc], true).length, 2);
const resetCore = resetChecklistItems([core], true)[0];
assert.equal(resetCore.done, false);
assert.equal(resetCore.removedUntilReset, undefined);
assert.equal(resetCore.completionNote, undefined);

const main: Todo = { id: 'main', user_id: '', title: 'Main Checklist', items: [core, adhoc], updated_at: 'old' };
assert.equal(resetMainChecklist([main], false, 'new')[0].items.length, 1);
assert.equal(resetMainChecklist([main], true, 'new')[0].items.length, 2);

const activeProjection = activeChecklistItems({
  ...main,
  items: [
    { id: 'removed-core', text: 'Hidden core job', done: false, kind: 'core', removedUntilReset: true },
    { id: 'open', text: 'Visible open job', done: false, kind: 'core' },
    { id: 'done', text: 'Visible done job', done: true, kind: 'core' },
  ],
});
assert.deepEqual(activeProjection.map(item => item.id), ['open', 'done']);
assert.equal(activeProjection.filter(item => !item.done).length, 1);
assert.equal(activeProjection.filter(item => item.done).length, 1);
const roundTripProjection = activeChecklistItems(JSON.parse(JSON.stringify({ ...main, items: activeProjection })) as Todo);
assert.deepEqual(roundTripProjection.map(item => item.id), ['open', 'done']);

const imported: TodoItem[] = [
  { id: 'old-a', text: 'Old wording', done: false, kind: 'core', sourceType: 'template', sourceId: 'template:t1:a', removedUntilReset: true },
  { id: 'old-removed', text: 'Removed definition', done: false, kind: 'core', sourceType: 'template', sourceId: 'template:t1:removed' },
];
const templates = [{ id: 't1', name: 'Car Prep', category: 'Car Prep', updatedAt: 'now', items: [
  { id: 'a', text: 'Updated wording' }, { id: 'b', text: 'New core job' },
] }];
const templateReset = resetChecklistItems(imported, true, templates);
assert.deepEqual(templateReset.filter(item => !item.removedUntilReset).map(item => item.text).sort(), ['New core job', 'Updated wording']);
assert.equal(templateReset.filter(item => !item.removedUntilReset).every(item => !item.done), true);
const emptyTemplateReset = resetChecklistItems(imported, true, [{ ...templates[0], items: [] }]);
assert.equal(emptyTemplateReset.every(item => item.removedUntilReset), true);
const repopulatedTemplate = resetChecklistItems(emptyTemplateReset, true, [{ ...templates[0], items: [{ id: 'fresh', text: 'Fresh definition' }] }]);
assert.equal(repopulatedTemplate.some(item => item.text === 'Fresh definition' && !item.removedUntilReset), true);

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
const dueWeekendReset = resetMainChecklist(completed, true, 'weekend');
assert.equal(dueWeekendReset[0].items.filter(item => item.sourceType === 'maintenance' && item.done).length, 1);
assert.equal(dueWeekendReset[0].items.filter(item => item.sourceType === 'maintenance' && !item.done).length, 1);
const afterReset = reconcileMaintenanceChecklist(completed, [component(100, '2026-07-14')], [], [], 'below');
assert.equal(afterReset[0].items.some(item => item.sourceType === 'maintenance' && item.done), true);

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
assert.match(trackersSource, /label: 'Maintenance Logs'/);
assert.doesNotMatch(trackersSource, /label: 'Service'/);
assert.doesNotMatch(trackersSource, /label: 'Templates'/);
assert.equal(MAINTENANCE_CATEGORIES.filter(category => category === 'Other').length, 1);
assert.doesNotMatch(trackersSource, /<option value="Other">Other<\/option>/);
assert.match(todoSource, /Edit List/);
assert.match(todoSource, /activeChecklistItems\(activeTodo\)/);
assert.match(dashboardSource, /activeChecklistItems\(mainChecklist\)/);
assert.match(dashboardSource, /Maintenance Due/);
assert.doesNotMatch(trackersSource, /Below 90%|At least 90% of the limit|Each item shows how much has been used/);
assert.match(trackersSource, /Used \{status\.used\} · Limit \{status\.limit\} · Remaining \{remaining\}/);
assert.match(trackersSource, /<option value="races">Races<\/option>/);
assert.match(trackersSource, /<option value="days">Days<\/option>/);
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

console.log('Chunk 8 Trackers harness PASS');
