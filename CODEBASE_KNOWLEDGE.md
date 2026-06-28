# Race Notes - Codebase Knowledge & Documentation

This document serves as a detailed technical reference for the **Race Notes** PWA. It is designed to assist with future development, feature additions, and maintenance of the codebase.

## 1. Tech Stack Overview
- **Framework**: React 19 (via Vite 6)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: TailwindCSS v4 with custom dark-mode theme variables in `index.css`
- **Icons**: Material Symbols Outlined (via Google Fonts in CSS) & `lucide-react`
- **Animations**: Framer Motion (`motion/react`) for fluid tab transitions
- **PWA Support**: `vite-plugin-pwa` for manifest generation, Service Worker offline precaching, and Android installability.
- **Hosting**: Configured for Netlify (`netlify.toml` included).

---

## 2. Architecture & State Management

The application is structured as a single-page React app without a dedicated routing library (like react-router). Instead, navigation is handled via conditional rendering controlled by the `activeTab` state in `App.tsx`.

### Global State (in `App.tsx`)
State is managed entirely at the top level (`App.tsx`) and passed down as props to the view components.
- `setup`: The currently active `Setup` configuration.
- `savedSetups`: An array of all saved `Setup` configurations.
- `weekends`: An array of `RaceWeekend` objects, each containing multiple `SessionRecord` logs.
- `activeSession`: The live data being entered for the current track session before it is finalized into a `RaceWeekend`.

### Data Persistence
To ensure a dirt racer doesn't lose their data trackside if they accidentally close the browser, all core state is **durably synced to `localStorage`**.
- `race_notes_setup`
- `race_notes_saved_setups`
- `race_notes_weekends`
- `race_notes_active_session`

The `useEffect` in `App.tsx` initializes state from `localStorage` on load, and custom handler functions (e.g., `saveSetup`, `handleUpdateSession`) update both React state and `localStorage` simultaneously.

---

## 3. Core Domain Models (`src/types.ts`)

The application heavily relies on detailed TypeScript interfaces tailored to dirt track physics and racing terminology.

- **`CornerSetup`**: The most granular model. Represents the physical setup of a single wheel corner (LF, RF, LR, RR). It includes properties for springs, shocks, load weights, c-to-c (center-to-center) measurements, caster, camber, tire compounds, sizes, pressures, and rear-specific metrics like birdcage holes, pull bar angles, and droop.
- **`Setup`**: Represents an entire car's configuration at a point in time. It contains metadata (chassis, track, date) and four `CornerSetup` objects, plus global settings like gear ratio and overall stagger.
- **`ActiveSession` / `SessionRecord`**: Logs for on-track performance.
  - **Metrics**: Best lap, average lap, finish position, max RPM, leader gap.
  - **Diagnostics**: Driver feedback on the car's handling at three points in the corner: `cornerEntry`, `centerApex`, `cornerExit` (values are `TIGHT`, `NEUTRAL`, or `LOOSE`).
  - **Tires & Pressures**: Hot/cold tire readings.
- **`RaceWeekend`**: A grouping container for multiple `SessionRecord`s (e.g., Heat 1, Qualifying, A-Main) that occur at the same event.

---

## 4. Main UI Components (`src/components/`)

- **`DashboardView.tsx`**: The landing screen. Displays an accordion-style log of all `RaceWeekends` and their nested sessions. Features a "Current Active Setup" summary card highlighting the 4 corner tire pressures.
- **`SetupView.tsx`**: The comprehensive engineering interface for creating, editing, and cloning car setups. Uses accordion panels for each of the 4 corners to keep the UI manageable. Auto-saves changes.
- **`SessionsView.tsx`**: The live logging view used during or immediately after a race. Allows the user to input lap times, diagnostics, and tire pressure adjustments.
- **`ExportView.tsx`**: Responsible for formatting and exporting the data (likely for sharing with crew chiefs or printing).
- **`QuickReferenceView.tsx`**: A reference guide tab for the user.

---

## 5. Styling & Theming

The UI is built with a custom "Motorsport Telemetry" dark-theme design system.
- **CSS Variables** (`src/index.css`): Variables map to Tailwind utilities (e.g., `--color-surface: #131313`, `--color-primary: #ffb3ac`).
- **Typography**: Inter (sans-serif), Space Grotesk (display headers), JetBrains Mono (data/telemetry numbers).
- **Effects**: Features custom `.scanline` animations and `.status-glow-*` classes to mimic physical telemetry dashboards.
- **Layout**: The app is constrained to `max-w-2xl` centrally, optimizing it heavily for mobile/tablet portrait usage (which is how it will be used in the pits).

