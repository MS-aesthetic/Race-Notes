# UX Overhaul v2 — Owner Report

## Current status

Task C2 is complete with a score of 98/100. Task C2.5, the owner-priority Setups corner-card alignment and stacked-stepper redesign, is also complete. Its second QA attempt passed with a score of 100/100. Task C3, which adds session-bound setup-difference summaries without duplicating Quick Adjust history, is now active.

## Task C2 — Session snapshot model and diff engine

### What was built

C2 added a legacy-compatible snapshot of the setup used for each saved session. A session can now retain both the setup ID and a detached plain-data copy of the actual tuning values used at that moment. The diff engine compares the saved snapshot to the current setup in a deterministic order, while excluding identity fields, lifecycle metadata, media, transient state, and irrelevant noise.

The original product implementation is commit `253897a` (builder tree `32135814`). The first QA attempt found no product defect, but two test harnesses were sensitive to Windows CRLF line endings. The approved repair in commit `13b556f` changes only those two harnesses so they normalize source text before running the existing assertions. No application code changed during the repair, and the assertion counts remained unchanged.

### What was checked

- Snapshot capture uses the same canonical setup source once, so `setupId`, `setupSnapshot`, and the recorded setup name cannot disagree.
- Snapshots are detached plain data and include the complete ordered top-level and corner tuning fields.
- Legacy sessions without a snapshot remain valid.
- Existing historical change-log bytes are preserved; the App hot path no longer adds a duplicate setup-diff log.
- Sessions continue to round-trip through local JSON and cloud sync without schema or sync-shape changes.
- Quick Adjust, offline/resume, tire behavior, touch targets, lifecycle behavior, Saved feedback, and local/cloud pressure behavior remain unchanged.
- Both repaired focused harnesses pass on the normal Windows checkout.
- The raw 24-harness matrix is exactly 22/24. The only failures are the two already documented stale whole-file locks: `muted-text-color-harness.ts` and `saved-flash-harness.ts`.
- Type-checking reports exactly the same three known baseline errors. The production build succeeds with 566 transformed modules.
- The repair diff contains only `scripts/chunk5-setup-harness.ts` and `scripts/offline-indicator-harness.ts`; no product file changed after `253897a`. Diff, protected-path, clean-worktree, and independent cavecrew review checks all passed.

### Preview and device verification

A Netlify draft preview was deployed at:

https://6a5badb3b3f79f44ec4211ad--crew-chief-race-notes.netlify.app/

The signed-out shell was inspected in the built-in browser at 360×800, 390×844, and 412×915. Each viewport had no horizontal overflow, all visible controls were at least 44px tall, the pinch-enabled viewport metadata was present, and the browser produced no warnings or errors.

A Java 21 debug APK was built at `android/app/build/outputs/apk/debug/app-debug.apk`, installed on the running `emulator-5554`, and cold-launched successfully in 3.769 seconds. The Dashboard rendered correctly with the preserved local account. Android's crash buffer was empty. The only error-level log entries were emulator graphics/Chromium infrastructure messages, not application crashes or JavaScript errors.

### Result and what comes next

C2 is a PASS. There is no remaining C2 product repair.

C2.5 now redesigns the Setups steppers so the value sits above side-by-side minus and plus buttons, and it aligns the LF/RF/LR/RR field rows. After C2.5 passes its focused, regression, three-width/two-scale browser, and emulator checks, work resumes in plan order: C3, C4, C5, Chunk C QA, Chunk D, Chunk E, and the final full-sprint QA and handoff.

## Task C2.5 — QA attempt 1

### What was built

The first C2.5 implementation added an official stacked layout to the shared number stepper. The Setups corner cards and the tire inventory form use it so the value appears above a side-by-side minus and plus row. The corner labels were also given a consistent one-line footprint so matching left/right fields begin at the same height.

### What passed

The implementation commit is `8ab870a`. It changes only the four approved C2.5 files. The shared stepper's existing pointer, scrolling, keyboard, direct-edit, 350ms hold delay, and 100ms repeat interval remain unchanged. Focused Setups, tires, lifecycle, Quick Adjust, offline, and resume tests passed. The full test matrix was exactly 22/24, with only the same two documented stale locks failing. Type-checking reported exactly the three known baseline errors, and the production build completed with 566 modules. Independent cavecrew review found no source-level issue.

A draft preview was deployed at:

https://6a5bbdb4471cad4925ade9c5--crew-chief-race-notes.netlify.app/

Its signed-out shell passed at 360×800, 390×844, and 412×915 with no page overflow, no browser warnings or errors, and all six visible controls at least 44px tall. A Java 21 debug APK was also built, installed, and launched. Its SHA-256 is `98F4E35AF8B59AB69BC51C228B7943C1F57190CC2A3C1AE2A1A6ACFB0617D0D0`.

