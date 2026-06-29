# Race Notes / Crew Chief — Codebase Knowledge & Documentation

This document serves as a detailed technical reference for the **Race Notes** PWA (branded in-app as **CREW CHIEF**). It is designed to assist with future development, feature additions, and maintenance of the codebase.

---

## 1. Tech Stack Overview
- **Framework**: React 19 (via Vite 6)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: TailwindCSS v4 with `@tailwindcss/vite` plugin (no `tailwind.config.js` — config lives in CSS)
- **Icons**: Material Symbols Outlined (via Google Fonts in CSS) & `lucide-react`
- **Animations**: Framer Motion (`motion/react`) for fluid tab transitions
- **PWA Support**: `vite-plugin-pwa` for manifest generation, Service Worker offline precaching, and Android installability
- **Mobile Native**: Capacitor 8 wrapping the PWA as an Android app
- **Backend**: Supabase (Postgres + Auth + Storage + RLS)
- **Hosting**: Configured for Netlify (`netlify.toml` included)

---

## 2. Architecture & State Management

The application is structured as a single-page React app without a dedicated routing library. Navigation is handled via conditional rendering controlled by the `activeTab` state in `App.tsx`.

**No router.** To add a new tab: add the key to the `activeTab` union type, add a `<button>` in the bottom `<nav>`, and add a conditional render in `<main>`.

**State lives in `App.tsx` only.** All domain state (`setup`, `savedSetups`, `weekends`, `activeSession`, `todos`, `tireInventory`, `theme`) is declared at the top level and passed as props. Views never own persistent state — they receive data + callback props.

### Global State (in `App.tsx`)
| State | Type | Description |
|---|---|---|
| `activeTab` | union | Controls which view is rendered |
| `setup` | `Setup` | Currently active car setup |
| `savedSetups` | `Setup[]` | All saved setup configurations |
| `weekends` | `RaceWeekend[]` | All race weekend events + their sessions |
| `activeSession` | `ActiveSession` | Live data being entered for the current session |
| `todos` | `Todo[]` | To-Do checklists |
| `tireInventory` | `TireInventoryItem[]` | Tracked tire inventory |
| `theme` | `AppTheme` | Current visual theme (dark/light + accent color) |
| `user` | `User \| null` | Supabase authenticated user |
| `profile` | `AppUser \| null` | Extended user profile with display name |
| `team` | `Team \| null` | The user's current team |

### Data Persistence — Dual-Write Pattern
Every state mutation must update both React state AND `localStorage` simultaneously. Cloud sync (Supabase) is a third, optional step only when `user` is truthy:
```ts
setSavedSetups(updated);
localStorage.setItem('race_notes_saved_setups', JSON.stringify(updated));
if (user) pushSetups(updated, user.id, setSyncStatus);
```

### localStorage Keys
| Key | Content |
|---|---|
| `race_notes_setup` | Active `Setup` object |
| `race_notes_saved_setups` | `Setup[]` array |
| `race_notes_weekends` | `RaceWeekend[]` array |
| `race_notes_active_session` | `ActiveSession` object |
| `race_notes_todos` | `Todo[]` array |
| `race_notes_tires` | `TireInventoryItem[]` array |
| `race_notes_theme` | `AppTheme` object |

---

## 3. Core Domain Models (`src/types.ts`)

### `CornerSetup`
The most granular model — represents the physical setup of a single wheel corner (LF, RF, LR, RR).

**General fields**: `spring`, `shock`, `loadWeight`, `loadCtoC`, `caster`, `camber`, `tireComp`, `tireSize`, `toe`, `stagger`, `staggerUnit`, `wheelSpacer`, `wheelSpacerUnit`, `tirePress`, `tireInventoryId`, `backspacing`

**Rear-specific fields**: `springHeight`, `load`, `topBarLength`, `bottomBarLength`, `topBarHFrame`, `topBarHBird`, `topBarAngRH`, `topBarAngFD`, `botBarHFrame`, `botBarHBird`, `bottomBarAngle`, `droop`, `preload`, `boundGraphId`

