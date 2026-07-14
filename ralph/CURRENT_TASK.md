# Current Task — UXF-5 Copy Tone and Guide Separation

**Status:** AWAITING OWNER TONE REVIEW — SOL High technical QA PASS attempt 2
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-4 closed by SOL QA at `bbaab34`; feature `0c2c827`, repair `12d932f`

## Goal

Keep operational screens concise. The Tuning Guide is a tuning reference, while app operating instructions belong in the App Guide. Use professional dirt-racing shop language: clear without academic jargon or patronizing simplification.

## Scope

1. **Tuning Guide starts with tuning content.** In `src/components/QuickReferenceView.tsx`:
   - Remove the four app-help cards/anchors: Setup Sheet, Four-Bar, Load Sessions, Compare Setups.
   - Remove the entire `Before You Change Anything` block.
   - The first rendered section must be the Pit-Side Adjustment Finder.
   - Keep High / Medium / Low available in the tuning reference, compact and professional while preserving the owner-approved meaning: High = try first; Medium = try next if the first change did not fix it; Low = fine-tuning after the bigger items are checked. Do not add another how-to preamble.
   - Do not remove tuning recommendations, direction, cautions, filters, tables, calculators, or condition content.

2. **Contextual help routes to the App Guide, not the Tuning Guide.** The existing `onHelp('setup' | 'four-bar' | 'loads' | 'setup-diff')` callers must remain useful after their Quick Reference anchors are removed.
   - Add a small explicit section classifier/routing path in `src/App.tsx` (or an extracted pure helper) so those four section requests render App Guide content in the help sheet. A sectionless/global Help request continues to render `QuickReferenceView` as **Tuning Guide**.
   - Extend `src/components/ui/HelpSheet.tsx` only as needed to accept an accurate title/intro for App Guide versus Tuning Guide and retain anchor scrolling. No silent fallback to the top of Tuning Guide.
   - Extend `GuideView` with a minimal embedded/active-section API or equivalent. The requested topic must expand before it scrolls into view, and it must react on every section change/reopen rather than only initial mount. Normal Settings → Guide rendering remains unchanged.
   - Preserve Android Back/bottom-sheet behavior and the four existing contextual-help call sites.

3. **Relocate app operating help.** In `src/components/GuideView.tsx` and `docs/USER_GUIDE.md`:
   - Keep/enrich Setup Sheet instructions.
   - Add a dedicated Four-Bar topic covering the stored fields and consistent measurement.
   - Keep/enrich Load Sessions instructions for travel/load, raw measured height, and Ride Height C-to-C.
   - Add a dedicated Compare Setups topic explaining Before, After, and highlighted changes without judging the change.
   - Give the in-app topics exact anchors `setup`, `four-bar`, `loads`, and `setup-diff` for contextual routing.
   - Put the maintenance 90% automatic-checklist rule in the Maintenance Logs guide section and USER_GUIDE, not on the working screen.

4. **Remove maintenance explanation clutter without changing behavior.** In `src/lib/checklistMaintenance.ts` and `src/components/TrackersView.tsx`:
   - Automatic maintenance task `desc` becomes exactly ```${used}/${limit} ${component.intervalType}```.
   - Remove now-unused `remaining` from the automatic-task builder only. Keep `cycleId`, `sourceId`, `sourceCycle`, generated task ID, 90% threshold, reset/reopen, assignment, and reconciliation logic unchanged.
   - Remove the permanent 90% explanation banner above Maintenance Logs.
   - Remove each row's verbose reason paragraph, including “Below 90%...” and “At least 90%...”. Keep the status chip, progress bar, concise Used / Limit / Remaining line, Log action, and all calculations.

5. **Bounded professional-language audit.** Limit judgment-based copy edits to `QuickReferenceView.tsx`, `GuideView.tsx`, `docs/USER_GUIDE.md`, and the existing C9 translation layer in `plainRacerEffect`.
   - Preserve all raw researched adjustment data and tuning direction. Fix ordered render-time translations only.
   - Avoid the C9 flagged literals in rendered copy, but do not replace them with childish phrases such as “part of the tire touching the track,” “weight moving,” “the car leaning,” or “how the car sits.” Prefer established shop terms such as tire contact, load shift, car roll, bar angle/rear steer, braking, throttle, and mid-corner when technically accurate.
   - Remove redundant coaching/commentary. Keep cautions that affect safety, applicability, tire rules, or technical direction.
   - Fix grammar produced by chained replacements; the rendered adjustment corpus must read naturally.

6. **Harnesses.** Update:
   - `scripts/chunk8-trackers-harness.ts`: exact terse description; source/cycle/idempotence/90%-boundary/removal/completed-history behavior unchanged; assert banner and row-reason copy are absent.
   - `scripts/chunk9-export-help-harness.ts`: Quick Reference lacks the four app-help anchors and Before block; GuideView owns all four anchors/topics; App/HelpSheet route sectioned help to App Guide and sectionless help to Tuning Guide; USER_GUIDE contains all four topics and maintenance threshold guidance; all 134 raw effect literals still pass through `plainRacerEffect`; rendered corpus/grammar/professional tone checks pass.
