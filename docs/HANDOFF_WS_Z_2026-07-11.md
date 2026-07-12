# WS-Z Handoff — Product Simplification and Android Debug Build

Last updated: 2026-07-12

This document records the July 11 WS-Z implementation, its exact locations, validation state, Android test artifact, and remaining work. It is intended to let another agent continue without relying on prior conversation history.

> ### ⚡ Corrections 2026-07-12 (these supersede the point-in-time statements below)
> - **Migration 014 IS now applied** to live Supabase (`20260711151905`). Continuation checklist item 1 is complete; disregard the "not applied / remains unapplied" statements below.
> - **The 9.1 MB `android/app/build/outputs/apk/debug/app-debug.apk` provenance is established:** it was built from secured commit `98bb2e0` on the complete Android platform (main tree), reflects the `firebase-messaging-sw.js` security fix, and **includes** the native `@capacitor/push-notifications` plugin. It is the current, approved debug build. The "unknown provenance" caution below no longer applies to it.
> - **The stale 5,290,667-byte `CrewChief.apk` / `race_notes.apk` root copies were deleted** during the 2026-07-12 cleanup (they predated the security fix, as warned below).
> - **Repo consolidated to a single worktree** on `master` (the `.worktrees/v2` worktree was removed; future parallel dev = a new `v3 preview` worktree). The "build-from-main bridge" is retired — APKs now build directly from the single main tree.

## Work locations and branches

- Feature development was completed in `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v2` on branch `preview-v2`.
- The repository root at `C:\Users\maxx\antigravity\Race-Notes` currently has a detached HEAD. It contains the complete Android platform files required for Gradle builds, but it is not the feature-development worktree.
- Current audited refs: `preview` remains at `6407d6e`; `preview-v2` and `master` point to `98bb2e0`. The movement of `master` occurred outside the documented WS-Z build turn, so this handoff does not attribute its provenance to that turn.
- Commit `9db863b` contains the WS-Z setup, sessions, trackers, compatibility, cloud-policy, and documentation changes.
- Commit `98bb2e0` removes the committed Firebase web configuration from `firebase-messaging-sw.js` and injects it from `VITE_FIREBASE_CONFIG_JSON` during service-worker registration.
- The production Netlify deployment was not changed during WS-Z.
- The main tree currently contains generated/host-specific changes that must be preserved: modified `android/app/capacitor.build.gradle`, modified `android/capacitor.settings.gradle`, and untracked `android/app/google-services.json`.

## Implemented product changes

### Setups

- Scale-weight percentages now use `loadWeight`, while existing records that only contain legacy `load` values remain readable.
- Explicitly cleared `loadWeight` values stay cleared instead of falling back to stale legacy data.
- LR and RR now expose the requested eight four-bar inputs: top and bottom bar length, frame hole, birdcage hole, and angle. RR angles use Ride Height; LR angles use Full Droop.
- Total scale weight and percentage calculations were verified with deterministic sample data.

Primary files:

- `src/components/SetupView.tsx`
- `src/lib/setupCompat.ts`
- `src/lib/setupDiff.ts`
- `src/data.ts`
- `src/types.ts`
- `src/App.tsx`
- `src/lib/sync.ts`

### Sessions and active weekends

- A session can only be created when a valid active weekend exists.
- Creating a weekend makes it active but does not force immediate session creation.
- The Sessions view shows only a Create Weekend action when no weekends exist.
- New Weekend is no longer exposed as a normal Sessions-page action; Dashboard owns weekend creation.
- Session checklist UI was removed.
- Active weekend selection is device-local under `race_notes_active_weekend` and is not synced to Supabase.
- Deleting or switching weekends reconciles session state to prevent stale cross-weekend editing.

Primary files:

- `src/App.tsx`
- `src/components/DashboardView.tsx`
- `src/components/RaceWeekendView.tsx`

### Trackers

- Visible Tracker tabs are Checklist, Service, Templates, and Accounting.
- Shopping UI and export options were removed. Existing Shopping data and its local-storage key remain intact for rollback/data preservation.
- Checklist now presents one Main Checklist with no list selector and no weekend dependency.
- Users can add items manually or import items from dedicated templates.
- Main Checklist migration consolidates legacy non-template Todo lists deterministically, preserves item metadata, handles ID collisions, and remains idempotent after subsequent loads.
- Service and template deletion paths now call cloud hard-delete helpers and report failure.

Primary files:

- `src/components/TrackersView.tsx`
- `src/components/ToDoView.tsx`
- `src/lib/mainChecklist.ts`
- `src/components/DashboardView.tsx`
- `src/components/ExportView.tsx`
- `src/components/SettingsView.tsx`
- `src/App.tsx`
- `src/lib/sync.ts`

### Cloud deletion and data compatibility

- `supabase/migrations/014_team_delete_policies.sql` adds team DELETE policies for maintenance components, maintenance logs, and checklist templates.
- Migration 014 is committed but has **not** been applied to live Supabase.
- Setup hydration and cloud synchronization normalize legacy `load` records through `src/lib/setupCompat.ts`.
- Main Checklist hydration merges local and cloud data by ID and timestamp, then pushes a newer local migration result when appropriate.

### Documentation and workflow

The implementation refreshed `AGENTS.md`, `HANDOFF.md`, `CODEBASE_KNOWLEDGE.md`, `plan-v2.md`, `ralph/CURRENT_TASK.md`, `ralph/STATE.md`, `docs/USER_GUIDE.md`, project instructions, and Ralph agent definitions. Current authority remains `AGENTS.md`, `HANDOFF.md`, `plan-v2.md`, and `ralph/STATE.md`.

