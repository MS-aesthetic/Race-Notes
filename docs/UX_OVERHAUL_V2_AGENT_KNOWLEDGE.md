# Crew Chief UX Overhaul v2 — Working Knowledge and Agent Runbook

> **Purpose:** durable cold-start guide for agents continuing the active UX Overhaul v2 sprint.
> This is a working handoff, not the Part 6.4 final independent-review packet and not a PASS verdict.
> **Last verified:** 2026-07-19 against product/QA base `c897cfd406ff074ad1a06535bdc015bb7198bf89`; documentation commits may sit above that base.

## 1. Current authority and exact checkout

Use this reading order:

1. `AGENTS.md` — repository-wide workflow, safety, architecture, and deploy authority.
2. `ralph/CURRENT_TASK.md` — exact active work order and file allowlist.
3. `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` — sprint design, especially Part 5, Part 6, and v2.1 addenda.
4. `ralph/STATE.md` — task history, scores, commits, failures, and current gate.
5. This document — consolidated implementation, tooling, QA, and handoff knowledge.
6. `CODEBASE_KNOWLEDGE.md` — deeper domain, storage, component, sync, and historical details.

Active checkout:

- Worktree: `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`
- Branch: `codex/ux-overhaul`
- Current verified product/QA base: `c897cfd406ff074ad1a06535bdc015bb7198bf89`
- Release baseline: `C:\Users\maxx\antigravity\Race-Notes` on `master`
- `C:\Users\maxx\.codex\worktrees\3d72\Race-Notes` is an independent QA/session checkout, not the active branch worktree.

