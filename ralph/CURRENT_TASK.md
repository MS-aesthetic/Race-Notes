# Current Task — WS-Z: July 11 Product Simplification

**Status:** CODE COMPLETE — attempt 1; rollout QA pending

## Scope

1. Fix setup scale percentages. Canonical key: `loadWeight` on LF/RF/LR/RR;
   legacy rear `load` remains readable without data loss.
2. Add exact eight four-bar inputs to LR and RR. RR angle context: Ride Height;
   LR angle context: Full Droop.
3. Add device-local active weekend. Session creation requires valid active
   weekend. Weekend creation activates weekend but never opens session form.
4. Sessions with zero weekends show only Create Weekend content action. Action
   routes through Dashboard weekend creation. Remove normal New Weekend action
   and weekend checklist UI from Sessions.
5. Trackers: one Main Checklist, Service, Templates, Accounting. Remove Shopping
   surfaces. Main Checklist supports manual items and template import; no list
   selector, new-list flow, delete-list action, or weekend association.
6. Preserve hidden legacy Shopping and weekend-checklist data. Never erase data
   during UI retirement.
7. Update `docs/USER_GUIDE.md`, `GuideView.tsx`, and current knowledge/handoff docs.

## Files

Primary: `src/components/SetupView.tsx`, `src/components/RaceWeekendView.tsx`,
`src/components/ToDoView.tsx`, `src/components/TrackersView.tsx`,
`src/components/DashboardView.tsx`, `src/App.tsx`, `src/lib/sync.ts`,
`src/lib/setupDiff.ts`, `src/data.ts`, `src/types.ts`.

Integration/docs: `src/components/ExportView.tsx`, `src/components/SettingsView.tsx`,
`src/components/GuideView.tsx`, `docs/USER_GUIDE.md`, `HANDOFF.md`,
`CODEBASE_KNOWLEDGE.md`, `plan-v2.md`, `ralph/STATE.md`.

## Out of scope

- Production deploy or merge to `preview`/`master`.
- Deleting legacy Shopping or weekend-checklist rows/storage.
- WS-T/U/W/X/Y work.
- New router/store architecture.

## Acceptance criteria

- LF=500, RF=600, LR=700, RR=800: total 2600, Nose 42.3%, Left
  46.2%, Cross 50.0%, LR split -100.0 lb. Legacy LR/RR `load` works.
- LR/RR each show exactly requested eight four-bar inputs with correct labels.
- New weekend persists, becomes active, session modal stays closed.
- Session modal cannot open or submit without active weekend; no weekend picker.
- Zero-weekend Sessions content shows only Create Weekend; existing-weekend view
  contains no New Weekend or Checklists section.
- Trackers contains Checklist, Service, Templates, Accounting; no Shopping.
- Checklist always shows one Main Checklist. Manual add/toggle/delete/assignment
  persists offline/cloud. Template import appends fresh unchecked item IDs.
- No weekend selector/link in Main Checklist.
- Dashboard task count uses Main Checklist only. Service panel still works.
- Shopping absent from Trackers/export/Guide; legacy key/data preserved.
- Cloud-backed deletions call matching `delete*FromCloud` helper.
- `npm run lint`: no new errors beyond three-error baseline. `npm run build`: pass.
- Dark/light, all zoom levels, offline reload, preview/incognito QA recorded.

## Model and skill routing

- Requested GPT 5.6 models unavailable in current runtime; disclosed to owner.
- Current model performs all roles under owner fallback instruction.
- `.agents/skills/caveman/SKILL.md`: `/caveman full` always.
- `.agents/skills/cavecrew/SKILL.md`: investigators map code; primary owns
  cross-file build; cavecrew reviewer gates diffs.

## Human prerequisite

- Apply `supabase/migrations/014_team_delete_policies.sql` to live Supabase before
  team-member deletion QA. Migration only adds team DELETE policies; no row changes.

## Verification record

- Cavecrew diff review: PASS; no unresolved WS-Z blockers.
- `npm run lint`: three known baseline errors only; zero new errors.
- `npm run build`: PASS (520 modules; PWA assets generated).
- Deterministic setup example: PASS (2600 / 42.3 / 46.2 / 50.0 / -100.0).
- Main Checklist legacy migration/idempotence checks: PASS.
- Netlify draft deploy: HTTP 200, title `Race Notes`, manifest present.
- Draft URL: https://6a525a23a0b54ce49ff7498c--crew-chief-race-notes.netlify.app
- Remaining before WS-Z complete: apply migration 014; authenticated team-delete,
  offline reload, light/dark, zoom, and mobile/incognito visual checks.
