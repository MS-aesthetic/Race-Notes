import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/components/SetupView.tsx'), 'utf8');
const inp = "const INP = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-1.5 min-h-12 outline-none rounded';";
assert.ok(source.includes(inp));
assert.equal((source.match(/className=\{INP\}/g) ?? []).length, 5);
const selectClass = 'w-full min-w-0 min-h-12 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-2 outline-none rounded';
assert.equal((source.match(new RegExp(selectClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 2);
for (const field of ['tireInventoryId', 'boundGraphId']) {
  const at = source.indexOf(`value={data.${field} || ''}`);
  assert.ok(at >= 0 && source.slice(at, at + 900).includes('onChange'));
}
const expanded = source.slice(source.indexOf('{/* Metadata grid */}'), source.indexOf('{/* Computed stagger display */}'));
assert.equal((expanded.match(/<input type="text"/g) ?? []).length, 11);
assert.equal((expanded.match(/min-h-12/g) ?? []).length, 11);
assert.equal((expanded.match(/text-sm/g) ?? []).length, 12);
assert.match(expanded, /textarea[\s\S]*text-sm[\s\S]*min-h-\[60px\]/);
assert.match(expanded, /grid grid-cols-1 sm:grid-cols-2 gap-4/);
assert.match(source, /min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1\.5 sm:gap-3/);
assert.match(source, /<NumberStepper[\s\S]*?value=\{parseStoredNumber/);
assert.match(source, /\[&_\[role=group\]\]:flex-wrap/);
for (const token of ['Create New Setup', 'handleMetadataChange', 'onFieldChange', 'onBatchChange', 'tireInventoryId', 'boundGraphId']) assert.ok(source.includes(token));
console.log('Setup touch-target harness: PASS');