### `Setup`
Entire car configuration at a point in time.
- Metadata: `id`, `chassis`, `track`, `date`, `carType`
- Four corners: `lf`, `rf`, `lr`, `rr` (each a `CornerSetup`)
- Global settings: `gear`, `toe`, `jbar`, `jbarFrameHeight`, `jbarPinionHeight`, `frontStagger`, `rearStagger`, `pullBarFrameHole`, `pullBarRearHole`, `pullBarAngle`, `notes`
- Attachments: `screenshots` — array of Supabase Storage public URLs

### `TireInventoryItem`
Tracks physical tires in inventory:
- `id`, `tireNumber`, `size`, `compound`, `wheelBackspacing` (`'2' | '3' | '4'`), `durometer`

### `TireDetails`
Per-corner tire state on a session:
- `compound`, `size`, `airPressure`, `tireId?`, `durometer?`, `backSpacing?`

### `SetupAdjustment`
Mid-session setup change log entry:
- `id`, `icon`, `label`, `value`

### `SessionRecord`
Logged on-track performance (stored inside `RaceWeekend.sessions`):
- **Identity**: `id`, `type`, `name`, `track`, `condition`, `time`, `weather`, `setupUsed`
- **Performance**: `bestLap`, `isBest`, `avgLap`, `finishPos`, `gap`, `maxRpm`, `leaderLap`, `leaderGap`
- **Diagnostics**: `cornerEntry`, `centerApex`, `cornerExit` — each `'TIGHT' | 'NEUTRAL' | 'LOOSE'` with optional notes
- **Adjustments**: `SetupAdjustment[]`
- **Tires**: `{ lf, rf, lr, rr: TireDetails }` + `pressures: { lf, rf, lr, rr: string }`
- **Other**: `competitionNotes`, `screenshots` (Supabase Storage URLs)

### `RaceWeekend`
Container grouping multiple `SessionRecord[]` under one event:
- `id` (format: `wknd-${Date.now()}`), `name`, `track`, `date`, `sessions`

### `ActiveSession`
Live-editing mirror of the currently selected session. Changes via `handleUpdateSession` are written back into the matching `SessionRecord` inside `weekends`. Fields mirror `SessionRecord` plus `weekendId` for targeting.

### `TodoItem`
- `id`, `text`, `desc?`, `completionNote?`, `completedAt?`, `done`

### `Todo`
- `id`, `user_id`, `title`, `items: TodoItem[]`, `is_template?`, `updated_at`

### `AppTheme`
Stored in `race_notes_theme`. Applied to `document.documentElement` via CSS variables:
- `mode: 'dark' | 'light'`
- `accent: string` — hex color (default `#ffb3ac`); drives `--color-primary`, `--color-primary-fixed-dim`, `--color-surface-tint`, and a contrast-calculated `--color-on-primary`

### `Team` / `TeamMember`
- `Team`: `id`, `name`, `banner_url?`, `created_at`
- `TeamMember`: `team_id`, `user_id`, `role: 'owner' | 'member'`

---

## 4. Main UI Components (`src/components/`)

| Component | Tab | Description |
|---|---|---|
| `DashboardView.tsx` | `dashboard` | Landing screen; accordion log of race weekends + sessions; active setup summary card |
| `SetupView.tsx` | `setups` | Engineering interface for creating/editing/cloning setups; accordion per corner; tire inventory management |
| `RaceWeekendView.tsx` | `raceweekend` | Live session logging; lap times, diagnostics, tire pressure adjustments, photo attachments |
| `QuickReferenceView.tsx` | `quickref` | Reference guide for dirt track setup terms and tuning info |
| `ToDoView.tsx` | `todos` | To-Do checklists with template support; completion notes per item |
| `SettingsView.tsx` | `settings` | Auth (login/register), theme picker, data export/import |
| `AuthView.tsx` | *(nested in Settings)* | Auth UI — login, register, profile |
| `TeamView.tsx` | *(nested in Settings)* | Team creation, invite members, team management |
| `ExportView.tsx` | *(not in nav)* | Formatting and exporting data; available but not linked from bottom nav |
| `SmasherLoadsView.tsx` | *(not in nav)* | Specialized view; not currently linked from bottom nav |

### Bottom Navigation (6 tabs)
`dashboard` → `setups` → `raceweekend` → `quickref` → `todos` → `settings`

Tab icons use Material Symbols with `fontVariationSettings: "'FILL' 1"` when active.

---

## 5. Styling & Theming

The UI uses a custom **Motorsport Telemetry** dark-theme design system.

