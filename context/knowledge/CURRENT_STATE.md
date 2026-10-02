# Current State — verified fact sheet

**Verified:** 2026-10-02 against code, git remotes, live Supabase, and Netlify.
**Precedence:** where this file disagrees with an older handoff, plan, or `CODEBASE_KNOWLEDGE.md`
section, this file wins for *facts*. Owner directives in `AGENTS.md` (communication, model routing,
deploy rules) are unchanged and still govern *process*.

---

## 1. Branches — two product directions

| Branch | What it is | Status |
| --- | --- | --- |
| `master` | Release **5.2.1** (versionCode 24), live on Google Play. "Full-featured" direction. | Tip `13343e5` (2026-07-25). Untouched by the simplify sprint. |
| `feature/ui-simplification` | Master + 11 commits (Chunks A–I + 2 docs). "Simplified" direction. | Tip `af24f98`. Owner device QA open. **Do not merge to master without explicit owner decision.** |
| `ccr-*` | Claude Code cloud session branches. Branch from one of the two above. | Working branches only. |

- `codex/ux-overhaul`, `preview-v3`, `preview-v2`, `preview` no longer exist on the remote. All v2 work
  is in `master` (`ab2d031`, `22dc112`, `7c20da0`, then releases 5.2.0 `9c964d1` and 5.2.1 `e4b980b`).
- Windows paths in older docs (`C:\Users\maxx\.codex\worktrees\203f\...`) describe the owner's
  machine only. Cloud sessions clone to `/home/user/Race-Notes`.
- Spec for the simplify branch: [`plan-ui-simplification.md`](../../plan-ui-simplification.md).

### What the simplified branch changes (user-visible)

| Chunk | Commit | Change |
| --- | --- | --- |
| A | `863d538` | All "Saved" / "Offline — saved on device" / "Syncing…" / "Synced" pills removed. `savedFlash`, `markSavedDirty` and friends deleted. |
| B | `6672cfd` | Runs editor loses Tires & Pressures, Import from Setup, adjustments log, Four-bar quick-adjust. `QuickAdjustPanel.tsx` deleted. |
| C | `5d2e9ca` | Floating SAVE RUN bar replaced by inline **NEXT SESSION** button: persists, collapses editor, opens new-session form. |
| D | `ffd0b77` | "Pending — will bind to next session" setup diff removed from Setups. |
| E | `64862ec` | Sync warning pills ("Sync failed — will retry", deferred-delete retry) removed. **Sync failures are now silent.** Header offline chip stays. |
| F | `bffed85` | Historical run cards drop bound-setup diff and adjustments list; `LegacySetupLog` removed. PDF prints "Setup Changes" only if present. |
| G | `560fcd3` | Lifecycle read-only notice, "Log setup changes", and per-run WEATHER input removed. Weekend weather widget stays. |
| H | `24203c6` | Weekend banner collapsed by default (component state, resets each load). |
| I | `af24f98` | Setup lifecycle removed: no baseline/weekend/final clones, no locks or view-only. Weekend binds `setupId` directly; finish only sets `status`/`finishedAt`. Setup is editable in Edit Race Day. |

**Data impact:** no schema change, no `types.ts` deletions, `sync.ts` untouched. Removed UI simply
stops writing `session.tires/pressures/adjustments`, `activeSetupId`, `baselineSetupId`,
`finalSetupId`. Weekends created on master point `setupId` at the locked baseline clone; owner
accepted this (data to be wiped).

**Dead code left on the simplified branch** (cleanup deferred until a direction is chosen):
`setupLifecycle.ts` lifecycle functions, most of `quickAdjust.ts` (only `isQuickAdjustRunAvailable`,
`applyExplicitCornerField` live), `setupSteps.mergeImportedSetupPressure`, `syncStatusRef` /
`infoToastRef` write-only refs, unreachable `fourBarVisible` branch in `helpRouting.ts`.

**Known issue (recorded, not fixed):** setups appear to revert on next session — likely the
lifecycle snapshot machinery. See plan "Known issue" section before touching setup tracking.

---

## 2. Verification baseline

| Check | `master` | `feature/ui-simplification` |
| --- | --- | --- |
| `npm run lint` | 3 known errors | Same 3 (RaceWeekendView `File` arg, SetupView `key` on CornerForm, SmasherLoadsView `File` arg) |
| `npm run build` | Needs Supabase env | Needs Supabase env |
| Harnesses (Linux, `npx tsx`) | 21/24 pass | 14/24 pass |

