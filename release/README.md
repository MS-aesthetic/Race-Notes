# CREW CHIEF Android release artifacts

- `CrewChief-5.2.0-play.aab` — upload this signed bundle to Google Play Console.
- `CrewChief-5.2.0-debug.apk` — debug-only QA package; do not upload to Google Play.
- `SHA256SUMS.txt` — artifact integrity hashes.

- Package: `nimbus.engineering.crewchief`
- Play bundle: version code `23`, version name `5.2.0`
- Debug APK: version code `23`, version name `5.2.0`
- Minimum API: `24`
- Target/compile API: `36`

AAB JAR signature and debug APK v2 signature were verified. The AAB upload certificate matches
the prior 5.1 and 5.1.1 Play bundles. Confirm Google Play reports that same upload certificate
before submission. No 5.2.0 release APK was produced.

Historical artifacts remain available for rollback/reference:

- `CrewChief-5.1.1-play.aab` — prior Play bundle, version code `19`.
- `CrewChief-5.1.4-release.apk` — prior signed direct-install package, version code `22`.

Do not distribute `CrewChief-5.1.3-release.apk`: it omitted Firebase configuration and can
crash immediately after a successful sign-in when native push registration starts.
