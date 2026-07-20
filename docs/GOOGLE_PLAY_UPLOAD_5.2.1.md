# CREW CHIEF 5.2.1 — Google Play upload

Supersedes `GOOGLE_PLAY_UPLOAD_5.2.0.md`. **5.2.0 / version code `23` is withdrawn and must never
be uploaded again.** See "Why 5.2.0 was withdrawn" below.

## Release identity

- Source branch: `codex/ux-overhaul`
- Play bundle: `release/CrewChief-5.2.1-play.aab`
- Debug QA package: `release/CrewChief-5.2.1-debug.apk`
- Package: `nimbus.engineering.crewchief`
- Version code: `24`
- Version name: `5.2.1`
- Minimum API: `24`
- Target/compile API: `36`
- Firebase configuration contains package `nimbus.engineering.crewchief`.

Do not upload the debug APK to Google Play. No 5.2.1 release APK was built.

## Artifact evidence

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `CrewChief-5.2.1-debug.apk` | 11,741,105 | `C220BC2D10589DDCB6ABD4E89A8FD42E99F26F040AF88AB77BFFF3FB8033C5A6` |
| `CrewChief-5.2.1-play.aab` | 9,968,398 | `08A11E50A1AB028596C528EF1C789BF07D56FE298619A13A6184DC215F8018BE` |

- `aapt2 dump badging` reports package `nimbus.engineering.crewchief`, version code `24`,
  version name `5.2.1`, target/compile API `36`.
- AAB contains 552 entries; debug APK contains 549.
- `jarsigner -verify` passes on the AAB.
- AAB upload certificate SHA-256 is
  `5CE2F57CB9FB130388062BB352D717F0EF89F7522351915FF10804256E098098`, matching both
  `CrewChief-5.1-play.aab` and `CrewChief-5.1.1-play.aab`.

## Cloud configuration evidence (new gate — do not skip)

This is the check that 5.2.0 lacked. It asserts on the shipped bytes, not on the build log.

- Packaged web bundle contains `https://swblfeayxoprodhwxqak.supabase.co`.
- `offline.invalid` and `offline-anon-key` are **absent** from both artifacts.
- The Supabase URL and anon key were extracted *from inside the AAB* and live-checked against
  `https://swblfeayxoprodhwxqak.supabase.co/auth/v1/settings` → **HTTP 200**, with the `google`
  and `email` providers both reported enabled.
- Native OAuth round trip intact in the bundle: `nimbus.engineering.crewchief://auth-callback`,
  legacy `com.racenotes.app://auth-callback`, `getLaunchUrl` cold-start handling, and
  `error_description` surfacing.

## Build gates

- `tsc --noEmit`: exact three known baseline TypeScript errors only.
- `npm run build`: passed, 566 modules transformed.
- `npx cap sync android`: passed, six Capacitor plugins.
- `android\gradlew.bat assembleDebug bundleRelease`: BUILD SUCCESSFUL, 573 actionable tasks.

## Why 5.2.0 was withdrawn

5.2.0 was built in a `git worktree` that had no `.env`. `.env*` is gitignored, so
`git worktree add` never copied it. Vite therefore resolved `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` to empty strings, and the fallback in `src/lib/supabase.ts` silently
substituted `https://offline.invalid` / `offline-anon-key`.

Result: every auth request went to a host that does not resolve, so **no sign-in method worked** —
neither email/password nor Google. The app booted and rendered normally, so lint, `cap sync`,
Gradle, signing, and manifest verification all passed on a build nobody could log in to.

Blast radius was Android only. Netlify production was checked and serves
`assets/index-B_4vFR3d.js`, which contains the real project ref and no placeholders.

Prevention now in place:

- `scripts/viteRequireCloudConfig.ts` aborts `vite build` when the Supabase vars are missing,
  empty, placeholders, or malformed. Escape hatch: `ALLOW_UNCONFIGURED_BUILD=1`, for deliberate
  offline bundles that must never be uploaded.
- The cloud configuration evidence section above is now a required release gate.

## Manual Google Play upload remaining

1. Sign in to [Google Play Console](https://play.google.com/console/) and select **CREW CHIEF**.
2. Open the intended testing or production track and create a new release.
3. Confirm Play App Signing remains enabled.
4. **Discard or halt any existing 5.2.0 (code 23) release that is still live or in review.**
5. Upload `release/CrewChief-5.2.1-play.aab`.
6. Stop if Play does not report package `nimbus.engineering.crewchief`, version code `24`,
   version name `5.2.1`, target API `36`, or the expected upload certificate above.
7. Add release notes, review warnings and device changes, then save the draft.
8. Review every pending change in Publishing overview before starting rollout.
9. After approval, install from Google Play on a test device and verify **both email/password and
   Google sign-in first**, then notification registration, Setup and Race Day flows, offline save,
   account deletion, and return-to-app refresh.

Manual Play Console upload, review, and rollout remain owner actions.

## Outstanding item not verifiable from the repo

Confirm `nimbus.engineering.crewchief://auth-callback` is present in Supabase →
Authentication → URL Configuration → Redirect URLs. It is not exposed through the API, so it
could not be asserted here. If native Google sign-in still fails on a build whose credentials
verify, this is the next thing to check.

Suggested English release notes:

> Fixes a problem that prevented signing in with email or Google. Also includes the redesigned
> Setup corner controls and mobile spacing, clearer save and sync feedback, safer setup and car
> deletion, stronger Race Day setup history, improved help and labels, larger touch targets, and
> more reliable offline and resume behavior.
