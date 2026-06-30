# CREW CHIEF — Project Instructions for Claude

You are an expert developer helping build **CREW CHIEF**, a React + TypeScript PWA and Android app for dirt track racing teams to track car setups, race sessions, tire inventory, weather, and pit-crew tasks.

## Key facts to always remember

- **Repo:** `C:\Users\maxx\antigravity\Race-Notes`
- **Brand:** CREW CHIEF (all caps)
- **Stack:** React 19 + TypeScript, Vite 6, TailwindCSS v4 (`@theme` in CSS — no `tailwind.config.js`), Capacitor 6 (Android), Supabase (auth + Postgres)
- **Main branch:** `master` — all features merged here; deployed to Netlify at `https://crew-chief-race-notes.netlify.app`
- **APK:** versionCode `3`, versionName `"3.0"`. Signing keystore: `android/app/crew-chief-release.jks`, password `CrewChief2024!`, alias `crew-chief`
- **Java for Android builds:** Java 21 required (`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`)

## App navigation tabs (activeTab string values)

`dashboard` | `setups` | `raceweekend` | `trackers` | `quickref` | `settings`

**`trackers` is the tasks/accounting/shopping tab** — there is NO `'todos'` tab.

## Architecture rules

- **Local-first:** localStorage is the primary write target. Supabase is secondary.
- **No React Router** — navigation is a single `activeTab` string in `App.tsx`.
- **Car scoping:** Setups, tires, and shock sessions are scoped to the active car via `byActiveCar()` in `src/lib/scope.ts`. Weekends, todos, accounting, and shopping are global.
- **Active car is device-local** — stored in `race_notes_active_car`, never synced to Supabase.
- **Deletion sync:** When deleting a weekend, MUST call both `pushWeekends(remaining)` AND `deleteWeekendFromCloud(id)` — upsert alone does not delete cloud records.
- **Never merge to master without explicit owner (Maxx) approval.**

## Build & deploy workflow

```powershell
# Web build + preview deploy
npm run build
netlify deploy --dir=dist          # preview
netlify deploy --prod --dir=dist   # production

# Android APK
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run build
npx cap sync android
cd android; .\gradlew.bat assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
# Copy to Google Drive as: CrewChief-preview.apk
```

## Conventions

- All new TypeScript interfaces go in `src/types.ts`
- All Supabase push/pull helpers go in `src/lib/sync.ts`
- TailwindCSS custom tokens: `bg-surface-container`, `border-outline-variant`, `text-primary`, `text-on-surface`, `text-on-surface-variant`, `font-mono`, `font-display`
- `npm run lint` = `tsc --noEmit` — run before every commit (Vite does NOT type-check)
- Vite build only runs on Windows (Rollup native binary)
- Bump `versionCode` in `android/app/build.gradle` with every APK build meant to install over a previous version

## Supabase tables

`race_weekends`, `setups`, `active_sessions`, `todos`, `tire_inventory`, `cars`, `shock_sessions`, `shared_setups`, `shared_weekends`, Storage bucket: `race-attachments`

All car-scoped tables have a `car_id text` column. RLS uses `in_same_team()` helper so team members share car/setup/tire data.

## Full codebase reference

See `CODEBASE_KNOWLEDGE.md` in the project root for complete interface definitions, component details, sync patterns, and known gotchas.
