# UX Overhaul v2 — Owner Report

## Current status

Tasks C2, C2.5, C3, C4, C5, the integrated Chunk C gate, D1, D2, and the owner's setup-label microfix are complete. D2 passed on its second QA attempt with a score of 100/100. D3 remains active after its first QA attempt failed 85/100 on one offline/local-only defect. A narrowly scoped SOL High repair is next. Chunk D QA and later work remain blocked until D3 passes.

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

## Chunk C — Integrated setup, session, and save-behavior QA

### What was checked

Chunk C did not add another feature. It tested C1 through C5 together as one system before allowing deletion work to begin. The review covered the complete accepted code range, not only the latest commit. It confirmed that only the seven approved product files changed across Chunk C and that synchronization, database policy, Android native code, packages, release files, credentials, and future Chunk D/E product files were untouched.

The integrated scenarios confirmed all of the important handoffs between tasks:

- Historical and active Race Day setups remained view-only, while unrelated Current setups remained editable and renameable.
- Every run retained its own frozen setup snapshot. The run history showed no change from Starting Setup to Hot Laps, the exact gear change from Hot Laps to Qualifying, and no change from Qualifying to Heat. The later Test run captured the same event-owned setup and its own frozen snapshot.
- The one Quick Adjust gear entry remained a separate run adjustment. It was not duplicated as a legacy setup log entry or lost when the bound setup differences were displayed.
- The live event setup's Pending panel and each run's Bound setup changes panel stayed computed from frozen data. None of those display rows were written into the historical change log.
- The stacked setup controls remained value-first with the minus and plus buttons side by side. At 360, 390, and 412 pixels there was no clipping or horizontal overflow. Controls were at least 44 pixels in Default and about 50.59 pixels in Large.
- Blank setup creation still rejected empty input without a write. A valid named blank created one Current setup, and copying without a name created one meaningfully named Current setup with the correct source reference.
- Pressing the rename pencil focused the exact existing Chassis field and changed no stored data. Typing a rename updated Local Storage immediately, showed no immediate Saved message, and survived force-stop and relaunch.
- Backgrounding after an edit produced one confirmation. Repeating a clean background produced none. A later dirty edit produced one timer confirmation. Force-stopping before confirmation lost no data.
- Creating a new Test run persisted the run, setup source, and frozen snapshot before feedback. The existing pressure-source information message correctly took priority over Saved, and the live setup's historical change log remained byte-for-byte unchanged.

### Automated, browser, and Android results

The focused setup, Saved-boundary, lifecycle, Quick Adjust, offline/resume, tire, and touch tests all passed. The complete raw test matrix was exactly 23 of 24, with the only failure being the already documented stale AuthView byte-count lock in `muted-text-color-harness.ts`. Type-checking reported exactly the three known baseline errors and no new error. The production build completed with exactly 566 transformed modules. An independent cavecrew cumulative review returned PASS, 100/100, with no repair finding.

The accepted Netlify draft preview is:

https://6a5c0047acf340e24b649f28--crew-chief-race-notes.netlify.app/

This is a draft only. The signed-out shell passed at 360×800, 390×844, 412×915, and 1080×2118 with only the authentication screen, exact viewports, no horizontal overflow, controls at least 44 pixels tall, pinch-enabled viewport metadata, and no browser warnings or errors. Production was not published.

A Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is available at `android/app/build/outputs/apk/debug/app-debug.apk`, is 12,085,112 bytes, and has SHA-256 `6801A2CEF805508A20D222BD6282659833AC674BC10E994C88CD60AF9FD94FDE`. Authenticated checks passed at 360×800, 390×844, and 412×915 in light and dark modes and the Default and Large font choices. The emulator was restored to its physical 1344×2992 resolution and density 480. There was no application crash or product JavaScript exception.

### Result and what comes next

Chunk C is a final **PASS, 100/100**. No C1–C5 or integrated Chunk C repair remains.

Task D1 is next. It is a deliberately small deletion-integrity change: a cloud delete must prove that a row was actually deleted, not merely return without an error. A blocked delete that affects zero rows must remain queued, show honest retry/error status, and never be reported as successful. D1 is isolated to the existing shared-delete helper, its existing replay decision point if needed, and its production-bound test. D2, D3, Chunk D QA, Chunk E, and final full-sprint QA remain blocked behind that sequence. No production publish, Git push, or master merge has occurred.

## Task D1 — Zero-row cloud-delete detection

### What was built

D1 closes a subtle deletion-integrity gap. Previously, the app treated a Supabase delete as successful whenever the request returned no API error. Under row-level security, however, a request can return without an error while deleting zero rows. That could make the app discard its pending delete too early and later allow cloud data to reappear.

The implementation is commit `1ca3576`. It changes only the existing shared-delete helper in `src/lib/sync.ts` and its production-bound proof in `scripts/saved-flash-harness.ts`. The helper now asks Supabase to return the deleted row ID and reports success only when the response contains the exact requested ID. Empty results, missing data, a different ID, an API error, and a thrown exception all remain failures and publish an honest sync-error state.

