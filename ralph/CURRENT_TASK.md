# Current Task — UX Overhaul v2 A2: Save Run Reservation and Bottom-Nav Clearance

**Status:** READY — Terra initial build, attempt 1
**Branch:** `codex/ux-overhaul`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 5, Task A2
**Runtime model:** Verify from `turn_context.payload.model` before work; if unavailable, report `unverified`.

## Builder role

Work as Terra initial builder. Read `AGENTS.md`, `.agents/skills/caveman/SKILL.md`, `.agents/skills/cavecrew/SKILL.md`, this file, `ralph/STATE.md`, and Part 5 Task A2 plus boundary statement 5.2 before editing. Use `/caveman full`; use cavecrew for delegated work.

Implement only Task A2. Land feature code and its harness assertion together in one task-identifying commit. Do not self-certify or advance Ralph state; SOL light QA owns verdict and state advancement.

## Authorized files only

- `src/index.css` — existing Save Run reservation styling around lines 266–275 only.
- `src/components/RaceWeekendView.tsx` — Save Run container only.
- `src/App.tsx` — main scroll container only.
- `scripts/chunk5-setup-harness.ts` — reservation assertion only.

Any edit outside these four files, or outside the named surfaces within them, fails scope.

## Required change

1. Reserve sticky Save Run bar height plus safe-area inset below Race Weekend content so its final controls can scroll fully above the bar.
2. Make Save Run bar opaque and give it a top border.
3. Render Save Run bar only while run data is dirty; clean state must not retain an empty reservation/bar.
4. Give global main-scroll content bottom padding of exactly `calc(4rem + safe-area)` using the project's safe-area expression/token so no content can sit behind bottom navigation.
5. Add only the A2 reservation assertion to `scripts/chunk5-setup-harness.ts`; do not broaden that harness into unrelated coverage.

## Acceptance

- Save Run never covers Race Weekend content.
- No view leaves content behind bottom navigation at any named test viewport.
- Dirty and clean Race Weekend states both reach their true scroll extremes: dirty state includes correct sticky-bar reservation; clean state has no phantom bar/reservation.
- Sticky bar remains opaque, top-bordered, safe-area aware, and dirty-only.
- Existing focus, keyboard, pinch-zoom, save semantics, and safe-area behavior do not regress.

Named layout viewports from this plan: `360×800`, `390×844`, `412×915`, and `1080×2118`.

## Required verification

1. Run focused `scripts/chunk5-setup-harness.ts`; it must PASS.
2. Mutation-check the new reservation assertion once: temporarily invalidate the implementation or fixture so the assertion demonstrably fails, then restore it and rerun PASS. Do not commit mutation artifacts.
3. Run `npm run lint`; result must match the exact known three-error baseline, with zero new errors.
4. Run `npm run build`; it must PASS.
5. Run `git diff --check`.
6. Run `git status --short` and inspect the task diff against the A1 base/current HEAD. Diff must contain only the four authorized files before commit and feature+harness only in the A2 commit.
7. Commit once with an A2-identifying message. Report commit SHA and concise evidence for focused harness, mutation check, exact lint baseline, build, diff check, scope, and status.

## Hard boundaries

- No files outside the four authorized files.
- No Ralph edits by builder.
- No schema, RLS, migrations, edge functions, sync behavior, deletion behavior, dual weekend-delete changes, team-owner canonical-write changes, account-scoped deferred-delete queue changes, UXN-1 pull-filtering changes, UXN-3 pull-on-resume throttle changes, generation-isolation changes, or setup lifecycle role/history/immutability changes.
- Do not sync `activeCarId` or `activeWeekendId`; both remain localStorage-only.
- No native, Android, release, APK/AAB, package, or credential changes.
- No branch-ref changes, push, deploy, merge, production action, or `master` work.
- Do not disable pinch-zoom or change unrelated focus, keyboard, or safe-area behavior.
- Do not begin Sprint 4 IA work.
- Do not begin A3. Stop after A2 commit and handoff to SOL light QA.

## Compressed builder contract

Patch only Save Run reservation/bar, main-scroll bottom clearance, and one chunk5 harness assertion. Verify dirty/clean scroll extremes and all named viewports. Mutation-prove assertion. Focused harness PASS; exact three-error lint baseline; build PASS; diff/status clean and scoped. Commit feature+harness once. No Ralph/schema/sync/delete/throttle/lifecycle/native/release/branch/push/deploy/merge work.
