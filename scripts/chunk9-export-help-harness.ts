import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { INITIAL_ACTIVE_SESSION, INITIAL_SETUP } from '../src/data';
import type { RaceWeekend, Setup } from '../src/types';
import {
  buildMasterReport,
  buildSetupReport,
  buildTrackersReport,
  buildWeekendReport,
  createPdfBytes,
  createPdfFile,
  renderReportHtml,
  reportFilename,
} from '../src/lib/exportPdf';
import { shareOrDownloadReport, type ReportShareAdapter } from '../src/lib/reportShare';
import { plainRacerEffect } from '../src/components/QuickReferenceView';
import GuideView from '../src/components/GuideView';
import {
  APP_GUIDE_ROOT,
  isAppGuideSection,
  resolveContextualAppGuideSection,
  type ContextualAppGuideContext,
} from '../src/lib/helpRouting';

const setup: Setup = {
  ...structuredClone(INITIAL_SETUP),
  id: 'setup-1', chassis: 'Rocket 1', track: 'Eldora Speedway', date: '2026-07-12', carType: 'Dirt Late Model',
  lf: { ...INITIAL_SETUP.lf, spring: '500', shock: '5/3', tirePress: '10' },
  rf: { ...INITIAL_SETUP.rf, spring: '525', shock: '6/2', tirePress: '11' },
};
const weekend = {
  id: 'wknd-1', name: 'Kings Royal Test', track: 'Eldora Speedway', date: '2026-07-12', notes: 'Try top first.',
  sessions: [{ ...structuredClone(INITIAL_ACTIVE_SESSION), id: 'run-1', name: 'Heat 1', type: 'Heat Race', bestLap: '15.220', finishPos: '2' }],
} as unknown as RaceWeekend;
const accounting = [{ id: 'acct-1', name: 'Pit pass', amount: 40, type: 'expense' as const, date: '2026-07-12', weekendId: weekend.id }];
const todos = [{ id: 'todo-1', user_id: '', title: 'Main Checklist', updated_at: 'now', items: [{ id: 'job-1', text: 'Torque wheels', done: false }] }];
const generatedAt = new Date('2026-07-13T12:00:00.000Z');

const setupReport = buildSetupReport(setup, INITIAL_ACTIVE_SESSION);
assert.equal(setupReport.title, 'Setup Report');
assert.match(setupReport.filename, /^crewchief-eldora-speedway-2026-07-12\.pdf$/);
assert.match(setupReport.bodyHtml, /Corner Setup/);
assert.match(setupReport.bodyHtml, /Current Run/);
assert.ok(setupReport.textLines.some(line => line.includes('LF | 500')));

const weekendReport = buildWeekendReport(weekend, accounting);
assert.equal(weekendReport.title, 'Race Day Report');
assert.ok(weekendReport.textLines.some(line => line.includes('Race Day notes:')));
assert.match(weekendReport.bodyHtml, /Runs \(1\)/);
assert.match(weekendReport.bodyHtml, /Heat 1/);
assert.ok(weekendReport.textLines.some(line => line.includes('Net:')));
assert.match(buildTrackersReport('all', todos, accounting).bodyHtml, /Torque wheels/);
assert.match(buildMasterReport(setup, INITIAL_ACTIVE_SESSION, [weekend], todos, accounting).bodyHtml, /Race Days \(1\)/);
assert.equal(reportFilename('Eldora Speedway', '2026-07-12'), 'crewchief-eldora-speedway-2026-07-12.pdf');

const printHtml = renderReportHtml(setupReport, generatedAt);
assert.match(printHtml, /CREW CHIEF — Setup Report/);
assert.match(printHtml, /window\.print/);
const bytes = createPdfBytes(weekendReport, generatedAt);
const pdfText = new TextDecoder().decode(bytes);
assert.equal(pdfText.startsWith('%PDF-1.4'), true);
assert.equal(pdfText.endsWith('%%EOF'), true);
assert.match(pdfText, /Heat 1/);
const file = createPdfFile(weekendReport, generatedAt);
assert.equal(file.type, 'application/pdf');
assert.equal(file.name, weekendReport.filename);
assert.equal(file.size, bytes.length);

const adapter = (overrides: Partial<ReportShareAdapter> = {}): ReportShareAdapter => ({
  isNative: false,
  webCanShare: () => false,
  download: () => undefined,
  ...overrides,
});
let calls: string[] = [];
assert.equal((await shareOrDownloadReport(file, 'Race Day', adapter({
  isNative: true,
  nativeShare: async () => { calls.push('native'); },
  download: () => calls.push('download'),
}))).status, 'shared');
assert.deepEqual(calls, ['native']);

calls = [];
assert.equal((await shareOrDownloadReport(file, 'Race Day', adapter({
  webCanShare: () => true,
  webShare: async () => { calls.push('web'); },
  download: () => calls.push('download'),
}))).status, 'shared');
assert.deepEqual(calls, ['web']);

calls = [];
assert.equal((await shareOrDownloadReport(file, 'Race Day', adapter({
  webCanShare: () => true,
  webShare: async () => { throw new DOMException('User cancelled', 'AbortError'); },
  download: () => calls.push('download'),
}))).status, 'cancelled');
assert.deepEqual(calls, []);