No replay code in `src/App.tsx` needed to change. Its existing behavior was already correct: failed deletes stay in the account-scoped queue, the retry remains exactly five seconds, queued records stay filtered out of subsequent pulls, successful deletes alone remove their intent, and stale account or authentication generations cannot continue a replay.

### What was checked

- The new test compiles and executes the real changed helper and the real unchanged replay and pull-filter slices. It uses a deterministic Supabase mock and never contacts or changes the live database.
- The D1 proof ran 62 assertions and independently killed all 13 required failure mutations, including removing the selected-row request, accepting empty or missing results, accepting API errors or exceptions, discarding a zero-row intent, changing the retry delay, weakening account-generation guards, retaining a proven success, and allowing Saved or Synced to hide a terminal delete failure.
- Eleven focused Saved, offline, resume, ownership, confirmation, setup, lifecycle, Quick Adjust, tire, and touch-target regressions passed.
- The complete raw 24-test matrix remained exactly 23 of 24. The only failure was the already documented stale `muted-text-color-harness.ts` byte-count lock, with the same `15 !== 16` result.
- Type-checking reported exactly the three known baseline errors and no new error. The production build completed with exactly 566 transformed modules.
- The implementation commit has the exact expected parent, contains one focused implementation commit, changes only the two authorized files, leaves `src/App.tsx` and every later-task or protected path untouched, passes `git diff --check`, and leaves the worktree clean.
- An independent cavecrew review returned PASS, 100/100, with no repair finding.

### Preview and debug APK

The accepted Netlify draft preview is:

https://6a5c0eb3acf3400ae9649f2f--crew-chief-race-notes.netlify.app/

This is a draft only; production was not published. Its signed-out authentication shell passed at 360×800, 390×844, and 412×915 with exact viewport sizes, no horizontal overflow, a 44-pixel minimum visible control height, pinch-enabled viewport metadata, and no browser warnings or errors.

A Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is available at `android/app/build/outputs/apk/debug/app-debug.apk`, is 12,085,163 bytes, and has SHA-256 `4276E03B2C11570C83EDBFC8E9887C3142201A962D0C3B8BC95866169FB72678`. It resolved and launched `nimbus.engineering.crewchief/.MainActivity`, rendered the authenticated Dashboard, and left the Android crash buffer empty.

### Result and what comes next

D1 is a final **PASS, 100/100**. No D1 repair remains.

D2 is next. Team users will receive two explicit Clear All Data choices. The device-only choice will remove local data without queuing cloud deletes and will warn that cloud data can return on sync. The everywhere choice will queue deletion only for records the signed-in user actually owns; records owned by another team member will remain in the cloud and the dialog will say so. Solo and unresolved-membership behavior, the existing deferred-delete machinery, D1's proof requirement, row-level security, and the pull filter must remain unchanged. D3, Chunk D QA, Chunk E, and final full-sprint QA remain blocked behind D2. The pre-D1 save point `9d9e4e1` was pushed to `origin/codex/ux-overhaul`; the D1 implementation and these QA records remain local. No production publish or master merge occurred.

## Owner setup-label microfix before D2

The corner setup cards now use the short visible label **Tire** instead of **Tire from Inventory**. This removes the collision with the neighboring **Bound Load Graph** label shown in the owner's screenshot. The inventory picker itself is unchanged: it still offers the same inventory options, keeps the same selected value and handlers, and retains the existing inventory wording in its placeholder.

The implementation is commit `dc5c63d`. It changes one visible label in `SetupView.tsx` and adds a production-bound regression to `setup-touch-target-harness.ts`. The focused eight-test group passed, the complete test matrix stayed at the expected 23 of 24 with only the known muted-text lock failing, type-checking stayed at exactly the three known baseline errors, and the production build transformed exactly 566 modules. Scope, diff, clean-worktree, and independent reviewer checks all passed.

Draft preview `https://6a5c19518df1ec312c463f95--crew-chief-race-notes.netlify.app/` is a draft only. The mobile authentication shell remained correct, and the installed Java 21 debug APK showed the two-column corner cards with **Tire** aligned cleanly beside **Bound Load Graph**. The APK is 12,085,162 bytes with SHA-256 `EC713FBD1F251F9F6BF7D97F5DE691BB7A5EB19F0727AD16C72230A5D4128DFE`. No production deploy, release build, signing, push, or merge was performed.

For D2, the owner authorized a dedicated Crew Chief account for destructive deletion testing. The implementation worker will use mocks only. During independent QA, the device-only option will be tested first to prove that cloud data can return as warned. The delete-everywhere option will be tested last, leaving that account's owned racing data cleared. The account itself, authentication record, team, membership, and any other user's records will not be deleted. Credentials are not stored in this report or any repository file.

## Task D2 — QA attempt 1

D2 attempt 1 is a **FAIL, 92/100**. The main deletion behavior worked, but the final confirmation message did not tell the truth, so the task cannot be accepted yet.

Commit `803d5d0` adds the two team-account choices. **Clear this device only** clears the same local racing records without queuing cloud deletion. **Delete my records everywhere** queues all nine shared datasets only when the signed-in user is the canonical team owner, always handles that account's personal tires, and never targets records owned by another team member. The old signed-out, solo, and unresolved-membership paths remain unchanged.

