import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const APP_PATH = 'src/App.tsx';
const SETUP_PATH = 'src/components/SetupView.tsx';
const SETTINGS_PATH = 'src/components/SettingsView.tsx';
const EXPORT_PATH = 'src/components/ExportView.tsx';
const STEPPER_PATH = 'src/components/ui/NumberStepper.tsx';
const root = process.cwd();
const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');
const app = normalizeEol(readFileSync(join(root, APP_PATH), 'utf8'));
const setup = normalizeEol(readFileSync(join(root, SETUP_PATH), 'utf8'));
const settings = normalizeEol(readFileSync(join(root, SETTINGS_PATH), 'utf8'));
const exportView = normalizeEol(readFileSync(join(root, EXPORT_PATH), 'utf8'));
const stepper = normalizeEol(readFileSync(join(root, STEPPER_PATH), 'utf8'));

const between = (source: string, start: string, end: string, label: string): string => {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${label} slice exists`);
  return source.slice(startAt, endAt);
};

const handler = (name: string, nextAnchor: string): string => between(
  app,
  `  const ${name} =`,
  nextAnchor,
  name,
);

const ordered = (source: string, tokens: string[], label: string): void => {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${label}: ${token} remains in order`);
    cursor = next;
  }
};

const persistenceBeforeLastFlash = (source: string, label: string): void => {
  const persistence = Math.max(source.lastIndexOf('localStorage.setItem'), source.lastIndexOf('localStorage.removeItem'));
  const flash = source.lastIndexOf('flashSaved();');
  assert.ok(persistence >= 0 && flash > persistence, `${label} flashes after its final direct localStorage write`);
};

const pointerMoveCancelBlock = `    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX) {
      press.moved = true;
      cancelPress();
    }`;
const pointerMoveIgnoredBlock = `    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX) {
      // mutation: movement ignored, leaving the gesture and repeat armed
    }`;

const b1SourceContractsPass = (source: string): boolean => {
  const startPress = between(source, '  const startPress =', '\n\n  const handlePointerMove =', 'B1 startPress');
  const pointerMove = between(source, '  const handlePointerMove =', '\n\n  const finishPress =', 'B1 pointerMove');
  const finishPress = between(source, '  const finishPress =', '\n\n  // Clear timers on unmount', 'B1 finishPress');
  return [
    'const REPEAT_DELAY_MS = 350;',
    'const REPEAT_INTERVAL_MS = 100;',
    'const STEPPER_POINTER_SLOP_PX = 8;',
    'touch-pan-y',
    'onPointerUp={finishPress}',
    'onPointerCancel={cancelPress}',
    'if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX) {',
    'press.moved = true;',
    'const releasedOutsideSlop = Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX;',
    'if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);',
    'press.didRepeat = true;',
    'applyRepeatStep(press);',
    '}, REPEAT_DELAY_MS);',
    '}, REPEAT_INTERVAL_MS);',
  ].every(token => source.includes(token))
    && !startPress.includes('applyStep(')
    && pointerMove.includes(pointerMoveCancelBlock)
    && finishPress.includes('releasedOutsideSlop');
};

const movementIgnoredMutation = stepper.replace(pointerMoveCancelBlock, pointerMoveIgnoredBlock);
const pointerCancelWriteMutation = stepper.replaceAll('onPointerCancel={cancelPress}', 'onPointerCancel={finishPress}');
assert.notEqual(movementIgnoredMutation, stepper, 'B1 movement mutation changes the exact production cancellation block');
assert.notEqual(pointerCancelWriteMutation, stepper, 'B1 pointercancel mutation changes the actual production handlers');
assert.ok(b1SourceContractsPass(stepper), 'B1 source keeps pointerup/slop/pan-y/cadence contracts');
for (const [name, mutated] of [
  ['pointerdown-write', stepper.replace('    const press: StepperPress = {', '    applyStep(dir, step);\n    const press: StepperPress = {')],
  ['movement-ignored-write', movementIgnoredMutation],
  ['pointercancel-write', pointerCancelWriteMutation],
  ['pan-y-removed', stepper.replace('touch-pan-y', 'touch-none')],
  ['repeat-delay-changed', stepper.replace('const REPEAT_DELAY_MS = 350;', 'const REPEAT_DELAY_MS = 349;')],
  ['repeat-interval-changed', stepper.replace('const REPEAT_INTERVAL_MS = 100;', 'const REPEAT_INTERVAL_MS = 99;')],
  ['release-slop-removed', stepper.replace('if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);', 'if (!press.moved && !press.didRepeat) applyStep(press.dir, step);')],
  ['release-double-step', stepper.replace('if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);', 'applyStep(press.dir, step);')],
] as const) {
  assert.equal(b1SourceContractsPass(mutated), false, `B1 mutation rejected: ${name}`);
}

type PressModel = { startX: number; startY: number; moved: boolean; didRepeat: boolean };
type PressModelMutation = { ignoreMovement?: boolean; pointerCancelWrites?: boolean };
const createB1PressModel = (mutation: PressModelMutation = {}) => {
  let writes = 0;
  let now = 0;
  let press: PressModel | null = null;
  let repeatAt: number | null = null;
  const cancel = () => { press = null; repeatAt = null; };
  const down = (x = 0, y = 0) => { cancel(); press = { startX: x, startY: y, moved: false, didRepeat: false }; repeatAt = now + 350; };
  const move = (x: number, y: number) => {
    if (!press) return;
    if (Math.hypot(x - press.startX, y - press.startY) > 8) {
      if (mutation.ignoreMovement) return;
      press.moved = true;
      cancel();
    }
  };
  const advance = (ms: number) => {
    const target = now + ms;
    while (repeatAt !== null && repeatAt <= target) {
      now = repeatAt;
      if (!press || press.moved) { repeatAt = null; break; }
      press.didRepeat = true;
      writes += 1;
      repeatAt += 100;
    }
    now = target;
  };
  const up = (x = 0, y = 0) => {
    const releasedOutsideSlop = press !== null && Math.hypot(x - press.startX, y - press.startY) > 8;
    if (press && !press.moved && !releasedOutsideSlop && !press.didRepeat) writes += 1;
    cancel();
  };
  const cancelPointer = (x = 0, y = 0) => {
    if (mutation.pointerCancelWrites) up(x, y);
    else cancel();
  };
  return { down, move, cancelPointer, advance, up, writes: () => writes };
};

const shortPress = createB1PressModel();
shortPress.down();
assert.equal(shortPress.writes(), 0, 'B1 pointerdown causes zero writes and zero Saved/toast side effects');
shortPress.advance(349);
assert.equal(shortPress.writes(), 0, 'B1 holds stay silent before 350ms');
shortPress.up();
assert.equal(shortPress.writes(), 1, 'B1 in-slop pointerup commits exactly one step');

const releaseSlopCancel = createB1PressModel();
releaseSlopCancel.down();
releaseSlopCancel.up(0, 9);
assert.equal(releaseSlopCancel.writes(), 0, 'B1 out-of-slop pointerup is zero-write even when no pointermove arrives');

const slopCancel = createB1PressModel();
slopCancel.down();
slopCancel.move(0, 9);
slopCancel.advance(1000);
slopCancel.up();
assert.equal(slopCancel.writes(), 0, 'B1 scroll movement beyond 8px cancels with zero writes and zero Saved/toast side effects');

const pointerCancel = createB1PressModel();
pointerCancel.down();
pointerCancel.cancelPointer();
pointerCancel.advance(1000);
pointerCancel.up();
assert.equal(pointerCancel.writes(), 0, 'B1 pointercancel cancels with zero writes and zero Saved/toast side effects');

const movementIgnoredRegression = createB1PressModel({ ignoreMovement: true });
movementIgnoredRegression.down();
movementIgnoredRegression.move(0, 9);
movementIgnoredRegression.advance(350);
assert.equal(movementIgnoredRegression.writes(), 1, 'B1 production movement mutation is behaviorally real: ignored scroll movement allows a repeat write');
assert.equal(b1SourceContractsPass(movementIgnoredMutation), false, 'B1 source gate rejects ignored production movement cancellation');

const pointerCancelWriteRegression = createB1PressModel({ pointerCancelWrites: true });
pointerCancelWriteRegression.down();
pointerCancelWriteRegression.cancelPointer();
assert.equal(pointerCancelWriteRegression.writes(), 1, 'B1 production pointercancel mutation is behaviorally real: finishPress commits a write');
assert.equal(b1SourceContractsPass(pointerCancelWriteMutation), false, 'B1 source gate rejects production pointercancel routed to finishPress');

const holdRepeat = createB1PressModel();
holdRepeat.down();
holdRepeat.advance(349);
assert.equal(holdRepeat.writes(), 0, 'B1 repeat has not fired before 350ms');
holdRepeat.advance(1);
assert.equal(holdRepeat.writes(), 1, 'B1 first repeat fires at 350ms');
holdRepeat.advance(100);
assert.equal(holdRepeat.writes(), 2, 'B1 repeat cadence remains 100ms');
holdRepeat.up();
assert.equal(holdRepeat.writes(), 2, 'B1 release after repeat adds no extra step');
console.log('B1 stepper behavior harness: PASS');

