# CREW CHIEF 5.1 — Google Play upload

## Files and identity

- Play bundle: `release/CrewChief-5.1-play.aab`
- Store icon: `Crew-Chief-Headset-Play-Icon-512.png`
- Package: `nimbus.engineering.crewchief`
- Version code: `18`
- Version name: `5.1`
- Developer entity: `Nimbus Engineering`
- Privacy policy: `https://crew-chief-race-notes.netlify.app/privacy/`
- Account deletion: `https://crew-chief-race-notes.netlify.app/delete-account/`

Do not upload the debug APK to Google Play. Google Play uses the signed Android App Bundle
and generates device-specific APKs from it.

## Upload steps

1. Sign in to [Google Play Console](https://play.google.com/console/) and select **CREW CHIEF**.
   If this is the first release, create the app with the exact package identity above and accept
   Play App Signing. Package names are permanent.
2. Complete every dashboard setup item before creating the release:
   - Main store listing, contact email, app category, short/full description.
   - Upload `Crew-Chief-Headset-Play-Icon-512.png` as the store icon.
   - Upload required phone screenshots and a 1024×500 feature graphic.
   - App content: privacy policy, Data safety, ads declaration, app access, target audience,
     content rating, and account deletion questions.
   - Enter the privacy and account-deletion URLs listed above. CREW CHIEF supports both
     in-app deletion and a public web request path.
   - If review needs authenticated access, provide a dedicated non-production test account in
     **App access**. Do not provide an owner or production credential.
3. For safest rollout, start with **Test and release → Internal testing**. After testing, use
   **Test and release → Production**. Select **Create new release**.
4. Confirm **Play App Signing** is active. Upload `release/CrewChief-5.1-play.aab`.
5. Confirm Play Console reads package `nimbus.engineering.crewchief`, version code `18`,
   version name `5.1`, target API 36, and the expected upload certificate. Stop if any identity
   or signing value differs.
6. Add release notes, save the draft, then select **Next**. Recommended English notes:

   > Improved mobile Setup layouts, checklist assignment notifications, automatic data refresh
   > when returning to the app, clearer Garage actions, safer undo and confirmations, stronger
   > accessibility, and updated privacy and account-deletion controls.

7. Resolve blocking errors. Review non-blocking warnings, supported-device changes, App Bundle
   Explorer output, and the automated pre-launch report.
8. Use **Publishing overview** to inspect every pending change. For internal testing, start the
   test rollout. For production, select the desired countries and rollout percentage, then send
   the release for review. A staged production rollout is safer than immediate 100% release.
9. After approval, verify the live listing, install from Google Play on a test device, sign in,
   confirm push-notification permission and delivery, then test Setup, checklist assignment,
   account deletion, offline save, and return-to-app refresh.

Personal developer accounts created after November 13, 2023 may need to satisfy Google's testing
requirement before production becomes available.

## Official references

- [Upload an Android App Bundle](https://developer.android.com/studio/publish/upload-bundle)
- [Prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348)
- [Create and set up an app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Store listing preview-asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Data safety declaration](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
