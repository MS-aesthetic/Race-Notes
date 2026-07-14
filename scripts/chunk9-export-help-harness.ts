import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const setupView = source('src/components/SetupView.tsx');
const weekendView = source('src/components/RaceWeekendView.tsx');
const loadsView = source('src/components/SmasherLoadsView.tsx');
const diffView = source('src/components/SetupDiffView.tsx');
const pdfSource = source('src/lib/exportPdf.ts');

for (const anchor of ['setup', 'four-bar', 'loads', 'setup-diff']) assert.match(quickRef, new RegExp(`data-help-anchor="${anchor}"`));
assert.match(helpSheet, /scrollIntoView/);
assert.match(setupView, /onHelp\('setup'\)/);
assert.match(setupView, /buildSetupReport\(target\)/);
assert.doesNotMatch(setupView, /buildSetupReport\(target, activeSession\)/);
assert.match(loadsView, /onHelp\('loads'\)/);
assert.match(diffView, /onHelp\('setup-diff'\)/);
assert.match(weekendView, /Share weekend PDF/);
assert.doesNotMatch(pdfSource, /from ['"]react['"]/);
assert.doesNotMatch([quickRef, setupView, weekendView].join('\n'), /AFCO|chassis-specific|package-specific|Package-dependent|Share with Team|Start New Logger Session|Shock Adjustment Handling Impacts|Adjustment Matrix/i);
const shopCopy = plainRacerEffect('The rear roll center changes forward weight transfer and rear steer geometry at the apex. This preserves the tire contact patch during braking transitions. Make one small change and check the next run.');
assert.equal(shopCopy, 'The rear roll point changes weight moving to the front and bar angles and rear steer in the middle. This keeps the part of the tire touching the track during braking. Make one small change and check the next run.');
assert.doesNotMatch(shopCopy, /roll center|weight transfer|geometry|apex|contact patch|transition/i);
assert.match(shopCopy, /Make one small change/);

console.log('Chunk 9 export/help/share harness PASS');