The automated checks were strong: 123 D2 assertions and all 23 D2 mutations passed, the retained D1 proof passed 62 assertions and 13 mutations, fourteen focused regressions passed, the complete matrix stayed at the expected 23 of 24 with only the known muted-text lock, type-checking stayed at exactly three known errors, the build transformed 566 modules, the three-file scope was clean, and an independent reviewer returned 100/100.

Draft `https://6a5c21695715094ce135f7b4--crew-chief-race-notes.netlify.app/` showed both choices and their warning text correctly at 360×800, 390×844, and 412×915. The authorized device-only live test also proved the important data behavior: local cars, setups, and Race Day data disappeared, then returned from the cloud after reload. No cloud data was deleted by that choice.

The blocker appeared immediately afterward. The toast said **That action could not be completed** even though the clear had succeeded. The new success sentence was passed through an older message mapper that did not recognize it and replaced it with a generic failure message. The delete-everywhere live test was deliberately not run after this finding.

The repair is tightly bounded. A SOL High worker will add structured success messages for the device-only and everywhere results in `App.tsx` and extend `saved-flash-harness.ts` so either result fails the test if it ever falls back to the generic failure message. The already-passing dialog and deletion logic stay unchanged. D3 and all later work remain blocked until repaired D2 passes, including the final authorized delete-everywhere test.

## Task D2 — Final result after repair

D2 is a final **PASS, 100/100** on QA attempt 2. The repair is commit `e29c0f0` on governance parent `5580cb3`. It changes only `App.tsx` and `saved-flash-harness.ts`. The two team-account results now use dedicated structured notification reasons, so the device-only action reports that shared team data will return on sync and the everywhere action reports that the signed-in user's records are queued while records owned by others remain. The already-passing dialog, deletion ownership rules, queue/push pairing, local wipe, retry behavior, and legacy paths did not change.

The expanded production-bound proof passed 143 D2 assertions and killed 29 independent mutations. D1 remained at 62 assertions and 13 mutations. All fourteen focused regressions passed. The complete harness matrix remained at the expected 23 of 24, with only the existing muted-text lock failing `15 !== 16`. Type-checking reported exactly the three known baseline errors, the production build transformed exactly 566 modules, the two-file repair scope was clean, protected paths had no diff, and independent cavecrew review passed 100/100.

Draft preview `https://6a5c275c8df1ec557846405c--crew-chief-race-notes.netlify.app/` is a draft only. At 360×800, 390×844, and 412×915, both choices and their warning copy were present, the page had no horizontal overflow, the three clear/cancel controls were exactly 44 pixels tall, and the viewport metadata remained pinch-enabled.

The authorized live sequence passed in the required order. First, device-only clearing removed the local cars, setups, and Race Day records, showed the correct success message, and a reload restored the cloud fixtures. Then the everywhere action showed the correct success message, cleared local state, and after two sync waits and reloads the account's owned car, setups, and Race Day records did not return. The login and team membership remained intact; no account, authentication record, team, membership, schema, or other user's records were deleted.

A Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is available at `android/app/build/outputs/apk/debug/app-debug.apk`, is 12,085,818 bytes, and has SHA-256 `8643DCD7FC47D7EB95E511B56397F27AA37943F0DE0A14ED795A548EE8C3F550`. It launched `nimbus.engineering.crewchief/.MainActivity` without an application crash; the only captured Android diagnostic was a benign WebView variations-seed warning.

D2 has no remaining repair. D3 is next: car deletion must enumerate dependent records, require strong confirmation, cascade through existing queue-plus-push paths without orphaning or resurrecting data, preserve embedded session setup snapshots, keep active-car reassignment correct, and report a mid-cascade failure honestly instead of showing Saved. No production publish, release build, Git push, PR, or master merge occurred.

## Task D3 — QA attempt 1

D3 attempt 1 is a **FAIL, 85/100**. Most of the feature is correct, but car deletion does not work in the app's signed-out offline mode, so the task cannot be accepted yet.

Implementation commit `120fa72` adds the strong Garage confirmation, exact dependent-record counts, cascading removal for setups, personal tires, shock records, car-scoped maintenance components and their logs, and active-car/setup reassignment. It preserves Race Days and every historical session snapshot, keeps unrelated and rig-level maintenance data, uses the existing deletion queues and push paths, and makes disabled setup cards explain why they cannot be deleted individually with a separate route to Garage.

The implementation is cleanly isolated to the eight authorized files. Its production-bound tests report 174 D3 assertions and kill 40 independent mutations. The complete builder matrix stayed at the expected 23 of 24 with only the known muted-text lock, type-checking stayed at exactly the three known baseline errors, the production build transformed 566 modules, and the independent focused confirmation, setup, status, and cascade harnesses all passed. Independent diff review found no second blocker.

The blocker is in the delayed account-safety check. When the app is running from its remembered local account without a live signed-in user, it stores the captured account identity as `null`. The later check compares that with an optional user ID, which evaluates to `undefined`. Because `undefined` and `null` are different values, the cascade exits immediately. The confirmation and Undo UI still appear, but after the delay the car and all linked local records remain. The existing test missed this because it only ran the real handler with a signed-in account and explicitly expected the flawed comparison.

