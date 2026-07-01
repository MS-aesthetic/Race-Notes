# AGENTS.md — Race Notes / Crew Chief

AI coding agent guide for the **Race Notes** PWA — a professional motorsport logbook and pit-side crew-chief tool for dirt-track racing.

> **📋 Active feature roadmap:** [`plan.md`](./plan.md) — read this FIRST before starting any feature work. It defines 13 workstreams (WS-A through WS-M), their execution order, dependencies, and the shared data-model foundation that must land first.
>
> **📚 Full reference:** [`CODEBASE_KNOWLEDGE.md`](./CODEBASE_KNOWLEDGE.md) — comprehensive technical reference (types, tables, localStorage keys, component details, gotchas, session history).

---

## Branch & Deploy Workflow (READ FIRST)

> **BRANCH RULE — all feature work on `preview`.** Never commit feature work directly to `master`. Create `preview` from `master` if it doesn't exist:
> ```bash
> git checkout -b preview master   # only if preview doesn't exist yet
> ```
>
> ```bash
> git checkout preview
> # ...make changes...
> git push origin preview
> ```
>
> **DEPLOY RULE — default to PREVIEW.** Always deploy to a Netlify **preview/draft**
> (`netlify deploy --dir=dist`). Only run a **production** deploy
> (`netlify deploy --prod --dir=dist`) when Maxx **explicitly** says "push to
> production" (or similar). When in doubt, preview.
>
> - The Netlify site is **NOT connected to Git continuous deployment** (`repo_url`
>   is empty). Therefore `git push` **never** deploys anything — every deploy is a
>   manual Netlify CLI step run from Windows PowerShell.
> - Pushing to GitHub and deploying to Netlify are **two separate actions**. Do both
>   only when asked; otherwise a GitHub push does not change the live site.
> - Production publishes require account credits (paid plan). Preview/draft deploys
>   are the normal iteration loop.
> - **NEVER merge `preview` → `master`** unless Maxx **explicitly** says "merge to
>   master" / "push to production".

---

## Architecture

**No router.** Navigation is entirely tab-based: `activeTab` state in `src/App.tsx` conditionally renders one of six view components — `'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'trackers'` (verified 2026-07-01). There is **no `'todos'` tab and no `'team'` tab** — todos live inside `TrackersView`'s Todos sub-tab (alongside Accounting/Shopping), and `TeamView.tsx`/`ToDoView.tsx` exist as files but are unwired/orphaned (not imported by `App.tsx`). To add a new tab: add the tab key to the `activeTab` union type, add a `<button>` in the bottom `<nav>`, and add a conditional render in `<main>`.

**Mandatory login gate (added 2026-07).** The app requires sign-in before any tab renders. `isUnlocked = !!user || hasLocalAcct` in `App.tsx` gates the entire UI behind `<AuthView />`. `hasLocalAccount()`/`rememberLocalAccount()` in `src/lib/supabase.ts` maintain a `race_notes_registered_user` localStorage flag independent of live Supabase session validity, so the app stays usable **offline** on a device that has logged in before — only explicit sign-out clears the flag. Google OAuth (web + native, via `signInWithGoogle()`) is available alongside email/password.

**State lives in `App.tsx` only.** All domain state (`setup`, `savedSetups`, `weekends`, `activeSession`, `todos`) is declared at the top level and passed as props. Views never own persistent state — they receive data + callback props. Do not introduce `useContext` or external stores without a strong reason.

**Dual-write pattern everywhere.** Every state mutation must update both React state AND `localStorage` in the same handler. Cloud sync (Supabase) is a third, optional step only when `user` is truthy:
```ts
setSavedSetups(updated);
localStorage.setItem('race_notes_saved_setups', JSON.stringify(updated));
if (user) pushSetups(updated, user.id, setSyncStatus);
```

**"Saved" flash toast (added 2026-07, session 10).** A guarded effect in `App.tsx` watches the core datasets (`setup, savedSetups, weekends, activeSession, tireInventory, cars, shockSessions, todos, accounting, shopping`) and shows a prominent bottom-center "Saved" toast on any change — covering every save path, online or offline, without wiring each handler. Guards: `flashReadyRef` (skips initial hydration, ~800ms) and `suppressPullRef` (silences cloud-pull-driven state updates).

---

## Definition of Done (every feature / fix)

Before marking any workstream complete, verify ALL of the following:

1. **`npm run lint`** (`tsc --noEmit`) introduces **zero new** type errors. Baseline has **3 known pre-existing** errors (two `File`-typed upload args in `RaceWeekendView`/`SmasherLoadsView`, one `key`-on-`CornerForm`) — do not add more on top.
2. **`npm run build`** succeeds on Windows.
3. **Deployed to a Netlify preview URL** and visually verified (hard-refresh / incognito to beat the PWA service-worker cache).
4. **Works offline** (local-first dual-write) and, when logged in, syncs to Supabase.
5. **Respects light and dark themes** and the font-scale zoom (standard/large/xlarge).
6. **Car scoping intact** — setups, tires, shock sessions scoped via `byActiveCar()`; weekends, todos, accounting, shopping are global.
7. **No data loss** — dual-write everywhere; deletions call `delete*FromCloud(id)` in addition to the upsert push.
8. **Existing data migrates** with sane defaults (new optional fields default to empty/null).

