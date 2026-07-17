# CREW CHIEF Android release artifacts

- `CrewChief-5.1.1-play.aab` — upload this file to Google Play Console.
- `CrewChief-5.1.4-release.apk` — signed direct-install package with working Google OAuth and Firebase-backed notification registration.
- `SHA256SUMS.txt` — artifact integrity hashes.

- Package: `nimbus.engineering.crewchief`
- Play bundle: version code `19`, version name `5.1.1`
- Direct APK: version code `22`, version name `5.1.4`
- Target/compile API: `36`

AAB and APK signatures were verified. Confirm Google Play's listed upload certificate matches
the upload key before submission.

Do not distribute `CrewChief-5.1.3-release.apk`: it omitted Firebase configuration and can
crash immediately after a successful sign-in when native push registration starts.