## Validation completed

- `npm run build`: passed.
- `npm run lint`: introduced zero new TypeScript errors. The existing three-error baseline remains: two upload arguments typed as `unknown` instead of `File` in `RaceWeekendView.tsx` and `SmasherLoadsView.tsx`, plus the existing `key` prop typing issue on `CornerForm` in `SetupView.tsx`.
- `git diff --check`: passed before commit.
- Deterministic setup-weight calculation test: passed using 500/600/700/800 lb inputs, producing 2600 lb total, 42.3% nose, 46.2% left, 50.0% cross, and -100.0 lb split.
- Main Checklist compatibility test: passed for metadata preservation, stable collision handling, source archival, and post-edit idempotence.
- Cavecrew review reported no remaining WS-Z blockers.
- At WS-Z deployment time, the Netlify draft returned HTTP 200: https://6a525a23a0b54ce49ff7498c--crew-chief-race-notes.netlify.app

These checks do not replace the remaining manual and authenticated QA listed below.

## Android debug APK

The v2 web bundle was built in `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v2`, then its `dist` output was bridged into the complete Android tree at `C:\Users\maxx\antigravity\Race-Notes`. Capacitor sync and the Gradle debug build ran from the main tree.

- Application ID: `nimbus.engineering.crewchief`
- Version name: `3.7`
- Version code: `12`
- Copied WS-Z UI-testing artifacts, created July 11 at 11:05 AM, 5,290,667 bytes each:
  - `C:\Users\maxx\antigravity\Race-Notes\CrewChief.apk`
  - `C:\Users\maxx\antigravity\Race-Notes\race_notes.apk`
- Previously reported distribution copies, not reverified in the current session:
  - `G:\My Drive\CrewChief-preview.apk`
  - `G:\My Drive\Google AI Studio\CrewChief-preview.apk`
- Copied-artifact SHA-256: `BD332310F285CFC32A9702636C90B2C60235CD3A0457AC8E4BEAC674570C201B`
- APK Signature Scheme v2 verification passed.

A newer raw Gradle output also exists at `C:\Users\maxx\antigravity\Race-Notes\android\app\build\outputs\apk\debug\app-debug.apk`. It was created July 11 at 1:45 PM, is 9,526,290 bytes, and has SHA-256 `83B20348E5DE1754DE244DC6E6E97E124A7BDE79BF442A0EE2B274E5BDFE7C26`. It is not the same binary as the copied WS-Z artifacts, and its provenance has not been established. Do not install, endorse, overwrite, rename, distribute, or use one artifact's QA evidence for the other without first establishing the newer build's source, configuration, and contents.

**Security warning:** The copied 5,290,667-byte APK predates commits `9db863b` and `98bb2e0`, is not a build of current HEAD, and contains the pre-fix `firebase-messaging-sw.js` configuration. It is not approved for redistribution, security QA, or native-push QA. It may be used only for isolated WS-Z UI regression testing if the owner explicitly accepts its stale security state. Preferred action is to rebuild from secured current commit `98bb2e0` first. Replace any previously reported Drive copies after that secured rebuild.

The copied APK also lacks native plugins that exist only in the incomplete v2 Android tree, including the v2-only native push-notifications integration. The newer raw Gradle APK has unknown provenance and is not endorsed for any test or distribution until separately audited.

## Deployment state

- Draft deployment recorded at WS-Z deployment time: https://6a525a23a0b54ce49ff7498c--crew-chief-race-notes.netlify.app
- Production site recorded as unchanged at that time: https://crew-chief-race-notes.netlify.app
- Current Netlify live deploy history has not been independently audited in this handoff session.
- Git state is separate from Netlify deployment state: `master` currently points to `98bb2e0`, while `preview` remains at `6407d6e`.
- Migration 014 remains unapplied to live Supabase.
- No production deploy or branch merge is authorized unless Maxx explicitly requests it.

## Required continuation checklist

1. Apply `supabase/migrations/014_team_delete_policies.sql` to the intended Supabase environment through the approved migration workflow.
2. Test authenticated deletion as two users in the same team for maintenance components, maintenance logs, and checklist templates.
3. Test Main Checklist local-first behavior offline, then reconnect and verify cloud convergence without duplicates or data loss.
4. Test existing legacy setup and Todo data on an upgraded device/profile.
5. Manually verify dark and light themes plus standard, large, xlarge, and xxlarge font scales.
6. Test mobile portrait layouts, hard refresh, incognito/PWA cache behavior, active-weekend switching, weekend deletion, and session creation guards.
7. Rebuild a secured APK from current commit `98bb2e0` using a complete Android platform before any installation, distribution, security review, or native-push QA.
8. Verify the rebuilt APK's source commit, application ID, version, size, signature, hash, packaged web assets, and native plugins; then replace stale Drive copies.
9. Record QA evidence and any human gates in `ralph/STATE.md` and `ralph/CURRENT_TASK.md`, and backfill the `ralph/STATE.md` commit column during that QA update.
10. Keep feature work on `preview-v2`; do not merge or publish production without explicit authorization.
11. Preserve main-tree generated/host-specific files listed above; do not clean or overwrite them while preparing Android work.

## Model and agent workflow note

Owner routing requires GPT 5.6 SOL High for analysis, specification, planning, and QA, and GPT 5.6 Terra High for implementation. The runtime used for WS-Z did not expose those named models, so work used the available model under the documented fallback and did not claim otherwise. Cavecrew investigators/reviewers supported implementation and QA. Future agents must follow the current routing in `AGENTS.md`; when a named model is unavailable, disclose that limitation and preserve the role split with the best available option.