- **CSS Variables** (`src/index.css`): Variables map to Tailwind utilities (e.g., `--color-surface: #131313`, `--color-primary: #ffb3ac`). Use semantic Tailwind classes like `bg-surface`, `text-primary`, `border-outline-variant`.
- **Typography**: `font-sans` = Inter; `font-display` = Space Grotesk (headers); `font-mono` = JetBrains Mono (all numeric/telemetry readouts — use this on all data values)
- **Effects**: `.scanline` animations and `.status-glow-*` classes mimic physical telemetry dashboards
- **Layout**: Constrained to `max-w-2xl` centered — optimized for mobile portrait use in the pits. Do not widen.
- **Theme system**: User can switch dark/light mode and pick an accent color. Applied at runtime via `document.documentElement` CSS variable overrides in `App.tsx`.

---

## 6. PWA Integration Details

- **Plugin**: `vite-plugin-pwa` with `generateSW` mode — service worker (`dist/sw.js`) precaches all assets for 100% offline functionality
- **Manifest**: `theme_color: #131313`, `display: standalone` — launches without browser UI on Android
- **Icons**: `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon.png` (15% safe padding for adaptive icons)

---

## 7. Cloud Sync & Auth (Phase 2)

Supabase provides cloud persistence and user authentication with a **local-first offline architecture**.

### Authentication (`src/lib/supabase.ts`)
- `signUp(email, password, displayName)` — registers + auto-creates profile row
- `signIn(email, password)` — session-based auth with auto-refresh
- `signOut()` — revokes session
- `onAuthChange(callback)` — real-time auth state listener
- `fetchProfile(userId)`, `searchProfiles(query)` — user metadata for sharing
- `getUserTeam(userId)` — fetch the user's current team

### Local-First Sync Engine (`src/lib/sync.ts`)
1. **Always write to `localStorage` first** (works offline)
2. **Debounce push to Supabase** (500ms) when authenticated and online
3. **Pull on login**: fetch all accessible cloud data, merge using cloud-wins strategy

**Push functions** (all debounced 500ms):
- `pushSetups(setups, userId, onStatus?)` — sync `Setup[]`
- `pushWeekends(weekends, userId, onStatus?)` — sync `RaceWeekend[]`
- `pushActiveSession(session, userId, onStatus?)` — sync live session state
- `pushTodos(todos, userId, onStatus?)` — sync `Todo[]`

**Pull functions**:
- `pullAllData(userId, onStatus?)` — fetches setups, weekends, active session; returns merged results
- `pullTodos(onStatus?)` — fetches `Todo[]` (RLS-filtered)
- `pullSharedData(userId)` — fetches setups/weekends shared explicitly via `shared_setups` / `shared_weekends` tables

**Merge helper**:
- `mergeIntoLocalStorage(type, cloudData, localKey)` — cloud overwrites local on conflict (cloud is source of truth when logged in)

