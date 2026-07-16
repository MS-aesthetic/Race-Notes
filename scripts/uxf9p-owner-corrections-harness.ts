import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CarRequiredPrompt from '../src/components/CarRequiredPrompt';
import QuickReferenceView from '../src/components/QuickReferenceView';
import { buildMasterReport, buildWeekendReport } from '../src/lib/exportPdf';
import { resolveRaceDayCreationTarget } from '../src/lib/raceDayGate';
import { displayLifecycleText } from '../src/lib/setupLifecycle';
import { INITIAL_ACTIVE_SESSION, INITIAL_SETUP } from '../src/data';
import type { RaceWeekend } from '../src/types';

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

assert.deepEqual(resolveRaceDayCreationTarget(null, 'new-weekend'), { tab: 'settings', initialAction: null });
assert.deepEqual(resolveRaceDayCreationTarget('', 'new-session'), { tab: 'settings', initialAction: null });
assert.deepEqual(resolveRaceDayCreationTarget('car-1', 'new-weekend'), { tab: 'raceweekend', initialAction: 'new-weekend' });
assert.deepEqual(resolveRaceDayCreationTarget('car-1', 'new-session'), { tab: 'raceweekend', initialAction: 'new-session' });

const prompt = renderToStaticMarkup(createElement(CarRequiredPrompt, { onAddCar: () => undefined }));
assert.match(prompt, /Add a car first/);
assert.match(prompt, /Add a Car/);
assert.match(prompt, /Race Days, runs, setups, tires, and load sessions need a car/);

const app = source('src/App.tsx');
const setupView = source('src/components/SetupView.tsx');
const raceDayView = source('src/components/RaceWeekendView.tsx');
const dashboard = source('src/components/DashboardView.tsx');
const contextStrip = source('src/components/ContextStrip.tsx');
const quickRef = source('src/components/QuickReferenceView.tsx');
const guide = source('src/components/GuideView.tsx');
const exportView = source('src/components/ExportView.tsx');
const todoView = source('src/components/ToDoView.tsx');
const trackersView = source('src/components/TrackersView.tsx');
const settingsView = source('src/components/SettingsView.tsx');

assert.match(app, /resolveRaceDayCreationTarget\(activeCarId, action\)/);
assert.match(app, /if \(!activeCarId\)[\s\S]{0,180}continueToRunAfterWeekendRef\.current = false/);
assert.match(app, /const handleQuickStartWeekend = \(\) => \{[\s\S]{0,120}if \(!activeCarId\)/);
assert.match(settingsView, /export type SettingsSubTab = 'garage' \| 'account' \| 'appearance' \| 'export' \| 'guide';/);
assert.match(app, /const \[settingsSubTab, setSettingsSubTab\] = useState<SettingsSubTab>\('garage'\)/);
assert.match(app, /const openSettingsTab = \(tab: SettingsSubTab\) => \{[\s\S]{0,180}setSettingsSubTab\(tab\);[\s\S]{0,180}setSettingsViewKey\(value => value \+ 1\);[\s\S]{0,180}setActiveTab\('settings'\)/);
assert.match(app, /const openGarage = \(\) => openSettingsTab\('garage'\);/);
assert.match(app, /subTabRequestKey=\{settingsViewKey\}/);
assert.doesNotMatch(`${app}\n${settingsView}`, /garageRequestKey/);
assert.match(settingsView, /useEffect\(\(\) => \{\s*setSubTab\(initialSubTab \?\? 'garage'\);\s*\}, \[initialSubTab, subTabRequestKey\]\);/);
assert.match(app, /onClick=\{\(\) => openSettingsTab\('garage'\)\}[\s\S]{0,100}id="tab-btn-settings"/);
for (const tab of ['garage', 'account', 'appearance', 'export', 'guide']) {
  assert.match(settingsView, new RegExp(`onClick=\\{\\(\\) => setSubTab\\('${tab}'\\)\\}`));
}
assert.match(app, /const handleCreateNewSession[\s\S]{0,140}if \(!activeCarId\)[\s\S]{0,80}openGarage/);
assert.match(setupView, /<CarRequiredPrompt onAddCar=/);
assert.match(raceDayView, /if \(!editing && !activeCarId\)/);
assert.match(raceDayView, /if \(!wkEditingId && !activeCarId\)/);
assert.match(raceDayView, /<CarRequiredPrompt onAddCar=\{onGoToGarage\}/);
assert.match(raceDayView, /const openNewSession = \(\) => \{[\s\S]{0,80}if \(!activeCarId\)/);
assert.match(raceDayView, /const hasActiveSession = !!activeCarId/);
assert.match(dashboard, /carCount === 0[\s\S]{0,100}onGoToGarage/);
assert.match(dashboard, /<CarRequiredPrompt onAddCar=\{onGoToGarage\}/);
assert.match(contextStrip, /cars\.length === 0/);
assert.match(contextStrip, /Add a car to start a Race Day/);

const quickMarkup = renderToStaticMarkup(createElement(QuickReferenceView));
assert.ok(quickMarkup.indexOf('Pit-Side Adjustment Finder') >= 0);
assert.doesNotMatch(quickMarkup.slice(0, quickMarkup.indexOf('Pit-Side Adjustment Finder')), /Setup Sheet|Four-Bar|Load Sessions|Compare Setups|Before/);
assert.doesNotMatch(quickRef, /Before You Change Anything|Setup Sheet<\/h2>|Load Sessions<\/h2>|Compare Setups<\/h2>/);

const directVisibleCorpus = [app, raceDayView, dashboard, contextStrip, guide, exportView, todoView, trackersView].join('\n');
for (const oldCopy of [
  'No active weekend', 'New weekend', 'New Weekend', 'Open weekends', 'Weekend history',
  'All Weekends', 'Finish Weekend', 'Share weekend PDF', 'Edit weekend', 'Delete weekend',
  'Reset for new weekend', 'No Weekend (general)', 'Weekend Report', 'Weekend notes:',
]) assert.equal(directVisibleCorpus.includes(oldCopy), false, `old visible copy remains: ${oldCopy}`);

const legacy = 'Race Weekend Starting Setup';
assert.equal(displayLifecycleText(legacy), 'Race Day Starting Setup');
assert.equal(legacy, 'Race Weekend Starting Setup');
assert.equal(displayLifecycleText('My Race Weekend Test Setup'), 'My Race Weekend Test Setup');

const raceDay = {
  id: 'wknd-qa', name: 'Test', track: '', date: '2026-07-14', notes: 'Note', sessions: [],
} as RaceWeekend;
const report = buildWeekendReport(raceDay);
assert.equal(report.title, 'Race Day Report');
assert.ok(report.textLines.some(line => line === 'Race Day notes: Note'));
assert.match(buildMasterReport(INITIAL_SETUP, INITIAL_ACTIVE_SESSION, [raceDay], [], []).bodyHtml, /Race Days \(1\)/);

console.log('UXF9P_OWNER_CORRECTIONS_HARNESS PASS');