// B2 notification arbiter: these checks deliberately run before the known
// whole-App UXP-18 byte lock below. Geometry uses exact production classes,
// compiled production CSS, real zoom, controlled safe insets, and Chromium.
const notificationMarkup = between(
  app,
  '        {/* One compact notification arbiter.',
  '\n\n        {/* Core Main Active Canvas Area */}',
  'B2 notification markup',
);
const notificationSourcePasses = (appSource: string, setupSource: string): boolean => {
  const markup = between(
    appSource,
    '        {/* One compact notification arbiter.',
    '\n\n        {/* Core Main Active Canvas Area */}',
    'B2 notification markup mutation',
  );
  const showInfoBlock = between(appSource, '  const showInfo = (notice: InfoNotice) => {', '\n  const showComponentInfo', 'B2 showInfo block');
  return [
    'const INFO_DEDUPE_MS = 5000;',
    'const SUCCESS_TOAST_MS = 1500;',
    'const INFO_COPY = {',
    'minimumSetups: () => SETUP_NOTICE_COPY.minimumSetups,',
    "'car-has-data': () => 'Reassign or delete this car\\'s data first.',",
    'type InfoNotice = { reason: InfoReason; context?: InfoCopyContext };',
    'const resolveInfoCopy = ({ reason, context = {} }: InfoNotice): string => INFO_COPY[reason](context);',
    'const componentInfoNotice = (message: string): InfoNotice => {',
    'const infoShownAtRef = useRef(new Map<string, number>());',
    'const showInfo = (notice: InfoNotice) => {',
    'const dedupeKey = resolveInfoCopy(notice);',
    'clearSavedFlash();',
    'if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;',
    'infoShownAtRef.current.set(dedupeKey, now);',
    "current === 'synced' || current === 'offline-saved' ? null : current",
    'if (!pullReportedFailure) clearTransientSyncStatus();',
    'onInfo={showComponentInfo}',
    'const observer = new ResizeObserver(updateNotificationTop);',
    'setNotificationTop((header.getBoundingClientRect().bottom / zoom) + 8);',
  ].every(token => appSource.includes(token))
    && appSource.includes("const resolved = current === 'synced' || current === 'offline-saved' ? null : current;\n      syncStatusRef.current = resolved;\n      setSyncStatusState(resolved);\n    }, SUCCESS_TOAST_MS);")
    && !/<InfoToast\b/.test(appSource)
    && !/showInfo\(\s*['"]/.test(appSource)
    && !/const showInfo = \([^)]*message/.test(appSource)
    && !appSource.includes('setInfoToast(message)')
    && !/setTimeout\(\(\) => setSyncStatus\(''\), (?:2500|3000)\)/.test(appSource)
    && showInfoBlock.indexOf('clearSavedFlash();') < showInfoBlock.indexOf('if (lastShownAt !== undefined')
    && markup.includes('const isInfo = !!infoToast;')
    && markup.includes('const msg = isInfo')
    && markup.includes('resolveInfoCopy(infoToast)')
    && markup.includes("const isBusy = !isInfo && !savedFlash && syncStatus === 'syncing';")
    && markup.includes('data-notification-slot="arbiter"')
    && markup.includes('style={{ top: notificationTop }}')
    && markup.includes('min-h-11')
    && markup.includes('max-w-md')
    && markup.includes('font-display text-sm font-bold')
    && markup.includes('aria-label="Dismiss notification"')
    && markup.includes('className="tap-target -mr-2 shrink-0 text-on-surface-variant"')
    && markup.includes('onClick={isInfo ? clearInfo : acknowledgeSyncStatus}')
    && (markup.match(/role="status"/g) ?? []).length === 1
    && setupSource.includes('export const SETUP_NOTICE_COPY =')
    && (setupSource.match(/Starting and finished snapshots stay unchanged\. Clone this setup to make a new editable Current Setup\./g) ?? []).length === 1
    && setupSource.includes('{SETUP_NOTICE_COPY.historicalSetup}')
    && !setupSource.includes("onInfo?.('Historical setups are view-only.");
};

assert.ok(notificationSourcePasses(app, setup), 'B2 source has one reason-keyed arbiter, passive historic banner, and one top notification renderer');

type B2Probe = { viewportWidth: number; viewportHeight: number; scale: number; appSource: string; offline: boolean; simultaneous?: boolean; status?: string; includeInfo?: boolean };
const b2Chrome = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find(candidate => candidate && existsSync(candidate));
assert.ok(b2Chrome, 'Chromium is available for B2 rendered notification proof');

const b2BuildDir = mkdtempSync(join(tmpdir(), 'race-notes-b2-css-'));
let b2ProductionCss = '';
try {
  execFileSync(process.execPath, [
    join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    'build', '--outDir', b2BuildDir, '--emptyOutDir',
  ], { cwd: root, stdio: 'ignore' });
  const cssFile = readdirSync(join(b2BuildDir, 'assets')).find(name => name.endsWith('.css'));
  assert.ok(cssFile, 'B2 Vite build emitted compiled production CSS');
  b2ProductionCss = readFileSync(join(b2BuildDir, 'assets', cssFile), 'utf8')
    .replace(/env\(safe-area-inset-top(?:,\s*0px)?\)/g, 'var(--qa-safe-top)')
    .replace(/env\(safe-area-inset-bottom(?:,\s*0px)?\)/g, 'var(--qa-safe-bottom)');
} finally {
  rmSync(b2BuildDir, { recursive: true, force: true });
}

const normalizeClass = (value: string) => value.replace(/\s+/g, ' ').trim();
const quotedClassContaining = (source: string, token: string): string => {
  const match = [...source.matchAll(/className="([^"]+)"/g)].find(item => item[1].includes(token));
  assert.ok(match, `B2 production class containing ${token} exists`);
  return normalizeClass(match[1]);
};
const classAfter = (source: string, anchor: string): string => {
  const at = source.indexOf(anchor);
  assert.ok(at >= 0, `B2 production anchor ${anchor} exists`);
  const match = source.slice(at).match(/className="([^"]+)"/);
  assert.ok(match, `B2 class after ${anchor} exists`);
  return normalizeClass(match[1]);
};
const noticeBaseClass = (source: string): string => {
  const markup = between(source, '        {/* One compact notification arbiter.', '\n\n        {/* Core Main Active Canvas Area */}', 'B2 notice class slice');
  const match = markup.match(/className=\{`([^$]+)\$\{/);
  assert.ok(match, 'B2 production notification pill base class exists');
  return normalizeClass(match[1]);
};
const escapeAttribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

const compileB2Mutation = (source: string, label: string) => {
  assert.doesNotThrow(
    () => transformSync(source, { loader: 'tsx', jsx: 'automatic', format: 'esm' }),
    `B2 ${label} mutation remains compile-real TSX`,
  );
};

type B2RenderedRoute = {
  visible: boolean;
  isInfo: boolean;
  isSuccess: boolean;
  isPersistent: boolean;
  msg: string;
};

const productionNotificationRoute = (appSource: string, simultaneous = false, status = '', includeInfo = true, isOnline = true): B2RenderedRoute => {
  const markup = between(appSource, '        {/* One compact notification arbiter.', '\n\n        {/* Core Main Active Canvas Area */}', 'B2 production route slice');
  const route = markup.match(/(const isInfo = [\s\S]*?const isPersistent = [^;]+;)/)?.[1];
  assert.ok(route, 'B2 exact production notification routing statements exist');
  const evaluateRoute = new Function(
    'infoToast',
    'savedFlash',
    'syncStatus',
    'isOnline',
    'resolveInfoCopy',
    `${route}\nreturn { visible: isInfo || savedFlash || !!statusNotice, isInfo, isSuccess, isPersistent, msg };`,
  ) as (infoToast: object | null, savedFlash: boolean, syncStatus: string, isOnline: boolean, resolveInfoCopy: () => string) => B2RenderedRoute | null;
  return evaluateRoute(
    includeInfo && !status ? { reason: 'missing-weekend-log' } : null,
    simultaneous,
    status,
    isOnline,
    () => 'Race Day setup is missing or locked. Restore it before logging a run.',
  ) ?? { visible: false, isInfo: false, isSuccess: false, isPersistent: false, msg: '' };
};

const b2NotificationGeometry = ({ viewportWidth, viewportHeight, scale, appSource, offline, simultaneous = false, status = '', includeInfo = true }: B2Probe) => {
  const probeDir = mkdtempSync(join(tmpdir(), 'race-notes-b2-notice-'));
  const htmlPath = join(probeDir, 'probe.html');
  const profilePath = join(probeDir, 'profile');
  const markup = between(appSource, '        {/* One compact notification arbiter.', '\n\n        {/* Core Main Active Canvas Area */}', 'B2 rendered notice slice');
  const rootClass = quotedClassContaining(appSource, 'h-full w-full bg-surface text-on-surface');
  const chassisClass = quotedClassContaining(appSource, 'w-full max-w-2xl md:max-w-3xl');
  const headerClass = quotedClassContaining(appSource, 'bg-surface w-full top-0 sticky');
  const headerRowClass = quotedClassContaining(appSource, 'flex flex-wrap justify-between');
  const brandClass = quotedClassContaining(appSource, 'flex min-w-0 items-center gap-1.5');
  const actionsClass = quotedClassContaining(appSource, 'ml-auto flex min-w-0 max-w-full');
  const offlineClass = quotedClassContaining(appSource, 'status-chip shrink-0');
  const guideClass = classAfter(appSource, 'aria-label="Tuning Guide"');
  const themeClass = classAfter(appSource, "aria-label={theme.mode === 'dark'");
  const mainClass = quotedClassContaining(appSource, 'app-main-scroll flex-grow');
  const navClass = quotedClassContaining(appSource, 'bg-surface-container border-t border-outline-variant z-40');
  const wrapperClass = quotedClassContaining(appSource, 'fixed inset-x-0 z-[60]');
  const pillClass = `${noticeBaseClass(appSource)} bg-surface-container border-outline-variant text-on-surface`;
  const closeClass = classAfter(markup, 'aria-label="Dismiss notification"');
  const usesMeasuredTop = markup.includes('style={{ top: notificationTop }}');
  const fixedTop = markup.match(/style=\{\{ top: (\d+) \}\}/)?.[1];
  const fixedBottom = markup.match(/style=\{\{ bottom: (\d+) \}\}/)?.[1];
  const route = productionNotificationRoute(appSource, simultaneous, status, includeInfo, !offline);
  const noticeKind = route.isInfo ? 'info' : route.isSuccess ? 'saved' : 'sync';
  const duplicateNotice = simultaneous && markup.includes('data-notification-slot="saved-duplicate"');
  const slotStyle = fixedTop ? `top:${fixedTop}px` : fixedBottom ? `bottom:${fixedBottom}px` : '';
  const renderedPillClass = route.isSuccess
    ? `${noticeBaseClass(appSource)} bg-green-500 border-green-300 text-black`
    : pillClass;
  const renderedClose = route.isInfo || route.isPersistent
    ? `<button id="qa-close" type="button" aria-label="Dismiss notification" class="${escapeAttribute(closeClass)}"><span>×</span></button>`
    : '';
  const document = `<!doctype html><html style="--ui-zoom:${scale};--qa-safe-top:24px;--qa-safe-bottom:20px"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${b2ProductionCss}\nhtml,body{margin:0!important;width:${viewportWidth}px;height:${viewportHeight}px;overflow:hidden!important}body{position:relative}#applet-main-body{position:relative}#qa-slot{position:absolute!important}#qa-result{display:none!important}</style></head><body>
<div id="applet-main-body" class="${escapeAttribute(rootClass)}"><div id="viewport-chassis" class="${escapeAttribute(chassisClass)}">
<header id="qa-header" class="${escapeAttribute(headerClass)}"><div id="qa-header-row" class="${escapeAttribute(headerRowClass)}"><div class="${escapeAttribute(brandClass)}"><span class="material-symbols-outlined text-primary text-xl">●</span><h1 class="font-display font-bold tracking-tight text-base text-primary uppercase">CREW CHIEF</h1></div><div class="${escapeAttribute(actionsClass)}">${offline ? `<div class="${escapeAttribute(offlineClass)}"><span>●</span><span class="hidden min-[360px]:inline">OFFLINE</span></div>` : ''}<button class="${escapeAttribute(guideClass)}"><span>●</span><span class="font-mono text-[11px] font-semibold">Tuning Guide</span></button><button class="${escapeAttribute(themeClass)}"><span>●</span></button></div></div></header>
<div id="qa-slot" data-notification-slot="arbiter" class="${escapeAttribute(wrapperClass)}" style="${slotStyle}"><div id="qa-toast" data-notice-kind="${noticeKind}" role="status" aria-live="polite" class="${escapeAttribute(renderedPillClass)}"><span class="material-symbols-outlined text-xl">●</span><span class="min-w-0 flex-1">${route.msg}</span>${renderedClose}</div>${duplicateNotice ? '<div data-notification-slot="saved-duplicate" role="status" class="min-h-11 rounded-full px-4 py-2">Saved</div>' : ''}</div>
<main class="${escapeAttribute(mainClass)}">Race Notes</main><nav id="global-bottom-nav-bar" class="${escapeAttribute(navClass)}"><button class="flex flex-1 min-w-0 flex-col items-center justify-center h-full">Dashboard</button></nav>
</div></div><pre id="qa-result"></pre><script>
const scale=${scale};const slot=document.querySelector('#qa-slot');const header=document.querySelector('#qa-header');${usesMeasuredTop ? "slot.style.top=((header.getBoundingClientRect().bottom/scale)+8)+'px';" : ''}
const r=o=>{if(!o)return null;const x=o.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}};const toast=document.querySelector('#qa-toast'),close=document.querySelector('#qa-close'),nav=document.querySelector('#global-bottom-nav-bar'),chassis=document.querySelector('#viewport-chassis'),headerRow=document.querySelector('#qa-header-row');document.querySelector('#qa-result').textContent=JSON.stringify({toast:r(toast),close:r(close),header:r(header),headerRow:r(headerRow),nav:r(nav),chassisClient:chassis.clientWidth,chassisScroll:chassis.scrollWidth,bodyClient:document.documentElement.clientWidth,bodyScroll:document.documentElement.scrollWidth,fontSize:getComputedStyle(toast).fontSize,headerPaddingTop:getComputedStyle(header).paddingTop,statusCount:document.querySelectorAll('[role=status]').length,noticeKind:toast.dataset.noticeKind,noticeText:toast.textContent});
</script></body></html>`;
  try {
    writeFileSync(htmlPath, document);
    const dumped = execFileSync(b2Chrome!, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--user-data-dir=${profilePath}`, `--window-size=${viewportWidth},${viewportHeight}`,
      '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<pre id="qa-result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(encoded, 'B2 rendered notification probe returned measurements');
    return JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as {
      toast: { left: number; right: number; top: number; bottom: number; width: number; height: number };
      close: { left: number; right: number; top: number; bottom: number; width: number; height: number } | null;
      header: { left: number; right: number; top: number; bottom: number; height: number };
      headerRow: { height: number };
      nav: { left: number; right: number; top: number; bottom: number };
      chassisClient: number;
      chassisScroll: number;
      bodyClient: number;
      bodyScroll: number;
      fontSize: string;
      headerPaddingTop: string;
      statusCount: number;
      noticeKind: 'info' | 'saved' | 'sync';
      noticeText: string;
    };
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

const b2RenderedPasses = (probe: B2Probe) => {
  const result = b2NotificationGeometry(probe);
  const tolerance = 1;
  const target = 44 * probe.scale;
  const passes = result.chassisScroll <= result.chassisClient
    && result.header.left >= -tolerance && result.header.right <= probe.viewportWidth + tolerance
    && result.header.top >= -tolerance && result.header.bottom <= probe.viewportHeight + tolerance
    && result.nav.left >= -tolerance && result.nav.right <= probe.viewportWidth + tolerance
    && result.nav.top >= -tolerance && result.nav.bottom <= probe.viewportHeight + tolerance
    && result.toast.left >= -tolerance && result.toast.right <= probe.viewportWidth + tolerance
    && result.toast.width <= Math.min(448 * probe.scale, probe.viewportWidth - (32 * probe.scale)) + tolerance
    && result.toast.top + tolerance >= result.header.bottom
    && result.toast.top <= result.header.bottom + (16 * probe.scale) + tolerance
    && result.toast.bottom + tolerance < result.nav.top
    && (result.noticeKind === 'info' || probe.status === 'sync-error')
    && result.close !== null
    && result.close.width + tolerance >= target && result.close.height + tolerance >= target
    && Number.parseFloat(result.fontSize) + tolerance >= 14
    && Number.parseFloat(result.headerPaddingTop) + tolerance >= 24
    && result.statusCount === 1;
  return { passes, result };
};

for (const [scaleName, scale] of [['Standard', 1], ['Large', 1.15]] as const) {
  for (const [viewportWidth, viewportHeight] of [[360, 800], [390, 844], [412, 915], [1080, 2118]] as const) {
    for (const offline of [false, true]) {
      const probe = { viewportWidth, viewportHeight, scale, appSource: app, offline };
      const { passes, result } = b2RenderedPasses(probe);
      assert.ok(passes, `B2 ${scaleName} ${viewportWidth}×${viewportHeight} ${offline ? 'offline' : 'online'}: compiled production notification clears actual header/nav, keeps direct 44px dismiss target, safe inset, text floor, and no overflow; ${JSON.stringify(result)}`);
      if (scaleName === 'Large' && viewportWidth === 360 && offline) {
        assert.ok(result.headerRow.height > 60 * scale, 'B2 Large 360 offline fixture exercises actual wrapped production header');
      }
    }
  }
}

for (const mutation of [
  ['close-target-floor', 'className="tap-target -mr-2', 'className="p-0 -mr-2'],
  ['header-clearance', 'style={{ top: notificationTop }}', 'style={{ top: 48 }}'],
  ['bottom-positioning', 'style={{ top: notificationTop }}', 'style={{ bottom: 96 }}'],
  ['text-floor', 'font-display text-sm font-bold', 'font-display text-xs font-bold'],
  ['oversized-treatment', 'max-w-md', 'max-w-none'],
] as const) {
  const [name, from, to] = mutation;
  const mutatedApp = app.replace(from, to);
  assert.notEqual(mutatedApp, app, `B2 ${name} mutation changes exact production notification markup`);
  compileB2Mutation(mutatedApp, name);
  assert.equal(notificationSourcePasses(mutatedApp, setup), false, `B2 ${name} mutation fails the production source gate`);
  const renderedViewport = name === 'oversized-treatment' ? 1080 : 360;
  assert.equal(b2RenderedPasses({ viewportWidth: renderedViewport, viewportHeight: 800, scale: 1, appSource: mutatedApp, offline: true }).passes, false, `B2 ${name} mutation fails the compiled production rendered gate`);
}

const numericConstant = (source: string, name: string): number => {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(match, `B2 ${name} production constant exists`);
  return Number(match[1]);
};
const createB2ArbiterModel = (source = app) => {
  let now = 0;
  let info: string | null = null;
  let savedUntil: number | null = null;
  let syncedUntil: number | null = null;
  const seenAt = new Map<string, number>();
  const dedupeMs = numericConstant(source, 'INFO_DEDUPE_MS');
  const dedupeEnabled = source.includes('if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;');
  const dedupeUsesResolvedCopy = source.includes('const dedupeKey = resolveInfoCopy(notice);');
  const successMs = numericConstant(source, 'SUCCESS_TOAST_MS');
  const showInfoAt = source.indexOf('const showInfo = (notice: InfoNotice) => {');
  const showInfoEnd = source.indexOf('const showComponentInfo =', showInfoAt);
  const clearSavedAt = source.indexOf('clearSavedFlash();', showInfoAt);
  const clearsSavedOnInfo = clearSavedAt >= showInfoAt && clearSavedAt < showInfoEnd;
  const dedupeReturnAt = source.indexOf('if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;', showInfoAt);
  const clearsSavedBeforeDedupe = clearsSavedOnInfo && clearSavedAt < dedupeReturnAt;
  const infoWins = source.includes('const isInfo = !!infoToast;');
  const duplicateRenderPath = source.includes('data-notification-slot="saved-duplicate"');
  const syncUsesSuccessConstant = source.includes("const resolved = current === 'synced' || current === 'offline-saved' ? null : current;\n      syncStatusRef.current = resolved;\n      setSyncStatusState(resolved);\n    }, SUCCESS_TOAST_MS);");
  const pullTimeout: string | undefined = undefined;
  const showInfo = (reason: string, context = '') => {
    const dedupeKey = dedupeUsesResolvedCopy ? `${reason}:${context}` : reason;
    if (clearsSavedOnInfo && clearsSavedBeforeDedupe) savedUntil = null;
    const last = seenAt.get(dedupeKey);
    if (dedupeEnabled && last !== undefined && now - last < dedupeMs) return false;
    if (clearsSavedOnInfo && !clearsSavedBeforeDedupe) savedUntil = null;
    seenAt.set(dedupeKey, now);
    info = dedupeKey;
    return true;
  };
  const flashSaved = () => { if (!info) savedUntil = now + successMs; };
  const showSynced = (fromPull = false) => {
    const lifetime = fromPull && pullTimeout ? Number(pullTimeout) : syncUsesSuccessConstant ? successMs : 2500;
    syncedUntil = now + lifetime;
  };
  const advance = (ms: number) => {
    now += ms;
    if (savedUntil !== null && savedUntil <= now) savedUntil = null;
    if (syncedUntil !== null && syncedUntil <= now) syncedUntil = null;
  };
  const visible = () => {
    if (info && savedUntil !== null && duplicateRenderPath) return 'info + Saved';
    if (info && infoWins) return info;
    if (savedUntil !== null) return 'Saved';
    if (syncedUntil !== null) return 'Synced';
    return null;
  };
  return { showInfo, flashSaved, showSynced, advance, dismissInfo: () => { info = null; }, visible };
};

const arbiter = createB2ArbiterModel();
arbiter.flashSaved();
assert.equal(arbiter.visible(), 'Saved', 'B2 model preserves honest local Saved feedback');
assert.equal(arbiter.showInfo('pressure-source'), true, 'B2 model shows the first reason');
assert.equal(arbiter.visible(), 'pressure-source:', 'B2 info replaces Saved and never co-renders');
arbiter.dismissInfo();
assert.equal(arbiter.visible(), null, 'B2 dismiss cannot reveal a stale suppressed Saved notification');
arbiter.flashSaved();
assert.equal(arbiter.showInfo('pressure-source'), false, 'B2 identical copy dedupes within five seconds');
assert.equal(arbiter.visible(), null, 'B2 duplicate info still clears pending Saved before its dedupe return');
assert.equal(arbiter.showInfo('pressure-source', 'Car B'), true, 'B2 same reason with different contextual copy surfaces immediately');
assert.equal(arbiter.visible(), 'pressure-source:Car B', 'B2 contextual copy owns the dedupe identity');
arbiter.dismissInfo();
assert.equal(arbiter.showInfo('finished-weekend'), true, 'B2 different reason surfaces immediately');
arbiter.dismissInfo();
arbiter.advance(5000);
assert.equal(arbiter.showInfo('pressure-source'), true, 'B2 identical reason may reappear after the dedupe window');
arbiter.dismissInfo();
arbiter.flashSaved();
arbiter.advance(1499);
assert.equal(arbiter.visible(), 'Saved', 'B2 success remains visible before 1.5 seconds');
arbiter.advance(1);
assert.equal(arbiter.visible(), null, 'B2 success expires at 1.5 seconds');
arbiter.showSynced();
arbiter.advance(1499);
assert.equal(arbiter.visible(), 'Synced', 'B2 ordinary Synced remains before shared 1.5-second lifetime');
arbiter.advance(1);
assert.equal(arbiter.visible(), null, 'B2 ordinary Synced expires at shared 1.5-second lifetime');
assert.doesNotMatch(app, /setSyncStatus\('Synced'\)/, 'B3 pull/resume/hydration never enqueue success');

const coRenderMarkup = notificationMarkup.replace(
  '              </div>\n            </div>\n          );',
  `              </div>
              {isInfo && savedFlash && (
                <div data-notification-slot="saved-duplicate" role="status" className="min-h-11 rounded-full px-4 py-2">Saved</div>
              )}
            </div>
          );`,
);
const coRenderMutation = app
  .replace('    clearSavedFlash();\n    const lastShownAt', '    // mutation: retain pending Saved while info becomes active\n    const lastShownAt')
  .replace(notificationMarkup, coRenderMarkup);
assert.notEqual(coRenderMutation, app, 'B2 co-render mutation changes production handler and renderer');
compileB2Mutation(coRenderMutation, 'co-render');
assert.equal(notificationSourcePasses(coRenderMutation, setup), false, 'B2 duplicate render-path mutation fails the source gate');
const coRenderModel = createB2ArbiterModel(coRenderMutation);
coRenderModel.flashSaved();
coRenderModel.showInfo('pressure-source');
assert.equal(coRenderModel.visible(), 'info + Saved', 'B2 duplicate render-path mutation behaviorally co-renders two notices');
assert.equal(b2NotificationGeometry({ viewportWidth: 360, viewportHeight: 800, scale: 1, appSource: coRenderMutation, offline: true, simultaneous: true }).statusCount, 2, 'B2 compile-real co-render mutation renders two production-routed statuses');

const baselinePriorityRender = b2RenderedPasses({ viewportWidth: 360, viewportHeight: 800, scale: 1, appSource: app, offline: true, simultaneous: true });
assert.equal(baselinePriorityRender.passes, true, 'B2 simultaneous baseline passes rendered arbiter gate');
assert.equal(baselinePriorityRender.result.noticeKind, 'info', 'B2 simultaneous baseline production routing renders info');
assert.equal(baselinePriorityRender.result.statusCount, 1, 'B2 simultaneous baseline renders exactly one status');
assert.match(baselinePriorityRender.result.noticeText, /Race Day setup is missing or locked/, 'B2 simultaneous baseline renders resolved info copy');

const infoPriorityMutation = app
  .replace('    clearSavedFlash();\n    const lastShownAt', '    // mutation: retain pending Saved while info becomes active\n    const lastShownAt')
  .replace('const isInfo = !!infoToast;', 'const isInfo = false && !!infoToast;');
compileB2Mutation(infoPriorityMutation, 'info-priority');
assert.equal(notificationSourcePasses(infoPriorityMutation, setup), false, 'B2 info-priority source mutation fails the source gate');
const infoPriorityModel = createB2ArbiterModel(infoPriorityMutation);
infoPriorityModel.flashSaved();
infoPriorityModel.showInfo('pressure-source');
assert.equal(infoPriorityModel.visible(), 'Saved', 'B2 info-priority mutation behaviorally lets Saved hide info');
const mutatedPriorityRender = b2RenderedPasses({ viewportWidth: 360, viewportHeight: 800, scale: 1, appSource: infoPriorityMutation, offline: true, simultaneous: true });
assert.equal(mutatedPriorityRender.result.noticeKind, 'saved', 'B2 compile-real priority mutation production routing renders Saved');
assert.equal(mutatedPriorityRender.result.noticeText, '●Offline — saved on device', 'B2 compile-real priority mutation hides info copy behind truthful offline Saved copy');
assert.doesNotMatch(mutatedPriorityRender.result.noticeText, /Race Day setup is missing or locked/, 'B2 compile-real priority mutation does not render info');
assert.equal(mutatedPriorityRender.result.statusCount, 1, 'B2 compile-real priority mutation still renders one arbiter status');
assert.equal(mutatedPriorityRender.passes, false, 'B2 compile-real priority mutation independently fails rendered info-priority gate');

const dedupeRemovalMutation = app.replace('if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;', 'if (false) return;');
assert.equal(notificationSourcePasses(dedupeRemovalMutation, setup), false, 'B2 dedupe-removal source mutation fails the source gate');
compileB2Mutation(dedupeRemovalMutation, 'dedupe-removal');
const dedupeRemovalModel = createB2ArbiterModel(dedupeRemovalMutation);
dedupeRemovalModel.showInfo('pressure-source');
assert.equal(dedupeRemovalModel.showInfo('pressure-source'), true, 'B2 dedupe-removal mutation behaviorally shows the duplicate');

const reasonOnlyDedupeMutation = app.replace('const dedupeKey = resolveInfoCopy(notice);', 'const dedupeKey = notice.reason;');
compileB2Mutation(reasonOnlyDedupeMutation, 'reason-only-dedupe');
assert.equal(notificationSourcePasses(reasonOnlyDedupeMutation, setup), false, 'B2 reason-only dedupe mutation fails source gate');
const reasonOnlyDedupeModel = createB2ArbiterModel(reasonOnlyDedupeMutation);
reasonOnlyDedupeModel.showInfo('pressure-source', 'Car A');
assert.equal(reasonOnlyDedupeModel.showInfo('pressure-source', 'Car B'), false, 'B2 reason-only mutation suppresses distinct contextual copy');

const lateSuccessClearMutation = app
  .replace('    clearSavedFlash();\n    const lastShownAt', '    const lastShownAt')
  .replace('    if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;\n    infoShownAtRef.current.set', '    if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;\n    clearSavedFlash();\n    infoShownAtRef.current.set');
assert.notEqual(lateSuccessClearMutation, app, 'B2 late-success-clear mutation moves the exact production clear after dedupe');
compileB2Mutation(lateSuccessClearMutation, 'late-success-clear');
assert.equal(notificationSourcePasses(lateSuccessClearMutation, setup), false, 'B2 late-success-clear mutation fails source gate');
const lateSuccessClearModel = createB2ArbiterModel(lateSuccessClearMutation);
lateSuccessClearModel.showInfo('pressure-source');
lateSuccessClearModel.dismissInfo();
lateSuccessClearModel.flashSaved();
assert.equal(lateSuccessClearModel.showInfo('pressure-source'), false, 'B2 late-success-clear mutation still dedupes identical copy');
assert.equal(lateSuccessClearModel.visible(), 'Saved', 'B2 late-success-clear mutation behaviorally leaves stale Saved visible');

const dedupeDriftMutation = app.replace('const INFO_DEDUPE_MS = 5000;', 'const INFO_DEDUPE_MS = 4000;');
assert.equal(notificationSourcePasses(dedupeDriftMutation, setup), false, 'B2 five-second-window source mutation fails the source gate');
compileB2Mutation(dedupeDriftMutation, 'dedupe-drift');
const dedupeDriftModel = createB2ArbiterModel(dedupeDriftMutation);
dedupeDriftModel.showInfo('pressure-source');
dedupeDriftModel.advance(4500);
assert.equal(dedupeDriftModel.showInfo('pressure-source'), true, 'B2 five-second-window mutation behaviorally expires too early');

const successDriftMutation = app.replace('const SUCCESS_TOAST_MS = 1500;', 'const SUCCESS_TOAST_MS = 1200;');
assert.equal(notificationSourcePasses(successDriftMutation, setup), false, 'B2 success-lifetime source mutation fails the source gate');
compileB2Mutation(successDriftMutation, 'success-drift');
const successDriftModel = createB2ArbiterModel(successDriftMutation);
successDriftModel.flashSaved();
successDriftModel.advance(1200);
assert.equal(successDriftModel.visible(), null, 'B2 success-lifetime mutation behaviorally expires too early');

const syncTimeoutMutation = app.replace(
  "const resolved = current === 'synced' || current === 'offline-saved' ? null : current;\n      syncStatusRef.current = resolved;\n      setSyncStatusState(resolved);\n    }, SUCCESS_TOAST_MS);",
  "const resolved = current === 'synced' || current === 'offline-saved' ? null : current;\n      syncStatusRef.current = resolved;\n      setSyncStatusState(resolved);\n    }, 2500);",
);
assert.notEqual(syncTimeoutMutation, app, 'B2 ordinary Synced timeout mutation changes production timeout');
compileB2Mutation(syncTimeoutMutation, 'sync-timeout');
assert.equal(notificationSourcePasses(syncTimeoutMutation, setup), false, 'B2 ordinary Synced timeout mutation fails source gate');
const syncTimeoutModel = createB2ArbiterModel(syncTimeoutMutation);
syncTimeoutModel.showSynced();
syncTimeoutModel.advance(1500);
assert.equal(syncTimeoutModel.visible(), 'Synced', 'B2 ordinary Synced timeout mutation remains visible past shared lifetime');

const duplicateHistoricalMutation = setup.replace(
  'if (!getSetupEditability(target, weekends, activeEventSetupId).deletable) {\n      return;',
  "if (!getSetupEditability(target, weekends, activeEventSetupId).deletable) {\n      onInfo?.('Historical setups are view-only. Clone this setup to make an editable copy.');\n      return;",
);
assert.notEqual(duplicateHistoricalMutation, setup, 'B2 duplicate historical mutation changes current production guard');
assert.equal(notificationSourcePasses(app, duplicateHistoricalMutation), false, 'B2 duplicate historical transient-copy mutation fails the source gate');

const sync = normalizeEol(readFileSync(join(root, 'src/lib/sync.ts'), 'utf8'));
const callbackToken = "onStatus?.('sync-error');";
const pullSpecs = [
  ['pullAllData', 'export async function pullAllData(', '// ---------------------------------------------------------------------------\n// Pull: Shared data', 4],
  ['pullSharedData', 'export async function pullSharedData(', '// ---------------------------------------------------------------------------\n// Merge helper', 5],
  ['pullTires', 'export async function pullTires(', 'export async function deleteTireFromCloud(', 2],
  ['pullCars', 'export async function pullCars(', 'export async function deleteCarFromCloud(', 2],
  ['pullShockSessions', 'export async function pullShockSessions(', 'export async function deleteShockSessionFromCloud(', 2],
  ['pullTodos', 'export async function pullTodos(', '// ---------------------------------------------------------------------------\n// Maintenance components sync', 2],
  ['pullMaintenanceComponents', 'export async function pullMaintenanceComponents(', 'export async function deleteMaintenanceComponentFromCloud(', 2],
  ['pullMaintenanceLogs', 'export async function pullMaintenanceLogs(', 'export async function deleteMaintenanceLogFromCloud(', 2],
  ['pullChecklistTemplates', 'export async function pullChecklistTemplates(', 'export async function deleteChecklistTemplateFromCloud(', 2],
  ['pullWeekendChecklists', 'export async function pullWeekendChecklists(', 'export async function deleteWeekendChecklistFromCloud(', 2],
  ['pullTrips', 'export async function pullTrips(', 'export async function deleteTripFromCloud(', 2],
] as const;
const pullBlock = (source: string, start: string, end: string, label: string): string => between(source, start, end, `B3 ${label} block`);
const pullErrorsPass = (syncSource: string): boolean => pullSpecs.every(([label, start, end, expected]) => {
  const block = pullBlock(syncSource, start, end, label);
  return (block.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length === expected
    && !block.includes("onStatus?.('synced')");
});
const pushErrorsPass = (syncSource: string): boolean => {
  const block = between(syncSource, 'export function pushSetups(', '/** Push race weekends', 'B3 pushSetups source gate');
  return (block.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length === 2
    && block.includes("else onStatus?.('synced');");
};
const sharedPullCallerPasses = (appSource: string, settingsSource: string, exportSource: string): boolean => (
  appSource.includes('onSyncStatus={setSyncStatus}')
  && settingsSource.includes('onSyncStatus?: (status: SyncStatus) => void;')
  && settingsSource.includes('onSyncStatus={onSyncStatus}')
  && exportSource.includes('onSyncStatus?: (status: SyncStatus) => void;')
  && exportSource.includes('const activeUserIdRef = useRef<string | null>(user?.id ?? null);')
  && exportSource.includes('const onSyncStatusRef = useRef(onSyncStatus);')
  && exportSource.includes('activeUserIdRef.current = user?.id ?? null;')
  && exportSource.includes('onSyncStatusRef.current = onSyncStatus;')
  && exportSource.includes('const pullUserId = user?.id;')
  && exportSource.includes('if (!pullUserId) {\n      setLoadingShared(false);\n      return;')
  && exportSource.includes('let cancelled = false;')
  && exportSource.includes('const reportSharedPullStatus = (status: SyncStatus) => {')
  && (exportSource.match(/if \(cancelled \|\| activeUserIdRef\.current !== pullUserId\) return;/g) ?? []).length === 2
  && exportSource.includes('onSyncStatusRef.current?.(status);')
  && exportSource.includes('pullSharedData(pullUserId, reportSharedPullStatus)')
  && exportSource.includes('return () => { cancelled = true; };')
  && exportSource.includes('}, [user?.id]);')
);
const b3SourcePasses = (
  appSource: string,
  syncSource: string,
  settingsSource = settings,
  exportSource = exportView,
): boolean => (
  appSource.includes("type NotificationStatus = SyncStatus | 'syncing';")
  && appSource.includes("status === 'deferred-delete-retrying' || status === 'sync-error'")
  && appSource.includes('const syncStatusRef = useRef<NotificationStatus | null>(null);')
  && appSource.includes('if (isTerminalSyncStatus(next)) clearSavedFlash();')
  && appSource.includes('isTerminalSyncStatus(current) && !isTerminalSyncStatus(next) ? current : next')
  && appSource.includes('syncStatusRef.current = resolved;\n    setSyncStatusState(resolved);')
  && appSource.includes('const clearTransientSyncStatus = () => {\n    const current = syncStatusRef.current;\n    const resolved = isTerminalSyncStatus(current) ? current : null;')
  && appSource.includes('const acknowledgeSyncStatus = () => {\n    clearSavedFlash();\n    syncStatusRef.current = null;\n    setSyncStatusState(null);')
  && appSource.includes('if (infoToastRef.current || isTerminalSyncStatus(syncStatusRef.current)) return;')
  && appSource.includes('if (!didPersist && !activeSelectionChanged) return;')
  && appSource.includes('if (didPersist) {\n      if (syncOwnerId) pushSetups(safeSetups, syncOwnerId, setSyncStatus);')
  && appSource.includes('if (activated || pressuresChanged) {')
  && appSource.includes('const pressures = setupPressureBlock(nextActive);')
  && appSource.includes("setSyncStatus('deferred-delete-retrying')")
  && appSource.includes("setSyncStatus('offline-saved')")
  && appSource.includes("const reportPullFailure = (status: SyncStatus) => {")
  && appSource.includes("if (status !== 'sync-error') return;")
  && appSource.includes("if (status !== 'sync-error') return;\n      if (!isCurrentPull()) return;\n      pullReportedFailure = true;")
  && appSource.includes("setSyncStatus('sync-error');")
  && appSource.includes('if (!pullReportedFailure) clearTransientSyncStatus();')
  && appSource.includes("current === 'synced' || current === 'offline-saved' ? null : current")
  && appSource.includes("const isFailure = syncStatus === 'deferred-delete-retrying' || syncStatus === 'sync-error';")
  && appSource.includes(": 'Sync failed — will retry';")
  && appSource.includes('onClick={isInfo ? clearInfo : acknowledgeSyncStatus}')
  && !appSource.includes("setSyncStatus('Synced')")
  && syncSource.includes("type SyncCallback = (status: 'synced' | 'sync-error') => void;")
  && syncSource.includes("else onStatus?.('synced');")
  && pushErrorsPass(syncSource)
  && pullErrorsPass(syncSource)
  && sharedPullCallerPasses(appSource, settingsSource, exportSource)
);
assert.ok(b3SourcePasses(app, sync), 'B3 source locks selection, terminal precedence, pull errors, truthful rendering, and pull-success silence');

const reportPullFailureBlock = (source: string): string => between(
  source,
  '    const reportPullFailure = (status: SyncStatus) => {',
  '    lastPullStartedAtRef.current = Date.now();',
  'B3 reportPullFailure block',
);
const pullFailureStatus = (source: string, currentGeneration: boolean): 'sync-error' | null => {
  const block = reportPullFailureBlock(source);
  const generationGuarded = block.includes("if (status !== 'sync-error') return;\n      if (!isCurrentPull()) return;\n      pullReportedFailure = true;");
  return currentGeneration || !generationGuarded ? 'sync-error' : null;
};
assert.equal(pullFailureStatus(app, false), null, 'B3 stale pull generation cannot publish global failure');
assert.equal(pullFailureStatus(app, true), 'sync-error', 'B3 current pull generation publishes terminal failure');
const staleGenerationMutation = app.replace(
  "if (status !== 'sync-error') return;\n      if (!isCurrentPull()) return;\n      pullReportedFailure = true;",
  "if (status !== 'sync-error') return;\n      pullReportedFailure = true;",
);
compileB2Mutation(staleGenerationMutation, 'stale-pull-generation');
assert.equal(b3SourcePasses(staleGenerationMutation, sync), false, 'B3 stale-generation mutation fails source gate');
assert.equal(pullFailureStatus(staleGenerationMutation, false), 'sync-error', 'B3 stale-generation mutation behaviorally poisons current status');
const staleBaselineRoute = productionNotificationRoute(app, false, pullFailureStatus(app, false) ?? '', false, true);
const staleMutationRoute = productionNotificationRoute(staleGenerationMutation, false, pullFailureStatus(staleGenerationMutation, false) ?? '', false, true);
assert.equal(staleBaselineRoute.visible, false, 'B3 stale generation renders no notification');
assert.equal(staleMutationRoute.isPersistent && staleMutationRoute.msg === 'Sync failed — will retry', true, 'B3 stale-generation mutation independently fails rendered route');

const savedAfterTerminalEntry = (source: string, pendingSaved: boolean): boolean => (
  pendingSaved && !source.includes('if (isTerminalSyncStatus(next)) clearSavedFlash();')
);
for (const terminal of ['sync-error', 'deferred-delete-retrying'] as const) {
  assert.equal(savedAfterTerminalEntry(app, true), false, `B3 ${terminal} entry clears pending Saved and timer`);
  const acknowledgedRoute = productionNotificationRoute(app, savedAfterTerminalEntry(app, true), '', false, true);
  assert.equal(acknowledgedRoute.visible, false, `B3 acknowledgement after ${terminal} cannot resurrect Saved`);
}
const retainSavedMutation = app.replace('    if (isTerminalSyncStatus(next)) clearSavedFlash();\n', '');
compileB2Mutation(retainSavedMutation, 'terminal-retains-saved');
assert.equal(b3SourcePasses(retainSavedMutation, sync), false, 'B3 terminal-retains-Saved mutation fails source gate');
assert.equal(savedAfterTerminalEntry(retainSavedMutation, true), true, 'B3 terminal-retains-Saved mutation preserves stale success');
const resurrectedSavedRoute = productionNotificationRoute(retainSavedMutation, savedAfterTerminalEntry(retainSavedMutation, true), '', false, true);
assert.equal(resurrectedSavedRoute.visible && resurrectedSavedRoute.isSuccess && resurrectedSavedRoute.msg === 'Saved', true, 'B3 terminal-retains-Saved mutation resurrects Saved after acknowledgement');

const terminalFlashGuard = 'if (infoToastRef.current || isTerminalSyncStatus(syncStatusRef.current)) return;';
const acknowledgeClearsSaved = (source: string): boolean => source.includes(
  'const acknowledgeSyncStatus = () => {\n    clearSavedFlash();\n    syncStatusRef.current = null;',
);
const savedArmedByLaterTerminalFlash = (source: string): boolean => !source.includes(terminalFlashGuard);
const savedAfterTerminalLaterFlashAndAck = (source: string): boolean => (
  savedArmedByLaterTerminalFlash(source) && !acknowledgeClearsSaved(source)
);
for (const terminal of ['sync-error', 'deferred-delete-retrying'] as const) {
  assert.equal(savedArmedByLaterTerminalFlash(app), false, `B3 ${terminal} blocks later flashSaved from arming Saved`);
  assert.equal(savedAfterTerminalLaterFlashAndAck(app), false, `B3 ${terminal} -> later save -> acknowledgement reveals no Saved`);
}
const terminalLaterFlashMutation = app.replace(terminalFlashGuard, 'if (infoToastRef.current) return;');
assert.notEqual(terminalLaterFlashMutation, app, 'B3 later-terminal-flash mutation changes exact production guard');
compileB2Mutation(terminalLaterFlashMutation, 'terminal-later-flash-arms-saved');
assert.equal(b3SourcePasses(terminalLaterFlashMutation, sync), false, 'B3 later-terminal-flash mutation fails source gate');
assert.equal(savedArmedByLaterTerminalFlash(terminalLaterFlashMutation), true, 'B3 later-terminal-flash mutation behaviorally arms hidden Saved');
const terminalLaterFlashAckMutation = terminalLaterFlashMutation.replace(
  'const acknowledgeSyncStatus = () => {\n    clearSavedFlash();\n    syncStatusRef.current = null;',
  'const acknowledgeSyncStatus = () => {\n    syncStatusRef.current = null;',
);
assert.notEqual(terminalLaterFlashAckMutation, terminalLaterFlashMutation, 'B3 acknowledgement mutation removes final stale-Saved defense');
compileB2Mutation(terminalLaterFlashAckMutation, 'terminal-later-flash-ack-resurrection');
assert.equal(b3SourcePasses(terminalLaterFlashAckMutation, sync), false, 'B3 later-flash acknowledgement mutation fails source gate');
assert.equal(savedAfterTerminalLaterFlashAndAck(terminalLaterFlashAckMutation), true, 'B3 mutated terminal -> later save -> acknowledgement behaviorally resurrects Saved');
for (const isOnline of [true, false]) {
  const baselineLaterSavedRoute = productionNotificationRoute(app, savedAfterTerminalLaterFlashAndAck(app), '', false, isOnline);
  assert.equal(baselineLaterSavedRoute.visible, false, `B3 terminal -> later ${isOnline ? 'online' : 'offline'} save -> acknowledgement renders nothing`);
  const laterSavedRoute = productionNotificationRoute(terminalLaterFlashAckMutation, savedAfterTerminalLaterFlashAndAck(terminalLaterFlashAckMutation), '', false, isOnline);
  assert.equal(
    laterSavedRoute.visible && laterSavedRoute.isSuccess && laterSavedRoute.msg === (isOnline ? 'Saved' : 'Offline — saved on device'),
    true,
    `B3 later-${isOnline ? 'online' : 'offline'}-flash acknowledgement mutation independently fails rendered gate`,
  );
}

const sharedPullFailureStatus = (
  appSource: string,
  settingsSource: string,
  exportSource: string,
): 'sync-error' | 'syncing' => sharedPullCallerPasses(appSource, settingsSource, exportSource) ? 'sync-error' : 'syncing';
assert.equal(sharedPullFailureStatus(app, settings, exportView), 'sync-error', 'B3 actual shared-pull caller routes failures to App terminal status');
const missingAppCallbackMutation = app.replace('\n                  onSyncStatus={setSyncStatus}', '');
const missingSettingsCallbackMutation = settings.replace(' onSyncStatus={onSyncStatus}', '');
const missingExportCallbackMutation = exportView.replace('pullSharedData(pullUserId, reportSharedPullStatus)', 'pullSharedData(pullUserId)');
compileB2Mutation(missingAppCallbackMutation, 'shared-pull-App-callback');
assert.doesNotThrow(() => transformSync(missingSettingsCallbackMutation, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'B3 shared-pull Settings callback mutation compiles');
assert.doesNotThrow(() => transformSync(missingExportCallbackMutation, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'B3 shared-pull Export callback mutation compiles');
const sharedPullMutations = [
  ['App', missingAppCallbackMutation, settings, exportView],
  ['Settings', app, missingSettingsCallbackMutation, exportView],
  ['Export', app, settings, missingExportCallbackMutation],
] as const;
for (const [label, appSource, settingsSource, exportSource] of sharedPullMutations) {
  assert.equal(b3SourcePasses(appSource, sync, settingsSource, exportSource), false, `B3 ${label} shared-pull callback mutation fails source gate`);
  const status = sharedPullFailureStatus(appSource, settingsSource, exportSource);
  assert.equal(status, 'syncing', `B3 ${label} callback mutation behaviorally loses terminal failure`);
  const route = productionNotificationRoute(appSource, false, status, false, true);
  assert.equal(route.isPersistent || route.msg === 'Sync failed — will retry', false, `B3 ${label} callback mutation independently fails rendered failure gate`);
}
const sharedPullSuccessRoute = productionNotificationRoute(app, false, '', false, true);
assert.equal(sharedPullSuccessRoute.visible, false, 'B3 successful shared pull remains notification-silent');

const sharedPullCurrentGuard = 'if (cancelled || activeUserIdRef.current !== pullUserId) return;';
const sharedPullFailureGuarded = (source: string): boolean => between(
  source,
  '    const reportSharedPullStatus = (status: SyncStatus) => {',
  '    };\n    setLoadingShared(true);',
  'B3 shared-pull callback guard',
).includes(sharedPullCurrentGuard);
const sharedPullStatusAfterCompletion = (
  source: string,
  cancelled: boolean,
  currentUserMatches: boolean,
): 'sync-error' | null => (
  sharedPullFailureGuarded(source) && (cancelled || !currentUserMatches) ? null : 'sync-error'
);
assert.equal(sharedPullStatusAfterCompletion(exportView, false, true), 'sync-error', 'B3 current shared pull reports terminal failure');
assert.equal(sharedPullStatusAfterCompletion(exportView, true, true), null, 'B3 unmounted Export rejects stale shared-pull failure');
assert.equal(sharedPullStatusAfterCompletion(exportView, false, false), null, 'B3 superseded user rejects stale shared-pull failure');
const loadingAfterSharedUserRemoval = (source: string, loading: boolean): boolean => (
  source.includes('if (!pullUserId) {\n      setLoadingShared(false);\n      return;') ? false : loading
);
assert.equal(loadingAfterSharedUserRemoval(exportView, true), false, 'B3 removing shared-pull user clears pending loading state');
const staleSharedLoadingMutation = exportView.replace(
  'if (!pullUserId) {\n      setLoadingShared(false);\n      return;\n    }',
  'if (!pullUserId) return;',
);
assert.notEqual(staleSharedLoadingMutation, exportView, 'B3 user-removal loading mutation changes production lifecycle branch');
assert.doesNotThrow(() => transformSync(staleSharedLoadingMutation, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'B3 user-removal loading mutation remains compile-real TSX');
assert.equal(b3SourcePasses(app, sync, settings, staleSharedLoadingMutation), false, 'B3 user-removal loading mutation fails source gate');
assert.equal(loadingAfterSharedUserRemoval(staleSharedLoadingMutation, true), true, 'B3 user-removal loading mutation leaves stale loading visible');
const staleSharedPullMutation = exportView.replace(sharedPullCurrentGuard, 'if (false) return;');
assert.notEqual(staleSharedPullMutation, exportView, 'B3 stale-shared-pull mutation changes exact production guard');
assert.doesNotThrow(() => transformSync(staleSharedPullMutation, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'B3 stale-shared-pull mutation remains compile-real TSX');
assert.equal(b3SourcePasses(app, sync, settings, staleSharedPullMutation), false, 'B3 stale-shared-pull mutation fails source gate');
assert.equal(sharedPullStatusAfterCompletion(staleSharedPullMutation, true, true), 'sync-error', 'B3 stale-shared-pull mutation publishes after unmount');
assert.equal(sharedPullStatusAfterCompletion(staleSharedPullMutation, false, false), 'sync-error', 'B3 stale-shared-pull mutation publishes after user switch');
const staleSharedPullRoute = productionNotificationRoute(app, false, sharedPullStatusAfterCompletion(staleSharedPullMutation, true, true) ?? '', false, true);
assert.equal(staleSharedPullRoute.visible && staleSharedPullRoute.isPersistent && staleSharedPullRoute.msg === 'Sync failed — will retry', true, 'B3 stale-shared-pull mutation independently fails rendered failure gate');

type SetupSaveOutcome = { activated: boolean; cloudSetupWrite: boolean; dirty: boolean; pressuresPropagated: boolean };
const setupSaveOutcome = (source: string, didPersist: boolean, activeSelectionChanged: boolean): SetupSaveOutcome => {
  const repairedGuard = source.includes('if (!didPersist && !activeSelectionChanged) return;');
  const oldGuard = source.includes('if (!didPersist) return;');
  const returns = repairedGuard ? !didPersist && !activeSelectionChanged : oldGuard ? !didPersist : false;
  if (returns) return { activated: false, cloudSetupWrite: false, dirty: false, pressuresPropagated: false };
  return {
    activated: activeSelectionChanged,
    cloudSetupWrite: didPersist && source.includes('if (didPersist) {\n      if (syncOwnerId) pushSetups(safeSetups, syncOwnerId, setSyncStatus);'),
    dirty: true,
    pressuresPropagated: activeSelectionChanged && source.includes('if (activated || pressuresChanged) {') && source.includes('const pressures = setupPressureBlock(nextActive);'),
  };
};
assert.deepEqual(setupSaveOutcome(app, false, false), { activated: false, cloudSetupWrite: false, dirty: false, pressuresPropagated: false }, 'B3 genuine reverted no-op stays silent');
assert.deepEqual(setupSaveOutcome(app, false, true), { activated: true, cloudSetupWrite: false, dirty: true, pressuresPropagated: true }, 'B3 unchanged-array active selection persists and propagates pressures without setup cloud write');
assert.deepEqual(setupSaveOutcome(app, true, false), { activated: false, cloudSetupWrite: true, dirty: true, pressuresPropagated: false }, 'B3 setup byte change persists and arms honest boundary feedback');
const activeSelectionMutation = app.replace('if (!didPersist && !activeSelectionChanged) return;', 'if (!didPersist) return;');
compileB2Mutation(activeSelectionMutation, 'unchanged-array-active-selection');
assert.equal(b3SourcePasses(activeSelectionMutation, sync), false, 'B3 active-selection mutation fails source gate');
assert.equal(setupSaveOutcome(activeSelectionMutation, false, true).activated, false, 'B3 active-selection mutation behaviorally blocks Use Setup');
const activationRender = b2NotificationGeometry({ viewportWidth: 360, viewportHeight: 800, scale: 1, appSource: app, offline: true, simultaneous: true, includeInfo: false });
assert.equal(setupSaveOutcome(app, false, true).dirty && activationRender.noticeText.includes('Offline — saved on device'), true, 'B3 unchanged-array activation reaches truthful rendered offline feedback at boundary');
const activationRoute = (source: string): B2RenderedRoute => productionNotificationRoute(
  source,
  setupSaveOutcome(source, false, true).dirty,
  '',
  false,
  false,
);
const baselineActivationRoute = activationRoute(app);
assert.equal(baselineActivationRoute?.visible && baselineActivationRoute.msg === 'Offline — saved on device', true, 'B3 production activation route renders truthful offline feedback');
const mutatedActivationRoute = activationRoute(activeSelectionMutation);
assert.equal(mutatedActivationRoute.visible || mutatedActivationRoute.msg.includes('Saved'), false, 'B3 active-selection mutation independently fails production rendered route');
const blockedFlashMutation = app.replace('if (!didPersist && !activeSelectionChanged) return;', 'if (false) return;');
compileB2Mutation(blockedFlashMutation, 'blocked-save-flash');
assert.equal(b3SourcePasses(blockedFlashMutation, sync), false, 'B3 blocked-save mutation fails source gate');
assert.equal(setupSaveOutcome(blockedFlashMutation, false, false).dirty, true, 'B3 blocked-save mutation behaviorally arms false Saved');

for (const [label, start, end, expected] of pullSpecs) {
  const block = pullBlock(sync, start, end, label);
  const parts = block.split(callbackToken);
  assert.equal(parts.length - 1, expected, `B3 ${label} exposes every query-error/catch callback`);
  for (let index = 0; index < expected; index += 1) {
    const mutatedBlock = parts.map((part, partIndex) => partIndex === 0
      ? part
      : `${partIndex - 1 === index ? '' : callbackToken}${part}`).join('');
    const mutatedSync = sync.replace(block, mutatedBlock);
    assert.doesNotThrow(() => transformSync(mutatedSync, { loader: 'ts', format: 'esm' }), `B3 ${label} error-path mutation ${index + 1} compiles`);
    assert.equal(pullErrorsPass(mutatedSync), false, `B3 ${label} error-path mutation ${index + 1} fails source gate`);
    assert.equal((mutatedBlock.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length, expected - 1, `B3 ${label} mutation ${index + 1} behaviorally drops one real failure report`);
    const baselineFailureStatus: TransitionStatus = (block.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length === expected ? 'sync-error' : 'syncing';
    const mutatedFailureStatus: TransitionStatus = (mutatedBlock.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length === expected ? 'sync-error' : 'syncing';
    assert.equal(baselineFailureStatus, 'sync-error', `B3 ${label} production model reports failure path ${index + 1}`);
    assert.equal(mutatedFailureStatus, 'syncing', `B3 ${label} mutation model leaves failure path ${index + 1} nonterminal`);
    const baselineFailureRoute = productionNotificationRoute(app, false, baselineFailureStatus, false, true);
    const mutatedFailureRoute = productionNotificationRoute(app, false, mutatedFailureStatus, false, true);
    assert.equal(baselineFailureRoute.msg, 'Sync failed — will retry', `B3 ${label} failure path ${index + 1} renders persistent error`);
    assert.equal(mutatedFailureRoute.msg === 'Sync failed — will retry' || mutatedFailureRoute.isPersistent, false, `B3 ${label} mutation ${index + 1} independently fails rendered error gate`);
  }
}

const pushSetupsBlock = between(sync, 'export function pushSetups(', '/** Push race weekends', 'B3 pushSetups block');
const pushErrorParts = pushSetupsBlock.split(callbackToken);
assert.equal(pushErrorParts.length - 1, 2, 'B3 pushSetups exposes query-error and catch failure callbacks');
for (let index = 0; index < 2; index += 1) {
  const mutatedBlock = pushErrorParts.map((part, partIndex) => partIndex === 0
    ? part
    : `${partIndex - 1 === index ? '' : callbackToken}${part}`).join('');
  const pushErrorMutation = sync.replace(pushSetupsBlock, mutatedBlock);
  assert.doesNotThrow(() => transformSync(pushErrorMutation, { loader: 'ts', format: 'esm' }), `B3 push error mutation ${index + 1} compiles`);
  assert.equal(b3SourcePasses(app, pushErrorMutation), false, `B3 production push-error callback mutation ${index + 1} fails source gate`);
  assert.equal((mutatedBlock.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length, 1, `B3 production push-error mutation ${index + 1} removes one real report`);
}

type RenderStatus = 'synced' | 'offline-saved' | 'deferred-delete-retrying' | 'sync-error';
type TransitionStatus = RenderStatus | 'syncing';
const typedRenderCases: Array<[RenderStatus, string, 'saved' | 'sync', boolean]> = [
  ['synced', 'Synced', 'saved', false],
  ['offline-saved', 'Offline — saved on device', 'saved', false],
  ['deferred-delete-retrying', 'Sync failed — will retry', 'sync', true],
  ['sync-error', 'Sync failed — will retry', 'sync', true],
];
for (const [status, copy, kind, persistent] of typedRenderCases) {
  const rendered = b2NotificationGeometry({ viewportWidth: 360, viewportHeight: 800, scale: 1, appSource: app, offline: true, status });
  assert.equal(rendered.noticeText.includes(copy), true, `B3 ${status} renders truthful copy`);
  assert.equal(rendered.noticeKind, kind, `B3 ${status} renders truthful treatment`);
  assert.equal(rendered.close !== null, persistent, `B3 ${status} direct acknowledgement matches persistence`);
  if (persistent) assert.ok(rendered.close!.width >= 44 && rendered.close!.height >= 44, `B3 ${status} acknowledgement target is at least 44px`);
}

const terminalGuard = 'isTerminalSyncStatus(current) && !isTerminalSyncStatus(next) ? current : next';
const transitionStatus = (source: string, current: RenderStatus, next: TransitionStatus): TransitionStatus => (
  source.includes(terminalGuard) && (current === 'sync-error' || current === 'deferred-delete-retrying')
    && next !== 'sync-error' && next !== 'deferred-delete-retrying' ? current : next
);
const terminalBypassMutation = app.replace(terminalGuard, 'next');
compileB2Mutation(terminalBypassMutation, 'terminal-status-bypass');
assert.equal(b3SourcePasses(terminalBypassMutation, sync), false, 'B3 terminal bypass mutation fails source gate');
for (const terminal of ['sync-error', 'deferred-delete-retrying'] as const) {
  for (const next of ['synced', 'offline-saved', 'syncing'] as const) {
    assert.equal(transitionStatus(app, terminal, next), terminal, `B3 ${terminal} survives later ${next}`);
    assert.equal(transitionStatus(terminalBypassMutation, terminal, next), next, `B3 bypass mutation lets ${next} overwrite ${terminal}`);
    const baselineRender = productionNotificationRoute(app, false, transitionStatus(app, terminal, next), false, true);
    const mutatedRender = productionNotificationRoute(terminalBypassMutation, false, transitionStatus(terminalBypassMutation, terminal, next), false, true);
    assert.equal(baselineRender.msg === 'Sync failed — will retry' && baselineRender.isPersistent, true, `B3 ${terminal} remains rendered as persistent failure after ${next}`);
    assert.equal(mutatedRender.msg === 'Sync failed — will retry' || mutatedRender.isPersistent, false, `B3 terminal bypass mutation fails rendered persistence gate for later ${next}`);
  }
}

const failedPushRace = productionNotificationRoute(app, true, 'sync-error', false, false);
assert.equal(failedPushRace.msg === 'Sync failed — will retry' && failedPushRace.isPersistent && !failedPushRace.isSuccess, true, 'B3 failure immediately overrides prior Saved');
const errorAsSuccessMutation = app.replace(": 'Sync failed — will retry';", ": 'Synced';");
compileB2Mutation(errorAsSuccessMutation, 'error-as-success');
assert.equal(b3SourcePasses(errorAsSuccessMutation, sync), false, 'B3 error-as-success mutation fails source gate');
const falseErrorRender = productionNotificationRoute(errorAsSuccessMutation, false, 'sync-error', false, false);
assert.equal(falseErrorRender.msg.includes('Sync failed — will retry'), false, 'B3 error-as-success mutation fails rendered copy gate');

const errorAutoDismissMutation = app.replace(
  "const resolved = current === 'synced' || current === 'offline-saved' ? null : current;",
  'const resolved = null;',
);
compileB2Mutation(errorAutoDismissMutation, 'error-auto-dismiss');
assert.equal(b3SourcePasses(errorAutoDismissMutation, sync), false, 'B3 error auto-dismiss mutation fails source gate');
const statusAfterTimer = (source: string, current: RenderStatus): RenderStatus | null => (
  source.includes("current === 'synced' || current === 'offline-saved' ? null : current")
    ? current === 'synced' || current === 'offline-saved' ? null : current
    : null
);
assert.equal(statusAfterTimer(app, 'sync-error'), 'sync-error', 'B3 sync error persists past success timer');
assert.equal(statusAfterTimer(errorAutoDismissMutation, 'sync-error'), null, 'B3 auto-dismiss mutation behaviorally clears error');

const pullCompletionMutation = app.replace('const resolved = isTerminalSyncStatus(current) ? current : null;', 'const resolved = null;');
compileB2Mutation(pullCompletionMutation, 'pull-completion-clears-error');
assert.equal(b3SourcePasses(pullCompletionMutation, sync), false, 'B3 pull-completion mutation fails source gate');
const terminalAfterPullCompletion = (source: string, current: RenderStatus): RenderStatus | null => (
  source.includes('const resolved = isTerminalSyncStatus(current) ? current : null;') ? current : null
);
assert.equal(terminalAfterPullCompletion(app, 'sync-error'), 'sync-error', 'B3 pull completion preserves terminal error');
assert.equal(terminalAfterPullCompletion(pullCompletionMutation, 'sync-error'), null, 'B3 pull-completion mutation behaviorally clears terminal error');
const pullCompletionRoute = productionNotificationRoute(app, false, terminalAfterPullCompletion(app, 'sync-error') ?? '', false, true);
const pullCompletionMutationRoute = productionNotificationRoute(pullCompletionMutation, false, terminalAfterPullCompletion(pullCompletionMutation, 'sync-error') ?? '', false, true);
assert.equal(pullCompletionRoute.visible && pullCompletionRoute.isPersistent && pullCompletionRoute.msg === 'Sync failed — will retry', true, 'B3 pull completion keeps rendered terminal error');
assert.equal(pullCompletionMutationRoute.visible || pullCompletionMutationRoute.isPersistent || pullCompletionMutationRoute.msg.includes('Sync failed'), false, 'B3 pull-completion mutation independently fails rendered persistence gate');
const pullSuccessSourceMutation = app.replace('if (!pullReportedFailure) clearTransientSyncStatus();', "setSyncStatus('synced');");
compileB2Mutation(pullSuccessSourceMutation, 'pull-success');
assert.equal(b3SourcePasses(pullSuccessSourceMutation, sync), false, 'B3 pull-success mutation fails source gate');
assert.equal(pullSuccessSourceMutation.includes("setSyncStatus('synced');"), true, 'B3 pull-success mutation behaviorally enqueues false success');
console.log('B3 honest status harness: PASS');
console.log('B2 notification arbiter harness: PASS');

// C4 autosave boundary harness follows. B1/B2/B3 coverage above stays active.

type RuntimeExport = (...args: any[]) => any;
let c4AssertionCount = 0;
const killedC4Mutations: string[] = [];
const c4Ok = (value: unknown, message: string): void => {
  c4AssertionCount += 1;
  assert.ok(value, message);
};
const c4Equal = (actual: unknown, expected: unknown, message: string): void => {
  c4AssertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const c4Kill = (name: string, killed: boolean): void => {
  c4AssertionCount += 1;
  assert.equal(killed, true, `C4 mutation killed: ${name}`);
  killedC4Mutations.push(name);
};

const compileExport = (
  source: string,
  name: string,
  endMarker: string,
  dependencies: Record<string, unknown> = {},
): RuntimeExport => {
  const start = source.indexOf(`export const ${name} =`);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `C4 production export ${name} exists`);
  const compiled = transformSync(source.slice(start, end), { loader: 'tsx', format: 'cjs' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  const dependencyNames = Object.keys(dependencies);
  const evaluate = new Function('module', 'exports', ...dependencyNames, compiled);
  evaluate(moduleBox, moduleBox.exports, ...dependencyNames.map(key => dependencies[key]));
  return moduleBox.exports[name] as RuntimeExport;
};

const compileHandler = (
  source: string,
  name: string,
  nextAnchor: string,
  dependencies: Record<string, unknown>,
): RuntimeExport => {
  const block = between(source, `  const ${name} =`, nextAnchor, `C4 ${name} production handler`);
  const exported = block.replace(`  const ${name} =`, `export const ${name} =`);
  const compiled = transformSync(exported, { loader: 'tsx', format: 'cjs' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  const dependencyNames = Object.keys(dependencies);
  const evaluate = new Function('module', 'exports', ...dependencyNames, compiled);
  evaluate(moduleBox, moduleBox.exports, ...dependencyNames.map(key => dependencies[key]));
  return moduleBox.exports[name] as RuntimeExport;
};

const intervalFromSource = (source: string): number => {
  const match = source.match(/const SAVED_FEEDBACK_INTERVAL_MS = ([\d_]+);/);
  assert.ok(match, 'C4 production interval constant exists');
  return Number(match[1].replaceAll('_', ''));
};
const compileController = (source = app): RuntimeExport => compileExport(
  source,
  'createSavedFeedbackController',
  '\ntype SavedFeedbackBoundaryTargets',
);
const compileInstaller = (source = app): RuntimeExport => compileExport(
  source,
  'installSavedFeedbackBoundaries',
  '\nexport const flushSavedFeedbackOnTabChange',
  { SAVED_FEEDBACK_INTERVAL_MS: intervalFromSource(source) },
);
const compileTabBoundary = (source = app): RuntimeExport => compileExport(
  source,
  'flushSavedFeedbackOnTabChange',
  '\nconst isOnlineNow',
);

const c4SourcePasses = (source: string): boolean => {
  const sessionCreate = between(source, '  const handleCreateNewSession =', '  // Immediate delete', 'C4 session source');
  return source.includes('const SAVED_FEEDBACK_INTERVAL_MS = 30_000;')
    && source.includes('export const createSavedFeedbackController =')
    && source.includes('if (!dirty) return false;\n      dirty = false;\n      announceSaved();')
    && source.includes('export const installSavedFeedbackBoundaries =')
    && source.includes("targets.documentTarget.addEventListener('visibilitychange', onVisibilityChange);")
    && source.includes("targets.windowTarget.addEventListener('pagehide', onPageHide);")
    && source.includes('targets.windowTarget.setInterval(flushSavedBoundary, SAVED_FEEDBACK_INTERVAL_MS)')
    && source.includes('if (!isActive) flushSavedBoundary();')
    && source.includes("targets.documentTarget.removeEventListener('visibilitychange', onVisibilityChange);")
    && source.includes("targets.windowTarget.removeEventListener('pagehide', onPageHide);")
    && source.includes('targets.windowTarget.clearInterval(intervalHandle);')
    && source.includes('export const flushSavedFeedbackOnTabChange =')
    && source.includes('previousTab !== nextTab && flushSavedBoundary()')
    && source.includes('const markSavedDirty = () => { savedFeedbackControllerRef.current?.markDirty(); };')
    && source.includes('const flushSavedBoundary = () => savedFeedbackControllerRef.current?.flush() ?? false;')
    && source.includes('createSavedFeedbackController(() => flashSavedRef.current())')
    && source.includes('flushSavedFeedbackOnTabChange(previousTab, activeTab, flushSavedBoundary);')
    && source.includes('useEffect(() => installSavedFeedbackBoundaries(flushSavedBoundary, {')
    && (source.match(/\bmarkSavedDirty\(\);/g) ?? []).length === 22
    && (source.match(/\bflashSaved\(\);/g) ?? []).length === 0
    && sessionCreate.includes("localStorage.setItem('race_notes_active_session', JSON.stringify(nextSession));\n    markSavedDirty();\n    flushSavedBoundary();");
};
c4Ok(c4SourcePasses(app), 'C4 production source binds one dirty controller and every required boundary');

const createController = compileController(app) as (announce: () => void) => {
  markDirty: () => void;
  flush: () => boolean;
  isDirty: () => boolean;
};
let burstAnnouncements = 0;
const burstController = createController(() => { burstAnnouncements += 1; });
const burstStore = new Map<string, string>();
let burstWrites = 0;
const burstEvents: string[] = [];
const compileTireSave = (source: string, controller = burstController, announcements?: { count: number }) => compileHandler(
  source,
  'handleSaveTires',
  '  const handleDeleteTireFromCloud',
  {
    setTireInventory: () => { burstEvents.push('state'); },
    localStorage: { setItem: (key: string, value: string) => { burstWrites += 1; burstStore.set(key, value); burstEvents.push('write'); } },
    markSavedDirty: () => { burstEvents.push('mark'); controller.markDirty(); },
    flashSaved: () => { burstEvents.push('flash'); if (announcements) announcements.count += 1; },
    user: null,
    pushTires: () => { burstEvents.push('push'); },
    setSyncStatus: () => undefined,
  },
);
const saveTires = compileTireSave(app);
for (const pressure of ['10', '11', '12']) saveTires([{ id: 'tire-1', airPressure: pressure }]);
c4Equal(burstWrites, 3, 'C4 N-edit burst performs N immediate local writes');
c4Equal(burstAnnouncements, 0, 'C4 N-edit burst emits zero Saved before boundary');
c4Equal(JSON.parse(burstStore.get('race_notes_tires') ?? '[]')[0].airPressure, '12', 'C4 final edit is synchronously persisted');
c4Ok(burstEvents.lastIndexOf('write') < burstEvents.lastIndexOf('mark'), 'C4 dirty mark follows direct persistence');

const tabBoundary = compileTabBoundary(app) as (previous: string, next: string, flush: () => boolean) => boolean;
c4Equal(tabBoundary('setups', 'raceweekend', burstController.flush), true, 'C4 tab change consumes dirty boundary');
c4Equal(burstAnnouncements, 1, 'C4 first dirty tab boundary emits exactly one Saved');
c4Equal(tabBoundary('raceweekend', 'dashboard', burstController.flush), false, 'C4 clean second tab boundary stays silent');
c4Equal(burstAnnouncements, 1, 'C4 clean tab boundary emits zero additional Saved');
burstController.markDirty();
c4Equal(tabBoundary('dashboard', 'trackers', burstController.flush), true, 'C4 later edit rearms tab boundary');
c4Equal(burstAnnouncements, 2, 'C4 rearmed boundary emits one later Saved');

const processDeathStore = new Map(burstStore);
let processDeathAnnouncements = 0;
const relaunchedController = createController(() => { processDeathAnnouncements += 1; });
c4Equal(JSON.parse(processDeathStore.get('race_notes_tires') ?? '[]')[0].airPressure, '12', 'C4 process death retains every pre-boundary persisted edit');
c4Equal(processDeathAnnouncements, 0, 'C4 process death before boundary needs no prior Saved feedback');
c4Equal(relaunchedController.isDirty(), false, 'C4 dirty feedback state is memory-only and not resurrected');

const immediateCounter = { count: 0 };
const immediateFlashMutation = app.replace(
  "localStorage.setItem('race_notes_tires', JSON.stringify(updated));\n    markSavedDirty();",
  "localStorage.setItem('race_notes_tires', JSON.stringify(updated));\n    flashSaved();",
);
assert.notEqual(immediateFlashMutation, app, 'C4 immediate-flash mutation changes production tire handler');
const immediateSave = compileTireSave(immediateFlashMutation, createController(() => undefined), immediateCounter);
immediateSave([]); immediateSave([]); immediateSave([]);
c4Kill('immediate-flash-restored', immediateCounter.count === 3);

const markBeforePersistenceMutation = app.replace(
  "setTireInventory(updated);\n    localStorage.setItem('race_notes_tires', JSON.stringify(updated));\n    markSavedDirty();",
  "markSavedDirty();\n    setTireInventory(updated);\n    localStorage.setItem('race_notes_tires', JSON.stringify(updated));",
);
assert.notEqual(markBeforePersistenceMutation, app, 'C4 mark-before-persistence mutation changes production tire handler');
burstEvents.length = 0;
compileTireSave(markBeforePersistenceMutation)([]);
c4Kill('mark-before-persistence', burstEvents.indexOf('mark') < burstEvents.indexOf('write'));

const omittedTabMutation = app.replace('previousTab !== nextTab && flushSavedBoundary()', 'false && flushSavedBoundary()');
const omittedTab = compileTabBoundary(omittedTabMutation) as typeof tabBoundary;
let omittedTabAnnouncements = 0;
const omittedTabController = createController(() => { omittedTabAnnouncements += 1; });
omittedTabController.markDirty();
omittedTab('setups', 'raceweekend', omittedTabController.flush);
c4Kill('tab-boundary-omitted', omittedTabAnnouncements === 0 && omittedTabController.isDirty());

type BoundaryProbe = {
  controller: ReturnType<typeof createController>;
  announcements: () => number;
  setHidden: () => void;
  fireVisibility: () => void;
  firePageHide: () => void;
  fireNative: (isActive: boolean) => void;
  fireTimer: () => void;
  intervalDelay: () => number;
  cleanup: () => void;
  counts: Record<string, number>;
};
const createBoundaryProbe = (source = app): BoundaryProbe => {
  let announcements = 0;
  const controllerFactory = compileController(source) as typeof createController;
  const controller = controllerFactory(() => { announcements += 1; });
  let visibilityState = 'visible';
  let visibilityListener: (() => void) | null = null;
  let pageHideListener: (() => void) | null = null;
  let nativeListener: ((state: { isActive: boolean }) => void) | null = null;
  let timerCallback: (() => void) | null = null;
  let timerDelay = 0;
  const counts = {
    visibilityAdd: 0, visibilityRemove: 0,
    pageHideAdd: 0, pageHideRemove: 0,
    intervalAdd: 0, intervalClear: 0,
    nativeAdd: 0, nativeRemove: 0,
  };
  const documentTarget = {
    get visibilityState() { return visibilityState; },
    addEventListener: (_type: 'visibilitychange', listener: () => void) => { counts.visibilityAdd += 1; visibilityListener = listener; },
    removeEventListener: (_type: 'visibilitychange', listener: () => void) => {
      counts.visibilityRemove += 1;
      if (visibilityListener === listener) visibilityListener = null;
    },
  };
  const windowTarget = {
    addEventListener: (_type: 'pagehide', listener: () => void) => { counts.pageHideAdd += 1; pageHideListener = listener; },
    removeEventListener: (_type: 'pagehide', listener: () => void) => {
      counts.pageHideRemove += 1;
      if (pageHideListener === listener) pageHideListener = null;
    },
    setInterval: (callback: () => void, delay: number) => { counts.intervalAdd += 1; timerCallback = callback; timerDelay = delay; return 41; },
    clearInterval: (handle: number) => { assert.equal(handle, 41); counts.intervalClear += 1; timerCallback = null; },
  };
  const addNativeListener = async (listener: (state: { isActive: boolean }) => void) => {
    counts.nativeAdd += 1;
    nativeListener = listener;
    return { remove: async () => { counts.nativeRemove += 1; nativeListener = null; } };
  };
  const install = compileInstaller(source) as (
    flush: () => boolean,
    targets: { documentTarget: typeof documentTarget; windowTarget: typeof windowTarget; addNativeListener: typeof addNativeListener },
  ) => () => void;
  const cleanup = install(controller.flush, { documentTarget, windowTarget, addNativeListener });
  return {
    controller,
    announcements: () => announcements,
    setHidden: () => { visibilityState = 'hidden'; },
    fireVisibility: () => { visibilityListener?.(); },
    firePageHide: () => { pageHideListener?.(); },
    fireNative: isActive => { nativeListener?.({ isActive }); },
    fireTimer: () => { timerCallback?.(); },
    intervalDelay: () => timerDelay,
    cleanup,
    counts,
  };
};

const boundaryProbe = createBoundaryProbe(app);
c4Equal(boundaryProbe.counts, {
  visibilityAdd: 1, visibilityRemove: 0,
  pageHideAdd: 1, pageHideRemove: 0,
  intervalAdd: 1, intervalClear: 0,
  nativeAdd: 1, nativeRemove: 0,
}, 'C4 lifecycle listeners and timer register once');
boundaryProbe.controller.markDirty();
boundaryProbe.setHidden();
boundaryProbe.fireVisibility();
c4Equal(boundaryProbe.announcements(), 1, 'C4 hidden visibility flushes dirty feedback once');
boundaryProbe.firePageHide();
c4Equal(boundaryProbe.announcements(), 1, 'C4 paired visibility and pagehide coalesce');
boundaryProbe.controller.markDirty();
boundaryProbe.firePageHide();
c4Equal(boundaryProbe.announcements(), 2, 'C4 isolated pagehide flushes once');
boundaryProbe.controller.markDirty();
boundaryProbe.fireNative(false);
c4Equal(boundaryProbe.announcements(), 3, 'C4 native inactive flushes once');
boundaryProbe.fireNative(true);
c4Equal(boundaryProbe.announcements(), 3, 'C4 native active transition stays feedback-silent');
boundaryProbe.controller.markDirty();
c4Equal(boundaryProbe.intervalDelay(), 30_000, 'C4 periodic cadence is exactly 30,000ms');
boundaryProbe.fireTimer();
c4Equal(boundaryProbe.announcements(), 4, 'C4 dirty periodic timer flushes once');
boundaryProbe.fireTimer();
c4Equal(boundaryProbe.announcements(), 4, 'C4 clean periodic timer stays silent');
boundaryProbe.cleanup();
await Promise.resolve();
await Promise.resolve();
c4Equal(boundaryProbe.counts, {
  visibilityAdd: 1, visibilityRemove: 1,
  pageHideAdd: 1, pageHideRemove: 1,
  intervalAdd: 1, intervalClear: 1,
  nativeAdd: 1, nativeRemove: 1,
}, 'C4 lifecycle listeners and timer clean up exactly once');

const boundaryMutationResult = (
  source: string,
  fire: (probe: BoundaryProbe) => void,
): { announcements: number; dirty: boolean; probe: BoundaryProbe } => {
  const probe = createBoundaryProbe(source);
  probe.controller.markDirty();
  fire(probe);
  return { announcements: probe.announcements(), dirty: probe.controller.isDirty(), probe };
};
const visibilityOmittedMutation = app.replace(
  "if (targets.documentTarget.visibilityState === 'hidden') flushSavedBoundary();",
  "if (targets.documentTarget.visibilityState === 'hidden') return;",
);
const visibilityMutationResult = boundaryMutationResult(visibilityOmittedMutation, probe => { probe.setHidden(); probe.fireVisibility(); });
c4Kill('visibility-boundary-omitted', visibilityMutationResult.announcements === 0 && visibilityMutationResult.dirty);

const pageHideOmittedMutation = app.replace(
  'const onPageHide = () => { flushSavedBoundary(); };',
  'const onPageHide = () => undefined;',
);
const pageHideMutationResult = boundaryMutationResult(pageHideOmittedMutation, probe => probe.firePageHide());
c4Kill('pagehide-boundary-omitted', pageHideMutationResult.announcements === 0 && pageHideMutationResult.dirty);

const nativeOmittedMutation = app.replace('if (!isActive) flushSavedBoundary();', 'if (!isActive) return;');
const nativeMutationResult = boundaryMutationResult(nativeOmittedMutation, probe => probe.fireNative(false));
c4Kill('native-inactive-boundary-omitted', nativeMutationResult.announcements === 0 && nativeMutationResult.dirty);

const timerOmittedMutation = app.replace(
  'targets.windowTarget.setInterval(flushSavedBoundary, SAVED_FEEDBACK_INTERVAL_MS)',
  'targets.windowTarget.setInterval(() => undefined, SAVED_FEEDBACK_INTERVAL_MS)',
);
const timerMutationResult = boundaryMutationResult(timerOmittedMutation, probe => probe.fireTimer());
c4Kill('timer-boundary-omitted', timerMutationResult.announcements === 0 && timerMutationResult.dirty);

const timerCadenceMutation = app.replace('const SAVED_FEEDBACK_INTERVAL_MS = 30_000;', 'const SAVED_FEEDBACK_INTERVAL_MS = 29_999;');
const timerCadenceProbe = createBoundaryProbe(timerCadenceMutation);
c4Kill('timer-cadence-changed', timerCadenceProbe.intervalDelay() === 29_999);

const dirtyClearMutation = app.replace('dirty = false;\n      announceSaved();', 'announceSaved();');
const dirtyClearControllerFactory = compileController(dirtyClearMutation) as typeof createController;
let dirtyClearAnnouncements = 0;
const dirtyClearController = dirtyClearControllerFactory(() => { dirtyClearAnnouncements += 1; });
dirtyClearController.markDirty();
dirtyClearController.flush();
dirtyClearController.flush();
c4Kill('dirty-clear-omitted', dirtyClearAnnouncements === 2);

const cleanGuardMutation = app.replace('if (!dirty) return false;', 'if (false) return false;');
const cleanGuardFactory = compileController(cleanGuardMutation) as typeof createController;
let cleanGuardAnnouncements = 0;
cleanGuardFactory(() => { cleanGuardAnnouncements += 1; }).flush();
c4Kill('clean-boundary-flushes', cleanGuardAnnouncements === 1);

const visibilityCleanupMutation = app.replace(
  "    targets.documentTarget.removeEventListener('visibilitychange', onVisibilityChange);\n",
  '',
);
const visibilityCleanupProbe = createBoundaryProbe(visibilityCleanupMutation);
visibilityCleanupProbe.cleanup();
c4Kill('visibility-cleanup-removed', visibilityCleanupProbe.counts.visibilityRemove === 0);

const pageHideCleanupMutation = app.replace(
  "    targets.windowTarget.removeEventListener('pagehide', onPageHide);\n",
  '',
);
const pageHideCleanupProbe = createBoundaryProbe(pageHideCleanupMutation);
pageHideCleanupProbe.cleanup();
c4Kill('pagehide-cleanup-removed', pageHideCleanupProbe.counts.pageHideRemove === 0);

const timerCleanupMutation = app.replace('    targets.windowTarget.clearInterval(intervalHandle);\n', '');
const timerCleanupProbe = createBoundaryProbe(timerCleanupMutation);
timerCleanupProbe.cleanup();
c4Kill('timer-cleanup-removed', timerCleanupProbe.counts.intervalClear === 0);

const nativeCleanupMutation = app.replace(
  '    if (nativeListener) void nativeListener.then(listener => listener.remove());\n',
  '',
);
const nativeCleanupProbe = createBoundaryProbe(nativeCleanupMutation);
nativeCleanupProbe.cleanup();
await Promise.resolve();
await Promise.resolve();
c4Kill('native-cleanup-removed', nativeCleanupProbe.counts.nativeRemove === 0);

const compileFlashSaved = (source: string): RuntimeExport => {
  const block = between(source, '  const flashSaved = () => {', '  flashSavedRef.current = flashSaved;', 'C4 flashSaved production block');
  const exported = block.replace('  const flashSaved =', 'export const flashSaved =');
  return (dependencies: Record<string, unknown>) => {
    const compiled = transformSync(exported, { loader: 'tsx', format: 'cjs' }).code;
    const moduleBox = { exports: {} as Record<string, unknown> };
    const names = Object.keys(dependencies);
    const evaluate = new Function('module', 'exports', ...names, compiled);
    evaluate(moduleBox, moduleBox.exports, ...names.map(key => dependencies[key]));
    return moduleBox.exports.flashSaved;
  };
};
const createFlashRuntime = (source: string, info: unknown, terminal: string | null) => {
  let savedShows = 0;
  const infoToastRef = { current: info };
  const syncStatusRef = { current: terminal };
  const savedFlashTimer = { current: null as number | null };
  const flashFactory = compileFlashSaved(source);
  const flashSaved = flashFactory({
    infoToastRef,
    isTerminalSyncStatus: (status: string | null) => status === 'sync-error' || status === 'deferred-delete-retrying',
    syncStatusRef,
    isOnline: true,
    setSyncStatus: () => undefined,
    setSavedFlash: (value: boolean) => { if (value) savedShows += 1; },
    savedFlashTimer,
    clearTimeout: () => undefined,
    setTimeout: () => 91,
    SUCCESS_TOAST_MS: 1500,
  }) as () => void;
  return { flashSaved, infoToastRef, syncStatusRef, savedShows: () => savedShows };
};

const infoFlash = createFlashRuntime(app, { reason: 'pressure-source' }, null);
const infoController = createController(infoFlash.flashSaved);
infoController.markDirty();
c4Equal(infoController.flush(), true, 'C4 info-suppressed boundary still consumes dirty state');
c4Equal(infoFlash.savedShows(), 0, 'C4 accepted info priority suppresses boundary Saved');
infoFlash.infoToastRef.current = null;
c4Equal(infoController.flush(), false, 'C4 info acknowledgement cannot resurrect consumed Saved');
c4Equal(infoFlash.savedShows(), 0, 'C4 no stale Saved appears after info acknowledgement');

const terminalFlash = createFlashRuntime(app, null, 'sync-error');
const terminalController = createController(terminalFlash.flashSaved);
terminalController.markDirty();
c4Equal(terminalController.flush(), true, 'C4 terminal-suppressed boundary consumes dirty state');
c4Equal(terminalFlash.savedShows(), 0, 'C4 accepted terminal priority suppresses boundary Saved');
terminalFlash.syncStatusRef.current = null;
c4Equal(terminalController.flush(), false, 'C4 terminal acknowledgement cannot resurrect consumed Saved');

const priorityMutation = app.replace(
  'if (infoToastRef.current || isTerminalSyncStatus(syncStatusRef.current)) return;',
  'if (false) return;',
);
const priorityFlash = createFlashRuntime(priorityMutation, null, 'sync-error');
const priorityController = createController(priorityFlash.flashSaved);
priorityController.markDirty();
priorityController.flush();
c4Kill('boundary-priority-weakened', priorityFlash.savedShows() === 1);

const sessionHandlerBlock = (source: string): string => between(
  source,
  '  const handleCreateNewSession =',
  '  // Immediate delete',
  'C4 session handler',
);
const compileSessionPersistence = (source: string): RuntimeExport => {
  const sessionBlock = sessionHandlerBlock(source);
  const start = sessionBlock.indexOf('    const updatedWeekends = weekendsRef.current.map');
  const end = sessionBlock.indexOf('    if (pressureSourceNote)', start);
  assert.ok(start >= 0 && end > start, 'C4 real session persistence tail exists');
  const tail = sessionBlock.slice(start, end);
  const wrapped = `export function persistCreatedSession(context: any) {
    const { weekendsRef, targetWeekend, newRecord, setWeekends, localStorage, syncOwnerId, pushWeekends,
      syncTireLifecycle, tireInventory, setTireInventory, user, pushTires, activeSessionRef, nextSession,
      setActiveSession, markSavedDirty, flushSavedBoundary } = context;
${tail}
  }`;
  const compiled = transformSync(wrapped, { loader: 'tsx', format: 'cjs' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compiled)(moduleBox, moduleBox.exports);
  return moduleBox.exports.persistCreatedSession as RuntimeExport;
};
const runSessionPersistence = (source: string) => {
  const events: string[] = [];
  const storage = new Map<string, string>();
  let announcements = 0;
  const controller = createController(() => { announcements += 1; events.push('announce'); });
  const targetWeekend = { id: 'weekend-1', sessions: [] };
  const newRecord = { id: 'session-1', setupId: 'setup-1', setupSnapshot: { chassis: 'Owner Setup', gear: '6.20' } };
  const nextSession = { id: 'session-1', weekendId: 'weekend-1' };
  compileSessionPersistence(source)({
    weekendsRef: { current: [targetWeekend] },
    targetWeekend,
    newRecord,
    setWeekends: () => { events.push('state:weekends'); },
    localStorage: { setItem: (key: string, value: string) => { storage.set(key, value); events.push(`write:${key}`); } },
    syncOwnerId: null,
    pushWeekends: () => { events.push('push:weekends'); },
    syncTireLifecycle: () => [{ id: 'tire-1' }],
    tireInventory: [],
    setTireInventory: () => { events.push('state:tires'); },
    user: null,
    pushTires: () => { events.push('push:tires'); },
    activeSessionRef: { current: null },
    nextSession,
    setActiveSession: () => { events.push('state:active'); },
    markSavedDirty: () => { events.push('mark'); controller.markDirty(); },
    flushSavedBoundary: () => { events.push('flush'); return controller.flush(); },
  });
  return { events, storage, announcements, dirty: controller.isDirty() };
};

const sessionResult = runSessionPersistence(app);
c4Equal(sessionResult.announcements, 1, 'C4 successful session creation flushes exactly once');
c4Equal(sessionResult.dirty, false, 'C4 session boundary clears dirty state');
const lastSessionWrite = Math.max(
  sessionResult.events.indexOf('write:race_notes_weekends'),
  sessionResult.events.indexOf('write:race_notes_tires'),
  sessionResult.events.indexOf('write:race_notes_active_session'),
);
c4Ok(lastSessionWrite < sessionResult.events.indexOf('mark')
  && sessionResult.events.indexOf('mark') < sessionResult.events.indexOf('flush'), 'C4 session persistence completes before mark and flush');
const persistedSessions = JSON.parse(sessionResult.storage.get('race_notes_weekends') ?? '[]')[0].sessions;
c4Equal(persistedSessions[0].setupSnapshot, { chassis: 'Owner Setup', gear: '6.20' }, 'C4 session snapshot persists before feedback boundary');

const sessionFlushOmittedMutation = app.replace(
  '    markSavedDirty();\n    flushSavedBoundary();\n    if (pressureSourceNote)',
  '    markSavedDirty();\n    if (pressureSourceNote)',
);
const sessionFlushOmitted = runSessionPersistence(sessionFlushOmittedMutation);
c4Kill('session-boundary-omitted', sessionFlushOmitted.announcements === 0 && sessionFlushOmitted.dirty);

const sessionMarkOmittedMutation = app.replace(
  '    markSavedDirty();\n    flushSavedBoundary();\n    if (pressureSourceNote)',
  '    flushSavedBoundary();\n    if (pressureSourceNote)',
);
const sessionMarkOmitted = runSessionPersistence(sessionMarkOmittedMutation);
c4Kill('session-dirty-mark-omitted', sessionMarkOmitted.announcements === 0);

const sessionBeforePersistenceMutation = app
  .replace('    markSavedDirty();\n    flushSavedBoundary();\n    if (pressureSourceNote)', '    if (pressureSourceNote)')
  .replace(
    '    const updatedWeekends = weekendsRef.current.map',
    '    markSavedDirty();\n    flushSavedBoundary();\n    const updatedWeekends = weekendsRef.current.map',
  );
const sessionBeforePersistence = runSessionPersistence(sessionBeforePersistenceMutation);
c4Kill('session-boundary-before-persistence', sessionBeforePersistence.events.indexOf('flush') < sessionBeforePersistence.events.indexOf('write:race_notes_weekends'));

const handlerFrom = (source: string, name: string, nextAnchor: string): string => between(
  source,
  `  const ${name} =`,
  nextAnchor,
  `C4 neutrality ${name}`,
);
const helperContracts: Array<[string, string, string[]]> = [
  ['handleSaveTires', '  const handleDeleteTireFromCloud', ['setTireInventory(updated);', "localStorage.setItem('race_notes_tires'", 'markSavedDirty();', 'pushTires(']],
  ['handleSaveCars', '  const handleSaveGarageCars', ['setCars(updated);', "localStorage.setItem('race_notes_cars'", 'if (notifySaved) markSavedDirty();', 'pushCars(']],
  ['handleSaveShockSessions', '  const handleSaveMaintenance', ['setShockSessions(updated);', "localStorage.setItem('race_notes_shock_graphs'", 'if (notifySaved) markSavedDirty();', 'pushShockSessions(']],
  ['handleSaveMaintenance', '  const handleSaveTodos', ['setMaintenance(updated);', "localStorage.setItem('race_notes_maintenance'", 'markSavedDirty();', 'pushMaintenanceComponents(']],
  ['handleSaveTodos', '  const handleSelectGarageCar', ['setTodos(updated);', "localStorage.setItem('race_notes_todos'", 'if (notifySaved) markSavedDirty();', 'pushTodos(']],
  ['handleSaveMaintenanceLogs', '  const handleSaveChecklistTemplates', ['setMaintenanceLogs(updated);', "localStorage.setItem('race_notes_maintenance_logs'", 'markSavedDirty();', 'pushMaintenanceLogs(']],
  ['handleSaveChecklistTemplates', '  const handleSaveWeekendChecklists', ['setChecklistTemplates(updated);', "localStorage.setItem('race_notes_checklist_templates'", 'markSavedDirty();', 'pushChecklistTemplates(']],
  ['handleSaveWeekendChecklists', '  const handleDeleteCar', ['setWeekendChecklists(updated);', "localStorage.setItem('race_notes_weekend_checklists'", 'markSavedDirty();', 'pushWeekendChecklists(']],
];
for (const [name, end, tokens] of helperContracts) {
  const source = handlerFrom(app, name, end);
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    c4Ok(next > cursor, `C4 ${name} keeps ${token} in persistence/feedback/cloud order`);
    cursor = next;
  }
}

const directHandlers: Array<[string, string]> = [
  ['handleSaveTires', '  const handleDeleteTireFromCloud'],
  ['handleClearAllData', '  const handleDeleteAccount'],
  ['handleSaveSetups', '  const handleUpdateSession'],
  ['handleUpdateSession', '  const handleCommitQuickAdjust'],
  ['handleCommitQuickAdjust', '  // Session weather helpers'],
  ['handleCreateNewWeekend', '  const handleCreateNewSession'],
  ['handleCreateNewSession', '  // Immediate delete'],
  ['deleteWeekendNow', '  // [7] Dashboard hero quick-start'],
  ['handleQuickService', '  // Undo removes BOTH records'],
  ['handleUndoQuickService', '  const handleDeleteSession'],
  ['handleDeleteSession', '  const handleUpdateWeekend'],
  ['handleUpdateWeekend', '  const handleFinishWeekend'],
  ['handleFinishWeekend', '  const handleSelectRecentSession'],
];
for (const [name, end] of directHandlers) {
  const source = handlerFrom(app, name, end);
  const persistence = Math.max(source.lastIndexOf('localStorage.setItem'), source.lastIndexOf('localStorage.removeItem'));
  const mark = source.lastIndexOf('markSavedDirty();');
  c4Ok(persistence >= 0 && mark > persistence, `C4 ${name} marks dirty after its final direct local write`);
}
const accountingCallback = between(app, 'onSaveAccounting={(updated) => {', '                  }}', 'C4 accounting callback');
c4Ok(accountingCallback.indexOf("localStorage.setItem('race_notes_accounting'") < accountingCallback.indexOf('markSavedDirty();'), 'C4 accounting callback marks dirty after immediate local write');

const tirePushTimingMutation = app.replace(
  "localStorage.setItem('race_notes_tires', JSON.stringify(updated));\n    markSavedDirty();\n    if (user) pushTires(updated, user.id, setSyncStatus);",
  "if (user) pushTires(updated, user.id, setSyncStatus);\n    localStorage.setItem('race_notes_tires', JSON.stringify(updated));\n    markSavedDirty();",
);
assert.notEqual(tirePushTimingMutation, app, 'C4 cloud timing mutation changes real tire handler');
const tireOrder = (source: string): string[] => {
  const events: string[] = [];
  const controller = createController(() => undefined);
  compileHandler(source, 'handleSaveTires', '  const handleDeleteTireFromCloud', {
    setTireInventory: () => { events.push('state'); },
    localStorage: { setItem: () => { events.push('write'); } },
    markSavedDirty: () => { events.push('mark'); controller.markDirty(); },
    flashSaved: () => { events.push('flash'); },
    user: { id: 'user-1' },
    pushTires: () => { events.push('push'); },
    setSyncStatus: () => undefined,
  })([]);
  return events;
};
c4Equal(tireOrder(app), ['state', 'write', 'mark', 'push'], 'C4 production keeps immediate local write before unchanged cloud push');
c4Kill('cloud-push-timing-rewired', JSON.stringify(tireOrder(tirePushTimingMutation)) === JSON.stringify(['state', 'push', 'write', 'mark']));

const compileRuntimeModule = (
  source: string,
  exportName: string,
  dependencies: Record<string, unknown>,
): RuntimeExport => {
  const compiled = transformSync(source, { loader: 'tsx', format: 'cjs' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  const names = Object.keys(dependencies);
  new Function('module', 'exports', ...names, compiled)(
    moduleBox,
    moduleBox.exports,
    ...names.map(name => dependencies[name]),
  );
  return moduleBox.exports[exportName] as RuntimeExport;
};

const dirtyProbe = () => {
  let announcements = 0;
  const controller = createController(() => { announcements += 1; });
  return { controller, announcements: () => announcements };
};

// Execute the exact production todo initializer. Hydration may normalize storage,
// but it must never arm user-mutation feedback.
const todoInitializerSource = (source: string): string => {
  const marker = 'const [todos, setTodos] = useState<Todo[]>(() => {';
  const markerAt = source.indexOf(marker);
  const arrowAt = source.indexOf('() => {', markerAt);
  const initializerEnd = source.indexOf('\n  });', arrowAt);
  const arrowEnd = initializerEnd + '\n  }'.length;
  assert.ok(markerAt >= 0 && arrowAt >= markerAt && arrowEnd > arrowAt, 'C4 real todo hydration initializer exists');
  return source.slice(arrowAt, arrowEnd);
};
const runTodoHydration = (source: string) => {
  const probe = dirtyProbe();
  const storage = new Map<string, string>([['race_notes_todos', JSON.stringify([{ id: 'todo-1' }])]]);
  const hydrate = compileRuntimeModule(
    `export const hydrateTodos = ${todoInitializerSource(source)};`,
    'hydrateTodos',
    {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
      },
      materializeMainChecklist: (value: unknown) => value,
      markSavedDirty: probe.controller.markDirty,
    },
  );
  hydrate();
  return probe;
};
const hydrationProbe = runTodoHydration(app);
c4Equal(hydrationProbe.controller.isDirty(), false, 'C4 real hydration write stays zero-dirty');
c4Equal(hydrationProbe.announcements(), 0, 'C4 real hydration stays zero-Saved');
const hydrationDirtyMutation = app.replace(
  "localStorage.setItem('race_notes_todos', JSON.stringify(materialized));\n    return materialized;",
  "localStorage.setItem('race_notes_todos', JSON.stringify(materialized));\n    markSavedDirty();\n    return materialized;",
);
c4Kill('hydration-dirty-mark-added', runTodoHydration(hydrationDirtyMutation).controller.isDirty());

// Execute the real reconciliation save helper with its production false flag.
const runTodoReconciliation = (source: string) => {
  const probe = dirtyProbe();
  let writes = 0;
  const save = compileHandler(source, 'handleSaveTodos', '  const handleSelectGarageCar', {
    prevTodosForNotifyRef: { current: [] },
    user: null,
    todos: [],
    queueSharedCloudDelete: () => undefined,
    setTodos: () => undefined,
    localStorage: { setItem: () => { writes += 1; } },
    markSavedDirty: probe.controller.markDirty,
    syncOwnerId: null,
    pushTodos: () => undefined,
    setSyncStatus: () => undefined,
    teamMembers: null,
    detectAssignmentChanges: () => [],
    pushAssignmentNotification: () => undefined,
  });
  save([{ id: 'todo-1' }], false);
  return { ...probe, writes };
};
c4Ok(app.includes('handleSaveTodos(reconciled, false);'), 'C4 maintenance reconciliation calls the real save helper with feedback suppressed');
const reconciliationProbe = runTodoReconciliation(app);
c4Equal(reconciliationProbe.writes, 1, 'C4 real reconciliation retains its immediate local write');
c4Equal(reconciliationProbe.controller.isDirty(), false, 'C4 real reconciliation stays zero-dirty');
const reconciliationDirtyMutation = app.replace(
  "localStorage.setItem('race_notes_todos', JSON.stringify(updated));\n    if (notifySaved) markSavedDirty();",
  "localStorage.setItem('race_notes_todos', JSON.stringify(updated));\n    markSavedDirty();",
);
c4Kill('reconciliation-suppression-removed', runTodoReconciliation(reconciliationDirtyMutation).controller.isDirty());

// Execute a real cloud-pull persistence branch, not a synthetic pull model.
const cloudTireSlice = (source: string): string => between(
  source,
  '      if (cloudTires.length > 0) {',
  '\n\n      const cloudCars',
  'C4 cloud tire pull branch',
);
const runCloudPullSlice = (source: string) => {
  const probe = dirtyProbe();
  let writes = 0;
  const runPull = compileRuntimeModule(
    `export function runPull(cloudTires: any[], setTireInventory: any, localStorage: any, markSavedDirty: any) {\n${cloudTireSlice(source)}\n}`,
    'runPull',
    {},
  );
  runPull([{ id: 'tire-1' }], () => undefined, { setItem: () => { writes += 1; } }, probe.controller.markDirty);
  return { ...probe, writes };
};
const cloudPullProbe = runCloudPullSlice(app);
c4Equal(cloudPullProbe.writes, 1, 'C4 real cloud pull branch retains its local cache write');
c4Equal(cloudPullProbe.controller.isDirty(), false, 'C4 real cloud pull branch stays zero-dirty');
const cloudPullDirtyMutation = app.replace(
  "localStorage.setItem('race_notes_tires', JSON.stringify(cloudTires));\n      }\n\n      const cloudCars",
  "localStorage.setItem('race_notes_tires', JSON.stringify(cloudTires));\n        markSavedDirty();\n      }\n\n      const cloudCars",
);
c4Kill('cloud-pull-dirty-mark-added', runCloudPullSlice(cloudPullDirtyMutation).controller.isDirty());

// Execute the exact resume request closure. It changes pull generation only.
const resumeRequestSource = (source: string): string => {
  const block = between(source, '    const requestResumePull = () => {', '\n\n    if (Capacitor.isNativePlatform())', 'C4 resume request');
  return block.replace('    const requestResumePull =', 'export const requestResumePull =');
};
const runResumeRequest = (source: string) => {
  const probe = dirtyProbe();
  let resumeUpdates = 0;
  const request = compileRuntimeModule(resumeRequestSource(source), 'requestResumePull', {
    lastPullStartedAtRef: { current: 0 },
    Date: { now: () => 50_000 },
    shouldPullOnResume: () => true,
    setResumePullVersion: () => { resumeUpdates += 1; },
    markSavedDirty: probe.controller.markDirty,
  });
  request();
  return { ...probe, resumeUpdates };
};
const resumeProbe = runResumeRequest(app);
c4Equal(resumeProbe.resumeUpdates, 1, 'C4 real resume path schedules its pull');
c4Equal(resumeProbe.controller.isDirty(), false, 'C4 real resume path stays zero-dirty');
const resumeDirtyMutation = app.replace(
  '      setResumePullVersion(version => version + 1);\n    };',
  '      setResumePullVersion(version => version + 1);\n      markSavedDirty();\n    };',
);
c4Kill('resume-dirty-mark-added', runResumeRequest(resumeDirtyMutation).controller.isDirty());

// Execute a real selection handler. Device-local selection writes are navigation,
// not user data commits, so they remain feedback-silent.
const runCarSelection = (source: string) => {
  const probe = dirtyProbe();
  let writes = 0;
  const select = compileHandler(source, 'handleSelectCar', '  const handleSaveShockSessions', {
    activeCarIdRef: { current: 'car-1' },
    carsRef: { current: [{ id: 'car-1' }, { id: 'car-2', name: 'Two' }] },
    showInfo: () => undefined,
    setActiveCarId: () => undefined,
    localStorage: { setItem: () => { writes += 1; } },
    pickLatestSetupForCar: () => null,
    savedSetupsRef: { current: [] },
    setSetup: () => undefined,
    markSavedDirty: probe.controller.markDirty,
  });
  select('car-2');
  return { ...probe, writes };
};
const selectionProbe = runCarSelection(app);
c4Equal(selectionProbe.writes, 1, 'C4 real selection path retains its device-local write');
c4Equal(selectionProbe.controller.isDirty(), false, 'C4 real selection-only path stays zero-dirty');
const selectionDirtyMutation = app.replace(
  "localStorage.setItem('race_notes_active_car', carId);\n    const nextSetup",
  "localStorage.setItem('race_notes_active_car', carId);\n    markSavedDirty();\n    const nextSetup",
);
c4Kill('selection-dirty-mark-added', runCarSelection(selectionDirtyMutation).controller.isDirty());

// Execute the whole real Setup save handler through three non-persistence exits.
const runSilentSetupSave = (
  source: string,
  prior: Array<Record<string, unknown>>,
  updated: Array<Record<string, unknown>>,
  editable: boolean,
) => {
  const probe = dirtyProbe();
  const save = compileHandler(source, 'handleSaveSetups', '  const handleUpdateSession', {
    savedSetupsRef: { current: prior },
    weekendsRef: { current: [] },
    activeWeekendId: null,
    isWeekendFinished: () => false,
    getSetupEditability: () => ({ editable, deletable: editable }),
    setup: { id: 'setup-active' },
    INITIAL_SETUP: { id: 'initial' },
    isSetupLocked: () => false,
    pickLatestSetupForCar: () => undefined,
    activeCarId: null,
    markSavedDirty: probe.controller.markDirty,
    syncOwnerId: null,
  });
  save(updated);
  return probe;
};
const priorSetup = { id: 'setup-1', chassis: 'Owner', updatedAt: '2026-07-18T00:00:00.000Z' };
const blockedSetupProbe = runSilentSetupSave(app, [priorSetup], [{ ...priorSetup, chassis: 'Blocked edit' }], false);
c4Equal(blockedSetupProbe.controller.isDirty(), false, 'C4 real blocked Setup save stays zero-dirty');
const blockedSetupMutation = app.replace('    if (hasBlockedEdit) return;', '    if (hasBlockedEdit) markSavedDirty();');
c4Kill('blocked-path-dirty-mark-added', runSilentSetupSave(blockedSetupMutation, [priorSetup], [{ ...priorSetup, chassis: 'Blocked edit' }], false).controller.isDirty());

const revertedSetupProbe = runSilentSetupSave(app, [priorSetup], [{ ...priorSetup }], true);
c4Equal(revertedSetupProbe.controller.isDirty(), false, 'C4 real reverted Setup save stays zero-dirty');
const revertedSetupMutation = app.replace(
  '    if (!didPersist && !activeSelectionChanged) return;',
  '    if (safeSetups.length === 0 && !didPersist && !activeSelectionChanged) return;',
);
c4Kill('reverted-path-guard-removed', runSilentSetupSave(revertedSetupMutation, [priorSetup], [{ ...priorSetup }], true).controller.isDirty());

const zeroRowSetupProbe = runSilentSetupSave(app, [], [], true);
c4Equal(zeroRowSetupProbe.controller.isDirty(), false, 'C4 real zero-row Setup save stays zero-dirty');
const zeroRowSetupMutation = app.replace(
  '    if (!didPersist && !activeSelectionChanged) return;',
  '    if (safeSetups.length > 0 && !didPersist && !activeSelectionChanged) return;',
);
c4Kill('zero-row-guard-removed', runSilentSetupSave(zeroRowSetupMutation, [], [], true).controller.isDirty());

// Execute the real first Quick Adjust rejection before any persistence branch.
const runBlockedQuickAdjust = (source: string) => {
  const probe = dirtyProbe();
  const commit = compileHandler(source, 'handleCommitQuickAdjust', '  // Session weather helpers', {
    resolveQuickAdjustTarget: () => ({ ok: false, error: 'blocked' }),
    activeWeekendId: null,
    weekendsRef: { current: [] },
    savedSetupsRef: { current: [] },
    activeSessionRef: { current: {} },
    showInfo: () => undefined,
    markSavedDirty: probe.controller.markDirty,
  });
  commit({});
  return probe;
};
const blockedQuickAdjustProbe = runBlockedQuickAdjust(app);
c4Equal(blockedQuickAdjustProbe.controller.isDirty(), false, 'C4 real blocked Quick Adjust stays zero-dirty');
const blockedQuickAdjustMutation = app.replace(
  "    if (target.ok === false) {\n      showInfo({ reason: 'quick-adjust-target' });",
  "    if (target.ok === false) {\n      markSavedDirty();\n      showInfo({ reason: 'quick-adjust-target' });",
);
c4Kill('quick-adjust-blocked-dirty-mark-added', runBlockedQuickAdjust(blockedQuickAdjustMutation).controller.isDirty());

c4Ok(app.includes('handleSaveShockSessions(stampedShock, false);')
  && app.includes('handleSaveCars([defaultCar], false);'), 'C4 remaining background helper suppression stays explicit');

const pairedDoubleFlushMutation = app.replace('dirty = false;\n      announceSaved();', 'dirty = true;\n      announceSaved();');
c4Ok(pairedDoubleFlushMutation !== dirtyClearMutation, 'C4 paired-event mutant is independent from dirty-clear omission');
const pairedDoubleProbe = createBoundaryProbe(pairedDoubleFlushMutation);
pairedDoubleProbe.controller.markDirty();
pairedDoubleProbe.setHidden();
pairedDoubleProbe.fireVisibility();
pairedDoubleProbe.firePageHide();
c4Kill('paired-background-double-flush', pairedDoubleProbe.announcements() === 2);

c4Ok(notificationSourcePasses(app, setup), 'C4 preserves accepted B2 notification source contract');
c4Ok(b3SourcePasses(app, sync), 'C4 preserves accepted B3 status and priority source contract');
c4Ok(c4SourcePasses(app), 'C4 final production source gate passes');
c4Equal(new Set(killedC4Mutations).size, killedC4Mutations.length, 'C4 killed mutation labels are unique');

console.log(`C4 assertions: ${c4AssertionCount}`);
console.log(`C4 killed mutations: ${killedC4Mutations.join(', ')}`);
console.log('Saved flash harness: PASS');

// D1 zero-row shared-delete proof. Compile real helper, replay decision, and
// queued-delete pull filter; live Supabase is never contacted.
type D1Row = { id: string };
type D1Response = { data?: readonly D1Row[] | null; error?: { message: string } | null };
type D1Plan = {
  selected: D1Response;
  unselected?: D1Response;
  throwSelected?: Error;
};
type D1Intent = { accountId: string; table: string; recordId: string; soloOnly?: boolean };

let d1AssertionCount = 0;
const killedD1Mutations: string[] = [];
const d1Ok = (value: unknown, message: string): void => {
  d1AssertionCount += 1;
  assert.ok(value, message);
};
const d1Equal = (actual: unknown, expected: unknown, message: string): void => {
  d1AssertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const d1Kill = (name: string, killed: boolean): void => {
  d1AssertionCount += 1;
  assert.equal(killed, true, `D1 mutation killed: ${name}`);
  killedD1Mutations.push(name);
};
const d1Replace = (source: string, before: string, after: string, label: string): string => {
  const mutated = source.replace(before, after);
  d1Ok(mutated !== source, `D1 ${label} mutation changes exact production source`);
  return mutated;
};

const d1DeleteBlock = (source: string): string => between(
  source,
  '/** Delete one exact shared row. Callers retain failed intents for retry. */',
  '// ---------------------------------------------------------------------------\n// Push: local',
  'D1 shared delete helper',
);
const d1DeleteSourcePasses = (source: string): boolean => {
  const block = d1DeleteBlock(source);
  return block.includes(".delete().eq('id', recordId).select('id')")
    && block.includes('if (error) {')
    && block.includes('if (!data?.some(row => row.id === recordId)) {')
    && block.includes(`console.warn(\`Sync: shared delete \${table}/\${recordId} matched no rows\`);`)
    && (block.match(/onStatus\?\.\('sync-error'\);/g) ?? []).length === 3
    && (block.match(/return false;/g) ?? []).length === 3
    && (block.match(/return true;/g) ?? []).length === 1;
};

type D1QueryCalls = {
  from: string[];
  deletes: number;
  eq: Array<[string, string]>;
  select: string[];
};
const compileD1Delete = (source: string, plan: D1Plan) => {
  const calls: D1QueryCalls = { from: [], deletes: 0, eq: [], select: [] };
  const supabaseMock = {
    from: (table: string) => {
      calls.from.push(table);
      return {
        delete: () => {
          calls.deletes += 1;
          return {
            eq: (field: string, id: string) => {
              calls.eq.push([field, id]);
              const chain = {
                select: async (columns: string) => {
                  calls.select.push(columns);
                  if (plan.throwSelected) throw plan.throwSelected;
                  return plan.selected;
                },
                then: (resolve: (value: D1Response) => unknown, reject: (error: unknown) => unknown) => (
                  Promise.resolve(plan.unselected ?? { data: null, error: null }).then(resolve, reject)
                ),
              };
              return chain;
            },
          };
        },
      };
    },
  };
  const compiled = transformSync(d1DeleteBlock(source), { loader: 'ts', format: 'cjs' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'supabase', 'console', compiled)(
    moduleBox,
    moduleBox.exports,
    supabaseMock,
    { warn: () => undefined },
  );
  return {
    helper: moduleBox.exports.deleteTeamSharedRecordFromCloud as (
      table: string,
      recordId: string,
      onStatus?: (status: string) => void,
    ) => Promise<boolean>,
    calls,
  };
};
const runD1Delete = async (source: string, plan: D1Plan) => {
  const statuses: string[] = [];
  const compiled = compileD1Delete(source, plan);
  const result = await compiled.helper('setups', 'row-1', status => statuses.push(status));
  return { result, statuses, calls: compiled.calls };
};

d1Ok(d1DeleteSourcePasses(sync), 'D1 helper source requires selected matching deleted id and three honest failures');
const d1Success = await runD1Delete(sync, { selected: { data: [{ id: 'row-1' }], error: null } });
d1Equal(d1Success.result, true, 'D1 returned requested row proves delete success');
d1Equal(d1Success.statuses, [], 'D1 proved success emits no failure status');
d1Equal(d1Success.calls, {
  from: ['setups'], deletes: 1, eq: [['id', 'row-1']], select: ['id'],
}, 'D1 production helper keeps exact table/id delete and selects id');
for (const [label, plan] of [
  ['empty rows', { selected: { data: [], error: null } }],
  ['missing data', { selected: { error: null } }],
  ['wrong returned id', { selected: { data: [{ id: 'other-row' }], error: null } }],
  ['API error', { selected: { data: null, error: { message: 'denied' } } }],
  ['exception', { selected: { data: null, error: null }, throwSelected: new Error('offline') }],
] as const) {
  const outcome = await runD1Delete(sync, plan);
  d1Equal(outcome.result, false, `D1 ${label} remains failure`);
  d1Equal(outcome.statuses, ['sync-error'], `D1 ${label} publishes sync-error`);
}

const d1SelectRemoved = d1Replace(
  sync,
  ".delete().eq('id', recordId).select('id')",
  ".delete().eq('id', recordId)",
  'select-removed',
);
const d1SelectRemovedOutcome = await runD1Delete(d1SelectRemoved, {
  selected: { data: [{ id: 'row-1' }], error: null },
  unselected: { data: null, error: null },
});
d1Kill('select-removed', !d1DeleteSourcePasses(d1SelectRemoved)
  && d1SelectRemovedOutcome.calls.select.length === 0
  && d1SelectRemovedOutcome.result === false);

const d1ZeroGuard = '    if (!data?.some(row => row.id === recordId)) {';
const d1EmptySuccess = d1Replace(
  sync,
  d1ZeroGuard,
  '    if (Array.isArray(data) && data.length === 0) return true;\n' + d1ZeroGuard,
  'empty-success',
);
const d1EmptySuccessOutcome = await runD1Delete(d1EmptySuccess, { selected: { data: [], error: null } });
d1Kill('empty-row-success', d1EmptySuccessOutcome.result === true && d1EmptySuccessOutcome.statuses.length === 0);

const d1MissingSuccess = d1Replace(
  sync,
  d1ZeroGuard,
  '    if (data == null) return true;\n' + d1ZeroGuard,
  'missing-data-success',
);
const d1MissingSuccessOutcome = await runD1Delete(d1MissingSuccess, { selected: { error: null } });
d1Kill('missing-data-success', d1MissingSuccessOutcome.result === true && d1MissingSuccessOutcome.statuses.length === 0);

const d1ErrorBranch = `    if (error) {
      console.warn(\`Sync: shared delete \${table}/\${recordId} error:\`, error.message);
      onStatus?.('sync-error');
      return false;
    }`;
const d1ErrorSuccess = d1Replace(sync, d1ErrorBranch, d1ErrorBranch.replace('return false;', 'return true;'), 'API-error-success');
const d1ErrorSuccessOutcome = await runD1Delete(d1ErrorSuccess, { selected: { data: null, error: { message: 'denied' } } });
d1Kill('api-error-success', d1ErrorSuccessOutcome.result === true);

const d1CatchBranch = `  } catch (error) {
    console.warn(\`Sync: shared delete \${table}/\${recordId} failed\`, error);
    onStatus?.('sync-error');
    return false;
  }`;
const d1ExceptionSuccess = d1Replace(sync, d1CatchBranch, d1CatchBranch.replace('return false;', 'return true;'), 'exception-success');
const d1ExceptionSuccessOutcome = await runD1Delete(d1ExceptionSuccess, {
  selected: { data: null, error: null }, throwSelected: new Error('offline'),
});
d1Kill('exception-success', d1ExceptionSuccessOutcome.result === true);

const d1ReplaySlice = (source: string): string => between(
  source,
  '  // Shared deletes are local-first.',
  '  // Tires stay personal.',
  'D1 shared replay effect',
);
const d1ReplaySourcePasses = (source: string): boolean => {
  const block = d1ReplaySlice(source);
  return block.includes('if (deleted) removePendingTeamDelete(window.localStorage, intent);\n        else retryNeeded = true;')
    && block.includes("setSyncStatus('deferred-delete-retrying');")
    && block.includes('}, 5000);')
    && (block.match(/authIdentityRef\.current === accountId/g) ?? []).length >= 2
    && (block.match(/authGenerationRef\.current === generation/g) ?? []).length >= 2;
};
const compileD1Replay = (source: string) => {
  const slice = d1ReplaySlice(source);
  const replayStart = '    void (async () => {\n';
  const body = between(slice, replayStart, '    })();', 'D1 replay async body').slice(replayStart.length);
  const wrapped = `export const runD1Replay = async (deps) => {
    const {
      pending, cancelled, accountId, generation, authIdentityRef, authGenerationRef,
      deleteTeamSharedRecordFromCloud, removePendingTeamDelete, setSyncStatus,
      window, setDeleteReplayVersion,
    } = deps;
${body}
  };`;
  return compileRuntimeModule(wrapped, 'runD1Replay', {}) as (deps: Record<string, unknown>) => Promise<void>;
};
const d1PullFilterBlock = (source: string): string => between(
  source,
  '      const omitQueuedDeletes = <T extends { id: string }>(',
  '      const data = await pullAllData',
  'D1 queued-delete pull filter',
);
const compileD1PullFilter = (source: string) => {
  const wrapped = `export const filterD1Pull = (table, rows, deps) => {
    const { queuedAtPullStart, readPendingTeamDeletes, pullUserId, window } = deps;
${d1PullFilterBlock(source)}
    return omitQueuedDeletes(table, rows);
  };`;
  return compileRuntimeModule(wrapped, 'filterD1Pull', {}) as (
    table: string,
    rows: D1Row[],
    deps: Record<string, unknown>,
  ) => D1Row[];
};
type D1ReplayPlan = { source?: string; syncSource?: string; plans: D1Plan[]; identity?: string; generation?: number };
const createD1Replay = ({ source = app, syncSource = sync, plans, identity = 'acct-1', generation = 7 }: D1ReplayPlan) => {
  const intent: D1Intent = { accountId: 'acct-1', table: 'setups', recordId: 'row-1' };
  let queue = [intent];
  let planIndex = 0;
  let deleteCalls = 0;
  let replayVersion = 0;
  let currentStatus: string | null = null;
  const statuses: string[] = [];
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const authIdentityRef = { current: identity };
  const authGenerationRef = { current: generation };
  const replay = compileD1Replay(source);
  const run = async () => replay({
    pending: queue.slice(),
    cancelled: false,
    accountId: 'acct-1',
    generation: 7,
    authIdentityRef,
    authGenerationRef,
    deleteTeamSharedRecordFromCloud: async (table: string, recordId: string, onStatus: (status: string) => void) => {
      deleteCalls += 1;
      const compiled = compileD1Delete(syncSource, plans[Math.min(planIndex, plans.length - 1)]);
      planIndex += 1;
      return compiled.helper(table, recordId, onStatus);
    },
    removePendingTeamDelete: (_storage: unknown, completed: D1Intent) => {
      queue = queue.filter(item => item.accountId !== completed.accountId
        || item.table !== completed.table || item.recordId !== completed.recordId);
    },
    setSyncStatus: (status: string) => { currentStatus = status; statuses.push(status); },
    window: {
      localStorage: {},
      setTimeout: (callback: () => void, delay: number) => { timers.push({ callback, delay }); return timers.length; },
    },
    setDeleteReplayVersion: (updater: (version: number) => number) => { replayVersion = updater(replayVersion); },
  });
  const filterPull = (rows: D1Row[]) => compileD1PullFilter(source)('setups', rows, {
    queuedAtPullStart: new Set(queue.map(item => `${item.table}:${item.recordId}`)),
    readPendingTeamDeletes: () => queue.slice(),
    pullUserId: 'acct-1',
    window: { localStorage: {} },
  });
  return {
    run,
    queue: () => queue.slice(),
    statuses: () => statuses.slice(),
    status: () => currentStatus,
    acknowledge: () => { currentStatus = null; },
    timers,
    deleteCalls: () => deleteCalls,
    replayVersion: () => replayVersion,
    authIdentityRef,
    authGenerationRef,
    filterPull,
  };
};

d1Ok(d1ReplaySourcePasses(app), 'D1 replay keeps true-only removal, retry status, 5000ms timer, and auth guards');
d1Ok(d1PullFilterBlock(app).includes('if (queuedAtPullStart.has(key)) return false;')
  && d1PullFilterBlock(app).includes('readPendingTeamDeletes(window.localStorage).some'), 'D1 next pull remains bound to queued-delete filter');

const d1ZeroReplay = createD1Replay({ plans: [{ selected: { data: [], error: null } }] });
await d1ZeroReplay.run();
d1Equal(d1ZeroReplay.queue().length, 1, 'D1 zero-row intent remains queued');
d1Equal(d1ZeroReplay.statuses(), ['sync-error', 'deferred-delete-retrying'], 'D1 zero-row reaches honest error then retrying status');
d1Equal(d1ZeroReplay.timers.map(timer => timer.delay), [5000], 'D1 zero-row schedules exact 5000ms retry');
d1Equal(d1ZeroReplay.filterPull([{ id: 'row-1' }]), [], 'D1 next-pull fixture cannot resurrect queued zero-row delete');
d1ZeroReplay.acknowledge();
d1Equal(d1ZeroReplay.status(), null, 'D1 acknowledgement clears visible terminal status');
d1Equal(d1ZeroReplay.queue().length, 1, 'D1 acknowledgement does not discard queued intent');
d1Equal(d1ZeroReplay.filterPull([{ id: 'row-1' }]), [], 'D1 clean acknowledgement still blocks next-pull resurrection');

d1ZeroReplay.timers[0].callback();
d1Equal(d1ZeroReplay.replayVersion(), 1, 'D1 matching account/generation timer requests replay');
const d1Eventual = createD1Replay({ plans: [
  { selected: { data: [], error: null } },
  { selected: { data: [{ id: 'row-1' }], error: null } },
] });
await d1Eventual.run();
d1Eventual.timers[0].callback();
await d1Eventual.run();
d1Equal(d1Eventual.deleteCalls(), 2, 'D1 queued retry reaches eventual cloud success');
d1Equal(d1Eventual.queue(), [], 'D1 eventual matching-row success removes intent once');
d1Equal(d1Eventual.timers.length, 1, 'D1 eventual success adds no duplicate retry timer');

const d1SuccessReplay = createD1Replay({ plans: [{ selected: { data: [{ id: 'row-1' }], error: null } }] });
await d1SuccessReplay.run();
d1Equal(d1SuccessReplay.queue(), [], 'D1 normal success removes intent');
d1Equal(d1SuccessReplay.timers, [], 'D1 normal success schedules no retry');

const d1RemoveOnFailure = d1Replace(
  app,
  'if (deleted) removePendingTeamDelete(window.localStorage, intent);',
  'if (deleted || true) removePendingTeamDelete(window.localStorage, intent);',
  'remove-zero-row-intent',
);
const d1RemovedReplay = createD1Replay({ source: d1RemoveOnFailure, plans: [{ selected: { data: [], error: null } }] });
await d1RemovedReplay.run();
d1Kill('zero-row-intent-removed', d1RemovedReplay.queue().length === 0
  && d1RemovedReplay.filterPull([{ id: 'row-1' }]).length === 1);

const d1ZeroStatusBlock = `    if (!data?.some(row => row.id === recordId)) {
      console.warn(\`Sync: shared delete \${table}/\${recordId} matched no rows\`);
      onStatus?.('sync-error');
      return false;
    }`;
const d1LostHelperStatus = d1Replace(
  sync,
  d1ZeroStatusBlock,
  d1ZeroStatusBlock.replace("      onStatus?.('sync-error');\n", ''),
  'zero-row-sync-error-lost',
);
const d1LostAllStatus = d1Replace(
  app,
  "        setSyncStatus('deferred-delete-retrying');",
  '        // mutation: retry status lost',
  'deferred-retry-status-lost',
);
const d1LostStatusReplay = createD1Replay({
  source: d1LostAllStatus,
  syncSource: d1LostHelperStatus,
  plans: [{ selected: { data: [], error: null } }],
});
await d1LostStatusReplay.run();
d1Kill('failure-status-lost', d1LostStatusReplay.statuses().length === 0 && d1LostStatusReplay.timers[0].delay === 5000);

const d1DelayChanged = d1Replace(app, '        }, 5000);', '        }, 4999);', 'retry-delay-changed');
const d1DelayReplay = createD1Replay({ source: d1DelayChanged, plans: [{ selected: { data: [], error: null } }] });
await d1DelayReplay.run();
d1Kill('retry-delay-changed', d1DelayReplay.timers[0].delay === 4999);

const d1SuccessRetained = d1Replace(
  app,
  'if (deleted) removePendingTeamDelete(window.localStorage, intent);',
  'if (false && deleted) removePendingTeamDelete(window.localStorage, intent);',
  'success-retained',
);
const d1RetainedReplay = createD1Replay({ source: d1SuccessRetained, plans: [{ selected: { data: [{ id: 'row-1' }], error: null } }] });
await d1RetainedReplay.run();
d1Kill('success-intent-retained', d1RetainedReplay.queue().length === 1 && d1RetainedReplay.timers[0].delay === 5000);

const d1EarlyGuard = `if (cancelled
          || authIdentityRef.current !== accountId
          || authGenerationRef.current !== generation) return;`;
const d1AuthWeakened = d1Replace(app, d1EarlyGuard, 'if (cancelled) return;', 'auth-account-generation-guard-weakened');
const d1StaleBaseline = createD1Replay({ plans: [{ selected: { data: [{ id: 'row-1' }], error: null } }], identity: 'other-account' });
await d1StaleBaseline.run();
d1Equal(d1StaleBaseline.deleteCalls(), 0, 'D1 stale account cannot call cloud delete');
const d1StaleMutation = createD1Replay({ source: d1AuthWeakened, plans: [{ selected: { data: [{ id: 'row-1' }], error: null } }], identity: 'other-account' });
await d1StaleMutation.run();
d1Kill('auth-account-generation-guard-weakened', d1StaleMutation.deleteCalls() === 1);

const d1TimerGuard = `if (authIdentityRef.current === accountId
            && authGenerationRef.current === generation) {`;
const d1TimerGuardWeakened = d1Replace(app, d1TimerGuard, 'if (true) {', 'retry-generation-guard-weakened');
const d1GuardBaseline = createD1Replay({ plans: [{ selected: { data: [], error: null } }] });
await d1GuardBaseline.run();
d1GuardBaseline.authGenerationRef.current = 8;
d1GuardBaseline.timers[0].callback();
d1Equal(d1GuardBaseline.replayVersion(), 0, 'D1 superseded generation cancels scheduled replay');
const d1GuardMutation = createD1Replay({ source: d1TimerGuardWeakened, plans: [{ selected: { data: [], error: null } }] });
await d1GuardMutation.run();
d1GuardMutation.authGenerationRef.current = 8;
d1GuardMutation.timers[0].callback();
d1Kill('retry-generation-guard-weakened', d1GuardMutation.replayVersion() === 1);

const d1TerminalOverwrite = d1Replace(app, terminalGuard, 'next', 'terminal-overwritten-by-synced');
const d1BaselineAfterSynced = transitionStatus(app, 'deferred-delete-retrying', 'synced');
d1Equal(d1BaselineAfterSynced, 'deferred-delete-retrying', 'D1 terminal retry status survives later Synced');
const d1MutatedAfterSynced = transitionStatus(d1TerminalOverwrite, 'deferred-delete-retrying', 'synced');
const d1MutatedSyncedRoute = productionNotificationRoute(d1TerminalOverwrite, false, d1MutatedAfterSynced, false, true);
d1Kill('terminal-failure-overwritten-by-synced', d1MutatedAfterSynced === 'synced' && d1MutatedSyncedRoute.isSuccess);

const d1SavedResurrection = d1Replace(
  terminalLaterFlashMutation,
  'const acknowledgeSyncStatus = () => {\n    clearSavedFlash();\n    syncStatusRef.current = null;',
  'const acknowledgeSyncStatus = () => {\n    syncStatusRef.current = null;',
  'terminal-saved-resurrection',
);
d1Equal(savedAfterTerminalLaterFlashAndAck(app), false, 'D1 terminal failure plus later save plus acknowledgement never resurrects Saved');
const d1ResurrectedRoute = productionNotificationRoute(
  d1SavedResurrection,
  savedAfterTerminalLaterFlashAndAck(d1SavedResurrection),
  '',
  false,
  true,
);
d1Kill('terminal-failure-resurrects-saved', d1ResurrectedRoute.visible && d1ResurrectedRoute.isSuccess && d1ResurrectedRoute.msg === 'Saved');

d1Equal(new Set(killedD1Mutations).size, killedD1Mutations.length, 'D1 killed mutation labels are unique');
d1Ok(killedD1Mutations.length >= 10, 'D1 kills at least ten independent mutation classes');
console.log(`D1 assertions: ${d1AssertionCount}`);
console.log(`D1 killed mutations (${killedD1Mutations.length}): ${killedD1Mutations.join(', ')}`);
console.log('D1 zero-row delete harness: PASS');

// D2 Clear Racing Data proof. Compile and execute the real App handler and
// Settings submit guard with deterministic dependencies; no live database exists.
type D2Mode = 'device-only' | 'everywhere';
type D2Identity = 'signed-out' | 'solo' | 'unresolved' | 'owner' | 'member' | 'missing-owner';
type D2Queue = { table: string; recordId: string; soloOnly: boolean; accountId: string };
type D2TireQueue = { accountId: string; tireId: string };
type D2Push = { name: string; args: unknown[] };
type D2Run = {
  shared: D2Queue[];
  tires: D2TireQueue[];
  pushes: D2Push[];
  removedKeys: string[];
  states: string[];
  dirty: number;
  undo: number;
  info: string[];
  reasons: string[];
  events: string[];
};

let d2AssertionCount = 0;
const killedD2Mutations: string[] = [];
const d2Ok = (value: unknown, message: string): void => {
  d2AssertionCount += 1;
  assert.ok(value, message);
};
const d2Equal = (actual: unknown, expected: unknown, message: string): void => {
  d2AssertionCount += 1;
  assert.deepEqual(actual, expected, message);
};
const d2Kill = (name: string, killed: boolean): void => {
  d2AssertionCount += 1;
  assert.equal(killed, true, `D2 mutation killed: ${name}`);
  killedD2Mutations.push(name);
};
const d2Replace = (source: string, before: string, after: string, label: string): string => {
  const mutated = source.replace(before, after);
  d2Ok(mutated !== source, `D2 ${label} mutation changes exact production source`);
  return mutated;
};

const D2_TABLES = [
  'setups',
  'race_weekends',
  'todos',
  'cars',
  'shock_sessions',
  'maintenance_components',
  'maintenance_logs',
  'checklist_templates',
  'weekend_checklists',
] as const;
const D2_PUSHES = [
  'pushSetups',
  'pushWeekends',
  'pushTodos',
  'pushCars',
  'pushShockSessions',
  'pushMaintenanceComponents',
  'pushMaintenanceLogs',
  'pushChecklistTemplates',
  'pushWeekendChecklists',
] as const;
const D2_KEYS = [
  'race_notes_setup', 'race_notes_saved_setups', 'race_notes_weekends',
  'race_notes_active_session', 'race_notes_todos', 'race_notes_tires',
  'race_notes_accounting', 'race_notes_accounting_draft', 'race_notes_shopping', 'race_notes_cars',
  'race_notes_active_car', 'race_notes_shock_graphs',
  'race_notes_maintenance', 'race_notes_maintenance_logs',
  'race_notes_checklist_templates', 'race_notes_weekend_checklists',
  'race_notes_active_weekend',
];
const D2_STATE_NAMES = [
  'savedSetups', 'weekends', 'activeWeekendId', 'tireInventory', 'cars',
  'shockSessions', 'activeCarId', 'activeSession', 'todos', 'accounting',
  'shopping', 'maintenance', 'maintenanceLogs', 'checklistTemplates', 'weekendChecklists',
];
const d2Fixture = Object.fromEntries(D2_TABLES.map(table => [table, [
  { id: `${table}-1` },
  { id: `${table}-2` },
]])) as Record<(typeof D2_TABLES)[number], Array<{ id: string }>>;
const d2ClearBlock = (source: string): string => between(
  source,
  '  const handleClearAllData =',
  '  const handleDeleteAccount',
  'D2 real clear handler',
);

const compileD2Clear = (source: string, dependencies: Record<string, unknown>): RuntimeExport => (
  compileHandler(source, 'handleClearAllData', '  const handleDeleteAccount', dependencies)
);

type D2InfoNotice = { reason: string; context?: Record<string, string> };
const compileD2ResolveInfoCopy = (source: string): RuntimeExport => {
  const block = between(
    source,
    'const INFO_COPY = {',
    '\n\nconst componentInfoNotice',
    'D2 real structured info-copy route',
  ).replace('const resolveInfoCopy =', 'export const resolveInfoCopy =');
  return compileRuntimeModule(block, 'resolveInfoCopy', {
    SETUP_NOTICE_COPY: { minimumSetups: 'minimum setups' },
  });
};
const compileD2ComponentInfoNotice = (source: string): RuntimeExport => {
  const block = between(
    source,
    'const componentInfoNotice =',
    '\n\nconst THEME_SCALE_MIGRATION_VERSION',
    'D2 real component fallback route',
  ).replace('const componentInfoNotice =', 'export const componentInfoNotice =');
  return compileRuntimeModule(block, 'componentInfoNotice', {});
};
const renderD2StructuredNotice = (source: string, notice: D2InfoNotice): B2RenderedRoute => {
  const markup = between(source, '        {/* One compact notification arbiter.', '\n\n        {/* Core Main Active Canvas Area */}', 'D2 real notification renderer');
  const route = markup.match(/(const isInfo = [\s\S]*?const isPersistent = [^;]+;)/)?.[1];
  d2Ok(route, 'D2 exact production notification route exists');
  const evaluate = new Function(
    'infoToast',
    'savedFlash',
    'syncStatus',
    'isOnline',
    'resolveInfoCopy',
    `${route}\nreturn { visible: isInfo || savedFlash || !!statusNotice, isInfo, isSuccess, isPersistent, msg };`,
  ) as (infoToast: D2InfoNotice, savedFlash: boolean, syncStatus: string, isOnline: boolean, resolveInfoCopy: RuntimeExport) => B2RenderedRoute;
  return evaluate(notice, false, '', true, compileD2ResolveInfoCopy(source));
};

const runD2Clear = async (
  source: string,
  identity: D2Identity,
  mode?: D2Mode,
): Promise<D2Run> => {
  const shared: D2Queue[] = [];
  const tires: D2TireQueue[] = [];
  const pushes: D2Push[] = [];
  const removedKeys: string[] = [];
  const states: string[] = [];
  const info: string[] = [];
  const reasons: string[] = [];
  const events: string[] = [];
  let dirty = 0;
  let undo = 0;
  const signedIn = identity !== 'signed-out';
  const resolved = identity !== 'unresolved' && identity !== 'signed-out';
  const hasTeam = identity === 'owner' || identity === 'member' || identity === 'missing-owner';
  const user = signedIn ? { id: 'account-1' } : null;
  const team = hasTeam ? { id: 'team-1' } : null;
  const syncOwnerId = identity === 'owner' ? 'account-1' : identity === 'member' ? 'owner-2' : identity === 'solo' ? 'account-1' : null;
  const resolveInfoCopy = compileD2ResolveInfoCopy(source);
  const componentInfoNotice = compileD2ComponentInfoNotice(source);
  const localStorage = {
    removeItem: (key: string) => { removedKeys.push(key); events.push(`remove:${key}`); },
  };
  const stateSetter = (name: string) => (_value: unknown) => { states.push(name); events.push(`state:${name}`); };
  const push = (name: string) => (...args: unknown[]) => { pushes.push({ name, args }); events.push(`push:${name}`); };
  const dependencies: Record<string, unknown> = {
    carUndo: { undo: () => { undo += 1; events.push('undo'); } },
    clearAllDataModeRef: { current: mode ?? 'device-only' },
    user,
    teamResolved: resolved,
    team,
    syncOwnerId,
    savedSetups: d2Fixture.setups,
    weekends: d2Fixture.race_weekends,
    todos: d2Fixture.todos,
    cars: d2Fixture.cars,
    shockSessions: d2Fixture.shock_sessions,
    maintenance: d2Fixture.maintenance_components,
    maintenanceLogs: d2Fixture.maintenance_logs,
    checklistTemplates: d2Fixture.checklist_templates,
    weekendChecklists: d2Fixture.weekend_checklists,
    tireInventory: [{ id: 'tire-1' }, { id: 'tire-2' }],
    queueSharedCloudDelete: (table: string, recordId: string, soloOnly = false, expectedAccountId?: string) => {
      shared.push({ table, recordId, soloOnly, accountId: expectedAccountId ?? user?.id ?? '' });
      events.push(`queue:${table}:${recordId}`);
    },
    enqueuePendingPersonalTireDelete: (_storage: unknown, entry: D2TireQueue) => {
      tires.push({ accountId: entry.accountId, tireId: entry.tireId });
      events.push(`tire:${entry.tireId}`);
    },
    window: { localStorage },
    localStorage,
    setDeleteReplayVersion: (update: (value: number) => number) => { update(0); events.push('replay'); },
    ACCOUNTING_DRAFT_KEY: 'race_notes_accounting_draft',
    ACTIVE_WEEKEND_KEY: 'race_notes_active_weekend',
    carsRef: { current: d2Fixture.cars },
    activeCarIdRef: { current: 'cars-1' },
    INITIAL_ACTIVE_SESSION: { id: 'initial-session' },
    prevTodosForNotifyRef: { current: d2Fixture.todos },
    markSavedDirty: () => { dirty += 1; events.push('dirty'); },
    showInfo: (notice: D2InfoNotice) => {
      const message = resolveInfoCopy(notice);
      reasons.push(notice.reason);
      info.push(message);
      events.push(`info:${notice.reason}:${message}`);
    },
    showComponentInfo: (message: string) => {
      const notice = componentInfoNotice(message) as D2InfoNotice;
      const resolved = resolveInfoCopy(notice);
      reasons.push(notice.reason);
      info.push(resolved);
      events.push(`info:${notice.reason}:${resolved}`);
    },
    setSyncStatus: () => undefined,
  };
  for (const name of D2_PUSHES) dependencies[name] = push(name);
  dependencies.pushTires = push('pushTires');
  for (const name of D2_STATE_NAMES) {
    const setter = `set${name[0].toUpperCase()}${name.slice(1)}`;
    dependencies[setter] = stateSetter(name);
  }
  const clear = compileD2Clear(source, dependencies);
  await clear();
  return { shared, tires, pushes, removedKeys, states, dirty, undo, info, reasons, events };
};

const d2SettingsBlock = (source: string): string => between(
  source,
  '  const clearRacingData =',
  '\n\n  useEffect',
  'D2 real Settings clear submit',
);
const compileD2SettingsClear = (
  source: string,
  dependencies: Record<string, unknown>,
): RuntimeExport => {
  const block = d2SettingsBlock(source).replace('  const clearRacingData =', 'export const clearRacingData =');
  const compiled = transformSync(block, { loader: 'tsx', format: 'cjs' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  const names = Object.keys(dependencies);
  new Function('module', 'exports', ...names, compiled)(
    moduleBox,
    moduleBox.exports,
    ...names.map(name => dependencies[name]),
  );
  return moduleBox.exports.clearRacingData as RuntimeExport;
};

const d2SourcePasses = (appSource: string, settingsSource: string): boolean => {
  const clear = d2ClearBlock(appSource);
  const settingsClear = d2SettingsBlock(settingsSource);
  return D2_TABLES.every(table => clear.includes(`['${table}',`))
    && D2_PUSHES.every(name => clear.includes(`${name}([], user.id`))
    && appSource.includes("const clearAllDataModeRef = useRef<'device-only' | 'everywhere'>('device-only');")
    && clear.includes('const mode = clearAllDataModeRef.current;')
    && clear.includes("const resolvedMode = isResolvedTeam ? mode : 'legacy';")
    && clear.includes("if (user && resolvedMode !== 'device-only')")
    && clear.includes('if (isResolvedTeam && syncOwnerId === user.id)')
    && clear.includes('queueSharedCloudDelete(table, id, false, user.id)')
    && clear.includes('queueSharedCloudDelete(table, id, true)')
    && clear.includes('if (isResolvedTeam) pushTires([], user.id, setSyncStatus);')
    && appSource.includes("'clear-device-only': () => 'Device data cleared. Shared team data will re-download on next sync.',")
    && appSource.includes("'clear-everywhere': () => 'Your records are queued for deletion. Team records you do not own remain in cloud.',")
    && clear.includes("showInfo({ reason: resolvedMode === 'device-only' ? 'clear-device-only' : 'clear-everywhere' });")
    && !clear.includes('showComponentInfo(isResolvedTeam')
    && clear.indexOf('carUndo.undo();') < clear.indexOf('localStorage.removeItem')
    && clear.indexOf('localStorage.removeItem') < clear.indexOf('markSavedDirty();')
    && (clear.match(/markSavedDirty\(\);/g) ?? []).length === 1
    && !clear.includes('supabase.')
    && !clear.includes('deleteTeamSharedRecordFromCloud')
    && settingsSource.includes('Clear this device only')
    && settingsSource.includes('shared team data will re-download on next sync')
    && settingsSource.includes('Delete my records everywhere')
    && settingsSource.includes('Team records you do not own remain in cloud.')
    && settingsSource.includes("clearRacingData('device-only')")
    && settingsSource.includes("clearRacingData('everywhere')")
    && settingsSource.includes('showTeamClearChoices ? (')
    && settingsSource.includes('canDeleteTeamSharedRecords')
    && settingsClear.includes('if (clearingRef.current) return;')
    && settingsClear.includes('clearingRef.current = true;')
    && settingsClear.includes('clearingRef.current = false;')
    && appSource.includes('showTeamClearChoices={!!user && teamResolved && !!team}')
    && appSource.includes('canDeleteTeamSharedRecords={!!user && teamResolved && !!team && syncOwnerId === user.id}')
    && appSource.includes("clearAllDataModeRef.current = mode ?? 'device-only';")
    && appSource.includes('await handleClearAllData();');
};

d2Ok(d2SourcePasses(app, settings), 'D2 real production source binds owner/device/everywhere semantics and Settings modes');
d2Ok(d1ReplaySourcePasses(app), 'D2 preserves D1 true-only removal, retry, status, and auth/generation guards');
d2Ok(d1DeleteSourcePasses(sync), 'D2 preserves D1 selected-row cloud proof');
d2Ok(b3SourcePasses(app, sync, settings, exportView), 'D2 preserves B3 terminal status priority');
d2Ok(c4SourcePasses(app), 'D2 preserves C4 one-dirty boundary contract');
d2Ok(!d2ClearBlock(app).includes('PENDING_'), 'D2 adds no queue key or direct queue implementation');
d2Ok(!d2ClearBlock(app).includes('.delete('), 'D2 adds no direct cloud delete primitive');
assert.doesNotThrow(() => transformSync(settings, { loader: 'tsx', jsx: 'automatic', format: 'esm' }), 'D2 real SettingsView compiles');
d2AssertionCount += 1;

const ownerDevice = await runD2Clear(app, 'owner', 'device-only');
d2Equal(ownerDevice.shared, [], 'D2 owner device-only queues zero shared rows');
d2Equal(ownerDevice.tires, [], 'D2 owner device-only queues zero tires');
d2Equal(ownerDevice.pushes, [], 'D2 owner device-only invokes zero cloud push/delete paths');
d2Equal(ownerDevice.removedKeys, D2_KEYS, 'D2 device-only removes exact 17 existing local keys');
d2Equal(ownerDevice.states, D2_STATE_NAMES, 'D2 device-only preserves every existing in-memory reset');
d2Equal(ownerDevice.undo, 1, 'D2 device-only cancels car Undo exactly once');
d2Equal(ownerDevice.dirty, 1, 'D2 device-only marks C4 dirty exactly once');
d2Ok(ownerDevice.events[0] === 'undo', 'D2 car Undo happens before queue, push, wipe, or dirty work');
d2Equal(ownerDevice.info, ['Device data cleared. Shared team data will re-download on next sync.'], 'D2 device-only status is honest');
d2Equal(ownerDevice.reasons, ['clear-device-only'], 'D2 device-only uses dedicated structured reason');
const ownerDeviceRoute = renderD2StructuredNotice(app, { reason: ownerDevice.reasons[0] });
d2Equal(ownerDeviceRoute, {
  visible: true,
  isInfo: true,
  isSuccess: false,
  isPersistent: false,
  msg: 'Device data cleared. Shared team data will re-download on next sync.',
}, 'D2 device-only exact copy renders through real info arbiter, never operation-failed');

const ownerEverywhere = await runD2Clear(app, 'owner', 'everywhere');
const expectedShared = D2_TABLES.flatMap(table => d2Fixture[table].map(item => ({
  table,
  recordId: item.id,
  soloOnly: false,
  accountId: 'account-1',
})));
d2Equal(ownerEverywhere.shared, expectedShared, 'D2 canonical owner queues every local id across exact nine shared tables');
d2Equal(ownerEverywhere.tires, [
  { accountId: 'account-1', tireId: 'tire-1' },
  { accountId: 'account-1', tireId: 'tire-2' },
], 'D2 canonical owner queues all personal tires under signed-in account');
d2Equal(ownerEverywhere.pushes.map(call => call.name), [...D2_PUSHES, 'pushTires'], 'D2 owner pairs all nine empty shared pushes plus personal tires');
for (const call of ownerEverywhere.pushes) {
  d2Equal(call.args[0], [], `D2 ${call.name} uses matching empty dataset`);
  d2Equal(call.args[1], 'account-1', `D2 ${call.name} uses canonical owner/account id`);
}
const ownerCarsPush = ownerEverywhere.pushes.find(call => call.name === 'pushCars');
d2Equal(ownerCarsPush?.args[2], 'team-1', 'D2 cars empty push retains resolved canonical team id');
d2Equal(ownerEverywhere.removedKeys, D2_KEYS, 'D2 everywhere preserves exact local wipe');
d2Equal(ownerEverywhere.dirty, 1, 'D2 everywhere marks C4 dirty once');
d2Ok(ownerEverywhere.events.indexOf('queue:setups:setups-1') < ownerEverywhere.events.indexOf('push:pushSetups'), 'D2 owner queues shared intent before matching cloud push');
d2Ok(ownerEverywhere.events.indexOf('tire:tire-1') < ownerEverywhere.events.indexOf('push:pushTires'), 'D2 owner queues tire intent before empty tire push');
d2Equal(ownerEverywhere.reasons, ['clear-everywhere'], 'D2 everywhere uses dedicated structured reason');
const ownerEverywhereRoute = renderD2StructuredNotice(app, { reason: ownerEverywhere.reasons[0] });
d2Equal(ownerEverywhereRoute, {
  visible: true,
  isInfo: true,
  isSuccess: false,
  isPersistent: false,
  msg: 'Your records are queued for deletion. Team records you do not own remain in cloud.',
}, 'D2 everywhere exact copy renders through real info arbiter, never operation-failed');

for (const identity of ['member', 'missing-owner'] as const) {
  const outcome = await runD2Clear(app, identity, 'everywhere');
  d2Equal(outcome.shared, [], `D2 ${identity} queues zero shared records`);
  d2Equal(outcome.pushes.map(call => call.name), ['pushTires'], `D2 ${identity} invokes only personal tire push path`);
  d2Equal(outcome.tires.map(item => item.tireId), ['tire-1', 'tire-2'], `D2 ${identity} queues personal tires`);
  d2Equal(outcome.removedKeys, D2_KEYS, `D2 ${identity} keeps same local wipe`);
  d2Ok(outcome.info[0].includes('Team records you do not own remain in cloud.'), `D2 ${identity} status does not imply shared deletion`);
}

const signedOut = await runD2Clear(app, 'signed-out');
d2Equal(signedOut.shared, [], 'D2 signed-out clear stays local-only');
d2Equal(signedOut.tires, [], 'D2 signed-out clear keeps zero personal queue');
d2Equal(signedOut.pushes, [], 'D2 signed-out clear keeps zero cloud path');
for (const identity of ['solo', 'unresolved'] as const) {
  const outcome = await runD2Clear(app, identity);
  d2Equal(outcome.shared, expectedShared.map(entry => ({ ...entry, soloOnly: true })), `D2 ${identity} retains provisional soloOnly shared intents`);
  d2Equal(outcome.tires.map(item => item.tireId), ['tire-1', 'tire-2'], `D2 ${identity} retains personal tire intents`);
  d2Equal(outcome.pushes, [], `D2 ${identity} retains no immediate empty pushes`);
}

for (const table of D2_TABLES) {
  const queuedAtPullStart = new Set(ownerEverywhere.shared.map(intent => `${intent.table}:${intent.recordId}`));
  const filtered = compileD1PullFilter(app)(table, [
    ...d2Fixture[table],
    { id: `${table}-nonowned` },
  ], {
    queuedAtPullStart,
    readPendingTeamDeletes: () => ownerEverywhere.shared,
    pullUserId: 'account-1',
    window: { localStorage: {} },
  });
  d2Equal(filtered, [{ id: `${table}-nonowned` }], `D2 queued ${table} fixtures cannot resurrect during pull/resume filtering`);
}

const runSettingsDoubleSubmit = async (source: string) => {
  let calls = 0;
  const modes: Array<D2Mode | undefined> = [];
  const steps: number[] = [];
  let finish: (() => void) | null = null;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const clear = compileD2SettingsClear(source, {
    clearingRef: { current: false },
    setClearStep: (step: number) => { steps.push(step); },
    onClearAllData: (mode?: D2Mode) => { calls += 1; modes.push(mode); return pending; },
  });
  const first = clear('everywhere');
  const second = clear('device-only');
  await Promise.resolve();
  const beforeFinish = { calls, modes: [...modes], steps: [...steps] };
  finish?.();
  await Promise.all([first, second]);
  return { beforeFinish, calls, modes, steps };
};
const guardedSubmit = await runSettingsDoubleSubmit(settings);
d2Equal(guardedSubmit.beforeFinish, { calls: 1, modes: ['everywhere'], steps: [2] }, 'D2 real Settings guard blocks double-submit and preserves first mode');
d2Equal(guardedSubmit.steps, [2, 0], 'D2 real Settings clearing state closes only after work settles');

const d2StructuredOutcomeFails = async (
  source: string,
  mode: D2Mode,
  expectedReason: string,
  expectedCopy: string,
): Promise<boolean> => {
  try {
    const outcome = await runD2Clear(source, 'owner', mode);
    if (outcome.reasons.length !== 1 || outcome.reasons[0] !== expectedReason) return true;
    const route = renderD2StructuredNotice(source, { reason: outcome.reasons[0] });
    return !route.visible
      || !route.isInfo
      || route.msg !== expectedCopy
      || route.msg === 'That action could not be completed.';
  } catch {
    return true;
  }
};

const deviceQueuesShared = d2Replace(app, "if (user && (!teamResolved || !team)) {", "if (user && resolvedMode === 'device-only') {", 'device-queues-shared');
d2Kill('device-only-queues-shared', (await runD2Clear(deviceQueuesShared, 'owner', 'device-only')).shared.length > 0);
const deviceQueuesCloud = d2Replace(app, "if (user && resolvedMode !== 'device-only') {", 'if (user) {', 'device-queues-cloud');
const deviceCloudOutcome = await runD2Clear(deviceQueuesCloud, 'owner', 'device-only');
d2Kill('device-only-queues-tire-cloud', deviceCloudOutcome.tires.length > 0 && deviceCloudOutcome.pushes.length > 0);
const missingWarning = d2Replace(settings, 'shared team data will re-download on next sync', 'team data stays available', 'missing-warning');
d2Kill('device-warning-removed', !d2SourcePasses(app, missingWarning));
const memberQueuesShared = d2Replace(app, 'if (isResolvedTeam && syncOwnerId === user.id) {', 'if (isResolvedTeam) {', 'member-queues-shared');
d2Kill('member-queues-shared', (await runD2Clear(memberQueuesShared, 'member', 'everywhere')).shared.length > 0);
const ownerOmitsTable = d2Replace(app, "      ['todos', todos.map(item => item.id)],\n", '', 'owner-omits-table');
d2Kill('owner-omits-table-ids', (await runD2Clear(ownerOmitsTable, 'owner', 'everywhere')).shared.length !== expectedShared.length);
const wrongSoloOnly = d2Replace(app, 'queueSharedCloudDelete(table, id, false, user.id)', 'queueSharedCloudDelete(table, id, true, user.id)', 'wrong-soloOnly');
d2Kill('owner-wrong-soloOnly', (await runD2Clear(wrongSoloOnly, 'owner', 'everywhere')).shared.some(intent => intent.soloOnly));
const wrongAccount = d2Replace(app, 'queueSharedCloudDelete(table, id, false, user.id)', "queueSharedCloudDelete(table, id, false, 'wrong-account')", 'wrong-account');
d2Kill('owner-wrong-account', (await runD2Clear(wrongAccount, 'owner', 'everywhere')).shared.some(intent => intent.accountId === 'wrong-account'));
const wrongTable = d2Replace(app, 'queueSharedCloudDelete(table, id, false, user.id)', "queueSharedCloudDelete('setups', id, false, user.id)", 'wrong-table');
d2Kill('owner-wrong-table', new Set((await runD2Clear(wrongTable, 'owner', 'everywhere')).shared.map(intent => intent.table)).size === 1);
const wrongId = d2Replace(app, 'queueSharedCloudDelete(table, id, false, user.id)', "queueSharedCloudDelete(table, 'wrong-id', false, user.id)", 'wrong-id');
d2Kill('owner-wrong-id', (await runD2Clear(wrongId, 'owner', 'everywhere')).shared.every(intent => intent.recordId === 'wrong-id'));
const pairingLost = d2Replace(app, '        pushTodos([], user.id, setSyncStatus);\n', '', 'pairing-lost');
d2Kill('queue-push-pairing-lost', (await runD2Clear(pairingLost, 'owner', 'everywhere')).pushes.length === D2_PUSHES.length);
const wrongTeam = d2Replace(app, 'pushCars([], user.id, team.id, setSyncStatus)', 'pushCars([], user.id, null, setSyncStatus)', 'wrong-team');
d2Kill('cars-push-wrong-team', (await runD2Clear(wrongTeam, 'owner', 'everywhere')).pushes.find(call => call.name === 'pushCars')?.args[2] === null);
const tiresOmitted = d2Replace(app, '      tireInventory.forEach(item => {', '      [].forEach(item => {', 'tires-omitted');
d2Kill('personal-tires-omitted', (await runD2Clear(tiresOmitted, 'owner', 'everywhere')).tires.length === 0);
const tireWrongAccount = d2Replace(app, '          accountId: user.id,\n          tireId: item.id,', "          accountId: 'wrong-account',\n          tireId: item.id,", 'tire-wrong-account');
d2Kill('personal-tire-wrong-account', (await runD2Clear(tireWrongAccount, 'member', 'everywhere')).tires.every(intent => intent.accountId === 'wrong-account'));
const labelsRemoved = d2Replace(settings, 'Delete my records everywhere', 'Delete records', 'choice-label-removed');
d2Kill('exact-choice-label-removed', !d2SourcePasses(app, labelsRemoved));
const modesSwapped = d2Replace(settings, "clearRacingData('device-only')", "clearRacingData('everywhere')", 'choice-modes-swapped');
d2Kill('choice-callback-modes-swapped', !d2SourcePasses(app, modesSwapped));
const appWiringLost = d2Replace(app, 'showTeamClearChoices={!!user && teamResolved && !!team}', 'showTeamClearChoices={false}', 'settings-wiring-lost');
d2Kill('settings-choice-wiring-lost', !d2SourcePasses(appWiringLost, settings));
const legacyChanged = d2Replace(app, 'if (user && (!teamResolved || !team)) {', 'if (user && !teamResolved) {', 'legacy-solo-changed');
d2Kill('resolved-solo-behavior-changed', (await runD2Clear(legacyChanged, 'solo')).shared.length === 0);
const undoMoved = d2Replace(app, '    carUndo.undo();\n', '', 'car-undo-removed');
d2Kill('car-undo-removed', (await runD2Clear(undoMoved, 'owner', 'device-only')).undo === 0);
const localKeyRemoved = d2Replace(app, "      ACTIVE_WEEKEND_KEY,\n", '', 'local-key-removed');
d2Kill('local-key-reset-removed', (await runD2Clear(localKeyRemoved, 'owner', 'device-only')).removedKeys.length === 16);
const stateResetRemoved = d2Replace(app, '    setAccounting([]);\n', '', 'state-reset-removed');
d2Kill('state-reset-removed', !(await runD2Clear(stateResetRemoved, 'owner', 'device-only')).states.includes('accounting'));
const dirtyRemoved = d2Replace(
  app,
  '    markSavedDirty();\n    if (isResolvedTeam)',
  '    if (isResolvedTeam)',
  'dirty-removed',
);
d2Kill('c4-dirty-mark-removed', (await runD2Clear(dirtyRemoved, 'owner', 'device-only')).dirty === 0);
const directSupabase = d2Replace(app, '    const isResolvedTeam =', "    supabase.from('setups').delete();\n    const isResolvedTeam =", 'direct-supabase');
d2Kill('direct-supabase-delete-added', !d2SourcePasses(directSupabase, settings));
const doubleSubmitGuardRemoved = d2Replace(settings, '    if (clearingRef.current) return;\n', '', 'double-submit-guard');
d2Kill('double-submit-guard-removed', (await runSettingsDoubleSubmit(doubleSubmitGuardRemoved)).beforeFinish.calls === 2);

const deviceFallbackRewire = d2Replace(
  app,
  "      showInfo({ reason: resolvedMode === 'device-only' ? 'clear-device-only' : 'clear-everywhere' });",
  `      if (resolvedMode === 'device-only') {
        showComponentInfo('Device data cleared. Shared team data will re-download on next sync.');
      } else {
        showInfo({ reason: 'clear-everywhere' });
      }`,
  'device-fallback-rewire',
);
d2Kill('device-success-fallback-rewire', await d2StructuredOutcomeFails(
  deviceFallbackRewire,
  'device-only',
  'clear-device-only',
  'Device data cleared. Shared team data will re-download on next sync.',
));
const everywhereFallbackRewire = d2Replace(
  app,
  "      showInfo({ reason: resolvedMode === 'device-only' ? 'clear-device-only' : 'clear-everywhere' });",
  `      if (resolvedMode === 'everywhere') {
        showComponentInfo('Your records are queued for deletion. Team records you do not own remain in cloud.');
      } else {
        showInfo({ reason: 'clear-device-only' });
      }`,
  'everywhere-fallback-rewire',
);
d2Kill('everywhere-success-fallback-rewire', await d2StructuredOutcomeFails(
  everywhereFallbackRewire,
  'everywhere',
  'clear-everywhere',
  'Your records are queued for deletion. Team records you do not own remain in cloud.',
));
const deviceReasonRemoved = d2Replace(
  app,
  "  'clear-device-only': () => 'Device data cleared. Shared team data will re-download on next sync.',\n",
  '',
  'device-reason-removed',
);
d2Kill('device-structured-reason-removed', await d2StructuredOutcomeFails(
  deviceReasonRemoved,
  'device-only',
  'clear-device-only',
  'Device data cleared. Shared team data will re-download on next sync.',
));
const everywhereReasonRemoved = d2Replace(
  app,
  "  'clear-everywhere': () => 'Your records are queued for deletion. Team records you do not own remain in cloud.',\n",
  '',
  'everywhere-reason-removed',
);
d2Kill('everywhere-structured-reason-removed', await d2StructuredOutcomeFails(
  everywhereReasonRemoved,
  'everywhere',
  'clear-everywhere',
  'Your records are queued for deletion. Team records you do not own remain in cloud.',
));
const deviceCopyChanged = d2Replace(
  app,
  'Device data cleared. Shared team data will re-download on next sync.',
  'Device data cleared. Team data may return later.',
  'device-copy-changed',
);
d2Kill('device-exact-copy-changed', await d2StructuredOutcomeFails(
  deviceCopyChanged,
  'device-only',
  'clear-device-only',
  'Device data cleared. Shared team data will re-download on next sync.',
));
const everywhereCopyChanged = d2Replace(
  app,
  'Your records are queued for deletion. Team records you do not own remain in cloud.',
  'Records queued.',
  'everywhere-copy-changed',
);
d2Kill('everywhere-exact-copy-changed', await d2StructuredOutcomeFails(
  everywhereCopyChanged,
  'everywhere',
  'clear-everywhere',
  'Your records are queued for deletion. Team records you do not own remain in cloud.',
));

d2Equal(new Set(killedD2Mutations).size, killedD2Mutations.length, 'D2 killed mutation labels are unique');
d2Ok(killedD2Mutations.length >= 20, 'D2 kills at least twenty independent mutation classes');
console.log(`D2 assertions: ${d2AssertionCount}`);
console.log(`D2 killed mutations (${killedD2Mutations.length}): ${killedD2Mutations.join(', ')}`);
console.log('D2 Clear Racing Data harness: PASS');
