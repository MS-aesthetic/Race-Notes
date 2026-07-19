# Current Task — UX Overhaul v2 Final Full-Sprint QA and Handoff

**Status:** ACTIVE Part 6.3 read-only QA. E3 passed 100/100 on attempt 1 at `f6e918174cc22a16eeabf59ef106bcb26b97a8b2`. Primary `gpt-5.6-sol` EXTRA HIGH owns QA, plan authority, Ralph, owner reporting, and the Part 6.4 handoff. No implementation worker is active. Any failed acceptance gate creates a separate bounded SOL High repair work order; primary does not implement unless the plan's three-consecutive-failure escalation is reached.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**QA base:** the exact clean governance commit containing this work order, with E3 `f6e918174cc22a16eeabf59ef106bcb26b97a8b2` as its direct product ancestor.
**Authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Parts 2–4, 5.2, 6.3, 6.4, all acceptance targets, and the binding v2.1 Owner Addendum; `ralph/STATE.md`; `SPRINT_INDEX.md`; `AGENTS.md`.
**Communication/delegation:** `/caveman full` for working notes and verdicts; cavecrew investigator/reviewer contracts only. Terra at every tier and `cavecrew-builder` remain forbidden.

## Objective

Independently certify the completed A1–E3 branch as one system. Reproduce every owner complaint and v2.1 addition, test the cross-task interactions that isolated task QA cannot prove, run the complete suite in one Windows capture, audit the whole branch against protected boundaries, produce final draft/debug artifacts, and write the cold-reader Part 6.4 handoff. A task-level or chunk-level PASS does not waive a final gate.

## Read-only QA rule

Until a verdict is reached, do not edit product, harness, Ralph, plan, owner report, handoff, Git history, or external data except the explicitly authorized bounded QA interactions below. If any acceptance, suite, visual, data-trust, boundary, or reviewer gate fails, stop final certification, record a strict FAIL and exact repair order in governance only, then dispatch one SOL High worker for that repair. Do not silently waive or repair a failure during QA.

The existing `muted-text-color-harness.ts` failure is not pre-waived. Part 6.1 requires a green suite and Part 6.3 requires the complete suite in one run. If the final raw run is still 23/24, independently prove whether it is a stale assertion or product regression, then record final QA FAIL and issue a harness-only or product repair order as evidence requires.

## Required final gates

### 1. Runtime, ref, ancestry, and task map

- Verify primary runtime metadata is `gpt-5.6-sol`, effort `xhigh`; missing metadata is unverified and cannot produce a verified final verdict.
- Verify exact pinned 203f worktree, branch, clean tree, E3/governance ancestry, and one task-identifying commit chain for every A1–E3 task, repair, and chunk gate.
- Produce an exact task → accepted commit map, including failed attempts and the SOL-only routing deviations recorded in v2.1.

### 2. Complete Windows proof

- Run all 24 `scripts/*-harness.ts` files in one raw capture and preserve verbatim per-file results. Final PASS requires 24/24.
- Rerun the cross-task focused set covering scale/density/touch, Save Run reservation, stepper pointer behavior, status/Saved arbitration, resume/offline, lifecycle/snapshots/diffs/Quick Adjust, setup naming, help, labels, confirmation, ownership, D1/D2/D3 deletion, native auth, and E3 scrollbar/source boundaries.
- `npm run lint` must report exactly the three known baseline errors and no new error.
- `npm run build` must succeed with exactly 566 transformed modules.

### 3. Cross-task interaction matrix

Exercise and record these combinations as systems:

1. A1 scale × A4 density × A2 sticky Save Run reservation.
2. B1 pointer semantics × B2 notification arbiter × B3 terminal status × C4 commit boundaries.
3. C1 editability × C2/C3 session snapshots/diffs × D1/D2/D3 deletion integrity.
4. C4 immediate persistence/quiet feedback × D2 device/everywhere clear behavior.
5. D1 selected-row zero detection × D2 ownership enumeration × D3 dependency/car-last cascade and pull filtering.

### 4. Owner complaint and v2.1 scenarios

- Scale migration/reset and Default/Large/Extra Large behavior; pinch remains enabled and scale/theme stay device-local.
- Full density/readability: every visible value at least 14px, controls at least 44px, no overlap/clipping/overflow, two setup columns, intended Four Bar/Tire stacked geometry, and no content behind the bottom nav.
- Dirty-only Save Run reservation; four distinct tire-pressure control regions at both visible scales.
- Real touch scroll over steppers produces zero writes/toasts; tap commits once; hold timing remains 350ms then 100ms.
- Historical setup byte immutability, unrelated live-event setup edit/delete, findable rename, blank-name zero-write rejection, and copy auto-name.
- Starting Setup → Hot Laps → Quick Adjust → Qualifying snapshot/diff sequence: pending and bound deltas match; older snapshot is immutable; legacy log and navigation remain.
- Immediate local persistence plus one boundary Saved; clean boundaries silent; process death loses no edit; info/terminal statuses suppress or replace Saved truthfully.
- Context-aware header App Guide on every tab, Setup and Four Bar targets, Tuning Guide separation, Back/tab stale-context clearing.
- All four Add/New opener → Create submit pairs and both Save edit labels.
- Setup corner-card picker label is exactly `Tire`; visible `Tire from Inventory` must not return. Preserve the picker placeholder, options, handler, and persistence semantics, and visually prove the label cannot collide with `Bound Load Graph` at 360/390/412 in Default and Large.
- C2.5 corner-card row alignment and stacked stepper geometry at 360/390/412 in Default and Large; NumberStepper timing bytes unchanged.
- E3 active guards/cleanup catch, fine-pointer visible scrollbars, coarse-pointer hidden scrollbars, and comments-only location runtime.

