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
const auth = read('src/components/AuthView.tsx');
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

// Chunk A repair: source-lock every repaired state, then feed those production
// utility classes through a rendered target/text probe. This remains separate
// from the FourBar geometry model so its exact width proof stays unchanged.
const normalizeWhitespace = (source: string) => source.replace(/\s+/g, ' ').trim();
const lockProductionClass = (source: string, className: string, label: string) => {
  assert.ok(normalizeWhitespace(source).includes(normalizeWhitespace(className)), `${label}: production class is locked`);
  return normalizeWhitespace(className);
};
type ProductionValueSpan = { className: string; content: string };
const findExactProductionSpan = (source: string, markup: string): ProductionValueSpan | null => {
  const start = source.indexOf(markup);
  if (start < 0 || source.indexOf(markup, start + markup.length) >= 0) return null;
  const productionMarkup = source.slice(start, start + markup.length);
  const parsed = productionMarkup.match(/^<span className="([^"]+)">([\s\S]+)<\/span>$/);
  return parsed ? { className: parsed[1], content: parsed[2] } : null;
};
const lockExactProductionSpan = (source: string, markup: string, label: string) => {
  const span = findExactProductionSpan(source, markup);
  assert.ok(span, `${label}: exact production span is uniquely locked`);
  return span;
};

const weatherValueMarkup = '<span className="font-mono text-sm font-bold text-on-surface">{value}</span>';
const historyValueMarkup = '<span className="font-mono text-sm text-on-surface-variant">Best: {sx.bestLap || \'--\'} | Finish: {sx.finishPos || \'--\'}</span>';
const productionValueSpans = {
  weather: lockExactProductionSpan(raceWeekend, weatherValueMarkup, 'Race Weather value'),
  history: lockExactProductionSpan(raceWeekend, historyValueMarkup, 'Race Best and Finish value'),
};

assert.equal((auth.match(/min-h-11/g) ?? []).length, 10, 'all ten direct Auth controls have explicit 44px floors');
assert.ok((settings.match(/min-h-11/g) ?? []).length >= 10, 'Settings tabs, Privacy, Danger, accent, Reset, and delete controls retain 44px floors');
assert.ok((raceWeekend.match(/min-h-11/g) ?? []).length >= 36, 'Race Day compact controls retain complete 44px coverage');
assert.ok((raceWeekend.match(/min-w-11/g) ?? []).length >= 9, 'Race Day compact/icon controls retain 44px width floors');
for (const [name, source] of [['Auth', auth], ['Settings', settings], ['Race Day', raceWeekend]] as const) {
  assert.doesNotMatch(source, /text-\[(?:9|10|11)px\]/, `${name} uses explicit text-xs chrome floor tokens`);
}

