import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const parentCommit = 'a68731a';
const uxp17Commit = '89845e8';
const phoneLayoutParentCommit = '38e9828';
const cssPath = 'src/index.css';
const expectedCounts = new Map<string, number>([
  ['src/App.tsx', 6],
  ['src/components/AuthView.tsx', 10],
  ['src/components/DashboardView.tsx', 4],
  ['src/components/ExportView.tsx', 2],
  ['src/components/GarageView.tsx', 5],
  ['src/components/GetRaceReadyCard.tsx', 1],
  ['src/components/GuideView.tsx', 1],
  ['src/components/QuickReferenceView.tsx', 3],
  ['src/components/RaceWeekendView.tsx', 16],
  ['src/components/SettingsView.tsx', 6],
  ['src/components/SetupDiffView.tsx', 2],
  ['src/components/SetupView.tsx', 16],
  ['src/components/SmasherLoadsView.tsx', 15],
  ['src/components/TeamView.tsx', 5],
  ['src/components/ToDoView.tsx', 1],
  ['src/components/TrackersView.tsx', 12],
]);

const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readParent = (path: string) => execFileSync(
  'git', ['show', `${parentCommit}:${path}`], { cwd: root, encoding: 'utf8' },
);
const readCommit = (commit: string, path: string) => execFileSync(
  'git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8' },
);
const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');
const countMatches = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length;
const replaceExact = (source: string, current: string, replacement: string, expected: number, label: string) => {
  const count = source.split(current).length - 1;
  assert.equal(count, expected, `${label}: exact current count`);
  return source.split(current).join(replacement);
};
const sourceFiles = (directory: string): string[] => readdirSync(join(root, directory), { withFileTypes: true })
  .flatMap(entry => {
    const relative = join(directory, entry.name).replace(/\\/g, '/');
    return entry.isDirectory() ? sourceFiles(relative) : /\.tsx?$/.test(entry.name) ? [relative] : [];
  });

