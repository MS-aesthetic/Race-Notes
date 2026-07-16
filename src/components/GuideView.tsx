import React, { useState } from 'react';

/**
 * GuideView — in-app "How to use CREW CHIEF" help.
 *
 * Rendered as the "Guide" sub-tab inside SettingsView. Each topic is a
 * collapsible header (accordion) so a crew member can jump straight to the
 * one thing they need. Written in plain language for pit-side use.
 *
 * NOTE: The step content here is also the canonical user-facing description
 * of each flow — keep it in sync with the app and with USER_GUIDE.md when
 * flows change.
 */

interface GuideStep {
  /** Optional bold lead-in shown before the step text. */
  lead?: string;
  text: string;
}

interface GuideSection {
  id: string;
  icon: string; // Material Symbols name
  title: string;
  summary: string;
  steps: GuideStep[];
  tip?: string;
}

const SECTIONS: GuideSection[] = [
  {
    id: 'account',
    icon: 'person',
    title: 'Requiring an account',
    summary: 'Sign in so your data is saved and shared with your team.',
    steps: [
      { text: 'When you open CREW CHIEF the first time, you must sign in before anything else loads.' },
      { lead: 'Email & password:', text: 'Enter your email and a password, then tap Sign Up to create an account, or Sign In if you already have one.' },
      { lead: 'Google:', text: 'Or tap Continue with Google to use your Google account — no password to remember.' },
      { text: 'Once you have logged in on a device, the app keeps working offline on that device. Everything you enter still saves locally even with no signal at the track.' },
      { text: 'Only tapping Sign Out (in Settings → Account) will lock the app again.' },
    ],
    tip: 'Sign in with the same account on your phone and tablet to see the same data on both.',
  },
  {
    id: 'team',
    icon: 'groups',
    title: 'Creating a team',
    summary: 'Put your crew on one shared account so everyone sees the same info.',
    steps: [
      { text: 'A team lets your crew share cars, setups, tires, Race Days, and tasks automatically — no manual sharing.' },
      { text: 'Open the Team area and create a team with a name (your car number or team name works well).' },
      { text: 'Invite crew members. Once they accept, everything you log shows up for them and everything they log shows up for you.' },
      { lead: 'Driver / Team profile:', text: 'The team owner can fill in Car #, Division, Hometown, Age, Transponder ID, and a MyRacePass link. Members can view these.' },
    ],
    tip: 'Team data is shared through the cloud, so whoever has the best signal can log the run.',
  },
  {
    id: 'car',
    icon: 'directions_car',
    title: 'Adding a car',
    summary: 'Every setup, tire, and load graph belongs to a car — add your car first.',
    steps: [
      { text: 'Go to Settings → Garage.' },
      { text: 'Tap Add Car. Pick the car type (Dirt Late Model, A Mod, B Mod, or type your own), then enter the chassis, division, and an optional name.' },
      { text: 'Save. Your new car becomes the active car automatically.' },
      { lead: 'Switching cars:', text: 'If you run more than one car, tap a car in the Garage list to make it active. The car chip at the top of the screen shows which car is active.' },
      { text: 'Setups, tires, and load graphs you add will belong to whichever car is active — so pick the right car before adding data.' },
    ],
    tip: 'A car can only be deleted once it has no setups, tires, or load graphs attached to it.',
  },
  {
    id: 'setup',
    icon: 'tune',
    title: 'Creating a setup',
    summary: 'Record a full car setup sheet — four corners, bars, gear, and notes.',
    steps: [
      { text: 'Select the correct car, then open the Setups tab.' },
      { text: 'Start a New Setup and enter the chassis, track, and date. Record the setup that is physically on the active car.' },
      { text: 'Fill in each corner (LF, RF, LR, RR): spring, shock, tire, and measurements. Rear corners have extra fields for bars, droop, and preload.' },
      { lead: 'Tires:', text: 'Use the "Tire from Inventory" picker on each corner to pull a tire in — it auto-fills size, compound, and backspacing so you do not retype them.' },
      { text: 'Enter scale weights on all four corners and the app auto-calculates Nose %, Left %, Cross %, LR split, and total weight.' },
      { text: 'Add gear, J-bar, pull bar, stagger, notes, and photos as needed, then save.' },
    ],
    tip: 'Stagger calculates from the saved tire sizes.',
  },
  {
    id: 'four-bar',
    icon: 'conversion_path',
    title: 'Recording four-bar measurements',
    summary: 'Keep both rear top and bottom bar locations with the setup.',
    steps: [
      { text: 'Open a setup and find Four-Bar at the bottom of the setup sheet.' },
      { text: 'For LR and RR top and bottom bars, record Frame Hole, Bar Length, and Birdcage Hole.' },
      { text: 'Record each bar angle at Ride Height and at Full Droop using the same measuring method every time.' },
      { text: 'Save the setup. Four-bar measurements stay with that setup and appear in setup comparisons.' },
    ],
  },
  {
    id: 'weekend',
    icon: 'event',
    title: 'Creating a Race Day',
    summary: 'A Race Day holds every run from that race night or test day.',
    steps: [
      { text: 'Open the Dashboard and tap + Race Day.' },
      { text: 'Enter a name, the track, and the date.' },
      { text: 'Optionally bind a saved setup to the Race Day so the whole crew knows what the car started on.' },
      { text: 'Crew Chief saves that as the Starting Setup and uses a Live-Trackside Setup for changes during the Race Day.' },
      { lead: 'Weather:', text: 'Tap the weather widget to pull current conditions by GPS, or type a zip code if GPS is blocked.' },
      { text: 'Creating the Race Day makes it active but does not start a run. Add notes and weather whenever you are ready.' },
      { text: 'Finish Race Day saves a Raced Setup after a Feature, or a Finished Setup for a test day, then makes an editable Current Setup.' },
    ],
    tip: 'All Race Days stay in one list, newest on top — tap one to see its runs.',
  },
  {
    id: 'session',
    icon: 'timer',
    title: 'Logging a run',
    summary: 'Log each run — laps, handling, tires, and adjustments.',
    steps: [
      { text: 'Create and activate a Race Day first. The Dashboard and Sessions list show which Race Day is active.' },
      { text: 'On the Sessions tab tap Log Run, then choose Test, Hot Laps, Qualifying, Heat Race, or Feature. The run always belongs to the active Race Day.' },
      { text: 'Pick a time of day and, if you want, pull weather.' },
      { lead: 'Handling:', text: 'Mark the car as Tight, Neutral, or Loose at corner entry, center, and exit, with notes for each.' },
      { lead: 'Tires on the car:', text: 'Pick the tire on each corner from your inventory. Tap "Import from Setup" to fill all four from the bound setup at once.' },
      { text: 'Log lap times, adjustments, and photos, then it saves to the Race Day.' },
    ],
  },
  {
    id: 'tires',
    icon: 'tire_repair',
    title: 'Adding tires',
    summary: 'Build a tire inventory once, then pick from it everywhere.',
    steps: [
      { text: 'With the right car active, open the Setups tab and find the Tire Inventory section. Tap Add Tire.' },
      { text: 'Enter the tire number and size. Size can be a decimal (86.5) or a fraction (86 1/2) — both work.' },
      { lead: 'Compound:', text: 'Tap one of the compound chips for a compound you have used before, or type a new one. You do not have to retype compounds you already use.' },
      { text: 'Set wheel backspacing, durometer, and air pressure, then save.' },
      { text: 'Your tires appear in every setup and run corner picker, sorted from smallest to largest.' },
    ],
    tip: 'Sort and filter the inventory list by newest, oldest, size, or compound to find a tire fast.',
  },
  {
    id: 'loads',
    icon: 'show_chart',
    title: 'Adding load sessions',
    summary: 'Log height and load data, plus photos of the graph.',
    steps: [
      { text: 'With the right car active, open Setups and then Load Graphs.' },
      { text: 'Tap New Load Session. Pick the corner, enter spring rate and shock ID, and optionally record Ride Height C-to-C.' },
      { text: 'Add measured height and load points. The chart derives travel from height: compression plots upward, increasing load plots to the right, and measured height stays available at each point.' },
      { text: 'Attach a photo of the dyno graph if you have one; it is compressed automatically.' },
      { text: 'Save. You can later overlay multiple graphs to compare them.' },
    ],
    tip: 'Record Ride Height C-to-C when available and bind the session to a setup corner so later comparisons match the car as it was run.',
  },
  {
    id: 'setup-diff',
    icon: 'difference',
    title: 'Comparing setups',
    summary: 'See exactly what changed between two saved setups.',
    steps: [
      { text: 'Open Setups and choose Compare Setups.' },
      { text: 'Before is the older or starting setup. After is the setup you want to compare against it.' },
      { text: 'Highlighted rows changed. Unchanged rows stay out of the way.' },
      { text: 'The comparison reports the difference; it does not rate the change as better or worse.' },
    ],
  },
  {
    id: 'checklist',
    icon: 'checklist',
    title: 'Using Main Checklist',
    summary: 'Keep one shared active checklist so nothing gets forgotten.',
    steps: [
      { text: 'Open Trackers → Checklist.' },
      { text: 'Type what needs doing and add it to the list. Add a note if it needs detail.' },
      { text: 'To add a reusable group, select a saved list and tap Import. Imported jobs start unchecked.' },
      { text: 'Check jobs off as they get done. Open Main Checklist jobs also show on Dashboard.' },
    ],
  },
  {
    id: 'assign',
    icon: 'assignment_ind',
    title: 'Assigning tasks',
    summary: 'Hand a task to a specific crew member.',
    steps: [
      { text: 'You need to be on a team for assignment (see "Creating a team").' },
      { text: 'On a task, choose the crew member to assign it to. Their name is saved with the task.' },
      { text: 'Assigned tasks are highlighted for the person they belong to, including an "assigned to me" callout on the Dashboard.' },
    ],
    tip: 'No team yet? You can still keep tasks — they just will not be assigned to a person.',
  },
  {
    id: 'templates',
    icon: 'fact_check',
    title: 'Creating templates',
    summary: 'Build reusable checklist groups for repeated preparation work.',
    steps: [
      { text: 'Open Trackers → Checklist → Edit List.' },
      { text: 'Create a saved list, choose a category, then add reusable jobs.' },
      { text: 'Return to Checklist, choose the template, and tap Import.' },
      { text: 'Saved-list edits apply to Main Checklist jobs at the next Race Day reset.' },
    ],
  },
  {
    id: 'service',
    icon: 'build',
    title: 'Using Maintenance Logs',
    summary: 'Track car and rig maintenance limits and completed work.',
    steps: [
      { text: 'Open Trackers → Maintenance Logs.' },
      { text: 'Add defaults or create a component with its interval.' },
      { text: 'Log maintenance, replacement, or inspection work when completed.' },
      { text: 'An optional maintenance cost automatically creates an Accounting expense.' },
      { text: 'At 90% of its configured limit, an unfinished maintenance job is added to Main Checklist automatically. Servicing the item clears the unfinished automatic job once usage drops below that point.' },
    ],
  },
];

