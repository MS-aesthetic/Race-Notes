import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');
const css = source('src/index.css');
const theme = css.slice(css.indexOf('@theme {'), css.indexOf('/* ── Light mode'));
const light = css.slice(css.indexOf('html[data-theme="light"] {'), css.indexOf('/* Light-mode metadata'));

const token = (block: string, name: string) => {
  const match = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i'));
  assert.ok(match, `missing ${name}`);
  return match[1].toLowerCase();
};

const expected = {
  dark: {
    surface: '#131313',
    error: '#ffb4ab', onError: '#690005', errorContainer: '#93000a', onErrorContainer: '#ffdad6',
    warning: '#ffb95c', onWarning: '#482900', warningContainer: '#653e00', onWarningContainer: '#ffddb0',
    success: '#88d982', onSuccess: '#003909', successContainer: '#307f34', onSuccessContainer: '#d8ffd0',
  },
  light: {
    surface: '#f4f1f0',
    error: '#980008', onError: '#ffffff', errorContainer: '#ffdad6', onErrorContainer: '#410002',
    warning: '#6e4700', onWarning: '#ffffff', warningContainer: '#ffddb0', onWarningContainer: '#291800',
    success: '#005a1b', onSuccess: '#ffffff', successContainer: '#a4f5ad', onSuccessContainer: '#002106',
  },
} as const;

const names = {
  surface: 'surface', error: 'error', onError: 'on-error', errorContainer: 'error-container', onErrorContainer: 'on-error-container',
  warning: 'warning', onWarning: 'on-warning', warningContainer: 'warning-container', onWarningContainer: 'on-warning-container',
  success: 'success', onSuccess: 'on-success', successContainer: 'success-container', onSuccessContainer: 'on-success-container',
} as const;

for (const [themeName, expectedTokens] of Object.entries(expected)) {
  const block = themeName === 'dark' ? theme : light;
  for (const [key, value] of Object.entries(expectedTokens)) {
    assert.equal(token(block, names[key as keyof typeof names]), value, `${themeName} ${key}`);
  }
}
assert.match(theme, /Success intentionally mirrors the existing tertiary family\./);

const luminance = (hex: string) => {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

for (const [themeName, colors] of Object.entries(expected)) {
  for (const family of ['error', 'warning', 'success'] as const) {
    const cap = family[0].toUpperCase() + family.slice(1) as 'Error' | 'Warning' | 'Success';
    assert.ok(contrast(colors[family], colors.surface) >= 4.5, `${themeName} ${family} text/surface contrast`);
    assert.ok(contrast(colors[`on${cap}`], colors[family]) >= 4.5, `${themeName} on-${family} contrast`);
    assert.ok(contrast(colors[`on${cap}Container`], colors[`${family}Container`]) >= 4.5, `${themeName} ${family} container contrast`);
  }
}

const trackers = source('src/components/TrackersView.tsx');
const dashboard = source('src/components/DashboardView.tsx');
const raw = /(?:text|bg|border)-(?:red|amber|green)-(?:400|500|800|900)(?:\/\d+)?/g;
assert.equal((trackers.match(raw) ?? []).length, 0, 'Trackers raw status utilities');
assert.equal((dashboard.match(raw) ?? []).length, 0, 'Dashboard raw status utilities');

const count = (text: string, family: string) => (
  text.match(new RegExp(`(?:text|bg|border)-${family}(?:/\\d+)?`, 'g')) ?? []
).length;
assert.deepEqual(
  { success: count(trackers, 'success'), warning: count(trackers, 'warning'), error: count(trackers, 'error') },
  { success: 13, warning: 4, error: 17 },
  'Trackers semantic count',
);
assert.deepEqual(
  { success: count(dashboard, 'success'), warning: count(dashboard, 'warning'), error: count(dashboard, 'error') },
  { success: 0, warning: 6, error: 9 },
  'Dashboard semantic count',
);
assert.deepEqual(
  { success: count(trackers + dashboard, 'success'), warning: count(trackers + dashboard, 'warning'), error: count(trackers + dashboard, 'error') },
  { success: 13, warning: 10, error: 26 },
  'global semantic count',
);

for (const shape of [
  'border-success bg-success/10 text-success',
  'bg-success/15 text-success border-success/30',
  'bg-warning/15 text-warning border-warning/30',
  'bg-error/15 text-error border-error/30',
  "status.state === 'overdue' ? 'bg-error' : status.state === 'due' ? 'bg-warning' : 'bg-success'",
  "st.state === 'overdue' ? 'bg-error' : 'bg-warning'",
  'hover:text-error',
]) assert.ok((trackers + dashboard).includes(shape), `missing semantic class shape: ${shape}`);

console.log('SEMANTIC_STATUS_COLOR_HARNESS PASS');