### 5. Browser and Android matrix

- Create one final Netlify draft only. Inspect signed-out shell at 360×800, 390×844, 412×915, and 1080×2118: exact viewport, auth gate, no overflow, >=44px controls, pinch metadata, fine-pointer scrollbar affordance, and zero console warning/error.
- Build with Java 21 using `npx cap sync android` and `gradlew assembleDebug`; install only the debug APK on the already-running emulator. No version, signing, release, or native-source change.
- In the existing authenticated Android state, inspect Dashboard, Setups, Loads, Tires, Compare, Runs, Checklist, Maintenance Logs, Accounting, Garage, Account, Style, Export, Guide, and all relevant sheets/forms at required phone widths, Default and Large, light and dark. Use DOM-derived targets; do not guess coordinates.
- Verify 1080×2118 owner-capture behavior, focus/keyboard, safe areas, bottom-nav clearance, no horizontal overflow, and no undersized control. Restore emulator display/theme/scale and close every form after testing.
- Capture Android crash buffer and product JavaScript errors. Known WebView variations-seed and pre-root Capacitor safe-area diagnostics may be recorded as residuals only if unchanged and not masking an app defect.

### 6. Authorized data-trust sequence

The owner explicitly authorized deletion testing only on the dedicated signed-in account already present on the emulator. Do not expose or store credentials. Do all data-dependent visual/session scenarios before destructive cleanup.

- Use deterministic mocks for RLS blocked/zero-row/Nth-failure branches.
- On the dedicated account, verify device-only clear first and confirm cloud data can return as warned.
- Run everywhere deletion last; target only canonically owned racing records and personal tires; never another member's data, account, authentication record, team, or membership.
- Wait through resume pulls and verify deleted owned racing data does not resurrect. Leave the account's owned racing data cleared at final handoff.
- Any temporary local/cloud QA fixture must be named, bounded, and removed before PASS.

### 7. Whole-branch boundary audit

Audit `master...final HEAD` line-by-line against §5.2. Confirm the only protected semantic changes are D1's selected-row zero detection, D2's ownership-limited clear-data path, and C1's bounded `in-play-elsewhere` editability demotion. Confirm unchanged meaning for dual weekend delete, canonical ownership writes, deferred queue format and five-second retry, UXN-1 pull filtering, 30-second resume throttle, auth-generation isolation, setup lifecycle roles/history, device-local active IDs, pinch/focus/keyboard/safe-area contracts, and Sprint 4 IA deferral. Confirm zero schema/RLS/migration/edge, native source/version, package/config, release/signing, production deploy, master merge, or unauthorized remote action.

Independently adjudicate and document these known plan/code tensions rather than hiding them:

- acceptance shorthand says “3 four-bar columns,” while accepted C2.5 intentionally uses Bar Length full-width plus two adaptive hole columns;
- Part 2 prefers title case, while accepted E2 preserves the existing uppercase-styled `CREATE RACE DAY` source text;
- `SPRINT_INDEX.md` still contains historical Terra routing, while the v2.1 Addendum and current state supersede it with SOL-only workers.

### 8. Review, verdict, and deliverables

- Obtain independent cavecrew whole-branch reviewer verdict with findings first.
- Score strictly. PASS only if every required gate is satisfied and all temporary QA state is cleaned. Otherwise provide exact repair files, behavior, proof, and bans.
- On PASS, update `ralph/STATE.md`, `ralph/CURRENT_TASK.md`, this plan's progress snapshot, and `docs/OWNER_REPORT_UX_OVERHAUL.md`; create `docs/HANDOFF_UX_OVERHAUL_V2_2026-07-19.md` exactly to Part 6.4. The handoff is a briefing packet, not a third-party verdict.
- Commit only the final governance/handoff files after cavecrew review. Then push `codex/ux-overhaul` as the owner-requested saving point. Do not open a PR or merge.
- Return a detailed plain-English owner explanation: all work completed, failures/repairs, what remains, final draft URL, debug APK path/size/hash, Git push SHA, known residuals, and explicit statement that production/release/master remain untouched.

## Hard bans

No primary implementation before three consecutive failed repair attempts; no Terra or cavecrew-builder; no product/harness edits during QA; no other user's data; no account/auth/team/membership deletion; no credential disclosure/storage; no production Netlify publish; no signed/release APK/AAB or `release/` change; no schema/RLS/migration/edge change; no PR, master merge, or master push; no Sprint 4 IA. Draft previews, debug emulator APKs, exact-owner data cleanup, governance/handoff documentation, and the final `codex/ux-overhaul` saving-point push are the only external/write actions authorized here.
