# CREW CHIEF — User Guide

> Plain-language, task-by-task guide to using CREW CHIEF at the track.
> This is the canonical source for the in-app **Settings → Guide** tab
> (`src/components/GuideView.tsx`). When an app flow changes, update BOTH this
> file and `GuideView.tsx` so they stay in sync.

The in-app guide lives under **Settings → Guide** (a sub-tab, not a dashboard
tab) and shows each topic below as a collapsible header.

---

## Requiring an account
Sign-in is mandatory before any tab renders (`isUnlocked` gate in `App.tsx`).

- On first open you must sign in before anything loads.
- Email & password: enter email + password → **Sign Up** (new) or **Sign In**.
- Google: tap **Continue with Google** (web + native OAuth).
- After logging in once on a device, the app works **offline** on that device — data still saves to localStorage with no signal.
- Only **Sign Out** (Settings → Account) locks the app again.
- Tip: sign in with the same account on phone + tablet to share data across devices.

## Creating a team
A team shares cars, setups, tires, weekends, and tasks automatically via Supabase RLS (`in_same_team()`).

- Create a team with a name (car number / team name).
- Invite crew members; once accepted, all data is shared both ways.
- Team owner can fill a Driver/Team profile: Car #, Division, Hometown, Age, Transponder ID, MyRacePass URL. Members view read-only.

## Adding a car
Every setup, tire, and load graph is scoped to the **active car**.

- Settings → Garage → **Add Car**.
- Pick car type (Dirt Late Model / A Mod / B Mod / custom), enter chassis, division, optional name. Save → becomes active car.
- Switch cars by tapping one in the Garage list; the header car chip shows the active car.
- A car can only be deleted when it owns no setups, tires, or load graphs.

## Creating a setup
- Ensure the right car is active → **Setups** tab → New Setup (chassis, track, date).
- Fill each corner (LF/RF/LR/RR): spring, shock, tire, measurements. Rear has bars, droop, preload.
- Use the **Tire from Inventory** picker per corner — auto-fills size, compound, backspacing. (Pickers are sorted by size.)
- Enter all four scale weights → app auto-calculates Nose %, Left %, Cross %, LR split, total.
- Stagger is auto-calculated from tire sizes.
- Record the setup that is physically on the active car so later changes and comparisons have the right starting point.

## Recording four-bar measurements
- Open a setup and find **Four-Bar** at the bottom of the setup sheet.
- For LR and RR top and bottom bars, record Frame Hole, Bar Length, and Birdcage Hole.
- Record each bar angle at Ride Height and Full Droop using the same measuring method every time.
- Four-bar measurements save with the setup and appear in setup comparisons.

## Creating a weekend
A weekend is the event container holding sessions.

- **Dashboard** → **+ Race Weekend** (name, track, date).
- Optionally bind a saved setup.
- Crew Chief keeps that Starting Setup unchanged and records weekend changes in the Live-Trackside Setup.
- Weather widget: GPS or zip-code fallback.
- Creating makes the weekend active but does not open or create a session.
- Active-weekend choice is device-local. Use Dashboard or Sessions weekend list to switch it.
- **Finish Weekend** saves a Raced Setup when a Feature was logged, or a Finished Setup for a test day, then creates the editable Current Setup.

## Logging a session
- Create and activate a weekend first, then Sessions → New Session.
- Sessions always belong to the active weekend. Choose type (Test / Hot Laps / Qualifying / Heat Race / Feature); repeats auto-number.
- Handling: Tight / Neutral / Loose at entry, center, exit, with notes.
- Pick the tire on each corner from inventory; **Import from Setup** fills all four at once.
- Log lap times, adjustments, photos.

## Adding tires
- Right car active → Setups tab → Tire Inventory → **Add Tire**.
- Size accepts decimals (`86.5`) or fractions (`86 1/2`) — both parse and sort correctly (`src/lib/tireSize.ts`).
- Compound: tap a chip for a previously-used compound, or type a new one.
- Set backspacing, durometer, air pressure.
- Tires appear in every corner picker, **sorted by size**.
- Inventory list sorts/filters by newest, oldest, size, or compound.

## Adding load sessions
- Right car active → Setups tab → Load Graphs → New Load Session.
- Pick corner, enter spring rate + shock ID, and optionally record Ride Height C-to-C.
- Add measured height/load points. The chart derives travel from height: compression plots upward, increasing load plots to the right, and raw measured height remains available.
- Attach a dyno graph photo (auto-compressed).
- Overlay multiple graphs to compare. Bind a graph to a setup corner.
- Ride Height C-to-C and the setup-corner binding keep later comparisons tied to how the car was run.

## Comparing setups
- **Setups** → **Compare Setups**.
- **Before** is the older or starting setup. **After** is the setup being compared against it.
- Highlighted rows changed; unchanged rows stay out of the way.
- The comparison reports the difference. It does not rate the change as better or worse.

## Using Main Checklist
- **Trackers** → **Checklist** always opens one Main Checklist.
- Add an item manually, with optional note and assignee.
- Or select a template and tap **Import**; imported items are fresh unchecked copies.
- Main Checklist is global, not linked to a weekend.
- Open items also surface on Dashboard.

## Assigning tasks
- Requires a team.
- Assign a task to a crew member; their name is saved with it.
- Assigned tasks are highlighted for the assignee ("assigned to me" on Dashboard).
- Without a team, tasks still work but are not assigned to a person.

## Creating templates
- **Trackers** → **Checklist** → **Edit List**.
- Create a template and add reusable preparation items.
- Import it from Trackers → Checklist whenever needed.
- Template edits never change items already imported into Main Checklist.

## Logging maintenance
- **Trackers** → **Maintenance Logs**.
- Add car or rig components with lap/session/race/day intervals.
- Log maintenance, replacement, or inspection work.
- Optional maintenance cost creates an Accounting expense.
- At 90% of its configured limit, an unfinished maintenance job is added to Main Checklist automatically. Servicing the item clears the unfinished automatic job once usage drops below that point.
