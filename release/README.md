# CREW CHIEF Android release artifacts

- `CrewChief-5.2.1-play.aab` — upload this signed bundle to Google Play Console.
- `CrewChief-5.2.1-debug.apk` — debug-only QA package; do not upload to Google Play.
- `SHA256SUMS.txt` — artifact integrity hashes.

- Package: `nimbus.engineering.crewchief`
- Play bundle: version code `24`, version name `5.2.1`
- Debug APK: version code `24`, version name `5.2.1`
- Minimum API: `24`
- Target/compile API: `36`

AAB JAR signature and debug APK v2 signature were verified. The AAB upload certificate is
`5CE2F57CB9FB130388062BB352D717F0EF89F7522351915FF10804256E098098`, matching the prior 5.1 and
5.1.1 Play bundles. Confirm Google Play reports that same upload certificate before submission.
No 5.2.1 release APK was produced.

## 5.2.0 is withdrawn — do not upload it

**Version code `23` / version name `5.2.0` is burned. It was uploaded to Play Console and must
never be reused.** That bundle was built in a `git worktree` with no `.env`, so Vite baked the
`https://offline.invalid` / `offline-anon-key` fallback from `src/lib/supabase.ts` into the app.
Every auth request went to a host that does not resolve, so **no sign-in method worked at all** —
neither email/password nor Google. The app booted and looked completely healthy, which is why
lint, `cap sync`, Gradle, signing, and manifest checks all passed on a build nobody could log in to.

5.2.1 / code `24` is the corrected replacement. Superseded 5.2.0 artifacts were deleted from this
directory; their hashes were `BE61AC8C…0152465` (aab) and `6D435CB4…C3E81649` (debug apk).

## 5.2.1 verification

- Packaged bundle contains `https://swblfeayxoprodhwxqak.supabase.co`; `offline.invalid` and
  `offline-anon-key` are absent from both artifacts.
- The URL and anon key were extracted *from inside the AAB* and live-checked against
  `/auth/v1/settings` → HTTP 200, with the `google` and `email` providers both enabled.
- Native OAuth round trip intact: both callback schemes
  (`nimbus.engineering.crewchief://`, `com.racenotes.app://`), `getLaunchUrl` cold-start handling,
  and `error_description` surfacing are all present.
- `aapt2 dump badging`: package `nimbus.engineering.crewchief`, code `24`, name `5.2.1`, target API `36`.
- `tsc --noEmit`: the three known baseline errors only.

## Build prerequisites — read before building from a worktree

`vite build` now aborts when Supabase env vars are missing or are placeholders; see
`scripts/viteRequireCloudConfig.ts`. Set `ALLOW_UNCONFIGURED_BUILD=1` only for a deliberate
offline bundle, which must never be uploaded.

These five files are gitignored and are **not** copied by `git worktree add`. Copy all of them
from the main checkout before building, or the build will fail (or silently degrade):

| File | Missing it causes |
| --- | --- |
| `.env` | No Supabase config → no sign-in at all (the 5.2.0 defect) |
| `.env.local` | No Firebase push, no HERE routing/geocoding |
| `android/local.properties` | Gradle cannot locate the Android SDK |
| `android/keystore.properties` | Release bundle cannot be signed |
| `android/app/google-services.json` | Gradle release build fails by design |

## Historical artifacts

- `CrewChief-5.1.1-play.aab` — prior Play bundle, version code `19`.
- `CrewChief-5.1.4-release.apk` — prior signed direct-install package, version code `22`.

Do not distribute `CrewChief-5.1.3-release.apk`: it omitted Firebase configuration and can
crash immediately after a successful sign-in when native push registration starts.
