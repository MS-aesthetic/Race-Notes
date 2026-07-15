# Current Task — Play Privacy + Account Deletion

**Status:** QA_PASS · LIVE BACKEND ACTIVE · Netlify draft verified
**Branch/worktree:** `codex/play-policy-delete-account` · `C:\Users\maxx\antigravity\Race-Notes`
**Owner request:** Implement Google Play blockers: privacy policy and in-app account deletion.

Delivered:

- Settings → Account privacy policy and typed `DELETE` confirmation.
- Failed server deletion preserves device racing data. A post-revocation Auth failure clears cached auth only and requires sign-in/retry.
- JWT-authenticated `delete-account` Edge Function; caller identity comes only from `auth.getUser()`.
- Owned Storage removal, team-owner transfer/empty-team cleanup, cached teammate identity cleanup, global session revoke, hard Auth deletion.
- Public `/privacy/` and `/delete-account/` pages; Netlify deletion/privacy request form.
- Applied live migrations `20260715161026`, `20260715161241`, `20260715161505`, `20260715161637`; Edge Function version 1 ACTIVE with JWT verification.
- Storage policies reject deleted/stale users; broad team-banner listing removed; tire cascade/index verified.

Evidence: focused policy/deletion harness PASS; exact three-error lint baseline; production build PASS; cavecrew security review PASS; unauthenticated function smoke `401/401/405`; relevant Supabase advisor findings zero.

Final draft: `https://6a57b47b1712493e1f563ff9--crew-chief-race-notes.netlify.app/`. Public pages passed 390px overflow/content/console checks; Netlify detected `account-deletion-request` with honeypot and zero submissions. Stable Play URLs require an explicit production Netlify publish. Confirm Play Console developer name matches **Nimbus Engineering** before submission. Do not test destructive deletion against an owner account.