const GuideAccordionItem: React.FC<{ section: GuideSection; active: boolean }> = ({ section, active }) => {
  const [open, setOpen] = useState(false);
  const shownOpen = active || open;
  const panelId = `guide-panel-${section.id}`;
  const btnId = `guide-header-${section.id}`;
  return (
    <div data-help-anchor={section.id} className="scroll-mt-3 bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
      <button
        id={btnId}
        type="button"
        aria-expanded={shownOpen}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left min-h-[56px] hover:bg-surface-container-high transition-colors"
      >
        <span
          className="material-symbols-outlined text-primary text-xl shrink-0"
          style={{ fontVariationSettings: shownOpen ? "'FILL' 1" : "'FILL' 0" }}
        >
          {section.icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-bold text-sm text-on-surface uppercase tracking-wide">{section.title}</span>
          {!shownOpen && <span className="block text-[11px] font-mono text-on-surface-muted mt-0.5">{section.summary}</span>}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0 transition-transform" style={{ transform: shownOpen ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </button>

      {shownOpen && (
        <div id={panelId} role="region" aria-labelledby={btnId} className="px-4 pb-4 pt-1 space-y-3 border-t border-outline-variant/40">
          <ol className="space-y-2.5">
            {section.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary/15 text-primary font-mono text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-[13px] leading-relaxed text-on-surface">
                  {step.lead && <span className="font-bold text-on-surface">{step.lead} </span>}
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
          {section.tip && (
            <div className="flex gap-2 items-start bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
              <span className="material-symbols-outlined text-primary text-base shrink-0">lightbulb</span>
              <p className="text-[12px] leading-relaxed text-on-surface-variant">{section.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface GuideViewProps {
  activeSection?: string;
  embedded?: boolean;
}

export default function GuideView({ activeSection, embedded = false }: GuideViewProps) {
  return (
    <div className="flex flex-col gap-3 pb-8">
      {!embedded && <div className="bg-surface-container border border-outline-variant rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
          <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">How to use CREW CHIEF</h3>
        </div>
        <p className="text-[11px] text-on-surface-variant font-mono">Tap any topic to expand step-by-step instructions.</p>
      </div>}

      {SECTIONS.map(section => (
        <GuideAccordionItem key={section.id} section={section} active={section.id === activeSection} />
      ))}
    </div>
  );
}