---

## Workstream Coordination (from `plan.md`)

`src/App.tsx` and `src/types.ts` are **hot shared files** that most workstreams touch. To avoid conflicts:

- **Do WS-A (Data Model & Migrations Foundation) FIRST** — it adds all new fields/types and empty Supabase columns so downstream agents don't fight over `types.ts`.
- When two agents must edit `App.tsx`, edit **different regions** and keep diffs small.
- Prefer extracting new logic into new files (`src/lib/*`, `src/components/*`) and wiring with minimal lines in `App.tsx`.

### Suggested execution order
```
WS-A  Data model + migrations  ──►  WS-C Tire lifecycle
                               ├──►  WS-B Setup diff
                               ├──►  WS-F Task↔weekend
                               └──►  WS-G Exports (depends on C, E, F data)
WS-D  Carry-over setup            (parallel; light App.tsx touch)
WS-E  Weather history/forecast    (parallel; App.tsx weekend-create region)
WS-H  Settings default+bigger menu(parallel; SettingsView only)
WS-I  Font default 1.15           (parallel; tiny)
WS-J  Reference overhaul          (parallel; QuickReferenceView only)
WS-K  Light mode fixes            (parallel; index.css only)
WS-L  Session track-condition     (parallel; App.tsx session-form region)
WS-M  Dashboard nav fixes         (parallel; DashboardView + small App.tsx)
```
Low-conflict quick wins (H, I, J, K, M) can start immediately — see [`plan.md`](./plan.md) for full details on each.

---

## Key Files

| File | Purpose |
|---|---|
| `plan.md` | **Active feature roadmap** — 13 workstreams, execution order, dependencies, definition of done. Read FIRST. |
| `CODEBASE_KNOWLEDGE.md` | Comprehensive technical reference — types, tables, localStorage keys, component details, gotchas, all session history. |
| `src/types.ts` | All TypeScript interfaces — start here to understand domain models |
| `src/data.ts` | `INITIAL_SETUP`, `INITIAL_SETUPS`, `INITIAL_WEEKENDS`, `INITIAL_ACTIVE_SESSION` defaults |
| `src/App.tsx` | Global state, all mutation handlers, tab routing, new-weekend/session modals, header (`?` help button), Saved toast |
| `src/lib/supabase.ts` | Supabase client singleton + auth helpers (`signIn`, `signUp`, `fetchProfile`, `getUserTeam`, `signInWithGoogle`, `hasLocalAccount`/`rememberLocalAccount`) |
| `src/lib/sync.ts` | Push/pull functions — `pushSetups`, `pushWeekends`, `pushTodos`, `pullAllData` |
| `src/lib/tireHistory.ts` | Derives tire usage history from weekend/session data; CSV + printable report export |
| `src/lib/tireSize.ts` | `parseTireSize` / `compareTireSize` / `sortBySize` — parses decimals AND fractions (`86 1/2` == `86.5`) for size sorting |
| `src/lib/shockCompare.ts` | Linear interpolation + comparison table for overlaying multiple shock-load graphs |
| `src/components/GuideView.tsx` | In-app how-to Guide (accordion). Rendered as the **Guide** sub-tab in `SettingsView`. Mirror of `docs/USER_GUIDE.md` |
| `supabase/migrations/` | Full DB schema history — read these before touching cloud data shapes |

---

## Domain Model — Critical Relationships

- `Setup` has four `CornerSetup` fields: `lf`, `rf`, `lr`, `rr` (left-front, right-front, left-rear, right-rear).
- `RaceWeekend` → contains many `SessionRecord[]`. A `RaceWeekend` is the event container; a `SessionRecord` is a logged practice/heat/main.
- `ActiveSession` is the live-editing mirror of the most-recently-selected `SessionRecord`. Changes to `ActiveSession` via `handleUpdateSession` are **also written back** into the matching `SessionRecord` inside `weekends` state.
- Diagnostics on both `ActiveSession` and `SessionRecord` use a three-point model: `cornerEntry`, `centerApex`, `cornerExit` — each is `'TIGHT' | 'NEUTRAL' | 'LOOSE'`.
- When a `Setup` is saved, its tire pressures and compounds are **auto-propagated** into `activeSession.pressures` and `activeSession.tires`.

---

## localStorage Keys

