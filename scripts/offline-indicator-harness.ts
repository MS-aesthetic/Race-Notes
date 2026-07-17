import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isOnline } from '../src/lib/saveStatus';

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');
const app = source('src/App.tsx');
const saveStatus = source('src/lib/saveStatus.ts');

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

try {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  assert.equal(isOnline(), false, 'isOnline reads offline navigator mock');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  assert.equal(isOnline(), true, 'isOnline reads online navigator mock');
} finally {
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else delete (globalThis as { navigator?: unknown }).navigator;
}

assert.match(saveStatus, /const \[online, setOnline\] = useState\(isOnline\(\)\);/);
assert.match(saveStatus, /window\.addEventListener\('online', up\);/);
assert.match(saveStatus, /window\.addEventListener\('offline', down\);/);
assert.match(saveStatus, /return \(\) => \{\s*window\.removeEventListener\('online', up\);\s*window\.removeEventListener\('offline', down\);\s*\};/);

const chipMatch = app.match(/\{!isOnline && \(\s*(<div[\s\S]*?aria-label="Offline — saved on device"[\s\S]*?<\/div>)\s*\)\}/);
assert.ok(chipMatch, 'one persistent offline chip is guarded only by !isOnline');
const chip = chipMatch[1];
assert.equal((app.match(/aria-label="Offline — saved on device"/g) ?? []).length, 1, 'one offline chip');
assert.match(chip, /role="status"/);
assert.match(chip, /aria-live="polite"/);
assert.match(chip, /className="status-chip shrink-0 border-outline-variant bg-surface-container text-on-surface-variant"/);
assert.match(chip, /<span className="material-symbols-outlined" aria-hidden="true">cloud_off<\/span>/);
assert.match(chip, /<span className="hidden min-\[360px\]:inline">OFFLINE<\/span>/);
assert.doesNotMatch(chip, /(?:bg|text|border)-(?:red|orange|amber|yellow|green|blue|indigo|violet|purple|pink|white|black|gray|slate|zinc|neutral)-/);
assert.doesNotMatch(chip, /setTimeout|useState|savedFlash|syncStatus|reportSave/);

const signedHeader = app.indexOf('{/* TopAppBar component with logo title & dual NEW entries triggers */}');
const headerEnd = app.indexOf('</header>', signedHeader);
const chipAt = app.indexOf(chip);
const guideAt = app.indexOf('aria-label="Tuning Guide"', signedHeader);
const contextAt = app.indexOf("{(activeTab === 'dashboard'", headerEnd);
assert.ok(signedHeader >= 0 && chipAt > signedHeader && chipAt < headerEnd, 'chip is in signed-in sticky header');
assert.ok(chipAt < guideAt, 'chip precedes Tuning Guide');
assert.ok(headerEnd < contextAt, 'chip precedes tab-conditioned ContextStrip');

const toastStart = app.indexOf('{/* One compact notification arbiter.');
const toastEnd = app.indexOf('{/* Core Main Active Canvas Area */}', toastStart);
assert.ok(toastStart >= 0 && toastEnd > toastStart, 'unified notification arbiter block remains');
const toast = app.slice(toastStart, toastEnd);
for (const state of ['Saved', 'Offline — saved on device', 'Syncing…', 'Synced']) {
  assert.ok(toast.includes(state), `arbiter retains ${state}`);
}
assert.match(toast, /const isInfo = !!infoToast;/);
assert.match(toast, /const isBusy = !isInfo && !savedFlash && syncStatus === 'Syncing\.\.\.';/);
assert.match(toast, /const isSynced = !isInfo && !savedFlash && syncStatus === 'Synced';/);
assert.match(toast, /const msg = isInfo[\s\S]*resolveInfoCopy\(infoToast\)[\s\S]*Offline — saved on device/);
assert.match(toast, /data-notification-slot="arbiter"/);
assert.match(toast, /style=\{\{ top: notificationTop \}\}/);
assert.match(toast, /role="status"/);
assert.match(toast, /aria-live="polite"/);
assert.match(toast, /aria-label="Dismiss notification"[\s\S]*className="tap-target/);
assert.match(app, /const SUCCESS_TOAST_MS = 1500;/);
assert.match(app, /setTimeout\(\(\) => setSyncStatus\(''\), SUCCESS_TOAST_MS\)/);
assert.doesNotMatch(app, /setTimeout\(\(\) => setSyncStatus\(''\), (?:2500|3000)\)/);

console.log('Offline indicator harness: PASS');
