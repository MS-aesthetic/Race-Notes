# Current Task — UX Overhaul v2 Task B4 Chunk B Integrated QA Gate

**Status:** QA READY — mandatory SOL High read-only Chunk B gate; no Terra build; Chunk C blocked
**Branch:** `codex/ux-overhaul`
**Final B3 commit:** `579d031cf7ab8881a8c95237136d9e775defede8`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 5 Chunk B QA, Part 6.2, Part 2 items 5/9/10/16, and boundary statement 5.2
**Runtime:** model metadata not exposed; record `unverified`.

## Role and writable scope

SOL High performs independent QA only. **No files are writable and no commit is created.** Terra has no B4 build assignment because Part 6.2 requires SOL to run the chunk gate after B3 light QA and before Chunk C opens.

Dependencies now satisfied:

- Chunk A final QA PASS.
- B1 final PASS 98 at `72c34ac`.
- B2 final PASS 98 at `546ffa5`.
- B3 final PASS 98 at `579d031`.

## Acceptance

1. Scroll starting over every NumberStepper surface produces zero writes and zero notifications; movement beyond ~8px and pointer cancel stay write-free; pointerup and 350ms/100ms hold-repeat semantics remain correct with no extra release write.
2. B2 arbiter and B3 terminal precedence work together: blocked, failed, offline-saved, synced, and deferred-delete scenarios render honestly; info suppresses Saved; at most one compact notification renders.
3. Terminal `sync-error`/`deferred-delete-retrying` persists until explicit acknowledgement, blocks earlier and later Saved/Synced, and cannot be overwritten by offline/syncing/pull completion.
4. Resume, hydration, successful main pull, and successful shared pull render zero success notifications; stale generations, unmounted Export work, and superseded users publish no status.
5. Historical scrolling causes no warnings or mutation. This is Chunk B's half of the joint historical-scroll target; C1 remains responsible for final historical editability closure.
6. B1–B3 interaction preserves B1 timing/accessibility, B2 copy/dedupe/safe-area geometry, B3 selection pressure propagation and sync error reporting, plus A1–A4 behavior.

## Required validation

1. Enumerate and test cross-task pairs: B1 scroll safety x B2 notification routing; B2 arbiter x B3 terminal persistence; B2 success lifetime x B3 pull silence; B3 terminal precedence x later online/offline `flashSaved`; B3 shared-pull reporting x cleanup/current-user guards.
2. Run focused `saved-flash-harness.ts`, `offline-indicator-harness.ts`, `pull-on-resume-harness.ts`, and `setup-touch-target-harness.ts` proofs, including compile-real source/model/rendered mutations.
3. Run full 24-harness matrix in one captured run. Exact accepted result remains 22/24; only unchanged `muted-text-color-harness.ts` AuthView byte lock and final `saved-flash-harness.ts` whole-App reconstruction byte lock may fail. Any other failure blocks PASS.
4. Re-run relevant delete/undo, confirmation, semantic status, tire, Quick Adjust, and A1–A4 regressions.
5. Verify signed-out 360x800, 390x844, 412x915, and 1080x2118 shells at Standard and Large where applicable: no overflow, controls >=44px, safe-area/top notification/nav containment, pinch zoom enabled, focus/keyboard intact, console clean. No credentials. Authenticated scenarios remain unclaimed unless authorized credentials already exist.
6. `npm run lint` must match exact three-error baseline; `npm run build` must pass with 566 modules.
7. Audit cumulative B1–B3 diff against Part 5 and boundary statement 5.2, with line-by-line attention to `src/lib/sync.ts`: error reporting only; no payload, merge, throttle, generation, queue, delete, zero-row, lifecycle, or successful-pull behavior drift.
8. Verify exact HEAD, clean worktree, `git diff --check`, protected paths, commit history, and cavecrew reviewer.
9. Return strict PASS/FAIL and score. On PASS, recommend Ralph-only closure of B4 and opening Task C1 for one Terra High initial build. Do not advance Ralph in this QA turn.

## Exclusions and bans

No edits, commits, B3 repair, C1 implementation, Chunk C/D/E work, schema, RLS, migrations, Supabase configuration, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Preserve dual weekend-delete, team-owner canonical writes, deferred delete queue, UXN-1 filtering, UXN-3 pull throttle/generation isolation, setup lifecycle meaning, local-only active IDs, pinch zoom, accessibility, safe areas, and every Part 5 boundary.
