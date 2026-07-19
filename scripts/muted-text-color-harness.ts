import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const parentCommit = 'a68731a531d07d9dba9bec8f3a166731d3a597b8';
const uxp17Commit = '89845e84458fa11a5d8edda046bb747abdc98311';
const phoneLayoutParentCommit = '38e9828b51386f41c981745c27400bd501c10fee';
const phoneLayoutCommit = 'd0477911cc8f23ac3bbfc54e67f294d9618e8f74';
const c3ParentCommit = '3559282fc02f5e28d24e08155673defeab060e4c';
const c3Commit = 'e8d70165ca7600e3b47d597e444fc953e6624fc7';
const d3ParentCommit = '0cb5d8c2c96331a9fb85436229d2638c20502d35';
const d3Commit = '120fa72632587c72ea1ab6122aff34cd9a393533';
const cssPath = 'src/index.css';
const raceWeekendPath = 'src/components/RaceWeekendView.tsx';
const setupPath = 'src/components/SetupView.tsx';
const fourBarPath = 'src/components/FourBarQuickAdjust.tsx';
const historicalCounts = new Map<string, number>([
  ['src/App.tsx', 6],
  ['src/components/AuthView.tsx', 10],
  ['src/components/DashboardView.tsx', 4],
  ['src/components/ExportView.tsx', 2],
  ['src/components/GarageView.tsx', 5],
  ['src/components/GetRaceReadyCard.tsx', 1],
  ['src/components/GuideView.tsx', 1],
  ['src/components/QuickReferenceView.tsx', 3],
  [raceWeekendPath, 16],
  ['src/components/SettingsView.tsx', 6],
  ['src/components/SetupDiffView.tsx', 2],
  [setupPath, 16],
  ['src/components/SmasherLoadsView.tsx', 15],
  ['src/components/TeamView.tsx', 5],
  ['src/components/ToDoView.tsx', 1],
  ['src/components/TrackersView.tsx', 12],
]);
const currentDeltas = new Map<string, number>([
  [setupPath, 1],
  [raceWeekendPath, -1],
]);
const currentCounts = new Map([...historicalCounts].map(([path, count]) => [
  path,
  count + (currentDeltas.get(path) ?? 0),
]));

const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');
const read = (path: string) => normalizeEol(readFileSync(join(root, path), 'utf8'));
const readCommit = (commit: string, path: string) => normalizeEol(execFileSync(
  'git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8' },
));
const resolveCommit = (ref: string) => execFileSync(
  'git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' },
).trim();
const gitLines = (...args: string[]) => normalizeEol(execFileSync(
  'git', args, { cwd: root, encoding: 'utf8' },
)).split('\n').filter(Boolean);
const countMatches = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length;
const countLiteral = (source: string, value: string) => source.split(value).length - 1;
const replaceExact = (source: string, current: string, replacement: string, expected: number, label: string) => {
  const count = countLiteral(source, current);
  assert.equal(count, expected, `${label}: exact current count`);
  return source.split(current).join(replacement);
};
const tryReplaceExact = (source: string, current: string, replacement: string, expected: number): string | null => (
  countLiteral(source, current) === expected ? source.split(current).join(replacement) : null
);
const sourceFiles = (directory: string): string[] => readdirSync(join(root, directory), { withFileTypes: true })
  .flatMap(entry => {
    const relative = join(directory, entry.name).replace(/\\/g, '/');
    return entry.isDirectory() ? sourceFiles(relative) : /\.tsx?$/.test(entry.name) ? [relative] : [];
  });