const productionClasses = {
  authMode: lockProductionClass(auth, 'flex-1 min-h-11 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all', 'Auth mode toggle'),
  authField: lockProductionClass(auth, 'w-full min-h-11 bg-surface-container border border-outline-variant/50 rounded-md px-3 py-2.5 text-sm', 'Auth field'),
  authAction: lockProductionClass(auth, 'w-full min-h-11 py-2.5 px-4 bg-primary text-on-primary font-mono text-xs font-bold', 'Auth submit'),
  authBody: lockProductionClass(auth, 'text-sm text-on-surface-muted text-center leading-relaxed font-mono', 'Auth explanatory body'),
  settingsDanger: lockProductionClass(settings, 'w-full min-h-11 py-2 rounded-lg border border-red-500/50 text-red-400 font-mono text-xs', 'Settings Danger action'),
  settingsConfirm: lockProductionClass(settings, 'flex-1 min-h-11 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-mono text-xs', 'Settings Danger cancel'),
  settingsDangerConfirm: lockProductionClass(settings, 'flex-1 min-h-11 py-2 rounded-lg bg-red-500/20 border border-red-500 text-red-400 font-mono text-xs', 'Settings Danger confirm'),
  settingsPrivacy: lockProductionClass(settings, 'min-h-11 w-full rounded-lg border border-outline-variant px-3 font-mono text-xs', 'Settings Privacy target'),
  settingsDeleteAccount: lockProductionClass(settings, 'min-h-11 w-full rounded-lg border border-red-500 bg-red-500/10 px-3 font-mono text-xs', 'Settings Delete Account target'),
  settingsReset: lockProductionClass(settings, 'w-full min-h-11 py-2 border border-outline-variant text-on-surface-variant font-mono text-xs', 'Settings Reset'),
  settingsColor: lockProductionClass(settings, 'min-h-11 min-w-11 rounded border border-outline-variant cursor-pointer bg-transparent shrink-0', 'Settings color target'),
  settingsDeleteField: lockProductionClass(settings, 'min-h-12 w-full rounded-lg border border-outline-variant bg-surface px-3 font-mono text-base', 'Settings delete confirmation field'),
  settingsDeleteAction: lockProductionClass(settings, 'min-h-11 rounded-lg border border-red-500 bg-red-500/20 px-3 font-mono text-xs', 'Settings delete confirmation action'),
  settingsDeleteCancel: lockProductionClass(settings, 'min-h-11 rounded-lg border border-outline-variant px-3 font-mono text-xs', 'Settings delete cancel'),
  settingsBody: lockProductionClass(settings, 'text-sm text-on-surface-variant font-mono', 'Settings Privacy and Danger body'),
  raceClose: lockProductionClass(raceWeekend, 'absolute top-4 right-4 flex min-h-11 min-w-11 items-center justify-center', 'Race modal close'),
  raceModalField: lockProductionClass(raceWeekend, 'w-full min-h-11 bg-surface-container text-sm text-on-surface p-2.5', 'Race modal value field'),
  raceModalCancel: lockProductionClass(raceWeekend, 'min-h-11 px-3 py-2 border border-outline-variant hover:bg-surface-container-high', 'Race modal cancel'),
  raceModalAction: lockProductionClass(raceWeekend, 'min-h-11 px-4 py-2 bg-primary text-on-primary font-bold uppercase', 'Race modal submit'),
  raceChip: lockProductionClass(raceWeekend, 'min-h-11 py-2 px-1 rounded border font-mono text-xs font-bold uppercase', 'Race session chip'),
  raceTimeGrid: lockProductionClass(raceWeekend, 'grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-1', 'Race time grid'),
  raceTimeTarget: lockProductionClass(raceWeekend, 'min-h-11 py-2 px-1 rounded border font-mono text-xs font-bold uppercase transition-all text-center leading-tight', 'Race time target'),
  raceWeather: lockProductionClass(raceWeekend, 'flex min-h-11 items-center gap-1 text-xs font-mono font-bold uppercase px-2.5 py-1.5', 'Race new-session GPS'),
  raceMainWeather: lockProductionClass(raceWeekend, 'flex min-h-11 items-center gap-1.5 text-xs font-mono font-bold uppercase px-2.5 py-1.5', 'Race main GPS'),
  raceClear: lockProductionClass(raceWeekend, 'ml-auto flex min-h-11 min-w-11 items-center justify-center text-xs font-mono', 'Race weather clear'),
  raceZipField: lockProductionClass(raceWeekend, 'flex-1 min-h-11 bg-surface-container border border-outline-variant focus:border-primary rounded px-3 py-2 font-mono text-sm', 'Race ZIP field'),
  raceMainZipField: lockProductionClass(raceWeekend, 'flex-1 min-h-11 bg-surface border border-outline-variant focus:border-primary rounded px-3 py-2 font-mono text-sm', 'Race main ZIP field'),
  raceCompactAction: lockProductionClass(raceWeekend, 'min-h-11 min-w-11 bg-primary text-on-primary px-3 py-2 rounded font-mono text-xs', 'Race ZIP action'),
  raceMainAction: lockProductionClass(raceWeekend, 'min-h-11 min-w-11 bg-primary text-on-primary px-4 py-2 rounded font-mono text-xs', 'Race main ZIP action'),
  raceRefresh: lockProductionClass(raceWeekend, 'inline-flex min-h-11 min-w-11 items-center justify-center px-2 underline hover:text-primary', 'Race weather refresh'),
  raceImport: lockProductionClass(raceWeekend, 'flex min-h-11 items-center gap-1 text-xs font-mono font-bold uppercase px-2 py-1', 'Race tire import'),
  raceSelect: lockProductionClass(raceWeekend, 'w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm', 'Race tire value'),
  raceAddImage: lockProductionClass(raceWeekend, 'inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs uppercase', 'Race add image'),
  racePhotoDelete: lockProductionClass(raceWeekend, 'absolute top-1 right-1 bg-black/60 rounded-full min-w-11 min-h-11 flex', 'Race photo delete'),
  raceSetActive: lockProductionClass(raceWeekend, 'inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-1 rounded border border-primary/40', 'Race Set Active'),
  raceLoad: lockProductionClass(raceWeekend, 'flex min-h-11 items-center gap-1.5 px-3 py-1 bg-surface-bright', 'Race Load action'),
  raceWeatherValue: productionValueSpans.weather.className,
  raceHistoryValue: productionValueSpans.history.className,
};
assert.ok((settings.match(/<p className="text-sm text-on-surface-variant font-mono">/g) ?? []).length >= 2, 'Privacy and Danger descriptions both use body floor');
assert.match(settings, /Clear racing records but keep this account\?<\/p>/, 'Danger confirmation body remains present');
assert.match(raceWeekend, /Best: \{sx\.bestLap \|\| '--'\} \| Finish: \{sx\.finishPos \|\| '--'\}/, 'session history value remains source-locked');