The repair is limited to `App.tsx` and `car-delete-undo-harness.ts`. The identity check will normalize both missing identities to the same value. The expanded test will run active-car, non-active-car, and last-car cascades with no live user, prove that all intended local records are removed and selection is safe, and prove that no cloud queue, push, or null-owned delete intent is created. It will also deliberately reintroduce the original comparison and require that mutation to fail. Signed-in account-replacement protection and every existing D3 proof remain required.

No Netlify preview or APK was produced for this failed candidate. After the SOL High repair, the full focused suite, raw matrix, lint, build, isolated scope, protected-path, and cavecrew gates will run again before browser and debug-APK inspection. Chunk D QA and every later task remain blocked until repaired D3 passes.

## Task D3 — Final result after repair

D3 is a final **PASS, 100/100** on QA attempt 2. The original car-cascade feature is commit `120fa72`; the repair is commit `a5e72d0`. The repair changes only `App.tsx` and the car-delete production harness. It normalizes a missing signed-in identity so remembered-device/offline use can finish the local cascade, while keeping every cloud deletion queue and push behind a real signed-in account.

The repaired real-handler tests cover deleting an active car, a non-active car, and the last car while signed out. In every case, the correct local records are removed, active car and setup selection remain safe, unrelated records and Race Day session history remain unchanged, and no cloud queue, push, or ownerless delete intent is created. The combined D3 proof passed 222 assertions and all 41 independent mutations. D1, D2, ownership, offline/resume, lifecycle, Quick Adjust, tire, and touch-target regressions also passed. The complete test matrix remained at the expected 23 of 24, with only the existing muted-text byte-count lock failing `15 !== 16`. Type-checking reported exactly the three known baseline errors, and the production build transformed exactly 566 modules. Scope, protected-path, clean-worktree, and independent reviewer checks all passed.

The accepted draft preview is:

https://6a5c406dc530a48c644693bd--crew-chief-race-notes.netlify.app/

This is a draft only. The signed-out shell passed at 360×800, 390×844, and 412×915 with exact viewports, no horizontal overflow, controls at least 44 pixels tall, pinch-enabled viewport metadata, and no browser warnings or errors.

A Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is available at `android/app/build/outputs/apk/debug/app-debug.apk`, is 12,087,614 bytes, and has SHA-256 `704836E5280FC53010AF0FC92F72426EA57D35E3FE3AD5AC5D95CE8F768DE0C4`.

The first Android view briefly showed the older disabled-delete screen because the embedded WebView had preserved a previous Workbox asset cache. Only that stale service-worker registration and cache were cleared; no user or racing data was cleared. The exact installed APK then showed Delete enabled for cars that had dependent setups, as intended. A temporary synthetic car and setup exercised the complete flow: strong confirmation, Cancel with no change, the five-second Undo window, permanent cascade, honest completion status, and reload/sync without resurrection. The synthetic fixture was deleted afterward. The Android crash buffer was empty and there was no product JavaScript error.

The dedicated D2 account's owned racing data remains cleared. Its login, authentication record, team, and membership remain intact, and no credentials are stored in the repository or this report.

No D3 repair remains. The mandatory Chunk D integrated QA is next. It will audit D1, D2, and D3 together for honest zero-row handling, ownership-safe clear modes, cascade ordering, retry and pull filtering, no orphan or resurrection, preserved Race Day history, and truthful status priority before Chunk E can begin. No production publish, release build, Git push, PR, or master merge occurred.

## Chunk D — Integrated deletion and data-trust QA

Chunk D is a final **PASS, 100/100**. This was a read-only whole-chunk review; it did not add or change product behavior. It tested D1, D2, and D3 together and reviewed every accepted change from the pre-D1 save point through the repaired D3 candidate.

The cumulative product scope is exactly five files: the existing shared-delete helper, the main app orchestration, and the Settings, Garage, and Setup views. Five production-bound test files and four governance documents account for the remaining changes. Database schema and policy, native Android source, packages, release files, queue formats, ownership and setup-lifecycle helpers, resume timing, authentication-generation guards, and all Chunk E product paths remained untouched.

The integrated checks confirmed the complete deletion chain:

- A shared cloud delete succeeds only when Supabase returns the exact requested row ID. Empty, missing, wrong-ID, error, and exception results remain queued, retry after exactly five seconds, stay filtered out of pulls, and cannot be reported as Saved or Synced.
- Clear this device only performs no cloud deletion and truthfully warns that shared records can return. Delete my records everywhere targets only the signed-in user's canonically owned shared records and personal tires; it never targets another team member's records.
- Car deletion counts and removes setups, tires, shock records, car-scoped maintenance components and their logs, then the car last. Active, non-active, and last-car selection remain safe. Unrelated and rig-level records survive.
- Undo and strong confirmation remain one-shot and cancel-safe. Clear All cancels a pending car deletion instead of committing it. Account replacement and signed-out use remain isolated.
- Race Days and every embedded session snapshot remain unchanged. Only permitted dangling top-level pointers are repaired. Queued records cannot reappear after a resume pull.
- Signed-out/offline deletion completes all intended local writes while creating no cloud queue entry, push, or ownerless intent. A real mid-cascade failure remains queued and its error message wins over Saved or Synced.