calls = [];
assert.equal((await shareOrDownloadReport(file, 'Race Day', adapter({
  isNative: true,
  nativeShare: async () => { throw new Error('Plugin failed'); },
  download: () => calls.push('download'),
}))).status, 'failed');
assert.deepEqual(calls, []);
assert.equal((await shareOrDownloadReport(file, 'Race Day', adapter({ download: () => { throw new Error('Disk full'); } }))).status, 'failed');

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8').replace(/\r\n/g, '\n');
const quickRef = source('src/components/QuickReferenceView.tsx');
const helpSheet = source('src/components/ui/HelpSheet.tsx');
const bottomSheet = source('src/components/ui/BottomSheet.tsx');
const guideView = source('src/components/GuideView.tsx');
const appSource = source('src/App.tsx');
const userGuide = source('docs/USER_GUIDE.md');
const setupView = source('src/components/SetupView.tsx');
const fourBarView = source('src/components/FourBarQuickAdjust.tsx');
const weekendView = source('src/components/RaceWeekendView.tsx');
const loadsView = source('src/components/SmasherLoadsView.tsx');
const diffView = source('src/components/SetupDiffView.tsx');
const pdfSource = source('src/lib/exportPdf.ts');
const helpRoutingSource = source('src/lib/helpRouting.ts');

for (const anchor of ['setup', 'four-bar', 'loads', 'setup-diff']) {
  assert.doesNotMatch(quickRef, new RegExp(`data-help-anchor="${anchor}"`));
  assert.match(guideView, new RegExp(`id: '${anchor}'`));
}
assert.doesNotMatch(quickRef, /Before You Change Anything|Setup Sheet<\/h2>|Load Sessions<\/h2>|Compare Setups<\/h2>/);
assert.ok(quickRef.indexOf('Pit-Side Adjustment Finder') < quickRef.indexOf('What Shock Changes Do'));
assert.equal(isAppGuideSection(undefined), false);
assert.equal(isAppGuideSection(APP_GUIDE_ROOT), true);
assert.equal(isAppGuideSection('setup'), true);
assert.equal(isAppGuideSection('four-bar'), true);
assert.equal(isAppGuideSection('loads'), true);
assert.equal(isAppGuideSection('setup-diff'), true);
assert.equal(isAppGuideSection('other'), false);
assert.match(helpSheet, /scrollIntoView/);
assert.match(helpSheet, /title = 'Tuning Guide'/);
assert.doesNotMatch(helpSheet, /Basic dirt-oval setup direction/);
assert.match(appSource, /isAppGuideSection\(helpSection\)/);
assert.match(appSource, /appGuideHelp \? <GuideView activeSection=\{helpSection\} embedded \/> : <QuickReferenceView \/>/);
assert.match(guideView, /const shownOpen = active \|\| open/);
assert.match(guideView, /data-help-anchor=\{section\.id\}/);
const setupGuideMarkup = renderToStaticMarkup(createElement(GuideView, { activeSection: 'setup', embedded: true }));
const loadsGuideMarkup = renderToStaticMarkup(createElement(GuideView, { activeSection: 'loads', embedded: true }));
const rootGuideMarkup = renderToStaticMarkup(createElement(GuideView, { activeSection: APP_GUIDE_ROOT, embedded: true }));
const guideSectionMarkup = (markup: string, id: string) => {
  const start = markup.indexOf(`data-help-anchor="${id}"`);
  const end = markup.indexOf('data-help-anchor="', start + 20);
  assert.notEqual(start, -1);
  return markup.slice(start, end === -1 ? undefined : end);
};
assert.match(guideSectionMarkup(setupGuideMarkup, 'setup'), /aria-expanded="true"[\s\S]*guide-panel-setup/);
assert.match(guideSectionMarkup(setupGuideMarkup, 'loads'), /aria-expanded="false"/);
assert.match(guideSectionMarkup(loadsGuideMarkup, 'setup'), /aria-expanded="false"/);
assert.match(guideSectionMarkup(loadsGuideMarkup, 'loads'), /aria-expanded="true"[\s\S]*guide-panel-loads/);
assert.doesNotMatch(setupGuideMarkup, /How to use CREW CHIEF/);
assert.doesNotMatch(rootGuideMarkup, /aria-expanded="true"|How to use CREW CHIEF/);
assert.match(renderToStaticMarkup(createElement(GuideView)), /How to use CREW CHIEF/);

