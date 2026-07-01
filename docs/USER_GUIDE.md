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
Every setup, tire, and shock graph is scoped to the **active car**.

- Settings → Garage → **Add Car**.
- Pick car type (Dirt Late Model / A Mod / B Mod / custom), enter chassis, division, optional name. Save → becomes active car.
- Switch cars by tapping one in the Garage list; the header car chip shows the active car.
- A car can only be deleted when it owns no setups, tires, or shock graphs.

## Creating a setup
- Ensure the right car is active → **Setups** tab → New Setup (chassis, track, date).
- Fill each corner (LF/RF/LR/RR): spring, shock, tire, measurements. Rear has bars, droop, preload.
- Use the **Tire from Inventory** picker per corner — auto-fills size, compound, backspacing. (Pickers are sorted by size.)
- Enter all four scale weights → app auto-calculates Nose %, Left %, Cross %, LR split, total.
- Stagger is auto-calculated from tire sizes.

## Creating a weekend
A weekend is the event container holding sessions.

- **Sessions** tab → New Weekend (name, track, date).
- Optionally bind a saved setup.
- Weather widget: GPS or zip-code fallback.
- After creating, the New Session form opens automatically.

## Logging a session
- Sessions tab → New Session (or auto-opened after making a weekend).
- Choose weekend + type (Test / Hot Laps / Qualifying / Heat Race / Feature). Repeats auto-number.
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

## Adding spring smasher graphs
- Right car active → Setups tab → Smasher / Shock Loads → New Session.
- Pick corner, enter spring rate + shock ID.
- Add height/load data points (plain number fields).
- Attach a dyno graph photo (auto-compressed).
- Overlay multiple graphs to compare. Bind a graph to a setup corner.

## Adding tasks
- **Trackers** tab → Tasks (to-do) area.
- Add a task, optional note, optional link to a weekend.
- Check off when done. Open tasks also surface on the Dashboard.

## Assigning tasks
- Requires a team.
- Assign a task to a crew member; their name is saved with it.
- Assigned tasks are highlighted for the assignee ("assigned to me" on Dashboard).
- Without a team, tasks still work but are not assigned to a person.

## Adding shopping
- **Trackers** tab → Shopping sub-tab.
- Add item with name, optional description, estimated cost, optional weekend link.
- Check off when bought (purchase date recorded).