Never create or switch branches/worktrees for this sprint. Run every command with the 203f worktree as its explicit working directory. Verify before and after work:

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
```

## 2. Product architecture that repairs must preserve

- React 19 + TypeScript + Vite 6 + TailwindCSS v4.
- Capacitor 8 Android wrapper; package `nimbus.engineering.crewchief`.
- No router. `src/App.tsx` owns tab selection and all durable domain state.
- Views are prop-driven. Do not introduce a second store or Context layer during this sprint.
- Local-first writes are mandatory: React state and localStorage update synchronously; signed-in cloud push is secondary.
- Setup, tire, shock, maintenance, Race Day, checklist, and accounting identifiers and storage keys are backward-compatible contracts.
- `race_notes_active_car` and `race_notes_active_weekend` remain device-local and never sync.
- Race Day session history is stronger than top-level relationship cleanup. Existing `sessions[]`, `SessionRecord.setupId`, and embedded `setupSnapshot` bytes must survive setup/car deletion repair unchanged.
- Cloud merge uses `updatedAt`; equal timestamps currently let the cloud record win. Any local relationship repair that must defeat stale cloud data must advance `updatedAt` on the changed record only.
- All visible native controls have a global 2.75rem minimum floor after `c897cfd`. Hidden/file/checkbox/radio glyph inputs stay exempt; their input-backed labels or semantic rows own the hit area.
- Default scale is 1.0 and Large is 1.15. Both are acceptance surfaces.

## 3. Development and implementation strategy history

### Release 5.0 and older worktrees

Release 5.0 consolidated the earlier `preview-v3` work into `master`. Old documentation describes a build-from-main bridge because the v3 worktree lacked complete native/gitignored dependencies. That bridge is historical for this sprint. The 203f worktree has the dependencies and Android project needed for direct debug builds.

Do not copy `dist` into the release tree. Do not use an old preview branch. Do not merge to `master` without a new explicit owner release authorization.

### UX Overhaul v2 structure

The v2 plan was deliberately serialized into five chunks:

- Chunk A: scale, density, sticky reservation, mobile geometry.
- Chunk B: pointer semantics and truthful Saved/sync/status feedback.
- Chunk C: canonical setup editability, session-bound snapshots/diffs, autosave boundaries, setup naming, and owner-priority stacked steppers.
- Chunk D: zero-row delete detection, clear-data ownership honesty, and car cascade deletion.
- Chunk E: context help, creation-label clarity, and small native/scrollbar cleanup.

Each task used a Ralph loop:

1. Primary QA/plan authority writes exact work order and file allowlist.
2. One `gpt-5.6-sol` High implementation task edits only that scope.
3. Primary `gpt-5.6-sol` Extra High independently reruns acceptance, focused regressions, full matrix, lint, build, scope, and runtime checks.
4. QA failure gets a revised durable work order before another implementation attempt.
5. After three consecutive failures of the same task, primary Extra High may implement directly under the same bar.

The v2.1 owner addendum supersedes older routing text: Terra at every tier and `cavecrew-builder` are forbidden. Use cavecrew investigator for bounded tracing and cavecrew reviewer for final diff/branch review. Runtime identity comes from rollout `turn_context.payload.model` and effort metadata, never prose self-identification. `scripts/verify-agent-handoff.ps1` helps inspect handoffs; its known one-model scalar bug may print only `g`. Do not patch that bug during sprint work.

### Strategy choices that worked

- Small task commits plus separate governance commits made regressions traceable.
- Chunk QA caught cross-task interactions before later work began.
- Production-derived harnesses compile or extract real source/CSS instead of testing hand-written approximations.
- Mutation tests prove assertions can fail. A passing count without an independently killed mutation is weak evidence.
- Raw full-matrix runs expose stale cross-task byte locks that focused tests miss.
- Signed-out browser checks and authenticated emulator checks cover different states; neither substitutes for the other.
- Destructive tests use device-only first and everywhere last, with ownership and no-resurrection checked after a real resume/pull.
- Workbox cache identity must be checked after every APK install. `adb install -r` can preserve an older service-worker bundle even when the APK is new.

### Strategies to avoid

- Do not rely on regex-only source checks for geometry, event behavior, or mutations.
- Do not treat `npm run build` as type-checking; Vite transpiles TypeScript without enforcing the lint gate.
- Do not accept a clean signed-out preview as authenticated product proof.
- Do not clear the entire emulator application merely to refresh assets; that destroys login and local test data.
- Do not timestamp every record during repair. Blanket timestamping creates false local precedence and needless sync churn.
- Do not repair stale relationship pointers without updating the changed record's timestamp.
- Do not reinterpret historical `sessions[]` while cleaning top-level setup relationships.

## 4. Available tools and where they fit

### Local command-line tools

- PowerShell on Windows for real Git, build, deploy, Android, and file verification.
- `rg` for source/file searches.
- Git with Windows Git Credential Manager. GitHub CLI is not installed in the verified environment.
- Node.js, `npm`, `npx`, Vite, TypeScript, `tsx`, and esbuild from the repository toolchain.
- Netlify CLI for manual draft deploys. Site is not Git-connected.
- Java 21: `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`.
- Android SDK/adb: `C:\Users\maxx\AppData\Local\Android\Sdk`.
- Gradle wrapper: `android\gradlew.bat`.

PowerShell execution policy may select `npm.ps1`/`npx.ps1`. If blocked, call `npm.cmd`, `npx.cmd`, or `netlify.cmd` explicitly.

### Codex/runtime tools

- `apply_patch` for tracked file edits.
- Shell execution for read-only inspection and verification.
- In-app Browser control for viewport, DOM, screenshot, and console checks.
- Chrome/computer-use when a logged-in browser or Windows UI is specifically required.
- `view_image` for local screenshot inspection.
- Cavecrew investigator/reviewer agents for bounded evidence and findings-first review.
- Codex task/thread tools for explicit `gpt-5.6-sol` High implementation sessions and runtime metadata verification.
- Supabase tools/skill for authorized live schema/data inspection. Current repair forbids schema, RLS, migration, Edge Function, or broad live-data changes.
- Netlify deploy skill/CLI for drafts only during this sprint.
- Android emulator QA tooling plus adb for authenticated device checks.

Never store credentials in source, docs, tool contracts, shell output, or commits. The dedicated deletion-test account was supplied out of band.

## 5. Build procedures

### Web build

Run directly in the 203f worktree:

```powershell
npm.cmd run lint
npm.cmd run build
```

Current expected lint baseline is exactly three pre-existing errors:

- `RaceWeekendView.tsx`: upload argument inferred as `unknown`, expected `File`.
- `SetupView.tsx`: `key` supplied to `CornerForm` props.
- `SmasherLoadsView.tsx`: upload argument inferred as `unknown`, expected `File`.

Any fourth error or changed baseline is a FAIL. Current production build expectation is exactly 566 transformed modules.

### Netlify draft preview

```powershell
netlify.cmd deploy --dir=dist
```

Use draft deploy only. Never add `--prod` without a new explicit owner production instruction. Record deploy ID and exact draft URL. Git push does not deploy this site.

### Android debug APK

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = 'C:\Users\maxx\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

npx.cmd cap sync android
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

Output:

`android\app\build\outputs\apk\debug\app-debug.apk`

Install without clearing data:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s emulator-5554 install -r android\app\build\outputs\apk\debug\app-debug.apk
```

