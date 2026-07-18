# Current Task — UX Overhaul v2 Chunk C Integrated QA Gate

**Status:** READY FOR `gpt-5.6-sol` EXTRA HIGH READ-ONLY QA. C5 is accepted at 100/100. Chunk D and every later task remain blocked until this integrated gate passes.
**Branch:** `codex/ux-overhaul`
**Accepted product baseline:** `1a3d49286d06322f7909f7226c01ca6a0d355edc`
**Chunk C comparison base:** `00ed702e7966370285e596e86742ea75d0c0fdd3` (parent of C1)
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Chunk C, Part 5, Part 6.2, and the binding v2.1 Owner Addendum
**Runtime routing:** the primary QA/plan authority must execute as `gpt-5.6-sol` **Extra High**. Runtime `turn_context.payload.model` and effort are authoritative; missing metadata is `unverified` and cannot satisfy this gate. This is a QA task, not an implementation dispatch. Terra at every tier and `cavecrew-builder` are forbidden.

## Accepted Chunk C commits

1. C1 editability: `82e6acf`
2. C2 product snapshot/diff engine: `253897a` (builder tree `32135814`)
3. C2 EOL-only harness portability repair: `13b556f`
4. C2.5 stacked stepper product: `8ab870a`
5. C2.5 bounded geometry repair: `2235c7d`
6. C3 session diff UI: `e8d7016`
7. C4 Saved boundaries: `83230c9`
8. C5 setup naming and rename affordance: `1a3d492`

Ralph/plan/owner-report commits between these product commits are governance only. No product repair is presently indicated.

## QA-only scope

Read, test, deploy a Netlify draft, and build/install a debug APK for verification. Do not edit product, harness, native, package/config, schema, migration, sync, or Git history during the QA phase. After the verdict, the primary may update only:

1. `ralph/STATE.md`
2. `ralph/CURRENT_TASK.md`
3. `docs/UX_TECHNICAL_REVIEW_2026-07-17.md`
4. `docs/OWNER_REPORT_UX_OVERHAUL.md`

If any gate fails, record the exact failure and issue a narrow `gpt-5.6-sol` High repair work order. Do not start Chunk D. The same-attempt escalation counter and all standing bans remain binding.

## Integrated acceptance

### C1 editability and lifecycle meaning

1. One canonical typed predicate still governs App and Setups behavior.
2. Baseline, final, `lockedAt`, and finished-weekend historical definitions are meaning-equivalent to the pre-C1 base.
3. A deliberate edit or delete against historical data changes zero bytes and produces no dirty mark, Saved, cloud write, or warning toast.
4. The active event-owned setup is edit-frozen while the live Race Day is active; unrelated Current setups remain editable, renameable, and deletable.

### C2 snapshots and zero-log hot path

1. Session creation resolves the canonical weekend setup once and uses that same source for `setupSnapshot`, `setupId`, and `setupUsed`.
2. Snapshots are detached deep plain data with the exact ordered tune allowlists, complete top/corner fields, and no identity, lifecycle, transient, media, or noise fields.
3. Legacy sessions with no snapshot remain compatible.
4. Diff rows stay deterministic for changed, equal, null, and noise cases.
5. The App hot path does not call `withSetupDiffLog`; existing historical `changeLog` bytes remain readable and unchanged.
6. Sessions JSON sync/pull round-trips without schema or sync changes.

### C2.5 phone geometry

1. LF/RF/LR/RR corner-card field rows align at 360, 390, and 412px in Default and Large.
2. Every stepper uses value-on-top with side-by-side minus/plus controls below; every control is at least 44px and no card overflows.
3. NumberStepper timing, hold, pointer, keyboard, ARIA, and commit behavior remain unchanged.

### C3 session diff and Quick Adjust coexistence

1. Pending current-vs-latest-snapshot rows are computed, ordered, labeled for the next session, and never persisted as legacy rows.
2. Bound session summaries derive from that session's own frozen snapshot and correct prior baseline, including provenance/legacy fallback.
3. Quick Adjust retains its in-run net rows and never duplicates a session diff or legacy row.
4. The owner scenario remains correct: starting setup -> hotlaps -> setup edits -> qualifying creation -> qualifying shows its start-state snapshot and the diff since hotlaps.
5. `Log setup changes` routes to Setups; run notes and existing session actions remain unchanged.

### C4 immediate persistence and boundary-only confirmation

1. Every accepted mutation updates React state and localStorage immediately before a dirty mark; existing cloud timing stays unchanged.
2. N edits produce zero immediate Saved messages. One dirty tab leave, hidden/pagehide, native inactive, exact 30-second interval, or successful session creation produces exactly one confirmation.
3. Clean/repeated boundaries produce nothing; terminal sync/error/info arbitration remains truthful and cannot resurrect Saved.
4. Process death before confirmation loses zero data.