7. **Focused help runtime:** locally verify global Help opens Tuning Guide; each of the four contextual actions opens its expanded App Guide topic; sequential `setup → loads → setup-diff` requests update instead of showing stale content; Settings → Guide still behaves normally; close button/scrim and Android Back close the sheet correctly.

## Primary files

- `src/components/QuickReferenceView.tsx`
- `src/components/GuideView.tsx`
- `src/components/ui/HelpSheet.tsx`
- `src/App.tsx`
- `src/components/TrackersView.tsx`
- `src/lib/checklistMaintenance.ts`
- `docs/USER_GUIDE.md`
- `scripts/chunk8-trackers-harness.ts`
- `scripts/chunk9-export-help-harness.ts`

## Out of scope

- No Main Checklist structural redesign, creation/reset flow change, or resurrection-policy change; UXF-7 owns redesign.
- No interval type/measurement/start-usage change; UXF-6 owns that.
- No lifecycle vocabulary/mechanics, setup/run data, tuning recommendation/data direction, storage/sync/type/schema/migration, package, native config, deploy, push, merge, or APK.
- No app-wide copy rewrite outside the bounded files above.

## Acceptance

1. Opening normal Help shows Tuning Guide with Pit-Side Adjustment Finder first. It has no app-help cards and no Before block.
2. Setup, Four-Bar, Load Sessions, and Compare Setups `?` actions open the matching expanded App Guide topic, including sequential topic changes/reopens; normal Settings → Guide still works.
3. App Guide and USER_GUIDE contain all four operating topics plus the maintenance 90% rule.
4. Maintenance working screens show concise state/action only. Automatic task description is exact and all threshold/cycle/idempotence behavior remains unchanged.
5. Raw tuning data is unchanged; every rendered effect is translated; rendered/direct copy contains no banned academic literals, broken grammar, or patronizing repair phrases.
6. Full chunk8 and chunk9 harnesses PASS; exact three-error lint baseline; production build PASS; `git diff --check` PASS; focused help runtime passes global/contextual/sequential/close/Android Back paths; cavecrew review finds no blocker.
7. SOL performs independent technical QA. Technical PASS records **AWAITING OWNER TONE REVIEW** rather than closing UXF-5. Maxx's local/draft spot-review is the final product-acceptance gate.

## Routing

Terra owns one initial build pass. Primary owns this cross-file change; cavecrew handles bounded trace/review. Commit feature and durable handoff, then return to SOL High QA. Any QA failure transfers repair to SOL fixer; Terra is not re-invoked. Do not start UXF-6 before UXF-5 technical QA and owner tone disposition are recorded.

## Terra attempt 1 evidence — 2026-07-14

- Feature commit: `e2f0553`.
- Tuning Guide now begins with Pit-Side Adjustment Finder. The four operating-help cards and the Before block are removed without changing the researched tuning records, directions, or cautions.
- Sectioned Setup, Four-Bar, Load Sessions, and Compare Setups help routes to the matching expanded App Guide topic. Sectionless global Help still opens Tuning Guide; Settings → Guide retains its normal presentation.
- Maintenance working screens retain status, progress, Used/Limit/Remaining, and Log action while removing the permanent threshold banner and row-level reason paragraphs. Automatic task descriptions are exactly `${used}/${limit} ${intervalType}`; reconciliation math, cycles, IDs, and storage shape are unchanged.
- Professional shop-language repair is render-only. All 134 raw effect literals remain source data and pass through `plainRacerEffect`; focused corpus and grammar guards cover translated and direct copy.
- `scripts/chunk8-trackers-harness.ts` PASS; `scripts/chunk9-export-help-harness.ts` PASS; lint reports only the exact three known errors; production build PASS with 555 modules and 18 PWA entries; `git diff --check` PASS; cavecrew final review found no issues.
- Local signed-out auth shell opened with zero console errors. Authenticated contextual clicks were unavailable on that origin, so no such runtime claim is made. Sequential topic changes and embedded/normal Guide rendering are covered by focused SSR fixtures; existing BottomSheet close and Android Back handling remain source-verified.
- No checklist redesign, interval behavior, lifecycle, schema, migration, sync shape, type, package, native config, deploy, push, merge, or APK change.

## SOL technical QA — 2026-07-14

- Attempt 1 found one medium copy blocker: five translated effects still produced awkward or academic output (`resists the chassis from rolling`, `keeping rear tire loading`, `cushioning the tire contact`, `Maximum mechanical forward traction`, and `allows weight to transfer`). Routing correctly transferred repair to SOL; Terra was not re-invoked.
- SOL fixer commit `83e652f` adds ordered phrase-specific render translations and exact harness guards. `BEHAVIOR_DATA` remains byte-equal to plan commit `aeaa62f` after line-ending normalization.
- QA attempt 2 PASS. Chunk8 and expanded chunk9 harnesses PASS; lint remains exact three-error baseline; production build PASS with 555 modules and 18 PWA entries; diff and clean-tree checks PASS; cavecrew re-review reports no issues.
- Technical acceptance is complete. UXF-5 remains open until Maxx reviews guide tone locally or on a future draft and accepts or requests copy changes. UXF-6 stays locked.