| Key | Content |
|---|---|
| `race_notes_setup` | Active `Setup` object |
| `race_notes_saved_setups` | `Setup[]` array |
| `race_notes_weekends` | `RaceWeekend[]` array |
| `race_notes_active_session` | `ActiveSession` object |
| `race_notes_todos` | `Todo[]` array |
| `race_notes_tires` | `TireInventoryItem[]` array |
| `race_notes_shock_graphs` | `ShockSession[]` array |
| `race_notes_cars` | `Car[]` array |
| `race_notes_active_car` | active car ID string — **device-local, never synced to Supabase** |
| `race_notes_accounting` | `AccountingEntry[]` array |
| `race_notes_shopping` | `ShoppingItem[]` array |
| `race_notes_theme` | `AppTheme` object (`fontSize: 'standard' \| 'large' \| 'xlarge' \| 'xxlarge'`, drives CSS `--ui-zoom`) |
| `race_notes_registered_user` | durable "device has logged in before" flag powering offline-resilient auth gate (see Architecture above) |

---

## Developer Workflows

```bash
npm run dev          # Start dev server at http://localhost:3000 (0.0.0.0)
npm run build        # Production Vite build → dist/
npm run lint         # TypeScript type-check only (tsc --noEmit), no test runner
npm run android:run  # Build + cap sync + run on connected Android device
npm run android:build:debug   # Produce debug APK
npm run android:build:release # Produce release APK
```

**Env vars required** (create `.env.local`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
App runs fully offline without these — Supabase calls are wrapped in try/catch and silently degrade.

**Lint baseline:** `npm run lint` (`tsc --noEmit`) currently has **3 pre-existing errors** (two `File`-typed upload args in `RaceWeekendView`/`SmasherLoadsView`, one `key`-on-`CornerForm`). Vite build does NOT type-check, so these do not block builds. Don't add new type errors on top of the baseline.

**HMR note:** `DISABLE_HMR=true` disables hot-reload and file watching (used in AI Studio). Do not modify the `vite.config.ts` server block.

---

## Styling Conventions

- **TailwindCSS v4** with `@tailwindcss/vite` plugin (no `tailwind.config.js` — config is in CSS).
- CSS design tokens are in `src/index.css` as `--color-*` variables (e.g., `--color-primary: #ffb3ac`, `--color-surface: #131313`). Use Tailwind semantic classes like `bg-surface`, `text-primary`, `border-outline-variant`.
- **Typography classes**: `font-sans` (Inter), `font-display` (Space Grotesk for headers), `font-mono` (JetBrains Mono for data/telemetry numbers). Use `font-mono` on all numeric readouts.
- App is constrained to `max-w-2xl` — optimized for mobile portrait. Do not widen the layout.
- Icons: use `<span className="material-symbols-outlined">icon_name</span>` (Material Symbols) or `lucide-react` components.
- Active tab indicator pattern: `style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}` on Material Symbols.

---

## Cloud Sync & Teams

- Cloud sync uses **RLS (Row Level Security)** in Supabase — team members automatically share data without explicit share buttons. The `in_same_team(user_a, user_b)` SQL function drives cross-user visibility.
- Pull on login: `pullAllData` fetches all records accessible via RLS (omits `user_id` filter on purpose) then merges by `updated_at` timestamp — newer wins.
- IDs: `RaceWeekend` IDs use `wknd-${Date.now()}`, session IDs use `session-rec-${Date.now()}`. Maintain this pattern for new entity creation.

---

## Android / Capacitor

- Capacitor 8 wraps the PWA as a native Android app. After any web change: `npm run android:sync` to push to native.
- Android source is in `android/` — avoid editing native files unless changing permissions or splash screens. Exception: `MainActivity`'s deep-link intent-filter (`com.racenotes.app://auth-callback`) is required for native Google OAuth — don't remove it.
- Target API 36 (Android 16), AGP 8.9.1, Gradle 8.11.1 — bumped ahead of Google Play's Aug 31, 2026 API-36 requirement.
- The built APK artifact is `race_notes.apk` at project root (also see `CrewChief.apk` naming used in some build scripts). Also copied to Google Drive as `CrewChief-preview.apk` (both `G:\My Drive\` and `G:\My Drive\Google AI Studio\`).
- **Bump `versionCode` and `versionName`** in `android/app/build.gradle` with every APK build meant to install over a previous version.
- `android/app/build.gradle` (versionCode/versionName, keystore password) is **gitignored** — changes there never show up in git history. **This value has been observed reverting unexpectedly outside of any known process** — always re-check the live file before assuming its versionCode.
- Real builds/git pushes for this repo should go through **Windows-MCP PowerShell** (real Windows Git Credential Manager), not a Linux sandbox — sandboxes typically lack git push credentials and can produce spurious `tsc`/build artifacts on cross-platform mounts. **Never write repo files through a Linux mount** (`cp`/`>` over `/sessions/.../mnt/...`) — it can produce null-byte-corrupted files. Use the host-side file tools.
