# UX Overhaul v2 — Owner Report

## Current status

Task C2 is complete and passed independent QA on the second attempt with a score of 98/100. Task C2.5, the owner-priority Setups corner-card alignment and stacked-stepper redesign, is now the active task. C3 and later work remain blocked until C2.5 passes.

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