The focused proof retained the exact totals: D1 passed 62 assertions and 13 mutations; D2 passed 143 assertions and 29 mutations; D3 passed 222 assertions and 41 mutations. Ownership, offline, resume, confirmation, Undo, lifecycle, Quick Adjust, tire, touch-target, and status regressions all passed. The complete 24-test matrix was exactly 23 passes and one expected failure: the unchanged `muted-text-color-harness.ts` byte-count lock reported `15 !== 16`. Type-checking reported exactly the three known baseline errors, and the production build transformed exactly 566 modules. Independent cumulative review returned PASS, 100/100, and the worktree remained clean.

No product bytes changed after the accepted D3 candidate, so Chunk D reused its exact inspected artifacts. Draft preview `https://6a5c406dc530a48c644693bd--crew-chief-race-notes.netlify.app/` had already passed the signed-out 360×800, 390×844, and 412×915 shells with no overflow, undersized controls, or browser errors. The installed Java 21 debug APK remains 12,087,614 bytes with SHA-256 `704836E5280FC53010AF0FC92F72426EA57D35E3FE3AD5AC5D95CE8F768DE0C4`; `emulator-5554` was present and its Android crash buffer was empty.

The temporary D3 synthetic car and setup remain deleted and did not return. The dedicated D2 account's owned racing data remains cleared. No destructive D2 fixture was recreated, no account, authentication record, team, membership, or other user's data was deleted, and no credential was stored.

Chunk D has no remaining repair. Task E1 is next: move context-aware App Guide help to a header question-mark button beside the unchanged Tuning Guide button, preserve the dedicated four-bar help control, and remove the redundant inline Setup help button. E2 will clarify Create labels, E3 will make the bounded closeout fixes, then the whole branch receives final full-sprint QA. No production publish, release build, Git push, PR, or master merge occurred.

## Task E1 — QA attempt 1

E1 attempt 1 is a **FAIL, 96/100**. The context-aware help feature itself is working as designed, but one required safeguard is missing from its automated proof, so the task is not accepted yet.

Implementation commit `45e60c9` adds an App Guide question-mark button in the authenticated header immediately after the unchanged Tuning Guide button. It chooses the Four Bar guide while the Four Bar sheet is visible, the Setup guide on the Setups tab, any explicitly mapped guide topic next, and the App Guide root everywhere else. The destination is resolved when the button is pressed, rather than cached earlier. Race Day reports Four Bar visibility through a stable callback and clears it on normal close, Android back, unmount, and tab departure. The redundant Setup header question mark is removed while the Four Bar, Loads, and Setup Diff deep links remain. `FourBarQuickAdjust.tsx` is byte-for-byte unchanged.

The implementation changes exactly the five authorized files and the worktree is clean. The E1 harness passed 85 assertions and killed all 27 existing mutations. All focused regressions passed. The complete matrix was exactly 23 of 24, with only the unchanged muted-text byte-count lock failing `15 !== 16`. Type-checking reported exactly the three known errors, and the production build transformed exactly 566 modules.

A draft-only preview was created at `https://6a5cc4ff714d1444000df60c--crew-chief-race-notes.netlify.app/`. Its signed-out shell passed at 360×800, 390×844, and 412×915 with exact viewport dimensions, no horizontal overflow, controls at least 44 pixels tall, pinch-enabled viewport metadata, and no browser warnings or errors. A Java 21 debug APK also assembled successfully. Installation and authenticated route inspection were stopped once the blocking proof finding was confirmed, because a failed candidate is not accepted for device sign-off.

The missing safeguard is in `chunk9-export-help-harness.ts`. The harness reads the expected product files but does not inspect the implementation commit's changed-file list. That means an unauthorized protected file, or an early E2/E3 change, could be added to the E1 commit without making the E1 harness fail. Independent cavecrew review found no product defect, but correctly failed this required proof.

The repair is limited to `scripts/chunk9-export-help-harness.ts`. A SOL High worker will bind the original E1 implementation commit to the exact five-file allowlist, prove `FourBarQuickAdjust.tsx` is absent, and add independent mutations for representative protected, E2, E3, sync/data, native, schema, and package paths. Every product file is frozen. After repair, the complete focused, matrix, lint, build, diff, preview, debug-APK, and independent review gates will run again. E2 and all later work remain blocked until E1 passes. No production deployment, release build, Git push, PR, merge, or owner-data mutation occurred.

## Task E1 — QA attempt 2

E1 attempt 2 is also a **FAIL, 96/100**. The App Guide product behavior remains correct and unchanged. This failure is another narrow test-harness edge case.