Harnesses failing on **both** branches under Linux: `muted-text-color`, `saved-flash`,
`setup-touch-target` (owner's Windows runs reported 24/24 on master; treat these as
environment/stale until re-proved). Failing **only** on the simplified branch, because they
assert removed UI: `car-delete-undo`, `chunk5-setup`, `chunk5-tires`, `chunk7-quick-adjust`,
`chunk9-export-help`, `confirm-sheet`, `offline-indicator`. Run them all with
`node scripts/run-harnesses.mjs`.

---

## 3. Build & environment

- **Build guard:** `scripts/viteRequireCloudConfig.ts` aborts `vite build` when
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing or placeholders. Release 5.2.0 shipped
  without cloud config; 5.2.1 added the guard. `ALLOW_UNCONFIGURED_BUILD=1` opts out — compile
  checks only, never deploy that bundle.
- **Env file:** `.env.local` (gitignored). URL `https://swblfeayxoprodhwxqak.supabase.co`; anon key
  from the Supabase connector (`get_publishable_keys`, legacy `anon`). The anon key is a public
  client key, but still never commit it.
- Optional env: `VITE_FIREBASE_CONFIG_JSON`, `VITE_FIREBASE_VAPID_KEY`, `VITE_HERE_API_KEY`.
- Versions: `package.json` 5.2.1; Gradle `versionCode 24` / `versionName "5.2.1"`;
  appId `nimbus.engineering.crewchief`. Vite 6, TypeScript 5.8, Capacitor 8.
- Native deep link: `nimbus.engineering.crewchief://auth-callback` is primary;
  `com.racenotes.app://` kept as legacy.
- Android builds need Windows (`gradlew` with `.\\` paths, keystore). Not possible in cloud sessions.

## 4. Deploy

- Netlify site **`crew-chief-race-notes`** (id `412f62d3-aebc-452c-b526-ac0aac3867b6`), primary URL
  `https://crew-chief-race-notes.netlify.app`. Not Git-connected. Preview/draft by default;
  production only on explicit owner instruction.
- Other sites on the team (`race-notes`, `extraordinary-sunshine-a44035`) are **not** this app.

## 5. Supabase (live project `swblfeayxoprodhwxqak`, us-west-2, Postgres 17)

- Repo has 24 migration files. `001`–`008` predate tracked history. 16 are recorded live.
- **`20260715180000_team_data_owner_write_policies.sql` is NOT applied live.** Verified
  2026-10-02: zero `Canonical team-*` policies and no `private.can_write_canonical_team_owner`
  function exist. Applying it is an owner decision (changes team write RLS).
- Security advisor (2026-10-02), all WARN: six `SECURITY DEFINER` functions executable by
  `anon`/`authenticated` (`create_team`, `handle_new_user`, `in_same_team`, `is_team_member`,
  `is_team_owner`, `user_can_view_team`), same six with mutable `search_path`, `pg_trgm` in
  `public`, leaked-password protection off.

## 6. Code facts that older docs get wrong

- Tabs: `dashboard | setups | raceweekend | quickref | settings | trackers`.
  - Trackers sub-tabs: Checklist, Maintenance Logs (id `service`), Accounting. `templates` id
    exists but redirects to Checklist. Shopping is retired.
  - Settings sub-tabs: Garage, Account, Appearance, Export, Guide.
  - Setups sub-tabs: Setups, Smasher Loads, Tires.
- `TeamView` is rendered by `AuthView`; `ToDoView` by `TrackersView`. Neither is orphaned.
- `src/lib/` has 38 files. Unimported: `weather.ts`, `location.ts`, `geo/here.ts` (+ `flexpolyline`).
- 27 `race_notes_*` localStorage keys. Beyond the AGENTS.md table: `accounting_draft`,
  `checklist_templates`, `weekend_checklists`, `maintenance`, `maintenance_logs`,
  `checklist_completed_open`, `dash_service_open`, `device_id`, `keep_added_items`,
  `location_optin`, `onboarding_dismissed`, `pending_personal_tire_deletes_v*`,
  `pending_team_deletes_v*`.
- `sync.ts` pushes/pulls setups, weekends, active session, tires, cars, shock sessions, todos,
  maintenance components/logs, checklist templates, weekend checklists, trips, attachments, plus
  `deleteTeamSharedRecordFromCloud`. Merge is newest `updated_at` wins (not "cloud always wins").
