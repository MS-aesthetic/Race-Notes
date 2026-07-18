# UX Overhaul v2 — Owner Report

## Current status

Tasks C2, C2.5, C3, C4, and C5 are complete. C5 passed its first QA attempt with a score of 100/100. The mandatory integrated Chunk C QA is now active; it will recheck the complete setup lifecycle, session snapshots and diffs, stepper layout, Saved boundaries, naming, and rename behavior together before any deletion work begins.

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

C2.5 followed C2 and is documented below. It redesigned the Setups steppers so the value sits above side-by-side minus and plus buttons and aligned the LF/RF/LR/RR field rows. The remaining work continues in plan order through C3, C4, C5, Chunk C QA, Chunk D, Chunk E, and the final full-sprint QA and handoff.

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

Task C3 followed and has now passed; its detailed result is below. C4 is active. C5, Chunk C QA, Chunks D and E, and final full-sprint QA remain after C4.

## Task C3 — Session-bound setup differences

### What was built

C3 replaces the noisy per-press setup-history presentation with two compact, computed views. Setups now shows changes that are waiting to be captured by the next run under “Pending — will bind to next session.” Each saved run can show the setup changes that were frozen when that run started. A new “Log setup changes” button on the Runs page takes the user back to Setups without changing editability or lifecycle rules.

The implementation is commit `e8d7016`. It changes only `src/App.tsx`, `src/components/SetupView.tsx`, `src/components/RaceWeekendView.tsx`, and `scripts/chunk5-setup-harness.ts`. Existing non-run historical setup-log rows remain available in a collapsed Legacy log. Quick Adjust rows remain attached to the run where the adjustment happened and are not repeated in the Legacy log or written again as session-difference rows.

### What was checked

- Run history is newest-first, so each run compares its frozen snapshot with the immediately older run. The first run compares with the Race Day's Starting Setup.
- Missing legacy snapshots, missing Starting Setups, and unrelated setup lineages show an honest unavailable state instead of reconstructing history from a mutable setup.
- Equal snapshots show no false change rows. Field order and before/after direction remain deterministic.
- The canonical owner scenario passed: Starting Setup, Hot Laps, a Quick Adjust gear change, then Qualifying. Before Qualifying, Setups showed `Gear — → 6.20` as pending. After Qualifying was created, the Qualifying card showed the identical bound row.
- Config, Conditions, free-text Notes, and existing run Adjustments remain present. C1's active Race Day setup stays view-only; the new button is navigation only.
- The focused C3 harness ran 49 assertions and killed 14 independent mutations. Lifecycle, Quick Adjust, offline/resume, tires, and touch-target regressions passed.
- The raw 24-harness matrix remained exactly 22/24. The only failures were the two expected pre-C4 stale locks: `muted-text-color-harness.ts` and `saved-flash-harness.ts`.
- Type-checking reported exactly the three known baseline errors. The production build completed with exactly 566 transformed modules. Scope, protected-path, diff, clean-worktree, and independent cavecrew review checks passed.

### Preview and debug APK

The accepted Netlify draft preview is:

https://6a5bd7642d319b93215dfc81--crew-chief-race-notes.netlify.app/

The signed-out shell passed at 360×800, 390×844, and 412×915. It had no horizontal overflow, every visible control was at least 44px, pinch-enabled viewport metadata remained present, and the browser reported no console warnings or errors.

A Java 21 debug APK was built, installed on `emulator-5554`, and used for the authenticated owner scenario. The APK is 11,745,619 bytes with SHA-256 `0DEB68C77FB6DD110E57242300F555AE5AF92C804D510DB0C431277B9F67F556`. The preserved emulator data initially loaded an older service-worker bundle, so QA cleared only the debug app's WebView service-worker cache while preserving Local Storage. The new bundle then rendered the pending and bound C3 cards correctly. Android emitted only emulator/Chromium engine diagnostics; there was no application crash or JavaScript exception.

### Result and what comes next

C3 is a final **PASS, 100/100**. No C3 repair remains.

