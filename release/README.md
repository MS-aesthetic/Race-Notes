# CREW CHIEF 5.1 Android release

- `CrewChief-5.1-play.aab` — upload this file to Google Play Console.
- `CrewChief-5.1-release.apk` — signed direct-install release package.
- `CrewChief-5.1-debug.apk` — debug-signed local QA package; never upload it to Google Play.
- `SHA256SUMS.txt` — artifact integrity hashes.

- Package: `nimbus.engineering.crewchief`
- Version code: `18`
- Version name: `5.1`
- Target/compile API: `36`

APK and AAB signatures were verified and use the same certificate. Confirm Google Play's
highest existing version code is below 18 and that the listed upload certificate matches the
Play Console upload key before submission.
