import assert from 'node:assert/strict';
import { STARTER_TEMPLATES, reconcileStarterTemplates, untouchedStarterFingerprint } from '../src/lib/checklists.ts';
import type { ChecklistTemplate } from '../src/types.ts';

let serial = 0;
const materialize = (starter: (typeof STARTER_TEMPLATES)[number]): ChecklistTemplate => ({
  id: `seed-${serial += 1}`,
  name: starter.name,
  category: starter.category,
  items: starter.items.map((text, index) => ({ id: `item-${serial}-${index}`, text })),
  updatedAt: '2026-07-13T00:00:00.000Z',
});

const starter = materialize(STARTER_TEMPLATES[0]);
const duplicate = { ...starter, id: 'duplicate', updatedAt: '2026-07-14T00:00:00.000Z' };
const customized = { ...starter, id: 'customized', items: [...starter.items, { id: 'custom-item', text: 'Custom note' }] };
const sameName = { ...starter, id: 'same-name', category: 'Custom' };

const empty = reconcileStarterTemplates([], materialize);
assert.equal(empty.seeded.length, STARTER_TEMPLATES.length);
assert.equal(reconcileStarterTemplates(empty.templates, materialize).seeded.length, 0);
const partial = reconcileStarterTemplates([starter], materialize);
assert.equal(partial.seeded.length, STARTER_TEMPLATES.length - 1);
assert.ok(partial.seeded.every(template => template.id !== starter.id), 'cloud push payload must contain seeded rows only');
assert.equal(partial.templates.length, STARTER_TEMPLATES.length, 'reconciled local list includes keeper plus seeded rows');

const legacyStrings = { ...starter, items: starter.items.map(item => item.text) } as unknown as ChecklistTemplate;
assert.equal(untouchedStarterFingerprint(starter), untouchedStarterFingerprint(legacyStrings));

const forward = reconcileStarterTemplates([duplicate, customized, sameName, starter], materialize);
const reverse = reconcileStarterTemplates([starter, sameName, customized, duplicate], materialize);
assert.deepEqual(forward.discardedIds, ['duplicate']);
assert.deepEqual(reverse.discardedIds, ['duplicate']);
assert.ok(forward.templates.some(template => template.id === 'customized'));
assert.ok(forward.templates.some(template => template.id === 'same-name'));
assert.deepEqual(forward.templates.find(template => template.id === 'customized'), customized);
assert.deepEqual(forward.templates.find(template => template.id === 'same-name'), sameName);
assert.equal(untouchedStarterFingerprint(starter), untouchedStarterFingerprint(duplicate));
assert.notEqual(untouchedStarterFingerprint(starter), untouchedStarterFingerprint(customized));
assert.notEqual(untouchedStarterFingerprint(starter), untouchedStarterFingerprint(sameName));

const { updatedAt: _oldUpdatedAt, ...legacyOldFields } = starter;
const { updatedAt: _newUpdatedAt, ...legacyNewFields } = duplicate;
const legacyOld = { ...legacyOldFields, id: 'legacy-a' } as ChecklistTemplate;
const legacyNew = { ...legacyNewFields, id: 'legacy-b' } as ChecklistTemplate;
const legacyResult = reconcileStarterTemplates([legacyNew, legacyOld], materialize);
assert.deepEqual(legacyResult.discardedIds, ['legacy-b'], 'missing updatedAt uses deterministic id tiebreaker');
console.log('UX-R1 starter harness PASS');