### Why QA failed

The authenticated device check found a layout problem hidden by the original test. At the three required phone widths, each nested corner stepper was only about 63–76px wide while its two buttons each correctly required at least 44px. The buttons therefore overlapped by about 14px at 360, 10px at 390, and 7px at 412. The stepper clips its contents, so the page itself did not report horizontal overflow even though the buttons were visibly crowded and partially clipped.

This is a C2.5 blocker, so attempt 1 is **FAIL, 88/100**. No setup values or user data were changed during the measurement.

### Repair and what comes next

The repair stays with a GPT-5.6 SOL High implementation worker. It must give the stacked corner controls enough real width for two separate 44px buttons without changing the stepper's behavior. The test harness must then exercise the actual 360, 390, and 412 production layout in both Default and Large scales and fail if the width fix is removed. C3 and all later roadmap work remain blocked until the repaired C2.5 passes independent QA.

## Task C2.5 — QA attempt 2 (final)

### What was repaired

The repair keeps the two side-by-side corner cards, but gives each numeric stepper a full row inside its own card at phone widths. This provides enough room for two separate, equal-width buttons without shrinking their 44px touch targets. At 768px and wider, the fields return to the denser inner-column layout where the available width is safe.

The repair commit is `2235c7d`. It changes only `src/components/SetupView.tsx` and `scripts/setup-touch-target-harness.ts`. The shared NumberStepper component and the tire form did not need another product change. Existing pointer, keyboard, direct-edit, scroll cancellation, hold delay, repeat cadence, value formatting, persistence, Saved feedback, sync, lifecycle, and Quick Adjust behavior remain untouched.

The test harness now compiles the real production Tailwind classes and renders the actual corner-card structure. It checks all three required phone sizes in both Default and Large modes, checks the safe return at tablet width, detects content hidden by overflow clipping, and deliberately removes the width repair to prove that the test fails for the original defect.

### What was checked

- The focused Setups touch-target test and the Setups, tires, lifecycle, Quick Adjust, offline, and resume regression tests all passed.
- The full raw test matrix was exactly 22/24. The only failures were the same two documented stale whole-file locks, `muted-text-color-harness.ts` and `saved-flash-harness.ts`.
- Type-checking reported exactly the three known baseline errors and no new errors. The production build completed with exactly 566 transformed modules.
- The repair commit contains only the two approved files. Protected paths, later roadmap work, and unrelated files are absent. The worktree is clean and independent cavecrew review found no issue.
- The signed-out browser shell passed at 360×800, 390×844, and 412×915 with exact viewport sizes, no horizontal overflow, all visible controls at least 44px tall, pinch zoom enabled, and no console warnings or errors.
- The authenticated Android WebView was measured at all six phone-size and display-size combinations. Across 26 corner steppers, the smallest button widths were 65.5, 73, and 78.5px in Default mode and approximately 62.2, 69.7, and 75.2px in Large mode. Every button was at least 44px tall. Button overlap, clipping, hidden scroll overflow, page overflow, and left/right card alignment differences were all zero within subpixel tolerance.
- The Tire Inventory Backspacing and Air pressure controls also rendered with the value above equal side-by-side minus and plus buttons.

### Preview and debug APK

The accepted Netlify draft preview is:

https://6a5bc73efc0c61784a25b9d0--crew-chief-race-notes.netlify.app/

This is a draft preview only; production was not changed. During QA, an unused draft was first sent to a secondary project linked to the dependency worktree. The same build was then deployed to the correct Crew Chief project using its explicit site ID. Neither action published to production.

A fresh Java 21 debug APK was built at `android/app/build/outputs/apk/debug/app-debug.apk`, installed on the running `emulator-5554`, and cold-launched successfully in 4.209 seconds. Its size is 11,745,601 bytes and its SHA-256 is `B89351FE973D21E1F9E60F281BFAE983CD606C3E0D69AA76C3C1E44DFA8FAACC`. The emulator remains on the Setups feature in Default mode for inspection. No release build, signing, production deploy, push, or merge was performed.

### Result and what comes next

C2.5 is a final **PASS, 100/100**. The attempt-one geometry defect is closed and no C2.5 repair remains.

Task C3 is next. It will replace the old per-press setup-change presentation with a compact computed “will bind to next session” view, show each session’s frozen setup difference, and keep Quick Adjust’s in-run net rows unchanged so the same adjustment is not logged twice. C4, C5, Chunk C QA, Chunks D and E, and final full-sprint QA remain after C3.