**Env vars required** (create `.env.local`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
App runs fully offline without these — all Supabase calls are try/catch wrapped.

---

## 8. Attachments / Photo Storage (Phase 4)

Users can attach photos and PDFs to both sessions and setups, stored in Supabase Storage.

### Storage Bucket: `race-attachments`
- **Public bucket** — files are publicly readable via URL
- **10 MB per file limit**
- **Allowed types**: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `application/pdf`
- **Path convention**: `{userId}/{sessions|setups}/{entityId}/{timestamp}_{random}.{ext}`
- Auth required to upload/delete; users can only modify files under their own `{userId}/` prefix

### Sync helpers (`src/lib/sync.ts`)
- `uploadAttachment(file, userId, entityType, entityId)` — uploads to storage, returns public URL
- `deleteAttachment(publicUrl)` — deletes from storage given the public URL

### Data model
- `Setup.screenshots: string[]` — array of public URLs
- `SessionRecord.screenshots: string[]` — array of public URLs
- `ActiveSession.screenshots?: string[]` — live session attachment list

---

## 9. Teams & To-Do Lists (Phase 3)

Team-based workflows allow crew members to collaborate via Supabase RLS.

### Team Architecture
- **`teams` table**: Team metadata
- **`team_members` table**: Maps users to teams with `owner` | `member` roles
- **`in_same_team(user_a, user_b)` SQL function**: Powers cross-user data visibility in RLS policies

### Team Permissions via RLS
Setups, weekends, sessions, and todos are automatically visible to all members of the same team — no explicit share buttons needed. The `.select('*')` in pull functions relies on RLS to mask data appropriately.

### Manage Team UI (`TeamView.tsx`, nested inside `SettingsView`)
- Auto-creates a team with you as owner
- Sends email invites to new members
- Syncs automatically to all team members via Postgres RLS policies

### To-Do Lists (`ToDoView.tsx`)
- Create multiple checklists with `is_template` support
- Items support `desc` (creation note), `completionNote` (note when checked off), and `completedAt` timestamp
- Cloud-synced via `pushTodos` / `pullTodos`

---

## 10. Tire Inventory

Tracks physical tires available in the garage.

- Managed via `tireInventory: TireInventoryItem[]` state in `App.tsx`
- Persisted to `race_notes_tires` in localStorage via `handleSaveTires`
- `TireInventoryItem` fields: `id`, `tireNumber`, `size`, `compound`, `wheelBackspacing` (`'2' | '3' | '4'`), `durometer`
- Corner setups reference a tire via `CornerSetup.tireInventoryId`
- Session `TireDetails` includes `tireId?`, `durometer?`, `backSpacing?` for cross-referencing

---

## 11. Database Schema (`supabase/migrations/`)

| Migration | Description |
|---|---|
| `001_schema.sql` | Base schema: profiles, setups, race_weekends, active_sessions |
| `002_share_weekends.sql` | `shared_setups` and `shared_weekends` explicit-share tables |
| `003_teams_and_todos.sql` | `teams`, `team_members`, `todos` tables + `in_same_team()` RLS function |
| `004_updates.sql` | Schema updates |
| `005_fix_recursion.sql` | Fix RLS recursion issue |
| `006_fix_teams_recursion.sql` | Further RLS recursion fix |
| `007_definitive_team_rls.sql` | Definitive team RLS policy implementation |
| `008_attachments_bucket.sql` | `race-attachments` Storage bucket + upload/delete RLS policies |

### Key Tables
- **`profiles`**: `display_name`, `avatar_url`, email. Auto-created on signup via `handle_new_user()` trigger.
- **`setups`**: Columns for all `Setup` scalar fields; `lf`/`rf`/`lr`/`rr` stored as JSONB.
- **`race_weekends`**: `name`, `track`, `date`, `sessions` (JSONB array of `SessionRecord[]`).
- **`active_sessions`**: One row per user (`id = "active-${userId}"`), `data` JSONB.
- **`todos`**: `title`, `items` (JSONB array of `TodoItem[]`), `is_template`, `updated_at`.
- **`teams`** / **`team_members`**: Team membership with roles.
- **`shared_setups`** / **`shared_weekends`**: Explicit per-entity sharing tables.

---

## 12. Android / Capacitor

- **Capacitor 8** wraps the PWA as a native Android app
- After any web change: `npm run android:sync` to push changes to the native layer
- Android source is in `android/` — avoid editing native files unless changing permissions or splash screens
- APK artifact: `race_notes.apk` at project root

---

## 13. Developer Workflows

```bash
npm run dev                   # Dev server at http://localhost:3000 (0.0.0.0)
npm run build                 # Production Vite build → dist/
npm run lint                  # TypeScript type-check only (tsc --noEmit)
npm run android:run           # Build + cap sync + run on connected Android device
npm run android:build:debug   # Produce debug APK
npm run android:build:release # Produce release APK
npm run android:sync          # Sync web assets to native (after web changes)
```

**HMR note**: `DISABLE_HMR=true` disables hot-reload and file watching (used in AI Studio). Do not modify the `vite.config.ts` server block.

**IDs**: `RaceWeekend` IDs use `wknd-${Date.now()}`, session IDs use `session-rec-${Date.now()}`. Maintain this pattern for all new entity creation.

**Session→Weekend sync**: `ActiveSession` is the live-editing mirror of a `SessionRecord`. `handleUpdateSession` writes changes back into the matching record inside `weekends` state. Always use `weekendId` + `id` for precise targeting.

**Setup→Session propagation**: When a `Setup` is saved, its tire pressures and compounds are auto-propagated into `activeSession.pressures` and `activeSession.tires` for engineering consistency.