Repair commit `e2e7fe9` changes only `chunk9-export-help-harness.ts`. It correctly binds the original E1 commit and parent to the exact five authorized files, explicitly proves that `FourBarQuickAdjust.tsx` was untouched, and adds checks for missing, duplicate, protected, E2, E3, Android-native, database-schema, and package-file changes. The prior 85 assertions and 27 mutations remain; the expanded harness passes 97 assertions and kills 35 mutations. The SOL High worker also passed all eight focused tests, the expected 23-of-24 full matrix, the exact three-error type-check baseline, the 566-module build, clean/protected scope checks, and its independent review. Primary QA independently reran all eight focused tests successfully.

The remaining defect is that the new pure scope validator trims whitespace and discards blank entries before comparison. As a result, a whitespace-padded replacement for an authorized path or an appended empty path is incorrectly treated as valid. The repair order explicitly requires every changed path to retain its identity and every extra path to fail, so this is a strict test-proof failure even though no product file is wrong. Primary QA stopped the redundant full matrix after independently reproducing this deterministic blocker.

Final SOL High attempt 3 remains limited to the same one harness file. It will normalize path separators only, leave Git-output blank-line cleanup outside the validator, and add independent mutations for an empty extra and a whitespace-altered authorized path. Product files stay frozen. If attempt 3 fails QA, the plan's three-failure escalation rule transfers the fix to the primary Extra High agent. E2 and later tasks remain blocked. No new preview, APK installation, live data operation, production deployment, push, PR, or merge occurred.

## Task E1 — Final result after repair

E1 is a final **PASS, 100/100** on QA attempt 3. The product feature remains commit `45e60c9`. The first proof repair is `e2e7fe9`, and the final identity-preserving proof repair is `b160f7a`.

The final repair changes only `chunk9-export-help-harness.ts`. It no longer trims or discards path entries inside the pure scope validator. Git output cleanup remains outside that validator. New independent tests prove that an empty extra path and a whitespace-altered authorized path both fail, while Windows and Unix path separators remain compatible. All prior proof remains intact. The E1 harness now passes 99 assertions and kills 37 independent mutations.

All eight focused regressions passed. The complete matrix was exactly 23 of 24, with only the unchanged muted-text byte-count lock failing `15 !== 16`. Type-checking reported exactly the three known errors. The production build transformed exactly 566 modules. Exact implementation and repair scopes, ancestry, protected paths, clean worktree, and independent cavecrew review all passed. The final reviewer score was 100/100.

Because both repairs are harness-only, the accepted product bytes are identical to the already inspected draft:

https://6a5cc4ff714d1444000df60c--crew-chief-race-notes.netlify.app/

Its signed-out 360×800, 390×844, and 412×915 shells remain free of horizontal overflow, undersized controls, viewport restrictions, browser warnings, and browser errors.

A fresh Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is 12,087,436 bytes with SHA-256 `8BE9442EE19F439CE73C898AA4B8ED4839E7C10909FBD10071FFD2A15FDB7B00`. It cold-launched in 5.628 seconds into the existing authenticated device state. Dashboard and Settings opened the App Guide root, Setups opened the Setup topic, the unchanged Tuning Guide remained separate, and Four Bar visibility resolved the Four Bar topic. Android back and tab departure cleared the Four Bar context. The dedicated inline Four Bar help remained reachable and unchanged. Visible controls were at least 50.59 pixels, the 448×997 viewport had no horizontal overflow, and the crash buffer was empty.

The WebView initially served an older cached header. Only its service-worker registration and cached app assets were cleared so the exact APK bundle could load. Login state, account, team, local storage, and racing data were not cleared or edited. The only error-level Android diagnostics were the emulator's known missing variations signature and software-renderer rendernode messages; there was no application crash or product JavaScript error.

E1 has no remaining repair. E2 is next and is copy-only: keep Add/New labels on buttons that open forms, but label the create-form submit actions Create Car, Create Tire, Create Race Day, and Create Job. The Race Day submit already complies and will be verified rather than changed. No production deployment, release build, push, PR, merge, or live-data mutation occurred.

## Task E2 — Final result

E2 is a **PASS, 100/100** on its first QA attempt. Implementation commit `2e2c277` applies the agreed creation-label convention without changing how any form works.

Buttons that open creation forms still say Add or New. Once a form is open, its new-record action now says Create: Add Car opens a form with Create Car, Add Tire opens a form with Create Tire, New Race Day retains Create Race Day, and Add Maintenance Job opens a form with Create Job. Editing remains separate: Tire edits still say Save Tire, and Race Day edits still say Save Changes. Form titles, fields, validation, disabled states, handlers, styling, persistence, cloud calls, and success behavior did not change. The durable codebase reference now states the same Add/New, Create, and Save convention.

The change is confined to three visible submit strings, the convention note, and production-bound test coverage. `RaceWeekendView.tsx` was verified but not changed because it already complied. The expanded test reports 48 E2 assertions and defeats 12 independent bad-change mutations, including submit labels being reverted, openers being changed, edit labels drifting, a handler being rewired, disabled behavior being removed, and a submit type being removed. Eight focused regression suites passed. The complete 24-test matrix remained at the expected 23 passes and one known stale muted-text lock (`15 !== 16`). Type-checking reported exactly the three existing baseline errors, and the production build transformed exactly 566 modules. Scope, protected-path, clean-worktree, and independent reviewer checks all passed; the reviewer score was 100/100.

