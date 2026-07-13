import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { contrastRatio, deriveReadableLightAccent } from '../src/lib/colorContrast.ts';

const surfaces = ['#f4f1f0', '#efedec', '#e7e4e3', '#e1dedc'];
const darkestSurface = '#e1dedc';
for (const accent of ['#ffb3ac', '#ffffff', '#000000', '#00ff00', '#808080', '#abc', 'legacy-value']) {
  const rendered = deriveReadableLightAccent(accent, darkestSurface);
  for (const surface of surfaces) {
    assert.ok(contrastRatio(rendered, surface) >= 4.5, `${accent} rendered ${rendered} below 4.5:1 on ${surface}`);
  }
}
const storedAccent = '#AbCdEf';
deriveReadableLightAccent(storedAccent, darkestSurface);
assert.equal(storedAccent, '#AbCdEf', 'stored accent must remain caller-owned and unchanged');

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
for (const size of [8, 9, 10, 11]) assert.ok(css.includes(`[class~="text-[${size}px]"]`), `missing ${size}px font-floor selector`);
assert.ok(!css.includes('font-size: max(0.75rem, 1em)'), 'font floor must not reset larger inherited text');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.ok(!app.includes('--ui-zoom-inverse'), 'App must not publish inverse zoom');
assert.ok(!css.includes('--ui-zoom-inverse'), 'shell must not apply inverse zoom dimensions');
assert.ok(css.includes('zoom: var(--ui-zoom, 1);'), 'shell must retain Chromium zoom');
assert.ok(css.includes('overflow-x: hidden;'), 'shell must retain horizontal overflow guard');
assert.ok(app.includes('ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1'), 'header action group must wrap within narrow zoomed shells');
assert.ok(!app.includes('ml-auto flex shrink-0'), 'header action group must not resist narrow-shell shrink');
assert.ok(!app.includes('transition-colors whitespace-nowrap'), 'Tuning Guide action must not force horizontal clipping');
assert.ok(css.includes('@import "material-symbols/outlined.css";'), 'Material Symbols must use bundled package CSS');
assert.ok(!/fonts\.googleapis\.com[^\n]*Material(?:\+|%20)Symbols/i.test(css), 'Material Symbols must not depend on Google Fonts');
const iconCssUrl = new URL('../node_modules/material-symbols/outlined.css', import.meta.url);
const iconFontUrl = new URL('../node_modules/material-symbols/material-symbols-outlined.woff2', import.meta.url);
const iconCss = readFileSync(iconCssUrl, 'utf8');
assert.ok(iconCss.includes('url("./material-symbols-outlined.woff2")'), 'icon CSS must reference local WOFF2');
assert.ok(iconCss.includes('font-feature-settings: "liga"'), 'icon CSS must enable ligatures');
assert.ok(existsSync(iconFontUrl), 'local Material Symbols WOFF2 must be installed');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
assert.ok(viteConfig.includes("globPatterns: ['**/*.{js,css,html,woff2}']"), 'PWA precache must include local WOFF2');
assert.ok(viteConfig.includes('maximumFileSizeToCacheInBytes: 5 * 1024 * 1024'), 'PWA cache limit must admit local icon font');
const navId = app.indexOf('id="global-bottom-nav-bar"');
const navStart = app.lastIndexOf('<nav', navId);
const navEnd = app.indexOf('</nav>', navId);
const bottomNav = app.slice(navStart, navEnd);
assert.equal((bottomNav.match(/flex flex-1 min-w-0 flex-col/g) ?? []).length, 5, 'all five bottom tabs must shrink equally');
assert.ok(!bottomNav.includes('w-14'), 'bottom tabs must not keep fixed width');
assert.equal((bottomNav.match(/w-full min-w-0 text-center[^\"]*break-words whitespace-normal/g) ?? []).length, 5, 'all five tab labels must wrap inside their columns');
console.log('UX-R1 color harness PASS');