Current sprint forbids release/signed builds, AABs, `release/` changes, native source/version changes, production deploys, or distribution.

### Workbox/WebView cache rule

After install, prove the WebView loaded the CSS/JS asset names present in `android/app/src/main/assets/public`. If it serves older names, preserve localStorage/login and remove only that debug package's WebView service-worker registration and Workbox HTTP/code cache. Inspect resolved paths first. Never use `pm clear nimbus.engineering.crewchief` during preservation-sensitive QA unless the owner explicitly authorizes losing app data.

## 6. Automated QA suite

The repository has 24 `scripts/*-harness.ts` files. Run focused harnesses first, then all 24 in one raw Windows capture.

Current files:

```text
accounting-draft-harness.ts
assignment-notify-harness.ts
car-delete-undo-harness.ts
chunk5-setup-harness.ts
chunk5-tires-harness.ts
chunk6a-refinement-harness.ts
chunk6b-lifecycle-harness.ts
chunk7-quick-adjust-harness.ts
chunk8-trackers-harness.ts
chunk9-export-help-harness.ts
confirm-sheet-harness.ts
garage-empty-state-harness.ts
muted-text-color-harness.ts
native-auth-callback-harness.ts
offline-indicator-harness.ts
play-policy-account-harness.ts
pull-on-resume-harness.ts
saved-flash-harness.ts
semantic-status-color-harness.ts
setup-touch-target-harness.ts
team-data-ownership-harness.ts
ux-r1-color-harness.ts
ux-r1-starters-harness.ts
uxf9p-owner-corrections-harness.ts
```

Focused examples:

```powershell
npx.cmd tsx scripts/chunk5-setup-harness.ts
npx.cmd tsx scripts/car-delete-undo-harness.ts
npx.cmd tsx scripts/setup-touch-target-harness.ts
npx.cmd tsx scripts/saved-flash-harness.ts
npx.cmd tsx scripts/offline-indicator-harness.ts
npx.cmd tsx scripts/pull-on-resume-harness.ts
```

Raw matrix pattern:

```powershell
$tests = Get-ChildItem scripts -Filter '*-harness.ts' | Sort-Object Name
$passed = 0
foreach ($test in $tests) {
  & npx.cmd tsx $test.FullName
  if ($LASTEXITCODE -ne 0) { throw "FAIL: $($test.Name)" }
  $passed++
}
"MATRIX $passed/$($tests.Count) PASS"
```

Current accepted result is exact 24/24. Preserve raw output for the final handoff. A focused pass cannot waive a matrix failure.

Harness rules:

- Compile real changed production code where practical.
- Assert behavior, not only source tokens.
- Give every important assertion an independent mutation that must fail.
- Preserve existing assertion/mutation coverage; never weaken a lock merely to make a repair green.
- Normalize CRLF/LF only at file-read boundaries where the owner-approved portability exception applies.
- Verify allowlisted paths, protected paths, `git diff --check`, and clean tree.

## 7. Browser QA procedure

Build first, deploy one fresh Netlify draft, then inspect the exact draft with the in-app Browser.

Required signed-out sizes:

- 360×800
- 390×844
- 412×915
- 1080×2118

At each size verify:

- Auth gate visible; no authenticated app shell leaks.
- `document.documentElement.scrollWidth <= clientWidth` and body has no horizontal overflow.
- Every visible control has at least a 44px effective target.
- Viewport metadata permits pinch zoom: `width=device-width, initial-scale=1.0, viewport-fit=cover` without `user-scalable=no`.
- No console warning/error.
- Light/dark and Default/Large when the state is available.

For final delivery, reset temporary viewport overrides. Finalize only the deliverable preview tab after all browser work is complete.

## 8. Android QA procedure

Install the exact freshly built APK. Record byte size and SHA-256 before testing.

Authenticated matrix on the app's actual CSS viewport:

- Dashboard
- Setups, including new setup, cards, Compare, attachment actions, and LF/RF corner geometry
- Loads
- Tires, including Add form
- Runs, including Quick Adjust and new-session sheet
- Checklist
- Maintenance and Logs sheet
- Accounting and add-money form
- Settings Garage, Account, Style, Export, and Guide