### C5 naming and rename

1. Empty/whitespace blank creation produces zero records/writes/selection/dirty/Saved and exposes the accessible exact hint `Name this setup` when the guarded handler is invoked.
2. Valid blank names trim and create exactly one Current setup with no `Setup #N` fallback.
3. Copy with no typed name remains frictionless and receives a meaningful source-based name; a typed trimmed name wins.
4. Editable cards expose one discoverable pencil with a minimum 44x44px target at 360px. Pencil-only action stops propagation, expands the exact card, focuses its exact existing Chassis input, and performs zero persistence/dirty/Saved work.
5. Typing through the existing field persists immediately and confirms only at a C4 boundary. Rename survives relaunch without lifecycle/version/provenance drift.
6. Historical and active event-owned cards remain view-only and expose no rename action.

## Required cross-task pairings

Enumerate and test at least these integrated interactions before the verdict:

1. C1 editability x C5 pencil/rename.
2. C2 frozen snapshots x C3 pending and bound diff UI.
3. C2 zero-log hot path x C4 dirty boundaries.
4. C3 Quick Adjust net rows x C2/C3 session diffs, proving no duplication.
5. C2.5 stacked steppers x B1 pointer/scroll semantics x C4 no-false-Saved behavior.
6. C3 successful session creation x C4 one boundary confirmation and B2/B3 arbiter priority.
7. C5 immediate rename persistence x C4 delayed confirmation x force-stop/relaunch.
8. C1 live event-owned freeze x C5 unrelated Current rename.

## Exact gates

1. Verify runtime model/effort, branch, actual HEAD, clean tree, comparison base, commit ancestry, and `git diff --check` before and after QA.
2. Audit `00ed702e...1a3d492` line-by-line. Product scope may include only the accepted C1-C5 paths. Protected sync/schema/RLS/migration/native/package/release/credential paths must have zero Chunk C product diff; governance-only docs and assertion-only harness modernizations must be classified separately.
3. Run the production-bound setup harness, Saved-boundary harness, lifecycle, Quick Adjust, offline/resume, tires, touch/pointer, confirmation/status, and session-binding regressions. Every accepted assertion and independent mutation from C1-C5 must remain green.
4. Run the raw full 24-harness matrix. It must be exactly **23/24**, with only the unchanged `muted-text-color-harness.ts` stale AuthView byte lock failing. No other waiver is allowed.
5. `npm run lint` must report exactly the three known baseline errors and no new error.
6. `npm run build` must succeed with exactly 566 transformed modules.
7. Deploy the exact build to the explicit Crew Chief Netlify site as a draft only. Inspect the signed-out shell at 360x800, 390x844, 412x915, and 1080x2118: exact viewport, auth gate only, no horizontal overflow, visible controls at least 44px, pinch-enabled viewport metadata, and zero product console warnings/errors.
8. Run authenticated owner scenarios at 360x800, 390x844, and 412x915 in light/dark and Default/Large. Cover corner geometry, pending/bound diffs, Quick Adjust coexistence, blank/copy/named setup creation, rename focus, event-owned view-only state, immediate persistence, boundary confirmation, keyboard/focus, nav/safe-area clearance, and relaunch persistence.
9. Run `npx cap sync android`; build only a Java 21 debug APK; install it on `emulator-5554`; run the authenticated process-death, background, timer, session-create, and rename-relaunch scenarios. Restore any temporary emulator display override afterward. No release build, signing, distribution, or native source edit.
10. Obtain an independent `cavecrew-reviewer` cumulative diff/protected-path/behavior review. A reviewer finding blocks PASS until resolved.
11. Record a strict PASS/FAIL score and exact evidence in Ralph, keep the plan current, and update the owner report in full plain English.

## PASS transition

On PASS, close Chunk C, recommend an owner review checkpoint, and issue the next work order for Chunk D Task D1 in plan order. Do not implement D1 in the same QA turn. Chunk D remains serial and its ISOLATED scope is binding.

## Hard bans

No Chunk D/E implementation during this gate; no lifecycle-definition change; no snapshot/model or session payload change; no Quick Adjust semantics change; no C4 dirty/boundary/arbiter change; no sync timing/payload/merge/throttle change; no schema/RLS/migration/Supabase configuration change; no native source or Android version/signing change; no release artifact; no production Netlify publish; no Git push; no merge; no `master` change; no credentials. Preserve all A1-C5 acceptance, dual-write behavior, owner/team scoping, deferred deletes, offline/resume behavior, safe areas, pinch zoom, themes, and accessibility. Terra and `cavecrew-builder` remain forbidden.
