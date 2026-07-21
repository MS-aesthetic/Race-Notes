# CREW CHIEF Race Notes

Mobile-first dirt-track racing logbook and pit-side crew-chief tool. React 19, TypeScript,
Vite PWA, Capacitor Android, and optional Supabase sync.

## Local web app

```powershell
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` when cloud auth/sync is needed. App keeps local-first
offline behavior without cloud credentials.

## Validation

```powershell
npm run lint
npm run build
```

Lint currently has three documented pre-existing TypeScript errors. See `AGENTS.md`.

## Android

Android package: `nimbus.engineering.crewchief`.

```powershell
npm run android:build:debug
npm run android:build:release
npm run android:build:bundle
```

Release signing uses ignored `android/keystore.properties` or these environment variables:
`ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
`ANDROID_KEY_PASSWORD`. Never commit signing credentials, keystores, Firebase configuration,
or local SDK paths.

## Project guidance

**Context hub: [`context/`](./context/README.md)** — consolidated knowledge, archived planning,
and the agent/skill index. Start there when onboarding an agent.

Read `HANDOFF.md`, `SPRINT_INDEX.md`, `ralph/STATE.md`, and `AGENTS.md` before feature work.
Production deploys and release merges require explicit owner approval.
