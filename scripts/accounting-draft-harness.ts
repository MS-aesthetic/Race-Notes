import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNTING_DRAFT_KEY,
  clearAccountingDraft,
  readAccountingDraft,
  writeAccountingDraft,
  type AccountingDraft,
} from '../src/lib/accountingDraft';

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  constructor(private failures = 0) {}
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    this.writes += 1;
    if (this.failures-- > 0) throw new Error('quota');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
  has(key: string) { return this.values.has(key); }
}

const draft: AccountingDraft = {
  name: 'Pit pass', desc: 'Friday gate', amount: '42.50', type: 'expense', payer: 'Crew', payee: 'Track',
  weekendId: 'wknd-1', weekendName: 'Friday night', receiptPhoto: 'data:image/jpeg;base64,photo', category: 'Travel', entryDate: '2026-07-16',
};
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const install = (storage: MemoryStorage) => Object.defineProperty(globalThis, 'localStorage', {
  configurable: true, writable: true, value: storage,
});

try {
  const empty = new MemoryStorage();
  install(empty);
  assert.equal(ACCOUNTING_DRAFT_KEY, 'race_notes_accounting_draft');
  assert.equal(readAccountingDraft(), null);

  writeAccountingDraft(draft);
  assert.deepEqual(readAccountingDraft(), draft, 'all 11 fields round-trip including receipt');
  assert.equal(Object.keys(JSON.parse(empty.getItem(ACCOUNTING_DRAFT_KEY)!)).length, 11);

  empty.values.set(ACCOUNTING_DRAFT_KEY, '{bad json');
  assert.equal(readAccountingDraft(), null);
  assert.equal(empty.has(ACCOUNTING_DRAFT_KEY), false, 'corrupt draft removed');
  empty.values.set(ACCOUNTING_DRAFT_KEY, JSON.stringify({ ...draft, type: 'other' }));
  assert.equal(readAccountingDraft(), null);
  assert.equal(empty.has(ACCOUNTING_DRAFT_KEY), false, 'wrong-shaped draft removed');

  const quota = new MemoryStorage(1);
  install(quota);
  writeAccountingDraft(draft);
  assert.equal(quota.writes, 2, 'receipt fallback retries once');
  assert.deepEqual(readAccountingDraft(), { ...draft, receiptPhoto: '' }, 'fallback preserves other ten fields');

  const failed = new MemoryStorage(2);
  install(failed);
  assert.doesNotThrow(() => writeAccountingDraft(draft), 'total storage failure is nonfatal');
  assert.equal(readAccountingDraft(), null);
  assert.doesNotThrow(clearAccountingDraft);

  const root = process.cwd();
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  const tracker = read('src/components/TrackersView.tsx');
  const app = read('src/App.tsx');
  const helper = read('src/lib/accountingDraft.ts');
  assert.match(tracker, /useState\(\(\) => readAccountingDraft\(\)\)/, 'draft reads once at initialization');
  assert.match(tracker, /useState\(\(\) => restoredDraft !== null\)/, 'valid draft auto-opens form');
  const persistence = tracker.match(/useEffect\(\(\) => \{\s*if \(!showForm\) return;([\s\S]*?)\}, \[showForm, ([^\]]+)\]\);/);
  assert.ok(persistence, 'open form persists draft');
  for (const field of ['name', 'desc', 'amount', 'type', 'payer', 'payee', 'weekendId', 'weekendName', 'receiptPhoto', 'category', 'entryDate']) {
    assert.match(persistence![1], new RegExp(`\\b${field}\\b`), `${field} is persisted`);
    assert.match(persistence![2], new RegExp(`\\b${field}\\b`), `${field} triggers persistence`);
  }
  assert.doesNotMatch(persistence![0], /weekendFilter/, 'list filter is excluded from draft');
  assert.match(tracker, /const cancelForm = \(\) => \{\s*clearAccountingDraft\(\);\s*resetForm\(\);\s*setShowForm\(false\);/);
  const submit = tracker.match(/const handleAdd = \(ev: React\.FormEvent\) => \{([\s\S]*?)\n  \};/);
  assert.ok(submit);
  assert.ok(submit![1].indexOf('if (!name.trim()') < submit![1].indexOf('onSave('), 'invalid submit returns before save');
  assert.ok(submit![1].indexOf('onSave(') < submit![1].indexOf('clearAccountingDraft()'), 'successful save clears draft after persistence');
  assert.match(tracker, /const resetForm = \(\) => \{[\s\S]*setCategory\(lastAccountingCategory\(entries\)\); setEntryDate\(localDateValue\(\)\);/);
  assert.match(app, /import \{ ACCOUNTING_DRAFT_KEY \} from '\.\/lib\/accountingDraft';/);
  const localKeys = app.match(/const LOCAL_KEYS = \[([\s\S]*?)\];/);
  assert.ok(localKeys && localKeys[1].includes('ACCOUNTING_DRAFT_KEY'), 'device Clear All removes draft');
  assert.doesNotMatch(helper, /supabase|sync\.ts|push[A-Z]|pull[A-Z]/i, 'draft helper has no cloud sync usage');
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
}

console.log('ACCOUNTING_DRAFT_HARNESS PASS');
