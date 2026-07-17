import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const PARENT = '89845e8';
const UXP18_COMMIT = '38e9828';
const APP_PATH = 'src/App.tsx';
const SETUP_PATH = 'src/components/SetupView.tsx';
const HARNESS_PATH = 'scripts/saved-flash-harness.ts';
const UXP17_ASSERTION_PATH = 'scripts/muted-text-color-harness.ts';
const STEPPER_PATH = 'src/components/ui/NumberStepper.tsx';
const root = process.cwd();
const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');
const app = normalizeEol(readFileSync(join(root, APP_PATH), 'utf8'));
const setup = normalizeEol(readFileSync(join(root, SETUP_PATH), 'utf8'));
const parent = normalizeEol(execFileSync('git', ['show', `${PARENT}:${APP_PATH}`], { cwd: root, encoding: 'utf8' }));
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
    "if (syncStatus === 'Synced') setSyncStatus('');",
    'if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;',
    'infoShownAtRef.current.set(dedupeKey, now);',
    'if (infoToastRef.current) return;',
    "setTimeout(() => setSyncStatus(''), SUCCESS_TOAST_MS)",
    'onInfo={showComponentInfo}',
    'const observer = new ResizeObserver(updateNotificationTop);',
    'setNotificationTop((header.getBoundingClientRect().bottom / zoom) + 8);',
  ].every(token => appSource.includes(token))
    && !/<InfoToast\b/.test(appSource)
    && !/showInfo\(\s*['"]/.test(appSource)
    && !/const showInfo = \([^)]*message/.test(appSource)
    && !appSource.includes('setInfoToast(message)')
    && !/setTimeout\(\(\) => setSyncStatus\(''\), (?:2500|3000)\)/.test(appSource)
    && showInfoBlock.indexOf('clearSavedFlash();') < showInfoBlock.indexOf('if (lastShownAt !== undefined')
    && markup.includes('const isInfo = !!infoToast;')
    && markup.includes('const msg = isInfo')
    && markup.includes('resolveInfoCopy(infoToast)')
    && markup.includes("const isBusy = !isInfo && !savedFlash && syncStatus === 'Syncing...';")
    && markup.includes('data-notification-slot="arbiter"')
    && markup.includes('style={{ top: notificationTop }}')
    && markup.includes('min-h-11')
    && markup.includes('max-w-md')
    && markup.includes('font-display text-sm font-bold')
    && markup.includes('aria-label="Dismiss notification"')
    && markup.includes('className="tap-target -mr-2 shrink-0 text-on-surface-variant"')
    && markup.includes('onClick={clearInfo}')
    && (markup.match(/role="status"/g) ?? []).length === 1
    && setupSource.includes('export const SETUP_NOTICE_COPY =')
    && (setupSource.match(/Starting and finished snapshots stay unchanged\. Clone this setup to make a new editable Current Setup\./g) ?? []).length === 1
    && setupSource.includes('{SETUP_NOTICE_COPY.historicalSetup}')
    && !setupSource.includes("onInfo?.('Historical setups are view-only.");
};

assert.ok(notificationSourcePasses(app, setup), 'B2 source has one reason-keyed arbiter, passive historic banner, and one top notification renderer');

type B2Probe = { viewportWidth: number; viewportHeight: number; scale: number; appSource: string; offline: boolean; simultaneous?: boolean };
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
  isInfo: boolean;
  isSuccess: boolean;
  msg: string;
};

