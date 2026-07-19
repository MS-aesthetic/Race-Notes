import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { compile } from '@tailwindcss/node';
import NumberStepper from '../src/components/ui/NumberStepper';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const sliceBetween = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `section exists: ${start}`);
  return source.slice(from, to);
};

const setup = read('src/components/SetupView.tsx');
const garage = read('src/components/GarageView.tsx');
const tires = read('src/components/TiresSubView.tsx');
const fourBar = read('src/components/FourBarQuickAdjust.tsx');
const raceWeekend = read('src/components/RaceWeekendView.tsx');
const stepper = read('src/components/ui/NumberStepper.tsx');
const app = read('src/App.tsx');
const context = read('src/components/ContextStrip.tsx');
const trackers = read('src/components/TrackersView.tsx');
const settings = read('src/components/SettingsView.tsx');
const auth = read('src/components/AuthView.tsx');
const loads = read('src/components/SmasherLoadsView.tsx');
const quickAdjust = read('src/components/QuickAdjustPanel.tsx');
const todo = read('src/components/ToDoView.tsx');
const setupDiff = read('src/components/SetupDiffView.tsx');
const exportView = read('src/components/ExportView.tsx');
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
assert.match(setup, /min-w-0 p-2 sm:p-3 grid grid-cols-1 min-\[360px\]:grid-cols-2 gap-2 items-start/, 'corner form is phone-first two columns aligned at row start');
assert.match(setup, /min-w-0 grid grid-cols-1 min-\[360px\]:grid-cols-2 gap-1\.5 min-\[360px\]:gap-2/, 'four corner cards have compact two-column gutter');
assert.match(setup, /className="min-w-0 p-2 sm:p-3 border-t border-outline-variant\/50 bg-surface-container-low"/, 'expanded Setup chrome is locked for rendered width proof');
assert.match(setup, /const LBL = 'block min-h-4 truncate text-xs .*leading-tight';/, 'Setup labels reserve one compact line');
const tirePickerSection = sliceBetween(setup, '{/* Tire from Inventory picker */}', '{/* Bound Load Graph */}');
const tirePickerLabel = tirePickerSection.match(/<label className="text-\[10px\] uppercase font-mono font-semibold text-on-surface-variant flex-shrink-0">([^<]+)<\/label>/)?.[1];
const renderTirePickerLabel = (source: string): string => {
  const section = sliceBetween(source, '{/* Tire from Inventory picker */}', '{/* Bound Load Graph */}');
  const label = section.match(/<label className="text-\[10px\] uppercase font-mono font-semibold text-on-surface-variant flex-shrink-0">([^<]+)<\/label>/)?.[1];
  assert.ok(label, 'Setup tire picker production label exists');
  return renderToStaticMarkup(createElement('label', null, label));
};
assert.equal(tirePickerLabel, 'Tire', 'Setup tire picker uses exact short visible label');
assert.equal(renderTirePickerLabel(setup), '<label>Tire</label>', 'Setup tire picker production label renders exactly Tire');
assert.doesNotMatch(tirePickerSection, />Tire from Inventory<\/label>/, 'Setup tire picker omits old long visible label');
assert.match(tirePickerSection, /<option value="">-- Select from Inventory --<\/option>/, 'Setup tire picker placeholder stays unchanged');
const longTireLabelMutation = setup.replace('>Tire</label>', '>Tire from Inventory</label>');
assert.notEqual(longTireLabelMutation, setup, 'Setup tire-label restoration mutation changes production source');
assert.doesNotThrow(() => transformSync(longTireLabelMutation, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'Setup tire-label restoration mutation compiles');
assert.equal(renderTirePickerLabel(longTireLabelMutation), '<label>Tire from Inventory</label>', 'Setup tire-label restoration mutation renders old long label');
assert.notEqual(renderTirePickerLabel(longTireLabelMutation), '<label>Tire</label>', 'Setup tire-label restoration mutation fails short-label render gate');
const stackedCornerFieldClass = setup.match(/const STACKED_CORNER_FIELD_CLASS = '([^']+)';/)?.[1];
assert.equal(stackedCornerFieldClass, 'min-w-0 min-[360px]:col-span-2 min-[768px]:col-span-1', 'stacked corner fields span both phone columns until safe tablet width');
assert.equal((setup.match(/className=\{STACKED_CORNER_FIELD_CLASS\}/g) ?? []).length, 2, 'shared numeric field and pressure-note parent both receive responsive span repair');

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
assert.match(stepper, /'min-h-11 min-w-11 shrink-0 select-none touch-pan-y/, 'stepper direction targets retain 44px floors and vertical-scroll handoff');
assert.match(stepper, /className="tap-target flex min-w-0 w-full/, 'stepper edit target retains shared 44px floor');
assert.match(stepper, /layout\?: 'inline' \| 'stacked';/, 'NumberStepper exposes first-class inline and stacked layouts');
assert.match(stepper, /layout = 'inline'/, 'NumberStepper defaults to inline layout');
assert.match(stepper, /layout === 'stacked'/, 'NumberStepper owns stacked rendering');

const arbitraryStackingSelector = /\[&_\[role=group\]\]|\[&_\[role=group\]>button\]:basis-full/;
assert.doesNotMatch(setup, arbitraryStackingSelector, 'Setup removes arbitrary role-group stacking selectors');
assert.doesNotMatch(tires, arbitraryStackingSelector, 'Tires removes arbitrary role-group stacking selectors');
assert.equal((setup.match(/layout="stacked"/g) ?? []).length, 1, 'Setup numeric corner field binds stacked layout once at shared call site');
assert.equal((tires.match(/layout="stacked"/g) ?? []).length, 2, 'Tire Inventory pressure and backspacing bind stacked layout');
assert.match(tires, /ariaLabel="Backspacing"\s+layout="stacked"/, 'Tire Inventory backspacing uses stacked stepper');
assert.match(tires, /step=\{1\}\s+min=\{2\}\s+max=\{4\}\s+decimals=\{0\}\s+unit="in"/, 'Tire Inventory backspacing remains limited to 2, 3, or 4 inches');
assert.match(tires, /airPressure: formatStoredNumber\(value, SETUP_STEPS\.tirePress\)/, 'Tire Inventory pressure keeps canonical string formatting and blank handling');
assert.match(tires, /airPressure: draft\.airPressure\?\.trim\(\) \|\| ''/, 'Tire Inventory submit persistence remains string-based');
assert.match(tires, /wheelBackspacing: \(draft\.wheelBackspacing as '2' \| '3' \| '4'\) \|\| '2'/, 'Tire Inventory submit preserves allowed backspacing values and default');
assert.doesNotMatch(tires, /<select value=\{draft\.wheelBackspacing/, 'Tire Inventory old backspacing select is removed');
assert.doesNotMatch(tires, /<input value=\{draft\.airPressure/, 'Tire Inventory old pressure input is removed');

const stackedBindingsPass = (setupSource: string, tiresSource: string) =>
  (setupSource.match(/layout="stacked"/g) ?? []).length === 1
  && (tiresSource.match(/layout="stacked"/g) ?? []).length === 2
  && !arbitraryStackingSelector.test(setupSource)
  && !arbitraryStackingSelector.test(tiresSource);
assert.equal(stackedBindingsPass(setup, tires), true, 'production consumers use only first-class stacked bindings');

for (const mutation of [
  { name: 'Setup stacked binding removed', setupSource: setup.replace('        layout="stacked"\n', ''), tiresSource: tires },
  { name: 'Tire backspacing stacked binding removed', setupSource: setup, tiresSource: tires.replace('                    layout="stacked"\n', '') },
] as const) {
  assert.doesNotThrow(() => transformSync(mutation.setupSource, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), `${mutation.name}: Setup mutation compiles`);
  assert.doesNotThrow(() => transformSync(mutation.tiresSource, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), `${mutation.name}: Tires mutation compiles`);
  assert.equal(stackedBindingsPass(mutation.setupSource, mutation.tiresSource), false, `${mutation.name}: compile-real mutation fails stacked binding gate`);
}

const stepperProps = {
  value: 12.5,
  onChange: (_value: number | '') => undefined,
  step: 0.5,
  min: 0,
  decimals: 1,
  unit: 'psi',
  ariaLabel: 'Pressure',
} as const;
const defaultStepperMarkup = renderToStaticMarkup(createElement(NumberStepper, stepperProps));
const inlineStepperMarkup = renderToStaticMarkup(createElement(NumberStepper, { ...stepperProps, layout: 'inline' }));
const stackedStepperMarkup = renderToStaticMarkup(createElement(NumberStepper, { ...stepperProps, layout: 'stacked' }));
assert.equal(defaultStepperMarkup, inlineStepperMarkup, 'default and explicit inline render byte-identical markup');
assert.ok(defaultStepperMarkup.indexOf('aria-label="Decrease Pressure"') < defaultStepperMarkup.indexOf('aria-label="Edit Pressure"'), 'inline DOM remains decrease, value, increase');
assert.ok(defaultStepperMarkup.indexOf('aria-label="Edit Pressure"') < defaultStepperMarkup.indexOf('aria-label="Increase Pressure"'), 'inline value remains between direction buttons');
assert.ok(stackedStepperMarkup.indexOf('aria-label="Edit Pressure"') < stackedStepperMarkup.indexOf('aria-label="Decrease Pressure"'), 'stacked DOM renders value before button row');
assert.ok(stackedStepperMarkup.indexOf('aria-label="Decrease Pressure"') < stackedStepperMarkup.indexOf('aria-label="Increase Pressure"'), 'stacked button row remains minus then plus');

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

const renderStackedStepperProbe = () => {
  const probeDir = mkdtempSync(join(tmpdir(), 'race-notes-c25-stepper-render-'));
  const htmlPath = join(probeDir, 'probe.html');
  const profilePath = join(probeDir, 'profile');
  const document = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}html,body{margin:0}.probe{width:220px}.grid{display:grid}.flex{display:flex}.w-full{width:100%}.min-w-0{min-width:0}.min-w-11{min-width:44px}.min-h-11,.tap-target{min-height:44px}.min-h-12{min-height:48px}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.items-center{align-items:center}.items-stretch{align-items:stretch}.justify-center{justify-content:center}.flex-1{flex:1}.border{border:1px solid}.border-b{border-bottom:1px solid}.border-x{border-left:1px solid;border-right:1px solid}.divide-x>button+button{border-left:1px solid}button,input{font:16px monospace;padding:0}
</style><div class="probe">${stackedStepperMarkup}</div><pre id="result"></pre><script>
const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
const group=document.querySelector('[role=group]');const value=group.children[0];const row=group.children[1];const buttons=[...row.querySelectorAll(':scope > button')];
document.querySelector('#result').textContent=JSON.stringify({groupChildren:group.children.length,rowChildren:row.children.length,group:rect(group),value:rect(value),row:rect(row),buttons:buttons.map(rect),text:value.textContent});
</script>`;
  try {
    writeFileSync(htmlPath, document);
    const dumped = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--user-data-dir=${profilePath}`, '--window-size=1200,900',
      '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(encoded, 'stacked NumberStepper probe returned real DOM measurements');
    return JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as {
      groupChildren: number;
      rowChildren: number;
      group: { width: number; height: number };
      value: { top: number; bottom: number; width: number; height: number };
      row: { top: number; bottom: number; width: number; height: number };
      buttons: Array<{ left: number; right: number; top: number; bottom: number; width: number; height: number }>;
      text: string;
    };
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

const stackedRender = renderStackedStepperProbe();
assert.equal(stackedRender.groupChildren, 2, 'stacked real DOM has value region then button row');
assert.equal(stackedRender.rowChildren, 2, 'stacked real DOM button row has exactly minus and plus');
assert.ok(stackedRender.value.bottom <= stackedRender.row.top + 0.5, 'stacked value renders fully above button row');
assert.ok(stackedRender.value.height >= TARGET_PX && stackedRender.buttons.every(button => button.height >= TARGET_PX), 'stacked value and both buttons render at least 44px tall');
assert.ok(Math.abs(stackedRender.buttons[0].width - stackedRender.buttons[1].width) <= 0.5, 'stacked minus and plus render equal width');
assert.ok(Math.abs(stackedRender.row.width - stackedRender.value.width) <= 0.5, 'stacked value and button row each use full available width');
assert.match(stackedRender.text, /12\.5\s*psi/, 'stacked real value region keeps formatted value and unit');

const lockC25ProductionClass = (source: string, className: string, label: string) => {
  assert.ok(source.includes(className), `${label}: exact production class is locked`);
  return className;
};
const c25Classes = {
  main: lockC25ProductionClass(app, 'app-main-scroll flex-grow p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar', 'App main'),
  setupCard: lockC25ProductionClass(setup, 'bg-surface-container border rounded-lg overflow-hidden transition-all duration-200', 'Setup accordion card'),
  expanded: lockC25ProductionClass(setup, 'min-w-0 p-2 sm:p-3 border-t border-outline-variant/50 bg-surface-container-low', 'Setup expanded body'),
  cornerGrid: lockC25ProductionClass(setup, 'min-w-0 grid grid-cols-1 min-[360px]:grid-cols-2 gap-1.5 min-[360px]:gap-2', 'paired corner grid'),
  cornerCard: lockC25ProductionClass(setup, 'min-w-0 bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden', 'corner card'),
  cornerHeader: lockC25ProductionClass(setup, 'min-w-0 border-b border-outline-variant px-1.5 sm:px-4 py-2 flex flex-wrap items-center gap-1 sm:gap-2 bg-surface-container-low', 'corner header'),
  innerGrid: lockC25ProductionClass(setup, 'min-w-0 p-2 sm:p-3 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 items-start', 'corner field grid'),
  label: lockC25ProductionClass(setup, 'block min-h-4 truncate text-xs uppercase font-mono font-semibold text-on-surface-variant mb-1 leading-tight', 'corner label'),
  note: lockC25ProductionClass(setup, 'mt-1 font-mono text-xs text-on-surface-variant', 'corner note'),
};

const classCandidates = (...values: string[]) => {
  const candidates = new Set<string>();
  for (const value of values) {
    const markupClasses = [...value.matchAll(/class="([^"]+)"/g)].map(match => match[1]);
    for (const classList of markupClasses.length ? markupClasses : [value]) {
      for (const candidate of classList.split(/\s+/).filter(Boolean)) candidates.add(candidate);
    }
  }
  return [...candidates];
};
const c25Compiler = await compile(css, { base: root, onDependency: () => undefined });
const compiledC25Css = c25Compiler.build(classCandidates(
  ...Object.values(c25Classes),
  stackedCornerFieldClass!,
  stackedStepperMarkup,
  'w-full border border-outline-variant',
)).replace(/@import url\([^;]+;\s*/g, '');
assert.ok(compiledC25Css.includes('.min-\\[360px\\]\\:col-span-2'), 'compiled production CSS contains phone span utility');
assert.ok(compiledC25Css.includes('.min-\\[768px\\]\\:col-span-1'), 'compiled production CSS contains safe-width return utility');

type C25IntegrationProbe = {
  name: string;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  numericClass: string;
};
type C25Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type C25IntegrationResult = {
  innerWidth: number;
  viewportClient: number;
  viewportScroll: number;
  documentScroll: number;
  cards: Array<{ name: string; rect: C25Rect }>;
  groups: Array<{
    card: string;
    field: C25Rect;
    inner: C25Rect;
    group: C25Rect;
    value: C25Rect;
    row: C25Rect & { clientWidth: number; scrollWidth: number };
    groupClientWidth: number;
    groupScrollWidth: number;
    buttons: Array<C25Rect>;
  }>;
};

const renderC25IntegrationProbe = ({ name, viewportWidth, viewportHeight, scale, numericClass }: C25IntegrationProbe): C25IntegrationResult => {
  const probeDir = mkdtempSync(join(tmpdir(), 'race-notes-c25-integration-'));
  const htmlPath = join(probeDir, 'probe.html');
  const profilePath = join(probeDir, 'profile');
  const card = (cardName: string, note = '') => `<section data-card="${cardName}" class="${c25Classes.cornerCard}">
    <div class="${c25Classes.cornerHeader}"><span>${cardName} Corner</span></div>
    <div data-inner class="${c25Classes.innerGrid}">
      <div data-numeric class="${numericClass}"><label class="${c25Classes.label}">Scale Weight</label>${stackedStepperMarkup}${note ? `<p class="${c25Classes.note}">${note}</p>` : ''}</div>
    </div>
  </section>`;
  const document = `<!doctype html><html style="--ui-zoom:${scale}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${compiledC25Css}</style></head><body>
  <div class="viewport" style="width:${viewportWidth}px;min-width:0">
    <div id="applet-main-body" class="w-full">
      <main class="${c25Classes.main}">
        <div class="${c25Classes.setupCard} border-outline-variant/60">
          <div class="${c25Classes.expanded}">
            <div data-corner-grid class="${c25Classes.cornerGrid}">
              ${card('LF', 'Pressure source note')}${card('RF')}${card('LR', 'Legacy measurement note')}${card('RR')}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div><pre id="result"></pre><script>
  const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const cards=[...document.querySelectorAll('[data-card]')].map(card=>({name:card.dataset.card,rect:rect(card)}));
  const groups=[...document.querySelectorAll('[data-numeric]')].map(field=>{const group=field.querySelector('[role=group]');const value=group.children[0];const row=group.children[1];const inner=field.closest('[data-inner]');return {card:field.closest('[data-card]').dataset.card,field:rect(field),inner:rect(inner),group:rect(group),value:rect(value),row:{...rect(row),clientWidth:row.clientWidth,scrollWidth:row.scrollWidth},groupClientWidth:group.clientWidth,groupScrollWidth:group.scrollWidth,buttons:[...row.querySelectorAll(':scope > button')].map(rect)}});
  const viewport=document.querySelector('.viewport');document.querySelector('#result').textContent=JSON.stringify({innerWidth:window.innerWidth,viewportClient:viewport.clientWidth,viewportScroll:viewport.scrollWidth,documentScroll:document.documentElement.scrollWidth,cards,groups});
  </script></body></html>`;
  try {
    writeFileSync(htmlPath, document);
    const dumped = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
      `--user-data-dir=${profilePath}`, `--window-size=${viewportWidth},${viewportHeight}`,
      '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(encoded, `${name}: compiled-CSS integration probe returned measurements`);
    return JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as C25IntegrationResult;
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

const c25IntegrationPasses = (probe: C25IntegrationProbe, expectFullSpan: boolean) => {
  const result = renderC25IntegrationProbe(probe);
  const tolerance = 0.75;
  const pairAligned = ([left, right]: [number, number]) =>
    Math.abs(result.cards[left].rect.top - result.cards[right].rect.top) <= tolerance
    && Math.abs(result.cards[left].rect.bottom - result.cards[right].rect.bottom) <= tolerance
    && Math.abs(result.cards[left].rect.width - result.cards[right].rect.width) <= tolerance;
  const cardsAligned = pairAligned([0, 1]) && pairAligned([2, 3]);
  const twoCornerColumns = result.cards[0].rect.right <= result.cards[1].rect.left + tolerance
    && result.cards[2].rect.right <= result.cards[3].rect.left + tolerance;
  const groupGeometry = result.groups.every(item => {
    const [minus, plus] = item.buttons;
    const noOverlap = minus.right <= plus.left + tolerance;
    const contained = minus.left + tolerance >= item.row.left && plus.right <= item.row.right + tolerance
      && minus.left + tolerance >= item.group.left && plus.right <= item.group.right + tolerance;
    const targets = minus.width + tolerance >= TARGET_PX && plus.width + tolerance >= TARGET_PX
      && minus.height + tolerance >= TARGET_PX && plus.height + tolerance >= TARGET_PX;
    const equal = Math.abs(minus.width - plus.width) <= tolerance;
    const unclipped = item.row.scrollWidth <= item.row.clientWidth + 1 && item.groupScrollWidth <= item.groupClientWidth + 1;
    const valueAbove = item.value.bottom <= item.row.top + tolerance;
    const fullSpan = item.field.width >= item.inner.width * 0.75;
    const singleColumn = item.field.width <= item.inner.width * 0.65;
    return item.row.width + tolerance >= TARGET_PX * 2 && noOverlap && contained && targets && equal && unclipped && valueAbove
      && (expectFullSpan ? fullSpan : singleColumn);
  });
  const noPageOverflow = result.viewportScroll <= result.viewportClient && result.documentScroll <= result.innerWidth;
  const exactLayoutWidth = result.viewportClient === probe.viewportWidth;
  const responsiveState = expectFullSpan
    ? result.innerWidth >= 360 && result.innerWidth < 768
    : result.innerWidth >= 768;
  return { passes: exactLayoutWidth && responsiveState && cardsAligned && twoCornerColumns && groupGeometry && noPageOverflow, result, checks: { exactLayoutWidth, responsiveState, cardsAligned, twoCornerColumns, groupGeometry, noPageOverflow } };
};

for (const [scaleName, scale] of [['default', 1], ['large', 1.15]] as const) {
  for (const [viewportWidth, viewportHeight] of [[360, 800], [390, 844], [412, 915]] as const) {
    const probe = { name: `c25-${scaleName}-${viewportWidth}x${viewportHeight}`, viewportWidth, viewportHeight, scale, numericClass: stackedCornerFieldClass! };
    const integration = c25IntegrationPasses(probe, true);
    assert.ok(integration.passes, `${probe.name}: production-derived compiled layout keeps paired cards and every stacked control aligned, >=88px, contained, and overflow-free: ${JSON.stringify({ checks: integration.checks, groups: integration.result.groups })}`);
  }
}
for (const [scaleName, scale] of [['default', 1], ['large', 1.15]] as const) {
  const probe = { name: `c25-safe-return-${scaleName}`, viewportWidth: 800, viewportHeight: 1024, scale, numericClass: stackedCornerFieldClass! };
  const integration = c25IntegrationPasses(probe, false);
  assert.ok(integration.passes, `${probe.name}: stacked fields return to one inner column only with two contained 44px buttons: ${JSON.stringify({ checks: integration.checks, groups: integration.result.groups })}`);
}

const spanRepairDeclaration = `const STACKED_CORNER_FIELD_CLASS = '${stackedCornerFieldClass}';`;
const spanRemovalMutation = setup.replace(spanRepairDeclaration, "const STACKED_CORNER_FIELD_CLASS = 'min-w-0';");
assert.notEqual(spanRemovalMutation, setup, 'C2.5 responsive span mutation changes production source');
assert.doesNotThrow(() => transformSync(spanRemovalMutation, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'C2.5 responsive span removal remains compile-real TSX');
const mutatedCornerFieldClass = spanRemovalMutation.match(/const STACKED_CORNER_FIELD_CLASS = '([^']+)';/)?.[1];
assert.equal(mutatedCornerFieldClass, 'min-w-0', 'C2.5 mutation removes only responsive span repair');
const spanRemovalRender = c25IntegrationPasses({ name: 'c25-span-removal-mutation', viewportWidth: 360, viewportHeight: 800, scale: 1, numericClass: mutatedCornerFieldClass! }, false);
assert.equal(spanRemovalRender.passes, false, 'C2.5 compiled real-DOM gate kills responsive span removal mutation');
assert.equal(spanRemovalRender.checks.groupGeometry, false, 'C2.5 span removal recreates detected overlap or clipping instead of only failing a source lock');

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

// Final QA Repair 2: compile the real shell CSS with exact production control
// classes, then render every observed/latent native-control failure at both
// supported scales. Hidden input glyphs remain compact; their effective label
// or semantic row owns the measured target.
let globalFloorAssertionCount = 0;
const killedGlobalFloorMutations: string[] = [];
const globalFloorOk: (value: unknown, message: string) => asserts value = (value, message) => {
  globalFloorAssertionCount += 1;
  assert.ok(value, message);
};
const globalFloorEqual = (actual: unknown, expected: unknown, message: string): void => {
  globalFloorAssertionCount += 1;
  assert.equal(actual, expected, message);
};
const lockConstClass = (source: string, name: string, label: string): string => {
  const value = source.match(new RegExp(`const ${name}\\s*=\\s*'([^']+)'`))?.[1];
  globalFloorOk(value, `${label}: production class constant exists`);
  return value!;
};

const GLOBAL_FLOOR_START = '/* Global native-control floor.';
const GLOBAL_FLOOR_END = '/* Minimum 44px hit area for any tappable control';
const globalFloorSection = sliceBetween(css, GLOBAL_FLOOR_START, GLOBAL_FLOOR_END);
globalFloorOk(/input:not\(\[type="hidden"\]\):not\(\[type="file"\]\):not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/.test(globalFloorSection), 'global native field selector excludes hidden/file/checkbox/radio glyphs');
globalFloorOk((globalFloorSection.match(/min-height: 2\.75rem;/g) ?? []).length === 1, 'global native controls share one exact 2.75rem height floor');
globalFloorOk((globalFloorSection.match(/min-width: 2\.75rem;/g) ?? []).length === 1, 'buttons and input-backed labels share one exact 2.75rem width floor');
globalFloorOk((globalFloorSection.match(/label:has\(input:is\(\[type="file"\], \[type="checkbox"\], \[type="radio"\]\)\)/g) ?? []).length === 3, 'input-backed file/checkbox/radio labels receive size and layout coverage');

const shellClasses = {
  setupNewName: lockProductionClass(setup, 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm px-3 py-2 outline-none rounded', 'Setup new-name input'),
  setupUse: lockProductionClass(setup, 'min-w-0 px-3 py-1 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all shadow', 'Setup Use Setup'),
  setupClone: lockProductionClass(setup, 'p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded', 'Setup Clone'),
  setupCompare: lockProductionClass(setup, 'p-1.5 rounded', 'Setup Compare'),
  setupFileLabel: lockProductionClass(setup, 'text-[10px] uppercase font-mono font-bold transition-colors', 'Setup Add File label'),
  setupAttachmentDelete: lockProductionClass(setup, 'absolute top-1 right-1 bg-black/70 rounded-full w-5 h-5 flex items-center justify-center text-white hover:bg-black/90', 'Setup attachment delete'),
  setupDiffSelect: lockProductionClass(setupDiff, 'w-full bg-surface-container text-xs text-on-surface p-2 border border-outline-variant rounded font-mono', 'Setup Compare select'),
  loadsCompare: lockProductionClass(loads, 'h-9 px-3 font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5 border', 'Loads Compare'),
  loadsNew: lockProductionClass(loads, 'h-9 px-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5 flex-shrink-0 hover:opacity-90', 'Loads New Session'),
  loadsSession: lockProductionClass(loads, 'flex-shrink-0 px-3 py-1.5 rounded border font-mono text-[10px] uppercase font-bold transition-all', 'Loads session tab'),
  loadsCsv: lockProductionClass(loads, 'h-7 px-2.5 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[9px] uppercase font-bold rounded transition-all flex items-center gap-1', 'Loads comparison CSV'),
  loadsDeleteSession: lockProductionClass(loads, 'p-1 text-on-surface-muted hover:text-error transition-colors', 'Loads delete session'),
  loadsExport: lockProductionClass(loads, 'flex-1 h-9 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[10px] uppercase font-bold rounded transition-all flex items-center justify-center gap-1.5', 'Loads export action'),
  loadsAddPoint: lockProductionClass(loads, 'h-[34px] px-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all flex items-center gap-1 flex-shrink-0', 'Loads Add point'),
  loadsDeletePoint: lockProductionClass(loads, 'text-on-surface-muted hover:text-error transition-colors', 'Loads delete point'),
  loadsFileLabel: lockProductionClass(loads, 'flex items-center gap-1.5 cursor-pointer h-8 px-3 border border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary font-mono text-[10px] uppercase font-bold rounded transition-colors', 'Loads Add Photo label'),
  loadsPhotoDelete: lockProductionClass(loads, 'absolute top-1 right-1 bg-black/70 hover:bg-error text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity', 'Loads photo delete'),
  loadsModalClose: lockProductionClass(loads, 'absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors', 'Loads modal close'),
  tiresAdd: lockProductionClass(tires, 'h-9 px-3 rounded bg-primary font-mono text-xs font-bold uppercase text-on-primary', 'Tires Add action'),
  tiresClose: lockProductionClass(tires, 'absolute right-3 top-3 text-on-surface-variant', 'Tires modal close'),
  quickInput: lockConstClass(quickAdjust, 'inputClass', 'Quick Adjust input/select'),
  quickAction: lockConstClass(quickAdjust, 'actionClass', 'Quick Adjust action'),
  checklistRow: lockProductionClass(todo, 'relative flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3', 'Checklist effective checkbox row'),
  checklistGlyph: lockProductionClass(todo, 'mt-0.5 h-5 w-5 shrink-0 accent-primary', 'Checklist checkbox glyph'),
  maintenanceFilter: lockProductionClass(trackers, 'w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-2 rounded-lg outline-none appearance-none cursor-pointer pr-7', 'Accounting filter'),
  maintenanceFilterClear: lockProductionClass(trackers, 'w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:text-primary shrink-0', 'Accounting filter clear'),
  maintenanceLog: lockProductionClass(trackers, 'shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] uppercase font-bold hover:bg-primary/20 transition-colors', 'Maintenance Log action'),
  maintenanceDelete: lockProductionClass(trackers, 'material-symbols-outlined text-[16px] text-on-surface-muted hover:text-error shrink-0', 'Maintenance delete action'),
  maintenanceOpen: lockProductionClass(trackers, 'flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary font-mono text-[11px] uppercase font-bold transition-colors', 'Maintenance Add action'),
  maintenanceModalClose: lockProductionClass(trackers, 'material-symbols-outlined text-on-surface-variant text-[22px]', 'Maintenance modal close'),
  maintenanceField: lockProductionClass(trackers, 'w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none', 'Maintenance input'),
  maintenanceTextarea: lockProductionClass(trackers, 'w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none resize-none', 'Maintenance textarea'),
  maintenanceSubmit: lockProductionClass(trackers, 'w-full py-3 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-xl tracking-wider active:opacity-80', 'Maintenance submit'),
  exportSwitch: lockProductionClass(exportView, 'relative inline-flex items-center cursor-pointer', 'Export input-backed switch'),
  exportSelect: lockConstClass(exportView, 'selectClass', 'Export select'),
  exportAction: lockConstClass(exportView, 'actionBtnClass', 'Export action'),
  headerGuide: lockProductionClass(app, 'flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors', 'header App Guide'),
  contextPicker: lockProductionClass(context, 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20', 'ContextStrip picker'),
  fourBarHelp: lockProductionClass(fourBar, 'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary', 'Four Bar help'),
  bottomNav: lockProductionClass(app, 'bg-surface-container border-t border-outline-variant z-40 flex justify-around items-center h-11 px-2 md:px-4 sticky bottom-0 w-full flex-shrink-0', 'bottom navigation'),
  bottomNavButton: lockProductionClass(app, 'flex flex-1 min-w-0 flex-col items-center justify-center h-full transition-all cursor-pointer', 'bottom navigation button'),
};

const shellTarget = (name: string, tag: 'button' | 'input' | 'select' | 'textarea', className: string, type = 'text', content = name) => {
  const width = tag === 'button' ? ' data-requires-width' : '';
  const attrs = `data-target data-name="${name}" data-kind="${tag}"${width} class="${className}"`;
  if (tag === 'input') return `<input ${attrs} type="${type}" value="${name}">`;
  if (tag === 'select') return `<select ${attrs}><option>${name}</option></select>`;
  if (tag === 'textarea') return `<textarea ${attrs}>${name}</textarea>`;
  return `<button ${attrs}>${content}</button>`;
};
const positionedShellButton = (name: string, className: string) => `<div class="relative h-16 w-16 shrink-0">${shellTarget(name, 'button', `${className} attachment-delete`, 'text', '×')}</div>`;
const fileTarget = (name: string, className: string) => `<label data-target data-name="${name}" data-kind="label" data-requires-width class="${className}">${name}<input data-backed-input type="file" class="hidden"></label>`;
const checkboxLabelTarget = (name: string, className: string, type: 'checkbox' | 'radio' = 'checkbox') => `<label data-target data-name="${name}" data-kind="label" data-requires-width class="${className}"><input data-backed-input type="${type}" class="sr-only peer"><span>${name}</span></label>`;
const checklistTarget = `<div data-target data-name="Checklist checkbox row" data-kind="effective" data-requires-width role="button" class="${shellClasses.checklistRow} border-outline-variant bg-surface-container"><input data-backed-input type="checkbox" class="${shellClasses.checklistGlyph}"><span>Pack tools</span></div>`;
const shellPanel = (name: string, content: string) => `<section data-panel data-name="${name}" class="shell-panel">${content}</section>`;

const shellMarkup = [
  shellPanel('Setup', [
    shellTarget('Setup new-name input', 'input', shellClasses.setupNewName),
    shellTarget('Use Setup', 'button', shellClasses.setupUse),
    shellTarget('Clone setup', 'button', shellClasses.setupClone, 'text', '<span class="material-symbols-outlined">content_copy</span>'),
    shellTarget('Compare setup', 'button', `${shellClasses.setupCompare} text-on-surface-variant`, 'text', '<span class="material-symbols-outlined">compare_arrows</span>'),
    fileTarget('Setup Add File', shellClasses.setupFileLabel),
    positionedShellButton('Setup attachment delete', shellClasses.setupAttachmentDelete),
    shellTarget('Setup Compare A', 'select', shellClasses.setupDiffSelect),
    shellTarget('Setup Compare B', 'select', shellClasses.setupDiffSelect),
  ].join('')),
  shellPanel('Loads', [
    shellTarget('Loads Compare', 'button', shellClasses.loadsCompare),
    shellTarget('Loads New Session', 'button', shellClasses.loadsNew),
    shellTarget('Loads session tab', 'button', shellClasses.loadsSession),
    shellTarget('Loads CSV', 'button', shellClasses.loadsCsv, 'text', 'CSV'),
    shellTarget('Loads delete session', 'button', shellClasses.loadsDeleteSession, 'text', '<span class="material-symbols-outlined">delete</span>'),
    shellTarget('Loads Export CSV', 'button', shellClasses.loadsExport, 'text', 'Export CSV'),
    shellTarget('Loads Add point', 'button', shellClasses.loadsAddPoint),
    shellTarget('Loads delete point', 'button', shellClasses.loadsDeletePoint, 'text', '<span class="material-symbols-outlined">close</span>'),
    fileTarget('Loads Add Photo', shellClasses.loadsFileLabel),
    positionedShellButton('Loads photo delete', shellClasses.loadsPhotoDelete),
    positionedShellButton('Loads modal close', shellClasses.loadsModalClose),
  ].join('')),
  shellPanel('Tires and Quick Adjust', [
    shellTarget('Tires Add', 'button', shellClasses.tiresAdd),
    positionedShellButton('Tires modal close', shellClasses.tiresClose),
    shellTarget('Quick Adjust spring', 'input', shellClasses.quickInput),
    shellTarget('Quick Adjust load session', 'select', shellClasses.quickInput),
    shellTarget('Quick Adjust action', 'button', shellClasses.quickAction),
  ].join('')),
  shellPanel('Checklist and Maintenance', [
    checklistTarget,
    shellTarget('Accounting filter', 'select', shellClasses.maintenanceFilter),
    shellTarget('Accounting filter clear', 'button', shellClasses.maintenanceFilterClear, 'text', '×'),
    shellTarget('Maintenance Log', 'button', shellClasses.maintenanceLog),
    shellTarget('Maintenance delete', 'button', shellClasses.maintenanceDelete, 'text', 'close'),
    shellTarget('Maintenance Add', 'button', shellClasses.maintenanceOpen),
    shellTarget('Maintenance modal close', 'button', shellClasses.maintenanceModalClose, 'text', 'close'),
    shellTarget('Maintenance date', 'input', shellClasses.maintenanceField, 'date'),
    shellTarget('Maintenance notes', 'textarea', shellClasses.maintenanceTextarea),
    shellTarget('Maintenance submit', 'button', shellClasses.maintenanceSubmit),
  ].join('')),
  shellPanel('Export', [
    checkboxLabelTarget('Export cloud switch', shellClasses.exportSwitch),
    checkboxLabelTarget('Radio-backed label contract', shellClasses.exportSwitch, 'radio'),
    shellTarget('Export Setup select', 'select', shellClasses.exportSelect),
    shellTarget('Export Race Day select', 'select', shellClasses.exportSelect),
    shellTarget('Export Trackers select', 'select', shellClasses.exportSelect),
    shellTarget('Export action', 'button', shellClasses.exportAction),
  ].join('')),
  shellPanel('Existing floors', [
    shellTarget('Auth mode', 'button', productionClasses.authMode),
    shellTarget('Auth field', 'input', productionClasses.authField),
    shellTarget('Settings danger', 'button', productionClasses.settingsDanger),
    shellTarget('Race Day close', 'button', productionClasses.raceClose, 'text', '<span class="material-symbols-outlined">close</span>'),
    shellTarget('Header guide', 'button', shellClasses.headerGuide, 'text', '<span class="material-symbols-outlined">help</span>'),
    shellTarget('Context picker', 'button', shellClasses.contextPicker),
    shellTarget('NumberStepper direction', 'button', 'min-h-11 min-w-11 shrink-0 select-none touch-pan-y', 'text', '−'),
    shellTarget('Four Bar help', 'button', shellClasses.fourBarHelp, 'text', '<span class="material-symbols-outlined">help</span>'),
  ].join('')),
  `<nav data-panel data-name="Bottom navigation" class="shell-panel shell-nav ${shellClasses.bottomNav}">${shellTarget('Bottom nav button', 'button', `${shellClasses.bottomNavButton} text-primary`, 'text', 'Runs')}</nav>`,
].join('');

type ShellFloorMutation = 'remove-height' | 'height-43' | 'remove-button-width' | 'exempt-buttons' | 'remove-label-floor' | 'attachment-20';
const mutateGlobalFloorCss = (source: string, mutation: ShellFloorMutation): string => {
  const section = sliceBetween(source, GLOBAL_FLOOR_START, GLOBAL_FLOOR_END);
  let changed = section;
  if (mutation === 'remove-height') changed = changed.replace('  min-height: 2.75rem;\n', '');
  if (mutation === 'height-43') changed = changed.replace('min-height: 2.75rem;', 'min-height: 2.6875rem;');
  if (mutation === 'remove-button-width') {
    const widthBlockAt = changed.indexOf('min-width: 2.75rem;');
    const buttonAt = changed.lastIndexOf('  button,', widthBlockAt);
    changed = `${changed.slice(0, buttonAt)}  button[data-width-floor],${changed.slice(buttonAt + '  button,'.length)}`;
  }
  if (mutation === 'exempt-buttons') changed = changed.replace('  button,', '  button[data-height-floor],');
  if (mutation === 'remove-label-floor') changed = changed.replaceAll('label:has(input:is([type="file"], [type="checkbox"], [type="radio"]))', 'label[data-input-backed-floor]');
  if (mutation === 'attachment-20') changed = changed.replaceAll('  button,', '  button:not(.attachment-delete),');
  globalFloorOk(changed !== section, `${mutation}: mutates exact global floor section`);
  return source.replace(section, changed);
};

const compileShellCss = async (source: string): Promise<string> => {
  const compiler = await compile(source, { base: root, onDependency: () => undefined });
  return compiler.build(classCandidates(shellMarkup, ...Object.values(shellClasses), ...Object.values(productionClasses)))
    .replace(/@import url\([^;]+;\s*/g, '');
};
type ShellRect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type ShellRenderResult = {
  viewportClient: number;
  viewportScroll: number;
  targets: Array<{ name: string; kind: string; requiresWidth: boolean; rect: ShellRect; panel: ShellRect; clientWidth: number; scrollWidth: number; clientHeight: number; scrollHeight: number }>;
  backedInputs: Array<{ type: string; display: string; rect: ShellRect }>;
};
const renderShellFloorProbe = (name: string, viewportWidth: number, viewportHeight: number, scale: number, compiledCss: string): ShellRenderResult => {
  const probeDir = mkdtempSync(join(tmpdir(), 'race-notes-global-floor-render-'));
  const htmlPath = join(probeDir, 'probe.html');
  const profilePath = join(probeDir, 'profile');
  const document = `<!doctype html><html style="--ui-zoom:${scale}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${compiledCss}
html,body,#root{height:auto!important;min-height:0!important;width:auto!important;overflow:visible!important}.viewport{width:${viewportWidth}px;min-width:0;overflow:visible}.shell-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));gap:8px;padding:8px;min-width:0}.shell-panel{position:relative;min-width:0;max-width:100%;border:1px solid #777;padding:8px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px}.shell-nav{padding:0!important}.shell-panel>[data-target]{max-width:100%}[data-target]{font-family:Arial,sans-serif}.relative{position:relative}
  </style></head><body><div class="viewport"><div id="root"><div id="applet-main-body"><main class="shell-grid">${shellMarkup}</main></div></div></div><pre id="result"></pre><script>
const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
const targets=[...document.querySelectorAll('[data-target]')].map(node=>({name:node.dataset.name,kind:node.dataset.kind,requiresWidth:node.hasAttribute('data-requires-width'),rect:rect(node),panel:rect(node.closest('[data-panel]')),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight}));
const backedInputs=[...document.querySelectorAll('[data-backed-input]')].map(node=>({type:node.type,display:getComputedStyle(node).display,rect:rect(node)}));
const viewport=document.querySelector('.viewport');document.querySelector('#result').textContent=JSON.stringify({name:${JSON.stringify(name)},viewportClient:viewport.clientWidth,viewportScroll:viewport.scrollWidth,targets,backedInputs});
  </script>`;
  try {
    writeFileSync(htmlPath, document);
    const dumped = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--user-data-dir=${profilePath}`, `--window-size=${Math.max(1200, viewportWidth)},${Math.max(900, viewportHeight)}`,
      '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    globalFloorOk(encoded, `${name}: Chromium returned global floor measurements`);
    return JSON.parse(encoded!.replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as ShellRenderResult;
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

const shellFloorPasses = (name: string, viewportWidth: number, viewportHeight: number, scale: number, compiledCss: string) => {
  const result = renderShellFloorProbe(name, viewportWidth, viewportHeight, scale, compiledCss);
  const tolerance = 0.6;
  const borderTolerance = 1.1;
  const floor = TARGET_PX * scale;
  const failedTargets = result.targets.filter(target => target.rect.height + tolerance < floor
    || (target.requiresWidth && target.rect.width + tolerance < floor)
    || target.scrollWidth > target.clientWidth + 1 || target.scrollHeight > target.clientHeight + 1
    || target.rect.left + borderTolerance < target.panel.left || target.rect.right > target.panel.right + borderTolerance
    || target.rect.top + borderTolerance < target.panel.top || target.rect.bottom > target.panel.bottom + borderTolerance);
  const glyphsStayCompact = result.backedInputs.every(input => input.type === 'file'
    ? input.display === 'none' && input.rect.width === 0 && input.rect.height === 0
    : input.rect.width <= 24 * scale && input.rect.height <= 24 * scale);
  const noOverflow = result.viewportScroll <= result.viewportClient;
  return { passes: failedTargets.length === 0 && glyphsStayCompact && noOverflow, result, failedTargets, glyphsStayCompact, noOverflow };
};

const compiledGlobalFloorCss = await compileShellCss(css);
for (const [scaleName, scale] of repairScales) {
  for (const [viewportWidth, viewportHeight] of repairViewports) {
    const name = `global-floor-${scaleName}-${viewportWidth}x${viewportHeight}`;
    const proof = shellFloorPasses(name, viewportWidth, viewportHeight, scale, compiledGlobalFloorCss);
    globalFloorEqual(proof.result.viewportClient, viewportWidth, `${name}: Chromium renders exact viewport width`);
    globalFloorOk(proof.passes, `${name}: all production-derived direct/effective controls meet floor without clipping or overflow: ${JSON.stringify({ failedTargets: proof.failedTargets, glyphsStayCompact: proof.glyphsStayCompact, noOverflow: proof.noOverflow })}`);
  }
}

for (const mutation of [
  { name: 'remove-global-height-floor', mutation: 'remove-height' },
  { name: 'reduce-global-height-to-43px', mutation: 'height-43' },
  { name: 'remove-button-width-floor', mutation: 'remove-button-width' },
  { name: 'exempt-buttons-from-global-height', mutation: 'exempt-buttons' },
  { name: 'remove-input-backed-label-floor', mutation: 'remove-label-floor' },
  { name: 'restore-20px-attachment-delete', mutation: 'attachment-20' },
] as const) {
  const mutatedCss = mutateGlobalFloorCss(css, mutation.mutation);
  const compiledMutationCss = await compileShellCss(mutatedCss);
  const proof = shellFloorPasses(mutation.name, 360, 800, 1, compiledMutationCss);
  globalFloorEqual(proof.passes, false, `${mutation.name}: independent compiled/rendered production geometry gate fails`);
  killedGlobalFloorMutations.push(mutation.name);
}
globalFloorEqual(new Set(killedGlobalFloorMutations).size, killedGlobalFloorMutations.length, 'global floor mutation names are unique');
globalFloorEqual(killedGlobalFloorMutations.length, 6, 'global floor proof kills all six required independent mutations');
console.log(`Global floor assertions: ${globalFloorAssertionCount}`);
console.log(`Global floor killed mutations (${killedGlobalFloorMutations.length}): ${killedGlobalFloorMutations.join(', ')}`);

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

const b1StartPress = sliceBetween(stepper, '  const startPress =', '\n\n  const handlePointerMove =');
const b1PointerMove = sliceBetween(stepper, '  const handlePointerMove =', '\n\n  const finishPress =');
const b1FinishPress = sliceBetween(stepper, '  const finishPress =', '\n\n  // Clear timers on unmount');
for (const token of [
  'const REPEAT_DELAY_MS = 350;',
  'const REPEAT_INTERVAL_MS = 100;',
  'const STEPPER_POINTER_SLOP_PX = 8;',
  'press.didRepeat = true;',
  '}, REPEAT_DELAY_MS);',
  '}, REPEAT_INTERVAL_MS);',
  'onPointerDown={(e) => startPress(e, -1)}',
  'onPointerDown={(e) => startPress(e, 1)}',
  'onPointerUp={finishPress}',
  'onPointerCancel={cancelPress}',
  'onClick={(e) => { if (e.detail === 0) applyStep(-1, step); }}',
]) assert.ok(stepper.includes(token), `B1 stepper contract remains: ${token}`);
assert.doesNotMatch(b1StartPress, /applyStep\(/, 'B1 pointerdown arms state and repeat only; it writes nothing');
assert.match(b1PointerMove, /Math\.hypot\(event\.clientX - press\.startX, event\.clientY - press\.startY\) > STEPPER_POINTER_SLOP_PX/, 'B1 movement checks 8px slop');
assert.match(b1PointerMove, /press\.moved = true;\s*cancelPress\(\);/s, 'B1 movement cancels pending step and repeat');
assert.match(b1FinishPress, /const releasedOutsideSlop = Math\.hypot\(event\.clientX - press\.startX, event\.clientY - press\.startY\) > STEPPER_POINTER_SLOP_PX;/, 'B1 pointerup rechecks release slop when no move event arrives');
assert.match(b1FinishPress, /if \(!press\.moved && !releasedOutsideSlop && !press\.didRepeat\) applyStep\(press\.dir, step\);/, 'B1 pointerup commits one in-slop, non-repeat step');
assert.doesNotMatch(stepper, /touch-none/, 'B1 removes scroll-blocking touch-none');

// E2 Add/New opens creation; Create submits new records; Save applies edits.
type E2Sources = { garage: string; tires: string; raceWeekend: string; trackers: string };
let e2AssertionCount = 0;
const killedE2Mutations: string[] = [];
const e2Ok: (value: unknown, message: string) => asserts value = (value, message) => {
  e2AssertionCount += 1;
  assert.ok(value, message);
};
const e2Equal = (actual: unknown, expected: unknown, message: string): void => {
  e2AssertionCount += 1;
  assert.equal(actual, expected, message);
};
const e2DoesNotThrow = (callback: () => void, message: string): void => {
  e2AssertionCount += 1;
  assert.doesNotThrow(callback, message);
};
const e2Kill = (name: string, killed: boolean): void => {
  e2AssertionCount += 1;
  assert.equal(killed, true, `E2 mutation killed: ${name}`);
  killedE2Mutations.push(name);
};
const e2ButtonBlock = (input: string, marker: string): string | null => {
  const markerAt = input.indexOf(marker);
  if (markerAt === -1) return null;
  const start = input.lastIndexOf('<button', markerAt);
  const closeAt = input.indexOf('</button>', markerAt);
  if (start === -1 || closeAt === -1) return null;
  return input.slice(start, closeAt + '</button>'.length);
};
const e2SourcePasses = (sources: E2Sources): boolean => {
  const garageSubmit = e2ButtonBlock(sources.garage, 'onClick={handleAdd}');
  const tireSubmit = e2ButtonBlock(sources.tires, "{editingId ? 'Save Tire' : 'Create Tire'}");
  const raceSubmit = e2ButtonBlock(sources.raceWeekend, "{wkEditingId ? 'SAVE CHANGES' : 'CREATE RACE DAY'}");
  const maintenanceSubmit = e2ButtonBlock(sources.trackers, '>Create Job</button>');
  if (!garageSubmit || !tireSubmit || !raceSubmit || !maintenanceSubmit) return false;
  return /onClick=\{handleAdd\}/.test(garageSubmit)
    && /disabled=\{!form\.chassis\.trim\(\)\}/.test(garageSubmit)
    && /className="flex-1 py-2 bg-primary text-on-primary font-mono text-xs uppercase rounded font-bold disabled:opacity-40"/.test(garageSubmit)
    && !/\btype=/.test(garageSubmit)
    && />\s*Create Car\s*<\/button>/.test(garageSubmit)
    && /cta=\{\{ label: 'Add Car', onClick: focusAddCarForm, icon: 'add' \}\}/.test(sources.garage)
    && /onClick=\{focusAddCarForm\}[\s\S]*?>\s*<span[^>]*>add<\/span>\s*Add Car\s*<\/button>/.test(sources.garage)
    && />Add Car<\/h4>/.test(sources.garage)
    && /<form onSubmit=\{handleSubmit\} className="min-w-0 space-y-3">/.test(sources.tires)
    && /type="submit"/.test(tireSubmit)
    && /className="rounded bg-primary px-3 py-2 font-mono text-xs font-bold uppercase text-on-primary"/.test(tireSubmit)
    && /\{editingId \? 'Save Tire' : 'Create Tire'\}/.test(tireSubmit)
    && /noCar \? 'Go to Garage' : 'Add Tire'/.test(sources.tires)
    && /label: noCar \? 'Go to Garage' : 'Add First Tire'/.test(sources.tires)
    && /onClick: \(\) => noCar \? onGoToGarage\?\.\(\) : openAdd\(\)/.test(sources.tires)
    && /<form onSubmit=\{handleWeekendFormSubmit\} className="space-y-3">/.test(sources.raceWeekend)
    && /type="submit"/.test(raceSubmit)
    && /className="min-h-11 px-4 py-2 bg-primary text-on-primary font-bold uppercase hover:bg-primary-fixed-dim cursor-pointer rounded"/.test(raceSubmit)
    && /\{wkEditingId \? 'SAVE CHANGES' : 'CREATE RACE DAY'\}/.test(raceSubmit)
    && /cta=\{\{ label: 'New Race Day', icon: 'add', onClick: \(\) => openWeekendForm\(\) \}\}/.test(sources.raceWeekend)
    && /onClick=\{\(\) => openWeekendForm\(\)\}[\s\S]*?>\s*\+ New Race Day\s*<\/button>/.test(sources.raceWeekend)
    && /<form onSubmit=\{handleAddSubmit\} className="bg-surface-container border border-outline-variant rounded-lg p-3 space-y-2">/.test(sources.trackers)
    && /<input required placeholder="Maintenance item name \*"/.test(sources.trackers)
    && /type="submit"/.test(maintenanceSubmit)
    && /className="flex-1 py-2\.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80"/.test(maintenanceSubmit)
    && />Create Job<\/button>/.test(maintenanceSubmit)
    && /onClick=\{\(\) => setShowAddForm\(v => !v\)\}[\s\S]*?\{showAddForm \? 'Cancel' : 'Add Maintenance Job'\}/.test(sources.trackers);
};
const productionE2Sources: E2Sources = { garage, tires, raceWeekend, trackers };
const dispatchRaceWeekend = execFileSync(
  'git',
  ['show', '8a70dd06eead68bf490417313adbad17ae6037d2:src/components/RaceWeekendView.tsx'],
  { cwd: root, encoding: 'utf8' },
).replace(/\r\n/g, '\n');

e2Ok(e2SourcePasses(productionE2Sources), 'E2 real production sources preserve exact opener, submit, edit, handler, type, disabled, and class contracts');
e2Equal(raceWeekend, dispatchRaceWeekend, 'E2 RaceWeekend real source has zero product diff from dispatch');
e2Ok(/>\s*Create Car\s*<\/button>/.test(e2ButtonBlock(garage, 'onClick={handleAdd}') ?? ''), 'E2 Garage new-record submit is Create Car');
e2Ok(/\{editingId \? 'Save Tire' : 'Create Tire'\}/.test(tires), 'E2 Tire create submit is Create Tire and edit submit remains Save Tire');
e2Ok(/\{wkEditingId \? 'SAVE CHANGES' : 'CREATE RACE DAY'\}/.test(raceWeekend), 'E2 Race Day create and edit submits remain exact');
e2Ok(/>Create Job<\/button>/.test(trackers), 'E2 Maintenance new-record submit is Create Job');
e2Ok(/cta=\{\{ label: 'Add Car'[\s\S]*?>\s*<span[^>]*>add<\/span>\s*Add Car\s*<\/button>/.test(garage), 'E2 Garage openers remain Add Car');
e2Ok(/'Add Tire'[\s\S]*'Add First Tire'/.test(tires), 'E2 Tire openers remain Add Tire and Add First Tire');
e2Ok(/label: 'New Race Day'[\s\S]*\+ New Race Day/.test(raceWeekend), 'E2 Race Day openers remain New Race Day variants');
e2Ok(/\{showAddForm \? 'Cancel' : 'Add Maintenance Job'\}/.test(trackers), 'E2 Maintenance opener remains Add Maintenance Job');

const mutateE2 = (name: string, key: keyof E2Sources, before: string, after: string): void => {
  const original = productionE2Sources[key];
  const mutated = original.replace(before, after);
  e2Ok(mutated !== original, `E2 ${name} changes exact production source`);
  e2DoesNotThrow(() => transformSync(mutated, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), `E2 ${name} remains compile-real TSX`);
  e2Kill(name, !e2SourcePasses({ ...productionE2Sources, [key]: mutated }));
};
mutateE2('garage-submit-reverted-to-opener', 'garage', '\n              Create Car\n', '\n              Add Car\n');
mutateE2('tire-submit-reverted-to-opener', 'tires', "{editingId ? 'Save Tire' : 'Create Tire'}", "{editingId ? 'Save Tire' : 'Add Tire'}");
mutateE2('race-day-create-branch-reverted-to-opener', 'raceWeekend', "{wkEditingId ? 'SAVE CHANGES' : 'CREATE RACE DAY'}", "{wkEditingId ? 'SAVE CHANGES' : 'NEW RACE DAY'}");
mutateE2('maintenance-submit-reverted-to-opener', 'trackers', '>Create Job</button>', '>Add Maintenance Job</button>');
mutateE2('garage-opener-changed-to-create', 'garage', "cta={{ label: 'Add Car', onClick: focusAddCarForm, icon: 'add' }}", "cta={{ label: 'Create Car', onClick: focusAddCarForm, icon: 'add' }}");
mutateE2('tire-opener-changed-to-create', 'tires', "noCar ? 'Go to Garage' : 'Add Tire'", "noCar ? 'Go to Garage' : 'Create Tire'");
mutateE2('race-day-opener-changed-to-create', 'raceWeekend', "label: 'New Race Day', icon: 'add'", "label: 'Create Race Day', icon: 'add'");
mutateE2('maintenance-opener-changed-to-create', 'trackers', "{showAddForm ? 'Cancel' : 'Add Maintenance Job'}", "{showAddForm ? 'Cancel' : 'Create Job'}");
mutateE2('tire-edit-save-changed-to-create', 'tires', "{editingId ? 'Save Tire' : 'Create Tire'}", "{editingId ? 'Create Tire' : 'Create Tire'}");
mutateE2('garage-submit-handler-rewired', 'garage', 'onClick={handleAdd}', 'onClick={focusAddCarForm}');
mutateE2('garage-submit-disabled-removed', 'garage', '              disabled={!form.chassis.trim()}\n', '');
mutateE2('tire-submit-type-removed', 'tires', '<button type="submit" className="rounded bg-primary', '<button type="button" className="rounded bg-primary');
e2Equal(new Set(killedE2Mutations).size, killedE2Mutations.length, 'E2 mutation names are unique');
e2Equal(killedE2Mutations.length, 12, 'E2 kills twelve independent production mutations');
console.log(`E2 assertions: ${e2AssertionCount}`);
console.log(`E2 killed mutations (${killedE2Mutations.length}): ${killedE2Mutations.join(', ')}`);

console.log('Setup touch-target harness: PASS');
