import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toTravel, travelToSvgY } from '../src/components/SmasherLoadsView';
import { buildComparisonRows } from '../src/lib/shockCompare';
import type { ShockSession } from '../src/types';

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
assert.match(guide, /High:<\/strong> Try first\./);
assert.match(guide, /Medium:<\/strong> Try this next if the first change did not fix the problem\./);
assert.match(guide, /Low:<\/strong> Fine-tuning after the bigger items are checked\./);

assert.match(types, /rideHeightCtoC\?: string/);
assert.match(loads, /New Load Session/);
assert.match(loads, /value=\{activeSession\.rideHeightCtoC \?\? ''\}/);
assert.match(loads, /rideHeightCtoC: formRideHeightCtoC\.trim\(\)/);
assert.match(sync, /ride_height_ctoc: s\.rideHeightCtoC \|\| ''/);
assert.match(sync, /rideHeightCtoC: \(r\.ride_height_ctoc as string\) \|\| ''/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS ride_height_ctoc text DEFAULT ''/i);

const heights = [12, 11.5, 10.75];
const maxHeight = Math.max(...heights);
const travels = heights.map(height => toTravel(height, maxHeight));
assert.deepEqual(travels, [0, 0.5, 1.25]);
const svgPositions = travels.map(travel => travelToSvgY(travel, 1.25, 20, 200));
assert.deepEqual(svgPositions, [220, 140, 20]);
assert.ok(svgPositions[2] < svgPositions[1] && svgPositions[1] < svgPositions[0]);
assert.equal(travelToSvgY(0, 0, 20, 200), 220, 'equal-height data stays at the chart floor');

assert.equal((loads.match(/sy: travelToSvgY\(toTravel\(height, heightMax\), maxTravel, PAD\.top, innerH\)/g) || []).length, 2);
assert.equal((loads.match(/TRAVEL \(in\)/g) || []).length, 2);
assert.doesNotMatch(loads, />HEIGHT \(in\)</);
assert.equal((loads.match(/<title>\{`Travel \$\{travel\.toFixed\(2\)\} in · Height \$\{p\.y\.toFixed\(2\)\} in`\}<\/title>/g) || []).length, 2);
assert.match(loads, /\{`H \$\{p\.y\.toFixed\(2\)\} in`\}/);
assert.match(loads, /const heightMin = Math\.min\(\.\.\.allY\), heightMax = Math\.max\(\.\.\.allY\)/);
const singleChartSource = loads.slice(loads.indexOf('function ShockLineChart'), loads.indexOf('// ─── Compare / Overlay Chart'));
const compareChartSource = loads.slice(loads.indexOf('function ShockCompareChart'), loads.indexOf('// ─── CSV Export'));
for (const chartSource of [singleChartSource, compareChartSource]) {
  assert.match(chartSource, /r=\{12\} fill="transparent" pointerEvents="all"/);
  assert.match(chartSource, /r=\{7\} fill="none" stroke="#fff" strokeWidth="1\.5" pointerEvents="none"/);
  assert.match(chartSource, /onFocus=\{/);
  assert.match(chartSource, /onBlur=\{/);
}

const comparisonSessions = [
  { id: 'a', points: [{ height: '10', load: '100' }, { height: '9', load: '200' }] },
  { id: 'b', points: [{ height: '10', load: '150' }, { height: '8', load: '350' }] },
] as ShockSession[];
const comparisonRows = buildComparisonRows(comparisonSessions);
assert.deepEqual(comparisonRows.map(row => row.height), [8, 9, 10]);
assert.deepEqual(comparisonRows.find(row => row.height === 9)?.values, [200, 250]);
assert.match(loads, /\['Shock Height \(in\)', 'Load \(lb\)'\]/);

console.log('CHUNK6A_REFINEMENT_HARNESS PASS');
