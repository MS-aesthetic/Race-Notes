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
      { text: 'A team lets your crew share cars, setups, tires, weekends, and tasks automatically — no manual sharing.' },
      { text: 'Open the Team area and create a team with a name (your car number or team name works well).' },
      { text: 'Invite crew members. Once they accept, everything you log shows up for them and everything they log shows up for you.' },
      { lead: 'Driver / Team profile:', text: 'The team owner can fill in Car #, Division, Hometown, Age, Transponder ID, and a MyRacePass link. Members can view these.' },
    ],
    tip: 'Team data is shared instantly through the cloud, so whoever has the best signal can log the session.',
  },
  {
    id: 'car',
    icon: 'directions_car',
    title: 'Adding a car',
    summary: 'Every setup, tire, and shock graph belongs to a car — add your car first.',
    steps: [
      { text: 'Go to Settings → Garage.' },
      { text: 'Tap Add Car. Pick the car type (Dirt Late Model, A Mod, B Mod, or type your own), then enter the chassis, division, and an optional name.' },
      { text: 'Save. Your new car becomes the active car automatically.' },
      { lead: 'Switching cars:', text: 'If you run more than one car, tap a car in the Garage list to make it active. The car chip at the top of the screen shows which car is active.' },
      { text: 'Setups, tires, and shock graphs you add will belong to whichever car is active — so pick the right car before adding data.' },
    ],
    tip: 'A car can only be deleted once it has no setups, tires, or shock graphs attached to it.',
  },
  {
    id: 'setup',
    icon: 'tune',
    title: 'Creating a setup',
    summary: 'Record a full car setup sheet — four corners, bars, gear, and notes.',
    steps: [
      { text: 'Make sure the right car is active, then open the Setups tab.' },
      { text: 'Start a New Setup and give it a chassis name, track, and date.' },
      { text: 'Fill in each corner (LF, RF, LR, RR): spring, shock, tire, and measurements. Rear corners have extra fields for bars, droop, and preload.' },
      { lead: 'Tires:', text: 'Use the "Tire from Inventory" picker on each corner to pull a tire in — it auto-fills size, compound, and backspacing so you do not retype them.' },
      { text: 'Enter scale weights on all four corners and the app auto-calculates Nose %, Left %, Cross %, LR split, and total weight.' },
      { text: 'Add gear, J-bar, pull bar, stagger, notes, and photos as needed, then save.' },
    ],
    tip: 'Stagger is calculated for you from the tire sizes — no need to do the math.',
  },
  {
    id: 'weekend',
    icon: 'event',
    title: 'Creating a weekend',
    summary: 'A weekend is the event that holds all your sessions for that night.',
    steps: [
      { text: 'Open the Sessions tab and tap New Weekend.' },
      { text: 'Enter a name, the track, and the date.' },
      { text: 'Optionally bind a saved setup to the weekend so the whole crew knows what the car started on.' },
      { lead: 'Weather:', text: 'Tap the weather widget to pull current conditions by GPS, or type a zip code if GPS is blocked.' },
      { text: 'After creating the weekend, the app opens the New Session form so you can log your first run right away.' },
    ],
    tip: 'All your weekends stay in one list, newest on top — tap any weekend to expand its sessions.',
  },
  {
    id: 'session',
    icon: 'timer',
    title: 'Logging a session',
    summary: 'Log each run — laps, handling, tires, and adjustments.',
    steps: [
      { text: 'On the Sessions tab tap New Session (or it opens automatically after making a weekend).' },
      { text: 'Choose which weekend it belongs to, then the session type: Test, Hot Laps, Qualifying, Heat Race, or Feature. The app auto-numbers repeats (Test, Test 2, Test 3…).' },
      { text: 'Pick a time of day and, if you want, pull weather.' },
      { lead: 'Handling:', text: 'Mark the car as Tight, Neutral, or Loose at corner entry, center, and exit, with notes for each.' },
      { lead: 'Tires on the car:', text: 'Pick the tire on each corner from your inventory. Tap "Import from Setup" to fill all four from the bound setup at once.' },
      { text: 'Log lap times, adjustments, and photos, then it saves to the weekend.' },
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
      { text: 'Your tires now appear in every corner picker on setups and sessions, sorted by size, so the smallest-to-largest order is always the same.' },
    ],
    tip: 'Sort and filter the inventory list by newest, oldest, size, or compound to find a tire fast.',
  },
  {
    id: 'smasher',
    icon: 'show_chart',
    title: 'Adding spring smasher graphs',
    summary: 'Log shock dyno load data and photos of the graph.',
    steps: [
      { text: 'With the right car active, open the Setups tab and go into the Smasher / Shock Loads area.' },
      { text: 'Tap New Session. Pick the corner (LF, RF, LR, RR) and enter the spring rate and shock ID.' },
      { text: 'Add height/load data points — plain number fields, no fiddly steppers.' },
      { text: 'Attach a photo of the dyno graph if you have one; it is compressed automatically.' },
      { text: 'Save. You can later overlay multiple graphs to compare them.' },
    ],
    tip: 'Bind a smasher graph to a setup corner so the crew can see exactly which shock curve was run.',
  },
  {
    id: 'tasks',
    icon: 'checklist',
    title: 'Adding tasks',
    summary: 'Keep a shared to-do list so nothing gets forgotten in the pits.',
    steps: [
      { text: 'Open the Trackers tab and go to the Tasks (to-do) area.' },
      { text: 'Type what needs doing and add it to the list. Add a note if it needs detail.' },
      { text: 'Optionally link the task to a race weekend so it shows in that weekend’s context.' },
      { text: 'Check items off as they get done. Open tasks also show on the Dashboard so the whole crew sees what is left.' },
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
    id: 'shopping',
    icon: 'shopping_cart',
    title: 'Adding shopping',
    summary: 'Track parts and supplies you need to buy.',
    steps: [
      { text: 'Open the Trackers tab and switch to the Shopping sub-tab.' },
      { text: 'Add an item with a name, optional description, and estimated cost.' },
      { text: 'Optionally link the item to a race weekend so costs group by event.' },
      { text: 'Check items off as they are bought — the purchase date is recorded.' },
    ],
  },
];

const GuideAccordionItem: React.FC<{ section: GuideSection }> = ({ section }) => {
  const [open, setOpen] = useState(false);
  const panelId = `guide-panel-${section.id}`;
  const btnId = `guide-header-${section.id}`;
  return (
    <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
      <button
        id={btnId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left min-h-[56px] hover:bg-surface-container-high transition-colors"
      >
        <span
          className="material-symbols-outlined text-primary text-xl shrink-0"
          style={{ fontVariationSettings: open ? "'FILL' 1" : "'FILL' 0" }}
        >
          {section.icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-bold text-sm text-on-surface uppercase tracking-wide">{section.title}</span>
          {!open && <span className="block text-[11px] font-mono text-on-surface-variant/70 mt-0.5">{section.summary}</span>}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </button>

      {open && (
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

export default function GuideView() {
  return (
    <div className="flex flex-col gap-3 pb-8">
      <div className="bg-surface-container border border-outline-variant rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
          <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">How to use CREW CHIEF</h3>
        </div>
        <p className="text-[11px] text-on-surface-variant font-mono">Tap any topic to expand step-by-step instructions.</p>
      </div>

      {SECTIONS.map(section => (
        <GuideAccordionItem key={section.id} section={section} />
      ))}
    </div>
  );
}
