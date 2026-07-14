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
import { lastAccountingCategory, localDateValue, recentAccountingRepeats } from '../src/lib/accountingDefaults';
import type { AccountingEntry, MaintenanceComponent, Todo, TodoItem } from '../src/types';

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
assert.match(automatic?.desc || '', /900.*1000.*100.*90%/);
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
assert.match(trackersSource, /label: 'Maintenance Logs'/);
assert.doesNotMatch(trackersSource, /label: 'Service'/);
assert.doesNotMatch(trackersSource, /label: 'Templates'/);
assert.match(todoSource, /Edit List/);
assert.match(dashboardSource, /Maintenance Due/);

console.log('Chunk 8 Trackers harness PASS');