const productionNotificationRoute = (appSource: string, simultaneous = false): B2RenderedRoute => {
  const markup = between(appSource, '        {/* One compact notification arbiter.', '\n\n        {/* Core Main Active Canvas Area */}', 'B2 production route slice');
  const route = markup.match(/(const isInfo = [\s\S]*?const isSuccess = [^;]+;)/)?.[1];
  assert.ok(route, 'B2 exact production notification routing statements exist');
  const evaluateRoute = new Function(
    'infoToast',
    'savedFlash',
    'syncStatus',
    'isOnline',
    'resolveInfoCopy',
    `${route}\nreturn { isInfo, isSuccess, msg };`,
  ) as (infoToast: object, savedFlash: boolean, syncStatus: string, isOnline: boolean, resolveInfoCopy: () => string) => B2RenderedRoute;
  return evaluateRoute(
    { reason: 'missing-weekend-log' },
    simultaneous,
    '',
    true,
    () => 'Race Day setup is missing or locked. Restore it before logging a run.',
  );
};

const b2NotificationGeometry = ({ viewportWidth, viewportHeight, scale, appSource, offline, simultaneous = false }: B2Probe) => {
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
  const route = productionNotificationRoute(appSource, simultaneous);
  const noticeKind = route.isInfo ? 'info' : route.isSuccess ? 'saved' : 'sync';
  const duplicateNotice = simultaneous && markup.includes('data-notification-slot="saved-duplicate"');
  const slotStyle = fixedTop ? `top:${fixedTop}px` : fixedBottom ? `bottom:${fixedBottom}px` : '';
  const renderedPillClass = route.isSuccess
    ? `${noticeBaseClass(appSource)} bg-green-500 border-green-300 text-black`
    : pillClass;
  const renderedClose = route.isInfo
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
    && result.noticeKind === 'info'
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
  const clearsSavedOnInfo = source.includes('clearSavedFlash();');
  const showInfoAt = source.indexOf('const showInfo = (notice: InfoNotice) => {');
  const dedupeReturnAt = source.indexOf('if (lastShownAt !== undefined && now - lastShownAt < INFO_DEDUPE_MS) return;', showInfoAt);
  const clearsSavedBeforeDedupe = source.indexOf('clearSavedFlash();', showInfoAt) < dedupeReturnAt;
  const infoWins = source.includes('const isInfo = !!infoToast;');
  const duplicateRenderPath = source.includes('data-notification-slot="saved-duplicate"');
  const syncUsesSuccessConstant = source.includes("setTimeout(() => setSyncStatus(''), SUCCESS_TOAST_MS)");
  const pullTimeout = source.match(/setSyncStatus\('Synced'\);\s*setTimeout\(\(\) => setSyncStatus\(''\), (\d+)\)/)?.[1];
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
arbiter.showSynced(true);
arbiter.advance(1499);
assert.equal(arbiter.visible(), 'Synced', 'B2 pull Synced remains before shared 1.5-second lifetime');
arbiter.advance(1);
assert.equal(arbiter.visible(), null, 'B2 pull Synced expires through shared cleanup with no competing timer');

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
  .replace('    clearSavedFlash();\n    if (syncStatus === \'Synced\')', '    // mutation: retain pending Saved while info becomes active\n    if (syncStatus === \'Synced\')')
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
  .replace('    clearSavedFlash();\n    if (syncStatus === \'Synced\')', '    // mutation: retain pending Saved while info becomes active\n    if (syncStatus === \'Synced\')')
  .replace('const isInfo = !!infoToast;', 'const isInfo = false && !!infoToast;');
compileB2Mutation(infoPriorityMutation, 'info-priority');
assert.equal(notificationSourcePasses(infoPriorityMutation, setup), false, 'B2 info-priority source mutation fails the source gate');
const infoPriorityModel = createB2ArbiterModel(infoPriorityMutation);
infoPriorityModel.flashSaved();
infoPriorityModel.showInfo('pressure-source');
assert.equal(infoPriorityModel.visible(), 'Saved', 'B2 info-priority mutation behaviorally lets Saved hide info');
const mutatedPriorityRender = b2RenderedPasses({ viewportWidth: 360, viewportHeight: 800, scale: 1, appSource: infoPriorityMutation, offline: true, simultaneous: true });
assert.equal(mutatedPriorityRender.result.noticeKind, 'saved', 'B2 compile-real priority mutation production routing renders Saved');
assert.match(mutatedPriorityRender.result.noticeText, /Saved/, 'B2 compile-real priority mutation hides info copy behind Saved');
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
  .replace('    clearSavedFlash();\n    if (syncStatus === \'Synced\') setSyncStatus(\'\');\n    const lastShownAt', '    if (syncStatus === \'Synced\') setSyncStatus(\'\');\n    const lastShownAt')
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

const syncTimeoutMutation = app.replace("setTimeout(() => setSyncStatus(''), SUCCESS_TOAST_MS)", "setTimeout(() => setSyncStatus(''), 2500)");
compileB2Mutation(syncTimeoutMutation, 'sync-timeout');
assert.equal(notificationSourcePasses(syncTimeoutMutation, setup), false, 'B2 ordinary Synced timeout mutation fails source gate');
const syncTimeoutModel = createB2ArbiterModel(syncTimeoutMutation);
syncTimeoutModel.showSynced();
syncTimeoutModel.advance(1500);
assert.equal(syncTimeoutModel.visible(), 'Synced', 'B2 ordinary Synced timeout mutation remains visible past shared lifetime');

const pullTimeoutMutation = app.replace("      setSyncStatus('Synced');", "      setSyncStatus('Synced');\n      setTimeout(() => setSyncStatus(''), 3000);");
compileB2Mutation(pullTimeoutMutation, 'pull-timeout');
assert.equal(notificationSourcePasses(pullTimeoutMutation, setup), false, 'B2 pull Synced timeout mutation fails source gate');
const pullTimeoutModel = createB2ArbiterModel(pullTimeoutMutation);
pullTimeoutModel.showSynced(true);
pullTimeoutModel.advance(1500);
assert.equal(pullTimeoutModel.visible(), 'Synced', 'B2 pull Synced timeout mutation remains visible past shared lifetime');

const duplicateHistoricalMutation = setup.replace(
  'if (isSetupLocked(target, weekends)) {\n      return;',
  "if (isSetupLocked(target, weekends)) {\n      onInfo?.('Historical setups are view-only. Clone this setup to make an editable copy.');\n      return;",
);
assert.equal(notificationSourcePasses(app, duplicateHistoricalMutation), false, 'B2 duplicate historical transient-copy mutation fails the source gate');
console.log('B2 notification arbiter harness: PASS');

// Exact feature files plus one necessary assertion-only prior-harness compatibility edit.
const tracked = execFileSync('git', ['diff', '--name-only', PARENT, UXP18_COMMIT, '--', 'src', 'scripts'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
assert.deepEqual(
  tracked.sort(),
  [APP_PATH, HARNESS_PATH, UXP17_ASSERTION_PATH].sort(),
  'UXP-18 changes App/focused harness plus only the required UXP-17 assertion compatibility file',
);

// Reconstruct parent App exactly by reversing only authorized UXP-18 edits.
let reverted = app.replace(/^\s+(?:if \(notifySaved\) )?flashSaved\(\);\n/gm, '');
reverted = reverted
  .replace(
    `    const notifySaved = typeof (expectedAccountId as unknown) === 'boolean'\n      ? expectedAccountId as unknown as boolean\n      : true;\n    if (typeof (expectedAccountId as unknown) === 'boolean') expectedAccountId = undefined;\n`,
    '',
  )
  .replace(
    'const handleSaveShockSessions = (updated: ShockSession[], notifySaved = true) => {',
    'const handleSaveShockSessions = (updated: ShockSession[]) => {',
  )
  .replace(
    'const handleSaveTodos = (updated: Todo[], notifySaved = true) => {',
    'const handleSaveTodos = (updated: Todo[]) => {',
  )
  .replace('handleSaveTodos(reconciled, false);', 'handleSaveTodos(reconciled);')
  .replace('handleSaveShockSessions(stampedShock, false);', 'handleSaveShockSessions(stampedShock);')
  .replace(
    `    // @ts-expect-error Runtime boolean overload keeps UXP-3's account-guard signature stable.\n    handleSaveCars([defaultCar], false);`,
    '    handleSaveCars([defaultCar]);',
  )
  .replace(
    `  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n`,
    `  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const flashReadyRef = useRef(false);      // false until initial hydration settles\n  const suppressPullRef = useRef(false);    // true during cloud pulls\n`,
  )
  .replace(
    `  useEffect(() => {\n    return () => {\n      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);\n    };\n  }, []);\n`,
    `  // Enable flashes only after the initial localStorage hydration has settled,\n  // so loading the app doesn't count as a "save".\n  useEffect(() => {\n    const t = setTimeout(() => { flashReadyRef.current = true; }, 800);\n    return () => clearTimeout(t);\n  }, []);\n`,
  )
  .replace(
    `  // Auto-dismiss any sync status so a message can never get "stuck" on screen.\n`,
    `  // Fire on any change to the core datasets — covers every save path (online\n  // or offline) without wiring each individual handler.\n  useEffect(() => {\n    if (!flashReadyRef.current || suppressPullRef.current) return;\n    flashSaved();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping, maintenance, maintenanceLogs, checklistTemplates, weekendChecklists]);\n\n  // Auto-dismiss any sync status so a message can never get "stuck" on screen.\n`,
  )
  .replace(
    `    const doPull = async () => {\n      setSyncStatus('Syncing...');`,
    `    const doPull = async () => {\n      suppressPullRef.current = true; // don't show "Saved" for cloud-pull state updates\n      setSyncStatus('Syncing...');`,
  )
  .replace(
    `      setSyncStatus('Synced');\n      setTimeout(() => setSyncStatus(''), 3000);\n`,
    `      setSyncStatus('Synced');\n      setTimeout(() => setSyncStatus(''), 3000);\n      // Re-enable "Saved" flashes after pull-driven state settles.\n      setTimeout(() => { if (isCurrentPull()) suppressPullRef.current = false; }, 800);\n`,
  )
  .replace(
    `      setPullDone(true); // checklist reconciliation may now use merged/local data\n`,
    `      setPullDone(true); // checklist reconciliation may now use merged/local data\n      setTimeout(() => { if (isCurrentPull()) suppressPullRef.current = false; }, 800);\n`,
  );
assert.equal(reverted, parent, 'whole App equals parent after reversing only authorized UXP-18 changes');

// Dataset watcher and timing suppression are gone; explicit timer behavior stays.
assert.doesNotMatch(app, /flashReadyRef|suppressPullRef/);
assert.doesNotMatch(app, /\[setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping, maintenance, maintenanceLogs, checklistTemplates, weekendChecklists\]/);
assert.equal((app.match(/\bflashSaved\(\);/g) ?? []).length, 22, 'exact explicit user-boundary flash inventory');
assert.match(app, /const \[savedFlash, setSavedFlash\] = useState\(false\);/);
assert.match(app, /const savedFlashTimer = useRef<ReturnType<typeof setTimeout> \| null>\(null\);/);
assert.match(app, /const flashSaved = \(\) => \{\s*setSavedFlash\(true\);\s*if \(savedFlashTimer\.current\) clearTimeout\(savedFlashTimer\.current\);\s*savedFlashTimer\.current = setTimeout\(\(\) => setSavedFlash\(false\), 1900\);\s*\};/s);
assert.match(app, /useEffect\(\(\) => \{\s*return \(\) => \{\s*if \(savedFlashTimer\.current\) clearTimeout\(savedFlashTimer\.current\);\s*\};\s*\}, \[\]\);/s);

// Executable coalescing model, tied to exact source lock above.
let visible = false;
let timer: number | null = null;
let nextTimer = 0;
const liveTimers = new Set<number>();
const flashModel = () => {
  visible = true;
  if (timer !== null) liveTimers.delete(timer);
  timer = ++nextTimer;
  liveTimers.add(timer);
};
flashModel();
flashModel();
flashModel();
assert.equal(visible, true);
assert.deepEqual([...liveTimers], [3], 'same-tick compound writes leave one timer');
liveTimers.delete(3);
visible = false;
assert.equal(visible, false, 'latest timer dismisses one coalesced flash');

// Existing visuals, copy, offline variant, and sync-state priority are byte-identical.
const toastStart = '{/* Single brief Saved / sync toast';
const toastEnd = '{/* Core Main Active Canvas Area */}';
assert.equal(
  between(app, toastStart, toastEnd, 'current toast'),
  between(parent, toastStart, toastEnd, 'parent toast'),
  'Saved/sync toast markup remains byte-identical',
);
for (const text of ['Saved', 'Offline — saved on device', 'Syncing…', 'Synced']) assert.ok(app.includes(text));

// Mixed-origin helpers default to notification; exact background calls opt out.
assert.match(app, /const handleSaveCars = \(updated: Car\[\], expectedAccountId\?: string \| null\)/);
assert.match(app, /const notifySaved = typeof \(expectedAccountId as unknown\) === 'boolean'\s*\? expectedAccountId as unknown as boolean\s*: true;/s);
assert.match(app, /if \(typeof \(expectedAccountId as unknown\) === 'boolean'\) expectedAccountId = undefined;/);
assert.match(app, /const handleSaveShockSessions = \(updated: ShockSession\[\], notifySaved = true\)/);
assert.match(app, /const handleSaveTodos = \(updated: Todo\[\], notifySaved = true\)/);
for (const call of [
  'handleSaveTodos(reconciled, false);',
  'handleSaveShockSessions(stampedShock, false);',
  'handleSaveCars([defaultCar], false);',
]) assert.equal(app.split(call).length - 1, 1, `${call} is exact and unique`);

// Shared save helpers flash after state + localStorage and before optional cloud push.
const helperContracts: Array<[string, string, string[]]> = [
  ['handleSaveTires', '  const handleDeleteTireFromCloud', ['setTireInventory(updated);', "localStorage.setItem('race_notes_tires'", 'flashSaved();', 'pushTires(']],
  ['handleSaveCars', '  const handleSaveGarageCars', ['setCars(updated);', "localStorage.setItem('race_notes_cars'", 'if (notifySaved) flashSaved();', 'pushCars(']],
  ['handleSaveShockSessions', '  const handleSaveMaintenance', ['setShockSessions(updated);', "localStorage.setItem('race_notes_shock_graphs'", 'if (notifySaved) flashSaved();', 'pushShockSessions(']],
  ['handleSaveMaintenance', '  const handleSaveTodos', ['setMaintenance(updated);', "localStorage.setItem('race_notes_maintenance'", 'flashSaved();', 'pushMaintenanceComponents(']],
  ['handleSaveTodos', '  const handleSelectGarageCar', ['setTodos(updated);', "localStorage.setItem('race_notes_todos'", 'if (notifySaved) flashSaved();', 'pushTodos(']],
  ['handleSaveMaintenanceLogs', '  const handleSaveChecklistTemplates', ['setMaintenanceLogs(updated);', "localStorage.setItem('race_notes_maintenance_logs'", 'flashSaved();', 'pushMaintenanceLogs(']],
  ['handleSaveChecklistTemplates', '  const handleSaveWeekendChecklists', ['setChecklistTemplates(updated);', "localStorage.setItem('race_notes_checklist_templates'", 'flashSaved();', 'pushChecklistTemplates(']],
  ['handleSaveWeekendChecklists', '  const handleDeleteCar', ['setWeekendChecklists(updated);', "localStorage.setItem('race_notes_weekend_checklists'", 'flashSaved();', 'pushWeekendChecklists(']],
];
for (const [name, end, tokens] of helperContracts) ordered(handler(name, end), tokens, name);

// Direct user entry points flash only after their local persistence boundary.
const directHandlers: Array<[string, string]> = [
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
for (const [name, end] of directHandlers) persistenceBeforeLastFlash(handler(name, end), name);

const accountingCallback = between(app, 'onSaveAccounting={(updated) => {', '                  }}', 'accounting callback');
ordered(accountingCallback, ['setAccounting(updated);', "localStorage.setItem('race_notes_accounting'", 'flashSaved();'], 'accounting callback');
assert.match(handler('handleDeleteCar', '  // ── Clear All Data'), /handleSaveCars\(updated, accountId\);/);
assert.match(handler('handleDeleteMaintenanceComponent', '  const handleDeleteChecklistTemplate'), /handleSaveMaintenance[\s\S]*handleSaveMaintenanceLogs/);
assert.match(handler('handleDeleteChecklistTemplate', '  // ── Create weekend'), /handleSaveChecklistTemplates\(updated\);/);

// Every idle/background/load-only family remains directly flash-free.
const backgroundSlices: Array<[string, string]> = [
  ['todo hydration', between(app, "const [todos, setTodos]", '  const prevTodosForNotifyRef', 'todo hydration')],
  ['starter reconciliation', between(app, '// Wait for auth restoration', '// Maintenance usage is derived', 'starter reconciliation')],
  ['maintenance reconciliation', between(app, '// Maintenance usage is derived', '// ── "Saved" flash toast', 'maintenance reconciliation')],
  ['weekend recovery and auto-select', between(app, '// Active weekend is device-local', '  useEffect(() => {\n    // Attempt load', 'weekend recovery')],
  ['mount hydration', between(app, '  useEffect(() => {\n    // Attempt load', '  // ---- Auth: restore session', 'mount hydration')],
  ['cloud pull', between(app, '  // ---- Cloud sync: pull on login', '  // Resume gets a fresh pull-effect', 'cloud pull')],
  ['legacy backfill', between(app, '// ── One-time backfill', '// ── [4] Auto-create', 'legacy backfill')],
  ['empty-account auto-car', between(app, '// ── [4] Auto-create', '  const handleSaveSetups', 'auto-car')],
  ['car auto-selection', between(app, '// Auto-select first car', '  const handleSaveCars', 'car auto-selection')],
  ['car selection', handler('handleSelectCar', '  const handleSaveShockSessions')],
  ['weekend activation', handler('handleActivateWeekend', '  const handleDeleteMaintenanceComponent')],
  ['recent-session selection', handler('handleSelectRecentSession', '  // ---- Auth gate')],
];
for (const [label, source] of backgroundSlices) assert.doesNotMatch(source, /flashSaved\(\);/, `${label} stays directly silent`);

// Protected ownership, retry, pull, assignment, Undo, and dialog-era sentinels.
assert.match(app, /const currentSyncOwnerId = syncOwnerIdRef\.current;\s*if \(currentSyncOwnerId\) pushCars\(updated, currentSyncOwnerId, teamRef\.current\?\.id \?\? null, setSyncStatus\);/s);
assert.match(app, /queueSharedCloudDelete\('cars', car\.id, false, currentAccountId\)/);
assert.match(app, /const generation = \+\+pullGenerationRef\.current;/);
assert.match(app, /const isCurrentPull = \(\) => pullGenerationRef\.current === generation;/);
assert.match(app, /prevTodosForNotifyRef\.current = updated;/);
assert.match(app, /prevTodosForNotifyRef\.current = materialized;/);
assert.match(app, /<UndoToast pending=\{carUndo\.pending\} onUndo=\{carUndo\.undo\} onDismiss=\{carUndo\.dismiss\}/);
assert.match(app, /<InfoToast\s*open=\{!!infoToast\}/s);
assert.doesNotMatch(app, /window\.confirm\(|\balert\(/);

console.log('Saved flash harness: PASS');
