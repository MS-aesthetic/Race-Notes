import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
import { isAppGuideSection } from '../src/lib/helpRouting';

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
assert.match(weekendReport.bodyHtml, /Runs \(1\)/);
assert.match(weekendReport.bodyHtml, /Heat 1/);
assert.ok(weekendReport.textLines.some(line => line.includes('Net:')));
assert.match(buildTrackersReport('all', todos, accounting).bodyHtml, /Torque wheels/);
assert.match(buildMasterReport(setup, INITIAL_ACTIVE_SESSION, [weekend], todos, accounting).bodyHtml, /Weekends \(1\)/);
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
assert.equal((await shareOrDownloadReport(file, 'Weekend', adapter({
  isNative: true,
  nativeShare: async () => { calls.push('native'); },
  download: () => calls.push('download'),
}))).status, 'shared');
assert.deepEqual(calls, ['native']);

calls = [];
assert.equal((await shareOrDownloadReport(file, 'Weekend', adapter({
  webCanShare: () => true,
  webShare: async () => { calls.push('web'); },
  download: () => calls.push('download'),
}))).status, 'shared');
assert.deepEqual(calls, ['web']);

calls = [];
assert.equal((await shareOrDownloadReport(file, 'Weekend', adapter({
  webCanShare: () => true,
  webShare: async () => { throw new DOMException('User cancelled', 'AbortError'); },
  download: () => calls.push('download'),
}))).status, 'cancelled');
assert.deepEqual(calls, []);

calls = [];
assert.equal((await shareOrDownloadReport(file, 'Weekend', adapter({
  isNative: true,
  nativeShare: async () => { throw new Error('Plugin failed'); },
  download: () => calls.push('download'),
}))).status, 'failed');
assert.deepEqual(calls, []);
assert.equal((await shareOrDownloadReport(file, 'Weekend', adapter({ download: () => { throw new Error('Disk full'); } }))).status, 'failed');

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');
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

for (const anchor of ['setup', 'four-bar', 'loads', 'setup-diff']) {
  assert.doesNotMatch(quickRef, new RegExp(`data-help-anchor="${anchor}"`));
  assert.match(guideView, new RegExp(`id: '${anchor}'`));
}
assert.doesNotMatch(quickRef, /Before You Change Anything|Setup Sheet<\/h2>|Load Sessions<\/h2>|Compare Setups<\/h2>/);
assert.ok(quickRef.indexOf('Pit-Side Adjustment Finder') < quickRef.indexOf('What Shock Changes Do'));
assert.equal(isAppGuideSection(undefined), false);
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
assert.match(renderToStaticMarkup(createElement(GuideView)), /How to use CREW CHIEF/);
assert.match(bottomSheet, /useBackClosable\(open, onClose\)/);
assert.match(bottomSheet, /sheet-scrim.*onClick=\{onClose\}/);
for (const heading of ['Creating a setup', 'Recording four-bar measurements', 'Adding load sessions', 'Comparing setups']) {
  assert.match(userGuide, new RegExp(`## ${heading}`, 'i'));
}
assert.match(userGuide, /At 90% of its configured limit/);
assert.match(setupView, /onHelp\('setup'\)/);
assert.match(fourBarView, /onHelp\('four-bar'\)/);
assert.match(setupView, /buildSetupReport\(target\)/);
assert.doesNotMatch(setupView, /buildSetupReport\(target, activeSession\)/);
assert.match(loadsView, /onHelp\('loads'\)/);
assert.match(diffView, /onHelp\('setup-diff'\)/);
assert.match(quickRef, /<strong>High:<\/strong> Try first\./);
assert.match(quickRef, /<strong>Medium:<\/strong> Try this next if the first change did not fix the problem\./);
assert.match(quickRef, /<strong>Low:<\/strong> Fine-tuning after the bigger items are checked\./);
assert.match(weekendView, /Share weekend PDF/);
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
assert.doesNotMatch(renderedEffectCorpus, /allowing controlled car roll and allowing|cushions the rear against the rear snapping loose|highly free-moving|under the power|while at the same time/i);
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
const shopCopy = plainRacerEffect('The rear roll center changes forward weight transfer and rear steer geometry at the apex. This preserves the tire contact patch during braking transitions.');
assert.equal(shopCopy, 'The rear roll location changes forward load shift and bar angles and rear steer at mid-corner. This keeps the tire contact during braking.');
assert.doesNotMatch(shopCopy, /roll center|weight transfer|geometry|apex|contact patch|transition/i);
assert.match(shopCopy, /rear roll location|forward load shift|tire contact/);

console.log('Chunk 9 export/help/share harness PASS');