Run both Default/dark and Large/light at minimum. Every direct native control must be at least `44 * scale`; input-backed labels/semantic rows own checkbox/file/radio hit areas. Require zero page overflow or clipped controls.

Lifecycle checks:

- Cold launch.
- Three background/foreground cycles without Chrome DevTools attached.
- Tab switch, visibility/pagehide, native inactive, 30-second dirty timer, and session-create Saved boundaries.
- Force-stop before feedback, relaunch, and confirm local data persisted.
- Clear crash buffer before the scenario and inspect it afterward.

Runtime caveat discovered during final QA:

- Android 17/API 37 dev-key `x86_64` 16KB emulator with WebView `150.0.7871.46` reproducibly SIGILLs inside `libwebviewchromium.so` at `WV.yh1.onTrimMemory` when this WebView is backgrounded.
- No app frame or repo `onTrimMemory` override exists. APK 16KB alignment passes.
- The exact APK survived 3/3 cycles on stable Android 15/API 35, 4KB pages, WebView `124.0.6367.219`.
- Treat API 37/WebView 150 as a runtime residual, not justification for an app patch. Final release confidence should use a stable API 36 emulator or physical Android device when available.

## 9. Authorized deletion QA procedure

Use only the dedicated owner-supplied deletion-test account. Credentials remain out of band. Never delete another user's records, account, authentication identity, team, or membership.

Order matters:

1. Record local/cloud dataset counts and ownership.
2. Run **Clear this device only** first.
3. Verify local racing keys clear, auth/device registration remains, and built-in checklist starters may reseed.
4. Resume/pull and verify shared cloud data honestly returns.
5. Run **Delete my records everywhere** last.
6. Verify only records owned by the signed-in account are queued/deleted.
7. Wait for deferred queues to drain.
8. Background, cold restart, wait beyond pull cooldown, resume again, and prove old owned data does not return.
9. Accept creation of one new blank `My Car` as the app's empty-account bootstrap, not resurrection, only if its ID/timestamp is new and all old datasets remain zero.

Final attempt-3 execution completed this sequence successfully. Owned racing data remained cleared; account, login, team, and membership remained intact.

## 10. Current final-sprint state

All planned A1–E3 tasks and Chunk A–D gates are implemented. Final QA is not complete.

Accepted final repair evidence at `c897cfd`:

- Touch-target Repair 2 changes only `src/index.css` and `scripts/setup-touch-target-harness.ts`.
- Focused touch proof: 52 global-floor assertions; 6/6 required mutations killed; retained prior 48 assertions/12 mutations.
- Full raw matrix: 24/24.
- Lint: exact three known errors.
- Build: 566 transformed modules.
- Fresh draft: `https://6a5d5df113e70a34d7bf2539--crew-chief-race-notes.netlify.app`.
- Fresh debug APK: 12,087,764 bytes; SHA-256 `29E9A3A1CE0B51CA38759B6D7D1393C3352B46A61F315A361EDAE67A0E84F6A6`.
- Signed-out four-size browser matrix passed.
- Authenticated Android page/form matrix passed at Default and Large with zero undersized targets or page overflow.
- Owner-requested setup heading is `TIRE`; “From Inventory” is removed; corner cards and stacked steppers match accepted geometry.
- Authorized device-only/everywhere deletion sequence passed without old-data resurrection.
- Repair diff, protected paths, worktree cleanliness, and focused touch-target reviewer passed.

Final whole-branch review then found two release-blocking deletion-integrity defects. Final QA attempt 3 is therefore FAIL 82/100.

## 11. Outstanding Repair 3 — exact problems and solution

No Repair 3 implementation has started.

Escalation accounting: Part 6.3 scopes final-gate failures back to the offending
task. These are newly discovered reopened C1/D3 defects after earlier task PASS
verdicts, not three consecutive failed implementation attempts of either repair.
When work resumes, use one SOL High implementation task; primary Extra High remains
independent QA/plan authority.

### Blocker A — active Race Day setup deletion

`getSetupEditability` currently makes the exact active Race Day setup non-editable but deletable. Setup deletion removes its row, while the Race Day keeps `activeSetupId`. `resolveWeekendSetup` then returns null and next-run creation stops.

Recommended lifecycle amendment:

- Make the exact active Race Day setup non-editable and non-deletable while that Race Day is active.
- Keep unrelated Current setups editable/deletable.
- Do not silently recreate/rebind a replacement setup; that would change protected lifecycle meaning.