C4 is next. It will keep React state and localStorage writes immediate on every real change, but stop showing Saved on every press or keystroke. One Saved confirmation will appear only when dirty work reaches a boundary such as leaving the tab, backgrounding the app, the 30-second timer, or creating the next run. C5, Chunk C QA, Chunks D and E, and final full-sprint QA remain after C4.

## Task C4 — Autosave confirmation boundaries

### What was built

C4 changes when the confirmation appears, not when data is saved. Every real edit still updates the screen and the device's local storage immediately. The app now remembers only whether there has been an unacknowledged edit burst. It shows one Saved confirmation when that burst reaches a meaningful boundary: leaving the current app tab, hiding or backgrounding the app, reaching 30 seconds while dirty, or successfully creating the next run.

The implementation is commit `83230c9`. It changes only `src/App.tsx` and `scripts/saved-flash-harness.ts`. No sync, lifecycle, setup-diff, Quick Adjust, native, schema, package, or layout file changed. Repeated background events are coalesced, clean boundaries show nothing, and the dirty flag is cleared before the existing notification system decides whether Saved, an information message, or a sync error has priority.

### What was checked

- Three edits produced three immediate local writes and no per-key or per-press Saved confirmation.
- Leaving the tab after an edit produced one Saved confirmation. Repeating clean tab changes produced none.
- The real 30-second timer was captured on the Android emulator: Saved appeared in exactly three consecutive capture frames, matching its 1.5-second lifetime, and was absent before and after.
- Force-stopping and relaunching the app before any confirmation retained the exact edited Race Day notes, proving that confirmation timing cannot cause data loss.
- Creating a Heat persisted a third run before the boundary fired. The existing “Pressures carried from Qual” information message correctly took priority over Saved, and closing it did not reveal a stale Saved message afterward.
- Backgrounding the native app consumed the dirty boundary; the following clean tab change remained silent.
- The focused C4 test ran 132 assertions and independently killed all 29 required failure mutations, including immediate-toast restoration, marking dirty before persistence, missing boundaries, wrong timer cadence, paired-event double notifications, missing cleanup, weakened error/info priority, and changed cloud timing.
- The full raw test matrix was exactly 23/24. The only failure was the already documented stale `muted-text-color-harness.ts` lock. The Saved harness now passes and is no longer waived.
- Type-checking reported exactly the three known baseline errors and no new error. The production build completed with exactly 566 transformed modules.
- The commit scope, protected paths, diff check, clean worktree, and independent cavecrew review all passed.

### Preview and debug APK

The accepted Netlify draft preview is:

https://6a5be8afd84d6f1d7738613c--crew-chief-race-notes.netlify.app/

The signed-out shell passed at 360×800, 390×844, and 412×915. Every viewport was exact, had no horizontal overflow, kept the pinch-enabled viewport metadata, showed only the authentication gate, and kept every visible button at least 44px tall. The built-in browser reported no console warnings or errors.

QA initially sent one unused draft to a secondary Netlify project because that worktree had an old local site link. This was caught immediately. The worktree was relinked to the explicit Crew Chief site ID and the accepted draft above was deployed. Neither draft changed production.

A Java 21 debug APK was built at `android/app/build/outputs/apk/debug/app-debug.apk`, installed on `emulator-5554`, and used for the authenticated scenarios above. Its size is 11,745,619 bytes and its SHA-256 is `A49577A9D00A7B3E32F94525A255A4E7166DCA0443F413DFDC678EE9508211CE`. Light and dark rendering passed at a 412×915 QA viewport, and the emulator display override was restored afterward.

There was no application crash. A fresh launch did log two Capacitor-injected safe-area CSS errors before the document root existed. C4 does not touch native, configuration, or safe-area code, and the rendered app remained correct; this pre-existing platform diagnostic is recorded for final native hardening rather than being folded into C5.

### Result and what comes next

C4 is a final **PASS, 100/100**. No C4 repair remains.

C5 followed and has now passed. Its result is documented below. The larger integrated Chunk C QA is active. Chunk D, Chunk E, final full-sprint QA, and the final third-party handoff remain after that gate.

## Task C5 — Setup naming and rename affordance

### What was built