// E1 context-aware App Guide relocation. Compile real resolver, execute the
// real Race Day visibility reporter, and mutation-check every route boundary.
type HelpRoutingRuntime = {
  isAppGuideSection: (section?: string) => boolean;
  resolveContextualAppGuideSection: (context: ContextualAppGuideContext) => string | undefined;
};
let e1AssertionCount = 0;
const killedE1Mutations: string[] = [];
const e1Ok: (value: unknown, message: string) => asserts value = (value, message) => {
  e1AssertionCount += 1;
  assert.ok(value, message);
};
const e1Equal = (actual: unknown, expected: unknown, message: string): void => {
  e1AssertionCount += 1;
  assert.equal(actual, expected, message);
};
const e1DeepEqual = (actual: unknown, expected: unknown, message: string): void => {
  e1AssertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const e1Kill = (name: string, killed: boolean): void => {
  e1AssertionCount += 1;
  assert.equal(killed, true, `E1 mutation killed: ${name}`);
  killedE1Mutations.push(name);
};
const e1Replace = (input: string, before: string, after: string, label: string): string => {
  const mutated = input.replace(before, after);
  e1Ok(mutated !== input, `E1 ${label} mutation changes exact production source`);
  return mutated;
};
const compileHelpRouting = (input: string): HelpRoutingRuntime => {
  const compiled = transformSync(input, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compiled)(moduleBox, moduleBox.exports);
  return moduleBox.exports as HelpRoutingRuntime;
};
const routing = compileHelpRouting(helpRoutingSource);
const context = (activeTab: ContextualAppGuideContext['activeTab'], fourBarVisible = false, mappedSection?: ContextualAppGuideContext['mappedSection']): ContextualAppGuideContext => ({
  activeTab,
  fourBarVisible,
  mappedSection,
});

const E1_PRODUCT_COMMIT = '45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf';
const E1_PRODUCT_PARENT = 'cbe874f491cc81e218f495e7bb50ac5f14f49aaa';
const E1_PRODUCT_PATHS = [
  'scripts/chunk9-export-help-harness.ts',
  'src/App.tsx',
  'src/components/RaceWeekendView.tsx',
  'src/components/SetupView.tsx',
  'src/lib/helpRouting.ts',
] as const;
const FROZEN_FOUR_BAR_PATH = 'src/components/FourBarQuickAdjust.tsx';
const normalizeE1ScopePaths = (paths: readonly string[]): string[] => paths
  .map(path => path.trim().replace(/\\/g, '/'))
  .filter(Boolean)
  .sort();
const validatesE1ImplementationScope = (paths: readonly string[]): boolean => {
  const normalized = normalizeE1ScopePaths(paths);
  return normalized.length === E1_PRODUCT_PATHS.length
    && normalized.every((path, index) => path === E1_PRODUCT_PATHS[index])
    && !normalized.includes(FROZEN_FOUR_BAR_PATH);
};
const e1ProductParent = execFileSync('git', ['rev-parse', `${E1_PRODUCT_COMMIT}^`], {
  cwd: process.cwd(),
  encoding: 'utf8',
}).trim();
const e1ProductChangedPaths = execFileSync(
  'git',
  ['diff', '--name-only', e1ProductParent, E1_PRODUCT_COMMIT, '--'],
  { cwd: process.cwd(), encoding: 'utf8' },
).split(/\r?\n/).filter(Boolean);
const normalizedE1ProductPaths = normalizeE1ScopePaths(e1ProductChangedPaths);

e1Equal(e1ProductParent, E1_PRODUCT_PARENT, 'E1 exact product parent is bound');
e1DeepEqual(normalizedE1ProductPaths, [...E1_PRODUCT_PATHS], 'E1 exact product diff matches sorted five-file allowlist');
e1Ok(validatesE1ImplementationScope(e1ProductChangedPaths), 'E1 pure scope validator accepts exact Git-derived product diff');
e1Equal(normalizedE1ProductPaths.includes(FROZEN_FOUR_BAR_PATH), false, 'E1 product diff explicitly excludes FourBarQuickAdjust');
e1Kill(
  'implementation-scope-missing-authorized-path',
  !validatesE1ImplementationScope(e1ProductChangedPaths.filter(path => path !== 'src/App.tsx')),
);
e1Kill(
  'implementation-scope-duplicate-authorized-path',
  !validatesE1ImplementationScope([...e1ProductChangedPaths, 'src/App.tsx']),
);
for (const [name, path] of [
  ['implementation-scope-protected-path-added', 'src/lib/sync.ts'],
  ['implementation-scope-e2-path-added', 'src/components/GarageView.tsx'],
  ['implementation-scope-e3-path-added', 'src/index.css'],
  ['implementation-scope-native-path-added', 'android/app/src/main/java/nimbus/engineering/crewchief/MainActivity.java'],
  ['implementation-scope-schema-path-added', 'supabase/migrations/99999999999999_e1_scope_mutation.sql'],
  ['implementation-scope-package-path-added', 'package.json'],
] as const) {
  e1Kill(name, !validatesE1ImplementationScope([...e1ProductChangedPaths, path]));
}

e1Equal(resolveContextualAppGuideSection(context('setups', true)), 'four-bar', 'E1 FourBar visibility overrides Setups');
e1Equal(resolveContextualAppGuideSection(context('raceweekend', true)), 'four-bar', 'E1 open Race Day FourBar resolves four-bar');
e1Equal(resolveContextualAppGuideSection(context('raceweekend', false)), APP_GUIDE_ROOT, 'E1 closed Race Day FourBar resolves App Guide root');
e1Equal(resolveContextualAppGuideSection(context('setups')), 'setup', 'E1 Setups resolves setup');
e1Equal(resolveContextualAppGuideSection(context('settings', false, 'loads')), 'loads', 'E1 explicit mapped context resolves existing topic');
e1Equal(resolveContextualAppGuideSection(context('setups', false, 'loads')), 'setup', 'E1 Setups outranks mapped context');
for (const tab of ['dashboard', 'settings', 'trackers', 'quickref'] as const) {
  e1Equal(resolveContextualAppGuideSection(context(tab)), APP_GUIDE_ROOT, `E1 ${tab} resolves App Guide root`);
}
e1Equal(routing.isAppGuideSection(APP_GUIDE_ROOT), true, 'E1 compiled real classifier accepts root sentinel');

const fourBarRemoved = e1Replace(helpRoutingSource, "if (fourBarVisible) return 'four-bar';", "if (false) return 'four-bar';", 'FourBar override removed');
e1Kill('fourbar-override-removed', compileHelpRouting(fourBarRemoved).resolveContextualAppGuideSection(context('raceweekend', true)) !== 'four-bar');
const fourBarLowered = e1Replace(
  helpRoutingSource,
  "if (fourBarVisible) return 'four-bar';\n  if (activeTab === 'setups') return 'setup';",
  "if (activeTab === 'setups') return 'setup';\n  if (fourBarVisible) return 'four-bar';",
  'FourBar priority lowered',
);
e1Kill('fourbar-priority-lowered', compileHelpRouting(fourBarLowered).resolveContextualAppGuideSection(context('setups', true)) !== 'four-bar');
const everyRaceDayFourBar = e1Replace(helpRoutingSource, 'if (fourBarVisible) return', "if (fourBarVisible || activeTab === 'raceweekend') return", 'closed Race Day forced FourBar');
e1Kill('closed-race-day-forced-fourbar', compileHelpRouting(everyRaceDayFourBar).resolveContextualAppGuideSection(context('raceweekend', false)) === 'four-bar');
const setupsMappingRemoved = e1Replace(helpRoutingSource, "if (activeTab === 'setups') return 'setup';", "if (false) return 'setup';", 'Setups mapping removed');
e1Kill('setups-mapping-removed', compileHelpRouting(setupsMappingRemoved).resolveContextualAppGuideSection(context('setups')) !== 'setup');
const mappedContextRemoved = e1Replace(helpRoutingSource, 'if (mappedSection) return mappedSection;', 'if (false) return mappedSection;', 'mapped context removed');
e1Kill('mapped-context-removed', compileHelpRouting(mappedContextRemoved).resolveContextualAppGuideSection(context('settings', false, 'loads')) !== 'loads');
const undefinedRoot = e1Replace(helpRoutingSource, 'return APP_GUIDE_ROOT;', 'return undefined as never;', 'root fallback undefined');
e1Kill('root-fallback-undefined', compileHelpRouting(undefinedRoot).resolveContextualAppGuideSection(context('dashboard')) !== APP_GUIDE_ROOT);
const rootClassificationRemoved = e1Replace(helpRoutingSource, '[APP_GUIDE_ROOT, ...APP_GUIDE_SECTIONS]', '[...APP_GUIDE_SECTIONS]', 'root classification removed');
e1Kill('root-classification-removed', compileHelpRouting(rootClassificationRemoved).isAppGuideSection(APP_GUIDE_ROOT) !== true);

const buttonBlock = (input: string, label: string): { start: number; end: number; text: string } => {
  const labelAt = input.indexOf(`aria-label="${label}"`);
  e1Ok(labelAt !== -1, `E1 ${label} button label exists`);
  const start = input.lastIndexOf('<button', labelAt);
  const end = input.indexOf('</button>', labelAt) + '</button>'.length;
  e1Ok(start !== -1 && end >= '</button>'.length, `E1 ${label} button block extracts`);
  return { start, end, text: input.slice(start, end) };
};
const appSourcePasses = (input: string): boolean => {
  const headerStart = input.indexOf('<header ref={notificationHeaderRef}');
  const headerEnd = input.indexOf('</header>', headerStart);
  if (headerStart === -1 || headerEnd === -1) return false;
  const header = input.slice(headerStart, headerEnd);
  const actionsStart = header.indexOf('<div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">');
  const actionsEnd = header.indexOf('{/* Active-car chip moved into ContextStrip', actionsStart);
  if (actionsStart === -1 || actionsEnd === -1) return false;
  const actions = header.slice(actionsStart, actionsEnd);
  const tuningLabel = actions.indexOf('aria-label="Tuning Guide"');
  const guideLabel = actions.indexOf('aria-label="App Guide"');
  const themeLabel = actions.indexOf('aria-label={theme.mode');
  if (!(tuningLabel !== -1 && tuningLabel < guideLabel && guideLabel < themeLabel)) return false;
  const tuningStart = actions.lastIndexOf('<button', tuningLabel);
  const tuningEnd = actions.indexOf('</button>', tuningLabel) + '</button>'.length;
  const guideStart = actions.lastIndexOf('<button', guideLabel);
  const guideEnd = actions.indexOf('</button>', guideLabel) + '</button>'.length;
  const tuningButton = actions.slice(tuningStart, tuningEnd);
  const guideButton = actions.slice(guideStart, guideEnd);
  return actions.slice(tuningEnd, guideStart).trim() === ''
    && /onClick=\{\(\) => openHelp\(\)\}/.test(tuningButton)
    && /aria-label="Tuning Guide"/.test(tuningButton)
    && /title="Tuning Guide"/.test(tuningButton)
    && /onClick=\{\(\) => openHelp\(resolveContextualAppGuideSection\(\{ activeTab, fourBarVisible: raceDayFourBarVisible \}\)\)\}/.test(guideButton)
    && /aria-label="App Guide"/.test(guideButton)
    && /title="App Guide"/.test(guideButton)
    && /min-h-11/.test(guideButton)
    && /min-w-11/.test(guideButton)
    && /const reportRaceDayFourBarVisibility = useCallback\([\s\S]*?\}, \[\]\);/.test(input)
    && /onFourBarVisibilityChange=\{reportRaceDayFourBarVisibility\}/.test(input)
    && /appGuideHelp \? <GuideView activeSection=\{helpSection\} embedded \/> : <QuickReferenceView \/>/.test(input);
};
e1Ok(appSourcePasses(appSource), 'E1 App source keeps exact authenticated header route and App Guide rendering');
const tuningBlock = buttonBlock(appSource, 'Tuning Guide');
const guideBlock = buttonBlock(appSource, 'App Guide');
e1Equal(tuningBlock.end <= guideBlock.start, true, 'E1 App Guide follows Tuning Guide');

