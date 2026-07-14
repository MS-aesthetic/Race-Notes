import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = source('../src/App.tsx');
const settings = source('../src/components/SettingsView.tsx');
const guide = source('../src/components/QuickReferenceView.tsx');
const loads = source('../src/components/SmasherLoadsView.tsx');
const sync = source('../src/lib/sync.ts');
const types = source('../src/types.ts');
const migration = source('../supabase/migrations/20260714010630_add_load_session_ride_height.sql');

assert.match(app, /saved\.fontSize === 'xlarge' \|\| saved\.fontSize === 'xxlarge'/);
assert.match(app, /standard: 1\.15, large: 1\.15, xlarge: 1\.45, xxlarge: 1\.45/);
assert.match(settings, /value: 'large'.*label: 'Default'/);
assert.match(settings, /value: 'xlarge'.*label: 'Large'/);
assert.doesNotMatch(settings, /1\.15x|1\.45x|1\.7x|1x scale|XX-Large|X-Large/);

assert.doesNotMatch(guide, /AFCO|chassis-specific|class\/chassis/i);
assert.match(guide, /High:<\/strong> Try this first\. Biggest likely help\./);
assert.match(guide, /Medium:<\/strong> Try this next if the first change did not fix the problem\./);
assert.match(guide, /Low:<\/strong> Fine-tuning\. Check the bigger items first\./);

assert.match(types, /rideHeightCtoC\?: string/);
assert.match(loads, /New Load Session/);
assert.match(loads, /value=\{activeSession\.rideHeightCtoC \?\? ''\}/);
assert.match(loads, /rideHeightCtoC: formRideHeightCtoC\.trim\(\)/);
assert.match(sync, /ride_height_ctoc: s\.rideHeightCtoC \|\| ''/);
assert.match(sync, /rideHeightCtoC: \(r\.ride_height_ctoc as string\) \|\| ''/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS ride_height_ctoc text DEFAULT ''/i);

const svgY = (height: number, minHeight: number, maxHeight: number) =>
  20 + (1 - (height - minHeight) / (maxHeight - minHeight)) * 200;
assert.ok(svgY(10, 10, 12) > svgY(12, 10, 12));
assert.equal((loads.match(/sy: PAD\.top \+ \(1 - \(y - yMin\) \/ yRange\) \* innerH/g) || []).length, 2);

console.log('CHUNK6A_REFINEMENT_HARNESS PASS');