The accepted draft preview is:

https://6a5cdf4dee7c5a9451464efb--crew-chief-race-notes.netlify.app/

This is a draft only. Its signed-out shell passed at 360×800, 390×844, and 412×915 with exact viewport sizes, no horizontal overflow, controls at least 44 pixels tall, pinch-enabled viewport metadata, and no browser warnings or errors.

A fresh Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is available at `android/app/build/outputs/apk/debug/app-debug.apk`, is 12,087,738 bytes, and has SHA-256 `8FA4583766CAFBEF3E5F5CA642E1B149D990A98B3C9C754B65FB4C18D94BEFF3`. The installed app cold-launched successfully. All four creation forms were opened and inspected in the existing authenticated device state, then cancelled without typing, submitting, deleting, or changing racing data. The native 448×997 view had no horizontal overflow, the Android crash buffer was empty, and there was no application JavaScript error. The only captured diagnostic was Android WebView's benign missing variations-seed signature warning.

The WebView initially served an older cached label. Only its stale service-worker registration and Workbox asset cache were removed so the exact installed APK bundle could load. Login, account, team, local storage, and racing data were left intact.

E2 has no remaining repair. E3 is next and is the final bounded implementation task: prevent native-auth callbacks from updating state after unmount, handle a rejected native listener cleanup, keep desktop scrollbar affordances by limiting universal scrollbar hiding to coarse-pointer devices, and explicitly mark the unused team-location functions as intentional scaffolding. After E3 light QA, the required whole-sprint QA and independent-review handoff document remain. No production deployment, release build, push, PR, merge, or live-data mutation occurred.

## Task E3 — Final result

E3 is a **PASS, 100/100** on its first QA attempt. Implementation commit `f6e9181` closes the four small technical findings without changing any feature flow or visible wording.

The Android Google-sign-in callback now checks whether its screen is still active before clearing or showing an authentication error. That prevents late asynchronous work from updating an unmounted app. The native URL-listener cleanup still removes the listener, and now also handles a rejected listener or cleanup promise with a diagnostic warning instead of leaving an unhandled rejection.

Scrollbar hiding is now limited to coarse-pointer devices such as phones and tablets. Touch devices retain the clean full-screen appearance, while desktop and fine-pointer browsers keep their normal scrollbar affordance. The two unused team-location functions are now explicitly documented as intentional, currently unwired scaffolding; their runtime code did not change.

The commit changes exactly `App.tsx`, `index.css`, and `location.ts`. The App change is confined to the native-auth deep-link effect, the CSS change only wraps the existing scrollbar rules, and the location change is comments only. Resume sync, Saved feedback, other authentication behavior, help, labels, setup and session history, deletion, local storage, cloud data, Android native source, packages, and database files are unchanged. Independent diff review returned 100/100 with no findings.

Eleven focused regression files passed, covering native authentication, offline/resume behavior, Saved boundaries, D1/D2/D3 deletion safety, help routing, setup touch behavior, lifecycle, Quick Adjust, tires, and confirmation. The complete 24-test matrix remained at the expected 23 passes and one known stale muted-text assertion (`15 !== 16`). Type-checking reported exactly the three existing baseline errors, and the production build transformed exactly 566 modules.

The accepted draft preview is:

https://6a5ce8943c4efd00286ee3d1--crew-chief-race-notes.netlify.app/

This is a draft only. At 360×800, 390×844, and 412×915 it had no horizontal overflow, every visible control was at least 44 pixels tall, the viewport remained pinch-enabled, and the browser console was clean. The fine-pointer browser reported normal scrollbar behavior, confirming desktop scrollbars are no longer universally hidden.

A fresh Java 21 debug APK was synchronized, built, and installed on `emulator-5554`. It is available at `android/app/build/outputs/apk/debug/app-debug.apk`, is 11,745,666 bytes, and has SHA-256 `E0726E1793A2D3A8AD1384EAA96D0F211EF5A5F9C252AE1CF5DA27C30EC2E8E3`. It cold-launched successfully into the existing authenticated device state. The Android WebView reported a coarse pointer and confirmed that the scrollbar rules are inside the coarse-pointer media rule. The 448×997 page had no horizontal overflow and the crash buffer was empty.

The WebView initially retained pre-E3 cached CSS. Only the service-worker registration and Workbox app-asset cache were removed so the exact installed APK bundle could load. Login, account, team, local storage, and racing data were not cleared or edited. The known WebView variations-seed warning and the existing pre-root Capacitor safe-area injection diagnostics remain recorded as platform residuals; no E3 authentication or listener-cleanup error occurred.

E3 has no remaining repair. All planned implementation tasks are now built. The required final whole-sprint QA is active next: it will test every owner complaint and cross-task interaction, run the complete harness and boundary audit, inspect authenticated layouts across the required sizes/themes/scales, and produce the independent-review handoff document. No production deployment, release build, push, PR, merge, or live-data mutation occurred.

## Final whole-sprint QA — Attempt 1

