import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const sliceBetween = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `section exists: ${start}`);
  return source.slice(from, to);
};

const setup = read('src/components/SetupView.tsx');
const fourBar = read('src/components/FourBarQuickAdjust.tsx');
const raceWeekend = read('src/components/RaceWeekendView.tsx');
const stepper = read('src/components/ui/NumberStepper.tsx');
const parentStepper = execFileSync('git', ['show', 'ace4da1:src/components/ui/NumberStepper.tsx'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const app = read('src/App.tsx');
const context = read('src/components/ContextStrip.tsx');
const css = read('src/index.css');

assert.match(css, /\.tap-target\s*\{[\s\S]*min-height: 2\.75rem;[\s\S]*min-width: 2\.75rem;/, 'shared tap targets have 44px floors');
assert.match(css, /\.tap-target-block\s*\{[\s\S]*min-height: 2\.75rem;/, 'block targets have 44px floors');
assert.match(css, /#global-bottom-nav-bar\s*\{[\s\S]*height: calc\(2\.75rem \+ env\(safe-area-inset-bottom, 0px\)\) !important;/, 'bottom nav has 44px floor plus safe area');
assert.match(css, /#applet-main-body :is\(\[class~="text-\[8px\]"\][\s\S]*font-size: 0\.75rem;/, 'tiny utility text is computed at text-xs floor');
assert.match(css, /\.app-main-scroll\s*\{\s*padding-bottom: calc\(4rem \+ env\(safe-area-inset-bottom, 0px\)\);/, 'A2 nav reservation remains intact');

assert.match(app, /px-3 md:px-4 py-2 w-full/, 'app header is density tiered down');
assert.match(app, /min-h-11 rounded-full text-on-surface-variant/, 'header guide target has 44px floor');
assert.match(app, /min-w-11 min-h-11 rounded-full/, 'header mode target has 44px floor');
assert.match(app, /h-11 px-2 md:px-4 sticky bottom-0/, 'bottom nav has compact presentation');
assert.doesNotMatch(app, /scale-105/, 'active nav no longer scales');
assert.doesNotMatch(context, /min-h-12|min-w-12/, 'ContextStrip uses 44px floors');
assert.ok((context.match(/min-h-11/g) ?? []).length >= 7, 'ContextStrip keeps every picker target at 44px');

assert.match(setup, /const INP = '.*text-sm.*min-h-11.*';/, 'shared Setup input has readable 44px floor');
assert.doesNotMatch(setup, /min-h-12|min-w-12/, 'Setup surfaces no longer retain 48px floor');
assert.match(setup, /min-w-0 p-2 sm:p-3 grid grid-cols-1 min-\[360px\]:grid-cols-2 gap-2/, 'corner form is phone-first two columns');
assert.match(setup, /min-w-0 grid grid-cols-1 min-\[360px\]:grid-cols-2 gap-1\.5 min-\[360px\]:gap-2/, 'four corner cards have compact two-column gutter');
assert.match(setup, /const LBL = 'text-xs .*leading-tight';/, 'Setup labels use readable compact tier');

assert.match(fourBar, /const barLength = bar\.measurements\[1\];/, 'FourBar puts Bar Length above the hole controls');
assert.match(fourBar, /const holeMeasurements = \[bar\.measurements\[0\], bar\.measurements\[2\]\];/, 'FourBar keeps Frame and Birdcage Hole controls together');
assert.match(fourBar, /<div className="grid grid-cols-2 gap-2">[\s\S]*holeMeasurements\.map/, 'FourBar renders the hole controls in two usable columns');
assert.match(fourBar, /compact \? 'space-y-3'/, 'FourBar compact prop changes real layout density');
assert.match(fourBar, /compact \? 'space-y-2 rounded-lg/, 'compact FourBar cards use compact spacing');
assert.doesNotMatch(fourBar, /\[&_\[role=group\]\]:flex-wrap|\[&_\[role=group\]>button\]:basis-full/, 'FourBar compact steppers are not forced vertical');
assert.match(setup, /<FourBarQuickAdjust\s+setup=\{setupItem\}\s+compact/, 'Setup activates FourBar compact mode');
assert.match(fourBar, /min-h-11 min-w-11 shrink-0/, 'FourBar help target has 44px floor');
assert.match(fourBar, /NumberStepper/, 'FourBar retains shared NumberStepper behavior');

const runSection = sliceBetween(raceWeekend, '{/* 1 ── Identity */}', '{/* 5 ── Tires & pressures */}');
assert.ok((runSection.match(/min-h-11/g) ?? []).length >= 4, 'Run freeform inputs have 44px floors');
const pressureSection = sliceBetween(raceWeekend, '{/* 5 ── Tires & pressures */}', '{/* 6 ── Changes made */}');
assert.match(pressureSection, /repeat\(auto-fit, minmax\(10\.5rem, 1fr\)\)/, 'A3 pressure grid stays actual-width');
assert.doesNotMatch(pressureSection, /grid-cols-2/, 'A3 pressure grid does not force columns');
assert.ok(pressureSection.includes('unit="psi"'), 'A3 pressure stepper props remain');

const stepperBehavior = sliceBetween(stepper, 'const REPEAT_DELAY_MS = 350;', '  const btnClass =');
const parentBehavior = sliceBetween(parentStepper, 'const REPEAT_DELAY_MS = 350;', '  const btnClass =');
assert.equal(stepperBehavior, parentBehavior, 'A3 leaves repeat, pointer, and commit semantics byte-identical');
for (const token of ['touch-none', 'onPointerUp={stopPress}', 'onPointerLeave={stopPress}', 'onPointerCancel={stopPress}', 'onClick={(e) => { if (e.detail === 0) applyStep(-1, step); }}']) {
  assert.ok(stepper.includes(token), `A3 stepper behavior remains: ${token}`);
}
assert.doesNotMatch(stepper, /onPointerMove|touch-action:\s*pan-y/, 'B1 scroll behavior remains untouched');

console.log('Setup touch-target harness: PASS');