let assertionCount = 0;
const killedMutations: string[] = [];
const countedEqual = (actual: unknown, expected: unknown, message: string): void => {
  assertionCount += 1;
  assert.equal(actual, expected, message);
};
const countedDeepEqual = (actual: unknown, expected: unknown, message: string): void => {
  assertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const countedOk: (value: unknown, message: string) => asserts value = (value, message) => {
  assertionCount += 1;
  assert.ok(value, message);
};
const countedMatch = (source: string, pattern: RegExp, message: string): void => {
  assertionCount += 1;
  assert.match(source, pattern, message);
};
const countedDoesNotMatch = (source: string, pattern: RegExp, message: string): void => {
  assertionCount += 1;
  assert.doesNotMatch(source, pattern, message);
};
const killMutation = (name: string, changed: boolean, killed: boolean): void => {
  countedEqual(changed, true, `${name}: changes intended source`);
  countedEqual(killed, true, `${name}: killed by advertised contract`);
  killedMutations.push(name);
};

const oldAlpha = /text-on-surface-variant\/(20|30|40|50|60|70|80)\b/g;
const anyMuted = /text-on-surface-muted\b/g;
const removedCompareClass = "'text-on-surface-muted opacity-40 cursor-not-allowed'";
const historicalExceptionNormalizations = new Map<string, Array<[string, string]>>([
  ['src/components/GarageView.tsx', [[
    'text-on-surface-muted opacity-20 cursor-not-allowed',
    'text-on-surface-muted cursor-not-allowed',
  ]]],
  [raceWeekendPath, [
    [
      'border-outline-variant/50 text-on-surface-muted opacity-50 cursor-not-allowed',
      'border-outline-variant/50 text-on-surface-muted cursor-not-allowed',
    ],
    [
      removedCompareClass,
      "'text-on-surface-muted cursor-not-allowed'",
    ],
  ]],
  [setupPath, [
    [
      'border-outline-variant/30 text-on-surface-muted opacity-30 cursor-not-allowed',
      'border-outline-variant/30 text-on-surface-muted cursor-not-allowed',
    ],
    [
      "'text-on-surface-muted opacity-30 cursor-not-allowed'",
      "'text-on-surface-muted cursor-not-allowed'",
    ],
    [
      'text-on-surface-variant hover:text-red-400 transition-colors rounded disabled:text-on-surface-muted disabled:opacity-40',
      'text-on-surface-variant hover:text-red-400 transition-colors rounded',
    ],
  ]],
  ['src/components/QuickReferenceView.tsx', [[
    'material-symbols-outlined text-on-surface-muted opacity-40 text-3xl">search_off',
    'material-symbols-outlined text-on-surface-muted text-3xl">search_off',
  ]]],
  ['src/components/SmasherLoadsView.tsx', [[
    'material-symbols-outlined text-5xl text-on-surface-muted opacity-30">show_chart',
    'material-symbols-outlined text-5xl text-on-surface-muted">show_chart',
  ]]],
]);
const currentExceptionSites = [...historicalExceptionNormalizations]
  .flatMap(([path, entries]) => entries.map(([site]) => ({ path, site })))
  .filter(({ path, site }) => (
    !(path === raceWeekendPath && site === removedCompareClass)
    && !(path === 'src/components/GarageView.tsx' && site.includes('opacity-20'))
  ));

const restoreHistoricalComponent = (path: string, implementation: string): string | null => {
  const parent = readCommit(parentCommit, path);
  const parentTokens = [...parent.matchAll(oldAlpha)].map(match => match[0]);
  const expectedCount = historicalCounts.get(path);
  if (expectedCount === undefined || parentTokens.length !== expectedCount) return null;
  if (countMatches(implementation, oldAlpha) !== 0) return null;
  if (countMatches(implementation, anyMuted) !== expectedCount + (path === setupPath ? 1 : 0)) return null;
  let normalized: string | null = implementation;
  for (const [site, replacement] of historicalExceptionNormalizations.get(path) ?? []) {
    normalized = tryReplaceExact(normalized, site, replacement, 1);
    if (normalized === null) return null;
  }
  if (countMatches(normalized, anyMuted) !== parentTokens.length) return null;
  let tokenIndex = 0;
  normalized = normalized.replace(anyMuted, () => parentTokens[tokenIndex++]);
  return tokenIndex === parentTokens.length && normalized === parent ? normalized : null;
};
const historicalComponentPasses = (path: string, implementation: string): boolean => (
  restoreHistoricalComponent(path, implementation) !== null
);

const historicalCssPasses = (implementationCss: string): boolean => {
  let normalized: string | null = implementationCss;
  normalized = tryReplaceExact(normalized, '  --color-on-surface-muted: #bea5a2;\n', '', 1);
  if (normalized === null) return false;
  normalized = tryReplaceExact(normalized, '  --color-on-surface-muted: #715c59;\n', '', 1);
  if (normalized === null) return false;
  const sentinel = '/* Light-mode metadata must not lose contrast through Tailwind alpha suffixes. */\n';
  const removedVariantHack = 'html[data-theme="light"] [class*="text-on-surface-variant/"] {\n  color: var(--color-on-surface-variant) !important;\n}\n\n';
  normalized = tryReplaceExact(normalized, sentinel, sentinel + removedVariantHack, 1);
  return normalized === readCommit(parentCommit, cssPath);
};

const phoneLayoutPasses = (implementation: string): boolean => {
  let normalized: string | null = implementation;
  normalized = tryReplaceExact(
    normalized,
    'grid grid-cols-1 gap-2 min-[360px]:grid-cols-3',
    'grid grid-cols-1 gap-2 sm:grid-cols-3',
    1,
  );
  if (normalized === null) return false;
  normalized = tryReplaceExact(
    normalized,
    'grid grid-cols-1 gap-2 min-[360px]:grid-cols-2',
    'grid grid-cols-1 gap-2 sm:grid-cols-2',
    1,
  );
  return normalized === readCommit(phoneLayoutParentCommit, fourBarPath);
};

const c3ReplacementPasses = (implementation: string, current: string): boolean => {
  const parent = readCommit(c3ParentCommit, raceWeekendPath);
  return countMatches(parent, anyMuted) === 16
    && countMatches(implementation, anyMuted) === 15
    && countLiteral(parent, removedCompareClass) === 1
    && countLiteral(parent, 'Compare setup') === 1
    && countLiteral(implementation, removedCompareClass) === 0
    && countLiteral(implementation, 'Compare setup') === 0
    && countLiteral(implementation, 'Bound setup changes') === 1
    && countLiteral(implementation, 'Log setup changes') === 1
    && countLiteral(current, removedCompareClass) === 0
    && countLiteral(current, 'Compare setup') === 0
    && countLiteral(current, 'Bound setup changes') === 1
    && countLiteral(current, 'Log setup changes') === 1;
};

const d3GarageReplacementPasses = (implementation: string, current: string): boolean => {
  const path = 'src/components/GarageView.tsx';
  const parent = readCommit(d3ParentCommit, path);
  const removedDisabledClass = 'text-on-surface-muted opacity-20 cursor-not-allowed';
  return countLiteral(parent, removedDisabledClass) === 1
    && countLiteral(implementation, removedDisabledClass) === 0
    && countLiteral(implementation, "'text-on-surface-muted text-red-400'") === 1
    && countLiteral(implementation, "'text-on-surface-muted hover:text-red-400'") === 1
    && countLiteral(current, removedDisabledClass) === 0
    && countLiteral(current, "'text-on-surface-muted text-red-400'") === 1
    && countLiteral(current, "'text-on-surface-muted hover:text-red-400'") === 1;
};

const currentCssPasses = (css: string): boolean => countMatches(css, /--color-on-surface-muted:/g) === 2
  && countLiteral(css, '--color-on-surface-muted: #bea5a2;') === 1
  && countLiteral(css, '--color-on-surface-muted: #715c59;') === 1
  && !/\[class\*="text-on-surface-variant\/"\]/.test(css)
  && /html\[data-theme="light"\] \[class\*="text-primary\/"\] \{\s*color: var\(--color-primary\) !important;\s*\}/.test(css)
  && countLiteral(css, '/* Light-mode metadata must not lose contrast through Tailwind alpha suffixes. */') === 1;
const currentSourcesPass = (sources: Map<string, string>, css: string): boolean => {
  const allSource = [...sources.values()].join('\n');
  if (countMatches(allSource, oldAlpha) !== 0 || /#bea5a2|#715c59/i.test(allSource)) return false;
  let total = 0;
  for (const [path, expected] of currentCounts) {
    const source = sources.get(path);
    if (!source || countMatches(source, anyMuted) !== expected) return false;
    total += countMatches(source, anyMuted);
  }
  if (total !== 105) return false;
  const mutedFiles = [...sources]
    .filter(([, source]) => countMatches(source, anyMuted) > 0)
    .map(([path]) => path)
    .sort();
  if (JSON.stringify(mutedFiles) !== JSON.stringify([...historicalCounts.keys()].sort())) return false;
  if (currentExceptionSites.length !== 6) return false;
  if (currentExceptionSites.some(({ path, site }) => countLiteral(sources.get(path) ?? '', site) !== 1)) return false;
  const race = sources.get(raceWeekendPath) ?? '';
  return countLiteral(race, removedCompareClass) === 0
    && countLiteral(race, 'Compare setup') === 0
    && countLiteral(race, 'Bound setup changes') === 1
    && countLiteral(race, 'Log setup changes') === 1
    && currentCssPasses(css);
};

countedEqual(resolveCommit('a68731a'), parentCommit, 'historical parent ref pinned');
countedEqual(resolveCommit('89845e8'), uxp17Commit, 'UXP-17 implementation ref pinned');
countedEqual(resolveCommit(`${uxp17Commit}^`), parentCommit, 'UXP-17 exact parent pinned');
countedEqual(resolveCommit('d047791'), phoneLayoutCommit, 'phone-layout implementation ref pinned');
countedEqual(resolveCommit(`${phoneLayoutCommit}^`), phoneLayoutParentCommit, 'phone-layout exact parent pinned');
countedEqual(resolveCommit('e8d7016'), c3Commit, 'C3 implementation ref pinned');
countedEqual(resolveCommit(`${c3Commit}^`), c3ParentCommit, 'C3 exact parent pinned');
countedEqual(resolveCommit('120fa72'), d3Commit, 'D3 implementation ref pinned');
countedEqual(resolveCommit(`${d3Commit}^`), d3ParentCommit, 'D3 exact parent pinned');

const currentSourcePaths = sourceFiles('src');
const allCurrentSource = currentSourcePaths.map(path => ({ path, source: read(path) }));
const currentSourceMap = new Map(allCurrentSource.map(file => [file.path, file.source]));
const currentCss = read(cssPath);
countedEqual(allCurrentSource.reduce((sum, file) => sum + countMatches(file.source, oldAlpha), 0), 0, 'current global old alpha utility count');
countedDoesNotMatch(allCurrentSource.map(file => file.source).join('\n'), /#bea5a2|#715c59/i, 'replacement hex stays out of current JSX/TS');

const parentHitFiles = gitLines(
  'grep', '-l', '-E', 'text-on-surface-variant/(20|30|40|50|60|70|80)', parentCommit, '--', 'src',
).map(line => line.replace(`${parentCommit}:`, '')).sort();
countedDeepEqual(parentHitFiles, [...historicalCounts.keys()].sort(), 'exact sixteen historical parent migration files');
const historicalChangedFiles = gitLines('diff', '--name-only', parentCommit, uxp17Commit, '--', 'src').sort();
countedDeepEqual(historicalChangedFiles, [cssPath, ...historicalCounts.keys()].sort(), 'exact seventeen UXP-17 changed source files including CSS');

let historicalAlphaTotal = 0;
let historicalMutedTotal = 0;
let currentMutedTotal = 0;
for (const [path, historicalCount] of historicalCounts) {
  const parent = readCommit(parentCommit, path);
  const implementation = readCommit(uxp17Commit, path);
  const parentTokens = [...parent.matchAll(oldAlpha)].map(match => match[0]);
  const historicalRawMuted = countMatches(implementation, anyMuted);
  const expectedCurrent = currentCounts.get(path);
  const currentMuted = countMatches(read(path), anyMuted);
  countedEqual(parentTokens.length, historicalCount, `${path}: exact historical alpha inventory`);
  countedEqual(countMatches(implementation, oldAlpha), 0, `${path}: UXP-17 implementation old alpha zero`);
  countedEqual(historicalRawMuted, historicalCount + (path === setupPath ? 1 : 0), `${path}: exact UXP-17 muted inventory`);
  countedOk(historicalComponentPasses(path, implementation), `${path}: historical reverse-byte proof uses 89845e8 bytes`);
  countedEqual(currentMuted, expectedCurrent, `${path}: exact current muted inventory with modeled delta`);
  countedEqual(countMatches(read(path), oldAlpha), 0, `${path}: current old alpha zero`);
  historicalAlphaTotal += parentTokens.length;
  historicalMutedTotal += historicalRawMuted;
  currentMutedTotal += currentMuted;
}
countedEqual(historicalAlphaTotal, 105, 'exact 105 historical alpha migrations');
countedEqual(historicalMutedTotal, 106, 'UXP-17 raw muted total includes one disabled Setup variant');
countedEqual(currentMutedTotal, 105, 'exact current muted total after Setup +1 and RaceWeekend -1');
countedEqual(currentCounts.get(setupPath), (historicalCounts.get(setupPath) ?? 0) + 1, 'current Setup delta is exact +1');
countedEqual(currentCounts.get(raceWeekendPath), (historicalCounts.get(raceWeekendPath) ?? 0) - 1, 'current RaceWeekend delta is exact -1');
for (const [path, currentCount] of currentCounts) {
  if (path === setupPath || path === raceWeekendPath) continue;
  countedEqual(currentCount, historicalCounts.get(path), `${path}: current delta is zero`);
}
const currentMutedFiles = allCurrentSource
  .filter(file => countMatches(file.source, anyMuted) > 0)
  .map(file => file.path)
  .sort();
countedDeepEqual(currentMutedFiles, [...historicalCounts.keys()].sort(), 'same exact sixteen current components contain muted utilities');

const historicalExceptionCount = [...historicalExceptionNormalizations.values()].reduce((sum, entries) => sum + entries.length, 0);
countedEqual(historicalExceptionCount, 8, 'exact eight historical opacity exceptions');
for (const [path, entries] of historicalExceptionNormalizations) {
  const implementation = readCommit(uxp17Commit, path);
  for (const [site] of entries) countedEqual(countLiteral(implementation, site), 1, `${path}: historical opacity exception exact`);
}
countedEqual(currentExceptionSites.length, 6, 'exact six surviving current opacity exceptions after C3 and D3');
for (const { path, site } of currentExceptionSites) {
  countedEqual(countLiteral(read(path), site), 1, `${path}: current opacity exception survives exactly once`);
}
countedEqual(countLiteral(read(raceWeekendPath), removedCompareClass), 0, 'removed C3 Compare opacity branch stays zero');
countedEqual(countLiteral(read(raceWeekendPath), 'Compare setup'), 0, 'removed C3 Compare action stays absent');
countedEqual(countMatches(read(setupPath), /disabled:text-on-surface-muted\b/g), 1, 'exact current disabled setup-delete muted variant');

const uxp17Css = readCommit(uxp17Commit, cssPath);
countedOk(historicalCssPasses(uxp17Css), 'historical CSS reverse-byte proof uses 89845e8 bytes');
countedOk(phoneLayoutPasses(readCommit(phoneLayoutCommit, fourBarPath)), 'phone-layout reversal uses d047791 implementation bytes');
const c3RaceWeekend = readCommit(c3Commit, raceWeekendPath);
countedOk(c3ReplacementPasses(c3RaceWeekend, read(raceWeekendPath)), 'C3 exact -1 and bound-summary/Log replacement remain pinned');
const d3Garage = readCommit(d3Commit, 'src/components/GarageView.tsx');
countedOk(d3GarageReplacementPasses(d3Garage, read('src/components/GarageView.tsx')), 'D3 Garage opacity exception removal and pending/delete states remain pinned');

countedEqual(countMatches(currentCss, /--color-on-surface-muted:/g), 2, 'current exact dark/light muted token declarations');
countedMatch(currentCss, /--color-on-surface-muted: #bea5a2;/, 'current exact dark muted token');
countedMatch(currentCss, /html\[data-theme="light"\][\s\S]*--color-on-surface-muted: #715c59;/, 'current exact light muted token');
countedDoesNotMatch(currentCss, /\[class\*="text-on-surface-variant\/"\]/, 'current light variant-alpha hack removed');
countedMatch(currentCss, /html\[data-theme="light"\] \[class\*="text-primary\/"\] \{\s*color: var\(--color-primary\) !important;\s*\}/, 'independent primary-alpha hack preserved');
countedEqual(countLiteral(currentCss, '/* Light-mode metadata must not lose contrast through Tailwind alpha suffixes. */'), 1, 'semantic-status light metadata sentinel preserved');

const themeBlock = currentCss.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
const lightBlock = currentCss.match(/html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
countedOk(themeBlock && lightBlock, 'current dark and light token blocks exist');
const tokenValue = (block: string, name: string) => {
  const value = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1];
  countedOk(value, `current token exists: ${name}`);
  return value;
};
const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const luminance = (hex: string) => rgb(hex)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};
const contrastContracts = [
  {
    label: 'dark', block: themeBlock, muted: '#bea5a2', onSurface: tokenValue(themeBlock, 'on-surface'),
    surfaces: ['surface', 'surface-container', 'surface-container-high', 'surface-container-highest', 'surface-bright'],
  },
  {
    label: 'light', block: lightBlock, muted: '#715c59', onSurface: tokenValue(lightBlock, 'on-surface'),
    surfaces: ['surface', 'surface-container', 'surface-container-high', 'surface-container-highest', 'surface-variant'],
  },
] as const;
for (const contract of contrastContracts) {
  countedEqual(tokenValue(contract.block, 'on-surface-muted').toLowerCase(), contract.muted, `${contract.label} muted exact`);
  for (const surfaceName of contract.surfaces) {
    const background = tokenValue(contract.block, surfaceName);
    const mutedRatio = contrast(contract.muted, background);
    const fullRatio = contrast(contract.onSurface, background);
    countedOk(mutedRatio >= 4.5, `${contract.label} muted/${surfaceName} contrast ${mutedRatio.toFixed(2)} >= 4.5`);
    countedOk(mutedRatio < fullRatio, `${contract.label} muted remains secondary on ${surfaceName}`);
  }
}
for (const family of ['success', 'on-success', 'success-container', 'on-success-container', 'warning', 'on-warning', 'warning-container', 'on-warning-container', 'error', 'on-error', 'error-container', 'on-error-container']) {
  countedOk(currentCss.includes(`--color-${family}:`), `UXP-15 current token family preserved: ${family}`);
}
countedOk(currentSourcesPass(currentSourceMap, currentCss), 'combined current UXP-17/C3 contract passes');

const withCurrentSource = (path: string, source: string) => new Map(currentSourceMap).set(path, source);
const raceCurrent = read(raceWeekendPath);
const setupCurrent = read(setupPath);
const firstCurrentMuted = 'text-on-surface-muted';

const compareReintroduced = `${raceCurrent}\n<button className={${removedCompareClass}}>Compare setup</button>\n`;
killMutation(
  'removed-compare-muted-site-reintroduced',
  compareReintroduced !== raceCurrent,
  !currentSourcesPass(withCurrentSource(raceWeekendPath, compareReintroduced), currentCss),
);

const raceDeltaLost = `${raceCurrent}\n<span className="text-on-surface-muted">stale</span>\n`;
killMutation(
  'accepted-race-minus-one-delta-lost',
  raceDeltaLost !== raceCurrent,
  !currentSourcesPass(withCurrentSource(raceWeekendPath, raceDeltaLost), currentCss),
);

const currentMutedRemoved = setupCurrent.replace(firstCurrentMuted, 'text-on-surface-variant');
killMutation(
  'current-muted-token-removed',
  currentMutedRemoved !== setupCurrent,
  !currentSourcesPass(withCurrentSource(setupPath, currentMutedRemoved), currentCss),
);

const currentDeclarationRemoved = currentCss.replace('  --color-on-surface-muted: #bea5a2;\n', '');
killMutation(
  'current-muted-declaration-removed',
  currentDeclarationRemoved !== currentCss,
  !currentSourcesPass(currentSourceMap, currentDeclarationRemoved),
);

const oldAlphaReturned = setupCurrent.replace(firstCurrentMuted, 'text-on-surface-variant/50');
killMutation(
  'current-old-alpha-utility-returned',
  oldAlphaReturned !== setupCurrent,
  !currentSourcesPass(withCurrentSource(setupPath, oldAlphaReturned), currentCss),
);

const historicalAuth = readCommit(uxp17Commit, 'src/components/AuthView.tsx');
const historicalMigrationChanged = historicalAuth.replace(firstCurrentMuted, 'text-on-surface-variant');
killMutation(
  'historical-migration-site-changed',
  historicalMigrationChanged !== historicalAuth,
  !historicalComponentPasses('src/components/AuthView.tsx', historicalMigrationChanged),
);

const historicalGarage = readCommit(uxp17Commit, 'src/components/GarageView.tsx');
const historicalExceptionChanged = historicalGarage.replace('opacity-20 cursor-not-allowed', 'opacity-30 cursor-not-allowed');
killMutation(
  'historical-opacity-exception-changed',
  historicalExceptionChanged !== historicalGarage,
  !historicalComponentPasses('src/components/GarageView.tsx', historicalExceptionChanged),
);

const historicalCssChanged = uxp17Css.replace('  --color-on-surface-muted: #bea5a2;\n', '');
killMutation(
  'historical-css-migration-changed',
  historicalCssChanged !== uxp17Css,
  !historicalCssPasses(historicalCssChanged),
);

const c3ReplacementRemoved = c3RaceWeekend.replace('Bound setup changes', 'Bound changes');
killMutation(
  'c3-bound-summary-replacement-removed',
  c3ReplacementRemoved !== c3RaceWeekend,
  !c3ReplacementPasses(c3ReplacementRemoved, raceCurrent),
);

const d3GarageReplacementRemoved = d3Garage.replace("'text-on-surface-muted text-red-400'", "'text-red-400'");
killMutation(
  'd3-garage-pending-muted-state-removed',
  d3GarageReplacementRemoved !== d3Garage,
  !d3GarageReplacementPasses(d3GarageReplacementRemoved, read('src/components/GarageView.tsx')),
);

const phoneLayoutImplementation = readCommit(phoneLayoutCommit, fourBarPath);
const phoneLayoutChanged = phoneLayoutImplementation.replace('min-[360px]:grid-cols-3', 'min-[361px]:grid-cols-3');
killMutation(
  'phone-layout-implementation-changed',
  phoneLayoutChanged !== phoneLayoutImplementation,
  !phoneLayoutPasses(phoneLayoutChanged),
);

countedEqual(new Set(killedMutations).size, killedMutations.length, 'mutation names unique');
countedEqual(killedMutations.length, 11, 'exact eleven independent mutations killed');
console.log(`Muted-text assertions: ${assertionCount}`);
console.log(`Muted-text killed mutations (${killedMutations.length}): ${killedMutations.join(', ')}`);
console.log('muted-text-color harness: PASS');