Generic deletion cleanup still must handle permitted source deletions:

- Calculate removed setup IDs once.
- Clear dangling `sourceSetupId` on surviving setups.
- Clear only matching top-level Race Day `setupId`, `sourceSetupId`, `baselineSetupId`, `activeSetupId`, and `finalSetupId`.
- Stamp only changed surviving setups/Race Days with one fresh ISO timestamp.
- Update canonical refs, React state, localStorage, and existing setup/weekend pushes.
- Queue exact removed setup IDs through existing delete machinery.
- Preserve every `sessions[]` byte.

### Blocker B — car-cascade timestamp resurrection

Car cascade clears a surviving setup's `sourceSetupId` and Race Day top-level pointers without advancing `updatedAt`. A failed/racing push followed by pull can let equal-timestamp stale cloud rows win and restore those pointers.

Repair:

- Create one cascade commit timestamp.
- Assign it to each surviving setup whose lineage changed.
- Assign it to each Race Day whose top-level pointer changed.
- Keep untouched records byte-identical.
- Repair `race_notes_setup` only when it is the same repaired surviving setup; preserve unrelated active setup bytes.
- Keep delete queues, push order, retry rules, sync status, schema, and session history unchanged.

### Exact proposed file scope

- `src/lib/setupLifecycle.ts`
- `src/App.tsx`
- `scripts/chunk5-setup-harness.ts`
- `scripts/car-delete-undo-harness.ts`

No `sync.ts`, component, type, native, package, config, schema, RLS, migration, Edge Function, release, or Sprint 4 change is presently indicated.

### Required Repair 3 proof

- Real active-setup removal attempt performs zero writes, zero queue, zero push, and no false Saved.
- Permitted source deletion clears every required surviving lineage/top-level pointer and nothing else.
- Changed records receive a strictly newer timestamp; unchanged record bytes remain exact.
- React refs/state, localStorage, and setup/weekend pushes contain identical repaired records.
- Race Day `sessions[]`, session `setupId`, and embedded `setupSnapshot` remain byte-identical.
- Real stale-cloud merge fixture proves repaired local rows beat pre-repair cloud rows after simulated push failure.
- Signed-out repair survives later sign-in/pull without stale-pointer restoration.
- Active setup cache repairs only when its exact saved twin changed.
- Independent mutations remove the active-delete guard, each cleanup, each timestamp, cache repair, persistence, and push; every mutation must fail.
- Focused setup/car/Saved/offline/resume/lifecycle/Quick Adjust/tire/touch regressions pass.
- Raw matrix remains 24/24; lint remains exact three; build remains 566.
- Fresh draft/debug artifacts, stable Android lifecycle, whole-branch review, exact scope, protected paths, and clean tree pass.

## 12. Remaining closeout after Repair 3 passes

1. Primary Extra High independently reruns Repair 3 gates.
2. Rerun full Part 6.3 owner-complaint and cross-chunk matrix.
3. Obtain final cavecrew whole-branch review with zero blocking findings.
4. Produce the Part 6.4 cold-reader handoff packet; it reports evidence but does not claim third-party review passed.
5. Update `ralph/STATE.md`, `ralph/CURRENT_TASK.md`, plan snapshot, this guide, and `docs/OWNER_REPORT_UX_OVERHAUL.md`.
6. Commit final governance/docs.
7. Build one final debug APK and deploy one final Netlify draft.
8. Push `codex/ux-overhaul` as a saving point only. No PR, master merge, production Netlify publish, release build, signing, AAB, schema change, or Sprint 4 work.

## 13. Known nonblocking residuals

- API 37 dev emulator/WebView 150 `onTrimMemory` SIGILL described above.
- Capacitor safe-area injection may log pre-root diagnostics before `document.documentElement` exists.
- WebView can preserve old Workbox assets across `adb install -r`.
- Dashboard may require two Android Back presses to exit.
- Dead internal `quickref` union member remains.
- Pending-delete ContextStrip presentation remains cosmetic backlog.
- Empty best-lap display may render a bare `s`.
- BottomSheet lacks a full focus trap.
- `src/App.tsx` remains a large centralized orchestrator by project design.
- `src/lib/location.ts` remains intentional unwired scaffold.
- Sprint 4 IA remains deferred.

None of these residuals authorizes scope expansion during Repair 3.
