# CREW CHIEF 5.2.0 — Google Play upload

## Release identity

- Source branch: `codex/ux-overhaul`
- Source HEAD: `7c20da080884ea89df09205fd0e8785dbac63871`
- Play bundle: `release/CrewChief-5.2.0-play.aab`
- Debug QA package: `release/CrewChief-5.2.0-debug.apk`
- Package: `nimbus.engineering.crewchief`
- Version code: `23`
- Version name: `5.2.0`
- Minimum API: `24`
- Target/compile API: `36`
- Firebase configuration contains package `nimbus.engineering.crewchief`.

Do not upload the debug APK to Google Play. No 5.2.0 release APK was built.

## Artifact evidence

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `CrewChief-5.2.0-debug.apk` | 11,740,533 | `6D435CB4E31DFE9DAE27ABA3034D2AC8BF5B6F91EA4629B9C0A295F3C3E81649` |
| `CrewChief-5.2.0-play.aab` | 9,967,844 | `BE61AC8C443DCE05272DC14516120884DB55C4757713926D94F361DFE0152465` |

Verification completed on Windows with Java 21 and Android SDK build tools:

- APK badging reports package `nimbus.engineering.crewchief`, version code `23`, version name `5.2.0`, minimum API `24`, and target/compile API `36`.
- APK Signature Scheme v2 verification passes. Debug signer certificate SHA-256 is `38339D3AECDCE26AD76F41E67D0C733DB00C0957ECD5B2D301C94E5F768790FA`.
- AAB contains 552 entries, including `BundleConfig.pb`, base manifest, resources, classes, and web entry assets.
- `jarsigner` verifies the AAB signature.
- AAB upload certificate SHA-256 is `5CE2F57CB9FB130388062BB352D717F0EF89F7522351915FF10804256E098098`.
- Upload certificate matches both prior `CrewChief-5.1-play.aab` and `CrewChief-5.1.1-play.aab`.
- Prior bundle hashes match retained history: 5.1 is `8C79DAAEB0092B61D07B0BD348DD42D8945E067ED1DBB6D6F94CF305FE8D784B`; 5.1.1 is `4AF615DAB523BD8B5450452A2AEB1B545F92A252D24236FD19E42638B9B0BFE5`.

Build gates:

- `npm.cmd run lint`: exact three known baseline TypeScript errors only.
- `npm.cmd run build`: passed with exactly 566 transformed modules.
- `npx.cmd cap sync android`: passed with six Capacitor plugins.
- `android\gradlew.bat assembleDebug bundleRelease`: passed; 573 actionable tasks, 353 executed and 220 up-to-date.

## Manual Google Play upload remaining

1. Sign in to [Google Play Console](https://play.google.com/console/) and select **CREW CHIEF**.
2. Open the intended testing or production track and create a new release.
3. Confirm Play App Signing remains enabled.
4. Upload `release/CrewChief-5.2.0-play.aab`.
5. Stop if Play does not report package `nimbus.engineering.crewchief`, version code `23`, version name `5.2.0`, target API `36`, or the expected upload certificate above.
6. Add release notes, review warnings and device changes, then save the draft.
7. Review every pending change in Publishing overview before starting rollout or submitting for review.
8. After approval, install from Google Play on a test device and verify sign-in, notification permission/registration, Setup and Race Day flows, offline save, account deletion, and return-to-app refresh.

Manual Play Console upload, review, and rollout remain owner actions. This build task performed no Netlify deployment, Play upload, or production publish.

Suggested English release notes:

> Redesigned Setup corner controls and mobile spacing, clearer save and sync feedback, safer setup and car deletion, stronger Race Day setup history, improved help and labels, larger touch targets, and more reliable offline/resume behavior.

The primary release step subsequently published the same accepted web build to Netlify production as deploy `6a5d8c1eadd194bdc614ea33`. The production app, privacy page, account-deletion page, JavaScript, and CSS returned HTTP 200. Google Play upload and rollout were not performed.