---

## 6. PWA Integration Details

- **Plugin**: `vite-plugin-pwa` handles the heavy lifting.
- **Caching Strategy**: `generateSW` mode is active, meaning the service worker (`dist/sw.js`) automatically precaches all JS, CSS, HTML, and icon assets on build, guaranteeing 100% offline functionality.
- **Manifest**: Generated dynamically with `theme_color` `#131313` and `standalone` display mode so it launches without browser UI on Android.
- **Icons**: Located in `public/`. Sized at `192x192`, `512x512`, and a `maskable-icon.png` (with 15% safe padding) for adaptive Android launcher icons.

---

## 7. Cloud Sync & Auth (Phase 2)

The application integrates **Supabase** for cloud persistence and user authentication, enabling multi-device sync and team-based collaboration while maintaining a **local-first offline architecture**.

### Authentication (`src/lib/supabase.ts`)
- **Client Setup**: Supabase client initialized with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables.
- **Auth Helpers**:
  - `signUp(email, password, displayName)`: Register new users and auto-create a profile row.
  - `signIn(email, password)`: Session-based authentication with auto-refresh tokens.
  - `signOut()`: Revoke session.
  - `onAuthChange(callback)`: Real-time auth state listener for login/logout events.
  - `fetchProfile(userId)`, `searchProfiles(query)`: Fetch user metadata for sharing workflows.

### Local-First Sync Engine (`src/lib/sync.ts`)
The sync strategy prioritizes offline-first resilience:
1. **Always write to `localStorage`** first (works offline).
2. **Debounce push to Supabase** (500ms debounce) when authenticated and online.
3. **Pull on login**: Merge cloud data with localStorage using `updated_at` timestamps (newer wins).

**Push Functions**:
- `pushSetups(setups, userId)`: Sync `Setup` configurations.
- `pushWeekends(weekends, userId)`: Sync `RaceWeekend` race logs.
- `pushActiveSession(session, userId)`: Persist live session state.
- `pushTodos(todos, userId)`: Persist To-Do checklists state.

**Pull Functions**:
- `pullAllData(userId)`: Fetch all cloud data and merge conflict resolution via timestamps. (Due to team RLS, omitting explicit `user_id` query filters allows downloading team data).
- `pullTodos()`: Fetch To-Do checklists state.

### Database Schema (`supabase/migrations/`)

**1. Profiles** (`profiles` table)
- Stores public user metadata: `display_name`, `avatar_url`, email.
- Auto-created on signup via `handle_new_user()` trigger.

**2. Setups** (`setups` table)
- Persists `Setup` objects: `chassis`, `track`, `date` with `lf`/`rf`/`lr`/`rr` JSONB configurations.

**3. Race Weekends** (`race_weekends` table)
- Stores grouped race sessions: `name`, `track`, `date`, `sessions` (JSONB array of `SessionRecord`s).

**4. Active Sessions** (`active_sessions` table)
- One row per user (`id = "active-${userId}"`) storing the current live session state for crew coordination.

**5. Todos** (`todos` table)
- To-Do lists checklists state (`items` stored as JSONB).

---

## 8. Teams & To-Do Lists (Phase 3)

The application supports **team-based workflows** where multiple crew members collaborate on vehicle setup and strategy seamlessly via Row Level Security (RLS) conditions in the cloud.

### Team Architecture
**Team-Based Access Model**:
- **`teams` table**: Stores team metadata (`name`, `created_at`).
- **`team_members` table**: Maps users to teams with roles (`owner`, `member`).
- **RLS Function `in_same_team(user_a, user_b)`**: Returns true if both users belong to any common team; used in policies to enable cross-user data visibility within a team.

### Team Permissions via RLS
- **Setups/Weekends/Sessions/Todos**: Any member in the same team as the owner (`user_id`) can `SELECT` and `UPDATE` records automatically. 
- Because all users operating in the same team fetch each other's data (the `sync.ts` pull commands are simply `.select('*')` reliant on RLS masking), the application inherently shares and modifies everything mutually without special buttons tracking individual entity "shares". 

### Manage Team UI
- Replaces individual "Share Setup/Session" buttons with an overall `TeamView` nested inside `Account` (`AuthView.tsx`). 
- Creates a Team automatically with you as the owner.
- Sends instant email requests to invite other members to the Team.
- Automatically syncs the app to anyone mapped natively via Supabase Postgres policies.