const oldAlpha = /text-on-surface-variant\/(20|30|40|50|60|70|80)\b/g;
const anyMuted = /text-on-surface-muted\b/g;
const allCurrentSource = sourceFiles('src').map(path => ({ path, source: read(path) }));
assert.equal(allCurrentSource.reduce((sum, file) => sum + countMatches(file.source, oldAlpha), 0), 0, 'global old alpha utility count');
assert.doesNotMatch(allCurrentSource.map(file => file.source).join('\n'), /#bea5a2|#715c59/i, 'replacement hex stays out of JSX/TS');

const parentHitOutput = execFileSync(
  'git', ['grep', '-l', '-E', 'text-on-surface-variant/(20|30|40|50|60|70|80)', parentCommit, '--', 'src'],
  { cwd: root, encoding: 'utf8' },
).trim();
const parentHitFiles = parentHitOutput.split(/\r?\n/).map(line => line.replace(`${parentCommit}:`, '')).sort();
assert.deepEqual(parentHitFiles, [...expectedCounts.keys()].sort(), 'exact sixteen parent migration files');

let parentAlphaTotal = 0;
let currentMutedTotal = 0;
for (const [path, expectedCount] of expectedCounts) {
  const current = read(path);
  const parent = readParent(path);
  const parentTokens = [...parent.matchAll(oldAlpha)].map(match => match[0]);
  const currentMutedCount = countMatches(current, anyMuted);
  assert.equal(parentTokens.length, expectedCount, `${path}: exact parent alpha inventory`);
  assert.equal(currentMutedCount, expectedCount + (path === 'src/components/SetupView.tsx' ? 1 : 0), `${path}: exact muted inventory plus disabled-delete variant`);
  assert.equal(countMatches(current, oldAlpha), 0, `${path}: old alpha zero`);
  parentAlphaTotal += parentTokens.length;
  currentMutedTotal += currentMutedCount;
}
assert.equal(parentAlphaTotal, 105, 'exact authorized parent alpha inventory');
assert.equal(currentMutedTotal, 106, '105 authorized migrations plus one disabled setup-delete variant');

const migratedFiles = allCurrentSource
  .filter(file => countMatches(file.source, anyMuted) > 0)
  .map(file => file.path)
  .sort();
assert.deepEqual(migratedFiles, [...expectedCounts.keys()].sort(), 'new muted utility stays in exact sixteen components');

// Exact six disabled actions plus two decorative glyphs retain intentional dimming.
const exceptionNormalizations = new Map<string, Array<[string, string]>>([
  ['src/components/GarageView.tsx', [[
    'text-on-surface-muted opacity-20 cursor-not-allowed',
    'text-on-surface-muted cursor-not-allowed',
  ]]],
  ['src/components/RaceWeekendView.tsx', [
    [
      'border-outline-variant/50 text-on-surface-muted opacity-50 cursor-not-allowed',
      'border-outline-variant/50 text-on-surface-muted cursor-not-allowed',
    ],
    [
      "'text-on-surface-muted opacity-40 cursor-not-allowed'",
      "'text-on-surface-muted cursor-not-allowed'",
    ],
  ]],
  ['src/components/SetupView.tsx', [
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

assert.equal([...exceptionNormalizations.values()].reduce((sum, entries) => sum + entries.length, 0), 8, 'exact eight opacity exceptions');
assert.equal(countMatches(read('src/components/SetupView.tsx'), /disabled:text-on-surface-muted\b/g), 1, 'exact disabled setup-delete muted variant');

for (const [path, expectedCount] of expectedCounts) {
  const parent = readParent(path);
  const parentTokens = [...parent.matchAll(oldAlpha)].map(match => match[0]);
  let normalized = path === 'src/App.tsx' ? readCommit(uxp17Commit, path) : read(path);
  if (path === 'src/components/SetupView.tsx') {
    normalized = replaceExact(normalized, 'grid grid-cols-1 min-[360px]:grid-cols-2 gap-4', 'grid grid-cols-1 sm:grid-cols-2 gap-4', 2, `${path}: later phone detail grids`);
    normalized = replaceExact(normalized, 'min-[360px]:col-span-2', 'sm:col-span-2', 1, `${path}: later phone Toe span`);
    normalized = replaceExact(normalized, 'min-w-0 grid grid-cols-1 min-[360px]:grid-cols-2 gap-1.5 min-[360px]:gap-3', 'min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3', 1, `${path}: later phone corner grid`);
  }
  for (const [current, replacement] of exceptionNormalizations.get(path) ?? []) {
    normalized = replaceExact(normalized, current, replacement, 1, `${path}: opacity exception`);
  }
  assert.equal(countMatches(normalized, anyMuted), parentTokens.length, `${path}: only parent alpha sites remain after exception normalization`);
  let tokenIndex = 0;
  normalized = normalized.replace(anyMuted, () => parentTokens[tokenIndex++]);
  assert.equal(tokenIndex, parentTokens.length, `${path}: restored every parent alpha token`);
  assert.equal(normalizeEol(normalized), normalizeEol(parent), `${path}: only authorized muted/opacity class changes`);
}

const fourBarPath = 'src/components/FourBarQuickAdjust.tsx';
let normalizedFourBar = read(fourBarPath);
normalizedFourBar = replaceExact(normalizedFourBar, 'grid grid-cols-1 gap-2 min-[360px]:grid-cols-3', 'grid grid-cols-1 gap-2 sm:grid-cols-3', 1, `${fourBarPath}: later phone measurement grid`);
normalizedFourBar = replaceExact(normalizedFourBar, 'grid grid-cols-1 gap-2 min-[360px]:grid-cols-2', 'grid grid-cols-1 gap-2 sm:grid-cols-2', 1, `${fourBarPath}: later phone angle grid`);
assert.equal(normalizeEol(normalizedFourBar), normalizeEol(readCommit(phoneLayoutParentCommit, fourBarPath)), `${fourBarPath}: only authorized phone breakpoint changes`);

const currentSrcDiff = execFileSync('git', ['diff', '--name-only', parentCommit, '--', 'src'], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean).sort();
assert.deepEqual(currentSrcDiff, [cssPath, fourBarPath, ...expectedCounts.keys()].sort(), 'no unrelated source-file drift');

const css = read(cssPath);
const parentCss = readParent(cssPath);
assert.equal(countMatches(css, /--color-on-surface-muted:/g), 2, 'exact dark/light muted token declarations');
assert.match(css, /--color-on-surface-muted: #bea5a2;/, 'exact dark muted token');
assert.match(css, /html\[data-theme="light"\][\s\S]*--color-on-surface-muted: #715c59;/, 'exact light muted token');
assert.doesNotMatch(css, /\[class\*="text-on-surface-variant\/"\]/, 'light variant-alpha hack removed');
assert.match(css, /html\[data-theme="light"\] \[class\*="text-primary\/"\] \{\s*color: var\(--color-primary\) !important;\s*\}/, 'independent primary-alpha hack preserved');
assert.equal(css.split('/* Light-mode metadata must not lose contrast through Tailwind alpha suffixes. */').length - 1, 1, 'semantic-status light metadata sentinel preserved');

const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
const lightBlock = css.match(/html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
assert.ok(themeBlock && lightBlock, 'dark and light token blocks exist');
const tokenValue = (block: string, name: string) => {
  const value = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1];
  assert.ok(value, `token exists: ${name}`);
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
  assert.equal(tokenValue(contract.block, 'on-surface-muted').toLowerCase(), contract.muted, `${contract.label} muted exact`);
  for (const surfaceName of contract.surfaces) {
    const background = tokenValue(contract.block, surfaceName);
    const mutedRatio = contrast(contract.muted, background);
    const fullRatio = contrast(contract.onSurface, background);
    assert.ok(mutedRatio >= 4.5, `${contract.label} muted/${surfaceName} contrast ${mutedRatio.toFixed(2)} >= 4.5`);
    assert.ok(mutedRatio < fullRatio, `${contract.label} muted remains secondary on ${surfaceName}`);
  }
}

// UXP-15 families and full CSS stay byte-identical after reversing only UXP-17 edits.
for (const family of ['success', 'on-success', 'success-container', 'on-success-container', 'warning', 'on-warning', 'warning-container', 'on-warning-container', 'error', 'on-error', 'error-container', 'on-error-container']) {
  assert.ok(css.includes(`--color-${family}:`), `UXP-15 token family preserved: ${family}`);
}
let normalizedCss = css;
normalizedCss = replaceExact(normalizedCss, '  --color-on-surface-muted: #bea5a2;\n', '', 1, 'dark muted declaration');
normalizedCss = replaceExact(normalizedCss, '  --color-on-surface-muted: #715c59;\n', '', 1, 'light muted declaration');
const sentinel = '/* Light-mode metadata must not lose contrast through Tailwind alpha suffixes. */\n';
const removedVariantHack = 'html[data-theme="light"] [class*="text-on-surface-variant/"] {\n  color: var(--color-on-surface-variant) !important;\n}\n\n';
normalizedCss = replaceExact(normalizedCss, sentinel, sentinel + removedVariantHack, 1, 'light variant-alpha hack restoration');
assert.equal(normalizeEol(normalizedCss), normalizeEol(parentCss), 'index.css differs from parent only by exact UXP-17 token/hack edits');

console.log('muted-text-color harness: PASS');