The first final QA attempt is a **FAIL, 96/100**, because the plan requires all 24 test files to pass in one run and the result was 23 of 24. The only failure is `muted-text-color-harness.ts`, which expects 16 muted-text sites in the Race Day screen but the current screen has 15.

This is not a visible product regression. The missing site belonged to the old disabled Compare Setup menu action. Task C3 deliberately removed that obsolete comparison and replaced it with the safer frozen per-run Bound Setup Changes summary and the Log Setup Changes route. The C3 tests already verify the replacement behavior and defeat mutations that remove or rewire it. Independent code review confirmed the product should not be changed or rolled back.

The color test itself still compares several current files to historical 2026-07 snapshots. Fixing only the 16-to-15 count would expose more stale comparisons. The approved repair is therefore limited to that single test file: retain the original 105-token color migration proof against the exact historical commits, retain current color-token and contrast checks, explicitly account for the accepted Setup `+1` and Race Day `-1` deltas, bind the Race Day delta to the exact C3 change, and add mutation checks so the repair cannot pass by merely weakening a count.

All product files are frozen during this repair. The remaining visual, Android, authorized final data cleanup, whole-branch boundary review, handoff document, final draft/debug artifacts, and saving-point push have not started in this attempt; they resume only after the repaired complete suite reaches 24 of 24. No deployment, APK build, data deletion, push, pull request, merge, production publish, release build, database change, or native-source change occurred during this failed attempt.

## Final QA repair — Result

The one-file test repair is a **PASS, 100/100**. SOL High commit `810d918` changes only `scripts/muted-text-color-harness.ts`; no application code changed.

The repaired test now separates the original muted-color migration from the application's later accepted evolution. It verifies the original 105 migrations across 16 components and eight historical opacity exceptions against the exact historical commits. It separately verifies the current application has 105 muted-text sites across the same 16 components, including one later Setup addition and the intentional removal of the obsolete Race Day Compare action. It also records the later Garage cascade-delete design. Those two accepted changes leave six current opacity exceptions, not the seven written in the first repair order.

The independent repaired test passed 232 assertions and defeated 11 independent mutations. The complete Windows matrix is now 24 of 24. Type-checking reports exactly the three known baseline errors and no new error. The production build transforms exactly 566 modules. Exact one-file scope, protected paths, clean worktree, and independent cavecrew review all pass.

Final full-sprint QA attempt 2 is now active. It still must complete the final signed-out draft matrix, authenticated Android screen and interaction matrix, authorized account data-clear/no-resurrection sequence, whole-branch boundary audit and review, cold-reader handoff document, final owner report, governance commit, debug artifact, and saving-point branch push. No deploy, APK build, live-data action, or push occurred during this repair QA.

## Final whole-sprint QA — Attempt 2

The second final QA attempt is a **FAIL, 88/100**. The complete automated test matrix now passes 24 of 24, type-checking still reports only the three known errors, and the production build still transforms exactly 566 modules. The final signed-out draft also passed at all four required sizes with the login gate, no horizontal overflow, pinch zoom enabled, controls at least 44 pixels, and no browser warnings or errors.

The failure was found only after installing the fresh debug build and measuring the authenticated Android screens themselves. Several controls are genuinely smaller than the required 44-pixel touch area. At the active Large scale, the Setup name field is 43.39 pixels tall, Setup Clone and Compare are 41.39 pixels wide, Loads actions are between 36.8 and 41.4 pixels tall, Quick Adjust fields are 43.4 pixels tall, the Maintenance close button is 27.6 pixels square, the Accounting filter is 38.8 pixels tall, and Export filters are 43.4 pixels tall. Default scale makes the padding-only controls smaller still.

This is a real final-integration defect, not a screenshot or rounding issue. The shared 44-pixel class works only where a component explicitly uses it. These controls do not. The existing touch-target test also has a blind spot: it passes 48 assertions and 12 mutations without rendering the failing Setup creation and card controls.

The approved repair is deliberately small. A SOL High worker may change only `src/index.css` and `scripts/setup-touch-target-harness.ts`. The CSS will provide a global 44-pixel minimum for visible native buttons and form controls, including the actual labels used to operate hidden file, checkbox, and radio inputs. The test must compile and render the real production CSS and cover all required pages at four viewports and both scales. It must also defeat independent mutations that remove the floor, reduce it to 43 pixels, remove button width, exempt buttons, remove label coverage, or allow the 20-pixel attachment-delete control to escape the global rule.

The draft created before this failure is:

https://6a5d52c877706b39b44d636c--crew-chief-race-notes.netlify.app/

It is a draft only. The fresh debug APK was successfully built and installed. It is 12,087,761 bytes with SHA-256 `4C7A5653B96226B094F70FB925C7FEAD10F3F299D921B9F78253C48E73424F0B`.

Because the final gate failed, the authorized data-clear and no-resurrection sequence was not run. No racing data, account, login, team, or membership was deleted. The final handoff and saving-point push also remain blocked until the repair passes and final QA attempt 3 is fully green. No production deployment, release build, signing, pull request, merge, master change, database change, or native-source change occurred.
