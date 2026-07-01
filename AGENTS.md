# AGENTS.md — Race Notes / Crew Chief

AI coding agent guide for the **Race Notes** PWA — a professional motorsport logbook and pit-side crew-chief tool for dirt-track racing.

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

---

## Key Files

| File | Purpose |
|---|---|
| `src/types.ts` | All TypeScript interfaces — start here to understand domain models |
| `src/data.ts` | `INITIAL_SETUP`, `INITIAL_SETUPS`, `INITIAL_WEEKENDS`, `INITIAL_ACTIVE_SESSION` defaults |
| `src/App.tsx` | Global state, all mutation handlers, tab routing, new-weekend/session modals |
| `src/lib/supabase.ts` | Supabase client singleton + auth helpers (`signIn`, `signUp`, `fetchProfile`, `getUserTeam`, `signInWithGoogle`, `hasLocalAccount`/`rememberLocalAccount`) |
| `src/lib/sync.ts` | Push/pull functions — `pushSetups`, `pushWeekends`, `pushTodos`, `pullAllData` |
| `src/lib/tireHistory.ts` | Derives tire usage history from weekend/session data; CSV + printable report export |
| `src/lib/shockCompare.ts` | Linear interpolation + comparison table for overlaying multiple shock-load graphs |
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
| `race_notes_theme` | `AppTheme` object (`fontSize: 'standard' \| 'large' \| 'xlarge'`, drives CSS `--ui-zoom`) |
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
- The built APK artifact is `race_notes.apk` at project root (also see `CrewChief.apk` naming used in some build scripts).
- `android/app/build.gradle` (versionCode/versionName, keystore password) is **gitignored** — changes there never show up in git history. **This value has been observed reverting unexpectedly outside of any known process** — always re-check the live file before assuming its versionCode.
- Real builds/git pushes for this repo should go through **Windows-MCP PowerShell** (real Windows Git Credential Manager), not a Linux sandbox — sandboxes typically lack git push credentials and can produce spurious `tsc`/build artifacts on cross-platform mounts.

