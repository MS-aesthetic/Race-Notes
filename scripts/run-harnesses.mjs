#!/usr/bin/env node
// Runs every scripts/*-harness.ts with tsx and prints a PASS/FAIL matrix.
// Usage: node scripts/run-harnesses.mjs [name-filter]
// Exit code: 1 if any harness fails that is not listed in KNOWN_FAILURES for this branch.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Known failures, verified 2026-10-02 under Linux. See context/knowledge/CURRENT_STATE.md §2.
const KNOWN_EVERYWHERE = ['muted-text-color', 'saved-flash', 'setup-touch-target'];
const KNOWN_SIMPLIFY = [
  'car-delete-undo', 'chunk5-setup', 'chunk5-tires', 'chunk7-quick-adjust',
  'chunk9-export-help', 'confirm-sheet', 'offline-indicator',
];

const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const simplified = spawnSync('git', ['merge-base', '--is-ancestor', 'af24f98', 'HEAD']).status === 0;
const known = new Set([...KNOWN_EVERYWHERE, ...(simplified ? KNOWN_SIMPLIFY : [])]);

const filter = process.argv[2] ?? '';
const files = readdirSync('scripts').filter((f) => f.endsWith('-harness.ts') && f.includes(filter)).sort();
const tsx = join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

let unexpected = 0;
let passed = 0;
console.log(`branch ${branch} (${simplified ? 'simplified' : 'full-featured'} direction)`);
for (const file of files) {
  const name = file.replace(/-harness\.ts$/, '');
  const run = spawnSync(tsx, [join('scripts', file)], { encoding: 'utf8', timeout: 120_000, shell: process.platform === 'win32' });
  const ok = run.status === 0;
  if (ok) passed += 1;
  const tag = ok ? (known.has(name) ? 'PASS (was known-fail: update list)' : 'PASS') : known.has(name) ? 'FAIL (known)' : 'FAIL';
  if (!ok && !known.has(name)) {
    unexpected += 1;
    const msg = `${run.stderr ?? ''}${run.stdout ?? ''}`.split('\n').find((l) => /Error|assert/i.test(l)) ?? '';
    console.log(`${tag.padEnd(36)} ${name}\n    ${msg.trim().slice(0, 200)}`);
  } else {
    console.log(`${tag.padEnd(36)} ${name}`);
  }
}
console.log(`\n${passed}/${files.length} pass, ${unexpected} unexpected failure(s)`);
process.exit(unexpected ? 1 : 0);
