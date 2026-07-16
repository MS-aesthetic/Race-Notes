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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

class ReceiptWorkSimulation {
  receiptPhoto: string | undefined;
  formOpen = true;
  mounted = true;
  private generation = 0;

  select(compression: Promise<string>) {
    const requestGeneration = ++this.generation;
    return compression.then(compressed => {
      if (this.generation === requestGeneration) this.receiptPhoto = compressed;
    }).catch(() => {
      // Receipt compression is optional and intentionally nonfatal.
    });
  }

  private invalidate() {
    this.generation += 1;
  }

  private resetAndClose() {
    this.invalidate();
    this.receiptPhoto = undefined;
    this.formOpen = false;
  }

  cancel() { this.resetAndClose(); }
  successfulSubmit() { this.resetAndClose(); }
  closeForm() { this.resetAndClose(); }
  reopenForm() { this.formOpen = true; }

  removePhoto() {
    this.invalidate();
    this.receiptPhoto = undefined;
  }

  unmount() {
    this.invalidate();
    this.mounted = false;
  }
}

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
  assert.match(tracker, /import React, \{ useEffect, useRef, useState \} from 'react';/);
  assert.match(tracker, /const receiptRequestGenerationRef = useRef\(0\);/);
  assert.match(tracker, /const invalidateReceiptWork = \(\) => \{\s*receiptRequestGenerationRef\.current \+= 1;\s*\};/);
  assert.match(tracker, /useState\(\(\) => readAccountingDraft\(\)\)/, 'draft reads once at initialization');
  assert.match(tracker, /useState\(\(\) => restoredDraft !== null\)/, 'valid draft auto-opens form');
  const persistence = tracker.match(/useEffect\(\(\) => \{\s*if \(!showForm\) return;([\s\S]*?)\}, \[showForm, ([^\]]+)\]\);/);
  assert.ok(persistence, 'open form persists draft');
  for (const field of ['name', 'desc', 'amount', 'type', 'payer', 'payee', 'weekendId', 'weekendName', 'receiptPhoto', 'category', 'entryDate']) {
    assert.match(persistence![1], new RegExp(`\\b${field}\\b`), `${field} is persisted`);
    assert.match(persistence![2], new RegExp(`\\b${field}\\b`), `${field} triggers persistence`);
  }
  assert.doesNotMatch(persistence![0], /weekendFilter/, 'list filter is excluded from draft');
  const reset = tracker.match(/const resetForm = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(reset && reset[1].includes('invalidateReceiptWork();'), 'all reset/close paths invalidate receipt work');
  assert.match(tracker, /const cancelForm = \(\) => \{\s*clearAccountingDraft\(\);\s*resetForm\(\);\s*setShowForm\(false\);/);
  assert.match(tracker, /onClick=\{showForm \? cancelForm : openForm\}/, 'visible form close routes through invalidating Cancel');
  assert.equal(tracker.match(/setShowForm\(false\)/g)?.length, 2, 'only Cancel and successful submit close the form');
  const submit = tracker.match(/const handleAdd = \(ev: React\.FormEvent\) => \{([\s\S]*?)\n  \};/);
  assert.ok(submit);
  assert.ok(submit![1].indexOf('if (!name.trim()') < submit![1].indexOf('onSave('), 'invalid submit returns before save');
  assert.ok(submit![1].indexOf('onSave(') < submit![1].indexOf('clearAccountingDraft()'), 'successful save clears draft after persistence');
  assert.ok(submit![1].indexOf('clearAccountingDraft()') < submit![1].indexOf('resetForm()'), 'successful submit invalidates through reset after clearing');
  assert.match(tracker, /const resetForm = \(\) => \{[\s\S]*setCategory\(lastAccountingCategory\(entries\)\); setEntryDate\(localDateValue\(\)\);/);
  assert.match(tracker, /useEffect\(\(\) => \(\) => \{\s*invalidateReceiptWork\(\);\s*\}, \[\]\);/, 'unmount invalidates receipt work');
  const receiptHandler = tracker.match(/const handleReceiptPhoto = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{([\s\S]*?)\n  \};/);
  assert.ok(receiptHandler, 'receipt handler exists');
  assert.match(receiptHandler![1], /const requestGeneration = \+\+receiptRequestGenerationRef\.current;/, 'each file selection owns a newer generation');
  assert.match(receiptHandler![1], /receiptRequestGenerationRef\.current === requestGeneration/, 'late resolve must still own current generation');
  assert.match(receiptHandler![1], /catch \{/, 'compression rejection remains nonfatal');
  assert.match(tracker, /const removeReceiptPhoto = \(\) => \{\s*invalidateReceiptWork\(\);\s*setReceiptPhoto\(undefined\);\s*\};/);
  assert.match(tracker, /onClick=\{removeReceiptPhoto\}/, 'explicit receipt remove uses invalidating handler');
  assert.match(app, /import \{ ACCOUNTING_DRAFT_KEY \} from '\.\/lib\/accountingDraft';/);
  const localKeys = app.match(/const LOCAL_KEYS = \[([\s\S]*?)\];/);
  assert.ok(localKeys && localKeys[1].includes('ACCOUNTING_DRAFT_KEY'), 'device Clear All removes draft');
  assert.doesNotMatch(helper, /supabase|sync\.ts|push[A-Z]|pull[A-Z]/i, 'draft helper has no cloud sync usage');

  const lateResolveCase = async (
    label: string,
    invalidate: (simulation: ReceiptWorkSimulation) => void,
    existingPhoto?: string,
  ) => {
    const simulation = new ReceiptWorkSimulation();
    simulation.receiptPhoto = existingPhoto;
    const pending = deferred<string>();
    const work = simulation.select(pending.promise);
    invalidate(simulation);
    pending.resolve(`late-${label}`);
    await work;
    assert.equal(simulation.receiptPhoto, undefined, `${label}: late resolve cannot restore cleared receipt`);
  };

  await lateResolveCase('cancel', simulation => {
    simulation.cancel();
    simulation.reopenForm();
    assert.equal(simulation.formOpen, true, 'Cancel then reopen starts blank form');
  });
  await lateResolveCase('successful submit', simulation => {
    simulation.successfulSubmit();
    simulation.reopenForm();
    assert.equal(simulation.formOpen, true, 'successful submit then reopen starts blank form');
  });
  await lateResolveCase('photo remove', simulation => simulation.removePhoto(), 'existing-photo');
  await lateResolveCase('form close/reopen', simulation => {
    simulation.closeForm();
    simulation.reopenForm();
    assert.equal(simulation.formOpen, true);
  });
  await lateResolveCase('unmount', simulation => {
    simulation.unmount();
    assert.equal(simulation.mounted, false);
  });

  const staleRejectSimulation = new ReceiptWorkSimulation();
  const staleReject = deferred<string>();
  const staleRejectWork = staleRejectSimulation.select(staleReject.promise);
  staleRejectSimulation.cancel();
  staleReject.reject(new Error('stale compression failed'));
  await assert.doesNotReject(staleRejectWork, 'stale rejection remains nonfatal');
  assert.equal(staleRejectSimulation.receiptPhoto, undefined);

  const latestSimulation = new ReceiptWorkSimulation();
  const slowFirst = deferred<string>();
  const fastLatest = deferred<string>();
  const slowFirstWork = latestSimulation.select(slowFirst.promise);
  const fastLatestWork = latestSimulation.select(fastLatest.promise);
  fastLatest.resolve('latest-photo');
  await fastLatestWork;
  assert.equal(latestSimulation.receiptPhoto, 'latest-photo', 'current compression result applies');
  slowFirst.resolve('stale-first-photo');
  await slowFirstWork;
  assert.equal(latestSimulation.receiptPhoto, 'latest-photo', 'latest request wins after older late resolve');
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
}

console.log('ACCOUNTING_DRAFT_HARNESS PASS');