type RepairMutation = 'target-height' | 'compact-width' | 'auth-body' | 'race-value' | 'time-columns';
type RepairProbe = {
  name: string;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  mutation?: RepairMutation;
  valueSpans?: typeof productionValueSpans;
};
const repairViewports = [[360, 800], [390, 844], [412, 915], [1080, 2118]] as const;
const repairScales = [['standard', 1], ['large', 1.15]] as const;

const renderRepairProbe = ({ name, viewportWidth, viewportHeight, scale, mutation, valueSpans = productionValueSpans }: RepairProbe) => {
  const classes = {
    ...productionClasses,
    raceWeatherValue: valueSpans.weather.className,
    raceHistoryValue: valueSpans.history.className,
  };
  if (mutation === 'target-height') classes.authMode = classes.authMode.replace('min-h-11', 'min-h-[43px]');
  if (mutation === 'compact-width') classes.raceClear = classes.raceClear.replace('min-w-11', 'min-w-[43px]');
  if (mutation === 'auth-body') classes.authBody = classes.authBody.replace('text-sm', 'text-xs');
  if (mutation === 'race-value') classes.raceWeatherValue = classes.raceWeatherValue.replace('text-sm', 'text-xs');
  if (mutation === 'time-columns') classes.raceTimeGrid = classes.raceTimeGrid.replace('grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))]', 'grid-cols-4');
  const target = (label: string, className: string, compact = false, tag = 'button') => {
    const attributes = `data-target data-name="${label}"${compact ? ' data-compact class="compact ' : ' class="'}${className}"`;
    if (tag === 'input') return `<input ${attributes} aria-label="${label}">`;
    if (tag === 'select') return `<select ${attributes} aria-label="${label}"><option>${label}</option></select>`;
    return `<${tag} ${attributes}>${label}</${tag}>`;
  };
  const text = (label: string, className: string, kind: 'body' | 'value' | 'chrome', content = label) =>
    `<p data-text data-${kind} data-name="${label}" class="${className}">${content}</p>`;
  const document = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;font-family:Arial,sans-serif}.viewport{width:${viewportWidth}px;height:${viewportHeight}px}.repair{zoom:${scale};min-width:0}main{padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:8px}.panel{min-width:0;border:1px solid #777;padding:8px;display:flex;flex-wrap:wrap;align-content:start;gap:8px}.w-full{width:100%}.flex-1{flex:1}.compact{width:min-content!important;flex:none!important;padding-left:0!important;padding-right:0!important}.font-mono{font-family:monospace}.time-grid{display:grid;width:100%;gap:4px}[class~="grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))]"]{grid-template-columns:repeat(auto-fit,minmax(88px,1fr))}[class~="grid-cols-4"]{grid-template-columns:repeat(4,minmax(0,1fr))}[class~="px-1"]{padding-left:4px;padding-right:4px}button,input,select{font:inherit;max-width:100%;padding-top:0;padding-bottom:0}[class~="min-h-11"]{min-height:44px}[class~="min-h-12"]{min-height:48px}[class~="min-w-11"]{min-width:44px}[class~="min-h-[43px]"]{min-height:43px}[class~="min-w-[43px]"]{min-width:43px}[class~="text-base"]{font-size:16px;line-height:24px}[class~="text-sm"]{font-size:14px;line-height:20px}[class~="text-xs"]{font-size:12px;line-height:16px}
</style><div class="viewport"><div class="repair"><main>
<section class="panel" data-state="auth-signed-out">${target('Sign In mode', classes.authMode)}${target('Register mode', classes.authMode)}${target('Display Name', classes.authField, false, 'input')}${target('Email', classes.authField, false, 'input')}${target('Password', classes.authField, false, 'input')}${target('Submit', classes.authAction)}${target('Google', classes.authAction)}${text('Offline account explanation', classes.authBody, 'body')}</section>
<section class="panel" data-state="auth-signed-in">${target('Account tab', classes.authMode)}${target('Team tab', classes.authMode)}${target('Sign Out', classes.authAction)}${text('Cloud storage explanation', classes.authBody, 'body')}</section>
<section class="panel" data-state="settings">${text('Privacy description', classes.settingsBody, 'body')}${target('Privacy Policy', classes.settingsPrivacy)}${text('Danger description', classes.settingsBody, 'body')}${target('Clear Racing Data', classes.settingsDanger)}${target('Danger Cancel', classes.settingsConfirm)}${target('Danger Confirm', classes.settingsDangerConfirm)}${target('Delete Account', classes.settingsDeleteAccount)}${target('Type DELETE', classes.settingsDeleteField, false, 'input')}${target('Delete sheet Cancel', classes.settingsDeleteCancel)}${target('Delete Forever', classes.settingsDeleteAction)}${target('Reset', classes.settingsReset)}${target('Color', classes.settingsColor, true, 'input')}</section>
<section class="panel" data-state="race-weekend-modal">${target('Close Race Day', classes.raceClose, true)}${target('Race Day Name', classes.raceModalField, false, 'input')}${target('Track', classes.raceModalField, false, 'input')}${target('Date', classes.raceModalField, false, 'input')}${target('Starting Setup', classes.raceModalField, false, 'select')}${target('Cancel Race Day', classes.raceModalCancel)}${target('Create Race Day', classes.raceModalAction)}</section>
<section class="panel" data-state="race-new-session">${target('Close Run', classes.raceClose, true)}${target('Run type', classes.raceChip)}${target('Condition', classes.raceChip)}<div class="time-grid ${classes.raceTimeGrid}">${['Current Time', 'Afternoon', 'Evening', 'Night'].map(label => target(label, classes.raceTimeTarget)).join('')}</div>${target('Surface notes', classes.raceZipField, false, 'input')}${target('GPS', classes.raceWeather)}${target('Zip', classes.raceWeather)}${target('Clear', classes.raceClear, true)}${target('ZIP field', classes.raceZipField, false, 'input')}${target('Get', classes.raceCompactAction, true)}${target('Cancel Run', classes.raceModalCancel)}${target('Start Run', classes.raceModalAction)}${text('Session weather', 'font-mono text-sm text-on-surface', 'value')}</section>
<section class="panel" data-state="race-weather">${target('Main GPS', classes.raceMainWeather)}${target('Main ZIP', classes.raceMainWeather)}${target('Main ZIP field', classes.raceMainZipField, false, 'input')}${target('Main Get', classes.raceMainAction, true)}${target('Refresh', classes.raceRefresh, true)}${target('Import tires', classes.raceImport)}${target('Tire select', classes.raceSelect, false, 'select')}${target('Add image', classes.raceAddImage, true)}${target('Delete photo', classes.racePhotoDelete, true)}${text('Weather value', classes.raceWeatherValue, 'value', valueSpans.weather.content)}${text('Temp label', 'font-mono text-xs', 'chrome')}</section>
<section class="panel" data-state="race-history">${target('Set Active', classes.raceSetActive, true)}${target('Load', classes.raceLoad)}${text('Best and Finish value', classes.raceHistoryValue, 'value', valueSpans.history.content)}${text('Run details', 'font-mono text-xs', 'chrome')}</section>
</main></div></div><pre id="result"></pre><script>
const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
const targets=[...document.querySelectorAll('[data-target]')].map(node=>({name:node.dataset.name,compact:node.hasAttribute('data-compact'),rect:rect(node),panel:rect(node.closest('.panel')),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight}));
const texts=[...document.querySelectorAll('[data-text]')].map(node=>({name:node.dataset.name,kind:node.hasAttribute('data-body')?'body':node.hasAttribute('data-value')?'value':'chrome',font:parseFloat(getComputedStyle(node).fontSize)}));
const panels=[...document.querySelectorAll('.panel')].map(panel=>({rect:rect(panel),children:[...panel.querySelectorAll('[data-target]')].map(rect)}));
const viewport=document.querySelector('.viewport');document.querySelector('#result').textContent=JSON.stringify({name:${JSON.stringify(name)},viewportClient:viewport.clientWidth,viewportScroll:viewport.scrollWidth,viewportRect:rect(viewport),targets,texts,panels});
</script>`;
  const probeDir = mkdtempSync(join(tmpdir(), 'race-notes-a4-repair-render-'));
  const htmlPath = join(probeDir, 'probe.html');
  const profilePath = join(probeDir, 'profile');
  try {
    writeFileSync(htmlPath, document);
    const dumped = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--user-data-dir=${profilePath}`, `--window-size=${Math.max(1200, viewportWidth)},${Math.max(900, viewportHeight)}`,
      '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(encoded, `${name}: repair probe returned measurements`);
    return JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as {
      viewportClient: number;
      viewportScroll: number;
      viewportRect: { left: number; right: number; top: number; bottom: number };
      targets: Array<{ name: string; compact: boolean; rect: { left: number; right: number; top: number; bottom: number; width: number; height: number }; panel: { left: number; right: number; top: number; bottom: number }; clientWidth: number; scrollWidth: number; clientHeight: number; scrollHeight: number }>;
      texts: Array<{ name: string; kind: 'body' | 'value' | 'chrome'; font: number }>;
      panels: Array<{ rect: { left: number; right: number; top: number; bottom: number }; children: Array<{ left: number; right: number; top: number; bottom: number }> }>;
    };
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

const repairLayoutPasses = (probe: RepairProbe) => {
  const result = renderRepairProbe(probe);
  const tolerance = 0.6;
  const targetFloor = TARGET_PX * probe.scale;
  const targetPasses = (item: (typeof result.targets)[number]) => item.rect.height + tolerance >= targetFloor
    && (!item.compact || item.rect.width + tolerance >= targetFloor)
    && item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1
    && item.rect.left + tolerance >= item.panel.left && item.rect.right <= item.panel.right + tolerance
    && item.rect.top + tolerance >= item.panel.top && item.rect.bottom <= item.panel.bottom + tolerance;
  const failedTargets = result.targets.filter(item => !targetPasses(item)).map(item => ({ name: item.name, rect: item.rect, compact: item.compact, clientWidth: item.clientWidth, scrollWidth: item.scrollWidth, clientHeight: item.clientHeight, scrollHeight: item.scrollHeight }));
  const targetsPass = failedTargets.length === 0;
  const textsPass = result.texts.every(item => item.font + tolerance >= (item.kind === 'chrome' ? 12 : 14));
  const noOverlap = result.panels.every(panel => panel.children.every((item, index) => panel.children.slice(index + 1).every(other =>
    item.right <= other.left + tolerance || other.right <= item.left + tolerance || item.bottom <= other.top + tolerance || other.bottom <= item.top + tolerance)));
  const panelsContained = result.panels.every(panel => panel.rect.left + tolerance >= result.viewportRect.left && panel.rect.right <= result.viewportRect.right + tolerance);
  const noOverflow = result.viewportScroll <= result.viewportClient;
  return { passes: targetsPass && textsPass && noOverlap && panelsContained && noOverflow, result, checks: { targetsPass, textsPass, noOverlap, panelsContained, noOverflow, failedTargets } };
};

for (const [scaleName, scale] of repairScales) {
  for (const [viewportWidth, viewportHeight] of repairViewports) {
    const probe = { name: `repair-${scaleName}-${viewportWidth}x${viewportHeight}`, viewportWidth, viewportHeight, scale };
    const { passes, result, checks } = repairLayoutPasses(probe);
    assert.equal(result.viewportClient, viewportWidth, `${probe.name}: Chromium rendered exact viewport width`);
    assert.ok(passes, `${probe.name}: Auth, Settings, weather, history, and session floors render without overlap or overflow: ${JSON.stringify(checks)}`);
  }
}
for (const mutation of [
  { name: 'repair-mutation-43px-height', mutation: 'target-height' },
  { name: 'repair-mutation-43px-compact-width', mutation: 'compact-width' },
  { name: 'repair-mutation-auth-body-xs', mutation: 'auth-body' },
  { name: 'repair-mutation-racing-value-xs', mutation: 'race-value' },
  { name: 'repair-mutation-forced-time-columns', mutation: 'time-columns' },
] as const) {
  const scale = mutation.mutation === 'time-columns' ? 1.15 : 1;
  assert.equal(repairLayoutPasses({ ...mutation, viewportWidth: 360, viewportHeight: 800, scale }).passes, false, `${mutation.name}: rendered repair proof rejects bad fixture`);
}

for (const mutation of [
  {
    name: 'production-weather-value-xs',
    key: 'weather',
    goodMarkup: weatherValueMarkup,
    badMarkup: weatherValueMarkup.replace('text-sm', 'text-xs'),
  },
  {
    name: 'production-history-value-xs',
    key: 'history',
    goodMarkup: historyValueMarkup,
    badMarkup: historyValueMarkup.replace('text-sm', 'text-xs'),
  },
] as const) {
  const mutatedSource = raceWeekend.replace(mutation.goodMarkup, mutation.badMarkup);
  assert.notEqual(mutatedSource, raceWeekend, `${mutation.name}: exact production markup is mutated in memory`);
  assert.equal(findExactProductionSpan(mutatedSource, mutation.goodMarkup), null, `${mutation.name}: original exact production lock rejects mutation`);
  const mutatedSpan = lockExactProductionSpan(mutatedSource, mutation.badMarkup, `${mutation.name} bad fixture`);
  const valueSpans = { ...productionValueSpans, [mutation.key]: mutatedSpan };
  assert.equal(
    repairLayoutPasses({ name: mutation.name, viewportWidth: 360, viewportHeight: 800, scale: 1, valueSpans }).passes,
    false,
    `${mutation.name}: rendered gate rejects class and content derived from mutated production span`,
  );
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
