# Current Task — UX Overhaul v2 Task B2: Notification Arbiter, Unified Copy, Top Toast

**Status:** READY — one Terra High initial build; SOL light QA next; B3 blocked
**Branch:** `codex/ux-overhaul`
**Dependency:** B1 final QA PASS 98/100 at repair commit `72c34ac`; Chunk A and B1 are closed
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 9 including N3, Part 5 Task B2/Chunk B, Part 6.1, and boundary statement 5.2
**Runtime model:** Required builder role is Terra High. Verify from runtime metadata; report `unverified` only if metadata is absent.

## Role and sequencing

Terra receives one initial implementation pass. Implement B2 only, commit product and harness together, then stop for independent SOL light QA. Any QA failure transfers fixes to SOL; Terra is not re-invoked. Do not begin B3 or Chunk C.

## Permitted files

- `src/App.tsx` — notification state/arbiter and toast renderer only, centered on current `infoToast`, `savedFlash`, `flashSaved`, sync-display block near roadmap lines 1443 and 2213–2244 including 2221–2233, and final `InfoToast` render
- `src/components/SetupView.tsx` — only roadmap notification/copy sites near lines 336, 351, and 584–586; setup editing, persistence, lifecycle, and layout otherwise frozen
- `scripts/saved-flash-harness.ts` — B2 source/behavior/rendered geometry and mutation proof; retain B1 proof and stale-lock provenance/order

No other file is permitted. Keep diff narrow inside these named concerns even within permitted files.

## Required behavior

1. Create one notification arbiter for transient info and Saved/sync-success display. An active info notification replaces/suppresses Saved; both must never co-render.
2. Use one visible-copy source keyed by reason for B2-targeted notifications. Remove duplicate historical-setup warning copy from transient channels; the historical setup card banner remains the only passive historical communication.
3. Deduplicate identical info reasons for approximately 5 seconds. A duplicate inside the window produces no second visible notification or timer reset; a different reason still displays immediately.
4. Render Saved/status as one compact top-center pill below the top safe area. Remove the large bottom-center confirmation treatment. It must clear sticky/header content, never overlap bottom navigation, and preserve `aria-live="polite"`/status semantics.
5. Success/Saved auto-dismisses after approximately 1.5 seconds. Info replacement and its existing explicit close behavior remain accessible; timer cleanup must be leak-free and deterministic.
6. Preserve offline-honest Saved copy already present: online local save says `Saved`; offline local save says `Offline — saved on device`. Do not implement B3's typed sync-error/deferred-retry states.
7. Preserve B1 zero-write scroll behavior and all A1–A4 density, safe-area, focus, keyboard, pinch-zoom, pressure-grid, FourBar, and Save Run reservation behavior.

## Harness requirements

1. Extend `scripts/saved-flash-harness.ts` with a production-source notification-arbiter contract and behavior model.
2. Force info and Saved simultaneously; assert exactly one visible notification and that info wins.
3. Assert identical-info dedupe inside about 5 seconds, expiry after the window, and immediate display for a different reason.
4. Assert success lifetime is about 1.5 seconds and timer cleanup/replacement cannot reveal a suppressed stale Saved notification.
5. Lock the single keyed copy source and historical-banner-only passive copy. Mutations that restore duplicate Setup transient copy or allow two render paths must fail.
6. Add production-derived rendered toast geometry at 360×800, 390×844, 412×915, and 1080×2118 under Standard and Large: compact top-center placement, safe-area clearance, no sticky/header or bottom-nav overlap, no horizontal overflow, and at least 44px close target where an interactive close exists.
7. Seed meaningful mutations for simultaneous co-render, info-loses priority, dedupe removal, 5-second window drift, success timeout drift, bottom positioning, oversized treatment, and duplicated copy. Every mutation must alter production-derived source/classes/model behavior and be rejected.
8. Preserve every B1 production-source mutation and behavioral assertion. `B1 stepper behavior harness: PASS` must still execute before the unchanged documented stale whole-App reconstruction byte-lock. Do not weaken unrelated UXP-18 assertions.

## Acceptance

- Simultaneous info plus Saved fixture renders exactly one notification; info copy wins.
- Repeated identical info within about 5 seconds is shown once; different reasons are not swallowed.
- Saved/status pill is compact, top-center, safe-area aware, and clears sticky/header and nav at all required viewports/scales.
- Success auto-dismisses around 1.5 seconds with no stale notification reappearing.
- Historical-card banner is the only passive historical setup communication; copy comes from one keyed source.
- Offline Saved honesty, B1 scroll safety, keyboard/focus/ARIA, A1–A4 geometry, and local persistence remain intact.

## Required tests and evidence

1. Run focused B2 arbiter/dedupe/timer/rendered mutation proof plus B1 focused proof.
2. Run `setup-touch-target-harness.ts`, A1–A4, tire, Quick Adjust, offline, pull-on-resume, semantic-status, and relevant Saved/toast regressions.
3. Run all 24 harnesses in one captured matrix. Only unchanged `muted-text-color-harness.ts` AuthView byte lock and unchanged `saved-flash-harness.ts` whole-App reconstruction byte lock may remain nonblocking; all new B1/B2 assertions must demonstrably pass before the saved-flash stale assertion.
4. Run `npm run lint`; require exact documented three-error baseline and zero new errors.
5. Run `npm run build`; require PASS.
6. Run `git diff --check`, exact three-file task-range scope, clean status, and protected-path checks.
7. Run authorized signed-out shell checks at 360×800, 390×844, 412×915, and 1080×2118 for safe area, pinch zoom, overflow, control floors, and console errors. Do not create or use credentials; production-derived fixtures cover auth-gated notification states.
8. Use cavecrew reviewer for arbiter priority, dedupe/timer state, copy-source uniqueness, rendered mutation strength, B1/A1–A4 preservation, and exact scope.
9. Commit code plus harness only with a B2-identifying message. Do not update Ralph state.

## Hard boundaries

- No B3 implementation: no typed four-state synced/offline-saved/deferred-retry/sync-error renderer, push-helper error callbacks, blocked-branch honesty expansion, `sync.ts` change, or `saveStatus.ts` deletion.
- No NumberStepper, RaceWeekend, FourBar, ContextStrip, CSS, types, schema, RLS, migration, sync, delete, queue, pull, resume throttle, lifecycle, persistence semantics, package, config, native, Android, release, credential, branch-ref, push, deploy, merge, production, `master`, or Sprint 4 IA change.
- Do not alter dual weekend-delete, team-owner canonical writes, account-scoped deferred delete queue, UXN-1 filtering, UXN-3 pull isolation/throttle, device-local active IDs, pinch zoom, keyboard/focus, or safe-area behavior.

## Compressed execution contract

Terra initial B2 only. Modify `src/App.tsx`, bounded notification/copy sites in `src/components/SetupView.tsx`, and `scripts/saved-flash-harness.ts`. One arbiter: info suppresses Saved; one reason-keyed copy source; ~5s identical-info dedupe; compact safe-area-aware top pill; ~1.5s success lifetime; historical banner only passive historical copy. Preserve offline honesty, B1, A1–A4. Add real source/model/rendered mutations, run focused/full/lint/build/shell/diff/cavecrew, commit code+harness, stop for SOL QA. B3 blocked. No sync/schema/native/release/push/deploy/merge.
