# Current Task — Final QA Repair 2: Global 44px Native-Control Floor

**Status:** ACTIVE SOL High implementation repair after Final Full-Sprint QA attempt 2 failed 88/100 on authenticated Android touch-target geometry.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Repair base:** exact governance HEAD containing this work order, on QA base `e92bf29411ebf9521740acd90296c41c6986c69b` and accepted Repair 1 `810d918d4d492270f4474c898f160c3a4450e387`.
**Roles:** one `gpt-5.6-sol` High implementation worker; primary `gpt-5.6-sol` Extra High independently QAs. Terra at every tier and `cavecrew-builder` remain forbidden.
**Communication/delegation:** `/caveman full`; cavecrew investigator/reviewer contracts only.

## Failure evidence

Fresh installed debug product was inspected through the Android WebView DOM at its actual 448×997 CSS viewport while the visible Large scale was active (`--ui-zoom: 1.15`). Required native controls below the absolute 44px touch floor include:

- Setup new-name input: 43.39px high.
- Setup Clone and Compare buttons: 41.39px wide.
- Loads actions: 36.8–41.4px high.
- Tires Add action: 41.4px high.
- Quick Adjust fields: 43.4px high.
- Maintenance Logs close action: 27.6px square.
- Accounting filter: 38.8px high.
- Export filters: 43.4px high.

Default scale uses `1.0`, so every padding-only control is smaller there. Source proves `src/index.css` has an opt-in `.tap-target` 2.75rem floor; the failing controls never opt in. Setup Clone/Compare are 24px icons plus 6px padding per side, exactly matching the measured 36px nominal and 41.4px Large result. Latent Setup states also include Use Setup, input-backed Add File, and the 20×20px attachment-delete button.

Current `scripts/setup-touch-target-harness.ts` incorrectly passes 48 assertions and 12 mutations because it counts selected class tokens and hand-builds limited fixtures; it never renders the failing Setup create/card controls or enforces a shell-wide native-control floor.

## Exact repair scope

Edit only:

1. `src/index.css`
2. `scripts/setup-touch-target-harness.ts`

No component file is authorized. If these two files cannot close the gate without changing semantics, stop and return `needs-confirm` with exact evidence. Do not expand scope.

## Required product repair

In `src/index.css`, add one auditable global hardening rule that:

- gives every visible native `button`, text-like `input`, `select`, and `textarea` a minimum height of exactly 2.75rem;
- gives every native `button` a minimum width of exactly 2.75rem;
- gives labels that are the actual hit area for nested file, checkbox, or radio inputs a minimum 2.75rem hit area in both dimensions;
- excludes hidden/file/checkbox/radio native inputs themselves where applying the native field box would expose hidden controls or enlarge only the visual glyph;
- preserves existing `.tap-target`, `.tap-target-block`, NumberStepper, bottom-nav, zoom, focus, keyboard, disabled, pointer, safe-area, and fine/coarse-scrollbar rules;
- changes no visible text, handler, state, persistence, sync, data shape, or component markup.

The rule must work at both Default `1.0` and Large `1.15`; scale multiplies the floor, never reduces it.

## Required proof repair

Extend `scripts/setup-touch-target-harness.ts` with production-derived compiled/rendered proof. It must read the real CSS and relevant production source; a regex-only or hand-written class approximation is insufficient.

Cover at 360×800, 390×844, 412×915, and 1080×2118, each at Default `1.0` and Large `1.15`:

- Setup new-name input, Clone, Compare, conditional Use Setup, input-backed Add File, and attachment delete;
- Loads actions and compact icon actions;
- Tires Add action;
- Setup Compare selects;
- Quick Adjust inputs/selects;
- Checklist effective checkbox row target;
- Maintenance Log action/close controls;
- Accounting filter;
- Export input-backed switch and selects;
- existing Auth, Settings, Race Day, header, ContextStrip, NumberStepper, Four Bar, and bottom-nav floors.

For each visible direct native control, rendered height must be at least `44 * scale`; compact/icon buttons must also be at least `44 * scale` wide. For checkbox/file/radio glyphs, prove their actual input-backed label or existing semantic row hit area is at least `44 * scale` without requiring the visual glyph itself to become 44px. Prove zero horizontal overflow and no control clipping at every case.

Kill at least these independent mutations through rendered production geometry:

1. remove the global height floor;
2. change 2.75rem to 2.6875rem / 43px;
3. remove the button width floor;
4. accidentally exempt buttons from the rule;
5. remove the input-backed label floor;
6. restore/retain the 20px attachment-delete geometry without the global override.

Every mutation must independently fail a rendered gate, not only a source regex.

## Worker gates before commit

1. Verify runtime metadata is `gpt-5.6-sol`, effort `high`; missing metadata is unverified and must be reported.
2. Verify exact worktree, branch, repair-base HEAD, and clean tree.
3. Run focused `scripts/setup-touch-target-harness.ts`; report exact assertions and killed mutations.
4. Run focused scale, density, stepper, C2.5, Loads, Tires, Quick Adjust, checklist, accounting, export, help, offline/resume, and Saved/status regressions.
5. Run all 24 harness files in one raw Windows capture; exact 24/24 required.
6. `npm run lint`: exact three known baseline errors only.
7. `npm run build`: exactly 566 transformed modules.
8. Verify exact two-file diff, `git diff --check`, protected paths, and clean post-commit tree.
9. Obtain cavecrew reviewer findings-first PASS.
10. Commit exactly the two authorized files with a task-identifying repair message. No deploy, APK, data action, push, PR, merge, production, release, native, package, config, schema/RLS/migration/edge, or Sprint 4 change.

## Independent QA after worker commit

Primary reruns all worker gates from clean exact commit, then installs a fresh Java 21 debug APK and remeasures every required authenticated Android page at Default and Large. PASS requires zero direct native target below 44px, every input-backed/effective target at least 44px, zero overflow/clipping, unchanged interaction behavior, raw 24/24, lint3, build566, exact scope, clean tree, and independent review.

Only after Repair 2 passes does Final Full-Sprint QA attempt 3 resume. Authorized device-only/everywhere cleanup remains last. Handoff, final governance, draft/debug deliverables, and saving-point push remain blocked until final PASS.

## Hard bans

No primary product implementation before the three-consecutive-failure escalation; no Terra or cavecrew-builder; no component edit; no weakened/removed assertion; no credentials in files/output/contracts; no live-data deletion during repair; no other-user/account/auth/team/membership deletion; no production Netlify publish; no signed/release APK/AAB or `release/` change; no native source/version; no package/config; no schema/RLS/migration/edge; no PR, master merge/push, or Sprint 4 IA.
