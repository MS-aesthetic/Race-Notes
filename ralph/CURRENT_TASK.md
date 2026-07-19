# Current Task — UX Overhaul v2 Final Full-Sprint QA Attempt 2 and Handoff

**Status:** ACTIVE Part 6.3 read-only QA attempt 2. Final QA Repair 1 passed 100/100 at `810d918d4d492270f4474c898f160c3a4450e387`; all product work A1–E3 is complete. Primary `gpt-5.6-sol` Extra High owns QA, plan authority, Ralph, owner reporting, and the Part 6.4 handoff. Any failed gate creates a separate bounded SOL High repair work order; primary does not implement unless the plan's three-consecutive-failure escalation is reached.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**QA base:** exact clean `810d918d4d492270f4474c898f160c3a4450e387`, including one-file muted-text proof repair on governance parent `50cc686f43ee46414c7a377f2640fccae8dc5ef5` and E3 product ancestor `f6e918174cc22a16eeabf59ef106bcb26b97a8b2`.
**Authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Parts 2–4, 5.2, 6.3, 6.4, all acceptance targets, and the binding v2.1 Owner Addendum; `ralph/STATE.md`; `SPRINT_INDEX.md`; `AGENTS.md`.
**Communication/delegation:** `/caveman full`; cavecrew investigator/reviewer contracts only. Terra at every tier and `cavecrew-builder` remain forbidden.

## Repair closure

Independent QA verifies Repair 1 exactly:

- `scripts/muted-text-color-harness.ts` only; product, governance, native, config, and every other harness byte frozen.
- 232 assertions and 11/11 independent mutations pass.
- Historical UXP-17 remains exact 105 migrations, 16 components, eight historical opacity exceptions, and 17 source files against pinned history.
- Current state remains exact 105 muted sites across the same 16 components: Setup `+1`, Race Weekend `-1`; accepted C3 and D3 deltas leave exactly six current opacity exceptions.
- Raw Windows matrix is exact 24/24; lint is the exact three known product errors; build is exactly 566 modules; cavecrew review PASS 100; tree clean.

The attempt-1 work order incorrectly said seven current opacity exceptions. Exact history proves six: original eight minus accepted C3 Race Compare and accepted D3 Garage disabled-state changes. The harness and this work order carry the corrected value.

## Read-only QA rule

Until a verdict is reached, do not edit product, harness, Ralph, plan, owner report, handoff, Git history, or external data except the explicitly authorized bounded QA interactions below. If any acceptance, suite, visual, data-trust, boundary, or reviewer gate fails, stop final certification, record a strict FAIL and exact repair order in governance only, then dispatch one SOL High worker. Do not silently waive or repair a failure during QA.

## Required final gates

### 1. Runtime, ref, ancestry, and task map

- Verify primary runtime metadata is `gpt-5.6-sol`, effort `xhigh`; missing metadata is unverified and cannot produce a verified final verdict.
- Verify exact pinned 203f worktree, branch, clean tree, repair/E3 ancestry, and one task-identifying commit chain for every A1–E3 task, repair, and chunk gate.
- Produce exact task-to-accepted-commit map, including failed attempts and SOL-only v2.1 routing deviations.

### 2. Complete Windows proof

- Run all 24 `scripts/*-harness.ts` files in one raw capture: exact 24/24 required.
- Run the focused cross-task set covering scale/density/touch, Save Run reservation, stepper pointer behavior, status/Saved arbitration, resume/offline, lifecycle/snapshots/diffs/Quick Adjust, setup naming, help, labels, confirmation, ownership, D1/D2/D3 deletion, native auth, E3 scrollbar/source boundaries, and muted-text history/current contracts.
- `npm run lint` must report exactly the three known baseline errors and no new error.
- `npm run build` must succeed with exactly 566 transformed modules.

### 3. Cross-task interaction matrix

Exercise and record:

1. A1 scale × A4 density × A2 sticky Save Run reservation.
2. B1 pointer semantics × B2 notification arbiter × B3 terminal status × C4 commit boundaries.
3. C1 editability × C2/C3 snapshots/diffs × D1/D2/D3 deletion integrity.
4. C4 immediate persistence/quiet feedback × D2 device/everywhere clear behavior.
5. D1 selected-row zero detection × D2 ownership enumeration × D3 dependency/car-last cascade and pull filtering.

### 4. Owner complaint and v2.1 scenarios

