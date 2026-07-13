# Current Task — UX Chunk 5: Setups + Fast Four-Bar

**Status:** READY TO PLAN/BUILD after UX-C4 commit `21405e9`

## Routing

- GPT 5.6 SOL High: analysis, specification, QA.
- GPT 5.6 Terra High: implementation; QA failures 1–2 return to Terra.
- Third failed QA review transfers implementation and final QA to SOL.
- If exact models are unavailable, disclose before work and never claim they ran.
- `/caveman full`; cavecrew investigator/reviewer only for bounded delegated work.

## Goal

Make Setups fast trackside: physical corner cards, glove-sized steppers, visible
four-bar quick adjustment, copy-last defaults, pressure provenance, one-tap diff,
and Tires sub-view. Four-bar must stay prominent because owner changes it often.

## Primary scope

- New: `src/components/FourBarQuickAdjust.tsx`,
  `src/components/TiresSubView.tsx`, `src/lib/setupSteps.ts`.
- Modify: `src/components/SetupView.tsx`, `src/components/RaceWeekendView.tsx`,
  `src/components/SetupDiffView.tsx`, `src/lib/setupCompat.ts`, `src/types.ts`.
- `src/App.tsx`: wiring only if existing props cannot carry setup mutations.
- Do not start Chunk 6/7 work.

## Acceptance

1. LF/RF/LR/RR numeric fields use physical 2×2 corner cards and shared
   `NumberStepper`; steps live only in `setupSteps.ts`.
2. Four-bar quick adjust is visible in Setups and reachable from quick-log in at
   most two taps; both mounts edit the same active setup state.
3. New setup defaults to active car's latest compatible setup, with explicit
   Start Blank option and no legacy-field loss.
4. Auto-carried pressure/four-bar values show source/provenance.
5. Setup card ⋯ Compare opens existing diff with correct default pair.
6. Tires sub-view shows active-car stagger/history and useful EmptyState.
7. Rare no-car Add Tire/Smasher disabled prerequisites become teaching actions.
8. Local-first dual-write, cloud sync, active-car scoping, old-data defaults,
   themes, and all zoom levels remain intact.
9. `npm run lint`: exact three-error baseline only. `npm run build`: pass.
10. Netlify draft + Android emulator walkthrough; production untouched.

## Required context

Read `HANDOFF.md` UX block, `docs/IMPLEMENTATION_PLAN_2026-07-12.md` Chunk 5,
`ralph/STATE.md`, and `CODEBASE_KNOWLEDGE.md` Chunk 4 override before editing.

## Build/Android gotchas

- v3 must contain gitignored `.env` and `.env.local` before build.
- Gate order: lint, v3 build, copy v3 `dist` to main, raw
  `npx cap sync android`, Gradle `assembleDebug`.
- Never run main-tree `npm run android:sync` during bridge; it rebuilds master.
- Bump live main-tree Android versionCode/versionName for each installable APK.
- Clear emulator app data after install to defeat stale Workbox cache.

## UX-C4 handoff evidence

- Commit: `21405e9`.
- Draft: `https://6a5458d75d0c165c44d0ef9f--crew-chief-race-notes.netlify.app`.
- APK: main standard debug output, versionCode 14/versionName 3.9.
- Verified: fresh auto-car/onboarding/hero/weekend/new-session flow;
  service cost creates linked Accounting expense and Undo removes both;
  session ⋯ delete/Undo; no runtime exceptions.
