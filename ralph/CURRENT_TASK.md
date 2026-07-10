# Current Task — WS-S: Push Infrastructure — COMPLETE

**Status:** COMPLETE — attempt 1, PASS 93/100 (commit 93d870d). See STATE.md.

WS-S delivered: `src/lib/push.ts` (native + web register/unregister), `public/firebase-messaging-sw.js` (scoped, excluded from Workbox precache), `supabase/functions/send-push/index.ts` (team-verified FCM v1 fan-out + token prune, deployed live with verify_jwt), App/supabase auth wiring, Android POST_NOTIFICATIONS + notification channel.

Verified live: lint 3-baseline, build green, both service workers in dist (FCM SW absent from Workbox precache), edge function ACTIVE + 401/405/no-user-401 smoke checks.

Deferred to WS-Y (need signed-in user JWT + device): send-push 400/403/200 + notifications insert + token prune + notification rendering.

OWNER ACTION: add `nimbus.engineering.crewchief://auth-callback` to Supabase Auth → URL Configuration → Redirect URLs (native sign-in).

Next unblocked workstreams: WS-T (location sharing), WS-U (needs WS-S ✓ — now unblocked). WS-W deferred by owner; WS-X needs WS-T + WS-W; WS-Y last.