const bareHeader = e1Replace(appSource, guideBlock.text.match(/onClick=\{[^\n]+/)?.[0] ?? '', 'onClick={() => openHelp()}', 'contextual header bare openHelp');
e1Kill('contextual-header-bare-openhelp', !appSourcePasses(bareHeader));
const staleHeader = e1Replace(appSource, guideBlock.text.match(/onClick=\{[^\n]+/)?.[0] ?? '', 'onClick={() => openHelp(helpSection)}', 'contextual header stale section');
e1Kill('contextual-header-stale-section', !appSourcePasses(staleHeader));
const tuningRewired = e1Replace(appSource, 'onClick={() => openHelp()}\n                aria-label="Tuning Guide"', 'onClick={() => openHelp(resolveContextualAppGuideSection({ activeTab, fourBarVisible: raceDayFourBarVisible }))}\n                aria-label="Tuning Guide"', 'Tuning Guide rewire');
e1Kill('tuning-guide-rewired', !appSourcePasses(tuningRewired));
const rootRendersTuning = e1Replace(appSource, '{appGuideHelp ? <GuideView activeSection={helpSection} embedded /> : <QuickReferenceView />}', '{appGuideHelp ? <QuickReferenceView /> : <GuideView activeSection={helpSection} embedded />}', 'root opens Tuning Guide');
e1Kill('root-opens-tuning-guide', !appSourcePasses(rootRendersTuning));
const undersizedHeader = e1Replace(appSource, 'className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors"', 'className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors"', 'header target undersized');
e1Kill('header-help-under-44px', !appSourcePasses(undersizedHeader));
const unlabeledHeader = e1Replace(appSource, 'aria-label="App Guide"\n                title="App Guide"', 'aria-label="Help"\n                title="Help"', 'header label weakened');
e1Kill('header-help-label-weakened', !appSourcePasses(unlabeledHeader));
const separatedHeader = e1Replace(appSource, '</button>\n              <button\n                type="button"\n                onClick={() => openHelp(resolveContextualAppGuideSection', '</button>\n              <span aria-hidden="true" />\n              <button\n                type="button"\n                onClick={() => openHelp(resolveContextualAppGuideSection', 'header adjacency broken');
e1Kill('header-help-separated-from-tuning', !appSourcePasses(separatedHeader));
const outsideHeader = appSource.slice(0, guideBlock.start) + appSource.slice(guideBlock.end).replace('</header>', `${guideBlock.text}\n        </header>`);
e1Kill('header-help-outside-action-group', !appSourcePasses(outsideHeader));
const propRouteRemoved = e1Replace(appSource, '                  onFourBarVisibilityChange={reportRaceDayFourBarVisibility}\n', '', 'RaceWeekend prop route removed');
e1Kill('raceweekend-prop-route-removed', !appSourcePasses(propRouteRemoved));
const unstableCallback = e1Replace(appSource, 'const reportRaceDayFourBarVisibility = useCallback((visible: boolean) => {\n    setRaceDayFourBarVisible(visible);\n  }, []);', 'const reportRaceDayFourBarVisibility = (visible: boolean) => {\n    setRaceDayFourBarVisible(visible);\n  };', 'stable callback removed');
e1Kill('raceweekend-callback-unstable', !appSourcePasses(unstableCallback));

type EffectCleanup = void | (() => void);
type RaceReporter = (fourBarOpen: boolean, onFourBarVisibilityChange: (visible: boolean) => void, useEffect: (effect: () => EffectCleanup, dependencies: unknown[]) => void) => void;
const raceReporterBlock = (input: string): string => {
  const start = input.indexOf('  // App owns contextual help routing; report this child-local sheet state.');
  const end = input.indexOf('  // Weekend pending delete stays hidden everywhere until undo/commit resolves.', start);
  e1Ok(start !== -1 && end !== -1, 'E1 real RaceWeekend visibility reporter extracts');
  return input.slice(start, end);
};
const compileRaceReporter = (input: string): RaceReporter => {
  const wrapped = `export const runRaceReporter = (fourBarOpen, onFourBarVisibilityChange, useEffect) => {\n${raceReporterBlock(input)}\n};`;
  const compiled = transformSync(wrapped, { loader: 'tsx', format: 'cjs', target: 'es2022' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compiled)(moduleBox, moduleBox.exports);
  return moduleBox.exports.runRaceReporter as RaceReporter;
};
const runRaceReporter = (input: string, visible: boolean) => {
  const events: boolean[] = [];
  const cleanups: Array<() => void> = [];
  compileRaceReporter(input)(visible, value => events.push(value), effect => {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  });
  return { events, unmount: () => cleanups.reverse().forEach(cleanup => cleanup()) };
};
const raceSourcePasses = (input: string): boolean => /onFourBarVisibilityChange\?: \(visible: boolean\) => void;/.test(input)
  && /onOpenFourBar=\{\(\) => setFourBarOpen\(true\)\}/.test(input)
  && /useBackClosable\(fourBarOpen, \(\) => setFourBarOpen\(false\)\);/.test(input)
  && /<BottomSheet open=\{fourBarOpen\} onClose=\{\(\) => setFourBarOpen\(false\)\}/.test(input)
  && /onFourBarVisibilityChange\?\.\(fourBarOpen\);/.test(input)
  && /useEffect\(\(\) => \(\) => \{\n    onFourBarVisibilityChange\?\.\(false\);\n  \}, \[onFourBarVisibilityChange\]\);/.test(input);
e1Ok(raceSourcePasses(weekendView), 'E1 RaceWeekend source reports every FourBar lifecycle route');
const openReporter = runRaceReporter(weekendView, true);
e1Equal(openReporter.events.length, 1, 'E1 real RaceWeekend reporter emits one current-state event');
e1Equal(openReporter.events[0], true, 'E1 real RaceWeekend reporter publishes true when open');
openReporter.unmount();
e1Equal(openReporter.events.at(-1), false, 'E1 real RaceWeekend reporter clears false on unmount');
e1Equal(runRaceReporter(weekendView, false).events[0], false, 'E1 real RaceWeekend reporter publishes false when closed');

const trueSignalRemoved = e1Replace(weekendView, 'onFourBarVisibilityChange?.(fourBarOpen);', 'if (!fourBarOpen) onFourBarVisibilityChange?.(fourBarOpen);', 'open true signal removed');
e1Kill('raceweekend-open-true-signal-removed', runRaceReporter(trueSignalRemoved, true).events[0] !== true);
const closeSignalRemoved = e1Replace(weekendView, 'onFourBarVisibilityChange?.(fourBarOpen);', 'if (fourBarOpen) onFourBarVisibilityChange?.(fourBarOpen);', 'close false signal removed');
e1Kill('raceweekend-close-false-signal-removed', runRaceReporter(closeSignalRemoved, false).events[0] !== false);
const unmountSignalRemoved = e1Replace(weekendView, 'useEffect(() => () => {\n    onFourBarVisibilityChange?.(false);\n  }, [onFourBarVisibilityChange]);', 'useEffect(() => () => undefined, [onFourBarVisibilityChange]);', 'unmount false signal removed');
const unmountMutationRun = runRaceReporter(unmountSignalRemoved, true);
unmountMutationRun.unmount();
e1Kill('raceweekend-unmount-false-signal-removed', unmountMutationRun.events.at(-1) !== false);
const backCloseRemoved = e1Replace(weekendView, 'useBackClosable(fourBarOpen, () => setFourBarOpen(false));', 'useBackClosable(fourBarOpen, () => setFourBarOpen(true));', 'Android back close removed');
e1Kill('raceweekend-android-back-close-removed', !raceSourcePasses(backCloseRemoved));
const sheetCloseRemoved = e1Replace(weekendView, '<BottomSheet open={fourBarOpen} onClose={() => setFourBarOpen(false)}', '<BottomSheet open={fourBarOpen} onClose={() => setFourBarOpen(true)}', 'sheet close removed');
e1Kill('raceweekend-sheet-close-removed', !raceSourcePasses(sheetCloseRemoved));
const openSignalRemoved = e1Replace(weekendView, 'onOpenFourBar={() => setFourBarOpen(true)}', 'onOpenFourBar={() => setFourBarOpen(false)}', 'sheet open removed');
e1Kill('raceweekend-sheet-open-removed', !raceSourcePasses(openSignalRemoved));

const nestedHelpCount = (input: string) => input.match(/onHelp=\{onHelp\}/g)?.length ?? 0;
const setupSourcePasses = (input: string): boolean => !/aria-label="Setup help"|title="Setup sheet help"|onHelp\('setup'\)/.test(input)
  && /onHelp\?: \(section: string\) => void;/.test(input)
  && nestedHelpCount(input) >= 3;
e1Ok(setupSourcePasses(setupView), 'E1 removes only Setup header help and retains nested forwarding');
e1Equal(nestedHelpCount(setupView) >= 3, true, 'E1 Setup keeps FourBar, Loads, and Diff prop routes');
const setupInlineRestored = e1Replace(setupView, '        </div>\n        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">', '          {onHelp && <button aria-label="Setup help" onClick={() => onHelp(\'setup\')} />}\n        </div>\n        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">', 'Setup inline help restored');
e1Kill('setup-inline-help-restored', !setupSourcePasses(setupInlineRestored));
const nestedHelpRemoved = e1Replace(setupView, '                        onHelp={onHelp}\n', '', 'nested FourBar help forwarding removed');
e1Kill('setup-nested-help-forwarding-removed', !setupSourcePasses(nestedHelpRemoved));

const fourBarHash = (input: string) => createHash('sha256').update(input).digest('hex');
const acceptedFourBarHash = 'f7d4c8ff1ec216c186bd70f1fce5cf7cbcd9f9893305bf6a890703b9027cf56c';
const fourBarSourcePasses = (input: string): boolean => fourBarHash(input) === acceptedFourBarHash
  && /onClick=\{\(\) => onHelp\('four-bar'\)\}/.test(input)
  && /min-h-11 min-w-11/.test(input);
e1Ok(fourBarSourcePasses(fourBarView), 'E1 FourBarQuickAdjust stays byte-frozen with exact inline four-bar route');
const fourBarHelpRemoved = e1Replace(fourBarView, "onClick={() => onHelp('four-bar')}", 'onClick={() => undefined}', 'FourBar inline help removed');
e1Kill('fourbar-inline-help-removed', !fourBarSourcePasses(fourBarHelpRemoved));
const fourBarTargetChanged = e1Replace(fourBarView, "onHelp('four-bar')", "onHelp('setup')", 'FourBar target changed');
e1Kill('fourbar-inline-target-changed', !fourBarSourcePasses(fourBarTargetChanged));

e1Equal(new Set(killedE1Mutations).size, killedE1Mutations.length, 'E1 mutation labels are unique');
e1Ok(killedE1Mutations.length >= 20, 'E1 kills at least twenty independent mutation classes');
console.log(`E1 assertions: ${e1AssertionCount}`);
console.log(`E1 killed mutations (${killedE1Mutations.length}): ${killedE1Mutations.join(', ')}`);

assert.match(bottomSheet, /useBackClosable\(open, onClose\)/);
assert.match(bottomSheet, /sheet-scrim.*onClick=\{onClose\}/);
for (const heading of ['Creating a setup', 'Recording four-bar measurements', 'Adding load sessions', 'Comparing setups']) {
  assert.match(userGuide, new RegExp(`## ${heading}`, 'i'));
}
assert.match(userGuide, /At 90% of its configured limit/);
assert.doesNotMatch(setupView, /onHelp\('setup'\)|aria-label="Setup help"/);
assert.match(fourBarView, /onHelp\('four-bar'\)/);
assert.match(setupView, /buildSetupReport\(target\)/);
assert.doesNotMatch(setupView, /buildSetupReport\(target, activeSession\)/);
assert.match(loadsView, /onHelp\('loads'\)/);
assert.match(diffView, /onHelp\('setup-diff'\)/);
assert.match(quickRef, /<strong>High:<\/strong> Try first\./);
assert.match(quickRef, /<strong>Medium:<\/strong> Try this next if the first change did not fix the problem\./);
assert.match(quickRef, /<strong>Low:<\/strong> Fine-tuning after the bigger items are checked\./);
assert.match(weekendView, /Share Race Day PDF/);
assert.doesNotMatch(pdfSource, /from ['"]react['"]/);
assert.doesNotMatch([quickRef, setupView, weekendView].join('\n'), /AFCO|chassis-specific|package-specific|Package-dependent|Share with Team|Start New Logger Session|Shock Adjustment Handling Impacts|Adjustment Matrix/i);
const quickReferenceDataStart = quickRef.indexOf('const BEHAVIOR_DATA:');
const quickReferenceComponentStart = quickRef.indexOf('export default function QuickReferenceView');
assert.notEqual(quickReferenceDataStart, -1);
assert.notEqual(quickReferenceComponentStart, -1);
const translatedAdjustmentData = quickRef.slice(quickReferenceDataStart, quickReferenceComponentStart);
const directQuickReferenceCopy = quickRef.slice(quickReferenceComponentStart);
assert.match(translatedAdjustmentData, /rear roll center[\s\S]*weight transfer[\s\S]*rear steer geometry[\s\S]*apex/i);
assert.match(directQuickReferenceCopy, /\{plainRacerEffect\(adj\.effect\)\}/);
const researchedEffectLiteral = /effect:\s*'(?:\\.|[^'\\])*'/g;
const untranslatedAdjustmentLabels = translatedAdjustmentData.replace(researchedEffectLiteral, 'effect: translated-at-render');
assert.doesNotMatch(
  `${untranslatedAdjustmentLabels}\n${directQuickReferenceCopy}`,
  /trailing arm geometry|rear roll center|\broll center\b|(?:chassis|body) roll|\bweight transfer(?:s)?\b|\bapex\b|\banti-squat\b|\broll steer\b|(?:mechanical|vertical) clamping force|(?:tire )?(?:footprint|contact patch)|directional stability|\blateral\b|\bdeceleration\b|\bacceleration\b|\bkinematic(?:s)?\b|AFCO|chassis-specific|package-specific|Package-dependent/i,
);
const encodedEffects = [...translatedAdjustmentData.matchAll(/effect:\s*'((?:\\.|[^'\\])*)'/g)].map(match => match[1]);
assert.equal(encodedEffects.length, (translatedAdjustmentData.match(/\beffect:/g) ?? []).length);
const decodeSingleQuotedLiteral = (encoded: string) => encoded.replace(/\\(['\\nrt])/g, (_match, token: string) => ({
  "'": "'",
  '\\': '\\',
  n: '\n',
  r: '\r',
  t: '\t',
})[token] ?? token);
const renderedEffectCorpus = encodedEffects.map(effect => plainRacerEffect(decodeSingleQuotedLiteral(effect))).join('\n');
assert.doesNotMatch(
  renderedEffectCorpus,
  /rear roll center|\broll center\b|(?:chassis|body) roll|\bweight transfer(?:s)?\b|\bapex\b|\banti-squat\b|\broll steer\b|rear steer geometry|trailing arm (?:design angles?|geometry)|(?:mechanical|vertical) clamping force|(?:tire )?(?:footprint|contact patch)|\blateral (?:roll |cornering )?forces?\b|\bdeceleration\b|\bacceleration\b|\bdynamically\b|\bprogressive(?:ly)?\b|\bcompliant\b|forward pitch|rear steer onset|leverage arc|vertical downward pressure|pull bar compliance|mechanical changes?/i,
);
assert.doesNotMatch(
  renderedEffectCorpus,
  /\b([a-z]{3,})[\s,]+\1\b|under the car leaning|during weight moving|all how fast weight moves|promoting the car leaning|direct weight moving|weight moving (?:cushions|off)|part of the (?:RR )?tire on the track on|smoothly and smoothly|the car to lean the car leaning|under getting on the gas/i,
);
assert.doesNotMatch(
  `${renderedEffectCorpus}\n${directQuickReferenceCopy}`,
  /part of the (?:RR )?tire (?:touching|on) the track|\bweight moving\b|\bcar leaning\b|how the car sits|controls the how|rear steer starts|loading smoothly the rear/i,
);
assert.doesNotMatch(renderedEffectCorpus, /(?:allows|resists|keeps|on) The car/);
assert.doesNotMatch(renderedEffectCorpus, /(?:^|[.!?]\s+)[a-z]/m);
assert.doesNotMatch(renderedEffectCorpus, /allowing controlled car roll and allowing|cushions the rear against the rear snapping loose|highly free-moving|under the power|while at the same time|resists the chassis from rolling|keeping rear tire loading|cushioning the tire contact|maximum mechanical forward traction|allows weight to transfer/i);
assert.equal(
  plainRacerEffect('Lowering the frame-side J-bar lowers the rear roll center, promoting progressive body roll and allowing the car to turn in more easily. The rear transfers weight more gradually.'),
  'Lowering the frame-side J-bar lowers the rear roll location, allowing controlled car roll and helping the car to turn in more easily. The rear shifts load more gradually.',
);
assert.equal(
  plainRacerEffect('Increasing RR compression controls the rate at which side bite builds on the RR tire. The controlled weight transfer cushions the rear against snap oversteer at the apex.'),
  'Increasing RR compression controls the side-bite buildup rate on the RR tire. The controlled load shift reduces sudden rear breakaway at mid-corner.',
);
assert.match(
  plainRacerEffect('This provides the same entry roll rate as a single spring but delivers a softer, highly compliant exit rate for ultimate traction.'),
  /softer, more controlled exit response/,
);
assert.equal(
  plainRacerEffect('Increasing RF compression resists the chassis from rolling rapidly onto the RF tire.'),
  'Increasing RF compression slows how quickly the car rolls onto the RF tire.',
);
assert.equal(
  plainRacerEffect('A stiffer RR spring resists the chassis from rolling too far onto the RR.'),
  'A stiffer RR spring keeps the car from rolling too far onto the RR.',
);
assert.equal(
  plainRacerEffect('The chassis stays level longer, preserving rear tire loading.'),
  'The chassis stays level longer, keeping load on the rear tires.',
);
assert.equal(
  plainRacerEffect('Decreasing RR compression allows the chassis to roll smoothly onto the RR tire, cushioning the tire contact patch and maximizing side bite.'),
  'Decreasing RR compression allows the chassis to roll smoothly onto the RR tire, building RR side bite smoothly.',
);
assert.equal(
  plainRacerEffect('Maximum mechanical forward traction.'),
  'This adds maximum forward bite.',
);
assert.equal(
  plainRacerEffect('Softening RR compression allows weight to transfer rapidly and smoothly to the outside tire.'),
  'Softening RR compression lets load build quickly and smoothly on the outside tire.',
);
const shopCopy = plainRacerEffect('The rear roll center changes forward weight transfer and rear steer geometry at the apex. This preserves the tire contact patch during braking transitions.');
assert.equal(shopCopy, 'The rear roll location changes forward load shift and bar angles and rear steer at mid-corner. This keeps the tire contact during braking.');
assert.doesNotMatch(shopCopy, /roll center|weight transfer|geometry|apex|contact patch|transition/i);
assert.match(shopCopy, /rear roll location|forward load shift|tire contact/);

console.log('Chunk 9 export/help/share harness PASS');
