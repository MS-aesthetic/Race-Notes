import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
const trackers = read('src/components/TrackersView.tsx');
const settings = read('src/components/SettingsView.tsx');
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
assert.match(setup, /className="min-w-0 p-2 sm:p-3 border-t border-outline-variant\/50 bg-surface-container-low"/, 'expanded Setup chrome is locked for rendered width proof');
assert.match(setup, /const LBL = 'text-xs .*leading-tight';/, 'Setup labels use readable compact tier');

assert.match(fourBar, /const barLength = bar\.measurements\[1\];/, 'FourBar puts Bar Length above the hole controls');
assert.match(fourBar, /const holeMeasurements = \[bar\.measurements\[0\], bar\.measurements\[2\]\];/, 'FourBar keeps Frame and Birdcage Hole controls together');
assert.equal((fourBar.match(/grid grid-cols-\[repeat\(auto-fit,minmax\(8\.75rem,1fr\)\)\] gap-2/g) ?? []).length, 2, 'FourBar fields adapt from two columns to one before controls clip');
assert.match(fourBar, /compact \? 'space-y-3'/, 'FourBar compact prop changes real layout density');
assert.equal((fourBar.match(/compact \? 'space-y-2 rounded-lg border border-outline-variant bg-surface-container(?:-low)? p-1'/g) ?? []).length, 2, 'compact FourBar sections use width-budgeted padding');
assert.match(fourBar, /compact \? 'rounded p-0\.5'/, 'compact fields remove decorative border chrome before shrinking controls');
assert.doesNotMatch(fourBar, /\[&_\[role=group\]\]:flex-wrap|\[&_\[role=group\]>button\]:basis-full/, 'FourBar compact steppers are not forced vertical');
assert.match(setup, /<FourBarQuickAdjust\s+setup=\{setupItem\}\s+compact/, 'Setup activates FourBar compact mode');
assert.match(fourBar, /min-h-11 min-w-11 shrink-0/, 'FourBar help target has 44px floor');
assert.match(fourBar, /NumberStepper/, 'FourBar retains shared NumberStepper behavior');
assert.match(stepper, /'min-h-11 min-w-11 shrink-0 select-none touch-none/, 'stepper direction targets retain 44px floors');
assert.match(stepper, /className="tap-target flex min-w-0 w-full/, 'stepper edit target retains shared 44px floor');

// Exact compact width budget, paired with the Chromium render probe below.
// At Standard, owner-approved hole controls fit two columns. Enlarged scales
// stack only when two columns cannot retain three 44px targets.
const TARGET_PX = 44;
const STEPPER_BORDER_PX = 2;
const STEPPER_CENTER_BORDER_PX = 2;
const STEPPER_OUTER_MIN_PX = TARGET_PX * 3 + STEPPER_BORDER_PX + STEPPER_CENTER_BORDER_PX;
const FIELD_CHROME_PX = 4; // p-0.5; compact field border intentionally removed
const GRID_ITEM_MIN_PX = 8.75 * 16;
const GRID_GAP_PX = 8;
const compactChrome = (viewportWidth: number) => {
  const mainPadding = viewportWidth >= 1024 ? 64 : viewportWidth >= 768 ? 48 : 32;
  const expandedPadding = viewportWidth >= 640 ? 24 : 16;
  return mainPadding + 2 + expandedPadding + 10 + 10;
};
assert.equal(GRID_ITEM_MIN_PX, STEPPER_OUTER_MIN_PX + FIELD_CHROME_PX, 'grid minimum equals three targets plus exact wrapper chrome');
const viewportWidths = [360, 390, 412, 1080];
const scales = [['standard', 1], ['large', 1.15], ['extra-large', 1.45]] as const;
for (const [scaleName, scale] of scales) {
  for (const viewportWidth of viewportWidths) {
    const gridWidth = viewportWidth / scale - compactChrome(viewportWidth);
    const columns = gridWidth >= GRID_ITEM_MIN_PX * 2 + GRID_GAP_PX ? 2 : 1;
    const itemWidth = (gridWidth - GRID_GAP_PX * (columns - 1)) / columns;
    const stepperWidth = itemWidth - FIELD_CHROME_PX;
    assert.ok(stepperWidth >= STEPPER_OUTER_MIN_PX, `${scaleName} ${viewportWidth}px: stepper width ${stepperWidth.toFixed(2)}px retains three 44px targets without clipping`);
    if (scale === 1) assert.equal(columns, 2, `standard ${viewportWidth}px keeps owner-approved two hole columns`);
  }
}
assert.ok(360 / 1.15 - compactChrome(360) < GRID_ITEM_MIN_PX * 2 + GRID_GAP_PX, 'Large 360px stacks before clipping');

type RenderProbe = {
  name: string;
  viewportWidth: number;
  scale: number;
  target?: number;
  fieldBorder?: number;
  forceTwoColumns?: boolean;
};

const chrome = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find(candidate => candidate && existsSync(candidate));
assert.ok(chrome, 'Chromium is available for rendered FourBar geometry proof');

const renderProbe = ({ name, viewportWidth, scale, target = TARGET_PX, fieldBorder = 0, forceTwoColumns = false }: RenderProbe) => {
  const probeDir = mkdtempSync(join(tmpdir(), 'race-notes-a4-render-'));
  const htmlPath = join(probeDir, 'probe.html');
  const profilePath = join(probeDir, 'profile');
  const gridTemplate = forceTwoColumns
    ? `repeat(2,minmax(${GRID_ITEM_MIN_PX}px,1fr))`
    : `repeat(auto-fit,minmax(${GRID_ITEM_MIN_PX}px,1fr))`;
  const mainPadding = viewportWidth >= 1024 ? 32 : viewportWidth >= 768 ? 24 : 16;
  const expandedPadding = viewportWidth >= 640 ? 12 : 8;
  const document = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}html,body{margin:0}.viewport{width:${viewportWidth}px}.viewport #applet-main-body{zoom:${scale};min-width:0}
main{padding:${mainPadding}px}.setup{border:1px solid}.expanded{border-top:1px solid;padding:${expandedPadding}px}
.rear,.bar{border:1px solid;padding:4px}.grid{display:grid;grid-template-columns:${gridTemplate};gap:8px}
.field{min-width:0;padding:2px;border:${fieldBorder}px solid}.group{display:flex;align-items:stretch;overflow:hidden;border:1px solid;width:100%}
.dir{min-width:${target}px;min-height:${target}px;flex-shrink:0;padding:0}.center{min-width:0;flex:1;border-left:1px solid;border-right:1px solid}
.edit{display:flex;min-width:${target}px;min-height:${target}px;width:100%;padding:0}
</style>
<div class="viewport"><div id="applet-main-body"><main><div class="setup"><div class="expanded"><section class="rear"><section class="bar"><div class="grid">
${[0, 1].map(index => `<div class="field"><div class="group" data-group="${index}"><button class="dir">-</button><div class="center"><button class="edit">0</button></div><button class="dir">+</button></div></div>`).join('')}
</div></section></section></div></div></main></div></div><pre id="result"></pre>
<script>
const rect=o=>{const r=o.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,width:r.width}};
const groups=[...document.querySelectorAll('.group')].map(group=>{const [decrease,center,increase]=group.children;const edit=center.firstElementChild;return {group:rect(group),decrease:rect(decrease),center:rect(center),edit:rect(edit),increase:rect(increase),groupClient:group.clientWidth,groupScroll:group.scrollWidth,centerClient:center.clientWidth,centerScroll:center.scrollWidth}});
const fields=[...document.querySelectorAll('.field')].map(rect);const grid=document.querySelector('.grid');const viewport=document.querySelector('.viewport');
document.querySelector('#result').textContent=JSON.stringify({name:${JSON.stringify(name)},viewportClient:viewport.clientWidth,gridClient:grid.clientWidth,gridScroll:grid.scrollWidth,fields,groups});
</script>`;
  try {
    writeFileSync(htmlPath, document);
    const dumped = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--user-data-dir=${profilePath}`, '--window-size=1200,900',
      '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(encoded, `${name}: rendered probe returned measurements`);
    return JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as {
      viewportClient: number;
      gridClient: number;
      gridScroll: number;
      fields: Array<{ left: number; right: number; top: number; width: number }>;
      groups: Array<{ group: { left: number; right: number; width: number }; decrease: { left: number; right: number; width: number }; center: { left: number; right: number; width: number }; edit: { left: number; right: number; width: number }; increase: { left: number; right: number; width: number }; groupClient: number; groupScroll: number; centerClient: number; centerScroll: number }>;
    };
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

const renderedLayoutPasses = (probe: RenderProbe) => {
  const result = renderProbe(probe);
  const tolerance = 0.6;
  const targetWidth = TARGET_PX * probe.scale;
  const noGridOverflow = result.gridScroll <= result.gridClient;
  const groupsPass = result.groups.every(({ group, decrease, center, edit, increase, groupClient, groupScroll, centerClient, centerScroll }) =>
    groupScroll <= groupClient && centerScroll <= centerClient
    && [decrease, edit, increase].every(rectangle => rectangle.width + tolerance >= targetWidth)
    && decrease.left + tolerance >= group.left && increase.right <= group.right + tolerance
    && decrease.right <= center.left + tolerance && center.right <= increase.left + tolerance
    && edit.left + tolerance >= center.left && edit.right <= center.right + tolerance);
  return { passes: noGridOverflow && groupsPass, result };
};

for (const [scaleName, scale] of scales) {
  for (const viewportWidth of viewportWidths) {
    const probe = { name: `${scaleName}-${viewportWidth}`, viewportWidth, scale };
    const { passes, result } = renderedLayoutPasses(probe);
    assert.equal(result.viewportClient, viewportWidth, `${probe.name}: Chromium rendered the required viewport width`);
    assert.ok(passes, `${probe.name}: rendered targets do not clip, overlap, or overflow`);
    const columns = Math.abs(result.fields[0].top - result.fields[1].top) < 1 ? 2 : 1;
    if (scale === 1) assert.equal(columns, 2, `${probe.name}: owner-approved normal-scale two-column layout renders`);
  }
}
for (const mutation of [
  { name: 'mutation-old-field-border', viewportWidth: 360, scale: 1, fieldBorder: 1 },
  { name: 'mutation-forced-large-columns', viewportWidth: 360, scale: 1.15, forceTwoColumns: true },
  { name: 'mutation-undersized-target', viewportWidth: 360, scale: 1, target: 43 },
]) {
  assert.equal(renderedLayoutPasses(mutation).passes, false, `${mutation.name}: rendered proof rejects clipping or undersized controls`);
}

const runSection = sliceBetween(raceWeekend, '{/* 1 ── Identity */}', '{/* 5 ── Tires & pressures */}');
assert.ok((runSection.match(/min-h-11/g) ?? []).length >= 4, 'Run freeform inputs have 44px floors');
assert.match(runSection, /className="w-full min-h-11 bg-surface border border-outline-variant\/50 text-on-surface text-sm font-mono p-2 rounded"/, 'diagnostic racing-data values use text-sm floor');
assert.match(raceWeekend, /rounded-xl border border-outline-variant bg-surface-container p-3 text-center space-y-2/, 'empty Race Day card density is complete');
assert.match(raceWeekend, /article key=\{weekend\.id\} className="rounded-xl border border-outline-variant bg-surface-container p-3"/, 'Race Day history card density is complete');
assert.match(raceWeekend, /flex items-start gap-2 p-3 border-b/, 'Race Day header density is complete');
assert.match(raceWeekend, /className="w-full flex items-center justify-between p-3 hover:bg-surface-container-high/, 'Run editor row density is complete');
assert.match(raceWeekend, /grid grid-cols-2 gap-3/, 'Race result grid density is complete');
assert.match(raceWeekend, /rounded-xl border border-primary\/40 bg-primary\/5 p-3 space-y-2/, 'Finish Race Day card density is complete');
assert.match(trackers, /<div className="flex flex-col gap-3">/, 'Trackers density tier-down is complete');
assert.match(settings, /<div className="space-y-3 pb-2">/, 'Settings delete-sheet density tier-down is complete');
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
