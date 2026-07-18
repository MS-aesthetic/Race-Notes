import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
const onlineExpression = app.match(/const isOnlineNow = \(\): boolean => (typeof navigator === 'undefined' \|\| navigator\.onLine);/)?.[1];
assert.ok(onlineExpression, 'B3 owns a production-derived navigator expression after saveStatus deletion');
const isOnlineNow = (navigator: unknown): boolean => new Function('navigator', `return ${onlineExpression};`)(navigator) as boolean;

assert.doesNotMatch(app, /from '\.\/lib\/saveStatus'/, 'B3 deletes obsolete saveStatus module import');
assert.equal(isOnlineNow({ onLine: false }), false, 'production-derived online check reads offline navigator mock');
assert.equal(isOnlineNow({ onLine: true }), true, 'production-derived online check reads online navigator mock');
assert.equal(isOnlineNow(undefined), true, 'production-derived online check keeps SSR-safe default');
assert.match(app, /const \[online, setOnline\] = useState\(isOnlineNow\(\)\);/);
assert.match(app, /window\.addEventListener\('online', up\);/);
assert.match(app, /window\.addEventListener\('offline', down\);/);
assert.match(app, /return \(\) => \{\s*window\.removeEventListener\('online', up\);\s*window\.removeEventListener\('offline', down\);\s*\};/);

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
assert.ok(signedHeader >= 0 && chipAt > signedHeader && chipAt < headerEnd, 'chip remains in signed-in sticky header');
assert.ok(chipAt < guideAt, 'chip precedes Tuning Guide');
assert.ok(headerEnd < contextAt, 'chip precedes tab-conditioned ContextStrip');

const toastStart = app.indexOf('{/* One compact notification arbiter.');
const toastEnd = app.indexOf('{/* Core Main Active Canvas Area */}', toastStart);
assert.ok(toastStart >= 0 && toastEnd > toastStart, 'unified notification arbiter block remains');
const toast = app.slice(toastStart, toastEnd);
for (const state of ['synced', 'offline-saved', 'deferred-delete-retrying', 'sync-error']) assert.ok(toast.includes(state), `typed renderer retains ${state}`);
for (const copy of ['Saved', 'Offline — saved on device', 'Syncing…', 'Synced', 'Sync failed — will retry']) assert.ok(toast.includes(copy), `arbiter retains ${copy}`);
assert.match(toast, /const isInfo = !!infoToast;/);
assert.match(toast, /const isBusy = !isInfo && !savedFlash && syncStatus === 'syncing';/);
assert.match(toast, /const isPersistent = statusNotice === 'deferred-delete-retrying' \|\| statusNotice === 'sync-error';/);
assert.match(toast, /data-notification-slot="arbiter"/);
assert.match(toast, /style=\{\{ top: notificationTop \}\}/);
assert.match(toast, /role="status"/);
assert.match(toast, /aria-live="polite"/);
assert.match(toast, /aria-label="Dismiss notification"[\s\S]*className="tap-target/);
assert.match(toast, /onClick=\{isInfo \? clearInfo : \(\) => setSyncStatus\(null\)\}/);
assert.match(app, /const SUCCESS_TOAST_MS = 1500;/);
assert.match(app, /setTimeout\(\(\) => setSyncStatus\(null\), SUCCESS_TOAST_MS\)/);
assert.doesNotMatch(app, /setTimeout\(\(\) => setSyncStatus\(null\), (?:2500|3000)\)/);

console.log('Offline indicator harness: PASS');