- Scale migration/reset and Default/Large/Extra Large behavior; pinch enabled; scale/theme device-local.
- App-wide density/readability: visible values >=14px, controls >=44px, no overlap/clipping/overflow, two setup columns, accepted Four Bar/Tire geometry, nothing behind bottom nav.
- Dirty-only Save Run reservation and four distinct tire-pressure regions at both visible scales.
- Touch scroll over steppers gives zero writes/toasts; tap commits once; hold remains 350ms then 100ms.
- Historical setup byte immutability, unrelated live-event edit/delete, rename, blank-name zero-write, and copy auto-name.
- Starting Setup → Hot Laps → Quick Adjust → Qualifying: pending/bound deltas match; older snapshot immutable; legacy log/navigation preserved.
- Immediate local persistence plus one boundary Saved; clean boundaries silent; process death loses no edit; info/terminal states truthfully suppress Saved.
- Context-aware App Guide every tab, Setup/Four Bar targets, Tuning Guide separation, Back/tab stale-context clearing.
- All Add/New opener → Create submit pairs and Save edit labels.
- Setup corner picker label exactly `Tire`; no visible `Tire from Inventory`; placeholder/options/handler/persistence unchanged; no collision with `Bound Load Graph` at 360/390/412 Default+Large.
- C2.5 corner alignment/stacked steppers at 360/390/412 Default+Large; NumberStepper timing unchanged.
- E3 active guards/cleanup catch, fine-pointer visible scrollbars, coarse-pointer hidden scrollbars, comments-only location runtime.

### 5. Browser and Android matrix

- Create one final Netlify draft only. Inspect signed-out shell at 360×800, 390×844, 412×915, and 1080×2118: exact viewport, auth gate, no overflow, >=44px controls, pinch metadata, fine-pointer scrollbar affordance, zero console warning/error.
- Build with Java 21 using `npx cap sync android` and `gradlew assembleDebug`; install only debug APK on the already-running emulator. No version, signing, release, or native-source change.
- In existing authenticated Android state, inspect Dashboard, Setups, Loads, Tires, Compare, Runs, Checklist, Maintenance Logs, Accounting, Garage, Account, Style, Export, Guide, and relevant sheets/forms at required phone widths, Default/Large, light/dark. Use DOM-derived targets.
- Verify 1080×2118 capture behavior, focus/keyboard, safe areas, bottom-nav clearance, no horizontal overflow, no undersized control. Restore emulator display/theme/scale and close forms.
- Capture crash buffer and product JavaScript errors. Known WebView variations-seed and pre-root Capacitor safe-area diagnostics remain residuals only if unchanged.

### 6. Authorized data-trust sequence

Use only the dedicated signed-in account already present on the emulator; never expose/store credentials. Complete all data-dependent visual/session scenarios before destructive cleanup.

- Use deterministic mocks for RLS blocked/zero-row/Nth-failure branches.
- Verify device-only clear first and confirm cloud data returns as warned.
- Run everywhere deletion last; target only canonically owned racing records and personal tires. Never another member's data, account, authentication record, team, or membership.
- Wait through resume pulls; verify no owned racing-data resurrection; leave owned racing data cleared.
- Remove all bounded QA fixtures before PASS.

### 7. Whole-branch boundary audit

Audit `master...final HEAD` against §5.2. Only D1 selected-row zero detection, D2 ownership-limited clear-data, and C1 bounded `in-play-elsewhere` demotion may change protected meaning. Confirm unchanged dual weekend delete, canonical ownership writes, deferred queue format/five-second retry, UXN-1 pull filtering, 30-second resume throttle, auth-generation isolation, lifecycle roles/history, device-local active IDs, pinch/focus/keyboard/safe-area, and Sprint 4 IA deferral. Confirm zero schema/RLS/migration/edge, native source/version, package/config, release/signing, production deploy, master merge, or unauthorized remote action.

Document these accepted plan/code tensions:

- “3 four-bar columns” shorthand versus accepted Bar Length full-width plus two adaptive hole columns;
- title-case preference versus accepted uppercase-styled `CREATE RACE DAY` source;
- historical Terra wording in `SPRINT_INDEX.md` versus binding v2.1 SOL-only override.

### 8. Review, verdict, and deliverables

- Obtain independent cavecrew whole-branch findings-first verdict.
- PASS only if every gate and cleanup passes. Otherwise record exact repair files, behavior, proof, and bans.
- On PASS update `ralph/STATE.md`, `ralph/CURRENT_TASK.md`, this plan snapshot, and `docs/OWNER_REPORT_UX_OVERHAUL.md`; create `docs/HANDOFF_UX_OVERHAUL_V2_2026-07-19.md` exactly to Part 6.4. Handoff is a briefing packet, not a third-party verdict.
- Commit only final governance/handoff files after cavecrew review. Push `codex/ux-overhaul` as owner-requested saving point. No PR or merge.
- Return detailed owner explanation: completed work, failures/repairs, what remains, final draft URL, debug APK path/size/hash, push SHA, residuals, and confirmation production/release/master untouched.

## Hard bans

No primary implementation before three consecutive failed repair attempts; no Terra or cavecrew-builder; no product/harness edits during QA; no other user's data; no account/auth/team/membership deletion; no credential disclosure/storage; no production Netlify publish; no signed/release APK/AAB or `release/` change; no schema/RLS/migration/edge; no PR, master merge, or master push; no Sprint 4 IA. Draft previews, debug emulator APKs, exact-owner data cleanup, governance/handoff documentation, and final `codex/ux-overhaul` saving-point push are authorized.