C5 prevents accidental unnamed setups when the owner starts from blank. The blank action now requires a real name after trimming leading and trailing spaces, and the old anonymous `Setup #N` fallback is no longer used on that path. Copying an existing setup still requires no typing: the app derives a meaningful name from the source setup and keeps the existing copy provenance and pressure-source behavior. A typed name still overrides the automatic copy name.

Editable setup cards now show a pencil beside the setup name. Pressing it opens that exact setup and focuses the existing Chassis field, so renaming uses the same field and persistence path as every other setup edit. The pencil does not create a second name field, modal, storage key, or cloud workflow. Historical snapshots and the active Race Day's edit-frozen event setup remain view-only and do not show the rename action.

The implementation is commit `1a3d492`. It changes only `src/components/SetupView.tsx` and `scripts/chunk5-setup-harness.ts`. No App, lifecycle, snapshot, Quick Adjust, sync, schema, native, package, or later-task product file changed.

### What was checked

- An empty or whitespace-only blank name left the saved-setup count, current setup, active session, Race Day data, and Saved feedback unchanged.
- Copying with an empty name created exactly one new Current setup with a source-derived name and preserved the live Race Day and active-session bytes.
- Entering `C5 Named Blank` created exactly one blank Current setup with that exact name and no numbered fallback.
- The new pencil measured exactly 44×44px in Default at 360px and about 50.59×50.59px in Large. It remained unclipped at 360, 390, and 412px.
- Historical starting and active event-owned cards showed `VIEW ONLY` and no pencil. An unrelated Current setup remained renameable while the live Race Day was present.
- Pressing the pencil focused the exact input `setup-chassis-setup-rec-1784412999666`. That focus action changed no setup, active-session, Race Day, dirty, or Saved state.
- Typing `C5 Renamed Current` appeared in Local Storage immediately while the live event-owned setup and Race Day remained unchanged. No immediate Saved message appeared; exactly one later C4 boundary confirmation was observed. The new name survived a force-stop and relaunch.
- Light and dark modes and the Default and Large font choices rendered without horizontal overflow at exact authenticated Android viewports of 360×800, 390×844, and 412×915.
- The focused setup harness ran 84 C5 assertions and independently killed all 20 required mutations while retaining the earlier C1-C3 proof.
- Eight focused setup, Saved, lifecycle, Quick Adjust, offline/resume, tire, and touch-target regressions passed.
- The complete raw 24-harness matrix was exactly 23/24. The only failure was the already documented stale `muted-text-color-harness.ts` AuthView byte lock.
- Type-checking reported exactly the three known baseline errors and no new error. The production build completed with exactly 566 transformed modules.
- The exact two-file scope, protected paths, diff check, clean worktree, and independent cavecrew review all passed.

### Preview and debug APK

The accepted Netlify draft preview is:

https://6a5bf7e2eadc63cd8a09d116--crew-chief-race-notes.netlify.app/

This is a draft only; production was not published. The signed-out shell passed at 360×800, 390×844, and 412×915. Each viewport was exact, showed only the authentication gate, had no horizontal overflow, kept the pinch-enabled viewport metadata, and kept every visible control at least 44px. The built-in browser reported no warnings or errors.

A Java 21 debug APK was built at `android/app/build/outputs/apk/debug/app-debug.apk`, installed on `emulator-5554`, and used for the authenticated scenarios. It is 12,085,112 bytes with SHA-256 `6801A2CEF805508A20D222BD6282659833AC674BC10E994C88CD60AF9FD94FDE`. The emulator's temporary phone-size overrides were restored to its physical 1344×2992 at density 480 afterward. There was no application crash or product JavaScript exception.

### Result and what comes next

C5 is a final **PASS, 100/100**. No C5 repair remains.

The mandatory Chunk C QA is next. It will test C1 through C5 as one integrated system, including the owner setup/session scenario, Quick Adjust coexistence, historical immutability, phone-width steppers, process-death persistence, and every Saved boundary. Chunk D cannot begin until that gate passes. After Chunk C, the remaining roadmap is Chunk D deletion integrity, Chunk E help/copy/hardening, the final full-sprint QA, and the cold third-party review handoff. No production publish, Git push, or master merge has occurred.
