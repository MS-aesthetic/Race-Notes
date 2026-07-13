# Current Task — UX-R1: Urgent Pre-Chunk-5 Regression Repair

**Status:** COMPLETE — CODE_PASS + RUNTIME_PASS (2026-07-13)
**Priority:** CLOSED — UX Chunk 5 is unblocked but has not started.

## Routing

- GPT 5.6 SOL High owns this specification and final QA.
- GPT 5.6 Terra High owns implementation. QA failures 1–2 return to Terra.
- Third failed QA review transfers implementation and final QA to SOL.
- Runtime metadata, not prose self-identification, proves which model ran.
- Use `/caveman full`. Use cavecrew only for bounded investigation or diff review.
- Evidence is settled. Do not browse or broaden product scope.

## Goal

Repair four regressions before Setups work resumes: restore team identity at the
top of Dashboard, make light-mode accent and metadata readable, restore a safe
and clearly scoped Tuning Guide without adding a sixth tab, and make starter
checklist hydration deterministic across offline and signed-in use.

## Required behavior

### 1. Team banner leads Dashboard

- Render the existing team banner as Dashboard's first content block, before
  Get Race-Ready, `+ LOG RUN`, launchpad cards, service, and accounting content.
- Keep current team data and edit/navigation behavior. Do not create duplicate
  team state or a second banner elsewhere.
- Team name and metadata must remain readable over every supplied/custom image.
  Use a deterministic scrim, gradient, or opaque text surface; never depend on
  image brightness. Normal text must meet WCAG AA 4.5:1 and large text 3:1.
- Missing image/team details must keep a deliberate, compact fallback with no
  layout jump or empty decorative block.

### 2. Readable rendered accent and global text floor

- Keep the user's stored accent value byte-for-byte unchanged. Do not migrate,
  clamp, or overwrite `race_notes_theme` or the Style picker value.
- Add a pure helper that derives the rendered light-theme accent from the stored
  accent and the actual light surface. Preserve hue as closely as practical,
  adjust only presentation, and deterministically choose the nearest color that
  meets WCAG AA: 4.5:1 where used for normal text and 3:1 for large text,
  controls, icons, borders, and focus indicators. Dark-theme rendering must not
  regress.
- Feed derived color through existing CSS theme variables. Components continue
  using semantic tokens; no component-local hardcoded color fixes.
- Raise global tiny-copy floor to 12 CSS px at standard zoom. Remove utilities or
  transforms that render app labels/metadata below that floor.
- Strengthen faint light-mode metadata and secondary-text tokens to 4.5:1 on
  their normal surfaces. Disabled-state and purely decorative exceptions must
  remain distinguishable and must not carry essential information alone.
- Verify standard, large, xlarge, and xxlarge zoom. No clipping, overlap, hidden
  actions, or horizontal page scroll.

### 3. Prominent, scoped, safe Tuning Guide

- Retain exactly five bottom tabs. Do not restore `quickref` as a tab.
- Add a prominent action labeled exactly **Tuning Guide** to the existing help
  entry surface so it is named and reachable in one tap from the persistent help
  control. Preserve other HelpSheet content and back behavior.
- Label guide applicability at both guide and row/section level. Separate
  **Modified** and **Dirt Late Model** guidance; never present chassis-specific
  AFCO direction as universal advice. State that these are baseline diagnostic
  directions and chassis, tire, shock-builder, and track rules prevail.
- Correct the already-flagged contradictory or unsafe setup rows only from the
  supplied official AFCO Modified and Dirt Late Model evidence. Keep conflicting
  application-specific directions in separate labeled rows. Do not invent a
  blended rule or perform new web research.
- Remove every universal claim that a pressure change of `5 PSI`, or any fixed
  pressure change, is a minimum or inherently safe. Pressure guidance must defer
  to tire manufacturer, chassis builder, measured hot pressure, and track rules.
- Preserve and surface the warning to change one item at a time, record the
  result, and revert if behavior worsens.
- Keep factual source attribution in the guide: official AFCO Modified and Dirt
  Late Model setup guidance. Do not add unsupported safety or performance claims.

### 4. Exact starter-template reconciliation

- Add a pure, exported helper for an **untouched starter fingerprint**. Fingerprint
  only canonical starter semantics: starter name plus ordered item text and any
  starter-defined behavior fields. Ignore generated IDs, owner/team IDs, cloud
  timestamps, and bookkeeping fields. Comparison is exact after applying only
  existing persisted-data defaults; do not lowercase, trim, sort, fuzzy-match,
  or identify a starter by name alone.
- A customized starter is not an untouched starter. A user template with the same
  name is not an untouched starter. Preserve both unchanged.
- During hydration, reconcile each canonical starter independently:
  1. Keep one exact untouched copy using an order-independent deterministic
     keeper rule with ID as final tie-break.
  2. Seed only canonical starters whose exact fingerprint is absent.
  3. Remove only additional exact untouched copies.
- Signed-out/offline-local hydration may reconcile after local hydration. When a
  user is signed in, do not seed or dedupe until the signed-in cloud pull attempt
  has settled and local/cloud data has been merged. No transient defaults may be
  pushed before pull completion.
- Persist the reconciled survivor set to React state and localStorage. When signed
  in, push newly seeded survivors and call the existing checklist-template cloud
  delete helper for every discarded duplicate ID. Never delete by name or
  fingerprint query.
- Repeated hydration, array reordering, offline restart, login, logout, pull
  success, and pull failure must converge without creating another starter or
  deleting customized/same-name templates.

## Explicit file scope

Implementation may touch only these production areas:

- `src/App.tsx` — minimal hydration/theme/help wiring only.
- `src/index.css` — semantic theme-token contrast and global type floor.
- `src/components/DashboardView.tsx` and its existing team-banner component, if
  already extracted — ordering/fallback/contrast only.
- `src/components/ui/HelpSheet.tsx` — named Tuning Guide entry and in-sheet
  navigation only.
- Existing Tuning/Quick Reference guide component or data module — applicability,
  AFCO-backed row corrections, pressure disclaimer, and warning only.
- Existing checklist template manager component — reconciliation wiring only.
- `src/lib/checklists.ts` — fingerprint, classification, deterministic reconcile.
- `src/lib/sync.ts` — only existing pull/delete integration needed for convergence.
- One new pure color helper under `src/lib/`.
- New focused harness files under `scripts/` for color contrast and starter
  reconciliation.

Builder may use bounded `rg` to resolve an existing extracted component's exact
filename. Any other production file requires planner approval before editing.
No schema, migration, dependency, router, tab-count, or unrelated Chunk 5/6/7
changes.

## Required harnesses

1. **Accent harness:** representative user accents including very light, very
   dark, saturated, achromatic, short hex, and invalid legacy input. Assert
   deterministic fallback, unchanged stored input, and required contrast against
   actual light surfaces for every semantic use.
2. **Starter harness:** empty state; one untouched copy; duplicate untouched
   copies in every order; customized starter; same-name custom template; missing
   one starter; legacy missing optional fields; offline repeat; merged local/cloud
   repeat. Assert idempotence, order-independent keeper, exact seed/delete ID sets,
   and preservation of every non-exact template.

Harnesses must run from documented Windows commands without network access and
must fail nonzero on any assertion.

## Acceptance and QA gates

1. Dashboard banner is visually first and its text meets stated contrast on
   bright, dark, and high-detail images plus no-image fallback.
2. Stored accent remains exact; rendered light accent and metadata meet stated
   WCAG ratios. Dark theme remains readable.
3. No app text renders below 12 CSS px at standard zoom. Light/dark at standard,
   large, xlarge, and xxlarge show no clipping, overlap, lost actions, or page
   horizontal scroll.
4. Exactly five bottom tabs remain. **Tuning Guide** is prominent, named, one-tap
   reachable from help, and back behavior returns to prior view.
5. Guide clearly separates Modified from Dirt Late Model applicability, matches
   supplied official AFCO evidence, contains no contradictory blended rows or
   universal `5 PSI`/fixed-pressure safety claim, and retains one-change-at-a-time
   warning.
6. Starter harness proves exact-only, idempotent, order-independent reconciliation.
   Customized and same-name templates survive byte-for-byte.
7. Signed-in pull is settled before reconciliation. Offline-first use, then login,
   and a second device/cloud pull converge to one copy of each untouched starter.
   Every discarded exact duplicate ID receives cloud delete; no other ID does.
8. Local-first writes, team sharing/RLS behavior, and existing checklist CRUD stay
   intact. Pull failure settles safely and does not create repeated defaults.
9. `npm run lint` reports exactly the three known baseline errors and no new error.
10. `npm run build` succeeds in the v3 worktree with required environment files.
11. Both focused harnesses pass. Record exact commands and output summaries.
12. Deploy a Netlify **draft** only. Hard-refresh/incognito visual QA covers bright
    and dark banners, light/dark themes, all four zooms, five tabs, Tuning Guide,
    and checklist reload/login convergence. Production remains untouched.
13. Build Android through the documented v3-dist-to-main bridge, bump installable
    versionCode/versionName, install with app data cleared, and repeat critical
    banner/theme/guide/checklist flows. Record APK path and version.
14. Terra reports exact files changed, harness evidence, lint baseline, build,
    draft URL, offline/login convergence evidence, and Android evidence. SOL QA
    independently verifies diff scope and all gates before unblocking Chunk 5.

## Completion record — 2026-07-13

- Product: banner leads Dashboard; light accent derives against the darkest light
  surface; explicit 8–11px utilities floor at 12px; five-tab shell exposes a named
  Tuning Guide; AFCO applicability/pressure language corrected; starter hydration
  converges without deleting customized or same-name templates.
- Offline: Material Symbols Outlined bundled locally and included in Workbox's
  WOFF2 precache. Cold Android launch passed with Wi-Fi/data disabled and WebView
  HTTP/service-worker caches removed.
- Responsive runtime: Android WebView at 320×800 passed dark/light × Standard,
  Large, X-Large, and XX-Large. Root/shell/nav had no horizontal scroll; five tab
  labels/icons and Tuning Guide remained visible.
- Gates: both UX-R1 harnesses PASS; build PASS; lint remained exactly the three
  known baseline errors; independent cavecrew review found no product defect.
- Android: debug APK versionCode 15/versionName 4.0 at
  `C:\Users\maxx\antigravity\Race-Notes\race_notes.apk`.
- Netlify draft: `https://6a54e5f9c0cf5c7bcc9280a4--crew-chief-race-notes.netlify.app`.
  Draft auth gate rendered without horizontal overflow and loaded the local icon
  font. Production remained untouched.
- Model routing: fresh token `handoff-live-7139` passed SOL → Terra → SOL in one
  task. Rollout `turn_context.payload.model` recorded `gpt-5.6-sol` →
  `gpt-5.6-terra` → `gpt-5.6-sol`, all high effort. Verify with
  `scripts/verify-agent-handoff.ps1 -Token handoff-live-7139`.
- Scope exception: `material-symbols@0.45.7`, `package*.json`, and `vite.config.ts`
  were added after runtime failure proved externally hosted icons broke offline
  layout. Workbox now precaches the emitted WOFF2 under a 5 MiB cap.
