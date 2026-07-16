import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectAssignmentChanges } from '../src/lib/assignmentNotify';
import type { Todo, TodoItem } from '../src/types';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const item = (id: string, changes: Partial<TodoItem> = {}): TodoItem => ({
  id,
  text: `Task ${id}`,
  done: false,
  ...changes,
});
const checklist = (items: TodoItem[], id = 'main'): Todo[] => [{
  id,
  user_id: 'owner',
  title: 'Main Checklist',
  items,
  updated_at: '2026-07-15T00:00:00.000Z',
}];

const baseline = checklist([item('existing')]);
assert.deepEqual(
  detectAssignmentChanges(baseline, checklist([item('existing', { assignedTo: 'member-a' })])),
  [{ itemId: 'existing', todoId: 'main', assignedTo: 'member-a', taskText: 'Task existing', taskDesc: undefined }],
  'assignment emits once',
);
assert.deepEqual(
  detectAssignmentChanges(
    checklist([item('existing', { assignedTo: 'member-a' })]),
    checklist([item('existing', { assignedTo: 'member-b' })]),
  ).map(change => change.assignedTo),
  ['member-b'],
  'reassignment emits once',
);
assert.equal(
  detectAssignmentChanges(baseline, checklist([item('new', { assignedTo: 'member-a', sourceType: 'manual' })])).length,
  1,
  'new manually-created assigned task emits',
);
assert.equal(
  detectAssignmentChanges(baseline, checklist([item('new', { assignedTo: 'member-a', sourceType: 'template' })])).length,
  0,
  'template occurrence emits nothing',
);
assert.equal(
  detectAssignmentChanges(baseline, checklist([item('new', { assignedTo: 'member-a', sourceType: 'maintenance' })])).length,
  0,
  'maintenance occurrence emits nothing',
);
assert.equal(
  detectAssignmentChanges(
    checklist([item('existing', { assignedTo: 'member-a' })]),
    checklist([item('existing')]),
  ).length,
  0,
  'unassignment emits nothing',
);
assert.equal(
  detectAssignmentChanges(
    checklist([item('existing', { assignedTo: 'member-a' })]),
    checklist([item('existing', { assignedTo: 'member-a' })]),
  ).length,
  0,
  'unchanged assignment emits nothing',
);
assert.equal(
  detectAssignmentChanges(baseline, checklist([item('done', { assignedTo: 'member-a', sourceType: 'manual', done: true })])).length,
  0,
  'completed task emits nothing',
);
assert.equal(
  detectAssignmentChanges(baseline, checklist([item('archived', { assignedTo: 'member-a', sourceType: 'manual', archivedAt: '2026-07-15T00:00:00.000Z' })])).length,
  0,
  'archived task emits nothing',
);
assert.equal(
  detectAssignmentChanges(baseline, checklist([item('reset-copy', { assignedTo: 'member-a', sourceType: 'template' })])).length,
  0,
  'reset-minted inherited non-manual assignment emits nothing',
);
assert.equal(
  detectAssignmentChanges(
    [...baseline, { ...checklist([item('hidden', { assignedTo: 'member-a', sourceType: 'manual' })], 'other')[0], title: 'Other List' }],
    [...baseline, { ...checklist([item('hidden', { assignedTo: 'member-b', sourceType: 'manual' })], 'other')[0], title: 'Other List' }],
  ).length,
  0,
  'only Main Checklist is considered',
);

let previousForRapidSaves = baseline;
const firstSave = checklist([item('existing', { assignedTo: 'member-a' })]);
assert.equal(detectAssignmentChanges(previousForRapidSaves, firstSave).length, 1);
previousForRapidSaves = firstSave;
assert.equal(detectAssignmentChanges(previousForRapidSaves, firstSave).length, 0, 'ref update avoids double-send');

const app = read('src/App.tsx');
assert.match(app, /prevTodosForNotifyRef\.current = updated/);
assert.match(app, /prevTodosForNotifyRef\.current = \[\]/);
assert.match(app, /prevTodosForNotifyRef\.current = materialized/);
assert.match(app, /pushTodos\(updated, syncOwnerId, setSyncStatus\)/);
assert.match(app, /void sendPush\(\{ toUserId: change\.assignedTo \}/);
assert.match(app, /teamMembers && teamMembers\.length > 1/);
assert.match(app, /member\.id === change\.assignedTo/);

const push = read('src/lib/push.ts');
assert.match(push, /functions\.invoke\('send-push'/);
assert.match(push, /\[push\] send-push failed/);

console.log('Assignment notification harness: PASS');
